/* Shared helpers: settings, fixture/result data, league maths. */
(function(){
  const S = window.SITE;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const val = v => v ? esc(v) : '<span class="tbc">To be confirmed</span>';
  const league = id => S.leagues.find(l => l.id === id);
  const param = k => new URLSearchParams(location.search).get(k);
  const pad = n => String(n).padStart(2,"0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

  function parseCSV(text){
    const rows=[]; let row=[], f="", q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++} else q=false } else f+=c; }
      else if(c==='"') q=true;
      else if(c===','){ row.push(f); f=""; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(f); rows.push(row); row=[]; f=""; }
      else f+=c;
    }
    if(f!==""||row.length){ row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()!==""));
  }
  function toDate(s){
    if(s instanceof Date) return s;
    if(!s) return null;
    s=String(s).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(+m[1], +m[2]-1, +m[3]);
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if(m){ const y=+m[3]<100?2000+ +m[3]:+m[3]; return new Date(y, +m[2]-1, +m[3]>31?+m[1]:+m[1]); }
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  // "Swill FC (Blue/White Shirts)" -> name "Swill FC", colour "Blue/White"
  const SHIRT_RE=/\s*\(([^)]*?)\s*(?:shirts?|kit|tops?)\)\s*$/i;
  const detected={};
  function cleanName(n){ n=String(n??"").trim(); const m=n.match(SHIRT_RE); if(m){ n=n.replace(SHIRT_RE,"").trim(); detected[slug(n)]=m[1].trim(); } return n; }
  const stripShirts = t => String(t).replace(/\s*\([^)]*?(?:shirts?|kit|tops?)\)/gi,"");
  const num = v => { const n = String(v ?? "").trim(); return /^\d+$/.test(n) ? +n : null; };

  /* Turn spreadsheet rows (first row = headings) into fixtures. Works with the Full-Time
     export whatever the column order; scores are read from "Home Score"/"Away Score"
     style columns or a single "Score"/"Result" column such as "3 - 1". */
  function rowsToFixtures(rows){
    if(!rows || rows.length<2) return [];
    const h = rows[0].map(x => String(x).trim().toLowerCase());
    const col = (...keys) => h.findIndex(x => keys.some(k => x.includes(k)));
    const exact = (...keys) => h.findIndex(x => keys.includes(x));
    const iDate=col("date"), iTime=col("time","ko"), iDiv=col("division","competition"),
          iPitch=col("pitch","venue"), iHS=col("home score","home goals","home team score"),
          iAS=col("away score","away goals","away team score"), iScore=exact("score","result","scores","ft");
    let iHome=exact("home team","home"), iAway=exact("away team","away");
    if(iHome<0) iHome=h.findIndex(x=>x.includes("home")&&!/score|goal/.test(x));
    if(iAway<0) iAway=h.findIndex(x=>x.includes("away")&&!/score|goal/.test(x));
    if(iHome<0 || iAway<0) return [];
    return rows.slice(1).map(r => {
      let hs = iHS>=0 && iHS!==iHome ? num(r[iHS]) : null, as = iAS>=0 && iAS!==iAway ? num(r[iAS]) : null;
      if((hs==null||as==null) && iScore>=0){ const m=String(r[iScore]||"").match(/(\d+)\s*[-–:v]\s*(\d+)/); if(m){hs=+m[1];as=+m[2];} }
      const d = iDate>=0 ? toDate(r[iDate]) : null;
      let time = iTime>=0 ? String(r[iTime]??"").trim() : "";
      if(/^\d:\d\d/.test(time)) time="0"+time; time=time.slice(0,5);
      return { ymd: d?ymd(d):"", time, home:cleanName(r[iHome]), away:cleanName(r[iAway]),
               division: iDiv>=0 ? String(r[iDiv]??"").trim() : "", pitch: iPitch>=0 ? String(r[iPitch]??"").trim() : "", hs, as };
    }).filter(f => f.home && f.away);
  }

  // Data: the event manager's latest upload; falls back to the CSV file in /data
  const cache = {};
  async function loadFixtures(lg){
    if(cache[lg.id]) return cache[lg.id];
    let fx=null;
    try{ const r=await fetch(`/.netlify/functions/league-data?l=${encodeURIComponent(lg.id)}`);
      if(r.ok){ const j=await r.json(); if(j && Array.isArray(j.fixtures) && j.fixtures.length){ fx=j.fixtures; fx.updated=j.updated; } } }catch(e){}
    if(!fx){ try{ const r=await fetch("/"+lg.fixturesFile.replace(/^\//,""),{cache:"no-cache"});
      if(r.ok){ fx=rowsToFixtures(parseCSV(await r.text())); if(!fx.length) fx=null; } }catch(e){} }
    if(fx){ fx.forEach(f=>{ f.home=cleanName(f.home); f.away=cleanName(f.away); f.date=f.ymd?new Date(f.ymd+"T12:00:00"):null; f.dateText=f.ymd; f.venue=f.pitch; f.played=f.hs!=null&&f.as!=null; }); fx.sort((a,b)=>(a.ymd+a.time).localeCompare(b.ymd+b.time)); }
    if(fx && !S.noLiveScores && !/\/admin\//.test(location.pathname)) await addLiveScores(lg, fx);
    return cache[lg.id]=fx;
  }

  /* Live scores: read the results from each division's FA Full-Time results snippet (it runs in the
     visitor's browser) and fill in any score the uploaded file doesn't have yet. An uploaded score always
     wins. Read results are kept for 10 minutes so pages stay quick. */
  const tidy = n => cleanName(String(n||"")).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  function readSnippet(code){
    return new Promise(res=>{
      const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.tabIndex=-1;
      f.style.cssText="position:absolute;left:-9999px;top:0;width:900px;height:600px;border:0";
      f.srcdoc=`<!doctype html><html><body><div id="lrep${code}"></div><script>var lrcode='${code}'<\/script><script src="https://fulltime.thefa.com/client/api/cs1.js" onerror="window.__ftFail=1"><\/script></body></html>`;
      let n=0; const t=setInterval(()=>{ let rows=null, failed=false;
        try{ const d=f.contentDocument, tb=d&&d.querySelector(`#lrep${code} table`); failed=!!f.contentWindow.__ftFail; if(tb) rows=[...tb.querySelectorAll("tr")].map(tr=>[...tr.children].map(c=>c.textContent.replace(/\s+/g," ").trim())); }catch(e){}
        if(rows||failed||++n>30){ clearInterval(t); f.remove(); res(rows||[]); } },200);
      document.body.appendChild(f);
    });
  }
  // Pull (date, home, home score, away score, away) out of whatever columns the snippet uses
  function parseResults(rows){
    const out=[];
    rows.forEach(r=>{
      const i=r.findIndex(c=>/^\d{1,2}\s*[-–:]\s*\d{1,2}$/.test(c)); if(i<1||i>=r.length-1) return;
      const m=r[i].match(/(\d+)\s*[-–:]\s*(\d+)/);
      let h=i-1; while(h>=0&&!/[a-z]/i.test(r[h])) h--; let a=i+1; while(a<r.length&&!/[a-z]/i.test(r[a])) a++;
      if(h<0||a>=r.length) return;
      const dc=r.find(c=>/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(c)), d=dc?toDate(dc.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)[0]):null;
      out.push({ymd:d?ymd(d):"",home:tidy(r[h]),away:tidy(r[a]),hs:+m[1],as:+m[2]});
    });
    return out;
  }
  async function addLiveScores(lg, fx){
    const key="s6-live-"+lg.id; let got=null;
    try{ const c=JSON.parse(sessionStorage.getItem(key)||"null"); if(c&&Date.now()-c.at<600000) got=c.results; }catch(e){}
    if(!got){
      const codes=(lg.divisions||[]).map(d=>d.results).filter(Boolean);
      const all=await Promise.race([Promise.all(codes.map(readSnippet)), new Promise(r=>setTimeout(()=>r(null),6500))]);
      got=all?all.flatMap(parseResults):[];
      try{ if(all) sessionStorage.setItem(key,JSON.stringify({at:Date.now(),results:got})); }catch(e){}
    }
    let added=0;
    fx.forEach(f=>{ if(f.played) return;
      const H=tidy(f.home), A=tidy(f.away);
      const hit=got.find(r=>r.home===H&&r.away===A&&(!r.ymd||!f.ymd||r.ymd===f.ymd));
      if(hit){ f.hs=hit.hs; f.as=hit.as; f.played=true; f.live=true; added++; } });
    fx.liveAdded=added;
  }
  function teams(fx){
    const m = new Map();
    fx.forEach(f => [f.home,f.away].forEach(t => { if(!m.has(t)) m.set(t, f.division); }));
    return [...m.entries()].map(([name,division]) => ({name,division})).sort((a,b)=>a.name.localeCompare(b.name));
  }
  const fmtDate = d => d ? d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "";
  const fmtDay = s => new Date(s+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});

  /* League table from played games (3 points a win, 1 a draw). Ties: points, goal difference, goals for, name. */
  function table(games, upTo){
    const t = new Map(), row = n => t.get(n) || t.set(n,{team:n,p:0,w:0,d:0,l:0,f:0,a:0,pts:0,form:[]}).get(n);
    games.forEach(g => { row(g.home); row(g.away); });
    games.filter(g => g.played && (!upTo || g.ymd<=upTo)).forEach(g => {
      const H=row(g.home), A=row(g.away); H.p++;A.p++; H.f+=g.hs;H.a+=g.as;A.f+=g.as;A.a+=g.hs;
      if(g.hs>g.as){H.w++;A.l++;H.pts+=3;H.form.push("W");A.form.push("L");}
      else if(g.hs<g.as){A.w++;H.l++;A.pts+=3;H.form.push("L");A.form.push("W");}
      else{H.d++;A.d++;H.pts++;A.pts++;H.form.push("D");A.form.push("D");}
    });
    return [...t.values()].map(r=>({...r,gd:r.f-r.a})).sort((x,y)=>y.pts-x.pts||y.gd-x.gd||y.f-x.f||x.team.localeCompare(y.team)).map((r,i)=>({...r,pos:i+1}));
  }
  const divGames = (fx,div) => fx.filter(f=>f.division===div);
  const formHTML = (form,n=5) => `<span class="form">${form.slice(-n).map(r=>`<i class="f-${r}" title="${{W:"Won",D:"Drew",L:"Lost"}[r]}">${r}</i>`).join("")||'<span class="muted">–</span>'}</span>`;
  const initials = n => n.replace(/[^A-Za-z0-9 ]/g,"").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const photoURL = (l,t) => `/.netlify/functions/team-photo?l=${encodeURIComponent(l)}&t=${encodeURIComponent(slug(t))}`;

  /* Shirts */
  const COL={green:"#1E8E4E",black:"#16181D",purple:"#6B2FA0",blue:"#1F5FD1",white:"#FFFFFF",pink:"#EC5FA6",red:"#D6110E",yellow:"#F2C230",
    orange:"#F07F1A",navy:"#13235E",sky:"#6EC1F0","light blue":"#6EC1F0",grey:"#9AA0A6",gray:"#9AA0A6",claret:"#7A1630",maroon:"#7A1630",gold:"#C9A227",amber:"#F2A900",teal:"#138A8A",lime:"#8BD12F",silver:"#C0C4CC"};
  const norm=w=>{ w=String(w).toLowerCase().trim(); return COL[w]?w:Object.keys(COL).find(k=>w.includes(k))||""; };
  const keyOf=t=>slug(String(t).replace(/,/g,", "));
  function shirtOf(lgId,team){
    const map=(S.shirts&&S.shirts[lgId])||{}, k=slug(team);
    const hit=Object.keys(map).find(n=>slug(n)===k||slug(n).replace(/-/g,"")===k.replace(/-/g,""));
    const raw=hit?map[hit]:detected[k]||"";
    return raw.split(/[\/&,]| and /i).map(norm).filter(Boolean);
  }
  let sid=0;
  function shirtSVG(cols,size=24,title=""){
    const id="sh"+(++sid), a=COL[cols[0]]||"none", b=cols[1]?COL[cols[1]]:null, known=cols.length>0;
    const body="M33 8 L41 4 Q50 12 59 4 L67 8 L92 23 L82 41 L73 36 L73 94 L27 94 L27 36 L18 41 L8 23 Z";
    const light=c=>["white","yellow","pink","sky","light blue","lime","silver","gold","amber"].includes(c);
    const edge=known?(light(cols[0])?"#8A93AD":"rgba(0,0,0,.35)"):"var(--muted)";
    let fill=known?a:"var(--tint)", stripes="";
    if(b){ stripes=`<clipPath id="${id}"><path d="${body}"/></clipPath><g clip-path="url(#${id})">${[0,1,2,3,4].map(i=>`<rect x="${27+i*11.5}" y="0" width="5.75" height="100" fill="${b}"/>`).join("")}</g>`; }
    const trim=known?(light(cols[0])&&!b?"#5F6883":"#FFFFFF"):"var(--muted)";
    return `<svg class="shirt" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${title?title.replace(/"/g,"&quot;")+" shirt":"Shirt"}"><path d="${body}" fill="${fill}"/>${stripes}
      <path d="M41 4 Q50 12 59 4" fill="none" stroke="${trim}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="${body}" fill="none" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round"/>${known?"":`<text x="50" y="66" text-anchor="middle" font-size="30" font-weight="700" fill="var(--muted)">?</text>`}</svg>`;
  }
  const shirt=(lgId,team,size)=>shirtSVG(shirtOf(lgId,team),size,team);
  // Training bib, worn by the away team when the shirts clash
  function bibSVG(size=24,title="Away team in bibs"){
    const body="M34 6 L44 6 Q50 18 56 6 L66 6 L70 30 L74 94 L26 94 L30 30 Z";
    return `<svg class="shirt bib" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${title}"><path d="${body}" fill="#C8F02F"/>
      <path d="M28 62 L72 62" stroke="#9CC21A" stroke-width="6"/><path d="${body}" fill="none" stroke="#6E8A10" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  }
  // Clash: both shirts known and the main colour is the same
  function clash(lgId,h,a){ const x=shirtOf(lgId,h), y=shirtOf(lgId,a); return !!(x[0]&&y[0]&&x[0]===y[0]); }

  // News: posts from the settings file plus posts added by the event manager (newest first)
  async function loadNews(){
    let posts=(S.news||[]).map(p=>({...p,src:"site"}));
    try{ const r=await fetch("/.netlify/functions/news"); if(r.ok){ const j=await r.json(); const ids=new Set(j.posts.map(p=>p.id)); posts=posts.filter(p=>!ids.has(p.id)).concat(j.posts); } }catch(e){}
    return posts.sort((a,b)=>b.date.localeCompare(a.date));
  }
  const newsImg = p => p.hasImage ? `/.netlify/functions/news?img=${encodeURIComponent(p.id)}` : (p.image ? "/img/"+p.image : "");

  window.S6 = {S, esc, val, league, param, ymd, slug, parseCSV, toDate, rowsToFixtures, loadFixtures, teams, fmtDate, fmtDay, table, divGames, formHTML, initials, photoURL, cleanName, stripShirts, shirtOf, shirtSVG, shirt, bibSVG, clash, loadNews, newsImg};

  if("serviceWorker" in navigator){ addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{})); }
})();
