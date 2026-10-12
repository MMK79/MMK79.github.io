/* routing_agentic_hybrid: a transparent router (vector / graph / hybrid) + a CRAG/Self-RAG-style loop REPLAYED from stored runs
   + vector+graph fusion (RRF recomputed in JS), on the 24 real questions of the pack.
   Serves j3-routing-map, j3-adaptive-rag, j3-router-vector-vs-graph, j3-semantic-router-classifier (rule router only, no embedding
   router), j3-agentic-rag-map, j3-crag, j3-self-rag, j3-react (loop shape only), j3-hybridrag-graph-vector, j3-when-each-wins.
   No LLM call anywhere. The loop is a REPLAY of stored retrieval runs, not a live agent. compute() is pure (no DOM): pass the pack in. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';

  /* ---------- the arms (every arm = a ranked list of passage ids for a question) ---------- */
  const ARMS = {
    vector:  { label: 'Vector',        long: 'dense cosine (all-MiniLM-L6-v2), stored run dense_cosine' },
    graph:   { label: 'Graph',         long: 'personalised PageRank over the extracted graph, stored run ppr_graph' },
    hybrid:  { label: 'Vector+graph',  long: 'RRF (k=60) of dense_cosine and ppr_graph, recomputed here (no stored run)' },
    lexhyb:  { label: 'Lexical+vector', long: 'stored run rrf_bm25_dense (RRF of BM25 and dense), shown as the strong non-graph baseline' },
    concat:  { label: 'Concat',        long: 'HybridRAG order: dense top-5, then ppr top-5 passages not already in it (rule of graph/context_assembly.json), recomputed' },
  };
  const ARM_IDS = Object.keys(ARMS);
  const SHORT = { vector: 'Vec', graph: 'Graph', hybrid: 'V+G', lexhyb: 'Lex+V', concat: 'Concat' };
  const TYPES = ['single-hop', 'bridge', 'comparison', 'unanswerable'];
  const RUNS_USED = ['dense_cosine', 'bm25_lucene', 'ppr_graph', 'rrf_bm25_dense'];

  const defaults = {
    k: 5,                       // context size (top-k passages)
    routerMode: 'label',        // label = question type from questions.json (oracle label) | text = regex rules on the question text
    routes: { 'single-hop': 'vector', 'bridge': 'hybrid', 'comparison': 'hybrid', 'unanswerable': 'vector' },
    grader: 'score',            // score = best dense cosine among the top-k (gold-free) | oracle = all gold passages present (not available live)
    tau: 0.5,                   // score-grader threshold (NOT tuned: 0.5 is a round number; see the sweep)
    maxSteps: 3,
  };

  /* ---------- pure pieces ---------- */
  function rrfFuse(lists, k) { // lists: arrays of ids (best first). Ties keep first-seen order.
    const s = new Map();
    for (const L of lists) L.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (k + i + 1)));
    return [...s.entries()].map(([id, score], pos) => ({ id, score, pos })).sort((a, b) => b.score - a.score || a.pos - b.pos).map(({ id, score }) => ({ id, score }));
  }
  const ids = L => (L || []).map(r => r.id);
  function ranking(pack, arm, qid) { // -> [{id, score}] (up to 20, or up to 10 for concat)
    const R = pack.runs, g = f => R[f][qid] || [];
    if (arm === 'vector') return g('dense_cosine');
    if (arm === 'graph') return g('ppr_graph');
    if (arm === 'lexhyb') return g('rrf_bm25_dense');
    if (arm === 'hybrid') return rrfFuse([ids(g('dense_cosine')), ids(g('ppr_graph'))], 60);
    if (arm === 'concat') {
      const v = ids(g('dense_cosine')).slice(0, 5), gr = ids(g('ppr_graph')).slice(0, 5).filter(x => !v.includes(x));
      return [...v, ...gr].map((id, i) => ({ id, score: 1 / (i + 1) }));
    }
    throw new Error('unknown arm ' + arm);
  }
  const top = (pack, arm, qid, k) => ids(arm === 'concat' ? ranking(pack, arm, qid) : ranking(pack, arm, qid).slice(0, k));
  const found = (list, gold) => gold.filter(g => list.includes(g)).length;

  /* rule router on the question TEXT (gold-free). The rules were written after reading these 24 questions, so its accuracy
     here is optimistic; it cannot detect unanswerable questions (that is the grader's job). */
  function predictType(question) {
    const q = question;
    const bridge = /,\s*and\s+(how|why|what|which|in which)\b/i.test(q) && (/\bwhich\s+(\w+\s+){1,2}/i.test(q.split(/,\s*and\s/i)[0]) || /\bthat\s+(the|,)/i.test(q) || /\bthat,/i.test(q));
    if (bridge) return 'bridge';
    if (/\b(compare|differ|differs|differently|versus)\b/i.test(q)) return 'comparison';
    return 'single-hop';
  }
  function routeOf(cfg, q) {
    const t = cfg.routerMode === 'text' ? predictType(q.question) : q.type;
    return { predicted: t, arm: cfg.routes[t] || 'vector' };
  }

  /* grader: returns {pass, value, rule}. 'score' = best dense cosine over the top-k that the stored dense run also holds
     (a passage outside the dense top-20 counts as 0, a documented conservative choice). 'oracle' uses gold (upper bound). */
  function grade(pack, cfg, q, list) {
    if (cfg.grader === 'oracle') {
      const ok = q.gold_passages.length > 0 && found(list, q.gold_passages) === q.gold_passages.length;
      return { pass: ok, value: q.gold_passages.length ? found(list, q.gold_passages) / q.gold_passages.length : 0, rule: 'all gold passages in the context' };
    }
    const dense = new Map((pack.runs.dense_cosine[q.id] || []).map(r => [r.id, r.score]));
    let best = 0; for (const id of list) best = Math.max(best, dense.get(id) || 0);
    return { pass: best >= cfg.tau, value: best, rule: 'best dense cosine in the context >= ' + cfg.tau };
  }
  const FALLBACK = ['vector', 'hybrid', 'graph', 'lexhyb'];

  /* replay: retrieve with the routed arm, grade, fall back to the next stored arm (never an arm twice), stop on pass or after maxSteps. */
  function runLoop(pack, cfg, q) {
    const first = routeOf(cfg, q).arm, order = [first, ...FALLBACK.filter(a => a !== first)];
    const steps = []; let ctx = null;
    for (const arm of order.slice(0, cfg.maxSteps)) {
      const list = top(pack, arm, q.id, cfg.k), g = grade(pack, cfg, q, list);
      steps.push({ arm, list, found: found(list, q.gold_passages), grade: g });
      if (g.pass) { ctx = list; break; }
    }
    /* out of steps without a pass: the score grader refuses (low confidence everywhere, CRAG 'incorrect');
       the oracle grader keeps the attempt with the most gold passages and refuses only if no attempt has any (ceiling, not live). */
    if (ctx === null && cfg.grader === 'oracle') { const b = steps.reduce((m, s) => s.found > m.found ? s : m, steps[0]); if (b.found > 0) ctx = b.list; }
    return { steps, context: ctx, refused: ctx === null, calls: steps.length };
  }

  function evaluate(pack, cfg) {
    const rows = [];
    for (const q of pack.questions) {
      const gold = q.gold_passages, per = {};
      for (const a of ARM_IDS) { const l = top(pack, a, q.id, cfg.k); per[a] = { list: l, found: found(l, gold) }; }
      const r = routeOf(cfg, q), loop = runLoop(pack, cfg, q);
      rows.push({ id: q.id, type: q.type, gold, per, route: r, routed: per[r.arm], loop, loopFound: loop.context ? found(loop.context, gold) : 0 });
    }
    const ans = rows.filter(r => r.gold.length), un = rows.filter(r => !r.gold.length);
    const mean = (xs, f) => xs.length ? xs.reduce((s, x) => s + f(x), 0) / xs.length : 0;
    const rec = (r, n) => n / r.gold.length;
    const byType = {};
    for (const t of TYPES.filter(t => t !== 'unanswerable')) {
      const rs = ans.filter(r => r.type === t);
      byType[t] = { n: rs.length, arms: Object.fromEntries(ARM_IDS.map(a => [a, mean(rs, r => rec(r, r.per[a].found))])), routed: mean(rs, r => rec(r, r.routed.found)), loop: mean(rs, r => rec(r, r.loopFound)) };
    }
    const arms = Object.fromEntries(ARM_IDS.map(a => [a, mean(ans, r => rec(r, r.per[a].found))]));
    const bestArm = ARM_IDS.reduce((b, a) => arms[a] > arms[b] ? a : b, ARM_IDS[0]);
    const nonConcat = ARM_IDS.filter(a => a !== 'concat').reduce((b, a) => arms[a] > arms[b] ? a : b, 'vector');
    return {
      rows, byType, arms, n_answerable: ans.length, n_unanswerable: un.length,
      routed: mean(ans, r => rec(r, r.routed.found)), loop: mean(ans, r => rec(r, r.loopFound)),
      bestFixed: bestArm, bestFixedRecall: arms[bestArm], bestFixedTop5: nonConcat, bestFixedTop5Recall: arms[nonConcat],
      routedAllGold: ans.filter(r => r.routed.found === r.gold.length).length,
      loopAllGold: ans.filter(r => r.loopFound === r.gold.length).length,
      loopCallsMean: mean(rows, r => r.loop.calls),
      falseRefusals: ans.filter(r => r.loop.refused).length,
      correctRefusals: un.filter(r => r.loop.refused).length,
      routerTypeAcc: cfg.routerMode === 'text' ? mean(ans, r => r.route.predicted === r.type ? 1 : 0) : null,
    };
  }

  /* fusion detail for one question: RRF of two stored ranked lists with constant k */
  function fuseDetail(pack, qid, a, b, k) {
    const A = ids(pack.runs[a][qid]), B = ids(pack.runs[b][qid]);
    const fused = rrfFuse([A, B], k).slice(0, 5);
    return fused.map(f => ({ id: f.id, score: f.score, rankA: A.indexOf(f.id) + 1 || null, rankB: B.indexOf(f.id) + 1 || null }));
  }
  /* equality of the recomputed bm25+dense RRF with the stored rrf_bm25_dense run. Stored lists hold the top 20 only, while the
     stored fusion used the full rankings, so a passage outside one stored top-20 loses that list's term. */
  function fusionCheck(pack) {
    let sameTop5 = 0, n = 0, bothMax = 0, bothN = 0, oneN = 0, oneMax = 0, lowerViol = 0;
    for (const q of pack.questions) {
      const A = ids(pack.runs.dense_cosine[q.id]), B = ids(pack.runs.bm25_lucene[q.id]), S = pack.runs.rrf_bm25_dense[q.id];
      const mine = new Map(rrfFuse([A, B], 60).map(r => [r.id, r.score]));
      const f = rrfFuse([A, B], 60).slice(0, 5).map(r => r.id).join() === ids(S).slice(0, 5).join();
      n++; if (f) sameTop5++;
      for (const r of S) {
        const d = r.score - (mine.get(r.id) || 0);
        if (d < -1e-6) lowerViol++;
        if (A.includes(r.id) && B.includes(r.id)) { bothN++; bothMax = Math.max(bothMax, Math.abs(d)); }
        else if (A.includes(r.id) || B.includes(r.id)) { oneN++; oneMax = Math.max(oneMax, d); }
      }
    }
    return { sameTop5, n, bothN, bothMaxDiff: bothMax, oneN, oneMaxDiff: oneMax, lowerViol };
  }
  /* recompute the stored concat (graph/context_assembly.json) */
  function concatCheck(pack, stored) {
    let same = 0; for (const s of stored.questions) if (top(pack, 'concat', s.qid, 5).join() === s.concat.join()) same++;
    return { same, n: stored.questions.length };
  }
  /* sweep of the score grader threshold with a fixed routing: one honest picture of the trade-off (no tuning) */
  function sweep(pack, cfg, taus) {
    return taus.map(t => { const e = evaluate(pack, { ...cfg, grader: 'score', tau: t }); return { tau: t, recall: e.loop, falseRefusals: e.falseRefusals, correctRefusals: e.correctRefusals, calls: e.loopCallsMean }; });
  }

  function compute(inp) { const cfg = { ...defaults, ...inp, routes: { ...defaults.routes, ...(inp.routes || {}) } }; return evaluate(inp.pack, cfg); }

  /* ---------- pack loading ---------- */
  async function loadPack() {
    const J = async p => (await fetch(PACK + p)).json();
    const [questions, ...runFiles] = await Promise.all([J('data/questions.json'), ...RUNS_USED.map(m => J('runs/' + m + '.json'))]);
    const [ctxAsm, linking, local, glob] = await Promise.all([J('graph/context_assembly.json'), J('graph/entity_linking.json'), J('graph/local_search.json'), J('graph/global_search.json')]);
    const runs = {}; RUNS_USED.forEach((m, i) => { runs[m] = Object.fromEntries(runFiles[i].questions.map(q => [q.qid, q.ranking])); });
    return { questions, runs, ctxAsm, linking, local, glob };
  }

  /* ---------- UI ---------- */
  function mount(el) {
    const K = root.DemoKit, E = K.el;
    const shell = K.shell(el, 'Routing, a replayed correct-and-retry loop, and vector+graph fusion',
      'Real example (default): the 24 real questions of the pack, the stored retrieval runs, no LLM call. Pick a routing rule, a grader and a question, and see which gold passages each path finds.');
    const note = E('div', { class: 'formula' }, 'Demo scale: 138 passages, 24 questions (20 answerable); one question moves a recall by 0.025 to 0.05. Gold labels cover only the passages judged necessary. NOT an evaluation of the thesis system. Routes by question type are inferred from Adaptive-RAG (not a published vector-vs-graph router). The text router was written after reading these questions. The label router reads the answer-key type (incl. unanswerable), which no live router knows. The loop below is a replay of stored runs, not a live agent.');
    shell.append(note);
    const body = E('div', {}, 'loading the pack ...'); shell.append(body);
    /* range input: label updates while dragging, the page re-renders on release/keypress (a re-render mid-drag would drop the thumb) */
    const slide = (label, min, max, step, value, on) => { const out = E('span', { class: 'num' }, String(value)), inp = E('input', { type: 'range', min, max, step, value }); inp.addEventListener('input', () => { out.textContent = inp.value; }); inp.addEventListener('change', () => on(Number(inp.value))); return E('label', {}, label + ' ', inp, ' ', out); };
    const cfg = JSON.parse(JSON.stringify(defaults)); let pack, sel = 'q09';
    const css = E('style', {}, '.rah .chips span{display:inline-block;min-width:1.6em;text-align:center;border-radius:4px;padding:0 3px;margin:0 1px;font-size:12px}.rah .full{background:#3CC7B433;color:var(--he)}.rah .part{background:#F2A93B33;color:var(--ai)}.rah .none{background:#FF8A6522;color:var(--warn)}.rah .na{color:var(--faint)}.rah td,.rah th{font-size:12px;padding:3px 4px;white-space:nowrap}.rah tr.sel td{background:#F2A93B14}.rah tr[data-q]{cursor:pointer}.rah .pid{font-family:var(--mono);font-size:12px;padding:1px 4px;border-radius:3px;border:1px solid var(--line);margin-right:3px;display:inline-block}.rah .pid.gold{border-color:var(--he);color:var(--he)}.rah .box{border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:10px 0;background:var(--panel2)}.rah h4{margin:14px 0 4px;font-weight:400;font-family:var(--display)}.rah select{max-width:100%}@media(max-width:600px){.rah td,.rah th{font-size:11px;padding:3px 2px}.rah .chips span{min-width:1.4em;padding:0 1px;margin:0}}');
    shell.classList.add('rah'); shell.append(css);
    const chip = (f, n) => E('span', { class: n === 0 ? 'na' : f === n ? 'full' : f === 0 ? 'none' : 'part' }, n === 0 ? '-' : f + '/' + n);
    const pids = (list, gold) => list.length ? list.map(id => E('span', { class: 'pid' + (gold.includes(id) ? ' gold' : '') }, id)) : [E('span', { class: 'bad' }, '(empty: no seed entity linked)')];
    const f2 = x => K.fmt(x, 3);

    function render() {
      const ev = evaluate(pack, cfg), out = [];
      /* controls */
      const mkSel = (opts, val, on) => { const s = E('select', {}, opts.map(([v, t]) => E('option', { value: v }, t))); s.value = val; s.addEventListener('change', () => on(s.value)); return s; };
      const armOpts = ARM_IDS.filter(a => a !== 'concat').map(a => [a, ARMS[a].label]);
      const ctl = E('div', { class: 'box' },
        E('div', { class: 'row' }, E('label', {}, 'Router input '), mkSel([['label', 'question type from questions.json (label)'], ['text', 'regex rules on the question text']], cfg.routerMode, v => { cfg.routerMode = v; render(); })),
        E('div', { class: 'row' }, ...['single-hop', 'bridge', 'comparison', 'unanswerable'].flatMap(t => [E('label', {}, t + ' → '), mkSel(armOpts, cfg.routes[t], v => { cfg.routes[t] = v; render(); })])),
        E('div', { class: 'row' }, E('label', {}, 'Grader '), mkSel([['score', 'score: best dense cosine >= tau (gold-free)'], ['oracle', 'oracle: all gold present (upper bound, not live)']], cfg.grader, v => { cfg.grader = v; render(); })),
        (() => { const s = slide('tau', 0.3, 0.8, 0.01, cfg.tau, v => { cfg.tau = v; render(); }); return E('div', { class: 'row' }, s, E('label', {}, ' max steps '), mkSel([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], String(cfg.maxSteps), v => { cfg.maxSteps = +v; render(); })); })(),
        E('div', { class: 'row' }, E('button', { onclick: () => { Object.assign(cfg, JSON.parse(JSON.stringify(defaults))); render(); } }, 'reset'),
          E('button', { onclick: () => { cfg.routes = { 'single-hop': 'vector', 'bridge': 'graph', 'comparison': 'graph', 'unanswerable': 'vector' }; render(); } }, 'break it: graph for multi-hop'),
          E('button', { onclick: () => { cfg.grader = 'oracle'; render(); } }, 'oracle grader')));
      out.push(ctl);

      /* verdict */
      const d = ev.routed - ev.bestFixedTop5Recall;
      const verdict = E('div', { class: 'box' },
        E('div', {}, 'Mean recall@' + cfg.k + ' over ' + ev.n_answerable + ' answerable questions. Fixed arms: ' + ARM_IDS.map(a => ARMS[a].label + ' ' + f2(ev.arms[a])).join(' | ') + '. V+G = Vector+graph RRF; Lex+V = lexical+vector; Concat = dense top-5 then PPR extras.'),
        E('div', { class: 'result num' }, 'routed ' + f2(ev.routed)),
        E('div', {}, 'Best fixed arm (top-' + cfg.k + ' only): ' + ARMS[ev.bestFixedTop5].label + ' ' + f2(ev.bestFixedTop5Recall) + '. Routing minus best fixed: ',
          E('b', { class: d > 0.0001 ? 'good' : 'bad' }, (d >= 0 ? '+' : '') + f2(d)), '. ',
          d > 0.0001 ? 'Routing helps here, but by at most ' + Math.round(d * 20) + ' gold passage(s) out of ' + (ev.rows.filter(r => r.gold.length).reduce((s, r) => s + r.gold.length, 0)) + ': inside the noise of a 20-question set.'
            : 'Routing does NOT help on this small set: no routed choice beats the best single arm.'),
        E('div', {}, 'Routed minus always-Vector (' + f2(ev.arms.vector) + '): ' + (ev.routed - ev.arms.vector >= 0 ? '+' : '') + f2(ev.routed - ev.arms.vector) + '; routed minus always-Graph (' + f2(ev.arms.graph) + '): ' + (ev.routed - ev.arms.graph >= 0 ? '+' : '') + f2(ev.routed - ev.arms.graph) + '. One gold passage in 20 questions = 0.025.'),
        E('div', {}, 'Loop (' + cfg.grader + ' grader, <= ' + cfg.maxSteps + ' steps): recall ' + f2(ev.loop) + ', all gold found for ' + ev.loopAllGold + '/' + ev.n_answerable + ', mean retrieval calls ' + f2(ev.loopCallsMean) + ', correct refusals ' + ev.correctRefusals + '/' + ev.n_unanswerable + ', false refusals ' + ev.falseRefusals + '/' + ev.n_answerable + '.' + (cfg.routerMode === 'text' ? ' Text-rule router type accuracy (answerable): ' + f2(ev.routerTypeAcc) + '.' : '')));
      out.push(verdict);

      /* per type */
      const tt = E('table', {}, E('thead', {}, E('tr', {}, E('th', {}, 'type (n)'), ...ARM_IDS.map(a => E('th', { title: ARMS[a].long }, SHORT[a])), E('th', {}, 'routed'), E('th', {}, 'loop'))),
        E('tbody', {}, ...Object.entries(ev.byType).map(([t, v]) => {
          const best = Math.max(...ARM_IDS.map(a => v.arms[a]));
          return E('tr', {}, E('td', {}, t.replace('single-hop', 'single').replace('comparison', 'compar.') + ' (' + v.n + ')'), ...ARM_IDS.map(a => E('td', { class: 'num' + (v.arms[a] === best ? ' good' : '') }, f2(v.arms[a]))), E('td', { class: 'num' }, f2(v.routed)), E('td', { class: 'num' }, f2(v.loop)));
        })));
      out.push(E('h4', {}, 'Recall@' + cfg.k + ' per question type (best arm in green)'), E('div', {}, tt));

      /* per question */
      const th = ['q', 'type', 'route', 'V', 'G', 'H', 'L', 'C', 'routed', 'loop'];
      const tq = E('table', {}, E('thead', {}, E('tr', {}, ...th.map(x => E('th', {}, x)))),
        E('tbody', {}, ...ev.rows.map(r => {
          const n = r.gold.length;
          const tr = E('tr', { 'data-q': r.id, class: r.id === sel ? 'sel' : '', tabindex: '0' },
            E('td', { class: 'num' }, r.id), E('td', {}, r.type[0] + (cfg.routerMode === 'text' && r.route.predicted !== r.type ? '→' + r.route.predicted[0] : '')), E('td', { title: ARMS[r.route.arm].label }, SHORT[r.route.arm]),
            ...ARM_IDS.map(a => E('td', { class: 'chips' }, chip(r.per[a].found, n))), E('td', { class: 'chips' }, chip(r.routed.found, n)),
            E('td', { class: 'chips' }, r.loop.refused ? E('span', { class: n ? 'none' : 'full' }, 'refuse') : chip(r.loopFound, n)));
          const pick = () => { sel = r.id; render(); }; tr.addEventListener('click', pick); tr.addEventListener('keydown', e => { if (e.key === 'Enter') pick(); });
          return tr;
        })));
      out.push(E('h4', {}, 'Every question: gold passages found in the top-' + cfg.k + ' (V vector, G graph, H vector+graph RRF, L lexical+vector, C concat; click a row)'), E('div', {}, tq),
        E('p', { class: 'hint' }, 'Cell = gold passages found / gold passages. "-" = no gold (unanswerable). Green = all found, amber = some, red = none.'));

      /* detail */
      const r = ev.rows.find(x => x.id === sel), q = pack.questions.find(x => x.id === sel);
      const det = E('div', { class: 'box' }, E('div', {}, E('b', {}, r.id + ' (' + r.type + '): '), q.question),
        E('div', { class: 'hint' }, 'gold passages: ' + (r.gold.join(', ') || 'none (unanswerable)') + ' | gold answer: ' + q.gold_answer + ' | linked entities: ' + ((pack.linking.questions[r.id].linked || []).map(x => x.name).join(', ') || 'none')),
        E('div', {}, E('b', {}, 'Router: '), (cfg.routerMode === 'text' ? 'text rules read the question as "' + r.route.predicted + '"' : 'label from the data: "' + r.type + '"') + ' → ' + ARMS[r.route.arm].label + ' (' + ARMS[r.route.arm].long + ')'),
        ...ARM_IDS.map(a => E('div', { style: 'margin:3px 0' }, E('span', { class: 'num', style: 'display:inline-block;min-width:8.5em;color:var(--muted)' }, ARMS[a].label), ...pids(r.per[a].list, r.gold))));
      out.push(E('h4', {}, 'Selected question: the real top-' + cfg.k + ' of each path'), det);

      /* loop replay */
      const lp = r.loop;
      out.push(E('h4', {}, 'Correct-and-retry loop on ' + r.id + ' (replay of stored runs, not a live agent)'),
        E('div', { class: 'box' }, ...lp.steps.map((s, i) => E('div', { style: 'margin:4px 0' },
          E('b', {}, 'Step ' + (i + 1) + '. '), 'retrieve with ' + ARMS[s.arm].label + ' → ', ...pids(s.list, r.gold), E('br', {}),
          'grade: ', E('span', { class: 'num' }, cfg.grader === 'score' ? 'best cosine ' + f2(s.grade.value) + ' vs tau ' + cfg.tau : 'gold coverage ' + f2(s.grade.value)), ' → ', E('b', { class: s.grade.pass ? 'good' : 'bad' }, s.grade.pass ? 'pass, stop and answer with this context' : (i === lp.steps.length - 1 ? 'fail, out of steps' : 'fail, fall back to the next stored arm')))),
          E('div', {}, E('b', {}, 'Result: '), lp.refused ? (r.gold.length ? 'refuse (false refusal: the question is answerable)' : 'refuse (correct: the question is unanswerable)') : 'context from ' + ARMS[lp.steps[lp.steps.length - 1].arm].label + ' with ' + r.loopFound + '/' + r.gold.length + ' gold passages after ' + lp.calls + ' retrieval call(s)' + (r.gold.length ? '' : ' (wrong: answering an unanswerable question)')),
          E('div', { class: 'hint' }, 'CRAG (Yan et al. 2024) grades with a trained evaluator and falls back to web search; Self-RAG (Asai et al. 2023) emits learned reflection tokens. Here the grader is one number from a stored run and the fallback is another stored arm. The ' + 'topic records cite the papers at abstract level only.')));

      /* tau sweep */
      const sw = sweep(pack, cfg, [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]);
      out.push(E('h4', {}, 'Score grader sweep (current routing, <= ' + cfg.maxSteps + ' steps)'),
        E('table', {}, E('thead', {}, E('tr', {}, ...['tau', 'loop recall', 'false refusals /20', 'correct refusals /4', 'calls'].map(x => E('th', {}, x)))),
          E('tbody', {}, ...sw.map(x => E('tr', { class: x.tau === cfg.tau ? 'sel' : '' }, E('td', { class: 'num' }, String(x.tau)), E('td', { class: 'num' }, f2(x.recall)), E('td', { class: 'num' }, String(x.falseRefusals)), E('td', { class: 'num' }, String(x.correctRefusals)), E('td', { class: 'num' }, f2(x.calls)))))),
        E('p', { class: 'hint' }, 'A higher tau refuses more unanswerable questions and more answerable ones too: the dense top-1 cosine of the unanswerable questions (0.33 to 0.57) overlaps the answerable ones (0.36 to 0.80), so a cosine threshold cannot separate them cleanly. Nothing here was tuned.'));

      /* fusion */
      const fs = { a: cfg.fa || 'dense_cosine', b: cfg.fb || 'ppr_graph', k: cfg.fk || 60 };
      const fd = fuseDetail(pack, sel, fs.a, fs.b, fs.k), fc = fusionCheck(pack), cc = concatCheck(pack, pack.ctxAsm);
      const runOpts = [['dense_cosine', 'vector (dense_cosine)'], ['bm25_lucene', 'BM25 (bm25_lucene)'], ['ppr_graph', 'graph (ppr_graph)']];
      const fsel = (v, on) => mkSel(runOpts, v, x => { on(x); render(); });
      const isStored = fs.k === 60 && ((fs.a === 'dense_cosine' && fs.b === 'bm25_lucene') || (fs.a === 'bm25_lucene' && fs.b === 'dense_cosine'));
      const storedTop = ids(pack.runs.rrf_bm25_dense[sel]).slice(0, 5).join(), mineTop = fd.map(x => x.id).join();
      out.push(E('h4', {}, 'Hybrid fusion: RRF of two stored runs, recomputed (' + sel + ')'),
        E('div', { class: 'box' },
          E('div', { class: 'row' }, E('label', {}, 'list A '), fsel(fs.a, v => { cfg.fa = v; }), E('label', {}, ' list B '), fsel(fs.b, v => { cfg.fb = v; }), slide('k', 1, 120, 1, fs.k, v => { cfg.fk = v; render(); })),
          E('div', { class: 'formula' }, 'RRF(d) = 1/(k + rank_A(d)) + 1/(k + rank_B(d)), a passage missing from a stored top-20 list adds 0'),
          E('table', {}, E('thead', {}, E('tr', {}, ...['fused rank', 'passage', 'rank A', 'rank B', 'RRF score', 'gold'].map(x => E('th', {}, x)))),
            E('tbody', {}, ...fd.map((x, i) => E('tr', {}, E('td', {}, String(i + 1)), E('td', { class: 'num' }, x.id), E('td', { class: 'num' }, x.rankA == null ? '-' : String(x.rankA)), E('td', { class: 'num' }, x.rankB == null ? '-' : String(x.rankB)), E('td', { class: 'num' }, K.fmt(x.score, 6)), E('td', { class: r.gold.includes(x.id) ? 'good' : '' }, r.gold.includes(x.id) ? 'gold' : ''))))),
          E('div', { class: 'hint' }, isStored ? (mineTop === storedTop ? 'Recomputed top-5 equals the stored rrf_bm25_dense top-5 for this question.' : 'Recomputed top-5 differs from the stored rrf_bm25_dense top-5 for this question (the stored run fused the full rankings, we only hold each top-20).') : 'This pair has no stored fused run; recomputed only.'),
          E('div', { class: 'hint' }, 'Check against the stored run, all 24 questions (BM25 + dense, k=60): top-5 identical for ' + fc.sameTop5 + '/' + fc.n + '; for the ' + fc.bothN + ' stored passages present in both top-20 lists the score matches within ' + fc.bothMaxDiff.toExponential(1) + '; the ' + fc.oneN + ' passages present in one list only are short by at most ' + K.fmt(fc.oneMaxDiff, 4) + ' (the missing term 1/(60+rank), rank > 20, is not stored); no recomputed score exceeds the stored one (' + fc.lowerViol + ' violations). Concat rule vs stored context_assembly.json: ' + cc.same + '/' + cc.n + ' identical.')));

      /* GraphRAG local / global search: stored windows, not recomputed */
      const loc = pack.local.questions, gl = pack.glob.questions;
      out.push(E('h4', {}, 'GraphRAG local and global search (stored real runs, not recomputed)'),
        E('div', { class: 'box' },
          E('div', { class: 'hint' }, 'Local search context (3,000 estimated tokens: 20% community reports, 50% passages, 30% entities and relationships), 4 questions chosen before results. No answer was generated in the pack, so only the gold passages in the window can be compared with the vector and vector+graph top-' + cfg.k + '.'),
          E('table', {}, E('thead', {}, E('tr', {}, ...['q', 'gold', 'local window', 'Vec', 'V+G', 'p/e/r'].map(x => E('th', {}, x)))),
            E('tbody', {}, ...loc.map(l => { const rw = ev.rows.find(x => x.id === l.qid); return E('tr', {}, E('td', { class: 'num' }, l.qid), E('td', { class: 'num' }, String(l.gold.length)), E('td', { class: 'num' }, l.gold_in_context.length + '/' + l.gold.length), E('td', { class: 'num' }, rw.per.vector.found + '/' + l.gold.length), E('td', { class: 'num' }, rw.per.hybrid.found + '/' + l.gold.length), E('td', { class: 'num' }, l.text_unit_ids.length + '/' + l.n_entities + '/' + l.n_relationships)); }))),
          E('div', { class: 'hint' }, 'p/e/r = passages / entities / relationships in the window. The window holds 12 to 13 passages against a top-' + cfg.k + ', so it is not a like-for-like comparison; here it finds the same gold passages as plain vector search in all 4 questions.'),
          E('div', {}, E('b', {}, 'Global search ('), gl.map(g => g.id).join(', '), E('b', {}, '): '), 'map-reduce over the community reports. ', ...gl.map(g => E('div', { class: 'hint' }, g.id + ' "' + g.question + '": ' + g.n_map_calls + ' map calls, ' + g.n_points + ' points, ' + g.n_points_kept_for_reduce + ' kept for the reduce. Answer starts: ' + g.reduce_answer.slice(0, 220) + ' ...'))),
          E('div', { class: 'hint' }, 'These two questions are corpus-wide and have no gold passages, so recall cannot score them; the pack stores the answers, not a judgement of them. Real example pending for a head-to-head of local, global and vector on the same question.')));
      body.replaceChildren(...out);
    }
    loadPack().then(p => { pack = p; render(); }).catch(e => { body.textContent = 'cannot load the pack: ' + e; });
  }

  const api = { defaults, compute, mount, ARMS, rrfFuse, ranking, top, predictType, runLoop, grade, evaluate, fusionCheck, concatCheck, fuseDetail, sweep };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['routing_agentic_hybrid'] = api;
})(typeof window !== 'undefined' ? window : this);
