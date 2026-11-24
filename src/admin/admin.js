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
  // Runs fn(user) once login state is known and on every change
  function onAuth(fn){
    const go = () => fn(ID().currentUser());
    if(!ID()){ fn(null); return; }
    ID().on("init", go); ID().on("login", u => { ID().close(); go(); }); ID().on("logout", go);
  }
  window.EM = { ymd, addDays, today, longDate, shortDate, packOpen, packEarly, activeOn, isAdmin, api, post, fixtures, onAuth };
})();
