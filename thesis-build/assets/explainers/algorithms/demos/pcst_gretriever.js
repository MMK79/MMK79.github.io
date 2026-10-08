/* G-Retriever PCST subgraph: pick a small CONNECTED subgraph that maximises (prizes of chosen nodes) - (edges x C_e).
   Real example (default): the stored pcst_fast run on the real 662-node graph (prizes from personalised PageRank, not from cosine
   similarity as in the paper; unit edge cost; untuned), compared with k-hop expansion. Toy example: a 7-node graph, solved EXACTLY by
   brute force over all 127 non-empty node subsets (invented numbers). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const EDGES = ['A-B', 'B-C', 'C-D', 'B-E', 'E-F', 'F-G', 'D-G'];
  const defaults = { nodes: NODES, edges: EDGES, sims: { A: 0.91, F: 0.83, C: 0.77, B: 0.40, D: 0.20, E: 0.12, G: 0.05 }, k: 3, Ce: 0.5 };

  /* prize = k - i for the node ranked i (from 0) by similarity among the top k, else 0 (paper Eq. 6, our rank reading). Ties: input order. */
  function prizes(inp) {
    const order = inp.nodes.map((n, i) => [n, i]).sort((a, b) => inp.sims[b[0]] - inp.sims[a[0]] || a[1] - b[1]).map(x => x[0]);
    const p = {}; inp.nodes.forEach(n => { p[n] = 0; });
    order.slice(0, inp.k).forEach((n, i) => { p[n] = inp.k - i; });
    return p;
  }
  function connected(inp, set) {
    if (!set.length) return false;
    const adj = {}; set.forEach(n => { adj[n] = []; });
    inp.edges.forEach(e => { const [a, b] = e.split('-'); if (a in adj && b in adj) { adj[a].push(b); adj[b].push(a); } });
    const seen = new Set([set[0]]), st = [set[0]];
    while (st.length) { const u = st.pop(); adj[u].forEach(v => { if (!seen.has(v)) { seen.add(v); st.push(v); } }); }
    return seen.size === set.length;
  }
  /* EXACT: every non-empty connected node subset; cost = (n-1) x C_e (a tree). Best value; ties go to fewer nodes, then input order. */
  function solve(inp) {
    const p = prizes(inp), n = inp.nodes.length, all = [];
    for (let m = 1; m < (1 << n); m++) {
      const set = inp.nodes.filter((_, i) => m & (1 << i));
      if (!connected(inp, set)) continue;
      const prize = set.reduce((s, x) => s + p[x], 0), cost = (set.length - 1) * inp.Ce;
      all.push({ set, prize, cost, value: prize - cost });
    }
    all.sort((a, b) => b.value - a.value || a.set.length - b.set.length || (a.set.join('') < b.set.join('') ? -1 : 1));
    return { prizes: p, best: all[0], all };
  }
  /* PURE. Returns the shape of worked_example.result. */
  function compute(inp) {
    const b = solve(inp).best;
    return { best_value: Math.round(b.value * 1e9) / 1e9, n_nodes: b.set.length, n_edges: b.set.length - 1, total_prize: b.prize };
  }
  function khopCount(inp, seeds, K) {
    const adj = {}; inp.nodes.forEach(n => { adj[n] = []; });
    inp.edges.forEach(e => { const [a, b] = e.split('-'); adj[a].push(b); adj[b].push(a); });
    const d = {}, q = [];
    seeds.forEach(s => { d[s] = 0; q.push(s); });
    for (let h = 0; h < q.length; h++) { const u = q[h]; if (d[u] >= K) continue; adj[u].forEach(v => { if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } }); }
    return Object.keys(d).length;
  }

  const TOY_POS = { A: [30, 100], B: [100, 100], C: [170, 40], D: [250, 40], E: [170, 160], F: [250, 160], G: [310, 100] };
  const PRESETS = {
    'worked example': { sims: defaults.sims, k: 3, Ce: 0.5 },
    'break it: the true node A falls out of the top k': { sims: { A: 0.10, F: 0.83, C: 0.77, B: 0.40, D: 0.20, E: 0.12, G: 0.05 }, k: 3, Ce: 0.5 },
    'break it: edges cost too much (C_e = 1)': { sims: defaults.sims, k: 3, Ce: 1 },
    'cheap edges (C_e = 0.1), k = 5': { sims: defaults.sims, k: 5, Ce: 0.1 },
  };

  function mountToy(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults));
    const box = K.shell(el, 'Toy example (break it): prizes, edge cost and the best connected subgraph',
      'Invented 7-node graph. Edit a similarity, k or C_e. The page solves the objective EXACTLY by trying all 127 non-empty node subsets (the paper uses a fast approximate solver; only a toy is small enough for this). Node B has no prize, yet joins the answer when edges are cheap: that is the Steiner part.');
    const svg = K.svg('svg', { viewBox: '0 0 340 200', role: 'img', 'aria-label': 'toy graph with chosen subgraph', style: 'width:100%;max-width:520px;display:block;margin:0 auto' });
    const eg = K.svg('g'), ng = K.svg('g'); svg.append(eg, ng);
    const inputs = {}, tbl = K.el('table', { style: 'font-size:12px' });
    const head = K.el('tr', {}, ...['node', 'similarity (editable)', 'rank', 'prize'].map(h => K.el('th', {}, h)));
    const rows = {};
    NODES.forEach(n => {
      const inp = K.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: st.sims[n], 'aria-label': 'similarity of ' + n, style: 'width:70px' });
      inp.addEventListener('input', () => { const v = Number(inp.value); if (Number.isFinite(v)) { st.sims[n] = v; render(); } });
      inputs[n] = inp;
      rows[n] = { rank: K.el('td', { class: 'num' }), prize: K.el('td', { class: 'num' }) };
      tbl.append(K.el('tr', {}, K.el('td', {}, n), K.el('td', {}, inp), rows[n].rank, rows[n].prize));
    });
    tbl.prepend(head);
    const kS = K.slider('k (nodes that get a prize)', 1, 6, 1, st.k, v => { st.k = v; render(); });
    const cS = K.slider('C_e (price of one edge)', 0, 3, 0.05, st.Ce, v => { st.Ce = v; render(); });
    const pre = K.el('div', { class: 'row' });
    Object.entries(PRESETS).forEach(([name, p]) => {
      const b = K.el('button', {}, name);
      b.addEventListener('click', () => { st.sims = { ...p.sims }; st.k = p.k; st.Ce = p.Ce; NODES.forEach(n => { inputs[n].value = st.sims[n]; }); kS.set(st.k); cS.set(st.Ce); render(); });
      pre.append(b);
    });
    const res = K.resultBox(), line = K.el('div', { class: 'formula' }), cmp = K.el('div', { class: 'hint' }), alt = K.el('table', { style: 'font-size:12px' }), warn = K.el('div', { class: 'bad', 'aria-live': 'polite' });
    box.append(pre, K.el('div', { class: 'row' }, kS.node, cS.node), svg, K.el('div', { class: 'row' }, K.el('span', {}, 'best value = '), res.node), line, warn, cmp, tbl, K.el('div', { class: 'hint' }, 'Five best connected subgraphs:'), alt);
    function render() {
      const s = solve(st), b = s.best, inB = new Set(b.set);
      eg.replaceChildren(); ng.replaceChildren();
      EDGES.forEach(e => { const [a, c] = e.split('-'), on = inB.has(a) && inB.has(c);
        eg.append(K.svg('line', { x1: TOY_POS[a][0], y1: TOY_POS[a][1], x2: TOY_POS[c][0], y2: TOY_POS[c][1], stroke: on ? 'var(--ai)' : 'var(--line)', 'stroke-width': on ? 4 : 2 })); });
      NODES.forEach(n => {
        const [x, y] = TOY_POS[n], p = s.prizes[n];
        ng.append(K.svg('circle', { cx: x, cy: y, r: 11 + 2 * p, fill: inB.has(n) ? 'var(--ai)' : 'var(--panel2)', stroke: p > 0 ? 'var(--he)' : 'var(--faint)', 'stroke-width': 2 }));
        ng.append(K.svg('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, style: inB.has(n) ? 'fill:#0B0D12;font-weight:600' : '' }, n));
        if (p > 0) ng.append(K.svg('text', { x, y: y - 17 - 2 * p, 'text-anchor': 'middle', 'font-size': 11, style: 'fill:var(--he)' }, 'prize ' + p));
      });
      const order = NODES.map((n, i) => [n, i]).sort((a, c) => st.sims[c[0]] - st.sims[a[0]] || a[1] - c[1]).map(x => x[0]);
      NODES.forEach(n => { rows[n].rank.textContent = order.indexOf(n) + 1; rows[n].prize.textContent = s.prizes[n]; });
      res.set(b.value, 2);
      line.textContent = `chosen: {${b.set.join(', ')}}   prizes ${b.set.map(x => s.prizes[x]).join(' + ') || 0} = ${b.prize}   cost (${b.set.length} nodes - 1) x C_e = ${b.set.length - 1} x ${K.fmt(st.Ce, 2)} = ${K.fmt(b.cost, 2)}   value ${b.prize} - ${K.fmt(b.cost, 2)} = ${K.fmt(b.value, 2)}`;
      const top = order[0], nk = khopCount(st, [top], 2);
      cmp.textContent = `For comparison, 2-hop expansion from the top node ${top} takes ${nk} of 7 nodes with no size control; PCST took ${b.set.length}.`;
      const zeros = b.set.filter(x => s.prizes[x] === 0);
      warn.textContent = (zeros.length ? `Zero-prize node(s) ${zeros.join(', ')} are in the answer only as connectors. ` : '') +
        (b.set.length === 1 ? 'Only one node survives: every extra node costs more than it earns.' : '') +
        (s.prizes.A === 0 ? ' A is not in the top k, so it has no prize: the tree connects the wrong nodes very efficiently.' : '');
      alt.replaceChildren(K.el('tr', {}, ...['nodes', 'prize', 'cost', 'value'].map(h => K.el('th', {}, h))),
        ...s.all.slice(0, 5).map(r => K.el('tr', {}, K.el('td', {}, r.set.join(' ')), K.el('td', { class: 'num' }, r.prize), K.el('td', { class: 'num' }, K.fmt(r.cost, 2)), K.el('td', { class: 'num' }, K.fmt(r.value, 2)))));
    }
    render();
  }

  /* simple deterministic spring layout for a small graph */
  function layout(ids, pairs, W, H) {
    const n = ids.length, P = ids.map((_, i) => [W / 2 + 0.35 * W * Math.cos(2 * Math.PI * i / n), H / 2 + 0.35 * H * Math.sin(2 * Math.PI * i / n)]);
    const ix = {}; ids.forEach((v, i) => { ix[v] = i; });
    for (let it = 0; it < 300; it++) {
      const F = P.map(() => [0, 0]);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d2 = dx * dx + dy * dy + 0.01, f = 6000 / d2; F[i][0] += dx * f; F[i][1] += dy * f; F[j][0] -= dx * f; F[j][1] -= dy * f; }
      pairs.forEach(([a, b]) => { const i = ix[a], j = ix[b], dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.sqrt(dx * dx + dy * dy) + 0.01, f = (d - 80) * 0.05; F[i][0] += dx / d * f * d; F[i][1] += dy / d * f * d; F[j][0] -= dx / d * f * d; F[j][1] -= dy / d * f * d; });
      for (let i = 0; i < n; i++) { P[i][0] += Math.max(-8, Math.min(8, F[i][0] * 0.02)) + (W / 2 - P[i][0]) * 0.01; P[i][1] += Math.max(-8, Math.min(8, F[i][1] * 0.02)) + (H / 2 - P[i][1]) * 0.01; P[i][0] = Math.max(60, Math.min(W - 60, P[i][0])); P[i][1] = Math.max(34, Math.min(H - 22, P[i][1])); }
    }
    const o = {}; ids.forEach((v, i) => { o[v] = P[i]; }); return o;
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: PCST subgraph on a graph extracted from Wikipedia text',
      'Real run, real data: a 662-node knowledge graph that an LLM extracted from 138 Wikipedia passages (machine-learning articles), and the stored pcst_fast result for each question. Pick a question: see the chosen connected subgraph, which nodes carry a prize, and how big k-hop expansion from the same seeds would be.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/graph.json'), get('graph/pcst.json'), get('graph/ppr.json'), get('graph/khop.json'), get('data/questions.json')]).then(([g, pc, pp, kh, qs]) => {
      const byName = {}, byId = {}; g.nodes.forEach(n => { byName[n.name] = n; byId[n.id] = n; });
      const KH = {}; kh.questions.forEach(q => { KH[q.qid] = q; });
      const QS = {}; qs.forEach(q => { QS[q.id] = q; });
      const ids = Object.keys(pc.questions);
      const sel = K.el('select', { 'aria-label': 'question' }, ...ids.map(i => K.el('option', { value: i }, `${i} (${QS[i].type}): ${QS[i].question.slice(0, 66)}`)));
      sel.value = 'q05';
      const info = K.el('div', {}), W = 560, H = 380;
      const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'real PCST subgraph', style: 'width:100%;max-width:640px;display:block;margin:0 auto' });
      const stats = K.el('table', { style: 'font-size:12px' }), nodesT = K.el('table', { style: 'font-size:12px' }), note = K.el('div', { class: 'hint' });
      const nodeDet = K.el('details', {}, K.el('summary', {}, 'node list with prizes and passages'), nodesT);
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: (1) The prize here is 10 x (personalised-PageRank score / best score), seeds = the linked entities, NOT the paper\'s cosine-similarity top-k prizes. (2) Edge cost 1, one cluster, strong pruning, one setting, untuned; G-Retriever tunes k and C_e per dataset. (3) The run stores the chosen node names only: lines drawn are all graph edges between those nodes (a tree uses n-1 of them), and prizes are known only for the 10 best PageRank nodes of each question, the rest show "below top 10". (4) The graph is noisy: LLM extraction, 662 nodes, near-duplicates such as "SVM" and "support vector machines" stay separate. (5) Demo scale: 24 questions, not an evaluation; across the 20 answerable questions the subgraphs hold all gold passages for 14. Text: Wikipedia contributors, CC BY-SA 4.0.');
      function draw() {
        const id = sel.value, q = QS[id], r = pc.questions[id], ppq = pp.questions[id], kq = KH[id];
        const nodes = r.nodes.map(n => byName[n]).filter(Boolean), set = new Set(nodes.map(n => n.id));
        const pairs = []; const seen = new Set();
        g.edges.forEach(e => { if (set.has(e.source) && set.has(e.target) && e.source !== e.target) { const k = [e.source, e.target].sort().join(); if (!seen.has(k)) { seen.add(k); pairs.push([e.source, e.target, e.relation]); } } });
        const mx = ppq.top_nodes.length ? ppq.top_nodes[0].score : 1, pr = {}; ppq.top_nodes.forEach(t => { pr[t.id] = 10 * t.score / mx; });
        const seeds = new Set(ppq.seeds.map(s => s.id)), pos = layout(nodes.map(n => n.id), pairs, W, H);
        svg.replaceChildren(...pairs.map(([a, b]) => K.svg('line', { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1], stroke: 'var(--ai)', 'stroke-width': 2.5, opacity: 0.8 })),
          ...nodes.flatMap(n => { const [x, y] = pos[n.id], p = pr[n.id];
            return [K.svg('circle', { cx: x, cy: y, r: p ? 6 + p * 1.3 : 6, fill: seeds.has(n.id) ? 'var(--ai)' : p ? 'var(--he)' : 'var(--faint)', stroke: seeds.has(n.id) ? 'var(--text)' : 'none', 'stroke-width': 2 }),
              K.svg('text', { x, y: y - 10 - (p ? p * 1.3 : 0), 'text-anchor': 'middle', 'font-size': 10 }, n.name.length > 24 ? n.name.slice(0, 22) + '..' : n.name)]; }));
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold passages: ${q.gold_passages.join(', ') || 'none'}. Seeds (linked entities, ringed): ${ppq.seeds.map(s => s.name).join(', ')}.`));
        const hop = kq && kq.steps;
        const row = (name, nn, pass, gold, ok) => K.el('tr', {}, K.el('td', {}, name), K.el('td', { class: 'num' }, nn), K.el('td', { class: 'num' }, pass), K.el('td', { class: ok === false ? 'bad' : ok ? 'good' : '' }, gold));
        const gl = st => st.gold_found.length + ' of ' + q.gold_passages.length;
        stats.replaceChildren(K.el('tr', {}, ...['method', 'nodes', 'passages', 'gold found'].map(h => K.el('th', {}, h))),
          row('PCST (this page)', r.n_nodes, r.passages, q.gold_passages.length ? (r.gold_found.length + ' of ' + q.gold_passages.length) : 'no gold (unanswerable)', q.gold_passages.length ? r.all_gold : null),
          ...(hop ? hop.slice(1).map(s => row(`k-hop, k = ${s.hop}`, s.cumulative_nodes, s.cumulative_passages, q.gold_passages.length ? gl(s) : 'no gold', q.gold_passages.length ? s.all_gold : null)) : []));
        const sz = hop ? hop[2].cumulative_nodes : 0;
        note.textContent = `${r.n_nodes} nodes and ${r.n_edges} tree edges; ${r.seeds_in_subgraph} of ${r.n_seeds} seeds are inside. 2-hop expansion would be ${sz} nodes (${hop ? Math.round(sz / r.n_nodes) : '?'} times larger). ` +
          (q.gold_passages.length ? (r.all_gold ? 'All gold passages are reachable from the chosen nodes.' : 'Not all gold passages are reachable from the chosen nodes: the small subgraph can drop evidence.') : 'Unanswerable question: PCST still returns a subgraph; it cannot say "I do not know".');
        nodesT.replaceChildren(K.el('tr', {}, ...['node', 'type', 'prize', 'in n passages'].map(h => K.el('th', {}, h))),
          ...nodes.map(n => K.el('tr', {}, K.el('td', {}, n.name + (seeds.has(n.id) ? ' (seed)' : '')), K.el('td', {}, n.type), K.el('td', { class: 'num' }, n.id in pr ? K.fmt(pr[n.id], 2) : 'below top 10'), K.el('td', { class: 'num' }, n.n_passages))));
      }
      sel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', {}, 'question ', sel)), info, svg,
        K.el('div', { class: 'hint' }, 'Amber ring = seed entity, teal = in the PageRank top 10 (bigger = bigger prize), grey = prize not stored (connector or low prize).'), note, stats, nodeDet, cav);
      draw();
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

  const api = { defaults, compute, mount, solve };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['pcst_gretriever'] = api;
})(this);
