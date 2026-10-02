// Research quality page: Iran vs world AI-in-education works by SCImago quartile
// (education-stats exports/site/research_quartiles.json). Topic, detail level, share basis and the source classes
// shown are all chosen by the reader and kept in the URL hash, so a chosen view can be shared.
(async () => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tt = (k, o) => esc(t(k, o));
if (!(D.data.iran_stats || []).includes("research_quartiles.json")) { $("big").innerHTML = `<p class="note-box">${tt("rq.nodata")}</p>`; return; }
const R = await fetch("/thesis/data/iran_stats/research_quartiles.json").then(r => r.json());
const COL = {Q1: "#3CC7B4", Q2: "#7C9CFF", Q3: "#C28BFF", Q4: "#F2A93B", not_ranked: "#68707F", conference: "#98A0B0", repository: "#4A5262", other: "#2E3544", unknown: "#20262F"};
const CLASSES = R.meta.classes, JOURNAL = ["Q1", "Q2", "Q3", "Q4", "not_ranked"];
const pct = (a, b) => b ? (100 * a / b) : 0, f1 = x => x.toFixed(1), N = x => Number(x).toLocaleString("en");

// state <-> hash: #b=ai&l=1&r=0&c=Q1,Q2,...
const st = {b: "ai", l: "1", r: "0", c: CLASSES.join(",")};
try { for (const [k, v] of new URLSearchParams(location.hash.slice(1))) if (k in st) st[k] = v; } catch (e) {}
if (!R.buckets[st.b]) st.b = Object.keys(R.buckets)[0];
const save = () => history.replaceState(null, "", "#" + new URLSearchParams(st).toString());

$("bseg").innerHTML = Object.keys(R.buckets).map(k => `<button data-b="${esc(k)}">${tt("rq.b." + k)}</button>`).join("");
$("cls").innerHTML = CLASSES.map(c => `<label data-c="${esc(c)}"><input type="checkbox" value="${esc(c)}"><i style="background:${COL[c] || "#444"}"></i>${tt("rq.c." + c)}</label>`).join("");

function draw() {
  save();
  const B = R.buckets[st.b], ranked = st.r === "1";
  const on = new Set(st.c.split(",").filter(Boolean)), use = (ranked ? JOURNAL.filter(c => c !== "not_ranked") : CLASSES).filter(c => on.has(c));
  for (const b of $("bseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.b === st.b);
  for (const b of $("lseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.l === st.l);
  $("ranked").checked = ranked;
  for (const l of $("cls").querySelectorAll("label")) { const c = l.dataset.c; l.hidden = ranked && !JOURNAL.slice(0, 4).includes(c); l.querySelector("input").checked = on.has(c); }
  for (const i of [1, 2, 3]) $("p" + i).hidden = +st.l < i && i !== 1 ? true : false;
  const T = B.totals, sum = (side, cs) => cs.reduce((s, c) => s + (T[side][c] || 0), 0);
  const den = s => ranked ? sum(s, ["Q1", "Q2", "Q3", "Q4"]) : T[s].total;

  // level 1: headline
  $("big").innerHTML = `<div class="ir"><b>${N(T.iran.total)}</b><span>${tt("rq.k_works", {w: N(T.world.total), y0: B.years[0], y1: B.years.at(-1)})}</span></div>
    <div class="ir"><b>${f1(pct(T.iran.total, T.world.total))}%</b><span>${tt("rq.k_share")}</span></div>
    <div class="ir"><b>${f1(pct(T.iran.Q1, den("iran")))}%</b><span>${tt(ranked ? "rq.k_q1r" : "rq.k_q1", {w: f1(pct(T.world.Q1, den("world")))})}</span></div>
    <div class="ir"><b>${f1(pct(T.iran.Q1, T.world.Q1))}%</b><span>${tt("rq.k_q1share")}</span></div>`;
  $("cav").innerHTML = tt("rq.cav") + (st.b === "its" ? " " + tt("rq.cav_its") : "");

  // level 2: mix bars (Iran vs world) + Iran share of world per class per year
  const bar = (side, y) => { const tot = use.reduce((s, c) => s + (T[side][c] || 0), 0) || 1; let x = 120;
    return `<text x="0" y="${y + 17}">${tt("rq.side." + side)}</text>` + use.map(c => { const w = 560 * (T[side][c] || 0) / tot, r = `<rect x="${x}" y="${y}" width="${w}" height="26" fill="${COL[c]}"><title>${esc(t("rq.c." + c))}: ${N(T[side][c] || 0)} (${f1(100 * (T[side][c] || 0) / tot)}%)</title></rect>` + (w > 34 ? `<text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" style="fill:#0B0D12">${Math.round(100 * (T[side][c] || 0) / tot)}%</text>` : ""); x += w; return r; }).join(""); };
  $("mix").innerHTML = `<svg viewBox="0 0 700 80" role="img" aria-label="${tt("rq.mix_h")}">${bar("iran", 4)}${bar("world", 44)}</svg>`;
  const yrs = B.years, W = 700, H = 220, px = i => 50 + i * (W - 70) / (yrs.length - 1);
  const series = use.filter(c => B.iran_share_pct[c]), mx = Math.max(1, ...series.flatMap(c => B.iran_share_pct[c]));
  const py = v => H - 30 - (H - 50) * v / mx;
  $("share").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tt("rq.share_h")}">` +
    [0, mx / 2, mx].map(v => `<line x1="50" x2="${W - 20}" y1="${py(v)}" y2="${py(v)}" stroke="#242B38"/><text x="44" y="${py(v) + 4}" text-anchor="end">${f1(v)}%</text>`).join("") +
    yrs.map((y, i) => i % 2 ? "" : `<text x="${px(i)}" y="${H - 10}" text-anchor="middle">${y}</text>`).join("") +
    series.map(c => `<polyline fill="none" stroke="${COL[c]}" stroke-width="${c === "Q1" ? 3 : 1.6}" points="${B.iran_share_pct[c].map((v, i) => `${px(i)},${py(v)}`).join(" ")}"><title>${esc(t("rq.c." + c))}</title></polyline>`).join("") + `</svg>`;

  // level 3: per-year table + top journals
  $("years").innerHTML = `<tr><th>${tt("rq.th_class")}</th>${yrs.map(y => `<th class="n">${y}</th>`).join("")}</tr>` +
    use.map(c => `<tr><td><span class="q" style="background:${COL[c]}">${tt("rq.c." + c)}</span></td>${yrs.map((y, i) => `<td class="n">${N(B.iran[c]?.[i] ?? 0)} <span class="faint">/ ${N(B.world[c]?.[i] ?? 0)}</span></td>`).join("")}</tr>`).join("");
  const top = L => `<tr><th>${tt("rq.th_journal")}</th><th>${tt("rq.th_class")}</th><th class="n">SJR</th><th class="n">${tt("rq.th_works")}</th></tr>` +
    L.map(j => `<tr><td lang="en" dir="ltr">${esc(j.name)}</td><td><span class="q" style="background:${COL[j.class] || "#444"}">${tt("rq.c." + j.class)}</span></td><td class="n">${j.sjr ?? "—"}</td><td class="n">${N(j.works)}</td></tr>`).join("");
  $("tir").innerHTML = top(B.top_journals_iran); $("tw").innerHTML = top(B.top_journals_world);
}
for (const b of $("bseg").querySelectorAll("button")) b.onclick = () => { st.b = b.dataset.b; draw(); };
for (const b of $("lseg").querySelectorAll("button")) b.onclick = () => { st.l = b.dataset.l; draw(); };
$("ranked").oninput = () => { st.r = $("ranked").checked ? "1" : "0"; draw(); };
$("cls").oninput = () => { st.c = [...$("cls").querySelectorAll("input:checked")].map(i => i.value).join(","); draw(); };
$("foot").textContent = t("rq.foot", {asof: R.meta.as_of});
draw();
})();
