// Ecosystem page: who builds and funds AI for education. Reads the vault's ecosystem data
// (Presentations/AI in Education Ecosystem - 2026-10-01/data, copied to /data/ecosystem/ by site.py).
// Data text stays English (lang="en"); the UI around it comes from i18n. Iran is its own tab, never mixed in.
(async () => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tt = (k, o) => esc(t(k, o));
const en = s => s == null || s === "" ? "" : `<span lang="en" dir="ltr">${esc(s)}</span>`;
const sub = s => s ? `<span class="sub" lang="en" dir="ltr">${esc(s)}</span>` : "";
const has = (D.data.ecosystem || []).includes("investment.json");
if (!has) { $("p-money").innerHTML = `<p class="note-box">${tt("eco.nodata")}</p>`; return; }
if (I18N.fa) $("ennote").hidden = false;
const get = f => fetch(`/thesis/data/ecosystem/${f}.json`).then(r => r.json());
const names = ["investment", "products_he_cs", "products_market", "edtech", "lms", "ocw_moocs", "funders", "iran_ecosystem"];
const X = Object.fromEntries(await Promise.all(names.map(async n => [n, await get(n)])));

// a link is "live" when its recorded check saw a 200 (some sites answer bots with 403 but browsers with 200)
const ok = st => st == null || /200/.test(String(st));
const a = (url, label, st) => /^https?:\/\//.test(url || "") ? `<a href="${esc(url)}" target="_blank" rel="noopener" lang="en" dir="ltr"${ok(st) ? "" : ` class="blocked" title="${tt("eco.blocked")}"`}>${esc(label)}</a>` : "";
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
const basisOf = b => { b = String(b || "").toLowerCase();
  return /measur|filing|sec\b|8-k|disburs/.test(b) ? "measured" : /claim|vendor|company/.test(b) ? "claimed" : /estim|announc/.test(b) ? "announced" : ""; };
const badge = b => { const k = basisOf(b); return k ? `<span class="basis ${k}" title="${esc(b)}">${tt("eco.b_" + k)}</span>` : ""; };
const money = (usd, loc, cur) => usd ? "$" + (usd >= 1e9 ? (usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1) + "B" : usd >= 1e6 ? Math.round(usd / 1e6) + "M" : Math.round(usd / 1e3) + "K")
  : loc ? `${Number(loc).toLocaleString("en")} ${cur || ""}` : "—";

// ---- search + count, per active tab
let tab = "money";
const rowsOf = {}; // tab -> [{tr, text}]
function reg(tabId, tbody) { rowsOf[tabId] = [...(rowsOf[tabId] || []), ...[...tbody.querySelectorAll("tr[data-r]")].map(tr => ({tr, text: tr.textContent.toLowerCase()}))]; }
function filter() {
  const q = $("q").value.trim().toLowerCase(), rs = rowsOf[tab] || [];
  let n = 0; for (const r of rs) { const show = !q || r.text.includes(q); r.tr.hidden = !show; n += show; }
  $("count").textContent = t("eco.showing", {a: n, b: rs.length});
}
$("q").oninput = filter;

// ---- money: VC by year, commitments, rounds
const I = X.investment;
(() => {
  const v = I.vc_by_year.filter(r => r.usd_bn != null), W = 720, Hh = 230, pad = 34, bw = (W - pad * 2) / v.length;
  const mx = Math.max(...v.map(r => r.usd_bn));
  $("vc").setAttribute("dir", "ltr");
  $("vc").innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${tt("eco.vc_aria")}">` + v.map((r, i) => {
    const h = (Hh - 60) * r.usd_bn / mx, x = pad + i * bw + bw * .18, y = Hh - 28 - h;
    return `<a href="${esc(r.link)}" target="_blank" rel="noopener"><title>${esc(r.note || "")}</title><rect x="${x}" y="${y}" width="${bw * .64}" height="${h}" rx="4" fill="var(--ai)" opacity="${r.year === 2021 ? 1 : .7}"/>
      <text x="${x + bw * .32}" y="${y - 8}" text-anchor="middle">$${r.usd_bn}B</text><text x="${x + bw * .32}" y="${Hh - 9}" text-anchor="middle">${r.year}</text></a>`; }).join("") + `</svg>`;
  const types = [...new Set(I.commitments.map(c => c.type))].sort(), regs = [...new Set(I.commitments.map(c => c.region))].sort();
  $("ctype").innerHTML = `<option value="">${tt("eco.all_types")}</option>` + types.map(x => `<option value="${esc(x)}">${tt("eco.ty." + x)}</option>`).join("");
  $("creg").innerHTML = `<option value="">${tt("eco.all_regions")}</option>` + regs.map(x => `<option value="${esc(x)}" lang="en">${esc(x)}</option>`).join("");
  const head = `<tr><th>${tt("eco.th_who")}</th><th>${tt("eco.th_funds")}</th><th class="n">${tt("eco.th_amount")}</th><th>${tt("eco.th_when")}</th><th>${tt("eco.th_links")}</th></tr>`;
  const row = (c, who) => `<tr data-r data-type="${esc(c.type)}" data-reg="${esc(c.region)}"><td><b lang="en" dir="ltr">${esc(who)}</b>${sub(`${c.country} · ${c.region}`)}<span class="sub">${tt("eco.ty." + c.type)}${c.in_kind ? " · " + tt("eco.inkind") : ""}</span></td>
    <td>${en(c.funds)}${c.note ? sub(c.note) : ""}</td><td class="n">${money(c.amount_usd, c.amount_local, c.currency)}${c.period ? sub(c.period) : ""}</td>
    <td class="n">${en(c.announced)} ${badge(c.basis)}</td><td class="links">${a(c.link, host(c.link), c.link_status)}${a(c.link2, host(c.link2), c.link2_status)}</td></tr>`;
  $("com").innerHTML = head + I.commitments.map(c => row(c, c.funder)).join("");
  $("rounds").innerHTML = head + I.rounds.map(c => row(c, `${c.company} — ${c.round || ""}`)).join("");
  const cf = () => { const ty = $("ctype").value, rg = $("creg").value;
    for (const tr of $("com").querySelectorAll("tr[data-r]")) tr.style.display = (!ty || tr.dataset.type === ty) && (!rg || tr.dataset.reg === rg) ? "" : "none"; };
  $("ctype").oninput = $("creg").oninput = cf;
  reg("money", $("com")); reg("money", $("rounds"));
})();

// ---- higher education & CS products, grouped
(() => {
  const groups = [...new Set(X.products_he_cs.map(p => p.group))].sort();
  $("he").innerHTML = groups.map(g => `<h3>${tt("eco.g." + g)}</h3><div class="xscroll"><table id="he-${g}"><tr><th>${tt("eco.th_product")}</th><th>${tt("eco.th_ai")}</th><th>${tt("eco.th_where")}</th><th>${tt("eco.th_evidence")}</th><th>${tt("eco.th_links")}</th></tr>` +
    X.products_he_cs.filter(p => p.group === g).map(p => {
      const L = p.links || {}, S = p.link_status || {}, sc = p.scale && typeof p.scale === "object" ? p.scale : null, ev = p.evidence || {};
      const where = (p.used_where || []).map(w => typeof w === "string" ? en(w) : a(w.url, w.name) || en(w.name)).join("<br>");
      const links = Object.entries(L).filter(([, u]) => typeof u === "string").map(([k, u]) => a(u, t("eco.l." + k) === "eco.l." + k ? k : t("eco.l." + k), S[u])).join("");
      return `<tr data-r><td><b lang="en" dir="ltr">${esc(p.name)}</b>${sub(p.maker)}<span class="sub">${esc(p.kind || "")}${p.launch ? " · " + esc(p.launch) : ""}</span></td>
        <td>${en(p.ai_does)}${p.student_price ? sub(p.student_price) : ""}</td>
        <td>${where}${sc ? `<span class="sub" lang="en" dir="ltr">${esc(sc.value)} (${esc(sc.as_of || "")})</span>${badge(sc.basis)}` : ""}</td>
        <td>${en(ev.summary)}${ev.independent != null ? `<span class="ind ${ev.independent === true || /^yes/i.test(ev.independent) ? "yes" : "no"}">${tt(ev.independent === true || /^yes/i.test(ev.independent) ? "eco.indep" : "eco.notindep")}</span>` : ""}${ev.link ? " " + a(ev.link, t("eco.study")) : ""}</td>
        <td class="links">${links}</td></tr>`; }).join("") + `</table></div>`).join("");
  for (const g of groups) reg("he", $("he-" + g));
})();

// ---- products sold to schools and learners
(() => {
  const P = X.products_market.products || X.products_market;
  $("schools").innerHTML = `<tr><th>${tt("eco.th_product")}</th><th>${tt("eco.th_ai")}</th><th>${tt("eco.th_price")}</th><th>${tt("eco.th_scale")}</th><th>${tt("eco.th_evidence")}</th><th>${tt("eco.th_links")}</th></tr>` +
    P.map(p => `<tr data-r><td><b lang="en" dir="ltr">${esc(p.name)}</b>${sub(p.maker)}${sub(`${p.segment || ""}${p.launch ? " · " + p.launch : ""}`)}</td><td>${en(p.what)}</td><td>${en(p.price)}</td>
      <td>${p.scale_claim ? `${en(p.scale_claim)}${sub(p.as_of)}<span class="basis claimed">${tt("eco.b_claimed")}</span>` : "—"}</td>
      <td>${en(p.evidence) || "—"} ${a(p.evidence_link, t("eco.study"), p.evidence_link_status)}</td><td class="links">${a(p.product_link, host(p.product_link), p.product_link_status)}</td></tr>`).join("");
  reg("schools", $("schools"));
})();

// ---- organisations (EdTech / LMS / OCW & MOOCs / funders) and Iran share one renderer
const orgRows = (L, iran) => `<tr><th>${tt("eco.th_org")}</th><th>${tt("eco.th_feat")}</th><th>${tt("eco.th_scale")}</th><th>${tt("eco.th_evidence")}</th><th>${tt("eco.th_links")}</th></tr>` + L.map(o => {
  const feats = (o.ai_features || []).map(f => `<li><b lang="en" dir="ltr">${esc(f.name)}</b>${f.launched ? ` <span class="faint num">${esc(f.launched)}</span>` : ""}${sub(f.what)}</li>`).join("");
  const integ = o.integration ? `<li>${Object.entries(o.integration).map(([k, v]) => `<span class="sub" lang="en" dir="ltr"><b>${esc(k.replace(/_/g, " "))}</b>: ${esc(v)}</span>`).join("")}</li>` : "";
  const scale = (o.scale || []).map(s => `<li>${en(s.value)} ${badge(s.basis)}${sub(`${s.metric || ""}${s.as_of ? " · " + s.as_of : ""}`)}</li>`).join("");
  const ev = (o.evidence || []).map(e => `<li>${en(e.finding)}<span class="ind ${e.independent ? "yes" : "no"}">${tt(e.independent ? "eco.indep" : "eco.notindep")}</span>${sub(`${e.study || ""}${e.design ? " — " + e.design : ""}`)} ${a(e.doi_or_url, t("eco.study"))}</li>`).join("");
  return `<tr data-r><td><b lang="en" dir="ltr">${esc(o.name)}</b>${sub(`${o.type || ""} · ${o.country || ""}${o.founded ? " · " + o.founded : ""}`)}${iran && o.quality ? ` <span class="q">${tt("eco.quality")}: ${esc(o.quality)}</span>` : ""}${o.verified === false ? `<span class="sub">${tt("eco.unverified")}</span>` : ""}</td>
    <td><ul>${feats || `<li class="faint">${tt("eco.noai")}</li>`}${integ}</ul></td><td><ul>${scale || "—"}</ul></td><td><ul>${ev || `<li class="faint">${tt("eco.noev")}</li>`}</ul></td>
    <td class="links">${(o.sources || []).map(u => a(u, host(u))).join("")}</td></tr>`; }).join("");
let org = "edtech";
const drawOrg = () => { $("orgs").innerHTML = orgRows(X[org], false); rowsOf.orgs = []; reg("orgs", $("orgs"));
  for (const b of $("orgseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.o === org); if (tab === "orgs") filter(); };
for (const b of $("orgseg").querySelectorAll("button")) b.onclick = () => { org = b.dataset.o; drawOrg(); };
drawOrg();
$("iran").innerHTML = orgRows(X.iran_ecosystem, true); reg("iran", $("iran"));

// ---- tabs (remembered in the URL hash)
const show = id => { tab = rowsOf[id] ? id : "money";
  for (const b of $("tabs").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.tab === tab);
  for (const p of document.querySelectorAll(".panel")) p.hidden = p.id !== "p-" + tab;
  history.replaceState(null, "", "#" + tab); filter(); };
for (const b of $("tabs").querySelectorAll("button")) b.onclick = () => show(b.dataset.tab);
show(location.hash.slice(1));
})();
