/* Index build time and ingest rate: r = N / T_build.
   Default = Real example (real hnswlib builds from the real-example pack + our own repeated re-measurement).
   Toy example (break it) = the catalogue example, editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { n: 1000000, seconds: 500, optimiserSeconds: 0, includeOptimiser: false };

  /* PURE. Ingest rate in vectors per second. T_build = upload/build seconds (+ optimiser seconds if counted). */
  function compute(inp) {
    const T = inp.seconds + (inp.includeOptimiser ? (inp.optimiserSeconds || 0) : 0);
    return inp.n / T;
  }
  const fmtInt = x => Math.round(x).toLocaleString('en-US');
  const fmtT = s => s >= 100 ? s.toFixed(0) + ' s' : s >= 1 ? s.toFixed(1) + ' s' : (s * 1000).toFixed(s < 0.1 ? 1 : 0) + ' ms';

  function bars(K, rows) {
    const wrap = K.el('div', { style: 'display:grid;gap:3px;margin:6px 0' });
    rows.forEach(([lab, v, vmax, col, txt, tip]) => wrap.append(K.el('div', { style: 'display:grid;grid-template-columns:minmax(70px,150px) 1fr minmax(60px,110px);gap:8px;align-items:center;font-size:12px', title: tip || '' },
      K.el('span', { class: 'num', style: 'color:var(--muted)' }, lab),
      K.el('span', { style: 'background:var(--panel2);border-radius:3px;height:10px;display:block' },
        K.el('span', { style: 'display:block;height:10px;border-radius:3px;background:' + col + ';width:' + Math.max(1, Math.min(1, v / vmax) * 100) + '%' })),
      K.el('span', { class: 'num', style: 'text-align:right' }, txt))));
    return wrap;
  }

  /* ---------- TOY ---------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults, { optimiserSeconds: 400 });
    const shell = K.shell(el, 'Toy example (break it)', 'Invented numbers: the catalogue example, 1,000,000 vectors in 500 s. Move the sliders; try counting the optimiser time, or compare a fast, poor graph with a slow, good one.');
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), cmp = K.el('div', {});
    const sN = K.slider('N (thousand vectors)', 10, 10000, 10, st.n / 1000, v => { st.n = v * 1000; render(); });
    const sT = K.slider('upload / build seconds', 10, 2000, 10, st.seconds, v => { st.seconds = v; render(); });
    const sO = K.slider('optimiser seconds after upload', 0, 2000, 10, st.optimiserSeconds, v => { st.optimiserSeconds = v; render(); });
    const tg = K.el('button', { type: 'button', 'aria-pressed': 'false' }, 'Count optimiser time');
    tg.addEventListener('click', () => { st.includeOptimiser = !st.includeOptimiser; tg.setAttribute('aria-pressed', String(st.includeOptimiser)); render(); });
    const btn = (t, f) => { const b = K.el('button', { type: 'button' }, t); b.addEventListener('click', f); return b; };
    const cmpSt = { tA: 500, rA: 0.99, tB: 60, rB: 0.8 };
    const sTA = K.slider('graph A: build seconds', 10, 2000, 10, cmpSt.tA, v => { cmpSt.tA = v; render(); });
    const sRA = K.slider('graph A: recall@10', 0.5, 1, 0.01, cmpSt.rA, v => { cmpSt.rA = v; render(); });
    const sTB = K.slider('graph B: build seconds', 10, 2000, 10, cmpSt.tB, v => { cmpSt.tB = v; render(); });
    const sRB = K.slider('graph B: recall@10', 0.5, 1, 0.01, cmpSt.rB, v => { cmpSt.rB = v; render(); });
    const setAll = (n, t, o, inc) => { st.n = n; st.seconds = t; st.optimiserSeconds = o; st.includeOptimiser = inc; sN.set(n / 1000); sT.set(t); sO.set(o); tg.setAttribute('aria-pressed', String(inc)); render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => setAll(1000000, 500, 0, false)),
      btn('Break it: optimiser not counted', () => setAll(1000000, 500, 400, false)),
      btn('Break it: optimiser counted', () => setAll(1000000, 500, 400, true))),
      K.el('div', { class: 'row' }, sN.node, sT.node, sO.node, tg), res.node, formula, note,
      K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, 'A fast build with low recall is not a win'),
      K.el('div', { class: 'row' }, sTA.node, sRA.node), K.el('div', { class: 'row' }, sTB.node, sRB.node), cmp);
    function render() {
      const v = compute(st), T = st.seconds + (st.includeOptimiser ? st.optimiserSeconds : 0);
      res.set(v, 1);
      formula.textContent = `r_ingest = N / T_build = ${fmtInt(st.n)} / ${T} s = ${fmtInt(v)} vectors/s` +
        (st.includeOptimiser ? `\n(T_build = ${st.seconds} s upload + ${st.optimiserSeconds} s optimiser)` : st.optimiserSeconds > 0 ? `\n(optimiser time ${st.optimiserSeconds} s NOT counted: the index is not at its target recall yet, so the rate is flattering)` : '');
      note.textContent = 'T_build means: until the index can serve at its target recall.';
      const rA = st.n / cmpSt.tA, rB = st.n / cmpSt.tB;
      cmp.replaceChildren(bars(K, [
        ['A build rate', rA, Math.max(rA, rB), 'var(--k12)', fmtInt(rA) + '/s'], ['B build rate', rB, Math.max(rA, rB), 'var(--k12)', fmtInt(rB) + '/s'],
        ['A recall@10', cmpSt.rA, 1, 'var(--he)', K.fmt(cmpSt.rA, 2)], ['B recall@10', cmpSt.rB, 1, 'var(--he)', K.fmt(cmpSt.rB, 2)]]),
        K.el('p', { class: 'hint' + (rB > rA && cmpSt.rB < cmpSt.rA - 0.05 ? ' bad' : '') }, `B ingests ${K.fmt(rB / rA, 2)}x as fast but its recall is ${K.fmt(cmpSt.rB - cmpSt.rA, 2)} relative to A. Compare build times only at equal recall.`));
    }
    render();
  }

  /* ---------- REAL ---------- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = SCRIPT_SRC || location.href;
    const get = rel => { const u = new URL(rel, base).href; return fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); };
    realP = Promise.all([get('../../_real-examples/data/hnsw_experiment.json'), get('data/ann_build_memory.real.json')]).then(a => ({ hnsw: a[0], meas: a[1] }));
    return realP;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const shell = K.shell(el, 'Real example: building a real HNSW index (hnswlib)',
      'Demo scale, NOT a benchmark. Index = MiniLM vectors of Wikipedia passages (138 corpus passages, or 20,000 Simple English Wikipedia passages), real hnswlib 0.8.0, one thread. Two builds: standard (M=16, efConstruction=200) and weak (M=4, efConstruction=16). Timings were taken while the Mac was swapping (load average about 20): they are noisy, and we show two independent measurements of the same build to prove it.');
    const st = { set: 'large', M: 16, ef: 64, src: 'stored' };
    const runOf = (set, M, q) => D.hnsw[set].runs.find(r => r.build.M === M && (q ? r.queries.startsWith('500') || r.queries.startsWith('each') : false));
    const measOf = (set, M) => D.meas[set].find(r => r.build.M === M);
    const N = set => D.hnsw[set].runs[0].n_index;
    const secs = (set, M, src) => src === 'stored' ? runOf(set, M, true).build_seconds : measOf(set, M).median;
    const recAt = (set, M, ef) => { const r = runOf(set, M, true); const p = r.points.find(p => p.k === 10 && p.ef_search === ef); return p ? p.recall : NaN; };
    const mk = (lab, opts, get, set) => { const s = K.el('select', { 'aria-label': lab }, opts.map(([v, t]) => K.el('option', Object.assign({ value: v }, String(v) === String(get()) ? { selected: '' } : {}), t))); s.addEventListener('change', () => { set(s.value); render(); }); return K.el('label', {}, lab + ' ', s); };
    const selSet = mk('index', [['small', '138 passages'], ['large', '20,000 passages']], () => st.set, v => { st.set = v; });
    const selM = mk('build', [[16, 'standard M=16, efC=200'], [4, 'weak M=4, efC=16']], () => st.M, v => { st.M = Number(v); });
    const selS = mk('timing', [['stored', 'pack run (stored build_seconds)'], ['meas', 'our re-measurement (median)']], () => st.src, v => { st.src = v; });
    const efs = [10, 12, 16, 24, 32, 48, 64, 128, 256];
    const sEf = K.slider('efSearch (for recall)', 0, efs.length - 1, 1, efs.indexOf(st.ef), v => { st.ef = efs[v]; efOut.textContent = ''; render(); });
    const efOut = K.el('span', {});
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), cmp = K.el('div', {}), spread = K.el('div', {}), extra = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, selSet, selM, selS), K.el('div', { class: 'row' }, sEf.node), res.node, formula, extra,
      K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, 'Build time against recall: both builds, same index'), cmp,
      K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, 'How noisy is the timing? Same build, measured more than once'), spread);
    function render() {
      const { set, M, ef, src } = st, n = N(set), T = secs(set, M, src), v = compute({ n, seconds: T }), b = runOf(set, M, true).build;
      res.set(v, 1);
      const r10 = recAt(set, M, ef);
      formula.textContent = `r_ingest = N / T_build = ${fmtInt(n)} / ${T} s = ${fmtInt(v)} vectors/s\nsource: ${src === 'stored' ? 'build_seconds stored in _real-examples/data/hnsw_experiment.json (' + D.hnsw[set === 'large' ? 'large' : 'small'].runs[0].queries + ' runs share one build)' : 'ann_build_memory.build.py, ' + measOf(set, M).reps + ' build(s), single thread, same vectors'}\nrecall@10 at efSearch ${ef}: ${r10}  (500 held-out passage queries / each passage; stored in the pack)`;
      const all = [16, 4].map(m => ({ M: m, T: secs(set, m, src), rec: recAt(set, m, ef) })).map(o => Object.assign(o, { rate: n / o.T }));
      const maxR = Math.max.apply(null, all.map(o => o.rate));
      cmp.replaceChildren(bars(K, all.flatMap(o => [[`M=${o.M} rate`, o.rate, maxR, o.M === M ? 'var(--ai)' : 'var(--k12)', fmtInt(o.rate) + '/s', `build ${fmtT(o.T)}`], [`M=${o.M} recall@10`, o.rec, 1, o.M === M ? 'var(--ai)' : 'var(--he)', K.fmt(o.rec, 3)]])),
        K.el('p', { class: 'hint' }, `The weak build is ${K.fmt(all[1].rate / all[0].rate, 1)}x faster to build, but recall@10 at efSearch ${ef} is ${K.fmt(all[1].rec, 3)} against ${K.fmt(all[0].rec, 3)}. ` +
          (set === 'small' ? 'On 138 vectors both finish in milliseconds and recall is nearly flat: build time is not a decision driver here.' : 'A fast build with a poor graph is not a win: you pay for it in recall or in a larger efSearch (slower queries).')));
      const rows = ['stored', 'meas'].flatMap(s => [16, 4].map(m => [`${s === 'stored' ? 'pack run' : 're-measured'} M=${m}`, secs(set, m, s), 1, s === 'stored' ? 'var(--k12)' : 'var(--ai)', fmtT(secs(set, m, s))]));
      const mx = Math.max.apply(null, rows.map(r => r[1])); rows.forEach(r => r[2] = mx);
      const m0 = measOf(set, M);
      spread.replaceChildren(bars(K, rows), K.el('p', { class: 'hint' + (set === 'large' ? ' bad' : '') },
        set === 'large' ? `The same 20,000-vector build took ${fmtT(runOf(set, 16, true).build_seconds)} in the pack run and ${fmtT(measOf(set, 16).median)} when we repeated it (${K.fmt(measOf(set, 16).median / runOf(set, 16, true).build_seconds, 1)}x slower, the Mac was swapping). One timing is a sample, not a property of the index.`
          : `Across ${m0.reps} repeated builds of the 138 vectors (M=${M}): min ${fmtT(m0.min)}, median ${fmtT(m0.median)}, max ${fmtT(m0.max)}; the pack run stored ${fmtT(runOf(set, M, true).build_seconds)}. The spread is ${K.fmt(m0.max / m0.min, 1)}x between fastest and slowest.`));
      const proj = 1e6 / v;
      extra.textContent = `Extrapolation (arithmetic, not measured): at ${fmtInt(v)} vectors/s, 1,000,000 vectors would take ${fmtT(proj)}. HNSW build cost grows faster than linearly in N, so treat this as a lower bound.`;
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realP = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_build_time'] = api;
})(this);
