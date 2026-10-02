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
})();
