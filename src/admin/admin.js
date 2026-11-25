/* Event manager area - shared helpers (login, data, dates). */
(function(){
  const ID = () => window.netlifyIdentity;
  const pad = n => String(n).padStart(2,"0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (s,n) => { const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return ymd(d); };
  const today = () => ymd(window.__TEST_TODAY ? new Date(window.__TEST_TODAY+"T12:00:00") : new Date());
  const longDate = s => new Date(s+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const shortDate = s => new Date(s+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  // Paperwork can be downloaded at any time. "Early" = more than a day before the night: the event manager
  // is reminded that suspensions or changes added after printing won't be on it.
  const packOpen = () => true;
  const packEarly = (night, t=today()) => t < addDays(night,-1);
  // A suspension prints if it covers the night (start and end dates included)
  const activeOn = (s, night) => s.start <= night && night <= s.end;

  function isAdmin(u){ return !!u && ((u.app_metadata && u.app_metadata.roles) || []).includes("admin"); }
  async function post(fn, body, method="POST", query=""){
    const u = ID() && ID().currentUser(); if(!u) throw new Error("Please log in.");
    const token = await u.jwt();
    const r = await fetch(`/.netlify/functions/${fn}${query}`, { method, cache:"no-store",
      headers: { "Authorization":"Bearer "+token, ...(body?{"Content-Type":"application/json"}:{}) },
      body: body?JSON.stringify(body):undefined });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  const api = (method, body, query="") => post("suspensions", body, method, query);
  async function fixtures(lg){
    const fx = await S6.loadFixtures(lg);
    if(!fx) return null;
    fx.forEach(f => { f.pitchNo = (String(f.pitch||"").match(/\d+/)||[""])[0]; });
    return fx;
  }
  /* Save what Full-Time shows into the site's own fixture list, so nothing is lost when results drop off
     Full-Time's snippets (they only show the last two weeks of results and the next league night).
     Runs in the signed-in event manager's browser: Full-Time's snippets only load in a browser.
     - a result is saved only where the fixture has no score yet (an uploaded score always wins)
     - a game Full-Time lists that isn't in the fixture list is added
     - a missing pitch number is filled in
     Returns counts; read:0 means Full-Time didn't load, and nothing is changed. */
  async function syncFullTime(lg){
    const r = await fetch(`/.netlify/functions/league-data?l=${encodeURIComponent(lg.id)}`, { cache:"no-store" });
    if(!r.ok) throw new Error("Could not load the saved fixtures.");
    const stored = ((await r.json()).fixtures || []).map(f => ({ ...f }));
    const jobs = (lg.divisions||[]).flatMap(d => [d.results, d.fixtures].filter(Boolean).map(code => S6.readSnippet(code).then(rows => ({ d, rows }))));
    const reads = await Promise.race([Promise.all(jobs), new Promise(res => setTimeout(() => res(null), 15000))]);
    if(!reads) return { read:0 };
    const T = S6.tidy, known = new Map();
    stored.forEach(f => { known.set(T(f.home), f.home); known.set(T(f.away), f.away); });
    let read = 0, scores = 0, added = 0, pitches = 0;
    for(const { d, rows } of reads) for(const e of S6.parseSnippet(rows)){
      if(!e.ymd) continue; read++;
      const f = stored.find(f => f.ymd === e.ymd && T(f.home) === e.home && T(f.away) === e.away);
      if(f){
        if(e.hs != null && f.hs == null){ f.hs = e.hs; f.as = e.as; f.ft = true; scores++; }
        if(e.pitch && !/\d/.test(f.pitch||"")){ f.pitch = e.pitch; pitches++; }
        if(!f.time && e.time) f.time = e.time;
      } else {
        stored.push({ ymd:e.ymd, time:e.time, division:d.name, home:known.get(e.home)||e.homeName, away:known.get(e.away)||e.awayName, pitch:e.pitch, hs:e.hs, as:e.as, ft:true });
        known.set(e.home, known.get(e.home)||e.homeName); known.set(e.away, known.get(e.away)||e.awayName); added++;
      }
    }
    if(scores || added || pitches) await post("league-data", { league:lg.id, fixtures:stored, sync:true });
    return { read, scores, added, pitches };
  }
  // Runs fn(user) once login state is known and on every change
  function onAuth(fn){
    const go = () => fn(ID().currentUser());
    if(!ID()){ fn(null); return; }
    ID().on("init", go); ID().on("login", u => { ID().close(); go(); }); ID().on("logout", go);
  }
  window.EM = { ymd, addDays, today, longDate, shortDate, packOpen, packEarly, activeOn, isAdmin, api, post, fixtures, syncFullTime, onAuth };
})();
