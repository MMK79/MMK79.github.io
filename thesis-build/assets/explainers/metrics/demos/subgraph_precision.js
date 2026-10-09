/* Subgraph precision demo: a retrieved subgraph of triples. Click a triple to flip gold / noise. Change the subgraph size. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    size: 40,                 // |S_q|: triples in the retrieved subgraph
    goldInSubgraph: [13, 26], // indices (0-based) of gold evidence triples inside S_q
    goldTotal: 2,             // |G*|: gold triples that exist for this question
  };

  /* PURE: SP = |G* ∩ S_q| / |S_q|. Returns a number in [0,1]. */
  function compute(inp) {
    const size = Math.max(1, inp.size);
    const hits = new Set(inp.goldInSubgraph.filter(i => i >= 0 && i < size)).size;
    return hits / size;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { size: defaults.size, gold: new Set(defaults.goldInSubgraph), goldTotal: defaults.goldTotal };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each square is one retrieved triple. Click a square to mark it gold evidence or noise. Change the subgraph size and the number of gold triples that exist.');
    const sizeS = K.slider('|S_q| (triples retrieved)', 1, 60, 1, st.size, v => { st.size = v; render(); });
    const totS = K.slider('|G*| (gold triples that exist)', 1, 6, 1, st.goldTotal, v => { st.goldTotal = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.gold = new Set(defaults.goldInSubgraph); sizeS.set(st.size = defaults.size); totS.set(st.goldTotal = defaults.goldTotal); render(); }),
      btn('Break it: tiny subgraph, 1 triple', () => { st.gold = new Set([0]); sizeS.set(st.size = 1); totS.set(st.goldTotal = 2); render(); }),
      btn('Dump everything: 60 triples', () => { sizeS.set(st.size = 60); render(); }));
    const grid = K.el('div', { class: 'row', role: 'group', 'aria-label': 'retrieved triples', style: 'gap:4px' });
    const res = K.resultBox();
    const noise = K.el('div', { class: 'num bad' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, sizeS.node, totS.node), presets, grid, res.node, noise, formula, note);

    function render() {
      grid.replaceChildren();
      for (let i = 0; i < st.size; i++) {
        const g = st.gold.has(i);
        grid.append(K.el('button', {
          type: 'button', 'aria-pressed': g ? 'true' : 'false', title: `triple ${i + 1}: ${g ? 'gold evidence' : 'noise'}`,
          'aria-label': `triple ${i + 1}, ${g ? 'gold' : 'noise'}`,
          style: 'width:30px;height:30px;padding:0;' + (g ? 'background:#3CC7B466;border-color:var(--he)' : 'border-color:var(--warn);background:#FF8A6522'),
          onclick: () => { g ? st.gold.delete(i) : st.gold.add(i); render(); },
        }));
      }
      const inp = { size: st.size, goldInSubgraph: Array.from(st.gold), goldTotal: st.goldTotal };
      const hits = Array.from(st.gold).filter(i => i < st.size).length;
      res.set(compute(inp));
      const sp = hits / st.size;
      noise.textContent = `noise ratio = 1 - SP = ${K.fmt(1 - sp)}`;
      formula.textContent = `SP = |G* ∩ S_q| / |S_q| = ${hits} / ${st.size} = ${K.fmt(sp)}`;
      const rec = Math.min(1, hits / st.goldTotal);
      note.textContent = `Evidence recall for comparison: ${hits} / ${st.goldTotal} = ${K.fmt(rec)}.` +
        (sp === 1 && rec < 1 ? ' Precision is perfect but evidence is missing: precision alone hides that.' : '') +
        (sp < 0.2 && rec === 1 ? ' All evidence is there, but buried in noise (not-gold triples may still give context).' : '');
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples/graph (graph.json, khop.json, pcst.json) + data/questions.json ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('graph/graph.json'), get('graph/khop.json'), get('graph/pcst.json'), get('data/questions.json'), fetch(new URL('data/kg_gold.real.json', SCRIPT_SRC || location.href).href).then(r => { if (!r.ok) throw new Error('kg_gold ' + r.status); return r.json(); })]).then(a => {
      const g = a[0], adj = {}, byName = {};
      g.nodes.forEach(n => { adj[n.id] = []; byName[n.name] = n.id; });
      g.edges.forEach(e => { adj[e.source].push(e.target); adj[e.target].push(e.source); });
      const qs = {}; a[3].forEach(q => { qs[q.id] = q; });
      const seeds = {}; a[1].questions.forEach(q => { if (q.seeds && q.seeds.length) seeds[q.qid] = q.seeds.map(s => s.id); });
      const ids = Object.keys(seeds).filter(id => qs[id].type !== 'unanswerable' && a[2].questions[id]).sort();
      const D = { g, adj, byName, qs, seeds, pcst: a[2].questions, ids, kg: a[4] };
      goldSets(D); return D;
    });
    return realData;
  }
  /* labelled gold (kg_gold.real.json, 2026-10-09): per covered question, edge keys s|t|relation labelled correct (strict) or correct+partly (lenient) in a gold passage */
  const ekey = e => e.source + '|' + e.target + '|' + e.relation;
  function goldSets(D) {
    D.kgSets = { strict: {}, lenient: {} };
    const P = {}; D.kg.passages.forEach(p => { P[p.id] = p; });
    D.kg.covered_questions.forEach(id => {
      [['strict', ['correct']], ['lenient', ['correct', 'partly']]].forEach(([m, pos]) => {
        const set = new Set(); D.qs[id].gold_passages.forEach(p => P[p].triples.forEach(t => { if (pos.includes(t.final)) set.add(t.s + '|' + t.t + '|' + t.relation); })); D.kgSets[m][id] = set;
      });
    });
  }
  /* undirected BFS from the seeds (same rule as khop.json); returns the node-id set within h hops */
  function bfs(D, seeds, h) {
    const S = new Set(seeds); let fr = new Set(seeds);
    for (let i = 0; i < h; i++) { const nx = new Set(); fr.forEach(x => D.adj[x].forEach(y => { if (!S.has(y)) nx.add(y); })); nx.forEach(y => S.add(y)); fr = nx; }
    return S;
  }
  /* induced edges of a node set; an edge is gold-supported if one of its source passages is a gold passage (our proxy: the pack has no gold triples) */
  function score(D, nodes, gold, mode, qid) {
    const gs = new Set(gold), edges = D.g.edges.filter(e => nodes.has(e.source) && nodes.has(e.target));
    const lab = mode && mode !== 'proxy' ? D.kgSets[mode][qid] : null;
    const sup = edges.filter(e => lab ? lab.has(ekey(e)) : e.passages.some(p => gs.has(p)));
    return { edges, sup, total: edges.length, hits: sup.length, sp: edges.length ? sup.length / edges.length : null };
  }
  function pcstNodes(D, qid) { return new Set(D.pcst[qid].nodes.map(n => D.byName[n])); }
  function mean(a) { const v = a.filter(x => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { qid: D.ids.includes('q02') ? 'q02' : D.ids[0], hop: 1, mode: 'strict' };
    const cov = id => !!D.kgSets.strict[id];
    const shell = K.shell(el, 'Real example: subgraph precision, k-hop vs PCST',
      'Scale: 138 passages, 24 questions, a knowledge graph of 662 nodes and 762 edges that an LLM (qwen3.8-flash) extracted. GOLD LABELS (new, 2026-10-09): for the 8 gold passages of 7 questions (q01 q02 q03 q04 q11 q13 q16) all 59 extracted triples were labelled correct / partly / incorrect against the passage text by an LLM labeller (qwen3.7-plus) and re-read by us (15 labels changed). A subgraph edge is gold when it is labelled correct (strict) or correct + partly (lenient) in a gold passage of the question. Subgraph edges = all graph edges whose two end nodes are in the subgraph. Seeds come from noisy entity linking. n = 7 questions, one labeller pair, no human annotator: a demo, not a benchmark. The earlier proxy (any edge extracted from a gold passage, unlabelled, all 20 questions) stays as the third choice; it counts wrong extractions as gold.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.ids.map(id => opt(id, (cov(id) ? '[labelled] ' : '[proxy only] ') + id + ' (' + D.qs[id].type + '): ' + D.qs[id].question.slice(0, 50))));
    qSel.value = st.qid;
    qSel.addEventListener('change', () => { st.qid = qSel.value; render(); });
    const mSel = K.el('select', { 'aria-label': 'gold set', style: 'width:100%;max-width:100%;box-sizing:border-box' },
      opt('strict', 'Gold = labelled correct only (strict)'), opt('lenient', 'Gold = labelled correct + partly (lenient)'), opt('proxy', 'Gold = proxy: any edge from a gold passage (unlabelled)'));
    mSel.value = st.mode; mSel.addEventListener('change', () => { st.mode = mSel.value; render(); });
    const hopS = K.slider('k-hop expansion: hop', 0, 3, 1, st.hop, v => { st.hop = v; render(); });
    const qline = K.el('p', { class: 'hint' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const table = K.el('div', { class: 'formula', style: 'white-space:pre-wrap;overflow-x:auto' });
    const list = K.el('div', { role: 'group', 'aria-label': 'edges of the PCST subgraph' });
    const note = K.el('p', { class: 'hint' });
    const meanBox = K.el('p', { class: 'hint', style: 'white-space:pre-wrap' });
    shell.append(K.el('div', { style: 'max-width:100%' }, K.el('label', { style: 'display:block;max-width:100%' }, 'question ', qSel), K.el('label', { style: 'display:block;max-width:100%' }, 'gold set ', mSel)), hopS.node, qline, res.node, formula, table, K.el('p', { class: 'hint' }, 'Edges of the PCST subgraph (teal = gold-supported, orange = not):'), list, note, meanBox);

    function render() {
      const q = D.qs[st.qid], gold = q.gold_passages, sd = D.seeds[st.qid];
      if (st.mode !== 'proxy' && !cov(st.qid)) {
        qline.textContent = q.question + '  | gold passages: ' + gold.join(', '); res.set(0, 3); formula.textContent = 'This question is not in the labelled set (its gold passages were not labelled). Pick a [labelled] question or the proxy gold set.';
        table.textContent = ''; list.replaceChildren(); note.textContent = ''; meanBox.textContent = means(); return;
      }
      qline.textContent = q.question + '  | gold passages: ' + gold.join(', ') + ' | seeds: ' + sd.length;
      const kh = [0, 1, 2, 3].map(h => score(D, bfs(D, sd, h), gold, st.mode, st.qid));
      const pc = score(D, pcstNodes(D, st.qid), gold, st.mode, st.qid);
      const cur = kh[st.hop];
      res.set(cur.sp === null ? 0 : cur.sp, 3);
      formula.textContent = cur.total
        ? `SP (hop ${st.hop}) = gold-supported edges / subgraph edges = ${cur.hits} / ${cur.total} = ${K.fmt(cur.sp, 3)}   noise = ${K.fmt(1 - cur.sp, 3)}`
        : `hop ${st.hop}: the subgraph has no edge (only seed nodes), SP is undefined (shown as 0)`;
      const f = x => x.sp === null ? 'n/a' : K.fmt(x.sp, 3);
      table.textContent = 'method        edges  gold-supp.  SP\n' +
        kh.map((x, h) => ('k-hop ' + h).padEnd(13) + String(x.total).padStart(5) + String(x.hits).padStart(11) + '  ' + f(x) + (h === st.hop ? '  <' : '')).join('\n') +
        '\n' + 'PCST'.padEnd(13) + String(pc.total).padStart(5) + String(pc.hits).padStart(11) + '  ' + f(pc);
      list.replaceChildren();
      pc.edges.slice(0, 30).forEach(e => {
        const ok = pc.sup.includes(e), nm = id => D.g.nodes.find(n => n.id === id).name;
        list.append(K.el('div', { style: 'margin:2px 0;padding:1px 6px;border-left:4px solid var(--' + (ok ? 'he' : 'warn') + ')' },
          K.el('span', { class: 'hint' }, `${nm(e.source)} -${e.relation}-> ${nm(e.target)}  [${e.passages.join(', ')}]`)));
      });
      note.textContent = `Teaching point: from hop 0 to hop 3 the subgraph grows from ${kh[0].total} to ${kh[3].total} edges while SP falls to ${f(kh[3])}. PCST keeps ${pc.total} edges at SP ${f(pc)}. Each edge shows the passage ids it was extracted from. Edges not marked gold may still be useful context (non-gold passages can support a bridge), so SP alone is a lower bound on usefulness.`;
    }
    // macro mean; labelled modes use the 7 labelled questions, proxy mode the 20 answerable ones with seeds; undefined SP (no edge) is skipped
    function means() {
      const lab = st.mode !== 'proxy', ids = lab ? D.ids.filter(cov) : D.ids;
      const run = mode => ({ rows: [0, 1, 2, 3].map(h => ids.map(id => score(D, bfs(D, D.seeds[id], h), D.qs[id].gold_passages, mode, id))), prow: ids.map(id => score(D, pcstNodes(D, id), D.qs[id].gold_passages, mode, id)) });
      const mm = a => K.fmt(mean(a.map(x => x.sp)), 3), me = a => K.fmt(a.reduce((s, x) => s + x.total, 0) / a.length, 1);
      const r = run(st.mode);
      let t = `Mean over ${ids.length} ${lab ? 'LABELLED' : 'answerable'} questions with seeds (macro average, ${st.mode} gold, undefined SP skipped):\n` +
        r.rows.map((x, h) => `k-hop ${h}: SP ${mm(x)}, mean ${me(x)} edges` + (x.some(y => y.sp === null) ? ` (${x.filter(y => y.sp === null).length} questions have no edge)` : '')).join('\n') + `\nPCST: SP ${mm(r.prow)}, mean ${me(r.prow)} edges`;
      if (lab) { const p = run('proxy'); t += '\nSame questions with the unlabelled proxy gold: ' + p.rows.map((x, h) => `k-hop ${h} ${mm(x)}`).join(', ') + `, PCST ${mm(p.prow)}`; }
      return t;
    }
    const render0 = render; render = () => { render0(); meanBox.textContent = means(); };
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
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

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['subgraph_precision'] = api;
})(this);
