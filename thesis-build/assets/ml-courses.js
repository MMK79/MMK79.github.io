// ML courses study page — reads the universities project export (pipeline, textbooks, universities, courses, materials, quality).
(async () => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const href = u => /^https?:\/\//.test(u || "") ? esc(u) : "#";
// names (universities, courses, books, files) stay in English and keep Latin digits ("en" = lang="en" dir="ltr");
// the UI around them and the pipeline / caveat text come from i18n (D.ml_fa = i18n/fa/ml-courses.json)
const I = I18N, FA = I.fa ? (D.ml_fa || {}) : {}, N = x => x.toLocaleString("en");
const en = s => `<span lang="en" dir="ltr">${esc(s)}</span>`;
const tt = (k, o) => esc(t(k, o));
const country = c => I.fa ? (FA.countries?.[c] || c) : c;
const kind = x => t("ml.kind." + x) === "ml.kind." + x ? x : t("ml.kind." + x);
if (!D.data.ml_courses.includes("pipeline.json")) { $("answer").textContent = t("ml.nodata"); return; }
const get = f => fetch(`/thesis/data/ml_courses/${f}.json`).then(r => r.json());
const [P, U, T, C, M, Q] = await Promise.all(["pipeline", "universities", "textbooks", "courses", "materials", "quality"].map(get));

// headline answer
const books = T.items.filter(b => b.universities > 0).sort((a, b) => b.universities - a.universities);
const nU = U.items.length;
$("answer").innerHTML = t("ml.answer", {n: nU, c: new Set(U.items.map(u => u.country)).size, b1: `<i>${en(books[0].title)}</i>`, n1: books[0].universities, b2: `<i>${en(books[1].title)}</i>`, n2: books[1].universities, b3: `<i>${en(books[2].title)}</i>`, n3: books[2].universities});

// pipeline
const mx = Math.max(...P.stages.map(s => s.count));
$("steps").innerHTML = P.stages.map((s, i) => `<li><span class="k">${i + 1}</span><div><b>${I.tx(s.label, FA.stages?.[s.id]?.label)}</b></div><div class="w">${I.tx(s.what, FA.stages?.[s.id]?.what)}</div><div><span class="bar" style="display:block;width:${Math.max(3, 100 * Math.log10(s.count + 1) / Math.log10(mx + 1))}%"></span></div><span class="c">${N(s.count)}</span></li>`).join("");

// books
const bmx = books[0].universities;
$("books").innerHTML = books.map(b => { const req = b.by_role?.textbook?.universities || 0;
  return `<div class="book" data-s="${esc(b.slug)}" tabindex="0" role="button" aria-expanded="false"><div class="t"><span lang="en" dir="ltr" style="display:inline;font-size:inherit;color:inherit">${esc(b.title)}</span><span><span lang="en" dir="ltr" style="display:inline;font-size:inherit;color:inherit">${esc(b.authors)}${b.year ? ", " + b.year : ""}</span>${b.free_url ? ` · <a href="${href(b.free_url)}" target="_blank" rel="noopener">${tt("ml.free")}</a>` : ""}</span></div>
    <div class="b" style="width:${100 * b.universities / bmx}%;--req:${100 * req / b.universities}%" title="${tt("ml.bar_t", {r: req, n: b.universities})}"></div><div class="n">${b.universities}</div></div>`; }).join("");
const toggle = el => { const open = el.classList.toggle("open"); el.setAttribute("aria-expanded", open);
  const nx = el.nextElementSibling; if (nx && nx.classList.contains("uses")) { nx.remove(); return; }
  const b = books.find(x => x.slug === el.dataset.s);
  el.insertAdjacentHTML("afterend", `<div class="uses">${(b.used_by || []).map(u => `<a href="${href(u.url)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(u.university)} ${esc(u.course)}${u.term ? " (" + esc(u.term) + ")" : ""}</a> <span class="tag">${tt("ml.role." + u.role)}</span>`).join(" · ")}</div>`); };
$("books").onclick = e => { const el = e.target.closest(".book"); if (el && !e.target.closest("a")) toggle(el); };
$("books").onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("book")) { e.preventDefault(); toggle(e.target); } };

// countries
const byC = {}; for (const u of U.items) { const c = byC[u.country] ||= {n: 0, ml: 0, tb: 0, off: 0}; c.n++; c.ml += u.ml_course_found; c.tb += u.textbook_extracted; c.off += u.n_offerings || 0; }
$("countries").innerHTML = `<tr><th>${tt("ml.th_country")}</th><th class="n">${tt("ml.th_unis")}</th><th class="n">${tt("ml.th_mlfound")}</th><th class="n">${tt("ml.th_tbfound")}</th><th class="n">${tt("ml.th_off")}</th></tr>` +
  Object.entries(byC).sort((a, b) => b[1].n - a[1].n).map(([k, c]) => `<tr><td>${esc(country(k))}</td><td class="n">${c.n}</td><td class="n">${c.ml}</td><td class="n">${c.tb}</td><td class="n">${c.off}</td></tr>`).join("");

// materials
const mats = M.items, ok = mats.filter(m => m.download_status === "ok");
const seen = new Set(), gb = ok.reduce((s, m) => seen.has(m.local_path) ? s : (seen.add(m.local_path), s + (m.bytes || 0)), 0) / 1e9;
const reasons = {}; for (const m of mats) if (m.download_status && m.download_status !== "ok") reasons[m.download_status] = (reasons[m.download_status] || 0) + 1;
$("mat-lede").innerHTML = t("ml.mat_lede", {n: N(mats.length), f: new Set(ok.map(m => m.local_path)).size, l: ok.length, gb: gb.toFixed(2),
  why: Object.entries(reasons).map(([k, v]) => `${v} ${esc(t("ml.why." + k))}`).join(t("ml.comma"))});
const types = [...new Set(mats.map(m => m.type))].sort(), unis = [...new Set(mats.map(m => m.university))].sort();
$("mt").innerHTML = `<option value="">${tt("ml.all_types")}</option>` + types.map(x => `<option value="${esc(x)}">${esc(kind(x))}</option>`).join("");
$("mu").innerHTML = `<option value="">${tt("ml.all_unis")}</option>` + unis.map(x => `<option value="${esc(x)}" lang="en">${esc(x)}</option>`).join("");
function drawMats() {
  const q = $("q").value.toLowerCase(), ty = $("mt").value, u = $("mu").value, dl = $("dlonly").checked;
  const rows = mats.filter(m => (!dl || m.download_status === "ok") && (!ty || m.type === ty) && (!u || m.university === u) &&
    (!q || `${m.university} ${m.course} ${m.course_title} ${m.title} ${m.local_path}`.toLowerCase().includes(q)));
  $("mcount").textContent = t("ml.showing", {a: N(rows.length), b: N(mats.length)});
  $("mats").innerHTML = `<tr><th>${tt("ml.th_uni")}</th><th>${tt("ml.th_course")}</th><th>${tt("ml.type")}</th><th>${tt("ml.th_file")}</th><th class="n">${tt("ml.th_size")}</th></tr>` + rows.slice(0, 600).map(m => {
    const name = m.local_path ? m.local_path.split("/").pop() : (m.title || m.url);
    const link = m.local_path && !window.SITE_PUBLIC ? `/thesis/materials/${m.local_path.split("/").map(encodeURIComponent).join("/")}` : href(m.url);
    return `<tr><td lang="en" dir="ltr">${esc(m.university)}</td><td><span lang="en" dir="ltr">${esc(m.course)}<br><span class="faint" style="font-size:12.5px">${esc(m.course_title)}</span></span></td><td><span class="tag">${esc(kind(m.type))}</span></td><td><a href="${link}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(String(name).slice(0, 70))}</a>${m.local_path && !window.SITE_PUBLIC ? "" : ` <span class="faint">${tt("ml.online")}</span>`}</td><td class="n">${m.bytes ? tt("ml.mb", {v: (m.bytes / 1e6).toFixed(1)}) : ""}</td></tr>`; }).join("") +
    (rows.length > 600 ? `<tr><td colspan="5" class="faint">${tt("ml.first600")}</td></tr>` : "");
}
for (const id of ["q", "mt", "mu", "dlonly"]) $(id).oninput = drawMats;
drawMats();

// courses
function drawCourses() {
  const q = $("cq").value.toLowerCase();
  const rows = C.items.filter(c => !q || `${c.university} ${c.country} ${c.code} ${c.title} ${(c.books || []).join(" ")}`.toLowerCase().includes(q));
  $("ccount").textContent = t("ml.showing_off", {a: rows.length, b: C.items.length});
  $("courses").innerHTML = `<tr><th>${tt("ml.th_uni")}</th><th>${tt("ml.th_course")}</th><th>${tt("ml.th_level")}</th><th>${tt("ml.th_term")}</th><th>${tt("ml.th_books")}</th></tr>` + rows.map(c => `<tr><td><span lang="en" dir="ltr">${esc(c.university)}</span><br><span class="faint" style="font-size:12.5px">${esc(country(c.country))}</span></td><td lang="en" dir="ltr"><a href="${href(c.url)}" target="_blank" rel="noopener">${esc(c.code)}</a> ${esc(c.title)}</td><td><span class="tag">${tt("ml.topic." + c.topic)}</span> <span class="tag">${tt("ml.level." + (c.level || "unknown"))}</span></td><td lang="en" dir="ltr">${esc(c.term || "")}</td><td style="font-size:13px"><span lang="en" dir="ltr">${(c.books || []).map(b => esc(typeof b === "string" ? b : b.title || b.slug)).join("; ")}</span>${c.unmatched_citations ? ` <span class="faint">${tt("ml.unmatched", {n: c.unmatched_citations})}</span>` : ""}</td></tr>`).join("");
}
$("cq").oninput = drawCourses; drawCourses();

// quality
$("qual").innerHTML = (Q.caveats || []).map(c => { const f = FA.caveats?.[c.claim] || {};
  return `<li><b>${I.tx(c.claim, f.claim)}</b> <span class="tag">${tt("ml.basis." + c.basis)}</span> ${I.tx(c.detail, f.detail)}</li>`; }).join("") + (Q.note ? `<li>${I.tx(Q.note, FA.note)}</li>` : "");
$("foot").textContent = t("ml.foot", {s: P.subset, d: String(P.generated_at || "").slice(0, 10)});
})();
