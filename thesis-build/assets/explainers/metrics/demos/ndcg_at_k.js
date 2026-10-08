/* nDCG@k demo: edit the grade of each ranked item, reorder, change k, switch gain convention. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    grades: [3, 2, 0, 1],   // grade of the item at rank 1..n, in the system's order
    k: 4,
    exp: false,             // false: gain = g ; true: gain = 2^g - 1
  };

  const gain = (g, exp) => (exp ? Math.pow(2, g) - 1 : g);
  const dcg = (gs, k, exp) => gs.slice(0, k).reduce((s, g, i) => s + gain(g, exp) / Math.log2(i + 2), 0);

  /* PURE: nDCG@k = DCG@k / IDCG@k ; ideal = same items sorted by grade, best first. 0 if IDCG = 0. */
  function compute(inp) {
    const k = Math.max(1, Math.min(inp.k, inp.grades.length));
    const ideal = inp.grades.slice().sort((a, b) => b - a);
    const id = dcg(ideal, k, inp.exp);
    return id === 0 ? 0 : dcg(inp.grades, k, inp.exp) / id;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { grades: defaults.grades.slice(), k: defaults.k, exp: defaults.exp };
    const shell = K.shell(el, 'Toy example (break it)',
      'Change a grade (0 = irrelevant, 3 = best), move items with the arrows, change k, switch the gain. Compare your order with the ideal one.');
    const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'ranking' });
    const bars = K.el('div', { class: 'row' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const kS = K.slider('k', 1, defaults.grades.length, 1, st.k, v => { st.k = v; render(); });
    const expB = K.el('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { st.exp = !st.exp; render(); } }, 'gain 2^g - 1');
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.grades = defaults.grades.slice(); st.exp = false; kS.set(st.k = 4); render(); }),
      btn('Break it: best item last', () => { st.grades = st.grades.slice().sort((a, b) => a - b); render(); }),
      btn('Ideal order', () => { st.grades = st.grades.slice().sort((a, b) => b - a); render(); }),
      btn('Unjudged = 0 (grade the best to 0)', () => { const i = st.grades.indexOf(Math.max(...st.grades)); st.grades[i] = 0; render(); }));
    shell.append(K.el('div', { class: 'row' }, kS.node, expB), presets, strip, bars, res.node, formula, note);

    function move(i, d) {
      const j = i + d; if (j < 0 || j >= st.grades.length) return;
      [st.grades[i], st.grades[j]] = [st.grades[j], st.grades[i]]; render();
    }
    function bar(label, items, color) {
      const w = 44, h = 70, svg = K.svg('svg', { width: items.length * (w + 6), height: h + 22, role: 'img', 'aria-label': label });
      const mx = Math.max(1e-9, ...items);
      items.forEach((v, i) => {
        const bh = Math.max(1, (v / mx) * h);
        svg.append(K.svg('rect', { x: i * (w + 6), y: h - bh, width: w, height: bh, fill: color, opacity: .8, rx: 3 }),
          K.svg('text', { x: i * (w + 6) + w / 2, y: h + 14, 'text-anchor': 'middle' }, K.fmt(v, 2)));
      });
      return K.el('div', {}, K.el('p', { class: 'hint' }, label), svg);
    }
    function render() {
      expB.setAttribute('aria-pressed', st.exp ? 'true' : 'false');
      strip.replaceChildren();
      const kk = Math.min(st.k, st.grades.length);
      st.grades.forEach((g, i) => {
        const inK = i < kk;
        const sel = K.el('select', { 'aria-label': `grade at rank ${i + 1}`, onchange: e => { st.grades[i] = Number(e.target.value); render(); } },
          ...[0, 1, 2, 3].map(v => { const o = K.el('option', { value: v }, String(v)); if (v === g) o.selected = true; return o; }));
        strip.append(K.el('span', { style: inK ? '' : 'opacity:.35' }, `rank ${i + 1} grade `, sel,
          K.el('button', { type: 'button', 'aria-label': `move rank ${i + 1} earlier`, onclick: () => move(i, -1) }, '←'),
          K.el('button', { type: 'button', 'aria-label': `move rank ${i + 1} later`, onclick: () => move(i, 1) }, '→')));
      });
      const ideal = st.grades.slice().sort((a, b) => b - a);
      const term = gs => gs.slice(0, kk).map((g, i) => gain(g, st.exp) / Math.log2(i + 2));
      bars.replaceChildren(bar('your order: gain / log2(i+1)', term(st.grades), 'var(--he)'), bar('ideal order', term(ideal), 'var(--k12)'));
      const d = dcg(st.grades, kk, st.exp), id = dcg(ideal, kk, st.exp);
      res.set(compute({ grades: st.grades, k: st.k, exp: st.exp }), 4);
      formula.textContent = `DCG@${kk} = ${K.fmt(d, 4)}   IDCG@${kk} = ${K.fmt(id, 4)}   nDCG@${kk} = ${K.fmt(d, 4)} / ${K.fmt(id, 4)} = ${id ? K.fmt(d / id, 4) : '0 (IDCG is 0)'}`;
      const other = compute({ grades: st.grades, k: st.k, exp: !st.exp });
      note.textContent = `Same order with the other gain convention (${st.exp ? 'linear g' : '2^g - 1'}): ${K.fmt(other, 4)}. State which you used. Items graded 0 add nothing, even if they are relevant but unjudged.`;
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
  /* pure: binary grades (1 = gold) of the stored ranking, then gold passages not in the stored top-20
     appended after it (they count in the ideal list but never in DCG@k, k <= 20). Same compute() as the toy. */
  function binGrades(ranking, gold) {
    const g = new Set(gold);
    return ranking.map(d => (g.has(d) ? 1 : 0)).concat(gold.filter(d => !ranking.includes(d)).map(() => 1));
  }
  const nAt = (ranking, gold, k) => compute({ grades: binGrades(ranking, gold), k, exp: false });

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'bm25_lucene', q: D.questions.find(q => q.type === 'bridge').id, k: 5 };
    const shell = K.shell(el, 'Real example: nDCG@k on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. The pack has BINARY labels only (gold passage = 1, anything else = 0), so graded gains (0-3) are NOT in the data: with g in {0,1} the formula is unchanged, gain g and 2^g-1 coincide, and IDCG is 1/log2(i+1) summed over min(|gold|, k) ranks. Gold covers only the passages judged necessary, so a relevant but unlabelled passage counts as 0 (lower bound).');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => opt(m, m)));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;text-overflow:ellipsis' }, D.questions.map(q => opt(q.id, q.id + ' (' + q.type + '): ' + q.question)));
    mSel.value = st.m; qSel.value = st.q;
    mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const kS = K.slider('k', 1, 20, 1, st.k, v => { st.k = v; render(); });
    const list = K.el('div', { 'aria-live': 'polite' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'overflow-wrap:anywhere' });
    const meanBox = K.el('p', { class: 'hint' });
    const tbl = K.el('div');
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%;min-width:0' }, 'question ', qSel)),
      K.el('div', { class: 'row' }, kS.node), list, res.node, formula, meanBox, tbl);

    const meanFor = (m, k) => { let s = 0; D.questions.forEach(q => { s += nAt(D.runs[m][q.id], q.gold_passages, k); }); return s / D.questions.length; };
    const sv = (m, k) => D.stored.methods[m] && D.stored.methods[m]['ndcg@' + k];
    function render() {
      const q = D.questions.find(x => x.id === st.q), rk = D.runs[st.m][q.id], gold = new Set(q.gold_passages), k = st.k;
      list.replaceChildren(K.el('p', { class: 'hint' }, 'Gold passage(s): ' + q.gold_passages.join(', ') + '. Gold answer: ' + q.gold_answer));
      const dcgT = [];
      rk.slice(0, k).forEach((id, i) => {
        const hit = gold.has(id), t = (hit ? 1 : 0) / Math.log2(i + 2);
        if (hit) dcgT.push(`1/log2(${i + 2}) = ${K.fmt(t, 4)}`);
        list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (hit ? '--he' : '--warn') + ')' },
          K.el('b', {}, (i + 1) + '. ' + id + (hit ? '  g=1, term ' + K.fmt(t, 4) : '  g=0') + ' '),
          K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 110) + (D.text[id] && D.text[id].length > 110 ? '...' : ''))));
      });
      const gr = binGrades(rk, q.gold_passages), kk = Math.min(k, gr.length);
      const dcg = gr.slice(0, kk).reduce((s, g, i) => s + g / Math.log2(i + 2), 0);
      const nIdeal = Math.min(gold.size, kk);
      let idcg = 0; const idT = [];
      for (let i = 0; i < nIdeal; i++) { idcg += 1 / Math.log2(i + 2); idT.push(`1/log2(${i + 2})`); }
      res.set(nAt(rk, q.gold_passages, k), 4);
      formula.textContent = `DCG@${k} = ${dcgT.length ? dcgT.join(' + ') + ' = ' : ''}${K.fmt(dcg, 4)};  IDCG@${k} = ${idT.join(' + ')} = ${K.fmt(idcg, 4)};  nDCG@${k} = ${K.fmt(dcg, 4)} / ${K.fmt(idcg, 4)} = ${idcg ? K.fmt(dcg / idcg, 4) : '0'}`;
      const mean = meanFor(st.m, k), s = sv(st.m, k);
      meanBox.textContent = `Mean over all ${D.questions.length} answerable questions, ${st.m}, k=${k}: ${K.fmt(mean, 4)}` +
        (s !== undefined ? `; pack's stored value ${s}: ${Math.abs(mean - s) < 5e-5 ? 'MATCH' : 'MISMATCH'}.` : '. (The pack stores only k=3, 5, 10; those k are checked against it.)');
      const rows = METHODS.map(m => [m, meanFor(m, k), sv(m, k)]);
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'method'), K.el('th', { align: 'right' }, 'mean nDCG@' + k), K.el('th', { align: 'right' }, 'stored')),
        rows.map(([m, v, s2]) => K.el('tr', { style: m === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, m), K.el('td', { align: 'right', class: 'num' }, K.fmt(v, 4)),
          K.el('td', { align: 'right', class: 'num' }, s2 === undefined ? 'n/a' : String(s2)))));
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ndcg_at_k'] = api;
})(this);
