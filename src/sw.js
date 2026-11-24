const C="super6s-__VERSION__",SHELL=["/","/index.html","/league.html","/rules.html","/team.html","/join.html","/css/site.css","/js/config.js","/js/common.js","/manifest.webmanifest","/img/logo.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return; // FA data always live
  if(u.pathname.startsWith("/admin")||u.pathname.startsWith("/.netlify/"))return; // event manager area: never cached on the device
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});
