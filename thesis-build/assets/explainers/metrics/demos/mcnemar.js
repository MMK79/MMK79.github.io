/* McNemar test demo: real paired binary outcomes of two answer arms on 12 questions -> 2x2 table, exact binomial and chi-square p, power at n = 12. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { b: 15, c: 5 };   // toy: A right/B wrong = 15, A wrong/B right = 5 (catalogue worked example)

  /* ---- maths (pure) ---- */
  function erfc(x) {            // Numerical Recipes erfcc, relative error < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function logC(n, k) { let s = 0; for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i); return s; }
  /* exact two-sided binomial p: 2 * P(X <= min(b,c)), X ~ Bin(b+c, 1/2), capped at 1 */
  function exactP(b, c) {
    const n = b + c; if (n === 0) return 1;
    const k = Math.min(b, c); let s = 0;
    for (let i = 0; i <= k; i++) s += Math.exp(logC(n, i) - n * Math.LN2);
    return Math.min(1, 2 * s);
  }
  function chiP(b, c, cc) {     // cc = continuity correction (the catalogue formula uses it)
    const n = b + c; if (n === 0) return { chi2: 0, p: 1 };
    const d = Math.max(0, Math.abs(b - c) - (cc ? 1 : 0)), chi2 = d * d / n;
    return { chi2, p: erfc(Math.sqrt(chi2 / 2)) };
  }
  const r3 = x => Math.round(x * 1000) / 1000;
  /* PURE: catalogue formula, chi2 = (|b-c|-1)^2/(b+c), p = erfc(sqrt(chi2/2)) */
  function compute(inp) { const r = chiP(inp.b, inp.c, true); return { chi2: Math.round(r.chi2 * 100) / 100, p: r3(r.p) }; }
  /* PURE: chance that the exact test gives p < alpha with n questions, if each question is "only X good" with prob pb, "only Y good" with pc */
  function power(n, pb, pc, alpha) {
    alpha = alpha || 0.05; let tot = 0;
    for (let b = 0; b <= n; b++) for (let c = 0; b + c <= n; c++) {
      if (exactP(b, c) >= alpha) continue;
      const lp = logC(n, b) + logC(n - b, c) + (pb > 0 ? b * Math.log(pb) : (b ? -Infinity : 0)) + (pc > 0 ? c * Math.log(pc) : (c ? -Infinity : 0)) + ((n - b - c) ? (n - b - c) * Math.log(Math.max(1e-300, 1 - pb - pc)) : 0);
      tot += Math.exp(lp);
    }
    return Math.min(1, tot);
  }
  /* smallest number of one-sided discordant pairs that gives exact p < alpha */
  function minDiscordant(alpha) { for (let n = 1; n < 60; n++) if (exactP(n, 0) < (alpha || 0.05)) return n; return null; }

  /* ---- real data ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = fetch(base + 'answers/per_question.json').then(r => { if (!r.ok) throw new Error('per_question.json ' + r.status); return r.json(); });
    return realData;
  }
  const OUTCOMES = {
    correct: { label: 'answer is right (or correctly refused)', f: r => r.type === 'unanswerable' ? !!r.refused : r.correctness === 1 },
    free: { label: 'no hallucinated claims (judge A)', f: r => r.hallucinated !== 1 },
  };
  const ARMS = { A: 'A no retrieval', B: 'B hybrid RRF top-5', C: 'C dense top-5 + graph' };

  function table(inp) {   // inp: array of [xGood, yGood]
    let both = 0, b = 0, c = 0, neither = 0;
    for (const [x, y] of inp) { if (x && y) both++; else if (x) b++; else if (y) c++; else neither++; }
    return { both, b, c, neither };
  }
  const sg = v => v < 0.0005 ? '< 0.001' : String(Math.round(v * 1000) / 1000);

  function statsNode(K, t, extra) {
    const { b, c } = t, n = b + c, ex = exactP(b, c), cc = chiP(b, c, true), pl = chiP(b, c, false);
    const verdict = n === 0 ? 'No discordant pairs: the test has nothing to compare.' : ex < 0.05 ? `Exact p = ${sg(ex)} < 0.05: the arms differ on these questions.` : `Exact p = ${sg(ex)} >= 0.05: cannot tell the arms apart.`;
    const box = K.el('div');
    box.append(K.el('div', { class: 'formula', 'aria-live': 'polite' },
      `b (X only) = ${b}, c (Y only) = ${c}, discordant b + c = ${n}   (the ${t.both + t.neither} questions both or neither get right carry no information)\n` +
      `chi2 = (|${b} - ${c}| - 1)^2 / ${n} = ${n ? K.fmt(cc.chi2, 3) : '-'}   ->  p = erfc(sqrt(chi2/2)) = ${n ? sg(cc.p) : '1'}\n` +
      `without the "-1" correction: chi2 = ${n ? K.fmt(pl.chi2, 3) : '-'}  ->  p = ${n ? sg(pl.p) : '1'}\n` +
      `exact binomial: p = 2 x P(X <= ${Math.min(b, c)}), X ~ Bin(${n}, 1/2) = ${sg(ex)}`));
    box.append(K.el('p', { class: ex < 0.05 ? 'good' : 'bad' }, verdict));
    if (extra) box.append(extra);
    return { node: box, ex, cc, pl };
  }

  function gauge(K, ex, cc, pl) {   // p-value bars on a log-ish scale, line at 0.05
    const W = 600, svg = K.svg('svg', { viewBox: '0 0 600 110', width: '100%', role: 'img', 'aria-label': 'p-values of the three versions of the test' });
    const X = p => 90 + (1 - Math.min(1, Math.max(0, p))) * 0 + Math.min(1, p) * 470;
    [['exact', ex, 'var(--he)'], ['chi2 (corrected)', cc, 'var(--ai)'], ['chi2 (plain)', pl, 'var(--warn)']].forEach(([n, p, col], i) => {
      const y = 12 + i * 28;
      svg.append(K.svg('text', { x: 0, y: y + 13 }, n));
      svg.append(K.svg('rect', { x: 90, y, width: 470, height: 16, fill: 'var(--panel2)', stroke: 'var(--line)' }));
      svg.append(K.svg('rect', { x: 90, y, width: Math.max(2, X(p) - 90), height: 16, fill: col, opacity: 0.8 }));
      svg.append(K.svg('text', { x: Math.min(X(p) + 4, 520), y: y + 13 }, sg(p)));
    });
    svg.append(K.svg('line', { x1: X(0.05), x2: X(0.05), y1: 6, y2: 98, stroke: 'var(--text)', 'stroke-dasharray': '4 3' }));
    svg.append(K.svg('text', { x: X(0.05) + 4, y: 106 }, 'p = 0.05'));
    svg.append(K.svg('text', { x: 90, y: 106 }, '0'));
    svg.append(K.svg('text', { x: 548, y: 106 }, '1'));
    return svg;
  }

  function powerBlock(K, t, nq) {
    const need = minDiscordant(0.05), box = K.el('div');
    const st = { pb: Math.round(t.b / nq * 100) / 100, pc: Math.round(t.c / nq * 100) / 100 };
    const out = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const sb = K.slider('share "only X right" (%)', 0, 100, 1, Math.round(st.pb * 100), v => { st.pb = v / 100; upd(); });
    const sc = K.slider('share "only Y right" (%)', 0, 100, 1, Math.round(st.pc * 100), v => { st.pc = v / 100; upd(); });
    function upd() {
      if (st.pb + st.pc > 1) { out.textContent = 'The two shares add up to more than 100 %.'; return; }
      const pw = power(nq, st.pb, st.pc);
      out.textContent = `Power with n = ${nq} questions if ${Math.round(st.pb * 100)} % of questions favour X only and ${Math.round(st.pc * 100)} % favour Y only:\n` +
        `P(exact p < 0.05) = ${K.fmt(pw * 100, 1)} %   (computed by summing the exact multinomial over all (b, c) outcomes)`;
    }
    upd();
    box.append(K.el('h4', {}, 'Power at this size'),
      K.el('p', { class: 'hint' }, `With n = ${nq} the exact test cannot reach p < 0.05 unless at least ${need} questions are discordant AND they all point the same way (${need} vs 0: p = ${sg(exactP(need, 0))}; 5 vs 0 gives ${sg(exactP(5, 0))}). Set the shares to the observed rates and see how often a real difference of that size would be detected.`),
      K.el('div', { class: 'row' }, sb.node, sc.node), out);
    return box;
  }

  function mountReal(el, rows) {
    const K = root.DemoKit;
    const qids = [...new Set(rows.map(r => r.qid))].sort();
    const get = (q, a) => rows.find(r => r.qid === q && r.arm === a);
    const st = { o: 'correct', x: 'C', y: 'B', flip: {} };
    const shell = K.shell(el, 'Real example: McNemar test on 12 questions, two arms',
      'Scale: n = 12 questions, one run, temperature 0, LLM judges (not humans), helper-written questions. X and Y are two of the three answer arms; each question is judged right or not for each arm. Arm C gets about 40% more context than B (620 vs 416 words), so C vs B does not isolate the graph. This shows how the test behaves at demo scale, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const oSel = K.el('select', { 'aria-label': 'outcome', style: 'max-width:62vw' }, Object.keys(OUTCOMES).map(k => opt(k, OUTCOMES[k].label)));
    const xSel = K.el('select', { 'aria-label': 'arm X' }, Object.keys(ARMS).map(k => opt(k, ARMS[k])));
    const ySel = K.el('select', { 'aria-label': 'arm Y' }, Object.keys(ARMS).map(k => opt(k, ARMS[k])));
    xSel.value = st.x; ySel.value = st.y;
    const reset = () => { st.flip = {}; render(); };
    oSel.addEventListener('change', () => { st.o = oSel.value; reset(); });
    xSel.addEventListener('change', () => { st.x = xSel.value; reset(); });
    ySel.addEventListener('change', () => { st.y = ySel.value; reset(); });
    const pre = K.el('div', { class: 'row' },
      K.el('button', { type: 'button', onclick: () => { st.o = 'correct'; st.x = 'C'; st.y = 'B'; oSel.value = 'correct'; xSel.value = 'C'; ySel.value = 'B'; reset(); } }, 'Real: C vs B, right answers (weak)'),
      K.el('button', { type: 'button', onclick: () => { st.o = 'free'; st.x = 'B'; st.y = 'A'; oSel.value = 'free'; xSel.value = 'B'; ySel.value = 'A'; reset(); } }, 'Real: B vs A, no hallucination (strong)'),
      K.el('button', { type: 'button', onclick: reset }, 'Undo my flips'));
    const grid = K.el('div'), tbl = K.el('div'), stats = K.el('div'), gv = K.el('div'), pw = K.el('div'), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'outcome ', oSel)), K.el('div', { class: 'row' }, K.el('label', {}, 'X ', xSel), K.el('label', {}, 'Y ', ySel)), pre,
      K.el('p', { class: 'hint' }, 'Click a cell to flip one question for one arm and watch the table and the p-values move.'), grid, tbl, stats, gv, pw, note);

    function render() {
      const f = OUTCOMES[st.o].f;
      const val = (q, a) => { const k = q + a; return k in st.flip ? st.flip[k] : f(get(q, a)); };
      const sel = qids.map(q => [val(q, st.x), val(q, st.y)]);
      const t = table(sel);
      /* per-question grid */
      const tb = K.el('table', { 'aria-label': 'per-question outcomes' });
      tb.append(K.el('tr', {}, K.el('th', {}, 'question'), K.el('th', {}, 'X = ' + st.x), K.el('th', {}, 'Y = ' + st.y), K.el('th', {}, 'cell')));
      qids.forEach((q, i) => {
        const [xv, yv] = sel[i], ty = get(q, 'A').type, cell = xv && yv ? 'both' : xv ? 'X only' : yv ? 'Y only' : 'neither';
        const btn = (arm, v) => K.el('button', { type: 'button', 'aria-pressed': v ? 'true' : 'false', title: `${q}, arm ${arm}: ${v ? 'right' : 'not right'} (click to flip)`, style: 'min-width:48px;padding:4px 6px', onclick: () => { st.flip[q + arm] = !v; render(); } }, v ? 'right' : 'not');
        tb.append(K.el('tr', {}, K.el('td', { class: 'num', title: ty }, q + ' ' + ty.slice(0, 4)), K.el('td', {}, btn(st.x, xv)), K.el('td', {}, btn(st.y, yv)),
          K.el('td', { class: cell === 'both' || cell === 'neither' ? 'hint' : (cell === 'X only' ? 'good' : 'bad') }, cell)));
      });
      grid.replaceChildren(K.el('details', { open: '' }, K.el('summary', {}, '12 questions'), tb));
      /* 2x2 */
      const c2 = (v, cls) => K.el('td', { class: 'num ' + (cls || ''), style: 'text-align:center;font-size:20px' }, String(v));
      tbl.replaceChildren(K.el('table', { 'aria-label': '2 by 2 table' },
        K.el('tr', {}, K.el('th', {}), K.el('th', { style: 'text-align:center' }, `Y right`), K.el('th', { style: 'text-align:center' }, `Y not right`)),
        K.el('tr', {}, K.el('th', {}, `X right`), c2(t.both), c2(t.b, 'good')),
        K.el('tr', {}, K.el('th', {}, `X not right`), c2(t.c, 'bad'), c2(t.neither))));
      const s = statsNode(K, t);
      stats.replaceChildren(s.node);
      gv.replaceChildren(gauge(K, s.ex, s.cc.p, s.pl.p));
      pw.replaceChildren(powerBlock(K, t, qids.length));
      const disc = t.b + t.c;
      note.textContent = (disc < 6 ? `Only ${disc} of 12 questions are discordant. Even if all of them went one way the exact test would need at least ${minDiscordant(0.05)}, so a p-value near 1 here means "no power", not "the arms are equal". ` : '') +
        (st.o === 'correct' ? 'Right answers: arm A answers every answerable question but invents on the 3 unanswerable ones; B and C refuse those. The two kinds of discordant pair cancel, which a mean score also hides. ' : 'Hallucination-free: one-sided and large (9 vs 0), the one place where n = 12 is enough. q09 in B is a refusal that judge A still flagged (meta-claims), counted here as the pack labels it. ') +
        'McNemar only uses binary outcomes; partial scores (0.5) are collapsed to "not right" here.';
    }
    render();
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { b: defaults.b, c: defaults.c };
    const shell = K.shell(el, 'McNemar test (toy numbers)', 'Set how many questions only system A got right (b) and only system B got right (c). Questions both or neither get right do not enter the test.');
    const bS = K.slider('b = A right, B wrong', 0, 60, 1, st.b, v => { st.b = v; render(); });
    const cS = K.slider('c = A wrong, B right', 0, 60, 1, st.c, v => { st.c = v; render(); });
    const sync = () => { bS.set(st.b); cS.set(st.c); render(); };
    const pre = K.el('div', { class: 'row' },
      K.el('button', { type: 'button', onclick: () => { st.b = 15; st.c = 5; sync(); } }, 'Worked example (15 vs 5 of 100)'),
      K.el('button', { type: 'button', onclick: () => { st.b = 4; st.c = 0; sync(); } }, 'Break it: 4 vs 0 (plain chi2 says significant)'),
      K.el('button', { type: 'button', onclick: () => { st.b = 5; st.c = 5; sync(); } }, '5 vs 5 (no difference)'));
    const res = K.resultBox(), body = K.el('div'), gv = K.el('div'), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, bS.node, cS.node), pre, K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' p (catalogue formula)')), body, gv, note);
    function render() {
      const r = chiP(st.b, st.c, true); res.set(r.p, 3);
      const s = statsNode(K, { b: st.b, c: st.c, both: 0, neither: 0 });
      body.replaceChildren(s.node); gv.replaceChildren(gauge(K, s.ex, s.cc.p, s.pl.p));
      note.textContent = st.b + st.c < 25 ? 'Break it: with fewer than 25 discordant pairs the chi-square approximation is unreliable. Use the exact binomial p. 4 vs 0: the plain chi-square p is 0.046, the exact p is 0.125.' : 'With many discordant pairs the three versions agree closely.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(rows => { body.replaceChildren(); mountReal(body, rows); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, exactP, chiP, power, minDiscordant };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['mcnemar'] = api;
})(this);
