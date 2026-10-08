/* Diversity (win rate) demo (Edge et al. GraphRAG criterion, pairwise LLM-judge win rate).
   Default = Real example: 12 questions x 3 arm pairs x both orders, judged on this criterion by a cheap LLM judge (data/gr_criteria.real.json, built by data/gr_criteria.build.py).
   Toy example (break it): the paper-style tally of verdicts, edit the counts. compute() is pure. */
(function (root) {
  const ID = 'gr_diversity', CRIT = 'diversity';
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  // toy inputs: judge verdict counts for A (GraphRAG) vs B (vector RAG); defaults reproduce the catalogue worked example
  const defaults = { a: 400, b: 200, tie: 25 };
  /* PURE: WR = (A preferred + 1/2 ties) / all verdicts */
  function compute(inp) { return (inp.a + 0.5 * inp.tie) / (inp.a + inp.b + inp.tie); }
  /* PURE: score of the first-named arm x on one question = mean over the two order-swapped verdicts (win 1, tie 0.5, loss 0) */
  function pairScore(orders, x) { return orders.reduce((s, o) => s + (o.winner_arm === x ? 1 : o.winner_arm === 'tie' ? 0.5 : 0), 0) / orders.length; }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const TOY = { worked: [400, 200, 25], brk: [560, 40, 25] };
  const ARM = { A: 'A: no retrieval', B: 'B: hybrid RRF top-5', C: 'C: dense top-5 + graph passages' };
  const CRITS = ['comprehensiveness', 'diversity', 'empowerment', 'directness'];

  function mountToy(el) {
    const K = root.DemoKit;
    const shell = K.shell(el, 'Toy example (break it)', 'Edge et al. style tally: many judge verdicts for system A (GraphRAG) against system B (vector RAG) on one criterion. The counts are illustrative, not measured. Change them and watch the win rate move; ties count half.');
    const sl = {
      a: K.slider('A preferred', 0, 625, 5, defaults.a, render),
      b: K.slider('B preferred', 0, 625, 5, defaults.b, render),
      tie: K.slider('no preference', 0, 625, 5, defaults.tie, render) };
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const bar = K.el('div', { style: 'display:flex;height:22px;border-radius:6px;overflow:hidden;margin:6px 0' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const setv = v => { ['a', 'b', 'tie'].forEach((k, i) => sl[k].set(v[i])); render(); };
    shell.append(K.el('div', { class: 'row' }, btn('Worked example', () => setv(TOY.worked)), btn('Break it: padding with extra angles wins', () => setv(TOY.brk))),
      K.el('div', { class: 'row' }, sl.a.node, sl.b.node, sl.tie.node), bar, res.node, formula, note);
    function render() {
      const inp = { a: sl.a.get(), b: sl.b.get(), tie: sl.tie.get() }, n = inp.a + inp.b + inp.tie;
      bar.replaceChildren();
      [['a', 'var(--he)'], ['tie', 'var(--muted, #9aa3b2)'], ['b', 'var(--warn)']].forEach(([k, c]) => { if (n) bar.append(K.el('div', { style: `flex:${inp[k]};background:${c}` })); });
      if (!n) { res.set(NaN); formula.textContent = 'no verdicts'; return; }
      const wr = compute(inp); res.set(wr);
      formula.textContent = `WR = (${inp.a} + ½·${inp.tie}) / ${n} = ${K.fmt(wr, 3)}`;
      note.textContent = 'Diversity is easy to inflate by listing many angles; a high rate is not a quality guarantee. Edge et al. report 62 to 82% for global approaches against vector RAG.';
    }
    render();
  }

  /* ---- Real example ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const here = new URL('.', SCRIPT_SRC || location.href).href, pack = new URL('../../_real-examples/', here).href;
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u.split('/').pop() + ' ' + r.status); return r.json(); });
    realData = Promise.all([get(here + 'data/gr_criteria.real.json'), get(pack + 'answers/answers.json'), get(pack + 'data/questions.json')]).then(a => {
      const ans = {}, qs = {}, v = {};
      a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; }); a[2].forEach(q => { qs[q.id] = q; });
      a[0].verdicts.forEach(r => { v[r.criterion + '_' + r.qid + '_' + r.pair.join('')] = r; });
      return { g: a[0], ans, qs, v };
    });
    return realData;
  }
  const wordsOf = r => r.answer.split(/\s+/).filter(Boolean).length;

  function mountReal(el, D) {
    const K = root.DemoKit, g = D.g, pairs = Object.keys(g.summary[CRIT]), qids = Object.keys(g.summary[CRIT][pairs[0]].per_question);
    const st = { pair: pairs[0], q: qids[0] };
    const shell = K.shell(el, 'Real example: ' + CRIT + ' judged on real answers',
      'Scale: n = 12 questions, one judge run per order, temperature 0, ' + g.calls + ' judge calls (' + g.judge_model + ', one LLM, no humans, USD ' + g.usd + '). The judge sees the question and both answers, not the sources. Diversity was designed for global sensemaking questions; the 12 questions here are factoid (6 single-hop or comparison, 3 bridge, 3 unanswerable), so there are few real perspectives to compare. Arm C gets about 40% more context than B, so B vs C does not isolate the graph. "First-named arm" = the arm listed first, not a better arm. The pack only had an overall-quality judgement; these four criterion verdicts are a new small run.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const pSel = K.el('select', { 'aria-label': 'pair of arms', style: 'max-width:100%' }, pairs.map(p => opt(p, p.replace('-', ' vs ') + ' (first-named: ' + p[0] + ')')));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    pSel.addEventListener('change', () => { st.pair = pSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const crit = K.el('p', { class: 'hint' }, 'Criterion given to the judge: "' + g.criteria[CRIT] + '"');
    const info = K.el('div', { 'aria-live': 'polite' }), orders = K.el('div', { role: 'group', 'aria-label': 'verdicts in both orders' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const tbl = K.el('div', { role: 'group', 'aria-label': 'all questions for this pair' }), sum = K.el('p', { class: 'hint' });
    const stack = K.el('div', { role: 'group', 'aria-label': 'four criteria for this pair' }), len = K.el('p', { class: 'hint' });
    shell.append(crit, K.el('div', { class: 'row' }, K.el('label', {}, 'pair ', pSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, orders, res.node, formula, K.el('h4', {}, 'All 12 questions, this pair (click a row to open it)'), tbl, sum,
      K.el('h4', {}, 'The four criteria for this pair (win rate of the first-named arm)'), stack, len);
    const ordersOf = (c, q, p) => (D.v[c + '_' + q + '_' + p.replace('-', '')] || {}).orders;
    const consistent = o => o[0].winner_arm === o[1].winner_arm;
    function render() {
      const [x, y] = st.pair.split('-'), o = ordersOf(CRIT, st.q, st.pair), ax = D.ans[st.q + '_' + x], ay = D.ans[st.q + '_' + y];
      info.replaceChildren(K.el('p', { class: 'hint' }, 'Gold answer (not shown to the judge): ' + D.qs[st.q].gold_answer),
        K.el('details', {}, K.el('summary', {}, 'Answer from arm ' + x + ' (first-named, ' + wordsOf(ax) + ' words)'), K.el('p', { class: 'hint' }, ax.answer)),
        K.el('details', {}, K.el('summary', {}, 'Answer from arm ' + y + ' (' + wordsOf(ay) + ' words)'), K.el('p', { class: 'hint' }, ay.answer)));
      orders.replaceChildren();
      o.forEach((r, i) => orders.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (r.winner_arm === 'tie' ? 'muted, #9aa3b2' : 'he') + ')' },
        K.el('b', {}, 'Order ' + (i + 1) + ': ' + r.first + ' shown first. Judge: ' + (r.winner_arm === 'tie' ? 'tie' : 'arm ' + r.winner_arm + ' (slot ' + r.winner_position + ')') + '. '), K.el('span', { class: 'hint' }, r.reason))));
      const ok = consistent(o), sc = pairScore(o, x);
      orders.append(K.el('p', { class: ok ? 'hint' : 'hint bad' }, ok ? 'Both orders agree.' : 'The orders DISAGREE: the verdict flipped with the slot (position bias). Scored as win + loss averaged.'));
      res.set(sc, 3);
      const sv = r => r.winner_arm === x ? 1 : r.winner_arm === 'tie' ? 0.5 : 0;
      formula.textContent = `score(${x}) on ${st.q} = (${sv(o[0])} + ${sv(o[1])}) / 2 = ${K.fmt(sc, 3)}  (win 1, tie 0.5, loss 0)`;
      tbl.replaceChildren(); const sc12 = [];
      qids.forEach(id => {
        const oo = ordersOf(CRIT, id, st.pair), s = pairScore(oo, x), c = consistent(oo); sc12.push(s);
        tbl.append(K.el('button', { type: 'button', 'aria-label': 'open ' + id, style: 'display:block;width:100%;text-align:left;margin:1px 0;padding:2px 6px;box-sizing:border-box;' + (id === st.q ? 'border-color:var(--he);' : '') + (c ? '' : 'border-color:var(--warn);color:var(--warn);'),
          onclick: () => { st.q = id; qSel.value = id; render(); } }, id + ' | ' + oo.map(r => r.winner_arm).join(' | ') + ' | ' + K.fmt(s, 2) + (c ? '' : ' | flip')));
      });
      const wr = mean(sc12), P = g.summary[CRIT][st.pair], flips = sc12.length - qids.filter(id => consistent(ordersOf(CRIT, id, st.pair))).length;
      sum.textContent = `Win rate of ${x} over ${y} on ${CRIT} = (sum of ${sc12.length} scores) / ${sc12.length} = ${K.fmt(wr, 3)} (stored: ${P.win_rate_first_arm}). Order consistency ${K.fmt(1 - flips / sc12.length, 3)} (${flips} question(s) flipped). Judge named the first slot in ${K.fmt(P.first_position_share, 3)} of verdicts (0.5 = no slot preference). 0.5 is parity; n = 12 so one question moves it by 0.083.`;
      stack.replaceChildren();
      CRITS.forEach(c => {
        const w = mean(qids.map(id => pairScore(ordersOf(c, id, st.pair), x)));
        stack.append(K.el('div', { style: 'display:flex;align-items:center;gap:8px;margin:2px 0' + (c === CRIT ? ';font-weight:700' : '') },
          K.el('span', { style: 'width:150px;flex:none' }, c), K.el('div', { style: 'flex:1;background:rgba(127,127,127,.2);height:14px;border-radius:4px;position:relative' },
            K.el('div', { style: `width:${w * 100}%;height:100%;border-radius:4px;background:var(--${c === CRIT ? 'he' : 'muted, #9aa3b2'})` }), K.el('div', { style: 'position:absolute;left:50%;top:-2px;height:18px;border-left:1px dashed currentColor' })), K.el('span', { class: 'num' }, K.fmt(w, 3))));
      });
      const L = P.longer_answer_win_share, nL = P.n_decisive_unequal_length;
      len.textContent = 'Length confound for this pair: ' + (L === null ? 'every answer pair had equal length.' : `when the judge picked a winner and the lengths differed (${nL} verdicts), it picked the LONGER answer in ${K.fmt(L, 3)} of them.`) + ' Diversity moves with length because more words carry more angles: see the judge length-bias demo.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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
  const api = { defaults, compute, mount, pairScore };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})[ID] = api;
})(this);
