// LLM providers: vertical page. Reads /data/llm-providers.json (copied from the vault at build time, account details removed).
// The table has one DOM row per model (1,192; cheap enough) built once; filters only toggle .lp-off, and only the first
// `limit` matching rows (in the current DOM order, which the layout module's sort changes) are shown, 100 at a time.
// Prices are not live: the strip and the footnotes show the currency, the dated FX rate and each provider's last_checked.
(async () => {
const $ = id => document.getElementById(id);
const esc = I18N.esc;
const T = (k, v) => esc(t(k, v));
const en = s => s ? `<span lang="en" dir="ltr">${esc(s)}</span>` : "";
const STEP = 100;
const doc = (D.data.llm || []).length ? await fetch("/thesis/data/llm-providers.json").then(r => r.ok ? r.json() : null).catch(() => null) : null;
if (!doc) { $("recs").insertAdjacentHTML("beforebegin", `<p class="note-box">${T("llm.nodata")}</p>`); return; }
const M = doc.models, P = Object.fromEntries(doc.providers.map(p => [p.id, p]));
const key = (p, id) => p + "|" + id;
const byKey = Object.fromEntries(M.map((m, i) => [key(m.provider, m.model_id), i]));
const nf = (x, o) => x == null ? "—" : new Intl.NumberFormat("en", o).format(x);
const usd = x => x == null ? "—" : x === 0 ? "0" : x >= 100 ? nf(x, {maximumFractionDigits: 0}) : x >= 1 ? nf(x, {maximumFractionDigits: 2}) : nf(x, {maximumSignificantDigits: 3});
const ctx = c => c == null ? "—" : c >= 1e6 ? nf(c / 1e6, {maximumFractionDigits: 2}) + "M" : c >= 1e3 ? nf(Math.round(c / 1e3)) + "K" : String(c);
const pname = id => P[id]?.name?.split(" (")[0] || id;
const blend = m => m.usd_in == null || m.usd_out == null ? null : (3 * m.usd_in + m.usd_out) / 4;

// ---------- header strip: not live ----------
const fx = doc.fx || {}, rt = fx.rates || {};
$("strip-list").innerHTML =
  `<li>${T("llm.generated")}: <b class="num">${esc(doc.generated)}</b></li>` +
  `<li>${T("llm.fx_rate")}: <b class="num" dir="ltr">1 USD = ${nf(rt.TOMAN_per_USD)} Toman = ${nf(rt.IRR_per_USD)} IRR</b> (${T("llm.fx_date")} <span class="num">${esc(fx.date)}</span>)</li>` +
  doc.providers.map(p => `<li>${esc(pname(p.id))}: ${T("llm.checked")} <span class="num">${esc(p.last_checked || "?")}</span>, ${T("llm.billed")} ${esc(M.find(m => m.provider === p.id)?.currency || "?")}</li>`).join("");
$("fxs").innerHTML = T("llm.fx_src") + " " + en(fx.source) + " " + T("llm.arvan_note");

// ---------- recommendations ----------
const ROLES = ["extraction", "answer", "judge-bulk", "judge-final", "question-gen", "vision", "embedding"];
const pick = (r) => { const i = byKey[key(r.provider, r.model_id)]; const m = M[i];
  return `<button type="button" class="pick" data-goto="${esc(r.provider)}|${esc(r.model_id)}" dir="ltr">${esc(r.provider)} / ${esc(r.model_id)}</button>` +
    (m ? ` <span class="num" dir="ltr">USD ${usd(m.usd_in)} / ${usd(m.usd_out)}</span>` : ""); };
$("recs").innerHTML = ROLES.filter(r => doc.recommendations[r]).map(r => { const c = doc.recommendations[r];
  return `<div class="card"><h3>${T("llm.role." + r)}</h3><div>${pick(c.best)}</div>` +
    `<div class="chips">${(c.alternatives || []).map(a => `<button type="button" class="chip" data-goto="${esc(a.provider)}|${esc(a.model_id)}" dir="ltr">${esc(a.provider)} / ${esc(a.model_id)}</button>`).join("")}</div>` +
    `<p class="why">${en(c.why)}</p></div>`; }).join("");

// ---------- providers ----------
$("provs").innerHTML = doc.providers.map(p => { const n = M.filter(m => m.provider === p.id).length;
  const rl = p.rate_limits ? Object.values(p.rate_limits).map(String).join(" · ") : "";
  return `<div class="card"><h3>${esc(p.name)}</h3><span class="tag ${p.usable_now ? "ok" : "no"}">${T(p.usable_now ? "llm.usable" : "llm.not_usable")}</span> ` +
    `<span class="tag">${n} ${T("llm.models")}</span><dl><dt>${T("llm.region")}</dt><dd>${en(p.region)}</dd><dt>${T("llm.pay")}</dt><dd>${en(p.payment_from_iran)}</dd>` +
    `<dt>${T("llm.limits")}</dt><dd>${en(rl)}</dd><dt>${T("llm.checked")}</dt><dd class="num">${esc(p.last_checked || "?")}</dd></dl></div>`; }).join("");

// ---------- table ----------
const modalities = [...new Set(M.map(m => m.modality))].sort();
const optP = [`<option value="">${T("llm.all")}</option>`, ...doc.providers.map(p => `<option value="${esc(p.id)}">${esc(pname(p.id))}</option>`)];
$("f-prov").innerHTML = optP.join("");
const ROLE_OPTS = [["", "llm.all"], ["llm", "llm.r_text"], ["vision", "llm.r_vision"], ["embedding", "llm.r_embedding"], ...modalities.filter(x => !["text", "vision", "embedding"].includes(x)).map(x => ["m:" + x, null, x])];
$("f-role").innerHTML = ROLE_OPTS.map(([v, k, raw]) => `<option value="${esc(v)}">${k ? T(k) : esc(raw)}</option>`).join("");
const recSet = new Set(Object.values(doc.recommendations).flatMap(r => [r.best, ...(r.alternatives || [])]).map(r => key(r.provider, r.model_id)));
$("models").tHead.querySelectorAll("th[data-k]").forEach(th => th.textContent = t(th.dataset.k));   // header text set here: the layout module reads it at init
const tb = $("models").tBodies[0];
const cell = (txt, cls = "", sort) => `<td class="${cls}"${sort !== undefined ? ` data-sort="${sort ?? ""}"` : ""}>${txt}</td>`;
const rows = M.map((m, i) => {
  const b = blend(m), nul = x => x == null ? " nul" : "";
  const nat = x => m.currency === "IRR" ? nf(x, {maximumFractionDigits: 0}) : usd(x);
  const av = m.available === true ? T("llm.yes") : m.available === false ? T("llm.no") : T("llm.unknown");
  const note = [m.min_tier ? t("llm.min_tier", {n: m.min_tier}) : "", m.notes].filter(Boolean).join("; ");
  const tr = document.createElement("tr");
  tr.dataset.k = key(m.provider, m.model_id); tr.dataset.i = i;
  if (m.usd_in == null) tr.classList.add("na");
  tr.innerHTML = cell(esc(pname(m.provider)), "t", m.provider) + cell(esc(m.model_id) + (recSet.has(tr.dataset.k) ? ` <span class="tag ok">${T("llm.rec")}</span>` : ""), "mid", m.model_id) +
    cell(esc(m.modality), "t") + cell(ctx(m.context), "n" + nul(m.context), m.context ?? "") +
    cell(usd(m.usd_in), "n" + nul(m.usd_in), m.usd_in ?? "") + cell(usd(m.usd_out), "n" + nul(m.usd_out), m.usd_out ?? "") +
    cell(usd(b), "n" + nul(b), b ?? "") + cell(esc(m.currency), "") + cell(m.price_in_per_mtok == null ? "—" : nat(m.price_in_per_mtok), "n" + nul(m.price_in_per_mtok), m.price_in_per_mtok ?? "") +
    cell(m.price_out_per_mtok == null ? "—" : nat(m.price_out_per_mtok), "n" + nul(m.price_out_per_mtok), m.price_out_per_mtok ?? "") +
    cell(esc(m.family || "—"), "t") + cell(av, "t", m.available === true ? 1 : m.available === false ? 0 : 0.5) + cell(`<span class="nt">${esc(note)}</span>`, "t");
  return tr;
});
tb.append(...rows);

let limit = STEP;
const F = () => ({q: $("q").value.trim().toLowerCase(), p: $("f-prov").value, r: $("f-role").value, av: $("f-avail").checked, fr: $("f-free").checked});
const matches = (m, f) => {
  if (f.p && m.provider !== f.p) return false;
  if (f.r === "llm" && !["text", "vision"].includes(m.modality)) return false;
  if ((f.r === "vision" || f.r === "embedding") && m.modality !== f.r) return false;
  if (f.r.startsWith("m:") && m.modality !== f.r.slice(2)) return false;
  if (f.av && m.available !== true) return false;
  if (f.fr && m.usd_in === 0 && !m.usd_out) return false;
  if (f.q && !(m.model_id + " " + (m.family || "") + " " + (m.notes || "") + " " + m.provider).toLowerCase().includes(f.q)) return false;
  return true;
};
let total = 0;
function apply() {
  const f = F(); let n = 0, shown = 0;
  const live = [...tb.rows];                      // current DOM order (the layout module's sort reorders it)
  for (const tr of live) {
    const ok = matches(M[+tr.dataset.i], f);
    if (ok) n++;
    const show = ok && shown < limit; if (show) shown++;
    tr.classList.toggle("lp-off", !show);
  }
  total = n;
  $("cnt").textContent = t("llm.count", {n: nf(n), total: nf(M.length)});
  $("none").hidden = n > 0;
  $("shown").textContent = n ? t("llm.shown", {n: nf(shown)}) : "";
  const more = $("more"); more.hidden = shown >= n; more.textContent = t("llm.more", {k: nf(Math.min(STEP, n - shown))});
}
const reset = () => { limit = STEP; apply(); };
["q", "f-prov", "f-role", "f-avail", "f-free"].forEach(id => $(id).addEventListener(id === "q" ? "input" : "change", reset));
$("f-clear").onclick = () => { $("q").value = ""; $("f-prov").value = ""; $("f-role").value = ""; $("f-avail").checked = false; $("f-free").checked = false; reset(); };
$("more").onclick = () => { limit += STEP; apply(); };
$("models").tHead.addEventListener("click", () => setTimeout(() => { limit = STEP; apply(); }, 0));   // after the module's sort
apply();
if (!window.HX) await new Promise(r => addEventListener("load", r));   // layout.js is loaded after this script
$("models").setAttribute("data-hx-table", ""); HX.initTable($("models")); apply();

// recommendation / alternative -> scroll to the row, clearing filters that would hide it
document.addEventListener("click", e => {
  const g = e.target.closest("[data-goto]"); if (!g) return;
  const tr = tb.querySelector(`tr[data-k="${CSS.escape(g.dataset.goto)}"]`); if (!tr) return;
  $("q").value = ""; $("f-prov").value = ""; $("f-role").value = ""; $("f-avail").checked = false; $("f-free").checked = false;
  limit = Math.max(limit, [...tb.rows].indexOf(tr) + 1); apply();
  tb.querySelectorAll("tr.hl").forEach(r => r.classList.remove("hl")); tr.classList.add("hl");
  const sec = $("s-table"); if (sec.classList.contains("hx-collapsed")) sec.querySelector("[aria-expanded]")?.click();
  tr.scrollIntoView({block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
});
})();
