const RECENCY=[1,.92,.85,.79,.73,.68,.63,.58];

function number(value){const n=Number(value);return Number.isFinite(n)?n:0}
function innings(value){const [whole='0',partial='0']=String(value??0).split('.');return number(whole)+Math.min(2,Math.max(0,number(partial)))/3}
function gameRows(player,group){
 const rows=[];
 for(const[key,splits]of Object.entries(player?.stats||{})){
  if(!key.startsWith(`${group}:gameLog:`))continue;
  for(const split of splits||[])rows.push({date:split.date||'',stat:split.stat||{},level:split.__shortLevel||split.__level||null,team:split.team?.name||null,opponent:split.opponent?.name||null});
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function weightedAverage(values){
 let score=0,weight=0;
 values.forEach((value,index)=>{const w=RECENCY[index]??Math.max(.35,1-index*.07);score+=value*w;weight+=w});
 return weight?score/weight:0;
}
export function hitterGamePoints(stat={}){
 const singles=Math.max(0,number(stat.hits)-number(stat.doubles)-number(stat.triples)-number(stat.homeRuns));
 return singles+2*number(stat.doubles)+3*number(stat.triples)+4*number(stat.homeRuns)+number(stat.runs)+number(stat.rbi)+number(stat.baseOnBalls)+number(stat.hitByPitch)+2*number(stat.stolenBases)-number(stat.caughtStealing)-.25*number(stat.strikeOuts);
}
export function pitcherGamePoints(stat={}){
 return 3*innings(stat.inningsPitched)+2*number(stat.strikeOuts)+5*number(stat.wins)+5*number(stat.saves)-2*number(stat.earnedRuns)-.5*number(stat.hits)-.5*number(stat.baseOnBalls)-1.5*number(stat.homeRuns);
}
function seasonHitterBaseline(player){const stat=player?.professionalSeason||{};const games=Math.max(1,number(stat.gamesPlayed));return hitterGamePoints(stat)/games}
function seasonPitcherBaseline(player){const stat=player?.professionalSeason||{};const games=Math.max(1,number(stat.gamesPlayed));return pitcherGamePoints(stat)/games}
export function scorePlayerForm(player,{games=8}={}){
 const hitRows=gameRows(player,'hitting').slice(0,games),pitchRows=gameRows(player,'pitching').slice(0,games);
 const recentHitting=weightedAverage(hitRows.map(row=>hitterGamePoints(row.stat))),recentPitching=weightedAverage(pitchRows.map(row=>pitcherGamePoints(row.stat));
 const hitterScore=hitRows.length?recentHitting*.8+seasonHitterBaseline(player)*.2:0;
 const pitcherScore=pitchRows.length?recentPitching*.8+seasonPitcherBaseline(player)*.2:0;
 return{playerId:player?.id,name:player?.name||'Player',team:player?.team||null,teamId:player?.teamId||null,position:player?.position||null,level:player?.level||null,hitterScore:Number(hitterScore.toFixed(2)),pitcherScore:Number(pitcherScore.toFixed(2)),recentHittingGames:hitRows.length,recentPitchingGames:pitchRows.length,recentHitting:hitRows,recentPitching:pitchRows};
}

function eligibility(position=''){
 const text=String(position).toLowerCase(),slots=[];
 if(/catcher/.test(text))slots.push('C');
 if(/first base/.test(text))slots.push('1B');
 if(/second base/.test(text))slots.push('2B');
 if(/third base/.test(text))slots.push('3B');
 if(/shortstop/.test(text))slots.push('SS');
 if(/outfield|left field|center field|right field/.test(text))slots.push('OF');
 if(/designated hitter/.test(text))slots.push('DH');
 if(/two-way|infielder/.test(text))slots.push('UTIL');
 if(!/pitcher/.test(text))slots.push('UTIL');
 return [...new Set(slots)];
}
function choose(slot,candidates,used){return candidates.find(item=>!used.has(item.playerId)&&item.eligible.includes(slot))||null}
export function buildIdealFantasyLineup(players,{games=8}={}){
 const scored=(players||[]).map(player=>({...scorePlayerForm(player,{games}),eligible:eligibility(player.position),snapshot:player})).filter(item=>item.recentHittingGames>0).sort((a,b)=>b.hitterScore-a.hitterScore);
 const used=new Set(),lineup=[];
 for(const slot of['C','1B','2B','3B','SS','OF','OF','OF']){
  const pick=choose(slot,scored,used);if(!pick)continue;used.add(pick.playerId);lineup.push({slot,...pick});
 }
 const util=scored.find(item=>!used.has(item.playerId));if(util){used.add(util.playerId);lineup.push({slot:'UTIL',...util})}
 const pitchers=(players||[]).map(player=>scorePlayerForm(player,{games})).filter(item=>item.recentPitchingGames>0).sort((a,b)=>b.pitcherScore-a.pitcherScore);
 return{
  model:'atlas-recent-form-v1',
  gamesWindow:games,
  battingLineup:lineup.map(({snapshot,eligible,...item})=>({...item,eligible})),
  bench:scored.filter(item=>!used.has(item.playerId)).slice(0,6).map(({snapshot,...item})=>item),
  pitchers:pitchers.slice(0,8),
  methodology:{recentWeight:.8,seasonWeight:.2,recencyWeights:RECENCY.slice(0,games),note:'This is a transparent recent-form ranking model, not a projection of future performance or a platform-specific fantasy scoring system.'}
 };
}
