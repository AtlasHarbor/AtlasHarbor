import{user,rest,updateUserMetadata}from'./supabase-client.js';

const LOCAL_KEY='atlas-game-state';
let timer=null,loading=false,resetting=false;
const status=message=>window.dispatchEvent(new CustomEvent('atlas-game-save-status',{detail:{message}}));
function metadataProgress(){return user()?.user_metadata?.atlas_problem_spaces?.logistics_game?.progress||null}
async function legacyProgress(){const current=user();if(!current)return null;try{const rows=await rest('game_progress',{query:`?user_id=eq.${encodeURIComponent(current.id)}&select=*&order=updated_at.desc&limit=1`})||[],row=rows[0];return row?.state?.game||row?.state||null}catch{return null}}
async function writeMetadata(game){const current=user();if(!current)return false;const spaces={...(current.user_metadata?.atlas_problem_spaces||{})},existing={...(spaces.logistics_game||{})};spaces.logistics_game={...existing,progress:{game,savedAt:new Date().toISOString(),version:Number(game.version||1)}};await updateUserMetadata({atlas_problem_spaces:spaces});return true}
async function clearMetadata(){const current=user();if(!current)return;const spaces={...(current.user_metadata?.atlas_problem_spaces||{})},existing={...(spaces.logistics_game||{})};spaces.logistics_game={...existing,progress:null};await updateUserMetadata({atlas_problem_spaces:spaces})}
async function load(){const current=user();if(!current){status('Saved on this device · sign in for cloud sync');return}loading=true;try{let saved=metadataProgress()?.game;if(!saved?.orders){saved=await legacyProgress();if(saved?.orders)await writeMetadata(saved)}if(saved?.orders){localStorage.setItem(LOCAL_KEY,JSON.stringify(saved));window.dispatchEvent(new CustomEvent('atlas-game-loaded',{detail:saved}));status('Loaded from your Atlas Harbor account')}else status('Cloud sync ready')}catch(error){console.warn('Progress load failed',error);status('Saved locally · cloud load unavailable')}finally{loading=false}}
async function save(){if(loading||resetting)return;const game=window.__atlasGameState;if(!game)return;if(!user()){status('Saved on this device · sign in for cloud sync');return}try{await writeMetadata(game);status(`Saved to your account · ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`)}catch(error){console.warn('Progress save failed',error);status('Saved locally · cloud retry pending')}}
function schedule(){clearTimeout(timer);timer=setTimeout(save,700)}
window.addEventListener('atlas-game-changed',schedule);
window.addEventListener('atlas-game-reset',async()=>{clearTimeout(timer);localStorage.removeItem(LOCAL_KEY);resetting=true;try{await clearMetadata()}catch(error){console.warn('Progress reset failed',error);status('Reset locally · cloud cleanup pending')}finally{resetting=false}await save();status(user()?'Fresh career saved to your account':'Fresh career saved on this device')});
load();
