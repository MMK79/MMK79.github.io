/* Joint answer + citation correctness: Joint = 1[EM = 1 and C contains every gold doc G]. Real example (default): the 9 answerable
   questions of the real answer study, arms A/B/C, "correct" = judge A score 1.0 (stand-in for exact match), C and G from the real answers.
   Click a cited chip to drop that citation and watch Joint flip. Toy example: the 6-question worked example, editable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const toyRows = [
    { em: 1, gold: ['d1', 'd2'], cited: ['d1', 'd2'] }, { em: 1, gold: ['d1', 'd2'], cited: ['d1'] },
    { em: 1, gold: ['d3'], cited: ['d3', 'd9'] }, { em: 0, gold: ['d4'], cited: ['d4'] },
    { em: 1, gold: ['d5', 'd6'], cited: ['d5', 'd6', 'd8'] }, { em: 0, gold: ['d7'], cited: [] }];
  const defaults = { em: toyRows.map(r => r.em), gold: toyRows.map(r => r.gold), cited: toyRows.map(r => r.cited) };   // Joint = 3/6

  const covers = (c, g) => g.every(x => c.includes(x));
  const jointOne = (em, c, g) => (em === 1 && covers(c, g)) ? 1 : 0;
  /* PURE: mean of Joint_q = 1[EM_q = 1 and C_q contains G_q]. Returns a number. */
  function compute(inp) {
    const n = inp.em.length;
    let s = 0; for (let i = 0; i < n; i++) s += jointOne(inp.em[i], inp.cited[i], inp.gold[i]);
    return n ? s / n : 0;
  }
  /* companions (handout section 2.8): citation precision P (1 when C empty and abstained; here empty C counts 0 unless abstained), recall R, F1, per question, then mean */
  function prf(c, g, abstained) {
    const hit = c.filter(x => g.includes(x)).length;
    const P = c.length ? hit / c.length : (abstained ? 1 : 0), R = g.length ? hit / g.length : 0;
    return { P, R, F1: P + R ? 2 * P * R / (P + R) : 0 };
  }
  function means(inp) {
    const L = inp.em.map((_, i) => prf(inp.cited[i], inp.gold[i], inp.abstained && inp.abstained[i]));
    const m = k => L.length ? L.reduce((a, x) => a + x[k], 0) / L.length : 0;
    return { P: m('P'), R: m('R'), F1: m('F1') };
  }

  /* ---- real data from the pack ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/answer_correctness.json'), get('metrics/citation_recall.json'), get('metrics/citation_precision.json'), get('data/questions.json')])
      .then(a => ({ corr: a[0], rec: a[1], prec: a[2], qs: Object.fromEntries(a[3].map(q => [q.id, q])) }));
    return realData;
  }
  function realInput(D, arm, dropped) {
    const ids = Object.keys(D.rec.gold);
    return {
      ids,
      em: ids.map(q => D.corr.per_question[arm][q] === 1 ? 1 : 0),
      gold: ids.map(q => D.rec.gold[q]),
      cited: ids.map(q => D.rec.cited[arm][q].filter(x => !(dropped.has(arm + q + x)))),
    };
  }

  function chip(K, id, cls, onclick, title) {
    const b = K.el(onclick ? 'button' : 'span', Object.assign({ class: 'chip ' + cls, style: 'margin:2px;padding:1px 7px;border-radius:10px;border:2px solid var(--' + cls + ');font-size:.85em;background:transparent;color:inherit' }, onclick ? { type: 'button', onclick, title } : { title }), id);
    return b;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = toyRows.map(r => ({ em: r.em, cited: new Set(r.cited) }));
    const shell = K.shell(el, 'Toy example (break it)',
      'Six questions with invented gold documents. Toggle EM and click a document chip to cite or un-cite it. Teal = a gold document that is cited, orange = a gold document that is missing, grey = an extra citation. Joint needs EM = 1 and no orange chip.');
    const table = K.el('div', { role: 'group', 'aria-label': 'questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { toyRows.forEach((r, i) => { st[i].em = r.em; st[i].cited = new Set(r.cited); }); render(); }),
      btn('Break it: cite everything', () => { st.forEach((s, i) => { s.cited = new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']); }); render(); }),
      btn('Drop one gold id from q1', () => { st[0].cited.delete('d2'); render(); }));
    shell.append(presets, table, res.node, formula, note);
    const universe = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'];
    function render() {
      table.replaceChildren();
      const inp = { em: st.map(s => s.em), gold: toyRows.map(r => r.gold), cited: st.map(s => [...s.cited]) };
      st.forEach((s, i) => {
        const g = toyRows[i].gold, c = [...s.cited], j = jointOne(s.em, c, g);
        const chips = universe.map(d => {
          const isG = g.includes(d), isC = s.cited.has(d);
          const cls = isG ? (isC ? 'he' : 'warn') : (isC ? 'muted' : null);
          if (!cls && !isC) return null;
          return chip(K, d, cls, () => { isC ? s.cited.delete(d) : s.cited.add(d); render(); }, isC ? 'cited, click to remove' : 'missing gold, click to cite');
        }).filter(Boolean);
        const add = K.el('select', { 'aria-label': 'add a citation to q' + (i + 1), style: 'max-width:90px' }, [K.el('option', { value: '' }, '+ cite')].concat(universe.filter(d => !s.cited.has(d)).map(d => K.el('option', { value: d }, d))));
        add.addEventListener('change', () => { if (add.value) { s.cited.add(add.value); render(); } });
        table.append(K.el('div', { style: 'margin:4px 0;padding:2px 6px;border-left:4px solid var(--' + (j ? 'he' : 'warn') + ')' },
          K.el('b', {}, 'q' + (i + 1) + ' '), K.el('button', { type: 'button', 'aria-pressed': s.em ? 'true' : 'false', onclick: () => { s.em = s.em ? 0 : 1; render(); } }, 'EM = ' + s.em),
          ' gold {' + g.join(', ') + '} cited: ', chips, add, K.el('b', {}, '  Joint = ' + j)));
      });
      const v = compute(inp), m = means(inp);
      res.set(v, 3);
      formula.textContent = 'Joint per question = [' + inp.em.map((e, i) => jointOne(e, inp.cited[i], inp.gold[i])).join(', ') + ']\nJoint = ' + inp.em.map((e, i) => jointOne(e, inp.cited[i], inp.gold[i])).reduce((a, b) => a + b, 0) + ' / ' + inp.em.length + ' = ' + K.fmt(v, 3) +
        '\ncitation precision P = ' + K.fmt(m.P, 3) + '   recall R = ' + K.fmt(m.R, 3) + '   F1 = ' + K.fmt(m.F1, 3);
      note.textContent = 'Cite everything and Joint rises to the EM rate while precision collapses: the superset test rewards over-citing, so always report P next to Joint. Also q4: a wrong answer with perfect citations scores 0.';
    }
    render();
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', dropped: new Set() };
    const shell = K.shell(el, 'Real example: joint answer + citation correctness on 9 answerable questions',
      'Scale: n = 9 answerable questions (12 in the study), one run, temperature 0, answerer ' + D.corr.answer_model + '. Exact match is not used: "correct" means judge ' + D.corr.judge_A + ' scored the answer 1.0 against the gold answer (an LLM stand-in for EM; 0.5 counts as not correct). Gold documents are the passages I judged necessary, so an answer citing another valid passage can be marked a miss. Arm A has no retrieval, so it cites nothing. Arm C gets about 40% more context than B, so B vs C does not isolate the graph. Click a cited id to drop it.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm; aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const reset = K.el('button', { type: 'button', onclick: () => { st.dropped.clear(); render(); } }, 'Restore all citations');
    const list = K.el('div', { role: 'group', 'aria-label': 'questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const all = K.el('div', { class: 'formula', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), reset), list, res.node, formula, all, note);

    function render() {
      const inp = realInput(D, st.arm, st.dropped);
      list.replaceChildren();
      inp.ids.forEach((q, i) => {
        const g = inp.gold[i], full = D.rec.cited[st.arm][q], c = inp.cited[i], j = jointOne(inp.em[i], c, g);
        const score = D.corr.per_question[st.arm][q], pr = D.prec.per_question[st.arm][q];
        const chips = [];
        g.forEach(d => { if (!c.includes(d)) chips.push(chip(K, d, 'warn', null, 'gold document, not cited')); });
        full.forEach(d => {
          const dropped = st.dropped.has(st.arm + q + d), isG = g.includes(d);
          chips.push(chip(K, d + (dropped ? ' (dropped)' : ''), dropped ? 'warn' : (isG ? 'he' : 'muted'), () => { const k = st.arm + q + d; st.dropped.has(k) ? st.dropped.delete(k) : st.dropped.add(k); render(); }, isG ? 'gold document, click to drop' : 'extra citation, click to drop'));
        });
        list.append(K.el('div', { style: 'margin:4px 0;padding:2px 6px;border-left:4px solid var(--' + (j ? 'he' : 'warn') + ')' },
          K.el('b', {}, q + ': Joint = ' + j + ' '), K.el('span', { class: 'hint' }, D.qs[q].question),
          K.el('div', { class: 'hint' }, 'answer correctness = ' + score + (inp.em[i] ? ' (EM stand-in 1)' : ' (stand-in 0)') + '  |  gold: ' + g.join(', ') + '  |  citations supported (precision) = ' + (pr === null || pr === undefined ? 'none cited' : K.fmt(pr, 2)) + '  |  cited: ', chips.length ? chips : 'none')));
      });
      const n = inp.em.length, v = compute(inp), k = Math.round(v * n), m = means(inp);
      res.set(v, 3);
      formula.textContent = `Joint = (EM = 1 and C contains G) / N = ${k} / ${n} = ${K.fmt(v, 3)}\ncitation precision P (gold-id) = ${K.fmt(m.P, 3)}   recall R = ${K.fmt(m.R, 3)}   F1 = ${K.fmt(m.F1, 3)}`;
      const arms = ['A', 'B', 'C'].map(a => {
        const x = realInput(D, a, new Set()), jn = compute(x), corr = x.em.reduce((s, e) => s + e, 0);
        const strict = x.ids.reduce((s, q, i) => s + (jointOne(x.em[i], x.cited[i], x.gold[i]) && D.prec.per_question[a][q] === 1 ? 1 : 0), 0);
        return `${a}: correct ${corr}/${n}   Joint ${Math.round(jn * n)}/${n} = ${K.fmt(jn, 3)}   Joint and every citation supported (judge) ${strict}/${n}`;
      });
      all.textContent = 'All arms (no citations dropped):\n' + arms.join('\n');
      note.textContent = st.arm === 'A'
        ? 'Arm A answers 8 of 9 correctly from the model\'s own knowledge, yet cites nothing, so Joint is 0: a right answer without evidence is not credited. This is the point of the metric.'
        : st.arm === 'B'
          ? 'B: q18 and q16 are partly right and cite only half of the gold set (judge score 0.5); q09 is wrong (0.0) and cites an extra off-topic passage (p005, p006 vs gold p074, p002). Note q09 and q16 also miss a gold document: Joint is stricter than answer correctness alone.'
          : 'C: q06 cites its gold passage but the answer is only half right (0.5); q09 is 0.5 and misses gold p002; q18 is correct but cites only one of its two gold passages (p016 instead of p026). Joint is 6/9 for B and C: with n = 9 the two arms are not distinguishable.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['joint_citation_correct'] = api;
})(this);
