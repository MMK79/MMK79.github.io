/* Citation recall (ALCE) demo. The NLI model phi is precomputed: each statement has an editable "entailed by its citations" flag.
   Citations are editable chips; a statement with no citations can never count. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    statements: [
      { cites: [1, 2], entailed: 1 },
      { cites: [3], entailed: 0 },
      { cites: [2, 4, 5], entailed: 1 },
    ],
  };

  /* PURE: CitRec = (1/|S|) * sum_s 1[phi(concat(C_s), s) = 1]. Uncited statement -> 0. No statements -> 0. */
  function compute(inp) {
    const S = inp.statements;
    if (!S.length) return 0;
    return S.reduce((a, s) => a + (s.cites.length && s.entailed ? 1 : 0), 0) / S.length;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it)',
      'Each statement cites some passages. The NLI model says whether the joined citations entail it. Click a citation to add or remove it, click the verdict to flip it, and watch the score.');
    const list = K.el('div', { role: 'group', 'aria-label': 'statements' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const loo = K.el('div', { class: 'formula' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const reset = () => { const d = JSON.parse(JSON.stringify(defaults)); st.statements = d.statements; render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', reset),
      btn('Break it: uncited true statement', () => { st.statements.push({ cites: [], entailed: 1 }); render(); }),
      btn('Break it: cite everything', () => { st.statements.forEach(s => { s.cites = [1, 2, 3, 4, 5]; s.entailed = 1; }); render(); }),
      btn('+ statement', () => { if (st.statements.length < 7) { st.statements.push({ cites: [1], entailed: 0 }); render(); } }),
      btn('- statement', () => { if (st.statements.length > 1) { st.statements.pop(); render(); } })),
      list, res.node, formula, loo, note);

    function render() {
      list.replaceChildren();
      st.statements.forEach((s, i) => {
        const counted = s.cites.length && s.entailed;
        const cites = [1, 2, 3, 4, 5].map(c => K.el('button', {
          type: 'button', 'aria-pressed': s.cites.includes(c) ? 'true' : 'false', title: 'toggle citation [' + c + ']',
          onclick: () => { s.cites = s.cites.includes(c) ? s.cites.filter(x => x !== c) : s.cites.concat(c).sort(); render(); },
        }, '[' + c + ']'));
        const v = K.el('button', {
          type: 'button', 'aria-pressed': s.entailed ? 'true' : 'false', title: 'NLI verdict (precomputed)',
          style: 'min-width:130px;' + (counted ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
          onclick: () => { s.entailed = 1 - s.entailed; render(); },
        }, !s.cites.length ? 'no citation: 0' : s.entailed ? 'entailed: 1' : 'not entailed: 0');
        list.append(K.el('div', { class: 'row' }, K.el('span', { class: 'num' }, 's' + (i + 1)), ...cites, v));
      });
      const score = compute(st), n = st.statements.length;
      const hit = st.statements.filter(s => s.cites.length && s.entailed).length;
      res.set(score, 3);
      formula.textContent = `CitRec = (1/|S|) * sum 1[phi(concat(C_s), s) = 1] = ${hit} / ${n} = ${K.fmt(score, 3)}`;
      loo.textContent = 'Leave-one-out (score if this statement is dropped): ' + st.statements.map((_, i) =>
        's' + (i + 1) + ' -> ' + K.fmt(compute({ statements: st.statements.filter((_, j) => j !== i) }), 3)).join('   ');
      note.textContent = 'CitRec only asks whether the cited text entails the statement, not whether the passage is true. An uncited statement counts as unsupported even if correct, and citing every passage raises recall, so read it together with citation precision. The NLI verdicts here are an editable table, not a live model.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/ + metrics/citation_recall.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/citation_recall.json'), get('answers/answers.json'), get('answers/verdicts.json'), get('data/questions.json')]).then(a => {
      const ans = {}, ver = {}, qs = {};
      a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[2].filter(r => r.judge === 'A').forEach(r => { ver[r.qid + '_' + r.arm] = r; });
      a[3].forEach(q => { qs[q.id] = q; });
      return { m: a[0], ans, ver, qs };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  /* Claim rows for one question and arm. A claim counts when judge A calls it supported by a passage the answer actually cited.
     (Derived here from verdicts + the answer's cited ids; the pack's own number is gold-passage recall.) */
  function rowsFor(D, key) {
    const a = D.ans[key], v = D.ver[key];
    if (!a || !v) return [];
    const cited = a.cited || [];
    return v.claims.map((text, i) => {
      const vd = v.verdicts[i] || {};
      const hit = (vd.passages || []).filter(p => cited.includes(p));
      const ok = vd.verdict === 'supported' && hit.length > 0;
      return { text, verdict: vd.verdict, support: vd.passages || [], cites: ok ? hit : cited, entailed: ok ? 1 : 0 };
    });
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.m.per_question.B).filter(id => D.qs[id].type !== 'unanswerable');
    const st = { arm: 'B', q: qids[0] };
    const shell = K.shell(el, 'Real example: Citation recall on real answers and a real judge',
      'Scale: n = 12 questions (9 answerable), one run, temperature 0, LLM judges (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Verdicts are the real judge output, not editable. Arm A has no retrieval, so it cites nothing and every claim counts as unsupported by citations. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'answer claims' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, list, res.node, formula, note, means);

    function render() {
      const key = st.q + '_' + st.arm, a = D.ans[key], rows = rowsFor(D, key);
      const cited = a ? a.cited || [] : [];
      info.replaceChildren(K.el('p', { class: 'hint' }, 'Answer: ' + (a ? a.answer : '')),
        K.el('p', { class: 'hint' }, 'Passages the answer cites: ' + (cited.length ? cited.join(', ') : 'none') + '. Gold passages: ' + D.qs[st.q].gold_passages.join(', ') + '.'));
      list.replaceChildren();
      rows.forEach((r, i) => {
        const ok = !!r.entailed;
        const why = !cited.length ? 'no citation: 0'
          : ok ? 'cited ' + r.cites.join(', ') + ' entail it: 1'
          : r.verdict === 'supported' ? 'judge finds support only in ' + r.support.join(', ') + ', which the answer does not cite: 0'
          : 'cited passages do not entail it (' + (r.verdict || 'no verdict') + '): 0';
        list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (ok ? 'he' : 'warn') + ')' },
          K.el('b', {}, 's' + (i + 1) + '. ' + why + ' '), K.el('span', { class: 'hint' }, r.text)));
      });
      const st2 = rows.map(r => ({ cites: r.cites, entailed: r.entailed }));
      const v = compute({ statements: st2 }), h = st2.filter(s => s.cites.length && s.entailed).length;
      res.set(v, 3);
      formula.textContent = `CitRec = (1/|S|) * sum 1[phi(concat(C_s), s) = 1] = ${h} / ${rows.length} = ${K.fmt(v, 3)}`;
      const gold = D.m.per_question[st.arm][st.q];
      note.textContent = 'Judge A is the entailment step phi. A claim counts only if a passage the answer cites supports it. ' +
        (gold == null ? 'Pack gold-passage recall for this arm: n/a (nothing cited).' : 'Pack gold-passage recall (gold passages cited / gold passages) for comparison: ' + K.fmt(gold, 3) + '.') +
        ' This claim-level score is computed here from the verdicts and the answer\'s cited ids; the pack itself published only the gold-passage version.';
      const row = arm => {
        const xs = qids.map(id => compute({ statements: rowsFor(D, id + '_' + arm).map(r => ({ cites: r.cites, entailed: r.entailed })) }));
        const g = D.m.summary[arm];
        return `${arm}: ${K.fmt(meanOf(xs), 3)} claim-level over n=${xs.length}` + (g ? ` (pack gold-passage recall ${g.mean}, 95% CI [${g.ci95.join(', ')}])` : ' (cites nothing)');
      };
      means.textContent = 'Arm means (9 answerable questions): ' + ['A', 'B', 'C'].map(row).join('  |  ');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['citation_recall'] = api;
})(this);
