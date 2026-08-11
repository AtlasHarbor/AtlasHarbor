const PLAYER_PATH=/^\/baseball\/players\/(\d+)/;
const match=location.pathname.match(PLAYER_PATH);

if(match){
 const esc=value=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const style=document.createElement('style');
 style.textContent=`
 .report-nav{position:sticky;top:0;z-index:1500;gap:14px}
 .baseball-profile-search-launch{display:grid;place-items:center;flex:0 0 auto;width:46px;height:46px;margin-left:auto;padding:0;border:1px solid #d5cfc2;border-radius:50%;background:#fffdf7;color:#173b32;box-shadow:0 6px 18px #173b3214;cursor:pointer}
 .baseball-profile-search-launch:hover,.baseball-profile-search-launch:focus-visible{border-color:#ef6b3a;box-shadow:0 0 0 3px #ef6b3a22,0 8px 24px #173b321a;outline:none}
 .baseball-profile-search-launch svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
 .baseball-profile-search-overlay{position:fixed;inset:0;z-index:7000;background:#10241db8;backdrop-filter:blur(2px)}
 .baseball-profile-search-overlay[hidden]{display:none}
 .baseball-profile-search-surface{position:absolute;left:0;right:0;top:0;max-height:min(78dvh,680px);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) max(18px,calc((100vw - 980px)/2)) 20px;background:#fbf8ef;border-bottom:1px solid #d8d2c4;box-shadow:0 22px 70px #071d195c}
 .baseball-profile-search-head{display:flex;align-items:center;gap:12px}
 .baseball-profile-search-form{display:flex;align-items:center;gap:11px;flex:1;height:58px;padding:0 14px;border:2px solid #d5cfc2;border-radius:16px;background:#fff}
 .baseball-profile-search-form:focus-within{border-color:#ef6b3a;box-shadow:0 0 0 4px #ef6b3a1f}
 .baseball-profile-search-form svg{width:22px;height:22px;fill:none;stroke:#6d7b75;stroke-width:2.2;stroke-linecap:round}
 .baseball-profile-search-form input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#173b32;font:700 17px "DM Sans",system-ui}
 .baseball-profile-search-form input::placeholder{color:#84918b;font-weight:600}
 .baseball-profile-search-close{display:grid;place-items:center;flex:0 0 auto;width:48px;height:48px;padding:0;border:1px solid #d5cfc2;border-radius:50%;background:#fffdf7;color:#173b32;font-size:29px;line-height:1;cursor:pointer}
 .baseball-profile-search-close:hover,.baseball-profile-search-close:focus-visible{background:#173b32;color:#fff;outline:none}
 .baseball-profile-search-meta{display:flex;justify-content:space-between;gap:12px;margin:12px 2px 8px;color:#687971;font:700 11px "DM Sans",system-ui}
 .baseball-profile-search-results{display:grid;gap:6px}
 .baseball-profile-search-results[hidden]{display:none}
 .baseball-profile-search-result{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;min-height:62px;padding:11px 13px;border:1px solid transparent;border-radius:13px;color:#173b32;text-decoration:none}
 .baseball-profile-search-result:hover,.baseball-profile-search-result.is-active,.baseball-profile-search-result:focus-visible{background:#fff;border-color:#dfd8cb;box-shadow:0 6px 18px #173b3210;outline:none}
 .baseball-profile-search-type{display:inline-grid;place-items:center;min-width:50px;padding:6px 8px;border-radius:999px;background:#173b32;color:#fff;font-size:9px;font-weight:900;letter-spacing:.7px;text-transform:uppercase}
 .baseball-profile-search-result strong,.baseball-profile-search-result small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .baseball-profile-search-result strong{font:700 15px "DM Sans",system-ui}
 .baseball-profile-search-result small{margin-top:3px;color:#687971;font-size:11px}
 .baseball-profile-search-arrow{color:#ef6b3a;font-size:20px;font-weight:900}
 body.baseball-profile-search-open{overflow:hidden}
 .ohtani-two-way{border-color:#e6b48d;background:linear-gradient(145deg,#fff8eb,#fffdf7)}
 .ohtani-two-way-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
 .ohtani-two-way-badge{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#ef6b3a;color:#fff;font-size:9px;font-weight:900;letter-spacing:1px}
 .ohtani-two-way-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
 .ohtani-stat-card{padding:18px;border:1px solid #ded8cc;border-radius:16px;background:#fffdf7}
 .ohtani-stat-card h3{margin:5px 0 0}
 .ohtani-stat-card .decision-grid{grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:7px}
 .ohtani-stat-card .decision-grid div{padding:9px}
 .ohtani-stat-card .decision-grid strong{font-size:15px}
 @media(max-width:900px){
   .report-nav{padding:10px 14px}
   .baseball-profile-search-launch{width:44px;height:44px}
   .baseball-profile-search-surface{max-height:100dvh;min-height:0;padding:calc(10px + env(safe-area-inset-top)) 12px calc(18px + env(safe-area-inset-bottom))}
   .baseball-profile-search-head{align-items:flex-start}
   .baseball-profile-search-form{height:54px;padding:0 12px}
   .baseball-profile-search-form input{font-size:16px}
   .baseball-profile-search-close{width:46px;height:46px}
   .baseball-profile-search-meta{margin-top:10px}
   .baseball-profile-search-result{min-height:60px;padding:12px 10px}
   .baseball-profile-search-type{min-width:46px}
   .ohtani-two-way-head{display:block}
   .ohtani-two-way-badge{margin-top:8px}
   .ohtani-two-way-grid{grid-template-columns:1fr}
 }
 @media(prefers-reduced-motion:reduce){.baseball-profile-search-result,.baseball-profile-search-launch{scroll-behavior:auto}}
 `;
 document.head.append(style);

 const searchIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l5 5"></path></svg>';
 const json=async(url,signal)=>{const response=await fetch(url,{headers:{Accept:'application/json'},signal});if(!response.ok)throw new Error(String(response.status));return response.json()};
 const nav=document.querySelector('.report-nav');

 if(nav){
  const launch=document.createElement('button');
  launch.type='button';
  launch.className='baseball-profile-search-launch';
  launch.setAttribute('aria-label','Search baseball');
  launch.setAttribute('aria-expanded','false');
  launch.innerHTML=searchIcon;
  nav.insertBefore(launch,nav.querySelector('nav'));

  const overlay=document.createElement('div');
  overlay.className='baseball-profile-search-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`<section class="baseball-profile-search-surface" role="dialog" aria-modal="true" aria-label="Search baseball">
    <div class="baseball-profile-search-head">
      <form class="baseball-profile-search-form" role="search">${searchIcon}<input type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search players, teams, games…" aria-label="Search baseball" aria-autocomplete="list" aria-controls="baseball-profile-search-results"><button type="submit" hidden aria-hidden="true"></button></form>
      <button class="baseball-profile-search-close" type="button" aria-label="Close search">×</button>
    </div>
    <div class="baseball-profile-search-meta"><span>Type at least 2 letters</span><span class="baseball-profile-search-status" aria-live="polite"></span></div>
    <div class="baseball-profile-search-results" id="baseball-profile-search-results" role="listbox" hidden></div>
  </section>`;
  document.body.append(overlay);

  const surface=overlay.querySelector('.baseball-profile-search-surface'),form=overlay.querySelector('form'),input=overlay.querySelector('input'),results=overlay.querySelector('.baseball-profile-search-results'),status=overlay.querySelector('.baseball-profile-search-status'),close=overlay.querySelector('.baseball-profile-search-close');
  let timer=0,items=[],active=-1,requestNumber=0,controller=null,restoreFocus=null;
  const href=item=>item.type==='player'?`/baseball/players/${item.id}`:item.type==='team'?`/baseball/teams/${item.id}`:`/baseball/games/${item.id}`;
  const closeResults=()=>{results.hidden=true;results.innerHTML='';items=[];active=-1;input.removeAttribute('aria-activedescendant')};
  const closeSearch=()=>{clearTimeout(timer);controller?.abort();controller=null;overlay.hidden=true;document.body.classList.remove('baseball-profile-search-open');launch.setAttribute('aria-expanded','false');closeResults();status.textContent='';restoreFocus?.focus?.();restoreFocus=null};
  const openSearch=()=>{restoreFocus=document.activeElement;overlay.hidden=false;document.body.classList.add('baseball-profile-search-open');launch.setAttribute('aria-expanded','true');requestAnimationFrame(()=>input.focus())};
  const setActive=index=>{const links=[...results.querySelectorAll('.baseball-profile-search-result[href]')];links.forEach(link=>link.classList.remove('is-active'));if(!links.length){active=-1;return}active=(index+links.length)%links.length;links[active].classList.add('is-active');links[active].scrollIntoView({block:'nearest'});input.setAttribute('aria-activedescendant',links[active].id)};
  const render=list=>{
   items=list.slice(0,12);
   results.innerHTML=items.length?items.map((item,index)=>`<a id="baseball-profile-search-option-${index}" class="baseball-profile-search-result" role="option" href="${href(item)}"><span class="baseball-profile-search-type">${esc(item.level||item.type)}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.subtitle||'Baseball result')}</small></span><span class="baseball-profile-search-arrow">→</span></a>`).join(''):'<div class="baseball-profile-search-result"><span></span><span><strong>No matches yet</strong><small>Try another player, team, or matchup.</small></span></div>';
   results.hidden=false;
   status.textContent=`${items.length} result${items.length===1?'':'s'}`;
   active=-1;
  };
  const search=async query=>{
   const serial=++requestNumber;
   controller?.abort();
   controller=new AbortController();
   status.textContent='Searching…';
   const encoded=encodeURIComponent(query);
   const responses=await Promise.allSettled([
    json(`/api/baseball/search?q=${encoded}`,controller.signal),
    json(`/api/baseball/prospect-search?q=${encoded}&levels=mlb,aaa,aa,higha,lowa`,controller.signal)
   ]);
   if(serial!==requestNumber||controller.signal.aborted)return;
   const combined=responses.flatMap(result=>result.status==='fulfilled'?(result.value.results||[]):[]);
   const seen=new Set();
   const merged=combined.filter(item=>{const key=`${item.type}:${item.id}`;if(!item.id||seen.has(key))return false;seen.add(key);return true});
   if(!combined.length&&responses.every(result=>result.status==='rejected')){closeResults();status.textContent='Search is temporarily unavailable.';return}
   render(merged);
  };
  input.addEventListener('input',()=>{
   clearTimeout(timer);
   const query=input.value.trim();
   if(query.length<2){controller?.abort();closeResults();status.textContent='';return}
   timer=setTimeout(()=>search(query),280);
  });
  input.addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'){event.preventDefault();if(!results.hidden)setActive(active+1)}
   else if(event.key==='ArrowUp'){event.preventDefault();if(!results.hidden)setActive(active-1)}
   else if(event.key==='Enter'&&!results.hidden&&items.length){event.preventDefault();location.href=href(items[active>=0?active:0])}
   else if(event.key==='Escape'){event.preventDefault();closeSearch()}
  });
  form.addEventListener('submit',event=>{event.preventDefault();if(items.length)location.href=href(items[active>=0?active:0])});
  launch.addEventListener('click',openSearch);
  close.addEventListener('click',closeSearch);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closeSearch()});
  surface.addEventListener('pointerdown',event=>event.stopPropagation());
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)closeSearch()});
 }

 const statFrom=(stats,prefix)=>{const keys=Object.keys(stats||{}).filter(key=>key===prefix||key.startsWith(`${prefix}:`)).sort((a,b)=>Number(b.endsWith(':1'))-Number(a.endsWith(':1')));for(const key of keys){const split=(stats[key]||[]).find(item=>item?.stat&&Object.keys(item.stat).length);if(split?.stat)return split.stat}return{}};
 const cells=pairs=>{const valid=pairs.filter(([,value])=>value!==undefined&&value!==null&&value!==''&&value!=='.---'&&value!=='-.--');return valid.length?`<div class="decision-grid">${valid.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`:'<p class="empty">No verified data is available for this split.</p>'};
 const hitting=stat=>cells([['AVG',stat.avg],['OBP',stat.obp],['SLG',stat.slg],['OPS',stat.ops],['G',stat.gamesPlayed],['PA',stat.plateAppearances],['AB',stat.atBats],['H',stat.hits],['2B',stat.doubles],['3B',stat.triples],['HR',stat.homeRuns],['RBI',stat.rbi],['R',stat.runs],['SB',stat.stolenBases],['BB',stat.baseOnBalls],['SO',stat.strikeOuts]]);
 const pitching=stat=>cells([['ERA',stat.era],['WHIP',stat.whip],['W-L',stat.wins!=null?`${stat.wins}-${stat.losses}`:null],['G',stat.gamesPlayed],['GS',stat.gamesStarted],['IP',stat.inningsPitched],['SO',stat.strikeOuts],['BB',stat.baseOnBalls],['SV',stat.saves],['K/9',stat.strikeoutsPer9Inn],['BB/9',stat.walksPer9Inn],['HR/9',stat.homeRunsPer9]]);
 const hasBoth=stats=>Object.keys(statFrom(stats,'hitting:season')).length&&Object.keys(statFrom(stats,'pitching:season')).length;

 async function mountOhtani(){
  if(Number(match[1])!==660271)return;
  try{
   const requests=await Promise.allSettled([json('/api/baseball/prospect-players/660271'),json('/api/baseball/players/660271')]);
   const players=requests.filter(result=>result.status==='fulfilled').map(result=>result.value.player||result.value).filter(Boolean);if(!players.length)return;
   const combinedStats=Object.assign({},...players.map(player=>player.stats||{}));
   const source=players.find(player=>hasBoth(player.stats||{}))||players[0],stats=hasBoth(combinedStats)?combinedStats:(source.stats||{});
   const hitSeason=statFrom(stats,'hitting:season'),pitchSeason=statFrom(stats,'pitching:season'),hitCareer=statFrom(stats,'hitting:career'),pitchCareer=statFrom(stats,'pitching:career');
   if(!Object.keys(hitSeason).length||!Object.keys(pitchSeason).length)return;
   const year=new Date().getUTCFullYear(),section=document.createElement('section');
   section.className='ohtani-two-way';
   section.innerHTML=`<div class="ohtani-two-way-head"><div><p class="eyebrow">SHOHEI OHTANI · TWO-WAY PLAYER</p><h2>Hitting + pitching</h2><p class="dek">Both sides of Ohtani's game are shown together on this profile only.</p></div><span class="ohtani-two-way-badge">HITTING + PITCHING</span></div><div class="ohtani-two-way-grid"><article class="ohtani-stat-card"><p class="eyebrow">${year} HITTING</p><h3>At the plate</h3>${hitting(hitSeason)}</article><article class="ohtani-stat-card"><p class="eyebrow">${year} PITCHING</p><h3>On the mound</h3>${pitching(pitchSeason)}</article><article class="ohtani-stat-card"><p class="eyebrow">CAREER HITTING</p><h3>Career at the plate</h3>${hitting(hitCareer)}</article><article class="ohtani-stat-card"><p class="eyebrow">CAREER PITCHING</p><h3>Career on the mound</h3>${pitching(pitchCareer)}</article></div>`;
   const article=document.querySelector('main article'),hero=article?.querySelector('.game-hero');if(!article||!hero)return;hero.insertAdjacentElement('afterend',section);
   for(const original of article.querySelectorAll(':scope > section')){if(original===section)continue;const title=original.querySelector(':scope > h2')?.textContent?.trim()||original.querySelector('.section-title-row h2')?.textContent?.trim()||'';if(/^\d{4} season by level$/.test(title)||title==='Professional career totals'||title==='Advanced profile')original.hidden=true}
   window.dispatchEvent(new Event('atlas-baseball-stats-rendered'));
  }catch(error){console.warn('Ohtani two-way profile enhancement unavailable',error)}
 }
 mountOhtani();
}
