const DEFINITIONS={
 'ERA':['Earned Run Average','Earned runs allowed per nine innings pitched. Lower is better.'],
 'WHIP':['Walks + Hits per Inning Pitched','Walks and hits allowed per inning pitched. Lower usually means fewer baserunners.'],
 'W-L':['Win–Loss Record','Pitcher wins and losses credited under official scoring rules.'],
 'G':['Games','Games played.'],
 'GS':['Games Started','Games in which the player was in the starting lineup or, for a pitcher, started the game.'],
 'IP':['Innings Pitched','Pitching workload expressed in innings and outs. .1 means one out and .2 means two outs.'],
 'SO':['Strikeouts','Batters struck out for pitchers, or strikeouts by the hitter on batting lines.'],
 'BB':['Bases on Balls','Walks. For pitchers, walks allowed; for hitters, walks drawn.'],
 'SV':['Saves','Games finished by a relief pitcher while preserving a qualifying lead.'],
 'K/9':['Strikeouts per 9 Innings','Pitcher strikeouts scaled to nine innings.'],
 'BB/9':['Walks per 9 Innings','Pitcher walks allowed scaled to nine innings.'],
 'HR/9':['Home Runs per 9 Innings','Home runs allowed by a pitcher scaled to nine innings.'],
 'AVG':['Batting Average','Hits divided by official at-bats.'],
 'OBP':['On-Base Percentage','How often a hitter reaches base through hits, walks, or hit-by-pitch, with standard MLB denominator rules.'],
 'SLG':['Slugging Percentage','Total bases divided by at-bats; gives extra-base hits more weight than singles.'],
 'OPS':['On-Base Plus Slugging','On-base percentage plus slugging percentage.'],
 'PA':['Plate Appearances','Completed trips to the plate, including at-bats, walks and several other outcomes.'],
 'AB':['At-Bats','Official at-bats; excludes outcomes such as most walks, sacrifices and hit-by-pitch.'],
 'H':['Hits','Official hits.'],
 '2B':['Doubles','Hits on which the batter safely reaches second base without an error or fielder’s choice.'],
 '3B':['Triples','Hits on which the batter safely reaches third base without an error or fielder’s choice.'],
 'HR':['Home Runs','Home runs hit.'],
 'RBI':['Runs Batted In','Runs credited to a batter for causing runners to score under official scoring rules.'],
 'R':['Runs','Times the player scored a run.'],
 'SB':['Stolen Bases','Bases successfully stolen.'],
 'BABIP':['Batting Average on Balls in Play','How often non-home-run balls put into play become hits.'],
 'ISO':['Isolated Power','Slugging percentage minus batting average; a compact measure of extra-base power.'],
 'P/IP':['Pitches per Inning','Average number of pitches thrown per inning.'],
 'P/PA':['Pitches per Plate Appearance','Average pitches seen by the hitter per plate appearance.'],
 'BB%':['Walk Rate','Walks as a share of plate appearances.'],
 'SO%':['Strikeout Rate','Strikeouts as a share of plate appearances.'],
 'XBH':['Extra-Base Hits','Doubles, triples and home runs combined.'],
 'FLD%':['Fielding Percentage','Putouts plus assists divided by putouts, assists and errors.'],
 'INN':['Defensive Innings','Innings played in the field.'],
 'PO':['Putouts','Defensive plays directly recording an out.'],
 'A':['Assists','Defensive plays contributing to an out before the putout.'],
 'E':['Errors','Officially charged defensive errors.'],
 'DP':['Double Plays','Double plays in which the fielder participated.']
};

let dialog;
function ensureDialog(){
 if(dialog)return dialog;
 dialog=document.createElement('div');
 dialog.className='baseball-stat-dialog';
 dialog.hidden=true;
 dialog.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="baseball-stat-title"><button type="button" class="baseball-stat-close" aria-label="Close">×</button><p class="eyebrow">BASEBALL STAT</p><h2 id="baseball-stat-title"></h2><p data-stat-copy></p></div>';
 document.body.append(dialog);
 dialog.querySelector('.baseball-stat-close').onclick=()=>dialog.hidden=true;
 dialog.onclick=event=>{if(event.target===dialog)dialog.hidden=true};
 return dialog;
}
function show(key){
 const item=DEFINITIONS[key];if(!item)return;
 const box=ensureDialog();box.querySelector('h2').textContent=`${key} · ${item[0]}`;box.querySelector('[data-stat-copy]').textContent=item[1];box.hidden=false;box.querySelector('.baseball-stat-close').focus();
}
function decorate(root=document){
 const labels=root.querySelectorAll('.decision-grid span');
 for(const label of labels){
  if(label.querySelector('.baseball-stat-info'))continue;
  const key=label.textContent.trim(),item=DEFINITIONS[key];if(!item)continue;
  const tip=`${key}: ${item[0]} — ${item[1]}`;
  label.classList.add('baseball-stat-label');label.title=tip;
  const button=document.createElement('button');button.type='button';button.className='baseball-stat-info';button.dataset.stat=key;button.setAttribute('aria-label',`Explain ${key}`);button.title=tip;button.textContent='i';label.append(button);
 }
}
const style=document.createElement('style');
style.textContent=`.baseball-stat-label{display:inline-flex!important;align-items:center;gap:5px;cursor:help}.baseball-stat-info{display:inline-grid;place-items:center;width:18px;height:18px;padding:0;border:1px solid #9ba7a2;border-radius:50%;background:#fff;color:#173b32;font:800 11px/1 system-ui;cursor:pointer;vertical-align:middle}.baseball-stat-info:hover,.baseball-stat-info:focus-visible{background:#173b32;color:#fff;border-color:#173b32;outline:none}.baseball-stat-dialog{position:fixed;inset:0;z-index:3000;background:#10241dcc;display:grid;place-items:center;padding:20px}.baseball-stat-dialog[hidden]{display:none}.baseball-stat-dialog>div{position:relative;width:min(480px,100%);background:#fffdf7;border:1px solid #d7d2c6;border-radius:16px;padding:24px;box-shadow:0 24px 70px #0005;color:#173b32}.baseball-stat-dialog h2{margin:4px 38px 10px 0}.baseball-stat-dialog p{line-height:1.55}.baseball-stat-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:26px;cursor:pointer}`;
document.head.append(style);
document.addEventListener('click',event=>{const button=event.target.closest?.('.baseball-stat-info');if(!button)return;event.preventDefault();event.stopPropagation();show(button.dataset.stat)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog&&!dialog.hidden)dialog.hidden=true});
decorate();
window.addEventListener('atlas-baseball-stats-rendered',()=>decorate());
export{decorate as decorateBaseballStats,DEFINITIONS as baseballStatDefinitions};
