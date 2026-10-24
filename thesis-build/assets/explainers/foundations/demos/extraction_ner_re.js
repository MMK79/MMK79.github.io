/* extraction_ner_re: NER + relation extraction on a REAL passage with the stored REAL LLM output (qwen3.8-flash, 138 cached calls in the pack).
   Highlights entities in the passage, lists the triples, flags what the model did OUTSIDE the prompt's lists (10 entity types, 39 relation labels,
   24 endpoints missing from the entity list) and shows real wrong / missed triples (OUR labels, one labeller).
   Serves j1-ner, j1-relation-extraction-overview, j1-llm-prompt-extraction, j1-schema-guided-vs-open, j1-open-information-extraction.
   Open view: a REAL open (no type or relation list) run of the same model on 8 of those passages, compared by code with the stored schema-guided answer (data/extraction_open.real.json).
   compute() is pure. Pack files are fetched relative to this script. No LLM call in the page. 2-D only (text + tables). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const DATA = SRC ? new URL('data/extraction_ner_re.real.json', SRC).href : '';
  const OPEN = SRC ? new URL('data/extraction_open.real.json', SRC).href : '';

  const ENTITY_TYPES = ['Method', 'Concept', 'Property', 'Metric', 'Person', 'Organization', 'Dataset', 'Software', 'Other'];
  const RELATION_LABELS = ['is_a', 'part_of', 'uses', 'introduced_by', 'extends', 'special_case_of', 'alternative_to', 'compared_with', 'improves', 'causes', 'requires', 'applied_to', 'related_to'];

  /* Real passage p001 and the model's real answer for it (copied from raw/graph/extract_p001_*.json; the node check compares it with the pack). */
  const P001 = 'Ridge regression (also known as Tikhonov regularization, named for Andrey Tikhonov) is a method of estimating the coefficients of multiple-regression models in scenarios where the variables are highly correlated. It has been used in many fields including econometrics, chemistry, and engineering. It is a widely used method of regularization of ill-posed problem inverse problems. It is particularly useful to mitigate the problem of multicollinearity in linear regression, which commonly occurs in models with large numbers of parameters.';
  const defaults = {
    text: P001,
    entities: [{ n: 'ridge regression', t: 'Method' }, { n: 'Tikhonov regularization', t: 'Method' }, { n: 'Andrey Tikhonov', t: 'Person' }, { n: 'multiple-regression models', t: 'Concept' },
      { n: 'regularization', t: 'Concept' }, { n: 'inverse problems', t: 'Concept' }, { n: 'multicollinearity', t: 'Property' }, { n: 'linear regression', t: 'Method' }],
    relations: [{ s: 'ridge regression', r: 'alternative_to', t: 'Tikhonov regularization' }, { s: 'Tikhonov regularization', r: 'introduced_by', t: 'Andrey Tikhonov' },
      { s: 'ridge regression', r: 'applied_to', t: 'multiple-regression models' }, { s: 'ridge regression', r: 'is_a', t: 'regularization' }, { s: 'regularization', r: 'applied_to', t: 'inverse problems' },
      { s: 'ridge regression', r: 'improves', t: 'multicollinearity' }, { s: 'multicollinearity', r: 'part_of', t: 'linear regression' }]
  };

  const isW = c => /[a-z0-9]/i.test(c || '');
  /* PURE. Find every whole-word, case-insensitive occurrence of each entity name; longer names first; no overlaps. */
  function annotate(text, entities) {
    const low = text.toLowerCase(), taken = new Array(text.length).fill(false), spans = [], notFound = [];
    const order = entities.map((e, i) => ({ e, i })).sort((a, b) => b.e.n.length - a.e.n.length || a.i - b.i);
    for (const { e, i } of order) {
      const nm = e.n.toLowerCase(); let from = 0, found = 0;
      for (;;) {
        const k = low.indexOf(nm, from); if (k < 0) break; from = k + 1;
        if (isW(text[k - 1]) || isW(text[k + nm.length])) continue;
        let free = true; for (let x = k; x < k + nm.length; x++) if (taken[x]) { free = false; break; }
        if (!free) continue;
        for (let x = k; x < k + nm.length; x++) taken[x] = true; found++;
        spans.push({ start: k, end: k + nm.length, name: e.n, type: e.t, ent: i });
      }
      if (!found) notFound.push(e.n);
    }
    spans.sort((a, b) => a.start - b.start);
    return { spans, notFound };
  }
  /* PURE. Everything the page needs for one passage. */
  function compute(inp) {
    const ET = inp.entityTypes || ENTITY_TYPES, RL = inp.relationLabels || RELATION_LABELS;
    const { spans, notFound } = annotate(inp.text, inp.entities);
    const names = new Set(inp.entities.map(e => e.n));
    const typeCounts = {}, relCounts = {};
    inp.entities.forEach(e => { typeCounts[e.t] = (typeCounts[e.t] || 0) + 1; });
    inp.relations.forEach(r => { relCounts[r.r] = (relCounts[r.r] || 0) + 1; });
    return {
      n_entities: inp.entities.length, n_relations: inp.relations.length, typeCounts, relCounts,
      off_types: inp.entities.filter(e => !ET.includes(e.t)).length,
      off_relations: inp.relations.filter(r => !RL.includes(r.r)).length,
      dangling: inp.relations.filter(r => !names.has(r.s) || !names.has(r.t)).length,
      n_spans: spans.length, entities_found_in_text: inp.entities.length - notFound.length, not_found: notFound, spans
    };
  }
  /* PURE. cost = (T_in * p_in + T_out * p_out) / 1e6 */
  const cost = (tin, tout, pin, pout) => (tin * pin + tout * pout) / 1e6;
  /* PURE. Totals over every passage record (the page header). */
  function totals(passages, ET, RL) {
    const t = { entities: 0, relations: 0, off_types: 0, off_relations: 0, dangling: 0, asked_related_to: 0, offLabels: {}, offTypes: {} };
    for (const pid of Object.keys(passages)) {
      const p = passages[pid], names = new Set(p.e.map(e => e.n));
      p.e.forEach(e => { t.entities++; if (!ET.includes(e.t)) { t.off_types++; t.offTypes[e.t] = (t.offTypes[e.t] || 0) + 1; } });
      p.r.forEach(r => {
        t.relations++; if (r.r === 'related_to') t.asked_related_to++;
        if (!RL.includes(r.r)) { t.off_relations++; (t.offLabels[r.r] ||= []).push({ pid, s: r.s, t: r.t }); }
        if (!names.has(r.s) || !names.has(r.t)) t.dangling++;
      });
    }
    return t;
  }
  /* PURE. Normalised form of an entity string: lower case, hyphen -> space, other punctuation removed, spaces collapsed, plural s removed per word (words of 4+ letters, not ss/is/us). */
  const norm = s => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const sing = s => norm(s).split(' ').filter(Boolean).map(w => (w.length > 3 && w.endsWith('s') && !/(ss|is|us)$/.test(w)) ? w.slice(0, -1) : w).join(' ');
  /* PURE. Compare the open answer with the schema-guided answer of the same passage (both {entities:[{name,type}], relations:[{source,relation,target}]}).
     Entities are the same when their normalised strings are equal. A triple pair is "the same pair" when the two normalised endpoints (either order) occur in a closed triple. */
  function compareOpen(open, closed, RL) {
    RL = RL || RELATION_LABELS;
    const on = new Set(open.entities.map(e => sing(e.name))), cn = new Set(closed.entities.map(e => sing(e.name)));
    const shared = [...on].filter(x => cn.has(x)), onlyOpen = [...on].filter(x => !cn.has(x)).sort(), onlyClosed = [...cn].filter(x => !on.has(x)).sort();
    const names = new Set(open.entities.map(e => e.name)), pair = (a, b) => [sing(a), sing(b)].sort().join('||'), cp = new Map();
    closed.relations.forEach(r => cp.set(pair(r.source, r.target), r.relation));
    const samePair = open.relations.filter(r => cp.has(pair(r.source, r.target))).map(r => ({ s: r.source, t: r.target, open: r.relation, closed: cp.get(pair(r.source, r.target)) }));
    return { ent_open: open.entities.length, ent_closed: closed.entities.length, shared: shared.length, onlyOpen, onlyClosed,
      rel_open: open.relations.length, rel_closed: closed.relations.length, in_list: open.relations.filter(r => RL.includes(r.relation)).length,
      dangling: open.relations.filter(r => !names.has(r.source) || !names.has(r.target)).length, samePair, distinctPhrases: new Set(open.relations.map(r => norm(r.relation))).size };
  }
  const api = { defaults, compute, mount, annotate, cost, totals, compareOpen, norm, sing, ENTITY_TYPES, RELATION_LABELS };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['extraction_ner_re'] = api;

  const TCOL = { Method: '#7C9CFF', Concept: '#3CC7B4', Property: '#F2A93B', Metric: '#C28BFF', Person: '#FF8A65', Organization: '#E06C9F', Dataset: '#9BD45F', Software: '#5BC0EB', Other: '#98A0B0', Task: '#FF5C5C' };
  const CSS = `.ner .txt{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:12px;line-height:2;font-size:15px}
.ner mark{color:var(--text);border-radius:4px;padding:1px 3px;border-bottom:3px solid;background:transparent;cursor:default}
.ner mark.dim{opacity:.25}.ner mark.sel{background:#F2A93B55;outline:2px solid var(--ai)}
.ner .chip{display:inline-block;border:1px solid var(--line);border-radius:10px;padding:0 7px;margin:2px;font-size:12px}
.ner .scroll{overflow-x:auto}.ner label{max-width:100%}.ner .scroll table{min-width:0}.ner td,.ner th{vertical-align:top;font-size:13px}
.ner tr.pick{cursor:pointer}.ner tr.pick:hover{background:var(--panel2)}.ner tr.cur{background:#F2A93B22}
.ner .tag{font-size:11px;border-radius:4px;padding:0 5px;margin-left:4px;border:1px solid}
.ner .tag.wrong{color:#FF5C5C}.ner .tag.questionable{color:#F2A93B}.ner .tag.missed{color:#C28BFF}.ner .tag.dangling{color:#5BC0EB}.ner .tag.off{color:#FF8A65}.ner .tag.good{color:#3CC7B4}
.ner details{margin:8px 0}.ner pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:var(--panel2);padding:8px;border-radius:6px}
.ner .kpi{display:flex;flex-wrap:wrap;gap:8px 18px;margin:8px 0}.ner .kpi b{font:300 22px var(--display);color:var(--ai)}`;

  function mount(el) {
    const K = DemoKit, E = K.el;
    if (!document.getElementById('ner-css')) { const s = E('style', { id: 'ner-css' }, CSS); document.head.append(s); }
    const shell = K.shell(el, 'Extraction on a real passage: entities, triples and what went wrong', 'The stored output of a real LLM run (138 passages, one call each) on Wikipedia text about machine learning. Pick a passage, read the highlighted entities and the triples, then look at the off-list answers and the wrong or missed triples.');
    shell.classList.add('ner');
    const box = E('div'); shell.append(box); box.append(E('p', { class: 'hint' }, 'Loading the pack...'));
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get(DATA), get(PACK + 'data/corpus.json'), get(OPEN)]).then(([d, c, o]) => build(box, d, c, o))
      .catch(e => { box.textContent = 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder so ../../_real-examples/ resolves.'; });
  }

  function build(box, D, corpus, OD) {
    const K = DemoKit, E = K.el, PL = Array.isArray(corpus) ? corpus : corpus.passages, PT = {}; PL.forEach(p => { PT[p.id] = p.text; });
    const ET = D.entity_types, RL = D.relation_labels, T = totals(D.passages, ET, RL);
    const st = { pid: 'p001', mode: 'schema', sel: -1, hide: {}, opid: 'p001' };
    const ids = Object.keys(D.passages);
    box.textContent = '';
    box.append(E('p', { class: 'hint bad' }, 'Real: the model output, the counts, the off-list labels. Ours: the right / wrong labels on 8 triples (read from the passage; not a gold set, no precision or recall is computed). The open view is a second real run (8 calls, no lists) compared by code with the stored answer; the open triples carry no right / wrong labels. One model, one prompt, demo scale: 138 passages (8 in the open run). NOT an evaluation of the thesis system.'));
    box.append(E('div', { class: 'kpi' },
      ...[[T.entities, 'entity mentions'], [T.relations, 'relations'], [T.off_types, 'entity types outside the list of 9'], [T.off_relations, 'relation labels outside the list of 13'], [T.dangling, 'relations whose endpoint is not in the entity list']]
        .map(([v, l]) => E('span', {}, E('b', {}, String(v)), ' ' + l))));
    const sel = E('select', { style: 'max-width:100%;width:100%' }, ids.map(p => E('option', { value: p }, p + ': ' + PT[p].slice(0, 50) + '...')));
    const go = pid => { st.pid = pid; st.sel = -1; sel.value = pid; draw(); };
    sel.addEventListener('change', () => go(sel.value));
    const mode = E('div', { class: 'row' });
    const chips = E('div', { class: 'row' });
    box.append(E('div', { class: 'row' }, E('label', {}, 'passage ', sel), E('button', { onclick: () => go(ids[(ids.indexOf(st.pid) + ids.length - 1) % ids.length]) }, '< prev'), E('button', { onclick: () => go(ids[(ids.indexOf(st.pid) + 1) % ids.length]) }, 'next >')), mode, chips);
    const out = E('div'); box.append(out);

    function draw() {
      const rec = D.passages[st.pid], text = PT[st.pid];
      const ents = rec.e.map(e => ({ n: e.n, t: e.t })), c = compute({ text, entities: ents, relations: rec.r.map(r => ({ s: r.s, r: r.r, t: r.t })) });
      mode.textContent = ''; mode.append(E('span', { class: 'hint' }, 'view:'),
        E('button', { 'aria-pressed': String(st.mode === 'schema'), onclick: () => { st.mode = 'schema'; draw(); } }, 'Schema-guided (what was run)'),
        E('button', { 'aria-pressed': String(st.mode === 'open'), onclick: () => { st.mode = 'open'; draw(); } }, 'Open (real run, 8 passages)'));
      chips.textContent = ''; chips.append(E('span', { class: 'hint' }, 'real error cases (our labels):'));
      D.labels.forEach((l, i) => chips.append(E('button', { onclick: () => { go(l.pid); st.sel = -2 - i; draw(); } }, l.pid + ' ' + l.kind)));
      out.textContent = '';
      if (st.mode === 'open') return drawOpen();
      // legend with filters
      out.append(E('div', { class: 'row' }, ...Object.keys(c.typeCounts).map(tp => {
        const b = E('button', { 'aria-pressed': String(!st.hide[tp]), style: 'border-left:6px solid ' + (TCOL[tp] || '#fff'), onclick: () => { st.hide[tp] = !st.hide[tp]; draw(); } }, tp + ' ' + c.typeCounts[tp] + (ET.includes(tp) ? '' : ' (not in list)'));
        return b;
      })));
      // passage with highlights
      const txt = E('div', { class: 'txt' }), marks = [];
      let pos = 0;
      c.spans.forEach(s => {
        if (s.start < pos) return;
        txt.append(text.slice(pos, s.start));
        const rel = st.sel >= 0 ? rec.r[st.sel] : null;
        const m = E('mark', { style: 'border-color:' + (TCOL[s.type] || '#fff'), title: s.name + ' (' + s.type + ')' }, text.slice(s.start, s.end));
        if (st.hide[s.type]) m.classList.add('dim');
        if (rel && (rel.s === s.name || rel.t === s.name)) m.classList.add('sel');
        txt.append(m); marks.push(m); pos = s.end;
      });
      txt.append(text.slice(pos)); out.append(txt);
      out.append(E('p', { class: 'hint' }, c.n_entities + ' entities returned, ' + c.entities_found_in_text + ' found as words in the text' + (c.not_found.length ? ' (not literally in the text: ' + c.not_found.join(', ') + ')' : '') + '. ' + c.n_relations + ' relations. Outside the lists: ' + c.off_types + ' types, ' + c.off_relations + ' labels; endpoint missing: ' + c.dangling + '. Click a triple to mark its two entities in the text.'));
      // triples
      const lab = D.labels.filter(l => l.pid === st.pid), tag = (s, r, t) => lab.find(l => l.kind !== 'missed' && l.s === s && l.r === r && l.t === t);
      const names = new Set(rec.e.map(e => e.n));
      const rows = rec.r.map((r, i) => {
        const l = tag(r.s, r.r, r.t), cur = st.sel === i || (l && st.sel === -2 - D.labels.indexOf(l));
        const tr = E('tr', { class: 'pick' + (cur ? ' cur' : ''), onclick: () => { st.sel = st.sel === i ? -1 : i; draw(); } },
          E('td', {}, r.s), E('td', {}, E('code', {}, r.r), r.off ? E('span', { class: 'tag off' }, 'not in list of 13: the build changed it to related_to') : ''), E('td', {}, r.t),
          E('td', {}, (!names.has(r.s) || !names.has(r.t)) ? E('span', { class: 'tag dangling' }, 'endpoint not in entity list') : '', l ? E('span', { class: 'tag ' + l.kind }, l.kind) : ''));
        return tr;
      });
      out.append(E('div', { class: 'scroll' }, E('table', {}, E('tr', {}, ['source', 'relation', 'target', 'check'].map(h => E('th', {}, h))), ...rows)));
      // our labels for this passage
      if (lab.length) {
        out.append(E('h4', {}, 'Our reading of this passage'));
        lab.forEach(l => out.append(E('p', { class: st.sel === -2 - D.labels.indexOf(l) ? 'changed' : '' }, E('span', { class: 'tag ' + l.kind }, l.kind), ' ', E('b', {}, l.s + ' | ' + l.r + ' | ' + l.t), ' ', l.why)));
        out.append(E('p', { class: 'hint' }, 'Labels are ours and only on these passages. The real error rate is unknown: the pack has no gold triples, so no precision or recall is shown.'));
      }
      out.append(E('h4', {}, 'Cost of this step (formula from the record, real token counts)'));
      const tin = E('input', { type: 'number', value: D.totals.tok_in, step: 1000, style: 'width:90px' }), tout = E('input', { type: 'number', value: D.totals.tok_out, step: 1000, style: 'width:90px' });
      const pin = E('input', { type: 'number', value: 0.113, step: 0.01, style: 'width:70px' }), pout = E('input', { type: 'number', value: 0.382, step: 0.01, style: 'width:70px' });
      const res = E('span', { class: 'num result' }), upd = () => { res.textContent = 'USD ' + K.fmt(cost(+tin.value, +tout.value, +pin.value, +pout.value), 5); K.flash(res); };
      [tin, tout, pin, pout].forEach(x => x.addEventListener('input', upd)); res.textContent = 'USD ' + K.fmt(cost(D.totals.tok_in, D.totals.tok_out, 0.113, 0.382), 5);
      out.append(E('div', { class: 'row' }, E('label', {}, 'tokens in ', tin), E('label', {}, 'out ', tout), E('label', {}, 'USD/M in ', pin), E('label', {}, 'out ', pout), res));
      out.append(E('div', { class: 'formula' }, 'C = (T_in x p_in + T_out x p_out) / 10^6   over 138 calls: ' + K.fmt(D.totals.tok_in / 138, 1) + ' tokens in and ' + K.fmt(D.totals.tok_out / 138, 1) + ' out per call. Prices are the pack ledger values for qwen3.8-flash.'));
      out.append(E('details', {}, E('summary', {}, 'The real prompt (the passage replaces {text})'), E('pre', {}, D.prompt.split('Passage:')[0] + 'Passage:\n{text}')));
    }
    function drawOpen() {
      const PT8 = OD.passages, C = {}, tot = { eo: 0, ec: 0, sh: 0, ro: 0, rc: 0, il: 0, sp: 0, dg: 0 };
      PT8.forEach(pid => { const q = OD.passages_data[pid]; C[pid] = compareOpen(q.open, q.closed, RL); const c = C[pid]; tot.eo += c.ent_open; tot.ec += c.ent_closed; tot.sh += c.shared; tot.ro += c.rel_open; tot.rc += c.rel_closed; tot.il += c.in_list; tot.sp += c.samePair.length; tot.dg += c.dangling; });
      const labs = {}; PT8.forEach(pid => { OD.passages_data[pid].open.relations.forEach(r => { const k = norm(r.relation); labs[k] = (labs[k] || 0) + 1; }); });
      out.append(E('p', { class: 'hint bad' }, 'Real: a second run of the same model (' + OD.model + ', temperature 0, JSON mode) on ' + PT8.length + ' passages (' + PT8.join(', ') + ': the 4 behind our labelled triples plus 4 drawn at random, seed 20261010), run ' + OD.date + '. The prompt is the pack prompt with only the two list rules removed: types and relations are free text. Counts, overlaps and the label table are computed by code from the stored outputs. Not done: no right / wrong labels on the open triples, no gold graph, no canonicalisation step. 8 passages only; first attempt at max_tokens 900 cut one open answer, so the run used 2000 (the open answers are longer: ' + K.fmt(OD.totals.tok_out_open / PT8.length, 0) + ' output tokens per call against ' + K.fmt(OD.totals.tok_out_closed / PT8.length, 0) + ' for the closed ones).'));
      out.append(E('div', { class: 'kpi' }, ...[[tot.eo + ' / ' + tot.ec, 'entities open / schema-guided'], [tot.sh, 'entity strings in both (normalised)'], [tot.ro + ' / ' + tot.rc, 'triples open / schema-guided'], [Object.keys(labs).length, 'distinct relation phrases in ' + tot.ro + ' open triples (schema: 13 labels)'], [tot.il, 'open phrases that are one of the 13 labels'], [tot.sp, 'open triples whose two endpoints also appear in a schema triple'], [tot.dg, 'open triples with an endpoint not in the open entity list']].map(([v, l]) => E('span', {}, E('b', {}, String(v)), ' ' + l))));
      out.append(E('div', { class: 'row' }, E('span', { class: 'hint' }, 'passage:'), ...PT8.map(pid => E('button', { 'aria-pressed': String(st.opid === pid), onclick: () => { st.opid = pid; draw(); } }, pid))));
      const q = OD.passages_data[st.opid], c = C[st.opid], tx = PT[st.opid];
      out.append(E('div', { class: 'txt' }, tx));
      const tri = (rs, bad) => E('div', { class: 'scroll' }, E('table', {}, E('tr', {}, ['source', 'relation', 'target'].map(h => E('th', {}, h))), ...rs.map(r => E('tr', {}, E('td', {}, r.source), E('td', {}, E('code', {}, r.relation), (bad && RL.includes(r.relation)) ? E('span', { class: 'tag good' }, 'one of the 13') : ''), E('td', {}, r.target)))));
      out.append(E('h4', {}, st.opid + ': open answer, ' + c.rel_open + ' triples, ' + c.ent_open + ' entities'), tri(q.open.relations, true));
      out.append(E('h4', {}, st.opid + ': schema-guided answer (stored, ' + c.rel_closed + ' triples, ' + c.ent_closed + ' entities)'), tri(q.closed.relations, false));
      const orig = (ents, k) => (ents.find(e => sing(e.name) === k) || { name: k }).name;
      const tc = {}; q.open.entities.forEach(e => { tc[e.type] = (tc[e.type] || 0) + 1; });
      out.append(E('p', {}, E('b', {}, 'Entity strings: '), c.shared + ' in both. Only in the open answer: ' + (c.onlyOpen.map(k => orig(q.open.entities, k)).join('; ') || 'none') + '. Only in the schema-guided answer: ' + (c.onlyClosed.map(k => orig(q.closed.entities, k)).join('; ') || 'none') + '.'));
      out.append(E('p', {}, E('b', {}, 'Entity types the open run chose (free text): '), Object.entries(tc).map(([k, v]) => v + ' x ' + k).join(', ') + '. The schema-guided run was held to 9 types.'));
      // label table over all 8 passages: closed label -> open phrases on the same endpoint pair
      const byLab = {}; PT8.forEach(pid => C[pid].samePair.forEach(x => { (byLab[x.closed] ||= {})[x.open] = (byLab[x.closed][x.open] || 0) + 1; }));
      const rows = Object.entries(byLab).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length || a[0].localeCompare(b[0])).map(([cl, o]) => E('tr', {}, E('td', {}, E('code', {}, cl)), E('td', { class: 'num' }, String(Object.keys(o).length)), E('td', {}, Object.entries(o).map(([ph, n]) => ph + (n > 1 ? ' (x' + n + ')' : '')).join('; '))));
      out.append(E('h4', {}, 'Where both runs related the same two things: which phrase did the open run write for each schema label?'));
      out.append(E('div', { class: 'scroll' }, E('table', {}, E('tr', {}, ['schema label', 'distinct open phrases', 'open phrases on the same pairs (all 8 passages)'].map(h => E('th', {}, h))), ...rows)));
      out.append(E('p', { class: 'hint' }, 'Reading: the open phrases keep detail the 13 labels drop ("also known as", "named for", "describes relationship between"), but one schema label such as part_of or uses is spread over many phrases, and several different phrases would need to be merged before the graph can be counted or queried. A canonicalisation step (EDC: define each phrase, then match to a schema) is what the record describes for that; it is not run here.'));
      out.append(E('details', {}, E('summary', {}, 'The open prompt (the passage replaces {text})'), E('pre', {}, OD.prompt_open.split('Passage:')[0] + 'Passage:\n{text}')));
      out.append(E('details', {}, E('summary', {}, 'What the closed list could not hold (all 138 passages, the earlier view of this page)'), E('div', { id: 'offlist' })));
      const off = out.querySelector('#offlist');
      off.append(E('ul', {}, E('li', {}, T.off_types + ' of ' + T.entities + ' entities have a type outside the list: ' + Object.entries(T.offTypes).map(([k, v]) => v + ' x "' + k + '"').join(', ') + '. The build turned them into "Other".'),
        E('li', {}, T.off_relations + ' of ' + T.relations + ' relations have a label outside the list of 13 (' + Object.keys(T.offLabels).length + ' different labels). The build turned every one into related_to.'),
        E('li', {}, T.dangling + ' relations point to a name that is not in the passage entity list; the build adds those names as nodes of type Other.')));
    }
    draw();
  }
})(typeof window !== 'undefined' ? window : globalThis);
