/* Monitoring and tracing: what to log per stage to find slow, costly and failing requests.
   Toy example (invented numbers, labelled): one trace of 4 spans + ten requests. compute() is pure.
   Real example (default): the LLM calls of the answer study (slice 4): per call latency, tokens, USD; each request = the answer call + its judge calls as spans. Retrieval/embed/rerank latency was never timed (pending). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    spans: [
      { name: 'embed_query', ms: 40 }, { name: 'vector_search', ms: 85 },
      { name: 'rerank', ms: 210 }, { name: 'generate', ms: 1450 },
    ],
    tokens: { n_in: 3200, n_cr: 2000, n_out: 280 },
    prices: { P_in: 3.00, P_cr: 0.30, P_out: 15.00 },   // USD per million tokens (Anthropic pricing table, 2026-10-08)
    lat: [1650, 1720, 1580, 1790, 1610, 1700, 5200, 1660, 1740, 1690],
    top1: [0.71, 0.66, 0.58, 0.62, 0.69, 0.31, 0.64, 0.72, 0.28, 0.67],
    thresh: 0.5, slowFactor: 2,
  };
  const r6 = x => Math.round(x * 1e6) / 1e6;
  const nearest = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.max(0, Math.ceil(p * s.length - 1e-9) - 1)]; };

  /* PURE. T = sum t_s; C = ((n_in-n_cr)P_in + n_cr P_cr + n_out P_out)/1e6; p = nearest-rank percentile. */
  function compute(inp) {
    const total = inp.spans.reduce((a, s) => a + s.ms, 0);
    const top = inp.spans.reduce((a, s) => (s.ms > a.ms ? s : a), inp.spans[0]);
    const t = inp.tokens, p = inp.prices;
    const cost = ((t.n_in - t.n_cr) * p.P_in + t.n_cr * p.P_cr + t.n_out * p.P_out) / 1e6;
    const cost0 = (t.n_in * p.P_in + t.n_out * p.P_out) / 1e6;
    const p50 = nearest(inp.lat, 0.5), p95 = nearest(inp.lat, 0.95);
    const slow = inp.lat.map((l, i) => (l > inp.slowFactor * p50 ? i : -1)).filter(i => i >= 0);
    const low = inp.top1.map((s, i) => (s < inp.thresh ? i : -1)).filter(i => i >= 0);
    return {
      trace_total_ms: total, generate_share_pct: Math.round(1000 * top.ms / total) / 10,
      cost_usd: r6(cost), cost_without_cache_read_usd: r6(cost0),
      p50_ms: p50, p95_ms: p95, low_retrieval_requests: low.length, slow_requests: slow.length,
      _bottleneck: top.name, _slow_idx: slow, _low_idx: low, _mean_ms: inp.lat.reduce((a, b) => a + b, 0) / inp.lat.length,
    };
  }

  /* PURE. Real trace of one (question, arm): spans = real LLM calls (ms, tokens measured). Cost per span from the model's price row; cached tokens (reported by the judge models, 0 on answer calls) priced at an ASSUMED 0.1 x the input price.
     Distribution: the answer-call latency of the 12 requests of the arm (nearest-rank p50/p95); low retrieval = dense top-1 cosine < thresh (arms B, C only). */
  function realTraceCompute(data, o) {
    const tr = data.traces.find(t => t.qid === o.qid && t.arm === o.arm), P = data.prices_usd_per_mtok;
    const spans = tr.spans.map(s => { const p = P[s.model]; return { ...s, usd: ((s.n_in - s.n_cr) * p.input + s.n_cr * p.input * 0.1 + s.n_out * p.output) / 1e6 }; });
    const total = spans.reduce((a, s) => a + s.ms, 0), top = spans.reduce((a, s) => (s.ms > a.ms ? s : a), spans[0]);
    const cost = spans.reduce((a, s) => a + s.usd, 0), arm = data.traces.filter(t => t.arm === o.arm);
    const lat = arm.map(t => t.spans[0].ms), p50 = nearest(lat, 0.5), p95 = nearest(lat, 0.95);
    const slow = arm.map((t, i) => (lat[i] > o.slowFactor * p50 ? i : -1)).filter(i => i >= 0);
    const low = arm.map((t, i) => (t.dense_top1 !== null && t.dense_top1 < o.thresh ? i : -1)).filter(i => i >= 0);
    return { spans, trace_total_ms: total, bottleneck: top.name, bottleneck_share_pct: Math.round(1000 * top.ms / total) / 10, cost_usd: r6(cost), p50_ms: p50, p95_ms: p95, mean_ms: lat.reduce((a, b) => a + b, 0) / lat.length, slow, low, arm, lat };
  }
  /* PURE. Serving path of one request: LOCALLY MEASURED retrieval stages (algos_real_local.json, time.perf_counter, median of 7) + the real answer-call latency. Stages per arm: A none; B embed, BM25, dense, RRF (+ rerank if switched on); C embed, dense, graph expand. */
  function servingPath(local, qid, arm, answerMs, withRerank) {
    const t = local.timing.questions.find(x => x.qid === qid);
    const names = { A: [], B: ['embed', 'bm25', 'dense', 'rrf'], C: ['embed', 'dense', 'graph_expand'] }[arm].slice();
    if (withRerank && arm !== 'A') names.push('rerank');
    const sp = names.map(n => ({ name: n, ms: t[n].median_ms, measured: 'local' })); sp.push({ name: 'generate answer', ms: answerMs, measured: 'endpoint' });
    const total = sp.reduce((a, s) => a + s.ms, 0), top = sp.reduce((a, s) => (s.ms > a.ms ? s : a), sp[0]);
    return { spans: sp, total_ms: total, bottleneck: top.name, bottleneck_share_pct: Math.round(1000 * top.ms / total) / 10 };
  }
  // keep the public result shape exactly as in worked_example.result (extra keys start with "_" and are stripped for the check)
  const pub = r => { const o = {}; Object.keys(r).filter(k => k[0] !== '_').forEach(k => { o[k] = r[k]; }); return o; };
  const clone = o => JSON.parse(JSON.stringify(o));

  const PRESETS = {
    'worked example (toy)': defaults,
    'break it: one slow outlier': (() => { const d = clone(defaults); d.lat = d.lat.map((l, i) => (i === 6 ? 1700 : l)); return d; })(),
    'break it: fast but wrong': (() => { const d = clone(defaults); d.top1 = d.top1.map((s, i) => (i % 2 ? Math.round(100 * (0.2 + 0.03 * i)) / 100 : s)); return d; })(),
    'break it: cache lost': (() => { const d = clone(defaults); d.tokens.n_cr = 0; return d; })(),
  };


  function mountReal(el) {
    const K = DemoKit, url = new URL('data/monitoring_tracing.real.json', SRC || location.href).href;
    const shell = K.shell(el, 'Real example: tracing the answer study (36 requests)',
      'Real data: every span is one real LLM call of the answer study, 2026-10-08 (answer model qwen3.7-plus, judges deepseek-v4.1-flash and glm-5.1): measured latency, input/output tokens, and cost from the provider price rows. Demo scale: one run, no repeats, endpoint in China, shared machine. Retrieval-side stages (query embedding, BM25, dense search, RRF, rerank, graph expand) were timed locally on 2026-10-09 with time.perf_counter (second block below), NOT in the answer study run.');
    const body = K.el('div', {}, 'loading real data...'); shell.append(body);
    fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
      const o = { qid: 'q09', arm: 'C', thresh: 0.5, slowFactor: 1.3, rerank: false }; const sv = K.el('div', {}); let local = null;
      fetch(new URL('data/algos_real_local.json', SRC || location.href).href).then(r => r.json()).then(d => { local = d; draw(); }).catch(() => { sv.textContent = 'serving-path timings not loaded (real: pending)'; });
      const ctl = K.el('div', { class: 'row' }), wf = K.el('div', {}), res = K.el('div', { 'aria-live': 'polite' }), tbl = K.el('div', {}), thr = K.el('div', { class: 'row' }), note = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px' });
      const qids = [...new Set(data.traces.map(t => t.qid))];
      const qs = K.el('select', { 'aria-label': 'question' }, ...qids.map(q => K.el('option', { value: q }, q + ' (' + data.traces.find(t => t.qid === q).type + ')')));
      const as = K.el('select', { 'aria-label': 'arm' }, ...['A', 'B', 'C'].map(a => K.el('option', { value: a }, 'arm ' + a)));
      qs.value = o.qid; as.value = o.arm;
      qs.addEventListener('change', () => { o.qid = qs.value; draw(); }); as.addEventListener('change', () => { o.arm = as.value; draw(); });
      const sl = K.slider('low-score threshold (dense top-1 cosine)', 0, 1, 0.05, o.thresh, v => { o.thresh = v; draw(); });
      const sf = K.slider('slow = more than x times p50', 1, 3, 0.1, o.slowFactor, v => { o.slowFactor = v; draw(); });
      ctl.append(K.el('label', {}, 'question ', qs), K.el('label', {}, 'arm ', as)); thr.append(sl.node, sf.node);
      function draw() {
        const r = realTraceCompute(data, o), tr = data.traces.find(t => t.qid === o.qid && t.arm === o.arm);
        if (local) {
          const sp = servingPath(local, o.qid, o.arm, tr.spans[0].ms, o.rerank), cb = K.el('input', { type: 'checkbox', 'aria-label': 'add cross-encoder rerank' }); cb.checked = o.rerank; cb.addEventListener('change', () => { o.rerank = cb.checked; draw(); });
          sv.replaceChildren(K.el('b', {}, `Serving path of ${o.qid}, arm ${o.arm}: retrieval stages MEASURED LOCALLY + the real answer call`),
            K.el('label', { class: 'hint', style: 'margin-left:8px' }, cb, ' add cross-encoder rerank of the top-20 (not part of arms A to C; measured cost if you add it)'),
            ...sp.spans.map(s => K.el('div', { class: 'row', style: 'gap:8px;margin:2px 0' }, K.el('code', { style: 'width:150px;font-size:12px' }, s.name), K.el('span', { class: 'num', style: 'width:70px' }, K.fmt(s.ms, s.ms < 10 ? 3 : 0) + ' ms'),
              K.el('div', { style: 'flex:1 1 100px;min-width:60px;background:var(--line);border-radius:2px;height:12px' }, K.el('div', { style: `height:12px;border-radius:2px;min-width:1px;width:${100 * s.ms / sp.total_ms}%;background:${s.name === sp.bottleneck ? 'var(--warn)' : 'var(--k12)'}` })),
              K.el('span', { class: 'hint', style: 'width:120px' }, s.measured === 'local' ? 'local, median of 7' : 'one real call'))),
            K.el('div', {}, K.el('span', { class: 'hint' }, 'serving total: '), K.el('b', { class: 'num' }, K.fmt(sp.total_ms, 0) + ' ms'), K.el('span', { class: 'hint' }, `; bottleneck ${sp.bottleneck} (${K.fmt(sp.bottleneck_share_pct, 1)}%). Mixed sources: retrieval on this Mac with a 138-passage corpus, the answer call over the network to a hosted model. The ORDER of cost is the lesson, not the absolute numbers.`)));
        }
        wf.replaceChildren(K.el('b', {}, `One real request: ${o.qid}, arm ${o.arm}${tr.refused ? ' (the model refused: not in the sources)' : ''}, spans = LLM calls (ms)`),
          ...r.spans.map(s => K.el('div', { class: 'row', style: 'gap:8px;margin:2px 0' }, K.el('code', { style: 'width:150px;font-size:12px' }, s.name), K.el('span', { class: 'num', style: 'width:60px' }, s.ms + ' ms'),
            K.el('div', { style: 'flex:1 1 100px;min-width:60px;background:var(--line);border-radius:2px;height:12px' }, K.el('div', { style: `height:12px;border-radius:2px;width:${100 * s.ms / r.trace_total_ms}%;background:${s.name === r.bottleneck ? 'var(--warn)' : 'var(--k12)'}` })),
            K.el('span', { class: 'hint', style: 'width:150px' }, `${s.n_in} in / ${s.n_out} out, $${s.usd.toFixed(6)}`))));
        const flag = i => { const t = r.arm[i], sl_ = r.slow.includes(i), lo = r.low.includes(i); return K.el('tr', { style: t.qid === o.qid ? 'font-weight:600' : '' }, K.el('td', {}, t.qid + ' ' + t.type.slice(0, 4)), K.el('td', {}, t.spans[0].ms + ''), K.el('td', {}, t.dense_top1 === null ? 'n/a' : t.dense_top1.toFixed(2)), K.el('td', {}, t.refused ? 'refused' : 'answered'), K.el('td', {}, sl_ ? K.el('span', { class: 'bad' }, 'SLOW ') : '', lo ? K.el('span', { class: 'bad' }, 'LOW ') : '', !sl_ && !lo ? K.el('span', { class: 'good' }, 'ok') : '')); };
        tbl.replaceChildren(K.el('b', {}, `The 12 requests of arm ${o.arm}: answer-call latency vs retrieval score`), K.el('table', {}, K.el('tr', {}, ...['req', 'answer ms', 'top-1 cos', 'outcome', 'flag'].map(h => K.el('th', {}, h))), ...r.arm.map((_, i) => flag(i))));
        const items = [['trace time T (sum of call latencies)', K.fmt(r.trace_total_ms, 0) + ' ms'], ['bottleneck', `${r.bottleneck} (${K.fmt(r.bottleneck_share_pct, 1)}%)`], ['request cost C', '$' + r.cost_usd.toFixed(6)], ['cached input tokens (measured; their price ASSUMED 0.1 x)', String(r.spans.reduce((a, s) => a + s.n_cr, 0))],
          ['answer latency p50 / p95 / mean', `${r.p50_ms} / ${r.p95_ms} / ${K.fmt(r.mean_ms, 0)} ms`], ['slow / low-retrieval', `${r.slow.length} / ${r.low.length}`]];
        res.replaceChildren(K.el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 16px;margin-top:8px' }, ...items.map(([k, v]) => K.el('div', {}, K.el('span', { class: 'hint' }, k + ': '), K.el('b', { class: 'num' }, v)))),
          r.arm.some((t, i) => t.refused === false && t.dense_top1 !== null && t.type === 'unanswerable') ? K.el('div', { class: 'bad' }, 'An unanswerable question was answered: latency looks normal, only the answer text shows the problem.') : '',
          r.arm.some(t => t.type === 'unanswerable' && t.dense_top1 !== null && t.dense_top1 >= o.thresh) ? K.el('div', { class: 'bad' }, 'An unanswerable question has a top-1 cosine above the threshold: the retrieval score alone does not flag it. A latency dashboard cannot see this either.') : '');
        note.textContent = `Measured: latency and tokens per call. Computed: cost (provider price rows; the price of cached tokens is assumed 0.1 x), p50/p95 (nearest-rank, n = 12), flags. Spans after "generate answer" are the EVALUATION judge calls, not serving stages; T sums their latencies as if sequential (the script's real call order was its own). Retrieval stages: see the serving-path block. Arm B's first stage is hybrid RRF, so its top-1 cosine column is the dense run, not what B retrieved. n = 12, one run.`;
      }
      body.replaceChildren(ctl, wf, sv, res, thr, tbl, note); draw();
    }).catch(e => { body.textContent = 'could not load the real data (' + e.message + '). Use the toy example.'; });
  }

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults);
    const shell = K.shell(el, 'Tracing: where is the time, where is the money, which request failed?',
      'TOY EXAMPLE: every number here is invented to show the arithmetic. Edit span times, token counts, prices, request latencies and scores; the totals, the bottleneck and the flags update.');
    const presetRow = K.el('div', { class: 'row' }), wf = K.el('div', {}), tokRow = K.el('div', { class: 'row' }), res = K.el('div', { 'aria-live': 'polite' });
    const tbl = K.el('div', {}), thr = K.el('div', { class: 'row' }), formula = K.el('div', { class: 'formula' });
    const num = (label, get, set, w = 70, step = 'any') => {
      const i = K.el('input', { type: 'number', step, value: get(), 'aria-label': label, style: `width:${w}px` });
      i.addEventListener('input', () => { const x = parseFloat(i.value); if (Number.isFinite(x) && x >= 0) { set(x); render(); } });
      return i;
    };
    function build() {
      presetRow.replaceChildren(...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); build(); render(); }); return b; }));
      wf.replaceChildren(K.el('b', {}, 'One trace: a span per stage (ms)'),
        ...st.spans.map((s, i) => K.el('div', { class: 'row', style: 'gap:8px;margin:2px 0' },
          K.el('code', { style: 'width:120px' }, s.name), num(s.name + ' ms', () => s.ms, v => { s.ms = v; }, 70),
          K.el('div', { style: 'flex:1 1 120px;min-width:80px;background:var(--line);border-radius:2px;height:12px' }, K.el('div', { 'data-bar': i, style: 'height:12px;border-radius:2px;width:0' })),
          K.el('span', { class: 'num', 'data-pct': i }))));
      tokRow.replaceChildren(
        K.el('label', {}, 'n_in ', num('n_in', () => st.tokens.n_in, v => { st.tokens.n_in = v; }, 70)),
        K.el('label', {}, 'n_cr (cached) ', num('n_cr', () => st.tokens.n_cr, v => { st.tokens.n_cr = v; }, 70)),
        K.el('label', {}, 'n_out ', num('n_out', () => st.tokens.n_out, v => { st.tokens.n_out = v; }, 60)),
        K.el('label', {}, 'P_in $/M ', num('P_in', () => st.prices.P_in, v => { st.prices.P_in = v; }, 56)),
        K.el('label', {}, 'P_cr ', num('P_cr', () => st.prices.P_cr, v => { st.prices.P_cr = v; }, 56)),
        K.el('label', {}, 'P_out ', num('P_out', () => st.prices.P_out, v => { st.prices.P_out = v; }, 56)));
      const rows = st.lat.map((l, i) => K.el('tr', { 'data-row': i }, K.el('td', {}, '#' + (i + 1)),
        K.el('td', {}, num('latency ' + (i + 1), () => st.lat[i], v => { st.lat[i] = v; }, 70, '10')),
        K.el('td', {}, num('top-1 score ' + (i + 1), () => st.top1[i], v => { st.top1[i] = v; }, 56, '0.01')), K.el('td', { 'data-flag': i })));
      tbl.replaceChildren(K.el('b', {}, 'Ten requests (invented)'), K.el('table', {}, K.el('tr', {}, K.el('th', {}, 'req'), K.el('th', {}, 'latency ms'), K.el('th', {}, 'top-1 score'), K.el('th', {}, 'flag')), ...rows));
      const sl = K.slider('low-score threshold', 0, 1, 0.05, st.thresh, v => { st.thresh = v; render(); });
      const sf = K.slider('slow = more than x times p50', 1, 5, 0.5, st.slowFactor, v => { st.slowFactor = v; render(); });
      thr.replaceChildren(sl.node, sf.node);
    }
    shell.append(presetRow, wf, tokRow, tbl, thr, res, formula);
    const last = {};
    function render() {
      const r = compute(st);
      st.spans.forEach((s, i) => {
        const b = wf.querySelector(`[data-bar="${i}"]`), pc = wf.querySelector(`[data-pct="${i}"]`);
        b.style.width = (r.trace_total_ms ? 100 * s.ms / r.trace_total_ms : 0) + '%'; b.style.background = s.name === r._bottleneck ? 'var(--warn)' : 'var(--k12)';
        pc.textContent = K.fmt(r.trace_total_ms ? 100 * s.ms / r.trace_total_ms : 0, 1) + '%';
      });
      st.lat.forEach((l, i) => {
        const f = tbl.querySelector(`[data-flag="${i}"]`), sl = r._slow_idx.includes(i), lo = r._low_idx.includes(i);
        f.replaceChildren(sl ? K.el('span', { class: 'bad' }, 'SLOW ') : '', lo ? K.el('span', { class: 'bad' }, 'LOW RETRIEVAL') : '', !sl && !lo ? K.el('span', { class: 'good' }, 'ok') : '');
      });
      const items = [
        ['trace time T', K.fmt(r.trace_total_ms, 0) + ' ms'], ['bottleneck', `${r._bottleneck} (${K.fmt(r.generate_share_pct, 1)}%)`],
        ['LLM call cost C', '$' + r.cost_usd.toFixed(6)], ['without cache reads', '$' + r.cost_without_cache_read_usd.toFixed(6)],
        ['p50', r.p50_ms + ' ms'], ['p95', r.p95_ms + ' ms'], ['mean', K.fmt(r._mean_ms, 0) + ' ms'],
        ['slow requests', String(r.slow_requests)], ['low-retrieval requests', String(r.low_retrieval_requests)]];
      res.replaceChildren(K.el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 16px;margin-top:8px' },
        ...items.map(([k, v]) => { const n = K.el('b', { class: 'num' }, v); if (last[k] !== undefined && last[k] !== v) K.flash(n); last[k] = v; return K.el('div', {}, K.el('span', { class: 'hint' }, k + ': '), n); })),
        r.slow_requests === 0 && r.low_retrieval_requests > 0 ? K.el('div', { class: 'bad' }, 'Latency looks healthy, yet the retriever found nothing good for some requests: a latency dashboard cannot see this failure.') : '',
        r._mean_ms < r.p95_ms * 0.6 ? K.el('div', { class: 'bad' }, 'The mean (' + K.fmt(r._mean_ms, 0) + ' ms) hides the slow tail that p95 shows.') : '',
        r.cost_usd === r.cost_without_cache_read_usd ? K.el('div', { class: 'bad' }, 'No cache reads: every input token is billed at the full input price.') : '');
      const t = st.tokens, p = st.prices;
      formula.textContent = `T = ${st.spans.map(s => s.ms).join(' + ')} = ${r.trace_total_ms} ms\nC = ((${t.n_in} - ${t.n_cr}) x ${p.P_in} + ${t.n_cr} x ${p.P_cr} + ${t.n_out} x ${p.P_out}) / 1e6 = $${r.cost_usd.toFixed(6)}\np95 = value at rank ceil(0.95 x ${st.lat.length}) = ${Math.ceil(0.95 * st.lat.length - 1e-9)} of the sorted latencies = ${r.p95_ms} ms`;
    }
    build(); render();
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy); mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute: inp => pub(compute(inp)), compute_full: compute, realTraceCompute, servingPath, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['monitoring_tracing'] = api;
})(this);
