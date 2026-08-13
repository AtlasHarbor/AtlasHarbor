const REPORTS_PER_PAGE=9;
let page=1;

function removeLegacyBuilder(){document.querySelector('#manual-space-block')?.remove()}
function createTile(){
 const signedIn=Boolean(localStorage.getItem('atlas-harbor-session'));
 const link=document.createElement('a');
 link.className='gtm-card prop-card prop-create-card';
 link.href=signedIn?'/prop/new':'/account';
 link.innerHTML=`<span>SPACE BLOCK</span><h3>+ Create a new Space Block</h3><p>${signedIn?'Start with a blank manual page. Paste an RFP or problem statement, format it, save it, then publish separate analysis from the block.':'Sign in to create and own a manual Space Block.'}</p><footer><b>${signedIn?'No AI required':'Account required'}</b><span>→</span></footer>`;
 return link;
}
function paginationHost(grid){
 let nav=document.querySelector('#prop-pagination');
 if(!nav){nav=document.createElement('nav');nav.id='prop-pagination';nav.className='prop-pagination';nav.setAttribute('aria-label','Proposition pages');grid.insertAdjacentElement('afterend',nav)}
 return nav;
}
function updateUrl(){const url=new URL(location.href);if(page>1)url.searchParams.set('page',String(page));else url.searchParams.delete('page');history.replaceState(history.state,'',url)}
function render(){
 removeLegacyBuilder();
 const grid=document.querySelector('#prop-grid');if(!grid)return false;
 grid.querySelector('.prop-create-card')?.remove();
 const reports=[...grid.children].filter(el=>el.classList.contains('gtm-card')&&!el.classList.contains('prop-create-card'));
 const pages=Math.max(1,Math.ceil(reports.length/REPORTS_PER_PAGE));
 page=Math.min(Math.max(1,page),pages);
 reports.forEach((card,index)=>{card.hidden=index<(page-1)*REPORTS_PER_PAGE||index>=page*REPORTS_PER_PAGE});
 grid.append(createTile());
 const nav=paginationHost(grid);
 if(pages<=1){nav.hidden=true;nav.innerHTML='';return true}
 nav.hidden=false;
 nav.innerHTML=`<button type="button" data-page="prev" ${page===1?'disabled':''}>← Previous</button><span>Page ${page} of ${pages}</span><button type="button" data-page="next" ${page===pages?'disabled':''}>Next →</button>`;
 nav.querySelector('[data-page="prev"]')?.addEventListener('click',()=>{if(page>1){page--;updateUrl();render();grid.scrollIntoView({behavior:'smooth',block:'start'})}});
 nav.querySelector('[data-page="next"]')?.addEventListener('click',()=>{if(page<pages){page++;updateUrl();render();grid.scrollIntoView({behavior:'smooth',block:'start'})}});
 return true;
}
function scheduleRender(){[160,360,700,1400].forEach(delay=>setTimeout(()=>{removeLegacyBuilder();render()},delay))}
function boot(){
 if(location.pathname.replace(/\/$/,'')!=='/prop')return;
 const requested=Number(new URL(location.href).searchParams.get('page'));if(Number.isFinite(requested)&&requested>0)page=Math.floor(requested);
 [0,120,350,900,1800].forEach(delay=>setTimeout(removeLegacyBuilder,delay));
 let attempts=0;const wait=()=>{attempts++;if(render()){const search=document.querySelector('#prop-search');search?.addEventListener('input',()=>{page=1;scheduleRender()});return}if(attempts<40)setTimeout(wait,100)};wait();
}
boot();
