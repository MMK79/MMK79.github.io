/* Throughput under concurrency (Little's law): L = lambda * W, so lambda_max = c / W.
   Real example (default): W = the 36 real wall-clock latencies of the ANSWER call of the answer study (12 questions x 3 arms, qwen3.7-plus,
   non-streaming, one run, sequential, shared machine, endpoint in China). Measured W is UNLOADED and SEQUENTIAL, and only the answer call is timed
   (not query embedding, retrieval, rerank). Provider rate limits and queueing are NOT in the pack: the queue panel is a SIMULATION seeded with the real
   latency sample (Poisson arrivals, c servers, FIFO, service time drawn from the 36 values), not a measurement.
   Toy example (break it): 8 students, W = 2 s -> 4 requests/s. compute() is pure and returns lambda_max. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { c: 8, W: 2 };

  /* PURE: throughput ceiling lambda_max = c / W (requests per second) */
  function compute(inp) { return inp.c / inp.W; }
  /* PURE: concurrency needed to serve an arrival rate: L = lambda W */
  const needed = (lambda, W) => lambda * W;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const nearest = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.max(1, Math.ceil(q * s.length - 1e-9)) - 1]; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* PURE SIMULATION (not a measurement): open queue, Poisson arrivals at rate lambda (1/s), c identical servers, FIFO,
     service time drawn with replacement from `sample` (seconds) times `slow`. Seeded. Returns utilisation, mean wait, p95 time in system, max in system. */
  function simulate(o) {
    const { lambda, c, sample, slow = 1, n = 3000, seed = 7 } = o, r = rng(seed);
    const free = new Array(c).fill(0), tot = [], waits = [], ev = [];
    let t = 0, busy = 0;
    for (let i = 0; i < n; i++) {
      t += -Math.log(1 - r()) / lambda;
      const s = sample[Math.floor(r() * sample.length)] * slow;
      let k = 0; for (let j = 1; j < c; j++) if (free[j] < free[k]) k = j;
      const st = Math.max(t, free[k]), fin = st + s; free[k] = fin;
      waits.push(st - t); tot.push(fin - t); busy += s; ev.push([t, 1], [fin, -1]);
    }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, mx = 0; for (const e of ev) { cur += e[1]; if (cur > mx) mx = cur; }
    const horizon = Math.max(...free);
    return { util: busy / (c * horizon), meanWait: mean(waits), p95Total: nearest(tot, 0.95), maxInSystem: mx, stable: lambda * mean(sample) * slow < c };
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = fetch(base + 'answers/answers.json').then(r => { if (!r.ok) throw new Error('answers.json ' + r.status); return r.json(); });
    return realData;
  }

  /* shared panel. st: {c, lambda, slow}, sample: W samples (s), unit labels */
  function panel(K, host, st, sample, opts) {
    const W0 = mean(sample), P95 = nearest(sample, 0.95);
    const cv = K.el('div'), out = K.el('div', { class: 'formula', 'aria-live': 'polite' }), res = K.resultBox(), cap = K.el('p', { class: 'hint' }), simOut = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const S = {};
    const mk = (k, lab, a, b, step) => { S[k] = K.slider(lab, a, b, step, st[k], v => { st[k] = v; go(); }); return K.el('div', { class: 'row' }, S[k].node); };
    host.append(mk('lambda', 'arrival rate lambda (questions per second)', opts.lmin, opts.lmax, opts.lstep), mk('c', 'concurrency limit c (calls at once)', 1, opts.cmax, 1), mk('slow', 'what-if: W grows under load by x', 1, 4, 0.1),
      K.el('div', { class: 'hint' }, 'ceiling lambda_max = c / W (questions per second):'), res.node, cv, out, cap, simOut);
    const Wd = 640, H = 190, M = { l: 40, r: 10, t: 12, b: 30 };
    function go() {
      const W = W0 * st.slow, Wp = P95 * st.slow, lmax = st.c / W, L = needed(st.lambda, W), Lp = needed(st.lambda, Wp);
      res.set(lmax, 2);
      const xmax = opts.lmax * 1.0, ymax = Math.max(opts.cmax, Math.ceil(Lp) + 1) , X = v => M.l + (Wd - M.l - M.r) * v / xmax, Y = v => H - M.b - (H - M.t - M.b) * Math.min(v, ymax) / ymax;
      const svg = K.svg('svg', { viewBox: `0 0 ${Wd} ${H}`, width: '100%', role: 'img', 'aria-label': 'L equals lambda times W line against the concurrency limit' });
      svg.append(K.svg('line', { x1: M.l, x2: Wd - M.r, y1: H - M.b, y2: H - M.b, stroke: '#68707F' }), K.svg('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: '#68707F' }));
      const lineTo = (slope, col, dash) => { const xe = Math.min(xmax, ymax / slope); svg.append(K.svg('line', { x1: X(0), y1: Y(0), x2: X(xe), y2: Y(slope * xe), stroke: col, 'stroke-width': 2, 'stroke-dasharray': dash || '' })); };
      lineTo(W, '#F2A93B'); lineTo(Wp, '#FF8A65', '5 4');
      svg.append(K.svg('line', { x1: M.l, x2: Wd - M.r, y1: Y(st.c), y2: Y(st.c), stroke: '#7C9CFF', 'stroke-width': 2 }));
      svg.append(K.svg('circle', { cx: X(st.lambda), cy: Y(L), r: 5, fill: L > st.c ? '#FF8A65' : '#3CC7B4' }));
      svg.append(K.svg('text', { x: Wd - M.r, y: Y(st.c) - 4, 'text-anchor': 'end', style: 'fill:#7C9CFF' }, 'limit c = ' + st.c), K.svg('text', { x: M.l + 4, y: M.t + 8, style: 'fill:#F2A93B' }, 'L = lambda W (mean W, solid)   '), K.svg('text', { x: M.l + 4, y: M.t + 22, style: 'fill:#FF8A65' }, 'with p95 call time (dashed)'));
      svg.append(K.svg('text', { x: Wd / 2, y: H - 6, 'text-anchor': 'middle' }, 'arrival rate lambda (questions / s)'), K.svg('text', { x: 6, y: M.t + 40 }, 'L'));
      cv.replaceChildren(svg);
      const ok = L <= st.c;
      out.textContent = `W = ${K.fmt(W0, 2)} s${st.slow > 1 ? ' x ' + st.slow + ' = ' + K.fmt(W, 2) + ' s' : ''}   (${opts.wlabel})\nneeded at lambda = ${st.lambda}/s:  L = lambda W = ${st.lambda} x ${K.fmt(W, 2)} = ${K.fmt(L, 2)} calls at once   (with p95 time ${K.fmt(Wp, 2)} s: ${K.fmt(Lp, 2)})\nceiling at c = ${st.c}:  lambda_max = c / W = ${st.c} / ${K.fmt(W, 2)} = ${K.fmt(lmax, 2)} per second = ${K.fmt(lmax * 60, 0)} per minute\n` + (ok ? 'lambda <= lambda_max: the average load fits.' : 'lambda > lambda_max: the queue grows without bound.');
      cap.textContent = opts.cap;
      const s = simulate({ lambda: st.lambda, c: st.c, sample, slow: st.slow });
      simOut.textContent = `SIMULATION (not measured; Poisson arrivals, ${st.c} servers, FIFO, service time resampled from the ${sample.length} real values, no rate limit, 3000 arrivals, seed 7):\nutilisation ${K.fmt(100 * s.util, 0)}%   mean wait in queue ${K.fmt(s.meanWait, 2)} s   p95 time in system ${K.fmt(s.p95Total, 2)} s   most requests at once ${s.maxInSystem}` + (s.stable ? '' : '\n(unstable: the simulated wait only reflects the 3000 arrivals, it would keep growing)') + `\nNote: the mean wait is near 0 while lambda W is well below c, and rises sharply as it approaches c: Little's law gives the average only.`;
    }
    go();
  }

  function mountToy(el) {
    const K = root.DemoKit, st = { c: defaults.c, W: defaults.W }, shell = K.shell(el, 'Toy example (break it)', 'TOY: 8 students at once, mean latency 2 s (the worked example). Change c and W; lambda_max = c / W.');
    const res = K.resultBox(), f = K.el('div', { class: 'formula', 'aria-live': 'polite' }), cap = K.el('p', { class: 'hint' }), bar = K.el('div', { class: 'row' });
    const sc = K.slider('students at once c', 1, 64, 1, st.c, v => { st.c = v; go(); }), sw = K.slider('mean latency W (s)', 0.5, 20, 0.5, st.W, v => { st.W = v; go(); });
    const btn = (t, fn) => K.el('button', { type: 'button', onclick: fn }, t);
    bar.append(btn('Worked example', () => { sc.set(8); sw.set(2); st.c = 8; st.W = 2; go(); }),
      btn('Break it: W triples under load', () => { sw.set(6); st.W = 6; go(); }),
      btn('Break it: provider caps at 2 calls', () => { sc.set(2); st.c = 2; go(); }));
    shell.append(K.el('div', { class: 'row' }, sc.node), K.el('div', { class: 'row' }, sw.node), bar, res.node, f, cap);
    function go() {
      res.set(compute(st), 2);
      f.textContent = `lambda_max = c / W = ${st.c} / ${K.fmt(st.W, 2)} s = ${K.fmt(compute(st), 2)} requests per second`;
      cap.textContent = 'Blind spot: the formula assumes W stays the same as c grows. Rate limits, GPU batching and a queue make W grow, so the real ceiling is lower; averages also hide the tail.';
    }
    go();
  }

  function mountReal(el, D) {
    const K = root.DemoKit, sample = D.map(a => a.latency_s), st = { lambda: 0.5, c: 4, slow: 1 };
    const shell = K.shell(el, "Real example: Little's law with the 36 real answer-call latencies",
      'W is the real wall-clock time of ONE answer call (qwen3.7-plus, non-streaming; 12 questions x 3 arms = 36 calls, run one after another on a shared machine, one run, 2026-10-08). Mean ' + K.fmt(mean(sample), 2) + ' s, p95 (nearest rank) ' + K.fmt(nearest(sample, 0.95), 2) + ' s, so p95 is the 2nd slowest of 36. Honest limits: (1) this W is UNLOADED and SEQUENTIAL: under real load W grows (use the what-if slider), no load test was run; (2) only the ANSWER call is timed, not query embedding, retrieval or rerank; (3) provider rate limits and queueing are NOT in the data pack. The queue numbers below are a labelled simulation, not measurements.');
    panel(K, shell, st, sample, { lmin: 0.1, lmax: 4, lstep: 0.1, cmax: 16, wlabel: 'mean of the 36 real answer calls', cap: 'Class check: 30 students asking within a minute is lambda = 0.5/s, so L = 0.5 x ' + K.fmt(mean(sample), 2) + ' = ' + K.fmt(0.5 * mean(sample), 1) + ' answers in flight on average, but p95-time planning wants ' + K.fmt(0.5 * nearest(sample, 0.95), 1) + '. The catalogue says generation, not vector search, is the bottleneck; this pack timed only the answer call, so it cannot show the comparison.' });
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, needed, simulate };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['throughput_littles_law'] = api;
})(this);
