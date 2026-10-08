/* Cost-normalised accuracy: toy ratio; real example = accuracy vs cost of the three answer-study arms with n=12 intervals and a Pareto plot. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { vector: { acc: 0.62, usd: 0.0024 }, graph: { acc: 0.68, usd: 0.0090 } };

  /* PURE: AccPerUSD = Acc / mean cost per query, per system */
  function compute(inp) {
    const r = {};
    for (const k of Object.keys(inp)) r[k] = Math.round(10 * inp[k].acc / inp[k].usd) / 10;
    return r;
  }

  /* seeded bootstrap of the mean (mulberry32), pure */
  function bootMean(xs, B, seed) {
    let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const m = [], n = xs.length;
    for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += xs[Math.floor(rnd() * n)]; m.push(s / n); }
    m.sort((x, y) => x - y);
    return [m[Math.floor(0.025 * B)], m[Math.min(B - 1, Math.floor(0.975 * B))]];
  }
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

  function mountToy(el) {
    const K = root.DemoKit;
    const st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it)', 'Illustrative numbers, not measured. Move accuracy and cost of each system; the ratio and the iso-ratio picture follow.');
    const res = K.resultBox(); const res2 = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const S = {};
    const mk = (sys, key, label, min, max, step) => { S[sys + key] = K.slider(label, min, max, step, st[sys][key], v => { st[sys][key] = v; render(); }); return K.el('div', { class: 'row' }, S[sys + key].node); };
    const set = o => { for (const s of ['vector', 'graph']) { Object.assign(st[s], o[s]); S[s + 'acc'].set(st[s].acc); S[s + 'usd'].set(st[s].usd); } render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Worked example', () => set(JSON.parse(JSON.stringify(defaults)))),
      btn('Break it: a cheap wrong system wins', () => set({ vector: { acc: 0.62, usd: 0.0024 }, graph: { acc: 0.05, usd: 0.00005 } })));
    const W = 600, H = 220, svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'accuracy versus cost' });
    shell.append(presets, mk('vector', 'acc', 'vector accuracy', 0, 1, 0.01), mk('vector', 'usd', 'vector USD / answer', 0.00001, 0.02, 0.00005), mk('graph', 'acc', 'graph accuracy', 0, 1, 0.01), mk('graph', 'usd', 'graph USD / answer', 0.00001, 0.02, 0.00005),
      K.el('div', { class: 'row' }, K.el('span', { class: 'hint' }, 'vector'), res.node, K.el('span', { class: 'hint' }, 'graph'), res2.node, K.el('span', { class: 'hint' }, 'correct answers per USD')), svg, formula, note);
    function render() {
      const r = compute(st); res.set(r.vector, 1); res2.set(r.graph, 1);
      svg.replaceChildren();
      const xm = Math.max(st.vector.usd, st.graph.usd, 0.001) * 1.2, X = c => 40 + (W - 60) * c / xm, Y = a => H - 30 - (H - 50) * a;
      svg.append(K.svg('line', { x1: 40, x2: W - 20, y1: H - 30, y2: H - 30, stroke: '#242B38' }), K.svg('line', { x1: 40, x2: 40, y1: 10, y2: H - 30, stroke: '#242B38' }),
        K.svg('text', { x: W / 2, y: H - 8, 'text-anchor': 'middle' }, 'USD per answer'), K.svg('text', { x: 4, y: 20 }, 'acc'));
      for (const [k, c, col] of [['vector', 'Vector', '#7C9CFF'], ['graph', 'Graph', '#F2A93B']]) {
        const p = st[k]; svg.append(K.svg('line', { x1: X(0), y1: Y(0), x2: X(Math.min(xm, 1 / (r[k] || 1) * 1)), y2: Y(Math.min(1, r[k] * xm)), stroke: col, 'stroke-opacity': .35, 'stroke-dasharray': '4 3' }),
          K.svg('circle', { cx: X(p.usd), cy: Y(p.acc), r: 7, fill: col }), K.svg('text', { x: X(p.usd) + 10, y: Y(p.acc) + 4 }, c + ' ' + K.fmt(r[k], 1)));
      }
      formula.textContent = `vector: ${st.vector.acc} / ${st.vector.usd} = ${K.fmt(r.vector, 1)}\ngraph:  ${st.graph.acc} / ${st.graph.usd} = ${K.fmt(r.graph, 1)}   (dashed lines: all points with the same ratio)`;
      note.textContent = 'The ratio hides absolute levels: a system with accuracy 0.05 at almost zero cost scores huge. Read accuracy and cost side by side, then the ratio. The 0.0090 USD graph cost is illustrative, not measured.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/per_question.json'), get('metrics/accuracy_per_dollar.json')]).then(a => ({ pq: a[0], m: a[1] }));
    return realData;
  }

  const MEASURES = {
    corr: ['Answer correctness, 9 answerable questions', r => r.type !== 'unanswerable' ? r.correctness : null],
    corr_all: ['Correctness on all 12 (a refusal of an unanswerable counts as correct)', r => r.correctness],
    faith: ['Faithfulness (judge A, pool; A over 12, B and C over the 9 answerable)', r => r.faithfulness_A],
  };

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'corr' };
    const shell = K.shell(el, 'Real example: three arms, accuracy against real cost',
      'Scale: n = 12 questions (9 answerable), one run, temperature 0, LLM judges, no human labels: the intervals are wide. Cost = answer model only (' + D.m.answer_model + '), from real token usage. Arm C gets about 40% more context than B (620 vs 416 words) and starts from a different first-stage list, so cost differences are partly the context size and B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'accuracy measure', style: 'width:100%;max-width:100%;box-sizing:border-box' }, Object.keys(MEASURES).map(k => opt(k, MEASURES[k][0])));
    mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    const tbl = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const W = 600, H = 260, svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'accuracy versus cost per arm with intervals' });
    const note = K.el('p', { class: 'hint', 'aria-live': 'polite' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'accuracy measure ', mSel)), svg, tbl, note);
    const cols = { A: '#98A0B0', B: '#7C9CFF', C: '#F2A93B' };
    function render() {
      const f = MEASURES[st.m][1], out = {};
      for (const a of 'ABC') {
        const rows = D.pq.filter(r => r.arm === a), xs = rows.map(f).filter(v => v !== null && v !== undefined);
        const usd = mean(rows.map(r => r.usd_answer)), acc = mean(xs), ci = bootMean(xs, 10000, 7);
        out[a] = { n: xs.length, acc, ci, usd, ratio: acc / usd, rlo: ci[0] / usd, rhi: ci[1] / usd };
      }
      svg.replaceChildren();
      const xm = 0.0004, X = c => 50 + (W - 80) * c / xm, Y = v => H - 40 - (H - 70) * v;
      svg.append(K.svg('line', { x1: 50, x2: W - 20, y1: H - 40, y2: H - 40, stroke: '#242B38' }), K.svg('line', { x1: 50, x2: 50, y1: 10, y2: H - 40, stroke: '#242B38' }),
        K.svg('text', { x: W / 2, y: H - 8, 'text-anchor': 'middle' }, 'USD per answer (mean of 12)'), K.svg('text', { x: 4, y: 14 }, 'accuracy'));
      for (const c of [0.0001, 0.0002, 0.0003, 0.0004]) svg.append(K.svg('text', { x: X(c), y: H - 24, 'text-anchor': 'middle' }, '$' + c));
      for (const v of [0, 0.5, 1]) svg.append(K.svg('text', { x: 46, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
      const mx = Math.max(...Object.values(out).map(o => o.ratio));
      for (const k of [0.25, 0.5, 1]) { const rr = mx * k; svg.append(K.svg('line', { x1: X(0), y1: Y(0), x2: X(Math.min(xm, 1 / rr)), y2: Y(Math.min(1, rr * xm)), stroke: '#68707F', 'stroke-opacity': .5, 'stroke-dasharray': '3 4' })); }
      const dom = (o, p) => p.acc >= o.acc && p.usd <= o.usd && (p.acc > o.acc || p.usd < o.usd);
      for (const a of 'ABC') {
        const o = out[a], dominated = 'ABC'.split('').some(b => b !== a && dom(o, out[b]));
        svg.append(K.svg('line', { x1: X(o.usd), x2: X(o.usd), y1: Y(o.ci[0]), y2: Y(o.ci[1]), stroke: cols[a], 'stroke-width': 3, 'stroke-opacity': .6 }),
          K.svg('circle', { cx: X(o.usd), cy: Y(o.acc), r: 8, fill: dominated ? 'none' : cols[a], stroke: cols[a], 'stroke-width': 2 }),
          K.svg('text', { x: X(o.usd) + 12, y: Y(o.acc) + 4 }, a + (dominated ? ' (dominated)' : ' (on the front)')));
        o.dominated = dominated;
      }
      const fx = (v, d) => K.fmt(v, d);
      tbl.textContent = 'arm    n   accuracy [95% interval]        USD/answer   acc per USD [interval]\n' +
        'ABC'.split('').map(a => { const o = out[a]; return `${a}     ${String(o.n).padEnd(3)} ${fx(o.acc, 3)} [${fx(o.ci[0], 2)}, ${fx(o.ci[1], 2)}]`.padEnd(46) + `${fx(o.usd, 6)}   ${fx(o.ratio, 0)} [${fx(o.rlo, 0)}, ${fx(o.rhi, 0)}]`; }).join('\n') +
        `\nformula: Acc / mean USD. Pack value for correctness, 9 answerable: A ${D.m.per_arm.A.accuracy_per_dollar}, B ${D.m.per_arm.B.accuracy_per_dollar}, C ${D.m.per_arm.C.accuracy_per_dollar}.\nInterval of the ratio = interval of accuracy / mean cost (cost treated as fixed; page bootstrap, 10,000 resamples, seed 7).`;
      const top = 'ABC'.split('').sort((a, b) => out[b].ratio - out[a].ratio)[0];
      const ov = (x, y) => !(out[x].ci[1] < out[y].ci[0] || out[y].ci[1] < out[x].ci[0]);
      note.textContent = `Highest accuracy per dollar: arm ${top}. ` + (st.m === 'corr'
        ? 'Arm A wins because it is cheapest and, on the 9 answerable questions, its parametric knowledge scores 0.94: the corpus is textbook material the model already knows. Yet A refuses 0 of 3 unanswerable questions and only 0.47 of its claims are supported by the corpus sample. The ratio alone would pick the arm that has no retrieval at all: that is the blind spot. The accuracy intervals of A, B and C ' + (ov('A', 'B') && ov('B', 'C') ? 'all overlap' : 'do not all overlap') + ' at n = 9.'
        : st.m === 'corr_all' ? 'Counting a correct refusal as correct removes A\'s advantage in accuracy (A fails the 3 unanswerables) and ranks C highest on accuracy, but the cost ranking still favours A. Changing what "accuracy" means moves the answer: state the measure beside the ratio.'
        : 'Faithfulness separates the arms far more than correctness (A about 0.47, B 0.94, C 0.97): B and C ground their claims in the corpus, A does not. Even so, A is cheap enough (about 2.4x less than B) that its faithfulness per dollar stays highest here, so the ratio alone still rewards the arm without retrieval. C is about as faithful as B for about 27% more money, partly its larger context; C minus B is not distinguishable from zero.');
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
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['accuracy_per_dollar'] = api;
})(this);
