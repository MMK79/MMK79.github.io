/* ROUGE-L demo: R = LCS/|ref|, P = LCS/|cand|, F = (1+b^2) R P / (R + b^2 P).
   Everything is computed live from the strings. Tokens: lowercase runs of letters/digits (punctuation and [p093] citation tags are split, not removed). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { ref: 'the cat sat on the mat', cand: 'the cat on the mat', beta: 1 };

  const tokenize = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
  /* DP table + one LCS alignment (backtrack prefers the diagonal, then up, then left: deterministic). */
  function lcsTable(x, y) {
    const t = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
    for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++)
      t[i][j] = x[i - 1] === y[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    return t;
  }
  function align(x, y) {
    const t = lcsTable(x, y), pairs = [];
    let i = x.length, j = y.length;
    while (i > 0 && j > 0) {
      if (x[i - 1] === y[j - 1]) { pairs.push([i - 1, j - 1]); i--; j--; }
      else if (t[i - 1][j] >= t[i][j - 1]) i--; else j--;
    }
    pairs.reverse();
    return { t, pairs, lcs: t[x.length][y.length] };
  }
  function prf(refText, candText, beta) {
    const x = tokenize(refText), y = tokenize(candText), a = align(x, y);
    const R = x.length ? a.lcs / x.length : 0, P = y.length ? a.lcs / y.length : 0;
    const b2 = (beta === undefined ? 1 : beta) ** 2, d = R + b2 * P;
    return { x, y, lcs: a.lcs, pairs: a.pairs, t: a.t, R, P, F: d > 0 ? (1 + b2) * R * P / d : 0 };
  }
  /* PURE: returns F (the worked example result) */
  function compute(inp) { return prf(inp.ref, inp.cand, inp.beta).F; }

  function ranks(v) {  // average ranks
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
    return r;
  }
  function pearson(a, b) {
    const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
  }
  const spearman = (a, b) => pearson(ranks(a), ranks(b));

  /* ---- shared view of an alignment: two rows of word chips, LCS words highlighted and linked by index ---- */
  function chips(K, words, matchedIdx, color) {
    const wrap = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;line-height:1.2' });
    words.forEach((w, i) => {
      const hit = matchedIdx.has(i);
      wrap.append(K.el('span', { title: hit ? 'in the LCS (#' + (matchedIdx.get(i) + 1) + ')' : 'not in the LCS',
        style: 'padding:1px 5px;border-radius:4px;font-size:13px;border:1px solid ' + (hit ? color : 'rgba(128,128,128,.35)') +
          ';background:' + (hit ? color : 'transparent') + ';color:' + (hit ? '#0b0f1a' : 'inherit') + ';opacity:' + (hit ? 1 : .6) + (hit ? ';font-weight:600' : '') },
        w + (hit ? ' ' + (matchedIdx.get(i) + 1) : '')));
    });
    return wrap;
  }
  function alignmentView(K, r) {
    const mr = new Map(), mc = new Map();
    r.pairs.forEach((p, k) => { mr.set(p[0], k); mc.set(p[1], k); });
    return K.el('div', {},
      K.el('div', { class: 'hint' }, 'reference (' + r.x.length + ' words)'), chips(K, r.x, mr, 'var(--he, #3fb8af)'),
      K.el('div', { class: 'hint' }, 'answer (' + r.y.length + ' words). Numbers 1..' + r.lcs + ' give the order of the shared words, gaps allowed.'),
      chips(K, r.y, mc, 'var(--k12, #7c9cff)'));
  }
  function dpView(K, r) {
    const cells = (r.x.length + 1) * (r.y.length + 1);
    const d = K.el('details', {}, K.el('summary', {}, 'Dynamic-programming table (' + r.x.length + ' x ' + r.y.length + ')'));
    if (r.y.length > 40) { d.append(K.el('p', { class: 'hint' }, 'The answer has ' + r.y.length + ' words; the table (' + cells + ' cells) is too wide to show here. Use the "first N words" slider to cut the answer to 40 words or fewer.')); return d; }
    const on = new Set(r.pairs.map(p => (p[0] + 1) + ',' + (p[1] + 1)));
    const tb = K.el('table', { style: 'border-collapse:collapse;font-size:11px' });
    tb.append(K.el('tr', {}, K.el('td'), K.el('td'), ...r.y.map(w => K.el('td', { style: 'padding:1px 3px;font-weight:600' }, w))));
    for (let i = 0; i <= r.x.length; i++) {
      tb.append(K.el('tr', {}, K.el('td', { style: 'padding:1px 3px;font-weight:600' }, i ? r.x[i - 1] : ''), ...r.t[i].map((v, j) =>
        K.el('td', { style: 'text-align:center;padding:1px 3px;border:1px solid rgba(128,128,128,.25);' + (on.has(i + ',' + j) ? 'background:var(--ai, #f2a93b);color:#0b0f1a;font-weight:700' : '') }, String(v)))));
    }
    d.append(K.el('div', { style: 'overflow-x:auto;max-width:100%' }, tb), K.el('p', { class: 'hint' }, 'Cell (i, j) = LCS of the first i reference words and the first j answer words. Highlighted cells are the matched pairs; the bottom-right cell is the LCS length.'));
    return d;
  }
  function formulaText(r, beta) {
    const b2 = beta * beta;
    return `LCS = ${r.lcs}\nR = LCS / |ref| = ${r.lcs} / ${r.x.length} = ${root.DemoKit.fmt(r.R, 3)}\nP = LCS / |answer| = ${r.lcs} / ${r.y.length} = ${root.DemoKit.fmt(r.P, 3)}\n` +
      `F = (1 + ${root.DemoKit.fmt(b2, 2)}) x ${root.DemoKit.fmt(r.R, 3)} x ${root.DemoKit.fmt(r.P, 3)} / (${root.DemoKit.fmt(r.R, 3)} + ${root.DemoKit.fmt(b2, 2)} x ${root.DemoKit.fmt(r.P, 3)}) = ${root.DemoKit.fmt(r.F, 4)}`;
  }

  function mountToy(el) {
    const K = root.DemoKit, st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Edit the two sentences. The score only counts shared words that appear in the same order; it does not know what the words mean.');
    const ta = (k, label) => { const t = K.el('textarea', { rows: '2', 'aria-label': label, style: 'width:100%;box-sizing:border-box;font:inherit' }); t.value = st[k]; t.addEventListener('input', () => { st[k] = t.value; render(); }); return t; };
    const tRef = ta('ref', 'reference'), tCand = ta('cand', 'answer');
    const beta = K.slider('beta (1 = balanced F)', 0.25, 3, 0.25, st.beta, v => { st.beta = v; render(); });
    const res = K.resultBox(), view = K.el('div'), dp = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    const set = o => { Object.assign(st, o); tRef.value = st.ref; tCand.value = st.cand; beta.set(st.beta); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: opposite meaning', () => set({ ref: 'the drug is safe for children', cand: 'the drug is not safe for children', beta: 1 })),
      btn('Break it: right answer, other words', () => set({ ref: 'it overshoots and diverges', cand: 'the step is too large so the loss explodes', beta: 1 })),
      btn('Break it: shuffled order', () => set({ ref: 'dog bites man', cand: 'man bites dog', beta: 1 })));
    shell.append(presets, K.el('label', { style: 'display:block' }, 'reference ', tRef), K.el('label', { style: 'display:block' }, 'answer ', tCand), K.el('div', { class: 'row' }, beta.node), res.node, view, formula, dp, note);
    function render() {
      const r = prf(st.ref, st.cand, st.beta);
      res.set(r.F, 4); view.replaceChildren(alignmentView(K, r)); dp.replaceChildren(dpView(K, r)); formula.textContent = formulaText(r, st.beta);
      note.textContent = st.cand.indexOf(' not ') >= 0 && r.F > 0.8 ? 'The answer says the opposite, and the score is still high: one extra word costs almost nothing.'
        : r.lcs === 0 ? 'No shared word, so the score is 0, even if the meaning is the same.' : 'ROUGE-L is a lexical overlap score. It cannot tell a right answer from a fluent wrong one.';
    }
    render();
  }

  /* ---- Real example: real gold vs real system answers (Presentations/_real-examples answers/ + data/questions.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json'), get('metrics/answer_correctness.json')]).then(a => {
      const ans = {}, qs = {};
      a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[1].forEach(q => { qs[q.id] = q; });
      return { ans, qs, ac: a[2] };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const answerable = id => D.qs[id].type !== 'unanswerable';
    const qids = Object.keys(D.ac.per_question.B).filter(answerable);
    const st = { arm: 'B', q: 'q06', n: 0, beta: 1 };
    const shell = K.shell(el, 'Real example: ROUGE-L on real gold vs real system answers',
      'Scale: n = 12 questions, 9 answerable (the 3 unanswerable ones have a placeholder gold answer and are left out), 3 arms, one run, temperature 0; gold answers written by the study helper, not by human annotators; a demo, not a benchmark. ROUGE-L is computed live in this page from the real strings (lowercase letters and digits as tokens, F with beta = 1 unless you move it). The correctness verdict beside it is the LLM judge A verdict from the answer study (1 / 0.5 / 0), not a human label.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; st.n = 0; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; st.n = 0; render(); });
    const nSl = K.slider('answer cut to first N words (0 = all)', 0, 120, 1, 0, v => { st.n = v; render(); });
    const bSl = K.slider('beta (1 = balanced F)', 0.25, 3, 0.25, 1, v => { st.beta = v; render(); });
    const res = K.resultBox(), pr = K.el('div', { class: 'row' }), view = K.el('div'), dp = K.el('div');
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tbl = K.el('div'), corr = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      K.el('div', { class: 'row' }, nSl.node), K.el('div', { class: 'row' }, bSl.node), pr, res.node, view, formula, dp, note, tbl, corr);

    function candOf(id, arm) { return D.ans[id + '_' + arm].answer; }
    function render() {
      const gold = D.qs[st.q].gold_answer;
      let cand = candOf(st.q, st.arm);
      if (st.n > 0) cand = cand.split(/\s+/).slice(0, st.n).join(' ');
      const r = prf(gold, cand, st.beta), v = D.ac.per_question[st.arm][st.q];
      res.set(r.F, 4);
      pr.replaceChildren(K.el('span', { class: 'num', style: 'color:var(--k12)' }, 'P = ' + K.fmt(r.P, 3)), K.el('span', { class: 'num', style: 'color:var(--he)' }, 'R = ' + K.fmt(r.R, 3)),
        K.el('span', { class: 'num good' }, 'F = ' + K.fmt(r.F, 3)), K.el('span', { class: 'num' }, 'judge A correctness = ' + v));
      view.replaceChildren(alignmentView(K, r)); dp.replaceChildren(dpView(K, r)); formula.textContent = formulaText(r, st.beta);
      const src = D.ans[st.q + '_' + st.arm];
      note.textContent = 'Source: gold answer of ' + st.q + ' (data/questions.json), system answer of arm ' + st.arm + (src.context_ids && src.context_ids.length ? ' with context ' + src.context_ids.join(', ') : ' with no context') + '. ' +
        (r.y.length > 3 * r.x.length ? 'The answer is ' + K.fmt(r.y.length / r.x.length, 1) + 'x longer than the gold: recall can be high while precision collapses, so F mostly measures length here. ' : '') +
        (v === 1 && r.F < 0.3 ? 'The judge marks this answer correct, yet ROUGE-L F is low.' : v === 0 && r.F >= 0.1 ? 'The judge marks this answer wrong, yet it still shares words with the gold.' : '');
      // all 27 pairs
      const rows = [], xs = [], ys = [];
      qids.forEach(id => ['A', 'B', 'C'].forEach(arm => { const rr = prf(D.qs[id].gold_answer, candOf(id, arm), 1), j = D.ac.per_question[arm][id]; rows.push({ id, arm, rr, j }); xs.push(rr.F); ys.push(j); }));
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['q', 'arm', 'ref w', 'ans w', 'P', 'R', 'F', 'judge'].map(h => K.el('th', { style: 'padding:1px 5px;text-align:right' }, h))));
      rows.forEach(o => t.append(K.el('tr', { style: (o.id === st.q && o.arm === st.arm) ? 'font-weight:700' : '' }, ...[o.id, o.arm, o.rr.x.length, o.rr.y.length, K.fmt(o.rr.P, 2), K.fmt(o.rr.R, 2), K.fmt(o.rr.F, 2), o.j].map(c => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(c))))));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All 27 answerable pairs (9 questions x 3 arms, beta = 1)'), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t)));
      const pm = arm => K.fmt(rows.filter(o => o.arm === arm).reduce((s, o) => s + o.rr.F, 0) / 9, 3);
      const ok = rows.filter(o => o.j === 1).length;
      corr.textContent = 'Mean ROUGE-L F over the 9 answerable questions: A ' + pm('A') + ', B ' + pm('B') + ', C ' + pm('C') + '. Judge correctness (mean): A 0.94, B 0.78, C 0.89 (pack). ' +
        'Across the 27 pairs, Spearman correlation between F and the judge verdict = ' + K.fmt(spearman(xs, ys), 2) + ' (Pearson ' + K.fmt(pearson(xs, ys), 2) + '); ' + ok + ' of 27 answers got verdict 1. With 27 pairs and only 3 verdict values this is a rough number, but note the direction: the arm with no retrieval and the longest, most generic answers is judged best on correctness by A, and ROUGE-L does not reproduce that ordering. The thesis recommends against ROUGE-L as a headline number.';
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, tokenize, prf, spearman };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['rouge_l'] = api;
})(this);
