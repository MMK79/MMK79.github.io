/* Tokens and cost per answer: sliders for token counts and prices, split bar of input vs output cost. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { t_in: 6500, t_out: 400, p_in: 0.25, p_out: 2.0 };

  /* PURE: c_q = (t_in * p_in + t_out * p_out) / 1e6   (prices in USD per million tokens) */
  function compute(inp) {
    return (inp.t_in * inp.p_in + inp.t_out * inp.p_out) / 1e6;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults, { acc: 0.7 });
    const shell = K.shell(el, 'Toy example (break it)',
      'Move the sliders. The bar splits the cost into input (blue) and output (amber). Then try the presets.');
    const res = K.resultBox();
    const unit = K.el('span', { class: 'hint' }, ' USD per answer');
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const norm = K.el('p', { class: 'hint' });
    const W = 600;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} 70`, width: '100%', role: 'img', 'aria-label': 'input versus output cost' });
    const rIn = K.svg('rect', { y: 10, height: 30, fill: '#7C9CFF' });
    const rOut = K.svg('rect', { y: 10, height: 30, fill: '#F2A93B' });
    const tIn = K.svg('text', { y: 60 }), tOut = K.svg('text', { y: 60, 'text-anchor': 'end' });
    svg.append(rIn, rOut, tIn, tOut);

    const S = {};
    const mk = (key, label, min, max, step) => { S[key] = K.slider(label, min, max, step, st[key], v => { st[key] = v; render(); }); return S[key]; };
    const rows = K.el('div', {},
      K.el('div', { class: 'row' }, mk('t_in', 't_in (prompt tokens)', 0, 40000, 100).node),
      K.el('div', { class: 'row' }, mk('t_out', 't_out (output tokens)', 0, 4000, 10).node),
      K.el('div', { class: 'row' }, mk('p_in', 'p_in (USD / M)', 0, 10, 0.05).node),
      K.el('div', { class: 'row' }, mk('p_out', 'p_out (USD / M)', 0, 40, 0.25).node),
      K.el('div', { class: 'row' }, mk('acc', 'accuracy of this arm', 0, 1, 0.01).node));
    const set = o => { Object.assign(st, o); for (const k in o) S[k].set(o[k]); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(Object.assign({}, defaults))),
      btn('Break it: graph arm, 3x context', () => set({ t_in: 19500, t_out: 400, p_in: 0.25, p_out: 2.0 })),
      btn('Pricier model (x10)', () => set({ p_in: 2.5, p_out: 20 })));
    shell.append(presets, rows, K.el('div', { class: 'row' }, res.node, unit), svg, formula, note, norm);

    function render() {
      const cIn = st.t_in * st.p_in / 1e6, cOut = st.t_out * st.p_out / 1e6, c = compute(st);
      res.set(c, 6);
      const wIn = c > 0 ? W * cIn / c : 0;
      rIn.setAttribute('x', 0); rIn.setAttribute('width', wIn);
      rOut.setAttribute('x', wIn); rOut.setAttribute('width', W - wIn);
      tIn.setAttribute('x', 0); tIn.textContent = c > 0 ? `input ${K.fmt(100 * cIn / c, 0)}%  (${K.fmt(cIn, 6)})` : 'input';
      tOut.setAttribute('x', W); tOut.textContent = c > 0 ? `output ${K.fmt(100 * cOut / c, 0)}%  (${K.fmt(cOut, 6)})` : 'output';
      formula.textContent = `c_q = (${st.t_in} x ${K.fmt(st.p_in, 2)} + ${st.t_out} x ${K.fmt(st.p_out, 2)}) / 10^6\n    = ${K.fmt(cIn, 6)} + ${K.fmt(cOut, 6)} = ${K.fmt(c, 6)} USD`;
      const ratio = c / compute(defaults);
      note.textContent = `Versus the worked example (0.002425 USD): ${K.fmt(ratio, 2)}x. Cached input tokens are billed less, and embedding and judge calls are not included.`;
      norm.textContent = c > 0 ? `Cost-normalised accuracy: ${K.fmt(st.acc, 2)} / ${K.fmt(c, 6)} = ${K.fmt(st.acc / c, 1)} correct answers per USD.` : '';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (metrics/cost_per_answer.json, answers/cost_latency.json, answers/answers.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/cost_per_answer.json'), get('answers/cost_latency.json'), get('data/questions.json')]).then(a => {
      const qs = {}; a[2].forEach(q => { qs[q.id] = q; });
      return { m: a[0], cl: a[1], qs };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const P = D.m.prices, rows = D.m.per_question_rows;
    const qids = [...new Set(rows.map(r => r.qid))];
    const st = { arm: 'B', q: qids[0] };
    const shell = K.shell(el, 'Real example: tokens and cost of real answers',
      'Scale: n = 12 questions, one run, temperature 0, no human labels. Only the answer model (' + D.m.answer_model + ') is costed: judge calls, embeddings and retrieval are not included. Latency is the wall-clock time of one non-streaming call from a shared machine, one run, indicative only. Arm C gets about 40% more context than B (620 vs 416 words) and starts from a different first-stage list, so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + (D.qs[id] ? ' (' + D.qs[id].type + '): ' + D.qs[id].question : ''))));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('p', { class: 'hint', 'aria-live': 'polite' });
    const res = K.resultBox();
    const unit = K.el('span', { class: 'hint' }, ' USD for this answer');
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const W = 600;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} 70`, width: '100%', role: 'img', 'aria-label': 'input versus output cost' });
    const rIn = K.svg('rect', { y: 10, height: 30, fill: '#7C9CFF' });
    const rOut = K.svg('rect', { y: 10, height: 30, fill: '#F2A93B' });
    const tIn = K.svg('text', { y: 60 }), tOut = K.svg('text', { y: 60, 'text-anchor': 'end' });
    svg.append(rIn, rOut, tIn, tOut);
    const priceBox = K.el('div', { class: 'formula' });
    const means = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const pr = D.cl.prices_usd_per_mtok;
    priceBox.textContent = 'Price table used (USD per million tokens, pack ' + D.m.generated + ')\n' +
      Object.keys(pr).map(m => (m + (m === D.m.answer_model ? ' (answer model, used here)' : ' (judge, not costed here)')).padEnd(0) + ': in ' + pr[m].input + ', out ' + pr[m].output).join('\n') +
      '\nSource: ' + D.cl.price_source;
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, K.el('div', { class: 'row' }, res.node, unit), svg, formula, priceBox, means, note);

    function render() {
      const r = rows.find(x => x.qid === st.q && x.arm === st.arm);
      const q = D.qs[st.q];
      info.textContent = 'Real call: ' + r.prompt_tokens + ' prompt tokens (question + ' + r.context_words + ' words of retrieved context' + (r.context_words ? '' : ': none, arm A') + '), ' + r.completion_tokens + ' completion tokens, latency ' + K.fmt(r.latency_s, 2) + ' s' + (q ? '. Question type: ' + q.type + '.' : '.');
      const inp = { t_in: r.prompt_tokens, t_out: r.completion_tokens, p_in: P.input, p_out: P.output };
      const cIn = inp.t_in * inp.p_in / 1e6, cOut = inp.t_out * inp.p_out / 1e6, c = compute(inp);
      res.set(c, 7);
      const wIn = c > 0 ? W * cIn / c : 0;
      rIn.setAttribute('x', 0); rIn.setAttribute('width', wIn);
      rOut.setAttribute('x', wIn); rOut.setAttribute('width', W - wIn);
      tIn.setAttribute('x', 0); tIn.textContent = `input ${K.fmt(100 * cIn / c, 0)}%  (${K.fmt(cIn, 6)})`;
      tOut.setAttribute('x', W); tOut.textContent = `output ${K.fmt(100 * cOut / c, 0)}%  (${K.fmt(cOut, 6)})`;
      formula.textContent = `c_q = (${inp.t_in} x ${inp.p_in} + ${inp.t_out} x ${inp.p_out}) / 10^6\n    = ${K.fmt(cIn, 6)} + ${K.fmt(cOut, 6)} = ${K.fmt(c, 6)} USD   (pack records ${r.usd})`;
      const a = D.m.per_arm;
      means.textContent = 'Arm means over 12 questions (USD per answer, mean prompt tokens, mean context words, mean latency)\n' +
        ['A', 'B', 'C'].map(k => `${k}: $${K.fmt(a[k].usd_per_answer_mean, 5)}  ${a[k].prompt_tokens_mean} tok in  ${a[k].context_words_mean} words  ${K.fmt(a[k].latency_s_mean, 2)} s`).join('\n') +
        `\nC context / B context = ${K.fmt(a.C.context_words_mean / a.B.context_words_mean, 2)}x; C cost / B cost = ${K.fmt(a.C.usd_per_answer_mean / a.B.usd_per_answer_mean, 2)}x`;
      note.textContent = 'Retrieval makes the input the main cost: about ' + K.fmt(100 * cIn / c, 0) + '% of this answer. Latency is nearly flat (about 3.7 s per arm) because the call is dominated by network and generation, not by the extra context. Cost alone says nothing about quality: see accuracy per dollar.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['cost_per_answer'] = api;
})(this);
