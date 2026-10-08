/* TutorEval key-point checklist score. Real example = PARTIAL: no tutor dialogues; our key-point split of the real gold answers
   + our lexical coverage rule on the real system answers, next to the pack's judged correctness. NO pedagogical validity claimed. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { covered: [1, 1, 1, 0] };   // 4 key points, answer covers 3

  /* PURE: S_q = (1/|K|) * sum covered_k   (the page-level TutorEval score is the mean of S_q over questions) */
  function compute(inp) {
    const k = inp.covered.length;
    return k ? inp.covered.reduce((p, c) => p + (c ? 1 : 0), 0) / k : 0;
  }

  /* ---- OUR rules (not TutorEval's LLM judge). Pure, no DOM. ---- */
  const STOP = new Set('the a an it its this that these those for in on of and or to is are as by with from at when if which while where there their they he she we not no one each both all any some such be has have so than then into'.split(' '));
  const norm = s => String(s).toLowerCase().replace(/[-−–]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  /* our key-point split: cut the gold answer at ';', ' whereas ', ', and ' and sentence ends; keep at most 3 */
  function splitKeyPoints(gold) {
    return String(gold).split(/;|\bwhereas\b|, and |\. /).map(s => s.trim()).filter(Boolean).slice(0, 3);
  }
  const words = s => norm(s).split(' ').filter(w => w && !STOP.has(w) && (w.length >= 3 || /^\d+$/.test(w)));
  /* our lexical coverage rule: >= 60 % of the key point's content words occur in the answer
     (a word matches a token that is equal, or shares its first 5 letters when the word has >= 5 letters) */
  function coverage(kp, answer) {
    const kw = words(kp), aw = norm(answer).split(' ');
    if (!kw.length) return { hit: 0, n: 0, covered: false };
    const hit = kw.filter(w => aw.some(a => a === w || (w.length >= 5 && a.slice(0, 5) === w.slice(0, 5)))).length;
    return { hit, n: kw.length, covered: hit / kw.length >= 0.6 };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const KP = ['Key point 1 (expert wrote it)', 'Key point 2', 'Key point 3', 'Key point 4'];
    const st = defaults.covered.slice();
    const shell = K.shell(el, 'Toy example (break it)', 'Toy checklist, not measured: an expert wrote 4 key points; tick the ones the answer covers. The score is the ticked share.');
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const boxes = KP.map((t, i) => { const c = K.el('input', { type: 'checkbox' }); c.checked = !!st[i]; c.addEventListener('change', () => { st[i] = c.checked ? 1 : 0; render(); }); return c; });
    const rows = KP.map((t, i) => K.el('div', { class: 'row' }, K.el('label', {}, boxes[i], ' ' + t + ' covered')));
    const set = a => { a.forEach((v, i) => { st[i] = v; boxes[i].checked = !!v; }); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example (3 of 4)', () => set([1, 1, 1, 0])),
      btn('Break it: right answer, other words', () => set([0, 0, 0, 0]))), ...rows, res.node, formula, note);
    function render() {
      const s = compute({ covered: st }), h = st.reduce((p, c) => p + c, 0);
      res.set(s, 3);
      formula.textContent = `S = ${h} / ${st.length} = ${K.fmt(s, 3)}`;
      note.textContent = 'Blind spot: key points are written by one author. A correct answer in different words, or a good alternative explanation, can tick none and still score 0. The paper uses an LLM judge and a graded 1 to 10 scale; this simplified form is ours.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json'), get('answers/correctness.json')]).then(a => {
      const qs = {}; a[1].forEach(q => { qs[q.id] = q; });
      const corr = {}; a[2].forEach(c => { corr[c.qid + '|' + c.arm] = c.score; });
      return { ans: a[0].filter(r => qs[r.qid].type !== 'unanswerable'), qs, corr };
    });
    return realData;
  }

  function scoreRow(r, D) {
    const kps = splitKeyPoints(D.qs[r.qid].gold_answer), cov = kps.map(k => coverage(k, r.answer));
    return { kps, cov, S: compute({ covered: cov.map(c => c.covered ? 1 : 0) }), judged: D.corr[r.qid + '|' + r.arm] };
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: D.ans[0].qid, over: {} };
    const shell = K.shell(el, 'Real example: partial (our key-point split on the real gold and system answers)',
      'No tutor dialogues exist in the pack, so this is NOT a pedagogy measure and there is no expert checklist: real example pending for real tutor dialogues. We split each real gold answer into 1 to 3 key points (our key-point split) and judge coverage with a lexical rule of ours, in this page, next to the pack\'s LLM-judged answer correctness. 9 answerable questions x 3 arms; n = 9 per arm is demo scale; Q&A answers by a RAG answerer, not tutor turns.');
    const rules = K.el('div', { class: 'formula' });
    rules.textContent = 'Our key-point split: cut the gold answer at ";", " whereas ", ", and " and sentence ends, keep at most 3 pieces.\nOur coverage rule: a key point is covered when >= 60 % of its content words occur in the answer (a word matches an equal token, or one sharing its first 5 letters).\nS = covered key points / key points. Pack judged correctness = the pack\'s LLM judge score for the same answer (0 to 1).';
    const tbl = K.el('div');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, [...new Set(D.ans.map(r => r.qid))].map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.addEventListener('change', () => { st.arm = aSel.value; st.over = {}; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; st.over = {}; render(); });
    const view = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    shell.append(rules, tbl, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), view, res.node, formula, note);
    const all = D.ans.map(r => Object.assign({ r }, scoreRow(r, D)));
    function render() {
      const tb = K.el('table'); tb.append(K.el('tr', {}, ['arm', 'S, our rule (n=9)', 'pack judged correctness (n=9)'].map(h => K.el('th', {}, h))));
      ['A', 'B', 'C'].forEach(arm => {
        const rs = all.filter(x => x.r.arm === arm), m = f => rs.reduce((p, x) => p + f(x), 0) / rs.length;
        tb.append(K.el('tr', {}, [arm, K.fmt(m(x => x.S), 2), K.fmt(m(x => x.judged), 2)].map(t => K.el('td', {}, t))));
      });
      tbl.replaceChildren(tb);
      const row = all.find(x => x.r.qid === st.q && x.r.arm === st.arm);
      const covered = row.cov.map((c, i) => (i in st.over) ? st.over[i] : c.covered);
      const kpEls = row.kps.map((k, i) => {
        const c = K.el('input', { type: 'checkbox' }); c.checked = covered[i];
        c.addEventListener('change', () => { st.over[i] = c.checked; render(); });
        return K.el('div', { class: 'row' }, K.el('label', {}, c, ' ' + k + '  [' + row.cov[i].hit + '/' + row.cov[i].n + ' content words found' + (i in st.over ? ', ticked by hand' : '') + ']'));
      });
      view.replaceChildren(K.el('div', { class: 'formula' }, `Gold answer: ${D.qs[st.q].gold_answer}\n\nSystem answer (${st.arm}, ${st.q}; context ${JSON.stringify(row.r.context_ids)}):\n${row.r.answer}`), ...kpEls);
      const s = compute({ covered: covered.map(c => c ? 1 : 0) });
      res.set(s, 3);
      formula.textContent = `S = ${covered.filter(Boolean).length} / ${covered.length} = ${K.fmt(s, 3)}   (our rule${Object.keys(st.over).length ? ' + your ticks' : ''})   |   pack judged correctness for this answer = ${K.fmt(row.judged, 2)}`;
      note.textContent = 'Untick or tick a key point to override our rule and see S move. Our rule is lexical: it misses paraphrase and can credit an answer that repeats the words wrongly, so it can disagree with the LLM judge. Our split of a short gold answer is not an expert checklist. No pedagogical validity is claimed; real tutor dialogues with expert key points: real example pending.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example (partial)'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
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

  const api = { defaults, compute, splitKeyPoints, coverage, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['tutoreval_keypoints'] = api;
})(this);
