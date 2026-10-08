/* Leiden communities and modularity: how a graph is cut into topic groups, and how the cut is scored.
   Real example (default): the real Leiden partition of the LLM-extracted graph in Presentations/_real-examples/graph (662 nodes, 57 communities, Q = 0.8505) with the stored LLM community reports.
   Toy example (break it): 6 invented nodes; drag a node to another group and watch Q = sum_c [e_c/m - gamma (K_c/2m)^2].
   Choice 2D, not three.js: a graph's layout has no depth, and a 3D view would hide nodes behind each other; 662 nodes also exceed the few-hundred-objects budget.
   compute() scores a given partition; it does not run Leiden (the real run was done offline with leidenalg 0.12.0, seed 42). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const T1 = [['A', 'B'], ['B', 'C'], ['A', 'C'], ['D', 'E'], ['E', 'F'], ['D', 'F'], ['C', 'D']];
  const T2 = [['a', 'b'], ['b', 'c'], ['b', 'x1'], ['b', 'x2'], ['b', 'x3'], ['x1', 'x2'], ['x2', 'x3'], ['x1', 'x3']];
  const defaults = {
    gamma: 1,
    toy1: { edges: T1, split: { A: 0, B: 0, C: 0, D: 1, E: 1, F: 1 }, one: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }, single: { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 } },
    toy2: { edges: T2, before: { a: 0, b: 0, c: 0, x1: 1, x2: 1, x3: 1 }, after: { a: 0, c: 0, b: 1, x1: 1, x2: 1, x3: 1 } },
  };
  const r4 = x => Math.round(x * 1e4) / 1e4;

  /* PURE. Modularity of a partition: sum over groups of e_c/m - gamma (K_c/2m)^2. assign: node -> group id. Edges are undirected pairs (no duplicates). */
  function modularity(edges, assign, gamma) {
    const m = edges.length, deg = {}, G = {};
    edges.forEach(([u, v]) => { deg[u] = (deg[u] || 0) + 1; deg[v] = (deg[v] || 0) + 1; });
    Object.keys(assign).forEach(n => { (G[assign[n]] ||= { g: assign[n], nodes: [], e: 0, K: 0 }).nodes.push(n); G[assign[n]].K += deg[n] || 0; });
    edges.forEach(([u, v]) => { if (assign[u] === assign[v]) G[assign[u]].e++; });
    let Q = 0;
    const groups = Object.values(G).map(c => {
      c.share = m ? c.e / m : 0; c.chance = m ? Math.pow(c.K / (2 * m), 2) : 0; c.term = c.share - gamma * c.chance; Q += c.term;
      c.connected = isConnected(edges, c.nodes); return c;
    });
    return { Q, m, groups };
  }
  function isConnected(edges, nodes) {
    if (nodes.length < 2) return true;
    const S = new Set(nodes), adj = {};
    edges.forEach(([u, v]) => { if (S.has(u) && S.has(v)) { (adj[u] ||= []).push(v); (adj[v] ||= []).push(u); } });
    const seen = new Set([nodes[0]]), st = [nodes[0]];
    while (st.length) { const x = st.pop(); (adj[x] || []).forEach(y => { if (!seen.has(y)) { seen.add(y); st.push(y); } }); }
    return seen.size === nodes.length;
  }
  function compute(inp) {
    const a = inp.toy1, b = inp.toy2, g = inp.gamma;
    return {
      Q_two_communities: r4(modularity(a.edges, a.split, g).Q),
      Q_one_community: r4(modularity(a.edges, a.one, g).Q),
      Q_singletons: r4(modularity(a.edges, a.single, g).Q),
      Q_two_communities_gamma_2: r4(modularity(a.edges, a.split, 2).Q),
      toy2_Q_before_b_moves: r4(modularity(b.edges, b.before, g).Q),
      toy2_Q_after_b_moves: r4(modularity(b.edges, b.after, g).Q),
    };
  }

  const COL = ['#7C9CFF', '#3CC7B4', '#C28BFF', '#F2A93B', '#FF8A65', '#E9ECF2'];
  const pal = i => `hsl(${(i * 137.5) % 360} 70% 62%)`;
  const fx = (x, d = 4) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString();

  /* ===================== toy ===================== */
  function mountToy(el, K) {
    const toys = { t1: { nodes: 'ABCDEF'.split(''), edges: T1 }, t2: { nodes: ['a', 'b', 'c', 'x1', 'x2', 'x3'], edges: T2 } };
    const st = { toy: 't1', assign: { ...defaults.toy1.split }, gamma: 1, sel: null };
    const shell = K.el('div', {});
    el.append(shell);
    const W = 600, H = 300, ZC = [[100, 80], [300, 80], [500, 80], [100, 220], [300, 220], [500, 220]], ZR = 62;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:880px;background:var(--panel2);border-radius:8px;touch-action:pan-y;user-select:none', role: 'img', 'aria-label': 'toy graph with six drop zones, one per group' });
    const gZ = K.svg('g'), gE = K.svg('g'), gN = K.svg('g'); svg.append(gZ, gE, gN);
    ZC.forEach((c, i) => gZ.append(K.svg('circle', { cx: c[0], cy: c[1], r: ZR, fill: 'none', stroke: COL[i], 'stroke-opacity': .35, 'stroke-dasharray': '4 4' }),
      K.svg('text', { x: c[0], y: c[1] - ZR - 4, 'text-anchor': 'middle', fill: COL[i], style: 'font-size:11px' }, 'group ' + (i + 1))));
    const out = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), table = K.el('div', {}), presets = K.el('div', { class: 'row' });
    const sg = K.slider('resolution gamma', 0.25, 3, 0.25, 1, v => { st.gamma = v; render(); });
    let pos = {}, drag = null, lastQ;
    function layout() {
      const T = toys[st.toy], by = {}; T.nodes.forEach(n => (by[st.assign[n]] ||= []).push(n));
      Object.entries(by).forEach(([g, ns]) => { const c = ZC[g]; ns.forEach((n, i) => { const a = i / ns.length * 6.283 + 0.6, r = ns.length > 1 ? 30 : 0; pos[n] = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; }); });
    }
    function draw() {
      const T = toys[st.toy]; gE.replaceChildren(); gN.replaceChildren();
      T.edges.forEach(([u, v]) => { const cut = st.assign[u] !== st.assign[v]; gE.append(K.svg('line', { x1: pos[u][0], y1: pos[u][1], x2: pos[v][0], y2: pos[v][1], stroke: cut ? '#FF8A65' : '#98A0B0', 'stroke-width': cut ? 2.5 : 2, 'stroke-dasharray': cut ? '5 3' : '' })); });
      T.nodes.forEach(n => {
        const g = K.svg('g', { tabindex: 0, role: 'button', 'aria-label': `node ${n}, group ${st.assign[n] + 1}. Arrow keys change its group`, style: 'cursor:grab' });
        g.append(K.svg('circle', { cx: pos[n][0], cy: pos[n][1], r: 15, fill: COL[st.assign[n]], stroke: st.sel === n ? '#fff' : '#0B0D12', 'stroke-width': 2 }), K.svg('text', { x: pos[n][0], y: pos[n][1] + 4, 'text-anchor': 'middle', style: 'fill:#0B0D12;font-size:12px;font-weight:600' }, n));
        g.addEventListener('pointerdown', e => { drag = n; st.sel = n; svg.setPointerCapture && svg.setPointerCapture(e.pointerId); e.preventDefault(); });
        g.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { st.assign[n] = (st.assign[n] + d + 6) % 6; e.preventDefault(); render(n); } });
        gN.append(g);
      });
    }
    const toPt = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    svg.addEventListener('pointermove', e => { if (!drag) return; pos[drag] = toPt(e); draw(); });
    const drop = e => { if (!drag) return; const p = toPt(e); let b = 0, bd = 1e9; ZC.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); st.assign[drag] = b; const n = drag; drag = null; render(n); };
    svg.addEventListener('pointerup', drop); svg.addEventListener('pointercancel', drop);
    function render(focusNode) {
      layout(); draw();
      if (focusNode) { const i = toys[st.toy].nodes.indexOf(focusNode); const g = gN.children[i]; if (g) g.focus(); }
      const T = toys[st.toy], r = modularity(T.edges, st.assign, st.gamma);
      const rows = r.groups.sort((a, b) => a.g - b.g);
      table.replaceChildren(K.el('table', {}, K.el('tr', {}, ...['group', 'nodes', 'e_c', 'K_c', 'e_c / m', 'gamma (K_c / 2m)^2', 'term'].map(t => K.el('th', {}, t))),
        ...rows.map(c => K.el('tr', {}, K.el('td', { style: 'color:' + COL[c.g] }, 'group ' + (c.g + 1)), K.el('td', {}, c.nodes.join(' ') + (c.connected ? '' : '  (NOT connected)')), K.el('td', { class: 'num' }, c.e), K.el('td', { class: 'num' }, c.K),
          K.el('td', { class: 'num' }, fx(c.share)), K.el('td', { class: 'num' }, fx(st.gamma * c.chance)), K.el('td', { class: 'num ' + (c.term >= 0 ? 'good' : 'bad') }, fx(c.term))))));
      const q = r4(r.Q);
      out.replaceChildren(K.el('div', {}, 'm = ', K.el('b', { class: 'num' }, r.m), ' edges   modularity Q = ', K.el('b', { class: 'num result', id: 'toyQ' }, fx(q))),
        ...rows.filter(c => !c.connected).map(c => K.el('div', { class: 'bad' }, `Group {${c.nodes.join(', ')}} is not connected inside, yet Q has no term for connectivity: it only counts edges. This is why Leiden adds a refinement step.`)));
      if (lastQ !== undefined && lastQ !== q) K.flash(out.querySelector('#toyQ')); lastQ = q;
      formula.textContent = `Q = ${rows.map(c => `[${c.e}/${r.m} - ${fx(st.gamma, 2)} x (${c.K}/${2 * r.m})^2]`).join(' + ')}\n  = ${rows.map(c => fx(c.term)).join(' + ')} = ${fx(q)}`;
    }
    const preset = (name, f) => { const b = K.el('button', {}, name); b.addEventListener('click', () => { f(); sg.set(st.gamma); render(); }); presets.append(b); };
    preset('worked example: two triangles', () => { st.toy = 't1'; st.assign = { ...defaults.toy1.split }; st.gamma = 1; });
    preset('everything in one group', () => { st.toy = 't1'; st.assign = { ...defaults.toy1.one }; });
    preset('every node alone', () => { st.toy = 't1'; st.assign = { ...defaults.toy1.single }; });
    preset('gamma = 2', () => { st.toy = 't1'; st.assign = { ...defaults.toy1.split }; st.gamma = 2; });
    preset('break it: move C to the other triangle', () => { st.toy = 't1'; st.assign = { ...defaults.toy1.split, C: 1 }; st.gamma = 1; });
    preset('second toy: b links a, c and a clique', () => { st.toy = 't2'; st.assign = { ...defaults.toy2.before }; st.gamma = 1; });
    preset('second toy: move b to the clique (a, c disconnected)', () => { st.toy = 't2'; st.assign = { ...defaults.toy2.after }; st.gamma = 1; });
    shell.append(K.el('p', { class: 'hint' }, 'Invented graph. Drag a node into another dashed group (or focus it and press an arrow key). Orange dashed edges cross between groups. Q is recomputed from the formula on every move. This scores a partition; it does not run Leiden.'),
      presets, svg, K.el('div', { class: 'row' }, sg.node), out, table, formula);
    render();
  }

  /* ===================== real ===================== */
  function mountReal(el, K) {
    const base = new URL('../../_real-examples/', SRC || location.href).href, lay = new URL('data/leiden_real_layout.json', SRC || location.href).href;
    const box = K.el('div', {}, 'loading real data...'); el.append(box);
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get(base + 'graph/graph.json'), get(base + 'graph/communities.json'), get(lay), get(base + 'data/corpus.json').catch(() => null)]).then(([g, C, L, corpus]) => {
      const name = {}; g.nodes.forEach(n => { name[n.id] = n.name; });
      const art = {}; (corpus || []).forEach(p => { art[p.id] = p.article; });
      const stored = {}; C.partition.forEach((p, i) => p.nodes.forEach(n => { stored[n] = i; }));
      const seen = new Set(), edges = [];
      g.edges.forEach(e => { if (e.source === e.target) return; const k = e.source < e.target ? e.source + '|' + e.target : e.target + '|' + e.source; if (!seen.has(k)) { seen.add(k); edges.push(k.split('|')); } });
      const st = { assign: { ...stored }, gamma: 1, sel: 0 };
      const nRep = C.reports.length, big = new Set(C.reports.map((_, i) => i));
      const base0 = modularity(edges, stored, 1);
      const allConn = base0.groups.every(c => c.connected);
      const shell = K.el('div', {}); box.replaceChildren(shell);
      const cv = K.el('canvas', { role: 'img', 'aria-label': 'the extracted knowledge graph coloured by Leiden community', style: 'width:100%;max-width:880px;aspect-ratio:880/520;background:var(--panel2);border-radius:8px;display:block;cursor:pointer' });
      const info = K.el('div', {}), qline = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), table = K.el('div', {});
      const selA = K.el('select', { 'aria-label': 'community' }, ...C.reports.map((r, i) => K.el('option', { value: i }, `c${String(i + 1).padStart(2, '0')}  ${r.title} (${r.size} nodes)`)));
      const selB = K.el('select', { 'aria-label': 'merge with' }, ...C.reports.map((r, i) => K.el('option', { value: i }, `c${String(i + 1).padStart(2, '0')}  ${r.title}`)));
      selB.value = 11;
      const sg = K.slider('resolution gamma (same partition, re-scored)', 0.25, 3, 0.25, 1, v => { st.gamma = v; render(); });
      let ctx, dpr = 1, cw = 0, ch = 0;
      const X = x => (x + 1.05) / 2.1 * cw, Y = y => (y + 1.05) / 2.1 * ch;
      const selSet = () => new Set(Object.keys(st.assign).filter(n => st.assign[n] === st.sel));
      function paint() {
        const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
        dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr; cw = w; ch = h; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        const S = selSet();
        ctx.lineWidth = 1;
        edges.forEach(([u, v]) => { const inSel = S.has(u) && S.has(v), same = st.assign[u] === st.assign[v]; ctx.strokeStyle = inSel ? 'rgba(233,236,242,.8)' : same ? 'rgba(152,160,176,.28)' : 'rgba(255,138,101,.22)'; ctx.beginPath(); ctx.moveTo(X(L.pos[u][0]), Y(L.pos[u][1])); ctx.lineTo(X(L.pos[v][0]), Y(L.pos[v][1])); ctx.stroke(); });
        g.nodes.forEach(n => { const a = st.assign[n.id], p = L.pos[n.id], on = a === st.sel; ctx.globalAlpha = S.size && !on ? 0.55 : 1; ctx.fillStyle = big.has(a) ? pal(a) : '#68707F'; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), on ? 4 : 3, 0, 6.283); ctx.fill(); });
        ctx.globalAlpha = 1; ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#E9ECF2';
        const rep = C.reports[st.sel]; if (rep) { const ids = rep.member_ids, cx = ids.reduce((s, n) => s + L.pos[n][0], 0) / ids.length, cy = ids.reduce((s, n) => s + L.pos[n][1], 0) / ids.length; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#0B0D12'; const t = rep.title; ctx.strokeText(t, X(cx), Y(cy) - 8); ctx.fillText(t, X(cx), Y(cy) - 8); }
        ctx.textAlign = 'left'; ctx.fillStyle = '#98A0B0'; ctx.fillText('grey = the 42 communities without an LLM report; orange line = edge between two communities', 8, ch - 8);
      }
      cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; let b = null, bd = 144; g.nodes.forEach(n => { const d = (X(L.pos[n.id][0]) - px) ** 2 + (Y(L.pos[n.id][1]) - py) ** 2; if (d < bd) { bd = d; b = n; } }); if (b && big.has(st.assign[b.id])) { st.sel = st.assign[b.id]; selA.value = st.sel; render(); } });
      selA.addEventListener('change', () => { st.sel = +selA.value; render(); });
      const presets = K.el('div', { class: 'row' });
      const preset = (name, f) => { const b = K.el('button', {}, name); b.addEventListener('click', () => { f(); render(); }); presets.append(b); };
      preset("Leiden's stored partition", () => { st.assign = { ...stored }; st.gamma = 1; sg.set(1); });
      preset('merge the community above with the one on the right', () => { const a = +selA.value, b = +selB.value; if (a !== b) Object.keys(st.assign).forEach(n => { if (st.assign[n] === b) st.assign[n] = a; }); });
      preset('break it: everything in one group', () => { Object.keys(st.assign).forEach(n => { st.assign[n] = 0; }); st.sel = 0; });
      preset('break it: random groups (same sizes)', () => { let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const ids = Object.keys(stored), lab = ids.map(n => stored[n]); for (let i = lab.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lab[i], lab[j]] = [lab[j], lab[i]]; } ids.forEach((n, i) => { st.assign[n] = lab[i]; }); });
      function render() {
        const r = modularity(edges, st.assign, st.gamma), q = r.Q, grp = {}; r.groups.forEach(c => { grp[c.g] = c; });
        const rep = C.reports[st.sel], c = grp[st.sel];
        qline.replaceChildren(K.el('span', {}, 'nodes ', K.el('b', { class: 'num' }, g.nodes.length)), '   ', K.el('span', {}, 'undirected edges m ', K.el('b', { class: 'num' }, r.m)), '   ', K.el('span', {}, 'groups ', K.el('b', { class: 'num' }, r.groups.length)), '   ',
          K.el('span', {}, 'modularity Q ', K.el('b', { class: 'num result', id: 'rQ' }, fx(q))), '   ', K.el('span', { class: r.groups.every(x => x.connected) ? 'good' : 'bad' }, r.groups.every(x => x.connected) ? 'every group is connected' : r.groups.filter(x => !x.connected).length + ' group(s) not connected'));
        if (render.last !== undefined && render.last !== fx(q)) K.flash(qline.querySelector('#rQ')); render.last = fx(q);
        const sm = c ? c.nodes.length : 0;
        const members = c ? c.nodes.map(n => name[n]).slice(0, 14).join(', ') + (c.nodes.length > 14 ? ', ...' : '') : '';
        info.replaceChildren(
          K.el('div', { style: 'border-left:3px solid ' + pal(st.sel) + ';padding-left:10px;margin:8px 0' },
            K.el('b', {}, `c${String(st.sel + 1).padStart(2, '0')}  ${rep.title}`),
            K.el('div', { class: 'hint' }, `real LLM community report (qwen3.7-plus; written from the community's entities, relations and 4 most-mentioned passages; not checked by a human): `),
            K.el('div', {}, rep.summary), K.el('ul', {}, ...rep.findings.map(f => K.el('li', {}, f))),
            K.el('div', { class: 'hint' }, `members now: ${sm} nodes (${members}). Stored size ${rep.size}. Source passages (top 4 of ${rep.n_passages}): ${rep.top_passages.map(p => p + (art[p] ? ' (' + art[p] + ')' : '')).join('; ')}.`),
            c ? K.el('div', { class: 'formula' }, `e_c = ${c.e} edges inside, K_c = ${c.K}   term = ${c.e}/${r.m} - ${fx(st.gamma, 2)} x (${c.K}/${2 * r.m})^2 = ${fx(c.share)} - ${fx(st.gamma * c.chance)} = ${fx(c.term)}\n(the report file counts ${rep.n_edges_inside} inside edges: it counts typed directed edges; the formula uses ${r.m} distinct undirected pairs)`) : ''));
        const top = r.groups.slice().sort((a, b) => b.nodes.length - a.nodes.length).slice(0, 8);
        const rest = r.groups.length - top.length, restSum = r.groups.reduce((s, x) => s + x.term, 0) - top.reduce((s, x) => s + x.term, 0);
        formula.textContent = `Q = sum over groups [ e_c/m - gamma (K_c/2m)^2 ],  m = ${r.m}, gamma = ${fx(st.gamma, 2)}\n  ${top.map(x => fx(x.term, 3)).join(' + ')} + (${rest} smaller groups: ${fx(restSum, 3)}) = ${fx(q)}\nstored Leiden partition at gamma = 1: Q = ${fx(base0.Q)}  (file says ${C.modularity}; recomputed here from graph.json + the partition)`;
        table.replaceChildren(K.el('details', {}, K.el('summary', {}, 'per-group terms (largest 15 groups)'), K.el('table', {}, K.el('tr', {}, ...['group', 'nodes', 'e_c', 'K_c', 'e_c / m', 'gamma (K_c / 2m)^2', 'term'].map(t => K.el('th', {}, t))),
          ...r.groups.slice().sort((a, b) => b.nodes.length - a.nodes.length).slice(0, 15).map(x => K.el('tr', {}, K.el('td', {}, C.reports[x.g] ? 'c' + String(+x.g + 1).padStart(2, '0') : 'group ' + x.g), K.el('td', { class: 'num' }, x.nodes.length), K.el('td', { class: 'num' }, x.e), K.el('td', { class: 'num' }, x.K), K.el('td', { class: 'num' }, fx(x.share)), K.el('td', { class: 'num' }, fx(st.gamma * x.chance)), K.el('td', { class: 'num' }, fx(x.term)))))));
        paint();
      }
      const cav = K.el('details', { open: '' }, K.el('summary', {}, 'Caveats of this pack (read before you trust the numbers)'), K.el('ul', {},
        ...[`Demo scale: 138 passages from 15 English Wikipedia articles on machine learning. This is NOT an evaluation of the thesis system.`,
          `The graph was extracted by an LLM (qwen3.8-flash), one call per passage, and not checked against a human graph. Near-duplicate nodes remain (for example "SVM" and "support vector machine"); ${g.nodes.length} nodes, ${edges.length} distinct undirected pairs from ${g.edges.length} typed edges.`,
          `One Leiden run (leidenalg 0.12.0, ModularityVertexPartition, seed 42, unweighted, gamma = 1). Another seed gives another partition. The graph has 40 connected components, so many communities are small leftovers.`,
          `Q = ${fx(base0.Q)} is high; a likely reason (inferred, not tested) is that the graph is sparse (mean degree 2.25). It says the cut is structurally clean, not that the groups are good topics: titles overlap (two "Support Vector Machines" communities, three on regression and regularization).`,
          `Only the ${nRep} largest communities (16 to 50 nodes) got an LLM report; the other ${C.n_communities - nRep} (under 16 nodes) have none. The reports are LLM text and were not checked.`,
          `The merge, one-group and random buttons re-score a changed partition with the formula; they do not re-run Leiden.`].map(t => K.el('li', {}, t))));
      shell.append(K.el('p', { class: 'hint' }, 'Real data: click a coloured node (or pick a community) to read its real LLM report. Move gamma, or break the partition, and watch Q move. The picture layout is only for reading: position means nothing.'),
        K.el('div', { class: 'row' }, K.el('label', {}, 'community ', selA), K.el('label', {}, 'merge target ', selB), sg.node), presets, cv, qline, info, formula, table, cav);
      new ResizeObserver(paint).observe(cv); st.sel = 0; render();
    }).catch(err => { box.replaceChildren(K.el('div', { class: 'bad' }, 'Real data could not be loaded (' + err.message + '). Serve the Presentations folder over http. Showing the toy example.')); mountToy(el, DemoKit); });
  }

  function mount(el) {
    const K = DemoKit, shell = K.shell(el, 'Leiden communities: cut the graph, score the cut',
      'Modularity compares the edges inside each group with the edges you would expect by chance. Leiden searches for the cut with the highest score. Default: a real graph and its real communities.');
    const body = K.el('div', {}), bar = K.el('div', { class: 'row' });
    const modes = [['real', 'Real example'], ['toy', 'Toy example (break it)']];
    const bs = modes.map(([m, t]) => { const b = K.el('button', {}, t); b.addEventListener('click', () => go(m)); bar.append(b); return b; });
    shell.append(bar, body);
    function go(m) { bs.forEach((b, i) => b.setAttribute('aria-pressed', String(modes[i][0] === m))); body.replaceChildren(); (m === 'real' ? mountReal : mountToy)(body, K); }
    go('real');
  }

  const api = { defaults, compute, mount, modularity };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['leiden_communities'] = api;
})(this);
