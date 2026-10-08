/* QPS = Q / T_total of an approximate-nearest-neighbour index. Meaningless without the recall it was measured at.
   Default = Real example (real hnswlib timings + our own IVFADC run). Toy example (break it) = the catalogue example, editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { Q: 10000, T: 4.0, threads: 1 };   // 10,000 queries in 4.0 s on one thread

  /* PURE. QPS = Q / T_total (T_total = wall-clock seconds for all Q queries, on the stated threads). */
  function compute(inp) { return inp.Q / inp.T; }

  function bars(K, rows, max, foot) {
    const wrap = K.el('div', { style: 'display:grid;gap:3px;margin:6px 0' });
    rows.forEach(([lab, v, col, txt, tip]) => wrap.append(K.el('div', { style: 'display:grid;grid-template-columns:84px 1fr 78px;gap:8px;align-items:center;font-size:12px', title: tip || '' },
      K.el('span', { class: 'num', style: 'color:var(--muted)' }, lab),
      K.el('span', { style: 'background:var(--panel2);border-radius:3px;height:10px;display:block' },
        K.el('span', { style: 'display:block;height:10px;border-radius:3px;background:' + col + ';width:' + Math.max(0, Math.min(1, v / max)) * 100 + '%' })),
      K.el('span', { class: 'num', style: 'text-align:right' }, txt))));
    return K.el('div', {}, wrap, foot || '');
  }

  /* ---------- TOY ---------- */
  function mountToy(el) {
    const K = root.DemoKit, st = { Q: defaults.Q, T: defaults.T, threads: 1, batch: false };
    const shell = K.shell(el, 'Toy example (break it)', 'Invented timings. Change the number of queries and the total time; QPS = Q / T_total. Then try the traps: the same QPS with a different recall means nothing, and a thread count or a batch changes T_total without changing the index.');
    const sQ = K.slider('queries Q', 100, 100000, 100, st.Q, v => { st.Q = v; render(); });
    const sT = K.slider('total time T (s)', 0.5, 20, 0.5, st.T, v => { st.T = v; render(); });
    const sTh = K.slider('threads (ideal speed-up)', 1, 8, 1, 1, v => { st.threads = v; render(); });
    const sRec = K.slider('recall at this setting', 0.3, 1, 0.01, 0.95, v => { st.rec = v; render(); }); st.rec = 0.95;
    const btn = (t, f) => { const b = K.el('button', { type: 'button' }, t); b.addEventListener('click', f); return b; };
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (10,000 in 4 s)', () => { st.Q = 10000; st.T = 4; st.threads = 1; st.rec = 0.95; sQ.set(10000); sT.set(4); sTh.set(1); sRec.set(0.95); render(); }),
      btn('Break it: 8 threads, same index', () => { st.threads = 8; sTh.set(8); render(); }),
      btn('Break it: fast because it is wrong', () => { st.T = 1; sT.set(1); st.rec = 0.4; sRec.set(0.4); render(); }));
    shell.append(presets, K.el('div', { class: 'row' }, sQ.node, sT.node), K.el('div', { class: 'row' }, sTh.node, sRec.node), res.node, formula, note);
    function render() {
      const T = st.T / st.threads, v = compute({ Q: st.Q, T }), base = compute({ Q: st.Q, T: st.T });
      res.set(v, 1);
      formula.textContent = `QPS = Q / T_total = ${st.Q} / ${K.fmt(T, 3)} s = ${K.fmt(v, 1)} queries/s` + (st.threads > 1 ? `\n(T_total = ${st.T} s / ${st.threads} threads, ideal; real scaling is worse)` : '');
      note.className = 'hint' + (st.rec < 0.8 ? ' bad' : '');
      note.textContent = `Paired with recall: (recall ${K.fmt(st.rec, 2)}, QPS ${K.fmt(v, 1)}).` + (st.threads > 1 ? ` The index is unchanged; only the hardware use is: one thread gave ${K.fmt(base, 1)}.` : '') +
        (st.rec < 0.8 ? ' A high QPS at this recall is not a good index: it is fast because it returns wrong neighbours.' : '');
    }
    render();
  }

  /* ---------- REAL ---------- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = SCRIPT_SRC || location.href;
    const get = rel => { const one = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); return one(new URL(rel, base).href).catch(e => { const alt = rel.replace('../../algorithms/', '../../algorithms/'); if (alt === rel) throw e; return one(new URL(alt, base).href); }); }; /* site layout: the algorithms data sits at ../../algorithms/ */
    realP = Promise.all([get('../../_real-examples/data/hnsw_experiment.json'), get('../../algorithms/data/real-ivf_pq.json')]).then(a => ({ hnsw: a[0], ivf: a[1] }));
    return realP;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, H = D.hnsw, R = D.ivf;
    const shell = K.shell(el, 'Real example: recall-QPS pairs of a real HNSW index',
      'Real hnswlib 0.8.0 timings (Mac, one thread). The pack stores the mean ms per query, so QPS = Q / T_total with T_total = Q x ms/1000, i.e. QPS = 1000 / mean ms. WARNING: the Mac was swapping, so these latencies are NOISY; compare shapes, not digits. Not a benchmark. Recall is against exact brute-force cosine search.');
    const st = { set: 'large', M: 16, qk: 'held', k: 10 };
    const sel = (lab, opts, get, set) => { const s = K.el('select', { 'aria-label': lab }, opts.map(([v, t]) => K.el('option', Object.assign({ value: v }, String(v) === String(get()) ? { selected: '' } : {}), t))); s.addEventListener('change', () => { set(s.value); render(); }); return K.el('label', {}, lab + ' ', s); };
    const body = K.el('div'), ivfBox = K.el('div');
    shell.append(K.el('div', { class: 'row' },
      sel('index', [['small', '138 passages'], ['large', '20,000 passages']], () => st.set, v => { st.set = v; }),
      sel('build', [[16, 'standard M=16'], [4, 'weak M=4']], () => st.M, v => { st.M = Number(v); }),
      sel('queries', [['held', 'held-out passages'], ['q', '24 questions']], () => st.qk, v => { st.qk = v; }),
      sel('k', [[10, 'k = 10'], [1, 'k = 1']], () => st.k, v => { st.k = Number(v); })), body, ivfBox);
    const find = () => { const nq = st.qk === 'q' ? 24 : (st.set === 'large' ? 500 : 138); return H[st.set].runs.find(r => r.build.M === st.M && r.n_queries === nq); };
    function render() {
      const run = find();
      if (!run) { body.replaceChildren(K.el('p', { class: 'hint bad' }, 'no such stored run')); return; }
      const pts = run.points.filter(p => p.k === st.k).map(p => ({ p, qps: compute({ Q: run.n_queries, T: run.n_queries * p.ms_per_query / 1000 }) }));
      const mx = Math.max.apply(null, pts.map(x => x.qps));
      const first = pts[0], last = pts[pts.length - 1];
      const tbl = K.el('table', { class: 'num', style: 'width:100%;border-collapse:collapse;font-size:12px' },
        K.el('tr', {}, ['efSearch', 'recall@' + st.k, 'ms/query', 'QPS'].map(h => K.el('th', { style: 'text-align:right;color:var(--muted);font-weight:500' }, h))),
        pts.map(x => K.el('tr', {}, [x.p.ef_search, x.p.recall, x.p.ms_per_query, K.fmt(x.qps, 0)].map(c => K.el('td', { style: 'text-align:right;padding:1px 4px' }, String(c))))));
      const warnRow = pts.filter(x => x.p.recall < 0.8);
      body.replaceChildren(
        K.el('h4', { style: 'margin:10px 0 4px;font-weight:600' }, `${st.set === 'large' ? '20,000' : '138'}-passage index, ${run.build.name} build (M=${run.build.M}, efC=${run.build.ef_construction}), ${run.n_queries} queries`),
        K.el('div', { style: 'overflow-x:auto' }, tbl),
        K.el('p', { class: 'hint' }, 'QPS (bars) next to recall (bars): read them as a pair.'),
        bars(K, pts.map(x => ['ef ' + x.p.ef_search, x.qps, 'var(--ai)', K.fmt(x.qps, 0) + ' QPS', `${x.p.ms_per_query} ms/query`]), mx),
        bars(K, pts.map(x => ['ef ' + x.p.ef_search, x.p.recall, x.p.recall < 0.8 ? 'var(--warn)' : 'var(--he)', 'rec ' + K.fmt(x.p.recall, 3)]), 1),
        K.el('div', { class: 'formula', 'aria-live': 'polite' }, `QPS = Q / T_total = ${run.n_queries} / (${run.n_queries} x ${first.p.ms_per_query} ms) = ${K.fmt(first.qps, 0)} at ef ${first.p.ef_search} (recall ${first.p.recall})\n` +
          `raising ef to ${last.p.ef_search}: recall ${last.p.recall}, QPS ${K.fmt(last.qps, 0)} (${K.fmt(first.qps / last.qps, 1)}x slower)`),
        K.el('p', { class: 'hint' + (warnRow.length ? ' bad' : '') }, (warnRow.length ? `Rows with recall below 0.8 (${warnRow.map(x => 'ef ' + x.p.ef_search).join(', ')}) have the highest QPS and are useless: that speed is bought with wrong neighbours. Try build = weak M=4, or queries = 24 questions on the large index. ` : 'All rows here have good recall, but compare with the weak build to see how QPS alone misleads. ') +
          (st.set === 'small' ? 'The 138-passage index is so small that every setting takes tens of microseconds: QPS differences are mostly timer noise. ' : '') +
          'Noisy timings (swapping Mac), one thread, single query at a time (no batching): QPS here is 1 / mean latency, a stored-timing estimate, not a measured throughput under load.'));
      // IVF
      const ms = R.ms, rows = [];
      ms.forEach(m => { [1, 2, 4].forEach(w => { const a = R.runs[String(m)].agg[String(w)]; rows.push([`m=${m} w=${w}`, a.recall10, a.scanned]); }); });
      ivfBox.replaceChildren(K.el('h4', { style: 'margin:18px 0 4px;font-weight:600' }, '2. Our own IVF+PQ run: no timings stored, so cost is "vectors scanned"'),
        K.el('p', { class: 'hint' }, 'The numpy IVFADC run (138 passages, 8 cells) did not record time, so we do NOT invent a QPS. The hardware-independent cost it does record is the number of vectors scanned per query (of 138); fewer scanned means more QPS on any machine, roughly. Pair, again: recall@10 against scanned.'),
        bars(K, rows.map(r => [r[0], r[2], 'var(--k12)', K.fmt(r[2], 1) + ' scanned', `recall@10 ${r[1]}`]), R.n),
        bars(K, rows.map(r => [r[0], r[1], r[1] < 0.8 ? 'var(--warn)' : 'var(--he)', 'rec ' + K.fmt(r[1], 3)]), 1));
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realP = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_qps'] = api;
})(this);
