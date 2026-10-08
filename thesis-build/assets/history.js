// History of RAG and GraphRAG: vertical page. Eras stack top to bottom (time runs downward); inside an era the events are
// grouped by lineage (track); a click opens the event details inline. Counts charts (one per era that overlaps the data, plus
// one full-range chart) are SVGs drawn at their container's pixel width, so nothing scrolls sideways.
// Data: /data/history/{timeline,people,counts,views,citations,warnings}.json (copied from the vault at build time; extra
// fields are tolerated). citations.json = per paper event: Semantic Scholar count (`s2`, arXiv and published merged),
// OpenAlex count (`openalex`, cross-check), `used` (= S2, else OpenAlex, else null shown as "—") and `split_flag`; warnings.json = the checked wording of
// the GraphRAG count warnings (the page shows i18n hist.warn.<id>, whose English must equal proposed_text_en).
// Event text stays English (lang="en").
(async () => {
const $ = id => document.getElementById(id);
const esc = I18N.esc;
const T = (k, v) => esc(t(k, v));
const en = s => s ? `<span lang="en" dir="ltr">${esc(s)}</span>` : "";
const dg = s => I18N.fa ? I18N.digits(String(s)) : String(s);
const NS = "http://www.w3.org/2000/svg";
const get = n => fetch(`/thesis/data/history/${n}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
const [TL, PE, CT, VW, CI, WN] = await Promise.all(["timeline", "people", "counts", "views", "citations", "warnings"].map(get));
if (!(D.data.history || []).length || !TL || !VW) {
  $("eras").insertAdjacentHTML("beforeend", `<p class="note-box">${T("hist.video_none")}</p>`); return;
}
$("vnone").hidden = (D.data.history_media || []).includes("RagVsGraphRag.mp4");
$("vid").hidden = !$("vnone").hidden;

// <scale> pure date-to-x helpers; templates/history.check.js evaluates this block in node, keep it free of DOM code.
// Time is continuous in years: 2020.0 = 1 Jan 2020. Year Y owns the band [x(Y), x(Y+1)). The year label "2020" sits ON
// its 1 January tick (the band's left edge), so every 2020 event line (2020-05 -> 2020 + 4.5/12 = 2020.375) falls to the
// RIGHT of the "2020" label. Annual totals are bars that span their calendar year (barSlot: one slot per shown series).
// (Before 2026-10-08 labels and yearly dots sat at mid-year, so a May line drew LEFT of the "2020" label and its dot.)
const yearOf = s => { const p = String(s).split("-"); const y = +p[0]; return p[1] ? y + (+p[1] - 0.5) / 12 : y + 0.5; };
const eraStart = s => { const p = String(s).split("-"); return p[1] ? +p[0] + (+p[1] - 1) / 12 : +p[0]; };
const xScale = (y0, y1, left, width) => yr => left + (yr - y0) / (y1 + 1 - y0) * width;
const yearAxis = (y0, y1) => { const n = y1 - y0 + 1, step = n > 12 ? 2 : 1, edges = [], labels = [];
  for (let yr = y0; yr <= y1 + 1; yr++) edges.push(yr);
  for (let yr = y0; yr <= y1; yr += step) labels.push({yr, at: yr});
  return {edges, labels}; };
// bar i of n inside year yr: [a, b) in years, with a 10% gap at each band edge
const barSlot = (yr, i, n) => { const pad = .1, w = (1 - 2 * pad) / n; return [yr + pad + i * w, yr + pad + (i + 1) * w]; };
const RULES = [["2020-05", "hist.rule_rag"], ["2024-04", "hist.rule_graph"]];
// </scale>
const COL = {ir: "#98A0B0", qa: "#D8C26A", kb: "#7C9CFF", "neural-retrieval": "#3CC7B4", rag: "#F2A93B", "kg-lm": "#C28BFF", graphrag: "#FF8A65", evaluation: "#9BD66F"};
const ERA = ["#98A0B0", "#3CC7B4", "#F2A93B", "#C28BFF", "#FF8A65"];
const tracks = Object.keys(VW.tracks);
const trName = k => I18N.has("hist.tr." + k) ? t("hist.tr." + k) : VW.tracks[k];
const el = (n, a = {}, p, txt) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
const ev = Object.fromEntries(TL.map(e => [e.id, e]));
const peopleOf = {}; (PE || []).forEach((p, i) => (p.papers || []).forEach(id => (peopleOf[id] = peopleOf[id] || []).push(i)));
const unvEvent = e => e.verified === false;
const unvText = s => /unverified/i.test(s || "");
let full = null;
let mode = "story", logS = false;
const open = new Set();
const MODES = {key: e => e.significance === 1, story: e => e.significance <= 2, all: () => true};
const eras = (VW.eras || []).map((e, i) => ({...e, a: eraStart(e.from), c: ERA[i % ERA.length], i})).sort((p, q) => p.a - q.a);

// ---------- counts (shared state for every chart) ----------
const series = CT ? Object.entries(CT.series || {}) : [];
const grpOf = k => /^graphrag/i.test(k) ? "graphrag" : /^rag/i.test(k) ? "rag" : "other";
const on = {}; series.forEach(([k]) => { on[k] = /title_abstract|arxiv/.test(k) && !/phrase/.test(k); });
const GC = {rag: "#F2A93B", graphrag: "#3CC7B4", other: "#98A0B0"}, DASH = ["", "7 3", "2 3", "10 3 2 3"];
const sty = {}; { const n = {}; series.forEach(([k]) => { const g = grpOf(k), j = (n[g] = (n[g] ?? -1) + 1) % 4; sty[k] = {c: GC[g], d: DASH[j], o: [.85, .5, .3, .18][j], g}; }); }
const dataYears = series.flatMap(([, s]) => Object.keys(s.by_year).map(Number));
const Y0 = dataYears.length ? Math.min(...dataYears) : 2019, Y1 = dataYears.length ? Math.max(...dataYears) : 2026;
const partialYear = CT && CT.as_of ? +String(CT.as_of).slice(0, 4) : null;
// checked warning wording (warnings.json): a series' warning is replaced by its checked text, or hidden when action = remove
const WARN = ((WN && WN.warnings) || []).map(w => ({...w, key: (String(w.where || "").match(/series\s+(\S+)/) || [])[1]}));
const warnText = w => I18N.has("hist.warn." + w.id) ? t("hist.warn." + w.id) : (w.proposed_text_en || "");
const warnFor = k => WARN.find(w => w.key === k);
const charts = [];   // {box, y0, y1, h}: the full chart first, then one per era (rebuilt with the eras)
function drawChart(c) {
  const w = Math.max(220, Math.floor(c.box.clientWidth) || 300), H = c.h;
  const svg = c.svg; svg.textContent = "";
  svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
  const shown = series.filter(([k]) => on[k]);
  const L = 42, R = 12, top = 30, bot = H - 24, ph = bot - top;
  let mx = 1; shown.forEach(([, s]) => Object.entries(s.by_year).forEach(([yr, v]) => { if (+yr >= c.y0 && +yr <= c.y1) mx = Math.max(mx, v); }));
  const x = xScale(c.y0, c.y1, L, w - L - R), ax = yearAxis(c.y0, c.y1);
  ax.edges.forEach((yr, i) => { const xe = x(yr);
    if (i < ax.edges.length - 1 && i % 2 === 0) el("rect", {x: xe, y: top, width: x(yr + 1) - xe, height: bot - top, class: "band"}, svg);
    el("line", {x1: xe, x2: xe, y1: top, y2: bot + 5, class: "yr-edge", "data-yr": yr}, svg); });
  const yy = v => logS ? (v <= 0 ? null : bot - (Math.log10(v) - Math.log10(.8)) / (Math.log10(mx * 1.25) - Math.log10(.8)) * ph) : bot - v / (mx * 1.05) * ph;
  const ticks = []; if (logS) { for (let p = 0; 10 ** p <= mx * 1.25; p++) ticks.push(10 ** p); } else { const st = 10 ** Math.floor(Math.log10(mx / 3)), m = [1, 2, 5, 10].find(f => mx / (f * st) <= 5) * st; for (let v = 0; v <= mx; v += m) ticks.push(v); }
  ticks.forEach(v => { const y = yy(v) ?? bot; el("line", {x1: L, x2: w - R, y1: y, y2: y, class: "grid-l", opacity: .6}, svg);
    el("text", {x: L - 5, y: y + 3.5, "text-anchor": "end"}, svg, dg(v >= 1000 ? v.toLocaleString("en") : v)); });
  ax.labels.forEach(l => el("text", {x: x(l.at), y: bot + 15, "text-anchor": "middle", class: "yr-lbl", "data-yr": l.yr}, svg, dg(l.yr)));
  // annual totals: one bar per shown series, spanning its calendar year; the partial year is hollow with a dashed edge
  shown.forEach(([k, s], i) => {
    const st = sty[k];
    Object.keys(s.by_year).map(Number).filter(yr => yr >= c.y0 && yr <= c.y1).forEach(yr => {
      const v = s.by_year[yr], y = yy(v); if (y == null || v <= 0) return;
      const [a, b] = barSlot(yr, i, shown.length), xa = x(a), part = yr === partialYear;
      const r = el("rect", {x: xa.toFixed(1), y: y.toFixed(1), width: Math.max(1, x(b) - xa - .5).toFixed(1), height: Math.max(.5, bot - y).toFixed(1),
        fill: st.c, "fill-opacity": part ? .08 : st.o, stroke: st.c, "stroke-width": 1.2, "stroke-dasharray": part ? "2 2" : st.d, class: "bar", "data-yr": yr, "data-k": k}, svg);
      el("title", {}, r, t("hist.ct_value", {series: k, year: yr, v})); });
  });
  let row = 0;
  RULES.forEach(([d, k]) => {
    const yo = yearOf(d); if (yo < c.y0 || yo > c.y1 + 1) return;
    const xr = x(yo), right = xr > w * .55;
    el("line", {x1: xr, x2: xr, y1: top - 8, y2: bot, stroke: "#E9ECF2", "stroke-width": 1.2, "stroke-dasharray": "4 3", opacity: .85, class: "rule", "data-date": d, "data-yo": yo.toFixed(4)}, svg);
    el("text", {x: xr + (right ? -4 : 4), y: 10 + row * 12, "text-anchor": right ? "end" : "start", class: "rule-lbl"}, svg, t(k)); row++;
  });
}
function drawCharts() { charts.forEach(drawChart); }
function mkChart(host, y0, y1, h, cap) {
  host.innerHTML = `<figure><svg role="img" aria-label="${T("hist.ct_aria")}"></svg>${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
  const c = {box: host.querySelector("figure"), svg: host.querySelector("svg"), y0, y1, h, w: 0};
  charts.push(c); if (host.id === "ct-full") full = c;
  new ResizeObserver(() => { const w = Math.floor(c.box.clientWidth); if (w && w !== c.w) { c.w = w; drawChart(c); } }).observe(c.box);
  drawChart(c);
}
function drawSeries() {
  $("series").innerHTML = `<h3>${T("hist.series_h")}</h3>` + series.map(([k, s]) => {
    const st = sty[k], q = s.filter ?? s.query ?? "", lab = s.filter != null ? "hist.s_filter" : "hist.s_query";
    return `<label><input type="checkbox" data-k="${esc(k)}"${on[k] ? " checked" : ""}><span><span class="sw" style="border-color:${st.c};border-top-style:${st.d ? "dashed" : "solid"}"></span><b>${T("hist.g_" + st.g)}</b> <span class="src" lang="en" dir="ltr">${esc(s.source || "")}</span>
      <code title="${esc(k)}"><b>${T(lab)}:</b> ${esc(q)}</code>${seriesWarn(k, s)}</span></label>`; }).join("");
  $("series").querySelectorAll("input").forEach(i => i.addEventListener("change", () => { on[i.dataset.k] = i.checked; drawCharts(); }));
  $("ctnote").innerHTML = T("hist.ct_axis") + " " + (partialYear ? T("hist.partial", {date: dg(CT.as_of)}) : "") + (CT && CT.note ? ` <span lang="en" dir="ltr">${esc(CT.note)}</span>` : "");
  const ws = WARN.filter(w => w.key && w.action !== "remove" && (CT.series || {})[w.key]);
  $("ctwarn").hidden = !ws.length;
  $("ctwarn").innerHTML = ws.length ? `<b>${T("hist.warn_h")}</b><ul>${ws.map(w => `<li><span class="sw" style="border-color:${sty[w.key].c};border-top-style:${sty[w.key].d ? "dashed" : "solid"}"></span> <code lang="en" dir="ltr">${esc(w.key)}</code>: ${esc(warnText(w))}</li>`).join("")}</ul><small>${T("hist.warn_src", {date: dg(WN.as_of || "")})}</small>` : "";
}
function seriesWarn(k, s) {
  const w = warnFor(k);
  if (w) return w.action === "remove" ? "" : `<div class="w">${T("hist.s_warning")}: ${esc(warnText(w))}</div>`;
  return s.warning ? `<div class="w" lang="en" dir="ltr">${T("hist.s_warning")}: ${esc(s.warning)}</div>` : "";
}

// ---------- citations (Semantic Scholar, OpenAlex as cross-check) ----------
const CEV = (CI && CI.events) || {}, CDATE = CI ? CI.retrieved : "";
const nf = v => dg(Number(v).toLocaleString("en"));
const nfx = v => v == null ? "—" : nf(v);
const oaN = c => c.openalex ? c.openalex.count : null;
const splitTxt = c => c.split_flag ? (/splits/.test(c.split_note || "") ? t("hist.cite_split") : t("hist.cite_split_rev")) : "";
const citeTip = c => c.used == null ? t("hist.cite_null_t", {reason: c.reason || ""})
  : t(c.used_source === "s2" ? "hist.cite_t" : "hist.cite_t_oa", {s2: c.s2 ? Number(c.s2.count).toLocaleString("en") : "—", oa: oaN(c) == null ? "—" : Number(oaN(c)).toLocaleString("en")}) + (c.split_flag ? " " + splitTxt(c) + "." : "");
// short badge on the row; null shows a dash (never 0)
function citeBadge(e) { const c = CEV[e.id]; if (!c) return "";
  return `<span class="tag cite" title="${esc(citeTip(c))}">${c.used == null ? "—" : T("hist.cite_short", {n: nf(c.used)})}</span>`; }
function citeLine(e) { const c = CEV[e.id]; if (!c) return "";
  const src = c.used_source === "s2" ? (c.s2.paperId ? `<a href="https://www.semanticscholar.org/paper/${esc(c.s2.paperId)}" target="_blank" rel="noopener">Semantic Scholar</a>` : "Semantic Scholar") : "OpenAlex";
  const v = c.used == null ? `— <span class="faint">${T("hist.cite_null")}</span>`
    : `<b class="num">${T("hist.cite_n", {n: nf(c.used), date: dg(CDATE)})}</b> <span class="faint">(${src}${c.used_source === "s2" ? "" : ", " + T("hist.cite_no_s2")})</span>`;
  const cross = c.used == null ? "" : `<span class="faint" style="display:block;font-size:12.5px">${T("hist.cite_cross", {n: nfx(oaN(c))})}</span>`;
  const flag = c.split_flag ? `<span class="tag unv" style="margin-top:4px" title="${T("hist.cite_split_t")}">${esc(splitTxt(c))}</span>` : "";
  return `<dt>${T("hist.cite")}</dt><dd>${v} <span class="faint cite-why" title="${esc(citeTip(c))}">${T("hist.cite_rule")}</span>${cross}${flag}</dd>`; }

// ---------- event details (inline) ----------
function tag(cls, k) { return `<span class="tag ${cls}" title="${T(k + "_t")}">${T(k)}</span>`; }
function details(e) {
  const links = []; const L = (u, k) => u && links.push(`<a href="${esc(u)}" target="_blank" rel="noopener" lang="en" dir="ltr">${T(k)}</a>`);
  L(e.source, "hist.l_source"); if (e.arxiv) L("https://arxiv.org/abs/" + e.arxiv, "hist.l_arxiv"); if (e.doi) L("https://doi.org/" + e.doi, "hist.l_doi");
  if (e.proceedings_doi) L("https://doi.org/" + e.proceedings_doi, "hist.l_proc"); L(e.source_blog, "hist.l_blog"); L(e.archive, "hist.l_archive");
  const z = e.zotero || {}, ppl = (peopleOf[e.id] || []).map(i => `<button type="button" class="chip" data-p="${i}" lang="en" dir="ltr">${esc(PE[i].name)}</button>`).join("");
  const kind = e.kind && I18N.has("hist.kind." + e.kind) ? T("hist.kind." + e.kind) : esc(e.kind || "");
  const corr = (e.superseded || []).map(c => `<div class="corr">${esc(t("hist.corrected", {date: dg(c.checked || ""), was: c.was == null || c.was === "" ? t("hist.was_empty") : String(c.was)}))} <small>(${esc(c.field)}${c.evidence && /^https?:/.test(c.evidence) ? `, <a href="${esc(c.evidence)}" target="_blank" rel="noopener">${T("hist.evidence")}</a>` : ""})</small></div>`).join("");
  const mets = (e.metrics || []).map(m => `<li>${en(m.label)}: <b class="num">${esc(m.value)}</b> <span class="faint">${esc(m.as_of || "")}</span></li>`).join("");
  return `<div class="meta"><span class="num">${dg(e.date)}</span><span>${kind}</span><span style="color:${COL[e.track]}">${esc(trName(e.track))}</span>
      ${unvEvent(e) ? tag("unv", "hist.unverified") : ""}<span class="tag zot${z.in_zotero ? "" : " no"}" title="${T(z.in_zotero ? "hist.zotero_in" : "hist.zotero_out")}">${T(z.in_zotero ? "hist.zotero_in" : "hist.zotero_out")}</span></div>
    <h5 lang="en" dir="ltr">${e.source ? `<a href="${esc(e.source)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}</h5>
    <dl><dt>${T("hist.who")}</dt><dd>${en(e.who)}</dd>
    ${e.venue ? `<dt>${T("hist.venue")}</dt><dd>${en(e.venue)} ${unvText(e.venue) ? `<span class="tag unv" title="${T("hist.unverified_t")}">${T("hist.venue_unverified")}</span>` : ""}</dd>` : ""}
    ${e.one_liner ? `<dt>${T("hist.changed")}</dt><dd>${en(e.one_liner)}</dd>` : ""}
    ${e.impact ? `<dt>${T("hist.impact")}</dt><dd>${en(e.impact)}</dd>` : ""}
    ${citeLine(e)}
    ${mets ? `<dt>${T("hist.metrics")}</dt><dd><ul style="list-style:none;padding:0;margin:0">${mets}</ul></dd>` : ""}
    ${ppl ? `<dt>${T("hist.people")}</dt><dd class="chips">${ppl}</dd>` : ""}
    <dt>${T("hist.links")}</dt><dd class="links">${links.join("")}</dd></dl>
    ${z.in_zotero && z.key ? `<p class="faint" style="font-size:12px;margin-top:6px" lang="en" dir="ltr">Zotero ${esc(z.key)}${z.status ? " · " + esc(z.status) : ""}</p>` : ""}
    ${corr}${e.note ? `<p class="notep"><b>${T("hist.note")}:</b> ${en(e.note)}</p>` : ""}`;
}
function evRow(e) {
  const isOpen = open.has(e.id), corrected = (e.superseded || []).length > 0;
  return `<li class="ev s${e.significance}" id="e-${esc(e.id)}"><button type="button" class="evb" aria-expanded="${isOpen}" aria-controls="d-${esc(e.id)}" data-id="${esc(e.id)}">
    <span class="dt num">${dg(e.date)}</span><span class="ttl" lang="en" dir="ltr">${esc(e.title)}</span>
    ${citeBadge(e)}${unvEvent(e) ? tag("unv", "hist.unverified") : ""}${corrected ? `<span class="tag cor" title="${T("hist.corrected_tag_t")}">${T("hist.corrected_tag")}</span>` : ""}</button>
    <div class="evd" id="d-${esc(e.id)}"${isOpen ? "" : " hidden"}>${isOpen ? details(e) : ""}</div></li>`;
}

// ---------- eras ----------
function drawEras() {
  charts.length = full ? 1 : 0;
  const vis = TL.filter(MODES[mode]);
  $("count").textContent = t("hist.showing", {n: dg(vis.length), m: dg(TL.length)});
  $("eras").innerHTML = eras.map(E => {
    const evs = vis.filter(e => e.era === E.id).sort((a, b) => yearOf(a.date) - yearOf(b.date));
    const hasCh = series.length && E.a < Y1 + 1 && eraEndY(E) >= Y0;
    const groups = tracks.map(k => ({k, list: evs.filter(e => e.track === k)})).filter(g => g.list.length);
    return `<article class="era" id="era-${E.i}" style="--ec:${E.c}"><header><h3 lang="en" dir="ltr">${esc(E.label)}</h3>
      <span class="span">${dg(E.from)} – ${dg(E.to)} · ${T("hist.era_n", {n: dg(evs.length), m: dg(TL.filter(e => e.era === E.id).length)})}</span></header>
      <div class="body${hasCh ? " hasch" : ""}"><div class="evs">${groups.length ? groups.map(g => `<div class="tg"><h4><span class="sw" style="background:${COL[g.k]}"></span>${esc(trName(g.k))}</h4><ul>${g.list.map(evRow).join("")}</ul></div>`).join("") : `<p class="none">${T("hist.era_none")}</p>`}</div>
      ${hasCh ? `<div class="chart" data-era="${E.i}"></div>` : ""}</div></article>`; }).join("");
  document.querySelectorAll("#eras .chart").forEach(h => {
    const E = eras[+h.dataset.era], y0 = Math.max(Y0, Math.floor(E.a)), y1 = Math.min(Y1, eraEndY(E));
    mkChart(h, y0, y1, 190, T("hist.era_chart", {a: dg(y0), b: dg(y1)}));
  });
}
function eraEndY(E) { const p = String(E.to).split("-"); return +p[0]; }

function toggle(id, force) {
  const e = ev[id]; if (!e) return;
  const want = force != null ? force : !open.has(id);
  want ? open.add(id) : open.delete(id);
  const row = $("e-" + id); if (!row) return;
  const b = row.querySelector(".evb"), d = row.querySelector(".evd");
  b.setAttribute("aria-expanded", want); d.hidden = !want; d.innerHTML = want ? details(e) : "";
}
$("eras").addEventListener("click", k => { const b = k.target.closest("[data-p]"); if (b) showPerson(+b.dataset.p); });
$("eras").addEventListener("click", k => { const b = k.target.closest(".evb"); if (b) { toggle(b.dataset.id); try { history.replaceState(null, "", open.has(b.dataset.id) ? "#e-" + b.dataset.id : location.pathname + location.search); } catch (_) {} } });
function reveal(id) {
  if (!MODES[mode](ev[id])) setMode("all");
  toggle(id, true);
  const r = $("e-" + id); if (r) r.scrollIntoView({block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  try { history.replaceState(null, "", "#e-" + id); } catch (_) {}
}

// ---------- controls ----------
function setMode(m) {
  mode = m; document.querySelectorAll("#mode button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === m));
  drawEras();
}
document.querySelectorAll("#mode button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.m)));
$("logt").addEventListener("change", e => { logS = e.target.checked; drawCharts(); });
$("jumps").innerHTML = eras.map(E => `<button type="button" class="btn" data-j="${E.i}" lang="en" dir="ltr">${esc(E.id)}</button>`).join("");
document.querySelectorAll("[data-j]").forEach(b => b.addEventListener("click", () => { const a = $("era-" + b.dataset.j); if (a) a.scrollIntoView({block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); }));

// ---------- people ----------
const pcard = (p, i) => {
  const evs = (p.papers || []).filter(id => ev[id]).map(id => `<button type="button" class="chip" data-e="${esc(id)}" lang="en" dir="ltr" title="${esc(ev[id].title)}">${esc(ev[id].title.length > 38 ? ev[id].title.slice(0, 36) + "…" : ev[id].title)}</button>`).join("");
  const link = p.link ? (p.link_verified ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${T("hist.p_home")}${p.link_kind ? ` <span class="faint" lang="en" dir="ltr">(${esc(p.link_kind)})</span>` : ""}</a>`
    : `<a href="${esc(p.link)}" target="_blank" rel="noopener">${T("hist.p_search")}</a> <span class="tag unv" title="${T("hist.unverified_t")}">${T("hist.homepage_nv")}</span>`) : "";
  return `<article class="pc" id="p-${i}" data-tr="${esc(p.track || "")}"><b lang="en" dir="ltr">${esc(p.name)}</b>
    <div class="aff" lang="en" dir="ltr">${esc(p.affiliation || "")} ${unvText(p.affiliation) ? `<span class="tag unv" title="${T("hist.unverified_t")}">${T("hist.aff_unverified")}</span>` : ""}</div>
    <div class="why">${en(p.why)}</div><div class="lk">${link}</div>
    ${evs ? `<div class="chips" style="margin-top:6px"><span class="faint" style="font-size:12px">${T("hist.p_events")}</span>${evs}</div>` : ""}</article>`; };
function drawPeople() {
  const f = $("pf-sel").value, list = (PE || []).map((p, i) => [p, i]).filter(([p]) => !f || p.track === f);
  $("people").innerHTML = list.map(([p, i]) => pcard(p, i)).join("");
  $("pcount").textContent = t("hist.n_people", {n: dg(list.length)});
  $("people").querySelectorAll("[data-e]").forEach(b => b.onclick = () => reveal(b.dataset.e));
}
function showPerson(i) {
  if (($("pf-sel").value) && PE[i].track !== $("pf-sel").value) { $("pf-sel").value = ""; drawPeople(); }
  const c = $("p-" + i); if (!c) return;
  const sec = $("s-people"); if (sec.classList.contains("hx-collapsed")) sec.querySelector("[aria-expanded]")?.click();
  document.querySelectorAll(".pc.hl").forEach(x => x.classList.remove("hl")); c.classList.add("hl");
  c.scrollIntoView({block: "center", behavior: "smooth"});
}
$("pf-sel").innerHTML = `<option value="">${T("hist.all_tracks")}</option>` + tracks.map(k => `<option value="${k}">${esc(trName(k))}</option>`).join("");
$("pf-sel").addEventListener("change", drawPeople);

// ---------- how important is the field (citations) ----------
function drawCites() {
  const box = $("cites");
  if (!CI || !CI.top20) { box.innerHTML = `<p class="note-box">${T("hist.cite_none")}</p>`; return; }
  const tt = CI.totals || {}, all = Object.entries(CEV), nulls = all.filter(([, c]) => c.used == null);
  const oaOnly = all.filter(([, c]) => c.used_source === "openalex"), split = all.filter(([, c]) => c.split_flag);
  const eraC = Object.fromEntries(eras.map(E => [E.id, E.c]));
  const bar = (v, mx, c) => `<span class="cbar"><span style="width:${Math.max(.6, v / mx * 100).toFixed(2)}%;background:${c}"></span></span>`;
  const evBtn = ([k]) => `<button type="button" class="lnk" data-e="${esc(k)}" lang="en" dir="ltr">${esc(ev[k] ? ev[k].title : k)}</button>`;
  const mx = Math.max(...CI.top20.map(r => r.citations), 1);
  const top = CI.top20.map(r => { const c = CEV[r.id] || {}, e = ev[r.id];
    return `<li><span class="rk num">${dg(r.rank)}</span><span class="nm">${e ? `<button type="button" class="lnk" data-e="${esc(r.id)}" lang="en" dir="ltr">${esc(r.title)}</button>` : `<span lang="en" dir="ltr">${esc(r.title)}</span>`}
      <small class="faint">${e ? dg(e.date) + " · " : ""}<span lang="en" dir="ltr">${esc(c.era || "")}</span> · ${T("hist.cite_cross", {n: nfx(oaN(c))})}${c.split_flag ? " · " + esc(splitTxt(c)) : ""}</small></span>
      ${bar(r.citations, mx, eraC[c.era] || "#98A0B0")}<span class="v num" title="${esc(citeTip(c))}">${nf(r.citations)}</span></li>`; }).join("");
  const be = CI.by_era || {}, emx = Math.max(...Object.values(be).map(v => v.citations), 1);
  const byEra = eras.filter(E => be[E.id]).map(E => { const v = be[E.id];
    return `<li><span class="nm"><span lang="en" dir="ltr">${esc(E.label)}</span> <small class="faint">${dg(E.from)} – ${dg(E.to)} · ${T("hist.cite_era_n", {n: dg(v.events)})}</small></span>
      ${bar(v.citations, emx, E.c)}<span class="v num">${nf(v.citations)}</span></li>`; }).join("");
  box.innerHTML = `<p class="cite-basis"><b>${T("hist.cite_basis", {date: dg(CDATE)})}</b></p>
    <p class="cite-tot">${T("hist.cite_totals", {m: dg(tt.matched), n: dg(tt.events_considered), s: dg(tt.from_s2 ?? 0), sum: nf(tt.sum_citations || 0), date: dg(CDATE)})}</p>
    <div class="cgrid"><div><h3>${T("hist.cite_top_h")}</h3><ol class="crank">${top}</ol></div>
    <div><h3>${T("hist.cite_era_h")}</h3><ul class="crank era-r">${byEra}</ul><p class="faint cnote">${T("hist.cite_era_note")} ${VW.note ? `<span lang="en" dir="ltr">${esc(VW.note)}</span>` : ""}</p></div></div>
    <div class="note-box cav"><b>${T("hist.cite_cav_h")}</b><ul>
      <li>${T("hist.cite_cav_src", {date: dg(CDATE)})}</li><li>${T("hist.cite_cav_max", {n: dg(split.length)})}</li>
      ${oaOnly.length ? `<li>${T("hist.cite_cav_oa", {n: dg(oaOnly.length)})} ${oaOnly.map(evBtn).join(", ")}</li>` : ""}
      ${nulls.length ? `<li>${T("hist.cite_cav_null", {n: dg(nulls.length)})} ${nulls.map(evBtn).join(", ")}</li>` : ""}
      <li>${T("hist.cite_cav_other")}</li></ul></div>`;
  box.querySelectorAll("[data-e]").forEach(b => b.onclick = () => reveal(b.dataset.e));
}

// ---------- go ----------
drawSeries(); drawCites();
if (series.length) mkChart($("ct-full"), Y0, Y1, 230, T("hist.ct_h"));
setMode("story"); drawPeople();
const h = location.hash.match(/^#e-(.+)$/);
if (h && ev[h[1]]) reveal(h[1]);
})();
