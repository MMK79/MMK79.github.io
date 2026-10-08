/* Exact match (SQuAD): EM = 1 if norm(prediction) equals norm(any gold), else 0. Real mode computes it live on the real strings of the answer study. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { pred: 'The Gradient Descent.', gold: 'gradient descent' };

  /* PURE: the four SQuAD normalisation steps, each returning the string after the step. */
  function steps(s) {
    const s1 = String(s).toLowerCase();
    const s2 = s1.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '');
    const s3 = s2.replace(/\b(a|an|the)\b/g, ' ');
    const s4 = s3.split(/\s+/).filter(Boolean).join(' ');
    return [s1, s2, s3, s4];
  }
  const norm = s => steps(s)[3];
  const contains = (pred, gold) => norm(gold) !== '' && (' ' + norm(pred) + ' ').includes(' ' + norm(gold) + ' ');
  /* PURE: returns 1 or 0 (gold may be a string or an array of strings) */
  function compute(inp) {
    const golds = Array.isArray(inp.gold) ? inp.gold : [inp.gold];
    const p = norm(inp.pred);
    return golds.some(g => norm(g) === p) ? 1 : 0;
  }
  const words = s => norm(s).split(' ').filter(Boolean).length;

  function stepsView(K, label, text) {
    const st = steps(text), names = ['lowercase', 'strip punctuation', 'drop articles a/an/the', 'collapse spaces'];
    return K.el('div', { style: 'overflow-wrap:anywhere;margin:4px 0' }, K.el('b', {}, label), st.map((s, i) =>
      K.el('div', { class: 'hint', style: 'overflow-wrap:anywhere' }, (i + 1) + '. ' + names[i] + ': ', K.el('code', {}, '"' + s + '"'))));
  }

  function mountToy(el) {
    const K = root.DemoKit; const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Type a prediction and a gold answer. The page normalises both (SQuAD steps) and compares the strings.');
    const pi = K.el('input', { type: 'text', value: st.pred, 'aria-label': 'prediction', style: 'width:100%;box-sizing:border-box' });
    const gi = K.el('input', { type: 'text', value: st.gold, 'aria-label': 'gold answer', style: 'width:100%;box-sizing:border-box' });
    const view = K.el('div'), res = K.resultBox(), note = K.el('p', { class: 'hint' });
    const set = (p, g) => { pi.value = p; gi.value = g; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults.pred, defaults.gold)),
      btn('Break it: longer correct answer', () => set('Stochastic gradient descent', 'gradient descent')),
      btn('Break it: a full sentence', () => set('The gold answer is gradient descent.', 'gradient descent')),
      btn('Break it: paraphrase', () => set('GD', 'gradient descent'))),
      K.el('label', { style: 'display:block' }, 'prediction', pi), K.el('label', { style: 'display:block' }, 'gold answer', gi), res.node, view, note);
    pi.addEventListener('input', render); gi.addEventListener('input', render);
    function render() {
      const inp = { pred: pi.value, gold: gi.value }, v = compute(inp);
      res.set(v, 0);
      view.replaceChildren(stepsView(K, 'prediction', inp.pred), stepsView(K, 'gold', inp.gold));
      note.textContent = v === 1 ? 'Identical after normalisation: EM = 1.' :
        contains(inp.pred, inp.gold) ? 'The gold answer is inside the prediction, yet EM = 0: a correct but longer answer is punished. Containment would score 1.' : 'Different strings: EM = 0, however close the meaning.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => {
      const qs = {}; a[1].forEach(q => { qs[q.id] = q; });
      return { rows: a[0].filter(r => qs[r.qid]), qs };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: 'q06' };
    const shell = K.shell(el, 'Real example: exact match on a real answer study',
      'Scale: n = 12 questions, 3 arms (A no retrieval, B hybrid top-5, C dense + graph), one run, answerer qwen3.7-plus. The gold answers are helper-written. EM is computed live in this page from the real strings (no LLM judge). Nothing here is a benchmark; the point is what EM does to long LLM answers.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const ids = [...new Set(D.rows.map(r => r.qid))];
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, ids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { style: 'overflow-wrap:anywhere' }), view = K.el('div'), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint' }), table = K.el('div', { style: 'overflow-wrap:anywhere' });
    const own = K.el('textarea', { rows: '2', 'aria-label': 'your own short answer', style: 'width:100%;box-sizing:border-box' });
    const ownOut = K.el('p', { class: 'hint' });
    own.addEventListener('input', () => { const g = D.qs[st.q].gold_answer; ownOut.textContent = own.value ? 'Your answer vs the gold: EM = ' + compute({ pred: own.value, gold: g }) + '. Try typing the gold answer with different case or an added "the".' : ''; });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, res.node, formula, view, note, K.el('h4', {}, 'All 36 real pairs'), table,
      K.el('label', { style: 'display:block' }, 'Try your own answer to the selected question: ', own), ownOut);

    function render() {
      const r = D.rows.find(x => x.qid === st.q && x.arm === st.arm), g = D.qs[st.q].gold_answer;
      const v = compute({ pred: r.answer, gold: g }), cont = contains(r.answer, g);
      const lab = (t, s) => K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, t + ' '), s);
      info.replaceChildren(lab('Gold answer:', g), lab('System answer (' + st.arm + ', ' + words(r.answer) + ' words after normalisation vs ' + words(g) + ' in the gold):', r.answer));
      view.replaceChildren(stepsView(K, 'system answer', r.answer), stepsView(K, 'gold answer', g));
      res.set(v, 0);
      formula.textContent = 'norm(answer) = "' + norm(r.answer) + '"\nnorm(gold)   = "' + norm(g) + '"\nEM = 1[equal] = ' + v + '    (gold contained in the answer: ' + (cont ? 'yes' : 'no') + ')';
      note.textContent = v === 1 ? 'Equal after normalisation: EM = 1.' : D.qs[st.q].type === 'unanswerable'
        ? 'The system refused correctly, but not in the exact words of the gold refusal, so EM = 0: a correct abstention is scored as a miss.'
        : (cont ? 'The gold string is inside the answer, yet EM = 0.' : 'EM = 0: the answer is a sentence (often a correct one), the gold is a short string; they are never identical.');
      const cells = ['A', 'B', 'C'].map(arm => ids.map(id => { const x = D.rows.find(y => y.qid === id && y.arm === arm); return { em: compute({ pred: x.answer, gold: D.qs[id].gold_answer }), c: contains(x.answer, D.qs[id].gold_answer) }; }));
      const tot = n => n.reduce((s, c) => s + c.em, 0), totc = n => n.filter(c => c.c).length;
      table.replaceChildren(K.el('p', { class: 'hint' },
        ['A', 'B', 'C'].map((arm, i) => 'Arm ' + arm + ': EM = ' + tot(cells[i]) + '/' + ids.length + ' = ' + K.fmt(tot(cells[i]) / ids.length, 3) + ', containment = ' + totc(cells[i]) + '/' + ids.length).join('  |  ') +
        '. Computed live on the real strings. Per question (EM, then containment) for A / B / C: ' +
        ids.map((id, j) => id + ' ' + cells.map(c => c[j].em + (c[j].c ? '+' : '-')).join('/')).join(', ') + ' ("+" = gold string inside the answer).'));
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

  const api = { defaults, compute, mount, norm, steps };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['exact_match'] = api;
})(this);
