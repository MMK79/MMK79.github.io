/* Information integration (RGB): accuracy on questions that need TWO passages, split by whether BOTH gold passages reached the context.
   Real example (default): the 5 two-gold questions of the answer study (3 bridge + 2 comparison), arms B and C, computed live from the real
   answers, contexts and gold passage ids. Toy example (break it): 40 illustrative multi-document questions. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  /* toy: 30 questions had both passages in context (20 right), 10 had only one (2 right) -> 22/40 */
  const defaults = { bothN: 30, bothCorrect: 20, missN: 10, missCorrect: 2 };

  /* PURE: Acc_int = correct / N_int (number). */
  function compute(inp) {
    const n = inp.bothN + inp.missN;
    return n > 0 ? (inp.bothCorrect + inp.missCorrect) / n : 0;
  }
  /* PURE helper: the same accuracy split by retrieval completeness */
  function split(inp) {
    const r = (c, n) => (n > 0 ? c / n : NaN);
    return { both: r(inp.bothCorrect, inp.bothN), missing: r(inp.missCorrect, inp.missN), all: compute(inp) };
  }
  /* PURE: rows [{inCtx: bool, ok: bool}] -> the same input shape */
  function fromRows(rows) {
    const b = rows.filter(r => r.inCtx), m = rows.filter(r => !r.inCtx);
    return { bothN: b.length, bothCorrect: b.filter(r => r.ok).length, missN: m.length, missCorrect: m.filter(r => r.ok).length };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)',
      'Illustrative numbers, not measured: 40 questions that each need two passages. Move the sliders to see how the overall accuracy hides where the misses come from.');
    const sl = {};
    const mk = (key, label, max) => { sl[key] = K.slider(label, 0, max, 1, st[key], v => { st[key] = v; fix(); render(); }); return sl[key].node; };
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = o => { Object.assign(st, o); Object.keys(sl).forEach(k => sl[k].set(st[k])); render(); };
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: same 0.55, other cause', () => set({ bothN: 22, bothCorrect: 22, missN: 18, missCorrect: 0 })));
    shell.append(presets, mk('bothN', 'questions with BOTH passages in context', 40), mk('bothCorrect', '... of which answered correctly', 40),
      mk('missN', 'questions with a passage missing', 40), mk('missCorrect', '... of which answered correctly', 40), res.node, formula, note);
    function fix() { st.bothCorrect = Math.min(st.bothCorrect, st.bothN); st.missCorrect = Math.min(st.missCorrect, st.missN); sl.bothCorrect.set(st.bothCorrect); sl.missCorrect.set(st.missCorrect); }
    function render() {
      const v = compute(st), s = split(st), n = st.bothN + st.missN;
      res.set(v, 3);
      formula.textContent = `Acc_int = (${st.bothCorrect} + ${st.missCorrect}) / ${n} = ${K.fmt(v, 3)}\nboth passages in context: ${st.bothCorrect}/${st.bothN} = ${K.fmt(s.both, 2)}\na passage missing: ${st.missCorrect}/${st.missN} = ${K.fmt(s.missing, 2)}`;
      note.textContent = 'The preset gives the same 0.55 as the worked example, but there every miss is a retrieval miss and the reader is perfect when it has both passages. The single number cannot tell the two stories apart.';
    }
    render();
  }

  /* ---- Real example ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('answers/correctness.json'), get('data/questions.json')]).then(a => {
      const ans = {}, cor = {}, qs = {};
      a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[1].forEach(r => { cor[r.qid + '_' + r.arm] = r; });
      a[2].forEach(q => { qs[q.id] = q; });
      const ids = Object.keys(qs).filter(id => qs[id].gold_passages.length === 2 && ans[id + '_B']);
      return { ans, cor, qs, ids };
    });
    return realData;
  }
  const ruleOk = (text, terms) => terms.every(t => text.toLowerCase().includes(t.toLowerCase()));
  function realRows(D, arm, how) {
    return D.ids.map(id => {
      const a = D.ans[id + '_' + arm], q = D.qs[id], c = D.cor[id + '_' + arm];
      const inCtx = q.gold_passages.map(p => a.context_ids.includes(p));
      const ok = how === 'rule' ? ruleOk(a.answer, q.check_terms) : how === 'half' ? c.score >= 0.5 : c.score === 1;
      return { id, q, a, c, inCtx: inCtx.every(Boolean), perGold: inCtx, ok };
    });
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', how: 'judge' };
    const shell = K.shell(el, 'Real example: 5 questions that need two passages',
      'Scale: n = 5 questions (3 bridge + 2 comparison, each with two gold passages) out of the 12 in the answer study, one run, temperature 0, answerer qwen3.7-plus, correctness judged by deepseek-v4.1-flash against the gold answer (no human labels). One question moves a rate by 0.20: a demo, not a benchmark. Gold labels cover only the passages judged necessary. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const hSel = K.el('select', { 'aria-label': 'how correctness is decided', style: 'max-width:100%;width:100%' },
      [opt('judge', 'correct = judge score 1'), opt('half', 'correct = judge score 0.5 or 1'), opt('rule', 'correct = all RGB check terms in the answer (string rule)')]);
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    hSel.addEventListener('change', () => { st.how = hSel.value; render(); });
    const list = K.el('div', { role: 'group', 'aria-label': 'two-gold questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const both = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row', style: 'flex-wrap:wrap;max-width:100%' }, K.el('label', {}, 'arm ', aSel), K.el('label', { style: 'display:block;max-width:100%' }, hSel)), list, res.node, formula, note, both);
    function render() {
      const rows = realRows(D, st.arm, st.how);
      list.replaceChildren();
      rows.forEach(r => {
        const gold = r.q.gold_passages.map((p, i) => p + (r.perGold[i] ? ' in context' : ' MISSING')).join(', ');
        list.append(K.el('div', { style: 'margin:6px 0;padding:2px 8px;border-left:4px solid var(--' + (r.ok ? 'he' : 'warn') + ')' },
          K.el('b', {}, r.id + ' (' + r.q.type + '): ' + (r.ok ? 'correct' : 'not correct') + '  '), K.el('span', { class: 'hint' }, r.q.question),
          K.el('p', { class: 'hint' }, 'gold passages: ' + gold + ' | judge score ' + r.c.score + ' (' + r.c.reason + ')'),
          K.el('p', { class: 'hint' }, 'Answer: ' + r.a.answer)));
      });
      const inp = fromRows(rows), s = split(inp), v = compute(inp);
      res.set(v, 3);
      formula.textContent = `Acc_int = ${inp.bothCorrect + inp.missCorrect} / ${rows.length} = ${K.fmt(v, 3)}\nboth gold passages in context: ${inp.bothCorrect}/${inp.bothN}` + (inp.bothN ? ` = ${K.fmt(s.both, 2)}` : '') +
        `\none gold passage missing:    ${inp.missCorrect}/${inp.missN}` + (inp.missN ? ` = ${K.fmt(s.missing, 2)}` : '');
      note.textContent = st.how !== 'judge' ? 'The split changes with the correctness rule: score 0.5 counts partial answers (the missing-passage group rises), the string rule is stricter. Switch back to "judge score 1" for the reading below.' : st.arm === 'B'
        ? 'Arm B had both passages for q10 and q20 and got both right; for q09, q16 and q18 one passage never reached the context and none of the three was judged fully correct. Here a miss is a retrieval miss, not a reasoning miss.'
        : 'Arm C had both passages for q10, q16 and q20 and got all three right. For q18 and q09 a passage was missing, yet q18 was still judged correct: the answer was reachable from the other passage, so "missing gold" is not always fatal.';
      both.textContent = 'Both arms: ' + ['B', 'C'].map(a => { const i = fromRows(realRows(D, a, st.how)); return `${a}: both in context ${i.bothCorrect}/${i.bothN}, one missing ${i.missCorrect}/${i.missN}`; }).join('  |  ');
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

  const api = { defaults, compute, split, fromRows, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['information_integration'] = api;
})(this);
