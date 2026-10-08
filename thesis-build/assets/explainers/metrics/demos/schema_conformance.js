/* Schema conformance demo. Real example (default): the 762 LLM-extracted edges of the graph pack, checked against a schema WE derive from the pack's own types. Toy example: 50 triples, 40 conform. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';

  /* ---------- PURE core: Conf = |{(h,r,t): r in R, type(h) in dom(r), type(t) in rng(r)}| / |T| ---------- */
  function conforms(tr, schema) {
    const s = schema[tr.r];
    return !!s && s.dom.includes(tr.ht) && s.rng.includes(tr.tt);
  }
  function compute(inp) {
    const T = inp.triples;
    if (!T.length) return NaN;
    return T.filter(t => conforms(t, inp.schema)).length / T.length;
  }

  /* ---------- toy: 50 triples, a 3-relation schema, 10 deliberate violations ---------- */
  const toySchema = {
    introduced_by: { dom: ['Method'], rng: ['Person'] },
    uses: { dom: ['Method'], rng: ['Method', 'Concept'] },
    is_a: { dom: ['Method', 'Concept'], rng: ['Concept'] },
  };
  function toyTriples() {
    const good = [['introduced_by', 'Method', 'Person'], ['uses', 'Method', 'Method'], ['uses', 'Method', 'Concept'], ['is_a', 'Method', 'Concept'], ['is_a', 'Concept', 'Concept']];
    const bad = [['likes', 'Method', 'Person'], ['likes', 'Method', 'Concept'], ['likes', 'Concept', 'Concept'],
      ['introduced_by', 'Method', 'Concept'], ['introduced_by', 'Method', 'Method'], ['introduced_by', 'Method', 'Concept'],
      ['uses', 'Person', 'Method'], ['uses', 'Person', 'Concept'], ['is_a', 'Method', 'Person'], ['is_a', 'Concept', 'Person']];
    const out = [];
    for (let i = 0; i < 40; i++) { const g = good[i % 5]; out.push({ id: i, r: g[0], ht: g[1], tt: g[2] }); }
    bad.forEach((b, j) => out.push({ id: 40 + j, r: b[0], ht: b[1], tt: b[2] }));
    return out;
  }
  const defaults = { triples: toyTriples(), schema: toySchema };   // compute(defaults) = 40/50 = 0.8

  /* ---------- real: schema derived from the pack ---------- */
  const RELATIONS = ['is_a', 'part_of', 'uses', 'introduced_by', 'extends', 'special_case_of', 'alternative_to', 'compared_with', 'improves', 'causes', 'requires', 'applied_to', 'related_to']; // the 13 allowed by the extraction prompt
  const HAND = {
    intro: { label: 'introduced_by must point to a Person or Organization (head must not be a Person)', test: (e, ht, tt) => e.relation === 'introduced_by' && !(['Person', 'Organization'].includes(tt) && ht !== 'Person') },
    taxo: { label: 'is_a / special_case_of / extends / part_of must not have a Person at either end', test: (e, ht, tt) => ['is_a', 'special_case_of', 'extends', 'part_of'].includes(e.relation) && (ht === 'Person' || tt === 'Person') },
    vague: { label: 'related_to is banned (the extractor\'s vague escape hatch)', test: e => e.relation === 'related_to' },
  };
  /* PURE: classify every real edge. cfg = {m: min support of a (relation, head type, tail type) pair, rules: {intro, taxo, vague}}.
     Pair support is counted on this same graph (circular on purpose: m=1 allows everything that exists). */
  function realCheck(g, cfg) {
    const T = {}; g.nodes.forEach(n => { T[n.id] = n; });
    const key = (r, a, b) => r + '|' + a + '|' + b, sup = {};
    g.edges.forEach(e => { const k = key(e.relation, T[e.source].type, T[e.target].type); sup[k] = (sup[k] || 0) + 1; });
    const rows = g.edges.map(e => {
      const ht = T[e.source].type, tt = T[e.target].type, why = [];
      if (!RELATIONS.includes(e.relation)) why.push('relation not in R');
      const s = sup[key(e.relation, ht, tt)];
      if (s < cfg.m) why.push(`type pair ${ht} -> ${tt} seen only ${s}x for ${e.relation} (< ${cfg.m})`);
      Object.keys(HAND).forEach(k => { if (cfg.rules[k] && HAND[k].test(e, ht, tt)) why.push(HAND[k].label); });
      return { e, head: T[e.source], tail: T[e.target], why, ok: why.length === 0 };
    });
    const ok = rows.filter(r => r.ok).length;
    return { rows, ok, total: rows.length, rate: rows.length ? ok / rows.length : NaN };
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = fetch(base + 'graph/graph.json').then(r => { if (!r.ok) throw new Error('graph.json ' + r.status); return r.json(); });
    return realData;
  }

  /* ---------- UI ---------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const shell = K.shell(el, 'Toy example (break it)', 'Fifty triples (head type, relation, tail type) are checked against a 3-relation schema. Click a row to flip it between a conforming and a violating pattern, or tighten the schema by removing an allowed type.');
    const schema = JSON.parse(JSON.stringify(toySchema)), triples = toyTriples();
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const schemaBox = K.el('div', { class: 'row', role: 'group', 'aria-label': 'schema' });
    const list = K.el('div', { role: 'group', 'aria-label': 'triples' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Worked example', () => { for (const r in toySchema) schema[r] = JSON.parse(JSON.stringify(toySchema[r])); render(); }),
      btn('Break it: a tight schema (uses: Method to Method only)', () => { schema.uses = { dom: ['Method'], rng: ['Method'] }; render(); }),
      btn('Break it: schema allows every type', () => { Object.keys(schema).forEach(r => { schema[r].dom = ['Method', 'Concept', 'Person']; schema[r].rng = ['Method', 'Concept', 'Person']; }); render(); }));
    shell.append(presets, schemaBox, res.node, formula, list, K.el('p', { class: 'hint' }, 'Teaching point: loosen the schema and the rate goes up without one triple becoming more true. Conformance measures form, not truth. (The relation "likes" is not in R at all, so those three always violate.)'));
    function render() {
      schemaBox.replaceChildren(...Object.keys(schema).map(r => K.el('span', { class: 'hint', style: 'border:1px solid var(--line,#444);padding:2px 6px;border-radius:6px' }, `${r}: ${schema[r].dom.join('|')} -> ${schema[r].rng.join('|')}`)));
      const c = compute({ triples, schema });
      res.set(c);
      const ok = triples.filter(t => conforms(t, schema)).length;
      formula.textContent = `Conf = conforming / all = ${ok} / ${triples.length} = ${K.fmt(c)}`;
      list.replaceChildren(...triples.map(t => { const g = conforms(t, schema); return K.el('div', { style: 'margin:1px 0;padding:1px 6px;border-left:4px solid var(--' + (g ? 'he' : 'warn') + ')' }, K.el('span', { class: 'hint' }, `${t.ht} -${t.r}-> ${t.tt}   ${g ? 'ok' : 'VIOLATES'}`)); }));
    }
    render();
  }

  function mountReal(el, g) {
    const K = root.DemoKit;
    const cfg = { m: 3, rules: { intro: false, taxo: false, vague: false } };
    const shell = K.shell(el, 'Real example: is the LLM-extracted graph well-formed?',
      'Data: the graph pack (138 Wikipedia passages on regression and machine learning, 662 nodes, 762 typed edges extracted by qwen3.8-flash). Our definitions, not a standard. The schema is OURS and derived from the pack itself: R = the 13 relations and the 9 node types the extraction prompt allowed; an edge conforms if its relation is in R and its (head type, relation, tail type) pattern is allowed. "Allowed" is defined here as "this pattern occurs at least m times in the same graph" (circular on purpose: at m = 1 everything conforms), plus three optional hand-written rules. The extraction is noisy and there is no gold graph: a violation can be a bad edge OR a schema that is too strict, and a conforming edge can still be false.');
    const mS = K.slider('minimum support m of a type pattern', 1, 10, 1, cfg.m, v => { cfg.m = v; render(); });
    const rulesBox = K.el('div', { role: 'group', 'aria-label': 'hand-written rules' });
    Object.keys(HAND).forEach(k => {
      const cb = K.el('input', { type: 'checkbox' }); cb.checked = cfg.rules[k];
      cb.addEventListener('change', () => { cfg.rules[k] = cb.checked; render(); });
      rulesBox.append(K.el('label', { style: 'display:block' }, cb, ' ' + HAND[k].label));
    });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const setAll = (m, r) => () => { cfg.m = m; Object.assign(cfg.rules, r); mS.set(m); rulesBox.querySelectorAll('input').forEach((cb, i) => { cb.checked = cfg.rules[Object.keys(HAND)[i]]; }); render(); };
    const presets = K.el('div', { class: 'row' }, btn('Prompt schema only (m = 1)', setAll(1, { intro: false, taxo: false, vague: false })), btn('Default, as in the video (m = 3)', setAll(3, { intro: false, taxo: false, vague: false })), btn('m = 3 + introduced_by rule', setAll(3, { intro: true, taxo: false, vague: false })), btn('Strict (m = 6, all rules)', setAll(6, { intro: true, taxo: true, vague: true })));
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const sweep = K.el('div', { class: 'formula', style: 'white-space:pre-wrap;overflow-x:auto' });
    const byRel = K.el('div', { class: 'hint', style: 'white-space:pre-wrap' });
    const list = K.el('div', { role: 'group', 'aria-label': 'violating edges' }), note = K.el('p', { class: 'hint' });
    shell.append(presets, mS.node, rulesBox, res.node, formula, K.el('p', { class: 'hint' }, 'Effect of tightening (same rules, m from 1 to 10):'), sweep, byRel, K.el('p', { class: 'hint' }, 'Violating edges (first 40; each shows the passage ids it was extracted from):'), list, note);

    function render() {
      const r = realCheck(g, cfg), viol = r.rows.filter(x => !x.ok);
      res.set(r.rate);
      formula.textContent = `Conf = conforming / all = ${r.ok} / ${r.total} = ${K.fmt(r.rate)}   (violators: ${viol.length})`;
      sweep.textContent = 'm    conforming  Conf\n' + [1, 2, 3, 4, 5, 6, 8, 10].map(m => { const q = realCheck(g, { m, rules: cfg.rules }); return String(m).padEnd(5) + String(q.ok).padStart(7) + '  ' + K.fmt(q.rate) + (m === cfg.m ? '  <' : ''); }).join('\n');
      const cnt = {}; viol.forEach(v => { cnt[v.e.relation] = (cnt[v.e.relation] || 0) + 1; });
      byRel.textContent = 'Violators per relation: ' + (Object.keys(cnt).length ? Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') : 'none');
      list.replaceChildren(...viol.slice(0, 40).map(v => K.el('div', { style: 'margin:2px 0;padding:1px 6px;border-left:4px solid var(--warn)' },
        K.el('span', { class: 'hint' }, `${v.head.name} (${v.head.type}) -${v.e.relation}-> ${v.tail.name} (${v.tail.type})  [${v.e.passages.join(', ')}]  because: ${v.why.join('; ')}`))));
      note.textContent = 'Reading it: tightening lowers the rate by construction, so a low number is not "bad extraction" until a human checks the violators. Look at introduced_by: Person -> concept edges are real direction errors by the extractor, the kind of mistake this check exists to catch. The rate says nothing about whether conforming edges are true.';
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
      loadReal().then(g => { body.replaceChildren(); mountReal(body, g); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, realCheck, RELATIONS };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['schema_conformance'] = api;
})(this);
