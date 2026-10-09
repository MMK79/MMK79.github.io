/* Answer-entity Hits@k: share of questions whose gold answer node is among the top-k ranked nodes.
   Real mode: Personalized PageRank over the real 662-node graph, answer nodes picked from the gold answer by a printed lexical rule. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { ranks: [1, 1, 1, 4, 12], k: 1 };   /* rank of the first gold answer node per question (null = not ranked) */

  /* PURE: Hits@k = share of questions with an answer node in the top k */
  function compute(inp) {
    const r = inp.ranks; if (!r.length) return 0;
    return r.filter(x => x != null && x <= inp.k).length / r.length;
  }

  /* ---------- real example: PURE helpers ---------- */
  function toks(s) {
    const ws = String(s).toLowerCase().replace(/&/g, ' and ').replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !['the', 'a', 'an'].includes(w));
    return ws.map(w => (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') && w !== 'is' && w !== 'us') ? w.slice(0, -1) : w);
  }
  function spans(t, nodes) {
    const out = [];
    nodes.forEach((n, i) => n.keys.forEach(k => { const L = k.length; if (!L) return; for (let s = 0; s + L <= t.length; s++) { let ok = true; for (let j = 0; j < L; j++) if (t[s + j] !== k[j]) { ok = false; break; } if (ok) out.push({ s, e: s + L, i }); } }));
    return out;
  }
  function prepNodes(graph) { return graph.nodes.map(n => ({ id: n.id, name: n.name, type: n.type, keys: [n.name].concat(n.aliases || []).map(toks) })); }
  /* The rule. Returns null (not an entity-answer question) with a reason, or the answer node indices. */
  function qualify(q, nodes) {
    if (!q.gold_passages.length) return { ok: false, why: 'unanswerable: no gold answer' };
    if (!/\b(who|which)\b/i.test(q.question)) return { ok: false, why: 'not a who/which question: the answer is a sentence, not a node' };
    const person = /\bwho\b|statistician/i.test(q.question);
    const sp = spans(toks(String(q.gold_answer).split(/[;:]/)[0]), nodes);
    const mx = sp.filter(x => !sp.some(y => y.s <= x.s && x.e <= y.e && (y.e - y.s) > (x.e - x.s)));
    const inq = new Set(spans(toks(q.question), nodes).map(x => x.i));
    const A = [...new Set(mx.filter(x => !inq.has(x.i) && ((nodes[x.i].type === 'Person') === person)).map(x => x.i))].sort((a, b) => a - b);
    return A.length ? { ok: true, A, person } : { ok: false, why: 'who/which question, but no gold answer node is in the graph' };
  }
  function buildGraph(g) {
    const idx = {}; g.nodes.forEach((n, i) => { idx[n.id] = i; });
    const sets = g.nodes.map(() => new Set());
    g.edges.forEach(e => { const a = idx[e.source], b = idx[e.target]; if (a !== b) { sets[a].add(b); sets[b].add(a); } });
    return { n: g.nodes.length, idx, nbrs: sets.map(s => Array.from(s)) };
  }
  function pprReal(G, seedIdx, restart) {
    const n = G.n, s = new Float64Array(n); if (!seedIdx.length) return new Float64Array(n);
    seedIdx.forEach(i => { s[i] = 1 / seedIdx.length; });
    let pi = Float64Array.from(s);
    for (let it = 0; it < 1000; it++) {
      const nx = new Float64Array(n); let dang = 0;
      for (let u = 0; u < n; u++) { const d = G.nbrs[u].length; if (!pi[u]) continue; if (!d) { dang += pi[u]; continue; } const sh = pi[u] / d; for (const v of G.nbrs[u]) nx[v] += sh; }
      let l1 = 0; for (let v = 0; v < n; v++) { nx[v] = restart * s[v] + (1 - restart) * (nx[v] + dang * s[v]); l1 += Math.abs(nx[v] - pi[v]); }
      pi = nx; if (l1 < 1e-12) break;
    }
    return pi;
  }
  /* ranking of node indices (best first), optionally without the seeds; ties by index */
  function ranking(pi, seeds, dropSeeds) {
    const sd = new Set(dropSeeds ? seeds : []);
    return Array.from(pi.keys()).filter(i => !sd.has(i)).sort((a, b) => pi[b] - pi[a] || a - b);
  }
  const firstRank = (order, A) => { const s = new Set(A); const i = order.findIndex(x => s.has(x)); return i < 0 ? null : i + 1; };
  const realApi = { toks, prepNodes, qualify, buildGraph, pprReal, ranking, firstRank };

  function mountToy(el) {
    const K = root.DemoKit, st = { ranks: defaults.ranks.slice(), k: defaults.k };
    const shell = K.shell(el, 'Toy example (break it)', 'Five invented questions. Each shows the rank at which its first correct answer node appears in the system\'s list. Change the ranks and the k slider; Hits@k counts the questions whose rank is at most k.');
    const kS = K.slider('k', 1, 10, 1, st.k, v => { st.k = v; render(); });
    const row = K.el('div', { class: 'row' }), res = K.resultBox(), fo = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const set = (r, k) => { st.ranks = r.slice(); if (k) { st.k = k; kS.set(k); } render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults.ranks, 1)),
      btn('Break it: right answer is always 2nd', () => set([2, 2, 2, 2, 2], 1)), btn('Same ranks, k = 3', () => set([2, 2, 2, 2, 2], 3)),
      btn('Break it: answer not in the list', () => set([null, null, null, null, null], 10)));
    shell.append(presets, kS.node, row, res.node, fo, note);
    function render() {
      row.replaceChildren(...st.ranks.map((r, i) => {
        const sel = K.el('select', { 'aria-label': 'rank of the answer for question ' + (i + 1) }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(v => K.el('option', { value: String(v) }, v === 12 ? 'rank 12 (>10)' : 'rank ' + v)), K.el('option', { value: 'none' }, 'not listed'));
        sel.value = r == null ? 'none' : String(r);
        sel.addEventListener('change', () => { st.ranks[i] = sel.value === 'none' ? null : +sel.value; render(); });
        const hit = r != null && r <= st.k;
        return K.el('label', { style: 'border:1px solid ' + (hit ? 'var(--he)' : 'var(--warn)') + ';border-radius:6px;padding:2px 6px' }, 'Q' + (i + 1) + ' ', sel, hit ? ' hit' : ' miss');
      }));
      const h = st.ranks.filter(r => r != null && r <= st.k).length, v = compute(st);
      res.set(v);
      fo.textContent = `Hits@${st.k} = ${h} / ${st.ranks.length} = ${K.fmt(v)}`;
      note.textContent = st.ranks.every(r => r === 2) ? (st.k === 1 ? 'Every answer is second, so Hits@1 = 0 although the system is almost right. Raise k to 2 or 3 and it jumps to 1.' : 'With k = ' + st.k + ' the same ranks score ' + K.fmt(v) + ': Hits@k depends strongly on k.') : '';
    }
    render();
  }

  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realP = Promise.all(['graph/graph.json', 'graph/ppr.json', 'data/questions.json', 'graph/entity_linking.json'].map(get).concat([fetch(new URL('data/kgqa_answers.real.json', SCRIPT_SRC || location.href).href).then(r => { if (!r.ok) throw new Error('kgqa_answers ' + r.status); return r.json(); })])).then(([graph, ppr, qs, el, v2]) => ({ graph, ppr, qs, el, v2 })).catch(e => { realP = null; throw e; });
    return realP;
  }

  function mountReal(box, D) {
    const K = root.DemoKit, nodes = prepNodes(D.graph), G = buildGraph(D.graph), STORED = D.ppr.restart;
    const st = { k: 3, drop: true, alpha: STORED, q: null, rule: 'v2' };
    const info = qualified => qualified;
    const V1 = D.qs.map(q => ({ q, r: qualify(q, nodes) }));
    const V2 = D.qs.map(q => { const row = D.v2.rows.find(r => r.qid === q.id); return { q, r: !row ? { ok: false, why: 'unanswerable: no gold answer' } : row.final.length ? { ok: true, A: row.final_ids.map(id => G.idx[id]) } : { ok: false, why: 'no candidate node is the answer (' + (row.candidates.length ? 'LLM dropped ' + row.candidates.join(', ') : 'no node in the gold answer') + ')' } }; });
    let Q = V2, QUAL = Q.filter(x => x.r.ok); st.q = QUAL[0].q.id;
    const sw = r => { st.rule = r; Q = r === 'v1' ? V1 : V2; QUAL = Q.filter(x => x.r.ok); if (!QUAL.some(x => x.q.id === st.q)) st.q = QUAL[0].q.id; fillQ(); render(); };
    const shell = K.shell(box, 'Real example: Hits@k of Personalized PageRank on the real graph',
      `Scale: a ${G.n}-node graph extracted by a language model from 138 Wikipedia passages, ${D.qs.length} helper-written questions (20 answerable), one run, PPR ranking. MEASURED: the rank of the first answer node in a live Personalized PageRank. PROXY: which node is "the answer". Rule v1 (lexical, who/which questions only) finds ${V1.filter(x => x.r.ok).length} questions. Rule v2 (new, 2026-10-09) takes every lexical node of the gold answer as a candidate and lets an LLM (${D.v2.model}) keep those that are the thing asked for; we re-read all ${D.v2.n_answerable} picks and changed ${D.v2.n_overridden}. v2 finds ${V2.filter(x => x.r.ok).length} questions, so one question moves Hits@k by about 0.08. The other ${D.v2.n_answerable - V2.filter(x => x.r.ok).length} answerable questions have a sentence as answer, no node, so Hits@k does not apply. A demo, not a benchmark.`);
    const ruleSel = K.el('select', { 'aria-label': 'answer-node rule', style: 'width:100%;max-width:100%;box-sizing:border-box' }, K.el('option', { value: 'v2' }, 'Answer-node rule v2: lexical candidates + LLM pick (' + V2.filter(x => x.r.ok).length + ' questions)'), K.el('option', { value: 'v1' }, 'Answer-node rule v1: lexical who/which only (' + V1.filter(x => x.r.ok).length + ' questions)'));
    ruleSel.addEventListener('change', () => sw(ruleSel.value));
    const ruleList = K.el('div', { style: 'font-size:12px;overflow-wrap:anywhere' });
    const fillQ = () => { ruleList.replaceChildren(...Q.map(x => K.el('div', {}, K.el('b', { class: x.r.ok ? 'good' : '' }, x.q.id + (x.r.ok ? ' qualifies: ' + x.r.A.map(i => nodes[i].name).join(', ') : ' excluded: ' + x.r.why)), ' ' + x.q.question.slice(0, 70) + (x.q.question.length > 70 ? '...' : '')))); qSel.replaceChildren(...QUAL.map(x => K.el('option', { value: x.q.id }, x.q.id + ': ' + x.q.question))); qSel.value = st.q; };
    const rule = K.el('details', {}, K.el('summary', {}, 'The answer-node rules and which questions qualify (v1 text first, then v2)'),
      K.el('p', { class: 'hint' }, 'A question is an entity-answer question if it has gold passages and contains the word "who" or "which". Its answer nodes A* are the graph nodes (by name or alias, lower-cased, plural s dropped) whose name occurs in the first clause of the gold answer (up to ";" or ":"), keeping only the longest match, dropping nodes already named in the question, and keeping Person nodes for "who"/"statistician" questions and non-Person nodes otherwise. Weakness: it is a word match, so a node can be picked that is not truly the answer (q05 also picks "hinge loss") and a list answer (q16) has 7 answer nodes.'),
      K.el('p', { class: 'hint' }, 'Rule v2: for every answerable question the candidates are the graph nodes (name or alias, same normalisation) whose name occurs in the WHOLE gold answer, longest match only, minus nodes named in the question, any type. The LLM labeller then received this instruction (verbatim): ' + D.v2.prompt),
      ruleList);
    const kS = K.slider('k', 1, 20, 1, st.k, v => { st.k = v; render(); });
    const aS = K.slider('restart alpha', 0.05, 0.95, 0.05, st.alpha, v => { st.alpha = v; render(); });
    const dropB = K.el('button', { type: 'button', 'aria-pressed': 'true' }, 'seed nodes removed from the ranking (they are in the question)');
    dropB.addEventListener('click', () => { st.drop = !st.drop; render(); });
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, ...QUAL.map(x => K.el('option', { value: x.q.id }, x.q.id + ': ' + x.q.question)));
    const head = K.el('div', { class: 'row', 'aria-live': 'polite' }), res = K.resultBox(), listBox = K.el('div'), fo = K.el('div', { class: 'formula', style: 'overflow-wrap:anywhere' }), tbl = K.el('div'), note = K.el('p', { class: 'hint' });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    fillQ();
    const pre = K.el('div', { class: 'row' },
      K.el('button', { type: 'button', onclick: () => { st.drop = false; render(); } }, 'Break it: keep the seeds in the ranking'),
      K.el('button', { type: 'button', onclick: () => { st.drop = true; st.alpha = STORED; aS.set(STORED); st.k = 3; kS.set(3); render(); } }, 'Reset (k = 3, alpha ' + STORED + ')'));
    shell.append(ruleSel, rule, pre, K.el('div', { class: 'row' }, kS.node, aS.node, dropB), K.el('div', { class: 'row' }, qSel), head, listBox, res.node, fo, note, tbl);

    const cache = {};
    function perQ(x) {
      const key = x.q.id + '|' + st.alpha;
      if (!cache[key]) { const seeds = D.ppr.questions[x.q.id].seeds.map(s => G.idx[s.id]); const pi = pprReal(G, seeds, st.alpha); cache[key] = { seeds, pi }; }
      const c = cache[key], order = ranking(c.pi, c.seeds, st.drop);
      return { seeds: c.seeds, pi: c.pi, order, rank: firstRank(order, x.r.A) };
    }
    function render() {
      dropB.setAttribute('aria-pressed', String(st.drop));
      const rows = QUAL.map(x => ({ x, p: perQ(x) }));
      const sel = rows.find(r => r.x.q.id === st.q), p = sel.p, A = sel.x.r.A;
      const hits = k => rows.filter(r => r.p.rank != null && r.p.rank <= k).length;
      head.replaceChildren(K.el('span', {}, 'gold answer: ', K.el('b', {}, sel.x.q.gold_answer)), K.el('span', { class: 'hint' }, 'answer node(s) A*: ' + A.map(i => nodes[i].name).join(', ') + ' | seeds: ' + p.seeds.map(i => nodes[i].name).join(', ')));
      const mx = p.pi[p.order[0]] || 1e-9, topN = Math.max(st.k, 10);
      listBox.replaceChildren(...p.order.slice(0, topN).map((i, j) => {
        const isA = A.includes(i), inK = j < st.k;
        return K.el('div', { style: `display:grid;grid-template-columns:34px minmax(90px,38%) 1fr 56px;gap:6px;align-items:center;font-size:12px;opacity:${inK ? 1 : 0.5}` },
          K.el('span', { class: 'num' }, '#' + (j + 1)), K.el('span', { class: isA ? 'good' : '', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:' + (isA ? 700 : 400), title: nodes[i].name + ' (' + nodes[i].type + ')' }, (isA ? '[answer] ' : '') + nodes[i].name),
          K.el('div', { style: `height:10px;border-radius:3px;background:${isA ? 'var(--he)' : 'var(--k12)'};width:${Math.max(1, 100 * p.pi[i] / mx)}%` }), K.el('span', { class: 'num' }, K.fmt(p.pi[i], 4)));
      }));
      const hk = hits(st.k); res.set(hk / rows.length);
      fo.textContent = `question ${st.q}: first answer node at rank ${p.rank == null ? 'none' : p.rank}  ->  hit@${st.k} = ${p.rank != null && p.rank <= st.k ? 1 : 0}\nHits@${st.k} = ${hk} / ${rows.length} = ${K.fmt(hk / rows.length)}\nHits@1 = ${K.fmt(hits(1) / rows.length)}, Hits@3 = ${K.fmt(hits(3) / rows.length)}, Hits@10 = ${K.fmt(hits(10) / rows.length)}   (${st.drop ? 'seeds removed' : 'seeds kept'}, alpha ${st.alpha})`;
      note.textContent = !st.drop ? 'Seeds kept: the nodes linked from the question hold the restart mass and fill the top ranks, so the true answer is pushed down. The question already names them, so they cannot be the answer.'
        : 'Most "who" questions miss: the person node (Hoerl, Kennard, Tibshirani) sits many hops from the entities named in the question, far outside the top 10. Move k to 10 and see which questions are still missed.';
      const t = K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['q', 'answer node(s)', 'rank', '@1', '@3', '@10'].map(h => K.el('th', {}, h))),
        ...rows.map(r => K.el('tr', { style: r.x.q.id === st.q ? 'background:rgba(242,169,59,.10)' : '' }, K.el('td', {}, r.x.q.id), K.el('td', { style: 'overflow-wrap:anywhere' }, r.x.r.A.map(i => nodes[i].name).join(', ')), K.el('td', { class: 'num' }, r.p.rank == null ? '-' : String(r.p.rank)),
          ...[1, 3, 10].map(k => K.el('td', { class: 'num' }, r.p.rank != null && r.p.rank <= k ? '1' : '0')))));
      tbl.replaceChildren(K.el('p', { class: 'hint', style: 'margin:10px 0 4px' }, `All ${rows.length} entity-answer questions (live PPR, alpha ${st.alpha}; for the other ${D.qs.length - rows.length} questions the metric does not apply):`), t);
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data (662-node graph)...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, realApi };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['kgqa_hits_at_k'] = api;
})(this);
