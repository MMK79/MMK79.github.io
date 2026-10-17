// Sources page: the origin paper behind every metric, algorithm, method and architecture component (/data/provenance.json, built by site.py
// from the vault's Presentations/_provenance). Table sorting and the column picker come from layout.js. Paper titles and author names stay as published.
(async () => {
const $ = id => document.getElementById(id), t = window.t, I = window.I18N, esc = I.esc, nf = x => I.fa ? I.digits(String(x)) : String(x);
let P = {items: {}};
try { P = await fetch("/thesis/data/provenance.json").then(r => r.json()); } catch (e) {}
const rows = Object.entries(P.items).map(([key, r]) => ({key, ...r}));
const tb = $("src").tBodies[0], ST = ["evidenced", "textbook-only", "inferred", "unverified"], KD = ["metric", "algorithm", "method", "component", "topic", "project"];
const short = a => { const n = (a || []).map(x => String(x).split(",")[0]); return n.length > 2 ? n[0] + " et al." : n.join(" & "); };
const link = (u, k) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(k)}</a>` : "";
const links = p => !p ? "" : link(p.doi && "https://doi.org/" + p.doi, "DOI") + link(p.arxiv && "https://arxiv.org/abs/" + String(p.arxiv).replace(/^arxiv:/i, ""), "arXiv") + (!p.doi && !p.arxiv ? link(p.url, "link") : "");
const cites = c => c && c.value != null ? `${nf(c.value.toLocaleString("en"))}<span class="sub" lang="en" dir="ltr">${esc(c.source)}, ${esc(c.date)}</span>` : "—";
window.PROV_LINKS = links;
tb.innerHTML = rows.map((r, i) => { const p = r.introduced_by || null, nm = I.fa && r.name_fa ? r.name_fa : r.name;
  return `<tr data-i="${i}"><td data-sort="${esc(nm)}"><a href="${esc(r.href)}">${esc(nm)}</a><span class="kind">${esc(t("so.kind_" + r.kind))}</span></td>
  <td lang="en" dir="ltr">${p ? `${esc(short(p.authors))}, <i>${esc(p.title)}</i>${p.venue ? ` · ${esc(p.venue)}` : ""}${p.why ? `<span class="why">${esc(p.why)}</span>` : ""}` : `<span class="sub">${esc(t("so.no_origin"))}</span>${r.notes ? `<span class="why">${esc(r.notes)}</span>` : ""}`}</td>
  <td class="num" data-sort="${p ? p.year : 0}">${p ? nf(p.year) : "—"}</td><td class="num" data-sort="${p && p.citations ? p.citations.value : -1}">${cites(p && p.citations)}</td>
  <td data-sort="${ST.indexOf(r.status)}"><span class="badge ${esc(r.status)}">${esc(t("so.status_" + r.status))}</span></td><td class="links">${links(p)}</td></tr>`; }).join("");
$("f-status").innerHTML = `<option value="">${esc(t("so.all"))}</option>` + ST.map(s => `<option value="${s}">${esc(t("so.status_" + s))}</option>`).join("");
$("f-kind").innerHTML = `<option value="">${esc(t("so.all"))}</option>` + KD.map(s => `<option value="${s}">${esc(t("so.kind_" + s))}</option>`).join("");
const text = rows.map(r => [r.name, r.name_fa, r.key, r.status, (r.introduced_by || {}).title, ((r.introduced_by || {}).authors || []).join(" "), (r.introduced_by || {}).year, r.notes].join(" ").toLowerCase());
function apply() {
  const q = $("q").value.trim().toLowerCase(), s = $("f-status").value, k = $("f-kind").value, inf = $("f-inf").checked; let n = 0;
  for (const tr of tb.rows) { const r = rows[+tr.dataset.i]; const ok = (!q || text[+tr.dataset.i].includes(q)) && (!s || r.status === s) && (!k || r.kind === k) && (!inf || r.status === "inferred" || r.status === "unverified");
    tr.classList.toggle("so-off", !ok); n += ok; }
  $("cnt").textContent = t("so.count", {n: nf(n), total: nf(rows.length)}); $("none").hidden = n > 0;
}
["q", "f-status", "f-kind", "f-inf"].forEach(id => $(id).addEventListener(id === "q" ? "input" : "change", apply));
apply();
if (!window.HX) await new Promise(r => addEventListener("load", r));
$("src").setAttribute("data-hx-table", ""); HX.initTable($("src"));
})();
