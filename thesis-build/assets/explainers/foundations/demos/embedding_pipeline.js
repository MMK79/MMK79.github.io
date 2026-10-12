/* embedding_pipeline: tokenise -> vector -> normalise on 6 REAL sentences (all-MiniLM-L6-v2, 384-d) from the pack, with the
   cosine / dot / L2 matrices, a 2-d PCA picture, truncation of dimensions, and what the pack can show of embedding "levels".
   Serves j2-tokenisation, j2-embedding-pipeline, j2-embedding-levels, j2-multi-vector-late-interaction, j2-matryoshka-dimensions, j2-bi-encoder-retrieval.
   compute() is pure. Pack files are fetched relative to this script. 2-d only: 6 points need no third axis (no three.js). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';

  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const norm = a => Math.sqrt(dot(a, a));
  const unit = a => { const n = norm(a); return a.map(x => x / n); };
  const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));
  const l2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
  /* truncate to the first m dimensions and re-normalise (what Matryoshka serving does; MiniLM was NOT trained for it) */
  const truncate = (a, m) => unit(a.slice(0, m));
  /* PURE: one pair, everything the page shows. */
  function compute(inp) {
    const a = inp.a, b = inp.b, ua = unit(a), ub = unit(b);
    return { norm_a: norm(a), norm_b: norm(b), norm_a_after: norm(ua), cosine: cosine(a, b), cosine_from_unit_dot: dot(ua, ub), dot_raw: dot(a, b), l2_raw: l2(a, b), l2_unit: l2(ua, ub) };
  }
  const matrix = (vs, f) => vs.map(a => vs.map(b => f(a, b)));
  /* ranking of the other items for item i: higher score first (for L2 pass sign -1) */
  function rank(vs, i, f, sign) { return vs.map((v, j) => j).filter(j => j !== i).sort((x, y) => sign * (f(vs[i], vs[y]) - f(vs[i], vs[x]))); }
  /* PURE: ColBERT-style MaxSim from the stored per-query-token best cosines (maxsim_example.json). */
  const maxsimSum = ex => ex.query_tokens.reduce((s, t) => s + t.max_cosine, 0);
  /* crude word/punctuation split: NOT WordPiece (no vocabulary in the pack); real tokens are lower-cased subwords + [CLS]/[SEP] */
  const approxTokens = t => t.toLowerCase().match(/[a-z0-9]+|[^\sa-z0-9]/g) || [];

  const defaults = { a: [3, 4], b: [4, 3] }; // toy 2-d pair: norm 5, cosine 0.96, dot 24, L2 sqrt(2)
  const api = { defaults, compute, matrix, rank, truncate, maxsimSum, approxTokens, dot, norm, unit, cosine, l2 };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['embedding_pipeline'] = api;

  function mount(el) {
    const K = DemoKit, E = K.el;
    const shell = K.shell(el, 'Text to vector: tokenise, pool, normalise', 'Six real sentences from the pack, embedded by all-MiniLM-L6-v2 (384 numbers each). Pick two, switch raw / normalised, and watch cosine, dot and L2 agree or disagree.');
    const box = E('div'); shell.append(box); box.append(E('p', { class: 'hint' }, 'Loading the pack...'));
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    Promise.all([get('data/vectors_sample.json'), get('data/maxsim_example.json'), get('data/chunking_experiment.json'), get('data/corpus.json'), get('data/questions.json')])
      .then(([vec, ms, exp, corpus, qs]) => build(box, vec, ms, exp, corpus, qs)).catch(e => { box.textContent = 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder so ../../_real-examples/ resolves.'; });
  }
  function build(box, vec, ms, exp, corpus, qs) {
    const K = DemoKit, E = K.el, S = vec.sentences, n = S.length;
    document.head.append(E('style', {}, '.demo select{max-width:100%}.demo .tw{overflow-x:auto;max-width:100%}.demo .tw table{font-size:12px}.demo .tw td,.demo .tw th{padding:3px 5px}.demo label{display:block;max-width:100%}.demo .row>label:has(input[type=range]){display:inline-block}'));
    const st = { a: 0, b: 1, view: 'raw', met: 'cosine', m: 384 };
    box.textContent = '';
    box.append(E('p', { class: 'hint bad' }, 'Demo scale: 6 sentences (from 6 different passages), one model (all-MiniLM-L6-v2, 384-d, mean pooling, its final normalisation layer removed so raw norms are visible). Real: vectors, norms, matrices, PCA. Approximate: the token split below. Not in the pack: word vectors, WordPiece ids, token vectors of these sentences, any Matryoshka or long-context model.'));
    const opts = () => S.map((s, i) => E('option', { value: i }, s.id + ' (' + s.passage + '): ' + s.text.slice(0, 48) + '...'));
    const aSel = E('select', {}, opts()), bSel = E('select', {}, opts()); bSel.value = 1;
    aSel.addEventListener('change', () => { st.a = +aSel.value; draw(); }); bSel.addEventListener('change', () => { st.b = +bSel.value; draw(); });
    const tog = (key, vals) => vals.map(([v, lab]) => { const bt = E('button', { 'aria-pressed': String(st[key] === v), onclick: () => { st[key] = v; draw(); } }, lab); return bt; });
    const mS = K.slider('keep first m dimensions', 8, 384, 8, 384, v => { st.m = v; draw(); });
    box.append(E('div', { class: 'row' }, E('label', {}, 'A ', aSel), E('label', {}, 'B ', bSel)));
    const ctrl = E('div', { class: 'row' }); box.append(ctrl);
    box.append(E('div', { class: 'row' }, mS.node, E('button', { onclick: () => { mS.set(st.m = 64); draw(); } }, 'm = 64'), E('button', { onclick: () => { mS.set(st.m = 384); draw(); } }, 'full 384')));
    const out = E('div'); box.append(out);

    function bars(v, k, col) { // first k dims as signed bars
      const w = 560, h = 70, bw = w / k, mx = Math.max(...v.slice(0, k).map(Math.abs));
      const svg = K.svg('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', style: 'max-width:560px;display:block' });
      svg.append(K.svg('line', { x1: 0, x2: w, y1: h / 2, y2: h / 2, stroke: '#68707F', 'stroke-width': .5 }));
      for (let i = 0; i < k; i++) { const hh = Math.abs(v[i]) / mx * (h / 2 - 2); svg.append(K.svg('rect', { x: i * bw + 1, width: bw - 2, y: v[i] >= 0 ? h / 2 - hh : h / 2, height: hh, fill: col })); }
      return svg;
    }
    function draw() {
      ctrl.textContent = '';
      ctrl.append(E('span', { class: 'hint' }, 'vectors:'), ...tog('view', [['raw', 'raw (before normalising)'], ['unit', 'normalised (length 1)']]), E('span', { class: 'hint' }, 'score:'), ...tog('met', [['cosine', 'cosine'], ['dot', 'dot'], ['l2', 'L2 distance']]));
      out.textContent = '';
      const A = S[st.a], B = S[st.b], inp = { a: A.embedding_raw, b: B.embedding_raw }, r = compute(inp);
      // 1 tokens
      const tk = approxTokens(A.text);
      out.append(E('h4', {}, '1. Tokenise'));
      out.append(E('p', { class: 'hint' }, 'A = "' + A.text.slice(0, 160) + (A.text.length > 160 ? '...' : '') + '" (passage ' + A.passage + ')'));
      out.append(E('p', {}, tk.slice(0, 60).map(t => E('code', { style: 'border:1px solid var(--line);border-radius:4px;padding:0 4px;margin:2px;display:inline-block' }, t)), tk.length > 60 ? ' ...' : ''));
      out.append(E('p', { class: 'hint' }, 'APPROXIMATION: this page splits on words and punctuation (' + tk.length + ' pieces), because the pack stores no WordPiece output for these sentences. Real WordPiece cuts rare words into subwords and adds [CLS] and [SEP]. REAL token example: maxsim_example.json lists the query tokens of question q01 (word-level, [CLS]/[SEP] not listed): ' + ms.query_tokens.map(t => t.token).join(' | ') + ' (' + ms.query_tokens.length + ' tokens). The model keeps only 256 tokens: chunks over that in the real experiment: ' + exp.results.map(x => x.target_words + 'w: ' + x.chunks_over_256_tokens).join(', ') + ' (see chunking_compare).'));
      // 2 vector
      out.append(E('h4', {}, '2. Pool into one vector, 3. normalise'));
      out.append(E('div', { class: 'formula' }, 'e = mean over tokens of h_t   (pool: 384 numbers)      e_hat = e / ||e||   (normalise)'));
      out.append(E('p', {}, E('span', { class: 'num' }, 'A raw: first 32 of 384 dimensions')), bars(A.embedding_raw, 32, '#7C9CFF'));
      out.append(E('p', {}, E('span', { class: 'num' }, 'A normalised: same direction, shorter')), bars(A.embedding_normalized, 32, '#3CC7B4'));
      const nrm = (a, d = 4) => K.fmt(norm(a), d);
      out.append(E('div', { class: 'tw' }, E('table', {}, E('tr', {}, ['', 'norm stored', 'norm recomputed (raw)', 'norm after normalising (recomputed)'].map(h => E('th', {}, h))),
        [A, B].map(s => E('tr', {}, E('td', {}, s.id), E('td', { class: 'num' }, s.norm), E('td', { class: 'num' }, nrm(s.embedding_raw)), E('td', { class: 'num' }, nrm(unit(s.embedding_raw), 6)))))));
      out.append(E('p', { class: 'hint' }, 'All 6 raw norms: ' + S.map(s => s.norm).join(', ') + ' (they differ, so dot and L2 on raw vectors depend on length). After normalising every norm is 1, and then cosine = dot product (topic j2-embedding-pipeline).'));
      // 4 matrix
      const vs = S.map(s => st.view === 'raw' ? s.embedding_raw : unit(s.embedding_raw)), f = st.met === 'cosine' ? cosine : st.met === 'dot' ? dot : l2;
      const M = matrix(vs, f), flat = M.flat().filter((x, i) => i % (n + 1)), mn = Math.min(...flat), mx = Math.max(...flat);
      out.append(E('h4', {}, '4. Compare: ' + st.met + ' on ' + (st.view === 'raw' ? 'raw' : 'normalised') + ' vectors'));
      const tb = E('table', {}, E('tr', {}, E('th', {}, ''), S.map(s => E('th', {}, s.id))));
      M.forEach((row, i) => tb.append(E('tr', {}, E('th', {}, S[i].id), row.map((x, j) => { const t = i === j ? 0 : (x - mn) / (mx - mn || 1); const hl = (i === st.a && j === st.b) || (i === st.b && j === st.a); return E('td', { class: 'num', style: 'background:rgba(242,169,59,' + (0.05 + 0.4 * (st.met === 'l2' ? 1 - t : t)) + ');' + (hl ? 'outline:2px solid var(--he)' : '') }, K.fmt(x, 3)); }))));
      out.append(E('div', { class: 'tw' }, tb));
      out.append(E('p', { class: 'hint' }, 'Green outline = your pair A,B. Pack check: stored cosine(s1,s2) = ' + K.fmt(vec.pairwise.cosine[0][1], 4) + '; recomputed here from the raw vectors = ' + K.fmt(cosine(S[0].embedding_raw, S[1].embedding_raw), 4) + '. The diagonal is a vector against itself (cosine 1, dot = norm squared, L2 0).'));
      out.append(E('p', {}, E('b', {}, 'A vs B: '), 'cosine ' + K.fmt(r.cosine, 4) + ' | dot(raw) ' + K.fmt(r.dot_raw, 3) + ' | dot(normalised) ' + K.fmt(r.cosine_from_unit_dot, 4) + ' | L2(raw) ' + K.fmt(r.l2_raw, 3) + ' | L2(normalised) ' + K.fmt(r.l2_unit, 3)));
      // ranking disagreement
      const rk = (f2, sg, v2) => rank(v2, st.a, f2, sg).map(j => S[j].id).join(' > ');
      const raw = S.map(s => s.embedding_raw), un = raw.map(unit);
      out.append(E('p', { class: 'hint' }, 'Who is nearest to ' + A.id + '?  cosine: ' + rk(cosine, 1, raw) + '  |  dot on raw: ' + rk(dot, 1, raw) + '  |  L2 on raw: ' + rk(l2, -1, raw) + '  |  dot on normalised: ' + rk(dot, 1, un) + '. Break it: pick A = s1, s2, s4 or s6 (the anchors whose raw-dot ranking really differs from cosine, checked in check_embedding_pipeline.mjs); long vectors (s4 has norm ' + S[3].norm + ') gain dot score from length, not meaning. Normalised vectors make all three agree (the pack\'s dense_dot run on raw vectors has R@5 0.825 and MRR 0.825 against 0.85 / 0.9167 for cosine).'));
      // PCA
      const W = 560, H = 260, px = S.map(s => s.pca2), xs = px.map(p => p[0]), ys = px.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), sx = v => 30 + (v - x0) / (x1 - x0 || 1) * (W - 60), sy = v => H - 30 - (v - y0) / (y1 - y0 || 1) * (H - 60);
      const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:560px;display:block;background:var(--panel2);border-radius:6px' });
      svg.append(K.svg('line', { x1: sx(S[st.a].pca2[0]), y1: sy(S[st.a].pca2[1]), x2: sx(S[st.b].pca2[0]), y2: sy(S[st.b].pca2[1]), stroke: '#F2A93B', 'stroke-dasharray': '4 3' }));
      S.forEach((s, i) => { svg.append(K.svg('circle', { cx: sx(s.pca2[0]), cy: sy(s.pca2[1]), r: i === st.a || i === st.b ? 8 : 5, fill: i === st.a ? '#7C9CFF' : i === st.b ? '#3CC7B4' : '#98A0B0', style: 'cursor:pointer' })); svg.append(K.svg('text', { x: sx(s.pca2[0]) + 9, y: sy(s.pca2[1]) - 6 }, s.id)); });
      out.append(E('h4', {}, 'Where they sit: PCA, 2 of 384 dimensions'));
      out.append(svg);
      const ev = vec.pca_explained_variance_ratio_first3;
      out.append(E('p', { class: 'hint' }, 'PCA fitted on the 138 passage vectors; the first two axes keep ' + K.fmt((ev[0] + ev[1]) * 100, 1) + '% of the variance (' + ev[0] + ', ' + ev[1] + '; the third adds ' + ev[2] + '). So 2-d distances here are a rough shadow of the real 384-d geometry. A 3-d view is available in the data (pca3) but with 6 points it adds nothing, so this page stays 2-d.'));
      // truncation
      const m = st.m, tv = S.map(s => truncate(s.embedding_raw, m)), c12 = cosine(tv[0], tv[1]), cAB = cosine(tv[st.a], tv[st.b]);
      out.append(E('h4', {}, '5. Fewer dimensions (Matryoshka idea)'));
      out.append(E('p', {}, 'Keep the first ' + m + ' of 384 dimensions and re-normalise: cosine(A,B) = ' + K.fmt(cAB, 4) + ' (full: ' + K.fmt(r.cosine, 4) + '); cosine(s1,s2) = ' + K.fmt(c12, 4) + '. Index of the 138 passages: 138 x ' + m + ' x 4 bytes = ' + (138 * m * 4).toLocaleString('en-US') + ' bytes (' + K.fmt(138 * m * 4 / 1024, 1) + ' KiB) against ' + (138 * 384 * 4).toLocaleString('en-US') + ' at 384 (j2-matryoshka-dimensions, recomputed).'));
      out.append(E('p', { class: 'hint' }, 'WARNING: all-MiniLM-L6-v2 is not a Matryoshka model. Truncating it changes the cosines (see above) and quality is NOT measured here. Only models trained with the nested loss (Kusupati 2022) keep quality at small m. Real example of retrieval quality at fewer dimensions: pending (no Matryoshka model run in the pack).'));
      // levels
      out.append(E('h4', {}, 'Levels: what the pack covers'));
      const pooled = unit(S.reduce((acc, s) => acc.map((x, i) => x + s.embedding_normalized[i]), new Array(S[0].embedding_normalized.length).fill(0)));
      const ssum = maxsimSum(ms), qq = qs.find(q => q.id === ms.qid), pp = corpus.find(p => p.id === ms.passage);
      out.append(E('ul', {},
        E('li', {}, E('b', {}, 'Word level: '), 'not covered (no word2vec or GloVe vectors in the pack). One vector per word type would give "bank" a single meaning (topic j2-embedding-levels).'),
        E('li', {}, E('b', {}, 'Token level (contextual): '), 'only the best cosines of q01 tokens are stored (table below), not the 384-d token vectors.'),
        E('li', {}, E('b', {}, 'Sentence level: '), 'real, the 6 vectors above.'),
        E('li', {}, E('b', {}, 'Document pooling: '), 'TOY. Mean of the 6 normalised sentence vectors, re-normalised, has cosine ' + S.map(s => K.fmt(cosine(pooled, s.embedding_normalized), 2)).join(', ') + ' to s1..s6. The sentences come from 6 different passages, so this is an artificial "document"; no hierarchical-pooling run exists in the pack.'),
        E('li', {}, E('b', {}, 'Multi-vector (late interaction): '), 'real stand-in, table below. Sparse (SPLADE) level: not covered.')));
      const t = E('table', {}, E('tr', {}, ['query token', 'best passage token', 'max cosine'].map(h => E('th', {}, h))), ms.query_tokens.map(x => E('tr', {}, E('td', { class: 'num' }, x.token), E('td', { class: 'num' }, x.best_passage_token), E('td', { class: 'num' }, x.max_cosine))));
      out.append(E('p', { class: 'hint' }, ms.qid + ': "' + qq.question + '" against its gold passage ' + ms.passage + ' (' + pp.words + ' words). MaxSim score S = sum over query tokens of the best cosine = ' + K.fmt(ssum, 3) + ' (stored: ' + ms.maxsim_score + '; ColBERT Eq. 3).'));
      out.append(E('div', { class: 'tw' }, t));
      out.append(E('p', { class: 'hint' }, 'STAND-IN, not a trained ColBERT: MiniLM was trained for one pooled vector, not for late interaction (pack README). Storage idea: a pooled index keeps 384 numbers per passage; late interaction keeps one vector per token, so ' + ms.passage + ' needs at least ' + pp.words + ' x 384 = ' + (pp.words * 384).toLocaleString('en-US') + ' numbers (tokens are at least as many as words) instead of 384. The query-time cost of scoring is not measured.'));
    }
    draw();
  }
  api.mount = mount;
})(this);
