/* Cohen's d demo. Real example: effect size of arm differences on the real per-question scores (n = 9 answerable questions, LLM-judged), live in the page. Toy: two invented groups (break it). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { m1: 72, s1: 10, n1: 30, m2: 66, s2: 12, n2: 30 };

  /* PURE: d = (m1 - m2) / s_p, s_p = sqrt(((n1-1) s1^2 + (n2-1) s2^2) / (n1 + n2 - 2)). NaN when s_p = 0 or n1 + n2 <= 2. */
  function pooledSd(i) { return i.n1 + i.n2 > 2 ? Math.sqrt(((i.n1 - 1) * i.s1 * i.s1 + (i.n2 - 1) * i.s2 * i.s2) / (i.n1 + i.n2 - 2)) : NaN; }
  function compute(i) { const sp = pooledSd(i); return sp > 0 ? (i.m1 - i.m2) / sp : NaN; }
  const mean = x => x.reduce((a, b) => a + b, 0) / x.length;
  const sd = x => { const m = mean(x); return x.length > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)) : NaN; };
  function stats(x1, x2) {
    const i = { m1: mean(x1), s1: sd(x1), n1: x1.length, m2: mean(x2), s2: sd(x2), n2: x2.length };
    const d = compute(i), J = 1 - 3 / (4 * (i.n1 + i.n2) - 9), diff = x1.map((v, k) => v - x2[k]), sdd = sd(diff);
    return Object.assign(i, { sp: pooledSd(i), d, hedges: d * J, J, dz: sdd > 0 ? mean(diff) / sdd : NaN });
  }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* percentile bootstrap of d: resample QUESTIONS (same indices for both arms); resamples with zero pooled spread are dropped and counted */
  function bootD(x1, x2, B, seed) {
    const r = rng(seed), n = x1.length, out = []; let dropped = 0;
    for (let b = 0; b < B; b++) { const a = [], c = []; for (let k = 0; k < n; k++) { const j = Math.floor(r() * n); a.push(x1[j]); c.push(x2[j]); } const d = stats(a, c).d; Number.isFinite(d) ? out.push(d) : dropped++; }
    out.sort((p, q) => p - q); const at = p => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
    return { lo: out.length ? at(0.025) : NaN, hi: out.length ? at(0.975) : NaN, used: out.length, dropped };
  }
  const label = d => { const a = Math.abs(d); return !Number.isFinite(d) ? 'undefined' : a < 0.2 ? 'negligible' : a < 0.5 ? 'small' : a < 0.8 ? 'medium' : 'large'; };

  /* ---------- toy ---------- */
  function bells(host, i) {
    const K = root.DemoKit, W = 560, H = 150, lo = Math.min(i.m1 - 3.5 * i.s1, i.m2 - 3.5 * i.s2), hi = Math.max(i.m1 + 3.5 * i.s1, i.m2 + 3.5 * i.s2);
    const X = v => 10 + (v - lo) / (hi - lo) * (W - 20), pdf = (v, m, s) => Math.exp(-0.5 * ((v - m) / s) ** 2) / s;
    const top = Math.max(1 / i.s1, 1 / i.s2), Y = p => H - 20 - (p / top) * (H - 40);
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:600px', role: 'img', 'aria-label': 'two overlapping normal curves for group 1 and group 2' });
    [[i.m1, i.s1, '#7C9CFF', 'group 1'], [i.m2, i.s2, '#F2A93B', 'group 2']].forEach(([m, s, c, t]) => {
      let d = ''; for (let k = 0; k <= 120; k++) { const v = lo + (hi - lo) * k / 120; d += (k ? 'L' : 'M') + X(v).toFixed(1) + ',' + Y(pdf(v, m, s)).toFixed(1); }
      svg.append(K.svg('path', { d, fill: 'none', stroke: c, 'stroke-width': 2.5 }), K.svg('line', { x1: X(m), x2: X(m), y1: 14, y2: H - 20, stroke: c, 'stroke-dasharray': '4 3' }), K.svg('text', { x: X(m) + 4, y: 24, style: 'fill:' + c }, t + ' mean ' + K.fmt(m, 2)));
    });
    svg.append(K.svg('line', { x1: 10, x2: W - 10, y1: H - 20, y2: H - 20, stroke: '#68707F' }));
    host.replaceChildren(svg);
  }
  function mountToy(el) {
    const K = root.DemoKit, st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Move the group means, spreads and sizes. d is the gap between the means measured in pooled standard deviations. Invented groups for illustration, not data.');
    const host = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), sl = {};
    const defs = [['m1', 'mean 1', 0, 100, 0.5], ['s1', 'sd 1', 0.5, 30, 0.5], ['n1', 'n 1', 2, 200, 1], ['m2', 'mean 2', 0, 100, 0.5], ['s2', 'sd 2', 0.5, 30, 0.5], ['n2', 'n 2', 2, 200, 1]];
    const rows = K.el('div', { class: 'row' });
    defs.forEach(([k, lab, mn, mx, stp]) => { sl[k] = K.slider(lab, mn, mx, stp, st[k], v => { st[k] = v; render(); }); rows.append(sl[k].node); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = o => { Object.assign(st, o); for (const k in sl) sl[k].set(st[k]); render(); };
    shell.append(host, rows, K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults)),
      btn('Break it: tiny spread, tiny gap', () => set({ m1: 98, s1: 0.8, n1: 30, m2: 96, s2: 0.8, n2: 30 })),
      btn('Break it: one outlier inflates the spread', () => set({ m1: 72, s1: 25, n1: 30, m2: 66, s2: 25, n2: 30 })),
      btn('Break it: 4 per group', () => set({ m1: 72, s1: 10, n1: 4, m2: 66, s2: 12, n2: 4 }))), res.node, formula, note);
    function render() {
      bells(host, st);
      const sp = pooledSd(st), d = compute(st);
      res.set(d, 3);
      formula.textContent = `s_p = sqrt((${st.n1 - 1} x ${K.fmt(st.s1 * st.s1, 2)} + ${st.n2 - 1} x ${K.fmt(st.s2 * st.s2, 2)}) / ${st.n1 + st.n2 - 2}) = ${K.fmt(sp, 3)}\nd = (${K.fmt(st.m1, 2)} - ${K.fmt(st.m2, 2)}) / ${K.fmt(sp, 3)} = ${K.fmt(d, 3)}   (${label(d)} by the 0.2 / 0.5 / 0.8 rule of thumb)`;
      const small = st.n1 + st.n2 < 40;
      note.className = 'hint' + ((Math.abs(st.m1 - st.m2) < 3 && Math.abs(d) >= 0.8) || small ? ' bad' : '');
      note.textContent = (Math.abs(st.m1 - st.m2) < 3 && Math.abs(d) >= 0.8 ? 'A two-point gap is a "large" effect only because the spread is tiny: d ignores whether the gap matters. ' : '') + (small ? 'Only ' + (st.n1 + st.n2) + ' people in total: d is unstable and biased upward a little (Hedges correction ' + K.fmt(1 - 3 / (4 * (st.n1 + st.n2) - 9), 3) + '). ' : '') + 'd says nothing about significance by itself.';
    }
    render();
  }

  /* ---------- real ---------- */
  const CMP = [
    ['Faithfulness: arm B (hybrid top-5) minus arm A (no retrieval)', 'faithfulness_A', 'B', 'A'],
    ['Faithfulness: arm C (dense + graph) minus arm B', 'faithfulness_A', 'C', 'B'],
    ['Faithfulness: arm C minus arm A', 'faithfulness_A', 'C', 'A'],
    ['Answer correctness: arm B minus arm A', 'correctness', 'B', 'A'],
    ['Answer correctness: arm C minus arm B', 'correctness', 'C', 'B'],
    ['Answer correctness: arm C minus arm A', 'correctness', 'C', 'A']];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = fetch(base + 'answers/per_question.json').then(r => { if (!r.ok) throw new Error('per_question.json ' + r.status); return r.json(); });
    return realData;
  }
  const ANSWERABLE = ['q01', 'q04', 'q06', 'q08', 'q18', 'q20', 'q09', 'q10', 'q16'];
  function series(rows, arm, key) { const m = {}; rows.filter(r => r.arm === arm).forEach(r => { m[r.qid] = r[key]; }); return ANSWERABLE.map(q => m[q]); }

  function strip(host, qids, x1, x2, an, bn) {
    const K = root.DemoKit, W = 560, H = 120, X = v => 40 + v * (W - 60);
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:600px', role: 'img', 'aria-label': 'per-question scores of two arms on a 0 to 1 axis' });
    svg.append(K.svg('line', { x1: X(0), x2: X(1), y1: 100, y2: 100, stroke: '#68707F' }));
    [0, 0.5, 1].forEach(t => svg.append(K.svg('text', { x: X(t), y: 114, 'text-anchor': 'middle' }, String(t))));
    [[x1, 30, '#7C9CFF', 'arm ' + an], [x2, 70, '#F2A93B', 'arm ' + bn]].forEach(([xs, y, c, t]) => {
      svg.append(K.svg('text', { x: 4, y: y + 4, style: 'fill:' + c }, t.slice(-1)));
      const seen = {};
      xs.forEach((v, k) => { const key = v.toFixed(3); seen[key] = (seen[key] || 0) + 1; svg.append(K.svg('circle', { cx: X(v), cy: y - (seen[key] - 1) * 7, r: 5, fill: c, 'fill-opacity': 0.8 }, K.svg('title', {}, qids[k] + ': ' + K.fmt(v, 3)))); });
      const m = mean(xs); svg.append(K.svg('line', { x1: X(m), x2: X(m), y1: y - 22, y2: y + 12, stroke: c, 'stroke-width': 2.5 }));
    });
    host.replaceChildren(svg);
  }
  function mountReal(el, rows) {
    const K = root.DemoKit, st = { i: 0 };
    const shell = K.shell(el, 'Real example: effect sizes of the arm differences (9 answerable questions)',
      'Real per-question scores from the answer study: 12 questions, 3 arms (A no retrieval, B hybrid top-5, C dense + graph), answerer qwen3.7-plus, scores judged by an LLM (deepseek-v4.1-flash for faithfulness). The 3 unanswerable questions are left out (arms B and C refused, so they have no faithfulness). n = 9 per arm and the same questions in both arms: demo scale, not a benchmark. Everything below is computed in this page.');
    const sel = K.el('select', { 'aria-label': 'comparison', style: 'max-width:100%' }); CMP.forEach((c, k) => sel.append(K.el('option', { value: k }, c[0])));
    sel.addEventListener('change', () => { st.i = Number(sel.value); render(); });
    const host = K.el('div'), res = K.el('div', { class: 'row' }), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), tbl = K.el('div'), note = K.el('p', { class: 'hint bad' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', { style: 'max-width:100%' }, 'Comparison ', sel)), host, res, formula, K.el('details', {}, K.el('summary', {}, 'The 9 per-question scores'), tbl), note);
    function render() {
      const [, key, a, b] = CMP[st.i], x1 = series(rows, a, key), x2 = series(rows, b, key);
      const s = stats(x1, x2), bt = bootD(x1, x2, 5000, 7), fm = (x, d = 2) => Number.isFinite(x) ? K.fmt(x, d) : 'undefined';
      strip(host, ANSWERABLE, x1, x2, a, b);
      const cell = (t, v, c) => K.el('div', {}, K.el('span', { class: 'hint' }, t), K.el('div', { class: 'result num', style: c ? 'color:' + c : '' }, v));
      res.replaceChildren(cell('d (pooled sd)', fm(s.d), ''), cell('95% interval of d', '[' + fm(bt.lo) + ', ' + fm(bt.hi) + ']', 'var(--k12)'), cell("Hedges' g", fm(s.hedges)), cell('d_z (paired)', fm(s.dz)));
      formula.textContent = `arm ${a}: mean ${fm(s.m1, 3)}, sd ${fm(s.s1, 3)}, n ${s.n1}     arm ${b}: mean ${fm(s.m2, 3)}, sd ${fm(s.s2, 3)}, n ${s.n2}\ns_p = sqrt((${s.n1 - 1} x ${fm(s.s1 * s.s1, 4)} + ${s.n2 - 1} x ${fm(s.s2 * s.s2, 4)}) / ${s.n1 + s.n2 - 2}) = ${fm(s.sp, 3)}\nd = (${fm(s.m1, 3)} - ${fm(s.m2, 3)}) / ${fm(s.sp, 3)} = ${fm(s.d, 3)}  (${label(s.d)})\ninterval: percentile bootstrap over questions, 5,000 resamples, seed 7` + (bt.dropped ? `, ${bt.dropped} resamples dropped (zero spread)` : '');
      tbl.replaceChildren(K.el('table', {}, K.el('tr', {}, K.el('th', {}, 'question'), K.el('th', {}, 'arm ' + a), K.el('th', {}, 'arm ' + b)), ...ANSWERABLE.map((q, k) => K.el('tr', {}, K.el('td', {}, q), K.el('td', { class: 'num' }, fm(x1[k], 3)), K.el('td', { class: 'num' }, fm(x2[k], 3))))));
      const wide = Number.isFinite(bt.lo) && bt.lo < 0 && bt.hi > 0;
      note.textContent = (wide ? 'The interval contains 0: with 9 questions this difference cannot be told from no difference. ' : '') + 'd on 9 questions is noisy (the interval is wide) and the scores come from an LLM judge, not from people. Several scores sit at the ceiling of 1.0, which shrinks the spread and can inflate d. Arm C also gets about 40% more context than B, so B vs C is not a clean test of the graph. A learning-gain effect size for the thesis needs real students and a real pre/post design (see normalized_gain); this is the same arithmetic on a different, much smaller thing.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, stats, bootD, series: (rows, a, k) => series(rows, a, k), ANSWERABLE, CMP };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['cohens_d'] = api;
})(this);
