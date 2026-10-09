/* Latency per stage: toy stacked bar with stage toggles; real example = retrieval stages timed locally over the real corpus (data/stage_latency.real.json, built by stage_latency.build.py) + the 36 answer-call latencies of the answer study. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { embed_search: 45, rerank: 120, graph: 80, generation: 1800, on: { embed_search: true, rerank: true, graph: true, generation: true } };
  const STAGES = [['embed_search', 'embed + vector search', '#7C9CFF'], ['rerank', 'rerank', '#C28BFF'], ['graph', 'graph expansion', '#3CC7B4'], ['generation', 'generation', '#F2A93B']];

  /* PURE: T_e2e = sum of the stages that are switched on; share = T_gen / T_e2e */
  function compute(inp) {
    const on = inp.on || {};
    let e2e = 0;
    for (const [k] of STAGES) if (on[k] !== false) e2e += inp[k];
    const gen = on.generation !== false ? inp.generation : 0;
    return { e2e_ms: e2e, generation_share: e2e > 0 ? Math.round(1e4 * gen / e2e) / 1e4 : 0 };
  }

  function pct(sorted, p) { /* nearest rank */ const i = Math.max(0, Math.ceil(p * sorted.length) - 1); return sorted[i]; }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it)', 'Illustrative numbers, not measured. Switch a stage off or drag a duration: the bar and the generation share move.');
    const res = K.resultBox(); const share = K.el('div', { class: 'num hint' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const W = 600, svg = K.svg('svg', { viewBox: `0 0 ${W} 60`, width: '100%', role: 'img', 'aria-label': 'stacked stage bar' });
    const rects = STAGES.map(([k, , c]) => { const r = K.svg('rect', { y: 8, height: 30, fill: c }); svg.append(r); return r; });
    const txt = K.svg('text', { y: 54 }); svg.append(txt);
    const S = {}, T = {};
    const rows = STAGES.map(([k, name]) => {
      const cb = K.el('input', { type: 'checkbox', checked: 'checked', 'aria-label': name + ' on' });
      cb.addEventListener('change', () => { st.on[k] = cb.checked; render(); });
      S[k] = K.slider(name + ' (ms)', 0, k === 'generation' ? 6000 : 600, k === 'generation' ? 50 : 5, st[k], v => { st[k] = v; render(); });
      T[k] = cb;
      return K.el('div', { class: 'row' }, cb, S[k].node);
    });
    const set = o => { Object.assign(st, o); for (const [k] of STAGES) { S[k].set(st[k]); T[k].checked = st.on[k] !== false; } render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(JSON.parse(JSON.stringify(defaults)))),
      btn('Turn off the graph step', () => set({ on: { embed_search: true, rerank: true, graph: false, generation: true } })),
      btn('Break it: generation dominates (5.2 s)', () => set({ generation: 5200 })));
    shell.append(presets, ...rows, K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' ms end to end'), share), svg, formula, note);
    function render() {
      const r = compute(st); res.set(r.e2e_ms, 0);
      share.textContent = 'generation share ' + K.fmt(100 * r.generation_share, 1) + '%';
      let x = 0;
      STAGES.forEach(([k], i) => { const w = st.on[k] !== false && r.e2e_ms > 0 ? W * st[k] / r.e2e_ms : 0; rects[i].setAttribute('x', x); rects[i].setAttribute('width', w); x += w; });
      txt.setAttribute('x', 0); txt.textContent = STAGES.filter(([k]) => st.on[k] !== false).map(([k, n]) => n + ' ' + st[k]).join(' + ') + ' ms';
      formula.textContent = 'T_e2e = ' + (STAGES.filter(([k]) => st.on[k] !== false).map(([k]) => st[k]).join(' + ') || '0') + ' = ' + r.e2e_ms + ' ms\nshare_gen = ' + (st.on.generation !== false ? st.generation : 0) + ' / ' + r.e2e_ms + ' = ' + K.fmt(r.generation_share, 4);
      note.textContent = 'One query shows a sum. Percentiles of each stage over many queries do not add: p95 of the total is not the sum of the stage p95s. With streaming the student feels time to first token, not T_e2e.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const tr = new URL('../../algorithms/demos/data/monitoring_tracing.real.json', SCRIPT_SRC || location.href).href;
    const get = (u, alt) => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }).catch(e => { if (!alt) throw e; return fetch(alt).then(r => { if (!r.ok) throw new Error(alt + ' ' + r.status); return r.json(); }); });
    const trAlt = new URL('../../algorithms/demos/data/monitoring_tracing.real.json', SCRIPT_SRC || location.href).href; /* site layout */
    const stU = new URL('data/stage_latency.real.json', SCRIPT_SRC || location.href).href;
    realData = Promise.all([get(base + 'answers/per_question.json'), get(base + 'metrics/stage_latency.json'), get(tr, trAlt), get(stU)]).then(a => ({ pq: a[0], m: a[1], tr: a[2], st: a[3] }));
    return realData;
  }

  /* stages timed locally per arm (arm A: no retrieval; B: hybrid = embed + dense + BM25 + RRF; C: dense + graph expansion) */
  const ARM_STAGES = { A: [], B: ['query_embed', 'dense_search', 'bm25', 'rrf'], C: ['query_embed', 'dense_search', 'graph'] };
  const STAGE_NAME = { query_embed: 'query embedding', dense_search: 'dense search', bm25: 'BM25', rrf: 'RRF fusion', graph: 'graph expansion (BFS, 2 hops)', rerank: 'cross-encoder rerank (top-20)', ppr: 'personalized PageRank' };
  const STAGE_COL = { query_embed: '#7C9CFF', dense_search: '#5A7BE0', bm25: '#3CC7B4', rrf: '#8BD4A8', graph: '#E07BB0', rerank: '#C28BFF', ppr: '#FF8A65' };
  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', rerank: false, t: 0 };
    const shell = K.shell(el, 'Real example: stages timed on this Mac + 36 timed answer calls',
      'Demo scale, one run, indicative only. Generation: wall-clock of one non-streaming call to an endpoint in China (n = 12 questions per arm, from the answer study). Retrieval stages: re-run on this Mac on 2026-10-09 over the real 138-passage corpus with time.perf_counter (median of 7 repeats after 2 warm-ups, per question): query embedding (all-MiniLM-L6-v2, CPU), dense search (numpy cosine), BM25 (the pack\'s own pure-Python code), RRF, cross-encoder rerank, graph expansion (BFS to hop 2 from the stored linked entities; entity linking not timed). The generation calls were made on 2026-10-08 over the network, the retrieval stages on 2026-10-09 locally, so the end-to-end figure adds numbers from two separate runs.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm; aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const rr = K.el('input', { type: 'checkbox', 'aria-label': 'add the reranker' }); rr.addEventListener('change', () => { st.rerank = rr.checked; render(); });
    const tbl = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const stat = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const res = K.resultBox(); const share = K.el('div', { class: 'num hint' });
    const W = 600, svgD = K.svg('svg', { viewBox: `0 0 ${W} 80`, width: '100%', role: 'img', 'aria-label': 'latency of the 12 generation calls' });
    const svgB = K.svg('svg', { viewBox: `0 0 ${W} 70`, width: '100%', role: 'img', 'aria-label': 'stage bar, mean per question' });
    const tSel = K.el('select', { 'aria-label': 'trace', style: 'max-width:100%;width:100%' }, D.tr.traces.map((t, i) => opt(i, t.qid + ' arm ' + t.arm)));
    tSel.addEventListener('change', () => { st.t = +tSel.value; render(); });
    const traceBox = K.svg('svg', { viewBox: `0 0 ${W} 70`, width: '100%', role: 'img', 'aria-label': 'spans of one traced question' });
    const traceTxt = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, rr, ' add the reranker (not used by the answer arms)')),
      K.el('h4', { style: 'margin:12px 0 4px' }, 'Measured per stage (24 questions)'), tbl,
      K.el('h4', { style: 'margin:12px 0 4px' }, 'End to end per question = measured stages + measured generation (the 12 answered questions)'),
      K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' ms mean end to end'), share), svgB, stat, svgD,
      K.el('h4', { style: 'margin:12px 0 4px' }, 'Real spans of one traced question (answer call, then evaluation judge calls)'),
      K.el('div', { class: 'row' }, K.el('label', {}, 'trace ', tSel)), traceBox, traceTxt, note);

    const S = D.st.rows, colors = { ans: '#F2A93B', ext: '#7C9CFF', verA: '#3CC7B4', verB: '#C28BFF', cor: '#FF8A65' };
    const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
    function render() {
      const stages = ARM_STAGES[st.arm].concat(st.rerank ? ['rerank'] : []);
      const lines = Object.keys(STAGE_NAME).map(k => { const v = S.map(r => r[k]).filter(x => x !== null && x !== undefined).sort((a, b) => a - b); return `${STAGE_NAME[k].padEnd(32)} median ${K.fmt(pct2(v, .5), 2).padStart(7)} ms   p95 ${K.fmt(pct(v, .95), 2).padStart(7)} ms   max ${K.fmt(v[v.length - 1], 2).padStart(7)} ms   n=${v.length}`; });
      tbl.textContent = lines.join('\n') + `\n(graph and PPR: n = ${S.filter(r => r.graph !== null).length}, the question with no linked entity has no graph stage; 7 repeats, median per question; load average at start ${D.st.machine.load_avg.map(x => K.fmt(x, 1)).join(' ')})`;
      const gp = D.pq.filter(r => r.arm === st.arm);
      const per = gp.map(r => { const row = S.find(x => x.qid === r.qid); const ms = stages.reduce((a, k) => a + (row && row[k] != null ? row[k] : 0), 0); return { qid: r.qid, ret: ms, gen: r.latency_s * 1000, e2e: ms + r.latency_s * 1000 }; });
      const e2e = per.map(x => x.e2e).sort((a, b) => a - b), mean = meanOf(per.map(x => x.e2e)), ret = meanOf(per.map(x => x.ret)), gen = meanOf(per.map(x => x.gen));
      res.set(mean, 0); share.textContent = 'generation share ' + K.fmt(100 * gen / mean, 2) + '% (mean generation / mean end to end)';
      svgB.replaceChildren(); let x = 0;
      const segs = stages.map(k => [STAGE_NAME[k], meanOf(per.map((_, i) => { const row = S.find(r => r.qid === gp[i].qid); return row && row[k] != null ? row[k] : 0; })), STAGE_COL[k]]).concat([['generation (measured)', gen, '#F2A93B']]);
      segs.forEach(([n, v, c]) => { const w = Math.max(W * v / mean, v > 0 ? 1.5 : 0); svgB.append(K.svg('rect', { x, y: 8, width: w, height: 30, fill: c }, K.svg('title', {}, n + ' ' + K.fmt(v, 2) + ' ms'))); x += w; });
      svgB.append(K.svg('text', { x: 0, y: 56 }, `retrieval stages ${K.fmt(ret, 2)} ms + generation ${K.fmt(gen, 0)} ms`));
      stat.textContent = `arm ${st.arm}, n = ${per.length}: end to end mean ${K.fmt(mean, 0)} ms  median ${K.fmt((e2e[5] + e2e[6]) / 2, 0)} ms  p95 ${K.fmt(pct(e2e, .95), 0)} ms (nearest rank, n = 12: the max)\n` +
        `of which the timed retrieval stages: ${K.fmt(ret, 2)} ms = ${K.fmt(100 * ret / mean, 3)}% . Pack check: generation mean ${D.m.per_arm[st.arm].latency_s_mean} s.`;
      svgD.replaceChildren();
      const lo = 2, hi = 6.5, X = s => 20 + (W - 40) * (s - lo) / (hi - lo), rows = gp.map(r => r.latency_s);
      svgD.append(K.svg('line', { x1: 20, x2: W - 20, y1: 40, y2: 40, stroke: '#242B38' }));
      for (let s = 2; s <= 6; s++) { svgD.append(K.svg('line', { x1: X(s), x2: X(s), y1: 36, y2: 44, stroke: '#68707F' }), K.svg('text', { x: X(s), y: 62, 'text-anchor': 'middle' }, s + ' s')); }
      rows.forEach((s, i) => svgD.append(K.svg('circle', { cx: X(s), cy: 40 - (i % 3) * 8, r: 5, fill: '#F2A93B', 'fill-opacity': .8 }, K.svg('title', {}, gp[i].qid + ' ' + s + ' s'))));
      const t = D.tr.traces[st.t], sum = t.spans.reduce((s, p) => s + p.ms, 0);
      traceBox.replaceChildren(); let xx = 0;
      t.spans.forEach(p => { const w = W * p.ms / sum; traceBox.append(K.svg('rect', { x: xx, y: 8, width: Math.max(w - 1, 1), height: 30, fill: colors[p.kind] || '#98A0B0', 'fill-opacity': p.kind === 'ans' ? 1 : .55 }, K.svg('title', {}, p.name + ' ' + p.ms + ' ms'))); xx += w; });
      traceBox.append(K.svg('text', { x: 0, y: 58 }, 'amber = answer call; other colours = judge calls'));
      traceTxt.textContent = 'Amber is the answer call (what a student waits for); the other colours are evaluation judge calls, not serving.\n' + t.spans.map(p => `${p.name.padEnd(20)} ${p.model.padEnd(20)} ${String(p.ms).padStart(5)} ms  in ${p.n_in} out ${p.n_out}`).join('\n') + `\nsequential sum ${sum} ms; the answer call is ${K.fmt(100 * t.spans[0].ms / sum, 0)}% of this sum`;
      note.textContent = 'What this shows: on a 138-passage corpus, every retrieval stage but the cross-encoder takes under 4 ms, and the cross-encoder (about 100 to 160 ms) is still about 30 times smaller than one generation call (2.1 to 5.9 s). It is the generation call that sets what a student waits for. What it cannot show: a large index (the HNSW and ANN-latency units cover that), embedding through a remote API, time to first token (calls were not streamed), network time of retrieval, p95 over many users. One run, no repeats of the generation calls; graph stage excludes entity linking and the real arm C pipeline may differ.';
    }
    function pct2(sorted, p) { const n = sorted.length; return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; }
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['stage_latency'] = api;
})(this);
