/* Query decomposition: split a multi-part question into sub-questions, answer/retrieve each, compose.
   Default mode = real example (real LLM sub-questions + real dense retrieval, from Presentations/_real-examples).
   Toy mode = editable hop trace over a 3-sentence knowledge base + error propagation ("break it"). */
(function (root) {
  const defaults = {
    question: "When was the birthplace of the director of 'Harbor Lights' first documented?",
    kb: [
      { key: "Who directed the film 'Harbor Lights'?", text: 'Harbor Lights was directed by Mara Voss.' },
      { key: 'Where was Mara Voss born?', text: 'Mara Voss was born in Tallin.' },
      { key: 'When was Tallin founded?', text: 'Records first mention the city of Tallin in 1219.' },
    ],
    /* sub-question templates: {1} = answer of hop 1, {2} = answer of hop 2. ans = the "LLM" intermediate answer (editable table) */
    subs: [
      { q: "Who directed the film 'Harbor Lights'?", ans: 'Mara Voss' },
      { q: 'Where was {1} born?', ans: 'Tallin' },
      { q: 'When was {2} founded?', ans: '1219' },
    ],
    gapBoth: 60, gapComposedRight: 36, hopAcc: 0.9,
  };
  const STOP = new Set(['the', 'of', 'in', 'was', 'by', 'a', 'when', 'who', 'where', 'is', 'to']);
  const tok = t => new Set((String(t).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)));
  const overlap = (a, b) => { const B = tok(b); let n = 0; tok(a).forEach(w => { if (B.has(w)) n++; }); return n; };
  const r3 = x => Math.round(x * 1e3) / 1e3;
  const subst = (tpl, answers) => tpl.replace(/\{(\d+)\}/g, (m, i) => answers[+i - 1] !== undefined ? answers[+i - 1] : m);
  /* best word overlap; on a tie prefer a sentence no earlier hop used (so each hop reaches the sentence it needs) */
  const bestOf = (q, kb, used = []) => { let bi = -1, bv = -1; kb.forEach((s, i) => { const v = overlap(q, s.text); if (v > bv || (v === bv && used.includes(bi) && !used.includes(i))) { bv = v; bi = i; } }); return bi; };

  /* PURE. Hop trace: each hop substitutes earlier answers, retrieves the best sentence (word overlap, our simplification), checks the LLM answer is in it. */
  function trace(inp) {
    const answers = [], hops = [], used = [];
    inp.subs.forEach((s, i) => {
      const q = subst(s.q, answers), bi = bestOf(q, inp.kb, used), text = bi >= 0 ? inp.kb[bi].text : '';
      const score = bi >= 0 ? overlap(q, text) : 0;
      hops.push({ q, retrieved: bi, text, score, ans: s.ans, supported: score > 0 && text.toLowerCase().includes(String(s.ans).toLowerCase()) });
      answers.push(s.ans); used.push(bi);
    });
    return hops;
  }
  /* PURE. Returns exactly worked_example.result's keys (plus extras the demo uses). */
  function compute(inp) {
    const oc = {}; inp.kb.forEach(s => { oc[s.key] = overlap(inp.question, s.text); });
    const best = inp.kb[bestOf(inp.question, inp.kb)];
    const hops = trace(inp), m = inp.subs.length;
    const gap = inp.gapBoth ? (inp.gapBoth - inp.gapComposedRight) / inp.gapBoth : 0;
    return {
      hops: m, final_answer: inp.subs[m - 1].ans, single_retrieval_hit: best.key, toy_gap: r3(gap), overlap_counts: oc,
      hop_supported: hops.map(h => h.supported), chain_prob: r3(Math.pow(inp.hopAcc, m)),
    };
  }

  /* ---- real example ---- */
  const fuse = (lists, k) => {
    const score = {}, order = [];
    lists.forEach(l => l.forEach((d, i) => { if (!(d in score)) { score[d] = 0; order.push(d); } score[d] += 1 / (k + i + 1); }));
    const ranking = order.map((d, i) => [d, i]).sort((a, b) => score[b[0]] - score[a[0]] || a[1] - b[1]).map(x => x[0]);
    return { score, ranking };
  };
  const ids = l => l.map(x => x.id);
  /* PURE: one stored decomposition item -> the facts the demo shows (gold hits in top-5 of each list). */
  function realFacts(item, k, withOriginal) {
    const gold = item.gold, orig = ids(item.retrieval_original), subs = item.retrieval_per_subquestion.map(ids);
    const lists = (withOriginal ? [orig] : []).concat(subs), f = fuse(lists, k);
    const hit = l => gold.filter(g => l.slice(0, 5).includes(g));
    const union = [...new Set(subs.flat())];
    return { gold, lists, fused: f.ranking, score: f.score, hitOriginal: hit(orig), hitFused: hit(f.ranking), hitUnion: gold.filter(g => union.includes(g)), hitStored: hit(ids(item.fused_top5)) };
  }

  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  function loadPack() {
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    return Promise.all([get('data/query_transforms.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')]).then(([t, c, mt]) => ({
      items: t.items.filter(i => i.technique === 'decomposition'), models: t.models,
      text: Object.fromEntries((Array.isArray(c) ? c : (c.passages || Object.values(c))).map(p => [p.id, p.text || ''])),
      metrics: { m: mt.methods.decomp_rrf, base: mt.subset_baselines.decomp_rrf, qids: mt.scored_qids.decomp_rrf, per: mt.per_question.decomp_rrf },
    }));
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': () => clone(defaults),
    'break it: hop 1 answered wrong': () => { const d = clone(defaults); d.subs[0].ans = 'Ian Roe'; d.subs[1].ans = 'Bergen'; d.subs[2].ans = '1050'; return d; },
    'break it: drop the middle hop': () => { const d = clone(defaults); d.subs = [d.subs[0], { q: 'When was {1} born and where is that first documented?', ans: '1219' }]; return d; },
  };
  const LIST_COLORS = ['var(--k12)', 'var(--both)', 'var(--both)', 'var(--both)'];

  function mount(el) {
    const K = DemoKit;
    let st = clone(defaults);
    const shell = K.shell(el, 'Query decomposition',
      'A model splits a multi-part question into sub-questions; each one is answered or retrieved on its own, and the answers are composed. Real example first, then a toy you can break.');
    const modeRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const mReal = K.el('button', {}, 'Real example'), mToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(mReal, mToy);
    const realBox = K.el('div', {}, K.el('p', { class: 'hint' }, 'Loading the real run...')), toyBox = K.el('div', {});
    shell.append(modeRow, realBox, toyBox);
    function setMode(m) {
      const real = m === 'real'; realBox.style.display = real ? '' : 'none'; toyBox.style.display = real ? 'none' : '';
      mReal.setAttribute('aria-pressed', String(real)); mToy.setAttribute('aria-pressed', String(!real));
    }
    mReal.addEventListener('click', () => setMode('real')); mToy.addEventListener('click', () => setMode('toy'));

    /* ----- toy ----- */
    const inStyle = 'width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:12px var(--mono)';
    const qLine = K.el('div', { style: 'font-size:13px' });
    const hopsBox = K.el('div', {}), ctl = K.el('div', {}), out = K.el('div', { 'aria-live': 'polite' }), form = K.el('div', { class: 'formula' });
    const kbBox = K.el('details', {}, K.el('summary', { style: 'cursor:pointer;color:var(--muted);font-size:13px' }, 'knowledge base (editable, 3 sentences)'));
    const subIn = [], ansIn = [];
    st.subs.forEach((s, i) => {
      const a = K.el('input', { type: 'text', value: s.q, 'aria-label': 'sub-question ' + (i + 1), style: inStyle });
      const b = K.el('input', { type: 'text', value: s.ans, 'aria-label': 'model answer ' + (i + 1), style: inStyle });
      a.addEventListener('input', () => { st.subs[i].q = a.value; renderToy(); }); b.addEventListener('input', () => { st.subs[i].ans = b.value; renderToy(); });
      subIn.push(a); ansIn.push(b);
    });
    const kbIn = st.kb.map((s, i) => { const x = K.el('input', { type: 'text', value: s.text, 'aria-label': 'sentence ' + (i + 1), style: inStyle }); x.addEventListener('input', () => { st.kb[i].text = x.value; renderToy(); }); kbBox.append(K.el('div', { style: 'margin:3px 0' }, x)); return x; });
    const pS = K.slider('accuracy per hop', 0.5, 1, 0.01, st.hopAcc, v => { st.hopAcc = v; renderToy(); });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n);
      b.addEventListener('click', () => {
        st = PRESETS[n](); pS.set(st.hopAcc);
        rebuildRows(); renderToy();
      }); return b; }));
    const rows = K.el('div', {});
    function rebuildRows() {
      rows.replaceChildren(...st.subs.map((s, i) => {
        subIn[i] = subIn[i] || K.el('input', { type: 'text', style: inStyle }); ansIn[i] = ansIn[i] || K.el('input', { type: 'text', style: inStyle });
        subIn[i].value = s.q; ansIn[i].value = s.ans;
        subIn[i].oninput = () => { st.subs[i].q = subIn[i].value; renderToy(); }; ansIn[i].oninput = () => { st.subs[i].ans = ansIn[i].value; renderToy(); };
        subIn[i].setAttribute('aria-label', 'sub-question ' + (i + 1)); ansIn[i].setAttribute('aria-label', 'model answer ' + (i + 1));
        return K.el('div', { style: 'display:grid;grid-template-columns:1fr 130px;gap:6px;margin:3px 0' }, K.el('label', {}, `hop ${i + 1} sub-question ({n} = earlier answer)`, subIn[i]), K.el('label', {}, 'model answer', ansIn[i]));
      }));
    }
    toyBox.append(presets, qLine, rows, kbBox, K.el('div', { class: 'row' }, pS.node), hopsBox, out, form,
      K.el('p', { class: 'hint' }, 'Toy data is invented and no model ran: the "answers" are the editable table, retrieval is word overlap. Try "hop 1 answered wrong": hop 2 is built from the wrong name, so the rest of the chain has nothing real to stand on.'));
    function renderToy() {
      const hops = trace(st), res = compute(st);
      qLine.replaceChildren(K.el('b', {}, 'question: '), st.question);
      hopsBox.replaceChildren(...hops.map((h, i) => K.el('div', { style: `border-left:3px solid ${h.supported ? 'var(--he)' : 'var(--warn)'};padding:2px 8px;margin:4px 0;font-size:13px` },
        K.el('div', { class: 'num' }, `hop ${i + 1}: ${h.q}`),
        K.el('div', { style: 'color:var(--muted)' }, h.score ? `retrieved (overlap ${h.score}): "${h.text}"` : 'retrieved: nothing matches (overlap 0)'),
        K.el('b', { class: h.supported ? 'good' : 'bad' }, `answer: ${h.ans} ` + (h.supported ? '(supported by the retrieved sentence)' : '(NOT supported by anything retrieved)')))));
      const ok = res.hop_supported.every(Boolean);
      out.replaceChildren(K.el('div', { class: 'result' }, res.final_answer),
        K.el('b', { class: ok ? 'good' : 'bad' }, ok ? 'every hop is supported: the chain holds' : 'at least one hop is unsupported: the final answer is not trustworthy'));
      form.textContent =
        `single retrieval with the whole question: best sentence = "${res.single_retrieval_hit}"  (overlap counts ${JSON.stringify(res.overlap_counts)})\n` +
        `chain: P(all ${res.hops} hops right) = ${K.fmt(st.hopAcc, 2)}^${res.hops} = ${K.fmt(res.chain_prob, 3)}   (assumes independent hops; our assumption)\n` +
        `compositionality gap (invented counts, 60 of 100 questions have all sub-answers right, 36 of those composed right): (60 - 36) / 60 = ${K.fmt(res.toy_gap, 2)}\n` +
        'real values from Press et al. 2022: 42.9% (ChatGPT), 23.0% (GPT-4, maybe contaminated).';
    }
    rebuildRows(); renderToy();

    /* ----- real ----- */
    if (!PACK) { realBox.replaceChildren(K.el('p', { class: 'hint' }, 'Real example needs the script loaded from a page (no document.currentScript); showing the toy.')); setMode('toy'); return; }
    setMode('real');
    loadPack().then(pack => {
      realBox.replaceChildren();
      let cur = pack.items[0], withOrig = true, k = 60;
      const sel = K.el('select', { 'aria-label': 'question' }, ...pack.items.map((it, i) => K.el('option', { value: i }, `${it.qid}: ${it.question.length > 70 ? it.question.slice(0, 68) + '...' : it.question}`)));
      const oc = K.el('button', { 'aria-pressed': 'true' }, 'include the original question as a list');
      const rk = K.slider('k', 0, 120, 1, 60, v => { k = v; draw(); });
      const qline = K.el('div', { style: 'font-size:13px' }), gen = K.el('div', { class: 'formula' }), lists = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }), verdict = K.el('div', { 'aria-live': 'polite' }), cmp = K.el('div', { class: 'formula' });
      realBox.append(K.el('div', { class: 'row' }, sel, oc), K.el('div', { class: 'row' }, rk.node), qline, gen, lists, verdict, cmp);
      const M = pack.metrics, f3 = x => K.fmt(x, 3);
      realBox.append(K.el('div', { class: 'formula' }, `honest result on these ${M.qids.length} questions (${M.qids.join(', ')}), same questions, three methods\n` +
        `  recall@5   decomposition + original (RRF) ${f3(M.m['recall@5'])}   dense ${f3(M.base.dense_cosine['recall@5'])}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense['recall@5'])}\n` +
        `  MRR        decomposition + original (RRF) ${f3(M.m.mrr)}   dense ${f3(M.base.dense_cosine.mrr)}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense.mrr)}\n` +
        `  nDCG@5     decomposition + original (RRF) ${f3(M.m['ndcg@5'])}   dense ${f3(M.base.dense_cosine['ndcg@5'])}   BM25+dense RRF ${f3(M.base.rrf_bm25_dense['ndcg@5'])}\n` +
        'Decomposition does NOT clearly beat the baselines: recall@5 is one gold passage higher than dense, MRR is lower than both. With 4 questions one question moves a score by 0.1 to 0.25, so this cannot rank the methods.'));
      realBox.append(K.el('p', { class: 'hint' }, `Real run: sub-questions written by ${pack.models.llm} (temperature 0) in ONE call, dense retrieval by ${pack.models.embedder}, 138 Wikipedia passages; demo scale, 4 bridge/comparison questions, not an evaluation. Gold labels cover only the passages judged necessary. Important: these sub-questions are NOT answered one after another. "this technique" in a later sub-question is never replaced by the earlier answer, which is why the sequential chain of the toy is only half of what ran. Lists are the stored top 5; the stored fusion used full lists.`));
      sel.addEventListener('change', () => { cur = pack.items[+sel.value]; draw(); });
      oc.addEventListener('click', () => { withOrig = !withOrig; oc.setAttribute('aria-pressed', String(withOrig)); draw(); });
      function draw() {
        const f = realFacts(cur, k, withOrig), gold = new Set(f.gold);
        const names = (withOrig ? ['original question'] : []).concat(cur.generated.map((g, i) => `sub-question ${i + 1}`));
        qline.replaceChildren(K.el('b', {}, 'question: '), cur.question);
        gen.textContent = 'sub-questions written by the model:\n' + cur.generated.map((g, i) => `  q${i + 1}: ${g}`).join('\n') + '\n(hover a passage id to read its text; * = gold passage)';
        lists.replaceChildren(...f.lists.map((l, li) => K.el('div', { style: `flex:1 1 150px;min-width:130px;border-top:3px solid ${LIST_COLORS[li % 4]};padding-top:4px` },
          K.el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:2px' }, names[li]),
          ...l.slice(0, 5).map((d, i) => K.el('div', { class: 'num', title: pack.text[d] || '', style: `font-size:12px;${gold.has(d) ? 'color:var(--he);font-weight:600' : ''}` }, `${i + 1}. ${d}${gold.has(d) ? ' *' : ''}`)))));
        const n = f.gold.length, sh = a => `${a.length} of ${n}` + (a.length ? ' (' + a.join(', ') + ')' : '');
        verdict.replaceChildren(
          K.el('div', {}, K.el('span', {}, 'fused top 5 here (RRF, k = ' + k + '): '), K.el('b', {}, f.fused.slice(0, 5).map(d => d + (gold.has(d) ? '*' : '')).join(' > '))),
          K.el('b', { class: f.hitFused.length > f.hitOriginal.length ? 'good' : f.hitFused.length < f.hitOriginal.length ? 'bad' : '' },
            `gold passages in the top 5: original alone ${sh(f.hitOriginal)}; fused ${sh(f.hitFused)}; found by some sub-question ${sh(f.hitUnion)}`));
        cmp.textContent = 'stored run (full top-20 lists, k = 60, original included), gold in its top 5: ' + sh(f.hitStored) +
          '\nA sub-question can find a gold passage that fusion then buries under passages the other lists agree on (q13, q14).';
      }
      draw();
    }).catch(e => { realBox.replaceChildren(K.el('p', { class: 'bad' }, 'Could not load the real run (' + e.message + '). Use the toy tab.')); setMode('toy'); });
  }

  const api = { defaults, compute, mount, trace, realFacts };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['decomposition'] = api;
})(this);
