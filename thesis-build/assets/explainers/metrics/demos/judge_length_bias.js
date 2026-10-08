/* Judge length bias demo. Real example (default): the 36 pairwise judgements of the answer study (judge A, both orders averaged),
   with the length of each answer in words (or completion tokens). Everything is computed live from the real strings.
   Toy example: the 10 invented pairs of the catalogue. compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { pairs: [[120, 1], [90, 1], [60, 1], [40, 1], [20, 1], [10, 0], [-10, 1], [-30, 0], [-60, 0], [-100, 0]], eps: 20 };

  function pearson(u, v) {
    const n = u.length; if (n < 2) return NaN;
    const mu = u.reduce((a, b) => a + b, 0) / n, mv = v.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (u[i] - mu) * (v[i] - mv); sxx += (u[i] - mu) ** 2; syy += (v[i] - mv) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
  }
  const r3 = x => Number.isFinite(x) ? Math.round(x * 1e3) / 1e3 : NaN;
  /* PURE. pairs: [[dlen, w]] (dlen = first minus second, w = score of the first arm, 1 win / 0.5 tie / 0 loss).
     raw_win_rate = mean w; corr = Pearson(dlen, w); matched_win_rate = mean w over |dlen| <= eps;
     longer_win_rate = mean score of the LONGER answer over pairs with unequal length (extra, not in the catalogue result). */
  function compute(inp) {
    const P = inp.pairs, n = P.length;
    const M = P.filter(p => Math.abs(p[0]) <= inp.eps), U = P.filter(p => p[0] !== 0);
    return {
      raw_win_rate: r3(n ? P.reduce((a, p) => a + p[1], 0) / n : NaN),
      corr: r3(pearson(P.map(p => p[0]), P.map(p => p[1]))),
      matched_win_rate: r3(M.length ? M.reduce((a, p) => a + p[1], 0) / M.length : NaN),
      longer_win_rate: r3(U.length ? U.reduce((a, p) => a + (p[0] > 0 ? p[1] : 1 - p[1]), 0) / U.length : NaN),
      n, n_matched: M.length, n_unequal: U.length,
    };
  }
  const f = (x, d = 3) => Number.isFinite(x) ? String(+x.toFixed(d)) : 'n/a';

  function bootCorr(P, B, seed) {   // seeded bootstrap of the correlation over pairs (mulberry32)
    let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = [];
    for (let b = 0; b < B; b++) { const S = P.map(() => P[Math.floor(rnd() * P.length)]); const c = pearson(S.map(p => p[0]), S.map(p => p[1])); if (Number.isFinite(c)) out.push(c); }
    out.sort((x, y) => x - y);
    return out.length ? [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)]] : [NaN, NaN];
  }

  function scatter(K, pairs, eps, colorOf, xlab) {
    const W = 560, H = 260, L = 44, R = 12, T = 22, Bm = 36;
    const xs = pairs.map(p => p[0]), lo = Math.min(-10, ...xs), hi = Math.max(10, ...xs);
    const X = v => L + (v - lo) / (hi - lo) * (W - L - R), Y = v => T + (1 - v) * (H - T - Bm);
    const s = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'length difference against judge score', style: 'max-width:640px;display:block' });
    s.append(K.svg('rect', { x: X(-eps), y: T, width: Math.max(1, X(eps) - X(-eps)), height: H - T - Bm, fill: '#3CC7B4', opacity: 0.12 }));
    [0, 0.5, 1].forEach(v => { s.append(K.svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#242B38' }), K.svg('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end' }, String(v))); });
    s.append(K.svg('line', { x1: X(0), x2: X(0), y1: T, y2: H - Bm, stroke: '#68707F', 'stroke-dasharray': '3 3' }));
    const step = (hi - lo) > 150 ? 50 : 20;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) s.append(K.svg('text', { x: X(v), y: H - Bm + 16, 'text-anchor': 'middle' }, String(v)));
    s.append(K.svg('text', { x: (L + W - R) / 2, y: H - 4, 'text-anchor': 'middle' }, xlab), K.svg('text', { x: 4, y: 12 }, 'score of the first-named arm'));
    pairs.forEach((p, i) => { const d = K.svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 5, fill: colorOf(i), opacity: 0.75, stroke: '#0B0D12' }); if (p[2]) d.append(K.svg('title', {}, p[2])); s.append(d); });
    return s;
  }

  function render(K, host, res, formula, note, pairs, eps, extra) {
    const v = compute({ pairs: pairs.map(p => [p[0], p[1]]), eps });
    res.set(v.corr, 3);
    host.replaceChildren(scatter(K, pairs, eps, i => pairs[i][3] || '#F2A93B', extra.xlab));
    formula.textContent = `n = ${v.n} pairs\nraw win rate of the first-named arm = ${f(v.raw_win_rate)}\n` +
      `corr(length difference, score) = ${f(v.corr)}` + (extra.ci ? `   (bootstrap 95%: [${f(extra.ci[0], 2)}, ${f(extra.ci[1], 2)}], 2000 resamples, seed 7)` : '') +
      `\nlonger answer wins = ${f(v.longer_win_rate)}  over ${v.n_unequal} pairs of unequal length` +
      `\nmatched (|diff| <= ${eps}) win rate = ${f(v.matched_win_rate)}  over ${v.n_matched} pairs`;
    return v;
  }

  function mountToy(el) {
    const K = root.DemoKit, st = { pairs: defaults.pairs.map(p => p.slice()), eps: defaults.eps };
    const shell = K.shell(el, 'Toy example (break it)', 'Ten invented pairs (illustrative, not measured): x = length difference in tokens (B minus A), y = 1 if B wins. Click a plot area button to load a preset, or move the tolerance.');
    const host = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const sl = K.slider('length tolerance epsilon (tokens)', 0, 120, 5, st.eps, v => { st.eps = v; draw(); });
    const btn = (t, fn) => K.el('button', { type: 'button', onclick: fn }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => { st.pairs = defaults.pairs.map(p => p.slice()); st.eps = 20; sl.set(20); draw(); }),
      btn('Break it: judge always picks the longer', () => { st.pairs = defaults.pairs.map(p => [p[0], p[0] > 0 ? 1 : 0]); draw(); }),
      btn('Length is irrelevant', () => { st.pairs = defaults.pairs.map((p, i) => [p[0], i % 2]); draw(); })), host, sl.node, res.node, formula, note);
    function draw() {
      const v = render(K, host, res, formula, note, st.pairs.map(p => [p[0], p[1], 'diff ' + p[0] + ', score ' + p[1], p[1] ? '#3CC7B4' : '#FF8A65']), st.eps, { xlab: 'length difference B - A (tokens)' });
      note.textContent = v.corr > 0.6 ? 'A strong positive correlation means longer answers win. Matching on length (teal band) keeps only pairs with similar lengths, but ten pairs are far too few: this is arithmetic, not evidence.' : 'Correlation near 0 means the winner does not follow length in this sample.';
    }
    draw();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('answers/pairwise.json')]).then(a => {
      const ans = {}; a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      const sc = (o, x) => o.winner_arm === x ? 1 : o.winner_arm === 'tie' ? 0.5 : 0;
      return a[1].map(r => {
        const x = r.pair[0], y = r.pair[1], A = ans[r.qid + '_' + x], B = ans[r.qid + '_' + y];
        return { qid: r.qid, pair: x + y, score: r.orders.reduce((s, o) => s + sc(o, x), 0) / r.orders.length,
          words: A.answer.trim().split(/\s+/).length - B.answer.trim().split(/\s+/).length, tokens: A.completion_tokens - B.completion_tokens };
      });
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, st = { unit: 'words', eps: 5, sub: { AB: true, BC: true, AC: true } };
    const shell = K.shell(el, 'Real example: do longer answers win? 36 pairs, one judge',
      'Scale: 12 questions x 3 arm pairs = 36 pairs, ONE LLM judge (deepseek-v4.1-flash, sees the evidence pool), temperature 0, both answer orders averaged (win 1, tie 0.5, loss 0), no human labels. The result is suggestive only. Length = words of the answer text (or completion tokens). No length control was applied by the judge. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const col = { AB: '#7C9CFF', BC: '#3CC7B4', AC: '#C28BFF' };
    const host = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), tab = K.el('p', { class: 'hint' });
    const unit = K.el('select', { 'aria-label': 'length unit' }, [K.el('option', { value: 'words' }, 'length in words'), K.el('option', { value: 'tokens' }, 'length in completion tokens')]);
    unit.addEventListener('change', () => { st.unit = unit.value; sl.set(st.unit === 'words' ? 5 : 8); st.eps = st.unit === 'words' ? 5 : 8; draw(); });
    const sl = K.slider('length tolerance epsilon', 0, 60, 1, st.eps, v => { st.eps = v; draw(); });
    const cbs = ['AB', 'BC', 'AC'].map(k => { const c = K.el('input', { type: 'checkbox', checked: 'checked', 'aria-label': k }); c.addEventListener('change', () => { st.sub[k] = c.checked; draw(); }); return K.el('label', { style: 'color:' + col[k] }, c, ' ' + k[0] + ' vs ' + k[1] + ' '); });
    shell.append(K.el('div', { class: 'row' }, unit, ...cbs), host, sl.node, res.node, formula, tab, note);
    function draw() {
      const rows = D.filter(r => st.sub[r.pair]);
      const pairs = rows.map(r => [r[st.unit === 'words' ? 'words' : 'tokens'], r.score, r.qid + ' ' + r.pair[0] + ' vs ' + r.pair[1] + ': diff ' + r[st.unit === 'words' ? 'words' : 'tokens'] + ', score ' + r.score, col[r.pair]]);
      const ci = pairs.length > 3 ? bootCorr(pairs, 2000, 7) : null;
      const v = render(K, host, res, formula, note, pairs, st.eps, { xlab: 'length difference, first-named minus second (' + st.unit + ')', ci });
      const by = ['AB', 'BC', 'AC'].map(k => { const P = D.filter(r => r.pair === k); const w = P.map(r => r.words); return k[0] + ' v ' + k[1] + ': mean |diff| ' + f(w.reduce((a, b) => a + Math.abs(b), 0) / w.length, 1) + ' words, ' + w.filter(x => x === 0).length + ' equal-length'; });
      tab.textContent = 'Confound check: ' + by.join('  |  ');
      note.textContent = 'Suggestive only (n = ' + v.n + ', one judge). The longer answers are mostly arm A (no retrieval, unsupported), and a judge that sees the sources can punish exactly that, so length and grounding are mixed up. B v C pairs differ by few words, so they barely test length; selecting only B v C leaves most pairs equal length. A negative correlation here is not proof of no bias, and a positive one would not prove bias.';
    }
    draw();
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
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['judge_length_bias'] = api;
})(this);
