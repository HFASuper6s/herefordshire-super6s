/* "Ask a question" helper panel - free, no AI, runs entirely in the browser.
   Any link or button with data-ask opens it. Questions are matched against the county's FAQ list
   (county/faq.json, built to /data/faq.json). Only when nothing matches - or the visitor says the answer
   didn't help - does it offer "Email the league", with their questions filled in. The link's own mailto:
   href is the email address used, and still works on its own if this script fails to load. */
(function(){
  const S=window.SITE||{}, esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // ---------- Matching ----------
  const STOP=new Set("a an the and or but if of to in on at for from by with about is are was were be been am i im me my we our us you your it its this that these those do does did can could would should will shall may might have has had get got how what whats which who whom whose why there their they them please thanks thank hi hello any some much many just also than then so as up out off into over going really moment currently still already lot bit need needs want wants".split(" "));
  // Words that mean the same thing are folded together, so "fee", "price" and "cost" all match.
  const SYN={}; [
    "cost price fee fees charge money pay paying payment paid expensive cheap afford",
    "join enter entry register registration signup sign apply application",
    "time times kickoff kick start starts when hour hours",
    "where venue location address directions postcode place ground",
    "boot boots footwear shoe shoes trainer trainers stud studs blade blades astro astros mould moulds moulded",
    "player players squad people lad lads",
    "sub subs substitute substitutes substitution",
    "age old aged young minimum year years son daughter kid kids child children teen teenager",
    "absence absent miss missing unavailable holiday cancel cancelled cancelling",
    "late delayed",
    "leave leaving quit withdraw stop",
    "ref refs referee referees official officials",
    "goalkeeper keeper goalie gk",
    "card cards yellow red booking sinbin suspension suspended ban banned",
    "trophy trophies prize prizes winner winners champion champions",
    "fixture fixtures result results table tables score scores standing standings",
    "contact phone call ring email manager organiser organizer",
    "kit shirt shirts top tops bib bibs colour colours",
    "insurance insured injury injured",
    "rule rules law laws",
    "struggling stress depressed depression anxiety anxious wellbeing crisis"
  ].forEach(g=>{ const w=g.split(" "); w.forEach(x=>SYN[x]=w[0]); });
  const stem=w=>w.length>4?w.replace(/(ing|ed|es|s)$/,""):w;
  function toks(t){
    return String(t).toLowerCase().replace(/[’']/g,"").replace(/kick[\s-]?offs?/g,"kickoff").replace(/sign[\s-]?up/g,"signup").replace(/sin[\s-]?bin/g,"sinbin").replace(/how much/g,"cost")
      .split(/[^a-z0-9£]+/).filter(w=>w&&!STOP.has(w)).map(w=>SYN[w]||SYN[stem(w)]||stem(w));
  }
  let FAQ=null, IDX=[], IDF={}, MAXIDF=1;
  function index(list){
    FAQ=list; IDX=list.map(f=>{ const m=new Map(); toks(f.q).forEach(t=>m.set(t,1.5)); toks(f.k||"").forEach(t=>{ if(!m.has(t)) m.set(t,1); }); return m; });
    const N=IDX.length, df={}; IDX.forEach(m=>m.forEach((_,t)=>df[t]=(df[t]||0)+1));
    for(const t in df) IDF[t]=Math.log(1+N/df[t]); MAXIDF=Math.log(1+N);
  }
  // Returns the FAQ entries ranked by how well they match, best first: [{i, score, cover}]
  function rank(q){
    const qt=[...new Set(toks(q))]; if(!qt.length) return [];
    const total=qt.reduce((s,t)=>s+(IDF[t]??MAXIDF),0);   // words the FAQ never uses count fully against the match
    return IDX.map((m,i)=>{ let s=0,c=0; qt.forEach(t=>{ if(m.has(t)){ s+=IDF[t]*m.get(t); c+=IDF[t]; } }); return {i,score:s,cover:c/total}; })
      .filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
  }
  // A good match covers most of the question, or matches a distinctive word strongly in a longer question.
  const good=r=>r&&((r.score>=1.1&&r.cover>=0.5)||(r.score>=4.5&&r.cover>=0.3));

  // ---------- Panel ----------
  const fmt=t=>{ // plain text -> safe HTML: line breaks, "- " lists, site paths, links, emails and phone numbers
    const link=s=>s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(\/[a-z0-9-]+\.html(?:#[a-z0-9-]+)?)/gi,'$1<a href="$2">$2</a>')
      .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,'<a href="mailto:$1">$1</a>')
      .replace(/\b(0\d{3,4} ?\d{3} ?\d{3,4})\b/g,(m)=>`<a href="tel:${m.replace(/\s/g,"")}">${m}</a>`);
    let html="", list=false;
    for(const l of esc(t).split(/\n/)){ const m=l.match(/^\s*[-•]\s+(.*)/);
      if(m){ if(!list){html+="<ul>";list=true;} html+=`<li>${link(m[1])}</li>`; }
      else { if(list){html+="</ul>";list=false;} if(l.trim()) html+=`<p>${link(l)}</p>`; } }
    return html+(list?"</ul>":"");
  };
  let d, log, form, ta, mail, asked=[], mailHref="";
  const toEnd=()=>{ log.scrollTop=log.scrollHeight; requestAnimationFrame(()=>log.scrollTop=log.scrollHeight); };
  function add(cls,html){ const el=document.createElement("div"); el.className="ask-msg "+cls; el.innerHTML=html; log.appendChild(el); toEnd(); return el; }
  function chips(ids,label){ if(!ids.length) return;
    const el=add("choices",(label?`<p class="ask-sub">${esc(label)}</p>`:"")+`<div class="ask-chips">${ids.map(i=>`<button type="button" data-i="${i}">${esc(FAQ[i].q)}</button>`).join("")}</div>`);
    el.addEventListener("click",e=>{ const b=e.target.closest("button[data-i]"); if(b) answer(+b.dataset.i,b.textContent); }); }
  function offerEmail(){
    const base=mailHref||("mailto:"+(S.contactEmail||"")), sep=base.includes("?")?"&":"?";
    mail.href=base+sep+"body="+encodeURIComponent((asked.length?"My question:\n"+asked.map(q=>"- "+q).join("\n")+"\n\n":"")+"Name:\nTeam (if any):\n");
    mail.hidden=false; toEnd();
  }
  function answer(i,asText){
    mail.hidden=true;   // email is the last resort: hide it again once a question is answered
    add("me",`<p>${esc(asText)}</p>`); asked.push(asText);
    const bot=add("bot",fmt(FAQ[i].a)+`<button type="button" class="ask-no">That didn't answer my question</button>`);
    bot.querySelector(".ask-no").onclick=e=>{ e.target.remove(); add("bot","<p>Sorry about that. You can email the league and they'll get back to you.</p>"); offerEmail(); };
  }
  function ask(q){
    q=q.trim().slice(0,300); if(!q||!FAQ) return; ta.value="";
    const r=rank(q);
    if(good(r[0])){
      answer(r[0].i,q);
      const more=r.slice(1).filter(x=>x.score>=0.8&&x.score>=r[0].score*0.6).slice(0,2).map(x=>x.i);
      chips(more,"Related questions:");
    } else {
      add("me",`<p>${esc(q)}</p>`); asked.push(q);
      add("bot","<p>Sorry, I couldn't find an answer to that. Try different words, pick a question below, or email the league and they'll help.</p>");
      const near=r.filter(x=>x.score>=0.6).slice(0,3).map(x=>x.i);
      chips(near.length?near:[0,1,2,3].filter(i=>FAQ[i]),near.length?"Did you mean:":"Common questions:");
      offerEmail();
    }
  }
  function build(){
    d=document.createElement("dialog"); d.className="ask"; d.setAttribute("aria-labelledby","ask-h");
    d.innerHTML=`<div class="ask-top"><h2 id="ask-h">Ask a question</h2><button type="button" class="ask-x" aria-label="Close">&times;</button></div>
      <div class="ask-log" aria-live="polite"></div>
      <a class="btn btn-accent ask-mail" hidden>Email the league</a>
      <form class="ask-form"><label class="vh" for="ask-q">Your question</label><textarea id="ask-q" rows="2" maxlength="300" placeholder="Type your question, e.g. what boots can I wear?"></textarea><button class="btn btn-navy" type="submit">Ask</button></form>`;
    document.body.appendChild(d);
    log=d.querySelector(".ask-log"); form=d.querySelector("form"); ta=d.querySelector("textarea"); mail=d.querySelector(".ask-mail");
    d.querySelector(".ask-x").onclick=()=>d.close();
    d.addEventListener("click",e=>{ if(e.target===d) d.close(); });
    form.addEventListener("submit",e=>{ e.preventDefault(); ask(ta.value); });
    ta.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); ask(ta.value); } });
    add("bot",`<p>Hi! Ask about times, prices, rules, boots, the venue or how to join, or pick a common question.</p>`); chips([0,1,2,3,4].filter(i=>FAQ[i]));
  }
  async function loadFaq(){ if(FAQ) return true;
    try{ const res=await fetch("/data/faq.json"); if(!res.ok) return false; const list=await res.json(); if(!Array.isArray(list)||!list.length) return false; index(list); return true; }catch(e){ return false; } }
  window.S6ask={index,rank,good,toks};   // for testing
  document.addEventListener("click",async e=>{ const t=e.target.closest("[data-ask]"); if(!t||!window.HTMLDialogElement) return;
    e.preventDefault(); const h=t.getAttribute("href")||""; if(h.startsWith("mailto:")) mailHref=h;
    // No FAQ list for this county (or it won't load): the button simply opens an email, as before.
    if(!(await loadFaq())){ location.href=mailHref||("mailto:"+(S.contactEmail||"")); return; }
    if(!d) build(); d.showModal(); ta.focus(); });
})();
