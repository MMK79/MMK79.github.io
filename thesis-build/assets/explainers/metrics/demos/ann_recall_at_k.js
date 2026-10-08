/* Recall@k vs exact kNN: how many of the k true nearest neighbours did the approximate index return?
   Default = Real example (our IVFADC run per query + real hnswlib curves from the real-example pack).
   Toy example (break it) = the catalogue example, editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    exact: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],      // exact top-10 ids (brute force)
    approx: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12],    // ids returned by the index
    k: 10,
  };

  /* PURE. Set form: |A_k ∩ T_k| / k.
     Distance form (optional inp.dist = {id: distance}): count returned ids whose distance <= distance of the k-th true neighbour. */
  function compute(inp) {
    const k = Math.max(1, inp.k);
    const A = inp.approx.slice(0, k);
    if (inp.dist) {
      const dk = Math.max.apply(null, inp.exact.slice(0, k).map(id => inp.dist[id]));
      return A.filter(id => inp.dist[id] <= dk + 1e-12).length / k;
    }
    const T = new Set(inp.exact.slice(0, k));
    return A.filter(id => T.has(id)).length / k;
  }

  /* ---------- shared drawing ---------- */
  function bars(K, rows, foot) {
    const wrap = K.el('div', { style: 'display:grid;gap:3px;margin:6px 0' });
    rows.forEach(([lab, v, col, tip]) => {
      wrap.append(K.el('div', { style: 'display:grid;grid-template-columns:96px 1fr 52px;gap:8px;align-items:center;font-size:12px', title: tip || '' },
        K.el('span', { class: 'num', style: 'color:var(--muted)' }, lab),
        K.el('span', { style: 'background:var(--panel2);border-radius:3px;height:10px;display:block' },
          K.el('span', { style: 'display:block;height:10px;border-radius:3px;background:' + col + ';width:' + Math.max(0, Math.min(1, v)) * 100 + '%' })),
        K.el('span', { class: 'num', style: 'text-align:right' }, K.fmt(v, 3))));
    });
    return K.el('div', {}, wrap, foot || '');
  }
  function chip(K, text, state) { // state: 'hit' | 'miss' | 'extra' | 'plain'
    const col = { hit: 'var(--he)', miss: 'var(--warn)', extra: 'var(--warn)', plain: 'var(--line)' }[state];
    const dash = state === 'miss' ? 'dashed' : 'solid';
    return K.el('span', { class: 'num', style: `display:inline-block;margin:2px 3px 2px 0;padding:1px 6px;border:1.5px ${dash} ${col};border-radius:6px;font-size:12px;color:${state === 'plain' ? 'var(--muted)' : col}` }, text);
  }

  /* ---------- TOY ---------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const N = 28;
    // deterministic layout: id i sits at distance d[i] (increasing with id) from the query at the centre
    const dist = {}; for (let i = 1; i <= N; i++) dist[i] = 1 + 0.55 * i;
    const ang = i => i * 2.399963;                          // golden angle
    const pos = i => [200 + 14 * dist[i] * Math.cos(ang(i)) * 0.62, 200 + 14 * dist[i] * Math.sin(ang(i)) * 0.62];
    const st = { k: 10, approx: defaults.approx.slice(), tie: false, hits5: [10, 10, 10, 10, 0] };
    const shell = K.shell(el, 'Toy example (break it)',
      'Invented points: id 1 is closest to the query (centre), id 28 is farthest. Click a point to put it into, or take it out of, the list the index returns. The ring is the exact top-k.');
    const svg = K.svg('svg', { viewBox: '0 0 400 400', role: 'img', 'aria-label': 'toy points around a query', style: 'width:100%;max-width:420px;height:auto;background:var(--panel2);border-radius:8px;touch-action:manipulation' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const lists = K.el('div', {});
    const kS = K.slider('k', 1, 10, 1, st.k, v => { st.k = v; render(); });
    const foundS = K.slider('true neighbours found', 0, 10, 1, 8, n => setFound(n));
    const tieB = K.el('button', { type: 'button', 'aria-pressed': 'false' }, 'Distance form (ties count)');
    tieB.addEventListener('click', () => { st.tie = !st.tie; tieB.setAttribute('aria-pressed', String(st.tie)); render(); });
    const btn = (t, f) => { const b = K.el('button', { type: 'button' }, t); b.addEventListener('click', f); return b; };
    function setFound(n) { // keep k true ids first n, fill with decoys beyond the exact top-k
      const k = st.k, t = []; for (let i = 1; i <= n && i <= k; i++) t.push(i);
      let d = k + 1; while (t.length < k) t.push(d++); st.approx = t; render();
    }
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (8 of 10)', () => { st.k = 10; kS.set(10); st.approx = defaults.approx.slice(); st.tie = false; tieB.setAttribute('aria-pressed', 'false'); foundS.set(8); render(); }),
      btn('Break it: a tie at the cut', () => { st.k = 10; kS.set(10); st.approx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]; st.tie = true; tieB.setAttribute('aria-pressed', 'true'); render(); }),
      btn('Break it: index finds nothing', () => { st.k = 10; kS.set(10); setFound(0); foundS.set(0); }));
    // mean hides a bad query
    const qRows = K.el('div', {}), qOut = K.el('p', { class: 'hint' });
    const qSliders = st.hits5.map((h, i) => K.slider('query ' + (i + 1) + ' hits', 0, 10, 1, h, v => { st.hits5[i] = v; renderQ(); }));
    function renderQ() {
      const rs = st.hits5.map(h => h / 10), mean = rs.reduce((a, b) => a + b, 0) / rs.length, mn = Math.min.apply(null, rs);
      qOut.textContent = `mean recall@10 = ${K.fmt(mean)}   per-query minimum = ${K.fmt(mn)}`;
      qOut.className = 'hint' + (mn === 0 && mean >= 0.75 ? ' bad' : '');
    }
    qSliders.forEach(s => qRows.append(K.el('div', { class: 'row' }, s.node)));
    svg.addEventListener('click', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 400, py = (e.clientY - r.top) / r.height * 400;
      let b = 1, bd = 1e9; for (let i = 1; i <= N; i++) { const [x, y] = pos(i), d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; b = i; } }
      const j = st.approx.indexOf(b); j >= 0 ? st.approx.splice(j, 1) : st.approx.push(b); render();
    });
    shell.append(presets, K.el('div', { class: 'row' }, kS.node, foundS.node, tieB), svg, res.node, formula, lists, note,
      K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, 'The mean hides bad queries'), qRows, qOut);
    function render() {
      const k = st.k, ex = []; for (let i = 1; i <= k; i++) ex.push(i);
      const dd = Object.assign({}, dist); if (st.tie) dd[11] = dd[10];
      const inp = { exact: ex, approx: st.approx, k, dist: st.tie ? dd : undefined };
      const A = st.approx.slice(0, k), T = new Set(ex), hits = A.filter(i => T.has(i)).length, v = compute(inp);
      const dk = dd[k];
      svg.replaceChildren(
        K.svg('circle', { cx: 200, cy: 200, r: 14 * dk * 0.62, fill: 'none', stroke: 'var(--k12)', 'stroke-dasharray': '4 4' }),
        K.svg('text', { x: 200, y: 204, 'text-anchor': 'middle', fill: 'var(--ai)' }, '+'));
      for (let i = 1; i <= N; i++) {
        const [x, y] = pos(i), inA = A.indexOf(i) >= 0, tr = i <= k, tied = st.tie && i === 11;
        svg.append(K.svg('circle', { cx: x, cy: y, r: inA ? 8 : 5, fill: inA ? (tr || (st.tie && dd[i] <= dk) ? 'var(--he)' : 'var(--warn)') : 'none', stroke: tr ? 'var(--he)' : 'var(--faint)', 'stroke-width': tr ? 2 : 1 }));
        if (i <= 12) svg.append(K.svg('text', { x: x + 9, y: y - 7, 'font-size': 10 }, String(i + (tied ? '=' : ''))));
      }
      res.set(v);
      const hitsD = inp.dist ? A.filter(i => dd[i] <= dk + 1e-12).length : hits;
      formula.textContent = (inp.dist ? `distance form: ${hitsD} returned ids have d <= d(k-th true) = ${K.fmt(dk)}` : `recall@${k} = |A_${k} ∩ T_${k}| / ${k} = ${hits} / ${k}`) + `  =  ${K.fmt(v)}` +
        (inp.dist ? `\n(set form would give ${K.fmt(compute({ exact: ex, approx: st.approx, k }))}: id 11 is as close as the k-th true neighbour, so it is not a real miss)` : '');
      lists.replaceChildren(
        K.el('div', {}, K.el('span', { class: 'hint' }, 'exact top-' + k + ': '), ex.map(i => chip(K, String(i), A.indexOf(i) >= 0 ? 'hit' : 'miss'))),
        K.el('div', {}, K.el('span', { class: 'hint' }, 'index returned: '), A.map(i => chip(K, String(i), T.has(i) ? 'hit' : 'extra'))));
      note.textContent = st.approx.length !== k ? `The index returned ${st.approx.length} ids but k = ${k}; only the first ${k} are counted.` : 'Recall only compares with exact search. It says nothing about whether those neighbours are the right passages for a human.';
      renderQ();
    }
    render();
  }

  /* ---------- REAL ---------- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = SCRIPT_SRC || location.href;
    const get = rel => { const one = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); return one(new URL(rel, base).href).catch(e => { const alt = rel.replace('../../algorithms/', '../../algorithms/'); if (alt === rel) throw e; return one(new URL(alt, base).href); }); }; /* site layout: the algorithms data sits at ../../algorithms/ */
    realP = Promise.all([get('../../algorithms/data/real-ivf_pq.json'), get('../../_real-examples/data/hnsw_experiment.json')])
      .then(a => ({ ivf: a[0], hnsw: a[1] }));
    return realP;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, R = D.ivf;
    const shell = K.shell(el, 'Real example: recall@k of two real approximate indexes',
      'Demo scale, NOT a benchmark: 138 Wikipedia passages (MiniLM, 384-d), the 24 pack questions as queries. Section 1 is our own numpy IVFADC (8 cells, 16-centroid codebooks trained on the same 138 vectors); both result sets are stored per query, so recall is recomputed here from the sets. Section 2 is real hnswlib: the pack stores only the aggregate recall per setting, not the per-query sets, so those bars are stored values, not recomputed.');
    const st = { q: 1, m: 8, w: 2, k: 10 };
    const pid = i => R.ids[i];
    const selQ = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, R.qids.map((id, i) => K.el('option', Object.assign({ value: i }, i === st.q ? { selected: '' } : {}), id + ': ' + R.qtext[i].slice(0, 70))));
    selQ.addEventListener('change', () => { st.q = Number(selQ.value); render(); });
    const selM = K.el('select', { 'aria-label': 'code size m' }, R.ms.map(v => K.el('option', Object.assign({ value: v }, v === st.m ? { selected: '' } : {}), `m = ${v} (${v / 2} ${v === 2 ? 'byte' : 'bytes'} per vector)`)));
    selM.addEventListener('change', () => { st.m = Number(selM.value); render(); });
    const sW = K.slider('w (cells visited)', 1, R.kc, 1, st.w, v => { st.w = v; render(); });
    const sK = K.slider('k', 1, 10, 1, st.k, v => { st.k = v; render(); });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), lists = K.el('div', { 'aria-live': 'polite' });
    const agg = K.el('div', {}), hn = K.el('div', {});
    shell.append(K.el('h4', { style: 'margin:6px 0;font-weight:600' }, '1. IVF + PQ, one query at a time'),
      K.el('div', { class: 'row' }, K.el('label', { style: 'flex:1 1 100%;min-width:0' }, 'question ', selQ)), K.el('div', { class: 'row' }, K.el('label', {}, 'code ', selM), sW.node, sK.node),
      lists, res.node, formula, agg, hn);

    const topOf = (qi, m, w) => R.runs[m].per_q[qi][w].top;
    const rec = (qi, m, w, k) => compute({ exact: R.exact[qi], approx: topOf(qi, m, w), k });
    function render() {
      const { q, m, w, k } = st, ex = R.exact[q].slice(0, k), ap = topOf(q, m, w).slice(0, k), T = new Set(ex), A = new Set(ap);
      const r = rec(q, m, w, k), hits = ap.filter(i => T.has(i)).length;
      const nm = i => pid(i) + ' ' + R.articles[i];
      lists.replaceChildren(
        K.el('p', { class: 'hint' }, `${R.qids[q]}: ${R.qtext[q]}${(R.gold[q] || []).length ? '  (gold passage(s): ' + R.gold[q].join(', ') + ')' : ''}`),
        K.el('div', {}, K.el('span', { class: 'hint' }, `exact top-${k} (brute force): `), ex.map(i => chip(K, pid(i), A.has(i) ? 'hit' : 'miss'))),
        K.el('div', {}, K.el('span', { class: 'hint' }, `IVFADC top-${k} (w=${w}, m=${m}): `), ap.map(i => chip(K, pid(i), T.has(i) ? 'hit' : 'extra'))),
        K.el('p', { class: 'hint' }, 'teal = in both; dashed orange = a true neighbour the index missed; solid orange = returned but not a true neighbour.'));
      res.set(r);
      const miss = ex.filter(i => !A.has(i)), extra = ap.filter(i => !T.has(i));
      formula.textContent = `recall@${k} = |A_${k} ∩ T_${k}| / ${k} = ${hits} / ${k} = ${K.fmt(r)}\n` +
        (miss.length ? 'missed: ' + miss.map(nm).join('; ') + '\n' : 'missed: none\n') + (extra.length ? 'returned instead: ' + extra.map(nm).join('; ') + '\n' : '') +
        `scanned ${R.runs[m].per_q[q][w].scanned} of ${R.n} vectors`;
      // all queries
      const per = R.qids.map((_, i) => rec(i, m, w, k)), mean = per.reduce((a, b) => a + b, 0) / per.length, mn = Math.min.apply(null, per), arg = per.indexOf(mn);
      const stored = k === 10 ? R.runs[m].agg[w].recall10 : k === 1 ? R.runs[m].agg[w].recall1 : undefined;
      const rows = per.map((v, i) => [R.qids[i], v, i === st.q ? 'var(--ai)' : v === mn ? 'var(--warn)' : 'var(--he)', `${R.qids[i]}: ${K.fmt(v)}`]);
      agg.replaceChildren(K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, `All 24 questions, recall@${k} per query`), bars(K, rows,
        K.el('p', { class: 'hint' }, `mean ${K.fmt(mean, 4)}` + (stored !== undefined ? ` (pack's stored ${stored}: ${Math.abs(mean - stored) < 5e-5 ? 'MATCH' : 'MISMATCH'})` : ` (recomputed from the stored top-10 prefixes; the pack stores aggregates only for k = 1 and 10)`) +
          `; worst query ${R.qids[arg]} = ${K.fmt(mn)}. The mean hides the bad queries: look at the minimum.`)));
      // hnsw
      const H = D.hnsw, sets = [['small', H.small, 'the 138 passages'], ['large', H.large, '20,000 Simple English Wikipedia passages']];
      const sel = hnswSel;
      const run = H[sel.set].runs.find(r => r.build.M === sel.M && r.n_queries === sel.nq);
      const pts = run ? run.points.filter(p => p.k === sel.k) : [];
      hn.replaceChildren(K.el('h4', { style: 'margin:18px 0 4px;font-weight:600' }, '2. HNSW (real hnswlib), recall against efSearch (stored aggregates)'),
        K.el('div', { class: 'row' }, hnswCtl()),
        bars(K, pts.map(p => ['ef ' + p.ef_search, p.recall, 'var(--k12)', `recall@${p.k} ${p.recall}, ${p.ms_per_query} ms/query (noisy)`]),
          K.el('p', { class: 'hint' }, run ? `${sel.set === 'small' ? '138-passage index' : '20,000-passage index'}, ${run.build.name} build (M=${run.build.M}, efConstruction=${run.build.ef_construction}), ${run.n_queries} queries (${run.queries}), k=${sel.k}. Stored values from the pack; per-query result sets are not stored, so not recomputed. ` +
            (sel.set === 'small' ? 'The corpus is tiny, so the curve is nearly flat: exact search is instant here.' : (run.queries.startsWith('24') ? 'The 24 ML questions are out-of-distribution for a Simple English index: recall is much lower, a real effect.' : 'Held-out passages from the same distribution.')) +
            ' Latencies (in the tooltips) were taken under heavy swap: indicative only.' : 'no such run')));
    }
    const hnswSel = { set: 'large', M: 16, nq: 500, k: 10 };
    function hnswCtl() {
      const mk = (lab, opts, get, set) => { const s = K.el('select', { 'aria-label': lab }, opts.map(([v, t]) => K.el('option', Object.assign({ value: v }, String(v) === String(get()) ? { selected: '' } : {}), t))); s.addEventListener('change', () => { set(s.value); fixNq(); render(); }); return K.el('label', {}, lab + ' ', s); };
      return [mk('index', [['small', '138 passages'], ['large', '20,000 passages']], () => hnswSel.set, v => { hnswSel.set = v; }),
        mk('build', [[16, 'standard M=16'], [4, 'weak M=4']], () => hnswSel.M, v => { hnswSel.M = Number(v); }),
        mk('queries', [['held', 'passages (held-out / each passage)'], ['q', '24 questions']], () => hnswSel.qk, v => { hnswSel.qk = v; }),
        mk('k', [[10, 'k = 10'], [1, 'k = 1']], () => hnswSel.k, v => { hnswSel.k = Number(v); })];
    }
    hnswSel.qk = 'held';
    function fixNq() { hnswSel.nq = hnswSel.qk === 'q' ? 24 : (hnswSel.set === 'large' ? 500 : 138); }
    fixNq();
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_recall_at_k'] = api;
})(this);
