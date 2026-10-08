/* Personalized PageRank (HippoRAG): pi = alpha*s + (1-alpha)*pi*P, solved here in closed form and by power iteration.
   Click a node to make it a seed (seeds share the restart mass equally, as in HippoRAG). Toggle edges, move alpha, step the walk.
   Node H (the "hub") is hidden until you press the hub preset. Graph and numbers are invented toy data. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const NAMES = 'ABCDEFH';
  const ALL = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]];
  const BASE = ALL.slice(0, 7).map(e => e.join('-'));
  const HUB = ALL.slice(7).map(e => e.join('-'));
  const defaults = { n: 6, edges: BASE.slice(), seeds: [0], alpha: 0.5 };

  function matP(inp) {
    const n = inp.n, A = Array.from({ length: n }, () => new Array(n).fill(0));
    inp.edges.forEach(k => { const [a, b] = k.split('-').map(Number); if (a < n && b < n) A[a][b] = A[b][a] = 1; });
    return A.map(r => { const d = r.reduce((x, y) => x + y, 0); return r.map(x => d ? x / d : 0); });
  }
  const seedVec = inp => { const s = new Array(inp.n).fill(0); inp.seeds.filter(i => i < inp.n).forEach(i => { s[i] = 1 / inp.seeds.filter(j => j < inp.n).length; }); return s; };

  /* PURE. Closed form pi = alpha * s (I - (1-alpha)P)^-1, by Gauss-Jordan on M = I - (1-alpha)P  (pi M = alpha s  <=>  M^T pi^T = alpha s^T). */
  function compute(inp) {
    const n = inp.n, P = matP(inp), s = seedVec(inp), a = inp.alpha;
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - (1 - a) * P[j][i]).concat(a * s[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /* power iteration history: h[0] = s, h[t+1] = alpha*s + (1-alpha) h[t] P */
  function history(inp, T) {
    const n = inp.n, P = matP(inp), s = seedVec(inp), a = inp.alpha; let pi = s.slice(); const h = [pi];
    for (let t = 0; t < T; t++) { pi = pi.map((_, v) => a * s[v] + (1 - a) * pi.reduce((acc, x, u) => acc + x * P[u][v], 0)); h.push(pi); }
    return h;
  }

  const POS = [[40, 150], [105, 60], [105, 240], [195, 150], [195, 240], [270, 190], [150, 20]];
  const PRESETS = {
    'worked example (seed A, alpha 0.5)': () => ({ n: 6, edges: BASE.slice(), seeds: [0], alpha: 0.5 }),
    'alpha 0.95 (stays at the seed)': () => ({ n: 6, edges: BASE.slice(), seeds: [0], alpha: 0.95 }),
    'alpha 0.05 (wanders far)': () => ({ n: 6, edges: BASE.slice(), seeds: [0], alpha: 0.05 }),
    'break it 1: add a hub H': () => ({ n: 7, edges: BASE.concat(HUB), seeds: [0], alpha: 0.5 }),
    'break it 2: wrong seed (F)': () => ({ n: 6, edges: BASE.slice(), seeds: [5], alpha: 0.5 }),
  };

  function mountToy(el) {
    const K = DemoKit; let st = JSON.parse(JSON.stringify(defaults)), t = 30;
    const shell = el;
    shell.append(K.el('p', { class: 'hint' }, 'Toy example, ours: a 6-node invented graph (not the real one). A random walker restarts at the seed with probability alpha, else walks along a random edge. Click a node to make it a seed, toggle edges, move alpha, and step the walk. Then press a "break it" preset.'));
    const svg = K.svg('svg', { viewBox: '0 0 310 295', role: 'img', 'aria-label': 'small graph', style: 'width:100%;max-width:440px;display:block;margin:0 auto' });
    const eg = K.svg('g', {}), ng = K.svg('g', {}); svg.append(eg, ng);
    const alS = K.slider('alpha (restart)', 0.05, 0.95, 0.05, st.alpha, v => { st.alpha = v; render(); });
    const tS = K.slider('walk step t', 0, 30, 1, t, v => { t = v; render(); });
    const play = K.el('button', {}, 'play walk'); let timer;
    play.addEventListener('click', () => { clearInterval(timer); let k = 0; tS.set(0); t = 0; render(); timer = setInterval(() => { k++; tS.set(k); t = k; render(); if (k >= 30) clearInterval(timer); }, 260); });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(nm => {
      const b = K.el('button', {}, nm); b.addEventListener('click', () => { st = PRESETS[nm](); alS.set(st.alpha); render(); }); return b; }));
    const chips = K.el('div', { class: 'row' }, K.el('span', { class: 'hint' }, 'edges:'));
    const chipEls = {};
    ALL.forEach(e => { const k = e.join('-'); const b = K.el('button', { 'aria-pressed': 'true', title: 'toggle edge' }, NAMES[e[0]] + '-' + NAMES[e[1]]);
      b.addEventListener('click', () => { const i = st.edges.indexOf(k); if (i >= 0) st.edges.splice(i, 1); else st.edges.push(k); render(); }); chipEls[k] = b; chips.append(b); });
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const tbl = K.el('table', { style: 'font-size:12px' });
    const formula = K.el('div', { class: 'formula' });
    const nodeEls = [], barEls = [];
    for (let i = 0; i < 7; i++) {
      const g = K.svg('g', { tabindex: 0, role: 'button', 'aria-label': 'node ' + NAMES[i], style: 'cursor:pointer;outline:none' });
      const c = K.svg('circle', { r: 17, 'stroke-width': 3 }), tx = K.svg('text', { 'text-anchor': 'middle', dy: 4, style: 'pointer-events:none;font-weight:700' }, NAMES[i]);
      const v = K.svg('text', { 'text-anchor': 'middle', dy: i === 6 ? -24 : 32, style: 'font-size:11px;fill:var(--muted);pointer-events:none' });
      g.append(c, tx, v); ng.append(g); nodeEls.push({ g, c, tx, v });
      const tog = () => { const k = st.seeds.indexOf(i); if (k >= 0) st.seeds.splice(k, 1); else st.seeds.push(i); render(); };
      g.addEventListener('click', tog); g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tog(); nodeEls[i].g.focus(); } });
    }
    const bars = K.el('div', { style: 'display:flex;align-items:flex-end;gap:8px;height:150px;margin:8px 0' });
    for (let i = 0; i < 7; i++) { const b = K.el('div', { style: 'flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0' });
      const bar = K.el('div', { style: 'width:100%;max-width:38px;background:var(--he);border-radius:3px 3px 0 0;height:2px' }), lb = K.el('div', { class: 'num', style: 'font-size:11px;color:var(--muted)' });
      b.append(K.el('div', { class: 'num', style: 'font-size:11px' }), bar, lb); bars.append(b); barEls.push({ b, bar, lb, val: b.firstChild }); }
    shell.append(presets, K.el('div', { class: 'row' }, alS.node, tS.node, play), svg, chips, bars, verdict, tbl, formula);

    function render() {
      const n = st.n, hist = history(st, 30), cur = hist[t], fin = compute(st);
      const mx = Math.max(...fin, 0.001);
      eg.replaceChildren();
      ALL.forEach(e => { const k = e.join('-'), on = st.edges.includes(k), vis = e[0] < n && e[1] < n;
        chipEls[k].style.display = vis ? '' : 'none'; chipEls[k].setAttribute('aria-pressed', on);
        if (vis && on) eg.append(K.svg('line', { x1: POS[e[0]][0], y1: POS[e[0]][1], x2: POS[e[1]][0], y2: POS[e[1]][1], stroke: e[0] === 6 ? 'var(--warn)' : 'var(--k12)', 'stroke-width': 2.5 })); });
      for (let i = 0; i < 7; i++) {
        const ne = nodeEls[i], vis = i < n, seed = st.seeds.includes(i) && vis;
        ne.g.style.display = vis ? '' : 'none'; if (!vis) { barEls[i].b.style.display = 'none'; continue; }
        ne.g.setAttribute('transform', `translate(${POS[i][0]} ${POS[i][1]})`);
        ne.c.setAttribute('fill', seed ? 'var(--ai)' : `rgba(242,169,59,${(0.12 + 0.85 * Math.min(1, cur[i] * 1.6)).toFixed(2)})`);
        ne.c.setAttribute('stroke', i === 6 ? 'var(--warn)' : seed ? 'var(--ai)' : 'var(--k12)');
        ne.tx.style.fill = seed ? '#0B0D12' : 'var(--text)'; ne.v.textContent = K.fmt(cur[i], 3);
        ne.g.setAttribute('aria-pressed', seed); ne.g.setAttribute('aria-label', `node ${NAMES[i]}${seed ? ', seed' : ''}, score ${K.fmt(cur[i], 3)}`);
        const be = barEls[i]; be.b.style.display = ''; be.bar.style.height = Math.max(2, cur[i] * 110 / Math.max(mx, 0.3)) + 'px';
        be.bar.style.background = i === 6 ? 'var(--warn)' : 'var(--he)'; be.val.textContent = K.fmt(cur[i], 3); be.lb.textContent = NAMES[i];
      }
      const order = fin.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => NAMES[x[1]]);
      const seeds = st.seeds.filter(i => i < n);
      const diff = Math.max(...cur.map((v, i) => Math.abs(v - fin[i])));
      verdict.replaceChildren(K.el('span', {}, 'final ranking: ', K.el('b', { class: 'good' }, seeds.length ? order.join(' > ') : '(no seed: click a node)')),
        K.el('span', { class: 'hint' }, `sum of scores ${K.fmt(cur.reduce((a, b) => a + b, 0), 3)}; gap to the closed form at step ${t}: ${K.fmt(diff, 4)}`),
        ...(st.n === 7 && seeds.length ? [K.el('b', { class: order.indexOf('H') < 4 ? 'bad' : 'good' }, order.indexOf('H') < 4 ? 'hub H is linked to everything and climbs the ranking' : 'hub H is low')] : []),
        ...(seeds.length && !seeds.includes(0) ? [K.el('b', { class: 'bad' }, `seed is ${seeds.map(i => NAMES[i]).join(',')}: ranking follows the seed, not the question`)] : []));
      const P = matP(st), s = seedVec(st), a = st.alpha;
      tbl.replaceChildren(K.el('tr', {}, ...['node', 'degree', 'restart a*s', 'walked in (1-a)*sum', 'score at step ' + t, 'final'].map(h => K.el('th', { style: 'padding:3px;font-size:12px' }, h))),
        ...cur.map((v, i) => { if (t === 0) return K.el('tr', {}, K.el('td', {}, NAMES[i]), K.el('td', { class: 'num' }, String(st.edges.filter(k => k.split('-').map(Number).includes(i) && k.split('-').every(x => +x < n)).length)), K.el('td', { class: 'num' }, '-'), K.el('td', { class: 'num' }, '-'), K.el('td', { class: 'num good' }, K.fmt(v, 3)), K.el('td', { class: 'num' }, K.fmt(fin[i], 3)));
          const prev = hist[t - 1], walk = (1 - a) * prev.reduce((acc, x, u) => acc + x * P[u][i], 0);
          return K.el('tr', {}, K.el('td', { style: 'font-weight:600' }, NAMES[i]), K.el('td', { class: 'num' }, String(P[i].filter(x => x > 0).length)), K.el('td', { class: 'num' }, K.fmt(a * s[i], 3)), K.el('td', { class: 'num' }, K.fmt(walk, 3)), K.el('td', { class: 'num good' }, K.fmt(v, 3)), K.el('td', { class: 'num' }, K.fmt(fin[i], 3))); }));
      const i0 = seeds.length ? seeds[0] : 0, pv = t ? hist[t - 1] : null;
      formula.textContent = t && seeds.length ? `step ${t}, node ${NAMES[i0]}:  ${K.fmt(a, 2)} x ${K.fmt(s[i0], 3)} + ${K.fmt(1 - a, 2)} x (sum of neighbours' share) = ${K.fmt(a * s[i0], 3)} + ${K.fmt((1 - a) * pv.reduce((acc, x, u) => acc + x * P[u][i0], 0), 3)} = ${K.fmt(cur[i0], 3)}\n` +
        'pi = alpha*s + (1-alpha)*pi*P.  Large alpha: stays near the seed. Small alpha: wanders far. Scores are relative: take the top-k.' : 'step 0: pi = s (all mass on the seeds). Move the step slider or press play.';
    }
    render();
  }

  /* ---------- real example: PURE helpers (no DOM) ---------- */
  /* buildGraph(graph.json): undirected, duplicate edges merged (762 directed edges -> 745 pairs), as networkx.Graph does. */
  function buildGraph(g) {
    const idx = {}; g.nodes.forEach((n, i) => { idx[n.id] = i; });
    const sets = g.nodes.map(() => new Set());
    g.edges.forEach(e => { const a = idx[e.source], b = idx[e.target]; if (a !== b) { sets[a].add(b); sets[b].add(a); } });
    /* passages attached to a node = where it was extracted + passages of every edge touching it (pack rule, build/_graph.py) */
    const np = g.nodes.map(n => new Set(n.passages));
    g.edges.forEach(e => { (e.passages || []).forEach(p => { np[idx[e.source]].add(p); np[idx[e.target]].add(p); }); });
    const pn = {}; np.forEach((ps, i) => ps.forEach(p => { (pn[p] = pn[p] || []).push(i); }));
    return { n: g.nodes.length, idx, nbrs: sets.map(s => Array.from(s)), passNodes: pn };
  }
  /* PURE. Power iteration: pi <- r*s + (1-r)*(pi P + dangling mass on s), stop at L1 change 1e-12 (same rule as the pack). */
  function pprReal(G, seedIdx, restart) {
    const n = G.n, s = new Float64Array(n); if (!seedIdx.length) return { pi: s, iters: 0 };
    seedIdx.forEach(i => { s[i] = 1 / seedIdx.length; });
    let pi = Float64Array.from(s), it = 0;
    for (; it < 1000; it++) {
      const nx = new Float64Array(n); let dang = 0;
      for (let u = 0; u < n; u++) { const d = G.nbrs[u].length; if (!pi[u]) continue; if (!d) { dang += pi[u]; continue; } const sh = pi[u] / d; for (const v of G.nbrs[u]) nx[v] += sh; }
      let l1 = 0; for (let v = 0; v < n; v++) { nx[v] = restart * s[v] + (1 - restart) * (nx[v] + dang * s[v]); l1 += Math.abs(nx[v] - pi[v]); }
      pi = nx; if (l1 < 1e-12) { it++; break; }
    }
    return { pi, iters: it };
  }
  /* passage score = sum of the node scores of the nodes attached to the passage (the pack's rule) */
  function passageScores(G, pi) {
    return Object.entries(G.passNodes).map(([id, ns]) => ({ id, score: ns.reduce((a, i) => a + pi[i], 0) })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  }
  const computeReal = { buildGraph, pprReal, passageScores };

  function mountReal(box) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const body = K.el('div', {}, 'loading real data (662-node graph)...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all(['graph/graph.json', 'graph/ppr.json', 'data/questions.json', 'data/corpus.json', 'runs/ppr_graph.json', 'runs/dense_cosine.json', 'runs/metrics_by_method.json'].map(get)).then(([graph, ppr, qs, corpus, runP, runD, met]) => {
      body.replaceChildren();
      const G = buildGraph(graph), nodes = graph.nodes, Q = {}, text = {}, art = {};
      qs.forEach(q => { Q[q.id] = q; }); corpus.forEach(c => { text[c.id] = c.text; art[c.id] = c.article; });
      const rankOf = (run, qid, pid) => { const r = run.questions.find(x => x.qid === qid).ranking; const i = r.findIndex(x => x.id === pid); return i < 0 ? null : i + 1; };
      const STORED = ppr.restart;
      let qid = 'q09', seeds = [], alpha = STORED, openP = null;
      const seedsOf = id => (ppr.questions[id].seeds || []).map(s => G.idx[s.id]);
      const mp = met.methods.ppr_graph, md = met.methods.dense_cosine;
      body.append(K.el('p', { class: 'hint' }, `Real run, demo scale: 24 helper-written questions over 138 Wikipedia passages (ridge regression, lasso, elastic net and neighbours); the graph (662 nodes, 762 relations) was extracted by a language model. Seeds are the entities linked from the question (the pack's linking step), they share the restart mass equally. Node scores below are recomputed here by power iteration on the same graph; at restart ${STORED} with the stored seeds they match the pack's networkx check. A passage scores the sum of the PPR scores of its nodes (a stand-in rule: it favours passages with many entities). Gold passages cover only the necessary passages. 20 answerable questions: one question is worth 0.05.`));
      body.append(K.el('p', { class: 'hint' }, K.el('b', {}, 'Honest headline: '), K.el('span', {}, `PPR alone is worse than dense search here. recall@5 ${K.fmt(mp['recall@5'], 3)} vs ${K.fmt(md['recall@5'], 3)}, MRR ${K.fmt(mp.mrr, 3)} vs ${K.fmt(md.mrr, 3)}, nDCG@5 ${K.fmt(mp['ndcg@5'], 3)} vs ${K.fmt(md['ndcg@5'], 3)}. Its only edge is bridge-question MRR, within noise. Its value is the second hop: it reaches passages the question never mentions, and it can be added to dense search.`)));
      const sel = K.el('select', { 'aria-label': 'question' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question}`)));
      sel.value = qid; sel.style.maxWidth = '100%';
      const aS = K.slider('restart alpha', 0.05, 0.95, 0.05, alpha, v => { alpha = v; render(); });
      const reset = K.el('button', {}, `reset seeds, alpha ${STORED}`);
      const PRE = [['q09: the second gold passage is 11th', 'q09'], ['q06: PPR loses to dense (gold 8th vs 1st)', 'q06'], ['q01: easy single-hop', 'q01'], ['q22: no seed, empty ranking', 'q22']];
      const pre = K.el('div', { class: 'row' }, ...PRE.map(([l, id]) => { const b = K.el('button', {}, l); b.addEventListener('click', () => { qid = id; sel.value = id; seeds = seedsOf(id); alpha = STORED; aS.set(STORED); render(); }); return b; }));
      const chips = K.el('div', { class: 'row' });
      const dl = K.el('datalist', { id: 'ppr-nodes' }, ...nodes.map(n => K.el('option', { value: n.name })));
      const addIn = K.el('input', { type: 'text', list: 'ppr-nodes', placeholder: 'add a seed: type a node name', 'aria-label': 'add a seed node', style: 'min-width:200px;max-width:100%' });
      const addB = K.el('button', {}, 'add seed');
      const addSeed = () => { const i = nodes.findIndex(n => n.name === addIn.value.trim()); if (i >= 0 && !seeds.includes(i)) { seeds.push(i); addIn.value = ''; render(); } };
      addB.addEventListener('click', addSeed); addIn.addEventListener('keydown', e => { if (e.key === 'Enter') addSeed(); });
      const qline = K.el('div', { class: 'hint', 'aria-live': 'polite' }), verify = K.el('div', { class: 'hint' }), verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
      const nodeBox = K.el('div'), passBox = K.el('div'), detail = K.el('div', { class: 'hint' }), formula = K.el('div', { class: 'formula' });
      sel.addEventListener('change', () => { qid = sel.value; seeds = seedsOf(qid); alpha = STORED; aS.set(STORED); render(); });
      reset.addEventListener('click', () => { seeds = seedsOf(qid); alpha = STORED; aS.set(STORED); render(); });
      body.append(pre, K.el('div', { class: 'row' }, sel), K.el('div', { class: 'row' }, aS.node, reset), chips, K.el('div', { class: 'row' }, addIn, addB, dl), qline, verify, verdict, K.el('h4', {}, 'PPR score per node (top 12)'), nodeBox, K.el('h4', {}, 'Passages scored through their nodes (top 10)'), passBox, detail, formula);
      const bar = (w, col) => K.el('div', { style: `height:10px;border-radius:3px;background:${col};width:${Math.max(1, Math.min(100, w))}%` });

      function render() {
        const q = Q[qid], gold = q.gold_passages, t0 = performance.now();
        const { pi, iters } = pprReal(G, seeds, alpha);
        const ms = performance.now() - t0, ps = passageScores(G, pi);
        qline.replaceChildren(K.el('b', {}, qid + ': '), q.question, `  (gold ${gold.length ? gold.join(', ') : 'none, unanswerable'}; reference answer: ${q.gold_answer || 'n/a'})`);
        chips.replaceChildren(K.el('span', { class: 'hint' }, 'seeds (click to remove):'), ...seeds.map(i => { const b = K.el('button', { 'aria-pressed': 'true', title: 'remove this seed' }, nodes[i].name + ' x'); b.addEventListener('click', () => { seeds = seeds.filter(j => j !== i); render(); }); return b; }), ...(seeds.length ? [] : [K.el('span', { class: 'bad' }, 'no seed: no walk, empty ranking (a miss)')]));
        // verification against the pack
        const sameSeeds = seeds.length === seedsOf(qid).length && seedsOf(qid).every(i => seeds.includes(i));
        if (sameSeeds && Math.abs(alpha - STORED) < 1e-9 && seeds.length) {
          const st = ppr.questions[qid].top_nodes; const d = Math.max(...st.map(x => Math.abs(pi[G.idx[x.id]] - x.score)));
          const sr = runP.questions.find(x => x.qid === qid).ranking, dp = Math.max(0, ...sr.slice(0, 10).map((x, i) => Math.abs((ps[i] || { score: 0 }).score - x.score))), same = sr.slice(0, 10).every((x, i) => ps[i] && ps[i].id === x.id);
          verify.replaceChildren(`Check against the pack (stored top ${st.length} node scores, rounded to 6 decimals): max difference ${d.toExponential(1)}; stored top-10 passage list: same order ${same ? 'yes' : 'no'}, max score difference ${dp.toExponential(1)}; ${iters} power iterations in ${K.fmt(ms, 1)} ms. The pack's networkx cross-check over all questions: ${ppr.max_abs_diff_power_vs_networkx.toExponential(1)}.`);
        } else verify.replaceChildren(seeds.length ? `Seeds or alpha changed: this is no longer the stored run (${iters} iterations, ${K.fmt(ms, 1)} ms). The stored run is restart ${STORED} with the linked seeds.` : '');
        // nodes
        const order = Array.from(pi.keys()).sort((a, b) => pi[b] - pi[a]).slice(0, 12), mx = Math.max(pi[order[0]] || 0, 1e-9);
        nodeBox.replaceChildren(...order.filter(i => pi[i] > 0).map(i => K.el('div', { style: 'display:grid;grid-template-columns:minmax(90px,36%) 1fr 56px;gap:6px;align-items:center;font-size:12px' }, K.el('span', { class: seeds.includes(i) ? 'good' : '', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title: nodes[i].name + ' (' + nodes[i].type + ')' }, (seeds.includes(i) ? '[seed] ' : '') + nodes[i].name), bar(100 * pi[i] / mx, seeds.includes(i) ? 'var(--ai)' : 'var(--he)'), K.el('span', { class: 'num' }, K.fmt(pi[i], 4)))));
        // passages
        const top = ps.slice(0, 10), mp1 = top.length ? top[0].score : 1;
        passBox.replaceChildren(...top.map((p, k) => { const g = gold.includes(p.id);
          const row = K.el('button', { style: 'display:grid;grid-template-columns:28px 52px 1fr 54px;gap:6px;align-items:center;font-size:12px;width:100%;text-align:left;padding:2px 4px;' + (g ? 'border-color:var(--he)' : '') , 'aria-label': `rank ${k + 1} passage ${p.id}${g ? ', gold' : ''}, score ${K.fmt(p.score, 3)}` },
            K.el('span', { class: 'num' }, '#' + (k + 1)), K.el('b', { class: g ? 'good' : '' }, p.id + (g ? ' *' : '')), bar(100 * p.score / mp1, g ? 'var(--he)' : 'var(--k12)'), K.el('span', { class: 'num' }, K.fmt(p.score, 3)));
          row.addEventListener('click', () => { openP = p.id; showDetail(); }); return row; }));
        function showDetail() { if (!openP) { detail.textContent = 'Click a passage to read it. * = gold.'; return; } const r = ps.findIndex(x => x.id === openP) + 1; detail.replaceChildren(K.el('b', {}, `${openP} (${art[openP]}), PPR rank ${r || 'unscored'}${gold.includes(openP) ? ', gold' : ''}: `), (text[openP] || '').slice(0, 420) + ((text[openP] || '').length > 420 ? '...' : '')); }
        showDetail();
        // verdict: gold ranks live vs dense
        const gr = gold.map(id => { const r = ps.findIndex(x => x.id === id) + 1; return { id, ppr: r || null, dense: rankOf(runD, qid, id) }; });
        verdict.replaceChildren(...(gold.length ? [K.el('span', {}, 'gold passage ranks, PPR (live) vs dense (stored): '), ...gr.map(x => K.el('b', { class: x.ppr && x.ppr <= 5 ? 'good' : 'bad' }, `${x.id}: ${x.ppr || '>' + ps.length} vs ${x.dense || '>20'}`))] : [K.el('span', { class: 'hint' }, ps.length ? `unanswerable: PPR still returns ${ps[0].id} first (score ${K.fmt(ps[0].score, 3)}), so it does not reject the question either.` : 'unanswerable and no seed: nothing is returned, which is the right answer but only by accident of the missing link.')]));
        const s1 = seeds.length ? seeds[0] : null;
        formula.textContent = s1 === null ? 'pi = alpha*s + (1-alpha)*pi*P.  No seed, s is all zeros.' : `pi = alpha*s + (1-alpha)*pi*P, alpha ${K.fmt(alpha, 2)}, ${seeds.length} seed(s), each s = ${K.fmt(1 / seeds.length, 3)}.\nseed "${nodes[s1].name}": ${K.fmt(alpha, 2)} x ${K.fmt(1 / seeds.length, 3)} (restart) + walked-in mass = ${K.fmt(pi[s1], 4)}   (degree ${G.nbrs[s1].length}).\nA bigger alpha keeps mass at the seeds; a smaller one lets it reach the second hop, but the walk also drifts to hubs.`;
      }
      seeds = seedsOf(qid); render();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit;
    const shell = K.shell(el, 'Personalized PageRank (HippoRAG)', 'A random walker restarts at the seed entities with probability alpha, else follows a random edge; the entities it visits most are the relevant ones.');
    const real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', { 'aria-pressed': 'true' }, 'Real example'), b2 = K.el('button', { 'aria-pressed': 'false' }, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    shell.append(K.el('div', { class: 'row' }, b1, b2), real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, history, computeReal };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['personalized_pagerank'] = api;
})(this);
