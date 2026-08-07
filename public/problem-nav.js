import'./loading-feedback.js';
const style = document.createElement('style');
style.textContent = `.problem-nav{position:relative;z-index:4000}.problem-nav::after{content:"";position:absolute;left:0;right:0;top:100%;height:12px;display:none}.problem-nav-main{display:flex;align-items:center}.problem-nav-trigger{display:inline-flex!important;align-items:center;gap:7px;color:inherit;text-decoration:none;font:700 14px system-ui;background:transparent;border:0;cursor:pointer;padding:10px;border-radius:9px;white-space:nowrap;touch-action:manipulation}.problem-nav-trigger:hover,.problem-nav-trigger:focus-visible{background:#173b3210;outline:none}.problem-nav-arrow{display:inline-block;font-size:12px;line-height:1;transition:transform .18s ease}.problem-nav.open .problem-nav-arrow{transform:rotate(180deg)}.problem-nav-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:4001;width:min(360px,90vw);padding:10px;background:#fffdf7;border:1px solid #d8d2c4;border-radius:14px;box-shadow:0 18px 55px #173b3230;display:none;max-height:min(72vh,620px);overflow:auto}.problem-nav.open .problem-nav-menu{display:grid}.problem-nav.open::after{display:block}.problem-nav-menu a{display:grid!important;visibility:visible!important;gap:2px;padding:11px 12px;border-radius:10px;color:#173b32!important;text-decoration:none!important;touch-action:manipulation}.problem-nav-menu a:hover{background:#f1efe7}.problem-nav-menu b{display:block;font:700 14px system-ui}.problem-nav-menu small{display:block;color:#667970;font:500 11px system-ui}.problem-nav-request{border-top:1px solid #ddd7ca;margin-top:4px;padding-top:13px!important}@media(hover:hover) and (pointer:fine) and (min-width:761px){.problem-nav:hover .problem-nav-menu,.problem-nav.hover-open .problem-nav-menu{display:grid}.problem-nav:hover::after,.problem-nav.hover-open::after{display:block}.problem-nav:hover .problem-nav-arrow,.problem-nav.hover-open .problem-nav-arrow{transform:rotate(180deg)}}@media(hover:none),(pointer:coarse){a,button,[role="button"]{touch-action:manipulation}.problem-nav-trigger:hover,.problem-nav-menu a:hover{background:transparent}.problem-nav-menu a:active{background:#f1efe7}}@media(max-width:760px){body>header nav,header nav{display:flex!important}.problem-nav{display:block!important}.problem-nav::after{display:none!important}.problem-nav-main{display:flex!important}.problem-nav-trigger{display:inline-flex!important;font-size:15px}.problem-nav-menu{position:fixed;left:12px;right:12px;top:68px;width:auto;max-height:calc(100dvh - 84px)}body>header nav .problem-nav-menu a,header nav .problem-nav-menu a{display:grid!important}}`;
document.head.append(style);

const spaces = [
  ['/economics', 'Economics', 'Daily economic stories converted into decision problems.'],
  ['/game', 'Logistics Game', 'Operate plants, orders, inventory, and transportation.'],
  ['/logistics', 'Logistics Planner', 'Research, map, compare, and publish 3PL decisions.'],
  ['/leads', 'Lead Discovery', 'Find, verify, rank, and message prospective organizations.'],
  ['/baseball', 'Baseball Intelligence', 'Games, teams, players, injuries, and projections.'],
  ['/legal', 'Legal Systems Tracker', 'Cases, timelines, sources, and analysis.'],
  ['/food', 'Food Decision Planner', 'Choose breakfast through late night, solo or together, for dine-in, quick service, takeaway, or delivery.'],
  ['/prop', 'Propositions', 'Build data-based cases for work projects, partnerships, sales pitches, investments, and market ideas.'],
  ['/dropshipping', 'Dropshipping & Advertising', 'Products, campaigns, tests, results, and collaboration.'],
  ['/life-sciences', 'Life Sciences', 'Research questions, evidence, experiments, and translation.'],
  ['/featured', 'Featured', 'High-quality work selected by the global quality system.'],
  ['/published', 'Published Analysis', 'Recent user views across every problem space.']
];
const menuHtml = `<div class="problem-nav"><div class="problem-nav-main"><button class="problem-nav-trigger" type="button" aria-label="Open Problem Spaces" aria-expanded="false" aria-controls="problem-spaces-menu"><span>Problem Spaces</span><span class="problem-nav-arrow" aria-hidden="true">▾</span></button></div><div class="problem-nav-menu" id="problem-spaces-menu">${spaces.map(([href, name, description]) => `<a href="${href}"><b>${name}</b><small>${description}</small></a>`).join('')}<a class="problem-nav-request" href="/problems#request"><b>Request a Problem Space</b><small>Propose a new public space for review.</small></a></div></div>`;
const currentNav = document.querySelector('body>header nav,header nav');
if (currentNav) {
  currentNav.innerHTML = menuHtml;
  const root = currentNav.querySelector('.problem-nav');
  const trigger = currentNav.querySelector('.problem-nav-trigger');
  const menu = currentNav.querySelector('.problem-nav-menu');
  let hoverCloseTimer = null;
  const close = () => { root.classList.remove('open', 'hover-open'); trigger.setAttribute('aria-expanded', 'false'); };
  const cancelHoverClose = () => { if (!hoverCloseTimer) return; clearTimeout(hoverCloseTimer); hoverCloseTimer = null; };
  if (matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)').matches) {
    root.addEventListener('pointerenter', () => { cancelHoverClose(); root.classList.add('hover-open'); });
    root.addEventListener('pointerleave', () => { cancelHoverClose(); hoverCloseTimer = setTimeout(() => root.classList.remove('hover-open'), 180); });
    menu.addEventListener('pointerenter', cancelHoverClose);
  }
  trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); const open = root.classList.toggle('open'); trigger.setAttribute('aria-expanded', String(open)); });
  menu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', (event) => { if (!root.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

if (matchMedia('(hover: none), (pointer: coarse)').matches) {
  let start = null; let moved = false;
  document.addEventListener('touchstart', (event) => { if (event.touches.length !== 1) { start = null; return; } const touch = event.touches[0]; start = { x: touch.clientX, y: touch.clientY, target: event.target }; moved = false; }, { passive: true });
  document.addEventListener('touchmove', (event) => { if (!start || !event.touches[0]) return; const touch = event.touches[0]; if (Math.abs(touch.clientX - start.x) > 12 || Math.abs(touch.clientY - start.y) > 12) moved = true; }, { passive: true });
  document.addEventListener('touchend', (event) => { if (!start || moved) { start = null; return; } const changed = event.changedTouches[0]; const target = (changed && document.elementFromPoint(changed.clientX, changed.clientY)) || start.target; const link = target?.closest?.('a[href]'); start = null; if (!link || link.hasAttribute('data-no-touch-nav') || link.hasAttribute('download') || link.closest('[contenteditable="true"]') || link.getAttribute('role') === 'button') return; const href = link.getAttribute('href') || ''; if (!href || href.startsWith('javascript:')) return; setTimeout(() => { if (link.target === '_blank') window.open(link.href, '_blank', 'noopener'); else if (location.href !== link.href) location.assign(link.href); }, 0); }, { passive: true });
}
if (location.pathname.startsWith('/admin')) import('./economics-admin-patch.js');
