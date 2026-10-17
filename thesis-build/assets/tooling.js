// /tooling.html: the RAG and GraphRAG tooling landscape (139 tools, 17 categories). Data /data/tooling.json, written by site.py galleries()
// from the vault folder Presentations/RAG and GraphRAG Tooling Landscape - 2026-10-13 (landscape-resolved.json, logos/manifest.json).
// Licence kinds are exact (open-source | open-core | source-available | closed | commercial-hosted) with the licence note read from the
// LICENSE file or model card. Row text stays English (lang=en); UI strings are tg.* and gx.* keys.
(async () => {
const {T, esc, N, num, day, logo, en, ext, list, wire, opts} = window.GX, $ = id => document.getElementById(id), main = $("tg-main");
let DATA;
try { DATA = await fetch("/thesis/data/tooling.json").then(r => { if (!r.ok) throw 0; return r.json(); }); } catch (e) { main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`; return; }
const rows = DATA.rows, CATS = DATA.categories || [...new Set(rows.map(r => r.category))];
const LK = ["open-source", "open-core", "source-available", "closed", "commercial-hosted"], FT = ["core", "useful", "marginal", "no"], FM = ["good", "ok", "poor", "none"];
const k_ = s => String(s).replace(/-/g, "_");
$("legend").innerHTML = LK.map(k => `<div><span class="ex-tag gx-b l-${k}">${esc(T("tg.lk_" + k_(k)))}</span> ${esc(T("tg.lkd_" + k_(k)))}</div>`).join("");
const feat = (r, f) => { const v = (r.features || {})[f]; return v && v !== "n/a" ? `<span class="ex-tag gx-b f-${esc(v)}" title="${esc(T("tg.ft_" + f + "_d"))}">${esc(T("tg.ft_" + f))}: ${esc(T("tg.fv_" + v))}</span>` : ""; };
const card = (r, i) => { const L = r.licence || {}, g = r.gh, h = r.hf, ft = r.fit_thesis || {}, fm = r.fit_mac8gb || {};
  const site = r.website, repo = r.repo ? "https://github.com/" + r.repo : null, hf = r.hf_model ? "https://huggingface.co/" + r.hf_model : null;
  return `<article class="gx-card" id="${esc(r.id)}" data-i="${i}">
  <div class="gx-head">${logo(r)}<div><h3 lang="en" dir="ltr">${(site || repo || hf) ? `<a href="${esc(site || repo || hf)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</h3>
    <div class="gx-tags"><span class="ex-tag gx-b l-${esc(r.licence_kind)}">${esc(T("tg.lk_" + k_(r.licence_kind)))}</span>
    ${r.status && r.status !== "active" ? `<span class="ex-tag gx-b st-${esc(r.status)}">${esc(T("tg.st_" + r.status))}</span>` : ""}
    <span class="ex-tag gx-b r-${esc(ft.rating)}" title="${esc(T("tg.f_thesis"))}">${esc(T("tg.fit_th", {r: T("tg.ft_r_" + ft.rating)}))}</span>
    <span class="ex-tag gx-b r-${esc(fm.rating)}" title="${esc(T("tg.f_mac"))}">${esc(T("tg.fit_mac", {r: T("tg.fm_r_" + fm.rating)}))}</span></div></div></div>
  ${en("p", esc(r.verdict || ""), "gx-what")}
  <div class="gx-lic">${esc(T("gx.licence"))}: <b lang="en" dir="ltr">${esc(L.spdx && L.spdx !== "NOASSERTION" ? L.spdx : T("tg.lic_see"))}</b>${L.note ? `<span class="gx-lnote" lang="en" dir="ltr">${esc(L.note)}</span>` : ""}${r.status_note ? `<span class="gx-lnote" lang="en" dir="ltr">${esc(r.status_note)}</span>` : ""}</div>
  <div class="gx-tags">${feat(r, "hybrid")}${feat(r, "filtering")}${feat(r, "graph")}</div>
  <div class="gx-stats">${g ? `<span>★ <b>${num(g.stars)}</b></span><span>${esc(T("tg.last_commit"))}: <b>${day(g.last_commit || g.pushed_at)}</b></span>` : ""}${h ? `<span>${esc(T("tg.hf_dl"))}: <b>${num(h.downloads)}</b></span><span>${esc(T("tg.hf_mod"))}: <b>${day(h.last_modified)}</b></span>` : ""}
    <span>${(r.deployment || []).map(d => esc(T("tg.dep_" + d))).join(" · ")}</span></div>
  <details><summary>${esc(T("gx.more"))}</summary><div class="gx-more">
    <div><h4>${esc(T("gx.h_strengths"))}</h4>${list(r.strengths) || "—"}</div>
    <div><h4>${esc(T("gx.h_limits"))}</h4>${list(r.limitations) || "—"}</div>
    <div><h4>${esc(T("tg.h_thesis"))}</h4>${en("p", esc(ft.why || ""))}</div>
    <div><h4>${esc(T("tg.h_mac"))}</h4>${en("p", esc(fm.why || ""))}</div>
    ${(r.sources || []).length ? `<div><h4>${esc(T("tg.h_sources"))}</h4><ul lang="en" dir="ltr">${r.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.what || s.url)}</a>${s.read ? "" : ` <span class="ex-tag">${esc(T("tg.not_read"))}</span>`}</li>`).join("")}</ul></div>` : ""}
    <p class="ex-src">${esc(T("tg.measured", {date: day((g && g.as_of) || (h && h.as_of) || DATA.as_of)}))}</p>
  </div></details>
  <div class="gx-links">${ext(repo, T("gx.repo"))}${ext(site, T("tg.site"))}${ext(hf, T("tg.hf_model"))}</div>
</article>`; };
const cats = CATS.filter(c => rows.some(r => r.category === c));
main.innerHTML = cats.map(c => `<section class="gx-sec" id="cat-${esc(c)}"><h2>${esc(T("tg.c_" + k_(c)))} <small></small></h2><p class="gx-sd">${esc(T("tg.cd_" + k_(c)))}</p>
  <div class="gx-grid">${rows.map((r, i) => r.category === c ? card(r, i) : "").join("")}</div></section>`).join("") +
  `<p class="ex-none" id="none" hidden>${esc(T("gx.none"))}</p><p class="gx-tm">${esc(T("gx.trademark"))}</p>`;
opts($("f-cat"), cats, c => T("tg.c_" + k_(c))); opts($("f-lic"), LK.filter(k => rows.some(r => r.licence_kind === k)), k => T("tg.lk_" + k_(k)));
opts($("f-th"), FT, v => T("tg.ft_r_" + v)); opts($("f-mac"), FM, v => T("tg.fm_r_" + v));
const cards = rows.map(r => document.getElementById(r.id));
const text = rows.map(r => [r.name, r.repo, r.verdict, (r.strengths || []).join(" "), (r.limitations || []).join(" "), r.licence_kind, (r.licence || {}).spdx, (r.licence || {}).note, r.category, (r.fit_thesis || {}).why].join(" ").toLowerCase());
const star = r => (r.gh && r.gh.stars) || (r.hf && r.hf.likes) || -1, cd = r => (r.gh && (r.gh.last_commit || r.gh.pushed_at)) || (r.hf && r.hf.last_modified) || "";
wire({rows, cards, text, q: $("q"), sort: $("sort"), count: $("cnt"), none: $("none"), sections: [...main.querySelectorAll("section.gx-sec")],
  inputs: ["q", "f-cat", "f-lic", "f-th", "f-mac", "f-os", "sort"].map($),
  match: r => (!$("f-cat").value || r.category === $("f-cat").value) && (!$("f-lic").value || r.licence_kind === $("f-lic").value) && (!$("f-th").value || (r.fit_thesis || {}).rating === $("f-th").value)
    && (!$("f-mac").value || (r.fit_mac8gb || {}).rating === $("f-mac").value) && (!$("f-os").checked || r.licence_kind === "open-source"),
  cmp: k => k === "stars" ? (a, b) => star(b) - star(a) : k === "commit" ? (a, b) => String(cd(b)).localeCompare(String(cd(a))) : k === "name" ? (a, b) => a.name.localeCompare(b.name)
    : (a, b) => (FT.indexOf((a.fit_thesis || {}).rating) - FT.indexOf((b.fit_thesis || {}).rating)) || star(b) - star(a)});
})();
