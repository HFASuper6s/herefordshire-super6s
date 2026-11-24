// Builds the site for one county: templates in src/ + settings and pictures in county/ -> dist/
// Usage: node build.mjs [countyFolder]   (default: county)
import fs from "node:fs"; import path from "node:path";
const countyDir = path.resolve(process.argv[2] || process.env.COUNTY_DIR || "county");
const SRC = path.resolve("src"), OUT = path.resolve("dist");
const C = JSON.parse(fs.readFileSync(path.join(countyDir, "config.json"), "utf8"));

// --- Check the settings so a new county fails loudly, not silently ---
const need = ["siteName","shortName","countyFA","headline","intro","colors","leagues"];
const missing = need.filter(k => C[k] == null); if (missing.length) throw new Error("county/config.json is missing: " + missing.join(", "));
for (const k of ["brand","brandDark","brandLight","accent","accentDark","logoBg"]) if (!/^#[0-9a-f]{6}$/i.test(C.colors[k]||"")) throw new Error(`colors.${k} must be a hex colour like #011A6C`);
// Warn if white text on the brand or accent colour would be hard to read (WCAG AA needs 4.5)
const lum = h => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(x => x <= .03928 ? x/12.92 : ((x+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
for (const k of ["brand","accent"]) { const r = 1.05/(lum(C.colors[k])+.05); if (r < 4.5) console.warn(`Warning: white text on colors.${k} (${C.colors[k]}) has contrast ${r.toFixed(2)}, below 4.5. Pick a darker shade.`); }
C.leagues.forEach(l => { if (!/^[a-z0-9-]{1,30}$/.test(l.id)) throw new Error(`League id "${l.id}" must be lower-case letters, numbers or dashes`); });
for (const f of ["logo.png","hero.jpg"]) if (!fs.existsSync(path.join(countyDir,"assets",f))) throw new Error(`county/assets/${f} is missing`);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const has = f => fs.existsSync(path.join(countyDir, "assets", f));
const P = C.partner;
const partnerLine = P ? ` in partnership with ${P.url ? `<a href="${esc(P.url)}" target="_blank" rel="noopener">${esc(P.name)}</a>` : esc(P.name)}` : "";
// Sponsor block in the footer: logo (if supplied) linked to the sponsor's website
const sponsorBlock = P ? `<a class="sponsor" href="${esc(P.url||"#")}" target="_blank" rel="noopener"${P.url?"":" aria-disabled=\"true\""}>
  ${P.logo && fs.existsSync(path.join(countyDir,"assets",P.logo)) ? `<img src="/img/${esc(P.logo)}" alt="${esc(P.shortName||P.name)}" width="88" height="88" loading="lazy">` : ""}
  <span><small>${esc(P.label||"League partner")}</small><b>${esc(P.shortName||P.name)}</b>${P.url?`<em>Visit website</em>`:""}</span></a>` : "";
// League rules: county/rules.json rendered as two tabs (playing rules, terms of entry)
const R = fs.existsSync(path.join(countyDir,"rules.json")) ? JSON.parse(fs.readFileSync(path.join(countyDir,"rules.json"),"utf8")) : null;
function rulesHTML(part){
  if(!R) return "";
  const fmt = t => esc(t).replace(/^(Fines tariff|Yellow card|Red card|Insurance):/,"<b>$1:</b>")
    .replace("The FA – Laws and Rules",'<a href="https://www.thefa.com/football-rules-governance/lawsandrules" target="_blank" rel="noopener">The FA – Laws and Rules</a>');
  return R[part].map(n=>{ const sec=R.sections[n];
    const groups=sec.groups.map(g=>{ const items=g.items.map((t,i)=>{ const k=(g.nums&&g.nums[i])||i+1; return `<li value="${k}"><span class="rn">${n}.${k}</span> ${fmt(t)}</li>`}).join("");
      return `${g.h?`<h3>${esc(g.h)}</h3>`:""}<ol class="rl">${items}</ol>`; }).join("");
    let body=groups;
    if(sec.table){ const t=sec.table, tbl=`<div class="rtable"><table><thead><tr>${t.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      body=body.replace(/(<li value="3">[\s\S]*?<\/li>)/,`$1</ol>${tbl}<ol class="rl" start="4">`); }
    return `<section class="rsec" id="r${n}"><h2><span>${n}</span>${esc(sec.title)}</h2>${sec.intro?`<p class="rintro">${esc(sec.intro)}</p>`:""}${body}</section>`; }).join("")
    + (part==="terms"&&R.disclaimer?`<section class="rsec" id="rdisc"><h2>Disclaimer</h2><p>${esc(R.disclaimer)}</p><p class="rver">${esc(R.version)}</p></section>`:"");
}
const rulesToc = part => R ? R[part].map(n=>`<a href="#r${n}">${n}. ${esc(R.sections[n].title)}</a>`).join("")+(part==="terms"?'<a href="#rdisc">Disclaimer</a>':"") : "";

const ctx = {
  site: C,
  partnerLine, sponsorBlock,
  partnerBlurb: C.partner && C.partner.blurb ? `, with ${esc(C.partner.name.split(",")[0])} ${esc(C.partner.blurb)}` : "",
  // Main sections (same for every county): Home, Tables, Fixtures, Results, then News / Get involved / Wellbeing
  // Four sections for everyone; "Join a league" is the button in the header
  navLinks: [["/","home","Home"],["/league.html","league","League"],["/news.html","news","News"],["/get-involved.html","involved","Get involved"]]
    .map(([h,id,t])=>`<a href="${h}" data-nav="${id}">${t}</a>`).join(""),
  tabLinks: [["/","home","Home",'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
    ["/league.html","league","League",'<path d="M4 5h16M4 10h16M4 15h16M4 20h16M9 5v15"/>'],
    ["/news.html","news","News",'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>'],
    ["/get-involved.html","involved","Get involved",'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c.3-2.4 1.6-4.5 4-5"/>']]
    .map(([h,id,t,ic])=>`<a href="${h}" data-nav="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>${t}</a>`).join(""),
  rulesPlaying: rulesHTML("playing"), rulesTerms: rulesHTML("terms"), tocPlaying: rulesToc("playing"), tocTerms: rulesToc("terms"), rulesIntro: R?esc(R.intro):"",
  polaroids: ((C.heroPhotos||[]).filter(p=>has(p.src)).slice(0,3).length ? C.heroPhotos.filter(p=>has(p.src)).slice(0,3) : [{src:"hero.jpg",caption:""}])
    .map((p,i)=>`<figure class="print p${i+1}"><img src="/img/${esc(p.src)}" alt="${esc(p.caption||"Super 6s")}" ${i?'loading="lazy"':'fetchpriority="high"'}><figcaption>${esc(p.caption||"")}</figcaption></figure>`).join(""),
  bannerWord: esc(C.shortName.replace(/^super\s*/i,"").trim() || "6s"),
  heroMobile: has("hero-mobile.jpg") ? "hero-mobile" : "hero",
  heroWebp: has("hero.webp"), featureImg: has("feature.jpg") ? "feature" : "hero",
  // Homepage Champions photos (optional): champions.photos in config, files in county/assets. Each photo opens larger when tapped.
  champions: (() => { const G = C.champions, ph = (G && G.photos || []).filter(p => has(p.src)); if (!ph.length) return "";
    return `<section class="block" id="champs-sec"><div class="wrap">
      <div class="sec-head"><h2 class="sec">${esc(G.title || "Champions")}</h2></div>${G.intro ? `<p class="champs-intro">${esc(G.intro)}</p>` : ""}
      <div class="champs">${ph.map((p, i) => { const alt = p.alt || [p.caption, p.sub].filter(Boolean).join(", ") || "A Super 6s team under the floodlights";
        const cap = p.caption ? `<figcaption><b>${esc(p.caption)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ""}</figcaption>` : "";
        return `<figure class="champ${cap ? "" : " nocap"}"><button type="button" class="champ-open" data-i="${i}" aria-label="View photo ${i + 1} larger"><img src="/img/${esc(p.src)}" alt="${esc(alt)}" loading="lazy" decoding="async"></button>${cap}</figure>`; }).join("")}</div>
    </div></section>`; })(),
};
const get = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
function render(tpl, page) {
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => render(fs.readFileSync(path.join(SRC, "partials", n + ".html"), "utf8"), page));
  return tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => get({ ...ctx, page }, k) ?? "")
            .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(get({ ...ctx, page }, k) ?? ""));
}
function copyDir(a, b) { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } }

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
// Pages: each starts with <!--page {"title":..., "desc":..., "id":...}-->
const pages = [];
(function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (f === "partials") continue;
  if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html")) pages.push(p); } })(SRC);
for (const p of pages) {
  if (p.endsWith(path.sep + "wellbeing.html") && !C.wellbeing) continue;
  if (p.endsWith(path.sep + "rules.html") && !R) continue;
  if (p.endsWith(path.sep + "get-involved.html") && !(C.getInvolved||[]).length) continue; // page only exists when the county lists sessions
  let t = fs.readFileSync(p, "utf8"); const m = t.match(/^<!--page (\{.*?\})-->\n?/);
  const page = m ? JSON.parse(m[1]) : {}; if (m) t = t.slice(m[0].length);
  page.title = render(page.title || C.siteName, page); page.desc = render(page.desc || C.intro, page);
  const out = path.join(OUT, path.relative(SRC, p)); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(t, page));
}
// Static files
copyDir(path.join(SRC, "css"), path.join(OUT, "css")); copyDir(path.join(SRC, "js"), path.join(OUT, "js"));
for (const f of ["admin.js"]) fs.copyFileSync(path.join(SRC, "admin", f), path.join(OUT, "admin", f));
copyDir(path.join(countyDir, "assets"), path.join(OUT, "img"));
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
if (fs.existsSync(path.join(countyDir, "data"))) copyDir(path.join(countyDir, "data"), path.join(OUT, "data"));
// Theme colours into the stylesheet
const k = C.colors, theme = `--brand:${k.brand}; --brand-dark:${k.brandDark}; --brand-light:${k.brandLight}; --accent:${k.accent}; --accent-dark:${k.accentDark}; --logo-bg:${k.logoBg};`;
const cssP = path.join(OUT, "css", "site.css"); fs.writeFileSync(cssP, fs.readFileSync(cssP, "utf8").replace("/*THEME*/", theme));
// Settings for the browser
fs.writeFileSync(path.join(OUT, "js", "config.js"), "/* Generated from county/config.json by build.mjs - edit that file, not this one. */\nwindow.SITE = " + JSON.stringify(C, null, 1) + ";\n");
// App manifest and offline cache
fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify({ name: C.siteName, short_name: C.shortName, start_url: "/", display: "standalone",
  background_color: k.brand, theme_color: k.brand, icons: [{ src: "/img/logo.png", sizes: "any", type: "image/png", purpose: "any" }] }, null, 1));
const sw = fs.readFileSync(path.join(SRC, "sw.js"), "utf8").replace("__VERSION__", Date.now().toString(36));
fs.writeFileSync(path.join(OUT, "sw.js"), sw);
console.log(`Built ${C.siteName}: ${pages.length} pages, ${C.leagues.length} leagues -> dist/`);
