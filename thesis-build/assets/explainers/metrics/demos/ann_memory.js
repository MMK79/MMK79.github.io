/* Index memory in bytes per vector: B_vec = M_index / N ~ d * b_dtype + graph links.
   Default = Real example (real hnswlib index files, exact PQ byte counts from our real IVF+PQ run).
   Toy example (break it) = the catalogue example, editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { d: 768, bytesPerComponent: 4, M: 16, n: 1000000 };

  /* PURE. Bytes per vector of a textbook HNSW layout: raw vector + level-0 links (2M links of 4 bytes). */
  function compute(inp) { return inp.d * inp.bytesPerComponent + 2 * inp.M * 4; }

  const fmtInt = x => Math.round(x).toLocaleString('en-US');
  const fmtB = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : b >= 1e3 ? (b / 1e3).toFixed(1) + ' kB' : Math.round(b) + ' B';

  /* stacked horizontal bar; parts = [[label, bytes, colour]] */
  function stack(K, parts, scaleMax) {
    const tot = parts.reduce((a, p) => a + p[1], 0);
    const bar = K.el('div', { style: 'display:flex;height:22px;border-radius:4px;overflow:hidden;background:var(--panel2);width:' + Math.max(2, tot / scaleMax * 100) + '%' },
      parts.map(p => K.el('span', { style: 'display:block;height:22px;background:' + p[2] + ';width:' + (p[1] / tot * 100) + '%', title: `${p[0]}: ${K.fmt(p[1], 1)} B` })));
    const leg = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;margin-top:4px' },
      parts.map(p => K.el('span', { class: 'num', style: 'color:var(--muted)' }, K.el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:2px;background:${p[2]};margin-right:4px` }), `${p[0]} ${K.fmt(p[1], 1)} B`)));
    return K.el('div', { style: 'margin:6px 0' }, bar, leg);
  }

  /* ---------- TOY ---------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults, { payload: 0 });
    const shell = K.shell(el, 'Toy example (break it)', 'Invented sizes: the catalogue example, 1,000,000 vectors of 768 dimensions with float32, HNSW M=16. The link formula is the textbook layout (2M links of 4 bytes on level 0), unverified against any particular database.');
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), vis = K.el('div', {});
    const sD = K.slider('d (dimensions)', 32, 4096, 32, st.d, v => { st.d = v; render(); });
    const sM = K.slider('M (HNSW links)', 2, 64, 1, st.M, v => { st.M = v; render(); });
    const sN = K.slider('N (thousand vectors)', 1, 10000, 1, st.n / 1000, v => { st.n = v * 1000; render(); });
    const sP = K.slider('payload bytes per vector', 0, 4000, 50, 0, v => { st.payload = v; render(); });
    const dt = K.el('select', { 'aria-label': 'data type' }, [['4', 'float32 (4 B)'], ['2', 'float16 (2 B)'], ['1', 'int8 (1 B)']].map(([v, t]) => K.el('option', { value: v }, t)));
    dt.addEventListener('change', () => { st.bytesPerComponent = Number(dt.value); render(); });
    const btn = (t, f) => { const b = K.el('button', { type: 'button' }, t); b.addEventListener('click', f); return b; };
    const setAll = (d, M, b, n, p) => { st.d = d; st.M = M; st.bytesPerComponent = b; st.n = n; st.payload = p; sD.set(d); sM.set(M); sN.set(n / 1000); sP.set(p); dt.value = String(b); render(); };
    shell.append(K.el('div', { class: 'row' }, btn('Worked example', () => setAll(768, 16, 4, 1e6, 0)), btn('Break it: add a 1 kB payload', () => setAll(768, 16, 4, 1e6, 1000)), btn('Break it: int8 quantised', () => setAll(768, 16, 1, 1e6, 0))),
      K.el('div', { class: 'row' }, sD.node, sM.node, sN.node), K.el('div', { class: 'row' }, K.el('label', {}, 'component ', dt), sP.node), res.node, formula, vis, note);
    function render() {
      const raw = st.d * st.bytesPerComponent, links = 2 * st.M * 4, v = compute(st), tot = (v + st.payload) * st.n;
      res.set(v, 1);
      formula.textContent = `B_vec = d * b + 2M * 4 = ${st.d} * ${st.bytesPerComponent} + ${2 * st.M} * 4 = ${raw} + ${links} = ${fmtInt(v)} B per vector\nN * B_vec = ${fmtInt(st.n)} * ${fmtInt(v)} = ${fmtB(st.n * v)}` + (st.payload ? `\nwith ${st.payload} B payload per vector: ${fmtInt(v + st.payload)} B each, ${fmtB(tot)} in total (the formula does not include it)` : '');
      vis.replaceChildren(stack(K, [['raw vector', raw, 'var(--k12)'], ['level-0 links', links, 'var(--ai)']].concat(st.payload ? [['payload', st.payload, 'var(--warn)']] : []), raw + links + st.payload));
      note.textContent = 'Counts only what the formula names. Payload, replicas, upper-level links, labels and the OS cache change the answer; quantisation cuts the vector part at some recall cost.';
    }
    render();
  }

  /* ---------- REAL ---------- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = SCRIPT_SRC || location.href;
    const get = rel => { const one = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); return one(new URL(rel, base).href).catch(e => { const alt = rel.replace('../../algorithms/', '../../algorithms/'); if (alt === rel) throw e; return one(new URL(alt, base).href); }); }; /* site layout: the algorithms data sits at ../../algorithms/ */
    realP = Promise.all([get('data/ann_build_memory.real.json'), get('../../algorithms/data/real-ivf_pq.json')]).then(a => ({ meas: a[0], ivf: a[1] }));
    return realP;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, R = D.ivf, d = R.D;
    const shell = K.shell(el, 'Real example: how many bytes does one vector cost?',
      'Demo scale, NOT a benchmark. Section 1: real hnswlib 0.8.0 indexes, memory = the size of the saved index file (vectors + links + labels), measured by us. Section 2: our own IVF+PQ run (138 passages, 384-d, 16-centroid codebooks): bytes per code are exact, memory = codes + codebooks + coarse centroids, computed from m, k* and d. Sizes are byte counts, so unlike timings they do not depend on the Mac swapping.');
    const st = { set: 'large', M: 16, m: 8, N: 138 };
    const mk = (lab, opts, get, set) => { const s = K.el('select', { 'aria-label': lab }, opts.map(([v, t]) => K.el('option', Object.assign({ value: v }, String(v) === String(get()) ? { selected: '' } : {}), t))); s.addEventListener('change', () => { set(s.value); render(); }); return K.el('label', {}, lab + ' ', s); };
    const selSet = mk('index', [['small', '138 passages'], ['large', '20,000 passages']], () => st.set, v => { st.set = v; });
    const selM = mk('build', [[16, 'standard M=16'], [4, 'weak M=4']], () => st.M, v => { st.M = Number(v); });
    const selPQ = mk('PQ code', R.ms.map(m => [m, `m = ${m} sub-vectors`]), () => st.m, v => { st.m = Number(v); });
    const sN = K.slider('N for the PQ extrapolation (log10)', 2, 9, 0.1, Math.log10(st.N), v => { st.N = Math.round(Math.pow(10, v)); render(); });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), hn = K.el('div', {}), pq = K.el('div', {}), res2 = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    shell.append(K.el('h4', { style: 'margin:6px 0;font-weight:600' }, '1. HNSW (real hnswlib): bytes per vector'), K.el('div', { class: 'row' }, selSet, selM), res.node, formula, hn,
      K.el('h4', { style: 'margin:18px 0 4px;font-weight:600' }, '2. IVF + PQ (our real run): bytes per vector and total'), K.el('div', { class: 'row' }, selPQ, sN.node), pq, res2);
    function render() {
      const { set, M, m } = st, r = D.meas[set].find(x => x.build.M === M), n = r.n;
      // ---- hnsw
      const raw = d * 4, l0 = 2 * M * 4, cnt = 4, lab = 8, measured = r.bytes_per_vector, upper = measured - raw - l0 - cnt - lab;
      res.set(measured, 1);
      formula.textContent = `measured: ${fmtInt(r.index_file_bytes)} B / ${fmtInt(n)} vectors = ${K.fmt(measured, 1)} B per vector\nexpected from the layout: raw d*4 = ${raw}  +  level-0 links 2M*4 = ${l0}  +  link count ${cnt}  +  label ${lab}  =  ${raw + l0 + cnt + lab} B\nremainder (upper-level links): ${K.fmt(upper, 1)} B per vector`;
      hn.replaceChildren(stack(K, [['raw float32 vector', raw, 'var(--k12)'], ['level-0 links', l0, 'var(--ai)'], ['count+label', cnt + lab, 'var(--faint)'], ['upper levels', Math.max(upper, 0), 'var(--he)']], 1700),
        K.el('p', { class: 'hint' }, `Graph overhead is ${K.fmt((measured - raw) / raw * 100, 1)}% on top of the raw vectors. The vector dominates: with d=${d} the graph (M=${M}) adds only ${K.fmt(measured - raw, 1)} B. Total index: ${fmtB(r.index_file_bytes)} for ${fmtInt(n)} vectors. The same formula with the catalogue's d=768, M=16 gives 3,200 B; here d=384 gives about ${fmtInt(compute({ d: 384, bytesPerComponent: 4, M: 16 }))} B before labels and upper levels.`));
      // ---- pq (exact byte counts)
      const run = R.runs[String(m)], bitsPer = Math.log2(R.ks), code = m * bitsPer / 8, cb = m * R.ks * (d / m) * 4, coarse = R.kc * d * 4;
      if (Math.abs(code - run.bytes) > 1e-9) throw new Error('code size mismatch');
      const N = st.N, total = N * code + cb + coarse, perVec = total / N, rawTot = N * raw, rec = run.agg['8'].recall10;
      const cross = Math.ceil((cb + coarse) / (raw - code));
      pq.replaceChildren(stack(K, [['codes (m*log2(k*)/8)', code, 'var(--he)'], ['codebooks / N', cb / N, 'var(--ai)'], ['coarse centroids / N', coarse / N, 'var(--k12)']], raw),
        stack(K, [['raw float32 vector', raw, 'var(--faint)']], raw));
      res2.textContent = `code: m=${m} sub-vectors x log2(k*=${R.ks})=${bitsPer} bits = ${m * bitsPer} bits = ${code} B per vector (the run stores bytes = ${run.bytes}: match)\n` +
        `codebooks: m * k* * (d/m) * 4 B = ${m} * ${R.ks} * ${d / m} * 4 = ${fmtInt(cb)} B (same for every m: it is k* * d * 4)\ncoarse centroids: ${R.kc} cells * ${d} * 4 B = ${fmtInt(coarse)} B\n` +
        `N = ${fmtInt(N)}${N === R.n ? ' (the real index)' : ' (extrapolation: arithmetic, NOT measured)'}: total ${fmtB(total)} = ${K.fmt(perVec, 1)} B per vector, against raw float32 ${fmtB(rawTot)} (${fmtInt(raw)} B per vector): ${K.fmt(rawTot / total, 1)}x smaller\n` +
        `PQ beats raw storage from N = ${cross} vectors up (shared tables are paid once). recall@10 of this code (stored, w=8 cells, all 138 vectors scanned): ${rec}; raw float32 exact search = 1 by definition. Ids and inverted lists are not counted.`;
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_memory'] = api;
})(this);
