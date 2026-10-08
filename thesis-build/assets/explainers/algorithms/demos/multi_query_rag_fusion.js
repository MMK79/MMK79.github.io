/* Multi-query + RAG-Fusion: an LLM writes rewrites of the question, each rewrite retrieves a ranked list, RRF merges the lists.
   Default mode = real example (real LLM rewrites, real dense retrieval, from Presentations/_real-examples). Toy mode = editable lists + "break it". */
(function (root) {
  const defaults = {
    lists: [['d1', 'd2', 'd3', 'd4'], ['d2', 'd5', 'd1', 'd6'], ['d5', 'd2', 'd7', 'd3'], ['d8', 'd2', 'd5', 'd1']],
    k: 60, kAlt: 1, relevant: ['d2', 'd5', 'd8'], top: 4,
  };
  const LIST_NAMES = ['q0 (original)', 'q1 (rewrite 1)', 'q2 (rewrite 2)', 'q3 (rewrite 3)'];
  const LIST_COLORS = ['var(--k12)', 'var(--he)', 'var(--both)', 'var(--warn)'];
  /* round half to even, like Python's round(): 1/64 = 0.015625 is an exact tie and the entry (made in Python) prints 0.01562 */
  const rh = (x, n) => { const m = x * n, f = Math.floor(m), d = m - f; return (d > 0.5 || (d === 0.5 && f % 2 === 1) ? f + 1 : f) / n; };
  const r5 = x => rh(x, 1e5), r3 = x => Math.round(x * 1e3) / 1e3;

  /* PURE. RRF over any number of ranked lists: score(d) = sum over lists containing d of 1/(k + rank). Ties keep first-seen order. */
  function fuse(lists, k) {
    const score = {}, parts = {}, order = [];
    lists.forEach((l, li) => l.forEach((d, i) => {
      if (!(d in score)) { score[d] = 0; parts[d] = lists.map(() => 0); order.push(d); }
      const v = 1 / (k + i + 1); score[d] += v; parts[d][li] = v;
    }));
    const ranking = order.map((d, i) => [d, i]).sort((a, b) => score[b[0]] - score[a[0]] || a[1] - b[1]).map(x => x[0]);
    return { score, parts, ranking };
  }
  const recallAt = (ranked, rel, n) => rel.length ? ranked.slice(0, n).filter(d => rel.includes(d)).length / rel.length : 0;

  /* PURE. Returns exactly worked_example.result's keys (plus extras the demo uses). */
  function compute(inp) {
    const a = fuse(inp.lists, inp.k), b = fuse(inp.lists, inp.kAlt);
    const sc = {}; Object.keys(a.score).sort().forEach(d => { sc[d] = r5(a.score[d]); });
    return {
      fused_ranking_k60: a.ranking, fused_ranking_k1: b.ranking, scores_k60: sc,
      recall_original_top4: r3(recallAt(inp.lists[0], inp.relevant, inp.top)),
      recall_fused_top4: r3(recallAt(a.ranking, inp.relevant, inp.top)),
    };
  }

  /* ---- real example: pack at Presentations/_real-examples (fetched relative to this script) ---- */
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  /* PURE: one stored item of data/query_transforms.json (technique 'multiquery') -> lists (original first, then the rewrites). Top-5 only. */
  function realInput(item, withOriginal) {
    const ids = l => l.map(x => x.id);
    const lists = (withOriginal ? [ids(item.retrieval_original)] : []).concat(item.retrieval_per_variant.map(ids));
    return { lists, k: 60, kAlt: 1, relevant: item.gold.slice(), top: 5 };
  }
  function loadPack() {
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    return Promise.all([get('data/query_transforms.json'), get('runs/multiquery_rrf.json'), get('runs/dense_cosine.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')])
      .then(([t, m, d, c, mt]) => ({
        metrics: { mq: mt.methods.multiquery_rrf, base: mt.subset_baselines.multiquery_rrf, n: (mt.scored_qids.multiquery_rrf || []).length },
        items: t.items.filter(i => i.technique === 'multiquery'), models: t.models,
        stored: Object.fromEntries(m.questions.map(x => [x.qid, x.ranking.map(y => y.id)])),
        dense: Object.fromEntries(d.questions.map(x => [x.qid, x.ranking.map(y => y.id)])),
        text: Object.fromEntries((Array.isArray(c) ? c : (c.passages || Object.values(c))).map(p => [p.id, p.text || ''])),
      }));
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example (k = 60)': () => clone(defaults),
    'k = 1: first places dominate': () => ({ ...clone(defaults), k: 1 }),
    'break it: all rewrites drift to one wrong topic': () => ({ ...clone(defaults), lists: [defaults.lists[0], ['d9', 'd10', 'd11', 'd12'], ['d9', 'd10', 'd12', 'd11'], ['d9', 'd11', 'd10', 'd12']] }),
  };

  function mount(el) {
    const K = DemoKit;
    let st = clone(defaults);
    const shell = K.shell(el, 'Multi-query and RAG-Fusion',
      'A language model writes several rewrites of the question; each rewrite retrieves its own ranked list; reciprocal rank fusion adds one vote 1/(k + rank) per list for each document. Real example first, then a toy you can break.');
    const modeRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const mReal = K.el('button', {}, 'Real example'), mToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(mReal, mToy);
    const realBox = K.el('div', {}, K.el('p', { class: 'hint' }, 'Loading the real run...')), toyBox = K.el('div', {});
    shell.append(modeRow, realBox, toyBox);
    function setMode(m) {
      const real = m === 'real'; realBox.style.display = real ? '' : 'none'; toyBox.style.display = real ? 'none' : '';
      mReal.setAttribute('aria-pressed', String(real)); mToy.setAttribute('aria-pressed', String(!real));
      mReal.style.outline = real ? '2px solid var(--ai)' : ''; mToy.style.outline = real ? '' : '2px solid var(--ai)';
    }
    mReal.addEventListener('click', () => setMode('real')); mToy.addEventListener('click', () => setMode('toy'));

    /* shared renderer: lists as chip columns, stacked bars of per-list votes, verdict, substituted formula */
    function view(box) {
      const lists = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' });
      const bars = K.el('div', {}), verdict = K.el('div', { class: 'row', 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' });
      box.append(lists, verdict, bars, formula);
      return {
        lists, set(inp, o) {
          o = o || {};
          const names = o.names || LIST_NAMES, gold = new Set(inp.relevant), f = fuse(inp.lists, inp.k), f1 = fuse(inp.lists, inp.kAlt);
          lists.replaceChildren(...inp.lists.map((l, li) => K.el('div', { style: `flex:1 1 150px;min-width:130px;border-top:3px solid ${LIST_COLORS[li % 4]};padding-top:4px` },
            K.el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:2px' }, names[li] || 'list ' + li),
            ...l.map((d, i) => K.el('div', { class: 'num', title: (o.text && o.text[d]) || '', style: `font-size:12px;${gold.has(d) ? 'color:var(--he);font-weight:600' : ''}` }, `${i + 1}. ${d}${gold.has(d) ? ' *' : ''}`)))));
          const mx = Math.max(...Object.values(f.score), 1e-9), top = inp.top;
          bars.replaceChildren(...f.ranking.slice(0, Math.max(top + 3, 8)).map((d, i) => K.el('div', { style: `display:flex;align-items:center;gap:8px;margin:2px 0;${i < top ? '' : 'opacity:.55'}` },
            K.el('span', { class: 'num', style: `width:42px;font-weight:600;${gold.has(d) ? 'color:var(--he)' : ''}` }, d),
            K.el('div', { style: 'display:flex;height:12px;width:68%' }, ...f.parts[d].map((v, li) => K.el('div', { style: `background:${LIST_COLORS[li % 4]};width:${(v / mx * 100).toFixed(2)}%` }))),
            K.el('span', { class: 'num', style: 'color:var(--muted);font-size:12px' }, K.fmt(f.score[d], 5)))));
          const rO = recallAt(inp.lists[0], inp.relevant, top), rF = recallAt(f.ranking, inp.relevant, top);
          const col = rF > rO ? 'good' : rF < rO ? 'bad' : '';
          verdict.replaceChildren(
            K.el('span', {}, `fused top ${top}: `, K.el('b', {}, f.ranking.slice(0, top).join(' > ')), `   (k = 1: ${f1.ranking.slice(0, top).join(' > ')})`),
            K.el('b', { class: col }, `recall@${top}: original list ${K.fmt(rO, 3)}, fused ${K.fmt(rF, 3)}` + (rF > rO ? ' (fusion helped)' : rF < rO ? ' (fusion hurt)' : ' (no change)')));
          const w = f.ranking[0], parts = f.parts[w].map((v, li) => v ? `1/(${K.fmt(inp.k, 3)}+${Math.round(1 / v - inp.k)})` : null).filter(Boolean);
          formula.textContent = `winner ${w}: RRF = ${parts.join(' + ')} = ${K.fmt(f.score[w], 5)}\n` +
            `bars: one colour per list; a document in many lists stacks many votes. Documents marked * are the gold (relevant) ones.\n` + (o.note || '');
        },
      };
    }

    /* ----- toy ----- */
    const tv = view(toyBox);
    const ta = inp => { /* editable lists: one comma-separated text input per list */ };
    const edit = K.el('div', { class: 'row', style: 'flex-direction:column;align-items:stretch' });
    const mkIn = (li) => {
      const inp = K.el('input', { type: 'text', value: st.lists[li].join(', '), 'aria-label': 'ranked list of ' + LIST_NAMES[li], style: 'width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:12px var(--mono)' });
      inp.addEventListener('input', () => { st.lists[li] = inp.value.split(',').map(s => s.trim()).filter(Boolean); renderToy(); });
      return K.el('label', { style: `border-left:3px solid ${LIST_COLORS[li]};padding-left:6px` }, LIST_NAMES[li] + ' (best first) ', inp);
    };
    const inputs = [0, 1, 2, 3].map(mkIn); edit.append(...inputs);
    const relIn = K.el('input', { type: 'text', value: st.relevant.join(', '), 'aria-label': 'relevant documents', style: 'width:140px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:12px var(--mono)' });
    relIn.addEventListener('input', () => { st.relevant = relIn.value.split(',').map(s => s.trim()).filter(Boolean); renderToy(); });
    const kS = K.slider('k', 0, 120, 1, st.k, v => { st.k = v; renderToy(); });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n); b.addEventListener('click', () => { st = PRESETS[n](); kS.set(st.k); inputs.forEach((lab, li) => { lab.lastChild.value = st.lists[li].join(', '); }); renderToy(); }); return b; }));
    toyBox.prepend(presets, edit, K.el('div', { class: 'row' }, kS.node, K.el('label', {}, 'relevant: ', relIn)));
    toyBox.append(K.el('p', { class: 'hint' }, 'Toy data is invented (no model ran). Edit a list or press "break it": when every rewrite drifts to the same wrong documents, their votes outvote the original question.'));
    function renderToy() { st.top = defaults.top; tv.set(st, { note: 'Toy lists are invented; the real-example tab uses real model output.' }); }
    renderToy();

    /* ----- real ----- */
    if (!PACK) { realBox.replaceChildren(K.el('p', { class: 'hint' }, 'Real example needs the script loaded from a page (no document.currentScript); showing the toy.')); setMode('toy'); return; }
    setMode('real');
    loadPack().then(pack => {
      realBox.replaceChildren();
      let cur = pack.items[0], withOrig = true, k = 60;
      const sel = K.el('select', { 'aria-label': 'question' }, ...pack.items.map((it, i) => K.el('option', { value: i }, `${it.qid}: ${it.question.length > 70 ? it.question.slice(0, 68) + '...' : it.question}`)));
      const oc = K.el('button', { 'aria-pressed': 'true' }, 'include the original question as a list');
      const rk = K.slider('k', 0, 120, 1, 60, v => { k = v; draw(); });
      const qline = K.el('div', { style: 'font-size:13px' }), gen = K.el('div', { class: 'formula' }), cmp = K.el('div', { class: 'formula' });
      const rv = view(realBox);
      realBox.prepend(K.el('div', { class: 'row' }, sel, oc), K.el('div', { class: 'row' }, rk.node), qline, gen);
      realBox.append(cmp, K.el('p', { class: 'hint' }, `Real run: rewrites by ${pack.models.llm} (temperature 0), dense retrieval by ${pack.models.embedder}, 138 Wikipedia passages; demo scale, 6 questions, not an evaluation. Gold labels cover only the passages judged necessary. Lists here are the stored top 5 per query, so the fusion below is over top-5 lists; the stored run (below) used the full lists.`));
      const M = pack.metrics, f3 = x => K.fmt(x, 3);
      realBox.append(K.el('div', { class: 'formula' }, `honest result on these ${M.n} questions (same questions, three methods)\n` +
        `  recall@5   multi-query RRF ${f3(M.mq['recall@5'])}   dense ${f3(M.base.dense_cosine['recall@5'])}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense['recall@5'])}\n` +
        `  MRR        multi-query RRF ${f3(M.mq.mrr)}   dense ${f3(M.base.dense_cosine.mrr)}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense.mrr)}\n` +
        `  nDCG@5     multi-query RRF ${f3(M.mq['ndcg@5'])}   dense ${f3(M.base.dense_cosine['ndcg@5'])}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense['ndcg@5'])}\n` +
        'Multi-query ties or loses here: with 6 questions one question moves a score by 0.1 or more, so this cannot rank the methods. Teaching point: more rewrites do not guarantee gains.'));
      sel.addEventListener('change', () => { cur = pack.items[+sel.value]; draw(); });
      oc.addEventListener('click', () => { withOrig = !withOrig; oc.setAttribute('aria-pressed', String(withOrig)); draw(); });
      function draw() {
        const inp = realInput(cur, withOrig); inp.k = k;
        const names = (withOrig ? ['q0 (original)'] : []).concat(cur.generated.map((g, i) => `q${i + 1} (rewrite ${i + 1})`));
        qline.replaceChildren(K.el('b', {}, 'question: '), cur.question);
        gen.textContent = 'rewrites written by the model:\n' + cur.generated.map((g, i) => `  q${i + 1}: ${g}`).join('\n') + '\n(hover a passage id to read its text)';
        rv.set(inp, { names, text: pack.text, note: 'Passage ids p001... are from the real-example corpus.' });
        const st5 = pack.stored[cur.qid], dn = pack.dense[cur.qid], gold = cur.gold;
        const pos = (arr, d) => arr.indexOf(d) < 0 ? 'outside top 20' : '#' + (arr.indexOf(d) + 1);
        cmp.textContent = 'gold passage ranks, single dense search vs stored multi-query fusion (full top-20 lists, k = 60):\n' +
          gold.map(g => `  ${g}: ${pos(dn, g)} -> ${pos(st5, g)}`).join('\n');
      }
      draw();
    }).catch(e => { realBox.replaceChildren(K.el('p', { class: 'bad' }, 'Could not load the real run (' + e.message + '). Use the toy tab.')); setMode('toy'); });
  }

  const api = { defaults, compute, mount, fuse, realInput };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['multi_query_rag_fusion'] = api;
})(this);
