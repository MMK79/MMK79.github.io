/* End to end GraphRAG: follow ONE real question through link -> expand -> PPR -> reports -> assemble -> generate -> cache/trace.
   Real example mode reads Presentations/_real-examples (demo scale, 138 passages, NOT the thesis system). 2D (SVG-free tables): the graph itself has its own demos (k_hop, personalized_pagerank).
   compute() = gold recall of dense top-nv + graph top-ng passages (concatenation, vector first). */
(function (root) {
  const defaults = { gold: ['p015', 'p006'], vector: ['p068', 'p006', 'p002', 'p047', 'p075'], graph: ['p015', 'p005', 'p013', 'p006', 'p012'], nv: 5, ng: 5 };
  const STAGES = ['1 Link', '2 Expand', '3 PPR rank', '4 Reports', '5 Assemble', '6 Generate', '7 Cache / trace'];
  const TOY = { gold: ['g1', 'g2'], vector: ['g1', 'x1', 'x2', 'x3', 'x4', 'x5'], graph: ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'], nv: 5, ng: 5 };

  function compute(inp) {
    const V = inp.vector.slice(0, inp.nv), G = inp.graph.slice(0, inp.ng);
    const C = V.concat(G.filter(x => !V.includes(x)));
    const rec = L => inp.gold.filter(g => L.includes(g)).length / inp.gold.length;
    return { recall_vector_top5: rec(V), recall_graph_top5: rec(G), recall_concat: rec(C), n_context: C.length };
  }

  function mount(el) {
    const K = DemoKit;
    const SRC = (document.currentScript && document.currentScript.src) || (Array.from(document.scripts).map(s => s.src).find(s => /end_to_end_graphrag\.js/.test(s)) || '');
    const base = SRC ? new URL('../../_real-examples/', SRC).href : '';
    const shell = K.shell(el, 'One question through the GraphRAG pipeline',
      'Default: a real question from the demo pack (662-node graph over 138 passages; not the thesis system). Pick q10 (the graph adds a passage), q09 (it loses one) or q13 (the second passage is never reached). Stages with no real run say "pending real data". The Production Stack page tells the same flow with the problem and fix of every step.');
    let mode = 'real', D = null, qid = 'q10', stage = 0, inp = JSON.parse(JSON.stringify(defaults));
    const modeRow = K.el('div', { class: 'row' }), qRow = K.el('div', { class: 'row' }), stRow = K.el('div', { class: 'row' }),
      qbox = K.el('div', { class: 'hint' }), panel = K.el('div', {}), calc = K.el('div', {});
    shell.append(modeRow, qRow, qbox, stRow, panel, calc);
    const bReal = K.el('button', {}, 'Real example'), bToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(bReal, bToy);
    const sel = K.el('select', { 'aria-label': 'question' }); qRow.append(K.el('label', {}, 'question '), sel);
    bReal.addEventListener('click', () => { mode = 'real'; loadQ(); draw(); });
    bToy.addEventListener('click', () => { mode = 'toy'; inp = JSON.parse(JSON.stringify(TOY)); draw(); });
    sel.addEventListener('change', () => { qid = sel.value; stage = 0; loadQ(); draw(); });

    const pend = t => K.el('p', { class: 'bad' }, 'pending real data. ' + t);
    const by = (arr, k = 'qid') => Object.fromEntries(arr.map(x => [x[k], x]));
    const rk = (ids, id) => { const i = ids.indexOf(id); return i < 0 ? 'not in top 20' : '#' + (i + 1); };
    const words = id => D && D.corpus[id] ? D.corpus[id].text.split(/\s+/).length : 0;
    function loadQ() {
      if (!D) return; const q = D.q[qid];
      inp = { gold: q.gold_passages, vector: D.dense[qid].slice(0, 10), graph: D.ppr[qid].slice(0, 10), nv: 5, ng: 5 };
    }
    const ptable = (ids, gold, n) => {
      const t = K.el('table', { style: 'font-size:12px' }); t.append(K.el('tr', {}, ...['#', 'id', '', 'text'].map(h => K.el('th', {}, h))));
      ids.slice(0, n).forEach((id, i) => { const g = gold.includes(id), p = D.corpus[id];
        t.append(K.el('tr', {}, K.el('td', { class: 'num' }, i + 1), K.el('td', { class: 'num' }, id), K.el('td', { class: g ? 'good' : '' }, g ? 'GOLD' : ''),
          K.el('td', { style: 'font-size:12px;color:var(--muted)' }, p ? (p.article + ': ' + p.text).slice(0, 130) : ''))); });
      return K.el('div', { style: 'overflow-x:auto' }, t);
    };

    function stagePanel() {
      if (mode === 'toy') return K.el('p', { class: 'hint' }, 'Toy mode: the graph top list holds no gold passage (invented ids). Concatenation then adds only words: recall stays 0.5 while the context grows. Slide the two counts below.');
      if (!D) return K.el('p', { class: 'bad' }, 'Loading the real example pack (needs the Presentations folder served)...');
      const q = D.q[qid], el_ = D.link[qid], kh = D.khop[qid], ca = D.ca[qid], pp = D.pprd[qid], n = [];
      if (stage === 0) {
        n.push(K.el('p', {}, K.el('b', {}, 'Link. '), 'The question is matched to graph nodes (string match, then embedding cosine at least 0.55). Real output:'));
        if (!el_ || el_.miss) n.push(K.el('p', { class: 'bad' }, 'Miss: no node linked, so the graph arm has no seed.'));
        else n.push(K.el('p', { class: 'num' }, el_.linked.map(l => l.name + ' (' + l.method + ', ' + K.fmt(l.score, 2) + ')').join('  |  ')));
        if (el_) n.push(K.el('p', { class: 'hint' }, el_.linked.length + ' seed(s); seeds attached to gold: ' + (el_.seeds_attached_to_gold || []).length + '. Linking is noisy: generic nodes make broad seeds, one seed is a thin start.'));
      } else if (stage === 1) {
        n.push(K.el('p', {}, K.el('b', {}, 'Expand. '), 'Undirected k-hop walk from the seeds. Gold passages reached per hop:'));
        const t = K.el('table', { style: 'font-size:12px' }); t.append(K.el('tr', {}, ...['hop', 'nodes', 'passages', 'share of corpus', 'gold reached'].map(h => K.el('th', {}, h))));
        kh.steps.forEach(s => t.append(K.el('tr', {}, K.el('td', { class: 'num' }, s.hop), K.el('td', { class: 'num' }, s.cumulative_nodes), K.el('td', { class: 'num' }, s.cumulative_passages),
          K.el('td', { class: 'num' }, K.fmt(s.share_of_corpus * 100, 1) + '%'), K.el('td', { class: s.all_gold ? 'good' : 'bad' }, s.gold_found.join(', ') + ' (' + s.gold_found.length + '/' + q.gold_passages.length + ')'))));
        n.push(K.el('div', { style: 'overflow-x:auto' }, t));
        const last = kh.steps[kh.steps.length - 1];
        if (!last.all_gold) n.push(K.el('p', { class: 'bad' }, 'Never reaches all gold passages within 3 hops: no ranking rule can fix this question.'));
      } else if (stage === 2) {
        n.push(K.el('p', {}, K.el('b', {}, 'PPR rank. '), 'Personalized PageRank (restart 0.5) from the seeds; a passage scores the sum of the PPR scores of its nodes. Gold: ',
          K.el('span', { class: 'num' }, q.gold_passages.map(g => g + ' graph ' + rk(D.pprAll[qid], g) + ' / dense ' + rk(D.denseAll[qid], g)).join('   '))));
        n.push(ptable(D.pprAll[qid], q.gold_passages, 8));
        if (pp && pp.top_nodes) n.push(K.el('p', { class: 'hint num' }, 'top nodes: ' + pp.top_nodes.slice(0, 4).map(x => x.name + ' ' + K.fmt(x.score, 3)).join(', ')));
        n.push(K.el('p', { class: 'hint' }, 'Over 20 questions PPR alone is worse than dense: recall@5 0.775 and MRR 0.756 vs 0.85 and 0.917.'));
      } else if (stage === 3) {
        n.push(K.el('p', {}, K.el('b', {}, 'Reports. '), 'Leiden found 57 communities; an LLM wrote a report for the 15 largest. Local search puts 5 of them into a 3000-token window.'));
        const ls = D.local[qid];
        if (!ls) {
          n.push(pend('Local search was run only for q09, q12, q16 and q18, so no window was built for ' + qid + '. What exists for it (real, from the Leiden partition):'));
          const seeds = (el_ && el_.linked) || [];
          if (!seeds.length) n.push(K.el('p', { class: 'hint' }, 'No seed, so no community to look up.'));
          seeds.forEach(l => { const pc = D.comm.partition.find(p => p.nodes.includes(l.node)), rep = pc && D.comm.reports.find(r => r.id === pc.id);
            n.push(K.el('p', { class: 'num' }, l.name + ' -> community ' + (pc ? pc.id + ' (' + pc.size + ' nodes) ' : 'none ') + (rep ? 'has a report: "' + rep.title + '"' : (pc ? 'no report (not among the 15 largest)' : '')))); });
          n.push(K.el('p', { class: 'hint' }, 'Reports were written for these communities, but no run put them into a context window or an answer for ' + qid + '.'));
        }
        else n.push(K.el('p', { class: 'num' }, 'window: ' + ls.n_community_reports + ' reports, ' + ls.text_unit_ids.length + ' passages, ' + ls.n_entities + ' entities; gold in window: ' + (ls.gold_in_context.join(', ') || 'none') + ' of ' + ls.gold.join(', ')));
        n.push(K.el('p', { class: 'hint' }, 'Local and global search imitate Microsoft GraphRAG (Edge et al. 2024); they are not its code.'));
      } else if (stage === 4) {
        const v = compute(inp);
        n.push(K.el('p', {}, K.el('b', {}, 'Assemble. '), 'Dense top-', K.el('b', {}, inp.nv), ' first, then the graph top-', K.el('b', {}, inp.ng), ' not already in it (HybridRAG order). Change the counts below.'));
        const C = inp.vector.slice(0, inp.nv); inp.graph.slice(0, inp.ng).forEach(x => { if (!C.includes(x)) C.push(x); });
        n.push(ptable(C, q.gold_passages, 12));
        const w = C.reduce((a, i) => a + words(i), 0), wv = inp.vector.slice(0, inp.nv).reduce((a, i) => a + words(i), 0);
        n.push(K.el('p', { class: 'num' }, 'context: ' + C.length + ' passages, ' + w + ' words (dense alone ' + wv + ' words, +' + (wv ? Math.round((w / wv - 1) * 100) : 0) + '%)'));
        n.push(K.el('p', { class: 'hint' }, 'Over 20 questions: recall 0.85 -> 0.875 at about 45% more context (one gold passage in one question, q10).'));
      } else if (stage === 5) {
        n.push(K.el('p', {}, K.el('b', {}, 'Generate. '), 'Real answers (qwen3.7-plus, temperature 0) with arm A no retrieval, B hybrid RRF top 5, C dense + graph. n = 12 questions, LLM judges.'));
        const rows = ['A', 'B', 'C'].map(a => D.ans[qid + a]);
        if (!rows[0]) n.push(pend('Answers were generated for 12 of the 24 questions; ' + qid + ' is not among them.'));
        else rows.forEach(r => n.push(K.el('div', { style: 'border-top:1px solid var(--line);padding:6px 0' }, K.el('div', { class: 'num', style: 'font-size:12px;color:var(--muted)' },
          'arm ' + r.arm + ' | ' + r.context_ids.length + ' passages | ' + r.prompt_tokens + ' prompt tokens | USD ' + r.usd.toFixed(6) + ' | ' + r.latency_s + ' s' + (r.refused ? ' | refused' : '') + ' | faithfulness ' + K.fmt(D.pq[qid + r.arm].faithfulness_A, 2) + ' | correctness ' + D.pq[qid + r.arm].correctness),
          K.el('div', { style: 'font-size:13px' }, r.answer))));
        n.push(K.el('p', { class: 'hint' }, 'C has about 40% more context than B and a different first-stage list, so B versus C does not isolate the graph. Means over 12: faithfulness A 0.47, B 0.94, C 0.97; USD per answer 0.00011, 0.00026, 0.00034; about 3.7 s each.'));
      } else {
        n.push(K.el('p', {}, K.el('b', {}, 'Cache / trace. '), 'Graph extraction is cached by chunk hash, community reports are written once at index time, and the trace gets spans for linking, traversal and pruning.'));
        n.push(pend('No cache run and no trace exist for this pack. The 3.7 s above is one remote call, not a pipeline latency. Index cost is real: USD 0.0273 extraction + 0.0085 reports for 138 passages.'));
      }
      return K.el('div', {}, ...n);
    }

    let resultBox = K.resultBox(), nvS, ngS;
    function draw() {
      bReal.setAttribute('aria-pressed', mode === 'real'); bToy.setAttribute('aria-pressed', mode === 'toy');
      qRow.style.display = mode === 'real' ? '' : 'none';
      qbox.textContent = mode === 'real' && D ? D.q[qid].type + ': ' + D.q[qid].question + '  Gold: ' + D.q[qid].gold_passages.join(', ') : '';
      stRow.replaceChildren(...STAGES.map((s, i) => { const b = K.el('button', { 'aria-pressed': String(stage === i), class: stage === i ? 'on' : '' }, s); b.addEventListener('click', () => { stage = i; draw(); }); return b; }));
      panel.replaceChildren(stagePanel());
      calc.replaceChildren();
      nvS = K.slider('dense passages taken', 0, 10, 1, inp.nv, v => { inp.nv = v; upd(); });
      ngS = K.slider('graph passages taken', 0, 10, 1, inp.ng, v => { inp.ng = v; upd(); });
      calc.append(K.el('div', { class: 'row' }, nvS.node, ngS.node), K.el('div', { class: 'row num', id: 'g-out' }), K.el('div', { class: 'formula', id: 'g-f' }));
      upd(true);
    }
    function upd(skipPanel) {
      const r = compute(inp);
      calc.querySelector('#g-out').textContent = 'gold recall: dense ' + K.fmt(r.recall_vector_top5, 3) + ' | graph ' + K.fmt(r.recall_graph_top5, 3) + ' | concatenated ' + K.fmt(r.recall_concat, 3) + ' | passages in context ' + r.n_context;
      calc.querySelector('#g-f').textContent = 'recall_C = |gold in C| / |gold| = ' + K.fmt(r.recall_concat, 3) + '   (C = dense top ' + inp.nv + ' + graph top ' + inp.ng + ' not already in it)';
      if (!skipPanel && mode === 'real' && stage === 4) panel.replaceChildren(stagePanel());
    }

    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    draw();
    Promise.all(['data/questions.json', 'data/corpus.json', 'runs/dense_cosine.json', 'runs/ppr_graph.json', 'graph/entity_linking.json', 'graph/khop.json', 'graph/ppr.json',
      'graph/context_assembly.json', 'graph/local_search.json', 'graph/communities.json', 'answers/answers.json', 'answers/per_question.json'].map(get)).then(([qs, corp, dn, pp, el, kh, ppd, ca, ls, cm, an, pq]) => {
      const rm = r => Object.fromEntries(r.questions.map(x => [x.qid, x.ranking.map(y => y.id)]));
      const answerable = qs.filter(q => q.type !== 'unanswerable');
      D = { q: Object.fromEntries(qs.map(q => [q.id, q])), corpus: Array.isArray(corp) ? Object.fromEntries(corp.map(p => [p.id, p])) : corp, dense: rm(dn), ppr: rm(pp), denseAll: rm(dn), pprAll: rm(pp),
        link: el.questions && !Array.isArray(el.questions) ? el.questions : by(el.questions), khop: by(kh.questions), pprd: ppd.questions && !Array.isArray(ppd.questions) ? ppd.questions : by(ppd.questions),
        ca: by(ca.questions), comm: cm, local: by(ls.questions), ans: Object.fromEntries(an.map(a => [a.qid + a.arm, a])), pq: Object.fromEntries(pq.map(a => [a.qid + a.arm, a])) };
      for (const k in D.local) { const l = D.local[k]; l.n_community_reports = l.n_community_reports || (l.est_tokens_used ? 5 : 0); }
      sel.replaceChildren(...answerable.map(q => K.el('option', { value: q.id }, q.id + ' ' + q.type)));
      sel.value = qid; if (mode === 'real') { loadQ(); draw(); }
    }).catch(e => { panel.replaceChildren(K.el('p', { class: 'bad' }, 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder (python3 -m http.server) or use the toy preset.')); });
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['end_to_end_graphrag'] = api;
})(this);
