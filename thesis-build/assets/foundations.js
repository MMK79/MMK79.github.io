// Foundations: hub (/foundations.html) and one page per family (/foundations/<family>.html, <main data-fam>). Data from site.py (Brief M):
//   /data/foundations/index.json   {families:[{id,label,n,status,topics:[{id,title,status,prerequisites}]}]}
//   /data/foundations/<family>.json {topics:[normalised records]}     /data/foundations/backlinks.json   existing explainer id -> topic ids
// Cards open on click or #<topic id>; the body is built only then (lazy). Origin block and LaTeX->Unicode come from explain-shared.js (same code as the
// metric and algorithm pages). Topic text is English (lang=en dir=ltr on Persian pages), UI strings are fd.* keys.
(async () => {
const I = window.I18N || {fa: false, digits: s => s, esc: s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]))};
const T = (k, v) => (window.t ? window.t(k, v) : k), esc = I.esc, N = x => (I.fa ? I.digits(String(x)) : String(x));
const main = document.getElementById("fd-main"), fam = (typeof D !== "undefined" && D.fam) || "";
const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
let FA = {}, IDX, PROV = {}, ALG = {}, MET = {}, DEM = {demos: {}, by_topic: {}};
try { IDX = await get("/thesis/data/foundations/index.json"); } catch (e) { main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`; return; }
DEM = await get("/thesis/data/foundations/demos.json").catch(() => DEM);
if (I.fa) FA = await get("/thesis/data/foundations/fa.json").catch(() => ({}));   // Persian topic text (Brief 2c); a topic without it falls back to English per field
PROV = (await get("/thesis/data/provenance.json").catch(() => ({items: {}}))).items || {};
const ids = async k => Object.fromEntries(((await get(`/thesis/data/explainers/${k}.json`).catch(() => ({units: []}))).units || []).map(u => [u.id, u.name]));
[ALG, MET] = await Promise.all([ids("algorithms"), ids("metrics")]);
const ST = ["evidenced", "textbook-only", "inferred", "unverified"];
const TOP = {}; IDX.families.forEach(f => f.topics.forEach(t => { TOP[t.id] = {...t, fam: f.id}; }));
const ttl = (t, tag = "span", extra = "") => t.title_fa && I.fa ? `<${tag}${extra}>${esc(t.title_fa)}</${tag}>` : `<${tag} lang="en" dir="ltr"${extra}>${esc(t.title)}</${tag}>`;
const en = (tag, html, cls = "") => `<${tag} lang="en" dir="ltr"${cls ? ` class="${cls}"` : ""}>${html}</${tag}>`;
const badge = s => `<span class="ex-tag ex-pv pv-${esc(s)}">${esc(T("so.status_" + s))}</span>`;
const stat = f => ST.filter(s => f.status[s]).map(s => `${badge(s)} ${N(f.status[s])}`).join(" ");
const FNAME = f => T(f.label);
const badge2 = r => { const k = String(r).split(":")[0].trim() || "toy"; return `<span class="ex-tag">${esc(T(k === "done" ? "fd.real_done" : k === "partial" ? "fd.real_partial" : "fd.real_pending"))}</span>`; };
const load = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.append(s); });
async function runDemo(host) {
  const id = host.dataset.demo; host.innerHTML = `<p class="muted">${esc(T("ex.demo_loading"))}</p>`;
  try {
    if (!window.DemoKit) await load("/thesis/assets/explainers/_demo-kit/demo-kit.js");
    await load(`/thesis/assets/explainers/foundations/demos/${id}.js`);
    const api = (window.DEMOS || {})[id]; if (!api || !api.mount) throw new Error("no demo registered for " + id);
    host.textContent = ""; api.mount(host);
  } catch (e) { host.innerHTML = `<p class="ex-novid">${esc(T("ex.demo_err", {m: e.message}))}</p>`; }
}

if (!fam) {   // ---------------- hub ----------------
  const ORDER = IDX.families;
  main.innerHTML = `<ol class="fd-flow">${ORDER.map(f => {
    const fid = new Set(f.topics.map(t => t.id)), start = f.topics.filter(t => !t.prerequisites.some(p => fid.has(p))).slice(0, 3);
    return `<li class="fd-fam"><h2><a href="/foundations/${f.id}.html">${esc(FNAME(f))}</a></h2><p>${esc(T(f.label + "_d"))}</p>
      <p class="fd-meta">${esc(T("fd.n_topics", {n: N(f.n)}))} · ${stat(f)}</p>
      <p class="fd-start"><b>${esc(T("fd.start"))}:</b> ${start.map(t => ttl(t, "a", ` href="/foundations/${f.id}.html#${esc(t.id)}"`)).join(" · ")}</p>
      ${f.id === "ont" ? `<p><a href="/thesis/assets/stories/ontology/build/index.html">${esc(T("fd.ont_page"))}</a></p>` : ""}</li>`; }).join("")}</ol>
    <p class="ex-note">${esc(T("fd.how"))}</p>`;
  return;
}

// ---------------- family page ----------------
const F = IDX.families.find(f => f.id === fam), data = await get(`/thesis/data/foundations/${fam}.json`).catch(() => null);
if (!F || !data) { main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`; return; }
document.getElementById("fd-h1").textContent = FNAME(F); document.getElementById("fd-lede").textContent = T(F.label + "_d");
document.title = FNAME(F) + " · " + document.title;
const topics = data.topics, VID = (IDX.videos || {})[fam];
if (VID) document.getElementById("fd-lede").insertAdjacentHTML("afterend", `<figure class="tlvideo fd-video"><video controls preload="none" playsinline poster="/thesis/videos/${esc(VID.poster)}" width="${VID.width}" height="${VID.height}" aria-label="${esc(T("fd.video_aria"))}"><source src="/thesis/videos/${esc(VID.file)}" type="video/mp4"></video><figcaption>${esc(T("fd.video_cap"))}</figcaption></figure>`);
const kv = (o, d = 0) => {   // a worked example or an inputs/outputs block of any shape, as nested lists
  if (o == null || o === "") return "";
  if (typeof o !== "object") return esc(typeof o === "number" ? +o.toFixed(6) : o);
  if (Array.isArray(o)) return `<ul>${o.map(x => `<li>${kv(x, d + 1)}</li>`).join("")}</ul>`;
  return `<dl class="fd-kv">${Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${kv(v, d + 1)}</dd>`).join("")}</dl>`;
};
const symRows = s => !s ? [] : Array.isArray(s) ? s.map(x => typeof x === "object" ? [x.symbol ?? x.name ?? "", x.meaning ?? x.text ?? ""] : ["", String(x)]) : typeof s === "object" ? Object.entries(s) : [["", String(s)]];
const link = id => TOP[id] ? ttl(TOP[id], "a", ` href="/foundations/${TOP[id].fam}.html#${esc(id)}"`) : ALG[id] ? `<a href="/thesis/algorithms.html#${esc(id)}">${esc(ALG[id])}</a>` : MET[id] ? `<a href="/thesis/metrics.html#${esc(id)}">${esc(MET[id])}</a>` : esc(id);
function body(t0) {
  const f0 = I.fa && FA[t0.id], t = f0 ? {...t0, ...f0, io: Object.fromEntries(Object.entries(f0.io || {}).map(([k, v]) => [({input: "ورودی", inputs: "ورودی", output: "خروجی", outputs: "خروجی"})[k] || k, v]))} : t0;
  const loc = (tag, html) => f0 ? `<${tag}>${html}</${tag}>` : en(tag, html);   // Persian blocks are not lang=en
  const fx = (t0.formulas || []).map((f, fi) => { const sy = symRows(f.symbols).map(([k, v], j) => [k, f0 && f0.symbols && f0.symbols[fi] && f0.symbols[fi][j] || v]); return `<div class="ex-fx" lang="en">${esc(window.EXS.tex(f.latex))}</div>
    <details class="ex-tex"><summary>${esc(T("ex.latex"))}</summary><code>${esc(f.latex)}</code></details>
    ${sy.length ? `<dl class="ex-sym" lang="en" dir="ltr">${sy.map(([k, v]) => `<dt>${esc(k)}</dt><dd lang="${f0 && f0.symbols ? "fa" : "en"}" dir="${f0 && f0.symbols ? "rtl" : "ltr"}">${esc(v)}</dd>`).join("")}</dl>` : ""}
    ${f.verified ? `<p class="ex-src" lang="en" dir="ltr">${esc(f.verified)}</p>` : ""}`; }).join("");
  const blk = (h, inner) => inner ? `<div class="ex-blk"><h4>${esc(T(h))}</h4>${inner}</div>` : "";
  const rel = (t.prerequisites || []).length ? `<ul class="fd-pre">${t.prerequisites.map(p => `<li>${link(p)}</li>`).join("")}</ul>` : "";
  const links = (t.links || []).filter(l => ALG[l] || MET[l] || TOP[l]);
  const o = PROV["topic:" + t.id] ? window.EXS.originBlock(PROV["topic:" + t.id], T, N, esc) : "";
  return blk("fd.h_what", loc("p", esc(t.what_it_is || ""))) + blk("fd.h_why", loc("p", esc(t.why || ""))) + blk("fd.h_io", loc("div", kv(t.io))) +
    blk("ex.h_formula", fx) + blk("fd.h_steps", loc("ol", (t.steps || []).map(s => `<li>${esc(String(s).replace(/^\d+\.\s*/, ""))}</li>`).join(""))) +
    blk("fd.h_trade", loc("div", Array.isArray(t.trade_offs) ? `<ul>${t.trade_offs.map(x => `<li>${esc(typeof x === "object" ? JSON.stringify(x) : x)}</li>`).join("")}</ul>` : `<p>${esc(t.trade_offs || "")}</p>`)) +
    blk("fd.h_example", en("div", kv(t.worked_example))) + blk("fd.h_demo", (DEM.by_topic[t.id] || []).map(d => `<div class="fd-demo"><p class="ex-src"><b lang="en" dir="ltr">${esc(DEM.demos[d].title)}</b> · ${badge2(DEM.demos[d].real)}</p><div class="ex-demo" data-demo="${esc(d)}" lang="en" dir="ltr"><button type="button" class="btn fd-run">${esc(T("fd.run_demo"))}</button></div></div>`).join("")) + blk("fd.h_prereq", rel) + blk("fd.h_links", links.length ? `<ul class="fd-pre">${links.map(l => `<li>${link(l)}</li>`).join("")}</ul>` : "") + o;
}
main.innerHTML = `<div class="ex-cards" id="fd-cards">${topics.map(t => { const s = (t.provenance || {}).status || "unverified";
  return `<article class="ex-card" id="${esc(t.id)}" data-s="${esc(s)}" data-p="${esc(t.problem || "")}" data-t="${esc((t.title + " " + (TOP[t.id].title_fa || "") + " " + (t.what_it_is || "") + " " + (t.why || "") + " " + ((FA[t.id] || {}).what_it_is || "")).toLowerCase())}"><details><summary>
    ${ttl(TOP[t.id] || t, "h3")}<span class="ex-meta">${badge(s)}${(t.prerequisites || []).length ? ` · ${esc(T("fd.n_pre", {n: N(t.prerequisites.length)}))}` : ""}</span></summary><div class="ex-body"></div></details></article>`; }).join("")}</div>
  <p class="ex-none" id="fd-none" hidden>${esc(T("fd.none"))}</p>`;
const cards = [...main.querySelectorAll(".ex-card")], byId = Object.fromEntries(topics.map(t => [t.id, t]));
function open(c) { const b = c.querySelector(".ex-body"); if (!b.dataset.done) { b.innerHTML = body(byId[c.id]); b.dataset.done = 1; b.querySelectorAll(".fd-run").forEach(x => x.addEventListener("click", () => runDemo(x.closest(".ex-demo")))); } }
cards.forEach(c => c.querySelector("details").addEventListener("toggle", e => { if (e.target.open) open(c); }));
const fp = document.getElementById("fd-pr"), probs = [...new Set(topics.map(t => t.problem).filter(Boolean))];
fp.innerHTML = `<option value="">${esc(T("fd.all"))}</option>` + probs.map(p => `<option value="${esc(p)}">${esc(T("fd." + p))}</option>`).join("");
const fs = document.getElementById("fd-st"); fs.innerHTML = `<option value="">${esc(T("fd.all"))}</option>` + ST.map(s => `<option value="${s}">${esc(T("so.status_" + s))}</option>`).join("");
function apply() {
  const q = document.getElementById("fd-q").value.trim().toLowerCase(), s = fs.value, pr = fp.value, hi = document.getElementById("fd-inf").checked; let n = 0;
  cards.forEach(c => { const ok = (!q || c.dataset.t.includes(q)) && (!s || c.dataset.s === s) && (!pr || c.dataset.p === pr) && !(hi && c.dataset.s === "inferred"); c.hidden = !ok; n += ok; });
  document.getElementById("fd-cnt").textContent = T("fd.count", {n: N(n), total: N(cards.length)}); document.getElementById("fd-none").hidden = n > 0;
}
["fd-q", "fd-st", "fd-pr", "fd-inf"].forEach(id => document.getElementById(id).addEventListener(id === "fd-q" ? "input" : "change", apply)); apply();
function hash() { const c = cards.find(x => "#" + x.id === location.hash); if (c) { c.hidden = false; c.querySelector("details").open = true; open(c); c.scrollIntoView({block: "start"}); } }
hash(); addEventListener("hashchange", hash);
})();
