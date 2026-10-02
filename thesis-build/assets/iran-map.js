// Iran education map — vanilla JS over the education-stats export (provinces, k12, he, meta, provenance).
(async () => {
const $ = id => document.getElementById(id);
if (!D.data.iran_stats.includes("provinces.json")) {
  $("empty").hidden = false; $("empty").textContent = t("map.nodata");
  return;
}
const get = f => fetch(`/thesis/data/iran_stats/${f}.json`).then(r => r.json());
const [PV, K, H, META, PROV] = await Promise.all(["provinces", "k12", "he", "meta", "provenance"].map(get));
const hasOut = D.data.iran_stats.includes("outcomes.json");
const [O, REL] = hasOut ? await Promise.all(["outcomes", "relations"].map(get)) : [{years: [], data: {}}, null];
const ACH = D.data.iran_stats.includes("achievement.json") ? await get("achievement") : [];
const TCS = D.data.iran_stats.includes("timss_class_size.json") ? await get("timss_class_size") : null;
const opt = f => D.data.iran_stats.includes(f + ".json") ? get(f) : Promise.resolve(null);
const [FX, HQ, NATO, RS] = await Promise.all([opt("final_exam"), opt("he_quality"), opt("national_outcomes"), opt("he_research")]);
if (!hasOut) document.querySelector('#ds button[data-v="out"]').hidden = true;

// i18n: every UI string is t("map.…") (i18n/en.json + fa.json); export text (interpretations, source lines) is translated
// in D.map_fa (i18n/fa/iran-map.json) keyed by its English text, so a changed export line falls back to English.
const I = I18N, esc = I.esc, FA = I.fa ? (D.map_fa || {}) : {};
const dt = s => I.tx(s, FA.text?.[s]);  // data text, escaped, Persian when translated
const fmt = v => v == null ? "—" : v >= 1e6 ? t("map.u_m", {v: (v/1e6).toFixed(2)}) : v >= 1e4 ? t("map.u_k", {v: Math.round(v/1e3)}) : v >= 100 ? Math.round(v).toLocaleString("en") : (+v).toFixed(1);
const full = v => v == null ? "—" : Math.round(v).toLocaleString("en");
const NAME = Object.fromEntries(PV.provinces.map(p => [p.code, p]));
NAME.IRN = {code: "IRN", name_en: "Iran (national)", name_fa: "کل کشور"};
const NM = c => I.fa ? NAME[c].name_fa : NAME[c].name_en;   // the province name in the page language
const IRN = t("map.iran");
const tmap = (pre, keys) => Object.fromEntries(keys.map(k => [k, t(pre + k)]));
const LV = tmap("map.lv.", ["primary", "lower_secondary", "upper_secondary", "core_three", "all_levels"]);
const DEG = tmap("map.deg.", ["all", "associate", "bachelor", "master", "professional_doctorate", "phd"]);
const TYP = tmap("map.typ.", ["all", "azad", "payame_noor", "public_msrt", "public_mohme", "applied_science", "technical_vocational_univ", "farhangian_teacher_training", "private_nonprofit", "public_other"]);
const FLAG = tmap("map.flag.", ["teacher_proxy_educational_staff", "alborz_in_tehran", "khorasan_undivided", "school_reform_1391_93", "province_tables_quarantined", "coverage_excl_azad_vs_azad_separate", "coverage_incl_azad_fulltime_staff"]);
const sig = o => o ? t("map.sig_yes") : t("map.sig_no");
const yy = y => `${y}–${String(y + 1).slice(-2)}`;  // a Solar Hijri academic year, 1402–03

const S = {ds: "k12", lvl: "primary", deg: "all", typ: "all", gen: "total", msr: "ratio", yi: 0, sel: "IRN", playing: null};
const OUTLV = tmap("map.lv.", ["primary", "lower_secondary", "upper_secondary"]);

// ---------- data access ----------
function k12(y, p, lvl = S.lvl) { return K.data[y]?.[p]?.[lvl]; }
function heRec(y, p, deg = S.deg, typ = S.typ) {
  const r = H.data[y]?.[p]; if (!r) return null;
  if (typ !== "all") return r[typ]?.[deg] || null;
  if (r.all_reported?.[deg]) return r.all_reported[deg];
  const a = r.azad?.[deg], b = r.excl_azad?.[deg]; if (!a && !b) return null;
  const out = {};  // all universities before 1393 = Azad + the rest
  for (const g of ["total", "male", "female"]) {
    const ga = a?.[g] || {}, gb = b?.[g] || {}; const o = {};
    for (const f of ["students", "academic_staff"]) if (ga[f] != null && gb[f] != null) o[f] = ga[f] + gb[f];
    if (g === "total" && o.students && o.academic_staff) o.students_per_staff = +(o.students / o.academic_staff).toFixed(2);
    if (Object.keys(o).length) out[g] = o;
  }
  return Object.keys(out).length ? out : null;
}
const rec = (y, p) => S.ds === "k12" ? k12(y, p) : S.ds === "he" ? heRec(y, p) : O.data[y]?.[p];
// Results: outcome measures from the yearbooks (pass rate, class size, two throughput proxies); null when withheld
function outVal(y, p, msr = S.msr, lvl = S.lvl, gen = S.gen) {
  const r = O.data[y]?.[p]; if (!r) return null;
  if (msr === "pass_rate") { const x = r.pass_rate?.[lvl]?.[gen]; return x?.status === "ok" && x.pass_rate != null ? 100 * x.pass_rate : null; }
  if (msr === "class_size") return r.class_size?.[lvl]?.students_per_class ?? null;
  if (msr === "completion") { const x = r.completion_proxy?.[gen]; return x?.status === "ok" ? 100 * x.completion_proxy : null; }
  if (msr === "final_exam") return FX?.[y]?.[p]?.avg ?? null;
  if (msr === "survival") { const x = r.cohort_survival?.[gen]; return x?.status === "ok" ? 100 * x.cohort_survival : null; }
  if (msr === "he_grad") { const x = r.he_graduation_ratio?.[gen]; return x?.status === "ok" ? 100 * x.graduation_ratio : null; }
  return null;
}
function heQual(y, p, msr) {
  if (!HQ && !msr.startsWith("pubs")) return null;
  if (msr === "completion_ba") { const x = HQ.completion.data[y]?.[p]?.all_reported?.bachelor?.nominal?.total; return x?.status === "ok" ? 100 * x.completion_ratio : null; }
  if (msr === "senior") { const r = HQ.rank_mix.data[y]?.[p]; const x = r?.all_reported || r?.azad_plus_excl_azad; return x?.status === "ok" && x.senior_share != null ? 100 * x.senior_share : null; }
  if (msr === "pubs" || msr === "pubs_staff" || msr === "pubs_ai") { // OpenAlex: academic year y (SH) ↔ publication year y + 621
    const pr = RS?.provinces?.[p] || (p === "IRN" ? RS?.national : null); if (!pr) return null;
    const i = pr.years.indexOf(+y + 621); if (i < 0) return null;
    return msr === "pubs" ? pr.works[i] ?? null : msr === "pubs_ai" ? pr.ai_works?.[i] ?? null : pr.works_per_staff?.[i] ?? null;
  }
  if (msr === "postgrad") { const r = HQ.degree_mix.data[y]?.[p]; const x = r?.all_reported || r?.azad_plus_excl_azad; return x?.status === "ok" && x.share?.postgraduate != null ? 100 * x.share.postgraduate : null; }
  return null;
}
function value(y, p, msr = S.msr) {
  if (S.ds === "out") return outVal(y, p, msr);
  if (S.ds === "he" && ["completion_ba", "senior", "postgrad", "pubs", "pubs_staff", "pubs_ai"].includes(msr)) return heQual(y, p, msr);
  const r = rec(y, p); if (!r) return null;
  if (msr === "ratio") return S.ds === "k12" ? r.total?.students_per_teacher ?? null : r.total?.students_per_staff ?? null;
  if (msr === "students") return r.total?.students ?? null;
  if (msr === "female") return r.female?.students != null && r.total?.students ? 100 * r.female.students / r.total.students : null;
  return null;
}
const SRC = () => S.ds === "k12" ? K : S.ds === "he" ? H : O;
const yearsAll = () => SRC().years.map(y => y.year_sh);
const yearMeta = y => SRC().years.find(x => x.year_sh == y) || {};
const year = () => yearsAll()[S.yi];

// ---------- controls ----------
function fillSelect(id, opts, cur) { $(id).innerHTML = Object.entries(opts).map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${l}</option>`).join(""); }
const PCT = new Set(["pass_rate", "completion", "he_grad", "female", "survival", "completion_ba", "senior", "postgrad"]);
function measures() {
  const m = k => t("map.m." + k);
  if (S.ds === "out") return {pass_rate: m("pass_rate"), class_size: m("class_size"), survival: m("survival"), ...(FX ? {final_exam: m("final_exam")} : {}), completion: m("completion"), he_grad: m("he_grad")};
  return S.ds === "k12" ? {ratio: m("ratio_k12"), students: m("students"), female: m("female_k12")}
                        : {ratio: m("ratio_he"), students: m("students"), female: m("female_he"),
     ...(HQ ? {completion_ba: m("completion_ba"), senior: m("senior"), postgrad: m("postgrad")} : {}),
     ...(RS ? {pubs: m("pubs"), pubs_staff: m("pubs_staff"), pubs_ai: m("pubs_ai")} : {})};
}
function setupControls() {
  fillSelect("lvl", LV, S.lvl); fillSelect("deg", DEG, S.deg); fillSelect("typ", TYP, S.typ);
  if (!(S.msr in measures())) S.msr = Object.keys(measures())[0];
  if (S.ds === "out") { if (!(S.lvl in OUTLV)) S.lvl = "primary"; fillSelect("lvl", S.msr === "pass_rate" ? {primary: OUTLV.primary, lower_secondary: OUTLV.lower_secondary} : OUTLV, S.lvl); }
  fillSelect("msr", measures(), S.msr);
  $("gen-l").hidden = S.ds !== "out";
  $("lvl-l").hidden = !(S.ds === "k12" || (S.ds === "out" && ["pass_rate", "class_size"].includes(S.msr))); $("deg-l").hidden = $("typ-l").hidden = S.ds !== "he";
  const ys = yearsAll(); $("yr").max = ys.length - 1; if (S.yi > ys.length - 1) S.yi = ys.length - 1;
  $("yr").value = S.yi;
}
$("ds").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.ds = b.dataset.v;
  [...$("ds").children].forEach(x => x.setAttribute("aria-pressed", x === b)); setupControls(); S.yi = latest(); setupControls(); draw(); };
// open on the newest year that has province values for the current selection (e.g. HE staff are blank in 1402)
function latest() { const ys = yearsAll(); for (let i = ys.length - 1; i >= 0; i--) if (PV.provinces.some(p => value(ys[i], p.code) != null)) return i; return ys.length - 1; }
for (const [id, k] of [["lvl", "lvl"], ["deg", "deg"], ["typ", "typ"], ["msr", "msr"], ["gen", "gen"]]) $(id).onchange = e => { S[k] = e.target.value; if (k === "msr" || S.ds === "out") setupControls();
  if (!PV.provinces.some(p => value(year(), p.code) != null)) { S.yi = latest(); $("yr").value = S.yi; } draw(); };
$("yr").oninput = e => { S.yi = +e.target.value; draw(); };
$("play").onclick = () => {
  // <html data-playing> tells the site header's "show what changed" rule to stay still while the years play
  if (S.playing) { clearInterval(S.playing); S.playing = null; $("play").textContent = "▶"; delete document.documentElement.dataset.playing; return; }
  if (S.yi >= yearsAll().length - 1) S.yi = 0;
  $("play").textContent = "❚❚"; document.documentElement.dataset.playing = "1";
  S.playing = setInterval(() => { if (S.yi >= yearsAll().length - 1) { $("play").click(); return; } S.yi++; $("yr").value = S.yi; draw(); }, 900);
};

// ---------- colour scale: fixed over all years for the current settings, so playing the years is honest ----------
const RAMPS = {k12: ["#1B2244", "#26336E", "#34489B", "#4D66C9", "#7C9CFF", "#B9C8FF"], he: ["#0F2E2B", "#134B45", "#18695F", "#1F8C7D", "#3CC7B4", "#93E6D9"], female: ["#2A1840", "#43266A", "#5E3893", "#7E52BF", "#A374E6", "#D4B8FF"], out: ["#3A2A10", "#5C4317", "#83601F", "#B08228", "#F2A93B", "#FFD592"]};
function scale() {
  const vals = [];
  for (const y of yearsAll()) for (const p of PV.provinces) { const v = value(y, p.code); if (v != null) vals.push(v); }
  vals.sort((a, b) => a - b);
  const ramp = S.msr === "female" ? RAMPS.female : RAMPS[S.ds];  // Results use the amber ramp
  const qs = ramp.slice(1).map((_, i) => vals[Math.floor((i + 1) / ramp.length * (vals.length - 1))]);
  return {ramp, qs, color: v => v == null ? null : ramp[qs.filter(q => v > q).length]};
}

// ---------- map ----------
const svg = $("map"); svg.setAttribute("viewBox", PV.viewBox.join(" "));
svg.innerHTML = `<rect x="0" y="0" width="${PV.viewBox[2]}" height="${PV.viewBox[3]}" fill="transparent" data-sea="1"/>` +
  PV.provinces.map(p => `<path d="${p.path}" data-c="${p.code}" fill-rule="${PV.fill_rule || "evenodd"}"><title>${esc(NM(p.code))}</title></path>`).join("") +
  PV.provinces.map(p => `<text x="${p.label[0]}" y="${p.label[1]}" text-anchor="middle">${esc(NM(p.code))}</text>`).join("");
svg.addEventListener("click", e => { const c = e.target.dataset.c; S.sel = c || "IRN"; draw(); });
const tip = $("tip");
svg.addEventListener("mousemove", e => { const c = e.target.dataset.c; if (!c) { tip.style.display = "none"; return; }
  const v = value(year(), c); tip.style.display = "block";
  // keep the tooltip inside the window (it flips to the other side of the pointer near the edge)
  const tx = e.clientX + 14 + 270 > innerWidth ? e.clientX - 14 - 260 : e.clientX + 14; tip.style.left = Math.max(4, tx) + "px"; tip.style.top = e.clientY + 14 + "px";
  tip.innerHTML = `<b>${esc(NM(c))}</b> <span ${I.fa ? 'lang="en" dir="ltr"' : 'lang="fa" style="font-family:Vazirmatn"'}>${esc(I.fa ? NAME[c].name_en : NAME[c].name_fa)}</span><br>${esc(measures()[S.msr])}: <b>${v == null ? esc(t("map.no_data")) : PCT.has(S.msr) ? v.toFixed(1) + "%" : fmt(v)}</b>`; });
svg.addEventListener("mouseleave", () => tip.style.display = "none");

// ---------- small line chart ----------
function lines(series, h = 150, unit = "") {
  const W = 420, H = h, L = 40, R = 18, T = 10, B = 24;
  const pts = series.flatMap(s => s.pts.filter(p => p[1] != null));
  if (!pts.length) return `<p class="faint">${esc(t("map.no_sel"))}</p>`;
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]));
  let y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1])); const pad = (y1 - y0) * .12 || 1; y0 = y0 >= 0 ? Math.max(0, y0 - pad) : y0 - pad; y1 += pad;
  if (unit === "%" && y1 > 100) y1 = 100;
  const X = x => L + (x - x0) / ((x1 - x0) || 1) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  if (y0 < 0 && y1 > 0) s += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3A4352"/>`;
  for (const t of [y0, (y0 + y1) / 2, y1]) s += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#1E2430"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${Math.abs(t) < 10 && unit !== "%" ? t.toFixed(2) : fmt(t)}${unit}</text>`;
  for (const t of [x0, Math.round((x0 + x1) / 2), x1]) s += `<text x="${X(t)}" y="${H - 6}" text-anchor="middle" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${t}</text>`;
  const yr = year(); if (yr >= x0 && yr <= x1) s += `<line x1="${X(yr)}" x2="${X(yr)}" y1="${T}" y2="${H - B}" stroke="#F2A93B" stroke-opacity=".5" stroke-dasharray="3 3"/>`;
  for (const se of series) {
    const p = se.pts.filter(q => q[1] != null); if (!p.length) continue;
    s += `<polyline points="${p.map(q => X(q[0]) + "," + Y(q[1])).join(" ")}" fill="none" stroke="${se.c}" stroke-width="${se.w || 2}" ${se.dash ? 'stroke-dasharray="4 4"' : ""}/>`;
    s += p.map(q => `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="2.6" fill="${se.c}"><title>${esc(se.l)} ${q[0]}: ${fmt(q[1])}${unit}</title></circle>`).join("");
  }
  return s + `</svg><div class="gleg" style="justify-content:flex-start;gap:16px;margin-top:4px">${series.map(se => `<span><i style="display:inline-block;width:14px;height:2px;background:${se.c};vertical-align:middle;margin-inline-end:6px"></i>${esc(se.l)}</span>`).join("")}</div>`;
}

// ---------- draw ----------
function draw() {
  const y = year(), ym = yearMeta(y), sc = scale(), msrL = measures()[S.msr];
  $("yrout").innerHTML = `${y}–${String(y + 1).slice(-2)} <small>(${y + 621}–${String(y + 622).slice(-2)})</small>`;
  let n = 0;
  for (const el of svg.querySelectorAll("path")) {
    const v = value(y, el.dataset.c), c = sc.color(v); if (v != null) n++;
    el.classList.toggle("nodata", c == null); if (c) el.style.fill = c; el.classList.toggle("sel", el.dataset.c === S.sel);
  }
  $("empty").hidden = n > 0;
  if (!n) $("empty").textContent = t("map.empty_year", {y});
  const f = PCT.has(S.msr) ? v => v.toFixed(S.msr === "pass_rate" ? 1 : 0) + "%" : fmt;
  $("legend").innerHTML = `<span>${esc(msrL)}</span><span class="ramp">${sc.ramp.map(c => `<i style="background:${c}"></i>`).join("")}</span><span class="ramp">${["", ...sc.qs].map(q => `<span>${q == null || q === "" ? "" : f(q)}</span>`).join("")}</span><span class="faint">${esc(t("map.same_scale"))}</span>`;
  // ranking
  const rk = PV.provinces.map(p => [p.code, value(y, p.code)]).filter(r => r[1] != null).sort((a, b) => b[1] - a[1]);
  const mx = rk.length ? rk[0][1] : 1;
  $("rank-h").textContent = rk.length ? t("map.rank_h", {m: msrL, y}) : "";
  $("rank").innerHTML = rk.map(([c, v], i) => `<li data-c="${c}"><span class="r">${i + 1}</span><span>${esc(NM(c))}</span><i style="width:${100 * v / mx}%;background:${sc.color(v)}"></i><span class="n">${f(v)}</span></li>`).join("");
  panel(y, ym);
  relations();
}
function relations() {
  const el = $("rel"); if (!REL) { el.hidden = true; return; }
  const lvl = S.ds === "k12" || S.ds === "out" ? (["primary", "lower_secondary"].includes(S.lvl) ? S.lvl : "primary") : "primary";
  // choose the year: the slider's year if it has both measures, else the newest year that does
  const both = y => PV.provinces.filter(p => k12(y, p.code, lvl)?.total?.students_per_teacher != null && outVal(y, p.code, "pass_rate", lvl, "total") != null);
  const oys = O.years.map(x => x.year_sh); let y = year(); if (both(y).length < 25) y = [...oys].reverse().find(yy => both(yy).length >= 25);
  const pts = both(y).map(p => [k12(y, p.code, lvl).total.students_per_teacher, outVal(y, p.code, "pass_rate", lvl, "total"), NM(p.code)]);
  // scatter with least-squares line
  const W = 520, H = 330, L = 46, R = 14, T = 12, B = 34, xs = pts.map(p => p[0]), ysv = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ysv) - .5, y1 = Math.max(...ysv) + .5;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const n = pts.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ysv.reduce((a, b) => a + b, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0), sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0), syy = pts.reduce((a, p) => a + (p[1] - my) ** 2, 0);
  const b = sxy / sxx, a = my - b * mx, r = sxy / Math.sqrt(sxx * syy);
  let sc = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("map.sc_aria"))}">`;
  for (const t of [y0, (y0 + y1) / 2, y1]) sc += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#1E2430"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${t.toFixed(1)}%</text>`;
  for (const t of [x0, (x0 + x1) / 2, x1]) sc += `<text x="${X(t)}" y="${H - 14}" text-anchor="middle" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${t.toFixed(0)}</text>`;
  sc += `<text x="${(L + W - R) / 2}" y="${H - 1}" text-anchor="middle" fill="#98A0B0" font-size="11.5">${esc(t("map.ax_spt"))}</text>`;
  sc += `<line x1="${X(x0)}" x2="${X(x1)}" y1="${Y(a + b * x0)}" y2="${Y(a + b * x1)}" stroke="#F2A93B" stroke-width="2" stroke-dasharray="5 4"/>`;
  sc += pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="5" fill="#7C9CFF" fill-opacity=".85" stroke="#0B0D12"><title>${esc(t("map.sc_dot", {p: p[2], a: p[0].toFixed(1), b: p[1].toFixed(1)}))}</title></circle>`).join("") + `</svg>`;
  // correlation by year
  const ser = REL.cross_province_by_year?.students_per_teacher_vs_pass_rate || {};
  const LC = {primary: "#7C9CFF", lower_secondary: "#3CC7B4"};
  const cy = Object.entries(ser).map(([l, arr]) => ({l: OUTLV[l] || l, c: LC[l] || "#98A0B0", w: 2.2, pts: arr.map(o => [o.year_sh, o.pearson])}));
  const fe = REL.within_province_fixed_effects?.results?.students_per_teacher_vs_pass_rate || {};
  const feCell = (l, spec, label) => { const o = fe[l]?.[spec]; if (!o) return "";
    const pp = v => (100 * v).toFixed(2);
    return `<div><b>${esc(t("map.points", {v: pp(o.coef)}))}</b>${esc(t("map.fe_pass", {l: OUTLV[l], s: label, a: pp(o.ci95[0]), b: pp(o.ci95[1]), n: o.n_provinces, y0: o.years[0], y1: o.years[1]}))} ${esc(sig(o.ci95 && (o.ci95[0] > 0 || o.ci95[1] < 0)))}</div>`; };
  el.innerHTML = `<h2>${esc(t("map.rel_h"))}</h2>
    <p class="muted">${t("map.rel_p", {y: yy(y), l: esc(OUTLV[lvl]), r: `<b class="num" style="color:var(--text)">${r.toFixed(2)}</b>`, n})}</p>
    <div class="cols"><div>${sc}</div><div><h3 style="font-size:16px;margin-bottom:6px">${esc(t("map.rel_corr_h"))}</h3>${lines(cy, 230)}
      <p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.rel_corr_p"))}</p></div></div>
    <div class="fe">${feCell("primary", "all_valid_years", t("map.all_years"))}${feCell("lower_secondary", "all_valid_years", t("map.all_years"))}${feCell("primary", "from_1394", t("map.from1394"))}${feCell("lower_secondary", "from_1394", t("map.from1394"))}</div>
    ${survivalRel()}
    ${finalExamRel()}
    ${heRel()}
    ${research()}
    ${nationalOutcomes()}
    ${achievement()}
    ${timssClass()}
    <p class="note-box" style="margin-top:16px">${dt(REL.interpretation)} ${esc(t("map.rel_sofar"))}</p>`;
}
// staying in school (cohort survival) vs students per teacher: cross-province r by year + fixed effects
function survivalRel() {
  const cs = REL.cohort_survival_cross_province_by_year, fe = REL.cohort_survival_within_province_fixed_effects?.results;
  if (!cs || !fe) return "";
  const lab = {lower_secondary_at_t: t("map.surv_lab_lower"), upper_secondary_at_t_plus_3: t("map.surv_lab_upper")};
  const ser = Object.entries(cs).map(([k, arr], i) => ({l: lab[k] || k, c: ["#C28BFF", "#3CC7B4"][i % 2], w: 2.2, pts: arr.map(o => [o.year_sh, o.pearson])}));
  const cell = k => { const o = fe[k]?.all_valid_years; if (!o) return ""; const pp = v => (100 * v).toFixed(2);
    return `<div><b>${esc(t("map.points", {v: pp(o.coef)}))}</b>${esc(t("map.fe_surv", {s: lab[k], a: pp(o.ci95[0]), b: pp(o.ci95[1]), n: o.n_provinces, y0: o.years[0], y1: o.years[1]}))} ${esc(sig(o.ci95 && (o.ci95[0] > 0 || o.ci95[1] < 0)))}</div>`; };
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.surv_h"))}</h3>
    <p class="muted" style="font-size:14.5px">${esc(t("map.surv_p"))}</p>
    <div class="cols"><div>${lines(ser, 220)}<p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.surv_note"))}</p></div><div class="fe" style="margin-top:0;align-self:start">${cell("lower_secondary_at_t")}${cell("upper_secondary_at_t_plus_3")}</div></div>`;
}
// grade-12 final-exam averages vs upper-secondary students per teacher, across provinces, for each year with ≥25 provinces
function finalExamRel() {
  if (!FX) return "";
  const yrs = Object.keys(FX).filter(y => Object.keys(FX[y]).length >= 25).sort();
  const blocks = yrs.map(y => {
    const pts = PV.provinces.map(p => [k12(+y, p.code, "upper_secondary")?.total?.students_per_teacher, FX[y][p.code]?.avg, NM(p.code), FX[y][p.code]?.verified]).filter(q => q[0] != null && q[1] != null);
    if (pts.length < 20) return "";
    const n = pts.length, mx = pts.reduce((a, q) => a + q[0], 0) / n, my = pts.reduce((a, q) => a + q[1], 0) / n;
    const sxy = pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0), sxx = pts.reduce((a, q) => a + (q[0] - mx) ** 2, 0), syy = pts.reduce((a, q) => a + (q[1] - my) ** 2, 0), b = sxy / sxx, r = sxy / Math.sqrt(sxx * syy);
    const W = 420, H = 260, L = 40, R = 10, T = 10, B = 32, xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    let g = `<svg viewBox="0 0 ${W} ${H}">`;
    for (const t of [y0, (y0 + y1) / 2, y1]) g += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#1E2430"/><text x="${L - 5}" y="${Y(t) + 4}" text-anchor="end" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${t.toFixed(1)}</text>`;
    for (const t of [x0, (x0 + x1) / 2, x1]) g += `<text x="${X(t)}" y="${H - 14}" text-anchor="middle" fill="#68707F" font-size="10.5" font-family="JetBrains Mono">${t.toFixed(0)}</text>`;
    g += `<text x="${(L + W) / 2}" y="${H - 1}" text-anchor="middle" fill="#98A0B0" font-size="11">${esc(t("map.ax_spt_upper"))}</text>`;
    g += `<line x1="${X(x0)}" x2="${X(x1)}" y1="${Y(my + b * (x0 - mx))}" y2="${Y(my + b * (x1 - mx))}" stroke="#F2A93B" stroke-dasharray="5 4" stroke-width="2"/>`;
    g += pts.map(q => `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="4.8" fill="${q[3] ? "#3CC7B4" : "#7C9CFF"}" fill-opacity=".85" stroke="#0B0D12"><title>${esc(t("map.fx_dot", {p: q[2], v: q[1], a: q[0].toFixed(1)}) + (q[3] ? "" : t("map.fx_press")))}</title></circle>`).join("") + "</svg>";
    const sess = Object.values(FX[y])[0]?.session || "";
    return `<div><h3 style="font-size:15px;margin-bottom:4px">${esc(t("map.fx_block", {s: session(sess), r: r.toFixed(2), n}))}</h3>${g}</div>`;
  }).join("");
  if (!blocks) return "";
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.fx_h"))}</h3>
    <p class="muted" style="font-size:14.5px">${esc(t("map.fx_p"))}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-top:12px">${blocks}</div>`;
}
// universities: bachelor completion vs students per staff (fixed effects), from relations.json
function heRel() {
  const R0 = REL.he_completion_vs_students_per_staff; if (!R0) return "";
  const res = R0.by_degree || R0.results || {};
  const flat = []; (function walk(o, path) { if (o && typeof o === "object") { if ("coef" in o && "ci95" in o) flat.push([path, o]); else for (const k in o) walk(o[k], path.concat(k)); } })(res, []);
  if (!flat.length) return "";
  const cells = flat.slice(0, 4).map(([path, o]) => { const pp = v => (100 * v).toFixed(2);
    return `<div><b>${esc(t("map.points", {v: pp(o.coef)}))}</b>${esc(t("map.fe_he", {d: path[0] === "all" ? DEG.all : DEG[path[0]] || path[0], a: pp(o.ci95[0]), b: pp(o.ci95[1]), n: o.n}))} ${esc(sig(o.ci95[0] > 0 || o.ci95[1] < 0))}</div>`; }).join("");
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.he_h"))}</h3>
    <p class="muted" style="font-size:14.5px">${esc(t("map.he_p"))}</p>
    <div class="fe">${cells}</div><p class="faint" style="font-size:13px;margin-top:8px">${R0.interpretation ? dt(R0.interpretation) : ""}</p>`;
}
// research output of Iranian universities (OpenAlex) + ISC ranking
function research() {
  if (!RS) return "";
  const N = RS.national, cov = RS.meta?.coverage || {};
  const ser = [{l: t("map.rs_pubs"), c: "#3CC7B4", w: 2.4, pts: N.years.map((y, i) => [y, N.works[i]])}];
  const intl = [{l: t("map.rs_intl"), c: "#C28BFF", w: 2.2, pts: N.years.map((y, i) => [y, N.works[i] ? 100 * N.intl_works[i] / N.works[i] : null])},
                {l: t("map.rs_ai"), c: "#F2A93B", w: 2.2, pts: N.years.map((y, i) => [y, N.works[i] ? 100 * N.ai_works[i] / N.works[i] : null])}];
  const top = (RS.top_universities || []).slice(0, 15), mx = Math.max(...top.map(u => u.total_works));
  const rk = (RS.rankings || []).filter(r => r.year === String(Math.max(...(RS.rankings || []).map(x => +x.year)))).slice(0, 12);
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.rs_h"))}</h3>
    <p class="muted" style="font-size:14.5px">${t("map.rs_p", {a: cov.institutions_fetched, b: cov.institutions_total, c: Math.round(100 * (cov.share_of_all_time_works_fetched || 0))})}</p>
    <div class="cols"><div>${lines(ser, 220)}<p class="faint" style="font-size:13px;margin-top:6px">${esc(t("map.rs_fall"))}</p></div><div>${lines(intl, 220, "%")}</div></div>
    <div class="cols" style="margin-top:18px"><div><h3 style="font-size:15px;margin-bottom:6px">${esc(t("map.rs_top"))}</h3>${top.map(u => `<div class="unirow" style="display:grid;grid-template-columns:minmax(0,230px) 1fr 60px;gap:8px;align-items:center;font-size:13px;margin:4px 0"><span lang="en" dir="ltr" style="text-align:start">${esc(u.name)}</span><span style="height:9px;border-radius:4px;background:linear-gradient(var(--gdeg),#C28BFF ${100 * u.intl_share}%,#3CC7B4 0);width:${100 * u.total_works / mx}%"></span><span class="num" style="text-align:end">${fmt(u.total_works)}</span></div>`).join("")}<p class="faint" style="font-size:12.5px">${esc(t("map.rs_violet"))}</p></div>
      <div><h3 style="font-size:15px;margin-bottom:6px">${esc(t("map.rs_isc", {y: rk[0]?.year || ""}))}</h3>${rk.map(r => `<div style="display:grid;grid-template-columns:1fr 90px;gap:8px;font-size:13px;padding:4px 0;border-top:1px solid #1A2030"><span lang="en" dir="ltr" style="text-align:start">${esc(r.university)}</span><span class="num" style="text-align:end">${esc(r.rank)}</span></div>`).join("")}<p class="faint" style="font-size:12.5px">${esc(t("map.rs_isc_note"))}</p></div></div>`;
}
// national graduate outcomes: unemployment of graduates (press) and students studying abroad (UNESCO)
function nationalOutcomes() {
  if (!NATO) return "";
  const un = (NATO.graduate_unemployment || []).filter(r => r.period_type === "year" && r.unemployment_rate_pct && !/old definition/i.test(r.definition));
  const sers = ["both", "female", "male"].map((sx, i) => ({l: {both: t("map.grad_all"), female: t("map.women"), male: t("map.men")}[sx], c: ["#E9ECF2", "#C28BFF", "#7C9CFF"][i], w: 2.2,
    pts: un.filter(r => r.sex === sx).map(r => [+r.period, +r.unemployment_rate_pct]).sort((a, b) => a[0] - b[0])})).filter(s => s.pts.length);
  const ob = (NATO.outbound_students || []).filter(r => r.indicator === "outbound_tertiary_students_total" && r.sex === "both").map(r => [+r.year, +r.value]).sort((a, b) => a[0] - b[0]);
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.after_h"))}</h3>
    <div class="cols"><div><h3 style="font-size:15px;margin-bottom:4px">${esc(t("map.unemp_h"))}</h3>${sers.length ? lines(sers, 220, "%") : `<p class="faint">${esc(t("map.no_series"))}</p>`}
      <p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.unemp_p"))}</p></div>
      <div><h3 style="font-size:15px;margin-bottom:4px">${esc(t("map.abroad_h"))}</h3>${ob.length ? lines([{l: t("map.abroad_l"), c: "#F2A93B", w: 2.4, pts: ob}], 220) : ""}
      <p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.abroad_p"))}</p></div></div>`;
}
// Iran's national test scores (TIMSS, PIRLS) beside the national students-per-teacher line, on Gregorian years
function achievement() {
  if (!ACH.length) return "";
  const key = r => t("map.ach_series", {s: r.study, g: r.grade, sub: t("map.subj." + r.subject)}), groups = {};
  for (const r of ACH) (groups[key(r)] ||= []).push([+r.year, +r.avg_scale_score]);
  const pal = ["#7C9CFF", "#3CC7B4", "#C28BFF", "#F2A93B", "#FF8A65", "#9BE15D"];
  const sc = Object.entries(groups).map(([l, p], i) => ({l, c: pal[i % pal.length], w: 2.2, pts: p.sort((a, b) => a[0] - b[0])}));
  const stp = K.years.map(x => [x.year_sh + 621, K.data[x.year_sh]?.IRN?.primary?.total?.students_per_teacher ?? null]);
  return `<div class="cols" style="margin-top:30px"><div><h3 style="font-size:16px;margin-bottom:6px">${esc(t("map.ach_h"))}</h3>${lines(sc, 240)}
      <p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.ach_p"))}</p></div>
    <div><h3 style="font-size:16px;margin-bottom:6px">${esc(t("map.ach_spt_h"))}</h3>${lines([{l: t("map.ach_spt_l"), c: "#7C9CFF", w: 2.4, pts: stp}], 240)}
      <p class="faint" style="font-size:13px;margin-top:8px">${esc(t("map.ach_spt_p"))}</p></div></div>`;
}
// TIMSS 2023 Iran: test scores by class-size band (mean ± 1.96 SE), school level, with the slope per +5 students
function timssClass() {
  if (!TCS) return "";
  const groups = [[4, "math", t("map.tcs_g4m")], [4, "science", t("map.tcs_g4s")], [8, "math", t("map.tcs_g8m")], [8, "science", t("map.tcs_g8s")]];
  const bands = ["<=20", "21-25", "26-30", "31-35", ">35"], W = 260, H = 170, L = 36, R = 8, T = 10, B = 30;
  const all = TCS.bands.map(b => [b.mean - 1.96 * b.se, b.mean + 1.96 * b.se]).flat(), lo = Math.floor(Math.min(...all) / 10) * 10, hi = Math.ceil(Math.max(...all) / 10) * 10;
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B), X = i => L + (i + .5) * (W - L - R) / bands.length;
  const panel = ([g, sub, label]) => {
    const rows = bands.map(bd => TCS.bands.find(b => b.grade === g && b.subject === sub && b.band === bd));
    const reg = TCS.regression.find(r => r.grade === g && r.subject === sub) || {};
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    for (const t of [lo, (lo + hi) / 2, hi]) s += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#1E2430"/><text x="${L - 5}" y="${Y(t) + 4}" text-anchor="end" fill="#68707F" font-size="10" font-family="JetBrains Mono">${t}</text>`;
    rows.forEach((b, i) => { if (!b) return; const x = X(i);
      s += `<line x1="${x}" x2="${x}" y1="${Y(b.mean + 1.96 * b.se)}" y2="${Y(b.mean - 1.96 * b.se)}" stroke="#F2A93B" stroke-opacity=".6" stroke-width="2"/>
        <circle cx="${x}" cy="${Y(b.mean)}" r="5" fill="#F2A93B"><title>${esc(t("map.tcs_dot", {l: label, b: b.band, m: b.mean, se: b.se, n: b.n, c: b.n_classes, u: Math.round(100 * b.share_urban_or_suburban)}))}</title></circle>
        <text x="${x}" y="${H - 12}" text-anchor="middle" fill="#98A0B0" font-size="10.5" font-family="JetBrains Mono">${esc(b.band.replace("<=", "≤"))}</text>`; });
    const sl = (v, se) => `${v > 0 ? "+" : ""}${v.toFixed(1)} (±${(1.96 * se).toFixed(1)})`;
    return `<div><h3 style="font-size:15px;margin-bottom:4px">${esc(label)}</h3>${s}</svg><p class="faint" style="font-size:12.5px">${esc(t("map.tcs_slope", {a: sl(reg.per_5_students_unadjusted, reg.se_unadjusted), b: sl(reg.per_5_students_with_controls, reg.se_with_controls)}))}</p></div>`;
  };
  return `<h3 style="font-size:20px;margin-top:34px">${esc(t("map.tcs_h"))}</h3>
    <p class="muted" style="font-size:14.5px">${t("map.tcs_p")}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px;margin-top:12px">${groups.map(panel).join("")}</div>`;
}
$("rank").onclick = e => { const li = e.target.closest("li"); if (li) { S.sel = li.dataset.c; draw(); } };

// panel heading: the province in the page language, the other language underneath
const title = nm => I.fa ? `<h2>${esc(nm.name_fa)}</h2><div class="fa" lang="en" dir="ltr" style="font-family:var(--body)">${esc(nm.name_en)}</div>`
                         : `<h2>${esc(nm.name_en)}</h2><div class="fa" lang="fa">${esc(nm.name_fa)}</div>`;
// "Khordad 1402 (June 2023)" -> «خرداد 1402»; the session label is kept short in both languages
const session = s => { s = String(s).replace(/\(.*?\)/g, "").replace(/\s*DERIVED\s*$/, "").trim(); return I.fa ? s.replace(/^Khordad/, "خرداد").replace(/^Academic year/, "سال تحصیلی") : s; };
function outPanel(y, ym) {
  const p = S.sel, nm = NAME[p], r = O.data[y]?.[p] || {};
  const pr = l => r.pass_rate?.[l], cs = l => r.class_size?.[l]?.students_per_class;
  const pct = x => x?.status === "ok" && x.pass_rate != null ? (100 * x.pass_rate).toFixed(1) + "%" : (x?.status ? esc(t("map.withheld")) : "—");
  let h = `${title(nm)}<p class="faint" style="margin-top:4px;font-size:13.5px">${esc(t("map.results_y", {y: yy(y)}))}</p>
    <div class="big"><div><b>${pct(pr("primary")?.total)}</b><span>${esc(t("map.b_pass_pri"))}</span></div><div><b>${pct(pr("lower_secondary")?.total)}</b><span>${esc(t("map.b_pass_low"))}</span></div>
    <div><b>${cs("primary") ? cs("primary").toFixed(1) : "—"}</b><span>${esc(t("map.b_class_pri"))}</span></div><div><b>${k12(y, p, "primary")?.total?.students_per_teacher?.toFixed(1) ?? "—"}</b><span>${esc(t("map.b_spt_pri"))}</span></div></div>`;
  const g = pr(S.lvl in OUTLV && S.lvl !== "upper_secondary" ? S.lvl : "primary");
  if (g?.female?.status === "ok" && g?.male?.status === "ok") h += `<p style="font-size:14px">${esc(t("map.gb_pass", {g: (100 * g.female.pass_rate).toFixed(1), b: (100 * g.male.pass_rate).toFixed(1), l: OUTLV[S.lvl] || OUTLV.primary}))}</p>`;
  const ys = yearsAll();
  h += `<div class="chart"><h3>${esc(t("map.over_time", {m: measures()[S.msr]}))}</h3>${lines([{l: NM(p), c: "#F2A93B", pts: ys.map(yy => [yy, outVal(yy, p)]), w: 2.4},
        ...(p !== "IRN" ? [{l: IRN, c: "#98A0B0", pts: ys.map(yy => [yy, outVal(yy, "IRN")]), dash: 1}] : [])], 150, PCT.has(S.msr) ? "%" : "")}</div>`;
  h += `<div class="chart"><h3>${esc(t("map.spt_over_time", {l: OUTLV[S.lvl] || OUTLV.primary}))}</h3>${lines([{l: NM(p), c: "#7C9CFF", pts: K.years.map(x => [x.year_sh, k12(x.year_sh, p, S.lvl === "upper_secondary" || !(S.lvl in OUTLV) ? "primary" : S.lvl)?.total?.students_per_teacher ?? null]), w: 2.4}], 130)}</div>`;
  const wl = (ym.pass_rate_withheld_levels || []); if (wl.length) h += `<div class="note-box">${esc(t("map.withheld_note", {l: wl.map(l => OUTLV[l] || l).join(t("ml.comma"))}))}</div>`;
  if (S.msr === "survival") h += `<div class="note-box">${esc(t("map.surv_def"))}</div>`;
  h += `<div class="note-box">${esc(t("map.pass_def"))}</div>`;
  $("panel").innerHTML = h;
}

function panel(y, ym) {
  if (S.ds === "out") return outPanel(y, ym);
  const p = S.sel, r = rec(y, p) || {}, nm = NAME[p], tt = r.total || {}, fe = r.female?.students, ma = r.male?.students;
  const k = S.ds === "k12", staff = k ? tt.teachers : tt.academic_staff;
  const ratio = k ? tt.students_per_teacher : tt.students_per_staff;
  const what = k ? t("map.what_k12", {l: LV[S.lvl]}) : t("map.what_he", {t: TYP[S.typ], d: DEG[S.deg]});
  const gsum = (fe || 0) + (ma || 0);
  let h = `${title(nm)}<p class="faint" style="margin-top:4px;font-size:13.5px">${esc(t("map.panel_sub", {w: what, y: yy(y)}))}</p>`;
  h += `<div class="big"><div><b>${full(tt.students)}</b><span>${esc(t(k ? "map.b_students_k12" : "map.b_students_he"))}</span></div><div><b>${full(staff)}</b><span>${esc(t(k ? "map.b_teachers" : "map.b_staff"))}</span></div>
        <div><b style="color:${k ? "var(--k12)" : "var(--he)"}">${ratio == null ? "—" : (+ratio).toFixed(1)}</b><span>${esc(t(k ? "map.b_spt" : "map.b_sps"))}</span></div>
        <div><b>${fe != null && tt.students ? (100 * fe / tt.students).toFixed(1) + "%" : "—"}</b><span>${esc(t(k ? "map.b_girls" : "map.b_women"))}</span></div></div>`;
  if (gsum) h += `<div class="gbar"><i style="width:${100 * fe / gsum}%;background:var(--both)"></i><i style="width:${100 * ma / gsum}%;background:#5A6478"></i></div>
        <div class="gleg"><span>${esc(t(k ? "map.girls" : "map.women"))} ${full(fe)}</span><span>${esc(t(k ? "map.boys" : "map.men"))} ${full(ma)}</span></div>`;
  else h += `<p class="faint" style="font-size:13.5px">${esc(t("map.no_split"))}</p>`;
  // trends
  const ys = yearsAll();
  const ser = (code, msr) => ys.map(yy => [yy, value(yy, code, msr)]);
  h += `<div class="chart"><h3>${esc(t(k ? "map.spt_time" : "map.sps_time"))}</h3>${lines([
        {l: NM(p), c: k ? "#7C9CFF" : "#3CC7B4", pts: ser(p, "ratio"), w: 2.4},
        ...(p !== "IRN" ? [{l: IRN, c: "#98A0B0", pts: ser("IRN", "ratio"), dash: 1}] : [])])}</div>`;
  h += `<div class="chart"><h3>${esc(t(k ? "map.share_girls" : "map.share_women"))}</h3>${lines([
        {l: NM(p), c: "#C28BFF", pts: ser(p, "female"), w: 2.4},
        ...(p !== "IRN" ? [{l: IRN, c: "#98A0B0", pts: ser("IRN", "female"), dash: 1}] : [])], 130, "%")}</div>`;
  if (S.ds === "he") { // national breakdown by university type (the yearbooks have no per-university or per-province-by-type figures)
    const nat = H.data[y]?.IRN || {}; const rows = Object.keys(TYP).filter(k => k !== "all" && nat[k]?.[S.deg]?.total?.students).map(k => [k, nat[k][S.deg].total.students, nat[k][S.deg].female?.students]);
    if (rows.length) { const mx = Math.max(...rows.map(r => r[1]));
      h += `<div class="chart"><h3>${esc(t("map.by_type", {y}))}</h3>${rows.sort((a, b) => b[1] - a[1]).map(([k, v, fv]) => `<div style="display:grid;grid-template-columns:150px 1fr 64px;gap:8px;align-items:center;font-size:13px;margin:4px 0"><span>${esc(TYP[k])}</span><span style="height:9px;border-radius:4px;background:linear-gradient(var(--gdeg),var(--both) ${fv ? 100 * fv / v : 0}%,#5A6478 0);width:${100 * v / mx}%"></span><span class="num" style="text-align:end">${fmt(v)}</span></div>`).join("")}<p class="faint" style="font-size:12.5px">${esc(t("map.by_type_note"))}</p></div>`; }
  }
  const fl = (ym.flags || []).filter(f => FLAG[f]); if (S.ds === "k12" && ym.teacher_definition?.[S.lvl] && ym.teacher_definition[S.lvl] !== "teachers") fl.push("teacher_proxy_educational_staff");
  if (fl.length) h += `<div class="flags">${[...new Set(fl)].map(f => `<div class="note-box">${esc(FLAG[f])}</div>`).join("")}</div>`;
  const src = PROV.datasets?.[S.ds === "k12" ? "k12" : "he"]?.[y] || [];
  // provenance names the yearbook table (file :: table), never a path on this machine
  const tbl = s => String(s).replace(/^.*\//, "").replace(/#\d+$/, "");
  h += `<div class="src">${esc(t(src.length === 1 ? "map.src1" : "map.srcn", {n: src.length}))} <span data-latin>${src.slice(0, 4).map(x => esc(tbl(x))).join("; ")}${src.length > 4 ? "; …" : ""}</span></div>`;
  $("panel").innerHTML = h;
}

$("foot").innerHTML = `${dt(META.source)}. ${esc(t("map.foot_map"))} <span lang="en" dir="ltr">${esc(PV.attribution || "geoBoundaries IRN ADM1 (ODbL 1.0)")}</span>. ${esc(t("map.foot_years"))}`;
S.yi = latest();
setupControls(); draw();
})();
