/* PathRAG-style path scoring: resource flows from a start node along edges (each step keeps alpha, split equally among out-neighbours),
   a path is scored by S(P) = (sum of S over its nodes) / (number of edges). Source: Chen et al. 2025, arXiv:2502.14902, Eq. 2-4.
   Real example (default): paths enumerated and scored HERE, in the browser, on the real 662-node graph (the pack stores no path scores).
   Toy example: the 5-node directed graph of the catalogue entry (invented). compute() is PURE (no DOM). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const TOY = { edges: [['s', 'a'], ['s', 'b'], ['a', 't'], ['b', 'c'], ['c', 't']], paths: [['s', 'a', 't'], ['s', 'b', 'c', 't']] };
  const defaults = { edges: TOY.edges, both: false, start: 's', alpha: 0.7, theta: 0.05, maxHops: 9, hub: 0, paths: TOY.paths };

  /* adjacency of "who can pass resource to whom"; both = every edge works in both directions */
  function adjacency(edges, both) {
    const out = {}, seen = new Set(), add = (a, b) => { const k = a + '\u0001' + b; if (!seen.has(k)) { seen.add(k); (out[a] ||= []).push(b); (out[b] ||= []); } };
    edges.forEach(([a, b]) => { if (a === b) return; add(a, b); if (both) add(b, a); });
    return out;
  }
  /* Eq. 2 + Eq. 3. Every node is updated once, in a fixed order: topological order if the reachable part has no cycle, otherwise BFS distance
     (a node only receives from nodes strictly earlier in that order). A node whose per-neighbour share S/outdeg is below theta passes nothing on. */
  function resource(out, start, alpha, theta, maxHops) {
    const depth = { [start]: 0 }, order = [start];
    for (let i = 0; i < order.length; i++) { const u = order[i]; if (depth[u] >= maxHops) continue; for (const v of out[u] || []) if (!(v in depth)) { depth[v] = depth[u] + 1; order.push(v); } }
    const indeg = {}; order.forEach(u => { indeg[u] = 0; });
    order.forEach(u => (out[u] || []).forEach(v => { if (v in depth) indeg[v]++; }));
    const q = order.filter(u => indeg[u] === 0), topo = [];
    for (let i = 0; i < q.length; i++) { topo.push(q[i]); for (const v of out[q[i]] || []) if (v in depth && --indeg[v] === 0) q.push(v); }
    const rank = {}; if (topo.length === order.length) topo.forEach((u, i) => { rank[u] = i; }); else order.forEach(u => { rank[u] = depth[u]; });
    const idx = {}; order.forEach((u, i) => { idx[u] = i; });
    const seq = order.slice().sort((a, b) => rank[a] - rank[b] || idx[a] - idx[b]);
    const inn = {}; order.forEach(u => (out[u] || []).forEach(v => { if (v in depth && rank[v] > rank[u]) (inn[v] ||= []).push(u); }));
    const S = { [start]: 1 }, alive = {};
    seq.forEach(u => {
      if (u !== start) { let s = 0; (inn[u] || []).forEach(w => { if (alive[w]) s += alpha * S[w] / out[w].length; }); S[u] = s; }
      alive[u] = u === start || S[u] / Math.max(1, out[u].length) >= theta;
    });
    return { S, depth, alive };
  }
  const pathScore = (S, p) => p.reduce((s, v) => s + (S[v] || 0), 0) / (p.length - 1);
  /* all simple paths start -> any node of targets with at most maxHops edges (a path may pass through a target and go on) */
  function enumerate(out, start, targets, maxHops, cap) {
    const T = new Set(targets), res = [], st = [[start, [start]]];
    while (st.length && res.length < cap) {
      const [u, p] = st.pop();
      if (p.length > 1 && T.has(u)) res.push(p);
      if (p.length - 1 >= maxHops) continue;
      for (const v of out[u] || []) if (!p.includes(v)) st.push([v, p.concat(v)]);
    }
    return res;
  }
  /* PURE. Everything the real and the toy mode need. */
  function analyse(inp) {
    const edges = inp.edges.slice();
    for (let i = 1; i <= (inp.hub || 0); i++) edges.push([inp.start, 'L' + i]);
    const out = adjacency(edges, inp.both), r = resource(out, inp.start, inp.alpha, inp.theta, inp.maxHops);
    const list = inp.paths || enumerate(out, inp.start, inp.targets || [], inp.maxHops, inp.cap || 4000);
    const paths = list.map(p => ({ nodes: p, score: pathScore(r.S, p) }));
    return { out, S: r.S, depth: r.depth, alive: r.alive, paths };
  }
  const r4 = x => Number(x.toFixed(4));
  function compute(inp) {
    const a = analyse(inp), S = a.S;
    return { S_a: r4(S.a), S_b: r4(S.b), S_c: r4(S.c), S_t: r4(S.t), score_path_s_a_t: r4(a.paths[0].score), score_path_s_b_c_t: r4(a.paths[1].score) };
  }

  /* ---------------- toy mode ---------------- */
  const POS = { s: [40, 120], a: [170, 55], b: [170, 185], c: [300, 185], t: [430, 120] };
  const C1 = 'var(--ai)', C2 = 'var(--k12)';
  function mountToy(el) {
    const K = DemoKit; let st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it): resource flows, paths are scored',
      'Invented 5-node directed graph. Water (resource 1) is poured at s and flows along the arrows; every step keeps alpha of it and splits it equally among the out-arrows. Two candidate paths from s to t: P1 = s, a, t (amber) and P2 = s, b, c, t (blue).');
    const W = 480, H = 240;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'toy graph with resource per node', style: 'width:100%;max-width:560px;display:block;margin:0 auto' });
    const aS = K.slider('alpha (decay per step)', 0.1, 1, 0.05, st.alpha, v => { st.alpha = v; render(); });
    const tS = K.slider('theta (pruning threshold)', 0, 0.4, 0.01, st.theta, v => { st.theta = v; render(); });
    const hS = K.slider('extra out-edges of s (hub)', 0, 12, 1, st.hub, v => { st.hub = v; render(); });
    const bk1 = K.el('button', {}, 'break it: hub (8 extra edges from s)'), bk2 = K.el('button', {}, 'break it: alpha = 1 (no decay)'),
      bk3 = K.el('button', {}, 'break it: theta = 0.2 (prune)'), rst = K.el('button', {}, 'worked example');
    const sync = () => { aS.set(st.alpha); tS.set(st.theta); hS.set(st.hub); render(); };
    bk1.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); st.hub = 8; sync(); });
    bk2.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); st.alpha = 1; sync(); });
    bk3.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); st.theta = 0.2; sync(); });
    rst.addEventListener('click', () => { st = JSON.parse(JSON.stringify(defaults)); sync(); });
    const res = K.resultBox(), res2 = K.resultBox(), line = K.el('div', { class: 'row', 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), note = K.el('div', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, rst, bk1, bk2, bk3), K.el('div', { class: 'row' }, aS.node, tS.node, hS.node), svg,
      K.el('div', { class: 'row' }, K.el('div', {}, K.el('div', { class: 'hint', style: 'margin:0' }, 'S(P1), path s-a-t'), res.node), K.el('div', {}, K.el('div', { class: 'hint', style: 'margin:0' }, 'S(P2), path s-b-c-t'), res2.node)), line, formula, note);
    function render() {
      const a = analyse(st), S = a.S, p1 = a.paths[0], p2 = a.paths[1], g = x => K.fmt(x, 4);
      const kids = [];
      const hubN = []; for (let i = 1; i <= st.hub; i++) hubN.push('L' + i);
      const posOf = n => POS[n] || [40 + (hubN.indexOf(n) + 0.5) * (130 / Math.max(1, hubN.length)) - 20, 12];
      const drawn = new Set(); const E = st.edges.concat(hubN.map(n => ['s', n]));
      E.forEach(([x, y]) => { const [x1, y1] = posOf(x), [x2, y2] = posOf(y); const on1 = pairIn(p1.nodes, x, y), on2 = pairIn(p2.nodes, x, y);
        kids.push(K.svg('line', { x1, y1, x2, y2, stroke: on1 ? C1 : on2 ? C2 : 'var(--line)', 'stroke-width': on1 || on2 ? 4 : 2, opacity: hubN.includes(y) ? 0.5 : 1 })); });
      Object.keys(POS).concat(hubN).forEach(n => { const [x, y] = posOf(n), v = S[n] || 0, leaf = n[0] === 'L', pr = a.alive[n] === false;
        kids.push(K.svg('circle', { cx: x, cy: y, r: leaf ? 4 : 14, fill: leaf ? 'var(--faint)' : 'var(--panel2)', stroke: pr ? 'var(--warn)' : 'var(--text)', 'stroke-width': pr ? 3 : 1.5 }));
        if (!leaf) { kids.push(K.svg('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 13 }, n));
          kids.push(K.svg('rect', { x: x - 20, y: y + 20, width: 40 * Math.min(1, v), height: 7, fill: 'var(--he)' }));
          kids.push(K.svg('text', { x, y: y + 42, 'text-anchor': 'middle', 'font-size': 11 }, 'S=' + g(v))); } });
      svg.replaceChildren(...kids);
      res.set(p1.score, 4); res2.set(p2.score, 4);
      const better = p1.score > p2.score ? 'P1 (short)' : p1.score < p2.score ? 'P2 (long)' : 'tie';
      line.replaceChildren(K.el('span', { class: p1.score >= p2.score ? 'good' : 'bad' }, 'Higher score: ' + better + '.'), K.el('span', { class: 'hint', style: 'margin:0' }, ' Pruned nodes (theta) are outlined in orange: they pass nothing on.'));
      formula.textContent = `S(a) = alpha x S(s) / out(s) = ${st.alpha} x 1 / ${a.out.s.length} = ${g(S.a)}\n` +
        `S(t) = alpha x S(a)/out(a) + alpha x S(c)/out(c) = ${g(st.alpha * S.a / a.out.a.length * (a.alive.a ? 1 : 0))} + ${g(st.alpha * S.c / a.out.c.length * (a.alive.c ? 1 : 0))} = ${g(S.t)}\n` +
        `S(P1) = (${p1.nodes.map(n => g(S[n])).join(' + ')}) / ${p1.nodes.length - 1} edges = ${g(p1.score)}\n` +
        `S(P2) = (${p2.nodes.map(n => g(S[n])).join(' + ')}) / ${p2.nodes.length - 1} edges = ${g(p2.score)}`;
      note.textContent = st.hub ? 'Hub: s now splits its resource over ' + a.out.s.length + ' arrows, so a and b each get only alpha/' + a.out.s.length + '. Both paths lose, whatever their meaning.' :
        st.alpha === 1 ? 'alpha = 1: no decay. The order stays, the scale changes (1.25 versus 1.0): a cut-off on S(P) means nothing across settings.' :
        st.theta >= 0.2 ? 'The pruned node stops the flow; the path through it is cut (S of the nodes after it drops to 0 or less).' :
        'Nothing in this score looks at what the nodes or edges MEAN: only shape (distance and out-degree). If P2 were the relevant chain, it would still lose.';
    }
    function pairIn(p, x, y) { for (let i = 0; i + 1 < p.length; i++) if (p[i] === x && p[i + 1] === y) return true; return false; }
    render();
  }

  /* ---------------- real mode ---------------- */
  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: scoring paths on a graph extracted from Wikipedia text',
      'Real graph (662 nodes, 762 typed edges, extracted by an LLM from 138 Wikipedia passages), real questions, real seeds. The pack stores NO path scores: every number below is computed here, live, with the entry\'s formula. Pick a question, a start node and the gold passage that should be reached.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/graph.json'), get('graph/entity_linking.json'), get('data/questions.json'), get('graph/khop.json')]).then(([g, el_, qs, kh]) => {
      const N = {}; g.nodes.forEach(n => { N[n.id] = n; });
      const edges = g.edges.map(e => [e.source, e.target]);
      const EDGE = {}; g.edges.forEach(e => { [[e.source, e.target, '->'], [e.target, e.source, '<-']].forEach(([a, b, d]) => { (EDGE[a + '|' + b] ||= []).push({ rel: e.relation, passages: e.passages, d }); }); });
      const KH = {}; kh.questions.forEach(q => { KH[q.qid] = q; });
      const QS = {}; qs.forEach(q => { QS[q.id] = q; });
      const ids = qs.filter(q => q.gold_passages.length && el_.questions[q.id] && !el_.questions[q.id].miss).map(q => q.id);
      const st = { q: 'q12', start: null, gp: null, alpha: 0.7, thetaI: 2, hops: 4, both: true, sel: 0, all: false };
      const THETAS = [0, 0.0001, 0.0005, 0.002, 0.01, 0.05];
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%' }, ...ids.map(i => K.el('option', { value: i }, `${i} (${QS[i].type}): ${QS[i].question.slice(0, 60)}`)));
      const selS = K.el('select', { 'aria-label': 'start node' }), selG = K.el('select', { 'aria-label': 'gold passage to reach' });
      const aS = K.slider('alpha', 0.3, 1, 0.05, st.alpha, v => { st.alpha = v; draw(); });
      const tS = K.slider('theta (index into 0, 1e-4, 5e-4, 2e-3, 0.01, 0.05)', 0, 5, 1, st.thetaI, v => { st.thetaI = v; draw(); });
      const hS = K.slider('max hops', 2, 6, 1, st.hops, v => { st.hops = v; draw(); });
      const both = K.el('input', { type: 'checkbox', checked: '' }); both.checked = true;
      both.addEventListener('change', () => { st.both = both.checked; draw(); });
      const moreB = K.el('button', {}, 'show all paths'); moreB.addEventListener('click', () => { st.all = !st.all; draw(); });
      const info = K.el('div', {}), verdict = K.el('div', { 'aria-live': 'polite', style: 'margin:8px 0' }), tbl = K.el('table', { style: 'font-size:12px' }),
        chain = K.el('div', {}), formula = K.el('div', { class: 'formula' }), hopNote = K.el('div', { class: 'hint' });
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: (1) Paths and scores are computed in this page, not stored in the pack. (2) The extracted edge directions are an LLM reading of one sentence, not "who may pass resource to whom", so by default every edge works both ways (untick to use the directions as extracted: most questions then have no path). (3) alpha = 0.7 is the paper\'s value; theta, max hops and the update order (BFS distance, because a two-way graph has cycles) are OUR choices. (4) "Evidence" = the path uses an edge that was extracted from the gold passage; it is our proxy, not a judgement of the answer. (5) The graph is noisy (near-duplicates, vague related_to edges). (6) S = 0 on a node means theta stopped the flow upstream (an earlier node had a per-neighbour share below theta); lower theta to see its small positive value. (7) Demo scale: 24 questions, one graph. Not an evaluation. Text: Wikipedia contributors, CC BY-SA 4.0.');
      const presets = K.el('div', { class: 'row' }, K.el('span', { class: 'hint', style: 'margin:0' }, 'try:'));
      [['q12', 'evidence path ranks 3rd'], ['q13', 'no path exists'], ['q14', 'only a 6-hop detour'], ['q18', 'other component']].forEach(([id, t]) => {
        const b = K.el('button', {}, `${id}: ${t}`); b.addEventListener('click', () => { sel.value = id; setQ(id, true); }); presets.append(b); });
      body.append(K.el('div', { class: 'row' }, K.el('label', { style: 'max-width:100%' }, 'question ', sel)), presets, info,
        K.el('div', { class: 'row' }, K.el('label', {}, 'start node ', selS), K.el('label', {}, 'reach passage ', selG), K.el('label', {}, both, ' edges work both ways')),
        K.el('div', { class: 'row' }, aS.node, tS.node, hS.node), verdict, hopNote, tbl, K.el('div', { class: 'row' }, moreB), chain, formula, cav);

      function setQ(id, reset) {
        st.q = id; const L = el_.questions[id].linked, q = QS[id];
        selS.replaceChildren(...L.map(l => K.el('option', { value: l.node }, `${l.name} (${N[l.node].n_passages} passages)`)));
        selG.replaceChildren(...q.gold_passages.map(p => K.el('option', { value: p }, p)));
        // default start: the seed with the most edges; default target: the gold passage not carried by that start
        const deg = n => edges.filter(e => e[0] === n || e[1] === n).length;
        const order = L.map(l => l.node).sort((a, b) => deg(b) - deg(a));
        let pick = order[0], gp = q.gold_passages[q.gold_passages.length - 1];
        for (const s of order) { const other = q.gold_passages.slice().reverse().find(p => !N[s].passages.includes(p)); if (other) { pick = s; gp = other; break; } }
        selS.value = pick; selG.value = gp; st.start = pick; st.gp = gp; st.sel = 0; st.all = false; draw();
      }
      sel.addEventListener('change', () => setQ(sel.value)); selS.addEventListener('change', () => { st.start = selS.value; st.sel = 0; draw(); });
      selG.addEventListener('change', () => { st.gp = selG.value; st.sel = 0; draw(); });

      function nm(n, S) { return N[n].name; }
      function draw() {
        const q = QS[st.q], start = st.start, gp = st.gp, theta = THETAS[st.thetaI], gset = q.gold_passages;
        const targets = g.nodes.filter(n => n.passages.includes(gp)).map(n => n.id);
        const inp = { edges, both: st.both, start, alpha: st.alpha, theta, maxHops: st.hops, targets, cap: 4000 };
        const a = analyse(inp), S = a.S;
        const goldEdge = p => { let c = 0; for (let i = 0; i + 1 < p.length; i++) if ((EDGE[p[i] + '|' + p[i + 1]] || []).some(e => e.passages.includes(gp))) c++; return c; };
        const paths = a.paths.map(x => ({ ...x, ev: goldEdge(x.nodes), hops: x.nodes.length - 1 })).sort((x, y) => y.score - x.score || x.hops - y.hops || x.nodes.join().localeCompare(y.nodes.join()));
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. Gold passages: ${gset.join(', ')}. Start = ${N[start].name} (out-degree ${(a.out[start] || []).length}). Targets = the ${targets.length} nodes extracted from ${gp}: ${targets.slice(0, 6).map(t => N[t].name).join(', ')}${targets.length > 6 ? ', ...' : ''}.`));
        const khq = KH[st.q], kfound = khq ? khq.steps[3].gold_found : [];
        hopNote.textContent = khq ? `For comparison, real k-hop from the same seeds (k = 3, from the pack) finds ${kfound.length} of ${gset.length} gold passages (${kfound.join(', ') || 'none'}).` : '';
        const evP = paths.filter(p => p.ev);
        const firstEv = paths.findIndex(p => p.ev);
        if (targets.includes(start)) {
          verdict.replaceChildren(K.el('span', { class: 'bad' }, `${N[start].name} already carries ${gp}: there is no path to score. Pick the other gold passage or another start.`)); tbl.replaceChildren(); chain.replaceChildren(); formula.textContent = ''; return;
        }
        if (!paths.length) {
          const reach = reachAll(a.out, start, targets);
          verdict.replaceChildren(K.el('span', { class: 'bad' }, `No path with at most ${st.hops} edges. `), K.el('span', {}, reach.msg), K.el('div', { class: 'hint' }, 'Path scoring ranks paths that exist. It cannot invent the missing link, so this passage would not reach the prompt through paths, exactly as with k-hop. Only an expansion step that is not graph-based (vector search on the passage) can fix this.'));
          tbl.replaceChildren(); chain.replaceChildren(); formula.textContent = ''; return;
        }
        verdict.replaceChildren(K.el('span', {}, `${paths.length}${paths.length >= 4000 ? '+ (cap)' : ''} paths found. Best score ${K.fmt(paths[0].score, 4)} (${paths[0].hops} hops). `),
          K.el('span', { class: evP.length ? 'good' : 'bad' }, evP.length ? `${evP.length} use an edge extracted from ${gp}; the first one is ranked ${firstEv + 1} of ${paths.length}.` : `None uses an edge extracted from ${gp}: every path ends at a node that merely appears in it.`));
        const shown = st.all ? paths : paths.slice(0, 8).concat(evP.filter(p => !paths.slice(0, 8).includes(p)).slice(0, 2));
        tbl.replaceChildren(K.el('tr', {}, ...['rank', 'S(P)', 'hops', 'path (out-degree)', 'evidence'].map(h => K.el('th', {}, h))),
          ...shown.map(p => { const r = paths.indexOf(p), row = K.el('tr', { tabindex: 0, style: 'cursor:pointer;' + (r === st.sel ? 'outline:1px solid var(--ai)' : '') },
            K.el('td', { class: 'num' }, r + 1), K.el('td', { class: 'num' }, K.fmt(p.score, 4)), K.el('td', { class: 'num' }, p.hops),
            K.el('td', { style: 'overflow-wrap:anywhere' }, p.nodes.map(n => `${N[n].name} (${(a.out[n] || []).length})`).join(' > ')), K.el('td', { class: p.ev ? 'good' : '' }, p.ev ? p.ev + ' edge' + (p.ev > 1 ? 's' : '') : '-'));
            const pick = () => { st.sel = r; draw(); }; row.addEventListener('click', pick); row.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } }); return row; }));
        moreB.textContent = st.all ? 'show only the top rows' : `show all ${paths.length} paths`;
        if (st.sel >= paths.length) st.sel = 0;
        const p = paths[st.sel];
        // chain drawing for the selected path
        const items = []; const wsz = 100;
        p.nodes.forEach((n, i) => {
          const v = S[n] || 0; items.push(K.el('div', { style: 'min-width:86px;max-width:120px;flex:1;text-align:center;font-size:12px' },
            K.el('div', { style: 'border:1px solid var(--line);border-radius:6px;padding:4px;background:var(--panel2);overflow-wrap:anywhere' }, N[n].name),
            K.el('div', { style: `height:6px;margin:3px auto;width:${Math.max(2, Math.min(1, v) * 100)}%;background:var(--he)` }),
            K.el('div', { class: 'num hint', style: 'margin:0' }, `S = ${K.fmt(v, 4)}`), K.el('div', { class: 'hint', style: 'margin:0' }, `out-degree ${(a.out[n] || []).length}`)));
          if (i + 1 < p.nodes.length) { const es = EDGE[n + '|' + p.nodes[i + 1]] || [], e0 = es.find(e => e.passages.includes(gp)) || es[0];
            items.push(K.el('div', { style: 'font-size:11px;text-align:center;color:' + (e0 && e0.passages.includes(gp) ? 'var(--he)' : 'var(--muted)') }, (e0 ? e0.rel : '?') + ' >', K.el('div', {}, e0 ? e0.passages.slice(0, 2).join(' ') : ''))); } });
        chain.replaceChildren(K.el('div', { class: 'hint', style: 'margin:8px 0 2px' }, `Selected path (rank ${st.sel + 1}): bar = resource S(v); the line between nodes is the edge relation and the passage(s) it was extracted from (teal = from ${gp}).`),
          K.el('div', { style: 'display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px' }, ...items));
        const g4 = x => K.fmt(x, 4);
        formula.textContent = `S(P) = (${p.nodes.map(n => g4(S[n] || 0)).join(' + ')}) / ${p.hops} edges = ${g4(p.score)}\n` +
          `each S(v) = alpha x S(parent) / out(parent) summed over earlier neighbours: e.g. S(${N[p.nodes[1]].name}) = ${st.alpha} x 1 / ${(a.out[start] || []).length} = ${g4(S[p.nodes[1]] || 0)}` +
          `${a.alive[p.nodes[1]] === false ? '  (pruned by theta)' : ''}`;
      }
      function reachAll(out, s, T) {
        const d = { [s]: 0 }, q = [s]; for (let i = 0; i < q.length; i++) for (const v of out[q[i]] || []) if (!(v in d)) { d[v] = d[q[i]] + 1; q.push(v); }
        const best = Math.min(...T.map(t => t in d ? d[t] : Infinity));
        return { msg: isFinite(best) ? `The nearest target is ${best} edges away: raise max hops to ${best}.` : `No path of ANY length: from ${N[s].name} ${q.length} nodes are reachable, and none of the ${T.length} nodes of this passage is among them (they sit in a different connected component${st.both ? '' : ', or only against the arrows'}).` };
      }
      sel.value = 'q12'; setQ('q12');
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, analyse };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['path_scoring'] = api;
})(this);
