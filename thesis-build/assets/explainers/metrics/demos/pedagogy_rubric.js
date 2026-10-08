/* Pedagogical dimension scores (MRBench taxonomy). Real example PENDING (no tutor dialogues, no human ratings);
   partial: a crude rule-based 3-item score of the 36 real RAG answers, computed in the page from the real strings. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { yes: 12, some: 5, no: 3 };

  /* PURE: S = (1*yes + 0.5*some + 0*no) / N */
  function compute(inp) {
    const N = inp.yes + inp.some + inp.no;
    return N > 0 ? (inp.yes + 0.5 * inp.some) / N : 0;
  }

  /* Our crude rules (NOT a pedagogy judgement). Pure: answer record + question record -> labels. */
  const CUE = /\b(try|consider|think about|what if|hint|step by step|can you)\b/i;
  function flags(ans, q) {
    const t = ans.answer.toLowerCase(), f = {};
    if (q.type === 'unanswerable') f.reveal = null;
    else { const k = q.check_terms.filter(x => t.includes(x.toLowerCase())).length / q.check_terms.length; f.reveal = k >= 1 ? 'Yes' : k > 0 ? 'Some' : 'No'; }
    f.guide = (ans.answer.includes('?') || CUE.test(ans.answer)) ? 'Yes' : 'No';
    if (ans.refused) f.ground = null;
    else if (!ans.cited.length) f.ground = 'No';
    else f.ground = ans.cited.every(c => ans.context_ids.includes(c)) ? 'Yes' : 'Some';
    return f;
  }
  const WT = { Yes: 1, Some: 0.5, No: 0 };

  const DIMS = [
    ['Mistake identification', 'Does the response notice there is a mistake?', false],
    ['Mistake location', 'Does it say where the mistake is?', false],
    ['Revealing of the answer', 'Does it give the answer away? (reverse-coded: a reveal is bad)', true],
    ['Providing guidance', 'Does it guide the student?', false],
    ['Actionability', 'Does the student know what to do next?', false],
    ['Coherence', 'Is it coherent?', false],
    ['Tutor tone', 'Is the tone encouraging?', false],
    ['Human-likeness', 'Does it sound like a human?', false]];

  function mountToy(el) {
    const K = root.DemoKit;
    const N = 20;
    const st = DIMS.map((d, i) => i === 0 ? { yes: 12, some: 5 } : { yes: 10, some: 6 });
    const shell = K.shell(el, 'Toy example (break it)', 'Toy labels, not measured: 20 pretend tutor responses per dimension. Set how many are Yes and "To some extent"; the rest are No. Real example pending: the pack has no tutor dialogues and no human ratings.');
    const out = K.el('div', { class: 'row' }); const res = K.resultBox(); out.append(res.node, K.el('span', { class: 'hint' }, ' S for mistake identification'));
    const rows = K.el('div'); const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const note = K.el('p', { class: 'hint' });
    const bars = [];
    DIMS.forEach((d, i) => {
      const yS = K.slider(d[0] + ': Yes', 0, N, 1, st[i].yes, v => { st[i].yes = v; if (st[i].yes + st[i].some > N) { st[i].some = N - st[i].yes; sS.set(st[i].some); } render(); });
      const sS = K.slider('some', 0, N, 1, st[i].some, v => { st[i].some = Math.min(v, N - st[i].yes); sS.set(st[i].some); render(); });
      const sv = K.el('span', { class: 'num' }); bars.push(sv);
      yS.node.title = d[1];
      rows.append(K.el('div', { class: 'row' }, yS.node, sS.node, sv));
      st[i].sY = yS; st[i].sS = sS;
    });
    const set = arr => { arr.forEach((v, i) => { st[i].yes = v[0]; st[i].some = v[1]; st[i].sY.set(v[0]); st[i].sS.set(v[1]); }); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (mistake id. 12/5/3)', () => set([[12, 5], [10, 6], [4, 6], [10, 6], [10, 6], [10, 6], [10, 6], [10, 6]])),
      btn('Break it: polite but wrong', () => set([[4, 4], [3, 4], [12, 4], [5, 5], [4, 4], [18, 2], [19, 1], [18, 2]])));
    shell.append(presets, out, rows, formula, note);
    function render() {
      const lines = [];
      DIMS.forEach((d, i) => {
        const inp = { yes: st[i].yes, some: st[i].some, no: N - st[i].yes - st[i].some }, s = compute(inp), shown = d[2] ? 1 - s : s;
        bars[i].textContent = 'No ' + inp.no + '  S = ' + K.fmt(s, 3) + (d[2] ? '  (reverse-coded: ' + K.fmt(shown, 3) + ' good)' : '');
        if (i === 0) { res.set(s, 3); lines.push(`S = (${inp.yes} x 1 + ${inp.some} x 0.5 + ${inp.no} x 0) / ${N} = ${K.fmt(s, 3)}`); }
      });
      formula.textContent = lines.join('\n');
      const tone = compute({ yes: st[6].yes, some: st[6].some, no: N - st[6].yes - st[6].some }), mi = compute({ yes: st[0].yes, some: st[0].some, no: N - st[0].yes - st[0].some });
      note.textContent = `Tone S = ${K.fmt(tone, 2)} vs mistake identification S = ${K.fmt(mi, 2)}: a tutor can sound good and still miss the mistake. The 0.5 weight is our choice, not the paper's; the three-level scale is coarse; labels depend on the judge or annotators. Add correctness separately.`;
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => { const qs = {}; a[1].forEach(q => { qs[q.id] = q; }); return { ans: a[0], qs }; });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: D.ans[0].qid };
    const shell = K.shell(el, 'Real example: pending (partial: a crude rule on the 36 real answers)',
      'Real example pending: the pack has no tutor dialogues and no human ratings, so there is no real MRBench-style score. Below is only our crude rule on the 36 real RAG answers (n = 12 questions x 3 arms), computed in this page from the answer strings. It is our crude rule, not a pedagogy judgement, and a RAG answerer is not a tutor.');
    const f3 = K.el('div', { class: 'formula' });
    f3.textContent = 'Rules (ours): reveals = share of the gold answer\'s key terms found in the text (all = Yes, some = To some extent, none = No; unanswerable questions skipped)\nguides = the text contains "?" or a cue word (try, consider, think about, what if, hint, step by step, can you)\ngrounded = cites a passage id [pNNN]: all cited ids in its own context = Yes, some outside = To some extent, none cited = No; refusals skipped';
    const tbl = K.el('div');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, [...new Set(D.ans.map(r => r.qid))].map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const view = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    shell.append(f3, tbl, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), view, note);
    const all = D.ans.map(a => ({ a, f: flags(a, D.qs[a.qid]) }));
    function render() {
      const tb = K.el('table'); tb.append(K.el('tr', {}, ['arm', 'S reveals (n)', 'S guides (n)', 'S grounded (n)'].map(h => K.el('th', {}, h))));
      ['A', 'B', 'C'].forEach(arm => {
        const cells = ['reveal', 'guide', 'ground'].map(d => { const v = all.filter(x => x.a.arm === arm && x.f[d]).map(x => WT[x.f[d]]); const s = v.reduce((p, c) => p + c, 0) / v.length; return K.fmt(s, 2) + ' (' + v.length + ')'; });
        tb.append(K.el('tr', {}, [arm].concat(cells).map(t => K.el('td', {}, t))));
      });
      tbl.replaceChildren(tb);
      const r = all.find(x => x.a.qid === st.q && x.a.arm === st.arm);
      view.textContent = `Answer (${r.a.arm}, ${r.a.qid}; cited ${JSON.stringify(r.a.cited)}; context ${JSON.stringify(r.a.context_ids)}):\n${r.a.answer}\n\nOur crude flags: reveals = ${r.f.reveal ?? 'n/a'}, guides = ${r.f.guide}, grounded = ${r.f.ground ?? 'n/a'}\ngold key terms: ${JSON.stringify(D.qs[st.q].check_terms)}`;
      note.textContent = 'No arm guides: the answerer is told to answer, not to teach. Reveals separates arm A (knows only some facts without the corpus) from B and C; grounded separates A (no context, nothing to cite) from B and C. These three flags are string rules; they say nothing about mistake identification, tone, or the other five MRBench dimensions. For a real score we need tutor responses and human or validated LLM labels.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example (pending, partial)'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
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

  const api = { defaults, compute, flags, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['pedagogy_rubric'] = api;
})(this);
