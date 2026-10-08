/* Counterfactual robustness (RGB): ED = errors flagged / N_cf, EC = correct answers after flagging / N_cf.
   Real example (default): a NEW tiny experiment (5 questions, one fact in one passage replaced by a plausible wrong one; plain prompt vs prompt
   with a warning), stored in data/counterfactual_robustness.real.json (script: data/counterfactual_robustness.build.py). The pack itself has no
   counterfactual run. The flags are an LLM judge's: click a flag to overrule it. Toy example (break it): 50 illustrative questions. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { n: 50, flagged: 12, correctAfterFlag: 5 };

  /* PURE: returns {ED, EC_over_N, EC_over_flagged} */
  function compute(inp) {
    const n = inp.n, f = inp.flagged, c = inp.correctAfterFlag;
    const r3 = x => Math.round(x * 1000) / 1000;   // 3 decimals, as the catalogue
    return { ED: r3(n > 0 ? f / n : 0), EC_over_N: r3(n > 0 ? c / n : 0), EC_over_flagged: r3(f > 0 ? c / f : 0) };
  }
  /* PURE: rows [{flagged, correct}] -> compute input */
  function fromRows(rows) {
    return { n: rows.length, flagged: rows.filter(r => r.flagged).length, correctAfterFlag: rows.filter(r => r.flagged && r.correct).length };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)',
      'Illustrative numbers, not measured: 50 questions whose context states a wrong fact. Choose how many answers flag the error and how many of those also give the right answer.');
    const sF = K.slider('answers that flag the error (out of 50)', 0, 50, 1, st.flagged, v => { st.flagged = v; if (st.correctAfterFlag > v) { st.correctAfterFlag = v; sC.set(v); } render(); });
    const sC = K.slider('... of which also give the correct answer', 0, 50, 1, st.correctAfterFlag, v => { st.correctAfterFlag = Math.min(v, st.flagged); sC.set(st.correctAfterFlag); render(); });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = (f, c) => { st.flagged = f; st.correctAfterFlag = c; sF.set(f); sC.set(c); render(); };
    shell.append(K.el('div', { class: 'row' }, btn('Worked example', () => set(12, 5)), btn('Break it: model trusts the context', () => set(0, 0))), sF.node, sC.node, res.node, formula, note);
    function render() {
      const r = compute(st);
      res.set(r.ED, 3);
      formula.textContent = `ED = ${st.flagged} / ${st.n} = ${K.fmt(r.ED, 3)}\nEC = ${st.correctAfterFlag} / ${st.n} = ${K.fmt(r.EC_over_N, 3)}   (or ${st.correctAfterFlag} / ${st.flagged} = ${K.fmt(r.EC_over_flagged, 3)} over the flagged cases; the exact denominator is unverified, check RGB)`;
      note.textContent = st.flagged === 0
        ? 'ED = 0 means the model trusted the wrong context every time. For a curated textbook that is the wanted behaviour, so a low ED is not a failure there: it is a stress test, not a target.'
        : 'The result box shows ED. A system that flags every context as wrong would score ED = 1 with no skill, so read ED together with EC.';
    }
    render();
  }

  /* ---- Real example ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/counterfactual_robustness.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('counterfactual_robustness.real.json ' + r.status); return r.json(); });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { mode: 'plain', over: {} };       // over['q01_plain'] = {flagged, correct} user overrides
    const shell = K.shell(el, 'Real example: 5 questions with one planted wrong fact',
      'This is a NEW tiny experiment, not part of the answer study (the pack has no counterfactual run): n = 5, one run, temperature 0, answerer ' + D.answer_model + ', cost USD ' + D.usd + '. For each question one fact in the gold passage was replaced by a plausible wrong one; the model answered it correctly with no retrieval before (arm A). "flagged" and "correct" are an LLM judge\'s (' + D.judge_model + ') calls: click a flag to overrule it. n = 5 means one question moves a rate by 0.20. A demo, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'prompt', style: 'max-width:100%' }, [opt('plain', 'plain prompt (no warning)'), opt('warn', 'prompt with a warning: sources may contain an error')]);
    mSel.addEventListener('change', () => { st.mode = mSel.value; render(); });
    const list = K.el('div', { role: 'group', 'aria-label': 'questions' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    const both = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'prompt ', mSel)), list, res.node, formula, note, both);
    const get = (q, m) => Object.assign({ flagged: q.modes[m].flagged, correct: q.modes[m].correct }, st.over[q.id + '_' + m] || {});
    function render() {
      list.replaceChildren();
      const rows = D.questions.map(q => {
        const r = get(q, st.mode), v = q.modes[st.mode];
        const toggle = (key) => K.el('button', { type: 'button', 'aria-pressed': r[key] ? 'true' : 'false', onclick: () => { st.over[q.id + '_' + st.mode] = Object.assign({}, r, { [key]: r[key] ? 0 : 1 }); render(); } },
          (key === 'flagged' ? 'flagged the error: ' : 'states the correct fact: ') + (r[key] ? 'yes' : 'no'));
        list.append(K.el('div', { style: 'margin:6px 0;padding:2px 8px;border-left:4px solid var(--' + (r.flagged && r.correct ? 'he' : 'warn') + ')' },
          K.el('b', {}, q.id + ' (passage ' + q.edited_passage + ') '), K.el('span', { class: 'hint' }, q.question),
          K.el('p', { class: 'hint' }, 'Planted: "' + q.original_snippet + '" became "' + q.planted_snippet + '" (wrong fact: ' + q.planted_wrong_fact + '; correct: ' + q.correct_fact + ')'),
          K.el('p', { class: 'hint' }, 'Answer: ' + v.answer),
          K.el('p', { class: 'hint' }, 'Judge: ' + v.judge_reason + ' (believed the wrong fact: ' + (v.believed_wrong ? 'yes' : 'no') + ')'),
          K.el('div', { class: 'row' }, toggle('flagged'), toggle('correct'))));
        return r;
      });
      const inp = fromRows(rows), c = compute(inp);
      res.set(c.ED, 3);
      formula.textContent = `ED = ${inp.flagged} / ${inp.n} = ${K.fmt(c.ED, 3)}\nEC = ${inp.correctAfterFlag} / ${inp.n} = ${K.fmt(c.EC_over_N, 3)}` + (inp.flagged ? `   (${inp.correctAfterFlag} / ${inp.flagged} = ${K.fmt(c.EC_over_flagged, 3)} over flagged cases; denominator unverified)` : '');
      note.textContent = st.mode === 'plain'
        ? 'With the plain prompt the judge found the wrong fact repeated as true in 4 of 5 answers (the 5th left the planted detail out) and no flag: it trusts its context. That is what a RAG system is built to do, so for a curated textbook this is expected.'
        : 'Warned that the sources may contain an error, the model flagged 1 of 5 (q06, the step-size swap) and the judge found the wrong fact repeated in the other 4. A warning helps a little here, but with n = 5 that is one question.';
      const a = D.aggregate;
      both.textContent = 'As judged (no overrides): plain ED ' + a.plain.ED + ', EC ' + a.plain.EC_over_N + '  |  warn ED ' + a.warn.ED + ', EC ' + a.warn.EC_over_N + ' (EC over flagged ' + a.warn.EC_over_flagged + '). Source: counterfactual_robustness.build.py, ' + D.calls + ' calls.';
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

  const api = { defaults, compute, fromRows, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['counterfactual_robustness'] = api;
})(this);
