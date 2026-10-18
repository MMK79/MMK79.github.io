// Shared by the explainer pages and the Foundations pages (Brief M): LaTeX -> readable Unicode, and the Origin block (provenance record,
// Brief I). Moved out of explainers.js so there is ONE implementation; explainers.js and foundations.js call window.EXS.
(() => {
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
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

const pl = p => p ? [p.doi && `<a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener">DOI</a>`, p.arxiv && `<a href="https://arxiv.org/abs/${esc(String(p.arxiv).replace(/^arxiv:/i, ""))}" target="_blank" rel="noopener">arXiv</a>`,
  !p.doi && !p.arxiv && p.url && `<a href="${esc(p.url)}" target="_blank" rel="noopener">link</a>`].filter(Boolean).join(" · ") : "";
const au = a => { const n = (a || []).map(x => String(x).split(",")[0]); return n.length > 2 ? n[0] + " et al." : n.join(" & "); };

function originBlock(r, T, N, esc) {
  const p = r.introduced_by, badge = `<span class="ex-tag ex-pv pv-${esc(r.status)}">${esc(T("so.status_" + r.status))}</span>`;
  const cites = p && p.citations && p.citations.value != null ? ` · ${esc(T("ex.o_cites", {n: N(Number(p.citations.value).toLocaleString("en")), src: p.citations.source}))}` : "";
  const body = p ? `<p lang="en" dir="ltr">${esc(au(p.authors))} (${esc(p.year)}). <i>${esc(p.title)}</i>${p.venue ? `, ${esc(p.venue)}` : ""}. ${pl(p)}${cites}</p>${p.why ? `<p class="ex-src" lang="en" dir="ltr">${esc(p.why)}</p>` : ""}`
    : `<p class="ex-src">${esc(T("so.no_origin"))}</p>`;
  const also = (r.also_cite || []).slice(0, 4).map(a => `<li lang="en" dir="ltr">${[au(a.authors), a.year && `(${a.year})`].filter(Boolean).map(esc).join(" ")}${au(a.authors) || a.year ? ". " : ""}<i>${esc(a.title)}</i>${a.venue ? `, ${esc(a.venue)}` : ""} ${pl(a)}</li>`).join("");
  return `<div class="ex-blk ex-origin"><h4>${esc(T("ex.h_origin"))} ${badge}</h4>${body}${also ? `<h5>${esc(T("ex.o_also"))}</h5><ul>${also}</ul>` : ""}
    ${r.notes ? `<p class="ex-src" lang="en" dir="ltr">${esc(r.notes)}</p>` : ""}<p class="ex-src"><a href="/thesis/sources.html">${esc(T("ex.o_all"))}</a></p></div>`;
}

window.EXS = {tex, originBlock, pl, au};
})();
