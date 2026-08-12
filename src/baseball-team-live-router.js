import express from 'express';

const BASE='https://statsapi.mlb.com/api/v1';
const POSTSEASON_TYPES=new Set(['F','D','L','W','P']);
const dateOnly=date=>date.toISOString().slice(0,10);
const addDays=(date,days)=>new Date(date.getTime()+days*86400000);

async function json(fetchImpl,path){
 const response=await fetchImpl(`${BASE}${path}`,{headers:{Accept:'application/json','User-Agent':'AtlasHarbor/1.0'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`MLB Stats API responded with ${response.status}`);
 return response.json();
}
async function optional(fetchImpl,path){try{return await json(fetchImpl,path)}catch(error){console.warn(`Optional team-live request failed: ${path}`,error.message);return null}}

const isFinal=game=>game?.status?.abstractGameState==='Final'||/final|game over|completed early/i.test(game?.status?.detailedState||'');
const isLive=game=>game?.status?.abstractGameState==='Live'||/in progress|warmup|delayed|review|challenge/i.test(game?.status?.detailedState||'');
function normalizeGame(game,teamId){
 const away=game.teams?.away||{},home=game.teams?.home||{},homeTeam=Number(home.team?.id)===Number(teamId),team=homeTeam?home:away,opponent=homeTeam?away:home,teamScore=team.score,opponentScore=opponent.score,final=isFinal(game),live=isLive(game);
 let result=null;if(final&&Number.isFinite(Number(teamScore))&&Number.isFinite(Number(opponentScore)))result=Number(teamScore)>Number(opponentScore)?'W':Number(teamScore)<Number(opponentScore)?'L':'T';
 return{id:game.gamePk,date:game.gameDate||game.officialDate,officialDate:game.officialDate,gameType:game.gameType,status:game.status?.detailedState||game.status?.abstractGameState||'Scheduled',abstractState:game.status?.abstractGameState||null,isFinal:final,isLive:live,isHome:homeTeam,team:{id:team.team?.id,name:team.team?.name,score:teamScore??null},opponent:{id:opponent.team?.id,name:opponent.team?.name,score:opponentScore??null},away:{id:away.team?.id,name:away.team?.name,score:away.score??null},home:{id:home.team?.id,name:home.team?.name,score:home.score??null},result,venue:game.venue?.name||null,inning:game.linescore?.currentInningOrdinal||game.linescore?.currentInning||null,inningState:game.linescore?.inningState||null,seriesDescription:game.seriesDescription||null};
}
function standingFor(data,teamId){return(data?.records||[]).flatMap(record=>record.teamRecords||[]).find(record=>Number(record.team?.id)===Number(teamId))||null}
function normalizeStanding(record){if(!record)return null;return{wins:Number(record.wins??record.leagueRecord?.wins??0),losses:Number(record.losses??record.leagueRecord?.losses??0),pct:record.winningPercentage??record.leagueRecord?.pct??null,divisionRank:record.divisionRank??null,leagueRank:record.leagueRank??null,wildCardRank:record.wildCardRank??null,gamesBack:record.gamesBack??record.divisionGamesBack??null,wildCardGamesBack:record.wildCardGamesBack??null,streak:record.streak?.streakCode??null}}
function rosterPlayer(entry){const p=entry.person||{};return{id:p.id,name:p.fullName||'Player',position:entry.position?.name||p.primaryPosition?.name||'Player',number:entry.jerseyNumber||p.primaryNumber||null,status:entry.status?.description||entry.status?.code||null}}

function activeInjuredIds(transactions=[]){
 const state=new Map();
 const sorted=[...transactions].sort((a,b)=>String(a.effectiveDate||a.date||'').localeCompare(String(b.effectiveDate||b.date||'')));
 for(const tx of sorted){const id=tx.person?.id,description=String(tx.description||tx.typeDesc||'');if(!id)continue;
  const cleared=/\b(reinstated|activated|returned)\b[\s\S]*\b(injured list|IL)\b/i.test(description);
  const placed=/\b(placed|transferred)\b[\s\S]*\b(on|to)\b[\s\S]*\b(injured list|IL)\b/i.test(description);
  if(cleared&&!placed)state.delete(Number(id));else if(placed)state.set(Number(id),{id:Number(id),description,date:tx.effectiveDate||tx.date||null});
 }
 return state;
}
function injuryLabel(description=''){const match=String(description).match(/\b(7-day|10-day|15-day|60-day)\s+injured list\b/i);return match?match[0].replace(/^\w/,c=>c.toUpperCase()):'Injured list'}

export function createBaseballTeamLiveRouter({fetchImpl=globalThis.fetch}={}){
 const router=express.Router();
 router.get('/api/baseball/team-live/:id',async(req,res)=>{
  if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid team ID.'});
  try{
   const id=Number(req.params.id),today=new Date(),year=today.getUTCFullYear();
   const teamData=await json(fetchImpl,`/teams/${id}?hydrate=league,division,venue,sport`),team=teamData.teams?.[0];
   if(!team)return res.status(404).json({error:'Team not found.'});
   const sportId=Number(team.sport?.id||1),leagueId=team.league?.id;
   const [schedule,active,transactions,fortyMan,standings]=await Promise.all([
    json(fetchImpl,`/schedule?sportId=${sportId}&teamId=${id}&startDate=${dateOnly(addDays(today,-35))}&endDate=${dateOnly(addDays(today,35))}&hydrate=team,probablePitcher,venue,linescore`),
    json(fetchImpl,`/teams/${id}/roster?rosterType=active&hydrate=person`),
    optional(fetchImpl,`/transactions?teamId=${id}&startDate=${year}-01-01&endDate=${dateOnly(today)}`),
    optional(fetchImpl,`/teams/${id}/roster?rosterType=40Man&hydrate=person`),
    leagueId?optional(fetchImpl,`/standings?leagueId=${leagueId}&season=${year}&standingsTypes=regularSeason`):Promise.resolve(null)
   ]);
   const games=(schedule.dates||[]).flatMap(day=>day.games||[]).map(game=>normalizeGame(game,id));
   const recent=games.filter(game=>game.isFinal).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
   const upcoming=games.filter(game=>!game.isFinal).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,5);
   const live=games.filter(game=>game.isLive).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
   const transactionState=activeInjuredIds(transactions?.transactions||[]),fortyEntries=fortyMan?.roster||[];
   for(const entry of fortyEntries){const status=[entry.status?.description,entry.status?.code,entry.person?.status?.description].filter(Boolean).join(' ');if(/\b(injured|injury|IL|disabled|7-day|10-day|15-day|60-day)\b/i.test(status)&&entry.person?.id&&!transactionState.has(Number(entry.person.id)))transactionState.set(Number(entry.person.id),{id:Number(entry.person.id),description:status,date:null})}
   const injuryIds=[...transactionState.keys()],people=injuryIds.length?await optional(fetchImpl,`/people?personIds=${injuryIds.join(',')}&hydrate=currentTeam`):null,peopleById=new Map((people?.people||[]).map(person=>[Number(person.id),person]));
   const injured=injuryIds.map(playerId=>{const person=peopleById.get(playerId)||fortyEntries.find(entry=>Number(entry.person?.id)===playerId)?.person||{};const meta=transactionState.get(playerId)||{};return{id:playerId,name:person.fullName||'Player',position:person.primaryPosition?.name||'Player',status:injuryLabel(meta.description),since:meta.date,sourceNote:meta.description||null}}).sort((a,b)=>a.name.localeCompare(b.name));
   const standing=normalizeStanding(standingFor(standings,id)),phase=games.some(game=>POSTSEASON_TYPES.has(String(game.gameType||'').toUpperCase())&&(game.isLive||!game.isFinal))?'postseason':'regular-season';
   res.set('Cache-Control','no-store');
   return res.json({team:{id:team.id,name:team.name,abbreviation:team.abbreviation,league:team.league?.name,division:team.division?.name,venue:team.venue?.name,sport:team.sport?.name,seasonPhase:phase},record:standing?{wins:standing.wins,losses:standing.losses,pct:standing.pct}:null,standing,roster:(active.roster||[]).map(rosterPlayer),injuredList:injured,recentGames:recent,upcomingGames:upcoming,liveGames:live,fetchedAt:new Date().toISOString()});
  }catch(error){console.error(error);return res.status(502).json({error:'Live team information is temporarily unavailable.'})}
 });
 return router;
}
