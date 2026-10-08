/* Combining graph and vector evidence. HybridRAG (arXiv:2408.04948, Sec. 4.4) appends the vector context first, then the graph context: ordered concatenation, no mixed score.
   The weighted sum with min-max normalisation is OUR construction (after convex fusion), shown in the toy.
   Real example (default): stored run on 138 Wikipedia passages: dense top-5, PPR graph top-5, and their concatenation, 24 questions.
   Toy example (break it): 5 invented chunks, weighted sum, normalise on/off.
   2D chosen (not three.js): the real unit is 5 + 5 ranked passages, and two columns joined by lines show the "same passage seen from both sides" better than a 3D scene. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = { vec: [0.82, 0.78, 0.55, 0.50, 0.30], hops: [3, 2, 1, 0, 1], lambda: 0.6, normalise: true, gscale: 1 };
  const r4 = x => Math.round(x * 1e4) / 1e4;
  const mm = a => { const lo = Math.min(...a), hi = Math.max(...a); return a.map(x => hi === lo ? 0 : (x - lo) / (hi - lo)); };

  /* PURE. fused score per chunk; graph score = gscale / (1 + hops) (gscale 100 = the break-it scale). */
  function scores(inp) {
    const g = inp.hops.map(h => (inp.gscale || 1) / (1 + h));
    const v = inp.normalise ? mm(inp.vec) : inp.vec.slice(), gg = inp.normalise ? mm(g) : g;
    return { g, v, gg, s: v.map((x, i) => inp.lambda * x + (1 - inp.lambda) * gg[i]) };
  }
  function compute(inp) {
    const o = scores(inp), res = {};
    o.s.forEach((x, i) => { res['score_c' + (i + 1)] = r4(x); });
    res.lambda = inp.lambda; return res;
  }
  const order = a => a.map((x, i) => [x, i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]).map(p => p[1]);
  /* HybridRAG-style: top-n of the vector list, then top-n of the graph list that are not already there. */
  function concat(inp, n) {
    const o = scores(inp), ov = order(inp.vec).slice(0, n), og = order(o.g).slice(0, n);
    return ov.concat(og.filter(i => !ov.includes(i)));
  }

  function mountToy(el) {
    const K = DemoKit; let st = JSON.parse(JSON.stringify(defaults));
    const box = K.shell(el, 'Toy example (break it): weighted sum of a vector score and a graph score',
      'Invented numbers. Edit a cosine or a hop count, move lambda, switch normalisation off. This weighted sum is our construction; HybridRAG itself only concatenates the two contexts (shown below the table).');
    box.append(K.el('style', {}, '@media(max-width:600px){.demo table{font-size:11px}.demo td,.demo th{padding:3px 3px}.demo table input{width:3.4em!important}}'));
    const vIn = [], hIn = [], rows = [];
    const tbl = K.el('table', {}, K.el('tr', {}, ...['chunk', 'vector cosine', 'hops', 'graph score', 'fused', 'rank'].map(t => K.el('th', {}, t))));
    for (let i = 0; i < 5; i++) {
      const a = K.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: st.vec[i], 'aria-label': 'cosine c' + (i + 1), style: 'width:70px' });
      const b = K.el('input', { type: 'number', min: 0, max: 9, step: 1, value: st.hops[i], 'aria-label': 'hops c' + (i + 1), style: 'width:56px' });
      a.addEventListener('input', () => { st.vec[i] = Number(a.value) || 0; render(); }); b.addEventListener('input', () => { st.hops[i] = Math.max(0, Math.round(Number(b.value) || 0)); render(); });
      const r = { g: K.el('td', { class: 'num' }), f: K.el('td', { class: 'num' }), k: K.el('td', { class: 'num' }) };
      vIn.push(a); hIn.push(b); rows.push(r);
      tbl.append(K.el('tr', {}, K.el('td', {}, 'c' + (i + 1)), K.el('td', {}, a), K.el('td', {}, b), r.g, r.f, r.k));
    }
    const lam = K.slider('lambda (1 = vector only)', 0, 1, 0.05, st.lambda, v => { st.lambda = v; render(); });
    const chk = K.el('input', { type: 'checkbox', checked: '' }); chk.addEventListener('change', () => { st.normalise = chk.checked; render(); });
    const sc = K.el('select', { 'aria-label': 'graph score scale' }, K.el('option', { value: 1 }, 'graph score on 0-1'), K.el('option', { value: 100 }, 'graph score on 0-100'));
    sc.addEventListener('change', () => { st.gscale = Number(sc.value); render(); });
    const pre = K.el('div', { class: 'row' });
    const preset = (n, f) => { const b = K.el('button', {}, n); b.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); f(); sync(); render(); }); pre.append(b); };
    preset('worked example', () => {});
    preset('break it: no normalisation, graph on 0-100', () => { st.normalise = false; st.gscale = 100; });
    preset('lambda = 1 (vector only)', () => { st.lambda = 1; });
    preset('lambda = 0 (graph only)', () => { st.lambda = 0; });
    function sync() { lam.set(st.lambda); chk.checked = st.normalise; sc.value = st.gscale; vIn.forEach((x, i) => { x.value = st.vec[i]; }); hIn.forEach((x, i) => { x.value = st.hops[i]; }); }
    const out = K.el('div', { class: 'formula', 'aria-live': 'polite' }), res = K.resultBox(); let last = '';
    box.append(pre, K.el('div', { class: 'row' }, lam.node, K.el('label', {}, chk, ' min-max normalise'), sc), tbl, res.node, out);
    function render() {
      const o = scores(st), c = compute(st), ord = order(o.s), vo = order(st.vec), go = order(o.g);
      const rk = []; ord.forEach((i, p) => { rk[i] = p + 1; });
      rows.forEach((r, i) => { r.g.textContent = K.fmt(o.g[i], 3); r.f.textContent = K.fmt(o.s[i], 4); r.k.textContent = rk[i]; r.k.className = 'num ' + (rk[i] === 1 ? 'good' : ''); });
      res.set(o.s[ord[0]], 4);
      const name = i => 'c' + (i + 1), cc = concat(st, 2).map(name);
      const now = ord.join(); if (last && last !== now) K.flash(res.node); last = now;
      const norm = st.normalise ? 'min-max normalised' : (st.gscale > 1 ? 'NOT normalised, graph scale x' + st.gscale : 'NOT normalised');
      out.textContent = `s(d) = lambda x vec + (1 - lambda) x graph = ${st.lambda} x vec + ${K.fmt(1 - st.lambda, 2)} x graph   (${norm}); graph = ${st.gscale > 1 ? st.gscale + ' / ' : '1 / '}(1 + hops)\n` +
        `vector alone: ${vo.map(name).join(' > ')}\ngraph alone:  ${go.map(name).join(' > ')}\nfused:        ${ord.map(name).join(' > ')}\n` +
        `HybridRAG-style concatenation (top 2 vector, then top 2 graph): ${cc.join(', ')} = ${cc.length} chunks, no single ranking` +
        (!st.normalise && st.gscale > 1 ? '\nthe graph numbers are 100x larger, so they decide the order and the vector signal is lost.' : '');
    }
    render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: dense top-5 + graph top-5, concatenated like HybridRAG',
      'Real stored run on 138 Wikipedia passages about machine learning, 24 questions. Left: dense cosine top-5. Right: top passages of personalised PageRank on an LLM-extracted graph. Lines join the same passage. Context = vector passages first, then the graph passages not already there. Gold passages are ringed.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/context_assembly.json'), get('data/corpus.json'), get('data/questions.json'), get('runs/metrics_by_method.json')]).then(([ca, corpus, qs, met]) => {
      const text = {}, art = {}; corpus.forEach(p => { text[p.id] = p.text; art[p.id] = p.article; });
      const qtext = {}; qs.forEach(q => { qtext[q.id] = q.question; });
      const sel = K.el('select', { 'aria-label': 'question' }, ...ca.questions.map(q => K.el('option', { value: q.qid }, q.qid + ' ' + (qtext[q.qid] || '').slice(0, 60))));
      const svgBox = K.el('div', {}), info = K.el('div', { class: 'formula', 'aria-live': 'polite' }), snip = K.el('div', { class: 'hint', 'aria-live': 'polite' }, 'Click a passage id to read it.');
      const fmt = x => x == null ? 'n/a (no gold passage: unanswerable)' : K.fmt(x, 3);
      function draw() {
        const q = ca.questions.find(x => x.qid === sel.value), gold = new Set(q.gold);
        const W = 640, H = 250, XL = 120, XR = 520, y = i => 40 + i * 40;
        const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'dense top 5 and graph top 5 for ' + q.qid, style: 'width:100%;max-width:640px;display:block;margin:0 auto' });
        svg.append(K.svg('text', { x: XL, y: 16, 'text-anchor': 'middle', fill: '#7C9CFF', style: 'fill:#7C9CFF' }, 'dense (vector) top-5'), K.svg('text', { x: XR, y: 16, 'text-anchor': 'middle', style: 'fill:#3CC7B4' }, 'graph (PPR) top-5'));
        const gtop = q.graph_top5;
        q.vector_top5.forEach((id, i) => { const j = gtop.indexOf(id); if (j >= 0) svg.append(K.svg('line', { x1: XL + 30, y1: y(i), x2: XR - 30, y2: y(j), stroke: '#C28BFF', 'stroke-width': 2, opacity: 0.7 })); });
        const node = (id, x, yy, col) => { const g = K.svg('g', { tabindex: 0, role: 'button', 'aria-label': id, style: 'cursor:pointer' });
          g.append(K.svg('rect', { x: x - 30, y: yy - 13, width: 60, height: 26, rx: 6, fill: '#171C28', stroke: gold.has(id) ? '#3CC7B4' : '#242B38', 'stroke-width': gold.has(id) ? 3 : 1 }), K.svg('text', { x, y: yy + 4, 'text-anchor': 'middle', style: 'fill:' + col }, id));
          const open = () => { snip.textContent = `${id} (${art[id]})${gold.has(id) ? ' [gold]' : ''}: ` + (text[id] || '').slice(0, 260) + '...'; };
          g.addEventListener('click', open); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); return g; };
        q.vector_top5.forEach((id, i) => svg.append(node(id, XL, y(i), '#7C9CFF'))); gtop.forEach((id, i) => svg.append(node(id, XR, y(i), '#3CC7B4')));
        svg.append(K.svg('text', { x: W / 2, y: H - 6, 'text-anchor': 'middle', style: 'fill:#98A0B0;font-size:11px' }, 'purple line = same passage in both lists; teal ring = gold passage'));
        svgBox.replaceChildren(svg);
        const cat = q.concat.map(id => `${id}${q.vector_top5.includes(id) ? '(v)' : '(g)'}${gold.has(id) ? '*' : ''}`).join('  ');
        const gained = q.recall_concat != null && q.recall_vector_top5 != null && q.recall_concat > q.recall_vector_top5;
        info.textContent = `${q.qid}: ${qtext[q.qid]}\ngold: ${q.gold.length ? q.gold.join(', ') : 'none (unanswerable question)'}\n` +
          `context (vector first, then new graph passages; v/g = which list, * = gold): ${cat}\n` +
          `recall of gold: vector ${fmt(q.recall_vector_top5)}, graph ${fmt(q.recall_graph_top5)}, concatenated ${fmt(q.recall_concat)}\n` +
          `context size: ${q.n_concat} passages, ${q.words_concat} words (vector alone ${q.words_vector_top5})` + (gained ? '\nThe graph passages added a gold passage that dense search missed here.' : '');
      }
      sel.addEventListener('change', draw);
      const s = ca.summary, m = met.methods, d = m.dense_cosine, p = m.ppr_graph;
      const row = (n, a, b, c) => K.el('tr', {}, ...[n, a, b, c].map(x => K.el('td', { class: 'num' }, x)));
      const tbl = K.el('table', {}, K.el('tr', {}, ...['20 answerable questions', 'recall@5 / mean gold recall', 'MRR', 'context words'].map(t => K.el('th', {}, t))),
        row('dense alone (top-5)', K.fmt(s.vector_top5.mean_recall, 3), K.fmt(d.mrr, 3), K.fmt(s.vector_top5.mean_context_words, 0)),
        row('graph (PPR) alone (top-5)', K.fmt(s.graph_top5.mean_recall, 3), K.fmt(p.mrr, 3), K.fmt(s.graph_top5.mean_context_words, 0)),
        row('dense + graph concatenated', K.fmt(s.concat.mean_recall, 3), 'n/a (a set, not a ranking)', K.fmt(s.concat.mean_context_words, 0)));
      const more = Math.round((s.concat.mean_context_words / s.vector_top5.mean_context_words - 1) * 100);
      const lesson = K.el('div', { class: 'hint' }, `Two honest findings. (1) The graph signal alone is WORSE than dense search here: gold recall ${K.fmt(s.graph_top5.mean_recall, 3)} vs ${K.fmt(s.vector_top5.mean_recall, 3)}, MRR ${K.fmt(p.mrr, 3)} vs ${K.fmt(d.mrr, 3)}. (2) Concatenating them lifts gold recall from ${K.fmt(s.vector_top5.mean_recall, 3)} to ${K.fmt(s.concat.mean_recall, 3)} (one gold passage, in q10) but costs about ${more}% more context (${K.fmt(s.vector_top5.mean_context_words, 0)} to ${K.fmt(s.concat.mean_context_words, 0)} words). 20 questions, one small corpus, untuned: an illustration, not an evaluation. Concatenation is what HybridRAG does; no weighted score is used in this view.`);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', {}, 'question ', sel)), svgBox, info, snip, tbl, lesson); draw();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy); mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, concat };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['graph_vector_combination'] = api;
})(this);
