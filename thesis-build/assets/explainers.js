// Explainer pages: /metrics.html and /algorithms.html (one script, <main data-kind>). Vertical page, vanilla JS.
// Data (written by site.py at every build, read from the vault then):
//   /data/explainers/<kind>.json               {layers, units}: catalogue entries of the done units (+ demo path, 3D flag, video name)
//   /data/explainers/<kind>-build-status.json  the LIVE build-status.json (done, test, real, revised), so a rebuild picks up retrofits
// A card opens on click (or #<id> in the address): only then the video element is made and the demo script is loaded and
// mounted (demo-kit.js + demo.css; the 3D demos import three.js themselves, from /assets/explainers/_demo-kit/vendor/).
// Videos: /videos/<Class>.<sha8>.mp4 + poster (web encodes copied by site.py; they ship with the site). Not encoded yet:
// "video encoding" (the demo still works); a rebuild picks the file up.
// UI strings: ex.* (en/fa). Catalogue text: on Persian, D.ex_fa (i18n/fa/explainers.json: {layers:{id:{measures}}, units:{id:{name, question,
// symbols, range, higher_is_better, blind_spots, use_vs_neighbours, worked_example{setup,steps}}}}, same shapes as the English fields) is used per
// field; a field without a translation stays English (lang="en"), and the line under the intro says so while any such field is shown.
(async () => {
const I = window.I18N || {fa: false, has: () => false, digits: s => s, esc: s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]))};
const T = (k, v) => (window.t ? window.t(k, v) : k);
const esc = I.esc, N = x => (I.fa ? I.digits(String(x)) : String(x));
const main = document.getElementById("ex-main"), kind = main.dataset.kind;
const FX = (typeof D !== "undefined" && D.ex_fa) || {}, FXU = FX.units || {}, FXL = FX.layers || {};
const fx = (u, k) => (I.fa && FXU[u.id] && FXU[u.id][k] != null && FXU[u.id][k] !== "") ? FXU[u.id][k] : null;
let missing = false;   // a Persian page that shows an English catalogue field says so (ex-en)
const noteEn = () => { missing = true; const n = document.getElementById("ex-en"); if (n && I.fa) n.hidden = false; };

const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
let cat, status, rel = {};
try {
  [cat, status] = await Promise.all([getJSON("/thesis/data/explainers/" + kind + ".json"), getJSON("/thesis/data/explainers/" + kind + "-build-status.json")]);
  rel = (await getJSON("/thesis/data/explainers/relations.json").catch(() => ({})))[kind] || {};   // related cards of the other page (site.py: relations())
} catch (e) {
  main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`; return;
}

// ---------- helpers ----------
const wiki = s => String(s ?? "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a);
const E = s => esc(wiki(s));
const isoFa = h => (I.iso ? I.iso(h) : h);   // Latin runs in Persian text in <bdi>, so brackets next to them keep their place
const loc = (tag, enHtml, faHtml, cls = "") => faHtml != null ? `<${tag}${cls ? ` class="${cls}"` : ""}>${isoFa(faHtml)}</${tag}>` : (I.fa && noteEn(), en(tag, enHtml, cls));
const en = (tag, html, cls = "") => `<${tag} lang="en" dir="ltr"${cls ? ` class="${cls}"` : ""}>${html}</${tag}>`;
const realKind = r => { const k = String(r ?? "").split(":")[0].trim(); return k === "done" ? "real" : k === "partial" ? "partial" : "toy"; };
const realWhy = r => { const s = String(r ?? ""); const i = s.indexOf(":"); return i > 0 ? s.slice(i + 1).trim() : ""; };
const tk = (k, fb) => (I.has && I.has(k)) || (window.I18N_DICT && window.I18N_DICT.en && k in window.I18N_DICT.en) ? T(k) : fb;
const layerName = l => tk("ex.layer_" + l.id, l.name);
const evName = s => tk("ex.ev_" + s, s);
const rev = d => esc(T("ex.revised", {d: "\u0001"})).replace("\u0001", `<bdi dir="ltr">${esc(d)}</bdi>`);   // dates stay YYYY-MM-DD order on Persian

// LaTeX -> readable Unicode (no math library is vendored on the site; the LaTeX source stays one click away).
const GREEK = {alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω"};
const OPS = {sum: "Σ", prod: "∏", cdot: "·", times: "×", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", sim: "∼", equiv: "≡", propto: "∝",
  in: "∈", notin: "∉", cap: "∩", cup: "∪", bigcup: "⋃", bigcap: "⋂", subseteq: "⊆", subset: "⊂", setminus: "∖", emptyset: "∅", varnothing: "∅", infty: "∞", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", Leftrightarrow: "⇔", iff: "⇔", mapsto: "↦", mid: "|", vert: "|", lvert: "|", rvert: "|", Vert: "‖", lVert: "‖", rVert: "‖", langle: "⟨", rangle: "⟩", lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋",
  ldots: "…", dots: "…", cdots: "⋯", forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨", wedge: "∧", vee: "∨", pm: "±", partial: "∂", nabla: "∇", top: "ᵀ", circ: "∘", oplus: "⊕", otimes: "⊗",
  star: "*", ast: "*", quad: "  ", qquad: "    ", colon: ":", lbrace: "{", rbrace: "}", Pr: "Pr", log: "log", ln: "ln", exp: "exp", max: "max", min: "min", arg: "arg", argmax: "argmax", argmin: "argmin",
  sqrt: "√", sin: "sin", cos: "cos", lim: "lim", sup: "sup", inf: "inf", det: "det", dim: "dim", mod: "mod", bmod: "mod", deg: "deg", ell: "ℓ", hbar: "ħ", prime: "′", cdotp: "·", bullet: "•", triangleq: "≜", coloneqq: "≔"};
const SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", T: "ᵀ", k: "ᵏ", t: "ᵗ", "*": "*", "′": "′"};
const SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", h: "ₕ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", p: "ₚ", s: "ₛ", t: "ₜ", i: "ᵢ", j: "ⱼ", r: "ᵣ", u: "ᵤ", v: "ᵥ"};
const script = (s, map, mark) => { s = s.trim(); return [...s].every(c => c in map) ? [...s].map(c => map[c]).join("") : mark + (s.length > 1 ? "(" + s + ")" : s); };
function tex(src) {
  let s = String(src ?? "");
  s = s.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002").replace(/\\%/g, "%").replace(/\\#/g, "#").replace(/\\&/g, "&").replace(/\\_/g, "\u0003");
  s = s.replace(/\\(?:left|right|big|Big|bigg|Bigg)(?=[^A-Za-z])/g, "").replace(/\\displaystyle|\\limits|\\nolimits/g, "");
  s = s.replace(/\\[,;:!> ]/g, m => (m === "\\!" ? "" : " ")).replace(/~/g, " ");
  for (let i = 0; i < 8; i++) {   // innermost brace groups first
    const before = s;
    s = s.replace(/\\(?:text|textrm|textit|textbf|mathrm|mathit|mathbf|mathsf|mathtt|mathcal|mathbb|boldsymbol|operatorname\*?|mbox|emph)\s*\{([^{}]*)\}/g, "$1");
    s = s.replace(/\\(?:hat|bar|tilde|vec|overline|underline|widehat|widetilde|dot)\s*\{([^{}]*)\}/g, (m, a) => a + (m.includes("hat") ? "̂" : m.includes("tilde") ? "̃" : m.includes("dot") ? "̇" : m.includes("vec") ? "⃗" : "̄"));
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${/^[\w.′]+$/.test(a.trim()) ? a.trim() : "(" + a.trim() + ")"}/${/^[\w.′]+$/.test(b.trim()) ? b.trim() : "(" + b.trim() + ")"}`);
    s = s.replace(/\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "C($1, $2)");
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
    s = s.replace(/\\x(?:right|left)arrow\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, (m, a) => ` —${a}→ `);
    s = s.replace(/\\(?:overset|stackrel)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$2[$1]").replace(/\\underset\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$2_{$1}");
    s = s.replace(/\\(?:underbrace|overbrace)\s*\{([^{}]*)\}/g, "$1");
    s = s.replace(/\^\s*\{([^{}]*)\}/g, (m, a) => script(a, SUP, "^")).replace(/_\s*\{([^{}]*)\}/g, (m, a) => script(a, SUB, "_"));
    s = s.replace(/(?<![\\\w])\{([^{}]*)\}/g, "$1");
    if (s === before) break;
  }
  s = s.replace(/\\([A-Za-z]+)/g, (m, w) => GREEK[w] ?? OPS[w] ?? w);
  s = s.replace(/\^([A-Za-z0-9*′])/g, (m, a) => SUP[a] ?? "^" + a).replace(/_([A-Za-z0-9])/g, (m, a) => SUB[a] ?? "_" + a);
  s = s.replace(/\\\\/g, "\n").replace(/[{}]/g, "").replace(/\u0001/g, "{").replace(/\u0002/g, "}").replace(/\u0003/g, "_").replace(/[ \t]{3,}/g, "   ");
  return s.trim();
}

const PAGE_RX = /\b(?:PDF\s)?pp?\.\s?\d+(?:\s?[-–]\s?\d+)?|\bSecs?\.\s?\d+(?:\.\d+)*|\bSection\s\d+(?:\.\d+)*|\bEqs?\.\s?\d+(?:\.\d+)*(?:\s?[-–]\s?\d+(?:\.\d+)*)?|\bTable\s\d+|\bAlgorithm\s\d+|\bFig(?:ure|\.)\s?\d+/g;
const pages = s => [...new Set(String(s ?? "").match(PAGE_RX) || [])];
function srcLink(id) {
  id = String(id ?? "").trim(); if (!id) return "";
  let u = null;
  if (/^https?:\/\//.test(id)) u = id;
  else if (/^arxiv:/i.test(id)) u = "https://arxiv.org/abs/" + id.replace(/^arxiv:\s*/i, "");
  else if (/^(?:doi:\s*)?10\.\d{4,}\//i.test(id)) u = "https://doi.org/" + id.replace(/^doi:\s*/i, "");
  return u ? `<a href="${esc(u)}" rel="noopener" target="_blank">${esc(id)}</a>` : esc(wiki(id));
}
const symRows = sym => {
  if (!sym) return [];
  if (typeof sym === "object" && !Array.isArray(sym)) return Object.entries(sym);
  if (Array.isArray(sym)) return sym.map(x => typeof x === "object" ? [x.symbol ?? x.name ?? "", x.meaning ?? x.text ?? JSON.stringify(x)] : ["", String(x)]);
  const parts = String(sym).split(/;\s+(?=[^;]{1,60}?\s=\s)/);
  return parts.map(p => { const i = p.indexOf(" = "); return i > 0 && i < 60 ? [p.slice(0, i), p.slice(i + 3)] : ["", p]; });
};
// the symbols stay left to right and in Latin; on Persian the explanation of each symbol is the Persian row of the same position
function symbols(sym, faSym) {
  const rows = symRows(sym); if (!rows.length) return "";
  const fr = faSym != null ? symRows(faSym) : null, ok = fr && fr.length === rows.length;
  if (I.fa && !ok) noteEn();
  return `<dl class="ex-sym"${ok ? "" : ' lang="en" dir="ltr"'}>${rows.map(([k, v], i) => `<dt lang="en" dir="ltr">${esc(k)}</dt><dd>${ok ? isoFa(esc(wiki(fr[i][1]))) : E(v)}</dd>`).join("")}</dl>`;
}
const list = (x, f) => { const y = f != null ? f : x, E2 = x => f != null ? isoFa(E(x)) : E(x), L = s => Array.isArray(y) ? `<ul>${y.map(i => `<li>${E2(typeof i === "object" ? JSON.stringify(i) : i)}</li>`).join("")}</ul>` : `<p>${E2(y)}</p>`;
  return f != null ? L() : `<div lang="en" dir="ltr">${L()}</div>`; };
const fmtResult = r => typeof r === "number" ? String(+r.toFixed(6)) : JSON.stringify(r);

// ---------- build ----------
const units = cat.units.filter(u => status[u.id] && status[u.id].done);
const layers = [...cat.layers].sort((a, b) => a.order - b.order);
const byLayer = new Map(layers.map(l => [l.id, []]));
units.forEach(u => { if (!byLayer.has(u.layer)) { byLayer.set(u.layer, []); layers.push({id: u.layer, name: u.layer, order: 99}); } byLayer.get(u.layer).push(u); });

function card(u) {
  const st = status[u.id] || {}, rk = realKind(st.real), ev = u.evidence_status || "inferred";
  const a = document.createElement("article");
  a.className = "ex-card"; a.id = u.id; a.dataset.layer = u.layer; a.dataset.ev = ev; a.dataset.real = rk; a.dataset.three = u.three ? "1" : "";
  a.dataset.text = [u.id, u.name, u.question, fx(u, "name") || "", fx(u, "question") || "", typeof u.symbols === "string" ? u.symbols : Object.keys(u.symbols || {}).join(" ")].join(" ").toLowerCase();
  const tags = [
    `<span class="ex-tag ev-${esc(ev)}" title="${esc(T("ex.ev_title"))}">${esc(evName(ev))}</span>`,
    `<span class="ex-tag ${rk}"${realWhy(st.real) ? ` title="${esc(realWhy(st.real))}"` : ""}>${esc(T("ex." + rk))}</span>`,
    u.three ? `<span class="ex-tag d3">${esc(T("ex.tag_3d"))}</span>` : "",
    !u.three && u.viz === "2d" && u.viz_planned === "3d" ? `<span class="ex-tag d3p" title="${esc(T("ex.tag_3d_planned_title"))}">${esc(T("ex.tag_3d_planned"))}</span>` : "",
    st.revised ? `<span class="ex-tag rev">${rev(st.revised)}</span>` : "",
    (u.superseded || []).length ? `<span class="ex-tag sup">${esc(T("ex.tag_sup", {n: N(u.superseded.length)}))}</span>` : "",
  ].join("");
  a.innerHTML = `<details><summary><div class="ex-sum-h">${loc("h3", E(u.name), (fx(u, "name") && E(fx(u, "name"))) || null)}<span class="ex-chev" aria-hidden="true">›</span></div>
    ${loc("p", E(u.question), (fx(u, "question") && E(fx(u, "question"))) || null, "ex-q")}<div class="ex-tags">${tags}</div></summary><div class="ex-body"></div></details>`;
  const det = a.querySelector("details");
  det.addEventListener("toggle", () => {
    if (!det.open) return;
    if (!a._built) { a._built = true; body(u, a.querySelector(".ex-body")); }
    if (location.hash !== "#" + u.id) history.replaceState(null, "", "#" + u.id);
  });
  return a;
}

// worked example: setup and steps in Persian when translated (the result is a number: shown as data), else English
function wx(u, we) {
  const f = fx(u, "worked_example") || {}, fs = f.setup != null && we.setup, ft = f.steps != null && we.steps;
  if (I.fa && ((we.setup && !fs) || (we.steps && !ft))) noteEn();
  const res = "result" in we ? `<p><b>${esc(T("ex.result"))}:</b> <span class="num" lang="en" dir="ltr">${esc(fmtResult(we.result))}</span></p>` : "";
  const part = (ok, enHtml, faHtml) => ok ? faHtml : `<div lang="en" dir="ltr">${enHtml}</div>`;
  return (we.setup ? part(fs, `<p>${E(we.setup)}</p>`, `<p>${isoFa(E(f.setup))}</p>`) : "") + (we.steps ? part(ft, list(we.steps).replace(/^<div[^>]*>|<\/div>$/g, ""), list(we.steps, f.steps)) : "") + res;
}

function body(u, el) {
  const st = status[u.id] || {}, rk = realKind(st.real), src = u.source || {}, pg = pages((src.cite || "") + " " + (src.id || ""));
  const we = u.worked_example || {};
  const sup = (u.superseded || []).map(s => `<div class="ex-sup" lang="en" dir="ltr"><b>${esc(s.date || "")}</b> · ${esc(s.field || "")}: ${E(s.reason || "")}
      ${s.old ? `<details class="ex-tex"><summary>${esc(T("ex.sup_old"))}</summary><code>${esc(typeof s.old === "string" ? s.old : JSON.stringify(s.old))}</code></details>` : ""}</div>`).join("");
  el.innerHTML = `
    <div class="ex-media">
      <div class="ex-blk"><h4>${esc(T("ex.h_video"))}</h4><div class="ex-video"></div></div>
      <div class="ex-blk"><h4>${esc(T("ex.h_demo"))}</h4><div class="ex-demo" lang="en" dir="ltr"></div></div>
    </div>
    <div class="ex-blk"><h4>${esc(T("ex.h_formula"))}</h4>
      <div class="ex-fx" lang="en">${esc(tex(u.formula_latex))}</div>
      <details class="ex-tex"><summary>${esc(T("ex.latex"))}</summary><code>${esc(u.formula_latex || "")}</code></details>
      <h4 style="margin-top:12px">${esc(T("ex.h_symbols"))}</h4>${symbols(u.symbols, fx(u, "symbols"))}
      ${u.range || u.higher_is_better ? loc("p", `${esc(T("ex.range"))}: ${E(u.range || "—")} · ${esc(T("ex.better"))}: ${E(u.higher_is_better ?? "—")}`, (fx(u, "range") || fx(u, "higher_is_better")) ? `${esc(T("ex.range"))}: ${E(fx(u, "range") || u.range || "—")} · ${esc(T("ex.better"))}: ${E(fx(u, "higher_is_better") ?? u.higher_is_better ?? "—")}` : null, "ex-src") : ""}
    </div>
    <div class="ex-grid2">
      <div class="ex-blk"><h4>${esc(T("ex.h_evidence"))}</h4>
        <p><span class="ex-tag ev-${esc(u.evidence_status || "inferred")}">${esc(evName(u.evidence_status || "inferred"))}</span> <span class="ex-src">${esc(T("ex.ev_explain_" + (u.evidence_status === "evidenced" ? "e" : "i")))}</span></p>
        ${en("p", `${E(src.cite || "")}${src.id ? " · " + srcLink(src.id) : ""}`, "ex-src")}
        <p class="ex-src">${esc(T("ex.where"))}: ${pg.length ? en("span", esc(pg.join(", "))) : esc(T("ex.nopage"))}</p>
        ${u.notes ? en("p", E(u.notes), "ex-src") : ""}
        ${sup ? `<h4 style="margin-top:10px">${esc(T("ex.h_sup"))}</h4>${sup}` : ""}
      </div>
      <div class="ex-blk ex-caveat"><h4>${esc(T("ex.h_caveats"))}</h4>
        <p class="ex-src">${esc(T("ex.example_" + rk))}${realWhy(st.real) ? " " + en("span", E(realWhy(st.real))) : ""}${st.revised ? " · " + rev(st.revised) : ""}</p>
        ${list(u.blind_spots, fx(u, "blind_spots"))}
      </div>
    </div>
    ${related(u)}
    <details class="ex-blk"><summary class="ex-src" style="cursor:pointer">${esc(T("ex.h_worked"))}</summary>
      ${wx(u, we)}
    </details>
    ${u.use_vs_neighbours ? `<details class="ex-blk"><summary class="ex-src" style="cursor:pointer">${esc(T("ex.h_use"))}</summary>${loc("p", E(u.use_vs_neighbours), (fx(u, "use_vs_neighbours") && E(fx(u, "use_vs_neighbours"))) || null)}</details>` : ""}
    <a class="ex-link" href="#${esc(u.id)}">#${esc(u.id)}</a>`;
  video(u, el.querySelector(".ex-video"));
  demo(u, el.querySelector(".ex-demo"));
}

// Related chips: the other page's cards this unit is measured by / measures. A chip links only when that card exists in this build.
const OTHER = kind === "metrics" ? "algorithms" : "metrics";
function related(u) {
  const r = rel[u.id], ls = (r && r.links) || []; if (!ls.length) return "";
  const chips = ls.map(c => c.exists
    ? `<a class="ex-tag ex-rel" lang="en" dir="ltr" href="/${OTHER}.html#${esc(c.id)}" title="${esc(c.note)}">${esc(c.name)}</a>`
    : `<span class="ex-tag ex-rel soon" lang="en" dir="ltr" title="${esc(T("ex.rel_soon"))}">${esc(c.name)}</span>`).join("");
  return `<div class="ex-blk ex-related"><h4>${esc(T(kind === "algorithms" ? "ex.h_related_m" : "ex.h_related_a"))}</h4>
    ${kind === "algorithms" && r.note ? en("p", E(r.note), "ex-src") : ""}<div class="ex-tags">${chips}</div></div>`;
}

const note = k => `<p class="ex-novid">${esc(T(k))}</p>`;
function video(u, box) {
  if (!u.video_file) { box.innerHTML = note(u.video ? "ex.vid_encoding" : "ex.novideo"); return; }
  const v = document.createElement("video");
  v.controls = true; v.preload = "none"; v.playsInline = true; v.setAttribute("aria-label", T("ex.video_aria", {name: u.name}));
  if (u.poster) v.poster = "/thesis/videos/" + u.poster;
  if (u.width && u.height) v.style.aspectRatio = u.width + " / " + u.height;
  const s = document.createElement("source"); s.src = "/thesis/videos/" + u.video_file; s.type = "video/mp4"; v.append(s);
  s.addEventListener("error", () => { box.innerHTML = note("ex.vid_missing"); });
  box.replaceChildren(v);
}

const scripts = {};
const load = (src, retry = 1) => scripts[src] ||= new Promise((ok, no) => {
  const s = document.createElement("script"); s.src = src; s.onload = ok;
  s.onerror = () => { s.remove(); delete scripts[src]; retry ? load(src, 0).then(ok, no) : no(new Error("cannot load " + src.split("/").pop())); };
  document.body.append(s);
});
async function demo(u, host) {
  host.innerHTML = `<p class="muted">${esc(T("ex.demo_loading"))}</p>`;
  try {
    if (!window.DemoKit) await load("/thesis/assets/explainers/_demo-kit/demo-kit.js");
    await load("/thesis/assets/explainers/" + u.demo);
    const api = (window.DEMOS || {})[u.id];
    if (!api || !api.mount) throw new Error("no demo registered for " + u.id);
    host.textContent = ""; api.mount(host);
  } catch (e) {
    host.innerHTML = `<p class="ex-novid">${esc(T("ex.demo_err", {m: e.message}))}</p>`;
  }
}

main.textContent = "";
for (const l of layers) {
  const us = byLayer.get(l.id) || []; if (!us.length) continue;
  const sec = document.createElement("section");
  sec.setAttribute("data-hx-section", ""); sec.id = "layer-" + l.id; sec.dataset.layer = l.id;
  sec.innerHTML = `<h2>${esc(layerName(l))} <span class="live-count" data-n></span></h2>${l.measures ? loc("p", E(l.measures), (I.fa && FXL[l.id] && FXL[l.id].measures && E(FXL[l.id].measures)) || null, "ex-lmeas") : ""}<div class="ex-cards"></div>`;
  us.forEach(u => sec.querySelector(".ex-cards").append(card(u)));
  main.append(sec);
}
if (!units.length) main.innerHTML = `<p class="ex-none">${esc(T("ex.nodata"))}</p>`;
const none = document.createElement("p"); none.className = "ex-none"; none.hidden = true; none.textContent = T("ex.none"); main.after(none);

// ---------- filters ----------
const $ = id => document.getElementById(id);
const opt = (sel, items) => { sel.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(""); };
opt($("ex-layer"), [["", T("ex.all")], ...layers.filter(l => (byLayer.get(l.id) || []).length).map(l => [l.id, layerName(l)])]);
opt($("ex-ev"), [["", T("ex.all")], ...[...new Set(units.map(u => u.evidence_status || "inferred"))].map(s => [s, evName(s)])]);
opt($("ex-real"), [["", T("ex.all")], ["real", T("ex.f_real")], ["toy", T("ex.toy")]]);
if (!units.some(u => u.three)) $("ex-3d").closest("label").hidden = true;
function apply() {
  const q = $("ex-q").value.trim().toLowerCase(), ly = $("ex-layer").value, ev = $("ex-ev").value, rl = $("ex-real").value, d3 = $("ex-3d").checked;
  let n = 0;
  main.querySelectorAll("section[data-layer]").forEach(sec => {
    let k = 0;
    sec.querySelectorAll(".ex-card").forEach(c => {
      const ok = (!q || c.dataset.text.includes(q)) && (!ly || c.dataset.layer === ly) && (!ev || c.dataset.ev === ev)
        && (!rl || (rl === "real" ? c.dataset.real !== "toy" : c.dataset.real === "toy")) && (!d3 || c.dataset.three);
      c.hidden = !ok; k += ok;
    });
    sec.hidden = !k; n += k;
    sec.querySelector("[data-n]").textContent = N(k);
  });
  $("ex-cnt").textContent = T("ex.count", {n: N(n), total: N(units.length)});
  none.hidden = !!n;
}
["ex-q", "ex-layer", "ex-ev", "ex-real", "ex-3d"].forEach(id => $(id).addEventListener(id === "ex-q" ? "input" : "change", apply));
$("ex-clear").onclick = () => { $("ex-q").value = ""; ["ex-layer", "ex-ev", "ex-real"].forEach(id => { $(id).value = ""; }); $("ex-3d").checked = false; apply(); };
apply();

// ---------- deep link #<id> ----------
function openHash() {
  const id = decodeURIComponent(location.hash.slice(1)), c = id && document.getElementById(id);
  if (!c || !c.classList.contains("ex-card")) return;
  if (c.hidden) $("ex-clear").click();
  const sec = c.closest("section"); if (sec && sec.classList.contains("hx-collapsed")) sec.querySelector(".hx-sec-head button[aria-expanded]")?.click();
  c.querySelector("details").open = true;
  c.classList.add("ex-hl"); setTimeout(() => c.classList.remove("ex-hl"), 1600);
  requestAnimationFrame(() => c.scrollIntoView({block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}));
}
addEventListener("hashchange", openHash);

// the layout module (collapse / reorder sections) is loaded after the sections exist
load("/thesis/assets/layout.js").catch(() => {}).finally(openHash);   // a deep link opens its card even if the module fails
})();
