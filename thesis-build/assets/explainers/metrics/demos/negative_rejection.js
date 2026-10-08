/* Negative rejection demo: 50 questions whose context has no answer. Click a dot to mark the reply as containing the
   rejection phrase ("insufficient information"). A second slider gives the answerable questions the system wrongly refuses,
   to show why Rej alone can be gamed. The model is NOT run: the marks are editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const N = 50;
  const defaults = { rejected: [3, 9, 12, 18, 21, 26, 30, 37, 41, 44, 48], n: N, answerable: 50, wronglyRefused: 0 };   // 11/50 -> 0.22

  /* PURE: Rej = #rejected / N_neg. Returns a number. */
  function compute(inp) {
    const n = inp.n === undefined ? N : inp.n;
    return n > 0 ? new Set(inp.rejected).size / n : 0;
  }
  /* companion: accuracy on answerable questions = (answerable - wrongly refused) / answerable (assumes the rest are answered correctly) */
  function answerableRate(inp) {
    return inp.answerable > 0 ? (inp.answerable - inp.wronglyRefused) / inp.answerable : 0;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { rej: new Set(defaults.rejected), wr: 0 };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each dot is a question whose context has no answer. Click (or press Enter on) a dot to mark that the reply contains the rejection phrase. Teal = refused, orange = answered anyway. The model is not run: the marks are yours.');
    const grid = K.el('div', { role: 'group', 'aria-label': 'unanswerable questions', style: 'display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px;max-width:520px' });
    const sl = K.slider('answerable questions the system wrongly refuses (out of 50)', 0, 50, 1, 0, v => { st.wr = v; render(); });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.rej = new Set(defaults.rejected); st.wr = 0; sl.set(0); render(); }),
      btn('Break it: always refuse', () => { st.rej = new Set([...Array(N).keys()]); st.wr = 50; sl.set(50); render(); }),
      btn('Clear', () => { st.rej = new Set(); render(); }));
    shell.append(presets, grid, sl.node, res.node, formula, note);

    function render() {
      grid.replaceChildren();
      for (let i = 0; i < N; i++) {
        const r = st.rej.has(i);
        grid.append(K.el('button', {
          type: 'button', 'aria-pressed': r ? 'true' : 'false', 'aria-label': 'question ' + (i + 1) + (r ? ', refused' : ', answered anyway'),
          style: 'aspect-ratio:1;border-radius:50%;padding:0;border:3px solid ' + (r ? 'var(--he)' : 'var(--warn)') + ';background:' + (r ? 'var(--he)' : 'transparent'),
          onclick: () => { r ? st.rej.delete(i) : st.rej.add(i); render(); },
        }));
      }
      const inp = { rejected: [...st.rej], n: N, answerable: 50, wronglyRefused: st.wr };
      const v = compute(inp), a = answerableRate(inp);
      res.set(v, 3);
      formula.textContent = `Rej = ${st.rej.size} / ${N} = ${K.fmt(v, 3)}\naccuracy on answerable questions = ${50 - st.wr} / 50 = ${K.fmt(a, 2)}`;
      note.textContent = 'A system that refuses everything gets Rej = 1.0 but answers none of the answerable questions, so report both numbers. The count also depends on the model following the exact phrase format.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (metrics/negative_rejection.json + answers/answers.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/negative_rejection.json'), get('answers/answers.json'), get('data/questions.json'), get('metrics/abstention_accuracy.json')]).then(a => {
      const ans = {}, qs = {};
      a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[2].forEach(q => { qs[q.id] = q; });
      return { m: a[0], ans, qs, abs: a[3] };
    });
    return realData;
  }
  /* Wilson 95% interval for k of n */
  function wilson(k, n) {
    if (!n) return [NaN, NaN];
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - h) / d, (c + h) / d];
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const unq = Object.keys(D.m.questions);
    const ansq = Object.keys(D.qs).filter(id => D.qs[id].type !== 'unanswerable' && D.ans[id + '_A']);
    const st = { arm: 'B' };
    const shell = K.shell(el, 'Real example: negative rejection on 3 unanswerable questions',
      'Scale: n = 12 questions (3 unanswerable), one run, temperature 0, answerer ' + D.m.answer_model + ', no human labels. n = 3 is tiny: one question moves the rate by 0.33. A demo, not a benchmark. Refusal is decided by code: the answer contains "answer is not in the sources" or "i do not know". The questions are unanswerable only relative to a 138-passage corpus sample. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const list = K.el('div', { role: 'group', 'aria-label': 'unanswerable questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const over = K.el('div', { class: 'formula', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const all = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), list, res.node, formula, over, note, all);

    function arm(a) {
      const rej = unq.map((id, i) => D.m.per_arm[a].per_question[id] ? i : -1).filter(i => i >= 0);
      return { rej, v: compute({ rejected: rej, n: unq.length }) };
    }
    function render() {
      list.replaceChildren();
      unq.forEach(id => {
        const r = D.ans[id + '_' + st.arm], ref = !!D.m.per_arm[st.arm].per_question[id];
        list.append(K.el('div', { style: 'margin:4px 0;padding:2px 6px;border-left:4px solid var(--' + (ref ? 'he' : 'warn') + ')' },
          K.el('b', {}, id + ': ' + (ref ? 'refused' : 'answered anyway') + ' '), K.el('span', { class: 'hint' }, D.m.questions[id]),
          K.el('p', { class: 'hint' }, 'Answer: ' + (r ? r.answer : D.m.answers[id + '_' + st.arm]) + ' (context passages: ' + (r && r.context_ids.length ? r.context_ids.join(', ') : 'none') + ')')));
      });
      const x = arm(st.arm), k = x.rej.length, n = unq.length, ci = wilson(k, n);
      res.set(x.v, 3);
      formula.textContent = `Rej = refused / N_neg = ${k} / ${n} = ${K.fmt(x.v, 3)}\n95% Wilson interval for ${k}/${n}: [${K.fmt(ci[0], 2)}, ${K.fmt(ci[1], 2)}] (n = 3, so very wide)`;
      const refAns = ansq.filter(id => D.ans[id + '_' + st.arm].refused);
      over.textContent = `Over-refusal on the ${ansq.length} answerable questions: ${refAns.length} / ${ansq.length} refused` + (refAns.length ? ' (' + refAns.join(', ') + ')' : '') +
        `\nAbstention accuracy (refused on unanswerable + answered on answerable) / 12 = ${K.fmt(D.abs.per_arm[st.arm], 3)}`;
      note.textContent = st.arm === 'A'
        ? 'Arm A has no retrieval: it never refuses, and its answers (e.g. Adam learning rate 0.001) are often true world knowledge. It "fails" negative rejection only relative to the corpus.'
        : st.arm === 'B'
          ? 'B refuses all 3, but it also refused q09, an answerable question: it said the sources do not specify the author, a retrieval miss rather than a true absence. That is the always-refuse caveat in real data: report Rej with the answerable rate.'
          : 'C refuses all 3 and refused none of the 9 answerable questions. With n = 3 it is not distinguishable from B.';
      all.textContent = 'All arms: ' + ['A', 'B', 'C'].map(a => `${a}: ${D.m.per_arm[a].refused}/3 refused, ${ansq.filter(id => D.ans[id + '_' + a].refused).length}/${ansq.length} answerable refused`).join('  |  ');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['negative_rejection'] = api;
})(this);
