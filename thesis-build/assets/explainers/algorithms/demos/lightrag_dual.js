/* LightRAG dual-level retrieval: local keywords match entity keys, global keywords match relation (theme) keys, then one hop outward.
   Toy example ("break it"): a 6-entity, 5-relation graph with invented 2-D embeddings; the LLM keyword step is two points you set (precomputed stand-in).
   Real example (default, PARTIAL): the real-example pack has NO LightRAG run. This walk-through is ASSEMBLED from pack data: stored entity links (low level),
   the 662-node graph (one hop), the 15 community reports (stand-in for relation keys). The global phrases and the MiniLM cosines between phrase and report are
   ours, computed by demos/data/lightrag_dual_real.build.py. Gold coverage is counted from stored passage ids.
   2D on purpose: two keys, one ring; 3D would add nothing here. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const ENT = { Bees: [0.95, 0.10], Hive: [0.80, 0.35], Honey: [0.60, 0.60], Pollination: [0.40, 0.80], Crops: [0.15, 0.95], Smoke: [0.90, -0.20] };
  const REL = [['Bees', 'Hive', [0.90, 0.30]], ['Hive', 'Honey', [0.70, 0.50]], ['Bees', 'Pollination', [0.30, 0.90]], ['Pollination', 'Crops', [0.20, 0.95]], ['Smoke', 'Hive', [0.95, -0.10]]];
  const defaults = { kl: [0.95, 0.12], kg: [0.25, 0.97], k: 1, levels: 'both' };
  const cos = (a, b) => (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1);
  const r4 = x => Math.round(x * 1e4) / 1e4;

  /* PURE. levels: 'both' | 'low' (entities only) | 'high' (relations only). Returns the sets too (extra keys are ignored by the check only if not listed; so they live in detail()). */
  function detail(inp) {
    const names = Object.keys(ENT), lv = inp.levels || 'both', k = Math.max(1, inp.k | 0);
    const eRank = names.map((n, i) => [n, cos(inp.kl, ENT[n]), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]);
    const rRank = REL.map((r, i) => [i, cos(inp.kg, r[2])]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const seeds = new Set(), topE = eRank.slice(0, k), topR = rRank.slice(0, k);
    if (lv !== 'high') topE.forEach(e => seeds.add(e[0]));
    if (lv !== 'low') topR.forEach(r => { seeds.add(REL[r[0]][0]); seeds.add(REL[r[0]][1]); });
    const ctx = new Set(seeds);
    REL.forEach(r => { if (seeds.has(r[0]) || seeds.has(r[1])) { ctx.add(r[0]); ctx.add(r[1]); } });
    const relCtx = REL.map((r, i) => i).filter(i => ctx.has(REL[i][0]) && ctx.has(REL[i][1]));
    return { eRank, rRank, topE, topR, seeds: [...seeds], ctx: [...ctx], relCtx };
  }
  function compute(inp) {
    const d = detail(inp);
    return { top_entity_cosine: r4(d.eRank[0][1]), top_relation_cosine: r4(d.rRank[0][1]), seed_nodes: d.seeds.length, nodes_after_one_hop: d.ctx.length, relations_in_context: d.relCtx.length };
  }

  /* PURE helper for the real walk-through. rec = one question record of data/lightrag_dual_real.json, kw = keyword index, k = number of reports, reps = the report list. */
  function assemble(rec, kw, k, reps) {
    const gold = rec.gold, cs = rec.keywords[kw].cos, top = rec.keywords[kw].order.slice(0, k);
    const low = new Set(rec.p_seed), hop = new Set(rec.p_hop), high = new Set();
    top.forEach(i => reps[i].passages.forEach(p => high.add(p)));
    const dual = new Set([...hop, ...high]), g = s => gold.filter(p => s.has(p));
    return { top, cos: top.map(i => cs[i]), low: { n: low.size, gold: g(low) }, hop: { n: hop.size, gold: g(hop) }, high: { n: high.size, gold: g(high) }, dual: { n: dual.size, gold: g(dual) },
      added_by_high: [...dual].filter(p => !hop.has(p)).length };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: swap the two keywords': { ...clone(defaults), kl: defaults.kg.slice(), kg: defaults.kl.slice() },
    'break it: only the low level (no theme key)': { ...clone(defaults), levels: 'low' },
    'k = 2 per level': { ...clone(defaults), k: 2 },
  };

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults), place = 'kl';
    const box = K.shell(el, 'LightRAG, toy: two keys, one hop',
      'Invented graph of 6 entities (circles) and 5 relations (diamonds = relation keys). Axes are fake topic axes: a point sits where its embedding is. The LLM keyword step is replaced by the two points you set. Pick "local" or "global", then click the plane (or use the number boxes). Cosine is about the angle from the origin, so the dashed rays matter, not the distance.');
    const W = 360, H = 300, X = x => 30 + x * 300, Y = y => 250 - (y + 0.3) / 1.4 * 220;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'embedding plane with entities, relation keys and two keyword points', style: 'width:100%;max-width:520px;background:var(--panel);border-radius:6px;cursor:crosshair;touch-action:manipulation' });
    const mk = (id, lbl, step) => { const i = K.el('input', { type: 'number', step: '0.05', 'aria-label': lbl, style: 'width:66px' }); i.addEventListener('input', () => { const v = parseFloat(i.value); if (Number.isFinite(v)) { st[id[0]][id[1]] = v; render(); } }); return i; };
    const nums = { kl0: mk(['kl', 0], 'local x'), kl1: mk(['kl', 1], 'local y'), kg0: mk(['kg', 0], 'global x'), kg1: mk(['kg', 1], 'global y') };
    const bl = K.el('button', {}, 'place: local keyword'), bg = K.el('button', {}, 'place: global keyword');
    const setPlace = p => { place = p; bl.setAttribute('aria-pressed', String(p === 'kl')); bg.setAttribute('aria-pressed', String(p === 'kg')); };
    bl.addEventListener('click', () => setPlace('kl')); bg.addEventListener('click', () => setPlace('kg')); setPlace('kl');
    svg.addEventListener('click', ev => { const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) / r.width * W, sy = (ev.clientY - r.top) / r.height * H; const x = (sx - 30) / 300, y = (250 - sy) / 220 * 1.4 - 0.3; if (x > 0.02) { st[place] = [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; render(); } });
    const kS = K.slider('k per level', 1, 3, 1, st.k, v => { st.k = v; render(); });
    const lv = K.el('select', { 'aria-label': 'levels' }, ...[['both', 'both levels'], ['low', 'low level only'], ['high', 'high level only']].map(o => K.el('option', { value: o[0] }, o[1])));
    lv.addEventListener('change', () => { st.levels = lv.value; render(); });
    const presets = K.el('div', { class: 'row' }); Object.keys(PRESETS).forEach(n => { const b = K.el('button', {}, n); b.addEventListener('click', () => { st = clone(PRESETS[n]); kS.set(st.k); lv.value = st.levels; render(); }); presets.append(b); });
    const res = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), lists = K.el('div', {});
    box.append(presets, K.el('div', { class: 'row' }, bl, bg, K.el('label', {}, 'local ', nums.kl0, nums.kl1), K.el('label', {}, 'global ', nums.kg0, nums.kg1)), K.el('div', { class: 'row' }, kS.node, K.el('label', {}, 'levels ', lv)), svg, res, lists, formula);
    function render() {
      const d = detail(st), r = compute(st), S = new Set(d.seeds), C = new Set(d.ctx), g = [];
      g.push(K.svg('line', { x1: X(0), y1: Y(0), x2: X(1), y2: Y(0), stroke: 'var(--line)' }), K.svg('line', { x1: X(0), y1: Y(-0.3), x2: X(0), y2: Y(1.1), stroke: 'var(--line)' }));
      REL.forEach((rl, i) => { const a = ENT[rl[0]], b = ENT[rl[1]], inC = d.relCtx.includes(i); g.push(K.svg('line', { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), stroke: inC ? 'var(--he)' : 'var(--faint)', 'stroke-width': inC ? 2 : 1, opacity: inC ? 1 : 0.5 })); });
      [['kl', 'var(--ai)'], ['kg', 'var(--k12)']].forEach(([id, c]) => { const v = st[id]; g.push(K.svg('line', { x1: X(0), y1: Y(0), x2: X(v[0] * 1.05), y2: Y(v[1] * 1.05), stroke: c, 'stroke-dasharray': '4 3', 'stroke-width': 1.5 }), K.svg('circle', { cx: X(v[0]), cy: Y(v[1]), r: 6, fill: c, stroke: 'var(--bg)' }), K.svg('text', { x: X(v[0]) + 8, y: Y(v[1]) - 6, fill: c, 'font-size': 11 }, id === 'kl' ? 'local key' : 'global key')); });
      REL.forEach((rl, i) => { const v = rl[2], top = d.topR.some(t => t[0] === i) && st.levels !== 'low'; g.push(K.svg('rect', { x: X(v[0]) - 4, y: Y(v[1]) - 4, width: 8, height: 8, transform: `rotate(45 ${X(v[0])} ${Y(v[1])})`, fill: top ? 'var(--k12)' : 'none', stroke: top ? 'var(--k12)' : 'var(--muted)' })); });
      Object.keys(ENT).forEach(n => { const v = ENT[n], top = d.topE.some(t => t[0] === n) && st.levels !== 'high', inS = S.has(n), inC = C.has(n);
        g.push(K.svg('circle', { cx: X(v[0]), cy: Y(v[1]), r: 7, fill: inS ? 'var(--he)' : 'var(--panel2)', stroke: inC ? 'var(--he)' : 'var(--muted)', 'stroke-width': top ? 3 : 1.5, 'stroke-dasharray': inC && !inS ? '3 2' : '' }), K.svg('text', { x: X(v[0]) - 10, y: Y(v[1]) + 18, fill: 'var(--text)', 'font-size': 11 }, n)); });
      svg.replaceChildren(...g);
      Object.entries(nums).forEach(([k2, i]) => { const v = st[k2.slice(0, 2)][+k2[2]]; if (document.activeElement !== i) i.value = v; });
      const ring = d.ctx.filter(n => !S.has(n)), lowOnly = detail({ ...st, levels: 'low' });
      res.replaceChildren(
        K.el('div', {}, 'low level: best entity ', K.el('b', { class: 'num' }, d.eRank[0][0] + ' ' + K.fmt(d.eRank[0][1], 4)), '   high level: best relation ', K.el('b', { class: 'num' }, REL[d.rRank[0][0]][0] + '-' + REL[d.rRank[0][0]][1] + ' ' + K.fmt(d.rRank[0][1], 4))),
        K.el('div', {}, 'seeds (solid): ', K.el('b', {}, d.seeds.join(', ') || 'none'), '   one-hop ring (dashed): ', K.el('b', {}, ring.join(', ') || 'none')),
        K.el('div', {}, 'context: ', K.el('b', { class: 'num' }, `${r.nodes_after_one_hop} nodes, ${r.relations_in_context} relations`), `  (low level alone: ${lowOnly.ctx.length} nodes, ${lowOnly.relCtx.length} relations)`),
        d.ctx.includes('Crops') ? K.el('div', { class: 'good' }, 'Crops, the end of the food-supply story, is in the context.') : K.el('div', { class: 'bad' }, 'Crops is NOT in the context: the question is about food supply, and this context cannot reach it.'),
        (cos(st.kl, ENT.Crops) > cos(st.kl, ENT.Bees)) ? K.el('div', { class: 'bad' }, 'Keywords look swapped (the "local" key sits near Crops, a theme-like spot): the wrong index is searched. LightRAG depends on the keyword-extraction LLM labelling entity words and theme words correctly.') : '');
      formula.textContent = 'C(q) = seeds + one-hop neighbours\n' + `v = top-${st.k} entity by cos(k_local, u) = ${d.topE.map(t => t[0] + ' ' + K.fmt(t[1], 3)).join(', ')}\n` + `e = top-${st.k} relation by cos(k_global, r) = ${d.topR.map(t => REL[t[0]][0] + '-' + REL[t[0]][1] + ' ' + K.fmt(t[1], 3)).join(', ')}`;
      lists.replaceChildren(K.el('div', { class: 'hint' }, 'Cosines, all entities: ' + d.eRank.map(t => t[0] + ' ' + K.fmt(t[1], 3)).join(', ') + '. All relations: ' + d.rRank.map(t => REL[t[0]][0] + '-' + REL[t[0]][1] + ' ' + K.fmt(t[1], 3)).join(', ') + '.'));
    }
    render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('data/', SRC || location.href).href;
    const box = K.shell(el, 'Real example (partial): a dual-level walk-through assembled from the real-example pack',
      'IMPORTANT: the pack has no LightRAG run. Nothing below is a LightRAG measurement. What is real: the low-level keys (entities the stored linker found in each question), the 662-node graph that an LLM extracted from 138 Wikipedia passages, and the 15 community reports. What is ours: the global phrases (hand-written, standing in for the LLM keyword step) and the cosines between phrase and report (MiniLM, computed by us). LightRAG matches global keys against RELATION keys; the pack has none, so a community report stands in for one. Gold coverage is counted from stored passage ids.');
    const body = K.el('div', {}, 'loading...'); box.append(body);
    fetch(base + 'lightrag_dual_real.json').then(r => { if (!r.ok) throw new Error('lightrag_dual_real.json ' + r.status); return r.json(); }).then(D => {
      const sel = K.el('select', { 'aria-label': 'question' }, ...D.questions.map((q, i) => K.el('option', { value: i }, q.id + '  ' + q.question.slice(0, 70))));
      const kwR = K.el('div', { class: 'row' }), out = K.el('div', {}), qbox = K.el('div', {}), seedBox = K.el('div', {}), repBox = K.el('div', {}), ctxBox = K.el('div', {}), verdict = K.el('div', {});
      let kw = 0; const kS = K.slider('reports taken (k)', 1, 3, 1, 1, () => draw());
      function bar(label, n, color, gold, G) { const w = Math.round(n / D.n_passages * 100);
        return K.el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding:4px 0' },
          K.el('b', { style: 'flex:1 1 210px;min-width:0' }, label), K.el('div', { style: 'width:130px;background:var(--line);border-radius:2px' }, K.el('div', { style: `height:10px;border-radius:2px;width:${Math.max(w, 2)}%;background:${color}` })),
          K.el('span', { class: 'num' }, `${n} of ${D.n_passages} passages`), K.el('span', { class: 'num ' + (gold.length === G ? 'good' : 'bad') }, `gold ${gold.length} of ${G}`)); }
      function draw() {
        const q = D.questions[sel.value | 0], k = kS.get(), a = assemble(q, kw, k, D.reports), G = q.gold.length;
        kwR.replaceChildren(K.el('span', { class: 'hint' }, 'global phrase (ours): '), ...q.keywords.map((x, i) => { const b = K.el('button', { 'aria-pressed': String(i === kw) }, (i === 2 ? 'break it: ' : '') + '"' + x.phrase + '"'); b.addEventListener('click', () => { kw = i; draw(); }); return b; }));
        qbox.replaceChildren(K.el('div', {}, K.el('b', {}, q.question), K.el('span', { class: 'hint' }, `  (${q.type}; gold passages ${q.gold.join(', ')})`)));
        seedBox.replaceChildren(K.el('b', { style: 'color:var(--ai)' }, 'Low level: local keys = entities the stored linker found (string match), real'),
          K.el('div', {}, q.seeds.map(s => `${s.name} (${s.degree} edges)`).join(', ')), K.el('div', { class: 'hint' }, `one hop outward adds ${q.neighbours.length} neighbour nodes`));
        const order = q.keywords[kw].order;
        repBox.replaceChildren(K.el('b', { style: 'color:var(--k12)' }, 'High level: global key vs community reports (stand-in for relation keys; cosine computed by us)'),
          ...order.slice(0, 5).map((i, r) => K.el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:2px 0;opacity:' + (r < k ? 1 : 0.5) },
            K.el('span', { style: 'flex:1 1 230px;min-width:0' }, `${r < k ? '> ' : ''}${D.reports[i].id} ${D.reports[i].title}`),
            K.el('div', { style: 'width:100px;background:var(--line);border-radius:2px' }, K.el('div', { style: `height:8px;border-radius:2px;width:${Math.round(Math.max(q.keywords[kw].cos[i], 0) * 100)}%;background:var(--k12)` })),
            K.el('span', { class: 'num' }, K.fmt(q.keywords[kw].cos[i], 3)), K.el('span', { class: 'hint' }, `${D.reports[i].passages.length} passages`))));
        ctxBox.replaceChildren(K.el('b', {}, 'Context sets (passages the nodes are attached to)'),
          bar('seed entities only', a.low.n, 'var(--ai)', a.low.gold, G), bar('seeds + one hop (low level, LightRAG-style)', a.hop.n, 'var(--he)', a.hop.gold, G),
          bar(`+ top-${k} report footprint (dual, our assembly)`, a.dual.n, 'var(--k12)', a.dual.gold, G));
        const lost = q.gold.filter(p => !a.dual.gold.includes(p)), only = a.dual.gold.filter(p => !a.hop.gold.includes(p)), v = [];
        if (only.length) v.push(K.el('div', { class: 'good' }, `The high level added gold passage ${only.join(', ')} that the low level missed (${a.added_by_high} extra passages came with it).`));
        else v.push(K.el('div', { class: 'hint' }, `The high level added ${a.added_by_high} passages and NO new gold passage.`));
        if (lost.length) v.push(K.el('div', { class: 'bad' }, `Still missing: ${lost.join(', ')}. Neither key reaches it, so the LLM never sees it.`));
        if (kw === 2) v.push(K.el('div', { class: 'bad' }, 'An entity name used as the "theme" key: the global index is searched with an entity word. It lands on whichever report mentions it most, which is the failure the paper-level pipeline has when keyword extraction mislabels.'));
        if (a.dual.n > 0.4 * D.n_passages) v.push(K.el('div', { class: 'bad' }, `The dual context is ${Math.round(a.dual.n / D.n_passages * 100)}% of the corpus: a community footprint is coarse, so this is little of a filter.`));
        verdict.replaceChildren(...v);
      }
      sel.addEventListener('change', () => { kw = 0; draw(); });
      const cav = K.el('div', { class: 'hint' }, `Limits: ${D.questions.length} hand-picked questions with entity links and multi-passage or theme wording; keyword phrases are ours; LightRAG's relation keys and its entity/relation text are not in the pack; the dual set is our assembly (community footprint added to a one-hop set), not LightRAG's code. Demo scale, not an evaluation. Text from Wikipedia, CC BY-SA 4.0.`);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;max-width:100%' }, 'question ', sel)), qbox, kwR, K.el('div', { class: 'row' }, kS.node), seedBox, repBox, ctxBox, verdict, cav); draw();
    }).catch(e => { body.textContent = 'could not load the assembled data (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example (assembled from the pack)'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy); mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, assemble, detail };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['lightrag_dual'] = api;
})(this);
