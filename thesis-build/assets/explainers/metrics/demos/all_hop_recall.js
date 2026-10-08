/* All-hop recall@k demo: a question counts only when EVERY gold passage is inside its top-k. Change k, click a missed gold passage to promote it. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    k: 3,
    questions: [
      { id: 'q1', gold: ['a', 'b'], ranking: ['a', 'b', 'x', 'y', 'z'] },
      { id: 'q2', gold: ['a', 'b'], ranking: ['a', 'x', 'y', 'b', 'z'] },   // b sits at rank 4
      { id: 'q3', gold: ['c', 'd'], ranking: ['c', 'x', 'd', 'y', 'z'] },
      { id: 'q4', gold: ['e'],      ranking: ['e', 'x', 'y', 'z', 'w'] },
    ],
  };

  function inTop(q, k) { return new Set(q.ranking.slice(0, k)); }

  /* PURE: all-hop recall = (1/|Q|) * sum 1[G_q subset of Ret_q,k] */
  function compute(inp) {
    const qs = inp.questions;
    if (!qs.length) return 0;
    const done = qs.filter(q => { const r = inTop(q, inp.k); return q.gold.every(g => r.has(g)); }).length;
    return done / qs.length;
  }
  /* Per-passage recall, to show what the strict score is hiding. */
  function perPassage(inp) {
    let got = 0, need = 0;
    inp.questions.forEach(q => { const r = inTop(q, inp.k); need += q.gold.length; got += q.gold.filter(g => r.has(g)).length; });
    return { got, need, value: need ? got / need : 0 };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const clone = () => defaults.questions.map(q => ({ id: q.id, gold: q.gold.slice(), ranking: q.ranking.slice() }));
    const st = { k: defaults.k, questions: clone() };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each question needs all its gold passages (green) in the top-k. Drag k. Click a gold passage that is outside the top-k to promote it to rank 1.');
    const kS = K.slider('k', 1, 5, 1, st.k, v => { st.k = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (k = 3)', () => { st.questions = clone(); kS.set(st.k = 3); render(); }),
      btn('Break it: k = 1', () => { st.questions = clone(); kS.set(st.k = 1); render(); }));
    const list = K.el('div', { role: 'group', 'aria-label': 'questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const hidden = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, kS.node), presets, list, res.node, formula, note, hidden);

    function render() {
      list.replaceChildren();
      st.questions.forEach((q, qi) => {
        const top = inTop(q, st.k), ok = q.gold.every(g => top.has(g));
        const chips = q.ranking.map((p, i) => {
          const isGold = q.gold.includes(p), inK = i < st.k;
          const col = isGold ? (inK ? 'var(--he)' : 'var(--warn)') : 'var(--faint)';
          return K.el('button', {
            type: 'button',
            title: (isGold ? 'gold' : 'not needed') + (inK ? ', in top-k' : ', outside top-k') + (isGold && !inK ? ' (click to promote to rank 1)' : ''),
            style: 'min-width:46px;border-color:' + col + ';color:' + col + ';' + (inK ? '' : 'opacity:.5;border-style:dashed;'),
            onclick: () => { if (isGold && !inK) { q.ranking.splice(i, 1); q.ranking.unshift(p); render(); } },
          }, `${i + 1}. ${p}`);
        });
        const miss = q.gold.filter(g => !top.has(g));
        list.append(K.el('div', { class: 'row' },
          K.el('b', {}, q.id), K.el('span', { class: 'num' }, 'needs {' + q.gold.join(', ') + '}'),
          ...chips,
          K.el('span', { class: ok ? 'good' : 'bad' }, ok ? 'complete' : 'missing ' + miss.join(', '))));
      });
      const inp = { k: st.k, questions: st.questions };
      const v = compute(inp), pp = perPassage(inp);
      const done = st.questions.filter(q => q.gold.every(g => inTop(q, st.k).has(g))).length;
      res.set(v);
      formula.textContent = `Rec_all@${st.k} = (1/|Q|) * sum 1[G_q in Ret_q,${st.k}] = ${done} / ${st.questions.length} = ${K.fmt(v)}`;
      note.textContent = 'One missing hop scores the whole question 0. A larger k can only raise the score, and it says nothing about answer quality.';
      hidden.textContent = `Per-passage recall on the same data: ${pp.got}/${pp.need} = ${K.fmt(pp.value)}${pp.value > v ? ' (hides the failed hops)' : ''}.`;
    }
    render();
  }

  /* ---- Real example (pack: Presentations/_real-examples) ---- */
  const METHODS = ['bm25_lucene', 'dense_cosine', 'rrf_bm25_dense', 'ppr_graph', 'bm25_original', 'tfidf_cosine', 'dense_dot', 'dense_l2',
    'convex_bm25_dense', 'mmr_dense', 'rerank_ce_bm25', 'rerank_ce_dense', 'rerank_ce_rrf', 'maxsim_minilm'];
  const COMPARE = ['dense_cosine', 'bm25_lucene', 'rrf_bm25_dense', 'ppr_graph'];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json')].concat(METHODS.map(m => get('runs/' + m + '.json')))).then(a => {
      const runs = {};
      METHODS.forEach((m, i) => { runs[m] = {}; a[1 + i].questions.forEach(q => { runs[m][q.qid] = q.ranking.map(x => x.id); }); });
      return { questions: a[0].filter(q => q.gold_passages.length), runs };
    });
    return realData;
  }
  /* pure: same compute() on a stored ranking + gold ids (gold passages are the "hops") */
  const realScore = (D, m, k) => compute({ k, questions: D.questions.map(q => ({ id: q.id, gold: q.gold_passages, ranking: D.runs[m][q.id] })) });
  const realPass = (D, m, k) => perPassage({ k, questions: D.questions.map(q => ({ id: q.id, gold: q.gold_passages, ranking: D.runs[m][q.id] })) });

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'rrf_bm25_dense', k: 5 };
    const shell = K.shell(el, 'Real example: all-hop recall on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. Questions were written by a helper; gold labels cover only the necessary passages. Bridge and comparison questions need 2 gold passages, single-hop need 1. One question = 0.05. Only the top-20 of each run is stored, so k is limited to 1-20. ppr_graph is Personalized PageRank on the LLM-extracted graph (a question with no linked entity has an empty ranking and scores as a miss).');
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => K.el('option', { value: m }, m)));
    mSel.value = st.m;
    mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    const kS = K.slider('k', 1, 20, 1, st.k, v => { st.k = v; render(); });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const hidden = K.el('p', { class: 'hint' });
    const cmp = K.el('div');
    const list = K.el('div', { role: 'group', 'aria-label': 'per-question result' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)), K.el('div', { class: 'row' }, kS.node),
      res.node, formula, hidden, cmp, K.el('p', { class: 'hint' }, 'Per question (gold passage and its rank in the stored top-20):'), list);

    function render() {
      const k = st.k, rk = q => D.runs[st.m][q.id];
      const v = realScore(D, st.m, k), pp = realPass(D, st.m, k);
      const done = Math.round(v * D.questions.length);
      res.set(v);
      formula.textContent = `Rec_all@${k} (${st.m}) = (1/|Q|) * sum 1[G_q in Ret_q,${k}] = ${done} / ${D.questions.length} = ${K.fmt(v)}`;
      hidden.textContent = `Per-passage recall, same run: ${pp.got}/${pp.need} = ${K.fmt(pp.value)}${pp.value > v ? ' (hides ' + (D.questions.length - done) + ' incomplete question' + (D.questions.length - done === 1 ? '' : 's') + ')' : ''}.`;
      const rows = COMPARE.map(m => [m, realScore(D, m, k), realPass(D, m, k).value]);
      cmp.replaceChildren(K.el('table', { style: 'width:100%;border-collapse:collapse' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'at k=' + k), K.el('th', { align: 'right' }, 'all-hop'), K.el('th', { align: 'right' }, 'per-passage')),
        rows.map(([m, a, b]) => K.el('tr', { style: m === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, m),
          K.el('td', { align: 'right', class: 'num' }, K.fmt(a)), K.el('td', { align: 'right', class: 'num' }, K.fmt(b))))));
      list.replaceChildren();
      D.questions.forEach(q => {
        const r = rk(q), top = new Set(r.slice(0, k));
        const miss = q.gold_passages.filter(g => !top.has(g)), ok = !miss.length;
        const where = q.gold_passages.map(g => { const i = r.indexOf(g); return g + ' @' + (i < 0 ? '>20' : i + 1); }).join(', ');
        list.append(K.el('div', { class: 'row', style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (ok ? '--he' : '--warn') + ');flex-wrap:wrap' },
          K.el('b', {}, q.id), K.el('span', { class: 'hint' }, q.type),
          K.el('span', { class: 'num' }, where),
          K.el('span', { class: ok ? 'good' : 'bad' }, ok ? 'complete' : 'missed ' + miss.join(', '))));
      });
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['all_hop_recall'] = api;
})(this);
