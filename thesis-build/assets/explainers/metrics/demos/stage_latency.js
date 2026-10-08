/* Latency per stage: toy stacked bar with stage toggles; real example = the 36 answer-call latencies of the answer study (other stages never timed). */
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
    realData = Promise.all([get(base + 'answers/per_question.json'), get(base + 'metrics/stage_latency.json'), get(tr, trAlt)]).then(a => ({ pq: a[0], m: a[1], tr: a[2] }));
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', r: 0, q: 0, assume: { embed_search: 0, rerank: 0, graph: 0 } };
    const shell = K.shell(el, 'Real example: 36 timed answer calls',
      'Scale: n = 12 questions, one run, temperature 0. Only the generation call was timed: wall-clock of one non-streaming call to an endpoint in China, from a shared machine under swap, one run, indicative only. Query embedding, vector search, reranking and graph expansion were run offline and never timed here, so those stages are PENDING: no number is shown for them unless you type an assumption yourself.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm; aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const stat = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const res = K.resultBox(); const share = K.el('div', { class: 'num hint' });
    const W = 600, svgD = K.svg('svg', { viewBox: `0 0 ${W} 80`, width: '100%', role: 'img', 'aria-label': 'latency of the 12 calls' });
    const svgB = K.svg('svg', { viewBox: `0 0 ${W} 100`, width: '100%', role: 'img', 'aria-label': 'stage bar with pending stages' });
    const asm = {}; const asmRows = [['embed_search', 'embed + vector search'], ['rerank', 'rerank'], ['graph', 'graph expansion']].map(([k, n]) => {
      asm[k] = K.slider('assume ' + n + ' (ms, NOT measured)', 0, 600, 5, 0, v => { st.assume[k] = v; render(); });
      return K.el('div', { class: 'row' }, asm[k].node);
    });
    const tSel = K.el('select', { 'aria-label': 'trace', style: 'max-width:100%' }, D.tr.traces.map((t, i) => opt(i, t.qid + ' arm ' + t.arm)));
    tSel.addEventListener('change', () => { st.t = +tSel.value; render(); });
    st.t = 0;
    const traceBox = K.svg('svg', { viewBox: `0 0 ${W} 70`, width: '100%', role: 'img', 'aria-label': 'spans of one traced question' });
    const traceTxt = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), stat, svgD,
      K.el('h4', { style: 'margin:12px 0 4px' }, 'End-to-end with the stages nobody timed'),
      K.el('p', { class: 'hint' }, 'Grey hatched stages are pending. The sliders let you ask "what if" with your own assumed milliseconds; the result then mixes a real number (generation) with assumed ones and is labelled as such.'),
      ...asmRows, K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' ms (generation measured, rest assumed)'), share), svgB,
      K.el('h4', { style: 'margin:12px 0 4px' }, 'Real spans of one traced question (answer call, then evaluation judge calls)'),
      K.el('div', { class: 'row' }, K.el('label', {}, 'trace ', tSel)), traceBox, traceTxt, note);

    const colors = { ans: '#F2A93B', ext: '#7C9CFF', verA: '#3CC7B4', verB: '#C28BFF', cor: '#FF8A65' };
    function render() {
      const rows = D.pq.filter(r => r.arm === st.arm).map(r => r.latency_s);
      const sorted = rows.slice().sort((a, b) => a - b);
      const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
      stat.textContent = `generation call, arm ${st.arm}, n = ${rows.length}:  mean ${K.fmt(mean, 2)} s   median ${K.fmt((sorted[5] + sorted[6]) / 2, 2)} s   p95 ${K.fmt(pct(sorted, .95), 2)} s (nearest rank, n = 12: the max)   max ${K.fmt(sorted[11], 2)} s\n` +
        `Pack check: mean ${D.m.per_arm[st.arm].latency_s_mean} s. Retrieval, rerank and embedding: PENDING (never timed).`;
      svgD.replaceChildren();
      const lo = 2, hi = 6.5, X = s => 20 + (W - 40) * (s - lo) / (hi - lo);
      svgD.append(K.svg('line', { x1: 20, x2: W - 20, y1: 40, y2: 40, stroke: '#242B38' }));
      for (let s = 2; s <= 6; s++) { svgD.append(K.svg('line', { x1: X(s), x2: X(s), y1: 36, y2: 44, stroke: '#68707F' }), K.svg('text', { x: X(s), y: 62, 'text-anchor': 'middle' }, s + ' s')); }
      rows.forEach((s, i) => svgD.append(K.svg('circle', { cx: X(s), cy: 40 - (i % 3) * 8, r: 5, fill: '#F2A93B', 'fill-opacity': .8 }, K.svg('title', {}, D.pq.filter(r => r.arm === st.arm)[i].qid + ' ' + s + ' s'))));
      svgD.append(K.svg('line', { x1: X(mean), x2: X(mean), y1: 8, y2: 52, stroke: '#7C9CFF', 'stroke-width': 2 }), K.svg('text', { x: X(mean), y: 10, 'text-anchor': 'middle', style: 'fill:#7C9CFF' }, 'mean'));
      const gen = mean * 1000, a = st.assume, tot = gen + a.embed_search + a.rerank + a.graph;
      res.set(tot, 0); share.textContent = 'generation share ' + K.fmt(100 * gen / tot, 1) + '%' + (a.embed_search + a.rerank + a.graph ? ' (assumed stages included)' : ' (only stage timed: trivially 100%)');
      svgB.replaceChildren();
      const parts = [['embed + search', a.embed_search, '#7C9CFF', 1], ['rerank', a.rerank, '#C28BFF', 1], ['graph', a.graph, '#3CC7B4', 1], ['generation (measured)', gen, '#F2A93B', 0]];
      let x = 0;
      parts.forEach(([n, v, c, pend]) => {
        const w = W * v / tot;
        if (pend && v === 0) return;
        svgB.append(K.svg('rect', { x, y: 8, width: w, height: 30, fill: c, 'fill-opacity': pend ? .45 : 1, stroke: pend ? '#98A0B0' : 'none', 'stroke-dasharray': pend ? '4 3' : '0' })); x += w;
      });
      const pend = parts.filter(p => p[3] && p[1] === 0).map(p => p[0]);
      svgB.append(K.svg('text', { x: 0, y: 56 }, pend.length ? 'PENDING (not timed): ' + pend.join(', ') : 'other stages: assumed, not measured'), K.svg('text', { x: 0, y: 74, style: 'fill:#F2A93B' }, 'generation, measured: ' + K.fmt(gen, 0) + ' ms'));
      const t = D.tr.traces[st.t], sum = t.spans.reduce((s, p) => s + p.ms, 0);
      traceBox.replaceChildren(); let xx = 0;
      t.spans.forEach(p => { const w = W * p.ms / sum; traceBox.append(K.svg('rect', { x: xx, y: 8, width: Math.max(w - 1, 1), height: 30, fill: colors[p.kind] || '#98A0B0', 'fill-opacity': p.kind === 'ans' ? 1 : .55 }, K.svg('title', {}, p.name + ' ' + p.ms + ' ms'))); xx += w; });
      traceBox.append(K.svg('text', { x: 0, y: 58 }, 'amber = answer call; other colours = judge calls'));
      traceTxt.textContent = 'Amber is the answer call (what a student waits for); the other colours are evaluation judge calls, not serving.\n' + t.spans.map(p => `${p.name.padEnd(20)} ${p.model.padEnd(20)} ${String(p.ms).padStart(5)} ms  in ${p.n_in} out ${p.n_out}`).join('\n') + `\nsequential sum ${sum} ms; the answer call is ${K.fmt(100 * t.spans[0].ms / sum, 0)}% of this sum`;
      note.textContent = 'What this shows: where the generation call sits and how spread it is (2.13 to 5.91 s over 36 calls, arm means 3.65 / 3.79 / 3.70 s). What it cannot show: retrieval, rerank, graph and embedding latency, time to first token (calls were not streamed), p95 over many users. One run, no repeats.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['stage_latency'] = api;
})(this);
