const base=String(process.env.ATLAS_TEST_BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const email=String(process.env.ATLAS_E2E_TEST_EMAIL||'').trim();
const password=String(process.env.ATLAS_E2E_TEST_PASSWORD||'');
const playerId=String(process.env.ATLAS_E2E_PLAYER_ID||'695491');

if(!email||!password)throw new Error('Set ATLAS_E2E_TEST_EMAIL and ATLAS_E2E_TEST_PASSWORD before running the smoke test.');

async function json(url,options={}){
 const response=await fetch(url,options),text=await response.text();
 let data={};try{data=text?JSON.parse(text):{}}catch{}
 if(!response.ok)throw new Error(`${options.method||'GET'} ${url} failed (${response.status}): ${data.error||data.message||text}`);
 return data;
}

const config=await json(`${base}/api/config`,{headers:{Accept:'application/json'}});
if(!config?.supabaseUrl||!config?.supabasePublishableKey)throw new Error('Public Supabase config is unavailable.');
const auth=await json(`${String(config.supabaseUrl).replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
const token=auth.access_token;if(!token)throw new Error('Test login returned no access token.');
const headers={Accept:'application/json',Authorization:`Bearer ${token}`};

const playerResponse=await json(`${base}/api/baseball/prospect-players/${encodeURIComponent(playerId)}`,{headers:{Accept:'application/json'}});
if(!playerResponse.player?.id)throw new Error('Player API returned no normalized player payload.');

await json(`${base}/api/workspaces/status`,{headers});
const resourceUrl=`${base}/api/workspaces/baseball_player/${encodeURIComponent(playerId)}`;
await json(resourceUrl,{headers});
const marker=`Atlas Harbor E2E ${new Date().toISOString()}`;
const saved=await json(resourceUrl,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({intent:'publish',resource_type:'baseball_player',resource_id:playerId,resource_title:playerResponse.player.name||`Player ${playerId}`,title:'E2E Baseball player analysis',body:`<p>${marker}</p>`,is_shared:true,is_published:true,featured:false,projections:[]})});
const tokenValue=saved.workspace?.share_token;if(!tokenValue)throw new Error('Workspace publish returned no share token.');

const anonymous=await json(`${base}/api/published-feed/${encodeURIComponent(tokenValue)}`,{headers:{Accept:'application/json'},cache:'no-store'});
const authenticated=await json(`${base}/api/published-feed/${encodeURIComponent(tokenValue)}`,{headers,cache:'no-store'});
if(!anonymous.publication||!authenticated.publication)throw new Error('Publication detail is not available in both anonymous and authenticated reads.');
if(anonymous.publication.share_token!==authenticated.publication.share_token)throw new Error('Authenticated publication detail does not match anonymous publication detail.');
if(!String(anonymous.publication.body||'').includes(marker))throw new Error('Published body does not contain the saved smoke-test marker.');

console.log(JSON.stringify({ok:true,base,playerId,playerName:playerResponse.player.name,workspaceStorage:saved.storage||null,shareToken:tokenValue,anonymousVisible:true,authenticatedVisible:true},null,2));
