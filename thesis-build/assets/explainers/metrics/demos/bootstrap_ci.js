/* Bootstrap confidence interval demo: toggle per-question scores, change B, watch resampling build the histogram of means. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    scores: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1],   // 1 = question answered correctly
    B: 10000,                                  // number of resamples
    seed: 7,                                   // JS PRNG seed (the catalogue's numpy stream is not reproduced; see note)
  };

  /* small seeded PRNG (mulberry32) so the demo is repeatable */
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* linear-interpolated percentile of a sorted array (same rule as numpy.percentile default) */
  function pct(sorted, q) {
    const pos = q * (sorted.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  /* PURE: bootstrap means (sorted) */
  function means(inp) {
    const n = inp.scores.length, rnd = prng(inp.seed == null ? 7 : inp.seed), out = new Float64Array(inp.B);
    for (let b = 0; b < inp.B; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += inp.scores[Math.floor(rnd() * n)];
      out[b] = s / n;
    }
    return out.sort();
  }
  const r6 = x => Math.round(x * 1e6) / 1e6;
  /* PURE: percentile bootstrap, CI95 = [2.5th, 97.5th] percentile of the resampled means */
  function compute(inp) {
    const n = inp.scores.length, mean = inp.scores.reduce((a, b) => a + b, 0) / n;
    const m = means(inp);
    return { mean: r6(mean), ci95: [r6(pct(m, 0.025)), r6(pct(m, 0.975))] };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { scores: defaults.scores.slice(), B: defaults.B, seed: defaults.seed };
    const shell = K.shell(el, 'Bootstrap confidence interval',
      'Click a question to flip it between correct and wrong. "Draw one resample" shows one resample: n questions picked with replacement. The histogram below is the means of all B resamples. Then ask: how wide is the interval?');
    const dots = K.el('div', { class: 'row', role: 'group', 'aria-label': 'per-question scores' });
    const draw = K.el('div', { class: 'row', 'aria-label': 'current resample' });
    const hist = K.svg('svg', { viewBox: '0 0 600 190', width: '100%', role: 'img', 'aria-label': 'histogram of resampled means' });
    const res = K.resultBox();
    const ci = K.el('div', { class: 'num', 'aria-live': 'polite' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const bS = K.slider('B (resamples)', 100, 10000, 100, st.B, v => { st.B = v; render(); });
    const pre = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.scores = defaults.scores.slice(); st.B = 10000; bS.set(10000); render(); }),
      btn('Break it: only 3 questions (2 of 3 right)', () => { st.scores = [1, 1, 0]; render(); }),
      btn('Same 70 % on 300 questions', () => { st.scores = Array.from({ length: 300 }, (_, i) => (i % 10 < 7 ? 1 : 0)); render(); }),
      btn('+ question', () => { st.scores.push(1); render(); }),
      btn('- question', () => { if (st.scores.length > 2) st.scores.pop(); render(); }));
    const one = btn('Draw one resample', () => {
      const n = st.scores.length, picks = Array.from({ length: n }, () => Math.floor(Math.random() * n));
      showDraw(picks);
    });
    shell.append(K.el('div', { class: 'row' }, bS.node, one), pre, dots, draw, hist, res.node, ci, formula, note);

    function chip(v, i, small) {
      return K.el('span', { class: 'num', style: `display:inline-block;min-width:${small ? 18 : 24}px;text-align:center;border:1px solid ${v ? 'var(--he)' : 'var(--warn)'};color:${v ? 'var(--he)' : 'var(--warn)'};border-radius:4px;font-size:${small ? 11 : 13}px` }, small ? String(v) : String(v));
    }
    function showDraw(picks) {
      draw.replaceChildren();
      if (st.scores.length > 40) { draw.append(K.el('span', { class: 'hint' }, `resample of ${picks.length}: mean = ${K.fmt(picks.reduce((a, i) => a + st.scores[i], 0) / picks.length)}`)); return; }
      draw.append(K.el('span', { class: 'hint' }, 'one resample (with replacement): '));
      picks.forEach(i => draw.append(K.el('span', { title: 'question ' + (i + 1) }, chip(st.scores[i], i, true), K.el('sub', {}, String(i + 1)))));
      draw.append(K.el('span', { class: 'num' }, ' mean = ' + K.fmt(picks.reduce((a, i) => a + st.scores[i], 0) / picks.length)));
      note.textContent = 'Some questions appear twice, some not at all: that is what makes every resample differ.';
    }
    function drawHist(m, lo, hi) {
      hist.replaceChildren();
      const n = st.scores.length, bins = Math.min(n + 1, 41), cnt = new Array(bins).fill(0);
      for (const v of m) cnt[Math.min(bins - 1, Math.round(v * (bins - 1)))]++;
      const mx = Math.max(...cnt), W = 600, H = 190, pl = 10, pw = W - 2 * pl, bw = pw / bins;
      cnt.forEach((c, i) => {
        const h = (c / mx) * 130, x = pl + i * bw, v = i / (bins - 1), inside = v >= lo - 1e-9 && v <= hi + 1e-9;
        hist.append(K.svg('rect', { x: x + 1, y: 150 - h, width: Math.max(1, bw - 2), height: h, fill: inside ? 'var(--he)' : 'var(--faint)', opacity: 0.85 }));
      });
      const X = v => pl + v * (pw - bw) + bw / 2;
      [lo, hi].forEach(v => hist.append(K.svg('line', { x1: X(v), x2: X(v), y1: 10, y2: 150, stroke: 'var(--ai)', 'stroke-width': 2 })));
      hist.append(K.svg('line', { x1: X(lo), x2: X(hi), y1: 18, y2: 18, stroke: 'var(--ai)', 'stroke-width': 2 }));
      hist.append(K.svg('text', { x: X((lo + hi) / 2), y: 12, 'text-anchor': 'middle' }, '95 % of resampled means'));
      [0, 0.25, 0.5, 0.75, 1].forEach(v => hist.append(K.svg('text', { x: X(v), y: 170, 'text-anchor': 'middle' }, String(v))));
      hist.append(K.svg('text', { x: W / 2, y: 187, 'text-anchor': 'middle' }, 'resampled mean score'));
    }
    function render() {
      dots.replaceChildren();
      st.scores.forEach((v, i) => dots.append(K.el('button', {
        type: 'button', 'aria-pressed': v ? 'true' : 'false', title: `question ${i + 1}: ${v ? 'correct' : 'wrong'} (click to flip)`,
        style: 'min-width:34px;padding:4px 6px;' + (v ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
        onclick: () => { st.scores[i] = v ? 0 : 1; render(); },
      }, String(v))));
      const inp = { scores: st.scores, B: st.B, seed: st.seed }, r = compute(inp), m = means(inp), n = st.scores.length;
      res.set(r.mean);
      ci.textContent = `95 % CI = [${K.fmt(r.ci95[0])}, ${K.fmt(r.ci95[1])}]   width ${K.fmt(r.ci95[1] - r.ci95[0])}`;
      formula.textContent = `mean = ${st.scores.reduce((a, b) => a + b, 0)}/${n} = ${K.fmt(r.mean)}\nB = ${st.B} resamples of n = ${n}\nCI95 = [θ*(${K.fmt(0.025 * st.B, 1)}), θ*(${K.fmt(0.975 * st.B, 1)})] = [${K.fmt(r.ci95[0])}, ${K.fmt(r.ci95[1])}]`;
      drawHist(m, r.ci95[0], r.ci95[1]);
      draw.replaceChildren();
      note.textContent = n <= 5 ? 'Break it: with only a few questions the interval is huge and the histogram is a few lumps. Also, this method treats questions as independent: questions from one document are not (use a cluster bootstrap).'
        : n >= 100 ? 'More questions, same mean: the interval shrinks roughly like 1/sqrt(n).' : 'Resample many times, read off the middle 95 % of the means.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (metrics/bootstrap_ci.json, metrics/paired_bootstrap.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/bootstrap_ci.json'), get('metrics/paired_bootstrap.json')]).then(a => ({ ci: a[0], pb: a[1] }));
    return realData;
  }
  const SUITES = {
    faithfulness: { label: 'faithfulness (judge A)', pool: 'faithfulness_pool_judgeA', pair: s => s + '_faithfulness_pool_judgeA' },
    correctness: { label: 'answer correctness (answerable questions)', pool: 'answer_correctness_answerable', pair: s => s + '_correctness_answerable' },
  };
  const PAIRS = { 'B-A': ['B', 'A'], 'C-B': ['C', 'B'], 'C-A': ['C', 'A'] };

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { metric: 'faithfulness', arm: 'A', pair: 'C-B', B: 10000 };
    const shell = K.shell(el, 'Real example: bootstrap interval on real per-question scores',
      'Scale: n = 12 questions (9 answerable), one run, temperature 0, LLM judges (not humans), helper-written questions. The intervals are wide on purpose: this shows how wide an interval is at demo scale, not a benchmark. Arm C gets about 40% more context than B (620 vs 416 words), so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'metric', style: 'max-width:100%' }, Object.keys(SUITES).map(k => opt(k, SUITES[k].label)));
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const pSel = K.el('select', { 'aria-label': 'paired difference', style: 'max-width:100%' }, [opt('C-B', 'C minus B'), opt('B-A', 'B minus A'), opt('C-A', 'C minus A')]);
    mSel.addEventListener('change', () => { st.metric = mSel.value; render(); });
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    pSel.addEventListener('change', () => { st.pair = pSel.value; render(); });
    const bS = K.slider('B (resamples)', 100, 10000, 100, st.B, v => { st.B = v; render(); });
    const dots = K.el('div', { class: 'row', role: 'group', 'aria-label': 'real per-question scores' });
    const hist = K.svg('svg', { viewBox: '0 0 600 190', width: '100%', role: 'img', 'aria-label': 'histogram of resampled means' });
    const res = K.resultBox();
    const ci = K.el('div', { class: 'num', 'aria-live': 'polite' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const phead = K.el('h4', {}, 'Paired difference');
    const pdots = K.el('div', { class: 'row', 'aria-label': 'per-question differences' });
    const phist = K.svg('svg', { viewBox: '0 0 600 190', width: '100%', role: 'img', 'aria-label': 'histogram of resampled mean differences' });
    const pci = K.el('div', { class: 'num', 'aria-live': 'polite' });
    const pformula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'metric ', mSel), K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, bS.node),
      dots, hist, K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' mean')), ci, formula,
      phead, K.el('div', { class: 'row' }, K.el('label', {}, 'compare ', pSel)), pdots, phist, pci, pformula, note);

    function chip(q, v) {
      const c = v >= 0.999 ? 'var(--he)' : v <= 0.001 ? 'var(--warn)' : 'var(--ai)';
      return K.el('span', { class: 'num', title: q + ': ' + v, style: `display:inline-block;min-width:44px;text-align:center;border:1px solid ${c};color:${c};border-radius:4px;font-size:11px;padding:1px 2px` }, q + ' ' + K.fmt(v, 2));
    }
    function histo(svg, m, xmin, xmax, lo, hi, stored) {
      svg.replaceChildren();
      const bins = 40, cnt = new Array(bins).fill(0), span = xmax - xmin || 1;
      for (const v of m) cnt[Math.max(0, Math.min(bins - 1, Math.floor((v - xmin) / span * bins)))]++;
      const mx = Math.max(...cnt), W = 600, pl = 10, pw = W - 2 * pl, bw = pw / bins, X = v => pl + (v - xmin) / span * pw;
      cnt.forEach((c, i) => {
        const h = (c / mx) * 120, mid = xmin + (i + 0.5) / bins * span, inside = mid >= lo && mid <= hi;
        svg.append(K.svg('rect', { x: pl + i * bw + 1, y: 145 - h, width: Math.max(1, bw - 2), height: h, fill: inside ? 'var(--he)' : 'var(--faint)', opacity: 0.85 }));
      });
      [lo, hi].forEach(v => svg.append(K.svg('line', { x1: X(v), x2: X(v), y1: 22, y2: 145, stroke: 'var(--ai)', 'stroke-width': 2 })));
      if (stored) stored.forEach(v => svg.append(K.svg('line', { x1: X(v), x2: X(v), y1: 22, y2: 145, stroke: 'var(--warn)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })));
      if (xmin < 0 && xmax > 0) svg.append(K.svg('line', { x1: X(0), x2: X(0), y1: 22, y2: 150, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.5 }));
      svg.append(K.svg('text', { x: X((lo + hi) / 2), y: 14, 'text-anchor': 'middle' }, 'solid = this page (JS)' + (stored ? ', dashed = stored (numpy)' : '')));
      for (let t = 0; t <= 4; t++) { const v = xmin + span * t / 4; svg.append(K.svg('text', { x: X(v), y: 165, 'text-anchor': 'middle' }, K.fmt(v, 2))); }
      svg.append(K.svg('text', { x: W / 2, y: 185, 'text-anchor': 'middle' }, 'resampled mean'));
    }
    function render() {
      const S = SUITES[st.metric], inputs = D.ci.per_question_inputs[st.metric];
      const row = inputs[st.arm], qs = Object.keys(row).filter(q => row[q] != null), scores = qs.map(q => row[q]);
      dots.replaceChildren(...qs.map(q => chip(q, row[q])));
      const skipped = Object.keys(row).filter(q => row[q] == null);
      const stored = D.ci.intervals[S.pool][st.arm];
      const inp = { scores, B: st.B, seed: 7 }, r = compute(inp), m = means(inp), n = scores.length;
      res.set(r.mean);
      histo(hist, m, 0, 1, r.ci95[0], r.ci95[1], st.B === 10000 ? stored.ci95 : null);
      ci.textContent = `95 % CI (this page, ${st.B} resamples, JS PRNG) = [${K.fmt(r.ci95[0])}, ${K.fmt(r.ci95[1])}]`;
      formula.textContent = `mean = sum of ${n} scores / ${n} = ${K.fmt(r.mean, 4)}   (pack: ${stored.mean})\n` +
        `stored interval (numpy default_rng seed ${stored.seed}, ${stored.resamples} resamples) = [${stored.ci95[0]}, ${stored.ci95[1]}]\n` +
        `The two intervals differ slightly because the random streams differ; the method is the same.` +
        (skipped.length ? `\nLeft out (unanswerable, no claims to score): ${skipped.join(', ')}` : '');
      /* paired */
      const [x, y] = PAIRS[st.pair], rx = inputs[x], ry = inputs[y];
      const pq = Object.keys(rx).filter(q => rx[q] != null && ry[q] != null), diffs = pq.map(q => rx[q] - ry[q]);
      phead.textContent = `Paired difference ${x} minus ${y} on the same ${pq.length} questions`;
      pdots.replaceChildren(...pq.map(q => { const d = rx[q] - ry[q], c = d > 0.001 ? 'var(--he)' : d < -0.001 ? 'var(--warn)' : 'var(--faint)'; return K.el('span', { class: 'num', title: q, style: `display:inline-block;min-width:50px;text-align:center;border:1px solid ${c};color:${c};border-radius:4px;font-size:11px;padding:1px 2px` }, q + ' ' + (d > 0 ? '+' : '') + K.fmt(d, 2)); }));
      const pinp = { scores: diffs, B: st.B, seed: 7 }, pr = compute(pinp), pm = means(pinp);
      const sKey = S.pair(x + '_minus_' + y), sv = D.pb.comparisons[sKey];
      const lo = Math.min(-0.5, pr.ci95[0] - 0.05), hi = Math.max(0.5, pr.ci95[1] + 0.05);
      histo(phist, pm, lo, hi, pr.ci95[0], pr.ci95[1], sv && st.B === 10000 ? sv.ci95 : null);
      const sg = v => (v > 0 ? '+' : '') + K.fmt(v, 3);
      pci.textContent = `${x} minus ${y}: mean ${sg(pr.mean)}, 95 % CI [${sg(pr.ci95[0])}, ${sg(pr.ci95[1])}] (this page)  ` + (pr.ci95[0] > 0 || pr.ci95[1] < 0 ? '-> excludes zero' : '-> straddles zero');
      pformula.textContent = sv ? `stored (numpy, seed 7, 10,000): ${sg(sv.mean_diff)} [${sg(sv.ci95[0])}, ${sg(sv.ci95[1])}]; share of resamples with difference <= 0: ${sv.share_resamples_diff_le_0}` : `No stored paired interval for ${x} minus ${y} on this metric in the pack; only the live one is shown.`;
      note.textContent = (pr.ci95[0] <= 0 && pr.ci95[1] >= 0 ? `Zero sits inside the interval, so ${x} and ${y} are not distinguishable at this scale. ` : '') +
        'Pairing matters: the same questions are resampled for both arms, so question difficulty cancels. Lower B (resamples) and watch the interval get ragged; the histogram only needs a few thousand to settle.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['bootstrap_ci'] = api;
})(this);
