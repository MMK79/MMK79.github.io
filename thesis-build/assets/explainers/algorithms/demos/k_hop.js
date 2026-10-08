/* k-hop / BFS expansion: walk k edges from the seed entities.
   Real example (default): the real 662-node LLM-extracted graph (138 Wikipedia passages), real seeds, BFS recomputed live from graph.json and checked against khop.json.
   Toy example (break it): toy graph (invented). Click a node to toggle it as a seed,
   move k, then press "break it" to add a hub. The marked "needed" nodes B, D, F (invented) show relevance versus noise. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const TOY = ['A-B', 'A-C', 'B-D', 'C-D', 'C-E', 'D-F', 'E-G', 'F-H', 'G-H', 'H-I'];
  const HUB_LINKS = ['A', 'E', 'G', 'I'], HUB_LEAVES = 12;
  const defaults = { edges: TOY, seeds: ['A'], k: 4, hub: false, need: ['B', 'D', 'F'] };

  function graph(inp) {
    const adj = {}; const add = (a, b) => { (adj[a] ||= new Set()).add(b); (adj[b] ||= new Set()).add(a); };
    inp.edges.forEach(e => { const [a, b] = e.split('-'); add(a, b); });
    if (inp.hub) { HUB_LINKS.forEach(v => add('Z', v)); for (let i = 1; i <= HUB_LEAVES; i++) add('Z', 'L' + i); }
    return adj;
  }
  /* PURE. BFS distances from the seed set (multi-source), never visiting a node twice. */
  function dist(adj, seeds, K) {
    const d = {}, q = [];
    seeds.forEach(s => { if (adj[s] && !(s in d)) { d[s] = 0; q.push(s); } });
    for (let h = 0; h < q.length; h++) {
      const u = q[h]; if (d[u] >= K) continue;
      [...adj[u]].sort().forEach(v => { if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } });
    }
    return d;
  }
  /* Returns |N_k| for k = 0..inp.k (cumulative). */
  function compute(inp) {
    const d = dist(graph(inp), inp.seeds, inp.k), out = [];
    for (let k = 0; k <= inp.k; k++) out.push(Object.values(d).filter(x => x <= k).length);
    return out;
  }
  /* our own growth estimate (not from a source): sum_{i<=k} dbar^i */
  const estimate = (dbar, k) => { let s = 0; for (let i = 0; i <= k; i++) s += Math.pow(dbar, i); return s; };
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* same recipe as the video (10,000 nodes, 30,000 edges, BFS from node 0) but another random generator, so counts differ a little */
  function bigGrowth(seed) {
    const n = 10000, m = 30000, r = mulberry(seed), adj = Array.from({ length: n }, () => new Set()); let e = 0;
    while (e < m) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b && !adj[a].has(b)) { adj[a].add(b); adj[b].add(a); e++; } }
    const d = new Int8Array(n).fill(-1); d[0] = 0; const q = [0];
    for (let h = 0; h < q.length; h++) { const u = q[h]; if (d[u] >= 5) continue; adj[u].forEach(v => { if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } }); }
    const out = []; for (let k = 0; k <= 5; k++) { let c = 0; for (let i = 0; i < n; i++) if (d[i] >= 0 && d[i] <= k) c++; out.push(c); }
    return out;
  }

  const POS = { A: [30, 120], B: [80, 50], C: [80, 190], D: [140, 120], E: [140, 230], F: [200, 50], G: [200, 190], H: [260, 120], I: [320, 120], Z: [170, 40] };
  for (let i = 1; i <= HUB_LEAVES; i++) POS['L' + i] = [10 + (i - 1) * 29, 8 - (i % 2) * 0];
  const RC = ['var(--ai)', 'var(--k12)', 'var(--he)', 'var(--both)', 'var(--text)', 'var(--warn)'];

  function mountToy(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults)); let showEst = false;
    const shell = K.shell(el, 'k-hop expansion (BFS)', 'Click a node to make it a seed. Move k to walk further. Teal squares mark the nodes the answer needs (B, D, F: our invented question). Then press "break it".');
    const W = 350, H = 260;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'graph with BFS rings', style: 'width:100%;max-width:520px;display:block;margin:0 auto' });
    const eg = K.svg('g'), ng = K.svg('g'); svg.append(eg, ng);
    const kS = K.slider('k (hops)', 0, 5, 1, st.k, v => { st.k = v; render(); });
    const hubB = K.el('button', {}, 'break it: add a hub node (links to A, E, G, I and 12 unrelated leaves)');
    hubB.addEventListener('click', () => { st.hub = !st.hub; render(); });
    const resetB = K.el('button', {}, 'worked example'); resetB.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); kS.set(st.k); render(); });
    const estB = K.el('button', {}, 'show our estimate: (average degree)^k'); estB.addEventListener('click', () => { showEst = !showEst; render(); });
    const bigB = K.el('button', {}, 'big graph: 10,000 nodes'); let bigOut = null; bigB.addEventListener('click', () => { bigOut = bigGrowth(3); render(); });
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const bars = K.el('div'); const tbl = K.el('table', { style: 'font-size:12px' }); const formula = K.el('div', { class: 'formula' }); const big = K.el('div', { class: 'formula' });
    shell.append(K.el('div', { class: 'row' }, resetB, hubB, estB, bigB), K.el('div', { class: 'row' }, kS.node), svg, verdict, bars, tbl, formula, big);

    function render() {
      const adj = graph(st), d = dist(adj, st.seeds, st.k), nodes = Object.keys(adj);
      eg.replaceChildren(); ng.replaceChildren();
      const seen = new Set();
      nodes.forEach(a => adj[a].forEach(b => { const key = [a, b].sort().join(); if (seen.has(key)) return; seen.add(key);
        const lit = a in d && b in d, r = lit ? Math.max(d[a], d[b]) : -1;
        eg.append(K.svg('line', { x1: POS[a][0], y1: POS[a][1], x2: POS[b][0], y2: POS[b][1], stroke: lit ? RC[Math.min(r, 4)] : 'var(--line)', 'stroke-width': lit ? 3 : 2 })); }));
      nodes.forEach(v => {
        const [x, y] = POS[v], inside = v in d, isSeed = st.seeds.includes(v), leaf = v[0] === 'L';
        const g = K.svg('g', { tabindex: 0, role: 'button', 'aria-label': `node ${v}${isSeed ? ', seed' : ''}${inside ? ', ring ' + d[v] : ', outside'}`, 'aria-pressed': isSeed, style: 'cursor:pointer;outline:none' });
        if (st.need.includes(v)) g.append(K.svg('rect', { x: x - 11, y: y - 11, width: 22, height: 22, rx: 4, fill: 'none', stroke: 'var(--he)', 'stroke-width': 2 }));
        g.append(K.svg('circle', { cx: x, cy: y, r: leaf ? 5 : 8, fill: inside ? RC[Math.min(d[v], 4)] : 'var(--faint)' }));
        if (isSeed) g.append(K.svg('circle', { cx: x, cy: y, r: 13, fill: 'none', stroke: 'var(--ai)', 'stroke-width': 3 }));
        if (!leaf) g.append(K.svg('text', { x, y: y - 15, 'text-anchor': 'middle', 'font-size': 11 }, v));
        const tog = () => { const i = st.seeds.indexOf(v); if (i >= 0) { if (st.seeds.length > 1) st.seeds.splice(i, 1); } else st.seeds.push(v); render(); };
        g.addEventListener('click', tog); g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tog(); } });
        ng.append(g);
      });
      const sizes = compute({ ...st, k: 5 }).slice(0, 6), n = sizes[st.k], total = nodes.length;
      const ring = i => sizes[i] - (i ? sizes[i - 1] : 0);
      const found = st.need.filter(v => v in d).length, noise = n - found;
      const dbar = [...nodes].reduce((s, v) => s + adj[v].size, 0) / total;
      verdict.replaceChildren(K.el('span', {}, `|N_${st.k}| = `, K.el('b', { class: 'num' }, String(n)), ` of ${total} nodes   needed found: `, K.el('b', { class: 'good' }, `${found} of ${st.need.length}`), '   noise: ',
        K.el('b', { class: noise > found * 2 && noise >= 6 ? 'bad' : '' }, String(noise))));
      const mx = Math.max(...sizes);
      bars.replaceChildren(...sizes.map((c, i) => K.el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:12px;opacity:' + (i <= st.k ? 1 : 0.35) },
        K.el('span', { class: 'num', style: 'width:36px' }, `k=${i}`),
        K.el('span', { style: `display:inline-block;height:12px;width:${Math.max(2, 70 * c / mx)}%;background:${RC[Math.min(i, 4)]};border-radius:2px` }),
        K.el('span', { class: 'num' }, `${c} (+${ring(i)})` + (showEst ? `   our estimate ${K.fmt(estimate(dbar, i), 1)}` : '')))));
      tbl.replaceChildren(K.el('tr', {}, ...['ring', 'nodes at exactly this distance'].map(h => K.el('th', {}, h))),
        ...[...Array(st.k + 1).keys()].map(i => K.el('tr', {}, K.el('td', { class: 'num' }, i), K.el('td', { class: 'num' }, nodes.filter(v => d[v] === i).sort().join(' ') || '-'))));
      formula.textContent = `N_${st.k}(S) = { v : d(S,v) <= ${st.k} },  S = {${st.seeds.join(', ')}}   ->  ${n} nodes\n` +
        `average degree d-bar = ${K.fmt(dbar, 2)};  sum of d-bar^i for i <= ${st.k} = ${K.fmt(estimate(dbar, st.k), 1)}  (OUR OWN tree-like estimate, not from a source; real graphs have loops, so it can be far off)\n` +
        (st.hub ? 'Hub added: one step from A reaches it, and the next step pulls in all 12 leaves, which the question does not need.' : 'Seeds with many links, or a hub, make the set explode.');
      hubB.setAttribute('aria-pressed', st.hub); estB.setAttribute('aria-pressed', showEst);
      big.textContent = bigOut ? `random graph, 10,000 nodes, average degree 6, BFS from node 0 (this browser's random numbers; the video used Python seed 3):\n|N_k| for k = 0..5: ${bigOut.join(', ')}\nat 50 tokens per node (assumed): k=3 is ${bigOut[3] * 50} tokens, k=5 is ${bigOut[5] * 50} tokens` : '';
    }
    render();
  }

  /* PURE. BFS over the real graph (undirected), multi-source from seed ids, up to hop 3.
     A node's passages = where it was extracted + passages of every edge touching it (rule of the pack's _graph.py).
     Returns per hop: cumulative node ids, new node ids, cumulative passage set. */
  function realBfs(g, seedIds, K) {
    const adj = {}, P = {};
    g.nodes.forEach(n => { adj[n.id] = new Set(); P[n.id] = new Set(n.passages); });
    g.edges.forEach(e => { adj[e.source].add(e.target); adj[e.target].add(e.source); e.passages.forEach(p => { P[e.source].add(p); P[e.target].add(p); }); });
    const d = {}, q = []; seedIds.forEach(s => { d[s] = 0; q.push(s); });
    for (let h = 0; h < q.length; h++) { const u = q[h]; if (d[u] >= K) continue; adj[u].forEach(v => { if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } }); }
    const out = [];
    for (let k = 0; k <= K; k++) {
      const ids = Object.keys(d).filter(x => d[x] <= k), ps = new Set(); ids.forEach(i => P[i].forEach(p => ps.add(p)));
      out.push({ hop: k, nodes: ids.length, fresh: Object.keys(d).filter(x => d[x] === k), passages: ps });
    }
    return { dist: d, hops: out, deg: Object.fromEntries(Object.keys(adj).map(i => [i, adj[i].size])) };
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: k-hop expansion on a graph an LLM extracted from Wikipedia',
      'Real data: 138 passages from 15 English Wikipedia articles on machine learning, a 662-node, 762-edge graph extracted by an LLM (noisy: near-duplicate nodes, vague relations), 24 questions. The seeds are the entities linked to the question. This page walks the real graph by BFS, live, and compares with the stored run (khop.json). "Passages reached" = passages attached to the reached nodes.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/graph.json'), get('graph/khop.json'), get('graph/entity_linking.json'), get('data/corpus.json')]).then(([g, kh, el_, corpus]) => {
      const N = {}; g.nodes.forEach(n => N[n.id] = n);
      const art = {}; corpus.forEach(p => art[p.id] = p.article);
      const NP = corpus.length, Q = el_.questions, KQ = {}; kh.questions.forEach(q => KQ[q.qid] = q);
      const ids = Object.keys(Q);
      const cache = {}; const run = qid => cache[qid] ||= realBfs(g, KQ[qid].seeds.map(s => s.id), 3);
      /* live check against the stored run, for every question with seeds */
      let match = 0, tot = 0;
      kh.questions.forEach(q => { if (!q.seeds.length) return; const r = run(q.qid); q.steps.forEach(s => { tot++; if (r.hops[s.hop].nodes === s.cumulative_nodes && r.hops[s.hop].passages.size === s.cumulative_passages) match++; }); });
      /* mean growth over the questions with seeds, recomputed here */
      const withSeeds = kh.questions.filter(q => q.seeds.length), mean = h => withSeeds.reduce((a, q) => a + run(q.qid).hops[h].nodes, 0) / withSeeds.length, meanP = h => withSeeds.reduce((a, q) => a + run(q.qid).hops[h].passages.size, 0) / withSeeds.length;
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%;width:100%' }, ...ids.map(i => K.el('option', { value: i }, `${i} (${Q[i].type}): ${Q[i].question.slice(0, 64)}`)));
      const CASES = [['q12', 'second gold only at hop 2'], ['q10', 'one seed, tiny start'], ['q09', 'all gold at hop 0'], ['q13', 'second gold never reached'], ['q21', 'unanswerable, still expands'], ['q22', 'no seed']];
      let hop = 2, qid = 'q12'; sel.value = qid;
      const hopS = K.slider('hops k', 0, 3, 1, hop, v => { hop = v; draw(); });
      const caseRow = K.el('div', { class: 'row' }, K.el('span', { class: 'hint' }, 'jump to: '), ...CASES.map(c => { const b = K.el('button', {}, `${c[0]} ${c[1]}`); b.addEventListener('click', () => { qid = c[0]; sel.value = qid; draw(); }); return b; }));
      sel.addEventListener('change', () => { qid = sel.value; draw(); });
      const qbox = K.el('div', { style: 'font-size:15px;margin:8px 0' }), seedBox = K.el('div', {}), verdict = K.el('div', { 'aria-live': 'polite', class: 'row' }), bars = K.el('div'), tbl = K.el('div', { style: 'overflow-x:auto' }), goldBox = K.el('div', {}), agg = K.el('div', { class: 'formula' });
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: demo scale (138 passages, 24 questions written by Claude from the corpus, not a benchmark, NOT an evaluation of the thesis system). The graph is LLM-extracted and not checked against a human gold graph; near-duplicates remain ("SVM" and "support vector machine" are separate nodes). "Reachable" means a gold passage is attached to a node within k hops; it does not say the passage would rank high. "Noise" = passages reached that are not gold; gold labels cover only the passages judged necessary, so other reached passages may also be useful (noise is an upper bound). Passage names: Wikipedia contributors, CC BY-SA 4.0.');
      function draw() {
        const q = Q[qid], kq = KQ[qid], r = run(qid), gold = q.gold, answerable = gold.length > 0;
        qbox.replaceChildren(K.el('b', {}, qid + ' '), q.question, K.el('span', { class: 'hint' }, `   [${q.type}; gold passages: ${gold.join(', ') || 'none (unanswerable)'}]`));
        seedBox.replaceChildren(K.el('span', { class: 'hint' }, 'real seeds (linked entities, hop 0): '), kq.seeds.length ? kq.seeds.map(s => K.el('span', { class: 'num', style: 'margin-right:8px;border:1px solid var(--ai);border-radius:10px;padding:0 6px' }, `${s.name} (${r.deg[s.id]} links)`)) : K.el('b', { class: 'bad' }, 'no entity linked: nothing to expand from (the expansion is empty, so this question is a miss for graph retrieval)'));
        if (!kq.seeds.length) { verdict.replaceChildren(); bars.replaceChildren(); tbl.replaceChildren(); goldBox.replaceChildren(); return; }
        const H = r.hops, cur = H[hop], reachedAt = p => { const i = H.findIndex(h => h.passages.has(p)); return i; };
        const goldIn = gold.filter(p => cur.passages.has(p)), noise = cur.passages.size - goldIn.length;
        const stored = kq.steps[hop], same = stored.cumulative_nodes === cur.nodes && stored.cumulative_passages === cur.passages.size;
        verdict.replaceChildren(K.el('span', {}, `after ${hop} hop(s): `, K.el('b', { class: 'num' }, String(cur.nodes)), ' nodes, ', K.el('b', { class: 'num' }, String(cur.passages.size)), ` of ${NP} passages (${K.fmt(100 * cur.passages.size / NP, 1)}%)   gold found: `, K.el('b', { class: answerable && goldIn.length < gold.length ? 'bad' : 'good' }, answerable ? `${goldIn.length} of ${gold.length}` : 'n/a'), '   noise passages: ', K.el('b', { class: noise > 40 ? 'bad' : '' }, String(noise)), '   ', K.el('span', { class: 'hint' }, same ? '(live BFS = stored khop.json)' : '(MISMATCH with khop.json)')));
        const mx = Math.max(...H.map(h => h.passages.size), 1);
        bars.replaceChildren(...H.map((h, i) => K.el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:12px;opacity:' + (i <= hop ? 1 : 0.35) },
          K.el('span', { class: 'num', style: 'width:36px' }, `k=${i}`),
          K.el('span', { style: `display:inline-block;height:12px;width:${Math.max(2, 60 * h.passages.size / mx)}%;background:${RC[Math.min(i, 4)]};border-radius:2px` }),
          K.el('span', { class: 'num' }, `${h.nodes} nodes (+${h.fresh.length}), ${h.passages.size} passages`))));
        const names = h => h.fresh.slice().sort((a, b) => r.deg[b] - r.deg[a]).slice(0, 8).map(i => N[i].name).join(', ');
        tbl.replaceChildren(K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['ring', 'new nodes', 'best-linked new nodes (up to 8)'].map(x => K.el('th', {}, x))),
          ...H.slice(0, hop + 1).map(h => K.el('tr', {}, K.el('td', { class: 'num' }, h.hop), K.el('td', { class: 'num' }, h.fresh.length), K.el('td', {}, names(h))))));
        goldBox.replaceChildren(answerable ? K.el('div', { style: 'font-size:13px' }, K.el('b', {}, 'gold passages and the hop that first reaches them: '),
          ...gold.map(p => { const i = reachedAt(p); return K.el('span', { class: 'num', style: 'margin-right:10px' }, `${p} (${art[p]}) `, K.el('b', { class: i < 0 ? 'bad' : 'good' }, i < 0 ? 'never within 3 hops' : 'hop ' + i)); }))
          : K.el('div', { class: 'hint' }, 'No gold passage: the question is unanswerable from this corpus, yet the expansion still grows like any other. The graph cannot say "nothing here".'));
      }
      const S = el_.summary.answerable_with_ALL_gold_passages_reachable;
      agg.textContent = `All ${withSeeds.length} questions with seeds (recomputed live here): mean nodes at hop 0..3 = ${[0, 1, 2, 3].map(h => K.fmt(mean(h), 1)).join(', ')}; mean passages = ${[0, 1, 2, 3].map(h => K.fmt(meanP(h), 1)).join(', ')} of ${NP} (${[0, 1, 2, 3].map(h => Math.round(100 * meanP(h) / NP) + '%').join(', ')}).\n` +
        `Live BFS equals the stored khop.json at ${match} of ${tot} (question, hop) steps.\nAll gold passages inside the expansion, 20 answerable questions (stored): hop 0: ${S[0]}, hop 1: ${S[1]}, hop 2: ${S[2]}, hop 3: ${S[3]}. q13, q14 and q18 never reach their second gold passage. By hop 3 the expansion touches about two thirds of the corpus, so hop 3 no longer filters anything.\n` +
        'Growth rule (our own estimate, not from a source): the toy tab shows (average degree)^k; real hubs and loops make real growth differ from it.';
      body.replaceChildren(K.el('div', {}, sel), caseRow, K.el('div', { class: 'row' }, hopS.node), qbox, seedBox, verdict, bars, tbl, goldBox, agg, cav);
      draw();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const bar = K_().el('div', { class: 'row' }), real = K_().el('div', {}), toy = K_().el('div', {});
    const b1 = K_().el('button', {}, 'Real example'), b2 = K_().el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }
  const K_ = () => DemoKit;

  const api = { defaults, compute, mount, realBfs };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['k_hop'] = api;
})(this);
