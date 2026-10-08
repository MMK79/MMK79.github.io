/* Latency percentiles p50 / p95 / p99 (nearest rank on the sorted latencies).
   Real example (default): the 36 wall-clock latencies of the real LLM calls of the answer study (12 questions x 3 arms, qwen3.7-plus).
   These are LLM-CALL latencies, NOT ANN-search latencies: the HNSW experiment stores only a mean ms/query per setting, no per-query latencies.
   Toy example (break it): the 20 invented latencies of the worked example. compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { lat: [12, 11, 13, 12, 14, 12, 15, 13, 12, 11, 13, 14, 12, 16, 13, 12, 40, 13, 12, 95] };

  const sorted = xs => xs.slice().sort((a, b) => a - b);
  /* nearest rank: x_(ceil(q n)), 1-based on the sorted values */
  const nearest = (xs, q) => { const s = sorted(xs); return s[Math.max(1, Math.ceil(q * s.length - 1e-9)) - 1]; };
  /* linear interpolation between order statistics (numpy default, R type 7): position (n-1)q */
  const linear = (xs, q) => { const s = sorted(xs), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (h - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo]); };
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

  /* PURE: result shape = worked_example.result */
  function compute(inp) {
    return { p50: nearest(inp.lat, 0.5), p95: nearest(inp.lat, 0.95), p99: nearest(inp.lat, 0.99) };
  }

  /* seeded RNG (mulberry32) so the interval is the same every time you look at the same sample */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* PURE: percentile bootstrap, B resamples with replacement; returns {q: [lo, hi]} (2.5 and 97.5 percent of the resampled percentile) */
  function bootstrapCI(xs, qs, B, seed) {
    const r = rng(seed), n = xs.length, out = qs.map(() => []);
    for (let b = 0; b < B; b++) {
      const s = new Array(n); for (let i = 0; i < n; i++) s[i] = xs[Math.floor(r() * n)];
      qs.forEach((q, j) => out[j].push(nearest(s, q)));
    }
    const res = {}; qs.forEach((q, j) => { const v = sorted(out[j]); res[q] = [v[Math.floor(0.025 * (B - 1))], v[Math.ceil(0.975 * (B - 1))]]; });
    return res;
  }

  /* PURE: coordinated omission, simulated (not measured). One server, constant service time, one stall.
     Open loop: a request is INTENDED every `gap` ms whatever happens; latency = finish - intended time (queueing counts).
     Closed loop: the next request is sent only after the previous reply; latency = finish - send time (the queue is never seen).
     Both run for the same wall time `dur` ms. */
  function coordinatedOmission(o) {
    const { svc, gap, stallAt, stall, dur } = o;
    const serve = (start) => (start <= stallAt && start + svc > stallAt ? start + svc + stall : (start >= stallAt && start < stallAt + stall ? stallAt + stall + svc : start + svc));
    const open = []; let free = 0;
    for (let t = 0; t < dur; t += gap) { const st = Math.max(t, free); const fin = serve(st); free = fin; open.push(fin - t); }
    const closed = []; let t = 0;
    while (t < dur) { const fin = serve(t); closed.push(fin - t); t = Math.max(fin, t + gap); }
    return { open, closed };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => ({ answers: a[0], qs: Object.fromEntries(a[1].map(q => [q.id, q])) }));
    return realData;
  }

  /* shared panel: histogram + table (nearest rank, interpolated, bootstrap CI, mean) + formula with the live numbers.
     opts: {unit, scale, get(): lat array, label(i): text for sample i or null, dec} */
  function stats(K, host, getLat, unit, dec, extra) {
    const hist = K.el('div'), tbl = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    host.append(hist, tbl, formula, note);
    const W = 640, H = 150, M = { l: 8, r: 8, t: 14, b: 26 };
    function render() {
      const lat = getLat(), n = lat.length, s = sorted(lat), r = compute({ lat }), mu = mean(lat);
      const lo = 0, hi = s[n - 1] * 1.05, X = v => M.l + (W - M.l - M.r) * (v - lo) / (hi - lo);
      const nb = Math.min(24, Math.max(6, Math.round(Math.sqrt(n) * 2.2))), bw = (hi - lo) / nb, bins = new Array(nb).fill(0);
      lat.forEach(v => { bins[Math.min(nb - 1, Math.floor((v - lo) / bw))]++; });
      const mx = Math.max(...bins), svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'histogram of latencies with p50, p95, p99 and mean lines' });
      bins.forEach((c, i) => { const h = c ? (H - M.t - M.b) * c / mx : 0; svg.append(K.svg('rect', { x: X(lo + i * bw) + 1, y: H - M.b - h, width: Math.max(1, X(lo + (i + 1) * bw) - X(lo + i * bw) - 2), height: h, fill: '#7C9CFF', opacity: 0.55 })); });
      svg.append(K.svg('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: '#68707F' }));
      const line = (v, col, lab, row, dash) => { svg.append(K.svg('line', { x1: X(v), x2: X(v), y1: M.t - 4, y2: H - M.b, stroke: col, 'stroke-width': 2, 'stroke-dasharray': dash || '' }), K.svg('text', { x: Math.min(W - 70, X(v) + 3), y: M.t + 6 + row * 12, fill: col, style: `fill:${col}` }, lab)); };
      line(r.p50, '#3CC7B4', 'p50', 0); line(r.p95, '#F2A93B', 'p95', 1); line(r.p99, '#FF8A65', 'p99', 2); line(mu, '#C28BFF', 'mean', 3, '4 3');
      [0, 0.5, 1].forEach(f => svg.append(K.svg('text', { x: M.l + (W - M.l - M.r) * f, y: H - 8, 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' }, K.fmt(lo + (hi - lo) * f, dec) + ' ' + unit)));
      hist.replaceChildren(svg);
      const ci = bootstrapCI(lat, [0.5, 0.95, 0.99], 2000, 7);
      const row = (name, q, v) => K.el('tr', {}, K.el('td', {}, name), K.el('td', { class: 'num' }, K.fmt(v, dec)), K.el('td', { class: 'num' }, K.fmt(linear(lat, q), dec + 1)), K.el('td', { class: 'num' }, `[${K.fmt(ci[q][0], dec)}, ${K.fmt(ci[q][1], dec)}]`), K.el('td', { class: 'num' }, 'x(' + Math.max(1, Math.ceil(q * n - 1e-9)) + ')'));
      tbl.replaceChildren(K.el('div', { style: 'overflow-x:auto;max-width:100%' }, K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['p', 'nearest (' + unit + ')', 'interp.', '95% CI', 'rank'].map(h => K.el('th', {}, h))),
        row('p50', 0.5, r.p50), row('p95', 0.95, r.p95), row('p99', 0.99, r.p99), K.el('tr', {}, K.el('td', {}, 'mean'), K.el('td', { class: 'num' }, K.fmt(mu, dec + 1)), K.el('td', {}, ''), K.el('td', {}, ''), K.el('td', {}, '')))));
      tbl.querySelectorAll('td:nth-child(2)').forEach(td => K.flash(td));
      const k = q => Math.max(1, Math.ceil(q * n - 1e-9));
      formula.textContent = `n = ${n} sorted latencies x(1) <= ... <= x(${n})\np50 = x(ceil(0.50 x ${n})) = x(${k(0.5)}) = ${K.fmt(r.p50, dec)} ${unit}\np95 = x(ceil(0.95 x ${n})) = x(${k(0.95)}) = ${K.fmt(r.p95, dec)} ${unit}\np99 = x(ceil(0.99 x ${n})) = x(${k(0.99)}) = ${K.fmt(r.p99, dec)} ${unit}${k(0.99) === n ? '   <- this is the MAXIMUM of the sample' : ''}\nmean = ${K.fmt(mu, dec + 1)} ${unit}   (mean / p50 = ${K.fmt(mu / r.p50, 2)})`;
      const warn = [];
      if (k(0.99) === n) warn.push(`With n = ${n}, p99 is the largest value: one slow call IS p99. The bootstrap interval shows how little this number is pinned down. You need about 100 samples before p99 is not the maximum, and many hundreds for it to be stable.`);
      if (k(0.95) === n) warn.push('p95 is the maximum too.');
      if (mu > 1.25 * r.p50) warn.push(`The mean (${K.fmt(mu, dec + 1)}) is ${K.fmt(mu / r.p50, 2)}x the median: the tail drags the mean up. Report percentiles, never the mean alone.`);
      else warn.push('Here the mean (' + K.fmt(mu, dec + 1) + ') is close to the median (' + K.fmt(r.p50, dec) + '): no heavy tail. Add a slow call to see the mean move away from p50.');
      note.textContent = warn.join(' ') + ' Interpolated column = the other common rule (linear between neighbours); the two rules differ for small n, so say which one you use.';
      if (extra) extra(lat, r);
    }
    return render;
  }

  function coPanel(K, host) {
    const st = { svc: 5, gap: 10, stallAt: 2000, stall: 1000, dur: 6000 };
    const out = K.el('div', { class: 'formula', 'aria-live': 'polite' }), cap = K.el('p', { class: 'hint' });
    const S = {}; const mk = (k, lab, a, b, step) => { S[k] = K.slider(lab, a, b, step, st[k], v => { st[k] = v; go(); }); return K.el('div', { class: 'row' }, S[k].node); };
    const det = K.el('details', {}, K.el('summary', {}, 'Coordinated omission (simulated, not measured): why a closed-loop test hides the tail'),
      K.el('p', { class: 'hint' }, 'A server answers in 5 ms but freezes once for the stall time. Open loop: a request is due every 10 ms whatever happens, so the ones that arrive during the freeze wait and their wait counts. Closed loop: the tester waits for each reply before sending the next, so only ONE request ever sees the freeze.'),
      mk('stall', 'stall (ms)', 0, 3000, 100), mk('gap', 'a request is due every (ms)', 6, 50, 1), out, cap);
    host.append(det);
    function go() {
      const r = coordinatedOmission(st), f = a => `n=${String(a.length).padStart(3)}  p50 ${K.fmt(nearest(a, .5), 0)} ms   p95 ${K.fmt(nearest(a, .95), 0)} ms   p99 ${K.fmt(nearest(a, .99), 0)} ms   max ${K.fmt(Math.max(...a), 0)} ms`;
      out.textContent = 'open loop  (honest):  ' + f(r.open) + '\nclosed loop (omits):  ' + f(r.closed);
      cap.textContent = 'Same server, same freeze, same wall time (' + st.dur + ' ms). The closed loop records ' + r.closed.length + ' samples and only one is slow, so its p99 looks fine while ' + r.open.filter(v => v > 3 * st.svc).length + ' real users in the open-loop run waited. Servers with a mean service time of 5 ms and one stall are enough to see it.';
    }
    go();
  }

  function mountToy(el) {
    const K = root.DemoKit, st = clone(defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'TOY: 20 invented latencies in ms (the worked example). Edit any value, add or remove calls. Then press "break it".');
    const edit = K.el('div', { class: 'row' }), pre = K.el('div', { class: 'row' }), host = K.el('div');
    shell.append(pre, edit, host);
    let render;
    const rebuild = () => {
      edit.replaceChildren(...st.lat.map((v, i) => { const inp = K.el('input', { type: 'number', value: v, min: 0, step: 'any', style: 'width:58px', 'aria-label': 'latency ' + (i + 1) }); inp.addEventListener('input', () => { const x = parseFloat(inp.value); if (Number.isFinite(x) && x >= 0) { st.lat[i] = x; render(); } }); return inp; }));
      pre.replaceChildren(
        btn('Worked example', () => { st.lat = defaults.lat.slice(); rebuild(); render(); }),
        btn('Break it: remove the 95 ms outlier', () => { st.lat = defaults.lat.slice(); st.lat[19] = 12; rebuild(); render(); }),
        btn('Break it: add 100 fast calls (p99 stops being the max)', () => { st.lat = defaults.lat.concat(new Array(100).fill(12)); rebuild(); render(); }),
        btn('One call is 10 s', () => { st.lat = defaults.lat.slice(); st.lat[19] = 10000; rebuild(); render(); }));
    };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    render = stats(K, host, () => st.lat, 'ms', 0);
    coPanel(K, host);
    rebuild(); render();
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'ALL', extra: 0, nsub: 36 };
    const shell = K.shell(el, 'Real example: latency percentiles of 36 real LLM calls',
      'These are LLM-CALL latencies of the answer study (12 questions x 3 arms, qwen3.7-plus, wall clock of one non-streaming call from a shared machine, endpoint in China, one run, 2026-10-08), NOT ANN-search latencies: the HNSW experiment stores only a mean ms/query per setting, no per-query latencies, so an ANN percentile cannot be computed honestly (real ANN percentiles: pending). The 36 calls are a real sample to show the percentile maths. n = 12 per arm and 36 pooled is demo scale: p99 is the maximum.');
    const all = D.answers.map((a, i) => ({ i, qid: a.qid, arm: a.arm, s: a.latency_s, refused: a.refused }));
    const arms = K.el('div', { class: 'row', role: 'group', 'aria-label': 'sample' }), host = K.el('div'), info = K.el('p', { class: 'hint', 'aria-live': 'polite' });
    const sub = K.slider('use only the first n calls (in question order)', 6, 36, 1, st.nsub, v => { st.nsub = v; render(); });
    const ex = K.slider('add one extra call of (seconds, 0 = none)', 0, 60, 1, 0, v => { st.extra = v; render(); });
    const abtn = {};
    [['ALL', 'all 36 calls'], ['A', 'arm A (12)'], ['B', 'arm B (12)'], ['C', 'arm C (12)']].forEach(([k, t]) => { abtn[k] = K.el('button', { type: 'button', onclick: () => { st.arm = k; render(); } }, t); arms.append(abtn[k]); });
    shell.append(arms, K.el('div', { class: 'row' }, sub.node), K.el('div', { class: 'row' }, ex.node), info, host);
    const cur = () => { let rows = all.filter(r => st.arm === 'ALL' || r.arm === st.arm); rows = rows.slice(0, Math.min(st.nsub, rows.length)); return rows; };
    const get = () => cur().map(r => r.s).concat(st.extra > 0 ? [st.extra] : []);
    const draw = stats(K, host, get, 's', 2, null);
    function render() {
      Object.keys(abtn).forEach(k => abtn[k].setAttribute('aria-pressed', String(k === st.arm)));
      const rows = cur(), slow = rows.slice().sort((a, b) => b.s - a.s)[0];
      info.textContent = `Sample: ${rows.length} real calls${st.extra > 0 ? ' + 1 invented call of ' + st.extra + ' s (your slider)' : ''}. Slowest real call: ${slow.qid} arm ${slow.arm}, ${K.fmt(slow.s, 2)} s (call index ${slow.i + 1} of 36; latency alone does not say why: network, queue or generation length). Use the arm buttons to see that p50 barely moves between arms while the max (= p99 here) does: ranking arms by p99 of 12 calls is ranking noise.`;
      draw();
    }
    coPanel(K, host);
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
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, nearest, linear, bootstrapCI, coordinatedOmission };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_latency_pct'] = api;
})(this);
