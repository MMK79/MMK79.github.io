// RAG Production Stack: click-through pipeline diagrams (plain RAG, GraphRAG, Intelligent Educator v2).
// Source of truth: vault Presentations/RAG Production Stack - 2026-10-08/src/stack.js (the thesis site's
// templates/production-stack.js is a copy). Data: window.STACK (standalone build) or /data/production-stack.json (site).
// UI strings: the site's i18n (ps.* keys) when present, else the English table below. Data text stays English.
// Vertical page only: the SVG has a viewBox and width 100%, and its grid has fewer columns on narrow screens.
(async () => {
const UI_EN = {
  "ps.h1": "RAG in production: from a question to a cited answer",
  "ps.lede": "How a RAG system and a GraphRAG system run in production, one component at a time, and how the thesis system Intelligent Educator v2 is planned to work end to end. Click a box, or use Previous / Next, to walk through the steps.",
  "ps.st_problem_h": "Problem",
  "ps.st_why_h": "Why the next idea",
  "ps.st_fix_h": "Fix",
  "ps.data_en": "",
  "ps.s_tracks": "From question to answer: plain RAG and GraphRAG",
  "ps.tracks_lede": "The same ten steps for both. Switch the track to see what the graph changes in each step; the selected step stays selected.",
  "ps.track_aria": "Pipeline",
  "ps.track_rag": "Plain RAG",
  "ps.track_graphrag": "GraphRAG",
  "ps.track_ie2": "Intelligent Educator v2",
  "ps.s_ie2": "Intelligent Educator v2, end to end",
  "ps.prev": "Previous",
  "ps.next": "Next",
  "ps.step_of": "Step {n} of {total}",
  "ps.all_on": "Show all steps",
  "ps.all_off": "Show one step",
  "ps.problem": "Problem",
  "ps.does": "What this component does",
  "ps.fixes": "What it fixes",
  "ps.in": "In",
  "ps.out": "Out",
  "ps.alg": "Algorithm explainers",
  "ps.met": "Metric explainers",
  "ps.nolinks": "No explainer page matches this step.",
  "ps.sources": "Sources",
  "ps.ours": "Ours",
  "ps.band_offline": "offline (before questions)",
  "ps.band_online": "per question",
  "ps.band_across": "across all steps",
  "ps.band_later": "later",
  "ps.ev_evidenced": "evidenced",
  "ps.ev_partly": "partly evidenced",
  "ps.ev_ours": "ours",
  "ps.st_exists": "exists today",
  "ps.st_planned": "planned",
  "ps.st_afterfreeze": "after freeze",
  "ps.diagram_aria": "{track}: {n} steps. Arrow keys move between steps.",
  "ps.node_aria": "Step {n}: {name}",
  "ps.soon": "coming soon",
  "ps.link_t": "Explainer page on the thesis site",
  "ps.s_evidence": "What is evidenced and what is ours",
  "ps.evidence_lede": "Every step names its sources. 'Evidenced' means the component is drawn or written in the cited source. 'Partly' means the component is in the source but the explanation or the arrangement is ours. 'Ours' means it is our own addition, taken from the algorithm and metric catalogues.",
  "ps.counts": "{e} evidenced, {p} partly, {o} ours",
  "ps.src_used": "used in {n} steps",
  "ps.s_how": "How to read",
  "ps.how_html": "<ul><li>Boxes are components; arrows are the order of the walk-through. Colour = when the component runs: blue offline, amber per question, teal across all steps, purple later.</li><li>Click a box, press Enter on it, or use Previous / Next. Arrow keys move between boxes when one has focus. The address bar keeps the step (for example <code>#graphrag-retrieve</code>).</li><li>Explainer links go to the algorithm and metric pages of the thesis site. A link is shown only when that id exists in the catalogues.</li><li>The Intelligent Educator track follows the architecture plan of 2026-10-02, which is a proposal: 'planned' means not built.</li></ul>",
  "ps.foot": "Built 2026-10-08 from the human's Excalidraw diagrams (RAG-Parts, RAG-Pipeline, RAG-General, RAG-in-Production-Architecture, HR-RAG-system-example, LLM-RAG-GraphRAG, GraphRAG-Formula) and the Intelligent Educator v2 architecture plan. Algorithm and metric ids are checked against the two catalogues at build time.",
  "ps.nodata": "The pipeline data file is missing, so nothing is shown."
};
const I = window.I18N;
const T = (k, v) => { let s = I && I.has && I.has(k) ? I.t(k) : (UI_EN[k] ?? k);
  return v ? s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m)) : s; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const en = s => `<span lang="en" dir="ltr">${esc(s)}</span>`;
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
const story = ["problem", "why", "fix"].map(k => `<div><b>${esc(T(`ps.st_${k}_h`))}</b>${I && I.has && I.has(`ps.st_${k}`) ? esc(T(`ps.st_${k}`)) : en(DATA.intro[k])}</div>`).join("");
root.innerHTML = `
<div class="ps-story">${story}</div>
${T("ps.data_en") ? `<p class="muted ps-small">${esc(T("ps.data_en"))}</p>` : ""}
<section id="s-tracks" data-hx-section>
  <h2>${esc(T("ps.s_tracks"))}</h2>
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
</section>
<section id="s-how" data-hx-section>
  <h2>${esc(T("ps.s_how"))}</h2>
  <div class="ps-how">${T("ps.how_html")}</div>
</section>`;

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
  // Link only to explainer cards that exist at build time (site.py writes DATA.existing_cards = {algorithms: [ids], metrics: [ids]});
  // the others are plain "coming soon" labels. Standalone build (no existing_cards) shows labels only.
  const EXIST = {algorithms: new Set((DATA.existing_cards || {}).algorithms || []), metrics: new Set((DATA.existing_cards || {}).metrics || [])};
  const chips = (ids, kind) => ids.filter(id => NAMES[kind][id]).map(id => EXIST[kind].has(id)
    ? `<a class="ps-chip" href="${ROOT}${kind}.html#${id}" title="${esc(T("ps.link_t"))}">${en(NAMES[kind][id])}</a>`
    : `<span class="ps-chip ps-soon" role="note" aria-label="${esc(NAMES[kind][id])}, ${esc(T("ps.soon"))}">${en(NAMES[kind][id])} <small>${esc(T("ps.soon"))}</small></span>`).join("");
  function card(s, i, n) {
    const ev = s.evidence || {status: "ours", sources: []};
    const src = (ev.sources || []).map(k => DATA.sources[k]).filter(Boolean).map(x => `${en(x.label)} <code lang="en">${esc(x.path)}</code>`).join("; ");
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

// ---------- evidence ----------
const used = {}, cnt = {};
for (const [k, tk] of Object.entries(DATA.tracks)) { cnt[k] = {evidenced: 0, partly: 0, ours: 0};
  for (const s of tk.steps) { const ev = s.evidence || {status: "ours", sources: []}; cnt[k][ev.status]++;
    for (const sid of ev.sources || []) used[sid] = (used[sid] || 0) + 1; } }
document.getElementById("ev").innerHTML = `
  <ul class="ps-cnt">${Object.entries(cnt).map(([k, c]) => `<li><b>${esc(T("ps.track_" + k))}</b>: ${esc(T("ps.counts", {e: c.evidenced, p: c.partly, o: c.ours}))}</li>`).join("")}</ul>
  <div class="ps-srcs">${Object.entries(DATA.sources).map(([k, s]) => `<div class="ps-srcc"><h4>${en(s.label)}</h4>
    <p><code lang="en">${esc(s.path)}</code> · <span class="faint">${esc(T("ps.src_used", {n: used[k] || 0}))}</span></p><p class="muted">${en(s.shows)}</p></div>`).join("")}</div>`;
})();
