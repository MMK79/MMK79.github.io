/* ColBERT MaxSim (late interaction): edit the token-by-token similarity table, watch row maxima and the sum.
   The table stands in for the encoder (precomputed cosines of unit token vectors); the single-vector cosine is an editable number too. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    docs: [
      { name: 'D1', sim: [[1.0, 0.5, -0.5, -0.5, 0.5], [0.5, 1.0, 0.5, -1.0, -0.5], [-0.5, 0.5, 1.0, -0.5, -1.0]], cos: 0.5 },
      { name: 'D2', sim: [[0.64, 0.5, 0.34], [0.98, 1.0, 0.98], [0.34, 0.5, 0.64]], cos: 1.0 },
    ],
  };
  const Q = ['q1', 'q2', 'q3'];

  /* row-wise maximum of one similarity matrix (rows = query tokens) */
  const rowMax = sim => sim.map(r => Math.max(...r));

  /* PURE: MaxSim score per document = sum over query tokens of the best similarity in that row.
     cosine = the single-vector score given with each document (for contrast). */
  function compute(inp) {
    return {
      maxsim: inp.docs.map(d => rowMax(d.sim).reduce((a, b) => a + b, 0)),
      cosine: inp.docs.map(d => d.cos),
    };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: one token reused': {
      docs: [
        { name: 'D1', sim: [[0.9, 0.0, 0.1], [0.9, 0.1, 0.0], [0.9, 0.0, 0.1]], cos: 0.35 },
        { name: 'D2', sim: [[0.85, 0.1, 0.0], [0.1, 0.85, 0.0], [0.0, 0.1, 0.85]], cos: 0.60 },
      ],
    },
    'single vector wins (it is not alone)': {
      docs: [
        { name: 'D1', sim: [[0.7, 0.1, 0.0], [0.1, 0.7, 0.0], [0.0, 0.1, 0.7]], cos: 0.40 },
        { name: 'D2', sim: [[0.5, 0.4, 0.4], [0.4, 0.5, 0.4], [0.4, 0.4, 0.5]], cos: 0.90 },
      ],
    },
  };

  function mountToy(el) {
    const K = DemoKit;
    let st = clone(defaults);
    const shell = K.shell(el, 'ColBERT MaxSim: best match per query token, then add',
      'Edit any cell of the similarity tables (each cell = cosine of one query token and one document token). The best value in each row counts; the rest is ignored. Compare with one averaged vector per text.');
    const inputs = [];                       // inputs[d][r][c]
    const rowCells = [], maxCells = [], scoreEls = [], cosIn = [], cosRank = [], msRank = [], formulas = [];
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const boxes = [];

    st.docs.forEach((d, di) => {
      inputs[di] = []; rowCells[di] = []; maxCells[di] = [];
      const tbl = K.el('table', { style: 'border-collapse:collapse;width:100%' });
      tbl.append(K.el('tr', {}, K.el('th', {}, ''), ...d.sim[0].map((_, c) => K.el('th', { style: 'padding:2px;font-size:12px' }, 'd' + (c + 1))), K.el('th', { class: 'good', style: 'padding:2px;font-size:11px' }, 'max')));
      d.sim.forEach((row, ri) => {
        inputs[di][ri] = []; rowCells[di][ri] = [];
        const tr = K.el('tr', {}, K.el('td', { style: 'color:var(--ai);font-weight:600' }, Q[ri]));
        row.forEach((v, ci) => {
          const inp = K.el('input', { type: 'number', step: '0.05', min: '-1', max: '1', value: v, 'aria-label': `${d.name} ${Q[ri]} vs d${ci + 1}`, style: 'width:36px;padding:3px 0;font-size:12px;text-align:center' });
          inp.addEventListener('input', () => { const x = parseFloat(inp.value); if (Number.isFinite(x)) { st.docs[di].sim[ri][ci] = Math.max(-1, Math.min(1, x)); render(); } });
          inputs[di][ri][ci] = inp;
          const td = K.el('td', {}, inp); rowCells[di][ri][ci] = td; tr.append(td);
        });
        const m = K.el('td', { class: 'num good' }); maxCells[di][ri] = m; tr.append(m); tbl.append(tr);
      });
      scoreEls[di] = K.el('div', { class: 'result num' });
      msRank[di] = K.el('span', { class: 'num' });
      const ci = K.el('input', { type: 'number', step: '0.05', min: '-1', max: '1', value: d.cos, 'aria-label': `${d.name} single-vector cosine`, style: 'width:70px' });
      ci.addEventListener('input', () => { const x = parseFloat(ci.value); if (Number.isFinite(x)) { st.docs[di].cos = Math.max(-1, Math.min(1, x)); render(); } });
      cosIn[di] = ci; cosRank[di] = K.el('span', { class: 'num' });
      formulas[di] = K.el('div', { class: 'formula' });
      boxes.push(K.el('div', { style: 'flex:1 1 300px;min-width:260px;border-top:1px solid var(--line);padding-top:8px' },
        K.el('b', {}, `${d.name} `, K.el('span', { style: 'color:var(--muted);font-weight:400' }, `(${d.sim[0].length} document tokens)`)),
        tbl, formulas[di], K.el('div', {}, 'MaxSim score ', scoreEls[di], msRank[di]),
        K.el('div', { class: 'row' }, K.el('label', {}, 'single-vector cosine (one averaged vector per text) ', ci), cosRank[di])));
    });

    const presetRow = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(k => {
      const b = K.el('button', {}, k);
      b.addEventListener('click', () => {
        st = clone(PRESETS[k]);
        st.docs.forEach((d, di) => { d.sim.forEach((r, ri) => r.forEach((v, ci) => { inputs[di][ri][ci].value = v; })); cosIn[di].value = d.cos; });
        render();
      });
      return b;
    }));
    shell.append(presetRow, K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:16px' }, ...boxes), verdict);

    const f = x => K.fmt(x, 2);
    const seen = {};
    function setText(node, key, text) { if (node.textContent !== text) { node.textContent = text; if (seen[key]) K.flash(node); seen[key] = 1; } }

    function render() {
      const res = compute(st);
      st.docs.forEach((d, di) => {
        const rm = rowMax(d.sim);
        d.sim.forEach((row, ri) => {
          const best = row.indexOf(rm[ri]);
          row.forEach((_, ci) => { const on = ci === best; rowCells[di][ri][ci].style.background = on ? 'rgba(60,199,180,.18)' : ''; rowCells[di][ri][ci].style.outline = on ? '1px solid var(--he)' : ''; });
          setText(maxCells[di][ri], `m${di}${ri}`, f(rm[ri]));
        });
        setText(scoreEls[di], 's' + di, f(res.maxsim[di]));
        formulas[di].textContent = `S = ${rm.map(f).join(' + ')} = ${f(res.maxsim[di])}   (best case ${Q.length}.00)`;
      });
      const rank = arr => arr.map(v => 1 + arr.filter(w => w > v + 1e-9).length);
      const rm = rank(res.maxsim), rc = rank(res.cosine);
      st.docs.forEach((d, di) => { msRank[di].textContent = `   rank #${rm[di]}`; cosRank[di].textContent = `rank #${rc[di]}`; });
      const best = a => st.docs.map((d, i) => [a[i], d.name]).sort((x, y) => y[0] - x[0])[0][1];
      const bm = best(res.maxsim), bc = best(res.cosine), same = bm === bc;
      verdict.replaceChildren(K.el('span', {}, 'MaxSim puts ', K.el('b', {}, bm), ' first; the single vector puts ', K.el('b', {}, bc), ' first.  '),
        K.el('b', { class: same ? 'good' : 'bad' }, same ? 'same winner' : 'different winners'));
    }
    render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: MaxSim vs one vector, on Wikipedia passages',
      'Real runs: 138 passages from 15 English Wikipedia articles, 24 questions. IMPORTANT: this is a MaxSim STAND-IN built from all-MiniLM-L6-v2 token vectors. It is NOT a trained ColBERT (MiniLM was trained for one pooled sentence vector, not with a late-interaction loss). It shows the mechanism, not ColBERT quality. Scores are stored from the run, not computed in this page.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('data/corpus.json'), get('data/questions.json'), get('runs/metrics_by_method.json'), get('runs/maxsim_minilm.json'), get('runs/dense_cosine.json'), get('data/maxsim_example.json'), fetch(new URL('data/algos_real_local.json', SRC || location.href).href).then(r => r.ok ? r.json() : null).catch(() => null)]).then(([corpus, qs, met, ms, dn, ex, loc]) => {
      const CB = {}; if (loc) loc.colbert.questions.forEach(x => { CB[x.qid] = x; }); let pick = 0, lastQ = '';
      const P = {}; corpus.forEach(p => { P[p.id] = p; });
      const idx = r => { const m = {}; r.questions.forEach(q => { m[q.qid] = q.ranking; }); return m; };
      const A = idx(ms), B = idx(dn);
      const sel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 70)}`)));
      sel.value = 'q01';
      const info = K.el('div', {}), cols = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' }), summ = K.el('div', {}), tokBox = K.el('div', {}), agg = K.el('div', { class: 'hint' });
      const open = new Set();
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: MaxSim here is a stand-in, not a trained ColBERT. 20 answerable questions (24 in total, written by Claude from the corpus text, not a benchmark). The gain over the single vector is within noise at this size (one question moves MRR by about 0.05, no confidence interval). Gold labels cover only the passages judged necessary, so a "miss" can be a fair hit. MiniLM token vectors also match stopword and punctuation tokens (see the table). The per-token table is re-computed locally (best match per query token for the gold passages and the top-1 passages, not the full matrices). Text: Wikipedia contributors, CC BY-SA 4.0.');
      function col(title, color, items, gold, fmt) {
        const rows = items.slice(0, 8).map((x, i) => {
          const isG = gold.includes(x.id), key = title + x.id;
          const btn = K.el('button', { 'aria-expanded': String(open.has(key)), style: 'text-align:left;width:100%;' + (isG ? 'border-color:var(--he)' : '') }, `#${i + 1}  ${x.id}  ${fmt(x)}  ${isG ? 'GOLD  ' : ''}${P[x.id].article}`);
          const txt = K.el('div', { class: 'hint', style: 'display:' + (open.has(key) ? 'block' : 'none') }, P[x.id].text);
          btn.addEventListener('click', () => { open.has(key) ? open.delete(key) : open.add(key); draw(); });
          return K.el('div', { style: 'margin:3px 0' }, btn, txt);
        });
        return K.el('div', { style: 'flex:1 1 320px;min-width:0' }, K.el('div', { style: `color:${color};font-weight:600` }, title), ...rows);
      }
      const rrOf = (list, g) => { const i = list.findIndex(x => g.includes(x.id)); return i < 0 ? 0 : 1 / (i + 1); };
      function draw() {
        const q = qs.find(x => x.id === sel.value), g = q.gold_passages, a = A[q.id], b = B[q.id];
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold: ${g.join(', ') || 'none'}. gold answer: ${q.gold_answer || '(none)'}`));
        cols.replaceChildren(col('MaxSim stand-in (sum of per-token maxima)', 'var(--he)', a, g, x => K.fmt(x.score, 2)), col('single vector (dense cosine)', 'var(--k12)', b, g, x => K.fmt(x.score, 3)));
        const ra = rrOf(a, g), rb = rrOf(b, g);
        summ.replaceChildren(K.el('div', {}, 'reciprocal rank (first gold): MaxSim ', K.el('b', {}, K.fmt(ra, 3)), ', single vector ', K.el('b', { class: rb >= ra ? '' : 'good' }, K.fmt(rb, 3))),
          g.length === 0 ? K.el('div', { class: 'bad' }, 'Unanswerable question: both methods still rank something first.') : '');
        const cb = CB[q.id];
        if (cb) {
          if (lastQ !== q.id) { pick = 0; lastQ = q.id; }
          const pp = cb.passages[Math.min(pick, cb.passages.length - 1)];
          const ps = K.el('select', { 'aria-label': 'passage to inspect' }, ...cb.passages.map((x, i) => K.el('option', { value: String(i) }, `${x.id} (${x.role.replace('_', ' ')}, rank ${x.rank_maxsim})`))); ps.value = String(Math.min(pick, cb.passages.length - 1));
          ps.addEventListener('change', () => { pick = +ps.value; draw(); });
          const sim = pp.matches.map(t => [t.cos]);
          const total = compute({ docs: [{ name: pp.id, sim, cos: 0 }] }).maxsim[0], stored = (a.find(x => x.id === pp.id) || {}).score;
          tokBox.replaceChildren(K.el('b', {}, `Inside the score: ${q.id} against `), ps,
            K.el('div', { class: 'hint' }, `Measured locally on 2026-10-09 from the real MiniLM token vectors (stand-in for ColBERT weights, not trained for late interaction): each query token keeps only its best match in the passage. Stopwords and punctuation also find a partner. ${cb.n_query_tokens} query tokens.`),
            ...pp.matches.map(t => K.el('div', { class: 'row', style: 'gap:8px;margin:1px 0;flex-wrap:nowrap' }, K.el('code', { class: 'num', style: 'width:42%;font-size:12px;overflow-wrap:anywhere' }, `${t.q} -> ${t.d}`), K.el('span', { class: 'num', style: 'width:44px;font-size:12px' }, K.fmt(t.cos, 3)), K.el('div', { style: 'flex:1 1 40px;background:var(--line);height:8px;border-radius:2px' }, K.el('div', { style: `height:8px;border-radius:2px;width:${Math.max(0, 100 * t.cos)}%;background:${t.cos < 0.5 ? 'var(--warn)' : 'var(--he)'}` })))),
            K.el('div', { class: 'formula' }, `S = ${pp.matches.map(t => K.fmt(t.cos, 2)).join(' + ')} = ${K.fmt(total, 3)}  (stored run: ${stored === undefined ? 'outside stored top-20' : K.fmt(stored, 3)}; recomputed here from the vectors: ${K.fmt(pp.maxsim, 3)})`));
        } else if (q.id === ex.qid) {
          const sim = ex.query_tokens.map(t => [t.max_cosine]);
          const total = compute({ docs: [{ name: ex.passage, sim, cos: 0 }] }).maxsim[0];
          tokBox.replaceChildren(K.el('b', {}, `Inside the score: ${ex.qid} against its gold passage ${ex.passage}`),
            ...ex.query_tokens.map(t => K.el('div', { class: 'num', style: 'font-size:13px' }, `${t.token}  ->  ${t.best_passage_token}   ${K.fmt(t.max_cosine, 3)}`)),
            K.el('div', { class: 'formula' }, `S = ${ex.query_tokens.map(t => K.fmt(t.max_cosine, 2)).join(' + ')} = ${K.fmt(total, 3)}`));
        } else tokBox.replaceChildren(K.el('div', { class: 'hint' }, 'Per-token table not loaded (data/algos_real_local.json missing): only the ranking scores are shown. Real example pending for the token level.'));
        const m1 = met.methods.maxsim_minilm, m2 = met.methods.dense_cosine;
        agg.textContent = `Whole set (20 answerable questions), single vector to MaxSim stand-in: MRR ${K.fmt(m2.mrr, 3)} to ${K.fmt(m1.mrr, 3)}, nDCG@5 ${K.fmt(m2['ndcg@5'], 3)} to ${K.fmt(m1['ndcg@5'], 3)}, recall@5 ${K.fmt(m2['recall@5'], 3)} to ${K.fmt(m1['recall@5'], 3)}. Within noise at n = 20.`;
      }
      sel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', { style: 'flex:1 1 100%;min-width:0;max-width:100%' }, 'question ', sel)), info, summ, cols, tokBox, agg, cav); draw();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit;
    const bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['colbert_maxsim'] = api;
})(this);
