// Explain hub and section pages: one search box filters every [data-item] (cards or list rows) by its visible text and its English tags.
// A [data-block] with no visible item is hidden. Vertical page, vanilla JS.
(() => {
const q = document.getElementById("xq"); if (!q) return;
const I = window.I18N || {fa: false, digits: s => s}, T = (k, v) => (window.t ? window.t(k, v) : k), N = x => (I.fa ? I.digits(String(x)) : String(x));
const items = [...document.querySelectorAll("[data-item]")], blocks = [...document.querySelectorAll("[data-block]")];
function apply() {
  const s = q.value.trim().toLowerCase(); let n = 0;
  items.forEach(el => { const ok = !s || (el.textContent + " " + (el.dataset.tags || "")).toLowerCase().includes(s); el.hidden = !ok; n += ok; });
  blocks.forEach(b => { b.hidden = !!s && !b.querySelector("[data-item]:not([hidden])"); });
  document.getElementById("x-cnt").textContent = T("ex.x_count", {n: N(n), total: N(items.length)});
  document.getElementById("x-none").hidden = n > 0;
}
q.addEventListener("input", apply); apply();
addEventListener("i18n:ready", apply);
})();
