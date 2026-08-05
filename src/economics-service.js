import crypto from 'node:crypto';
import {runEconomicsNow} from './admin-runs.js';

export const DEFAULT_ECONOMICS={source_name:'Financial Times',source_url:'',source_type:'rss',cadence_hours:12,max_items:8,ai_items_per_run:6,ai_instruction:'Convert each economic story into a clear decision problem with stakeholders, constraints, tradeoffs, questions, and relevant topics.',enabled:false,last_started_at:null,last_run_at:null,last_error:null,last_result:null,current_run:null,run_log:[],problems:[]};
const b64decode=value=>Buffer.from(value,'base64url');
function decrypt(value,env){if(!value)return null;try{const key=crypto.createHash('sha256').update(env.ADMIN_ENCRYPTION_KEY||env.SUPABASE_SECRET_KEY||'atlas-harbor-admin-key').digest(),[iv,tag,body]=String(value).split('.').map(b64decode),decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8')}catch{return null}}
const providers=(config,env)=>{const ai=config?.ai||{};return[{name:'primary',endpoint:ai.primaryEndpoint,model:ai.primaryModel,key:decrypt(ai.primaryKeyCiphertext,env)},{name:'backup',endpoint:ai.backupEndpoint,model:ai.backupModel,key:decrypt(ai.backupKeyCiphertext,env)}]};
const researchProvider=(config,env)=>{const research=config?.research||{},key=decrypt(research.apiKeyCiphertext,env)||env.PERPLEXITY_API_KEY;return key?{key,model:research.model||'sonar-pro'}:null};
const bySource=item=>String(item?.source_url||item?.sourceUrl||item?.source_title||item?.sourceTitle||'').toLowerCase();
function mergeProblems(existing,incoming){const map=new Map();for(const item of [...incoming,...existing]){const key=bySource(item);if(key&&!map.has(key))map.set(key,item)}return[...map.values()].sort((a,b)=>String(b.source_published_at||b.published_at).localeCompare(String(a.source_published_at||a.published_at))).slice(0,60)}
function summaryResult(result){const copy={...result};delete copy.problems;return copy}

export function createEconomicsService({storage,env=process.env,fetchImpl=globalThis.fetch}={}){
 if(!storage)throw new Error('Economics storage is required.');
 let activeRun=null,timer=null;
 async function state(){const account=await storage.readHost();const config=account?.user_metadata?.atlas_admin||null;return{account,config,economics:{...DEFAULT_ECONOMICS,...(config?.economics||{})}}}
 async function status(){const current=await state();return{configured:Boolean(current.config),settings:current.economics,storage:storage.configured?'supabase-account-metadata':'unavailable'}}
 async function execute(runId,trigger){
  try{
   const current=await state();if(!current.config)throw new Error('Administrator has not been initialized.');const economics={...DEFAULT_ECONOMICS,...current.economics};
   const result=await runEconomicsNow({fetchImpl,settings:economics,providers:providers(current.config,env),instruction:economics.ai_instruction,existingProblems:economics.problems||[],researchProvider:researchProvider(current.config,env)}),finishedAt=new Date().toISOString();
   await storage.updateHost(metadata=>{const admin={...(metadata.atlas_admin||{})},latest={...DEFAULT_ECONOMICS,...(admin.economics||{})},problems=result.ok?mergeProblems(latest.problems||[],result.problems||[]):latest.problems||[],entry={runId,trigger,startedAt:latest.current_run?.startedAt||latest.last_started_at,finishedAt,ok:Boolean(result.ok),...summaryResult(result)};admin.economics={...latest,problems,last_run_at:finishedAt,last_error:result.ok?null:result.reason||'Economics run failed.',last_result:entry,current_run:null,run_log:[entry,...(latest.run_log||[])].slice(0,30)};return{...metadata,atlas_admin:admin}});
   return result;
  }catch(error){const finishedAt=new Date().toISOString();await storage.updateHost(metadata=>{const admin={...(metadata.atlas_admin||{})},latest={...DEFAULT_ECONOMICS,...(admin.economics||{})},entry={runId,trigger,startedAt:latest.current_run?.startedAt||latest.last_started_at,finishedAt,ok:false,reason:error.message};admin.economics={...latest,last_run_at:finishedAt,last_error:error.message,last_result:entry,current_run:null,run_log:[entry,...(latest.run_log||[])].slice(0,30)};return{...metadata,atlas_admin:admin}}).catch(()=>{});throw error
  }finally{activeRun=null}
 }
 async function trigger({trigger='public'}={}){
  const current=await state();if(!current.config)throw Object.assign(new Error('Administrator has not been initialized.'),{status:409});const economics=current.economics;
  if(!economics.source_url)throw Object.assign(new Error('The Economics feed URL is not configured.'),{status:409});
  const last=Date.parse(economics.last_started_at||0),elapsed=Date.now()-last;if(activeRun||economics.current_run)throw Object.assign(new Error('An Economics run is already in progress.'),{status:409});if(Number.isFinite(last)&&last>0&&elapsed<60000)throw Object.assign(new Error(`Economics was triggered recently. Try again in ${Math.ceil((60000-elapsed)/1000)} seconds.`),{status:429});
  const runId=crypto.randomUUID(),startedAt=new Date().toISOString();
  await storage.updateHost(metadata=>{const admin={...(metadata.atlas_admin||{})},latest={...DEFAULT_ECONOMICS,...(admin.economics||{})};admin.economics={...latest,last_started_at:startedAt,current_run:{runId,trigger,startedAt,status:'running'}};return{...metadata,atlas_admin:admin}});
  activeRun=execute(runId,trigger).catch(error=>console.error('Economics run failed',error));
  return{ok:true,accepted:true,runId,status:'running',startedAt};
 }
 async function maybeRunScheduled(){try{const current=await state(),economics=current.economics;if(!current.config||!economics.enabled||!economics.source_url||activeRun||economics.current_run)return;const last=Date.parse(economics.last_run_at||0),cadence=Math.max(1,Number(economics.cadence_hours)||12)*3600000;if(!last||Date.now()-last>=cadence)await trigger({trigger:'schedule'})}catch(error){if(error.status!==429&&error.status!==409)console.error('Economics scheduler failed',error)}}
 function startScheduler(){if(timer)return;timer=setInterval(maybeRunScheduled,60000);timer.unref?.();setTimeout(maybeRunScheduled,5000).unref?.()}
 return{state,status,trigger,startScheduler,maybeRunScheduled};
}
