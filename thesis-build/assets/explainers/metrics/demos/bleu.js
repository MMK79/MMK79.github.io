/* BLEU demo: BLEU = BP * exp(sum_n w_n log p_n), p_n = clipped n-gram precision, BP = brevity penalty.
   Everything is computed live from the strings. Tokens: lowercase runs of letters/digits; optional: drop [p093]-style citation tags first. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { ref: 'there is a cat on the mat', cand: 'the cat is on the mat', N: 2, smooth: false };

  const tokenize = (s, strip) => { let t = String(s).toLowerCase(); if (strip) t = t.replace(/\[p\d+\]/g, ' '); return t.match(/[a-z0-9]+/g) || []; };
  const grams = (t, n) => { const m = new Map(); for (let i = 0; i + n <= t.length; i++) { const k = t.slice(i, i + n).join(' '); m.set(k, (m.get(k) || 0) + 1); } return m; };
  /* clipped matches of order n; also which candidate positions are covered by a matched (clipped) n-gram */
  function orderStats(r, c, n) {
    const rc = grams(r, n), used = new Map(), covered = new Array(c.length).fill(false);
    let match = 0;
    for (let i = 0; i + n <= c.length; i++) {
      const k = c.slice(i, i + n).join(' '), u = used.get(k) || 0;
      if (u < (rc.get(k) || 0)) { used.set(k, u + 1); match++; for (let j = i; j < i + n; j++) covered[j] = true; }
    }
    return { match, total: Math.max(c.length - n + 1, 0), covered };
  }
  /* PURE from counts: match[n-1], total[n-1], reference length, candidate length. smooth = add 1 to numerator and denominator for n > 1 (Lin and Och 2004). */
  function bleuFromCounts(match, total, rl, cl, N, smooth) {
    if (cl === 0) return { bleu: 0, bp: 0, p: [], logsum: -Infinity };
    let ls = 0; const p = [];
    for (let i = 0; i < N; i++) {
      let m = match[i], t = total[i];
      if (smooth && i > 0) { m += 1; t += 1; }
      p.push(t > 0 ? m / t : 0);
      ls += (m > 0 && t > 0) ? Math.log(m / t) / N : -Infinity;
    }
    const bp = cl > rl ? 1 : Math.exp(1 - rl / cl);
    return { bleu: bp * Math.exp(ls), bp, p, logsum: ls };
  }
  function sentence(refText, candText, N, smooth, strip) {
    const r = tokenize(refText, strip), c = tokenize(candText, strip), os = [];
    for (let n = 1; n <= 4; n++) os.push(orderStats(r, c, n));
    const f = bleuFromCounts(os.map(o => o.match), os.map(o => o.total), r.length, c.length, N, smooth);
    return Object.assign({ r, c, os }, f);
  }
  /* corpus level: sum matches and totals over all pairs first, then one BP from the summed lengths */
  function corpus(pairs, N, smooth, strip) {
    const M = [0, 0, 0, 0], T = [0, 0, 0, 0]; let RL = 0, CL = 0;
    pairs.forEach(([rt, ct]) => { const s = sentence(rt, ct, 4, false, strip); for (let i = 0; i < 4; i++) { M[i] += s.os[i].match; T[i] += s.os[i].total; } RL += s.r.length; CL += s.c.length; });
    return Object.assign({ M, T, RL, CL }, bleuFromCounts(M, T, RL, CL, N, smooth));
  }
  /* PURE: returns BLEU-N (the worked example result) */
  function compute(inp) { return sentence(inp.ref, inp.cand, inp.N, !!inp.smooth, false).bleu; }

  const fmt = (x, d) => root.DemoKit.fmt(x, d);
  function chips(K, words, covered, color) {
    const wrap = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;line-height:1.2' });
    words.forEach((w, i) => {
      const hit = covered ? covered[i] : false;
      wrap.append(K.el('span', { style: 'padding:1px 5px;border-radius:4px;font-size:13px;border:1px solid ' + (hit ? color : 'rgba(128,128,128,.35)') +
        ';background:' + (hit ? color : 'transparent') + ';color:' + (hit ? '#0b0f1a' : 'inherit') + ';opacity:' + (hit ? 1 : .6) + (hit ? ';font-weight:600' : '') }, w));
    });
    return wrap;
  }
  function orderTable(K, s, N, smooth) {
    const t = K.el('table', { style: 'border-collapse:collapse;font-size:13px' });
    t.append(K.el('tr', {}, ...['order n', 'clipped matches', 'candidate n-grams', 'p_n', 'used'].map(h => K.el('th', { style: 'padding:2px 6px;text-align:right' }, h))));
    for (let n = 1; n <= 4; n++) {
      const o = s.os[n - 1], used = n <= N, zero = used && o.match === 0;
      const sm = smooth && n > 1 && used;
      t.append(K.el('tr', { style: 'opacity:' + (used ? 1 : .4) + (zero ? ';color:var(--warn,#e5484d);font-weight:700' : '') },
        ...[n, o.match, o.total, (o.total ? fmt(o.match / o.total, 3) : '-') + (sm ? ' -> ' + fmt((o.match + 1) / (o.total + 1), 3) + ' (smoothed)' : ''), used ? 'yes' : 'no'].map(c => K.el('td', { style: 'padding:2px 6px;text-align:right' }, String(c)))));
    }
    return K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t);
  }
  function formulaText(s, N, smooth) {
    const ps = s.p.map((p, i) => 'p' + (i + 1) + ' = ' + fmt(p, 3)).join(', ');
    const parts = s.p.map(p => fmt(p, 3)).join(' x ');
    const zero = s.p.some(p => p === 0);
    return `${ps}\nc = ${s.c.length} (answer), r = ${s.r.length} (reference), BP = ${s.c.length > s.r.length ? '1 (c > r)' : 'exp(1 - ' + s.r.length + '/' + s.c.length + ') = ' + fmt(s.bp, 4)}\n` +
      `BLEU-${N} = BP x (${parts})^(1/${N}) = ${fmt(s.bleu, 4)}` + (zero ? '\nOne order has no match: its log is -infinity, so the whole product is 0.' : '');
  }

  function mountToy(el) {
    const K = root.DemoKit, st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Edit the two sentences and the maximum n-gram order. BLEU only counts shared word sequences; it does not know what the words mean.');
    const ta = (k, label) => { const t = K.el('textarea', { rows: '2', 'aria-label': label, style: 'width:100%;box-sizing:border-box;font:inherit' }); t.value = st[k]; t.addEventListener('input', () => { st[k] = t.value; render(); }); return t; };
    const tRef = ta('ref', 'reference'), tCand = ta('cand', 'answer');
    const nSl = K.slider('max order N', 1, 4, 1, st.N, v => { st.N = v; render(); });
    const sm = K.el('input', { type: 'checkbox', 'aria-label': 'smoothing' }); sm.addEventListener('change', () => { st.smooth = sm.checked; render(); });
    const res = K.resultBox(), view = K.el('div'), tbl = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    const set = o => { Object.assign(st, o); tRef.value = st.ref; tCand.value = st.cand; nSl.set(st.N); sm.checked = !!st.smooth; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: right answer, no 4-gram', () => set({ ref: 'Hoerl and Kennard introduced the theory in 1970', cand: 'Ridge regression was introduced by Hoerl and Kennard in 1970', N: 4, smooth: false })),
      btn('Break it: repeat a word', () => set({ ref: 'the cat sat', cand: 'the the the the the', N: 1, smooth: false })),
      btn('Break it: too short', () => set({ ref: 'the cat sat on the mat today', cand: 'the cat', N: 1, smooth: false })),
      btn('Break it: opposite meaning', () => set({ ref: 'the drug is safe for children', cand: 'the drug is not safe for children', N: 2, smooth: false })));
    shell.append(presets, K.el('label', { style: 'display:block' }, 'reference ', tRef), K.el('label', { style: 'display:block' }, 'answer ', tCand),
      K.el('div', { class: 'row' }, nSl.node, K.el('label', {}, sm, ' smoothing (add 1 for n > 1)')), res.node, view, tbl, formula, note);
    function render() {
      const s = sentence(st.ref, st.cand, st.N, st.smooth, false);
      res.set(s.bleu, 4);
      view.replaceChildren(K.el('div', { class: 'hint' }, 'reference (' + s.r.length + ' words)'), chips(K, s.r, null, ''),
        K.el('div', { class: 'hint' }, 'answer (' + s.c.length + ' words); coloured = inside a clipped matched ' + st.N + '-gram'), chips(K, s.c, s.os[st.N - 1].covered, 'var(--ai, #f2a93b)'));
      tbl.replaceChildren(orderTable(K, s, st.N, st.smooth)); formula.textContent = formulaText(s, st.N, st.smooth);
      note.textContent = s.bleu === 0 && s.c.length > 0 ? 'Score 0: at least one order has no match, so the geometric mean collapses. Turn smoothing on, or lower N.'
        : s.c.length < s.r.length ? 'The answer is shorter than the reference, so the brevity penalty ' + fmt(s.bp, 3) + ' lowers the score.'
        : st.cand.indexOf(' not ') >= 0 && s.bleu > 0.5 ? 'The answer says the opposite and still scores high: one extra word costs little.' : 'BLEU is precision only. It is a machine-translation score, weak for free-form answers.';
    }
    render();
  }

  /* ---- Real example: real gold vs real system answers (demos/data/bleu.real.json, built from Presentations/_real-examples) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const here = SCRIPT_SRC || location.href;
    const get = u => fetch(new URL(u, here).href).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/bleu.real.json'), get('../../_real-examples/metrics/answer_correctness.json').catch(() => null)]).then(a => ({ qs: a[0].questions, ac: a[1] }));
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, st = { arm: 'B', q: 0, N: 4, smooth: false, strip: true, view: 4 };
    const shell = K.shell(el, 'Real example: BLEU on real gold vs real system answers',
      'Scale: the 9 answerable questions of the answer study (the 3 unanswerable ones have a placeholder gold answer and are left out), 3 arms, one run; gold answers written by the study helper, one short reference per question, not human annotators; a demo, not a benchmark. BLEU is computed live in this page from the real strings. Corpus BLEU is the meaningful number here; BLEU on one sentence is not, and BLEU has weak validity for LLM answers. The judge verdict (LLM judge A, not a human) is shown for comparison.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.qs.map((q, i) => opt(i, q.id + ' (' + q.type + '): ' + q.question)));
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = Number(qSel.value); render(); });
    const nSl = K.slider('max order N', 1, 4, 1, st.N, v => { st.N = v; render(); });
    const vSl = K.slider('highlight matches of order', 1, 4, 1, st.view, v => { st.view = v; render(); });
    const sm = K.el('input', { type: 'checkbox', 'aria-label': 'smoothing' }), sp = K.el('input', { type: 'checkbox', 'aria-label': 'strip tags', checked: 'checked' });
    sm.addEventListener('change', () => { st.smooth = sm.checked; render(); }); sp.addEventListener('change', () => { st.strip = sp.checked; render(); });
    const res = K.resultBox(), resC = K.resultBox(), pr = K.el('div', { class: 'row' }), view = K.el('div'), tbl = K.el('div');
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tab = K.el('div'), corp = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      K.el('div', { class: 'row' }, nSl.node), K.el('div', { class: 'row' }, vSl.node),
      K.el('div', { class: 'row' }, K.el('label', {}, sm, ' smoothing (add 1 for n > 1)'), K.el('label', {}, sp, ' drop [pNNN] citation tags')),
      K.el('h4', {}, 'One answer (sentence-level BLEU)'), pr, res.node, view, tbl, formula, note,
      K.el('h4', {}, 'All 9 answers of the arm together (corpus-level BLEU)'), resC.node, tab, corp);
    const verdict = (arm, id) => D.ac && D.ac.per_question && D.ac.per_question[arm] ? D.ac.per_question[arm][id] : undefined;

    function render() {
      const q = D.qs[st.q], cand = q.answers[st.arm], s = sentence(q.gold, cand, st.N, st.smooth, st.strip);
      res.set(s.bleu, 4);
      const v = verdict(st.arm, q.id);
      pr.replaceChildren(...s.p.map((p, i) => K.el('span', { class: 'num', style: p === 0 ? 'color:var(--warn,#e5484d)' : '' }, 'p' + (i + 1) + ' = ' + fmt(p, 3))),
        K.el('span', { class: 'num' }, 'BP = ' + fmt(s.bp, 3)), v !== undefined ? K.el('span', { class: 'num good' }, 'judge A correctness = ' + v) : '');
      view.replaceChildren(K.el('div', { class: 'hint' }, 'gold answer (' + s.r.length + ' words): ' + q.gold),
        K.el('div', { class: 'hint' }, 'system answer ' + st.arm + ' (' + s.c.length + ' words); coloured = inside a clipped matched ' + st.view + '-gram'),
        chips(K, s.c, s.os[st.view - 1].covered, 'var(--k12, #7c9cff)'));
      tbl.replaceChildren(orderTable(K, s, st.N, st.smooth)); formula.textContent = formulaText(s, st.N, st.smooth);
      note.textContent = 'Source: gold answer of ' + q.id + ' (data/questions.json) and the arm ' + st.arm + ' answer (answers/answers.json), copied to demos/data/bleu.real.json. ' +
        (s.bleu === 0 ? 'Sentence-level BLEU is 0 here' + (v === 1 ? ' although the judge marks the answer correct' : '') + ': an order has no match (a short gold answer has few 4-grams, the system answer words them differently). Tick smoothing to see a non-zero number; it is a convention, not a measurement. '
          : '') + (s.c.length > 3 * s.r.length ? 'The answer is ' + fmt(s.c.length / s.r.length, 1) + 'x longer than the gold, so the brevity penalty is 1 and precision does the damage. ' : '');
      // corpus
      const rows = D.qs.map(qq => ({ qq, s: sentence(qq.gold, qq.answers[st.arm], st.N, st.smooth, st.strip) }));
      const C = corpus(D.qs.map(qq => [qq.gold, qq.answers[st.arm]]), st.N, st.smooth, st.strip);
      resC.set(C.bleu, 4);
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['q', 'ref w', 'ans w', 'matches (n=1..4)', 'sentence BLEU-' + st.N, 'judge'].map(h => K.el('th', { style: 'padding:1px 5px;text-align:right' }, h))));
      rows.forEach((o, i) => t.append(K.el('tr', { style: i === st.q ? 'font-weight:700' : '' }, ...[o.qq.id, o.s.r.length, o.s.c.length, o.s.os.map(x => x.match).join(' / '), fmt(o.s.bleu, 3), verdict(st.arm, o.qq.id) === undefined ? '-' : verdict(st.arm, o.qq.id)].map(c => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(c))))));
      const zeros = rows.filter(o => o.s.bleu === 0).length;
      t.append(K.el('tr', { style: 'border-top:2px solid rgba(128,128,128,.5);font-weight:700' }, ...['corpus', C.RL, C.CL, C.M.join(' / '), fmt(C.bleu, 3), ''].map(c => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(c)))));
      tab.replaceChildren(K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t));
      const armC = a => corpus(D.qs.map(qq => [qq.gold, qq.answers[a]]), st.N, st.smooth, st.strip).bleu;
      const jm = a => { const xs = D.qs.map(qq => verdict(a, qq.id)).filter(x => x !== undefined); return xs.length ? fmt(xs.reduce((p, c) => p + c, 0) / xs.length, 2) : '-'; };
      corp.textContent = 'Corpus BLEU-' + st.N + ' adds the matches and the n-gram counts of all 9 answers before taking the logs, so one zero does not kill the score: ' + zeros + ' of 9 sentence scores are 0 for this arm, the corpus score is ' + fmt(C.bleu, 4) + '. ' +
        'All arms (same settings): A ' + fmt(armC('A'), 4) + ', B ' + fmt(armC('B'), 4) + ', C ' + fmt(armC('C'), 4) + '; mean judge A correctness on these 9: A ' + jm('A') + ', B ' + jm('B') + ', C ' + jm('C') + '. ' +
        'The order of BLEU (C above B above A) is the opposite of the judge order (A highest): the no-retrieval answers are long, fluent and correct but use other words than the short gold sentence. n = 9 and one reference per question, so this shows the validity problem, it does not rank the arms. The brevity penalty is 1 for every arm (answers are about 3 to 4 times longer than the gold in total), so here BLEU is precision only.';
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

  const api = { defaults, compute, mount, tokenize, sentence, corpus, bleuFromCounts };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['bleu'] = api;
})(this);
