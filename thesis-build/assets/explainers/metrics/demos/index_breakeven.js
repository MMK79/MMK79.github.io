/* Indexing cost and break-even queries: C(Q) = C_idx + Q c_q, Q* = (C_idx^G - C_idx^V) / (c_q^V - c_q^G). Real example: the pack's 138 extraction calls vs the real per-answer cost of arms B and C. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { idx_g: 30, idx_v: 0.5, q_v: 0.5, q_g: 0.02 };

  /* PURE: Q* = ceil((idx_g - idx_v) / (q_v - q_g)) when the graph is cheaper per query; Infinity (never) when it is not. */
  function compute(inp) {
    const dI = inp.idx_g - inp.idx_v, dq = inp.q_v - inp.q_g;
    if (dq > 0) return Math.max(0, Math.ceil(dI / dq - 1e-9));
    return (dI <= 0 && dq >= 0) ? 0 : Infinity;
  }
  const fmtQ = q => Number.isFinite(q) ? String(q) : 'never';

  function chart(K, W, H) {
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'cumulative cost versus number of answered queries, vector baseline and graph system' });
    return svg;
  }
  function drawChart(K, svg, W, H, p) {   // p: {Qmax, idx_v, q_v, idx_g, q_g, unit}
    const L = 56, Rr = 12, T = 12, B = 34, w = W - L - Rr, h = H - T - B;
    const ymax = Math.max(p.idx_v + p.q_v * p.Qmax, p.idx_g + p.q_g * p.Qmax) * 1.05 || 1;
    const X = q => L + w * q / p.Qmax, Y = c => T + h * (1 - c / ymax);
    const kids = [];
    kids.push(K.svg('line', { x1: L, y1: T + h, x2: L + w, y2: T + h, stroke: '#68707F' }), K.svg('line', { x1: L, y1: T, x2: L, y2: T + h, stroke: '#68707F' }));
    [0, 0.5, 1].forEach(f => { const c = ymax * f / 1.05; kids.push(K.svg('text', { x: L - 6, y: Y(c) + 4, 'text-anchor': 'end', style: 'font-size:11px' }, K.fmt(c, c < 1 ? 3 : 2))); });
    [0, 0.5, 1].forEach(f => kids.push(K.svg('text', { x: X(p.Qmax * f), y: H - 14, 'text-anchor': f === 1 ? 'end' : f ? 'middle' : 'start', style: 'font-size:11px' }, String(Math.round(p.Qmax * f)))));
    kids.push(K.svg('text', { x: L + w / 2, y: H - 1, 'text-anchor': 'middle', style: 'font-size:11px' }, 'queries answered Q      cumulative cost, ' + p.unit));
    kids.push(K.svg('line', { x1: X(0), y1: Y(p.idx_v), x2: X(p.Qmax), y2: Y(p.idx_v + p.q_v * p.Qmax), stroke: '#7C9CFF', 'stroke-width': 2.5 }));
    kids.push(K.svg('line', { x1: X(0), y1: Y(p.idx_g), x2: X(p.Qmax), y2: Y(p.idx_g + p.q_g * p.Qmax), stroke: '#F2A93B', 'stroke-width': 2.5 }));
    kids.push(K.svg('text', { x: X(p.Qmax) - 4, y: Y(p.idx_v + p.q_v * p.Qmax) + (p.q_v < p.q_g ? 16 : -6), 'text-anchor': 'end', fill: '#7C9CFF', style: 'fill:#7C9CFF;font-size:12px' }, 'vector / hybrid'));
    kids.push(K.svg('text', { x: X(p.Qmax) - 4, y: Y(p.idx_g + p.q_g * p.Qmax) + (p.q_v < p.q_g ? -6 : 16), 'text-anchor': 'end', style: 'fill:#F2A93B;font-size:12px' }, 'graph'));
    const qs = compute({ idx_g: p.idx_g, idx_v: p.idx_v, q_v: p.q_v, q_g: p.q_g });
    if (Number.isFinite(qs) && qs > 0 && qs <= p.Qmax) {
      kids.push(K.svg('circle', { cx: X(qs), cy: Y(p.idx_v + p.q_v * qs), r: 5, fill: '#3CC7B4' }), K.svg('text', { x: X(qs) + 8, y: Y(p.idx_v + p.q_v * qs) + 16, style: 'fill:#3CC7B4;font-size:12px' }, 'Q* = ' + qs));
    }
    svg.replaceChildren(...kids);
  }

  function mountToy(el) {
    const K = root.DemoKit; const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Illustrative numbers from the catalogue (global questions, after Edge et al. 2024): the graph costs more to build and less per query. Move the sliders, then try the presets.');
    const res = K.resultBox(); const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const W = 600, H = 250, svg = chart(K, W, H); const S = {};
    const mk = (k, lab, min, max, step) => { S[k] = K.slider(lab, min, max, step, st[k], v => { st[k] = v; render(); }); return K.el('div', { class: 'row' }, S[k].node); };
    const set = o => { Object.assign(st, o); for (const k in o) S[k].set(o[k]); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults)), btn('Break it: local questions, graph not cheaper', () => set({ q_g: 0.6 }))),
      mk('idx_g', 'graph index cost (USD)', 0, 100, 0.5), mk('idx_v', 'vector index cost (USD)', 0, 10, 0.1), mk('q_v', 'vector per query (USD)', 0, 1, 0.01), mk('q_g', 'graph per query (USD)', 0, 1, 0.01),
      K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' queries to break even (Q*)')), svg, formula);
    function render() {
      const q = compute(st);
      drawChart(K, svg, W, H, { Qmax: Math.max(10, Math.min(500, Number.isFinite(q) ? Math.ceil(q * 1.6) : 100)), idx_v: st.idx_v, q_v: st.q_v, idx_g: st.idx_g, q_g: st.q_g, unit: 'USD' });
      const dI = st.idx_g - st.idx_v, dq = st.q_v - st.q_g;
      formula.textContent = `Q* = (${K.fmt(st.idx_g, 4)} - ${K.fmt(st.idx_v, 4)}) / (${K.fmt(st.q_v, 4)} - ${K.fmt(st.q_g, 4)}) = ${K.fmt(dI, 4)} / ${K.fmt(dq, 4)} = ${dq > 0 ? K.fmt(dI / dq, 2) : 'undefined'}  ->  ` + (Number.isFinite(q) ? q + ' queries' : 'never: the graph is not cheaper per query, so the gap only grows') + '\nPrices change: valid only for the stated model and prices.';
      res.node.textContent = fmtQ(q); K.flash(res.node);
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/index_breakeven.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); }); return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const ex = D.extraction, T = ex.totals, A = D.per_arm, og = D.other_graph_stages, P = D.prices;
    const cqV = A.B.usd_per_answer_mean, cqG = A.C.usd_per_answer_mean;
    const st = { extra: false, mult: 1, Q: 1000 };
    const shell = K.shell(el, 'Real example: what the graph build cost, and what each answer costs',
      'Real run, demo scale: 138 extraction calls (' + P.extract_model + ') and 12 questions answered once per arm (' + P.answer_model + '). Per-answer cost is the answer model only (judges, embeddings and retrieval excluded). Arm C gets about 40% more context than B and starts from a different first-stage list, so C versus B is "vector + graph" versus "hybrid", not a clean graph test. n = 12: indicative only. Vector and hybrid indexes run locally (MiniLM on CPU, BM25): USD 0.00, CPU time not costed.');
    const res = K.resultBox(); const nums = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const need = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const note = K.el('p', { class: 'hint' });
    const W = 600, H = 250, svg = chart(K, W, H);
    const cb = K.el('input', { type: 'checkbox', id: 'ib-extra' }); cb.addEventListener('change', () => { st.extra = cb.checked; render(); });
    const sM = K.slider('what if the graph arm cost x', 0.2, 1.5, 0.01, st.mult, v => { st.mult = v; render(); });
    const sQ = K.slider('queries to look at (Q)', 100, 5000, 100, st.Q, v => { st.Q = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const callTbl = K.el('div', { class: 'formula' });
    const sorted = ex.calls.slice().sort((a, b) => a.usd - b.usd);
    const med = sorted[Math.floor(sorted.length / 2)];
    callTbl.textContent = `Extraction: ${ex.calls.length} calls, one per passage\n  tokens in ${T.t_in.toLocaleString('en-US')}   tokens out ${T.t_out.toLocaleString('en-US')}   USD ${K.fmt(T.usd, 6)} (ledger ${ex.ledger_usd})\n  per call: cheapest ${K.fmt(sorted[0].usd, 6)}, median ${K.fmt(med.usd, 6)}, dearest ${K.fmt(sorted[sorted.length - 1].usd, 6)} USD\n  wall time ${K.fmt(T.latency_s / 60, 1)} min if run one after another (sum of the call latencies)\n  price ${P.extract_in} in / ${P.extract_out} out USD per M tokens. Output tokens are ${K.fmt(T.t_out / T.t_in, 2)}x the input tokens, so output is ${K.fmt(100 * T.t_out * P.extract_out / (T.t_in * P.extract_in + T.t_out * P.extract_out), 0)}% of the bill.`;
    shell.append(callTbl,
      K.el('div', { class: 'row' }, K.el('label', {}, cb, ' also count community reports + global search (' + K.fmt(og.community_reports.usd + og.global_search.usd, 4) + ' USD; arm C does not use them)')),
      K.el('div', { class: 'row' }, sM.node), K.el('div', { class: 'row' }, sQ.node),
      K.el('div', { class: 'row' }, btn('Measured costs', () => { st.mult = 1; sM.set(1); render(); }), btn('Graph arm 29% cheaper', () => { st.mult = 0.71; sM.set(0.71); render(); })),
      K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' queries to break even (Q*)')), svg, nums, need, note);
    function render() {
      const idxG = T.usd + (st.extra ? og.community_reports.usd + og.global_search.usd : 0), idxV = D.vector_index.usd, qG = cqG * st.mult;
      const q = compute({ idx_g: idxG, idx_v: idxV, q_v: cqV, q_g: qG });
      res.node.textContent = fmtQ(q); K.flash(res.node);
      drawChart(K, svg, W, H, { Qmax: st.Q, idx_v: idxV, q_v: cqV, idx_g: idxG, q_g: qG, unit: 'USD' });
      const dI = idxG - idxV, dq = cqV - qG;
      nums.textContent = `C_idx graph = ${K.fmt(idxG, 6)} USD, vector = ${K.fmt(idxV, 4)} USD\nc_q hybrid (arm B) = ${K.fmt(cqV, 7)}, graph arm (C) = ${K.fmt(qG, 7)} USD per answer\nQ* = (${K.fmt(idxG, 6)} - ${K.fmt(idxV, 4)}) / (${K.fmt(cqV, 7)} - ${K.fmt(qG, 7)}) = ` + (dq > 0 ? `${K.fmt(dI, 6)} / ${K.fmt(dq, 7)} = ${K.fmt(dI / dq, 1)} -> ${q} queries` : `${K.fmt(dI, 6)} / ${K.fmt(dq, 7)}: the denominator is not positive -> never`);
      const target = cqV - dI / st.Q, tokIn = (target * 1e6 - A.C.completion_tokens_mean * P.answer_out) / P.answer_in;
      need.textContent = `To break even within ${st.Q} queries the graph arm must cost at most c_q^V - dI/Q = ${K.fmt(cqV, 7)} - ${K.fmt(dI / st.Q, 7)} = ${K.fmt(target, 7)} USD per answer\n  measured arm C: ${K.fmt(cqG, 7)} -> it must be ${K.fmt(100 * (1 - target / cqG), 0)}% cheaper than it is (about ${Math.round(tokIn)} prompt tokens instead of ${Math.round(A.C.prompt_tokens_mean)}, same ${Math.round(A.C.completion_tokens_mean)} output tokens; arm B itself uses ${Math.round(A.B.prompt_tokens_mean)})`;
      const pq = {}; D.per_question.forEach(r => { (pq[r.qid] = pq[r.qid] || {})[r.arm] = r.usd; });
      const more = Object.values(pq).filter(x => x.C > x.B).length;
      note.textContent = (dq <= 0 ? `No break-even: arm C costs MORE per answer than B on ${more} of ${Object.keys(pq).length} questions (${K.fmt(100 * (cqG / cqV - 1), 0)}% more on average), so every query widens the gap. ` : `Only under the what-if cost does a break-even exist. `) + 'Cost is not value: the graph may buy accuracy (see accuracy per dollar), and a different workload (global, sense-making questions answered by map-reduce over the full text) is where published numbers claim graphs pay off. This corpus has no such comparison.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }); const body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy); real();
  }
  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['index_breakeven'] = api;
})(this);
