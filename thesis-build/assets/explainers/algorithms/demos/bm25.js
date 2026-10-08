/* BM25: two sliders. k1 = saturation (the count curve flattens), b = length normalisation (long chunks are discounted). */
(function (root) {
  const defaults = {
    k1: 1.2, b: 0.75, N: 1000, avgdl: 100,
    terms: [{ name: 'graph', n: 100 }, { name: 'retrieval', n: 10 }],
    docs: [{ len: 100, f: [3, 1] }, { len: 400, f: [6, 2] }, { len: 50, f: [1, 1] }],
  };
  const NAMES = ['A', 'B', 'C'];

  const idf = (N, n) => Math.log(1 + (N - n + 0.5) / (n + 0.5));
  const lenFactor = (b, L, avgdl) => 1 - b + b * L / avgdl;
  /* tf part: f (k1+1) / (f + k1 * lengthFactor). f = 0 gives 0. */
  const tfPart = (f, L, p) => { const den = f + p.k1 * lenFactor(p.b, L, p.avgdl); return den === 0 ? 0 : f * (p.k1 + 1) / den; };

  /* PURE: one BM25 score per chunk, in input order. */
  function compute(inp) {
    const w = inp.terms.map(t => idf(inp.N, t.n));
    return inp.docs.map(d => inp.terms.reduce((s, t, j) => s + w[j] * tfPart(d.f[j], d.len, inp), 0));
  }
  const rankOf = sc => sc.map(v => 1 + sc.filter(w => w > v + 1e-9).length);

  const PRESETS = {
    'worked example': {},
    'no saturation (k1 = 3)': { k1: 3 },
    'binary match (k1 = 0)': { k1: 0 },
    'ignore length (b = 0)': { b: 0 },
    'break it: 40x stuffing still capped': { k1: 1.2, b: 0.75, docs: [{ len: 100, f: [3, 1] }, { len: 100, f: [40, 0] }, { len: 50, f: [1, 1] }] },
  };

  /* ---- real example: pack at Presentations/_real-examples (fetched relative to this script) ---- */
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const tok = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []);
  const idfOrig = (N, n) => Math.log((N - n + 0.5) / (n + 0.5));
  /* PURE: corpus statistics, built once from the real passage text (same tokeniser as the pack's build/03_runs.py). */
  function realStats(corpus) {
    const docs = corpus.map(p => tok(p.text)), N = docs.length, df = {}, tfs = docs.map(d => { const c = {}; d.forEach(t => c[t] = (c[t] || 0) + 1); return c; });
    tfs.forEach(c => Object.keys(c).forEach(t => df[t] = (df[t] || 0) + 1));
    const dl = docs.map(d => d.length);
    return { ids: corpus.map(p => p.id), N, df, tfs, dl, avgdl: dl.reduce((a, b) => a + b, 0) / N };
  }
  /* PURE: BM25 for one real question over all passages. kind = 'lucene' | 'original'. Returns scores in corpus order. */
  function realScores(stats, question, k1, b, kind) {
    const terms = [...new Set(tok(question))].filter(t => stats.df[t]);
    const idfFn = kind === 'original' ? idfOrig : idf;
    return stats.tfs.map((c, i) => terms.reduce((s, t) => { const f = c[t] || 0; return f ? s + idfFn(stats.N, stats.df[t]) * f * (k1 + 1) / (f + k1 * lenFactor(b, stats.dl[i], stats.avgdl)) : s; }, 0));
  }
  const byQ = r => Object.fromEntries(r.questions.map(x => [x.qid, x.ranking]));
  function loadPack() {
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    return Promise.all([get('data/questions.json'), get('data/corpus.json'), get('runs/bm25_lucene.json'), get('runs/bm25_original.json'), get('runs/metrics_by_method.json')])
      .then(([questions, corpus, lu, orr, metrics]) => ({ questions, corpus, lu: byQ(lu), orr: byQ(orr), metrics, stats: realStats(corpus) }));
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  function mount(el) {
    const K = DemoKit;
    let st = clone(defaults), sel = 1, probeTf = 3;
    const COL = ['var(--he)', 'var(--k12)', 'var(--both)'];
    const shell = K.shell(el, 'BM25: saturation (k1) and length normalisation (b)',
      'Move k1: the count curve flattens sooner or later. Move b: long chunks are discounted more or less. The table re-ranks live. (Rare words count more; BM25 adds the two knobs.)');

    const k1s = K.slider('k1 (saturation)', 0, 3, 0.1, st.k1, v => { st.k1 = v; render(); });
    const bs = K.slider('b (length normalisation)', 0, 1, 0.05, st.b, v => { st.b = v; render(); });
    const ps = K.slider('probe count (chart 2)', 1, 12, 1, probeTf, v => { probeTf = v; render(); });
    const sliders = K.el('div', { class: 'row' }, k1s.node, bs.node, ps.node);
    const presetRow = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(k => {
      const btn = K.el('button', {}, k);
      btn.addEventListener('click', () => { st = Object.assign(clone(defaults), clone(PRESETS[k])); k1s.set(st.k1); bs.set(st.b); render(true); });
      return btn;
    }));

    /* charts */
    const W = 360, H = 250, M = { l: 38, r: 10, t: 14, b: 32 };
    const mkSvg = (aria) => K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:420px;background:var(--panel2);border-radius:8px', role: 'img', 'aria-label': aria });
    const svg1 = mkSvg('Chart 1: term-frequency part against word count, flattening towards the ceiling k1 plus 1');
    const svg2 = mkSvg('Chart 2: term-frequency part against chunk length, for a fixed word count');
    const charts = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' },
      K.el('div', { style: 'flex:1 1 300px' }, K.el('div', { class: 'hint' }, 'chart 1: count of "graph" in a chunk -> its tf part'), svg1),
      K.el('div', { style: 'flex:1 1 300px' }, K.el('div', { class: 'hint' }, 'chart 2: chunk length -> tf part (fixed probe count)'), svg2));

    /* table */
    const tbl = K.el('table', {});
    tbl.append(K.el('tr', {}, ...['chunk', 'length', 'count graph', 'count retrieval', 'length factor', 'BM25 score', 'rank'].map(h => K.el('th', {}, h))));
    const cells = [];
    const numIn = (i, key, j) => {
      const cur = () => (key === 'len' ? st.docs[i].len : st.docs[i].f[j]);
      const inp = K.el('input', { type: 'number', min: key === 'len' ? 1 : 0, step: key === 'len' ? 10 : 1, value: cur(), 'aria-label': `chunk ${NAMES[i]} ${key === 'len' ? 'length' : 'count of ' + st.terms[j].name}`, style: 'width:64px' });
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value); if (!Number.isFinite(v)) return;
        if (key === 'len') st.docs[i].len = Math.max(1, v); else st.docs[i].f[j] = Math.max(0, Math.round(v));
        render();
      });
      return inp;
    };
    NAMES.forEach((nm, i) => {
      const r = K.el('tr', { style: 'cursor:pointer' });
      const c = { lf: K.el('td', { class: 'num' }), sc: K.el('td', { class: 'num' }), rk: K.el('td', { class: 'num' }), inputs: [] };
      const li = numIn(i, 'len'), g = numIn(i, 'f', 0), rr = numIn(i, 'f', 1); c.inputs = [li, g, rr];
      r.append(K.el('td', { style: `color:${COL[i]};font-weight:600` }, nm), K.el('td', {}, li), K.el('td', {}, g), K.el('td', {}, rr), c.lf, c.sc, c.rk);
      r.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { sel = i; render(); } });
      cells.push(c); c.row = r; tbl.append(r);
    });
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const formula = K.el('div', { class: 'formula' });
    const variantNote = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px' },
      'Lucene-style IDF: ln(1 + (N - n + 0.5)/(n + 0.5)). The original paper (Robertson & Zaragoza 2009, Eq. 3.3) has no +1: ln((N - n + 0.5)/(n + 0.5)). Its Eq. 3.15 also has no (k1 + 1) in the numerator; that factor does not change the ranking (Sec. 3.5.1). k1 = 1.2 and b = 0.75 are library defaults, not stated in the paper. Numbers below use the Lucene form.');
    const toyBox = K.el('div', {}), realBox = K.el('div', {});
    const modeRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const mReal = K.el('button', {}, 'Real example'), mToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(mReal, mToy);
    toyBox.append(presetRow, sliders, charts, K.el('div', { style: 'overflow-x:auto' }, tbl), verdict, formula);
    shell.append(variantNote, modeRow, realBox, toyBox);
    function setMode(m) { const real = m === 'real'; realBox.style.display = real ? '' : 'none'; toyBox.style.display = real ? 'none' : ''; mReal.setAttribute('aria-pressed', String(real)); mToy.setAttribute('aria-pressed', String(!real)); mReal.style.outline = real ? '2px solid var(--ai, #F2A93B)' : ''; mToy.style.outline = real ? '' : '2px solid var(--ai, #F2A93B)'; if (real) drawReal(); }
    mReal.addEventListener('click', () => setMode('real')); mToy.addEventListener('click', () => setMode('toy'));
    let drawReal = () => {};
    mountReal(K, realBox, fn => { drawReal = fn; });
    setMode('real');


    function setCell(node, text) { if (node.textContent !== text) { node.textContent = text; if (node.dataset.seen) K.flash(node); node.dataset.seen = 1; } }

    function axes(svg, xmax, ymax, xl, yl, xt, yt) {
      const X = x => M.l + (x / xmax) * (W - M.l - M.r), Y = y => H - M.b - (y / ymax) * (H - M.t - M.b);
      svg.replaceChildren();
      svg.append(K.svg('line', { x1: M.l, y1: H - M.b, x2: W - M.r, y2: H - M.b, stroke: 'var(--faint)' }), K.svg('line', { x1: M.l, y1: M.t, x2: M.l, y2: H - M.b, stroke: 'var(--faint)' }));
      xt.forEach(v => svg.append(K.svg('text', { x: X(v), y: H - M.b + 14, 'text-anchor': 'middle', style: 'font-size:10px;fill:var(--muted)' }, String(v))));
      yt.forEach(v => { svg.append(K.svg('line', { x1: M.l, y1: Y(v), x2: W - M.r, y2: Y(v), stroke: 'var(--line)' })); svg.append(K.svg('text', { x: M.l - 4, y: Y(v) + 3, 'text-anchor': 'end', style: 'font-size:10px;fill:var(--muted)' }, K.fmt(v, 1))); });
      svg.append(K.svg('text', { x: (W + M.l) / 2, y: H - 4, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, xl));
      svg.append(K.svg('text', { x: 4, y: 10, style: 'font-size:11px;fill:var(--muted)' }, yl));
      return { X, Y };
    }
    const path = (pts, color, w, dash) => K.svg('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), fill: 'none', stroke: color, 'stroke-width': w, 'stroke-dasharray': dash || '' });

    function drawCharts() {
      const p = st, top = Math.max(4, p.k1 + 1 + 0.3), xmax = 12;
      // chart 1: one curve per chunk length, dots at each chunk's own count of "graph"
      let { X, Y } = axes(svg1, xmax, top, 'word count f', 'tf part', [0, 3, 6, 9, 12], [0, 1, 2, 3, 4].filter(v => v <= top));
      svg1.append(K.svg('line', { x1: M.l, y1: Y(p.k1 + 1), x2: W - M.r, y2: Y(p.k1 + 1), stroke: 'var(--warn)', 'stroke-dasharray': '5 4' }));
      svg1.append(K.svg('text', { x: W - M.r - 2, y: Y(p.k1 + 1) - 4, 'text-anchor': 'end', style: 'font-size:10px;fill:var(--warn)' }, `ceiling k1 + 1 = ${K.fmt(p.k1 + 1, 2)}`));
      p.docs.forEach((d, i) => {
        const pts = []; for (let f = 0; f <= xmax + 1e-9; f += 0.25) pts.push([X(f), Y(tfPart(f, d.len, p))]);
        svg1.append(path(pts, COL[i], i === sel ? 3 : 1.5, i === sel ? '' : '4 3'));
        const f = Math.min(d.f[0], xmax);
        svg1.append(K.svg('circle', { cx: X(f), cy: Y(tfPart(d.f[0], d.len, p)), r: 5, fill: COL[i] }));
        svg1.append(K.svg('text', { x: X(f) + 7, y: Y(tfPart(d.f[0], d.len, p)) + 14, style: `font-size:11px;font-weight:600;fill:${COL[i]}` }, NAMES[i]));
      });
      // chart 2: length curve for the probe count; b=0 dashed for contrast
      const Lmax = 800;
      ({ X, Y } = axes(svg2, Lmax, Math.max(4, p.k1 + 1 + 0.3), 'chunk length |D| (words)', 'tf part', [0, 200, 400, 600, 800], [0, 1, 2, 3, 4].filter(v => v <= Math.max(4, p.k1 + 1 + 0.3))));
      const curve = bb => { const pts = []; for (let L = 0; L <= Lmax; L += 10) pts.push([X(L), Y(tfPart(probeTf, L, { k1: p.k1, b: bb, avgdl: p.avgdl }))]); return pts; };
      svg2.append(path(curve(0), 'var(--faint)', 1.5, '4 3'), path(curve(p.b), 'var(--ai)', 3));
      svg2.append(K.svg('line', { x1: X(p.avgdl), y1: M.t, x2: X(p.avgdl), y2: H - M.b, stroke: 'var(--faint)', 'stroke-dasharray': '2 3' }));
      svg2.append(K.svg('text', { x: X(p.avgdl) + 3, y: M.t + 8, style: 'font-size:10px;fill:var(--faint)' }, 'avgdl'));
      svg2.append(K.svg('text', { x: W - M.r - 2, y: M.t + 22, 'text-anchor': 'end', style: 'font-size:10px;fill:var(--faint)' }, 'dashed: b = 0 (length ignored)'));
      p.docs.forEach((d, i) => svg2.append(K.svg('circle', { cx: X(Math.min(d.len, Lmax)), cy: Y(tfPart(probeTf, d.len, p)), r: 5, fill: COL[i] }), K.svg('text', { x: X(Math.min(d.len, Lmax)) + 7, y: Y(tfPart(probeTf, d.len, p)) - 6, style: `font-size:11px;font-weight:600;fill:${COL[i]}` }, NAMES[i])));
    }

    function render(sync) {
      const sc = compute(st), rk = rankOf(sc);
      drawCharts();
      st.docs.forEach((d, i) => {
        setCell(cells[i].lf, K.fmt(lenFactor(st.b, d.len, st.avgdl), 3));
        setCell(cells[i].sc, K.fmt(sc[i], 3)); setCell(cells[i].rk, '#' + rk[i]);
        cells[i].rk.classList.toggle('good', rk[i] === 1);
        cells[i].row.style.background = i === sel ? 'var(--panel2)' : '';
        if (sync) [d.len, d.f[0], d.f[1]].forEach((v, j) => { if (document.activeElement !== cells[i].inputs[j]) cells[i].inputs[j].value = v; });
      });
      const order = rk.map((r, i) => [r, NAMES[i]]).sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' > ');
      verdict.replaceChildren(K.el('span', {}, 'ranking: ', K.el('b', {}, order)));
      // formula, selected chunk, live numbers
      const d = st.docs[sel], f = x => K.fmt(x, 3), lf = lenFactor(st.b, d.len, st.avgdl);
      const lines = st.terms.map((t, j) => {
        const w = idf(st.N, t.n), part = tfPart(d.f[j], d.len, st);
        return `${t.name}: Lucene-style IDF ${f(w)} * ${d.f[j]}*(${f(st.k1)}+1) / (${d.f[j]} + ${f(st.k1)}*${f(lf)}) = ${f(w)} * ${f(part)} = ${f(w * part)}`;
      });
      formula.textContent = `chunk ${NAMES[sel]} (click a row to choose)  length factor 1 - ${f(st.b)} + ${f(st.b)}*${d.len}/${st.avgdl} = ${f(lf)}\n` +
        lines.join('\n') + `\nBM25 = ${f(sc[sel])}   (tf part can never exceed k1 + 1 = ${f(st.k1 + 1)})`;
    }
    render(true);
  }


  /* Real-example UI: pick a real question; k1 and b move live over the real tf, passage length and avgdl. */
  function mountReal(K, box, setDraw) {
    box.append(K.el('div', { class: 'hint' }, 'Loading the real example...'));
    if (!PACK) { box.replaceChildren(K.el('div', { class: 'hint' }, 'Real example needs the page to be served (not available in node).')); return; }
    loadPack().then(pack => {
      const stats = pack.stats, ans = pack.questions.filter(q => q.type !== 'unanswerable');
      const st = { qid: ans[0].id, k1: 1.2, b: 0.75, kind: 'lucene', sel: null };
      const qSel = K.el('select', { 'aria-label': 'real question', style: 'max-width:100%' }, ...pack.questions.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question}`)));
      qSel.addEventListener('change', () => { st.qid = qSel.value; st.sel = null; draw(); });
      const k1s = K.slider('k1 (saturation)', 0, 3, 0.1, st.k1, v => { st.k1 = v; draw(); });
      const bs = K.slider('b (length normalisation)', 0, 1, 0.05, st.b, v => { st.b = v; draw(); });
      const kindBtns = [['lucene', 'Lucene-style IDF'], ['original', 'original IDF (no +1)']].map(([k, t]) => { const bt = K.el('button', {}, t); bt.addEventListener('click', () => { st.kind = k; draw(); }); return [k, bt]; });
      const reset = K.el('button', {}, 'reset k1 = 1.2, b = 0.75'); reset.addEventListener('click', () => { st.k1 = 1.2; st.b = 0.75; k1s.set(1.2); bs.set(0.75); draw(); });
      const qline = K.el('div', {}), termTbl = K.el('table', {}), rankTbl = K.el('table', {}), detail = K.el('div', { class: 'formula', style: 'white-space:pre-wrap' }), check = K.el('div', { class: 'hint', 'aria-live': 'polite' });
      const caveat = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px' },
        'Real run, demo scale: 138 Wikipedia passages (15 articles, CC BY-SA 4.0), 24 helper-written questions (20 answerable are scored), no stemming, no stop words. Gold labels list only the passages judged necessary, so other top hits may also be fine (precision is a lower bound). Not an evaluation of the thesis system.');
      const mm = pack.metrics.methods;
      const mline = K.el('div', { class: 'hint' }, `Whole run, 20 answerable questions: bm25_lucene MRR ${mm.bm25_lucene.mrr}, Recall@5 ${mm.bm25_lucene['recall@5']}, nDCG@10 ${mm.bm25_lucene['ndcg@10']}.  bm25_original MRR ${mm.bm25_original.mrr}, Recall@5 ${mm.bm25_original['recall@5']}, nDCG@10 ${mm.bm25_original['ndcg@10']}. With 20 questions one question moves MRR by about 0.05, so small gaps are noise.`);
      box.replaceChildren(caveat, K.el('div', { class: 'row' }, qSel), qline, K.el('div', { class: 'row' }, k1s.node, bs.node, reset), K.el('div', { class: 'row' }, ...kindBtns.map(x => x[1])),
        K.el('div', { class: 'hint' }, 'Query terms: n = passages containing the term, both IDFs side by side'), K.el('div', { style: 'overflow-x:auto' }, termTbl),
        K.el('div', { class: 'hint' }, 'Top 8 by the recomputed score (click a row for the term-by-term sum). Gold passage = marked GOLD. "stored" = rank in the pack run at k1 = 1.2, b = 0.75.'), K.el('div', { style: 'overflow-x:auto' }, rankTbl), detail, check, mline);
      const r2 = (x, d = 3) => K.fmt(x, d);
      function draw() {
        const q = pack.questions.find(x => x.id === st.qid), gold = new Set(q.gold_passages);
        k1s.set(st.k1); bs.set(st.b);
        kindBtns.forEach(([k, bt]) => { bt.setAttribute('aria-pressed', String(k === st.kind)); bt.style.outline = k === st.kind ? '2px solid var(--ai, #F2A93B)' : ''; });
        qline.replaceChildren(K.el('b', {}, q.question), K.el('span', { class: 'hint' }, `  gold: ${q.gold_passages.join(', ') || 'none (unanswerable)'}`));
        const terms = [...new Set(tok(q.question))];
        termTbl.replaceChildren(K.el('tr', {}, ...['term', 'n', 'IDF Lucene', 'IDF original'].map(h => K.el('th', {}, h))), ...terms.map(t => {
          const n = stats.df[t] || 0;
          return K.el('tr', {}, K.el('td', {}, t), K.el('td', { class: 'num' }, String(n)), K.el('td', { class: 'num' }, n ? r2(idf(stats.N, n)) : 'not in corpus'), K.el('td', { class: 'num' }, n ? r2(idfOrig(stats.N, n)) : '-'));
        }));
        const sc = realScores(stats, q.question, st.k1, st.b, st.kind), order = sc.map((v, i) => i).sort((a, b) => sc[b] - sc[a] || a - b);
        const stored = (st.kind === 'original' ? pack.orr : pack.lu)[q.id], sRank = Object.fromEntries(stored.map((x, i) => [x.id, i + 1]));
        if (!st.sel || !stats.ids.includes(st.sel)) st.sel = stats.ids[order[0]];
        rankTbl.replaceChildren(K.el('tr', {}, ...['rank', 'passage', 'score', 'stored rank', ''].map(h => K.el('th', {}, h))), ...order.slice(0, 8).map((i, r) => {
          const id = stats.ids[i], row = K.el('tr', { style: 'cursor:pointer;' + (id === st.sel ? 'background:var(--panel2)' : '') },
            K.el('td', { class: 'num' }, '#' + (r + 1)), K.el('td', {}, id), K.el('td', { class: 'num' }, r2(sc[i])), K.el('td', { class: 'num' }, sRank[id] ? '#' + sRank[id] : '>20'), K.el('td', { class: gold.has(id) ? 'good' : '' }, gold.has(id) ? 'GOLD' : ''));
          row.addEventListener('click', () => { st.sel = id; draw(); }); return row;
        }));
        const i = stats.ids.indexOf(st.sel), p = pack.corpus[i], lf = lenFactor(st.b, stats.dl[i], stats.avgdl);
        const lines = terms.filter(t => stats.df[t]).map(t => { const f = stats.tfs[i][t] || 0, w = st.kind === 'original' ? idfOrig(stats.N, stats.df[t]) : idf(stats.N, stats.df[t]); const part = f ? f * (st.k1 + 1) / (f + st.k1 * lf) : 0; return `${t}: IDF ${r2(w)} * tf part ${r2(part)} (count ${f}) = ${r2(w * part)}`; });
        detail.textContent = `${st.sel} (${p.article}, ${p.section}): length ${stats.dl[i]} words, avgdl ${r2(stats.avgdl, 1)}, length factor 1 - ${r2(st.b, 2)} + ${r2(st.b, 2)}*${stats.dl[i]}/${r2(stats.avgdl, 1)} = ${r2(lf)}\n` + lines.join('\n') + `\nBM25 = ${r2(sc[i])}\n\n"${p.text.slice(0, 260)}${p.text.length > 260 ? '...' : ''}"`;
        const diff = Math.max(...stored.map(x => Math.abs(x.score - sc[stats.ids.indexOf(x.id)])));
        check.textContent = (st.k1 === 1.2 && st.b === 0.75) ? `Check: recomputed in the page from the passage text vs the stored run, largest score difference over the stored top 20 = ${diff.toExponential(1)}.` : 'Sliders moved away from the pack setting (k1 = 1.2, b = 0.75): stored rank column no longer matches. Reset to compare.';
      }
      setDraw(draw); draw();
    }).catch(e => box.replaceChildren(K.el('div', { class: 'bad' }, 'Could not load the real example: ' + e.message + '. Toy example still works.')));
  }

  const api = { defaults, compute, mount, rankOf };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['bm25'] = api;
})(this);
