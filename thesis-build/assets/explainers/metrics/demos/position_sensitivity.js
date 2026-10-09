/* Position sensitivity (Lost in the Middle): Acc(p) = share of questions answered correctly when the gold passage sits at position p;
   gap = max Acc - min Acc. Real example (default): a small NEW experiment run for this page (10 questions, 5 or 10 passages, gold moved
   to 3 positions, the model re-answers each time) loaded from data/position_sensitivity.real.json. compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { acc: { 1: 0.78, 5: 0.62, 10: 0.55, 15: 0.6, 20: 0.74 } };   // gap = 0.78 - 0.55 = 0.23

  /* PURE: gap = max_p Acc(p) - min_p Acc(p). Returns a number. */
  function compute(inp) {
    const v = Object.values(inp.acc);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  }
  /* Liu et al. 2023 Sec. 2: correct if ANY gold answer string appears in the output as a SUBSTRING (case-insensitive; not exact match).
     Same normalisation as the build script: lowercase, unicode minus to '-', runs of whitespace/hyphens/dashes to one space. */
  const normTxt = s => String(s).toLowerCase().replace(/\u2212/g, '-').replace(/[\s\-\u2010\u2011\u2013\u2014]+/g, ' ');
  function anyGold(golds, output) { const o = normTxt(output); return golds.some(g => o.includes(normTxt(g))); }
  function wilson(k, n) {
    if (!n) return [NaN, NaN];
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
  }

  /* row of N boxes with the gold passage highlighted; returns a node */
  function boxes(K, N, gold) {
    const w = 100 / N;
    const row = K.el('div', { role: 'img', 'aria-label': 'context of ' + N + ' passages, gold passage at position ' + gold, style: 'display:flex;gap:3px;max-width:880px' });
    for (let i = 1; i <= N; i++) row.append(K.el('div', { style: 'flex:1 1 0;min-width:0;height:34px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:.75em;border:2px solid var(--' + (i === gold ? 'he' : 'line') + ',#445);background:' + (i === gold ? 'var(--he)' : 'transparent') + ';color:' + (i === gold ? '#08201c' : 'inherit') }, String(i)));
    return row;
  }
  /* accuracy-vs-position chart: pts [{p, acc, lo, hi}], x domain 1..N; fluid width via viewBox */
  function chart(K, pts, N, hi) {
    const W = 600, H = 190, L = 38, R = 14, T = 12, B = 30;
    const x = p => L + (N === 1 ? 0 : (p - 1) / (N - 1)) * (W - L - R), y = a => T + (1 - a) * (H - T - B);
    const s = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'accuracy by gold position', style: 'width:100%;max-width:880px;height:auto' });
    [0, 0.5, 1].forEach(a => { s.append(K.svg('line', { x1: L, x2: W - R, y1: y(a), y2: y(a), stroke: 'currentColor', 'stroke-opacity': .15 }), K.svg('text', { x: 4, y: y(a) + 4, 'font-size': 11, fill: 'currentColor', 'fill-opacity': .6 }, String(a))); });
    pts.forEach(q => {
      if (q.lo !== undefined) s.append(K.svg('line', { x1: x(q.p), x2: x(q.p), y1: y(q.lo), y2: y(q.hi), stroke: 'var(--k12)', 'stroke-width': 3, 'stroke-opacity': .5 }));
    });
    s.append(K.svg('polyline', { points: pts.map(q => x(q.p) + ',' + y(q.acc)).join(' '), fill: 'none', stroke: 'var(--ai)', 'stroke-width': 2 }));
    pts.forEach(q => {
      s.append(K.svg('circle', { cx: x(q.p), cy: y(q.acc), r: q.p === hi ? 7 : 5, fill: q.p === hi ? 'var(--he)' : 'var(--ai)' }),
        K.svg('text', { x: x(q.p), y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, 'p=' + q.p));
    });
    return s;
  }

  function mountToy(el) {
    const K = root.DemoKit, N = 20, P = [1, 5, 10, 15, 20];
    const st = Object.assign({}, defaults.acc), pos = { v: 10 };
    const shell = K.shell(el, 'Toy example (break it)',
      'Invented numbers in the shape Lost in the Middle reports: a 20-passage context, accuracy highest when the gold passage is first or last, lowest in the middle. Drag the five accuracy sliders; move the gold passage along the row.');
    const sliders = P.map(p => K.slider('Acc(p=' + p + ')', 0, 1, 0.01, st[p], v => { st[p] = v; render(); }));
    const gs = K.slider('gold passage position', 1, N, 1, pos.v, v => { pos.v = v; render(); });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const view = K.el('div'), btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (U shape)', () => { P.forEach((p, i) => { st[p] = defaults.acc[p]; sliders[i].set(st[p]); }); render(); }),
      btn('Break it: flat curve', () => { P.forEach((p, i) => { st[p] = 0.8; sliders[i].set(0.8); }); render(); }),
      btn('Break it: only the middle is hard', () => { P.forEach((p, i) => { st[p] = p === 10 ? 0.2 : 0.9; sliders[i].set(st[p]); }); render(); }));
    shell.append(presets, ...sliders.map(s => K.el('div', {}, s.node)), K.el('div', {}, gs.node), view, res.node, formula, note);
    function interp(p) {   // piecewise linear through the five points (the shape between the points is an assumption)
      for (let i = 0; i < P.length - 1; i++) if (p >= P[i] && p <= P[i + 1]) return st[P[i]] + (st[P[i + 1]] - st[P[i]]) * (p - P[i]) / (P[i + 1] - P[i]);
      return st[P[P.length - 1]];
    }
    function render() {
      view.replaceChildren(boxes(K, N, pos.v), chart(K, P.map(p => ({ p, acc: st[p] })), N, pos.v));
      const g = compute({ acc: st });
      res.set(g, 3);
      formula.textContent = `gap = max Acc - min Acc = ${K.fmt(Math.max(...Object.values(st)), 2)} - ${K.fmt(Math.min(...Object.values(st)), 2)} = ${K.fmt(g, 3)}\nwith the gold passage at position ${pos.v}: Acc about ${K.fmt(interp(pos.v), 2)} (straight line between the five points; an assumption)`;
      note.textContent = 'A flat curve (gap 0) is the goal. A model can have a small gap and still be weak: the gap only says whether order matters, not whether answers are right. With few questions each point has a wide interval.';
    }
    render();
  }

  /* ---- real data ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/position_sensitivity.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('position_sensitivity.real.json ' + r.status); return r.json(); });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const conds = Object.keys(D.conditions);
    const st = { N: conds[0], p: null, q: 0 };
    const shell = K.shell(el, 'Real example: where the gold passage sits, ' + D.conditions[conds[0]].length + ' questions re-answered',
      'A new small experiment made for this page (the answer study had no position run). The ' + D.conditions[conds[0]].length + ' answerable questions with ONE gold passage; context = the gold passage plus distractors (the next-best RRF passages, fixed order); only the position of the gold passage changes. Answerer ' + D.answer_model + ', temperature 0, one run, correct = Liu et al. rule (ANY gold answer string appears in the output as a substring, not exact match; the gold strings are our key phrases for the question), computed live in this page from the stored answers; the judge ' + D.judge_model + ' score is a cross-check. Cost USD ' + D.usd + '. ' + D.caveats[0] + '. ' + D.caveats[2] + '. ' + D.caveats[3] + '. ' + D.caveats[D.caveats.length - 1]);
    const opt = (v, t) => K.el('option', { value: v }, t);
    const nSel = K.el('select', { 'aria-label': 'number of passages in the context' }, conds.map(n => opt(n, n + ' passages in the context')));
    nSel.addEventListener('change', () => { st.N = nSel.value; st.p = null; render(); });
    const qSel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%;width:100%' }, D.conditions[conds[0]].map((d, i) => opt(i, d.id + ': ' + d.question)));
    qSel.addEventListener('change', () => { st.q = Number(qSel.value); render(); });
    const pBox = K.el('div', { class: 'row', role: 'group', 'aria-label': 'gold position' });
    const view = K.el('div'), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const ans = K.el('div', { class: 'formula', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'context ', nSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;max-width:100%' }, 'question ', qSel)), pBox, view, res.node, formula, ans, note);

    function render() {
      const Q = D.conditions[st.N], n = Q.length, N = Number(st.N), poss = Object.keys(Q[0].positions).map(Number);
      if (st.p === null || !poss.includes(st.p)) st.p = poss[0];
      pBox.replaceChildren(...poss.map(p => K.el('button', { type: 'button', 'aria-pressed': p === st.p ? 'true' : 'false', onclick: () => { st.p = p; render(); } }, 'gold at position ' + p)));
      const accs = {}, pts = poss.map(p => {
        const k = Q.reduce((s, d) => s + (anyGold(d.check_terms, d.positions[p].answer) ? 1 : 0), 0), ci = wilson(k, n); accs[p] = k / n;
        return { p, acc: k / n, lo: ci[0], hi: ci[1] };
      });
      view.replaceChildren(boxes(K, N, st.p), chart(K, pts, N, st.p));
      const g = compute({ acc: accs });
      res.set(g, 3);
      formula.textContent = 'Acc(p) = ' + pts.map(q => `${Math.round(q.acc * n)}/${n} = ${K.fmt(q.acc, 2)} (95% Wilson [${K.fmt(q.lo, 2)}, ${K.fmt(q.hi, 2)}]) at p=${q.p}`).join('\n         ') +
        `\ngap = max - min = ${K.fmt(Math.max(...Object.values(accs)), 2)} - ${K.fmt(Math.min(...Object.values(accs)), 2)} = ${K.fmt(g, 3)}` +
        `\ncross-check, stricter rule (ALL key phrases appear): ` + poss.map(p => `${Q.reduce((s, d) => s + d.positions[p].terms_ok, 0)}/${n} at p=${p}`).join(', ') +
        `\ncross-check, LLM judge score 1.0: ` + poss.map(p => `${Q.reduce((s, d) => s + d.positions[p].correct, 0)}/${n} at p=${p}`).join(', ');
      const d = Q[st.q], r = d.positions[st.p];
      ans.textContent = `${d.id} with the gold passage ${d.gold_passage} at position ${st.p}:\ncontext order: ${r.context_ids.join(' ')}\nanswer: ${r.answer}\ngold strings: ${d.check_terms.join(' | ')} -> substring rule says ${anyGold(d.check_terms, r.answer) ? 'correct' : 'wrong'}\njudge score ${r.score}: ${r.judge_reason}`;
      note.textContent = g === 0
        ? 'The curve is flat at the ceiling: with 5 or 10 short passages this model finds the gold passage wherever it sits. That does NOT contradict Lost in the Middle (20+ passages, long contexts, weaker models); it means this context is too easy to show the effect. Any difference between the substring rule and the judge count is phrasing (an answer is right but words the key phrase differently), not position.'
        : 'The gap is non-zero. With n = ' + n + ' each point carries a wide interval: check it before reading a U shape into it.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
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

  const api = { defaults, compute, mount, anyGold };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['position_sensitivity'] = api;
})(this);
