/* Recall@k demo: click boxes to mark relevant, change k, push relevant items down, watch recall rise with junk. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    ranking: ['d3', 'd7', 'd1', 'd9', 'd2', 'd5', 'd8', 'd6', 'd4'],   // system output, rank 1..9
    relevant: ['d1', 'd3', 'd4'],                                       // gold set (d4 sits at rank 9)
    k: 5,
  };

  /* PURE: R@k = |Rel ∩ Ret_k| / |Rel| */
  function compute(inp) {
    const k = Math.max(1, Math.min(inp.k, inp.ranking.length));
    const rel = new Set(inp.relevant);
    if (!rel.size) return 0;
    const hits = inp.ranking.slice(0, k).filter(d => rel.has(d)).length;
    return hits / rel.size;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { ranking: defaults.ranking.slice(), relevant: new Set(defaults.relevant), k: defaults.k };
    const shell = K.shell(el, 'Toy example (break it)',
      'Click a document to flip it between relevant and not. Drag k. Use the arrows to reorder. Notice that a longer list can only raise the score.');
    const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'ranking' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const junk = K.el('p', { class: 'hint' });

    const kS = K.slider('k', 1, defaults.ranking.length, 1, st.k, v => { st.k = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (k = 5)', () => { st.ranking = defaults.ranking.slice(); st.relevant = new Set(defaults.relevant); kS.set(st.k = 5); render(); }),
      btn('Break it: k = 9, mostly junk', () => { st.ranking = defaults.ranking.slice(); st.relevant = new Set(defaults.relevant); kS.set(st.k = 9); render(); }),
      btn('Relevant first', () => {
        const rel = st.ranking.filter(d => st.relevant.has(d)), non = st.ranking.filter(d => !st.relevant.has(d));
        st.ranking = rel.concat(non); render();
      }));
    shell.append(K.el('div', { class: 'row' }, kS.node), presets, strip, res.node, formula, note, junk);

    function move(i, d) {
      const j = i + d; if (j < 0 || j >= st.ranking.length) return;
      [st.ranking[i], st.ranking[j]] = [st.ranking[j], st.ranking[i]]; render();
    }
    function render() {
      strip.replaceChildren();
      st.ranking.forEach((d, i) => {
        const inK = i < st.k, rel = st.relevant.has(d);
        const b = K.el('button', {
          type: 'button', 'aria-pressed': rel ? 'true' : 'false',
          title: (rel ? 'relevant' : 'not relevant') + (inK ? ', counted' : ', outside top-k'),
          style: 'min-width:54px;' + (inK ? '' : 'opacity:.35;') + (rel ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
          onclick: () => { rel ? st.relevant.delete(d) : st.relevant.add(d); render(); },
        }, `${i + 1}. ${d}`);
        strip.append(K.el('span', {}, b,
          K.el('button', { type: 'button', 'aria-label': 'move ' + d + ' earlier', onclick: () => move(i, -1) }, '←'),
          K.el('button', { type: 'button', 'aria-label': 'move ' + d + ' later', onclick: () => move(i, 1) }, '→')));
      });
      const kk = Math.min(st.k, st.ranking.length), nRel = st.relevant.size;
      const hits = st.ranking.slice(0, kk).filter(d => st.relevant.has(d)).length;
      res.set(compute({ ranking: st.ranking, relevant: Array.from(st.relevant), k: st.k }));
      formula.textContent = `R@${kk} = |Rel ∩ Ret_${kk}| / |Rel| = ${hits} / ${nRel} = ${nRel ? K.fmt(hits / nRel) : 'undefined (no relevant documents)'}`;
      const junkN = kk - hits;
      note.textContent = `Denominator is the gold set (${nRel}), not k. ${junkN} of the top ${kk} are not relevant, and the score does not mind.`;
      const never = Array.from(st.relevant).filter(d => !st.ranking.slice(0, kk).includes(d));
      junk.textContent = never.length ? `Relevant but outside the top ${kk} (missed): ${never.join(', ')}.` : 'Every relevant document is inside the top-k: recall is 1.';
      junk.className = 'hint' + (never.length ? ' bad' : ' good');
    }
    render();
  }

  /* ---- Real example: small self-contained loader (pack: Presentations/_real-examples) ---- */
  const METHODS = ['bm25_lucene', 'bm25_original', 'tfidf_cosine', 'dense_cosine', 'dense_dot', 'dense_l2',
    'rrf_bm25_dense', 'convex_bm25_dense', 'mmr_dense', 'rerank_ce_bm25', 'rerank_ce_dense', 'rerank_ce_rrf', 'maxsim_minilm'];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')]
      .concat(METHODS.map(m => get('runs/' + m + '.json')))).then(a => {
      const runs = {};
      METHODS.forEach((m, i) => { runs[m] = {}; a[3 + i].questions.forEach(q => { runs[m][q.qid] = q.ranking.map(x => x.id); }); });
      const corpus = a[1].passages || a[1];
      const text = {}; (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      return { questions: a[0].filter(q => q.gold_passages.length), text, stored: a[2], runs };
    });
    return realData;
  }
  /* pure: R@k from a stored ranking (ids) and gold ids; same formula as compute() */
  const pAt = (ranking, gold, k) => compute({ ranking, relevant: gold, k });

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'bm25_lucene', q: (D.questions.find(x => x.gold_passages.length > 1) || D.questions[0]).id, k: 3 };
    const shell = K.shell(el, 'Real example: Recall@k on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. Gold labels cover only the necessary passages (helper-written questions). Bridge questions have 2 gold passages, so recall can be 0, 0.5 or 1. Only the top-20 of each run is stored, so Recall@k for k > 20 is NOT available here.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => opt(m, m)));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%' }, D.questions.map(q => opt(q.id, q.id + ' (' + q.type + '): ' + q.question)));
    mSel.value = st.m;
    mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const kS = K.slider('k', 1, 20, 1, st.k, v => { st.k = v; render(); });
    const list = K.el('div', { 'aria-live': 'polite' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const meanBox = K.el('p', { class: 'hint' });
    const tbl = K.el('div');
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)), K.el('div', { class: 'row' }, K.el('label', {}, 'question ', qSel)),
      K.el('div', { class: 'row' }, kS.node), list, res.node, formula, meanBox, tbl);

    const meanFor = (m, k) => { let s = 0; D.questions.forEach(q => { s += pAt(D.runs[m][q.id], q.gold_passages, k); }); return s / D.questions.length; };
    function render() {
      const q = D.questions.find(x => x.id === st.q), rk = D.runs[st.m][q.id], gold = new Set(q.gold_passages), k = st.k;
      list.replaceChildren(K.el('p', { class: 'hint' }, 'Gold passage(s): ' + q.gold_passages.join(', ') + '. Gold answer: ' + q.gold_answer));
      rk.slice(0, k).forEach((id, i) => {
        const hit = gold.has(id);
        list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (hit ? '--he' : '--warn') + ')' },
          K.el('b', {}, (i + 1) + '. ' + id + (hit ? '  relevant' : '  not in gold') + ' '),
          K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 110) + (D.text[id] && D.text[id].length > 110 ? '...' : ''))));
      });
      const hits = rk.slice(0, k).filter(d => gold.has(d)).length;
      res.set(pAt(rk, q.gold_passages, k));
      const miss = q.gold_passages.filter(d => !rk.slice(0, k).includes(d));
      formula.textContent = `R@${k} = |Rel ∩ Ret_${k}| / |Rel| = ${hits} / ${gold.size} = ${K.fmt(hits / gold.size)}` + (miss.length ? `   (missed: ${miss.join(', ')}${rk.includes(miss[0]) ? '' : ' - not in stored top-20'})` : '');
      const mean = meanFor(st.m, k), sv = D.stored.methods[st.m] && D.stored.methods[st.m]['recall@' + k];
      meanBox.textContent = `Mean over all ${D.questions.length} answerable questions, ${st.m}, k=${k}: ${K.fmt(mean, 4)}` +
        (sv !== undefined ? `; pack's stored value ${sv}: ${Math.abs(mean - sv) < 5e-5 ? 'MATCH' : 'MISMATCH'}.` : '. (The pack stores only k=3, 5, 10; k=3/5/10 are checked against it. No k above 20: only top-20 is stored.)');
      const rows = METHODS.map(m => { const v = meanFor(m, k), s = D.stored.methods[m] && D.stored.methods[m]['recall@' + k]; return [m, v, s]; });
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'method'), K.el('th', { align: 'right' }, 'mean R@' + k), K.el('th', { align: 'right' }, 'stored')),
        rows.map(([m, v, s]) => K.el('tr', { style: m === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, m), K.el('td', { align: 'right', class: 'num' }, K.fmt(v, 4)),
          K.el('td', { align: 'right', class: 'num' }, s === undefined ? 'n/a' : String(s)))));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All methods at k=' + k + ' (recomputed vs stored)'), t));
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['recall_at_k'] = api;
})(this);
