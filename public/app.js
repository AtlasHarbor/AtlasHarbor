const input = document.querySelector("#player-search");
const results = document.querySelector("#search-results");
const status = document.querySelector("#search-status");
const playerCard = document.querySelector("#player-card");
let timer;

const escapeHtml = (value) => String(value ?? "—").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const initials = (name) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");

input.addEventListener("input", () => {
  clearTimeout(timer);
  const query = input.value.trim();
  if (query.length < 2) { results.hidden = true; status.textContent = "Type at least 2 letters to scout the league"; return; }
  status.textContent = "Scouting MLB rosters…";
  timer = setTimeout(() => search(query), 250);
});

async function search(query) {
  try {
    const response = await fetch(`/api/baseball/players?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error();
    const { players } = await response.json();
    results.innerHTML = players.length ? players.map((player) => `
      <button class="result" role="option" data-id="${player.id}">
        <span class="avatar">${escapeHtml(initials(player.name))}</span>
        <span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.position)}</small></span><span class="arrow">→</span>
      </button>`).join("") : `<div class="result"><span>No players found. Try a full name.</span></div>`;
    results.hidden = false;
    status.textContent = `${players.length} player${players.length === 1 ? "" : "s"} found`;
  } catch { results.hidden = true; status.textContent = "The player market is unavailable. Try again shortly."; }
}

results.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  results.hidden = true; status.textContent = "Loading player report…";
  try {
    const response = await fetch(`/api/baseball/players/${button.dataset.id}`);
    if (!response.ok) throw new Error();
    const { player } = await response.json();
    input.value = player.name; renderPlayer(player); status.textContent = "Player report ready";
  } catch { status.textContent = "That player report could not be loaded."; }
});

function renderPlayer(player) {
  const pitching = player.stats["pitching:season"] ?? player.stats["pitching:career"];
  const hitting = player.stats["hitting:season"] ?? player.stats["hitting:career"];
  const stat = pitching && Object.keys(pitching).length ? ["Pitching", pitching, [["era","ERA"],["whip","WHIP"],["wins","Wins"],["losses","Losses"],["strikeOuts","Strikeouts"],["inningsPitched","Innings"]]] : ["Hitting", hitting ?? {}, [["avg","Average"],["ops","OPS"],["homeRuns","Home runs"],["rbi","RBI"],["hits","Hits"],["stolenBases","Stolen bases"]]];
  playerCard.innerHTML = `<div class="player-head"><div class="jersey">${escapeHtml(player.number ?? initials(player.name))}</div><div><h2>${escapeHtml(player.name)}</h2><p>${escapeHtml(player.team)} · ${escapeHtml(player.position)}</p></div><div class="player-meta">Bats ${escapeHtml(player.bats)} · Throws ${escapeHtml(player.throws)}<br>Age ${escapeHtml(player.age)} · Debut ${escapeHtml(player.debut)}</div></div><p class="stat-title">${stat[0]} · current season</p><div class="stat-grid">${stat[2].map(([key,label]) => `<div class="stat"><span>${label}</span><strong>${escapeHtml(stat[1][key])}</strong></div>`).join("")}</div>`;
  playerCard.hidden = false; playerCard.scrollIntoView({ behavior:"smooth", block:"center" });
}

document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); input.focus(); } if (event.key === "Escape") results.hidden = true; });
document.addEventListener("click", (event) => { if (!event.target.closest(".search-shell")) results.hidden = true; });

if (window.Phaser) {
  new Phaser.Game({ type:Phaser.CANVAS, parent:"game-canvas", transparent:true, scale:{mode:Phaser.Scale.RESIZE}, scene:{create(){
    const g=this.add.graphics(); const w=this.scale.width, h=this.scale.height;
    g.fillStyle(0xadc9a5,.55); g.fillEllipse(w*.82,h*.52,560,270); g.fillStyle(0x91b18e,.7); g.fillEllipse(w*.86,h*.62,430,190);
    const bx=w*.72, by=h*.25; g.fillStyle(0xf7e2b2,1); g.fillRect(bx,by,225,145); g.fillStyle(0xd75f3d,1); g.fillTriangle(bx-25,by,bx+112,by-85,bx+250,by); g.fillStyle(0x345b4e,1); g.fillRect(bx+88,by+65,48,80); g.fillStyle(0xffffff,.7); g.fillRect(bx+25,by+42,38,35); g.lineStyle(3,0x537665,.7); g.strokeRect(bx+25,by+42,38,35);
    g.lineStyle(5,0xe9e2cb,1); for(let x=w*.56;x<w;x+=46){g.beginPath();g.moveTo(x,h*.72);g.lineTo(x-75,h);g.strokePath()} g.lineStyle(3,0x88a47f,.75); g.strokeRect(w*.54,h*.7,w*.43,95);
    for(let i=0;i<18;i++){const x=w*.55+(i%9)*50,y=h*.76+Math.floor(i/9)*53;g.fillStyle(i%2?0xe1a83a:0xef7445,1);g.fillCircle(x,y,7);g.fillStyle(0x56815b,1);g.fillTriangle(x,y-4,x-8,y-15,x,y-11)}
  }}} });
}
