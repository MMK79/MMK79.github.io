/* Answer relevancy (Ragas) demo: AR = mean_i cos(E(q), E(q_hat_i)), q_hat_i = N questions an LLM generates from the answer alone.
   Real mode (default): the 36 real answers of the answer study (12 questions x arms A/B/C); for each answer qwen3.7-plus generated 3 questions
   (data/answer_relevancy.build.py, USD 0.0049), embedded locally with all-MiniLM-L6-v2; the cosines and the mean are recomputed live from the stored 384-d vectors.
   Toy mode: 2-D arrows, invented numbers. compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const unit = c => [c, Math.sqrt(1 - c * c)];
  const defaults = { q: [1, 0], gen: [unit(0.9), unit(0.8), unit(0.6)] };   // cosines 0.9, 0.8, 0.6

  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), norm = a => Math.sqrt(dot(a, a));
  const cosine = (a, b) => { const n = norm(a) * norm(b); return n === 0 ? 0 : dot(a, b) / n; };
  /* PURE: AR = mean of cos(E(q), E(q_hat_i)); optional noncommittal=1 -> 0 (the Ragas rule). Worked example result: 0.7667 */
  function compute(inp) {
    if (inp.noncommittal) return 0;
    const g = inp.gen; return g.length ? g.reduce((s, v) => s + cosine(inp.q, v), 0) / g.length : 0;
  }
  function ranks(v) { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function pearson(a, b) { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN; }
  const spearman = (a, b) => pearson(ranks(a), ranks(b));
  const mean = v => v.reduce((s, x) => s + x, 0) / v.length;
  const TAU = Math.PI / 180;

  /* ---------------- toy: arrows around the question ---------------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const st = { ang: defaults.gen.map(v => Math.atan2(v[1], v[0]) / TAU), label: '' };
    const shell = K.shell(el, 'Toy example (break it)', 'Invented 2-D unit vectors, not model output. The original question q points right (1, 0). Each slider turns one generated question; the score is the mean cosine of the three angles.');
    const sl = st.ang.map((a, i) => K.slider('angle of generated question ' + (i + 1) + ', degrees', 0, 180, 1, Math.round(a), v => { st.ang[i] = v; st.label = ''; render(); }));
    const svg = K.svg('svg', { viewBox: '-0.2 -1.15 1.7 1.4', style: 'width:100%;max-width:520px;height:auto;display:block', role: 'img', 'aria-label': 'question arrow and generated question arrows' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    const set = (angs, label) => { st.ang = angs.slice(); st.label = label || ''; sl.forEach((s, i) => s.set(Math.round(angs[i]))); render(); };
    const A = c => Math.acos(c) / TAU;
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => set([A(0.9), A(0.8), A(0.6)])),
      btn('Break it: restating the question', () => set([0, 0, 0], 'An answer that only repeats the question lets the LLM regenerate the same question: cosine 1, perfect score, no information given.')),
      btn('Break it: confident wrong answer, on topic', () => set([14, 20, 26], 'A wrong answer about the right topic still yields on-topic questions. Relevancy is not correctness.')),
      btn('Off-topic answer', () => set([80, 95, 110], 'An answer about something else yields questions pointing elsewhere: low score.'))),
      ...sl.map(s => K.el('div', { class: 'row' }, s.node)), res.node, svg, formula, note);
    function render() {
      const gen = st.ang.map(a => [Math.cos(a * TAU), Math.sin(a * TAU)]), q = [1, 0], v = compute({ q, gen });
      res.set(v, 4);
      const arrow = (p, col, t) => { const g = K.svg('g'); g.append(K.svg('line', { x1: 0, y1: 0, x2: p[0] * 1.2, y2: -p[1] * 1.2, stroke: col, 'stroke-width': 0.025, 'stroke-linecap': 'round' }));
        const tx = K.svg('text', { x: p[0] * 1.2 + 0.03, y: -p[1] * 1.2, fill: col, 'font-size': 0.1 }); tx.textContent = t; g.append(tx); return g; };
      svg.replaceChildren(arrow(q, '#f2a93b', 'q'), ...gen.map((p, i) => arrow(p, '#7c9cff', 'q' + (i + 1))));
      const cs = gen.map(p => cosine(q, p));
      formula.textContent = 'cos(E(q), E(q_i)) = ' + cs.map(c => K.fmt(c, 3)).join(', ') + '\nAR = (' + cs.map(c => K.fmt(c, 3)).join(' + ') + ') / 3 = ' + K.fmt(v, 4);
      note.textContent = st.label || 'Only angles count. The metric never looks at whether the answer is true.';
    }
    render();
  }

  /* ---------------- real ---------------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/answer_relevancy.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('answer_relevancy.real.json ' + r.status); return r.json(); });
    return realData;
  }
  const ARMS = { A: 'A: no retrieval', B: 'B: hybrid RRF top-5', C: 'C: dense top-5 + graph' };

  function mountReal(el, D) {
    const K = root.DemoKit, Q = D.questions.filter(q => q.arms.A), byId = {}; Q.forEach(q => { byId[q.id] = q; });
    const st = { q: 'q06', arm: 'B', ragas: true };
    const shell = K.shell(el, 'Real example: 36 real answers, 3 questions generated from each',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable), 3 arms, one run; a demo, not a benchmark. For each real answer the LLM ' + D.model + ' (temperature 0, thinking off; ' + D.calls + ' calls, ' + D.prompt_tokens + ' + ' + D.completion_tokens +
      ' tokens, USD ' + D.usd + ') wrote 3 questions that the answer would reply to, plus a "noncommittal" flag. Embeddings: ' + D.embedder + ' (384-d), local CPU. The cosines and the mean below are recomputed live from the stored vectors (rounded to 4 decimals). ' +
      'The Ragas rule gives 0 to a noncommittal answer; the checkbox turns it off to show the raw mean. "Judge" = LLM judge A\'s correctness (1 / 0.5 / 0), not a human label. Generated questions are one LLM run: another run or model gives other numbers.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, Object.keys(ARMS).map(a => opt(a, ARMS[a])));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, Q.map(q => opt(q.id, q.id + ' (' + q.type + '): ' + q.question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const rg = K.el('input', { type: 'checkbox', checked: 'checked', 'aria-label': 'apply the Ragas noncommittal rule' }); rg.addEventListener('change', () => { st.ragas = rg.checked; render(); });
    const jump = (q, arm) => () => { st.q = q; st.arm = arm; aSel.value = arm; qSel.value = q; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('On topic (q06 B)', jump('q06', 'B')),
      btn('Break it: confident wrong answer scores high (q21 A)', jump('q21', 'A')),
      btn('Break it: correct refusal scores ~0 (q21 B)', jump('q21', 'B')),
      btn('Wrong refusal (q09 B)', jump('q09', 'B')));
    const res = K.resultBox(), pr = K.el('div', { class: 'row' }), txt = K.el('div', { style: 'overflow-wrap:anywhere' }), genBox = K.el('div', { style: 'overflow-wrap:anywhere' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const bar = K.el('div', { style: 'height:14px;border-radius:7px;background:rgba(128,128,128,.25);max-width:520px', 'aria-hidden': 'true' }), fill = K.el('div', { style: 'height:100%;border-radius:7px;background:var(--ai,#f2a93b)' }); bar.append(fill);
    const note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tbl = K.el('div'), summ = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    shell.append(presets, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, rg, ' Ragas noncommittal rule')), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), pr, res.node, bar, formula, txt, genBox, note, tbl, summ);

    const score = (q, a, ragas) => { const A = q.arms[a]; return compute({ q: q.q_vec, gen: A.gen_vecs, noncommittal: ragas ? A.noncommittal : 0 }); };
    function render() {
      const q = byId[st.q], A = q.arms[st.arm], v = score(q, st.arm, st.ragas), raw = score(q, st.arm, false), cs = A.gen_vecs.map(g => cosine(q.q_vec, g));
      res.set(v, 3); fill.style.width = Math.max(0, Math.min(1, v)) * 100 + '%';
      pr.replaceChildren(K.el('span', { class: 'num good' }, 'AR = ' + K.fmt(v, 3)), K.el('span', { class: 'num' }, 'raw mean cosine = ' + K.fmt(raw, 3)), K.el('span', { class: 'num' }, 'noncommittal = ' + A.noncommittal),
        K.el('span', { class: 'num' }, 'judge A correctness = ' + A.judge_correctness), K.el('span', { class: 'num' }, A.refused ? 'system refused' : 'system answered'));
      txt.replaceChildren(K.el('div', { class: 'hint' }, 'original question q (' + q.id + ', data/questions.json)'), K.el('div', { style: 'color:var(--ai,#f2a93b)' }, q.question),
        K.el('div', { class: 'hint' }, 'answer, arm ' + st.arm + ' (answers/answers.json)'), K.el('div', { style: 'color:var(--k12,#7c9cff)' }, A.answer));
      genBox.replaceChildren(K.el('div', { class: 'hint' }, 'questions generated from that answer alone (LLM, cached in this page\'s data file)'),
        ...A.gen.map((g, i) => K.el('div', {}, K.el('span', { class: 'num' }, 'q' + (i + 1) + ' cos ' + K.fmt(cs[i], 3) + '  '), K.el('span', { style: 'color:var(--k12,#7c9cff)' }, g))));
      formula.textContent = 'cos(E(q), E(q_i)) = ' + cs.map(c => K.fmt(c, 4)).join(', ') + '\nAR = (' + cs.map(c => K.fmt(c, 4)).join(' + ') + ') / 3 = ' + K.fmt(raw, 4) +
        (st.ragas && A.noncommittal ? '\nnoncommittal = 1  ->  Ragas score = 0' : '');
      const cm = q.type === 'unanswerable', hall = cm && !A.refused;
      note.textContent = (A.refused && cm ? 'A correct refusal (judge ' + A.judge_correctness + '). The generated questions are unrelated to q ("What is the capital of France according to the provided text?"), so the raw cosine is about 0 and the Ragas rule also says 0: the metric punishes honest abstention. Use it with a refusal metric (negative rejection), not alone. ' : '') +
        (hall ? 'Arm A answered a question that has no answer in the corpus (judge ' + A.judge_correctness + ', hallucination) yet scores ' + K.fmt(v, 2) + ', as high as good answers: it is on topic and confident. Arm A never refused (0 of 3), so this mirrored case stands in for the arm-A blind spot. ' : '') +
        (st.q === 'q09' && st.arm === 'B' ? 'Arm B refused although the answer is in the corpus (judge 0); its questions drift to the passage text, and the noncommittal flag zeroes it. ' : '') +
        'Relevancy asks "is it about the question?", never "is it true?".';
      drawTable();
    }
    function drawTable() {
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['q', 'type', 'arm', 'AR', 'raw', 'noncomm.', 'judge'].map(h => K.el('th', { style: 'padding:1px 5px;text-align:right' }, h))));
      const per = { A: [], B: [], C: [] }, jper = { A: [], B: [], C: [] }, rawA = { A: [], B: [], C: [] }, xs = [], ys = [], un = { A: [], B: [], C: [] };
      Q.forEach(q => ['A', 'B', 'C'].forEach(arm => { const A = q.arms[arm], s = score(q, arm, st.ragas), r = score(q, arm, false), j = A.judge_correctness;
        if (q.type !== 'unanswerable') { per[arm].push(s); rawA[arm].push(r); jper[arm].push(j); xs.push(s); ys.push(j); } else un[arm].push(s);
        t.append(K.el('tr', { style: (q.id === st.q && arm === st.arm) ? 'font-weight:700' : '' }, ...[q.id, q.type, arm, K.fmt(s, 3), K.fmt(r, 3), A.noncommittal, j].map(x => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(x))))); }));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All 36 (question, arm) pairs'), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t)));
      summ.textContent = 'Mean AR over the 9 answerable questions: A ' + K.fmt(mean(per.A), 3) + ', B ' + K.fmt(mean(per.B), 3) + ', C ' + K.fmt(mean(per.C), 3) + '; judge correctness on the same 9: A ' + K.fmt(mean(jper.A), 2) + ', B ' + K.fmt(mean(jper.B), 2) + ', C ' + K.fmt(mean(jper.C), 2) +
        '. Spearman AR vs judge over the 27 answerable pairs: ' + K.fmt(spearman(xs, ys), 2) + ' (weak, n = 27: relevancy and correctness are different things). On the 3 unanswerable questions mean AR is A ' + K.fmt(mean(un.A), 2) + ' (all three hallucinated), B ' + K.fmt(mean(un.B), 2) + ', C ' + K.fmt(mean(un.C), 2) +
        ' (all three refused correctly): the arm that is wrong scores highest. n = 12, one run, one generator model, one embedding model.';
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

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['answer_relevancy'] = api;
})(this);
