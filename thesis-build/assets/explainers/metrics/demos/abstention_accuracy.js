/* Abstention accuracy demo. Real example (default): 12 questions of the answer study (3 unanswerable, 9 answerable), per arm;
   the 2x2 table is counted live from the gold label (questions.json) and the refusal flag (answers.json).
   Toy example: four editable counts. compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { tp: 18, fn: 6, fp: 9, tn: 67 };   // 24 unanswerable, 76 answerable (illustrative)

  /* PURE: AbsAcc = (TP+TN)/N, AbsRecall = TP/(TP+FN), OverAbs = FP/(FP+TN) */
  function compute(i) {
    const N = i.tp + i.fn + i.fp + i.tn, U = i.tp + i.fn, A = i.fp + i.tn;
    const r4 = x => Math.round(x * 1e4) / 1e4;   // catalogue values are rounded to 4 decimals
    return { abs_acc: r4(N ? (i.tp + i.tn) / N : 0), abs_recall: r4(U ? i.tp / U : 0), over_abs: r4(A ? i.fp / A : 0) };
  }
  const f = (x, d = 3) => Number.isFinite(x) ? String(+x.toFixed(d)) : 'n/a';
  function counts(rows) {   // rows: [{unans, refused}]
    const c = { tp: 0, fn: 0, fp: 0, tn: 0 };
    rows.forEach(r => { r.unans ? (r.refused ? c.tp++ : c.fn++) : (r.refused ? c.fp++ : c.tn++); });
    return c;
  }
  function show(res, formula, c) {
    const v = compute(c), N = c.tp + c.fn + c.fp + c.tn;
    res.set(v.abs_acc, 3);
    formula.textContent = `TP = ${c.tp}  FN = ${c.fn}  FP = ${c.fp}  TN = ${c.tn}  (N = ${N})\n` +
      `AbsAcc    = (${c.tp} + ${c.tn}) / ${N} = ${f(v.abs_acc)}\n` +
      `AbsRecall = ${c.tp} / ${c.tp + c.fn} = ${f(v.abs_recall)}\n` +
      `OverAbs   = ${c.fp} / ${c.fp + c.tn} = ${f(v.over_abs)}`;
  }

  function mountToy(el) {
    const K = root.DemoKit, st = { ...defaults };
    const shell = K.shell(el, 'Toy example (break it)', 'Four counts of an invented 100-question test (illustrative, not measured). Move the sliders; the three scores update.');
    const sl = {};
    const mk = (k, label, max) => { sl[k] = K.slider(label, 0, max, 1, st[k], v => { st[k] = v; render(); }); return sl[k].node; };
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const set = (o) => { Object.assign(st, o); Object.keys(o).forEach(k => sl[k].set(o[k])); render(); };
    const btn = (t, fn) => K.el('button', { type: 'button', onclick: fn }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: always abstain', () => set({ tp: 24, fn: 0, fp: 76, tn: 0 })),
      btn('Never abstain', () => set({ tp: 0, fn: 24, fp: 0, tn: 76 }))),
      mk('tp', 'TP unanswerable, abstained', 100), mk('fn', 'FN unanswerable, answered', 100),
      mk('fp', 'FP answerable, abstained', 100), mk('tn', 'TN answerable, answered', 100), res.node, formula, note);
    function render() {
      show(res, formula, st);
      const v = compute(st);
      note.textContent = v.over_abs > 0.5 ? 'Always abstaining gives AbsRecall 1.0 but OverAbs 1.0: it refuses every answerable question. Read the three numbers together.'
        : 'AbsAcc mixes both errors. Check AbsRecall (misses on unanswerable) and OverAbs (refusals of answerable questions) separately.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json'), get('metrics/abstention_accuracy.json')]).then(a => {
      const ans = {}; a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      return { ans, qs: a[1].filter(q => ans[q.id + '_A']), ref: a[2] };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, st = { arm: 'B', always: false };
    const shell = K.shell(el, 'Real example: abstain or answer, 12 questions',
      'Scale: n = 12 questions (3 unanswerable, 9 answerable), one run, temperature 0, answerer ' + D.ref.answer_model + ', no human labels, so intervals are very wide: one question moves AbsAcc by 0.083. "Unanswerable" means not answerable from a 138-passage corpus sample (labels by the question author). Refusal is detected by code: the reply contains the fixed phrase. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm; aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const btn = K.el('button', { type: 'button', 'aria-pressed': 'false' }, 'Break it: force "always abstain" (hypothetical)');
    btn.addEventListener('click', () => { st.always = !st.always; btn.setAttribute('aria-pressed', String(st.always)); render(); });
    const list = K.el('div', { role: 'group', 'aria-label': 'questions', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), cmp = K.el('div', { class: 'formula' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), btn), list, res.node, formula, cmp, note);
    const rowsOf = (arm, always) => D.qs.map(q => ({ id: q.id, unans: q.type === 'unanswerable', refused: always ? true : D.ans[q.id + '_' + arm].refused, q }));
    function render() {
      const rows = rowsOf(st.arm, st.always);
      list.replaceChildren();
      rows.forEach(r => {
        const ok = r.refused === r.unans;
        list.append(K.el('div', { title: r.q.question, style: 'padding:3px 6px;border-radius:6px;border:2px solid var(--' + (ok ? 'he' : 'warn') + ');' + (r.unans ? 'background:#C28BFF22' : '') },
          K.el('b', {}, r.id), K.el('div', { class: 'hint', style: 'margin:0' }, (r.unans ? 'unanswerable' : 'answerable') + ': ' + (r.refused ? 'refused' : 'answered'))));
      });
      const c = counts(rows); show(res, formula, c);
      cmp.textContent = 'All arms (from the data): ' + ['A', 'B', 'C'].map(a => { const v = compute(counts(rowsOf(a, false))); return `${a}: AbsAcc ${f(v.abs_acc)}, recall ${f(v.abs_recall)}, over ${f(v.over_abs)}`; }).join('  |  ') +
        '\nCatalogue file metrics/abstention_accuracy.json gives AbsAcc ' + ['A', 'B', 'C'].map(a => a + ' ' + f(D.ref.per_arm[a])).join(', ') + ' (matches).';
      const over = rows.filter(r => !r.unans && r.refused).map(r => r.id);
      note.textContent = st.always ? 'Hypothetical: every question refused. Recall is 1.0 but OverAbs is 1.0 and AbsAcc falls to 0.25, the share of unanswerable questions.'
        : st.arm === 'A' ? 'Arm A never refuses: recall 0 on the unanswerable questions, but it answers all 9 answerable ones. Its replies to the unanswerable ones are often true world knowledge (e.g. Adam learning rate 0.001), "unanswerable" only relative to the corpus.'
        : st.arm === 'B' ? 'B refuses all 3 unanswerable questions but also refused ' + over.join(', ') + ' (answerable): the passage holding the author was not retrieved, so refusing is honest but counts as over-abstention.'
        : 'C refuses all 3 unanswerable questions and answers all 9 answerable ones. With n = 12 it is not distinguishable from B (one question).';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['abstention_accuracy'] = api;
})(this);
