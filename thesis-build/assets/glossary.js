// Glossary page: every term of i18n/fa/glossary.json (D.glossary = [{en, fa, src, alt, note}]), searchable; sorting and the
// column picker come from layout.js (data-hx-table). Persian and English cells keep their own direction in both UIs.
(async () => {
const $ = id => document.getElementById(id), t = window.t, I = window.I18N, G = D.glossary || [];
const esc = I.esc, nf = x => I.fa ? I.digits(String(x)) : String(x);
const tb = $("terms").tBodies[0];
tb.innerHTML = G.map((g, i) => `<tr data-i="${i}"><td class="fa" lang="fa" dir="rtl" data-sort="${esc(g.fa)}">${esc(g.fa)}</td>
  <td class="en" lang="en" dir="ltr">${esc(g.en)}</td><td class="src" lang="en" dir="ltr">${esc(g.src)}</td>
  <td class="note" lang="en" dir="ltr">${esc(g.note)}</td><td class="alt" lang="fa" dir="rtl">${esc(g.alt)}</td></tr>`).join("");
$("legend").innerHTML = ["P", "T", "F", "G", "W", "S", "J"].map(c => `<span><b lang="en">${c}</b> ${esc(t("gl.src_" + c))}</span>`).join("");
const text = G.map(g => (g.en + " " + g.fa + " " + g.src + " " + g.note + " " + g.alt).toLowerCase());
function apply() {
  const q = $("q").value.trim().toLowerCase(); let n = 0;
  for (const tr of tb.rows) { const ok = !q || text[+tr.dataset.i].includes(q); tr.classList.toggle("gl-off", !ok); n += ok; }
  $("cnt").textContent = t("gl.count", {n: nf(n), total: nf(G.length)}); $("none").hidden = n > 0;
}
$("q").addEventListener("input", apply);
apply();
if (!window.HX) await new Promise(r => addEventListener("load", r));   // layout.js is loaded after this script
$("terms").setAttribute("data-hx-table", ""); HX.initTable($("terms"));
})();
