/* Magestic AI Hub — team accounts, saved posts, comments.
   Backed by Supabase (project: Magestic AI Dashboard / yfzeiekuqgruubanksoo).
   Sign-up is restricted to @magestictech.com addresses at the database level.
   Email confirmation is disabled in the project's Auth settings: the first
   sign-in creates the account and enters the site immediately. */
(function(){
  const SUPABASE_URL = "https://yfzeiekuqgruubanksoo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_FH8NK4e7DE4k60tKMGl2RA_GRXZu9tV";
  const TEAM_DOMAIN = "magestictech.com";
  if (typeof supabase === "undefined") {
    // The Supabase CDN script didn't load (network/firewall). Rather than silently break the
    // sign-in button, show a clear message on the gate so the failure is diagnosable.
    console.warn("supabase-js not loaded; team features disabled");
    window.HUB = window.HUB || {};
    const notLoaded = () => { const m = document.getElementById("gateMsg"); if (m) { m.textContent = "Couldn't load the sign-in library (a network filter or extension may be blocking cdn.jsdelivr.net). Try another network or browser."; m.className = "hub-msg err"; } };
    window.HUB.gateSubmit = notLoaded; window.HUB.submit = notLoaded;
    window.HUB.openModal = () => {}; window.HUB.toggleSave = () => false; window.HUB.toggleShare = () => false;
    window.HUB.openSend = () => false; window.HUB.toggleComments = () => false; window.HUB.decorate = () => {}; window.HUB.isSaved = () => false;
    return;
  }
  // Disable the Web Locks coordination: on GitHub Pages the UMD build can deadlock
  // (auth request completes server-side with 200 but the client promise never resolves,
  // leaving sign-in stuck). A pass-through lock runs the callback immediately and avoids it.
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { lock: async (_name, _acquireTimeout, fn) => await fn() }
  });
  // supabase-js persists sessions under this localStorage key. We also write it
  // ourselves after a direct-fetch sign-in, because relying on setSession alone
  // proved fragile (sessions were silently not saved, forcing a login on every
  // new browser window).
  const STORAGE_KEY = "sb-" + SUPABASE_URL.replace("https://", "").split(".")[0] + "-auth-token";
  function persistSession(sessionData){
    try {
      if (sessionData && sessionData.access_token && sessionData.refresh_token) {
        if (!sessionData.expires_at && sessionData.expires_in)
          sessionData.expires_at = Math.floor(Date.now() / 1000) + sessionData.expires_in;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      }
    } catch (e) { console.warn("could not persist session:", e); }
  }

  // Gate logo: reuse the header's embedded Magestic logo image
  try { const hl = document.querySelector(".logo-img"), gl = document.getElementById("gateLogo"); if (hl && gl) gl.src = hl.src; } catch (e) {}

  let user = null;
  let saves = new Set();
  let counts = {};           // post_key -> comment count
  let profiles = [];         // team members
  let shares = [];           // recent team shares
  let myShares = new Set();
  let inbox = [];            // posts sent directly to me

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function gateMsg(t, ok){ const m = document.getElementById("gateMsg"); if (m) { m.textContent = t; m.className = "hub-msg" + (ok ? " ok" : " err"); } }
  function showGate(show){
    const g = document.getElementById("authGate"); if (g) g.hidden = !show;
    // if the pre-paint check hid the gate but the session proved invalid, un-hide it
    if (show) document.documentElement.classList.remove("authed");
    document.body.style.overflow = show ? "hidden" : "";
  }
  // Direct-fetch sign-in: bypasses the supabase-js auth path (which can deadlock on GitHub
  // Pages, leaving the button stuck on "Signing in…"). A plain fetch cannot hang the UI, and
  // we reveal the app the instant the token comes back — before any SDK call runs.
  async function doSignIn(emailId, passId, report, onOk){
    const email = (document.getElementById(emailId).value || "").trim().toLowerCase();
    const pass = document.getElementById(passId).value;
    if (!email.endsWith("@" + TEAM_DOMAIN)) return report(`Use your @${TEAM_DOMAIN} email address.`);
    if (!pass) return report("Enter your password.");
    report("Signing in…", true);
    const H = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
    let res, data;
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("__timeout__")), 8000));
    try {
      res = await Promise.race([fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass }) }), timeout]);
      data = await res.json();
    } catch (e) {
      if (e && e.message === "__timeout__") return report("Sign-in is taking too long — a browser extension (often a crypto-wallet extension) may be blocking the page. Try an incognito window, a different browser, or disabling extensions.");
      return report("Network error — check your connection and try again.");
    }
    if (res.ok && data.access_token) {
      // reveal immediately, bulletproof: hide gate first, then non-critical UI in try/catch
      user = data.user;
      persistSession(data); // guarantee the session survives browser restarts
      const g = document.getElementById("authGate"); if (g) g.remove();
      document.body.style.overflow = "";
      try { renderAuthBox(); } catch (e) {}
      try { onOk(); } catch (e) {}
      try { await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token }); } catch (e) { console.warn("setSession failed:", e); }
      setTimeout(refreshData, 0);
      return;
    }
    const emsg = (data && (data.error_description || data.msg || data.error_code || data.error)) || "";
    if (/not confirmed/i.test(emsg)) return report("Your email isn't confirmed yet — check your inbox for the link, then sign in.");
    if (res.status === 400 || /invalid|credentials/i.test(emsg)) {
      // No confirmed account with these credentials — try to create one.
      let su, sud;
      try {
        su = await fetch(SUPABASE_URL + "/auth/v1/signup", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } }) });
        sud = await su.json();
      } catch (e) { return report("Network error — try again."); }
      if (!su.ok) return report(/restricted to @|domain/i.test(sud.msg || sud.error_description || "") ? `Signups are restricted to @${TEAM_DOMAIN} addresses.` : (sud.msg || sud.error_description || "Sign-up failed — check the password."));
      if (sud.user && Array.isArray(sud.user.identities) && sud.user.identities.length === 0)
        return report("An account already exists with this email — check the password.");
      if (sud.access_token) {
        // Confirmation is disabled: the signup response includes a session, so enter directly.
        user = sud.user;
        persistSession(sud); // guarantee the session survives browser restarts
        const g2 = document.getElementById("authGate"); if (g2) g2.remove();
        document.body.style.overflow = "";
        try { renderAuthBox(); } catch (e) {}
        try { onOk(); } catch (e) {}
        try { await sb.auth.setSession({ access_token: sud.access_token, refresh_token: sud.refresh_token }); } catch (e) { console.warn("setSession failed:", e); }
        setTimeout(refreshData, 0);
        return;
      }
      return report("Account created — sign in with the same email and password.", true);
    }
    report(emsg || "Sign-in failed — try again.");
  }
  const nameFromEmail = e => e.split("@")[0].split(/[._-]+/).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  // Prefer the Microsoft (Entra) display name — matches company formatting
  // (e.g. "Matthew DiGeronimo") — over the email-derived fallback.
  const displayName = u => (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || nameFromEmail(u.email);
  const initialsOf = n => n.split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();

  /* ---------- auth box in the header ---------- */
  function renderAuthBox(){
    const box = document.getElementById("authBox");
    if (!box) return;
    if (user) {
      const n = displayName(user);
      box.innerHTML = `<span class="auth-user"><span class="avatar-xs">${initialsOf(n)}</span>${esc(n)}</span>
        <a href="#" class="auth-link" onclick="HUB.signOut();return false;">Sign out</a>`;
    } else {
      box.innerHTML = `<button class="auth-btn" onclick="HUB.openModal()">Team sign in</button>`;
    }
  }

  /* ---------- modal ---------- */
  function ensureModal(){
    if (document.getElementById("hubModal")) return;
    const div = document.createElement("div");
    div.id = "hubModal"; div.className = "hub-modal"; div.hidden = true;
    div.innerHTML = `
      <div class="hub-modal-card">
        <h3>Magestic team sign in</h3>
        <div id="hubMsg" class="hub-msg"></div>
        <div class="hub-modal-actions">
          <button class="auth-btn" style="background:#2f2f2f" onclick="HUB.msSignIn()">Sign in with Microsoft</button>
          <a href="#" class="auth-link" onclick="HUB.closeModal();return false;">Cancel</a>
        </div>
      </div>`;
    div.addEventListener("click", e => { if (e.target === div) HUB.closeModal(); });
    document.body.appendChild(div);
  }
  function msg(t, ok){ const m = document.getElementById("hubMsg"); m.textContent = t; m.className = "hub-msg" + (ok ? " ok" : " err"); }

  /* ---------- data ---------- */
  async function refreshData(){
    if (!user) { saves = new Set(); counts = {}; profiles = []; shares = []; myShares = new Set(); inbox = []; decorate(); renderTeam(); renderInbox(); return; }
    const [sv, cm, pf, sh, ib] = await Promise.all([
      sb.from("saves").select("post_key"),
      sb.from("comments").select("post_key"),
      sb.from("profiles").select("id,display_name,email").order("display_name"),
      sb.from("shares").select("user_id,author_name,post_key,post_title,post_url,created_at").order("created_at", { ascending: false }).limit(15),
      sb.from("direct_shares").select("id,from_user,from_name,to_user,post_title,post_url,note,read,created_at").order("created_at", { ascending: false }).limit(30)
    ]);
    saves = new Set((sv.data || []).map(r => r.post_key));
    counts = {};
    (cm.data || []).forEach(r => { counts[r.post_key] = (counts[r.post_key] || 0) + 1; });
    profiles = pf.data || [];
    shares = sh.data || [];
    myShares = new Set(shares.filter(s => s.user_id === user.id).map(s => s.post_key));
    inbox = (ib.data || []).filter(r => r.to_user === user.id).slice(0, 10);
    decorate();
    renderTeam();
    renderInbox();
  }

  function renderInbox(){
    const el = document.getElementById("inboxList");
    if (!el) return;
    if (!user) { el.innerHTML = `<div class="comment-hint">Sign in to receive posts sent to you.</div>`; return; }
    if (!inbox.length) { el.innerHTML = `<div class="comment-hint">Nothing yet — teammates can send you posts with "Send to…".</div>`; return; }
    el.innerHTML = inbox.map(s => `
      <div class="share-row${s.read ? "" : " unread"}">
        <b>${esc(s.from_name)}</b> sent you
        <div>${s.post_url ? `<a href="${esc(s.post_url)}" target="_blank" rel="noopener" onclick="HUB.markRead(${s.id})">${esc(s.post_title)}</a>` : esc(s.post_title)}</div>
        ${s.note ? `<div class="share-note">“${esc(s.note)}”</div>` : ""}
        <span class="comment-when">${new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
        · <a href="#" class="auth-link" onclick="HUB.dismissShare(${s.id});return false;">dismiss</a>
      </div>`).join("");
  }

  function postMeta(k){
    const p = (typeof POSTS !== "undefined" ? POSTS : []).find(x => postKey(x) === k);
    return {
      title: p ? (p.link && p.link.b ? p.link.b : (p.body || "").split("\n")[0].slice(0, 120)) : "a post",
      url: p && p.link ? p.link.u : null
    };
  }

  function renderTeam(){
    const list = document.getElementById("teamList");
    const shr = document.getElementById("teamShares");
    if (list) {
      if (!user) list.innerHTML = `<div class="comment-hint">Sign in to see who's on the hub.</div>`;
      else if (!profiles.length) list.innerHTML = `<div class="comment-hint">No members yet.</div>`;
      else list.innerHTML = profiles.map(m => `
        <div class="team-row">
          <span class="avatar-xs">${initialsOf(m.display_name)}</span>
          <span class="team-name">${esc(m.display_name)}${user && m.id === user.id ? ' <span class="team-you">· you</span>' : ""}</span>
        </div>`).join("");
    }
    if (shr) {
      if (!user) shr.innerHTML = `<div class="comment-hint">Articles teammates share appear here.</div>`;
      else if (!shares.length) shr.innerHTML = `<div class="comment-hint">Nothing shared yet — use "Share with team" on any post.</div>`;
      else shr.innerHTML = shares.map(s => `
        <div class="share-row">
          <b>${esc(s.author_name)}</b> shared
          <div>${s.post_url ? `<a href="${esc(s.post_url)}" target="_blank" rel="noopener">${esc(s.post_title)}</a>` : esc(s.post_title)}</div>
          <span class="comment-when">${new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
        </div>`).join("");
    }
  }

  function decorate(){
    document.querySelectorAll(".act-save").forEach(el => {
      const k = el.dataset.key;
      const on = saves.has(k);
      el.textContent = on ? "★ Saved" : "☆ Save";
      el.classList.toggle("saved", on);
    });
    document.querySelectorAll(".act-comment").forEach(el => {
      const c = counts[el.dataset.key] || 0;
      el.textContent = c ? `💬 ${c} comment${c === 1 ? "" : "s"}` : "💬 Comment";
    });
    document.querySelectorAll(".act-share").forEach(el => {
      const on = myShares.has(el.dataset.key);
      el.textContent = on ? "✓ Shared" : "↗ Share with team";
      el.classList.toggle("saved", on);
    });
  }

  /* ---------- comments ---------- */
  async function renderComments(k){
    const panel = document.getElementById("cp-" + k);
    if (!panel) return;
    if (!user) { panel.innerHTML = `<div class="comment-hint">Sign in with your @${TEAM_DOMAIN} email to comment.</div>`; return; }
    panel.innerHTML = `<div class="comment-hint">Loading…</div>`;
    const { data, error } = await sb.from("comments").select("id,author_name,body,created_at,user_id").eq("post_key", k).order("created_at");
    if (error) { panel.innerHTML = `<div class="comment-hint">Could not load comments.</div>`; return; }
    const rows = (data || []).map(c => `
      <div class="comment-row">
        <span class="avatar-xs">${initialsOf(c.author_name)}</span>
        <div class="comment-body"><b>${esc(c.author_name)}</b> <span class="comment-when">${new Date(c.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span><br>${esc(c.body)}
        ${c.user_id === user.id ? ` <a href="#" class="auth-link" onclick="HUB.deleteComment(${c.id},'${k}');return false;">delete</a>` : ""}</div>
      </div>`).join("");
    panel.innerHTML = rows + `
      <div class="comment-form">
        <input id="ci-${k}" type="text" maxlength="2000" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')HUB.postComment('${k}')">
        <button class="auth-btn" onclick="HUB.postComment('${k}')">Post</button>
      </div>`;
  }

  /* ---------- public API ---------- */
  window.HUB = {
    isSaved: k => saves.has(k),
    decorate,
    openModal(){ ensureModal(); document.getElementById("hubModal").hidden = false; msg("", true); },
    closeModal(){ const m = document.getElementById("hubModal"); if (m) m.hidden = true; },
    async submit(){ return doSignIn("hubEmail", "hubPass", msg, () => HUB.closeModal()); },
    async gateSubmit(){ return doSignIn("gateEmail", "gatePass", gateMsg, () => showGate(false)); },
    async signOut(){
      // Instant sign-out: blank the screen immediately (no intermediate frame),
      // clear storage, fire the server-side revocation without waiting on it,
      // and reload straight to the gate.
      try { document.documentElement.style.visibility = "hidden"; } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      try { Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); }); } catch (e) {}
      try { sb.auth.signOut().catch(() => {}); } catch (e) {}
      location.reload();
    },
    async msSignIn(){
      // Entra ID (Azure) SSO via Supabase. On a company machine Edge is already
      // signed into Microsoft at the OS level, so this round-trip is silent.
      const say = (t) => { const g = document.getElementById("gateMsg"); const m = document.getElementById("hubMsg");
        const el = (g && !document.getElementById("authGate")?.hidden) ? g : (m || g); if (el) { el.textContent = t; el.className = "hub-msg err"; } };
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: "azure",
          options: { scopes: "email openid profile", redirectTo: location.origin + location.pathname }
        });
        if (error) say("Microsoft sign-in isn't set up yet — use your email and password.");
      } catch (e) { say("Microsoft sign-in failed — use your email and password."); }
    },
    toggleSave(k, el){
      if (!user) { HUB.openModal(); return false; }
      const on = saves.has(k);
      if (on) { saves.delete(k); sb.from("saves").delete().eq("post_key", k).then(()=>{}); }
      else { saves.add(k); sb.from("saves").insert({ user_id: user.id, post_key: k }).then(()=>{}); }
      decorate();
      if (typeof feedFilter !== "undefined" && feedFilter === "Saved") renderFeed();
      return false;
    },
    async toggleShare(k){
      if (!user) { HUB.openModal(); return false; }
      if (myShares.has(k)) {
        myShares.delete(k);
        shares = shares.filter(s => !(s.user_id === user.id && s.post_key === k));
        decorate(); renderTeam();
        await sb.from("shares").delete().eq("post_key", k).eq("user_id", user.id);
      } else {
        const { title, url } = postMeta(k);
        const row = { user_id: user.id, author_name: displayName(user), post_key: k, post_title: title, post_url: url, created_at: new Date().toISOString() };
        myShares.add(k);
        shares.unshift(row);
        decorate(); renderTeam();
        const { error } = await sb.from("shares").insert({ user_id: row.user_id, author_name: row.author_name, post_key: k, post_title: title, post_url: url });
        if (error) { // revert optimistic UI so failures are visible, not silent
          console.error("share failed:", error.message);
          myShares.delete(k);
          shares = shares.filter(s => !(s.user_id === user.id && s.post_key === k));
          decorate(); renderTeam();
        }
      }
      return false;
    },
    openSend(k){
      if (!user) { HUB.openModal(); return false; }
      const others = profiles.filter(m => m.id !== user.id);
      let old = document.getElementById("sendModal"); if (old) old.remove();
      const div = document.createElement("div");
      div.id = "sendModal"; div.className = "hub-modal";
      div.innerHTML = `
        <div class="hub-modal-card">
          <h3>Send this post to a teammate</h3>
          <p class="hub-modal-sub">${esc(postMeta(k).title)}</p>
          ${others.length ? `
          <select id="sendWho">${others.map(m => `<option value="${m.id}">${esc(m.display_name)}</option>`).join("")}</select>
          <input id="sendNote" type="text" maxlength="500" placeholder="Add a note (optional)">
          <div id="sendMsg" class="hub-msg"></div>
          <div class="hub-modal-actions">
            <button class="auth-btn" onclick="HUB.sendTo('${k}')">Send</button>
            <a href="#" class="auth-link" onclick="document.getElementById('sendModal').remove();return false;">Cancel</a>
          </div>` : `<div class="comment-hint">No other team members have joined yet.</div>
          <div class="hub-modal-actions"><a href="#" class="auth-link" onclick="document.getElementById('sendModal').remove();return false;">Close</a></div>`}
        </div>`;
      div.addEventListener("click", e => { if (e.target === div) div.remove(); });
      document.body.appendChild(div);
      return false;
    },
    async sendTo(k){
      const who = document.getElementById("sendWho");
      const note = (document.getElementById("sendNote") || {}).value || "";
      if (!who || !user) return;
      const to = profiles.find(m => m.id === who.value);
      const { title, url } = postMeta(k);
      const { error } = await sb.from("direct_shares").insert({
        from_user: user.id, from_name: displayName(user),
        to_user: who.value, post_key: k, post_title: title, post_url: url,
        note: note.trim() || null
      });
      const m = document.getElementById("sendMsg");
      if (error) { if (m) { m.textContent = "Could not send — try again."; m.className = "hub-msg err"; } return; }
      const sm = document.getElementById("sendModal");
      if (sm) sm.querySelector(".hub-modal-card").innerHTML = `<h3>Sent</h3><p class="hub-modal-sub">${esc(to ? to.display_name : "They")} will see it in "Shared with you" next time they're on the hub.</p><div class="hub-modal-actions"><a href="#" class="auth-link" onclick="document.getElementById('sendModal').remove();return false;">Close</a></div>`;
    },
    async markRead(id){
      await sb.from("direct_shares").update({ read: true }).eq("id", id);
      const it = inbox.find(s => s.id === id); if (it) it.read = true;
      renderInbox();
    },
    async dismissShare(id){
      inbox = inbox.filter(s => s.id !== id); renderInbox();
      await sb.from("direct_shares").delete().eq("id", id);
    },
    toggleComments(k){
      const panel = document.getElementById("cp-" + k);
      if (!panel) return false;
      if (panel.hidden) { panel.hidden = false; renderComments(k); } else panel.hidden = true;
      return false;
    },
    async postComment(k){
      const input = document.getElementById("ci-" + k);
      const body = input && input.value.trim();
      if (!body || !user) return;
      input.value = "";
      const { error } = await sb.from("comments").insert({ user_id: user.id, author_email: user.email, author_name: displayName(user), post_key: k, body });
      if (!error) { counts[k] = (counts[k] || 0) + 1; decorate(); }
      renderComments(k);
    },
    async deleteComment(id, k){
      await sb.from("comments").delete().eq("id", id);
      counts[k] = Math.max(0, (counts[k] || 1) - 1);
      decorate(); renderComments(k);
    }
  };

  /* ---------- init ---------- */
  // OAuth return handler: after Microsoft sign-in, tokens arrive in the URL
  // fragment. Apply them explicitly — relying on the library's automatic
  // detection proved unreliable (backend logged successful logins while the
  // page kept showing the gate).
  (async function handleOAuthReturn(){
    try {
      if (!location.hash || location.hash.indexOf("access_token=") === -1) return;
      const h = new URLSearchParams(location.hash.slice(1));
      const at = h.get("access_token"), rt = h.get("refresh_token");
      if (!at || !rt) return;
      history.replaceState(null, "", location.pathname + location.search);
      const { data, error } = await sb.auth.setSession({ access_token: at, refresh_token: rt });
      if (error || !data || !data.session) { console.warn("OAuth session apply failed:", error); return; }
      persistSession(data.session);
      user = data.session.user;
      const g = document.getElementById("authGate"); if (g) g.remove();
      document.body.style.overflow = "";
      try { renderAuthBox(); } catch (e) {}
      setTimeout(refreshData, 0);
    } catch (e) { console.warn("OAuth return handling failed:", e); }
  })();
  sb.auth.onAuthStateChange((_evt, session) => {
    user = session ? session.user : null;
    renderAuthBox();
    showGate(!user);
    // Defer: making Supabase calls inside onAuthStateChange deadlocks the auth lock
    setTimeout(refreshData, 0);
    if (user) { const m = document.getElementById("hubModal"); if (m) m.hidden = true; }
  });
  sb.auth.getSession().then(({ data }) => {
    user = data.session ? data.session.user : null;
    renderAuthBox();
    showGate(!user);
    refreshData();
  });
  renderAuthBox();
  window.HUB.gateSubmit = HUB.gateSubmit; // ensure exposed
})();
