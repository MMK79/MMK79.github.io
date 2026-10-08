/* Step-back prompting for retrieval. Default view: real run (4 questions, real LLM step-back questions, dense MiniLM). Second view: toy word-overlap example you can edit and break. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    passages: {
      P1: 'Estella Leopold education history: BS 1948 University of Wisconsin, MS Botany 1950 University of California Berkeley, PhD Botany 1955 Yale University.',
      P2: 'Estella Leopold was a paleobotanist and conservationist, daughter of Aldo Leopold, active in the Wilderness Society.',
      P3: 'University of California Berkeley campus history: the botany department moved in 1954 and 1955 to a new building.',
      P4: 'Yale University graduate school admits: PhD programs in Botany run five years.',
      P5: 'Timeline of the Leopold family: births, marriages and homes 1887 to 1972.',
    },
    q: 'Estella Leopold went to which school between Aug 1954 and Nov 1954?',
    stepBack: "What was Estella Leopold's education history?",
    gold: 'P1',
  };
  const STOP = new Set('a an the of to in and or was is what which for from went between at she her s'.split(' '));
  const tok = t => (String(t).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
  const counts = ws => { const c = new Map(); ws.forEach(w => c.set(w, (c.get(w) || 0) + 1)); return c; };
  function cos(a, b) {
    const ca = counts(tok(a)), cb = counts(tok(b)); let n = 0, na = 0, nb = 0;
    ca.forEach((v, w) => { n += v * (cb.get(w) || 0); na += v * v; }); cb.forEach(v => { nb += v * v; });
    return na && nb ? n / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }
  const r3 = x => Math.round(x * 1000) / 1000;
  const rank = s => Object.keys(s).sort((a, b) => s[b] - s[a]);       // stable: ties keep insertion order

  /* PURE. Toy retriever: cosine of word-count vectors. Returns ranking and scores for the question and for the step-back question. */
  function compute(inp) {
    const ids = Object.keys(inp.passages), s0 = {}, s1 = {};
    ids.forEach(k => { s0[k] = cos(inp.q, inp.passages[k]); s1[k] = cos(inp.stepBack, inp.passages[k]); });
    const o = rank(s0), b = rank(s1), g = inp.gold || 'P1';
    const rd = s => Object.fromEntries(ids.map(k => [k, r3(s[k])]));
    return { rank_original: o, rank_step_back: b, scores_original: rd(s0), scores_step_back: rd(s1), p1_rank_original: 1 + ids.filter(k => s0[k] > s0[g] + 1e-12).length, p1_rank_step_back: 1 + ids.filter(k => s1[k] > s1[g] + 1e-12).length };
  }

  /* PURE. Real run: ranks of the gold passages in three stored top-20 lists (null = not in the top 20). */
  function computeReal(inp) {
    const at = (L, g) => { const i = L.indexOf(g); return i < 0 ? null : i + 1; };
    const out = { gold: inp.gold, original: inp.gold.map(g => at(inp.orig, g)), step_back: inp.gold.map(g => at(inp.step, g)), fused: inp.gold.map(g => at(inp.fused, g)) };
    const best = a => a.reduce((m, x) => x === null ? m : (m === null || x < m ? x : m), null);
    const b0 = best(out.original), b1 = best(out.step_back), b2 = best(out.fused);
    const cmp = (x, y) => (x === null && y === null) ? 'same' : x === null ? 'better' : y === null ? 'worse' : y < x ? 'better' : y > x ? 'worse' : 'same';
    out.best = { original: b0, step_back: b1, fused: b2 }; out.verdict_step_back = cmp(b0, b1); out.verdict_fused = cmp(b0, b2);
    return out;
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: step back goes the wrong way': Object.assign(clone(defaults), { stepBack: 'Tell me about the Leopold family timeline' }),
  };

  function mountReal(box) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('data/query_transforms.json'), get('runs/dense_cosine.json'), get('runs/stepback_dense.json'), get('runs/stepback_rrf.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')]).then(([qt, dc, sd, sr, corpus, mm]) => {
      const items = qt.items.filter(i => i.technique === 'stepback');
      const rk = run => Object.fromEntries(run.questions.map(q => [q.qid, q.ranking]));
      const D = rk(dc), S = rk(sd), F = rk(sr);
      const passages = Array.isArray(corpus) ? corpus : (corpus.passages || []);
      const text = id => { const p = passages.find(x => x.id === id); return p ? p.text : '(text not found)'; };
      body.replaceChildren();
      body.append(K.el('p', { class: 'hint' }, `Real run, demo scale: the language model (${qt.models.llm}, temperature 0) wrote each step-back question. Retrieval = dense cosine with ${qt.models.embedder} over 138 Wikipedia passages. Only these 4 questions were run: this is an illustration, not an evaluation. Gold passages are marked.`));
      const sel = K.el('div', { class: 'row' }), view = K.el('div', {}); body.append(sel, view);
      let cur = 0;
      const col = (title, list, gold, color) => K.el('div', { style: 'flex:1 1 220px;min-width:200px' }, K.el('div', { style: `color:${color};font-weight:600;margin-bottom:4px` }, title),
        ...list.slice(0, 8).map((r, i) => { const g = gold.includes(r.id);
          const b = K.el('button', { class: g ? 'good' : '', style: 'display:flex;justify-content:space-between;width:100%;margin:2px 0;text-align:left', title: 'show the passage text' }, K.el('span', {}, `${i + 1}. ${r.id}${g ? '  (gold)' : ''}`), K.el('span', { class: 'num' }, K.fmt(r.score, 4)));
          b.addEventListener('click', () => { pass.textContent = `${r.id}: ${text(r.id)}`; }); return b; }));
      const pass = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' }, 'click a passage id to read it');
      function draw() {
        const it = items[cur], q = it.qid, gold = it.gold;
        const res = computeReal({ gold, orig: D[q].map(r => r.id), step: S[q].map(r => r.id), fused: F[q].map(r => r.id) });
        const f = a => a.map((x, i) => `${gold[i]}: ${x === null ? '>20' : '#' + x}`).join(', ');
        const word = { better: 'step-back helped', worse: 'step-back hurt', same: 'no change' };
        const cls = v => v === 'better' ? 'good' : v === 'worse' ? 'bad' : '';
        view.replaceChildren(
          K.el('div', { class: 'row' }, K.el('b', { style: 'color:var(--k12)' }, 'question q: '), it.question),
          K.el('div', { class: 'row' }, K.el('b', { style: 'color:var(--ai)' }, "step-back q' (written by the LLM): "), it.generated),
          K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px' },
            col('search with q', D[q], gold, 'var(--k12)'), col("search with q'", S[q], gold, 'var(--ai)'), col("RRF of both (k = 60)", F[q], gold, 'var(--both)')),
          K.el('div', { class: 'row' }, K.el('span', {}, `gold rank (top 20): with q ${f(res.original)} | with q' ${f(res.step_back)} | fused ${f(res.fused)} `)),
          K.el('div', { class: 'row', 'aria-live': 'polite' }, K.el('b', { class: cls(res.verdict_step_back) }, 'q\' alone: ' + word[res.verdict_step_back]), ' ; ', K.el('b', { class: cls(res.verdict_fused) }, 'fused: ' + word[res.verdict_fused]), '  (by the best-placed gold passage)'),
          pass);
      }
      const M = [['dense, original q', mm.subset_baselines.stepback_dense.dense_cosine], ['dense, step-back q\' alone', mm.methods.stepback_dense], ['RRF of q and q\'', mm.methods.stepback_rrf], ['BM25+dense RRF, original q', mm.subset_baselines.stepback_dense.rrf_bm25_dense]];
      const mt = K.el('table', {}, K.el('tr', {}, ...['same 4 questions', 'recall@5', 'MRR', 'nDCG@5'].map(h => K.el('th', {}, h))), ...M.map(([n, m]) => K.el('tr', {}, K.el('td', {}, n), ...[m['recall@5'], m.mrr, m['ndcg@5']].map(v => K.el('td', { class: 'num' }, K.fmt(v, 3))))));
      items.forEach((it, i) => { const b = K.el('button', { 'aria-pressed': String(i === 0) }, it.qid + ' ' + (it.gold.length > 1 ? '(2 gold)' : '(1 gold)'));
        b.addEventListener('click', () => { cur = i; [...sel.children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === i))); draw(); }); sel.append(b); });
      draw();
      body.append(mt);
      body.append(K.el('p', { class: 'hint' }, 'Read it: the step-back question moved a gold passage to rank 1 once (q09). In the other three the general question pulled in passages about the topic and pushed the gold passage down; fusing with the original question kept it near the top. None of the step-back variants beats the plain dense baseline on these 4 questions (recall@5 0.875 vs 0.375 alone, 0.875 fused). Four questions cannot rank techniques; the value here is the real generated question and what it retrieves, failures included.'));
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mountToy(box) {
    const K = DemoKit; let st = clone(defaults);
    box.append(K.el('p', { class: 'hint' }, 'Toy example, ours: five invented passages and a hand-written step-back question (a stand-in for the LLM). The retriever is word overlap (cosine of word counts), not a dense model. Edit any text and watch the answer passage P1 move. Then press "break it".'));
    const row = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); sync(); render(); }); return b; }));
    const q = K.el('input', { type: 'text', 'aria-label': 'original question', style: 'width:100%' });
    const sb = K.el('input', { type: 'text', 'aria-label': 'step-back question', style: 'width:100%' });
    q.addEventListener('input', () => { st.q = q.value; render(); }); sb.addEventListener('input', () => { st.stepBack = sb.value; render(); });
    const out = K.el('div', {}), verdict = K.el('div', { class: 'row', 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' });
    const areas = {};
    const pbox = K.el('details', {}, K.el('summary', {}, 'passages (editable)'), ...Object.keys(st.passages).map(k => { const t = K.el('textarea', { rows: 2, 'aria-label': 'passage ' + k, style: 'width:100%' }); t.addEventListener('input', () => { st.passages[k] = t.value; render(); }); areas[k] = t; return K.el('div', {}, K.el('b', {}, k), t); }));
    box.append(row, K.el('label', {}, 'original question q', q), K.el('label', {}, "step-back question q' (you write it; the LLM would)", sb), pbox, out, verdict, formula);
    const sync = () => { q.value = st.q; sb.value = st.stepBack; Object.keys(areas).forEach(k => { areas[k].value = st.passages[k]; }); };
    const bar = (v, c, hi) => K.el('div', { style: 'background:var(--panel2);border-radius:4px;height:14px;flex:1' }, K.el('div', { style: `width:${Math.min(100, v * 100)}%;height:100%;background:${c};border-radius:4px;opacity:${hi ? 1 : 0.55}` }));
    function render() {
      const res = compute(st); out.replaceChildren();
      Object.keys(st.passages).forEach(k => {
        const g = k === st.gold;
        out.append(K.el('div', { style: 'display:flex;gap:8px;align-items:center;margin:3px 0' },
          K.el('span', { style: `width:90px;color:${g ? 'var(--he)' : 'var(--both)'};font-weight:600` }, k + (g ? ' (answer)' : '')),
          bar(res.scores_original[k], 'var(--k12)', g), K.el('span', { class: 'num', style: 'width:48px' }, K.fmt(res.scores_original[k])),
          bar(res.scores_step_back[k], 'var(--ai)', g), K.el('span', { class: 'num', style: 'width:48px' }, K.fmt(res.scores_step_back[k]))));
      });
      out.prepend(K.el('div', { class: 'hint' }, 'blue bar = score with q, amber bar = score with q\''));
      const a = res.p1_rank_original, b = res.p1_rank_step_back;
      verdict.replaceChildren(K.el('span', {}, `answer passage P1: rank ${a} with q, rank ${b} with q' `), K.el('b', { class: b < a ? 'good' : b > a ? 'bad' : '' }, b < a ? 'step-back helped' : b > a ? 'step-back hurt' : 'no change'), Math.max(...Object.values(res.scores_step_back)) === 0 ? ' (every score is 0: nothing matched, the ranks are ties)' : `; first place with q': ${res.rank_step_back[0]}${res.rank_step_back[0] === st.gold ? '' : ' (not the answer)'}`);
      formula.textContent = `q' = (you wrote it)    C = Retrieve(q')    a = LLM(q | C)\nscore(P) = cosine(word counts of query, word counts of P)\ncontent words of q : ${tok(st.q).join(' ')}\ncontent words of q': ${tok(st.stepBack).join(' ')}\nnothing here checks that q' is a good step back.`;
    }
    sync(); render();
  }

  function mount(el) {
    const K = DemoKit;
    const shell = K.shell(el, 'Step-back prompting: ask a more general question first', 'The language model writes a more general question q\'. You search with q\', then answer the original question q with what you found.');
    const real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', { 'aria-pressed': 'true' }, 'Real example'), b2 = K.el('button', { 'aria-pressed': 'false' }, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    shell.append(K.el('div', { class: 'row' }, b1, b2), real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, computeReal, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['step_back'] = api;
})(this);
