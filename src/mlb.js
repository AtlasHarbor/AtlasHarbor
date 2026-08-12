const MLB_BASE_URL="https://statsapi.mlb.com/api/v1";
const season=()=>new Date().getUTCFullYear();
const dateOnly=d=>d.toISOString().slice(0,10);
const addDays=(d,n)=>new Date(d.getTime()+n*86400000);
const splitsToObject=(entries=[])=>Object.fromEntries(entries.map(e=>[`${e.group?.displayName}:${e.type?.displayName}`,e.splits??[]]));
const POSTSEASON_GAME_TYPES=new Set(['F','D','L','W','P']);
const INJURED_STATUS=/\b(injured|injury|il|disabled|10-day|15-day|60-day|7-day)\b/i;
const NOISY_TRANSACTION=/\b(?:changed?|changes?)\s+(?:his\s+|her\s+|their\s+)?(?:uniform|jersey)?\s*(?:number|no\.?)(?:\s+from\s+\d+)?\s+to\s+\d+\b|\buniform number\b|\bjersey number\b/i;

export function isInjuredRosterEntry(entry={}){
 const description=[entry.status?.description,entry.status?.code,entry.person?.status?.description,entry.person?.status?.code].filter(Boolean).join(' ');
 return INJURED_STATUS.test(description);
}
export function isUsefulPlayerTransaction(tx={}){
 const text=[tx.typeDesc,tx.description].filter(Boolean).join(' ');
 return !NOISY_TRANSACTION.test(text);
}
function normalizeStanding(record){
 if(!record)return null;
 return{
  wins:Number(record.wins??record.leagueRecord?.wins??0),
  losses:Number(record.losses??record.leagueRecord?.losses??0),
  pct:record.winningPercentage??record.leagueRecord?.pct??null,
  divisionRank:record.divisionRank??null,
  leagueRank:record.leagueRank??null,
  wildCardRank:record.wildCardRank??null,
  gamesBack:record.gamesBack??record.divisionGamesBack??null,
  wildCardGamesBack:record.wildCardGamesBack??null,
  streak:record.streak?.streakCode??record.streak?.streakNumber??null,
  clinched:Boolean(record.clinched),
  eliminationNumber:record.eliminationNumber??null,
  wildCardEliminationNumber:record.wildCardEliminationNumber??null
 };
}
function standingFor(data,teamId){
 return(data?.records??[]).flatMap(record=>record.teamRecords??[]).find(record=>Number(record.team?.id)===Number(teamId))??null;
}
function seasonPhase(nextGame,recentGame){
 const game=nextGame??recentGame;
 if(game&&POSTSEASON_GAME_TYPES.has(String(game.gameType||'').toUpperCase()))return'postseason';
 return'regular-season';
}

export function createMlbClient(fetchImpl=globalThis.fetch){
 async function request(path){const r=await fetchImpl(`${MLB_BASE_URL}${path}`,{headers:{Accept:"application/json","User-Agent":"AtlasHarbor/0.6"},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`MLB Stats API responded with ${r.status}`);return r.json()}
 async function optionalRequest(path){try{return await request(path)}catch(e){console.warn(`Optional MLB request failed: ${path}`,e.message);return null}}
 async function getStats(path){const d=await request(path);return d.stats?.flatMap(e=>e.splits??[])??[]}
 async function rosterProfiles(ids){if(!ids.length)return new Map();const data=await optionalRequest(`/people?personIds=${ids.join(',')}&hydrate=${encodeURIComponent('currentTeam,stats(group=[hitting,pitching,fielding],type=[season])')}`);return new Map((data?.people??[]).map(p=>[p.id,p]))}
 return{
  async search(query){const[people,teams,schedule]=await Promise.all([request(`/people/search?names=${encodeURIComponent(query)}`),request(`/teams?sportId=1&season=${season()}`),request(`/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(),14))}&hydrate=team,probablePitcher,venue,weather`)]);const needle=query.toLowerCase();const players=(people.people??[]).slice(0,8).map(p=>({type:"player",id:p.id,name:p.fullName,subtitle:`${p.currentTeam?.name??"Team unavailable"} · ${p.primaryPosition?.name??"Player"}`}));const matchingTeams=(teams.teams??[]).filter(t=>[t.name,t.teamName,t.clubName,t.abbreviation].some(v=>v?.toLowerCase().includes(needle))).slice(0,8).map(t=>({type:"team",id:t.id,name:t.name,subtitle:`${t.league?.name??"MLB"} · ${t.division?.name??""}`.replace(/ · $/,"")}));const games=(schedule.dates??[]).flatMap(d=>d.games??[]).filter(g=>`${g.teams?.away?.team?.name} ${g.teams?.home?.team?.name} ${g.venue?.name}`.toLowerCase().includes(needle)).map(normalizeGame).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);return[...matchingTeams,...games,...players]},
  async getUpcomingGames(days=14){const d=await request(`/schedule?sportId=1&startDate=${dateOnly(new Date())}&endDate=${dateOnly(addDays(new Date(),days))}&hydrate=team,probablePitcher,venue,weather`);return(d.dates??[]).flatMap(x=>x.games??[]).map(normalizeGame).sort((a,b)=>a.date.localeCompare(b.date))},
  async getGame(id){const schedule=await request(`/schedule?sportId=1&gamePk=${id}&hydrate=team,probablePitcher,venue,weather,linescore`);const game=schedule.dates?.[0]?.games?.[0];if(!game)return null;const normalized=normalizeGame(game);const[boxscore,feed]=await Promise.all([optionalRequest(`/game/${id}/boxscore`),optionalRequest(`/game/${id}/feed/live`)]);const teams={};for(const side of["away","home"]){const tb=boxscore?.teams?.[side]??{},players=tb.players??{};teams[side]={team:normalized[side],battingOrder:(tb.battingOrder??[]).map(pid=>normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),bench:(tb.bench??[]).map(pid=>normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),bullpen:(tb.bullpen??[]).map(pid=>normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),pitchers:(tb.pitchers??[]).map(pid=>normalizeBoxPlayer(players[`ID${pid}`])).filter(Boolean),totals:tb.teamStats??{}}}const probable=feed?.gameData?.probablePitchers??{};return{...normalized,teams,probablePitchers:{away:probable.away?.fullName??normalized.awayPitcher,home:probable.home?.fullName??normalized.homePitcher},probablePitcherIds:{away:probable.away?.id??normalized.awayPitcherId,home:probable.home?.id??normalized.homePitcherId},venueDetails:feed?.gameData?.venue??{},officials:boxscore?.officials??[],linescore:feed?.liveData?.linescore??game.linescore??null,decisions:feed?.liveData?.decisions??null,broadcasts:feed?.gameData?.broadcasts??[],gameInfo:feed?.gameData?.gameInfo??{},availability:{schedule:true,boxscore:Boolean(boxscore),liveFeed:Boolean(feed)}}},
  async getTeam(id){
   const teamData=await request(`/teams/${id}?hydrate=league,division,venue,sport`),team=teamData.teams?.[0];if(!team)return null;
   const sportId=Number(team.sport?.id||1),leagueId=team.league?.id,year=season(),today=new Date(),start=dateOnly(addDays(today,-21)),end=dateOnly(addDays(today,14));
   const standingsPath=leagueId?`/standings?leagueId=${leagueId}&season=${year}&standingsTypes=regularSeason`:null;
   const[hitting,pitching,fielding,active,injured,nextGames,pinch,standings,recentSchedule]=await Promise.all([
    getStats(`/teams/${id}/stats?stats=season&group=hitting&season=${year}`),
    getStats(`/teams/${id}/stats?stats=season&group=pitching&season=${year}`),
    getStats(`/teams/${id}/stats?stats=season&group=fielding&season=${year}`),
    request(`/teams/${id}/roster?rosterType=active&hydrate=person`),
    optionalRequest(`/teams/${id}/roster?rosterType=injuredList&hydrate=person`),
    request(`/schedule?sportId=${sportId}&teamId=${id}&startDate=${dateOnly(today)}&endDate=${end}&hydrate=team,probablePitcher,venue,weather`),
    getStats(`/teams/${id}/stats?stats=statSplits&group=hitting&season=${year}&sitCodes=ph`),
    standingsPath?optionalRequest(standingsPath):Promise.resolve(null),
    optionalRequest(`/schedule?sportId=${sportId}&teamId=${id}&startDate=${start}&endDate=${dateOnly(today)}&hydrate=team`)
   ]);
   const entries=active.roster??[],profiles=await rosterProfiles(entries.map(e=>e.person?.id).filter(Boolean)),roster=entries.map(e=>normalizeRosterPlayer(e,profiles.get(e.person?.id))),nextGame=nextGames.dates?.flatMap(d=>d.games??[])[0]??null,recentGames=recentSchedule?.dates?.flatMap(d=>d.games??[])??[],recentGame=recentGames.at(-1)??null;
   let lineup=[],bench=[];if(nextGame){try{const box=await request(`/game/${nextGame.gamePk}/boxscore`),side=Number(nextGame.teams?.home?.team?.id)===Number(id)?"home":"away",tb=box.teams?.[side]??{};lineup=(tb.battingOrder??[]).map(pid=>mergeRoster(normalizeBoxPlayer(tb.players?.[`ID${pid}`]),roster)).filter(Boolean);bench=(tb.bench??[]).map(pid=>mergeRoster(normalizeBoxPlayer(tb.players?.[`ID${pid}`]),roster)).filter(Boolean)}catch{}}
   const pinchById=new Map(pinch.map(s=>[s.player?.id,s.stat??{}])),standingRecord=standingFor(standings,id),standing=normalizeStanding(standingRecord),phase=seasonPhase(nextGame,recentGame),injuredEntries=(injured?.roster??[]).filter(isInjuredRosterEntry);
   return{id:team.id,name:team.name,abbreviation:team.abbreviation,league:team.league?.name,leagueId:team.league?.id,division:team.division?.name,divisionId:team.division?.id,sportId,sportName:team.sport?.name??(sportId===1?'Major League Baseball':'Professional baseball'),venue:team.venue?.name,firstYear:team.firstYearOfPlay,season:year,seasonPhase:phase,record:standing?{wins:standing.wins,losses:standing.losses,pct:standing.pct}:null,standing,stats:{hitting:hitting[0]?.stat??{},pitching:pitching[0]?.stat??{},fielding:fielding[0]?.stat??{}},roster,lineup:{status:lineup.length?"confirmed":"projected-unavailable",players:lineup},bench:(bench.length?bench:roster.filter(p=>!lineup.some(l=>l.id===p.id)&&!/Pitcher/i.test(p.position))).map(p=>({...p,pinchHitting:pinchById.get(p.id)??{}})),injuredList:injuredEntries.map(e=>({...normalizeRosterPlayer(e),status:e.status?.description??e.status?.code??e.person?.status?.description??"Injured list"})),nextGame:nextGame?normalizeGame(nextGame):null}},
  async getPlayer(id){const hydrate="currentTeam,team,stats(group=[hitting,pitching,fielding],type=[season,career,yearByYear,seasonAdvanced,careerAdvanced])";const[data,gameLog,splits,transactions]=await Promise.all([request(`/people/${id}?hydrate=${encodeURIComponent(hydrate)}`),request(`/people/${id}/stats?stats=gameLog&group=hitting,pitching,fielding&season=${season()}&hydrate=team,opponent`),request(`/people/${id}/stats?stats=statSplits&group=hitting,pitching&season=${season()}&sitCodes=vl,vr,home,away`),request(`/transactions?playerId=${id}&startDate=${season()}-01-01&endDate=${dateOnly(new Date())}`)]);const p=data.people?.[0];if(!p)return null;const logs=gameLog.stats?.flatMap(e=>e.splits??[])??[];return{id:p.id,name:p.fullName,team:p.currentTeam?.name??"Free agent / team unavailable",position:p.primaryPosition?.name??"Player",number:p.primaryNumber??null,bats:p.batSide?.description??null,throws:p.pitchHand?.description??null,age:p.currentAge??null,birthDate:p.birthDate??null,birthCity:p.birthCity??null,birthCountry:p.birthCountry??null,height:p.height??null,weight:p.weight??null,debut:p.mlbDebutDate??null,active:p.active??null,stats:splitsToObject(p.stats),situationalSplits:splitsToObject(splits.stats),recentGames:logs.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8).map(s=>({date:s.date,season:s.season??season(),opponent:s.opponent?.name??s.team?.name??"Opponent",isHome:s.isHome,stat:s.stat??{}})),transactions:(transactions.transactions??[]).filter(isUsefulPlayerTransaction).slice(-12).reverse().map(tx=>({date:tx.date,type:tx.typeDesc,description:tx.description,effectiveDate:tx.effectiveDate}))}}
 }
}
function normalizeRosterPlayer(entry,profile){const p=profile??entry.person??{};return{id:p.id??entry.person?.id,name:p.fullName??entry.person?.fullName,position:entry.position?.name??p.primaryPosition?.name,number:entry.jerseyNumber??p.primaryNumber,status:entry.status?.description??null,stats:splitsToObject(p.stats??[])}}
function mergeRoster(player,roster){if(!player)return null;const full=roster.find(p=>p.id===player.id);return full?{...full,...player,stats:full.stats}:player}
function normalizeBoxPlayer(p){if(!p?.person)return null;return{id:p.person.id,name:p.person.fullName,position:p.position?.name,battingOrder:p.battingOrder??null,stats:p.stats??{},seasonStats:p.seasonStats??{},gameStatus:p.gameStatus??{}}}
function normalizeGame(g){const ap=g.teams?.away?.probablePitcher,hp=g.teams?.home?.probablePitcher;return{type:"game",id:g.gamePk,name:`${g.teams?.away?.team?.name??"Away"} at ${g.teams?.home?.team?.name??"Home"}`,subtitle:`${g.officialDate??g.gameDate?.slice(0,10)} · ${g.venue?.name??"Venue TBD"}`,date:g.gameDate??g.officialDate,officialDate:g.officialDate,venue:g.venue?.name??null,away:g.teams?.away?.team??null,home:g.teams?.home?.team??null,awayPitcher:ap?.fullName??"TBD",homePitcher:hp?.fullName??"TBD",awayPitcherId:ap?.id??null,homePitcherId:hp?.id??null,weather:g.weather?{condition:g.weather.condition??null,temperature:g.weather.temp??null,wind:g.weather.wind??null}:null,status:g.status?.detailedState??null,gameType:g.gameType??null,seriesDescription:g.seriesDescription??null,seriesGameNumber:g.seriesGameNumber??null,doubleHeader:g.doubleHeader??null,dayNight:g.dayNight??null,scheduledInnings:g.scheduledInnings??null,gamesInSeries:g.gamesInSeries??null,recordSource:"MLB Stats API"}}
