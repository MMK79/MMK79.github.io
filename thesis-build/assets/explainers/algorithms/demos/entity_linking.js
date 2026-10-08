/* Entity linking: turn the mentions of a question into graph nodes (candidates, scores, one chosen node, or "no entity").
   Real example (default): the stored linking run of the real-example pack (662-node graph from 138 Wikipedia passages, 24 questions).
   Toy example ("break it"): BLINK-style two stages on an invented 4-entity knowledge base; the cross-encoder logits are an editable table (invented, no model runs).
   2D on purpose: the idea is text span -> ranked candidate table; there is no spatial structure that 3D would show. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const KB = {
    E1: ['Scott Young (footballer)', 'Welsh football player who played as a forward for Cardiff City and Wales.'],
    E2: ['Scott Young (writer)', 'Canadian writer and journalist, author of books about hockey and newspaper columns.'],
    E3: ['Scott Young (musician)', 'American singer who recorded country music albums in Nashville.'],
    E4: ['Cardiff City F.C.', 'Welsh football club based in Cardiff that plays in the English league.'],
  };
  const defaults = {
    text: 'Scott Young scored twice for Cardiff on Saturday as the forward helped his club to a win.',
    cands: ['E1', 'E2', 'E3'],                       // the alias-table result for the mention (editable)
    cross: { E1: 3.1, E2: -0.8, E3: -1.9 },          // invented cross-encoder logits
    prior: { E1: 20, E2: 70, E3: 10 },               // invented popularity counts
    S: [[4.0, 1.0, 0.5], [0.2, 3.0, 1.1], [0.4, 0.9, 2.5]],  // invented in-batch score matrix
  };
  const STOP = new Set('the a an of in and to was is for with by at on as it he she'.split(' '));
  const tok = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
  const counts = ws => { const c = {}; ws.forEach(w => { c[w] = (c[w] || 0) + 1; }); return c; };
  function cos(a, b) {
    const ca = counts(tok(a)), cb = counts(tok(b)); let n = 0;
    for (const w in ca) if (w in cb) n += ca[w] * cb[w];
    const na = Math.sqrt(Object.values(ca).reduce((s, v) => s + v * v, 0)), nb = Math.sqrt(Object.values(cb).reduce((s, v) => s + v * v, 0));
    return na && nb ? n / (na * nb) : 0;
  }
  const r3 = x => Math.round(x * 1000) / 1000;

  /* PURE. Stage 1: word-count cosine (our stand-in for the dense bi-encoder). Stage 2: softmax over the cross-encoder logits. */
  function compute(inp) {
    const cands = inp.cands.slice();
    const s1 = {}; cands.forEach(e => { s1[e] = cos(inp.text, KB[e][0] + ' ' + KB[e][1]); });
    const order1 = cands.map((e, i) => [e, i]).sort((a, b) => (s1[b[0]] - s1[a[0]]) || (a[1] - b[1])).map(x => x[0]);
    const Z = cands.reduce((s, e) => s + Math.exp(inp.cross[e]), 0), p = {};
    cands.forEach(e => { p[e] = Math.exp(inp.cross[e]) / Z; });
    const linked = cands.length ? cands.reduce((b, e) => (inp.cross[e] > inp.cross[b] ? e : b), cands[0]) : null;
    const pri = cands.length ? cands.reduce((b, e) => (inp.prior[e] > inp.prior[b] ? e : b), cands[0]) : null;
    const loss = inp.S.map((row, i) => -row[i] + Math.log(row.reduce((s, v) => s + Math.exp(v), 0)));
    const o = x => { const q = {}; cands.forEach(e => { q[e] = r3(x[e]); }); return q; };
    return { candidates: cands, stage1_scores: o(s1), stage1_order: order1, linked_entity: linked, cross_probabilities: o(p),
      popularity_baseline_pick: pri, batch_loss_mean: r3(loss.reduce((s, v) => s + v, 0) / loss.length) };
  }

  /* PURE helper for the real example: which stored candidates would be linked at an embedding threshold.
     rec = one record of graph/entity_linking.json; string links always stay; embedding top-3 are added if cosine >= thr and not linked yet. */
  function relink(rec, thr) {
    const out = rec.linked.filter(l => l.method === 'string');
    const have = new Set(out.map(l => l.node));
    rec.embedding_top3_for_reference.forEach(e => { if (e.score >= thr && !have.has(e.node)) { out.push({ node: e.node, name: e.name, method: 'embedding', score: e.score }); have.add(e.node); } });
    return out;
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: no context in the question': { ...clone(defaults), text: 'Who is Scott Young?', cross: { E1: 0.2, E2: 0.1, E3: 0.0 } },
    'break it: the right entity is not in the alias table': { ...clone(defaults), cands: ['E2', 'E3'] },
  };
  /* generic words, marked by hand (our judgement): they match many questions and mean little as a start node */
  const GENERIC = new Set(['data', 'algorithm', 'error', 'classification', 'regression', 'parameters', 'tree', 'shrinkage']);

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults);
    const shell = K.shell(el, 'Entity linking, toy: mention to node in two stages',
      'Invented knowledge base of four entities. Stage 1 scores candidates by word overlap with the sentence (our stand-in for the dense bi-encoder). Stage 2 uses the logits in the table, which stand in for a cross-encoder (invented, no model runs). Edit the sentence, the alias table (the "candidate" box), the logits or the popularity counts. Then try the break-it presets.');
    const presetRow = K.el('div', { class: 'row' }), txt = K.el('input', { type: 'text', value: st.text, 'aria-label': 'sentence', style: 'width:100%' });
    const tbl = K.el('div', {}), res = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' });
    txt.addEventListener('input', () => { st.text = txt.value; render(); });
    function build() {
      txt.value = st.text;
      tbl.replaceChildren(...['E1', 'E2', 'E3'].map(e => {
        const inA = K.el('input', { type: 'checkbox', 'aria-label': e + ' in alias table' }); inA.checked = st.cands.includes(e);
        inA.addEventListener('change', () => { st.cands = ['E1', 'E2', 'E3'].filter(x => (x === e ? inA.checked : st.cands.includes(x))); render(); });
        const lg = K.el('input', { type: 'number', step: '0.1', value: st.cross[e], 'aria-label': e + ' logit', style: 'width:64px' });
        lg.addEventListener('input', () => { const x = parseFloat(lg.value); if (Number.isFinite(x)) { st.cross[e] = x; render(); } });
        const pr = K.el('input', { type: 'number', step: '1', min: '0', value: st.prior[e], 'aria-label': e + ' popularity', style: 'width:56px' });
        pr.addEventListener('input', () => { const x = parseFloat(pr.value); if (Number.isFinite(x)) { st.prior[e] = x; render(); } });
        return K.el('div', { style: 'border-bottom:1px solid var(--line);padding:6px 0' },
          K.el('div', { class: 'row', style: 'align-items:center;gap:10px' }, K.el('b', {}, e + ' ' + KB[e][0]), K.el('label', {}, inA, ' candidate'), K.el('label', {}, 'logit ', lg), K.el('label', {}, 'popularity ', pr),
            K.el('span', { class: 'num', 'data-s': e }, '')),
          K.el('div', { class: 'hint' }, KB[e][1]));
      }));
    }
    Object.keys(PRESETS).forEach(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); build(); render(); }); presetRow.append(b); });
    shell.append(presetRow, K.el('label', {}, 'sentence ', txt), tbl, res, formula);
    function render() {
      if (!st.cands.length) { res.replaceChildren(K.el('div', { class: 'bad' }, 'No candidate: the linker has nothing to rank. The honest answer is "no entity" (NIL).')); formula.textContent = ''; return; }
      const r = compute(st);
      ['E1', 'E2', 'E3'].forEach(e => {
        const s = tbl.querySelector(`[data-s="${e}"]`), t = st.cands.includes(e) ? `stage 1 = ${K.fmt(r.stage1_scores[e], 3)}   P = ${K.fmt(r.cross_probabilities[e], 3)}` : 'not a candidate';
        if (s.textContent !== t) { s.textContent = t; K.flash(s); }
      });
      const best = Math.max(...st.cands.map(e => st.cross[e])), gold = 'E1', right = r.linked_entity === gold;
      res.replaceChildren(
        K.el('div', {}, 'stage 1 order: ', K.el('b', {}, r.stage1_order.join(' > '))),
        K.el('div', {}, 'linked after stage 2: ', K.el('b', { class: right ? 'good' : 'bad' }, `${r.linked_entity} ${KB[r.linked_entity][0]}`), '   (the sentence is about the footballer, E1)'),
        K.el('div', {}, 'popularity-only pick: ', K.el('b', { class: r.popularity_baseline_pick === gold ? 'good' : 'bad' }, `${r.popularity_baseline_pick} ${KB[r.popularity_baseline_pick][0]}`)),
        !st.cands.includes(gold) ? K.el('div', { class: 'bad' }, 'E1 is not in the candidate list, so no ranker can pick it. The system links a wrong node with a confident-looking probability (P = ' + K.fmt(r.cross_probabilities[r.linked_entity], 3) + '). A "no entity" rule on a low score would be the only safeguard.') : '',
        best < 0 ? K.el('div', { class: 'hint' }, 'Every logit is below 0: a NIL rule such as "best logit < 0 means no entity" (our example, not part of BLINK) would refuse here.') : '',
        (tok(st.text).length <= 3 && Math.abs(st.cross.E1 - st.cross.E2) < 0.5) ? K.el('div', { class: 'bad' }, 'Almost no context: the logits are close, so the choice is close to a guess. Popularity is the usual tie-break, and it is wrong for this sentence.') : '');
      const L = st.S.map((row, i) => -row[i] + Math.log(row.reduce((s, v) => s + Math.exp(v), 0)));
      formula.textContent = 's_cross -> softmax: ' + st.cands.map(e => `${e} ${K.fmt(r.cross_probabilities[e], 3)}`).join(', ') + `\ntraining loss (BLINK Eq. 4) on the invented 3x3 batch matrix: per pair ${L.map(x => K.fmt(x, 3)).join(', ')}; mean ${K.fmt(r.batch_loss_mean, 3)}`;
    }
    build(); render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: linking questions to a graph that an LLM extracted from Wikipedia',
      'Real data, one stored run: 138 passages from 15 English Wikipedia articles on machine learning, a 662-node graph extracted by an LLM, 24 questions. Rule: (1) a node name or alias occurs as a whole-word phrase in the question (string match); (2) otherwise the question embedding (MiniLM) is compared with node names and the top 3 with cosine >= 0.55 are added. The numbers below are stored, not computed in this page; you can move the threshold and watch the links change.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/entity_linking.json'), get('graph/graph.json')]).then(([el_, g]) => {
      const Q = el_.questions, S = el_.summary, N = {}, deg = {};
      g.nodes.forEach(n => { N[n.id] = n; deg[n.id] = 0; }); g.edges.forEach(e => { deg[e.source]++; deg[e.target]++; });
      const ids = Object.keys(Q);
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%;width:100%' }, ...ids.map(i => K.el('option', { value: i }, `${i} (${Q[i].type}): ${Q[i].question.slice(0, 64)}`)));
      const CASES = [['q22', 'the correct miss'], ['q04', 'generic seeds'], ['q10', 'only one weak link'], ['q11', 'one link, ridge missed'], ['q21', 'linked but unanswerable'], ['q14', 'near-duplicate node']];
      const caseRow = K.el('div', { class: 'row' }, K.el('span', { class: 'hint' }, 'jump to: '), ...CASES.map(c => { const b = K.el('button', {}, `${c[0]} ${c[1]}`); b.addEventListener('click', () => { sel.value = c[0]; draw(); }); return b; }));
      const thrS = K.slider('embedding threshold', 0.3, 0.8, 0.01, 0.55, v => { thr = v; draw(); });
      let thr = 0.55;
      const qbox = K.el('div', { style: 'font-size:15px;margin:8px 0' }), tbl = K.el('div', {}), reach = K.el('div', {}), verdict = K.el('div', { 'aria-live': 'polite' }), agg = K.el('div', { class: 'hint' });
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: demo scale (138 passages, 24 questions written by Claude from the corpus, not a benchmark, NOT an evaluation of the thesis system). The graph is LLM-extracted and not checked against a human gold graph; it has near-duplicates ("SVM" and "support vector machine" are separate nodes, no embedding merge). Linking has no gold labels here: "linked" means the rule fired, not that the node is the right one; only "gold passages reachable" is checked against labelled passages. "Generic word" flags are our hand list. Reachability is stored for the 0.55 rule only. Text: Wikipedia contributors, CC BY-SA 4.0.');
      const rx = m => new RegExp('(^|[^a-z0-9])(' + (m.toLowerCase().match(/[a-z0-9]+/g) || []).map(w => w + 's?').join('[^a-z0-9]+') + ')(?![a-z0-9])', 'i');
      function highlight(q, links) {
        const spans = []; links.forEach(l => { if (l.method !== 'string') return; const mm = rx(l.matched || l.name).exec(q); if (mm) { const s = mm.index + mm[1].length; spans.push([s, s + mm[2].length, l]); } });
        spans.sort((a, b) => a[0] - b[0]); const out = []; let pos = 0;
        spans.forEach(([s, e, l]) => { if (s < pos) return; out.push(q.slice(pos, s)); out.push(K.el('mark', { style: 'background:var(--he);color:#000;border-radius:3px;padding:0 3px', title: 'string match -> ' + l.name }, q.slice(s, e))); pos = e; });
        out.push(q.slice(pos)); return out;
      }
      function draw() {
        const id = sel.value, q = Q[id], links = relink(q, thr), unans = !q.gold.length;
        qbox.replaceChildren(K.el('b', {}, id + '  '), ...highlight(q.question, links), K.el('div', { class: 'hint' }, `type: ${q.type}. gold passages: ${q.gold.join(', ') || 'none (unanswerable)'}. Highlighted words are the string-matched mentions.`));
        tbl.replaceChildren(...(links.length ? links.map(l => {
          const n = N[l.node], gen = GENERIC.has(l.name.toLowerCase());
          const flags = [gen ? 'generic word' : '', deg[l.node] >= 15 ? 'hub (degree ' + deg[l.node] + ')' : '', q.seeds_attached_to_gold.includes(l.node) ? 'touches a gold passage' : ''].filter(Boolean);
          return K.el('div', { class: 'row', style: 'align-items:center;gap:10px;border-bottom:1px solid var(--line);padding:4px 0' },
            K.el('b', { style: 'flex:1 1 200px;min-width:0' }, l.name),
            K.el('span', { style: 'color:' + (l.method === 'string' ? 'var(--he)' : 'var(--k12)') }, l.method),
            K.el('div', { style: 'width:90px;background:var(--line);border-radius:2px' }, K.el('div', { style: `height:10px;border-radius:2px;width:${Math.round(l.score * 100)}%;background:${l.method === 'string' ? 'var(--he)' : 'var(--k12)'}` })),
            K.el('span', { class: 'num' }, 'score ' + K.fmt(l.score, 2)),
            K.el('span', { class: 'hint' }, `degree ${deg[l.node]}, ${n.n_passages} passage${n.n_passages === 1 ? '' : 's'}`),
            flags.length ? K.el('span', { class: gen || deg[l.node] >= 15 ? 'bad' : 'good' }, flags.join('; ')) : '');
        }) : [K.el('div', { class: 'bad' }, 'No node linked: a miss.')]));
        const top = q.embedding_top3_for_reference;
        const best = top.length ? top[0] : null;
        const v = [];
        if (!links.length) {
          v.push(K.el('div', { class: unans ? 'good' : 'bad' }, unans ? `Correct miss. The question is unanswerable from this corpus (there is no Adam node). The best embedding cosine is ${K.fmt(best.score, 2)} (${best.name}), under the threshold ${K.fmt(thr, 2)}. Better a "no entity" than a wrong start node.` : 'A miss on an answerable question: the graph search would start from nothing.'));
        } else if (unans && thr < 0.55 && !q.linked.length) {
          v.push(K.el('div', { class: 'bad' }, `Lower the threshold and the system links "${links.map(l => l.name).join('", "')}" for a question the corpus cannot answer: a confident wrong start. This is why the threshold is 0.55 here.`));
        }
        if (unans && q.linked.length) v.push(K.el('div', { class: 'bad' }, 'This question is unanswerable, yet the string rule found names in it. Linking only says "these words are nodes", never "the answer exists".'));
        const gen = links.filter(l => GENERIC.has(l.name.toLowerCase()));
        if (gen.length) v.push(K.el('div', { class: 'bad' }, `Generic seed${gen.length > 1 ? 's' : ''}: ${gen.map(l => '"' + l.name + '"').join(', ')}. A common word was matched as a node. It adds a start node that says little about the question.`));
        verdict.replaceChildren(...v);
        const gs = q.gold, rb = q.reachability_by_hop;
        if (Math.abs(thr - 0.55) < 1e-9 && Object.keys(rb).length) {
          reach.replaceChildren(K.el('b', {}, 'What the links reach in the graph (stored BFS from the linked nodes)'),
            K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['hop', 'nodes', 'passages', 'gold passages found'].map(h => K.el('th', {}, h))),
              ...['0', '1', '2', '3'].map(h => K.el('tr', {}, K.el('td', { class: 'num' }, h), K.el('td', { class: 'num' }, rb[h].nodes), K.el('td', { class: 'num' }, `${rb[h].passages} of 138`),
                K.el('td', { class: 'num ' + (gs.length && rb[h].gold_found.length < gs.length ? 'bad' : '') }, gs.length ? `${rb[h].gold_found.length} of ${gs.length}` : 'n/a')))));
        } else reach.replaceChildren(K.el('div', { class: 'hint' }, Object.keys(rb).length ? 'Reachability is stored for the 0.55 rule only; set the threshold back to 0.55 to see it.' : 'No links, so there is no graph walk to show.'));
        const a = S.answerable_with_ALL_gold_passages_reachable;
        agg.textContent = `Whole set: ${S.n_linked} of ${S.n_questions} questions linked (${S.linked_by_string} by string, ${S.linked_by_embedding_only} by embedding alone), misses ${S.misses.join(', ')}. For the ${S.answerable} answerable questions, all gold passages are reachable at hop 0 for ${a['0']}, hop 1 for ${a['1']}, hop 2 for ${a['2']}, hop 3 for ${a['3']}.`;
      }
      sel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;max-width:100%' }, 'question ', sel), thrS.node), caseRow, qbox, tbl, verdict, reach, agg, cav); draw();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit;
    const bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, relink };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['entity_linking'] = api;
})(this);
