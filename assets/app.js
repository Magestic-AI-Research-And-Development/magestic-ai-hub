/* Magestic AI Hub — app logic.
   Data comes from data/*.js (content, feed, feed-live, directory, companies). */

const POSTS = [...(typeof POSTS_LIVE !== "undefined" ? POSTS_LIVE : []), ...POSTS_CURATED];
let activeRole = "Everyone";
let feedFilter = "All";
const FEED_FILTERS = {
  "All": p=>true,
  "Marketing": p=>p.tags.includes("Marketing & Sales")||p.topic==="Company Watch",
  "Developers": p=>p.topic==="Tools"||p.tags.includes("Developers"),
  "Regulatory": p=>p.topic==="Regulatory",
  "Saved": p=>!!(window.HUB&&HUB.isSaved(postKey(p)))
};
/* ---------- theme ---------- */
function setTheme(t){
  document.documentElement.setAttribute("data-theme",t);
  const b=document.getElementById("themeBtn");if(b)b.textContent=t==="dark"?"☀":"☾";
  try{localStorage.setItem("hubTheme",t);}catch(e){}
}
function toggleTheme(){setTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");}
function initTheme(){
  let t=null;try{t=localStorage.getItem("hubTheme");}catch(e){}
  if(!t)t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
  setTheme(t);
}
function spreadAuthors(list){
  const out=[...list];
  for(let i=1;i<out.length;i++){
    if(out[i].a===out[i-1].a){
      let j=i+1;
      while(j<out.length&&out[j].a===out[i-1].a)j++;
      if(j<out.length){const [x]=out.splice(j,1);out.splice(i,0,x);}
    }
  }
  return out;
}
function interleaveByAuthor(posts){
  const by={};posts.forEach(p=>{(by[p.a]=by[p.a]||[]).push(p);});
  const qs=Object.values(by),out=[];let added=true;
  while(added){added=false;for(const q of qs){if(q.length){out.push(q.shift());added=true;}}}
  return out;
}
function postKey(p){const s=p.link&&p.link.u?p.link.u:(p.a+"|"+p.d+"|"+(p.body||"").slice(0,80));let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return "k"+(h>>>0).toString(36);}

/* ---------- helpers ---------- */
const AV_PALETTE = ["#1264a3","#0b7285","#5f3dc4","#c2255c","#e8590c","#2f9e44","#875a2c","#3b5bdb","#b5540a","#087f5b"];
function hashColor(s){let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return AV_PALETTE[h%AV_PALETTE.length];}
function initials(n){return n.replace(/\(.*?\)/g,"").split(/[\s/·]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function avFor(p){const a=AV[p.av];return a?{bg:a.bg,txt:a.txt}:{bg:hashColor(p.a),txt:initials(p.a)};}
function avatarStyle(key){const a=AV[key];return `style="background:${a.bg}"`;}
function badge(t){
  const map={official:["OFFICIAL","official"],industry:["INDUSTRY","industry"],
             voice:["THOUGHT LEADER","voice"],internal:["MAGESTIC","internal"]};
  const [label,cls]=map[t];return `<span class="badge ${cls}">${label}</span>`;
}
function matchesRole(tags){return activeRole==="Everyone"||tags.includes(activeRole)||tags.includes("Everyone");}
function liSearch(name){return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`;}
function newsLink(name){return `https://news.google.com/search?q=${encodeURIComponent('"'+name.replace(/\s*\(.*?\)/g,"")+'" AI')}`;}

/* ---------- roles ---------- */

/* ---------- feed ---------- */
function renderFeedPills(){
  document.getElementById("feedPills").innerHTML=Object.keys(FEED_FILTERS).map(f=>
    `<button class="pill ${f===feedFilter?'active':''}" onclick="feedFilter='${f}';renderFeedPills();renderFeed();">${f}</button>`).join("");
}
function renderFeed(){
  const q=document.getElementById("searchBox").value.trim().toLowerCase();
  const sort=document.getElementById("sortSel").value;
  let posts=POSTS.filter(p=>matchesRole(p.tags)).filter(FEED_FILTERS[feedFilter]);
  if(q)posts=posts.filter(p=>(p.a+" "+p.body+" "+p.topic+" "+p.tags.join(" ")).toLowerCase().includes(q));
  // heavyweight posts (w>=4: company-watch and core-relevance stories) stay in the top bucket ~24h longer;
  // in the Developers feed, how-to and instructional videos get an extra boost so education leads
  const wOf=p=>(p.w||0)+((feedFilter==="Developers"&&p.vid)?3:0);
  const today=new Date().toISOString().slice(0,10);
  const rankDay=p=>{if(wOf(p)>=4){const dt=new Date(p.d+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const s=dt.toISOString().slice(0,10);return s>today?today:s;}return p.d;};
  posts=[...posts].sort((x,y)=>sort==="topic"?x.topic.localeCompare(y.topic)||y.d.localeCompare(x.d):rankDay(y).localeCompare(rankDay(x))||wOf(y)-wOf(x)||y.d.localeCompare(x.d));
  if(sort!=="topic")posts=spreadAuthors(posts); // never two consecutive posts from the same source
  // single unified feed, newest first; role/pill/search are pure filters
  document.getElementById("feedCount").textContent=
    `${posts.length} post${posts.length===1?"":"s"}`+(activeRole!=="Everyone"?` · filtered for ${activeRole}`:"")+(q?` · matching "${q}"`:"");
  const postHTML=p=>{const k=postKey(p);return `
    <article class="card post" data-key="${k}">
      <div class="post-head">
        <div class="avatar" style="background:${avFor(p).bg}">${avFor(p).txt}</div>
        <div class="post-who">
          <div class="name">${p.a}${badge(p.t)}</div>
          <div class="sub">${p.s}</div>
          <div class="when">${p.when} · 2026</div>
        </div>
      </div>
      <div class="post-body">${String(p.body||"").trim().replace(/\n{3,}/g,"\n\n")}</div>
      ${p.img?`<a class="post-media" href="${p.link?p.link.u:"#"}" target="_blank" rel="noopener"><img src="${p.img}" loading="lazy" alt=""${/maxresdefault/.test(p.img)?` onerror="this.onerror=null;this.src='${p.img.replace("maxresdefault","hqdefault")}'"`:""}>${p.vid?'<span class="play-badge">▶</span>':''}</a>`:""}
      ${p.link?`<a class="post-link" href="${p.link.u}" target="_blank" rel="noopener"><b>${p.link.b} ↗</b><span>${p.link.s}</span></a>`:""}
      <div class="tags">
        <span class="tag topic">${p.topic}</span>
        ${p.tags.filter(t=>t!=="Everyone").map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>
      <div class="post-foot">
        ${p.link?`<a href="${p.link.u}" target="_blank" rel="noopener">Read source</a>`:""}
        <a href="#" class="act-save" data-key="${k}" onclick="return window.HUB?HUB.toggleSave('${k}',this):false;">☆ Save</a>
        <a href="#" class="act-share" data-key="${k}" onclick="return window.HUB?HUB.toggleShare('${k}'):false;">↗ Share with team</a>
        <a href="#" class="act-send" data-key="${k}" onclick="return window.HUB?HUB.openSend('${k}'):false;">➤ Send to…</a>
        <a href="#" class="act-comment" data-key="${k}" onclick="return window.HUB?HUB.toggleComments('${k}'):false;">💬 Comment</a>
      </div>
      <div class="comments-panel" id="cp-${k}" hidden></div>
    </article>`;};
  document.getElementById("feedList").innerHTML=posts.length?posts.map(postHTML).join(""):
    `<div class="card empty">No posts match. Try clearing the search or switching the role filter.</div>`;
  if(window.HUB)HUB.decorate();
}

/* ---------- right rail ---------- */
function renderWire(){
  // live industry wire: newest company-watch and industry items; static wire as fallback
  const live=POSTS.filter(p=>p.topic==="Company Watch"||p.topic==="Industry AI")
    .sort((x,y)=>y.d.localeCompare(x.d)).slice(0,20)
    .map(p=>({b:(p.link?p.link.b:p.body.split("\n")[0]).slice(0,80),s:`${p.a} · ${p.when}`,u:p.link?p.link.u:null}));
  const items=live.length?live:NEWS_WIRE;
  document.getElementById("newsWire").innerHTML=items.map(n=>
    `<div class="news-item"><b>${n.u?`<a href="${n.u}" target="_blank" rel="noopener" style="color:inherit">${n.b}</a>`:n.b}</b><span>${n.s}</span></div>`).join("");
}
function renderExpertRail(){
  // one voice per category, rotating daily so no one is privileged
  const cats=[...new Set(DIRECTORY.map(d=>d.c))];
  const day=Math.floor(Date.now()/86400000);
  const picks=cats.slice(0,6).map((c,i)=>{const g=DIRECTORY.filter(d=>d.c===c);return g[(day+i)%g.length];});
  document.getElementById("expertRail").innerHTML=picks.map(e=>`
    <div class="expert-row">
      <div class="avatar-sm" style="background:${hashColor(e.n)}">${initials(e.n)}</div>
      <div class="who"><b>${e.n}</b><span>${e.r}</span></div>
      <a class="follow-btn" href="${e.u||liSearch(e.n)}" target="_blank" rel="noopener">Follow</a>
    </div>`).join("");
}

/* ---------- industry watch ---------- */
let coFilter="All";
function renderCoPills(){
  const cats=["All","Suppliers & competitors","Customers & markets",...new Set(COMPANIES.map(c=>c.cat))];
  document.getElementById("coPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===coFilter?'active':''}" onclick="coFilter='${c.replace(/'/g,"\\'")}';renderCoPills();renderCompanies();">${c}</button>`).join("");
}
function renderPriority(){
  document.getElementById("prioGrid").innerHTML=COMPANIES.filter(c=>c.p).map(c=>`
    <div class="card prio-card" onclick="openBrief('${c.n.replace(/'/g,"\\'")}')" style="cursor:pointer">
      <div class="prio-tag">${c.side==="s"?"Competitor / supplier":"Customer / target market"}</div>
      <h3>${c.n}</h3>
      <div class="meta">${c.hq} · ${c.seg}${c.score!=null?` · <b>AI ${c.score}/10</b>`:""}${c.tier?` · ${c.tier}`:""}</div>
      <p>${c.note||""}</p>
      <div class="foot"><a href="#" onclick="event.stopPropagation();openBrief('${c.n.replace(/'/g,"\\'")}');return false;"><b>Open account brief →</b></a></div>
    </div>`).join("");
}
/* ---------- account briefing (Sales) ---------- */
function briefPostsFor(name){
  const clean=name.replace(/\s*\(.*?\)/g,"").trim();
  const re=new RegExp("\\b"+clean.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").split(/\s+/)[0],"i");
  return POSTS.filter(p=>p.a===name||(p.topic==="Company Watch"&&re.test(p.a))||re.test((p.link?p.link.b:"")+" "+p.body))
    .sort((x,y)=>y.d.localeCompare(x.d)).slice(0,8);
}
function openBrief(name){
  const c=COMPANIES.find(x=>x.n===name)||{n:name};
  const posts=briefPostsFor(name);
  const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  let old=document.getElementById("briefModal");if(old)old.remove();
  const div=document.createElement("div");div.id="briefModal";div.className="hub-modal";
  const newsList=posts.length?posts.map(p=>`
    <div class="brief-item">
      <a href="${p.link?p.link.u:"#"}" target="_blank" rel="noopener">${esc((p.link?p.link.b:p.body.split("\n")[0]).slice(0,110))}</a>
      <span class="comment-when">${esc(p.a)} · ${esc(p.when)}</span>
    </div>`).join(""):`<div class="comment-hint">No recent AI news captured for ${esc(name)} in the current feed window. The Company Watch pull cycles the full list every few hours.</div>`;
  const rel=c.side==="s"?"Competitor / supplier":"Customer / target market";
  const scoreLine=c.score!=null?`AI-leadership score <b>${c.score}/10</b>${c.tier?` · ${esc(c.tier)}`:""}`:"Not yet scored";
  div.innerHTML=`
    <div class="hub-modal-card" style="width:min(620px,94vw);max-height:88vh;overflow:auto;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h3 style="margin-bottom:2px">${esc(c.n)}</h3><div class="comment-when">${esc(c.hq||"")} · ${esc(c.seg||"")}</div></div>
        <a href="#" class="auth-link" onclick="document.getElementById('briefModal').remove();return false;">✕ Close</a>
      </div>
      <div class="brief-score">${rel} · ${scoreLine}</div>
      ${c.note?`<p style="font-size:13px;color:var(--ink-2);margin:8px 0"><b>AI posture:</b> ${esc(c.note)}</p>`:""}
      <h4 class="brief-h">Recent AI news</h4>
      ${newsList}
      <h4 class="brief-h">Talking points for a customer call</h4>
      <ul class="brief-points">
        <li>${c.side==="s"?"Position against their AI program: where does Magestic's nesting/composites depth beat a generalist CAD/CAM AI push?":"Their AI-leadership score is "+(c.score!=null?c.score+"/10 — ":"")+"open with how Magestic's AI roadmap complements where they already are."}</li>
        <li>Reference the most recent item above — showing you track their AI moves builds credibility fast.</li>
        <li>Tie back to Magestic's Responsible AI posture (US-origin tooling, human-reviewed, ITAR-aware) — a differentiator for defense-adjacent accounts.</li>
      </ul>
      <div class="hub-modal-actions">
        <a class="auth-btn" style="text-decoration:none" href="${newsLink(c.n)}" target="_blank" rel="noopener">Live news search ↗</a>
        ${c.src?`<a href="${c.src}" target="_blank" rel="noopener" class="auth-link">AI source ↗</a>`:""}
      </div>
    </div>`;
  div.addEventListener("click",e=>{if(e.target===div)div.remove();});
  document.body.appendChild(div);
}
/* ---------- weekly leadership brief ---------- */
function openWeeklyBrief(){
  const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const cut=new Date();cut.setUTCDate(cut.getUTCDate()-7);const cutS=cut.toISOString().slice(0,10);
  const week=POSTS.filter(p=>p.d>=cutS&&p.topic!=="internal")
    .sort((x,y)=>(y.w||0)-(x.w||0)||y.d.localeCompare(x.d));
  const seen=new Set(),top=[];
  for(const p of week){const k=(p.a+p.topic).toLowerCase();if(top.length<6&&!seen.has(k)){seen.add(k);top.push(p);}}
  const soWhat=p=>p.topic==="Company Watch"?"A tracked account/competitor is moving on AI — sales and account teams should note it.":
    p.topic==="Regulatory"?"Compliance-relevant: bears on how Magestic and its customers can deploy AI.":
    p.topic==="Tools"?"Developer-tooling shift — affects how the engineering team builds with AI.":
    "Frontier/industry movement worth leadership awareness.";
  let old=document.getElementById("wbModal");if(old)old.remove();
  const div=document.createElement("div");div.id="wbModal";div.className="hub-modal";
  div.innerHTML=`<div class="hub-modal-card" style="width:min(640px,94vw);max-height:88vh;overflow:auto;text-align:left">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h3 style="margin-bottom:2px">This week in AI — leadership brief</h3><div class="comment-when">Auto-generated from the week's highest-weighted posts. Review before forwarding.</div></div>
      <a href="#" class="auth-link" onclick="document.getElementById('wbModal').remove();return false;">✕ Close</a>
    </div>
    <ol class="brief-points" style="margin-top:12px">
      ${top.map(p=>`<li style="margin-bottom:10px"><a href="${p.link?p.link.u:"#"}" target="_blank" rel="noopener"><b>${esc((p.link?p.link.b:p.body.split("\n")[0]).slice(0,120))}</b></a><br><span style="font-size:12px;color:var(--ink-3)">${esc(p.a)} · ${esc(p.when)}</span><br><span style="font-size:12.5px;color:var(--ink-2)">So what: ${soWhat(p)}</span></li>`).join("")}
    </ol>
    ${top.length===0?`<div class="comment-hint">Not enough posts in the last 7 days yet — check back after a few refresh cycles.</div>`:""}
    <div class="comment-hint">Tip: copy these bullets straight into a leadership email or meeting doc.</div>
  </div>`;
  div.addEventListener("click",e=>{if(e.target===div)div.remove();});
  document.body.appendChild(div);
}
function renderCompanies(){
  const q=(document.getElementById("coSearch").value||"").trim().toLowerCase();
  let items=COMPANIES;
  if(coFilter==="Suppliers & competitors")items=items.filter(c=>c.side==="s");
  else if(coFilter==="Customers & markets")items=items.filter(c=>c.side==="d");
  else if(coFilter!=="All")items=items.filter(c=>c.cat===coFilter);
  if(q)items=items.filter(c=>(c.n+" "+c.hq+" "+c.seg+" "+c.cat+" "+(c.tier||"")).toLowerCase().includes(q));
  items=[...items].sort((x,y)=>(y.score??-1)-(x.score??-1));
  document.getElementById("coCount").textContent=`${items.length} of ${COMPANIES.length} companies`;
  document.getElementById("coGrid").innerHTML=items.length?items.map(c=>`
    <div class="card co-row" onclick="openBrief('${c.n.replace(/'/g,"\\'")}')" style="cursor:pointer">
      <span class="side-dot ${c.side==="s"?"supply":"demand"}" title="${c.side==="s"?"Supplier/competitor":"Customer/market"}"></span>
      <div class="who"><b>${c.n}</b><span>${c.hq} · ${c.seg}${c.score!=null?` · AI ${c.score}/10 ${c.tier}`:""}</span></div>
      <a class="go" href="#" onclick="event.stopPropagation();openBrief('${c.n.replace(/'/g,"\\'")}');return false;">Brief →</a>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">No companies match this filter.</div>`;
}

/* ---------- learning ---------- */
let learnFilter="All";
function renderLearnPills(){
  const cats=["All","Developers","Database Engineers","Leadership","Marketing"];
  document.getElementById("learnPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===learnFilter?'active':''}" onclick="learnFilter='${c}';renderLearnPills();renderLearning();">${c}</button>`).join("");
}
function renderLearning(){
  let items=LEARNING.filter(l=>learnFilter==="All"||l.cat===learnFilter);
  items=items.filter(l=>matchesRole(l.who));
  document.getElementById("learnGrid").innerHTML=items.length?items.map(l=>`
    <div class="card res-card">
      <div class="kicker">${l.cat}</div>
      <h3>${l.h}</h3>
      <p>${l.p}</p>
      <div class="tags" style="margin-bottom:9px">${l.who.filter(w=>w!=="Everyone").map(w=>`<span class="tag">${w}</span>`).join("")||'<span class="tag">All roles</span>'}</div>
      <div class="foot">${l.links.map(([t,u])=>u==="#experts"?`<a href="#" onclick="showView('experts');return false;">${t}</a>`:`<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join(" · ")}</div>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">Nothing in this category for the selected role. Switch the role filter on the Feed tab back to Everyone.</div>`;
}

/* ---------- tools ---------- */
function renderToolsGrid(){
  const items=TOOLS.filter(t=>t.sec||matchesRole(t.who));
  document.getElementById("toolsGrid").innerHTML=items.map(t=>t.sec?`<h2 class="tools-sec">${t.sec}</h2>`:`
    <div class="card res-card">
      <h3>${t.h}</h3>
      <p>${t.p}</p>
      <div class="tags" style="margin-bottom:9px">${t.who.filter(w=>w!=="Everyone").map(w=>`<span class="tag">${w}</span>`).join("")||'<span class="tag">All roles</span>'}</div>
      <div class="foot">${t.links.map(([lbl,u])=>`<a href="${u}" target="_blank" rel="noopener">${lbl} ↗</a>`).join(" · ")}</div>
    </div>`).join("");
}

/* ---------- experts: featured + directory ---------- */
let dirFilter="All";
function renderDirPills(){
  const cats=["All",...Object.keys(DIR_CATS)];
  document.getElementById("dirPills").innerHTML=cats.map(c=>
    `<button class="pill ${c===dirFilter?'active':''}" onclick="dirFilter='${c.replace(/'/g,"\\'")}';renderDirPills();renderDirectory();">${c}</button>`).join("");
}
function renderDirectory(){
  const q=(document.getElementById("dirSearch").value||"").trim().toLowerCase();
  let items=DIRECTORY;
  if(dirFilter!=="All")items=items.filter(d=>d.c===dirFilter);
  if(activeRole!=="Everyone")items=items.filter(d=>{
    const roles=DIR_CATS[d.c]||["Everyone"];
    return roles.includes(activeRole)||roles.includes("Everyone");
  });
  if(q)items=items.filter(d=>(d.n+" "+d.r+" "+d.c).toLowerCase().includes(q));
  document.getElementById("dirCount").textContent=`${items.length} of ${DIRECTORY.length} voices, all equal`;
  document.getElementById("dirGrid").innerHTML=items.length?items.map(d=>`
    <div class="card dir-row">
      <div class="avatar-sm" style="background:${hashColor(d.n)}">${initials(d.n)}</div>
      <div class="who"><b>${d.n}</b><span>${d.r}</span></div>
      <a class="go" href="${d.u||liSearch(d.n)}" target="_blank" rel="noopener">${d.u?"Visit ↗":"Find ↗"}</a>
    </div>`).join("")
    :`<div class="card empty" style="grid-column:1/-1">No people match this filter.</div>`;
}

/* ---------- navigation ---------- */
function showView(v){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));
  document.getElementById("view-feed").classList.toggle("hidden",v!=="feed");
  ["industry","learning","tools","experts"].forEach(p=>
    document.getElementById("view-"+p).classList.toggle("visible",v===p));
  window.scrollTo({top:0});
}

/* ---------- benchmark & cost charts (Tools page) ---------- */
// Four lab tracks, best score per lab over time. Each point: [date, score, label, dx, dy, anchor]
const SWE_SERIES=[
 {n:"Anthropic (Claude)",c:"#16233f",pts:[
   ["2024-06",49,"3.5 Sonnet",0,20,"middle"],["2025-02",62,"3.7 Sonnet",-8,-8,"end"],
   ["2025-06",81,"Opus 4.5",-6,-11,"end"],["2025-11",87.5,"Opus 4.7",-8,-8,"end"],
   ["2026-03",88.5,"Opus 4.8",10,4,"start"],["2026-07",95,"Fable 5",9,4,"start"]]},
 {n:"OpenAI",c:"#3f7d44",pts:[
   ["2025-01",49,"o1",8,4,"start"],["2025-04",69,"o3",-8,-6,"end"],
   ["2025-08",75,"GPT-5",6,15,"start"],["2026-01",80.5,"GPT-5.2",-8,-8,"end"],
   ["2026-07",80.5,"GPT-5.5",9,4,"start"]]},
 {n:"Google",c:"#4a90d9",pts:[
   ["2025-03",63.8,"Gemini 2.5 Pro",6,15,"start"],["2025-11",76,"Gemini 3 Pro",6,15,"start"],
   ["2026-05",80.5,"Gemini 3.1 Pro",0,-11,"middle"]]},
 {n:"Open weight frontier",c:"#c96a2b",pts:[
   ["2024-12",42,"DeepSeek V3",0,18,"middle"],["2025-02",49,"DeepSeek R1",6,15,"start"],
   ["2025-07",69.5,"Qwen3-Coder",0,18,"middle"],["2026-02",77.5,"DeepSeek V4 Pro",6,15,"start"],
   ["2026-07",82.5,"Ornith-1.0",9,4,"start"]]}
];
function buildSweSvg(){
  const W=820,H=560,L=64,R=150,T=24,B=46;
  const mIdx=d=>{const[y,m]=d.split("-").map(Number);return (y-2024)*12+(m-5);}; // May 2024 = 0
  const xMax=mIdx("2026-07"),yMin=30,yMax=100;
  const X=d=>L+(W-L-R)*(mIdx(d)/xMax), Y=v=>T+(H-T-B)*(1-(v-yMin)/(yMax-yMin));
  let out=[];
  for(let v=30;v<=100;v+=10){out.push(`<line x1="${L}" y1="${Y(v)}" x2="${W-R}" y2="${Y(v)}" class="sw-grid"/><text x="${L-10}" y="${Y(v)+4}" class="sw-lab" text-anchor="end">${v}</text>`);}
  // 95% reference line (dotted)
  out.push(`<line x1="${L}" y1="${Y(95)}" x2="${W-R}" y2="${Y(95)}" style="stroke:#9aa4b2;stroke-width:1;stroke-dasharray:2 3"/>`);
  // y-axis title
  out.push(`<text transform="translate(${16},${T+(H-T-B)/2}) rotate(-90)" class="sw-lab" text-anchor="middle" style="font-size:12px">% of 500 real GitHub issues resolved</text>`);
  [["2024-06","mid-2024"],["2025-01","2025"],["2025-07","mid-2025"],["2026-01","2026"],["2026-07","mid-2026"]]
    .forEach(([d,l])=>out.push(`<text x="${X(d)}" y="${H-B+20}" class="sw-lab" text-anchor="middle">${l}</text>`));
  out.push(`<line x1="${L}" y1="${Y(yMin)}" x2="${W-R}" y2="${Y(yMin)}" class="sw-axis"/>`);
  // series: solid line, dots, per-point labels
  for(const sr of SWE_SERIES){
    if(sr.pts.length>1){
      const d=sr.pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+","+Y(p[1]).toFixed(1)).join(" ");
      out.push(`<path d="${d}" class="sw-line" style="stroke:${sr.c};stroke-width:2.2;fill:none"/>`);
    }
    for(const p of sr.pts){
      out.push(`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" class="sw-dot" style="fill:${sr.c}"><title>${p[2]} — ${p[1]}% (${p[0]})</title></circle>`);
      out.push(`<text x="${X(p[0])+(p[3]||0)}" y="${Y(p[1])+(p[4]||0)}" text-anchor="${p[5]||"start"}" style="font-size:11px;fill:#555">${p[2]}</text>`);
    }
  }
  // legend (bottom-right, inside plot)
  const lx=W-R-186,ly=H-B-92;
  SWE_SERIES.forEach((sr,i)=>{
    const yy=ly+i*20;
    out.push(`<line x1="${lx}" y1="${yy}" x2="${lx+26}" y2="${yy}" style="stroke:${sr.c};stroke-width:3"/>`);
    out.push(`<text x="${lx+34}" y="${yy+4}" style="font-size:12px;fill:var(--ink)">${sr.n}</text>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="SWE-bench Verified coding scores over time, grouped into four lab tracks: Anthropic, OpenAI, Google, and open weight frontier" style="width:100%;height:auto">${out.join("")}</svg>`;
}
const COST_BARS=[
 ["Claude Fable 5",50,true],["GPT-5.6 Sol",30,true],["Claude Opus 4.8",25,true],
 ["Gemini 3.1 Pro",15,true],["GPT-5.6 Terra",15,true],["Claude Sonnet 5",10,true],
 ["Gemini 3.5 Flash",9,true],["Qwen3.7 Max (hosted)",7.5,false],["Grok 4.5",6,true],
 ["GPT-5.6 Luna",6,true],["Inkling (hosted)",4.68,false],["Muse Spark 1.1",4.25,true],
 ["Kimi K2 (hosted)",3,false],["DeepSeek V4 (hosted)",1.7,false]
];
function buildCostSvg(){
  const W=780,rowH=25,L=190,R=60,T=12,B=30,H=T+B+COST_BARS.length*rowH;
  const max=52,X=v=>L+(W-L-R)*(v/max);
  let out=[];
  for(const g of [10,20,30,40,50])out.push(`<line x1="${X(g)}" y1="${T}" x2="${X(g)}" y2="${H-B}" class="sw-grid"/><text x="${X(g)}" y="${H-B+16}" class="sw-lab" text-anchor="middle">$${g}</text>`);
  COST_BARS.forEach(([n,v,closed],i)=>{
    const y=T+i*rowH;
    out.push(`<text x="${L-8}" y="${y+rowH/2+4}" class="sw-lab" text-anchor="end">${n}</text>`);
    out.push(`<rect x="${L}" y="${y+4}" width="${Math.max(X(v)-L,2)}" height="${rowH-9}" rx="4" class="cost-bar ${closed?"sw-closed":"sw-open"}"><title>${n} — $${v} per 1M output tokens (${closed?"closed-weight API":"open-weight, hosted"})</title></rect>`);
    out.push(`<text x="${X(v)+6}" y="${y+rowH/2+4}" class="sw-plab">$${v}</text>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Price per million output tokens by model" style="width:100%;height:auto">${out.join("")}</svg>`;
}
const METR_PTS=[["2023-03",4,"GPT-4"],["2024-05",8,"GPT-4o"],["2024-10",40,"Claude 3.5 Sonnet"],["2025-03",75,"o3 / Claude 3.7"],["2025-06",137,"GPT-5"],["2025-07",289,"Claude Opus 4.5"],["2026-02",870,"Claude Opus 4.6"]];
function buildMetrSvg(){
  const W=780,H=330,L=56,R=30,T=16,B=42;
  const mIdx=d=>{const[y,m]=d.split("-").map(Number);return (y-2023)*12+(m-3);}; // Mar 2023 = 0
  const xMax=mIdx("2026-12");
  const lg=v=>Math.log2(v), yMin=lg(3), yMax=lg(2400);
  const X=d=>L+(W-L-R)*(mIdx(d)/xMax), Y=v=>T+(H-T-B)*(1-(lg(v)-yMin)/(yMax-yMin));
  let out=[];
  const ticks=[[4,"4 min"],[15,"15 min"],[60,"1 hr"],[240,"4 hr"],[960,"16 hr"],[1920,"32 hr"]];
  for(const[v,l] of ticks)out.push(`<line x1="${L}" y1="${Y(v)}" x2="${W-R}" y2="${Y(v)}" class="sw-grid"/><text x="${L-8}" y="${Y(v)+4}" class="sw-lab" text-anchor="end">${l}</text>`);
  [["2023-03","Mar '23"],["2024-01","Jan '24"],["2025-01","Jan '25"],["2026-01","Jan '26"],["2026-12","Dec '26"]]
    .forEach(([d,l])=>out.push(`<text x="${X(d)}" y="${H-B+18}" class="sw-lab" text-anchor="middle">${l}</text>`));
  // dashed doubling-trend extension from the last measured point (~doubling every 4-5 months recently)
  const last=METR_PTS[METR_PTS.length-1];
  const trendEnd=870*Math.pow(2,(mIdx("2026-12")-mIdx("2026-02"))/4.5);
  out.push(`<path d="M${X(last[0])},${Y(last[1])} L${X("2026-12")},${Y(trendEnd)}" class="sw-line" style="stroke:var(--chart-open)" stroke-dasharray="5 5" opacity="0.7"/>`);
  out.push(`<text x="${X("2026-12")-6}" y="${Y(trendEnd)+16}" class="sw-lab" text-anchor="end">trend if doubling continues</text>`);
  const line=METR_PTS.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+","+Y(p[1]).toFixed(1)).join(" ");
  out.push(`<path d="${line}" class="sw-line" style="stroke:var(--chart-closed)"/>`);
  for(const p of METR_PTS)out.push(`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" class="sw-dot" style="fill:var(--chart-closed)"><title>${p[2]} — ${p[1]>=60?(p[1]/60).toFixed(1)+" hours":p[1]+" min"} (${p[0]})</title></circle>`);
  const plabs=[["2023-03",4,"GPT-4",-10,"start"],["2024-05",8,"GPT-4o",-10,"middle"],["2024-10",40,"Claude 3.5",-10,"middle"],["2025-03",75,"o3 / 3.7",22,"middle"],["2025-06",137,"GPT-5",22,"middle"],["2025-07",289,"Opus 4.5",-12,"middle"],["2026-02",870,"Opus 4.6 · 14.5 hr",-12,"middle"]];
  for(const[d,v,t,dy,a] of plabs)out.push(`<text x="${X(d)}" y="${Y(v)+dy}" class="sw-plab" text-anchor="${a}">${t}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="METR 50 percent time horizon: how long an autonomous task frontier models can complete, log scale, doubling roughly every 4 to 7 months" style="width:100%;height:auto">${out.join("")}</svg>`;
}
function renderSweChart(){
  const el=document.getElementById("sweChart");if(el)el.innerHTML=buildSweSvg();
  const ce=document.getElementById("costChart");if(ce)ce.innerHTML=buildCostSvg();
  const me=document.getElementById("metrChart");if(me)me.innerHTML=buildMetrSvg();
}
/* ---------- stats + init ---------- */
function renderUpdated(){
  const el=document.getElementById("lastUpdated");
  if(!el)return;
  let d=null;
  if(typeof FEED_GENERATED!=="undefined")d=new Date(FEED_GENERATED);
  else if(typeof POSTS_LIVE!=="undefined"&&POSTS_LIVE.length)d=new Date(POSTS_LIVE[0].d+"T12:00:00Z");
  if(!d||isNaN(d))return;
  const day=d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const time=(typeof FEED_GENERATED!=="undefined")?" · "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  el.textContent="Updated "+day+time;
}
function renderStats(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set("statPosts",POSTS.length);set("statLearning",LEARNING.length);
  set("statCompanies",COMPANIES.length);set("statExperts",DIRECTORY.length);
}
initTheme();renderUpdated();renderFeedPills();renderFeed();renderWire();renderExpertRail();
renderPriority();renderCoPills();renderCompanies();
renderLearnPills();renderLearning();renderToolsGrid();renderSweChart();
renderDirPills();renderDirectory();renderStats();
