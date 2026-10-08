/* HyDE: embed hypothetical answers, average them, search with the average. 2-D toy embeddings, all editable. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    q: [0.2, 0.98],
    hyps: [[0.82, 0.57], [0.97, 0.26], [0.77, 0.64]],
    docs: [[0.94, 0.34], [0.34, 0.94], [0.64, 0.77], [-0.5, 0.87]],   // G gold, X lexical twin, Y, Z
    includeQuery: false,
  };
  const NAMES = ['G (gold)', 'X (same words)', 'Y', 'Z (off topic)'];
  const ip = (a, b) => a[0] * b[0] + a[1] * b[1];
  const rankOf = (sc, i) => 1 + sc.filter(s => s > sc[i] + 1e-9).length;

  /* PURE. vhat = mean of hypothetical embeddings (optionally plus the question as one more vote); score = inner product. gold = docs[0]. */
  function compute(inp) {
    const vs = inp.hyps.concat(inp.includeQuery ? [inp.q] : []);
    const vhat = [vs.reduce((s, v) => s + v[0], 0) / vs.length, vs.reduce((s, v) => s + v[1], 0) / vs.length];
    const qs = inp.docs.map(d => ip(inp.q, d)), hs = inp.docs.map(d => ip(vhat, d));
    return { vhat, question_scores: qs, hyde_scores: hs, gold_rank_question: rankOf(qs, 0), gold_rank_hyde: rankOf(hs, 0) };
  }

  /* PURE. Real run: ranks of the gold passages in three stored top-20 lists (null = not in the top 20). */
  function computeReal(inp) {
    const at = (L, g) => { const i = L.indexOf(g); return i < 0 ? null : i + 1; };
    const out = { gold: inp.gold, question: inp.gold.map(g => at(inp.orig, g)), hyde: inp.gold.map(g => at(inp.hyde, g)), hyde_plus_query: inp.gold.map(g => at(inp.plus, g)) };
    const best = a => a.reduce((m, x) => x === null ? m : (m === null || x < m ? x : m), null);
    const cmp = (x, y) => (x === null && y === null) ? 'same' : x === null ? 'better' : y === null ? 'worse' : y < x ? 'better' : y > x ? 'worse' : 'same';
    out.best = { question: best(out.question), hyde: best(out.hyde), hyde_plus_query: best(out.hyde_plus_query) };
    out.verdict_hyde = cmp(out.best.question, out.best.hyde); out.verdict_plus = cmp(out.best.question, out.best.hyde_plus_query);
    return out;
  }

  function mountReal(box) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('data/query_transforms.json'), get('runs/dense_cosine.json'), get('runs/hyde_dense.json'), get('runs/hyde_plus_query.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')]).then(([qt, dc, hd, hq, corpus, mm]) => {
      const items = qt.items.filter(i => i.technique === 'hyde');
      const rk = run => Object.fromEntries(run.questions.map(q => [q.qid, q.ranking]));
      const D = rk(dc), H = rk(hd), P = rk(hq);
      const passages = Array.isArray(corpus) ? corpus : (corpus.passages || []);
      const text = id => { const p = passages.find(x => x.id === id); return p ? p.text : '(text not found)'; };
      body.replaceChildren();
      body.append(K.el('p', { class: 'hint' }, `Real run, demo scale: the language model (${qt.models.llm}, temperature 0, told to answer from its own knowledge) wrote one hypothetical answer per question. Retrieval = dense cosine with ${qt.models.embedder} over 138 Wikipedia passages. Only these 6 questions were run: an illustration, not an evaluation. Read from the pack: the question, the hypothetical text, the stored top-20 rankings and scores. Not recomputed here: the pack stores no embeddings of the hypothetical texts, so the mean v̂ and the cosine arithmetic are not redrawn on real data; the toy example shows that part. The hypothetical text is not checked for truth. Gold passages are marked (they cover only the necessary passages).`));
      const sel = K.el('div', { class: 'row' }), view = K.el('div', {}); body.append(sel, view);
      let cur = 0;
      const pass = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' }, 'click a passage id to read it');
      const col = (title, list, gold, color) => K.el('div', { style: 'flex:1 1 220px;min-width:200px' }, K.el('div', { style: `color:${color};font-weight:600;margin-bottom:4px` }, title),
        ...list.slice(0, 8).map((r, i) => { const g = gold.includes(r.id);
          const b = K.el('button', { class: g ? 'good' : '', style: 'display:flex;justify-content:space-between;width:100%;margin:2px 0;text-align:left', title: 'show the passage text' }, K.el('span', {}, `${i + 1}. ${r.id}${g ? '  (gold)' : ''}`), K.el('span', { class: 'num' }, K.fmt(r.score, 4)));
          b.addEventListener('click', () => { pass.textContent = `${r.id}: ${text(r.id)}`; }); return b; }));
      function draw() {
        const it = items[cur], q = it.qid, gold = it.gold;
        const res = computeReal({ gold, orig: D[q].map(r => r.id), hyde: H[q].map(r => r.id), plus: P[q].map(r => r.id) });
        const f = a => a.map((x, i) => `${gold[i]}: ${x === null ? '>20' : '#' + x}`).join(', ');
        const word = { better: 'HyDE helped', worse: 'HyDE hurt', same: 'no change' };
        const cls = v => v === 'better' ? 'good' : v === 'worse' ? 'bad' : '';
        view.replaceChildren(
          K.el('div', { class: 'row' }, K.el('b', { style: 'color:var(--k12)' }, 'question q: '), it.question),
          K.el('div', { class: 'row', style: 'white-space:pre-wrap' }, K.el('b', { style: 'color:var(--ai)' }, 'hypothetical answer (written by the LLM, may be wrong): '), it.generated),
          K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px' },
            col('search with q', D[q], gold, 'var(--k12)'), col('search with the hypothetical text', H[q], gold, 'var(--ai)'), col('hypothetical text + question', P[q], gold, 'var(--both)')),
          K.el('div', { class: 'row' }, K.el('span', {}, `gold rank (top 20 stored): with q ${f(res.question)} | with hypothetical ${f(res.hyde)} | hypothetical + q ${f(res.hyde_plus_query)} `)),
          K.el('div', { class: 'row', 'aria-live': 'polite' }, K.el('b', { class: cls(res.verdict_hyde) }, 'HyDE alone: ' + word[res.verdict_hyde]), ' ; ', K.el('b', { class: cls(res.verdict_plus) }, 'hypothetical + q: ' + word[res.verdict_plus]), '  (by the best-placed gold passage)'),
          pass);
      }
      const B = mm.subset_baselines.hyde_dense;
      const M = [['dense, question only', B.dense_cosine], ['HyDE (hypothetical text only)', mm.methods.hyde_dense], ['hypothetical text + question', mm.methods.hyde_plus_query], ['BM25+dense RRF, question only', B.rrf_bm25_dense]];
      const mt = K.el('table', {}, K.el('tr', {}, ...['same 6 questions', 'recall@5', 'MRR', 'nDCG@5'].map(h => K.el('th', {}, h))), ...M.map(([n, m]) => K.el('tr', {}, K.el('td', {}, n), ...[m['recall@5'], m.mrr, m['ndcg@5']].map(v => K.el('td', { class: 'num' }, K.fmt(v, 3))))));
      items.forEach((it, i) => { const b = K.el('button', { 'aria-pressed': String(i === 0) }, it.qid + ' (' + it.gold.length + ' gold)');
        b.addEventListener('click', () => { cur = i; [...sel.children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === i))); draw(); }); sel.append(b); });
      draw();
      body.append(mt);
      body.append(K.el('p', { class: 'hint' }, 'Read it: HyDE alone does not clearly beat the plain dense baseline on these 6 questions. Recall@5 is 0.75 vs 0.667 (one gold passage in q09 moves from #8 to #3, while the other slips from #3 to #4), but MRR drops from 0.889 to 0.806 because in q14 the first gold passage slips from #1 to #2. In q02, q06 and q18 the best gold passage stays #1; in q13 and q14 the second gold passage stays low (#20, #15) or outside the top 20 with the question. Adding the question back gives recall@5 0.667 and MRR 0.917: also no clear win. Six questions cannot rank techniques; the value here is the real hypothetical text and what it retrieves, failures included.'));
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: confident wrong answers': { q: [0.85, 0.53], hyps: [[-0.6, 0.8], [-0.45, 0.89], [-0.7, 0.71]], docs: clone(defaults.docs), includeQuery: false },
  };

  function mountToy(el) {
    const K = DemoKit, S = 120, C = 200, LIM = 1.6;               // svg 400x400, origin at centre-left-ish
    let st = clone(defaults), drag = null;
    const shell = el;
    shell.append(K.el('p', { class: 'hint' }, 'Toy example, ours: 2-D invented embeddings (not a real model). Drag any point (or type numbers, or focus a point and use the arrow keys). Blue = the question, orange = fake answers written by the language model, white diamond = their mean, teal = toy chunks. Then press "break it".'));
    const X = x => C + x * S * 0.9 - 40, Y = y => 360 - y * S * 0.9 - 40;
    const svg = K.svg('svg', { viewBox: '0 0 400 400', width: '100%', style: 'max-width:440px;touch-action:none;background:var(--panel2);border-radius:8px', role: 'img', 'aria-label': 'Plane with question, hypothetical answers, their mean and real chunks' });
    const layer = K.svg('g'); svg.append(layer);
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const formula = K.el('div', { class: 'formula' });
    const tbl = K.el('table', {});
    const cb = K.el('button', { 'aria-pressed': 'false' }, 'add the question to the average (N+1 form)');
    cb.addEventListener('click', () => { st.includeQuery = !st.includeQuery; render(); });
    const presetRow = K.el('div', { class: 'row' }, cb, ...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); render(); }); return b; }));
    const pts = () => [{ n: 'question q', v: st.q, c: 'var(--k12)' }]
      .concat(st.hyps.map((v, i) => ({ n: 'fake answer h' + (i + 1), v, c: 'var(--ai)' })))
      .concat(st.docs.map((v, i) => ({ n: 'chunk ' + NAMES[i], v, c: i === 0 ? 'var(--he)' : 'var(--both)' })));
    const inputs = K.el('div', { class: 'row' });
    shell.append(K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start' },
      K.el('div', { style: 'flex:1 1 300px;min-width:260px' }, svg),
      K.el('div', { style: 'flex:2 1 320px;min-width:280px;overflow-x:auto' }, presetRow, tbl, verdict, formula, inputs)));

    const clamp = v => v.map(x => Math.max(-LIM, Math.min(LIM, Math.round(x * 100) / 100)));
    const pt = e => { const r = svg.getBoundingClientRect(), k = 400 / r.width; return [(((e.clientX - r.left) * k) + 40 - C) / (S * 0.9), -(((e.clientY - r.top) * k) + 40 - 360) / (S * 0.9)]; };
    svg.addEventListener('pointermove', e => { if (drag === null) return; pts()[drag].v.splice(0, 2, ...clamp(pt(e))); render(); });
    const up = () => { drag = null; }; svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);

    function numRow() {
      inputs.replaceChildren();
      pts().forEach((p, i) => {
        const mk = k => { const inp = K.el('input', { type: 'number', step: '0.05', value: p.v[k], 'aria-label': p.n + (k ? ' y' : ' x'), style: 'width:62px' });
          inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { p.v[k] = Math.max(-LIM, Math.min(LIM, v)); render(true); } }); return inp; };
        inputs.append(K.el('span', { style: `color:${p.c};white-space:nowrap;margin-right:10px` }, p.n + ' ', mk(0), mk(1)));
      });
    }
    function setCell(n, t) { if (n.textContent !== t) { n.textContent = t; if (n.dataset.s) K.flash(n); n.dataset.s = 1; } }
    const cells = NAMES.map(() => ({}));
    tbl.append(K.el('tr', {}, ...['chunk', 'question score', 'HyDE score'].map(h => K.el('th', {}, h))));
    NAMES.forEach((nm, i) => { const r = K.el('tr', {}); const a = K.el('td', { class: 'num' }), b = K.el('td', { class: 'num' });
      r.append(K.el('td', { style: `color:${i === 0 ? 'var(--he)' : 'var(--both)'};font-weight:600` }, nm), a, b); cells[i] = { a, b }; tbl.append(r); });

    let built = false;
    function render(keepInputs) {
      const res = compute(st), f = x => K.fmt(x, 3);
      cb.setAttribute('aria-pressed', String(st.includeQuery)); cb.classList.toggle('on', st.includeQuery);
      layer.replaceChildren();
      layer.append(K.svg('line', { x1: X(-LIM), y1: Y(0), x2: X(LIM), y2: Y(0), stroke: 'var(--line)' }), K.svg('line', { x1: X(0), y1: Y(-0.2), x2: X(0), y2: Y(LIM), stroke: 'var(--line)' }));
      // link fake answers to the mean
      st.hyps.forEach(h => layer.append(K.svg('line', { x1: X(h[0]), y1: Y(h[1]), x2: X(res.vhat[0]), y2: Y(res.vhat[1]), stroke: 'var(--ai)', 'stroke-dasharray': '3 4', 'stroke-opacity': 0.6 })));
      if (st.includeQuery) layer.append(K.svg('line', { x1: X(st.q[0]), y1: Y(st.q[1]), x2: X(res.vhat[0]), y2: Y(res.vhat[1]), stroke: 'var(--k12)', 'stroke-dasharray': '3 4', 'stroke-opacity': 0.6 }));
      const m = [X(res.vhat[0]), Y(res.vhat[1])];
      layer.append(K.svg('polygon', { points: `${m[0]},${m[1] - 9} ${m[0] + 9},${m[1]} ${m[0]},${m[1] + 9} ${m[0] - 9},${m[1]}`, fill: 'var(--text)', stroke: 'var(--bg)' }));
      layer.append(K.svg('text', { x: m[0] + 12, y: m[1] + 16, style: 'fill:var(--text);font-size:12px;font-weight:600' }, 'mean v̂'));
      pts().forEach((p, i) => {
        const cx = X(p.v[0]), cy = Y(p.v[1]);
        const h = K.svg('circle', { cx, cy, r: 9, fill: p.c, 'fill-opacity': 0.3, stroke: p.c, 'stroke-width': 2, tabindex: 0, role: 'slider', 'aria-label': `${p.n}, x ${p.v[0]} y ${p.v[1]}`, style: 'cursor:grab;outline:none' });
        h.addEventListener('pointerdown', e => { drag = i; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
        h.addEventListener('keydown', e => { const s = e.shiftKey ? 0.2 : 0.05, d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key]; if (!d) return;
          e.preventDefault(); const n = clamp([p.v[0] + d[0], p.v[1] + d[1]]); p.v[0] = n[0]; p.v[1] = n[1]; render(); layer.querySelectorAll('circle')[i].focus(); });
        layer.append(h);
        const short = i === 0 ? 'q' : i <= st.hyps.length ? 'h' + i : ['G', 'X', 'Y', 'Z'][i - 1 - st.hyps.length];
        layer.append(K.svg('text', { x: cx + 12, y: cy - 8, style: `fill:${p.c};font-weight:600;font-size:13px` }, short));
      });
      NAMES.forEach((nm, i) => {
        setCell(cells[i].a, `${f(res.question_scores[i])}  #${rankOf(res.question_scores, i)}`); cells[i].a.classList.toggle('good', rankOf(res.question_scores, i) === 1);
        setCell(cells[i].b, `${f(res.hyde_scores[i])}  #${rankOf(res.hyde_scores, i)}`); cells[i].b.classList.toggle('good', rankOf(res.hyde_scores, i) === 1);
      });
      const gq = res.gold_rank_question, gh = res.gold_rank_hyde, better = gh < gq, worse = gh > gq;
      verdict.replaceChildren(K.el('span', {}, `gold chunk G: rank ${gq} with the question, rank ${gh} with HyDE `),
        K.el('b', { class: better ? 'good' : worse ? 'bad' : '' }, better ? 'HyDE helped' : worse ? 'HyDE hurt: the fake answers are wrong' : 'no change'));
      const n = st.hyps.length + (st.includeQuery ? 1 : 0), sx = st.hyps.map(h => f(h[0])).concat(st.includeQuery ? [f(st.q[0])] : []).join(' + '), sy = st.hyps.map(h => f(h[1])).concat(st.includeQuery ? [f(st.q[1])] : []).join(' + ');
      formula.textContent =
        `v̂ = mean of ${st.includeQuery ? 'the fake answers and the question' : 'the fake answers'}\n` +
        `   x: (${sx}) / ${n} = ${f(res.vhat[0])}\n   y: (${sy}) / ${n} = ${f(res.vhat[1])}\n` +
        `score(G) = v̂ . G = ${f(res.vhat[0])}*${f(st.docs[0][0])} + ${f(res.vhat[1])}*${f(st.docs[0][1])} = ${f(res.hyde_scores[0])}\n` +
        `the language-model step is the editable orange points: nothing checks they are right.`;
      if (!keepInputs) numRow();
    }
    render();
  }

  function mount(el) {
    const K = DemoKit;
    const shell = K.shell(el, 'HyDE: search with a hypothetical answer', 'The language model writes a fake answer; you embed it and search with that instead of the question. A good fake answer sits closer to the real passage than the question does.');
    const real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', { 'aria-pressed': 'true' }, 'Real example'), b2 = K.el('button', { 'aria-pressed': 'false' }, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    shell.append(K.el('div', { class: 'row' }, b1, b2), real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, computeReal, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['hyde'] = api;
})(this);
