/* Answer leakage rate. Real example = PARTIAL: the pack's system answers are direct Q&A answers, not tutor turns; we count the share
   that contain the gold answer's key terms (rule ours). That is what a tutor WOULD leak. NO pedagogical validity claimed. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { guided: 40, leaks: 6 };

  /* PURE: Leak = leaks / guided turns */
  function compute(inp) { return inp.guided > 0 ? inp.leaks / inp.guided : 0; }

  /* ---- OUR leak rule. Pure, no DOM. A reply leaks when ALL the gold answer's key terms (check_terms) occur in it
     (lower-cased, hyphens and punctuation turned to spaces). String matching: paraphrases are missed. ---- */
  const norm = s => String(s).toLowerCase().replace(/[-−–]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function termsFound(terms, text) { const n = norm(text); return terms.map(t => n.includes(norm(t))); }
  function leaks(terms, text) { return termsFound(terms, text).every(Boolean); }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { guided: defaults.guided, leaks: defaults.leaks };
    const shell = K.shell(el, 'Toy example (break it)', 'Toy counts, not measured: tutor turns on guided items (where the answer must be withheld) and how many of them contain the final answer.');
    const g = K.slider('guided turns', 1, 100, 1, st.guided, v => { st.guided = v; if (st.leaks > v) { st.leaks = v; l.set(v); } render(); });
    const l = K.slider('turns that leak', 0, 100, 1, st.leaks, v => { st.leaks = Math.min(v, st.guided); l.set(st.leaks); render(); });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const set = (a, b) => { st.guided = a; st.leaks = b; g.set(a); l.set(b); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example (6 of 40)', () => set(40, 6)),
      btn('Break it: a tutor that never helps', () => set(40, 0))), g.node, l.node, res.node, formula, note);
    function render() {
      const s = compute(st); res.set(s, 3);
      formula.textContent = `Leak = ${st.leaks} / ${st.guided} = ${K.fmt(s, 3)}`;
      note.textContent = st.leaks === 0 ? 'Leak = 0 looks perfect, but a tutor that says nothing useful also scores 0. Pair leakage with guidance quality. String matching also misses paraphrased leaks.' : 'Lower is better. Counting is by string match, so a paraphrased give-away is missed; a tutor that never helps would score 0. Pair with guidance quality.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => {
      const qs = {}; a[1].forEach(q => { qs[q.id] = q; });
      return { ans: a[0].filter(r => qs[r.qid].type !== 'unanswerable'), qs };
    });
    return realData;
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function highlight(K, text, terms) {
    const pats = terms.map(t => norm(t).split(' ').map(esc).join('[\\s\\-\\u2212\\u2013]+')).filter(Boolean);
    if (!pats.length) return [text];
    const re = new RegExp('(' + pats.join('|') + ')', 'ig'), out = []; let last = 0, m;
    while ((m = re.exec(text))) { if (m.index > last) out.push(text.slice(last, m.index)); out.push(K.el('mark', { style: 'background:var(--warn);color:#000;padding:0 2px' }, m[0])); last = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: D.ans[0].qid };
    const shell = K.shell(el, 'Real example: partial (leakage of the gold answer in real Q&A answers)',
      'These are Q&A answers from a RAG answerer, not tutoring turns: here giving the answer is the job, so a high leak share is expected and says nothing about any tutor. We only measure what a tutor WOULD leak: the share of real answers that contain the gold answer\'s key terms. Real example pending for real tutor dialogues. 9 answerable questions per arm (n = 9, demo scale).');
    const rules = K.el('div', { class: 'formula' });
    rules.textContent = 'Our leak rule: a reply leaks when ALL key terms of the gold answer occur in it (lower-cased; hyphens and punctuation count as spaces). The 3 unanswerable questions are skipped (the gold "answer" is a refusal). String match only: a paraphrased leak is missed, so these shares are lower bounds.';
    const tbl = K.el('div');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, [...new Set(D.ans.map(r => r.qid))].map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const view = K.el('div', { class: 'formula', 'aria-live': 'polite' }), chips = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula' }), note = K.el('p', { class: 'hint' });
    shell.append(rules, tbl, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), chips, view, res.node, formula, note);
    const all = D.ans.map(r => ({ r, leak: leaks(D.qs[r.qid].check_terms, r.answer) }));
    function render() {
      const tb = K.el('table'); tb.append(K.el('tr', {}, ['arm', 'answers that contain the gold answer', 'Leak share (n=9)'].map(h => K.el('th', {}, h))));
      ['A', 'B', 'C'].forEach(arm => {
        const rs = all.filter(x => x.r.arm === arm), n = rs.filter(x => x.leak).length;
        tb.append(K.el('tr', {}, [arm, n + ' of ' + rs.length, K.fmt(compute({ guided: rs.length, leaks: n }), 2)].map(t => K.el('td', {}, t))));
      });
      tbl.replaceChildren(tb);
      const row = all.find(x => x.r.qid === st.q && x.r.arm === st.arm), q = D.qs[st.q], f = termsFound(q.check_terms, row.r.answer);
      chips.replaceChildren(...q.check_terms.map((t, i) => K.el('span', { style: 'display:inline-block;margin:2px 4px 2px 0;padding:1px 7px;border:2px solid var(--' + (f[i] ? 'warn' : 'he') + ')' }, t + (f[i] ? ' (in answer)' : ' (absent)'))));
      view.replaceChildren(K.el('div', {}, `Gold answer: ${q.gold_answer}`), K.el('div', {}, `Answer (${st.arm}, ${st.q}; context ${JSON.stringify(row.r.context_ids)}):`), K.el('div', {}, ...highlight(K, row.r.answer, q.check_terms)));
      const s = row.leak ? 1 : 0; res.set(s, 0);
      formula.textContent = `this answer: ${f.filter(Boolean).length} of ${f.length} key terms present -> ${row.leak ? 'leaks (counts 1)' : 'does not leak (counts 0)'}\nLeak share over the 9 answerable questions, arm ${st.arm} = ${all.filter(x => x.r.arm === st.arm && x.leak).length} / 9 = ${K.fmt(compute({ guided: 9, leaks: all.filter(x => x.r.arm === st.arm && x.leak).length }), 3)}`;
      note.textContent = 'Arm A has no retrieval, so it often cannot state the corpus-specific gold answer; B and C retrieve it and state it. For a tutor, this share should be low; for a Q&A answerer it is the goal. A silent system scores 0, so pair with guidance quality. No pedagogical validity is claimed.';
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

  const api = { defaults, compute, leaks, termsFound, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['answer_leakage_rate'] = api;
})(this);
