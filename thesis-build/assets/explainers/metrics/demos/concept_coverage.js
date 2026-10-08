/* Concept coverage demo. Real example (default): which expected KG concepts does each arm's answer mention? OUR rule: node name or alias in the answer text. Toy example: the catalogue's backpropagation prerequisites (3/4). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    required: ['chain rule', 'gradient', 'loss function', 'computational graph'],
    answer: 'Backpropagation applies the chain rule to get the gradient of the loss function with respect to every weight, layer by layer.',
  };
  /* The pack's normalisation: lower-case, NFKD, strip punctuation, '&' -> and, hyphen -> space, drop leading the/a/an, trailing 's' off words of 4+ letters (not ss/is/us). */
  function norm(s) {
    let w = String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/-/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);
    while (w.length && ['the', 'a', 'an'].includes(w[0])) w = w.slice(1);
    return w.map(x => (x.length >= 4 && x.endsWith('s') && !/(ss|is|us)$/.test(x)) ? x.slice(0, -1) : x).join(' ');
  }
  const has = (textNorm, key) => key !== '' && (' ' + textNorm + ' ').includes(' ' + key + ' ');

  /* PURE: Cov = |C_ans ∩ C_req| / |C_req|, a concept counts as present when its normalised phrase occurs in the answer. */
  function compute(inp) {
    const req = Array.from(new Set(inp.required.map(norm).filter(Boolean)));
    if (!req.length) return 0;
    const t = norm(inp.answer);
    return req.filter(c => has(t, c)).length / req.length;
  }

  /* ---------- OUR real-graph rule (pure) ----------
     A node is mentioned when its name or an alias (normalised, whole-word phrase, >= 3 characters) occurs in the text.
     Expected set, mode 'gold': nodes mentioned in the gold answer (answerable questions only).
     Expected set, mode 'linked1': nodes linked to the question by graph/entity_linking.json plus their 1-hop neighbours (undirected). */
  function compileGraph(g) {
    const keys = {}, adj = {};
    g.nodes.forEach(n => { keys[n.id] = Array.from(new Set([n.name].concat(n.aliases || []).map(norm).filter(k => k.length >= 3))); adj[n.id] = new Set(); });
    g.edges.forEach(e => { if (e.source !== e.target) { adj[e.source].add(e.target); adj[e.target].add(e.source); } });
    return { g, keys, adj };
  }
  function mentioned(C, text) { const t = norm(text); return Object.keys(C.keys).filter(id => C.keys[id].some(k => has(t, k))); }
  function expected(C, q, mode) {
    if (mode === 'gold') return q.type === 'unanswerable' ? [] : mentioned(C, q.gold_answer);
    const linked = q.linked.map(x => x.node), s = new Set(linked);
    linked.forEach(x => C.adj[x].forEach(y => s.add(y)));
    return Array.from(s).sort();
  }
  const cov = (exp, got) => { if (!exp.length) return NaN; const g = new Set(got); return exp.filter(x => g.has(x)).length / exp.length; };
  const meanOf = xs => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };

  function mountToy(el) {
    const K = root.DemoKit, st = { required: defaults.required.join(', '), answer: defaults.answer };
    const shell = K.shell(el, 'Toy example (break it)', 'Target concept "backpropagation"; the graph says four prerequisites are needed (invented example). Type or paste an answer: each prerequisite chip lights up when its name appears. No model runs.');
    const mk = (label, key, tag) => { const i = K.el(tag, { 'aria-label': label, style: 'width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit' }); if (tag === 'textarea') i.rows = 3; i.value = st[key]; i.addEventListener('input', () => { st[key] = i.value; render(); }); return K.el('label', { style: 'display:block' }, label, i); };
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), chips = K.el('div'), note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = (r, a) => { st.required = r; st.answer = a; shell.querySelector('input').value = r; shell.querySelector('textarea').value = a; render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults.required.join(', '), defaults.answer)),
      btn('Break it: name the concepts, explain nothing', () => set(defaults.required.join(', '), 'chain rule, gradient, loss function, computational graph.')),
      btn('Break it: right idea, other words', () => set(defaults.required.join(', '), 'Backpropagation works backwards through the network, multiplying local derivatives of the error to get the slope for each weight.'))),
      mk('required prerequisites (comma separated)', 'required', 'input'), mk('answer text', 'answer', 'textarea'), chips, res.node, formula, note);
    function render() {
      const req = Array.from(new Set(st.required.split(',').map(x => x.trim()).filter(Boolean))), t = norm(st.answer);
      chips.replaceChildren(...req.map(c => { const ok = has(t, norm(c)); return K.el('span', { style: 'display:inline-block;margin:2px 4px 2px 0;padding:1px 7px;border:2px solid var(--' + (ok ? 'he' : 'warn') + ')' }, c + (ok ? ' (mentioned)' : ' (missing)')); }));
      const v = compute({ required: req, answer: st.answer }), h = req.filter(c => has(t, norm(c))).length;
      res.set(v, 4);
      formula.textContent = req.length ? `Cov = |C_ans ∩ C_req| / |C_req| = ${h} / ${req.length} = ${K.fmt(v, 4)}` : 'Cov = 0 / 0 (add prerequisites)';
      note.textContent = 'Blind spot: mentioning is not explaining (the first break-it scores 1), and a paraphrase counts as missing (the second scores 0).';
    }
    render();
  }

  /* ---------- real ---------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('graph/graph.json'), get('graph/entity_linking.json'), get('data/questions.json'), get('answers/answers.json')]).then(a => buildReal(a[0], a[1], a[2], a[3]));
    return realData;
  }
  function buildReal(g, el, questions, answers) {
    const C = compileGraph(g), nm = {}, ty = {}; g.nodes.forEach(n => { nm[n.id] = n.name; ty[n.id] = n.type; });
    const qs = {}; questions.forEach(q => { qs[q.id] = Object.assign({}, q, { linked: el.questions[q.id].linked }); });
    const qids = Array.from(new Set(answers.map(a => a.qid))).sort();
    const ans = {}; answers.forEach(a => { ans[a.qid + '|' + a.arm] = a; });
    const D = { C, nm, ty, qs, qids, ans, exp: {}, got: {} };
    qids.forEach(q => { ['gold', 'linked1'].forEach(m => { D.exp[q + '|' + m] = expected(C, qs[q], m); }); ['A', 'B', 'C'].forEach(a => { D.got[q + '|' + a] = mentioned(C, ans[q + '|' + a].answer); }); });
    return D;
  }
  const covReal = (D, q, a, mode) => cov(D.exp[q + '|' + mode], D.got[q + '|' + a]);

  function mountReal(el, D) {
    const K = root.DemoKit, st = { arm: 'C', q: 'q16', mode: 'gold' };
    const shell = K.shell(el, 'Real example: does the answer mention the concepts the knowledge graph expects?',
      'Scale: 12 questions (9 answerable), answers of arms A (no retrieval), B (hybrid RRF top-5), C (dense top-5 + graph passages), graph of 662 nodes extracted by an LLM. Rule (ours): a node is mentioned when its name or alias occurs in the text (whole word, normalised). Expected set: either the nodes mentioned in the gold answer, or the nodes linked to the question plus their 1-hop neighbours. The graph is noisy and its aliases do not merge ("SVM" and "support vector machine" are two nodes), so a correct paraphrase can count as missing. The expected list is defined by the same graph that arm C retrieves from, which favours C by construction. Not an evaluation of learning.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const mSel = K.el('select', { 'aria-label': 'expected set' }, [opt('gold', 'expected = nodes of the gold answer'), opt('linked1', 'expected = linked nodes + 1-hop neighbours')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question.slice(0, 70)))); qSel.value = st.q;
    const info = K.el('p', { class: 'hint' }), chips = K.el('div', { role: 'group', 'aria-label': 'expected concepts' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), table = K.el('div', { class: 'formula', style: 'overflow-x:auto' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, mSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, res.node, formula, chips, K.el('h3', { style: 'font-size:16px' }, 'Arm means over the questions with an expected set'), table, note);
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); mSel.addEventListener('change', () => { st.mode = mSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    function render() {
      const q = D.qs[st.q], exp = D.exp[st.q + '|' + st.mode], got = new Set(D.got[st.q + '|' + st.arm]), a = D.ans[st.q + '|' + st.arm];
      info.textContent = q.question + '  | gold answer: ' + q.gold_answer + (a.refused ? '  | this arm REFUSED to answer' : '') + '  | answer length ' + a.answer.split(/\s+/).length + ' words';
      chips.replaceChildren();
      exp.slice(0, 60).forEach(id => { const ok = got.has(id); chips.append(K.el('span', { style: 'display:inline-block;margin:2px 4px 2px 0;padding:1px 7px;border:2px solid var(--' + (ok ? 'he' : 'warn') + ')' }, D.nm[id] + (ok ? ' (in answer)' : ' (missing)'))); });
      if (exp.length > 60) chips.append(K.el('p', { class: 'hint' }, '... and ' + (exp.length - 60) + ' more expected nodes (counted in the score).'));
      if (!exp.length) { chips.append(K.el('p', { class: 'hint bad' }, st.mode === 'gold' && q.type === 'unanswerable' ? 'An unanswerable question has no gold answer: no expected concepts, coverage is undefined (n/a), not zero.' : 'No expected nodes for this question (the entity linker found none): coverage is undefined (n/a).')); }
      const v = cov(exp, [...got]), h = exp.filter(x => got.has(x)).length;
      res.set(v, 3);
      formula.textContent = exp.length ? `Cov = |C_ans ∩ C_req| / |C_req| = ${h} / ${exp.length} = ${K.fmt(v)}` : 'Cov = n/a (|C_req| = 0)';
      const row = ar => { const xs = D.qids.map(q2 => covReal(D, q2, ar, st.mode)); const ok = xs.filter(Number.isFinite); return ar + ': ' + K.fmt(meanOf(xs), 3) + ' (n=' + ok.length + ')'; };
      const bc = D.qids.map(q2 => covReal(D, q2, 'C', st.mode) - covReal(D, q2, 'B', st.mode)).filter(Number.isFinite);
      table.textContent = ['A', 'B', 'C'].map(row).join('    ') + '\nC minus B, per question: mean ' + K.fmt(meanOf(bc), 3) + ', C higher on ' + bc.filter(x => x > 1e-9).length + ', lower on ' + bc.filter(x => x < -1e-9).length + ', equal on ' + bc.filter(x => Math.abs(x) <= 1e-9).length + ' of ' + bc.length + '.';
      note.textContent = st.mode === 'gold' ? 'Arm A (no retrieval) scores close to B because the model knows the topic: coverage of the gold concepts is not groundedness. n is small; C minus B is not distinguishable from noise.' : 'With linked nodes + 1-hop neighbours the expected set is large (up to ~45 nodes), so every arm scores low and nearly equal: no answer can be expected to name them all. The set is built from a noisy entity linker.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, norm, compileGraph, buildReal, covReal, cov };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['concept_coverage'] = api;
})(this);
