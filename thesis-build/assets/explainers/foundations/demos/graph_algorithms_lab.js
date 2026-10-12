/* graph_algorithms_lab: degree, closeness, betweenness, PageRank, personalized PageRank and Leiden communities on the REAL graph of the pack
   (662 nodes, 745 undirected simple edges, 138 Wikipedia ML passages). Scores are recomputed in JS (compute() is pure); the node check compares them with
   networkx, with data/topics/j4-compute.py results (as stored in the J4 records), with graph/ppr.json (all 23 stored PPR runs) and with graph/communities.json (Q = 0.8505).
   Scope "full graph": scores on all 662 nodes, the 516-node largest component is drawn (layout precomputed offline with networkx spring_layout, seed 7; no force simulation in the page).
   Scope "hub graph": the 12 highest-degree nodes (11 edges), the small graph the J4 records use for hand-checkable numbers.
   Serves j4-degree-centrality, j4-closeness-centrality, j4-betweenness-centrality, j4-pagerank, j4-personalized-pagerank, j4-leiden, j4-modularity, j4-connected-components.
   No LLM call. 2-D canvas, rendered on change only. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const DATA = SRC ? new URL('data/graph_algorithms_lab.real.json', SRC).href : '';

  /* formulas copied from the J4 topic records (the node check compares these strings with data/topics/*.json) */
  const FORMULAS = {
    degree: ['C_D(v)=\\frac{\\deg(v)}{n-1}'],
    closeness: ['C_C(v)=\\frac{r-1}{\\sum_{u\\neq v} d(v,u)}\\cdot\\frac{r-1}{n-1}'],
    betweenness: ['C_B(v)=\\sum_{s\\neq v\\neq t}\\frac{\\sigma_{st}(v)}{\\sigma_{st}}', 'C_B^{norm}(v)=\\frac{2\\,C_B(v)}{(n-1)(n-2)}'],
    pagerank: ['PR(v)=\\frac{1-d}{n}+d\\sum_{u\\to v}\\frac{PR(u)}{\\mathrm{out}(u)}'],
    ppr: ['\\mathbf{r}=(1-\\alpha)\\,\\mathbf{s}+\\alpha\\,W\\,\\mathbf{r}\\;\\Rightarrow\\;\\mathbf{r}=(1-\\alpha)(I-\\alpha W)^{-1}\\mathbf{s}'],
    leiden: ['Q=\\frac1{2m}\\sum_{ij}\\Bigl(A_{ij}-\\frac{k_ik_j}{2m}\\Bigr)\\delta(c_i,c_j)=\\sum_c\\Bigl(\\frac{L_c}{m}-\\bigl(\\frac{K_c}{2m}\\bigr)^2\\Bigr)']
  };
  const SYMBOLS = {
    degree: 'deg(v) = number of neighbours of v; n = number of nodes.',
    closeness: 'd(v,u) = fewest edges between v and u; r = nodes v can reach, itself included; n = all nodes (the second factor shrinks nodes in small components).',
    betweenness: 'sigma_st = number of shortest paths from s to t; sigma_st(v) = how many pass through v; the normal form divides by the number of node pairs.',
    pagerank: 'd = 0.85, the chance to follow an edge (1-d = jump anywhere); out(u) = edges leaving u; scores sum to 1. Undirected: every edge counts both ways.',
    ppr: 's = seed vector (the nodes linked from the question, equal weight); W = column-normalised adjacency; alpha = chance to continue the walk (networkx alpha); the restart chance is 1-alpha. The pack uses alpha 0.5; nodes with no edge return their mass to the seeds.',
    leiden: 'm = edges; L_c = edges inside community c; K_c = sum of degrees in c; Leiden greedily raises Q and keeps communities well connected. The page shows the pack\'s stored partition (seed 42), it does not run Leiden.'
  };

  /* ---- PURE graph code (adjacency lists over 0..n-1, undirected, simple, no self-loops) ---- */
  function buildGraph(ids, edges) {
    const idx = new Map(ids.map((x, i) => [x, i])), sets = ids.map(() => new Set());
    for (const e of edges) { const a = idx.get(e.source), b = idx.get(e.target); if (a === undefined || b === undefined || a === b) continue; sets[a].add(b); sets[b].add(a); }
    const adj = sets.map(s => [...s].sort((x, y) => x - y)); let m = 0; adj.forEach(a => { m += a.length; });
    return { n: ids.length, ids, idx, adj, m: m / 2 };
  }
  const degree = g => g.adj.map(a => a.length / (g.n - 1));
  function bfs(g, s) { const d = new Int32Array(g.n).fill(-1); d[s] = 0; const q = [s]; for (let h = 0; h < q.length; h++) { const v = q[h]; for (const w of g.adj[v]) if (d[w] < 0) { d[w] = d[v] + 1; q.push(w); } } return d; }
  /* Wasserman-Faust closeness (the networkx default): (r-1)/sum d * (r-1)/(n-1); 0 for a node that reaches nobody */
  function closenessDetail(g, v) { const d = bfs(g, v); let r = 0, sum = 0; for (let i = 0; i < g.n; i++) if (d[i] >= 0) { r++; sum += d[i]; } return { r, sum, value: r > 1 ? ((r - 1) / sum) * ((r - 1) / (g.n - 1)) : 0 }; }
  const closeness = g => g.adj.map((_, v) => closenessDetail(g, v).value);
  /* Brandes (2001) betweenness, unweighted undirected; returns raw (each unordered pair once) */
  function betweennessRaw(g) {
    const n = g.n, C = new Float64Array(n);
    for (let s = 0; s < n; s++) {
      const S = [], P = Array.from({ length: n }, () => []), sg = new Float64Array(n), d = new Int32Array(n).fill(-1), q = [s]; sg[s] = 1; d[s] = 0;
      for (let h = 0; h < q.length; h++) { const v = q[h]; S.push(v); for (const w of g.adj[v]) { if (d[w] < 0) { d[w] = d[v] + 1; q.push(w); } if (d[w] === d[v] + 1) { sg[w] += sg[v]; P[w].push(v); } } }
      const dl = new Float64Array(n); while (S.length) { const w = S.pop(); for (const v of P[w]) dl[v] += sg[v] / sg[w] * (1 + dl[w]); if (w !== s) C[w] += dl[w]; }
    }
    return Array.from(C, x => x / 2);
  }
  const betweenness = g => { const c = 2 / ((g.n - 1) * (g.n - 2)); return betweennessRaw(g).map(x => x * c); };
  /* PageRank by power iteration. alpha = chance to continue the walk; pers = personalization vector (sums to 1) or null (uniform).
     A node with no edge sends its whole mass back to pers (networkx dangling = personalization). Stops at L1 change < tol. */
  function pagerank(g, alpha, pers, tol) {
    const n = g.n; tol = tol || 1e-12; const p = pers ? Float64Array.from(pers) : new Float64Array(n).fill(1 / n);
    let x = Float64Array.from(p), it = 0;
    for (; it < 2000; it++) {
      const y = new Float64Array(n); let dang = 0;
      for (let v = 0; v < n; v++) { const a = g.adj[v]; if (!a.length) { dang += x[v]; continue; } const share = x[v] / a.length; for (const w of a) y[w] += share; }
      let diff = 0; for (let v = 0; v < n; v++) { const nv = alpha * (y[v] + dang * p[v]) + (1 - alpha) * p[v]; diff += Math.abs(nv - x[v]); y[v] = nv; }
      x = y; if (diff < tol) { it++; break; }
    }
    return { scores: Array.from(x), iterations: it };
  }
  /* modularity of a partition (array of node-index arrays): Q = sum_c ( L_c/m - (K_c/2m)^2 ) */
  function modularity(g, parts) {
    const comm = new Int32Array(g.n).fill(-1); parts.forEach((c, k) => c.forEach(v => { comm[v] = k; }));
    const L = new Float64Array(parts.length), K = new Float64Array(parts.length);
    for (let v = 0; v < g.n; v++) { K[comm[v]] += g.adj[v].length; for (const w of g.adj[v]) if (w > v && comm[w] === comm[v]) L[comm[v]]++; }
    let q = 0; for (let k = 0; k < parts.length; k++) q += L[k] / g.m - (K[k] / (2 * g.m)) ** 2; return q;
  }
  function components(g) { const seen = new Int32Array(g.n).fill(-1); let k = 0; const sizes = []; for (let s = 0; s < g.n; s++) { if (seen[s] >= 0) continue; let c = 0; const q = [s]; seen[s] = k; for (let h = 0; h < q.length; h++) { c++; for (const w of g.adj[q[h]]) if (seen[w] < 0) { seen[w] = k; q.push(w); } } sizes.push(c); k++; } return { comp: seen, sizes: sizes.sort((a, b) => b - a) }; }
  const seedVec = (n, seeds) => { const v = new Float64Array(n); seeds.forEach(s => { v[s] += 1 / seeds.length; }); return v; };
  /* PURE. All scores for one graph. inp = {ids, edges, seeds (node ids), alpha (PPR continue prob), d (PageRank damping)} */
  function compute(inp) {
    const g = buildGraph(inp.ids, inp.edges), seeds = (inp.seeds || []).map(s => g.idx.get(s)).filter(x => x !== undefined);
    const out = { n: g.n, m: g.m, degree_norm: degree(g), degree_raw: g.adj.map(a => a.length), closeness: closeness(g), betweenness_raw: betweennessRaw(g), betweenness: betweenness(g), pagerank: pagerank(g, inp.d || 0.85, null).scores };
    if (seeds.length) out.ppr = pagerank(g, inp.alpha === undefined ? 0.5 : inp.alpha, seedVec(g.n, seeds)).scores;
    out.names = inp.ids.slice(); return out;
  }
  const top = (scores, k, ids) => scores.map((v, i) => [ids[i], v, i]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k);

  /* real hub graph of the J4 records: induced subgraph of the 12 highest-degree nodes (11 edges); NOT a toy, a real slice */
  const HUB = ['regularization', 'lasso', 'overfitting', 'cross-validation', 'random forests', 'SVM', 'linear regression', 'ridge regression', 'decision tree', 'gradient descent', 'multicollinearity', 'variance'];
  const HUB_EDGES = [['cross-validation', 'overfitting'], ['multicollinearity', 'linear regression'], ['multicollinearity', 'ridge regression'], ['overfitting', 'decision tree'], ['overfitting', 'regularization'], ['overfitting', 'variance'],
    ['random forests', 'decision tree'], ['random forests', 'overfitting'], ['regularization', 'lasso'], ['regularization', 'ridge regression'], ['regularization', 'variance']];
  const defaults = { ids: HUB, edges: HUB_EDGES.map(([a, b]) => ({ source: a, target: b })), seeds: ['ridge regression'], alpha: 0.85, d: 0.85 };
  const api = { defaults, compute, mount, buildGraph, degree, closeness, closenessDetail, betweenness, betweennessRaw, pagerank, modularity, components, seedVec, top, FORMULAS, HUB };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['graph_algorithms_lab'] = api;

  const ALGOS = [['degree', 'degree'], ['closeness', 'closeness'], ['betweenness', 'betweenness'], ['pagerank', 'PageRank'], ['ppr', 'personalized PageRank'], ['leiden', 'Leiden communities']];
  const PAL = ['#7C9CFF', '#3CC7B4', '#F2A93B', '#C28BFF', '#FF8A65', '#E06C9F', '#9BD45F', '#5BC0EB', '#FFD166', '#06D6A0', '#EF476F', '#B5838D'];
  const CSS = `.gal canvas{display:block;width:100%;max-width:880px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;touch-action:manipulation}
.gal .scroll{overflow-x:auto}.gal td,.gal th{font-size:13px;vertical-align:top}.gal tr.pick{cursor:pointer}.gal tr.pick:hover{background:var(--panel2)}.gal tr.cur{background:#F2A93B22}
.gal .kpi{display:flex;flex-wrap:wrap;gap:6px 18px;margin:8px 0}.gal .kpi b{font:300 22px var(--display);color:var(--ai)}.gal label{max-width:100%}.gal select{max-width:100%;width:100%}
.gal .formula{overflow-wrap:anywhere}.gal th.sel{color:var(--ai)}.gal td.sel{background:#F2A93B14}`;

  function mount(el) {
    const K = DemoKit, E = K.el;
    if (!document.getElementById('gal-css')) document.head.append(E('style', { id: 'gal-css' }, CSS));
    const shell = K.shell(el, 'Graph algorithms lab on the real graph', 'Pick an algorithm and see the same graph resized and recoloured by its score, with the top 10, the formula and a check against the stored numbers.');
    shell.classList.add('gal');
    const box = E('div'); shell.append(box); box.append(E('p', { class: 'hint' }, 'Loading the pack...'));
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get(PACK + 'graph/graph.json'), get(PACK + 'graph/communities.json'), get(PACK + 'graph/ppr.json'), get(PACK + 'graph/entity_linking.json'), get(PACK + 'data/questions.json'), get(DATA)])
      .then(r => build(box, ...r)).catch(e => { box.textContent = 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder so ../../_real-examples/ resolves.'; });
  }

  function build(box, G, COM, PPR, LINK, QS, D) {
    const K = DemoKit, E = K.el, ids = G.nodes.map(n => n.id), names = G.nodes.map(n => n.name);
    const full = compute({ ids, edges: G.edges, seeds: [] }), g = buildGraph(ids, G.edges), idx = g.idx;
    const parts = COM.partition.map(c => c.nodes.map(x => idx.get(x))), Q = modularity(g, parts), cc = components(g);
    const commOf = new Int32Array(g.n).fill(-1); parts.forEach((c, k) => c.forEach(v => { commOf[v] = k; }));
    const QT = {}; QS.forEach(q => { QT[q.id] = q.question; });
    const linked = Object.keys(LINK.questions).filter(q => !LINK.questions[q].miss);
    const hubG = buildGraph(HUB, defaults.edges), hub = compute({ ids: HUB, edges: defaults.edges, seeds: ['ridge regression'], alpha: 0.85 });
    const st = { scope: 'full', algo: 'pagerank', q: 'q01', alpha: 0.5, sel: -1 };
    const pprCache = new Map(), pprOf = (q, a) => { const k = q + '|' + a; if (!pprCache.has(k)) { const seeds = LINK.questions[q].linked.map(l => idx.get(l.node)); pprCache.set(k, pagerank(g, a, seedVec(g.n, seeds), 1e-12)); } return pprCache.get(k); };
    box.textContent = '';
    box.append(E('p', { class: 'hint bad' }, 'Real: the graph is the pack\'s LLM-extracted graph (662 nodes, 745 undirected simple edges, 40 connected components; near-duplicate nodes remain; edges are one model\'s reading of one passage). Scores are recomputed here and checked against networkx and the J4 records. Layout: precomputed once (networkx spring_layout, seed 7) for the 516-node largest component; the other 146 nodes are not drawn but are scored. Leiden is the pack\'s stored run (seed 42), not recomputed. Global scores on an extracted graph mostly echo degree: see the table. Demo scale, NOT an evaluation of the thesis system.'));
    const scopeB = E('div', { class: 'row' }), algoB = E('div', { class: 'row' }), qRow = E('div', { class: 'row' });
    const qSel = E('select', {}, linked.map(q => E('option', { value: q }, q + ': ' + QT[q])));
    qSel.addEventListener('change', () => { st.q = qSel.value; st.sel = -1; draw(); });
    const aS = K.slider('alpha = chance to continue the walk (restart = 1 - alpha)', 0.1, 0.95, 0.05, 0.5, v => { st.alpha = Math.round(v * 100) / 100; draw(); });
    qRow.append(E('label', {}, 'question (its linked entities are the seeds) ', qSel), aS.node);
    const cv = E('canvas', { width: 880, height: 560, 'aria-label': 'graph picture' }), kpi = E('div', { class: 'kpi' }), info = E('div', { class: 'hint' }), formula = E('div'), tbl = E('div', { class: 'scroll' }), side = E('div', { class: 'scroll' }), chk = E('div', { class: 'hint' });
    box.append(scopeB, algoB, qRow, kpi, cv, info, formula, E('h4', {}, 'Top 10 for the chosen algorithm'), tbl, chk, E('h4', {}, 'All algorithms side by side (top 10 each, click a name to select it)'), side);
    let pts = [];
    cv.addEventListener('click', ev => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * cv.width / r.width, y = (ev.clientY - r.top) * cv.height / r.height; let best = -1, bd = 14 * 14 * (cv.width / r.width) ** 2; pts.forEach(p => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.i; } }); st.sel = best; draw(); });

    function scoresFor(algo) { // -> {s: array over scope nodes, labels, nodes: scope node indexes in global space}
      if (st.scope === 'hub') { const m = { degree: hub.degree_norm, closeness: hub.closeness, betweenness: hub.betweenness, pagerank: hub.pagerank, ppr: hub.ppr }; return { s: m[algo], nodes: null }; }
      if (algo === 'ppr') return { s: pprOf(st.q, st.alpha).scores, nodes: null };
      const m = { degree: full.degree_norm, closeness: full.closeness, betweenness: full.betweenness, pagerank: full.pagerank }; return { s: m[algo], nodes: null };
    }
    function draw() {
      scopeB.textContent = ''; scopeB.append(E('span', { class: 'hint' }, 'graph:'),
        E('button', { 'aria-pressed': String(st.scope === 'full'), onclick: () => { st.scope = 'full'; st.sel = -1; draw(); } }, 'full graph (662 nodes, 516 drawn)'), E('button', { 'aria-pressed': String(st.scope === 'hub'), onclick: () => { st.scope = 'hub'; st.sel = -1; draw(); } }, '12-hub graph (the J4 records)'));
      algoB.textContent = ''; algoB.append(E('span', { class: 'hint' }, 'algorithm:'), ...ALGOS.map(([k, l]) => E('button', { 'aria-pressed': String(st.algo === k), onclick: () => { st.algo = k; draw(); } }, l)));
      qRow.style.display = st.algo === 'ppr' && st.scope === 'full' ? '' : 'none';
      const hubMode = st.scope === 'hub', nodeIds = hubMode ? HUB : ids, nm = hubMode ? HUB : names, N = nodeIds.length;
      const leiden = st.algo === 'leiden' && !hubMode;
      const S = leiden ? null : scoresFor(st.algo).s, G2 = hubMode ? hubG : g;
      // layout
      const lay = hubMode ? HUB.map((_, i) => [0.5 + 0.42 * Math.cos(2 * Math.PI * i / 12 - Math.PI / 2), 0.5 + 0.42 * Math.sin(2 * Math.PI * i / 12 - Math.PI / 2)]) : ids.map(x => D.layout[x] || null);
      const W = cv.width, H = cv.height, pad = 30, c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
      const px = i => pad + lay[i][0] * (W - 2 * pad), py = i => pad + lay[i][1] * (H - 2 * pad), drawn = i => !!lay[i];
      c.lineWidth = 1; c.strokeStyle = 'rgba(152,160,176,0.22)'; c.beginPath();
      G2.adj.forEach((a, i) => a.forEach(j => { if (j > i && drawn(i) && drawn(j)) { c.moveTo(px(i), py(i)); c.lineTo(px(j), py(j)); } })); c.stroke();
      const mx = S ? Math.max(...S) || 1 : 1, rank = S ? S.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]) : null, topSet = new Set(rank ? rank.slice(0, 10) : []);
      const bigC = new Map(); if (leiden) COM.partition.slice(0, 12).forEach((cm, k) => cm.nodes.forEach(x => bigC.set(idx.get(x), k)));
      const seedSet = new Set(st.algo === 'ppr' ? (hubMode ? [HUB.indexOf('ridge regression')] : LINK.questions[st.q].linked.map(l => idx.get(l.node))) : []);
      pts = [];
      const order = [...Array(N).keys()].filter(drawn).sort((a, b) => (S ? S[a] - S[b] : 0));
      for (const i of order) {
        let r = 3, col = '#68707F';
        if (S) { const f = Math.sqrt(S[i] / mx); r = 2.5 + 12 * f; col = `hsl(${220 - 175 * f},75%,${45 + 15 * f}%)`; } else { const k = bigC.get(i); col = k === undefined ? '#68707F' : PAL[k]; r = 2.5 + 1.1 * Math.sqrt(G2.adj[i].length); }
        c.beginPath(); c.arc(px(i), py(i), r, 0, 6.2832); c.fillStyle = col; c.globalAlpha = S && S[i] === 0 ? 0.35 : 0.9; c.fill(); c.globalAlpha = 1;
        if (seedSet.has(i)) { c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); }
        pts.push({ i, x: px(i), y: py(i) });
      }
      c.font = '12px Inter,system-ui,sans-serif'; c.fillStyle = '#E9ECF2';
      const lab = i => { c.fillStyle = 'rgba(11,13,18,0.7)'; const w = c.measureText(nm[i]).width; c.fillRect(px(i) + 6, py(i) - 14, w + 4, 15); c.fillStyle = '#E9ECF2'; c.fillText(nm[i], px(i) + 8, py(i) - 2); };
      topSet.forEach(i => { if (drawn(i)) lab(i); }); if (st.sel >= 0 && drawn(st.sel)) { c.beginPath(); c.arc(px(st.sel), py(st.sel), 17, 0, 6.2832); c.lineWidth = 2; c.strokeStyle = '#F2A93B'; c.stroke(); lab(st.sel); }
      // kpi
      kpi.textContent = '';
      const items = hubMode ? [[12, 'nodes'], [hubG.m, 'edges'], [components(hubG).sizes.length, 'components']] : [[g.n, 'nodes'], [g.m, 'edges'], [cc.sizes.length, 'components'], [cc.sizes[0], 'nodes in the largest']];
      if (leiden) items.push([COM.partition.length, 'communities'], [K.fmt(Q, 4), 'modularity Q (recomputed)']);
      items.forEach(([v, l]) => kpi.append(E('span', {}, E('b', {}, String(v)), ' ' + l)));
      info.textContent = leiden ? 'Colour = one of the 12 largest of the 57 stored Leiden communities; grey = the rest. Size = degree.' : (st.algo === 'ppr' ? 'White ring = seed (linked from the question). Size and colour = score (square-root scale). Top 10 labelled.' : 'Size and colour = score (square-root scale, blue low, orange high). Top 10 labelled. Click a node or a table row.');
      // formula
      formula.textContent = ''; const key = st.algo;
      formula.append(E('h4', {}, 'Formula (from the topic record)'), ...FORMULAS[key].map(f => E('div', { class: 'formula' }, f)), E('p', { class: 'hint' }, SYMBOLS[key]));
      if (st.algo === 'ppr') formula.append(E('div', { class: 'formula' }, 'alpha = ' + st.alpha + (hubMode ? ', seed = ridge regression (hub graph)' : ', ' + LINK.questions[st.q].linked.length + ' seed(s): ' + LINK.questions[st.q].linked.map(l => l.name).join(', '))));
      if (st.algo === 'pagerank') formula.append(E('div', { class: 'formula' }, 'd = 0.85, n = ' + N));
      // live numbers for selected node
      if (st.sel >= 0 && !leiden) { const v = st.sel, gg = G2; let t = nm[v] + ': ';
        if (st.algo === 'degree') t += 'deg = ' + gg.adj[v].length + ', n-1 = ' + (N - 1) + ', C_D = ' + K.fmt(gg.adj[v].length / (N - 1), 4);
        else if (st.algo === 'closeness') { const d = closenessDetail(gg, v); t += 'r = ' + d.r + ', sum of distances = ' + d.sum + ', C_C = (' + (d.r - 1) + '/' + d.sum + ') x (' + (d.r - 1) + '/' + (N - 1) + ') = ' + K.fmt(d.value, 4); }
        else if (st.algo === 'betweenness') { const raw = betweennessRaw(gg)[v]; t += 'C_B = ' + K.fmt(raw, 2) + ' pairs; normalised = 2 x ' + K.fmt(raw, 2) + ' / ((' + (N - 1) + ')(' + (N - 2) + ')) = ' + K.fmt(raw * 2 / ((N - 1) * (N - 2)), 4); }
        else t += 'score = ' + K.fmt(S[v], 5);
        formula.append(E('div', { class: 'formula changed' }, t)); }
      if (leiden) formula.append(E('div', { class: 'formula' }, 'Q recomputed from the stored partition: ' + K.fmt(Q, 4) + '   (stored in communities.json: ' + COM.modularity + ')'));
      // top table
      tbl.textContent = '';
      if (leiden) {
        const rep = {}; (COM.reports || []).forEach(r => { rep[r.id] = r; });
        tbl.append(E('table', {}, E('tr', {}, ['#', 'community', 'nodes', 'highest-degree members', 'LLM report title (unchecked text)'].map(h => E('th', {}, h))), ...COM.partition.slice(0, 10).map((cm, k) => {
          const mem = cm.nodes.map(x => idx.get(x)).sort((a, b) => g.adj[b].length - g.adj[a].length).slice(0, 3).map(i => names[i]);
          return E('tr', { class: 'pick', onclick: () => { st.sel = idx.get(cm.nodes[0]); draw(); } }, E('td', {}, String(k + 1)), E('td', {}, E('span', { style: 'display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;background:' + PAL[k] }), cm.id), E('td', { class: 'num' }, String(cm.size)), E('td', {}, mem.join(', ')), E('td', {}, rep[cm.id] ? rep[cm.id].title : '(no report: only the 15 largest got one)'));
        })));
      } else {
        const tp = top(S, 10, nm);
        tbl.append(E('table', {}, E('tr', {}, ['#', 'node', 'type', 'score', 'degree'].map(h => E('th', {}, h))), ...tp.map(([n, v, i], k) => E('tr', { class: 'pick' + (st.sel === i ? ' cur' : ''), onclick: () => { st.sel = i; draw(); } }, E('td', {}, String(k + 1)), E('td', {}, n + (drawn(i) ? '' : ' (not drawn)')), E('td', {}, hubMode ? '' : G.nodes[i].type), E('td', { class: 'num' }, K.fmt(v, 5)), E('td', { class: 'num' }, String(G2.adj[i].length))))));
      }
      // stored-number check
      chk.textContent = '';
      if (st.algo === 'ppr' && !hubMode) { const stq = PPR.questions[st.q], mine = top(pprOf(st.q, 0.5).scores, 3, names); chk.textContent = 'Check at alpha 0.5 against graph/ppr.json (' + st.q + '): stored top 3 = ' + stq.top_nodes.slice(0, 3).map(t => t.name + ' ' + t.score).join(', ') + '; recomputed here = ' + mine.map(t => t[0] + ' ' + K.fmt(t[1], 6)).join(', ') + (st.alpha !== 0.5 ? ' (move alpha back to 0.5 to compare)' : '') + '.'; }
      else if (st.algo === 'pagerank' && !hubMode) chk.textContent = 'Check: the J4 record (j4-compute.py, networkx) lists the full-graph top 5 as regularization 0.01291, SVM 0.01131, lasso 0.01067, random forests 0.0104, gradient descent 0.01029. Global PageRank mostly echoes degree here.';
      else if (st.algo === 'betweenness' && !hubMode) chk.textContent = 'Check: the J4 record lists the full-graph top 5 (normalised) as regularization 0.1684, ridge regression 0.1262, linear regression 0.1193, lasso 0.1188, overfitting 0.1168.';
      else if (st.algo === 'degree' && !hubMode) chk.textContent = 'Check: graph/stats.json top degree: regularization 27, lasso 22, overfitting 21, cross-validation 20, random forests 19 (degrees on the 745-edge simple graph).';
      else if (hubMode) chk.textContent = 'Check: hub-graph values equal the J4 records (e.g. PageRank overfitting 0.1973, regularization 0.1661; betweenness regularization 23 and overfitting 20 pairs; closeness regularization 0.4909).';
      // side by side
      side.textContent = '';
      const cols = ALGOS.filter(([k]) => !(k === 'leiden') && (k !== 'ppr' || true)).map(([k, l]) => ({ k, l, t: top(scoresFor(k).s, 10, nm) }));
      const rows = []; for (let r = 0; r < 10; r++) rows.push(E('tr', {}, E('td', {}, String(r + 1)), ...cols.map(cl => E('td', { class: cl.k === st.algo ? 'sel' : '', style: 'cursor:pointer', onclick: () => { st.sel = cl.t[r][2]; st.algo = cl.k; draw(); } }, cl.t[r][0]))));
      side.append(E('table', {}, E('tr', {}, E('th', {}, '#'), ...cols.map(cl => E('th', { class: cl.k === st.algo ? 'sel' : '' }, cl.l))), ...rows));
      const dTop = new Set(top(scoresFor('degree').s, 10, nm).map(x => x[2]));
      side.append(E('p', { class: 'hint' }, 'Overlap of each top 10 with the degree top 10: ' + cols.map(cl => cl.l + ' ' + cl.t.filter(x => dTop.has(x[2])).length + '/10').join(', ') + '. PPR depends on the question seeds; the others do not.'));
    }
    draw();
  }
})(typeof window !== 'undefined' ? window : globalThis);
