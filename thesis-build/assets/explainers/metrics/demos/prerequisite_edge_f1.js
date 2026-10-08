/* Prerequisite-edge precision / recall demo. Real example: the 28 `requires` edges of the pack's LLM-extracted graph, audited by hand against the passage text. Toy: a four-node chain (break it). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    gold: [['A', 'B'], ['B', 'C'], ['C', 'D']],
    pred: [['A', 'B'], ['C', 'B'], ['C', 'D'], ['A', 'D']],
    closure: false, directed: true
  };

  /* PURE. Edges are [from, to] pairs. P = |pred ∩ gold| / |pred|, R = |pred ∩ gold| / |gold|.
     P_closure counts a predicted edge as right when it lies in the transitive closure of gold (a shortcut is not an error).
     directed=false compares edges as unordered pairs. */
  function closureOf(edges) {
    const nodes = [...new Set(edges.flat())], reach = new Set(edges.map(e => e.join('>')));
    for (const k of nodes) for (const i of nodes) for (const j of nodes)
      if (reach.has(i + '>' + k) && reach.has(k + '>' + j)) reach.add(i + '>' + j);
    return reach;
  }
  function compute(inp) {
    const directed = inp.directed !== false;
    const key = e => directed ? e[0] + '>' + e[1] : [e[0], e[1]].sort().join('~');
    const gold = new Set(inp.gold.map(key)), pred = [...new Set(inp.pred.map(key))];
    const hit = pred.filter(k => gold.has(k)).length;
    const cl = directed ? closureOf(inp.gold) : null;
    const clSet = cl ? cl : new Set([...closureOf(inp.gold)].map(k => key(k.split('>'))));
    const hitC = pred.filter(k => clSet.has(k)).length;
    return { P: pred.length ? hit / pred.length : NaN, R: gold.size ? hit / gold.size : NaN, P_closure: pred.length ? hitC / pred.length : NaN };
  }

  /* ---------- toy ---------- */
  const NODES = ['A', 'B', 'C', 'D'];
  const PAIRS = []; NODES.forEach(a => NODES.forEach(b => { if (a !== b) PAIRS.push([a, b]); }));
  const pk = e => e[0] + '>' + e[1];

  function drawChain(svgHost, st) {
    const K = root.DemoKit, W = 560, H = 190, x = { A: 60, B: 200, C: 360, D: 500 }, y = 100;
    const gold = new Set(st.gold.map(pk)), cl = closureOf(st.gold);
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:600px', role: 'img', 'aria-label': 'gold and predicted prerequisite edges between four concepts' });
    svg.append(K.svg('defs', {}, ...[['g', '#3CC7B4'], ['r', '#FF8A65'], ['a', '#F2A93B'], ['k', '#68707F']].map(([id, c]) =>
      K.svg('marker', { id: 'ah' + id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, K.svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: c })))));
    const arc = (a, b, off, col, id, dash) => {
      const x1 = x[a] + (x[b] > x[a] ? 16 : -16), x2 = x[b] + (x[b] > x[a] ? -16 : 16), mx = (x1 + x2) / 2, span = Math.abs(x2 - x1);
      return K.svg('path', { d: `M${x1},${y} Q${mx},${y + off * (0.35 + span / 600)} ${x2},${y}`, fill: 'none', stroke: col, 'stroke-width': 2.5, 'stroke-dasharray': dash || '', 'marker-end': `url(#ah${id})` });
    };
    st.gold.forEach(e => svg.append(arc(e[0], e[1], -70, '#68707F', 'k', '5 4')));
    st.pred.forEach(e => {
      const k = pk(e), ok = gold.has(k), sc = cl.has(k), rev = gold.has(e[1] + '>' + e[0]);
      svg.append(arc(e[0], e[1], 70, ok ? '#3CC7B4' : (sc ? '#F2A93B' : '#FF8A65'), ok ? 'g' : (sc ? 'a' : 'r')));
    });
    NODES.forEach(n => svg.append(K.svg('circle', { cx: x[n], cy: y, r: 16, fill: '#171C28', stroke: '#E9ECF2', 'stroke-width': 1.5 }), K.svg('text', { x: x[n], y: y + 4, 'text-anchor': 'middle' }, n)));
    svg.append(K.svg('text', { x: 10, y: 16, style: 'fill:#98A0B0' }, 'above, dashed grey: gold chain'), K.svg('text', { x: 10, y: 34, style: 'fill:#98A0B0' }, 'below: predicted. green right, amber shortcut, orange wrong or reversed'));
    svgHost.replaceChildren(svg);
  }

  function mountToy(el) {
    const K = root.DemoKit, st = { gold: defaults.gold.map(e => e.slice()), pred: defaults.pred.map(e => e.slice()), closure: false, directed: true };
    const shell = K.shell(el, 'Toy example (break it)',
      'Tick which ordered pairs are in the gold chain and which the system predicted. Direction matters: B to A is not A to B. Precision asks how many predicted edges are right, recall how many gold edges were found. This chain is invented for illustration.');
    const host = K.el('div'), res = K.el('div', { class: 'row' }), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const boxes = { gold: {}, pred: {} };
    const grid = which => {
      const wrap = K.el('div', { class: 'row', role: 'group', 'aria-label': which + ' edges' }, K.el('b', {}, which === 'gold' ? 'Gold edges:' : 'Predicted edges:'));
      PAIRS.forEach(p => {
        const cb = K.el('input', { type: 'checkbox' }); cb.checked = st[which].some(e => pk(e) === pk(p));
        cb.setAttribute('aria-label', which + ' ' + p[0] + ' to ' + p[1]);
        cb.addEventListener('change', () => { st[which] = st[which].filter(e => pk(e) !== pk(p)); if (cb.checked) st[which].push(p); render(); });
        boxes[which][pk(p)] = cb; wrap.append(K.el('label', {}, cb, ' ' + p[0] + '→' + p[1]));
      });
      return wrap;
    };
    const cl = K.el('input', { type: 'checkbox' }), dr = K.el('input', { type: 'checkbox' }); dr.checked = true;
    cl.addEventListener('change', () => { st.closure = cl.checked; render(); }); dr.addEventListener('change', () => { st.directed = dr.checked; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const setAll = (g, p) => { st.gold = g.map(e => e.slice()); st.pred = p.map(e => e.slice()); for (const w of ['gold', 'pred']) for (const k in boxes[w]) boxes[w][k].checked = st[w].some(e => pk(e) === k); render(); };
    const chain = defaults.gold;
    shell.append(host, grid('gold'), grid('pred'),
      K.el('div', { class: 'row' }, K.el('label', {}, dr, ' direction counts'), K.el('label', {}, cl, ' judge against the transitive closure (shortcuts are fine)')),
      K.el('div', { class: 'row' }, btn('Worked example', () => setAll(defaults.gold, defaults.pred)),
        btn('Break it: whole chain reversed', () => setAll(chain, chain.map(e => [e[1], e[0]]))),
        btn('Break it: only shortcuts', () => setAll(chain, [['A', 'C'], ['A', 'D'], ['B', 'D']])),
        btn('Perfect', () => setAll(chain, chain))),
      res, formula, note);
    function render() {
      drawChain(host, st);
      const inp = { gold: st.gold, pred: st.pred, directed: st.directed }, r = compute(inp);
      const shown = st.closure ? r.P_closure : r.P;
      const fm = x => Number.isFinite(x) ? K.fmt(x, 3) : 'undefined';
      res.replaceChildren(K.el('div', {}, K.el('span', { class: 'hint' }, 'precision ' + (st.closure ? '(closure) ' : '')), K.el('div', { class: 'result num' }, fm(shown))), K.el('div', {}, K.el('span', { class: 'hint' }, 'recall'), K.el('div', { class: 'result num' }, fm(r.R))));
      const gset = new Set(st.gold.map(e => st.directed ? pk(e) : e.slice().sort().join('~')));
      const hit = [...new Set(st.pred.map(e => st.directed ? pk(e) : e.slice().sort().join('~')))].filter(k => gset.has(k)).length;
      formula.textContent = `|pred| = ${new Set(st.pred.map(pk)).size}, |gold| = ${st.gold.length}, correct = ${hit}\nP = ${hit} / ${new Set(st.pred.map(pk)).size} = ${fm(r.P)}   R = ${hit} / ${st.gold.length} = ${fm(r.R)}   P with closure = ${fm(r.P_closure)}`;
      note.className = 'hint';
      if (st.directed && st.pred.length && r.P === 0 && compute({ gold: st.gold, pred: st.pred, directed: false }).P > 0) { note.textContent = 'Every edge is right as an undirected link but wrong in direction: precision 0. Untick "direction counts" to see how much the direction hides.'; note.className = 'hint bad'; }
      else if (r.P === 0 && r.P_closure > 0) { note.textContent = 'All predicted edges are shortcuts through the chain. A strict count gives 0, the closure count gives ' + fm(r.P_closure) + ': say which rule you use.'; note.className = 'hint bad'; }
      else note.textContent = 'Annotators disagree on prerequisites a lot, so gold lists are themselves noisy. State the direction rule and the closure rule with every score.';
    }
    render();
  }

  /* ---------- real ---------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/prerequisite_edge_f1.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('prerequisite_edge_f1.real.json ' + r.status); return r.json(); });
    return realData;
  }
  const LAB = { correct: ['correct', 'var(--he)'], reversed: ['reversed', 'var(--ai)'], borderline: ['borderline', 'var(--k12)'], unsupported: ['unsupported', 'var(--warn)'] };

  function mountReal(el, D) {
    const K = root.DemoKit, st = { rev: false, bord: false, directed: true, open: null, showAll: false };
    const shell = K.shell(el, 'Real example: the 28 "requires" edges of the pack graph',
      'The pack graph (662 nodes, 762 typed edges, extracted by qwen3.8-flash from 138 Wikipedia passages) has no relation named "prerequisite". The closest is "requires" (28 edges, "X requires Y"; the prerequisite edge is Y to X). We read all 28 against the passage text and labelled each ourselves. Our hand labels, a demo, not a benchmark: one labeller, no inter-annotator check. Real example, n = 28 edges.');
    const pa = K.el('div'), rb = K.el('div'), list = K.el('div'), note = K.el('p', { class: 'hint' });
    const cb = (txt, key, tip) => { const i = K.el('input', { type: 'checkbox' }); i.checked = st[key]; i.addEventListener('change', () => { st[key] = i.checked; render(); }); return K.el('label', { title: tip || '' }, i, ' ' + txt); };
    shell.append(K.el('h4', {}, 'Precision: how many predicted prerequisite edges are right?'),
      K.el('div', { class: 'row' }, cb('count reversed edges as right (ignore direction)', 'rev'), cb('count borderline edges as right', 'bord')), pa,
      K.el('h4', {}, 'Recall: how many of a small gold list were found?'),
      K.el('div', { class: 'row' }, cb('direction counts', 'directed')), rb, K.el('h4', {}, 'The 28 edges (click one for the passage sentence)'), list, note);

    function render() {
      const a = D.audit, c = D.counts;
      const right = c.correct + (st.rev ? c.reversed : 0) + (st.bord ? c.borderline : 0);
      pa.replaceChildren(K.el('div', { class: 'result num' }, K.fmt(right / a.length, 3)),
        K.el('div', { class: 'formula' }, `correct ${c.correct}` + (st.rev ? ` + reversed ${c.reversed}` : '') + (st.bord ? ` + borderline ${c.borderline}` : '') + ` = ${right} of ${a.length}   P = ${right} / ${a.length} = ${K.fmt(right / a.length, 3)}\n(not counted: ${a.length - right}: ${c.unsupported} unsupported, ${(st.rev ? 0 : c.reversed)} reversed, ${(st.bord ? 0 : c.borderline)} borderline)`));
      // recall through the PURE compute(): gold list vs predicted requires edges (prerequisite -> dependent)
      const gold = D.gold.map(g => [g.prereq, g.dependent]), pred = a.map(x => [x.prereq, x.dependent]);
      const r = compute({ gold, pred, directed: st.directed });
      const found = D.gold.filter(g => st.directed ? g.in_requires_directed : (g.in_requires_directed || g.in_requires_reversed));
      rb.replaceChildren(K.el('div', { class: 'result num' }, K.fmt(r.R, 3)),
        K.el('div', { class: 'formula' }, `gold pairs found = ${found.length} of ${D.gold.length}   R = ${found.length} / ${D.gold.length} = ${K.fmt(r.R, 3)}`),
        K.el('div', {}, ...D.gold.map(g => { const f = g.in_requires_directed, rv = g.in_requires_reversed;
          return K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid ' + (f ? 'var(--he)' : rv && !st.directed ? 'var(--he)' : 'var(--warn)') },
            K.el('b', {}, g.prereq + ' → ' + g.dependent + ' '), K.el('span', { class: 'hint' }, g.passage + ': ' + (f ? 'found' : rv ? 'found but REVERSED' + (st.directed ? ' (a miss when direction counts)' : '') : (g.dependent_in_graph ? 'missing as "requires"' + (g.other_relation.length ? ' (graph has it as "' + g.other_relation.join('", "') + '")' : '') : 'node missing from the graph')))); })));
      list.replaceChildren(...a.map(x => {
        const [name, col] = LAB[x.label], open = st.open === x.n;
        const row = K.el('div', { style: 'margin:3px 0;padding:3px 8px;border-left:4px solid ' + col });
        row.append(K.el('button', { type: 'button', 'aria-expanded': open ? 'true' : 'false', style: 'text-align:left;width:100%', onclick: () => { st.open = open ? null : x.n; render(); } },
          K.el('b', {}, '#' + x.n + ' '), x.prereq + ' → ' + x.dependent, K.el('span', { style: 'color:' + col + ';float:right' }, name)));
        if (open) row.append(K.el('p', { class: 'hint' }, K.el('b', {}, x.passages.join(', ') + ': '), '“' + x.evidence + '”'), K.el('p', { class: 'hint' }, 'Our label: ' + x.why));
        return row;
      }));
      note.className = 'hint bad';
      note.textContent = 'Read with care. Labels are ours (one labeller, an LLM) and the 11-pair gold list was written from cue words in the passages (requires, assumes, essential ...) but after we had seen the 28 edges, so recall is optimistic and not exhaustive; precision against that list alone would be ' + K.fmt(D.summary.precision_vs_gold_floor, 2) + ', a floor. "requires" is dependency inside the text, not a curriculum prerequisite. Expert prerequisite sets (LectureBank, MOOCCubeX) are not in the pack.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['prerequisite_edge_f1'] = api;
})(this);
