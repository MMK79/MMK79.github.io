/* Evidence (subgraph) recall demo. Real example (default): gold-passage triples vs the retrieved subgraph, k-hop vs PCST vs PPR top-N. Toy example: 3 gold triples, 2 found in a 40-triple subgraph. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    size: 40,                  // |S_q|: triples in the retrieved subgraph
    goldInSubgraph: [13, 26],  // indices of gold triples that were retrieved
    goldTotal: 3,              // |G*|
  };
  /* PURE: ER = |G* ∩ S_q| / |G*|  (toy form). */
  function compute(inp) {
    const hits = new Set(inp.goldInSubgraph.filter(i => i >= 0 && i < inp.size)).size;
    return hits / Math.max(1, inp.goldTotal);
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { size: defaults.size, gold: new Set(defaults.goldInSubgraph), goldTotal: defaults.goldTotal };
    const shell = K.shell(el, 'Toy example (break it)', 'Each square is one retrieved triple. Click a square to mark it as a gold evidence triple that was found. Set how many gold triples exist in total; the ones not found are missing evidence.');
    const sizeS = K.slider('|S_q| (triples retrieved)', 1, 60, 1, st.size, v => { st.size = v; render(); });
    const totS = K.slider('|G*| (gold triples that exist)', 1, 6, 1, st.goldTotal, v => { st.goldTotal = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.gold = new Set(defaults.goldInSubgraph); sizeS.set(st.size = defaults.size); totS.set(st.goldTotal = defaults.goldTotal); render(); }),
      btn('Break it: retrieve 60 triples, mark all gold found', () => { sizeS.set(st.size = 60); st.gold = new Set(Array.from({ length: st.goldTotal }, (_, i) => i * 7)); render(); }),
      btn('Break it: tiny subgraph, 1 triple', () => { sizeS.set(st.size = 1); st.gold = new Set([0]); render(); }));
    const grid = K.el('div', { class: 'row', role: 'group', 'aria-label': 'retrieved triples', style: 'gap:4px' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, sizeS.node, totS.node), presets, grid, res.node, formula, note);
    function render() {
      grid.replaceChildren();
      for (let i = 0; i < st.size; i++) {
        const g = st.gold.has(i);
        grid.append(K.el('button', { type: 'button', 'aria-pressed': g ? 'true' : 'false', title: `triple ${i + 1}: ${g ? 'gold, found' : 'not gold'}`, 'aria-label': `triple ${i + 1}, ${g ? 'gold' : 'other'}`,
          style: 'width:30px;height:30px;padding:0;' + (g ? 'background:#3CC7B466;border-color:var(--he)' : 'border-color:var(--warn);background:#FF8A6522'),
          onclick: () => { g ? st.gold.delete(i) : st.gold.add(i); render(); } }));
      }
      const hits = Math.min(Array.from(st.gold).filter(i => i < st.size).length, st.goldTotal);
      const er = compute({ size: st.size, goldInSubgraph: Array.from(st.gold), goldTotal: st.goldTotal });
      res.set(Math.min(1, er));
      formula.textContent = `ER = |G* ∩ S_q| / |G*| = ${hits} / ${st.goldTotal} = ${K.fmt(Math.min(1, er))}     subgraph size |S_q| = ${st.size}`;
      note.textContent = (er >= 1 && st.size >= 40 ? 'Recall 1 with a huge subgraph is cheap: always report the size (or precision) next to it. ' : '') + (st.gold.size > st.goldTotal ? 'More triples are marked gold than exist in G*; raise |G*|. ' : '');
    }
    render();
  }

  /* ---------- real ---------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('graph/graph.json'), get('graph/khop.json'), get('graph/pcst.json'), get('data/questions.json'), get('graph/ppr.json')]).then(a => buildReal(a[0], a[1], a[2], a[3], a[4]));
    return realData;
  }
  function buildReal(g, khop, pcst, questions, ppr) {
    const adj = {}, byName = {}, nm = {};
    g.nodes.forEach(n => { adj[n.id] = new Set(); byName[n.name] = n.id; nm[n.id] = n.name; });
    g.edges.forEach(e => { if (e.source !== e.target) { adj[e.source].add(e.target); adj[e.target].add(e.source); } });
    const qs = {}; questions.forEach(q => { qs[q.id] = q; });
    const seeds = {}; khop.questions.forEach(q => { if (q.seeds && q.seeds.length) seeds[q.qid] = q.seeds.map(s => s.id); });
    const ids = Object.keys(seeds).filter(id => qs[id].type !== 'unanswerable' && pcst.questions[id]).sort();
    return { g, adj, byName, nm, qs, seeds, pcst: pcst.questions, pprRef: ppr.questions, ids };
  }
  function bfs(D, seeds, h) {
    const S = new Set(seeds); let fr = new Set(seeds);
    for (let i = 0; i < h; i++) { const nx = new Set(); fr.forEach(x => D.adj[x].forEach(y => { if (!S.has(y)) nx.add(y); })); nx.forEach(y => S.add(y)); fr = nx; }
    return S;
  }
  /* Personalized PageRank, restart 0.5, equal seed mass, undirected simple graph, dangling mass back to the seeds (the pack's rule). Returns {id: score}. */
  function ppr(D, seeds) {
    const ids = Object.keys(D.adj), s = {}; seeds.forEach(x => { s[x] = 1 / seeds.length; });
    let p = {}; ids.forEach(i => { p[i] = s[i] || 0; });
    for (let it = 0; it < 200; it++) {
      const q = {}; ids.forEach(i => { q[i] = 0; }); let dang = 0;
      ids.forEach(i => { const d = D.adj[i].size; if (!d) dang += p[i]; else D.adj[i].forEach(j => { q[j] += p[i] / d; }); });
      let diff = 0;
      ids.forEach(i => { const v = 0.5 * (q[i] + dang * (s[i] || 0)) + 0.5 * (s[i] || 0); diff += Math.abs(v - p[i]); q[i] = v; });
      p = q; if (diff < 1e-12) break;
    }
    return p;
  }
  function pprTop(D, qid, n) { D.cache = D.cache || {}; const p = D.cache[qid] || (D.cache[qid] = ppr(D, D.seeds[qid])); return new Set(Object.keys(p).sort((a, b) => p[b] - p[a] || (a < b ? -1 : 1)).slice(0, n)); }
  function pcstNodes(D, qid) { return new Set(D.pcst[qid].nodes.map(n => D.byName[n])); }
  /* gold triples = edges extracted from a gold passage (OUR proxy: the pack has no gold triples). Subgraph triples = edges whose two ends are both in the node set. */
  function goldEdges(D, gold) { const gs = new Set(gold); return D.g.edges.filter(e => e.passages.some(p => gs.has(p))); }
  function evalSet(D, nodes, G) {
    const sub = D.g.edges.filter(e => nodes.has(e.source) && nodes.has(e.target)), subSet = new Set(sub);
    const found = G.filter(e => subSet.has(e));
    return { size: sub.length, nodes: nodes.size, hits: found.length, found, er: G.length ? found.length / G.length : null };
  }
  function methods(D, qid, o) {
    const G = goldEdges(D, D.qs[qid].gold_passages), sd = D.seeds[qid];
    return { G, rows: [0, 1, 2, 3].map(h => ['k-hop ' + h, evalSet(D, bfs(D, sd, h), G)]).concat([['PCST', evalSet(D, pcstNodes(D, qid), G)], ['PPR top ' + o.n, evalSet(D, pprTop(D, qid, o.n), G)]]) };
  }
  const mean = a => { const v = a.filter(x => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; };

  function mountReal(el, D) {
    const K = root.DemoKit, st = { qid: D.ids.includes('q02') ? 'q02' : D.ids[0], hop: 1, n: 10 };
    const shell = K.shell(el, 'Real example: evidence recall, k-hop vs PCST vs PPR',
      'Scale: 138 passages, 24 questions (20 answerable), a graph of 662 nodes and 762 edges extracted by an LLM (qwen3.8-flash). The pack has NO gold triples. Our proxy: the gold triples G* of a question are the edges extracted from one of its gold passages. Because extraction is noisy, some of those edges are vague or wrong, and true evidence edges extracted from non-gold passages are not counted. A retrieved subgraph S_q = all graph edges whose two end nodes are retrieved. Seeds come from noisy entity linking. A demo, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.ids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question.slice(0, 60))));
    qSel.value = st.qid; qSel.addEventListener('change', () => { st.qid = qSel.value; render(); });
    const hopS = K.slider('k-hop expansion: hop', 0, 3, 1, st.hop, v => { st.hop = v; render(); });
    const nS = K.slider('PPR: keep the top N nodes', 2, 40, 1, st.n, v => { st.n = v; render(); means(); });
    const qline = K.el('p', { class: 'hint' }), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const table = K.el('div', { class: 'formula', style: 'white-space:pre-wrap;overflow-x:auto' }), list = K.el('div', { role: 'group', 'aria-label': 'gold triples' });
    const note = K.el('p', { class: 'hint' }), meanBox = K.el('p', { class: 'hint', style: 'white-space:pre-wrap' });
    shell.append(K.el('div', { style: 'max-width:100%' }, K.el('label', { style: 'display:block;max-width:100%' }, 'question ', qSel)), hopS.node, nS.node, qline, res.node, formula, table,
      K.el('p', { class: 'hint' }, 'Gold triples of this question (teal = in the current k-hop subgraph, orange = missing; the passage id is where the edge was extracted):'), list, note, meanBox);
    function render() {
      const q = D.qs[st.qid], M = methods(D, st.qid, st), cur = M.rows[st.hop][1], f = x => x.er === null ? 'n/a' : K.fmt(x.er, 3);
      qline.textContent = q.question + '  | gold passages: ' + q.gold_passages.join(', ') + ' | gold triples |G*|: ' + M.G.length + ' | seeds: ' + D.seeds[st.qid].length;
      res.set(cur.er === null ? 0 : cur.er, 3);
      formula.textContent = cur.er === null ? 'no gold triple was extracted for this question: ER is undefined' : `ER (hop ${st.hop}) = |G* ∩ S_q| / |G*| = ${cur.hits} / ${M.G.length} = ${K.fmt(cur.er, 3)}   with a subgraph of ${cur.size} triples`;
      table.textContent = 'method        triples  found  ER\n' + M.rows.map(([n, x], i) => n.padEnd(13) + String(x.size).padStart(6) + String(x.hits).padStart(7) + '  ' + f(x) + (i === st.hop ? '  <' : '')).join('\n');
      const have = new Set(cur.found); list.replaceChildren();
      M.G.slice(0, 30).forEach(e => list.append(K.el('div', { style: 'margin:2px 0;padding:1px 6px;border-left:4px solid var(--' + (have.has(e) ? 'he' : 'warn') + ')' }, K.el('span', { class: 'hint' }, `${D.nm[e.source]} -${e.relation}-> ${D.nm[e.target]}  [${e.passages.join(', ')}]`))));
      const big = M.rows[3][1];
      note.textContent = `Teaching point: recall rises with the hop, but so does the subgraph (hop 3: ${big.size} triples, ER ${f(big)}). PCST keeps ${M.rows[4][1].size} triples at ER ${f(M.rows[4][1])}; PPR top ${st.n} keeps ${M.rows[5][1].size} at ER ${f(M.rows[5][1])}. Recall without the size is easy to inflate.`;
    }
    function means() {
      const per = D.ids.map(id => methods(D, id, st).rows.map(r => r[1]));
      const labels = ['k-hop 0', 'k-hop 1', 'k-hop 2', 'k-hop 3', 'PCST', 'PPR top ' + st.n];
      meanBox.textContent = `Mean over the ${D.ids.length} answerable questions with seeds (macro average; a question with no gold triple would be skipped):\n` +
        labels.map((l, i) => `${l}: ER ${K.fmt(mean(per.map(r => r[i].er)), 3)}, mean ${K.fmt(per.reduce((s, r) => s + r[i].size, 0) / per.length, 1)} triples`).join('\n');
    }
    render(); means();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, buildReal, methods, ppr, goldEdges };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['evidence_triple_recall'] = api;
})(this);
