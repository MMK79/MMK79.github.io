/* Failure attribution demo: for every WRONG answer, which stage lost the evidence?
   retrieval = a gold passage is not even in the candidate list; rank/cut = candidates have all gold but the prompt context dropped one;
   generation = all gold passages were in the prompt context and the answer is still wrong. First matching class wins. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const CLASSES = ['retrieval', 'rank_cut', 'generation'];

  /* Toy = the catalogue worked example: 100 questions, 40 wrong: 22 retrieval, 9 rank/cut, 9 generation (illustrative). */
  const mk = (n, wrong, goldInR, goldInC) => Array.from({ length: n }, () => ({ wrong, goldInR, goldInC }));
  const defaults = {
    items: [].concat(mk(60, false, true, true), mk(22, true, false, false), mk(9, true, true, false), mk(9, true, true, true)),
  };

  /* PURE. item = { wrong, goldInR (all gold in candidate list), goldInC (all gold in prompt context) }.
     First matching class wins; shares are over the wrong answers only. */
  function classify(it) {
    if (!it.wrong) return null;
    if (!it.goldInR) return 'retrieval';
    if (!it.goldInC) return 'rank_cut';
    return 'generation';
  }
  function compute(inp) {
    const n = { retrieval: 0, rank_cut: 0, generation: 0 };
    inp.items.forEach(it => { const c = classify(it); if (c) n[c]++; });
    const wrong = n.retrieval + n.rank_cut + n.generation;
    return wrong ? { retrieval: n.retrieval / wrong, rank_cut: n.rank_cut / wrong, generation: n.generation / wrong } : { retrieval: 0, rank_cut: 0, generation: 0 };
  }
  const counts = inp => { const n = { retrieval: 0, rank_cut: 0, generation: 0 }; inp.items.forEach(it => { const c = classify(it); if (c) n[c]++; }); return n; };

  const LAB = { retrieval: 'retrieval miss', rank_cut: 'rank / context cut', generation: 'generation' };
  const COL = { retrieval: 'var(--warn)', rank_cut: 'var(--k12)', generation: 'var(--ai)' };

  /* A stacked bar of the three counts (HTML, no SVG sizing issues at 390 px). */
  function bar(K, n, title) {
    const tot = n.retrieval + n.rank_cut + n.generation;
    const seg = c => K.el('div', { title: LAB[c] + ': ' + n[c], style: 'flex:' + n[c] + ' 0 0;background:' + COL[c] + ';min-width:' + (n[c] ? '22px' : '0') + ';text-align:center;color:#000;font-size:12px;line-height:22px;overflow:hidden' }, n[c] ? String(n[c]) : '');
    return K.el('div', { style: 'margin:4px 0' },
      K.el('div', { class: 'hint' }, title + (tot ? '' : ': no failures')),
      tot ? K.el('div', { style: 'display:flex;width:100%;border-radius:4px;overflow:hidden' }, CLASSES.map(seg)) : K.el('span'));
  }
  const legend = K => K.el('div', { class: 'row', style: 'flex-wrap:wrap' }, CLASSES.map(c =>
    K.el('span', { style: 'border-left:12px solid ' + COL[c] + ';padding-left:6px' }, LAB[c])));

  /* ---- Toy ---- */
  function mountToy(el) {
    const K = root.DemoKit;
    const st = { r: 22, c: 9, g: 9, ok: 60 };
    const shell = K.shell(el, 'Toy example (break it)',
      'Illustrative numbers (the catalogue worked example), not measured. 100 questions; set how many wrong answers were lost at each stage. Shares are over the wrong answers only.');
    const sr = K.slider('retrieval misses', 0, 60, 1, st.r, v => { st.r = v; render(); });
    const sc = K.slider('rank / cut', 0, 60, 1, st.c, v => { st.c = v; render(); });
    const sg = K.slider('generation', 0, 60, 1, st.g, v => { st.g = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { sr.set(st.r = 22); sc.set(st.c = 9); sg.set(st.g = 9); render(); }),
      btn('Break it: only 2 wrong answers', () => { sr.set(st.r = 2); sc.set(st.c = 0); sg.set(st.g = 0); render(); }));
    const out = K.el('div'); const res = K.el('div', { class: 'num' }); const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const note = K.el('p', { class: 'hint' });
    shell.append(presets, K.el('div', { class: 'row' }, sr.node), K.el('div', { class: 'row' }, sc.node), K.el('div', { class: 'row' }, sg.node), out, legend(K), res, formula, note);
    function render() {
      const items = [].concat(mk(Math.max(0, 100 - st.r - st.c - st.g), false, true, true), mk(st.r, true, false, false), mk(st.c, true, true, false), mk(st.g, true, true, true));
      const inp = { items }, v = compute(inp), n = counts(inp), w = n.retrieval + n.rank_cut + n.generation;
      out.replaceChildren(bar(K, n, w + ' wrong answers out of ' + items.length));
      res.textContent = 'retrieval ' + K.fmt(v.retrieval) + '   rank/cut ' + K.fmt(v.rank_cut) + '   generation ' + K.fmt(v.generation);
      formula.textContent = w ? `retrieval = ${n.retrieval}/${w} = ${K.fmt(v.retrieval)};  rank/cut = ${n.rank_cut}/${w} = ${K.fmt(v.rank_cut)};  generation = ${n.generation}/${w} = ${K.fmt(v.generation)}` : 'no wrong answers: the shares are undefined (shown as 0)';
      note.textContent = w && w < 8 ? 'With only ' + w + ' wrong answers one question moves a share by ' + K.fmt(1 / w) + ': the split is noisy.' : 'The rule needs gold labels for every document, and says where the evidence was lost, not why the reader failed.';
    }
    render();
  }

  /* ---- Real example (pack: Presentations/_real-examples) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    const rk = r => { const o = {}; r.questions.forEach(q => { o[q.qid] = q.ranking.map(x => x.id); }); return o; };
    realData = Promise.all([get('data/questions.json'), get('answers/answers.json'), get('answers/correctness.json'),
      get('runs/rrf_bm25_dense.json'), get('runs/dense_cosine.json'), get('runs/ppr_graph.json')]).then(a => {
      const Q = {}; a[0].forEach(q => { Q[q.id] = q; });
      const corr = {}; a[2].forEach(c => { corr[c.qid + c.arm] = c; });
      return { Q, ans: a[1].filter(x => x.arm === 'B' || x.arm === 'C'), corr, rrf: rk(a[3]), dense: rk(a[4]), ppr: rk(a[5]) };
    });
    return realData;
  }

  /* pure on the real data: builds one item per (question, arm) under the rule; depth N = how deep the candidate list R is read. */
  function realItems(D, opt) {
    return D.ans.map(x => {
      const q = D.Q[x.qid], G = q.gold_passages, c = D.corr[x.qid + x.arm];
      const lists = x.arm === 'B' ? [D.rrf[x.qid]] : [D.dense[x.qid], D.ppr[x.qid]];
      const R = new Set(); lists.forEach(l => (l || []).slice(0, opt.depth).forEach(p => R.add(p)));
      const C = new Set(x.context_ids);
      const rankOf = g => { let b = null; lists.forEach(l => { const i = (l || []).indexOf(g); if (i >= 0 && (b === null || i + 1 < b)) b = i + 1; }); return b; };
      const answerable = G.length > 0;
      const score = c ? c.score : null;
      let wrong, why;
      if (!answerable) { wrong = !x.refused; why = x.refused ? 'refused, correct' : 'answered an unanswerable question'; }
      else if (x.refused) { wrong = true; why = 'refused an answerable question'; }
      else { wrong = score < (opt.partial ? 1 : 0.5); why = 'correctness ' + score; }
      return { qid: x.qid, arm: x.arm, type: q.type, gold: G, ctx: x.context_ids, ranks: G.map(g => [g, rankOf(g)]),
        goldInR: G.every(g => R.has(g)), goldInC: G.every(g => C.has(g)), wrong, why, answer: x.answer, reason: c ? c.reason : '' };
    });
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { depth: 20, partial: true, arm: 'both', open: null };
    const shell = K.shell(el, 'Real example: which stage lost the evidence? (12 questions x arms B and C)',
      'Demo scale: 12 questions x 2 arms = 24 answers, one run, temperature 0; correctness is an LLM judge, no human labels. Arm B = RRF top-5 passages as the prompt context. Arm C = dense top-5 plus up to 5 graph (PPR) passages. THE RULE IS OURS: it follows the catalogue formula (handout 8.4 idea), and there is no reranker in these arms, so "rank / cut" means a gold passage sat in the stored candidate list (top-N of the first-stage run) but was not in the prompt context. Only the top-20 of each run is stored. Gold labels cover only the necessary passages. The three unanswerable questions are right when the system refuses.');
    const dS = K.slider('candidate depth N (read the first N of each run as "retrieved")', 5, 20, 1, st.depth, v => { st.depth = v; render(); });
    const pChk = K.el('input', { type: 'checkbox', checked: 'checked' });
    pChk.addEventListener('change', () => { st.partial = pChk.checked; render(); });
    const aSel = K.el('select', { 'aria-label': 'arm' }, [['both', 'arms B and C'], ['B', 'arm B only'], ['C', 'arm C only']].map(([v, t]) => K.el('option', { value: v }, t)));
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const bars = K.el('div'); const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const note = K.el('p', { class: 'hint' });
    const list = K.el('div', { role: 'group', 'aria-label': 'per answer attribution' });
    const detail = K.el('div', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, dS.node),
      K.el('div', { class: 'row' }, K.el('label', {}, pChk, ' correctness 0.5 (partial) counts as wrong'), K.el('label', {}, 'show ', aSel)),
      bars, legend(K), formula, note,
      K.el('p', { class: 'hint' }, 'All 24 answers (click a row for the answer text). Left colour = failure class; grey = answered correctly.'), list, detail);

    function render() {
      const all = realItems(D, st), shown = all.filter(i => st.arm === 'both' || i.arm === st.arm);
      const inp = { items: shown }, n = counts(inp), w = n.retrieval + n.rank_cut + n.generation, v = compute(inp);
      bars.replaceChildren(bar(K, counts({ items: all.filter(i => i.arm === 'B') }), 'arm B'), bar(K, counts({ items: all.filter(i => i.arm === 'C') }), 'arm C'),
        bar(K, n, 'selected: ' + w + ' wrong of ' + shown.length + ' answers'));
      formula.textContent = w ? `retrieval = ${n.retrieval}/${w} = ${K.fmt(v.retrieval)};  rank/cut = ${n.rank_cut}/${w} = ${K.fmt(v.rank_cut)};  generation = ${n.generation}/${w} = ${K.fmt(v.generation)}` : 'no failures in this selection';
      note.textContent = (w ? 'With ' + w + ' failures one answer moves a share by ' + K.fmt(1 / w) + '. ' : '') + 'Try N = 5: the candidate list shrinks to what fits in the prompt, so every cut becomes a retrieval miss. The split depends on where you draw the line.';
      list.replaceChildren();
      shown.forEach(i => {
        const cls = classify(i), col = cls ? COL[cls] : 'var(--faint)';
        const where = i.gold.length ? i.ranks.map(([g, r]) => g + (i.ctx.includes(g) ? ' in context' : ' rank ' + (r === null ? '>20' : r) + ', not in context')).join('; ') : 'no gold (unanswerable)';
        const row = K.el('div', { class: 'row', tabindex: '0', role: 'button', style: 'margin:2px 0;padding:2px 6px;border-left:6px solid ' + col + ';flex-wrap:wrap;cursor:pointer',
          onclick: () => open(i), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } } },
          K.el('b', {}, i.qid + ' ' + i.arm), K.el('span', { class: 'hint' }, i.type), K.el('span', { class: 'num' }, where),
          K.el('span', { class: cls ? 'bad' : 'good' }, cls ? LAB[cls] + ' (' + i.why + ')' : 'ok (' + i.why + ')'));
        list.append(row);
      });
      if (st.open) { const o = all.find(i => i.qid === st.open.qid && i.arm === st.open.arm); if (o) open(o, true); }
    }
    function open(i, keep) {
      st.open = { qid: i.qid, arm: i.arm };
      detail.replaceChildren(K.el('b', {}, i.qid + ' arm ' + i.arm), ' gold ' + (i.gold.join(', ') || 'none') + '; context ' + i.ctx.join(', '), K.el('br'),
        'Answer: ' + i.answer, K.el('br'), 'Judge: ' + (i.reason || 'n/a'));
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar0 = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar0.append(bR, bT); el.append(bar0, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real answers and runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, _realItems: realItems };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['failure_attribution'] = api;
})(this);
