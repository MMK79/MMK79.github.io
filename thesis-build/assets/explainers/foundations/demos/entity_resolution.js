/* entity_resolution: blocking -> matching -> clusters on the REAL 662-node graph of the pack.
   Step 1 blocking: shared-word blocks cut 218,791 possible pairs to 3,551 candidates (stop-word list and block-size cap are editable).
   Step 2 matching: token Jaccard on the candidates with a threshold slider; precision / recall ONLY on pairs that carry a label
     (37 pairs hand-picked and hand-labelled by us; 163 pairs = 43 merged + a seeded random sample of 120 of a 402-pair pool, labelled by an LLM and re-read by us).
   Step 3 clusters: connected components of the accepted pairs, with the labelled merges marked right or wrong, and chaining.
   Step 4 scores: B-cubed and pairwise precision / recall / F1 of the clusters on gold clusters we built for a seeded sample of 60 graph nodes (67 surface forms; one labeller; data/er_bcubed.real.json).
   Serves j1-entity-resolution-blocking, j1-entity-resolution-matching, j1-entity-resolution-clustering-metrics.
   compute() is pure. Pack files are fetched relative to this script. No LLM call. 2-D only. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const DATA = SRC ? new URL('data/entity_resolution.real.json', SRC).href : '';
  const B3DATA = SRC ? new URL('data/er_bcubed.real.json', SRC).href : '';

  const STOP_DEFAULT = ['of', 'the', 'and', 'a', 'in', 'for', 'to', 'on', 'with', 'data', 'model', 'models'];
  /* PURE. Lower-case words [a-z0-9]+, trailing s removed (all of them, like Python rstrip('s')), then stop words removed. */
  function tokens(s, stop, strip) {
    const ws = (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).map(w => strip === false ? w : w.replace(/s+$/, ''));
    return new Set(ws.filter(w => !stop.has(w)));
  }
  const jaccard = (A, B) => { let o = 0; A.forEach(x => { if (B.has(x)) o++; }); const u = A.size + B.size - o; return u ? o / u : 0; };
  /* PURE. Token blocking: every word is a key; the names that contain it form a block; a block with more than `cap` names is skipped;
     candidate pairs = union of all pairs inside the kept blocks (a pair that shares two words is counted once). */
  function block(names, o) {
    o = o || {}; const stop = new Set(o.stop || STOP_DEFAULT), cap = o.cap || Infinity, TK = names.map(n => tokens(n, stop, o.strip));
    const inv = new Map(); TK.forEach((t, i) => t.forEach(w => { if (!inv.has(w)) inv.set(w, []); inv.get(w).push(i); }));
    const n = names.length, cand = new Set(), blocks = [];
    inv.forEach((ids, w) => { blocks.push({ tok: w, size: ids.length, pairs: ids.length * (ids.length - 1) / 2, skipped: ids.length > cap });
      if (ids.length > cap) return;
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) cand.add(ids[a] * n + ids[b]); });
    blocks.sort((x, y) => y.size - x.size || (x.tok < y.tok ? -1 : 1));
    const pairs = [...cand].map(k => [Math.floor(k / n), k % n]), total = n * (n - 1) / 2;
    return { n, total, nCand: pairs.length, rr: 1 - pairs.length / total, pairs, TK, blocks, sizes: new Map([...inv].map(([w, ids]) => [w, ids.length])), cap };
  }
  /* PURE. Candidates with their Jaccard, best first (ties by name). */
  function score(names, B) {
    return B.pairs.map(([i, j]) => ({ i, j, s: jaccard(B.TK[i], B.TK[j]) })).sort((x, y) => y.s - x.s || (names[x.i] < names[y.i] ? -1 : names[x.i] > names[y.i] ? 1 : names[x.j] < names[y.j] ? -1 : 1));
  }
  /* PURE. Is a labelled pair (two strings) inside a kept block? Same rule as block(): they share a word whose block has at most cap names. */
  function blocked(a, b, B, stop, strip) {
    const A = tokens(a, stop, strip), C = tokens(b, stop, strip);
    for (const w of A) if (C.has(w) && (B.sizes.get(w) || 0) <= B.cap) return true;
    return false;
  }
  /* PURE. Union-find clusters of the accepted pairs. */
  function clusters(n, accepted) {
    const p = Array.from({ length: n }, (_, i) => i), f = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    accepted.forEach(([a, b]) => { const ra = f(a), rb = f(b); if (ra !== rb) p[ra] = rb; });
    const g = new Map(); for (let i = 0; i < n; i++) { const r = f(i); if (!g.has(r)) g.set(r, []); g.get(r).push(i); }
    const all = [...g.values()].sort((x, y) => y.length - x.length), multi = all.filter(c => c.length > 1);
    return { find: f, all, multi, nClusters: all.length, nMulti: multi.length, nodesInMulti: multi.reduce((s, c) => s + c.length, 0), biggest: all[0] ? all[0].length : 0 };
  }
  /* PURE. Precision / recall on LABELLED pairs only. items[i] = {a, b, merged, same, stratum?}. A pair is predicted "same" when the pack already merged it
     (merged = true) or when it is a candidate (inside a kept block) with Jaccard >= t (t > 1 = Jaccard rule off).
     With opts.pool (size of the pool the unmerged sample came from) the stratified estimate is used: merged stratum = census (weight 1),
     every sampled unmerged pair stands for pool / n_unmerged pairs. Recall is then relative to that pool only. */
  function evaluate(items, t, B, opts) {
    opts = opts || {}; const stop = new Set(opts.stop || STOP_DEFAULT), rows = [];
    for (const x of items) {
      const A = tokens(x.a, stop, opts.strip), C = tokens(x.b, stop, opts.strip), J = jaccard(A, C), bl = blocked(x.a, x.b, B, stop, opts.strip);
      const pred = !!x.merged || (bl && J >= t && t <= 1);
      rows.push({ x, J, blocked: bl, pred, verdict: pred && x.same ? 'TP' : pred ? 'FP' : x.same ? 'FN' : 'TN' });
    }
    const unm = rows.filter(r => !r.x.merged), nu = unm.length, w = opts.pool && nu ? opts.pool / nu : 1;
    let tp = 0, fp = 0, fn = 0, tn = 0;
    rows.forEach(r => { const k = (opts.pool && !r.x.merged) ? w : 1; if (r.verdict === 'TP') tp += k; else if (r.verdict === 'FP') fp += k; else if (r.verdict === 'FN') fn += k; else tn += k; });
    const P = tp + fp ? tp / (tp + fp) : 0, R = tp + fn ? tp / (tp + fn) : 0, F1 = P + R ? 2 * P * R / (P + R) : 0;
    const gold = rows.filter(r => r.x.same && !r.x.merged), lost = gold.filter(r => !r.blocked).length;
    return { rows, tp, fp, fn, tn, P, R, F1, w, goldUnmerged: gold.length, lostByBlocking: lost };
  }
  /* PURE. B-cubed (Bagga and Baldwin 1998, Sec. 7.3): for each item d, P_d = |S_d and G_d| / |S_d|, R_d = |S_d and G_d| / |G_d|, S_d = items with the same system label,
     G_d = items with the same gold label; P and R are the means over the N items (equal weights 1/N); F1 = 2PR/(P+R). Also the pairwise P/R/F1 over item pairs. */
  function bcubed(sys, gold) {
    const N = sys.length, cs = new Map(), cg = new Map(), cb = new Map();
    for (let i = 0; i < N; i++) { cs.set(sys[i], (cs.get(sys[i]) || 0) + 1); cg.set(gold[i], (cg.get(gold[i]) || 0) + 1); const k = sys[i] + '\u0001' + gold[i]; cb.set(k, (cb.get(k) || 0) + 1); }
    let P = 0, R = 0; const per = [];
    for (let i = 0; i < N; i++) { const inter = cb.get(sys[i] + '\u0001' + gold[i]), p = inter / cs.get(sys[i]), r = inter / cg.get(gold[i]); P += p; R += r; per.push({ inter, s: cs.get(sys[i]), g: cg.get(gold[i]), p, r }); }
    P /= N; R /= N;
    let tp = 0, sp = 0, gp = 0; const c2 = n => n * (n - 1) / 2; cb.forEach(v => { tp += c2(v); }); cs.forEach(v => { sp += c2(v); }); cg.forEach(v => { gp += c2(v); });
    const pp = sp ? tp / sp : 0, pr = gp ? tp / gp : 0;
    return { P, R, F1: P + R ? 2 * P * R / (P + R) : 0, per, pair: { tp, fp: sp - tp, fn: gp - tp, P: pp, R: pr, F1: pp + pr ? 2 * pp * pr / (pp + pr) : 0 } };
  }
  /* PURE. All three steps for one setting (what the page shows as numbers). */
  function compute(inp) {
    const names = inp.names, B = block(names, { stop: inp.stop, strip: inp.strip, cap: inp.cap }), S = score(names, B), t = inp.t;
    const acc = S.filter(x => x.s >= t).map(x => [x.i, x.j]), C = clusters(names.length, acc);
    const ev = inp.items ? evaluate(inp.items, t, B, { stop: inp.stop, strip: inp.strip, pool: inp.pool }) : null;
    return { n: B.n, total: B.total, nCand: B.nCand, rr: B.rr, nGE05: S.filter(x => x.s >= 0.5).length, nEq1: S.filter(x => x.s === 1).length, accepted: acc.length, nMulti: C.nMulti, biggest: C.biggest, P: ev && ev.P, R: ev && ev.R, F1: ev && ev.F1 };
  }

  /* toy defaults (NOT real): 6 names so compute() runs without the pack; the real page and the node check use the 662 real names. */
  const defaults = {
    names: ['linear regression', 'linear regression models', 'lasso', 'least absolute shrinkage and selection operator', 'random forests', 'random forest'],
    stop: STOP_DEFAULT, strip: true, cap: 0, t: 0.5,
    items: [{ a: 'linear regression', b: 'linear regression models', merged: false, same: true }, { a: 'random forests', b: 'random forest', merged: true, same: true }, { a: 'lasso', b: 'least absolute shrinkage and selection operator', merged: true, same: true }, { a: 'linear regression', b: 'random forest', merged: false, same: false }]
  };
  const api = { defaults, compute, mount, tokens, jaccard, block, score, blocked, clusters, evaluate, bcubed, STOP_DEFAULT };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['entity_resolution'] = api;

  const CSS = `.er .scroll{overflow-x:auto}.er label{max-width:100%}.er .row{min-width:0}.er .tall{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:6px}
.er td,.er th{font-size:13px;vertical-align:top}.er tr.pick{cursor:pointer}.er tr.pick:hover{background:var(--panel2)}.er tr.cur{background:#F2A93B22}
.er .v{font-size:11px;border:1px solid;border-radius:4px;padding:0 5px}.er .TP{color:#3CC7B4}.er .TN{color:#98A0B0}.er .FP{color:#FF5C5C}.er .FN{color:#C28BFF}
.er .kpi{display:flex;flex-wrap:wrap;gap:6px 18px;margin:8px 0}.er .kpi b{font:300 22px var(--display);color:var(--ai)}
.er .chip{display:inline-block;border:1px solid var(--line);border-radius:10px;padding:0 8px;margin:2px;font-size:12px;cursor:pointer;background:var(--panel2);color:var(--text)}
.er .chip.off{opacity:.45;text-decoration:line-through}.er h4{margin:16px 0 4px}.er .ev{background:var(--panel2);border-radius:6px;padding:8px;font-size:13px;margin:6px 0}`;

  function mount(el) {
    const K = DemoKit, E = K.el;
    if (!document.getElementById('er-css')) document.head.append(E('style', { id: 'er-css' }, CSS));
    const shell = K.shell(el, 'Entity resolution on the real graph: block, match, cluster', 'The pack merged only 4 abbreviation pairs. Here you change the blocking and the matching rule and see how many pairs are compared, which merges are right or wrong where a label exists, and what the clusters look like.');
    shell.classList.add('er');
    const box = E('div'); shell.append(box); box.append(E('p', { class: 'hint' }, 'Loading the pack...'));
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get(PACK + 'graph/graph.json'), get(DATA), get(B3DATA)]).then(([g, d, b]) => build(box, g, d, b)).catch(e => { box.textContent = 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder so ../../_real-examples/ resolves.'; });
  }

  function build(box, G, D, B3) {
    const K = DemoKit, E = K.el, nodes = G.nodes, names = nodes.map(n => n.name), id2i = new Map(nodes.map((n, i) => [n.id, i]));
    const st = { stop: new Set(STOP_DEFAULT), strip: true, cap: 662, t: 0.5, set: 'sample', sel: -1, more: 12 };
    const SETS = { hand: { items: D.hand, label: '37 pairs hand-picked and labelled by us (not random, a demo)', pool: 0 }, sample: { items: D.sample, label: '163 pairs: 43 merged (all) + 120 random of a 402-pair pool; LLM label re-read by us', pool: D.sample_meta.pool_unmerged } };
    const labelled = new Map(); // node-pair key -> {same, set}
    D.hand.concat(D.sample).forEach(p => { if (p.na !== p.nb) labelled.set([p.na, p.nb].sort().join('|'), p.same); });
    box.textContent = '';
    box.append(E('p', { class: 'hint bad' }, 'Real: the 662 node names, the blocking and Jaccard counts, the clusters. Labels: ours or an LLM re-read by us, only on the labelled pairs; precision and recall are shown only there. The 163-pair set estimates recall relative to its 402-pair pool, so true recall is lower (pairs whose names share nothing, like Tikhonov regularization and ridge regression, are outside it). Not a benchmark, one labeller, demo scale. The stop-word list is our choice.'));

    // ---- step 1 blocking
    box.append(E('h4', {}, '1. Blocking: which pairs are worth comparing?'));
    const chips = E('div', {}); const capS = K.slider('largest block allowed (names per word)', 5, 662, 1, 662, v => { st.cap = v; draw(); });
    const plural = E('button', { 'aria-pressed': 'true', onclick: () => { st.strip = !st.strip; draw(); } }, 'strip plural s');
    const presets = E('div', { class: 'row' }, E('button', { onclick: () => { st.stop = new Set(STOP_DEFAULT); st.strip = true; st.cap = 662; capS.set(662); draw(); } }, 'record setting (12 stop words)'),
      E('button', { onclick: () => { st.stop = new Set(); draw(); } }, 'no stop words'), E('button', { onclick: () => { st.cap = 30; capS.set(30); draw(); } }, 'cap blocks at 30'), plural);
    box.append(E('p', { class: 'hint' }, 'A block = all names that contain one word. Only pairs inside a block are compared. Click a word to drop it from the stop list.'), chips, E('div', { class: 'row' }, capS.node), presets);
    const kpi1 = E('div', { class: 'kpi' }), blk = E('div', { class: 'scroll' }); box.append(kpi1, blk);
    box.append(E('div', { class: 'formula' }, 'RR = 1 - |C| / |E|     PC = |C and M| / |M|     PQ = |C and M| / |C|     |E| = n(n-1)/2 = 662 x 661 / 2 = 218,791   (C = candidate pairs, M = true matching pairs)'));

    // ---- step 2 matching
    box.append(E('h4', {}, '2. Matching: score the candidates, choose a threshold'));
    const tS = K.slider('merge when token Jaccard >=  (above 1 = rule off, only the pack merges)', 0.05, 1.05, 0.05, 0.5, v => { st.t = Math.round(v * 100) / 100; draw(); });
    const setSel = E('select', { style: 'max-width:100%;width:100%' }, E('option', { value: 'sample' }, SETS.sample.label), E('option', { value: 'hand' }, SETS.hand.label));
    setSel.addEventListener('change', () => { st.set = setSel.value; st.sel = -1; draw(); });
    box.append(E('div', { class: 'row' }, tS.node), E('div', { class: 'row' }, E('label', {}, 'labelled set ', setSel)));
    box.append(E('div', { class: 'formula' }, 'J(a,b) = |tokens(a) and tokens(b)| / |tokens(a) or tokens(b)|     P = TP/(TP+FP)   R = TP/(TP+FN)   F1 = 2PR/(P+R)   (only on labelled pairs)'));
    const kpi2 = E('div', { class: 'kpi' }), plot = E('div'), lab = E('div', { class: 'tall' }), evBox = E('div'), cand = E('div', { class: 'scroll' });
    box.append(kpi2, plot, E('p', { class: 'hint' }, 'Labelled pairs (click a row for the sentences). TP = merged and the same thing, FP = merged but different things (a wrong merge), FN = same thing but kept apart, TN = kept apart and different.'), lab, evBox);
    box.append(E('h4', {}, 'Candidate pairs the rule accepts at this threshold (best first)'), cand);

    // ---- step 3 clusters
    box.append(E('h4', {}, '3. Clusters: pairs become groups'));
    const kpi3 = E('div', { class: 'kpi' }), cl = E('div', { class: 'scroll' }); box.append(kpi3, cl);
    box.append(E('div', { class: 'formula' }, 'transitive closure: a=b and b=c  =>  a=c, so one wrong pair can join two large groups   (B-cubed per mention d: P = |S_d and G_d| / |S_d|, R = |S_d and G_d| / |G_d|)'));
    box.append(E('p', { class: 'hint' }, 'The pair labels above are a sample of pairs, not clusters. Scoring whole clusters needs gold clusters: step 4 uses a small set we built.'));
    // ---- step 4 B-cubed
    box.append(E('h4', {}, '4. Scoring the clusters: B-cubed and pairwise, on a gold sample'));
    const nm = new Map(B3.nodes.map(n => [n.id, n]));
    box.append(E('p', { class: 'hint bad' }, 'Real: the sample (' + B3.n_nodes + ' nodes drawn with seed ' + B3.sample.seed + ' from the union of the ' + B3.sample.top_blocks.length + ' largest blocks: ' + B3.sample.top_blocks.map(b => b[0] + ' ' + b[1]).join(', ') + '; ' + B3.sample.pool_nodes + ' nodes in the union), the ' + B3.n_items + ' surface forms (node name plus aliases), the scores. Ours: the gold clusters. ONE labeller: ' + B3.labeller_model + ' proposed the groups (1 call), the author re-read every group against the passage text and made ' + B3.review.disagreements + ' changes (listed below). NOT a human gold standard, no second labeller, no agreement figure. Demo scale: ' + B3.n_nodes + ' of 662 nodes, only ' + B3.n_gold_multi_node_groups + ' gold groups join different nodes, so a duplicate whose partner is outside the sample is invisible here and recall is probably overstated for the whole graph. Items are surface forms, one weight each.'));
    const kpi4 = E('div', { class: 'kpi' }), pick4 = E('div'), tab4 = E('div', { class: 'scroll' }); box.append(kpi4, E('div', { class: 'formula' }, 'P_B3 = (1/N) sum_d |S_d and G_d| / |S_d|     R_B3 = (1/N) sum_d |S_d and G_d| / |G_d|     F1 = 2 P R / (P + R)     N = ' + B3.n_items + ' items   (S_d = the system cluster of d, G_d = its gold cluster; Bagga and Baldwin 1998, Sec. 7.3, equal weights 1/N)'), pick4, tab4);
    const gl = (g, col) => g.map(i => nm.get(i).name).join(' + ');
    box.append(E('h4', {}, 'Our gold clusters that join different graph nodes (' + B3.n_gold_multi_node_groups + ' of the sample) and the changes we made to the LLM labels'));
    box.append(E('div', { class: 'scroll' }, E('table', {}, E('tr', {}, ['gold cluster (nodes)', 'source'].map(h => E('th', {}, h))),
      ...B3.gold_groups.filter(g => g.length > 1).map(g => E('tr', {}, E('td', {}, gl(g)), E('td', {}, B3.review.merges_we_added.some(m => m.nodes.join() === g.slice().sort().join()) ? 'we added this merge (the LLM kept them apart): ' + B3.review.merges_we_added.find(m => m.nodes.join() === g.slice().sort().join()).why : 'LLM and we agree: ' + (B3.review.llm_groups_we_accepted.find(m => g.slice().sort().join() === m.nodes.slice().sort().join()) || { why: '' }).why))),
      ...B3.review.aliases_we_kept.map(a => E('tr', {}, E('td', {}, 'alias "' + a.alias + '" of ' + nm.get(a.node).name), E('td', {}, 'the LLM called it wrong; we kept it: ' + a.why))),
      ...B3.review.aliases_we_split.map(a => E('tr', {}, E('td', {}, 'alias "' + a.alias + '" of ' + nm.get(a.node).name), E('td', {}, 'we call it wrong (a bad merge by the pack, a precision error): ' + a.why))))));
    box.append(E('p', { class: 'hint' }, 'Reading: with the pack as built (every node is its own cluster) precision is high because the pack merges little; recall is lost on the ' + B3.n_gold_multi_node_groups + ' gold groups that the pack keeps in separate nodes. Lower the Jaccard threshold above and watch the scores: at J >= 0.75 recall rises a little; at J >= 0.5 the groups chain into one of 103 nodes, so B-cubed recall is 1.000 but precision falls to 0.367 (pairwise precision 0.016). These are scores on a sample of ' + B3.n_nodes + ' nodes, not of the graph.'));

    function draw() {
      // chips
      chips.textContent = ''; STOP_DEFAULT.forEach(w => chips.append(E('button', { class: 'chip' + (st.stop.has(w) ? '' : ' off'), onclick: () => { st.stop.has(w) ? st.stop.delete(w) : st.stop.add(w); draw(); } }, w)));
      plural.setAttribute('aria-pressed', String(st.strip));
      const opts = { stop: [...st.stop], strip: st.strip, cap: st.cap >= 662 ? 0 : st.cap };
      const B = block(names, opts), S = score(names, B), acc = S.filter(x => x.s >= st.t);
      // step 1 numbers
      const set = SETS[st.set], ev = evaluate(set.items, st.t, B, { stop: opts.stop, strip: st.strip, pool: set.pool });
      const hand = evaluate(D.hand, 2, B, { stop: opts.stop, strip: st.strip });
      const goldBoth = hand.goldUnmerged, kept = goldBoth - hand.lostByBlocking;
      kpi1.textContent = '';
      [[B.total.toLocaleString('en-US'), 'all pairs, n(n-1)/2'], [B.nCand.toLocaleString('en-US'), 'candidate pairs after blocking'], [K.fmt(B.rr, 4), 'reduction ratio RR'], [S.filter(x => x.s >= 0.5).length, 'candidates with J >= 0.5'], [S.filter(x => x.s === 1).length, 'with J = 1']]
        .forEach(([v, l]) => kpi1.append(E('span', {}, E('b', {}, String(v)), ' ' + l)));
      const isRecord = B.nCand === 3551 && st.cap >= 662;
      kpi1.append(E('span', { class: isRecord ? 'good' : 'hint' }, isRecord ? 'same as the record: 3,551 pairs, RR 0.9838' : 'differs from the record (3,551 pairs, RR 0.9838) because you changed the setting'));
      blk.textContent = '';
      blk.append(E('p', { class: 'hint' }, 'Pairs completeness PC, only where labels exist: of the ' + goldBoth + ' hand-labelled same-concept pairs that the pack did NOT merge, ' + kept + ' are inside a kept block and ' + hand.lostByBlocking + ' are lost by blocking (no shared word left). PC cannot be computed for the whole graph (no gold duplicate pairs).'));
      blk.append(E('table', {}, E('tr', {}, ['word (block key)', 'names in block', 'pairs it adds'].map(h => E('th', {}, h))), ...B.blocks.slice(0, 8).map(b => E('tr', {}, E('td', {}, E('code', {}, b.tok), b.skipped ? E('span', { class: 'bad' }, ' skipped by the cap') : ''), E('td', { class: 'num' }, String(b.size)), E('td', { class: 'num' }, String(b.pairs))))));
      // step 2 numbers
      kpi2.textContent = '';
      const cnt = (set.pool ? 'estimated (each sampled unmerged pair stands for ' + K.fmt(ev.w, 2) + ' pairs)' : 'counts');
      [[K.fmt(ev.P, 3), 'precision'], [K.fmt(ev.R, 3), 'recall'], [K.fmt(ev.F1, 3), 'F1']].forEach(([v, l]) => kpi2.append(E('span', {}, E('b', {}, v), ' ' + l)));
      kpi2.append(E('span', { class: 'hint' }, cnt + ': TP ' + K.fmt(ev.tp, 1) + '  FP ' + K.fmt(ev.fp, 1) + '  FN ' + K.fmt(ev.fn, 1) + '  TN ' + K.fmt(ev.tn, 1) + '. Labelled pairs only.'));
      drawPlot(B, set);
      lab.textContent = '';
      const tb = E('table', {}, E('tr', {}, ['', 'name a', 'name b', 'J', 'in block', 'label'].map(h => E('th', {}, h))));
      ev.rows.forEach((r, i) => tb.append(E('tr', { class: 'pick' + (st.sel === i ? ' cur' : ''), onclick: () => { st.sel = i; draw(); } },
        E('td', {}, E('span', { class: 'v ' + r.verdict }, r.verdict)), E('td', {}, r.x.a), E('td', {}, r.x.b), E('td', { class: 'num' }, r.x.merged ? 'merged by pack' : K.fmt(r.J, 2)), E('td', {}, r.x.merged ? '-' : r.blocked ? 'yes' : 'NO'), E('td', {}, r.x.same ? 'same' : 'different'))));
      lab.append(tb);
      evBox.textContent = '';
      if (st.sel >= 0 && ev.rows[st.sel]) { const x = ev.rows[st.sel].x; evBox.append(E('div', { class: 'ev' }, E('b', {}, x.a + '  /  ' + x.b + ': ' + (x.same ? 'same concept' : 'different concepts')), E('div', {}, 'Why: ' + x.why + (x.mine ? ' (our override of the LLM label: ' + x.mine + ')' : '')), E('div', { class: 'hint' }, x.ea.p + ': ' + x.ea.x), E('div', { class: 'hint' }, x.eb.p + ': ' + x.eb.x))); }
      // candidate list
      cand.textContent = '';
      cand.append(E('p', { class: 'hint' }, acc.length + ' of ' + B.nCand + ' candidates have J >= ' + st.t + (st.t > 1 ? ' (rule off)' : '') + '. A label chip appears where the pair is in a labelled set.'));
      const ct = E('table', {}, E('tr', {}, ['J', 'name a', 'name b', 'label'].map(h => E('th', {}, h))));
      acc.slice(0, st.more).forEach(x => { const k = [nodes[x.i].id, nodes[x.j].id].sort().join('|'), l = labelled.get(k); ct.append(E('tr', {}, E('td', { class: 'num' }, K.fmt(x.s, 2)), E('td', {}, names[x.i]), E('td', {}, names[x.j]), E('td', {}, l === undefined ? '' : E('span', { class: 'v ' + (l ? 'TP' : 'FP') }, l ? 'right merge' : 'wrong merge')))); });
      cand.append(ct); if (acc.length > st.more) cand.append(E('button', { onclick: () => { st.more += 20; draw(); } }, 'show 20 more'));
      // step 3
      const C = clusters(names.length, acc.map(x => [x.i, x.j]));
      kpi3.textContent = '';
      [[C.nClusters, 'groups (662 nodes)'], [C.nMulti, 'groups with 2 or more nodes'], [C.nodesInMulti, 'nodes in them'], [C.biggest, 'size of the biggest group']].forEach(([v, l]) => kpi3.append(E('span', {}, E('b', {}, String(v)), ' ' + l)));
      let right = 0, wrong = 0, chain = 0, direct = new Set(acc.map(x => nodes[x.i].id + '|' + nodes[x.j].id));
      const lp = []; D.hand.concat(D.sample).forEach(p => { if (p.na !== p.nb) lp.push(p); });
      const seen = new Set(); lp.forEach(p => { const k = [p.na, p.nb].sort().join('|'); if (seen.has(k)) return; seen.add(k); if (C.find(id2i.get(p.na)) === C.find(id2i.get(p.nb))) { p.same ? right++ : wrong++; if (!direct.has(p.na + '|' + p.nb) && !direct.has(p.nb + '|' + p.na)) chain++; } });
      kpi3.append(E('span', {}, E('b', {}, String(right)), ' labelled pairs joined and right'), E('span', {}, E('b', { class: wrong ? 'bad' : '' }, String(wrong)), ' joined but different (wrong)'), E('span', { class: 'hint' }, chain + ' of the joined labelled pairs got there only through a chain (their own J is below the threshold).'));
      cl.textContent = '';
      cl.append(E('table', {}, E('tr', {}, ['size', 'members (first 8)'].map(h => E('th', {}, h))), ...C.multi.slice(0, 8).map(c => E('tr', {}, E('td', { class: 'num' }, String(c.length)), E('td', {}, c.slice(0, 8).map(i => names[i]).join('; ') + (c.length > 8 ? ' ...' : ''))))));
      drawB3(C);
      cl.append(E('p', { class: 'hint' }, st.t > 1 ? 'Rule off: no group has two nodes, the 662 nodes stay as the pack built them (inside the nodes the pack already merged names by its name-key rule: plural, case, hyphen; and 4 abbreviation pairs).' : 'Lower the threshold and watch the biggest group grow: at a low J one shared word such as "regression" chains many different concepts into one group.'));
    }
    function drawB3(C) {
      const sys = B3.items.map(it => 'c' + C.find(id2i.get(it.node))), gold = B3.items.map(it => it.gold), r = bcubed(sys, gold), llm = bcubed(sys, B3.items.map(it => it.llm_gold));
      const base = B3.pack, rule = st.t > 1 ? 'pack as built (rule off)' : 'pack + Jaccard >= ' + st.t;
      kpi4.textContent = '';
      [[K.fmt(r.P, 3), 'B-cubed precision'], [K.fmt(r.R, 3), 'B-cubed recall'], [K.fmt(r.F1, 3), 'B-cubed F1']].forEach(([v, l]) => kpi4.append(E('span', {}, E('b', {}, v), ' ' + l)));
      kpi4.append(E('span', { class: 'hint' }, rule + ': pairwise P ' + K.fmt(r.pair.P, 3) + ', R ' + K.fmt(r.pair.R, 3) + ', F1 ' + K.fmt(r.pair.F1, 3) + ' (TP ' + r.pair.tp + ', FP ' + r.pair.fp + ', FN ' + r.pair.fn + '). With the LLM labels unedited: B-cubed F1 ' + K.fmt(llm.F1, 3) + '. Pack as built (stored): B-cubed P ' + K.fmt(base.bcubed.P, 3) + ' R ' + K.fmt(base.bcubed.R, 3) + ' F1 ' + K.fmt(base.bcubed.F1, 3) + ', pairwise F1 ' + K.fmt(base.pairwise.F1, 3) + '.'));
      // worked item: pick one
      if (st.b3 == null) st.b3 = Math.max(0, B3.items.findIndex(it => it.form === 'decision trees'));
      pick4.textContent = '';
      const sel4 = E('select', { style: 'max-width:100%;width:100%' }, B3.items.map((it, i) => E('option', { value: i }, it.form + (it.form !== nm.get(it.node).name ? ' (alias of ' + nm.get(it.node).name + ')' : ''))));
      sel4.value = String(st.b3); sel4.addEventListener('change', () => { st.b3 = +sel4.value; drawB3(C); });
      const d = st.b3, per = r.per[d], S_d = B3.items.filter((_, i) => sys[i] === sys[d]), G_d = B3.items.filter((_, i) => gold[i] === gold[d]), inter = S_d.filter(x => x.gold === B3.items[d].gold);
      pick4.append(E('div', { class: 'row' }, E('label', {}, 'worked item d ', sel4)));
      pick4.append(E('div', { class: 'ev' }, E('div', {}, E('b', {}, 'S_d (system cluster, ' + S_d.length + '): '), S_d.map(x => x.form).join('; ')), E('div', {}, E('b', {}, 'G_d (gold cluster, ' + G_d.length + '): '), G_d.map(x => x.form).join('; ')),
        E('div', {}, 'P_d = ' + inter.length + ' / ' + S_d.length + ' = ' + K.fmt(per.p, 3) + '    R_d = ' + inter.length + ' / ' + G_d.length + ' = ' + K.fmt(per.r, 3))));
      // items below 1 (the cost)
      const low = r.per.map((q, i) => ({ q, i })).filter(x => x.q.p < 1 || x.q.r < 1);
      tab4.textContent = '';
      tab4.append(E('p', { class: 'hint' }, low.length + ' of ' + B3.n_items + ' items have P_d or R_d below 1; the other ' + (B3.n_items - low.length) + ' add 1 to both sums.'),
        E('table', {}, E('tr', {}, ['item', 'node', 'P_d', 'R_d'].map(h => E('th', {}, h))), ...low.slice(0, 14).map(x => E('tr', { class: 'pick' + (x.i === d ? ' cur' : ''), onclick: () => { st.b3 = x.i; drawB3(C); } }, E('td', {}, B3.items[x.i].form), E('td', {}, nm.get(B3.items[x.i].node).name), E('td', { class: 'num' }, K.fmt(x.q.p, 3)), E('td', { class: 'num' }, K.fmt(x.q.r, 3))))));
    }
    function drawPlot(B, set) {
      plot.textContent = '';
      const W = 560, H = 140, pad = 28, xs = []; for (let t = 0.05; t <= 1.051; t += 0.05) xs.push(Math.round(t * 100) / 100);
      const pts = xs.map(t => evaluate(set.items, t, B, { stop: [...st.stop], strip: st.strip, pool: set.pool }));
      const X = t => pad + (t - 0.05) / 1.0 * (W - pad - 6), Y = v => H - 20 - v * (H - 34);
      const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:' + W + 'px;display:block' });
      svg.append(K.svg('line', { x1: pad, x2: W - 6, y1: Y(0), y2: Y(0), stroke: '#68707F', 'stroke-width': .5 }), K.svg('line', { x1: pad, x2: pad, y1: Y(0), y2: Y(1), stroke: '#68707F', 'stroke-width': .5 }));
      [['P', '#7C9CFF', 'precision'], ['R', '#3CC7B4', 'recall'], ['F1', '#F2A93B', 'F1']].forEach(([k, c], i) => {
        svg.append(K.svg('polyline', { fill: 'none', stroke: c, 'stroke-width': 2, points: xs.map((t, j) => X(t) + ',' + Y(pts[j][k])).join(' ') }));
        svg.append(K.svg('text', { x: pad + 6 + i * 90, y: 12, fill: c, style: 'fill:' + c }, ['precision', 'recall', 'F1'][i]));
      });
      svg.append(K.svg('line', { x1: X(st.t), x2: X(st.t), y1: Y(0), y2: Y(1), stroke: '#FF8A65', 'stroke-dasharray': '3 3' }));
      [0.05, 0.5, 1.05].forEach(t => svg.append(K.svg('text', { x: X(t) - 8, y: H - 4 }, String(t))));
      svg.append(K.svg('text', { x: 2, y: Y(1) + 4 }, '1'), K.svg('text', { x: 2, y: Y(0) }, '0'));
      plot.append(svg, E('p', { class: 'hint' }, 'x: Jaccard threshold (1.05 = rule off, only the pack merges). The curves use the labelled pairs of the chosen set only.'));
    }
    draw();
  }
})(typeof window !== 'undefined' ? window : globalThis);
