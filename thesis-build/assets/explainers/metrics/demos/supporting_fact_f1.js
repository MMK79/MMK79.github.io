/* Supporting-fact F1 demo: toggle which sentences are gold and which the system cited. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    gold: ['A:0', 'B:2'],
    predicted: ['A:0', 'B:1', 'C:0'],
  };
  const UNIVERSE = ['A:0', 'A:1', 'A:2', 'B:0', 'B:1', 'B:2', 'C:0', 'C:1'];

  /* PURE: P = |S^ ∩ S*| / |S^|, R = |S^ ∩ S*| / |S*|, F1 = 2PR/(P+R); returns F1 (0 if no overlap or an empty set) */
  function parts(inp) {
    const g = new Set(inp.gold), p = new Set(inp.predicted);
    const ov = [...p].filter(x => g.has(x)).length;
    const P = p.size ? ov / p.size : 0, R = g.size ? ov / g.size : 0;
    return { ov, P, R, F1: P + R ? 2 * P * R / (P + R) : 0, np: p.size, ng: g.size };
  }
  function compute(inp) { return parts(inp).F1; }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { gold: new Set(defaults.gold), predicted: new Set(defaults.predicted) };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each chip is (document, sentence number). Click chips to set the gold evidence and what the system cited. Same document but a different sentence counts as a miss.');
    const goldRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'gold evidence' });
    const predRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'predicted evidence' });
    const pr = K.resultBox(), rr = K.resultBox(), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = (g, p) => { st.gold = new Set(g); st.predicted = new Set(p); render(); };
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults.gold, defaults.predicted)),
      btn('Break it: right document, wrong sentence', () => set(['A:0', 'B:2'], ['A:1', 'B:1'])),
      btn('Break it: right answer, no evidence cited', () => set(['A:0', 'B:2'], [])),
      btn('Cite everything', () => set(defaults.gold, UNIVERSE)),
      btn('Perfect', () => set(defaults.gold, defaults.gold)));
    const scores = K.el('div', { class: 'row' },
      K.el('span', {}, 'P = ', pr.node), K.el('span', {}, 'R = ', rr.node), K.el('span', {}, 'F1 = ', res.node));
    shell.append(presets,
      K.el('div', { class: 'hint' }, 'Gold evidence S*'), goldRow,
      K.el('div', { class: 'hint' }, 'Predicted evidence S-hat'), predRow,
      scores, formula, note);

    function chips(row, set, color) {
      row.replaceChildren();
      UNIVERSE.forEach(f => {
        const on = set.has(f), other = (set === st.gold ? st.predicted : st.gold).has(f);
        const [d, s] = f.split(':');
        row.append(K.el('button', {
          type: 'button', 'aria-pressed': on ? 'true' : 'false',
          title: on && other ? 'matched' : on ? 'no match' : 'off',
          style: 'min-width:62px;' + (on ? `border-color:${on && other ? 'var(--he)' : color};color:${on && other ? 'var(--he)' : color}` : 'opacity:.4'),
          onclick: () => { on ? set.delete(f) : set.add(f); render(); },
        }, `(${d}, ${s})`));
      });
    }
    function render() {
      chips(goldRow, st.gold, 'var(--both)');
      chips(predRow, st.predicted, 'var(--k12)');
      const inp = { gold: [...st.gold], predicted: [...st.predicted] }, x = parts(inp);
      pr.set(x.P); rr.set(x.R); res.set(x.F1);
      formula.textContent = `overlap = ${x.ov}\nP = ${x.ov} / ${x.np} = ${K.fmt(x.P)}\nR = ${x.ov} / ${x.ng} = ${K.fmt(x.R)}\nF1 = 2 x ${K.fmt(x.P)} x ${K.fmt(x.R)} / (${K.fmt(x.P)} + ${K.fmt(x.R)}) = ${K.fmt(x.F1)}`;
      note.textContent = x.np === 0 ? 'Nothing cited: F1 = 0, whatever the answer was. The score never looks at the answer.'
        : x.ov === 0 ? 'No exact (document, sentence) match: F1 = 0, even if documents agree.'
        : x.P < 1 && x.R === 1 ? 'Every gold sentence found, but extra citations cost precision.'
        : x.F1 === 1 ? 'Perfect: cited exactly the gold sentences.' : '';
      note.className = 'hint' + (x.ov === 0 ? ' bad' : '');
    }
    render();
  }


  /* ---- Real example: pack Presentations/_real-examples (runs/*.json, data/questions.json, answers/answers.json) ---- */
  const METHODS = ['rrf_bm25_dense', 'bm25_lucene', 'dense_cosine', 'rerank_ce_rrf', 'ppr_graph', 'hyde_dense', 'multiquery_rrf', 'tfidf_cosine'];
  let base = null, realQ = null, realA = null; const runs = {};
  function getJson(p) {
    if (!base) base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    return fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
  }
  function loadBase() {
    if (!realQ) realQ = Promise.all([getJson('data/questions.json'), getJson('answers/answers.json')]).then(a => {
      const qs = {}; a[0].forEach(q => { qs[q.id] = q; });
      const ans = {}; a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      return { qs, ans };
    }).catch(e => { realQ = null; throw e; });
    return realQ;
  }
  function loadRun(m) {
    if (!runs[m]) runs[m] = getJson('runs/' + m + '.json').then(d => { const o = {}; d.questions.forEach(q => { o[q.qid] = q.ranking.map(x => x.id); }); return o; }).catch(e => { delete runs[m]; throw e; });
    return runs[m];
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.qs).filter(id => D.qs[id].type === 'bridge' || D.qs[id].type === 'comparison');
    const st = { src: 'run', method: 'rrf_bm25_dense', arm: 'B', k: 5, q: qids[0], run: null };
    const shell = K.shell(el, 'Real example: supporting-fact F1 on real questions',
      'Scale: demo corpus of 138 Wikipedia passages, 12 bridge and comparison questions written by Claude, one run, no human labels. Not a benchmark. The unit here is the PASSAGE (id pNNN), not the sentence as in HotpotQA, so a hit means the right passage, not the right sentence. Gold labels list only the passages needed for the answer, so precision is a lower bound (a useful extra passage counts as a miss).');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const sSel = K.el('select', { 'aria-label': 'predicted set source', style: 'max-width:100%' }, [opt('run', 'Predicted set = top-k retrieved by a method'), opt('cited', 'Predicted set = passages the answer cites')]);
    const mSel = K.el('select', { 'aria-label': 'retrieval method', style: 'max-width:100%' }, METHODS.map(m => opt(m, m)));
    const aSel = K.el('select', { 'aria-label': 'answer arm', style: 'max-width:100%' }, [opt('B', 'arm B: hybrid RRF top-5 answer'), opt('C', 'arm C: dense top-5 + graph answer')]);
    const kIn = K.el('input', { type: 'range', min: '1', max: '10', value: String(st.k), 'aria-label': 'k' });
    const kLab = K.el('span', { class: 'num' });
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' });
    const rowSrc = K.el('div', { class: 'row' }, K.el('label', {}, 'source ', sSel));
    const rowM = K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel), K.el('label', {}, 'k ', kIn, ' ', kLab));
    const rowA = K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel));
    const info = K.el('div', { 'aria-live': 'polite' });
    const goldRow = K.el('div', { class: 'row' }), predRow = K.el('div', { class: 'row' });
    const pr = K.resultBox(), rr = K.resultBox(), res = K.resultBox();
    const scores = K.el('div', { class: 'row' }, K.el('span', {}, 'P = ', pr.node), K.el('span', {}, 'R = ', rr.node), K.el('span', {}, 'F1 = ', res.node));
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const means = K.el('p', { class: 'hint' });
    const note = K.el('p', { class: 'hint' });
    shell.append(rowSrc, rowM, rowA, K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, K.el('div', { class: 'hint' }, 'Gold passages S*'), goldRow, K.el('div', { class: 'hint' }, 'Predicted passages S-hat'), predRow, scores, formula, means, note);

    function ids() { return st.src === 'cited' ? qids.filter(id => D.ans[id + '_' + st.arm]) : qids; }
    function pred(id) {
      if (st.src === 'cited') { const a = D.ans[id + '_' + st.arm]; return a ? [...new Set(a.cited || [])] : null; }
      return st.run && st.run[id] ? st.run[id].slice(0, st.k) : null;
    }
    const q2 = id => parts({ gold: D.qs[id].gold_passages, predicted: pred(id) });
    function fillQ() {
      const cur = ids(); if (!cur.includes(st.q)) st.q = cur[0];
      qSel.replaceChildren(...cur.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question))); qSel.value = st.q;
    }
    function chips(row, list, other, color) {
      row.replaceChildren();
      if (!list.length) row.append(K.el('span', { class: 'hint' }, 'none'));
      list.forEach(f => { const m = other.includes(f), c = m ? 'var(--he)' : color;
        row.append(K.el('span', { class: 'num', style: 'padding:2px 8px;border:1px solid ' + c + ';color:' + c + ';border-radius:6px', title: m ? 'matched' : 'no match' }, f)); });
    }
    function render() {
      rowM.style.display = st.src === 'run' ? '' : 'none'; rowA.style.display = st.src === 'cited' ? '' : 'none';
      kLab.textContent = String(st.k); fillQ();
      const g = D.qs[st.q].gold_passages, p = pred(st.q) || [], x = q2(st.q);
      chips(goldRow, g, p, 'var(--both)'); chips(predRow, p, g, 'var(--k12)');
      info.replaceChildren(K.el('p', { class: 'hint' }, st.src === 'run'
        ? 'Predicted set = the first ' + st.k + ' passage ids of the ' + st.method + ' ranking for this question (runs/' + st.method + '.json).'
        : 'Predicted set = the passage ids the arm ' + st.arm + ' answer cites (answers/answers.json): ' + ((D.ans[st.q + '_' + st.arm] || {}).answer || '')));
      pr.set(x.P); rr.set(x.R); res.set(x.F1);
      formula.textContent = `overlap = ${x.ov}\nP = ${x.ov} / ${x.np} = ${K.fmt(x.P)}\nR = ${x.ov} / ${x.ng} = ${K.fmt(x.R)}\nF1 = 2 x ${K.fmt(x.P)} x ${K.fmt(x.R)} / (${K.fmt(x.P)} + ${K.fmt(x.R)}) = ${K.fmt(x.F1)}`;
      const sel = ids(), f = sel.map(id => q2(id).F1);
      const byT = t => { const xs = sel.filter(id => D.qs[id].type === t).map(id => q2(id).F1); return xs.length ? t + ' ' + K.fmt(meanOf(xs)) + ' (n=' + xs.length + ')' : ''; };
      means.textContent = 'Mean F1 over ' + sel.length + ' questions: ' + K.fmt(meanOf(f)) + '   |   ' + ['bridge', 'comparison'].map(byT).filter(Boolean).join('   ');
      note.textContent = st.src === 'run'
        ? 'Retrieval is not an answer: a method can retrieve the gold passages and the answer still be wrong, and top-k always fills k slots, so precision falls as k grows while recall rises. Move k to see the trade-off.'
        : 'Only the ' + sel.length + ' bridge/comparison questions that have answers are scored. A cited-passage set is what the answer claims as evidence, so an answer that cites nothing (a refusal) scores F1 = 0 whatever its text.';
    }
    sSel.addEventListener('change', () => { st.src = sSel.value; render(); });
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    kIn.addEventListener('input', () => { st.k = +kIn.value; render(); });
    mSel.addEventListener('change', () => { st.method = mSel.value; loadRun(st.method).then(r => { st.run = r; render(); }); });
    loadRun(st.method).then(r => { st.run = r; render(); });
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
      loadBase().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['supporting_fact_f1'] = api;
})(this);
