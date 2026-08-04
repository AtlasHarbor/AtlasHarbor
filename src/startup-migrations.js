import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

function runPsql(databaseUrl,args,input){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.PSQL_BIN||'psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--dbname',databaseUrl,...args],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);
  child.stderr.on('data',chunk=>stderr+=chunk);
  child.on('error',error=>reject(new Error(error.code==='ENOENT'?'The psql executable is not installed. Install PostgreSQL client tools or disable AUTO_MIGRATE.':error.message)));
  child.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr.trim()||`psql exited with code ${code}`)));
  if(input)child.stdin.end(input);else child.stdin.end();
 });
}

export async function runStartupMigrations({env=process.env,root=process.cwd()}={}){
 const databaseUrl=env.DATABASE_URL||env.SUPABASE_DATABASE_URL;
 const enabled=String(env.AUTO_MIGRATE??'true').toLowerCase()!=='false';
 if(!enabled)return{enabled:false,status:'disabled'};
 if(!databaseUrl)return{enabled:true,status:'skipped',reason:'DATABASE_URL is not configured'};
 const exists=(await runPsql(databaseUrl,['--tuples-only','--no-align','--command',"select to_regclass('public.admin_system') is not null;"])).trim()==='t';
 if(exists)return{enabled:true,status:'ready',created:false};
 const migrationPath=path.join(root,'supabase','admin-ai-featured.sql');
 const sql=await fs.readFile(migrationPath,'utf8');
 await runPsql(databaseUrl,[],sql);
 return{enabled:true,status:'ready',created:true,migration:'supabase/admin-ai-featured.sql'};
}
