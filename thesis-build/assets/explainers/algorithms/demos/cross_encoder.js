/* Cross-encoder reranker: score each (query, passage) pair jointly, sort by the score; cost = one model pass per pair.
   Real example (default): stored runs of cross-encoder/ms-marco-MiniLM-L-6-v2 over the top 20 of three first stages.
   Toy example: the logits are an editable table standing in for the model (invented numbers). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    cands: [
      { id: 'p1', logit: -2.1, rel: 0 }, { id: 'p2', logit: 0.4, rel: 0 }, { id: 'p3', logit: 2.6, rel: 1 },
      { id: 'p4', logit: -0.7, rel: 0 }, { id: 'p5', logit: 1.1, rel: 1 },
    ],
    M: 1000000, K: 100, nSent: 10000,
  };
  const sig = x => 1 / (1 + Math.exp(-x));
  const r4 = x => Math.round(x * 1e4) / 1e4;
  const rrOf = (order, rel) => { const i = order.findIndex(id => rel.has(id)); return i < 0 ? 0 : 1 / (i + 1); };

  /* PURE. cands are in first-stage order. Score s = sigmoid(logit), rank by s (stable: ties keep first-stage order). */
  function compute(inp) {
    const rel = new Set(inp.cands.filter(c => c.rel).map(c => c.id));
    const s = {}; inp.cands.forEach(c => { s[c.id] = sig(c.logit); });
    const first = inp.cands.map(c => c.id);
    const order = first.map((id, i) => [id, i]).sort((a, b) => (s[b[0]] - s[a[0]]) || (a[1] - b[1])).map(x => x[0]);
    const eps = 1e-12;
    const loss = inp.cands.reduce((a, c) => a - (c.rel ? Math.log(Math.max(s[c.id], eps)) : Math.log(Math.max(1 - s[c.id], eps))), 0);
    const probabilities = {}; first.forEach(id => { probabilities[id] = r4(s[id]); });
    return {
      reranked_order: order, first_stage_order: first, probabilities, toy_loss: r4(loss),
      rr_before: r4(rrOf(first, rel)), rr_after: r4(rrOf(order, rel)),
      passes_all: inp.M, passes_rerank_top100: inp.K, pairs_10000_sentences: inp.nSent * (inp.nSent - 1) / 2,
    };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example': defaults,
    'break it: relevant passage not in the list': {
      cands: [{ id: 'p1', logit: -2.1, rel: 0 }, { id: 'p2', logit: 0.4, rel: 0 }, { id: 'p3', logit: 2.6, rel: 0 }, { id: 'p4', logit: -0.7, rel: 0 }, { id: 'p5', logit: 1.1, rel: 0 }],
      M: 1000000, K: 100, nSent: 10000,
    },
    'break it: model prefers the wrong passage': {
      cands: [{ id: 'p1', logit: 3.0, rel: 0 }, { id: 'p2', logit: 0.4, rel: 0 }, { id: 'p3', logit: 1.0, rel: 1 }, { id: 'p4', logit: -0.7, rel: 0 }, { id: 'p5', logit: -1.1, rel: 0 }],
      M: 1000000, K: 100, nSent: 10000,
    },
  };

  /* shared: cost panel (plain arithmetic) */
  function costPanel(K, st, onChange) {
    const box = K.el('div', { style: 'border-top:1px solid var(--line);padding-top:8px;margin-top:10px' });
    const out = K.el('div', {});
    const sM = K.slider('corpus size M (log10)', 3, 9, 0.5, Math.log10(st.M), v => { st.M = Math.round(Math.pow(10, v)); draw(); });
    const sK = K.slider('rerank depth K', 5, 1000, 5, st.K, v => { st.K = v; draw(); });
    function bar(name, n, color, note) {
      const w = Math.max(2, 100 * Math.log10(n + 1) / 9);
      return K.el('div', { style: 'margin:4px 0' }, K.el('div', { style: `color:${color};font-size:13px` }, `${name}: `, K.el('b', {}, n.toLocaleString('en-US') + ' passes'), note ? ' ' + note : ''),
        K.el('div', { style: `height:10px;width:${w}%;background:${color};border-radius:2px` }));
    }
    function draw() {
      const r = compute(st);
      out.replaceChildren(
        bar('bi-encoder, per query', 1, 'var(--k12)', '(+ nearest-neighbour search; the passages were embedded once, offline)'),
        bar(`cross-encoder on all M = ${r.passes_all.toLocaleString('en-US')}`, r.passes_all, 'var(--warn)', ''),
        bar(`cross-encoder on top K = ${r.passes_rerank_top100}`, r.passes_rerank_top100, 'var(--he)', ''),
        K.el('div', { class: 'hint' }, 'Bar length is log scale (0 to 10^9). Pair counts: all pairs among 10,000 sentences = ' + r.pairs_10000_sentences.toLocaleString('en-US') + ' (n(n-1)/2); Reimers & Gurevych (2019) report about 65 hours for this with BERT. A pass costs different time on different hardware; the pass count is the fair comparison.'));
      if (onChange) onChange();
    }
    box.append(K.el('b', {}, 'Cost of reranking'), K.el('div', { class: 'row' }, sM.node, sK.node), out); draw();
    return box;
  }

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults);
    const shell = K.shell(el, 'Cross-encoder: score each pair, sort by the score',
      'The logit column stands in for the model (invented numbers, no network runs here). Edit a logit or tick "relevant": the sigmoid score, the new order and the reciprocal rank update. Then try the break-it presets.');
    const presetRow = K.el('div', { class: 'row' });
    const tbl = K.el('div', {}), res = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' });
    const costBox = K.el('div', {});
    function build() {
      tbl.replaceChildren(...st.cands.map((c, i) => {
        const lg = K.el('input', { type: 'number', step: '0.1', value: c.logit, 'aria-label': c.id + ' logit', style: 'width:64px' });
        lg.addEventListener('input', () => { const x = parseFloat(lg.value); if (Number.isFinite(x)) { c.logit = x; render(); } });
        const rl = K.el('input', { type: 'checkbox', 'aria-label': c.id + ' relevant' }); rl.checked = !!c.rel;
        rl.addEventListener('change', () => { c.rel = rl.checked ? 1 : 0; render(); });
        const bar = K.el('div', { style: 'height:10px;background:var(--k12);border-radius:2px;width:0%', 'data-bar': i });
        return K.el('div', { class: 'row', style: 'align-items:center;gap:10px' }, K.el('b', { style: 'width:28px' }, c.id), K.el('label', {}, 'logit ', lg), K.el('label', {}, rl, ' relevant'),
          K.el('div', { style: 'flex:1 1 120px;min-width:80px;background:var(--line);border-radius:2px' }, bar), K.el('span', { class: 'num', 'data-s': i }, ''));
      }));
    }
    PRESETS && presetRow.append(...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); build(); render(); }); return b; }));
    shell.append(presetRow, tbl, res, formula, costBox);
    let costNode; 
    function render() {
      const r = compute(st);
      st.cands.forEach((c, i) => {
        const b = tbl.querySelector(`[data-bar="${i}"]`), s = tbl.querySelector(`[data-s="${i}"]`);
        b.style.width = (r.probabilities[c.id] * 100) + '%'; b.style.background = c.rel ? 'var(--he)' : 'var(--k12)';
        const t = 's = ' + K.fmt(r.probabilities[c.id], 4); if (s.textContent !== t) { s.textContent = t; K.flash(s); }
      });
      const anyRel = st.cands.some(c => c.rel);
      res.replaceChildren(K.el('div', {}, 'first-stage order: ', K.el('b', {}, r.first_stage_order.join(' > '))),
        K.el('div', {}, 'after cross-encoder: ', K.el('b', { class: 'good' }, r.reranked_order.join(' > '))),
        K.el('div', {}, 'reciprocal rank (first relevant): ', K.el('b', {}, K.fmt(r.rr_before, 4)), ' to ', K.el('b', { class: r.rr_after >= r.rr_before ? 'good' : 'bad' }, K.fmt(r.rr_after, 4))),
        anyRel ? '' : K.el('div', { class: 'bad' }, 'No relevant passage in this list: the reranker can only reorder what the first stage returned, so RR stays 0.'),
        r.rr_after < r.rr_before ? K.el('div', { class: 'bad' }, 'The model scored a non-relevant passage higher: reranking made the list worse for this query.') : '');
      formula.textContent = 's = 1/(1+e^-logit)    loss L = -sum log s (relevant) - sum log(1-s) (not) = ' + K.fmt(r.toy_loss, 4) + '   (Nogueira & Cho Eq. 1, on these toy pairs)';
    }
    build(); costBox.append(costPanel(K, st)); render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: cross-encoder reranking on Wikipedia passages',
      'Real data, real runs: 138 passages from 15 English Wikipedia articles, 24 questions. The model cross-encoder/ms-marco-MiniLM-L-6-v2 reranked the top 20 of the chosen first stage. Pick a question and a first stage: gold passages are marked, scores are the stored model logits (not computed in this page).');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    const FS = [['bm25_lucene', 'rerank_ce_bm25', 'BM25'], ['dense_cosine', 'rerank_ce_dense', 'dense cosine'], ['rrf_bm25_dense', 'rerank_ce_rrf', 'RRF (BM25 + dense)']];
    Promise.all([get('data/corpus.json'), get('data/questions.json'), get('runs/metrics_by_method.json'), ...FS.flatMap(f => [get(`runs/${f[0]}.json`), get(`runs/${f[1]}.json`)])]).then(([corpus, qs, met, ...runs]) => {
      const P = {}; corpus.forEach(p => { P[p.id] = p; });
      const idx = r => { const m = {}; r.questions.forEach(q => { m[q.qid] = q.ranking; }); return m; };
      const F = FS.map((f, i) => ({ name: f[2], a: idx(runs[2 * i]), b: idx(runs[2 * i + 1]), ka: f[0], kb: f[1] }));
      const sel = K.el('select', { 'aria-label': 'question' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 70)}`)));
      const fsel = K.el('select', { 'aria-label': 'first stage' }, ...F.map((f, i) => K.el('option', { value: i }, f.name)));
      sel.value = 'q02';
      const info = K.el('div', {}), cols = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' }), summ = K.el('div', {}), agg = K.el('div', { class: 'hint' });
      const open = new Set();
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: 20 answerable questions (24 in total); the whole-set gains are within noise (one question moves MRR by about 0.05, no confidence interval yet). n = 24 questions, written by Claude from the corpus text, not a benchmark; gold labels cover only the passages judged necessary, so a "miss" can be a fair hit. The corpus is a sample. Only the top 20 of the first stage are reranked: a gold passage below rank 20 can never be recovered. One question is an anecdote; the aggregate line below is still demo scale (differences of 0.05 MRR are about one question). Text: Wikipedia contributors, CC BY-SA 4.0.');
      function col(title, color, items, gold, fmt) {
        const rows = items.slice(0, 8).map((x, i) => {
          const isG = gold.includes(x.id), key = title + x.id;
          const btn = K.el('button', { 'aria-expanded': String(open.has(key)), style: 'text-align:left;width:100%;' + (isG ? 'border-color:var(--he)' : '') }, `#${i + 1}  ${x.id}  ${fmt(x)}  ${isG ? 'GOLD  ' : ''}${P[x.id].article}`);
          const txt = K.el('div', { class: 'hint', style: 'display:' + (open.has(key) ? 'block' : 'none') }, P[x.id].text);
          btn.addEventListener('click', () => { open.has(key) ? open.delete(key) : open.add(key); draw(); });
          return K.el('div', { style: 'margin:3px 0' }, btn, txt);
        });
        return K.el('div', { style: 'flex:1 1 320px;min-width:0' }, K.el('div', { style: `color:${color};font-weight:600` }, title), ...rows);
      }
      function draw() {
        const q = qs.find(x => x.id === sel.value), g = q.gold_passages, f = F[+fsel.value];
        const first = f.a[q.id].slice(0, 20), ce = f.b[q.id];
        const lg = {}; ce.forEach(x => { lg[x.id] = x.score; });
        const cands = first.map(x => ({ id: x.id, logit: lg[x.id], rel: g.includes(x.id) ? 1 : 0 }));
        const r = compute({ cands, M: 138, K: 20, nSent: 0 });
        const same = JSON.stringify(r.reranked_order) === JSON.stringify(ce.map(x => x.id));
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold: ${g.join(', ') || 'none'}. gold answer: ${q.gold_answer || '(none)'}`));
        cols.replaceChildren(col(f.name + ' (first stage)', 'var(--k12)', first, g, x => K.fmt(x.score, 2)), col('after cross-encoder (logit)', 'var(--he)', ce, g, x => (x.score >= 0 ? '+' : '') + K.fmt(x.score, 2)));
        const miss = g.filter(x => !first.some(y => y.id === x));
        summ.replaceChildren(K.el('div', {}, 'reciprocal rank (first gold): ', K.el('b', {}, K.fmt(r.rr_before, 3)), ' to ', K.el('b', { class: r.rr_after >= r.rr_before ? 'good' : 'bad' }, K.fmt(r.rr_after, 3))),
          miss.length ? K.el('div', { class: 'bad' }, `Not in the first-stage top 20, so never seen by the reranker: ${miss.join(', ')}`) : '',
          g.length === 0 ? K.el('div', { class: 'bad' }, 'Unanswerable question: the reranker still ranks something first. A score is not an "I do not know".') : '',
          same ? '' : K.el('div', { class: 'bad' }, 'order mismatch with the stored run (tie?)'));
        const a = met.methods[f.ka], b = met.methods[f.kb];
        agg.textContent = `Whole set (20 answerable questions), ${f.name} to reranked: MRR ${K.fmt(a.mrr, 3)} to ${K.fmt(b.mrr, 3)}, nDCG@5 ${K.fmt(a['ndcg@5'], 3)} to ${K.fmt(b['ndcg@5'], 3)}, recall@5 ${K.fmt(a['recall@5'], 3)} to ${K.fmt(b['recall@5'], 3)}.`;
      }
      sel.addEventListener('change', draw); fsel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', {}, 'question ', sel), K.el('label', {}, 'first stage ', fsel)), info, summ, cols, agg, cav); draw();
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

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['cross_encoder'] = api;
})(this);
