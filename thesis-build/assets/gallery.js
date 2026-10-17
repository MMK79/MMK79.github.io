// Shared helpers of the two gallery pages (/rag-projects.html, /tooling.html), 2026-10-13. window.GX.
// Logos are vendored files (/assets/logos/<set>/), inline Simple Icons path data, or an initials badge when nothing was found.
(() => {
const I = window.I18N || {fa: false, digits: s => s, esc: s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]))};
const T = (k, v) => (window.t ? window.t(k, v) : k), esc = I.esc;
const N = x => (I.fa ? I.digits(String(x)) : String(x));
const num = n => n == null ? "—" : N(n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k" : Number(n).toLocaleString("en"));
const day = s => s ? "\u2066" + N(String(s).slice(0, 10)) + "\u2069" : "—";   // isolated LTR run: a date keeps its order inside Persian text
const initials = name => { const w = String(name).replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : String(name).slice(0, 2)).toUpperCase(); };
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
function logo(row) {
  const L = row.logo || {kind: "badge"}, kind = L.kind || "badge", tip = esc(T("gx.logo_" + kind.replace("-", "_")));
  if (L.src) return `<span class="gx-logo k-${esc(kind)}" title="${tip}"><img src="${esc(L.src)}" alt="" loading="lazy" decoding="async" width="32" height="32"></span>`;
  if (L.svg) return `<span class="gx-logo k-${esc(kind)}" title="${tip}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(L.svg)}" fill="${L.mono || !L.hex ? "#111" : esc(L.hex)}"/></svg></span>`;
  return `<span class="gx-logo k-badge" style="--h:${hue(row.name)}" title="${tip}" aria-hidden="true" lang="en">${esc(initials(row.name))}</span>`;
}
const en = (tag, html, cls = "") => `<${tag} lang="en" dir="ltr"${cls ? ` class="${cls}"` : ""}>${html}</${tag}>`;
const ext = (u, label) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : "";
const list = a => (a && a.length) ? `<ul lang="en" dir="ltr">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
// Filter + sort over cards grouped in sections. cfg: {cards, text(i), match(i), cmp(key)(a,b), count el, none el}
function wire(cfg) {
  const go = () => {
    const q = cfg.q.value.trim().toLowerCase(); let n = 0;
    cfg.rows.forEach((r, i) => { const ok = (!q || cfg.text[i].includes(q)) && cfg.match(r); cfg.cards[i].hidden = !ok; n += ok; });
    const key = cfg.sort.value, cmp = cfg.cmp(key);
    cfg.sections.forEach(sec => { const g = sec.querySelector(".gx-grid"), cs = [...g.children];
      cs.sort((a, b) => cmp(cfg.rows[+a.dataset.i], cfg.rows[+b.dataset.i])).forEach(c => g.append(c));
      const v = cs.filter(c => !c.hidden).length; sec.hidden = !v; const sm = sec.querySelector("h2 small"); if (sm) sm.textContent = T("gx.n_shown", {n: N(v), total: N(cs.length)}); });
    cfg.count.textContent = T("gx.count", {n: N(n), total: N(cfg.rows.length)}); cfg.none.hidden = n > 0;
  };
  cfg.inputs.forEach(el => el.addEventListener(el.type === "search" ? "input" : "change", go)); go();
  const hash = () => { const c = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (c && c.classList.contains("gx-card")) { c.hidden = false; c.closest(".gx-sec").hidden = false; c.classList.add("gx-hl"); c.scrollIntoView({block: "start"}); } };
  hash(); addEventListener("hashchange", hash);
}
const opts = (sel, vals, label) => { sel.innerHTML = `<option value="">${esc(T("gx.all"))}</option>` + vals.map(v => `<option value="${esc(v)}">${esc(label(v))}</option>`).join(""); };
window.GX = {I, T, esc, N, num, day, logo, en, ext, list, wire, opts};
})();
