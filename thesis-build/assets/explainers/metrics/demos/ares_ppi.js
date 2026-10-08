/* ARES / prediction-powered inference demo.
   Real example (default): judge A (cheap predictor) on every claim, judge B as a STAND-IN for human labels on a small subset.
   The pack has NO human labels, so this shows the mechanics of the correction, not a validity result.
   Toy example: the catalogue's 1,000 unlabelled + 100 labelled worked example. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  /* toy defaults reproduce worked_example.result = 0.70 - (0.72 - 0.68) = 0.66; `disagree` only feeds the interval */
  const defaults = { N: 1000, fUnl: 0.70, n: 100, fLab: 0.72, yLab: 0.68, disagree: 0.20, z: 1.96 };

  /* PURE: PPI point estimate = judge mean on unlabelled - rectifier (judge mean - label mean on labelled) */
  function compute(inp) { return inp.fUnl - (inp.fLab - inp.yLab); }
  /* PURE: estimate, rectifier and normal-approximation interval from summary numbers */
  function ppiSummary(inp) {
    const rect = inp.fLab - inp.yLab, est = inp.fUnl - rect;
    const vf = inp.fUnl * (1 - inp.fUnl), vd = Math.max(0, inp.disagree - rect * rect);
    const se = Math.sqrt(vf / inp.N + vd / inp.n);
    return { est, rect, se, lo: est - inp.z * se, hi: est + inp.z * se, vf, vd };
  }
  /* PURE: same from raw 0/1 vectors. unl = judge outputs on unlabelled; fl, yl = judge and label on labelled */
  function ppiVectors(unl, fl, yl, z) {
    z = z || 1.96;
    const N = unl.length, n = fl.length, mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    const vr = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, a.length - 1); };
    const fU = mean(unl), d = fl.map((f, i) => f - yl[i]), rect = mean(d), est = fU - rect;
    const se = Math.sqrt(vr(unl) / N + vr(d) / n);
    const yM = mean(yl), seY = Math.sqrt(vr(yl) / n);
    return { N, n, fU, fL: mean(fl), yM, rect, est, se, lo: est - z * se, hi: est + z * se, seY, yLo: yM - z * seY, yHi: yM + z * seY };
  }
  /* PURE seeded shuffle (mulberry32) -> permutation of 0..len-1 */
  function perm(len, seed) {
    let a = (seed >>> 0) + 0x6D2B79F5; const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const p = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p;
  }
  /* PURE: pairs = [{f,y}] (all claims). Label the first n of a seeded shuffle; the rest are the unlabelled set. */
  function realPPI(pairs, n, seed, z) {
    const p = perm(pairs.length, seed), lab = p.slice(0, n), unl = p.slice(n);
    const r = ppiVectors(unl.map(i => pairs[i].f), lab.map(i => pairs[i].f), lab.map(i => pairs[i].y), z);
    r.lab = lab; return r;
  }
  /* PURE: repeat over many shuffles at one n: mean |error| vs the all-claims target, mean interval width, coverage */
  function repeats(pairs, n, reps, z) {
    const T = pairs.reduce((s, x) => s + x.y, 0) / pairs.length;
    let eP = 0, eL = 0, w = 0, wL = 0, cP = 0, cL = 0;
    for (let s = 1; s <= reps; s++) {
      const r = realPPI(pairs, n, 1000 + s, z);
      eP += Math.abs(r.est - T); eL += Math.abs(r.yM - T); w += r.hi - r.lo; wL += r.yHi - r.yLo;
      cP += (r.lo <= T && T <= r.hi) ? 1 : 0; cL += (r.yLo <= T && T <= r.yHi) ? 1 : 0;
    }
    return { T, errPPI: eP / reps, errLab: eL / reps, widthPPI: w / reps, widthLab: wL / reps, covPPI: cP / reps, covLab: cL / reps };
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = fetch(base + 'metrics/cohens_kappa.json').then(r => { if (!r.ok) throw new Error('cohens_kappa.json ' + r.status); return r.json(); });
    return realData;
  }

  function mountToy(el) {
    const K = root.DemoKit, st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)',
      'Illustrative numbers, not measured. The judge is tested on a few labelled outputs; the gap between judge and label there is subtracted from the judge score on the big unlabelled set.');
    const sl = (lab, min, max, step, key) => K.slider(lab, min, max, step, st[key], v => { st[key] = v; render(); });
    const sN = sl('N unlabelled', 100, 5000, 100, 'N'), sFu = sl('judge on unlabelled', 0, 1, 0.01, 'fUnl'), sn = sl('n labelled', 10, 500, 10, 'n'),
      sFl = sl('judge on labelled', 0, 1, 0.01, 'fLab'), sY = sl('human on labelled', 0, 1, 0.01, 'yLab');
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const all = [sN, sFu, sn, sFl, sY];
    const set = o => { Object.assign(st, o); all.forEach((s, i) => s.set(st[['N', 'fUnl', 'n', 'fLab', 'yLab'][i]])); render(); };
    const presets = K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults)),
      btn('Break it: 10 labels', () => set({ n: 10 })),
      btn('Break it: judge fine on labels, wrong elsewhere', () => set({ fLab: 0.68, yLab: 0.68 })));
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', {}, ...all.map(s => K.el('div', {}, s.node))), presets, res.node, formula, note);
    function render() {
      const s = ppiSummary(st), est = compute(st);
      res.set(est, 3);
      formula.textContent = `rectifier = ${K.fmt(st.fLab)} - ${K.fmt(st.yLab)} = ${K.fmt(s.rect)}   (judge ${s.rect >= 0 ? 'over' : 'under'}-estimates on labelled)\n` +
        `estimate = ${K.fmt(st.fUnl)} - ${K.fmt(s.rect)} = ${K.fmt(est)}\n` +
        `interval = ${K.fmt(est)} +/- ${st.z} x sqrt(${K.fmt(s.vf)}/${st.N} + ${K.fmt(s.vd)}/${st.n}) = [${K.fmt(s.lo)}, ${K.fmt(s.hi)}]`;
      note.textContent = 'Judge disagreement rate on labelled outputs is fixed at ' + st.disagree + ' for the interval. ' + (st.n < 50 ? 'With so few labels the rectifier is itself noisy: the interval is wide, and the normal approximation is shaky.' : 'Interval is dominated by the labelled-set term sigma_Delta^2 / n.') + ' Assumes labelled and unlabelled outputs come from the same distribution.';
      note.className = 'hint' + (st.n < 50 ? ' bad' : '');
    }
    render();
  }

  function mountReal(el, M) {
    const K = root.DemoKit;
    const pairs = M.claim_pairs.map(c => ({ f: c.judgeA === 'supported' ? 1 : 0, y: c.judgeB === 'supported' ? 1 : 0, id: c.qid + '/' + c.arm + '#' + c.claim_index }));
    const T = pairs.reduce((s, x) => s + x.y, 0) / pairs.length, FA = pairs.reduce((s, x) => s + x.f, 0) / pairs.length;
    const st = { n: 30, seed: 7 };
    const shell = K.shell(el, 'Real example: judge B stands in for human labels',
      'The pack has NO human labels. Judge B (' + M.judge_B + ') is used as a stand-in "gold" on a small labelled subset; judge A (' + M.judge_A + ') is the cheap predictor on every claim. Judge B is NOT human, so this demonstrates the mechanics of the correction, not that either judge is valid. Metric: share of claims judged supported (faithfulness), 140 claims, 12 questions x 3 arms, one run. Real-example demo scale.');
    shell.append(K.el('p', { class: 'hint bad' }, 'Mechanics demonstration only: judge B is an LLM, not a human. The "target" below is judge B on all 140 claims, which you would not have in practice.'));
    const sn = K.slider('n labelled (judge B)', 5, 100, 1, st.n, v => { st.n = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const reshuffle = btn('Draw another labelled subset', () => { st.seed++; render(); });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' });
    const chart = K.el('div', { 'aria-label': 'interval versus labelled-set size' }), rep = K.el('div', { class: 'hint' }), ids = K.el('p', { class: 'hint' });
    shell.append(K.el('div', {}, sn.node), K.el('div', { class: 'row' }, reshuffle), K.el('div', { class: 'hint' }, 'PPI-corrected faithfulness estimate:'), res.node, formula, chart, rep, ids);
    function barRow(lab, lo, est, hi, col, y) {
      const X = v => 130 + v * 330, S = K.svg;
      return [S('text', { x: 4, y: y + 4, fill: 'var(--muted)', 'font-size': 12 }, lab),
        S('line', { x1: X(Math.max(0, lo)), x2: X(Math.min(1, hi)), y1: y, y2: y, stroke: col, 'stroke-width': 4 }),
        S('circle', { cx: X(est), cy: y, r: 5, fill: col })];
    }
    function render() {
      const r = realPPI(pairs, st.n, st.seed, 1.96);
      res.set(r.est, 3);
      formula.textContent =
        `labelled (judge B as gold): n = ${r.n}; unlabelled: N = ${r.N}\n` +
        `judge A on unlabelled = ${K.fmt(r.fU)};  on labelled = ${K.fmt(r.fL)};  judge B on labelled = ${K.fmt(r.yM)}\n` +
        `bias correction (rectifier) = ${K.fmt(r.fL)} - ${K.fmt(r.yM)} = ${K.fmt(r.rect)}\n` +
        `PPI estimate = ${K.fmt(r.fU)} - (${K.fmt(r.rect)}) = ${K.fmt(r.est)}   interval [${K.fmt(r.lo)}, ${K.fmt(r.hi)}], width ${K.fmt(r.hi - r.lo)}\n` +
        `target (judge B on all 140) = ${K.fmt(T)};  judge A raw on all 140 = ${K.fmt(FA)} (off by ${K.fmt(FA - T)})`;
      const svg = K.svg('svg', { viewBox: '0 0 480 120', width: '100%', role: 'img', 'aria-label': 'intervals' });
      const tx = 130 + T * 330;
      svg.append(K.svg('line', { x1: tx, x2: tx, y1: 8, y2: 104, stroke: 'var(--he)', 'stroke-dasharray': '4 3' }),
        K.svg('text', { x: tx + 4, y: 14, fill: 'var(--he)', 'font-size': 11 }, 'target ' + K.fmt(T, 2)),
        ...barRow('judge A raw', FA, FA, FA, 'var(--warn)', 40),
        ...barRow('labelled only', r.yLo, r.yM, r.yHi, 'var(--k12)', 70),
        ...barRow('PPI', r.lo, r.est, r.hi, 'var(--ai)', 100));
      chart.replaceChildren(svg);
      const q = repeats(pairs, st.n, 300, 1.96);
      rep.textContent = `Over 300 random labelled subsets of size ${st.n}: mean interval width PPI ${K.fmt(q.widthPPI, 3)} vs labelled-only ${K.fmt(q.widthLab, 3)}; mean |error| PPI ${K.fmt(q.errPPI, 3)} vs labelled-only ${K.fmt(q.errLab, 3)}; coverage of the target PPI ${K.fmt(q.covPPI, 2)}, labelled-only ${K.fmt(q.covLab, 2)}. ` +
        (st.n < 20 ? 'Very few labels: the rectifier is noisy and the interval is wide. ' : '') +
        (q.widthPPI > q.widthLab ? 'Here PPI is NOT narrower: the unlabelled set is only ' + (pairs.length - st.n) + ' claims, so the judge-A term barely helps (PPI pays off when the unlabelled set is much larger than the labelled one; real ARES uses thousands). ' : 'PPI is narrower than using the labels alone, because the cheap judge is reused on the ' + (pairs.length - st.n) + ' unlabelled claims. ') +
        'Caveats: the 140 claims come from 12 questions (claims within an answer are not independent), the target is the same 140 claims, and judge B is not human.';
      ids.textContent = 'Labelled claims (first 8 of ' + r.n + '): ' + r.lab.slice(0, 8).map(i => pairs[i].id).join(', ') + '.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(M => { body.replaceChildren(); mountReal(body, M); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, ppiSummary, ppiVectors, realPPI, repeats };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ares_ppi'] = api;
})(this);
