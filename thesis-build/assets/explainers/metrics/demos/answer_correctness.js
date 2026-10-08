/* Answer correctness (RAGAS) demo: AC = w_f * F1_fact + w_s * cos(E(a), E(a*)).
   The LLM claim sorting and the embedding model are NOT run here: TP / FP / FN counts and the cosine are editable inputs. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { tp: 3, fp: 1, fn: 2, cos: 0.9, wf: 0.75 };   // w_s = 1 - w_f (Ragas default 0.75 / 0.25)

  /* PURE: F1_fact = TP / (TP + (FP+FN)/2) (0 when there are no claims), AC = w_f F1 + (1-w_f) cos */
  function compute(inp) {
    const d = inp.tp + 0.5 * (inp.fp + inp.fn);
    const f1 = d > 0 ? inp.tp / d : 0;
    return inp.wf * f1 + (1 - inp.wf) * inp.cos;
  }
  const f1Of = i => { const d = i.tp + 0.5 * (i.fp + i.fn); return d > 0 ? i.tp / d : 0; };

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)',
      'Sort the claims into shared (TP), extra (FP) and missing (FN), set the embedding cosine, and move the weight. The claim sorting and the embedding are precomputed here, not run.');
    const venn = K.el('div', { 'aria-hidden': 'true' });
    const sl = {
      tp: K.slider('TP shared claims', 0, 8, 1, st.tp, v => { st.tp = v; render(); }),
      fp: K.slider('FP extra claims', 0, 8, 1, st.fp, v => { st.fp = v; render(); }),
      fn: K.slider('FN missing claims', 0, 8, 1, st.fn, v => { st.fn = v; render(); }),
      cos: K.slider('cosine of embeddings', 0, 1, 0.05, st.cos, v => { st.cos = v; render(); }),
      wf: K.slider('weight w_f (facts)', 0, 1, 0.05, st.wf, v => { st.wf = v; render(); }),
    };
    const res = K.resultBox();
    const parts = K.el('div', { class: 'row' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const set = o => { Object.assign(st, o); for (const k in sl) sl[k].set(st[k]); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: fluent near-miss', () => set({ tp: 0, fp: 4, fn: 5, cos: 0.9, wf: 0.75 })),
      btn('Break it: weights 50/50', () => set({ tp: 3, fp: 1, fn: 2, cos: 0.9, wf: 0.5 })),
      btn('Perfect answer', () => set({ tp: 5, fp: 0, fn: 0, cos: 1, wf: 0.75 })));
    shell.append(presets, venn, ...Object.values(sl).map(s => K.el('div', { class: 'row' }, s.node)), res.node, parts, formula, note);

    function dots(n, col, cx) {
      const g = []; const gap = 18, y0 = 90 - (Math.max(n, 1) - 1) * gap / 2;
      for (let i = 0; i < n; i++) g.push(K.svg('circle', { cx, cy: y0 + i * gap, r: 6, fill: col }));
      return g;
    }
    function render() {
      const s = K.svg('svg', { viewBox: '0 0 360 190', width: '100%', style: 'max-width:420px' },
        K.svg('circle', { cx: 130, cy: 90, r: 72, fill: 'rgba(124,156,255,.10)', stroke: 'var(--k12)', 'stroke-width': 2 }),
        K.svg('circle', { cx: 230, cy: 90, r: 72, fill: 'rgba(242,169,59,.10)', stroke: 'var(--ai)', 'stroke-width': 2 }),
        ...dots(Math.min(st.fn, 8), 'var(--k12)', 95), ...dots(Math.min(st.tp, 8), 'var(--he)', 180), ...dots(Math.min(st.fp, 8), 'var(--warn)', 265),
        K.svg('text', { x: 100, y: 183, 'text-anchor': 'middle' }, 'reference'), K.svg('text', { x: 260, y: 183, 'text-anchor': 'middle' }, 'answer'));
      venn.replaceChildren(s);
      const f1 = f1Of(st), score = compute(st);
      res.set(score, 3);
      parts.replaceChildren(
        K.el('span', { class: 'num good' }, `F1_fact = ${K.fmt(f1, 3)}`),
        K.el('span', { class: 'num', style: 'color:var(--both)' }, `cos = ${K.fmt(st.cos, 2)}`),
        K.el('span', { class: 'num' }, `w_f = ${K.fmt(st.wf, 2)}, w_s = ${K.fmt(1 - st.wf, 2)}`));
      const d = st.tp + 0.5 * (st.fp + st.fn);
      formula.textContent = `F1_fact = ${st.tp} / (${st.tp} + 0.5 x (${st.fp} + ${st.fn})) = ${K.fmt(f1, 3)}\nAC = ${K.fmt(st.wf, 2)} x ${K.fmt(f1, 3)} + ${K.fmt(1 - st.wf, 2)} x ${K.fmt(st.cos, 2)} = ${K.fmt(score, 3)}`;
      note.textContent = st.tp === 0 && st.cos >= 0.8
        ? 'No shared fact, yet the score is far from 0: the semantic part rewards a fluent near-miss.'
        : 'The 0.75 / 0.25 weights are a Ragas default, not a theory. The score also needs a good reference answer.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (metrics/answer_correctness.json + answers/) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/answer_correctness.json'), get('answers/answers.json'), get('answers/claims.json'), get('data/questions.json')]).then(a => {
      const ans = {}, cl = {}, qs = {};
      a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[2].forEach(r => { cl[r.qid + '_' + r.arm] = r.claims; });
      a[3].forEach(q => { qs[q.id] = q; });
      return { m: a[0], ans, cl, qs };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  function mountReal(el, D) {
    const K = root.DemoKit;
    const answerable = qid => D.qs[qid].type !== 'unanswerable';
    const qids = Object.keys(D.m.per_question.B).filter(answerable);
    const st = { arm: 'B', q: qids[0], cos: 0.9 };
    const shell = K.shell(el, 'Real example: Answer correctness on a real answer study',
      'Scale: n = 12 questions (9 answerable), one run, temperature 0, LLM judges (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Not shown, because the pack does not contain it: the claim-level TP / FP / FN split against the gold answer and the embedding cosine. What the pack has is the judge verdict 1 / 0.5 / 0 against the gold answer, which stands in for the factual part.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const cosSl = K.slider('what-if cosine (NOT measured)', 0, 1, 0.05, st.cos, v => { st.cos = v; render(); });
    const info = K.el('div', { 'aria-live': 'polite', style: 'overflow-wrap:anywhere' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, res.node, formula, K.el('div', { class: 'row' }, cosSl.node), note, means);

    function render() {
      const key = st.q + '_' + st.arm, q = D.qs[st.q], a = D.ans[key];
      const v = D.m.per_question[st.arm][st.q];
      const claims = D.cl[key] || [];
      const lab = (t, s) => K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, t + ' '), s);
      info.replaceChildren(
        lab('Gold answer:', q.gold_answer),
        lab('System answer (' + st.arm + (a && a.context_ids && a.context_ids.length ? ', context ' + a.context_ids.join(', ') : ', no context') + '):', a ? a.answer : '(missing)'),
        lab('Answer claims (' + claims.length + ', split for faithfulness; the pack does not label them TP / FP / FN against the gold):', ''),
        K.el('ol', { style: 'margin:2px 0 6px 18px;padding:0' }, claims.map(c => K.el('li', { class: 'hint' }, c))),
        lab('Judge A verdict:', v + ' (1 = matches the gold facts, 0.5 = partly, 0 = no). Reason: ' + (D.m.reasons[key] || '')));
      res.set(v, 3);
      const sem = st.cos, score = compute({ tp: 0, fp: 0, fn: 0, cos: sem, wf: 0.75 });
      const mix = 0.75 * v + 0.25 * sem;
      formula.textContent = `factual part = judge verdict = ${K.fmt(v, 2)}  (measured, replaces F1_fact)\n` +
        `semantic part = cosine = ${K.fmt(sem, 2)}  (what-if, not in the pack)\n` +
        `AC = 0.75 x ${K.fmt(v, 2)} + 0.25 x ${K.fmt(sem, 2)} = ${K.fmt(mix, 3)}  (pack value shown above is the factual part alone: ${K.fmt(v, 2)})`;
      note.textContent = v === 1 ? 'The judge found the gold facts in the answer. Even so, the Ragas score would also depend on the embedding cosine, which was not computed here.'
        : 'The judge found the gold facts only partly or not at all: ' + (st.arm === 'A' ? 'with no retrieval the model may answer fluently from memory and still miss the corpus facts.' : 'see the reason above.');
      const row = arm => {
        const xs = Object.keys(D.m.per_question[arm]).filter(answerable).map(id => D.m.per_question[arm][id]);
        const s = D.m.summary[arm];
        return `${arm}: ${K.fmt(meanOf(xs), 4)} recomputed over n=${xs.length} (pack ${s.mean}, 95% CI [${s.ci95.join(', ')}])`;
      };
      means.textContent = 'Arm means (9 answerable questions, judge verdict): ' + ['A', 'B', 'C'].map(row).join('  |  ') +
        '. B is lower than A because q09 and q18 were judged worse in B; with n = 9 the intervals overlap, so this is not a ranking.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['answer_correctness'] = api;
})(this);
