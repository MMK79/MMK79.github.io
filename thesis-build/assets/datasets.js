// Datasets page: the evaluation-dataset catalogue from the vault note "Thesis - Evaluation Datasets"
// (/data/datasets.json). Dataset text stays English (lang="en"); the UI comes from i18n.
(async () => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tt = (k, o) => esc(t(k, o));
const en = s => s ? `<span lang="en" dir="ltr">${esc(s)}</span>` : "";
const sub = s => s ? `<span class="sub" lang="en" dir="ltr">${esc(s)}</span>` : "";
if (!(D.data.datasets || []).length) { $("all").outerHTML = `<p class="note-box">${tt("ds.nodata")}</p>`; return; }
if (I18N.fa) $("ennote").hidden = false;
const L = await fetch("/thesis/data/datasets.json").then(r => r.json());
const byId = Object.fromEntries(L.map(x => [x.id, x]));

const ok = st => !st || /^2\d\d/.test(String(st.http || ""));
const links = x => {
  const out = Object.entries(x.access || {}).filter(([, u]) => /^https?:\/\//.test(u || "")).map(([k, u]) => {
    const st = (x.url_status || {})[k];
    return `<a href="${esc(u)}" target="_blank" rel="noopener" lang="en" dir="ltr"${ok(st) ? "" : ` class="blocked" title="${tt("eco.blocked")}"`}>${esc(k)}</a>`; });
  const p = x.paper;
  if (p && (p.doi || p.arxiv)) out.push(`<a href="${esc(p.doi ? "https://doi.org/" + p.doi : "https://arxiv.org/abs/" + p.arxiv)}" target="_blank" rel="noopener">${tt("ds.paper")}</a>`);
  return out.join("");
};
const fit = n => n == null ? "" : `<span class="fit" title="${tt("ds.fit_t")}">${"●".repeat(n)}<i>${"●".repeat(5 - n)}</i></span>`;
const grp = g => `<span class="g">${tt("ds.g." + g)}</span>`;

// the five to use (from the note's recommendation; ids in the catalogue)
const PICKS = [["own-bank"], ["graphrag-bench-cs"], ["tutorqa"], ["lecturebank", "mooccube"], ["cskg", "cso"]];
$("picks").innerHTML = PICKS.map((ids, i) => {
  const xs = ids.map(id => byId[id]).filter(Boolean);
  return `<li><div>${xs.map(x => `<b lang="en" dir="ltr">${esc(x.name)}</b>`).join("")}<span class="role">${tt("ds.role" + (i + 1))}</span></div>
    <div class="r">${tt("ds.why" + (i + 1))}</div><div class="links">${xs.map(links).join("")}</div></li>`; }).join("");

// the big CS graphs
const G = L.filter(x => x.group === "graph_scholarly");
$("graphs").innerHTML = `<tr><th>${tt("ds.th_name")}</th><th>${tt("ds.th_size")}</th><th>${tt("ds.th_graph")}</th><th>${tt("ds.th_lic")}</th><th>${tt("ds.th_links")}</th></tr>` +
  G.map(x => `<tr><td><b lang="en" dir="ltr">${esc(x.name)}</b>${sub(x.use)}</td><td>${en(x.size)}</td><td>${en(x.graph_structure)}</td><td>${en(x.licence)}</td><td class="links">${links(x)}</td></tr>`).join("");

// full catalogue
const groups = [...new Set(L.map(x => x.group))];
let g = "";
$("gseg").innerHTML = `<button data-g="" aria-pressed="true">${tt("ds.all")}</button>` + groups.map(x => `<button data-g="${esc(x)}">${tt("ds.g." + x)}</button>`).join("");
$("all").innerHTML = `<tr><th>${tt("ds.th_name")}</th><th>${tt("ds.th_fit")}</th><th>${tt("ds.th_what")}</th><th>${tt("ds.th_use")}</th><th>${tt("ds.th_lic")}</th><th>${tt("ds.th_links")}</th></tr>` +
  L.map(x => `<tr data-r data-g="${esc(x.group)}" data-graph="${/^(yes|weak)/i.test(x.graph_structure || "") ? 1 : 0}"><td><b lang="en" dir="ltr">${esc(x.name)}</b> ${grp(x.group)}${sub(x.size)}${x.paper?.year ? sub(String(x.paper.year)) : ""}</td>
    <td>${fit(x.cs_ml_fit)}</td><td>${en(x.contains)}${sub(x.graph_structure ? t("ds.th_graph") + ": " + x.graph_structure : "")}</td><td>${en(x.use)}${x.caveats ? sub(x.caveats) : ""}</td>
    <td>${en(x.licence)}</td><td class="links">${links(x)}</td></tr>`).join("");
const rows = [...$("all").querySelectorAll("tr[data-r]")].map(tr => ({tr, text: tr.textContent.toLowerCase()}));
const draw = () => { const q = $("q").value.trim().toLowerCase(), go = $("graphonly").checked; let n = 0;
  for (const r of rows) { const s = (!g || r.tr.dataset.g === g) && (!go || r.tr.dataset.graph === "1") && (!q || r.text.includes(q)); r.tr.hidden = !s; n += s; }
  $("count").textContent = t("eco.showing", {a: n, b: rows.length}); };
for (const b of $("gseg").querySelectorAll("button")) b.onclick = () => { g = b.dataset.g; for (const o of $("gseg").querySelectorAll("button")) o.setAttribute("aria-pressed", o === b); draw(); };
$("q").oninput = $("graphonly").oninput = draw;
draw();

// which model, and why (benchmarks.json, vault note "Model Benchmarks - CS-ML QA and Text-to-Graph")
if ((D.data.datasets || []).includes("benchmarks.json")) {
  const B = await fetch("/thesis/data/benchmarks.json").then(r => r.json());
  $("bm-finding").innerHTML = `${en(B.finding)} <span class="faint">${tt("bm.asof", {d: B.as_of})}</span>`;
  const ext = (u, label) => `<a href="${esc(u)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(label)}</a>`;
  const M = B.models, W = 860, rh = 30, top = 10, left = 190, right = 120, H = top + M.length * rh + 26;
  const x = v => left + (W - left - right) * (v - 60) / 40;  // axis 60–100
  $("bm-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tt("bm.scores_h")}">` +
    [60, 70, 80, 90, 100].map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H - 22}" stroke="#242B38"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle">${v}</text>`).join("") +
    M.map((m, i) => { const y = top + i * rh;
      return `<a href="${esc(m.url || "")}" target="_blank" rel="noopener"><text class="lbl" x="${left - 10}" y="${y + 17}" text-anchor="end">${esc(m.model)}</text></a>
        <rect x="${x(60)}" y="${y + 4}" width="${x(m.mmlu_pro) - x(60)}" height="10" rx="3" fill="var(--he)"><title>MMLU-Pro ${m.mmlu_pro}${m.caveat ? " (" + esc(m.caveat) + ")" : ""}</title></rect>
        ${m.gpqa != null ? `<rect x="${x(60)}" y="${y + 15}" width="${x(m.gpqa) - x(60)}" height="8" rx="3" fill="var(--k12)"><title>GPQA Diamond ${m.gpqa}</title></rect>` : ""}
        <text x="${x(m.mmlu_pro) + 6}" y="${y + 13}">${m.mmlu_pro}</text>
        <text x="${W - right + 10}" y="${y + 17}">$${m.price[0]} / $${m.price[1]}</text>`; }).join("") + `</svg>`;
  $("bm-roles").innerHTML = `<tr><th>${tt("bm.th_role")}</th><th>${tt("bm.th_pick")}</th><th>${tt("bm.th_why")}</th></tr>` +
    B.roles.map(r => `<tr><td><b lang="en" dir="ltr">${esc(r.role)}</b></td><td lang="en" dir="ltr">${esc(r.pick).replace(/[a-z0-9][a-z0-9.-]*[a-z0-9]/g, w => { const m = M.find(m => m.model === w); return m ? ext(m.url, w) : w; })}</td><td>${en(r.why)}</td></tr>`).join("");
  $("bm-graph").innerHTML = B.graph_evidence.map(e => `<li>${en(e.finding)}<span lang="en" dir="ltr">${e.url ? ext(e.url, e.source) : esc(e.source)} · ${esc(e.caveat)}</span></li>`).join("");
  const bl = b => typeof b === "string" ? `<li>${en(b)}</li>` : `<li>${en(b.name)}<span class="links">${b.links.map(([k, u]) => ext(u, k)).join("")}</span></li>`;
  $("bm-qa").innerHTML = B.qa_benchmarks.map(bl).join("");
  $("bm-kg").innerHTML = B.graph_benchmarks.map(bl).join("");
} else { $("models").hidden = true; }

// lecture videos + course platforms (course_videos.json, course_platforms.json; vault notes
// "Course Videos as Tutor Data - Inventory and Pipeline", "Course Platforms - Free vs Paywalled ML Courses")
const has = f => (D.data.datasets || []).includes(f);
if (has("course_videos.json")) {
  const V = await fetch("/thesis/data/course_videos.json").then(r => r.json());
  const P = has("course_platforms.json") ? await fetch("/thesis/data/course_platforms.json").then(r => r.json()) : [];
  const a = (u, k) => /^https?:\/\//.test(u || "") ? `<a href="${esc(u)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(k)}</a>` : "";
  const lang = s => /^fa/.test(s || "") ? "fa" : /^en/.test(s || "") ? "en" : "other";
  const R = [
    ...V.map(x => ({name: x.course, by: [x.university, x.year].filter(Boolean).join(", "), kind: x.kind || "university", country: x.country || "?", lang: lang(x.language),
      access: x.access, h: typeof x.hours === "number" && x.playlist_url ? x.hours : 0,
      size: x.lectures != null ? `${x.lectures} / ${x.hours} h` : "–", caps: x.captions, fit: x.syllabus_overlap || "", high: /^high/.test(x.syllabus_overlap || ""),
      links: a(x.playlist_url, "playlist") + a(x.official_url, "course page") + a(x.slides_url, "slides")})),
    ...P.map(x => ({name: x.course, by: x.platform + (x.provider && x.provider !== x.platform ? ", " + x.provider : ""), kind: x.kind, country: x.country || "?", lang: lang(x.language),
      access: x.access, h: 0, size: x.hours || "–", caps: x.captions, fit: [x.level, x.price].filter(Boolean).join(" · "), high: false,
      links: a(x.url, "course") + a(x.terms_url, "terms")})),
  ];
  const opts = (id, key, label) => { const vs = [...new Set(R.map(r => r[key]))].sort();
    $(id).innerHTML = `<option value="">${tt(label)}</option>` + vs.map(v => `<option value="${esc(v)}">${key === "kind" || key === "access" || key === "lang" ? tt("cv." + key + "." + v) : esc(v)}</option>`).join(""); };
  opts("cv-kind", "kind", "cv.f_kind"); opts("cv-access", "access", "cv.f_access"); opts("cv-lang", "lang", "cv.f_lang"); opts("cv-country", "country", "cv.f_country");
  $("cv").innerHTML = `<tr><th>${tt("cv.th_course")}</th><th>${tt("cv.f_access")}</th><th>${tt("cv.th_size")}</th><th>${tt("cv.th_caps")}</th><th>${tt("cv.th_fit")}</th><th>${tt("ds.th_links")}</th></tr>` +
    R.map((r, i) => `<tr data-i="${i}"><td><b lang="en" dir="ltr">${esc(r.name)}</b>${sub(r.by)}<span class="sub">${tt("cv.kind." + r.kind)} · ${esc(r.country)}</span></td>
      <td><span class="acc ${esc(r.access)}">${tt("cv.access." + r.access)}</span></td><td lang="en" dir="ltr">${esc(r.size)}</td><td>${en(r.caps)}</td><td>${en(r.fit)}</td><td class="links">${r.links}</td></tr>`).join("");
  const trs = [...$("cv").querySelectorAll("tr[data-i]")].map(tr => ({tr, r: R[tr.dataset.i], text: tr.textContent.toLowerCase()}));
  const cvdraw = () => { const f = {kind: $("cv-kind").value, access: $("cv-access").value, lang: $("cv-lang").value, country: $("cv-country").value},
      q = $("cv-q").value.trim().toLowerCase(), hi = $("cv-fit").checked; let n = 0, h = 0;
    for (const {tr, r, text} of trs) { const s = Object.entries(f).every(([k, v]) => !v || r[k] === v) && (!hi || r.high) && (!q || text.includes(q));
      tr.hidden = !s; if (s) { n++; h += r.h; } }
    $("cv-count").textContent = t("cv.count", {a: n, b: trs.length, h: Math.round(h).toLocaleString()}); };
  for (const id of ["cv-kind", "cv-access", "cv-lang", "cv-country", "cv-q", "cv-fit"]) $(id).oninput = cvdraw;
  cvdraw();
} else { $("videos").hidden = true; }
})();
