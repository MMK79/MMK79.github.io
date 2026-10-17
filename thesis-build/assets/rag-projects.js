// /rag-projects.html: what people build with RAG and GraphRAG (60 projects, 6 families). Data /data/rag-projects.json, written by site.py
// galleries() from the vault folder Presentations/RAG and GraphRAG Projects - 2026-10-13 (projects.json, radar.json, logos/manifest.json).
// Row text stays English (lang=en); UI strings are rp.* and gx.* keys. Deep link #<project id> shows and highlights the card.
(async () => {
const {T, esc, N, num, day, logo, en, ext, list, wire, opts} = window.GX, $ = id => document.getElementById(id), main = $("rp-main");
let DATA;
try { DATA = await fetch("/thesis/data/rag-projects.json").then(r => { if (!r.ok) throw 0; return r.json(); }); } catch (e) { main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`; return; }
const FAM = ["graphrag", "retriever", "framework", "app", "education", "eval"], VER = ["baseline", "copy ideas", "ignore"];
const rows = DATA.projects, vk = v => v.replace(" ideas", "");
const lic = g => !g ? "—" : g.license && g.license !== "NOASSERTION" ? g.license : T(g.license ? "rp.lic_file" : "rp.lic_none");
const paper = (p, extra) => !p ? "" : `<p class="gx-paper"${extra ? ' data-extra="1"' : ""}>${extra ? esc(T("rp.also_paper")) + " " : ""}<a href="${esc(p.url)}" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(p.title)}</a>
  <span lang="en" dir="ltr">(${esc(p.first_author || "")}${p.n_authors > 1 ? " et al." : ""}, ${esc(p.year)})</span> ·
  ${p.citations != null ? esc(T("rp.cites", {n: num(p.citations), src: p.citations_source || "Semantic Scholar", date: day(p.citations_date)})) : esc(T("rp.cites_none"))}</p>`;
const card = (r, i) => { const g = r.github, p = r.paper;
  return `<article class="gx-card" id="${esc(r.id)}" data-i="${i}">
  <div class="gx-head">${logo(r)}<div><h3 lang="en" dir="ltr">${r.repo ? `<a href="${esc(r.repo)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</h3>
    <div class="gx-tags"><span class="ex-tag gx-b v-${esc(vk(r.verdict))}">${esc(T("rp.v_" + vk(r.verdict)))}</span>
    <span class="ex-tag">${esc(T("rp.fam_" + r.family))}</span>${r.cloned ? `<span class="ex-tag">${esc(T("rp.cloned"))}</span>` : ""}${g && g.archived ? `<span class="ex-tag gx-b st-archived">${esc(T("gx.archived"))}</span>` : ""}</div></div></div>
  ${en("p", esc(r.what || ""), "gx-what")}
  <div class="gx-stats">${g ? `<span>★ <b>${num(g.stars)}</b></span><span>${esc(T("gx.licence"))}: <b lang="en">${esc(lic(g))}</b></span><span>${esc(T("rp.last_push"))}: <b>${day(g.last_push)}</b></span>${g.language ? `<span lang="en">${esc(g.language)}</span>` : ""}` : `<span>${esc(T("rp.no_repo"))}</span>`}</div>
  ${p ? paper(p) : `<p class="gx-paper">${esc(T("rp.no_paper"))}</p>`}${(r.extra_papers || []).map(x => paper(x, true)).join("")}
  <details><summary>${esc(T("gx.more"))}</summary><div class="gx-more">
    <div><h4>${esc(T("rp.h_reuse"))}</h4><p>${esc(T("rp.reuse_" + vk(r.verdict)))}</p></div>
    <div><h4>${esc(T("gx.h_strengths"))}</h4>${en("p", esc(r.strengths || "—"))}</div>
    <div><h4>${esc(T("gx.h_limits"))}</h4>${en("p", esc(r.limits || "—"))}</div>
    ${r.graph_build ? `<div><h4>${esc(T("rp.h_graph"))}</h4>${en("p", esc(r.graph_build))}</div>` : ""}
    ${(r.retrieval || []).length ? `<div><h4>${esc(T("rp.h_retrieval"))}</h4>${list(r.retrieval)}</div>` : ""}
    ${r.requirements ? `<div><h4>${esc(T("rp.h_req"))}</h4>${en("p", esc(r.requirements))}</div>` : ""}
    <div><h4>${esc(T("gx.h_evidence"))}</h4>${en("p", esc(r.evidence || "—"))}<p class="ex-src">${esc(T("rp.measured", {date: day(g && g.measured)}))}</p></div>
  </div></details>
  <div class="gx-links">${ext(r.repo, T("gx.repo"))}${p ? ext(p.url, T("rp.paper")) : ""}${p && p.hf_papers && p.hf_papers.listed ? ext("https://huggingface.co/papers/" + p.arxiv, T("rp.hf")) : ""}${p ? `<a href="/thesis/sources.html">${esc(T("rp.in_sources"))}</a>` : ""}</div>
</article>`; };
const R = DATA.radar;
const radar = !R ? "" : `<section class="gx-sec" id="radar"><h2>${esc(T("rp.radar_h"))}</h2><p class="gx-sd">${esc(T("rp.radar_p", {date: day(R.checked)}))}</p>
  <div class="gx-radar">${R.sources.map(s => `<div id="radar-${esc(s.id)}"><h3 lang="en" dir="ltr"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></h3><dl>
    <dt>${esc(T("rp.r_offers"))}</dt><dd lang="en" dir="ltr">${esc(s.offers)}</dd><dt>${esc(T("rp.r_api"))}</dt><dd lang="en" dir="ltr">${esc(s.api)}</dd>
    ${s.vs_old ? `<dt>${esc(T("rp.r_vs"))}</dt><dd lang="en" dir="ltr">${esc(s.vs_old)}</dd>` : ""}${s.not_read ? `<dt>${esc(T("rp.r_notread"))}</dt><dd class="gx-nr" lang="en" dir="ltr">${esc(s.not_read)}</dd>` : ""}</dl>
    <details><summary>${esc(T("gx.more"))}</summary><dl><dt>${esc(T("rp.r_use"))}</dt><dd lang="en" dir="ltr">${esc(s.use)}</dd>
    <dt>${esc(T("gx.h_evidence"))}</dt><dd lang="en" dir="ltr">${esc(s.evidence)}</dd></dl></details></div>`).join("")}</div></section>`;
const fams = FAM.filter(f => rows.some(r => r.family === f));
main.innerHTML = radar + fams.map(f => `<section class="gx-sec" id="fam-${f}"><h2>${esc(T("rp.fam_" + f))} <small></small></h2><p class="gx-sd">${esc(T("rp.famd_" + f))}</p>
  <div class="gx-grid">${rows.map((r, i) => r.family === f ? card(r, i) : "").join("")}</div></section>`).join("") +
  `<p class="ex-none" id="none" hidden>${esc(T("gx.none"))}</p><p class="gx-tm">${esc(T("gx.trademark"))}</p>`;
opts($("f-fam"), fams, f => T("rp.fam_" + f)); opts($("f-ver"), VER, v => T("rp.v_" + vk(v)));
const cards = rows.map(r => document.getElementById(r.id));
const text = rows.map(r => [r.name, r.what, r.strengths, r.limits, r.graph_build, (r.retrieval || []).join(" "), r.paper && r.paper.title, r.paper && r.paper.first_author, r.verdict, r.family].join(" ").toLowerCase());
const cit = r => (r.paper && r.paper.citations) || -1, st = r => (r.github && r.github.stars) || -1;
wire({rows, cards, text, q: $("q"), sort: $("sort"), count: $("cnt"), none: $("none"), sections: [...main.querySelectorAll("section[id^=fam-]")],
  inputs: ["q", "f-fam", "f-ver", "f-paper", "f-clone", "sort"].map($),
  match: r => (!$("f-fam").value || r.family === $("f-fam").value) && (!$("f-ver").value || r.verdict === $("f-ver").value) && (!$("f-paper").checked || !!r.paper) && (!$("f-clone").checked || r.cloned),
  cmp: k => k === "stars" ? (a, b) => st(b) - st(a) : k === "cites" ? (a, b) => cit(b) - cit(a) : k === "push" ? (a, b) => String((b.github || {}).last_push || "").localeCompare(String((a.github || {}).last_push || ""))
    : k === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.rank - b.rank});
})();
