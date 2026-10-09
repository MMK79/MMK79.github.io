// RAG Production Stack: click-through pipeline diagrams (plain RAG, GraphRAG, Intelligent Educator v2).
// Source of truth: vault Presentations/RAG Production Stack - 2026-10-08/src/stack.js (the thesis site's
// templates/production-stack.js is a copy). Data: window.STACK (standalone build) or /data/production-stack.json (site).
// UI strings: the site's i18n (ps.* keys in i18n/en.json + fa.json). Diagram text (arch.json) is English; on Persian D.ps_fa (i18n/fa/production-stack.json) replaces it field by field.
// Vertical page only: the SVG has a viewBox and width 100%, and its grid has fewer columns on narrow screens.
(async () => {
const I = window.I18N;
const T = (k, v) => { let s = I && I.has && I.has(k) ? I.t(k) : k;
  return v ? s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m)) : s; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
// data text: English stays left to right; Persian text (from D.ps_fa) takes the page direction, Latin runs in it are isolated
const en = s => I && I.fa && /[\u0600-\u06FF]/.test(s) ? `<span>${I.iso(esc(s))}</span>` : `<span lang="en" dir="ltr">${esc(s)}</span>`;
// site root; on an exported copy (/thesis/...) the build rewrites "/thesis/index.html", so links follow
const ROOT = "/thesis/index.html".replace("index.html", "");
const RTL = document.documentElement.dir === "rtl", AR_B = RTL ? "→" : "←", AR_F = RTL ? "←" : "→";
const RM = matchMedia("(prefers-reduced-motion: reduce)");

let DATA = window.STACK;
if (!DATA) DATA = await fetch("/thesis/data/production-stack.json").then(r => r.ok ? r.json() : null).catch(() => null);
const root = document.getElementById("ps-root");
if (!DATA) { root.innerHTML = `<p class="note-box">${esc(T("ps.nodata"))}</p>`; return; }
const NAMES = DATA.names || {algorithms: {}, metrics: {}};
const BAND = {offline: "var(--k12)", online: "var(--ai)", across: "var(--he)", later: "var(--both)"};

// ---------- static frame ----------
// The 2026-10-09 lede and footer have new keys (ps.lede2, ps.foot2) so the older Persian of ps.lede / ps.foot is not shown
// against changed English; until fa.json has them, both languages show the English below.
{ const l = document.querySelector("#top .lede"), f = document.querySelector(".site-foot p");
  if (l) l.textContent = T("ps.lede2"); if (f) f.textContent = T("ps.foot2"); }
// Until the diagram UI keys are in fa.json, those sections are English throughout: mark them so on the Persian page
const LTR_EN = I && I.has && I.has("ps.mode_rag") ? "" : ' lang="en" dir="ltr"';
const ARCH = DATA.arch || {components: {}, diagrams: [], checks: []}, COMP = ARCH.components, LOGO = DATA.logos || {};
// Persian: replace the user-facing arch text (names, descriptions, trade-offs, titles, ledes, lane and method text, corrections) with
// D.ps_fa; ids, tools, sources, logos and the layout stay as in arch.json. A missing entry stays English.
{ const F = I && I.fa && typeof D !== "undefined" ? D.ps_fa : null;
  if (F) {
    for (const [id, f] of Object.entries(F.components || {})) if (COMP[id]) Object.assign(COMP[id], f);
    for (const dg of ARCH.diagrams || []) { const f = (F.diagrams || {})[dg.id]; if (!f) continue;
      if (f.title) dg.title = f.title; if (f.lede) dg.lede = f.lede;
      (dg.lanes || []).forEach(l => { if (f.lanes && f.lanes[l.id]) l.title = f.lanes[l.id]; });
      (dg.methods || []).forEach(m => { const fm = f.methods && f.methods[m.id]; if (fm) Object.assign(m, fm); }); }
    (ARCH.checks || []).forEach((c, k) => { const f = (F.checks || [])[k]; if (f) Object.assign(c, f); }); } }
const story = ["problem", "why", "fix"].map(k => `<div><b>${esc(T(`ps.st_${k}_h`))}</b>${I && I.has && I.has(`ps.st_${k}`) ? esc(T(`ps.st_${k}`)) : en(DATA.intro[k])}</div>`).join("");
root.innerHTML = `
<div class="ps-story">${story}</div>
${T("ps.data_en") ? `<p class="muted ps-small">${esc(T("ps.data_en"))}</p>` : ""}
${ARCH.diagrams.map(dg => `<section id="s-${dg.id}" data-hx-section${LTR_EN}>
  <h2>${en(dg.title)}</h2>
  <p class="muted">${en(dg.lede)}</p>
  <div class="ps-arch" id="dg-${dg.id}"></div>
</section>`).join("")}
<section id="s-checks" data-hx-section${LTR_EN}>
  <h2>${esc(T("ps.s_checks"))}</h2>
  <p class="muted">${esc(T("ps.checks_lede"))}</p>
  <div id="checks"></div>
</section>
<section id="s-tracks" data-hx-section>
  <h2>${esc(T("ps.s_walk"))}</h2>
  <p class="muted">${esc(T("ps.tracks_lede"))}</p>
  <div class="ps-flow" id="flow-main"></div>
</section>
<section id="s-ie2" data-hx-section>
  <h2>${esc(T("ps.s_ie2"))}</h2>
  <p class="muted">${en(DATA.tracks.ie2.lede)}</p>
  <div class="ps-flow" id="flow-ie2"></div>
</section>
<section id="s-evidence" data-hx-section>
  <h2>${esc(T("ps.s_evidence"))}</h2>
  <p class="muted">${esc(T("ps.evidence_lede"))}</p>
  <div id="ev"></div>
  <h3 class="ps-h3">${esc(T("ps.s_logos"))}</h3>
  <p class="muted ps-small">${T("ps.logos_html")}</p>
</section>
<section id="s-how" data-hx-section>
  <h2>${esc(T("ps.s_how"))}</h2>
  <div class="ps-how">${T("ps.how2_html")}</div>
</section>`;

// Explainer chips: link only to cards that exist at build time (site.py writes DATA.existing_cards = {algorithms: [ids], metrics: [ids]});
// the others are plain "coming soon" labels. Standalone build (no existing_cards) shows labels only.
const EXIST = {algorithms: new Set((DATA.existing_cards || {}).algorithms || []), metrics: new Set((DATA.existing_cards || {}).metrics || [])};
const chips = (ids, kind) => (ids || []).filter(id => NAMES[kind][id]).map(id => EXIST[kind].has(id)
  ? `<a class="ps-chip" href="${ROOT}${kind}.html#${id}" title="${esc(T("ps.link_t"))}">${en(NAMES[kind][id])}</a>`
  : `<span class="ps-chip ps-soon" role="note" aria-label="${esc(NAMES[kind][id])}, ${esc(T("ps.soon"))}">${en(NAMES[kind][id])} <small>${esc(T("ps.soon"))}</small></span>`).join("");
const srcLine = keys => (keys || []).map(k => DATA.sources[k]).filter(Boolean).map(x => x.url
  ? `<a href="${esc(x.url)}" rel="noopener">${en(x.label)}</a> <span class="faint">(${en(x.date)})</span>`
  : `${en(x.label)} <code lang="en">${esc(x.path)}</code>`).join("; ");

// ---------- architecture diagrams (data: DATA.arch) ----------
// Lanes of boxes; the grid has 5 / 4 / 3 / 2 columns by container width, so the SVG is never wider than the page.
// Mode (plain RAG / GraphRAG) is shared by every diagram with a toggle. Box colour = component kind.
const KIND = {user: "var(--muted)", app: "var(--k12)", process: "var(--ai)", llm: "var(--both)", store: "var(--he)", cache: "var(--cache)", guard: "var(--warn)", monitor: "var(--mon)"};
const logoSvg = (id, size) => { const L = LOGO[id]; if (!L) return "";
  return `<svg class="ps-logo" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="${L.d}" fill="${L.mono ? "currentColor" : L.hex}"/></svg>`; };
const wrap = (s, n) => { const out = []; let line = "";
  for (const w of String(s).split(/\s+/)) { if ((line + " " + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); }
  if (line) out.push(line); return out; };
let MODE = "rag";
const diagrams = [];
function Arch(el, dg) {
  const st = {sel: null, method: null};
  const seg = dg.toggle ? `<div class="seg ps-seg" role="group" aria-label="${esc(T("ps.mode_aria"))}">${["rag", "graph"].map(m =>
    `<button type="button" data-m="${m}" aria-pressed="false">${esc(T("ps.mode_" + m))}</button>`).join("")}</div><p class="muted ps-lede ps-mnote"></p>` : "";
  const meth = dg.methods ? `<div class="seg ps-seg ps-meth" role="group" aria-label="${esc(T("ps.method_aria"))}">
    <button type="button" data-k="" aria-pressed="true">${esc(T("ps.method_none"))}</button>${dg.methods.map(m =>
    `<button type="button" data-k="${m.id}" aria-pressed="false">${en(m.name)} <small class="faint">${en(m.by)}</small></button>`).join("")}</div>
    <p class="ps-mtext muted ps-lede" aria-live="polite"></p>` : "";
  el.innerHTML = `${seg}${meth}
    <figure class="ps-fig ps-afig"><svg role="group" focusable="false"></svg><div class="ps-tip" role="tooltip" hidden></div>
      <figcaption class="ps-legend"></figcaption></figure>
    <div class="ps-delta"></div>
    <div class="ps-panel" aria-live="polite"><p class="faint ps-small">${esc(T("ps.pick"))}</p></div>`;
  const svg = el.querySelector("svg"), fig = el.querySelector("figure"), tip = el.querySelector(".ps-tip"), panel = el.querySelector(".ps-panel");
  let cols = 0, geo = {}, W = 0;
  const mode = () => dg.toggle ? MODE : "graph";
  const visible = id => { const c = COMP[id]; return !c.only || c.only === mode(); };
  function layout(force) {
    const w = el.clientWidth || 360, c = w >= 1100 ? 6 : w >= 900 ? 5 : w >= 720 ? 4 : w >= 520 ? 3 : 2;
    if (c !== cols || force) { cols = c; draw(); }
  }
  function draw() {
    const CW = 196, NW = 176, NH = 96, PAD = 30, TT = 30, RG = 30, LG = 18;
    W = cols * CW + 2 * PAD; geo = {}; let y = 8; let lanes = "", titles = "";
    for (const lane of dg.lanes) {
      const ids = lane.nodes.filter(visible); if (!ids.length) continue;
      const rows = Math.ceil(ids.length / cols), h = TT + rows * NH + (rows - 1) * RG + 16;
      ids.forEach((id, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, ids.length - r * cols), c = i % cols;
        const off = (cols - inRow) * CW / 2;
        geo[id] = {x: PAD + off + c * CW + (CW - NW) / 2, y: y + TT + r * (NH + RG), w: NW, h: NH}; });
      lanes += `<g class="ps-lane"><rect x="6" y="${y}" width="${W - 12}" height="${h}" rx="14"/></g>`;
      titles += `<g class="ps-lt"><rect x="14" y="${y + 6}" width="${lane.title.length * 7.6 + 14}" height="20" rx="6"/><text x="21" y="${y + 20}">${esc(lane.title.toUpperCase())}</text></g>`;
      y += h + LG;
    }
    const H = y - LG + 8;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const nVis = Object.keys(geo).length;
    svg.setAttribute("aria-label", T("ps.diag_aria", {title: dg.title, n: nVis}));
    // edges; isEnd(id, 1) = rightmost box of its row, isEnd(id, 0) = leftmost
    let edges = "";
    const rowsOf = {}; for (const [id, g] of Object.entries(geo)) (rowsOf[g.y] = rowsOf[g.y] || []).push(id);
    Object.values(rowsOf).forEach(r => r.sort((p, q) => geo[p].x - geo[q].x));
    const used = [0, 0];
    const isEnd = (id, right) => { const r = rowsOf[geo[id].y]; return right ? r[r.length - 1] === id : r[0] === id; };
    const minL = Math.min(...Object.values(geo).map(g => g.x)), maxR = Math.max(...Object.values(geo).map(g => g.x + g.w));
    dg.edges.forEach((e, k) => { const [a, b, kind] = e; if (!geo[a] || !geo[b]) return;
      const A = geo[a], B = geo[b], acx = A.x + A.w / 2, bcx = B.x + B.w / 2; let d;
      if (Math.abs(A.y - B.y) < 1) {
        const right = bcx > acx, adj = Math.abs(bcx - acx) <= CW + 1, yy = A.y + A.h / 2;
        if (kind && !right) d = `M${acx},${A.y + A.h} C${acx},${A.y + A.h + 26} ${bcx},${B.y + B.h + 26} ${bcx},${B.y + B.h + 4}`;
        else if (adj) d = right ? `M${A.x + A.w},${yy} L${B.x - 4},${yy}` : `M${A.x},${yy} L${B.x + B.w + 4},${yy}`;
        else d = `M${acx},${A.y} C${acx},${A.y - 26} ${bcx},${B.y - 26} ${bcx},${B.y - 4}`;
      } else if (B.y > A.y) { const k2 = Math.min(70, (B.y - A.y - A.h) / 2 + 20);
        d = `M${acx},${A.y + A.h} C${acx},${A.y + A.h + k2} ${bcx},${B.y - k2} ${bcx},${B.y - 4}`;
      } else { // upward (a loop or a read from a lower store): orthogonal route through the side margin, so it never cuts a box
        const side = isEnd(b, 1) && !isEnd(b, 0) ? 1 : isEnd(b, 0) && !isEnd(b, 1) ? 0 : ((acx + bcx) / 2 >= W / 2 ? 1 : 0);
        const o = Math.min(2, used[side]++) * 9, sx = side ? maxR + 14 + o : minL - 14 - o, acy = A.y + A.h / 2, bcy = B.y + B.h / 2;
        d = isEnd(a, side) ? `M${side ? A.x + A.w : A.x},${acy + o} L${sx},${acy + o}` : `M${acx + o},${A.y + A.h} L${acx + o},${A.y + A.h + 12 + o} L${sx},${A.y + A.h + 12 + o}`;
        d += isEnd(b, side) ? ` L${sx},${bcy - o} L${side ? B.x + B.w + 4 : B.x - 4},${bcy - o}` : ` L${sx},${B.y - 12 - o} L${bcx - o},${B.y - 12 - o} L${bcx - o},${B.y - 4}`; }
      const dash = kind ? " ps-e-dash" : "";
      edges += `<path class="ps-e${dash}" data-a="${a}" data-b="${b}" data-k="${kind || ""}" d="${d}" marker-end="url(#ps-am-${dg.id})"/>`; });
    // nodes
    const nodes = Object.entries(geo).map(([id, g]) => { const c = COMP[id], col = KIND[c.kind] || "var(--muted)", gmode = mode() === "graph";
      const nm = gmode && c.gname ? c.gname : c.name, sb = gmode && c.gsub ? c.gsub : c.sub;
      const t = wrap(nm, 19).slice(0, 2), lg = c.tools.filter(x => x.logo && LOGO[x.logo]).map(x => x.logo).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
      const ty = t.length > 1 ? 30 : 38, sub = sb ? `<text x="${g.x + g.w / 2}" y="${g.y + ty + 18 * t.length}" text-anchor="middle" class="ps-sub">${esc(sb.length > 26 ? sb.slice(0, 25) + "…" : sb)}</text>` : "";
      const logos = lg.map((l, i) => `<g transform="translate(${g.x + g.w / 2 - (lg.length * 24 - 6) / 2 + i * 24},${g.y + g.h - 26})" class="ps-nlogo">${logoSvg(l, 18)}</g>`).join("");
      const gm = mode() === "graph" && dg.toggle ? (c.only === "graph" ? "new" : c.graph ? "changes" : "") : "";
      const tag = gm ? `<g class="ps-gtag ps-gtag-${gm}"><rect x="${g.x + g.w - 64}" y="${g.y - 9}" width="60" height="18" rx="9"/><text x="${g.x + g.w - 34}" y="${g.y + 4}" text-anchor="middle">${esc(T("ps." + gm))}</text></g>` : "";
      return `<g class="ps-nd ps-an${gm ? " ps-g-" + gm : ""}" data-id="${id}" role="button" tabindex="-1" aria-label="${esc(nm)}${gm ? " (" + esc(T("ps." + gm)) + ")" : ""}">
        <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12" class="ps-box" style="--c:${col}"${c.when === "across" ? ' stroke-dasharray="6 4"' : ""}/>
        <rect x="${g.x}" y="${g.y + 10}" width="4" height="${g.h - 20}" rx="2" fill="${col}"/>
        ${t.map((line, i) => `<text x="${g.x + g.w / 2}" y="${g.y + ty + 18 * i}" text-anchor="middle" class="ps-t ps-at">${esc(line)}</text>`).join("")}${sub}${logos}${tag}</g>`; }).join("");
    svg.innerHTML = `<defs><marker id="ps-am-${dg.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
      <g>${lanes}</g><g class="ps-edges">${edges}</g><g class="ps-elabels"></g><g>${titles}</g><g>${nodes}</g>`;
    // edge labels for the special arrows, at the middle of the path
    const lab = svg.querySelector(".ps-elabels");
    svg.querySelectorAll(".ps-e[data-k]").forEach(p => { const k = p.dataset.k; if (!k || k === "read") return;
      try { const L = p.getTotalLength(); if (L < 70) return; const pt = p.getPointAtLength(L / 2), s = T("ps.e_" + k), w = s.length * 6.4 + 10;
        lab.insertAdjacentHTML("beforeend", `<g class="ps-el" data-a="${p.dataset.a}" data-b="${p.dataset.b}"><rect x="${pt.x - w / 2}" y="${pt.y - 9}" width="${w}" height="18" rx="9"/><text x="${pt.x}" y="${pt.y + 4}" text-anchor="middle">${esc(s)}</text></g>`); } catch (e) {} });
    const kinds = [...new Set(Object.keys(geo).map(id => COMP[id].kind))];
    el.querySelector(".ps-legend").innerHTML = kinds.map(k => `<span><i style="background:${KIND[k]}"></i>${esc(T("ps.kind_" + k))}</span>`).join("");
    // what GraphRAG adds or changes (toggle diagrams, GraphRAG mode)
    const dl = el.querySelector(".ps-delta");
    if (dg.toggle && MODE === "graph") {
      const ch = Object.keys(geo).filter(id => COMP[id].only === "graph" || COMP[id].graph);
      dl.innerHTML = ch.length ? `<b>${esc(T("ps.delta_h"))}</b><span>${ch.map(id => `<button type="button" class="ps-chip ps-dchip ${COMP[id].only ? "is-new" : "is-ch"}" data-id="${id}">${en(COMP[id].name)} <small>${esc(T(COMP[id].only ? "ps.new" : "ps.changes"))}</small></button>`).join("")}</span>` : "";
    } else dl.innerHTML = "";
    if (st.sel && !geo[st.sel]) st.sel = null;
    mark();
  }
  function mark() {
    const path = st.method ? dg.methods.find(m => m.id === st.method).path : null;
    const onPath = new Set(path || []), pairs = new Set(path ? path.slice(1).map((b, i) => path[i] + ">" + b) : []);
    const first = st.sel || (path && path.find(id => geo[id])) || Object.keys(geo)[0];
    svg.querySelectorAll(".ps-nd").forEach(g => { const id = g.dataset.id, on = id === st.sel;
      g.classList.toggle("on", on); g.classList.toggle("path", onPath.has(id)); g.classList.toggle("dim", !!path && !onPath.has(id) && !on);
      g.setAttribute("aria-pressed", on); g.setAttribute("tabindex", id === first ? "0" : "-1"); });
    svg.querySelectorAll(".ps-e").forEach(p => { const a = p.dataset.a, b = p.dataset.b;
      const act = path ? pairs.has(a + ">" + b) : (st.sel && (a === st.sel || b === st.sel));
      p.classList.toggle("act", !!act); p.classList.toggle("dim", !!path && !act); });
    svg.querySelectorAll(".ps-el").forEach(l => l.classList.toggle("dim", !!path));
    el.querySelectorAll(".ps-seg [data-m]").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === MODE));
    const mn = el.querySelector(".ps-mnote"); if (mn) mn.textContent = T("ps.mode_note_" + MODE);
    el.querySelectorAll(".ps-meth button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === (st.method || "")));
    const mt = el.querySelector(".ps-mtext");
    if (mt) { const m = st.method && dg.methods.find(x => x.id === st.method);
      mt.innerHTML = m ? `<b>${en(m.name)}</b> · ${en(m.by)}: ${en(m.text)} <span class="faint ps-small">${srcLine(m.sources)}</span>` : esc(T("ps.method_hint")); }
  }
  function card(id) {
    const c = COMP[id], gm = mode() === "graph";
    const tools = c.tools.map(t => `<span class="ps-tool${t.logo && LOGO[t.logo] ? "" : " ps-badge"}">${t.logo && LOGO[t.logo] ? logoSvg(t.logo, 18) : ""}<span>${en(t.name)}${t.note ? ` <small class="faint">${en(t.note)}</small>` : ""}</span></span>`).join("");
    const a = chips(c.algorithms, "algorithms"), m = chips(c.metrics, "metrics");
    return `<article class="ps-card" id="card-${dg.id}-${id}">
      <div class="ps-tags"><span class="tag" style="--c:${KIND[c.kind]}">${esc(T("ps.kind_" + c.kind))}</span>
        <span class="tag" style="--c:${BAND[c.when]}">${esc(T("ps.band_" + c.when))}</span>
        <span class="tag ev ev-${c.ev}">${esc(T("ps.ev_" + c.ev))}</span>
        ${c.only === "graph" ? `<span class="tag" style="--c:var(--both)">${esc(T("ps.mode_graph"))}</span>` : ""}</div>
      <h3>${en(gm && c.gname ? c.gname + " (" + c.name + ")" : c.name)}</h3>
      <div class="ps-pwf">
        <div class="d"><b>${esc(T("ps.what"))}</b><p>${en(c.what)}</p></div>
        <div class="p"><b>${esc(T("ps.trade"))}</b><ul>${c.tradeoffs.map(x => `<li>${en(x)}</li>`).join("")}</ul></div>
        ${c.graph ? `<div class="g${gm ? " hot" : ""}"><b>${esc(T("ps.ingraph"))}</b><p>${en(c.graph)}</p></div>` : ""}
      </div>
      ${tools ? `<div class="ps-links"><div><b>${esc(T("ps.tools"))}</b><span class="ps-tools">${tools}</span><p class="faint ps-small">${esc(T("ps.tools_note"))}</p></div></div>` : ""}
      <div class="ps-links">
        ${a ? `<div><b>${esc(T("ps.alg"))}</b><span>${a}</span></div>` : ""}
        ${m ? `<div><b>${esc(T("ps.met"))}</b><span>${m}</span></div>` : ""}
      </div>
      <p class="ps-src"><b>${esc(T("ps.sources"))}:</b> ${srcLine(c.sources)}${c.ours ? `<br><b>${esc(T("ps.ours"))}:</b> ${en(c.ours)}` : ""}</p>
    </article>`;
  }
  function select(id, focus, hash = true) {
    if (!geo[id]) return; st.sel = id; mark(); panel.innerHTML = card(id);
    if (hash) try { history.replaceState(null, "", `#${dg.id}-${id}`); } catch (e) {}
    if (focus) { const g = svg.querySelector(`.ps-nd[data-id="${id}"]`); g && g.focus({preventScroll: true}); }
  }
  // tooltip on hover / keyboard focus: name + first sentence; kept inside the figure
  function showTip(g) { const c = COMP[g.dataset.id]; if (!c) return;
    tip.innerHTML = `<b>${en(c.name)}</b> ${en(c.what.split(/(?<=\.)\s/)[0])}`; tip.hidden = false;
    const fr = fig.getBoundingClientRect(), r = g.getBoundingClientRect(), tw = Math.min(300, fr.width - 16);
    tip.style.width = tw + "px";
    const left = Math.max(8, Math.min(fr.width - tw - 8, r.left - fr.left + r.width / 2 - tw / 2));
    let top = r.bottom - fr.top + 6; if (top + tip.offsetHeight > fr.height) top = r.top - fr.top - tip.offsetHeight - 6;
    tip.style.left = left + "px"; tip.style.top = Math.max(4, top) + "px"; }
  const hideTip = () => { tip.hidden = true; };
  svg.addEventListener("pointerover", e => { const g = e.target.closest(".ps-nd"); if (g && e.pointerType !== "touch") showTip(g); });
  svg.addEventListener("pointerout", e => { const g = e.target.closest(".ps-nd"); if (g && !g.contains(e.relatedTarget)) hideTip(); });
  svg.addEventListener("focusin", e => { const g = e.target.closest(".ps-nd"); if (g) showTip(g); });
  svg.addEventListener("focusout", hideTip);
  svg.addEventListener("click", e => { const g = e.target.closest(".ps-nd"); if (g) { hideTip(); select(g.dataset.id, true); } });
  svg.addEventListener("keydown", e => { const g = e.target.closest(".ps-nd"); if (!g) return;
    const ids = [...svg.querySelectorAll(".ps-nd")].map(x => x.dataset.id), i = ids.indexOf(g.dataset.id), k = e.key;
    const move = j => { const n = svg.querySelector(`.ps-nd[data-id="${ids[j]}"]`); svg.querySelectorAll(".ps-nd").forEach(x => x.setAttribute("tabindex", "-1"));
      n.setAttribute("tabindex", "0"); n.focus({preventScroll: false}); };
    if (k === "Enter" || k === " ") { e.preventDefault(); select(g.dataset.id, true); }
    else if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); move(Math.min(ids.length - 1, i + 1)); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); move(Math.max(0, i - 1)); }
    else if (k === "Home") { e.preventDefault(); move(0); }
    else if (k === "End") { e.preventDefault(); move(ids.length - 1); }
    else if (k === "Escape") hideTip(); });
  el.querySelectorAll(".ps-seg [data-m]").forEach(b => b.onclick = () => { if (b.dataset.m !== MODE) setMode(b.dataset.m); });
  el.querySelectorAll(".ps-meth button").forEach(b => b.onclick = () => { st.method = b.dataset.k || null; mark();
    const m = st.method && dg.methods.find(x => x.id === st.method); if (m) { const id = m.path.find(x => geo[x]); if (id) { st.sel = id; mark(); panel.innerHTML = card(id); } } });
  el.querySelector(".ps-delta").addEventListener("click", e => { const b = e.target.closest(".ps-dchip"); if (b) select(b.dataset.id, true); });
  new ResizeObserver(() => layout()).observe(el);
  layout();
  return {dg, select, redraw() { draw(); if (st.sel && geo[st.sel]) panel.innerHTML = card(st.sel); }, has: id => !!geo[id]};
}
function setMode(m) { MODE = m; for (const d of diagrams) if (d.dg.toggle) d.redraw(); }
for (const dg of ARCH.diagrams) diagrams.push(Arch(document.getElementById("dg-" + dg.id), dg));

// corrections (what the first version got wrong)
document.getElementById("checks").innerHTML = `<ol class="ps-checks">${(ARCH.checks || []).map(c => `<li><div><b>${esc(T("ps.was"))}</b> ${en(c.was)}</div>
  <div><b>${esc(T("ps.now"))}</b> ${en(c.now)}</div><p class="ps-src">${srcLine(c.sources)}</p></li>`).join("")}</ol>`;

// ---------- one flow: toggle (optional) + diagram + step panel ----------
const flows = [];
function Flow(el, keys) {
  const st = {track: keys[0], i: 0, all: false};
  const tr = () => DATA.tracks[st.track];
  el.innerHTML = `
    ${keys.length > 1 ? `<div class="seg ps-seg" role="group" aria-label="${esc(T("ps.track_aria"))}">${keys.map(k =>
      `<button type="button" data-k="${k}" aria-pressed="false">${esc(T("ps.track_" + k))}</button>`).join("")}</div>
      <p class="muted ps-lede"></p>` : ""}
    <figure class="ps-fig"><svg role="group" focusable="false"></svg>
      <figcaption class="ps-legend"></figcaption></figure>
    <div class="ps-nav">
      <button type="button" class="btn" data-a="prev">${AR_B} ${esc(T("ps.prev"))}</button>
      <span class="ps-pos live-count" aria-live="polite"></span>
      <button type="button" class="btn" data-a="next">${esc(T("ps.next"))} ${AR_F}</button>
      <button type="button" class="btn ps-all" data-a="all" aria-pressed="false"></button>
    </div>
    <div class="ps-panel" data-reveal></div>`;
  const svg = el.querySelector("svg"), panel = el.querySelector(".ps-panel"), pos = el.querySelector(".ps-pos");
  const allBtn = el.querySelector(".ps-all");
  let cols = 0, geo = [];

  function layout() {
    const w = el.clientWidth || 360;
    const c = w >= 1000 ? 5 : w >= 760 ? 4 : w >= 520 ? 3 : 2;
    if (c !== cols) { cols = c; draw(); }
  }
  function draw() {
    const S = tr().steps, CW = 200, NW = 172, rowsH = [];
    const rows = Math.ceil(S.length / cols);
    for (let r = 0; r < rows; r++) rowsH.push(S.slice(r * cols, r * cols + cols).some(s => s.branches) ? (S.slice(r * cols, r * cols + cols).some(s => (s.branches || []).length > 2) ? 120 : 108) : 84);
    const GAP = 46; let y = 14; const ys = rowsH.map(h => { const v = y; y += h + GAP; return v; });
    const H = y - GAP + 14, W = cols * CW;
    geo = S.map((s, i) => { const r = Math.floor(i / cols), c0 = i % cols, c = r % 2 ? cols - 1 - c0 : c0;
      return {x: c * CW + (CW - NW) / 2, y: ys[r], w: NW, h: rowsH[r], r}; });
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", T("ps.diagram_aria", {track: T("ps.track_" + st.track), n: S.length}));
    let edges = "";
    for (let i = 1; i < S.length; i++) {
      const a = geo[i - 1], b = geo[i]; let d;
      if (a.r === b.r) { const fw = b.x > a.x; const x1 = fw ? a.x + a.w : a.x, x2 = fw ? b.x - 3 : b.x + b.w + 3, yy = a.y + a.h / 2;
        d = `M${x1},${yy} L${x2},${yy}`; }
      else { const xx = a.x + a.w / 2; d = `M${xx},${a.y + a.h} L${xx},${b.y - 3}`; }
      const dash = S[i].band === "across" || S[i - 1].band === "across" ? ' stroke-dasharray="5 5"' : "";
      edges += `<path class="ps-edge" data-e="${i}" d="${d}"${dash} marker-end="url(#ps-ar-${el.id})"/>`;
    }
    const nodes = S.map((s, i) => { const g = geo[i], col = BAND[s.band] || "var(--muted)";
      const name = esc(s.short);
      // two branches side by side; three or more stacked (short labels would not fit side by side in a narrow box)
      const nb = s.branches ? s.branches.length : 0, side = nb <= 2;
      const br = nb ? s.branches.map((b, j) => { const bw = side ? (g.w - 20 - (nb - 1) * 6) / nb : g.w - 20;
        const bh = side ? 34 : (g.h - 58) / nb - 3, bx = g.x + 10 + (side ? j * (bw + 6) : 0), by = g.y + (side ? 58 : 52 + j * (bh + 3));
        return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" class="ps-br"/><text x="${bx + bw / 2}" y="${by + bh / 2 + 4}" text-anchor="middle" class="ps-brt">${esc(b)}</text>`; }).join("") :
        `<text x="${g.x + g.w / 2}" y="${g.y + 62}" text-anchor="middle" class="ps-sub">${esc(s.sub)}</text>`;
      const badge = s.status ? `<text x="${g.x + g.w - 8}" y="${g.y + 15}" text-anchor="end" class="ps-stt ps-st-${s.status.replace(/\s/g, "")}">${esc(T("ps.st_" + s.status.replace(/\s/g, "")))}</text>` : "";
      return `<g class="ps-nd" data-i="${i}" role="button" tabindex="-1" aria-label="${esc(T("ps.node_aria", {n: i + 1, name: s.short}))}">
        <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12" class="ps-box" style="--c:${col}"${s.band === "across" ? ' stroke-dasharray="6 4"' : ""}/>
        <text x="${g.x + 12}" y="${g.y + 16}" class="ps-n">${i + 1}</text>${badge}
        <text x="${g.x + g.w / 2}" y="${g.y + 40}" text-anchor="middle" class="ps-t">${name}</text>${br}</g>`; }).join("");
    svg.innerHTML = `<defs><marker id="ps-ar-${el.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
      <g>${edges}</g><g>${nodes}</g><circle class="ps-dot" r="6" cx="-20" cy="-20"/>`;
    const bands = [...new Set(S.map(s => s.band))];
    el.querySelector(".ps-legend").innerHTML = bands.map(b => `<span><i style="background:${BAND[b]}"></i>${esc(T("ps.band_" + b))}</span>`).join("");
    mark(false);
  }
  function mark(anim, from) {
    svg.querySelectorAll(".ps-nd").forEach(g => { const i = +g.dataset.i, on = i === st.i;
      g.classList.toggle("on", on); g.classList.toggle("seen", i < st.i);
      g.setAttribute("aria-pressed", on); g.setAttribute("tabindex", on ? "0" : "-1"); });
    svg.querySelectorAll(".ps-edge").forEach(p => p.classList.toggle("seen", +p.dataset.e <= st.i));
    const dot = svg.querySelector(".ps-dot");
    if (anim && from != null && Math.abs(from - st.i) === 1 && !RM.matches) {
      const p = svg.querySelector(`.ps-edge[data-e="${Math.max(from, st.i)}"]`);
      if (p) { const L = p.getTotalLength(), back = st.i < from, t0 = performance.now();
        const step = now => { const k = Math.min(1, (now - t0) / 420), pt = p.getPointAtLength((back ? 1 - k : k) * L);
          dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); dot.style.opacity = k < 1 ? 1 : 0;
          if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step); }
    } else dot.style.opacity = 0;
  }
  function card(s, i, n) {
    const ev = s.evidence || {status: "ours", sources: []};
    const src = srcLine(ev.sources);
    const a = chips(s.algorithms || [], "algorithms"), m = chips(s.metrics || [], "metrics");
    return `<article class="ps-card" id="${el.id}-${s.id}">
      <div class="ps-tags"><span class="num">${esc(T("ps.step_of", {n: i + 1, total: n}))}</span>
        <span class="tag" style="--c:${BAND[s.band]}">${esc(T("ps.band_" + s.band))}</span>
        <span class="tag ev ev-${ev.status}">${esc(T("ps.ev_" + ev.status))}</span>
        ${s.status ? `<span class="tag st st-${s.status.replace(/\s/g, "")}">${esc(T("ps.st_" + s.status.replace(/\s/g, "")))}</span>` : ""}</div>
      <h3>${en(s.title)}</h3>
      <div class="ps-pwf">
        <div class="p"><b>${esc(T("ps.problem"))}</b><p>${en(s.problem)}</p></div>
        <div class="d"><b>${esc(T("ps.does"))}</b><p>${en(s.body)}</p></div>
        <div class="f"><b>${esc(T("ps.fixes"))}</b><p>${en(s.fixes)}</p></div>
      </div>
      <div class="ps-io"><div><b>${esc(T("ps.in"))}</b>${en(s.in)}</div><span class="ps-io-ar" aria-hidden="true">→</span><div><b>${esc(T("ps.out"))}</b>${en(s.out)}</div></div>
      <div class="ps-links">
        ${a ? `<div><b>${esc(T("ps.alg"))}</b><span>${a}</span></div>` : ""}
        ${m ? `<div><b>${esc(T("ps.met"))}</b><span>${m}</span></div>` : ""}
        ${!a && !m ? `<p class="faint">${esc(T("ps.nolinks"))}</p>` : ""}
      </div>
      <p class="ps-src">${src ? `<b>${esc(T("ps.sources"))}:</b> ${src}` : ""}${ev.ours ? `${src ? "<br>" : ""}<b>${esc(T("ps.ours"))}:</b> ${en(ev.ours)}` : ""}</p>
    </article>`;
  }
  function show(anim, from) {
    const S = tr().steps; st.i = Math.max(0, Math.min(S.length - 1, st.i));
    panel.innerHTML = st.all ? S.map((s, i) => card(s, i, S.length)).join("") : card(S[st.i], st.i, S.length);
    pos.textContent = T("ps.step_of", {n: st.i + 1, total: S.length});
    el.querySelector('[data-a="prev"]').disabled = st.i === 0;
    el.querySelector('[data-a="next"]').disabled = st.i === S.length - 1;
    allBtn.textContent = T(st.all ? "ps.all_off" : "ps.all_on"); allBtn.setAttribute("aria-pressed", st.all);
    el.querySelectorAll(".ps-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === st.track));
    const lede = el.querySelector(".ps-lede"); if (lede) lede.innerHTML = en(tr().lede);
    mark(anim, from);
    if (anim) try { history.replaceState(null, "", `#${st.track}-${S[st.i].id}`); } catch (e) {}
  }
  function go(i, focus) { const from = st.i; st.i = i; show(true, from);
    if (focus) { const g = svg.querySelector(`.ps-nd[data-i="${st.i}"]`); g && g.focus({preventScroll: true}); } }
  svg.addEventListener("click", e => { const g = e.target.closest(".ps-nd"); if (g) go(+g.dataset.i, true); });
  svg.addEventListener("keydown", e => { const g = e.target.closest(".ps-nd"); if (!g) return;
    const n = tr().steps.length, k = e.key;
    if (k === "Enter" || k === " ") { e.preventDefault(); go(+g.dataset.i, true); }
    else if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); go(Math.min(n - 1, st.i + 1), true); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); go(Math.max(0, st.i - 1), true); }
    else if (k === "Home") { e.preventDefault(); go(0, true); }
    else if (k === "End") { e.preventDefault(); go(n - 1, true); } });
  el.querySelector('[data-a="prev"]').onclick = () => go(st.i - 1);
  el.querySelector('[data-a="next"]').onclick = () => go(st.i + 1);
  allBtn.onclick = () => { st.all = !st.all; show(false); };
  el.querySelectorAll(".ps-seg button").forEach(b => b.onclick = () => {
    if (b.dataset.k === st.track) return;
    const id = tr().steps[st.i].id; st.track = b.dataset.k;
    const j = tr().steps.findIndex(s => s.id === id); st.i = j < 0 ? 0 : j; cols = 0; layout(); show(true); });
  new ResizeObserver(layout).observe(el);
  layout(); show(false);
  return {keys, st, set(track, id) { st.track = track; const j = tr().steps.findIndex(s => s.id === id); st.i = j < 0 ? 0 : j; cols = 0; layout(); show(false); }};
}
flows.push(Flow(document.getElementById("flow-main"), ["rag", "graphrag"]));
flows.push(Flow(document.getElementById("flow-ie2"), ["ie2"]));

// deep link #<track>-<step>
const h = decodeURIComponent(location.hash.slice(1));
for (const f of flows) for (const k of f.keys) if (h.startsWith(k + "-")) {
  f.set(k, h.slice(k.length + 1)); const t = document.getElementById(f === flows[0] ? "s-tracks" : "s-ie2"); t && t.scrollIntoView(); }

// deep link #<diagram>-<component>
for (const d of diagrams) if (h.startsWith(d.dg.id + "-") && d.has(h.slice(d.dg.id.length + 1))) {
  d.select(h.slice(d.dg.id.length + 1), false, false); const t = document.getElementById("s-" + d.dg.id); t && t.scrollIntoView(); }

// ---------- evidence ----------
const used = {}, cnt = {};
for (const c of Object.values(COMP)) for (const sid of c.sources || []) used[sid] = (used[sid] || 0) + 1;
for (const [k, tk] of Object.entries(DATA.tracks)) { cnt[k] = {evidenced: 0, partly: 0, ours: 0};
  for (const s of tk.steps) { const ev = s.evidence || {status: "ours", sources: []}; cnt[k][ev.status]++;
    for (const sid of ev.sources || []) used[sid] = (used[sid] || 0) + 1; } }
document.getElementById("ev").innerHTML = `
  <ul class="ps-cnt">${Object.entries(cnt).map(([k, c]) => `<li><b>${esc(T("ps.track_" + k))}</b>: ${esc(T("ps.counts", {e: c.evidenced, p: c.partly, o: c.ours}))}</li>`).join("")}</ul>
  <div class="ps-srcs">${Object.entries(DATA.sources).map(([k, s]) => `<div class="ps-srcc"><h4>${en(s.label)}</h4>
    <p>${s.url ? `<a href="${esc(s.url)}" rel="noopener"><code lang="en">${esc(s.url.replace(/^https?:\/\//, ""))}</code></a> · ${esc(T("ps.accessed"))} ${en(s.date)}` : `<code lang="en">${esc(s.path)}</code>`} · <span class="faint">${esc(T("ps.src_cited", {n: used[k] || 0}))}</span></p><p class="muted">${en(s.shows)}</p></div>`).join("")}</div>`;
})();
