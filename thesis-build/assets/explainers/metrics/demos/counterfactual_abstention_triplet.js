/* Counterfactual abstention triplet: when the answer is not in the evidence, does the system abstain, hallucinate or get it right by luck?
   abstention = 1[a], hallucination = 1[not a and EM = 0], lucky-correct = 1[not a and EM = 1]; the three rates partition the question set and sum to 1.
   Real example (default): the 3 unanswerable questions of the answer study (the closest real stand-in for "gold documents hidden") per arm, composed
   with the answerable accuracy and with the counterfactual-robustness run (n = 5). Toy example: the 10 masked questions of the worked example. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { abstain: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0], em: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0] };   // 4 abstain, 2 lucky, 4 hallucinate

  /* PURE: the three rates over the masked set. Returns {abstention, hallucination, lucky_correct}. */
  function compute(inp) {
    const n = inp.abstain.length;
    let a = 0, h = 0, l = 0;
    for (let i = 0; i < n; i++) { if (inp.abstain[i]) a++; else if (inp.em[i]) l++; else h++; }
    return n ? { abstention: a / n, hallucination: h / n, lucky_correct: l / n } : { abstention: 0, hallucination: 0, lucky_correct: 0 };
  }

  function bars(K, r) {
    const seg = (v, col, name) => K.el('div', { style: 'flex:' + Math.max(v, 0) + ' 1 0;min-width:0;background:var(--' + col + ');color:#08110f;text-align:center;font-size:.8em;overflow:hidden;white-space:nowrap' }, v > 0.001 ? name + ' ' + K.fmt(v, 2) : '');
    const row = K.el('div', { role: 'img', 'aria-label': 'abstention ' + K.fmt(r.abstention, 2) + ', hallucination ' + K.fmt(r.hallucination, 2) + ', lucky-correct ' + K.fmt(r.lucky_correct, 2), style: 'display:flex;height:30px;border-radius:6px;overflow:hidden;max-width:880px;border:1px solid var(--line,#445)' },
      seg(r.abstention, 'he', 'abstain'), seg(r.lucky_correct, 'ai', 'lucky'), seg(r.hallucination, 'warn', 'hallucinate'));
    return row;
  }

  function mountToy(el) {
    const K = root.DemoKit, N = 10;
    const st = { abstain: defaults.abstain.slice(), em: defaults.em.slice() };
    const shell = K.shell(el, 'Toy example (break it)',
      'Ten questions whose gold documents are hidden (invented). Click a dot to flip "abstains"; click the small box under it to flip "answer is exactly right". Teal = abstains, orange = answers wrongly (hallucination), amber = answers rightly anyway (lucky-correct, a contamination signal). A reply that abstains cannot also be marked right.');
    const grid = K.el('div', { role: 'group', 'aria-label': 'masked questions', style: 'display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px;max-width:560px' });
    const view = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' }), note = K.el('p', { class: 'hint' });
    const res = K.resultBox();
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.abstain = defaults.abstain.slice(); st.em = defaults.em.slice(); render(); }),
      btn('Break it: never abstain', () => { st.abstain = Array(N).fill(0); render(); }),
      btn('Break it: model memorised it', () => { st.abstain = Array(N).fill(0); st.em = Array(N).fill(1); render(); }));
    shell.append(presets, grid, view, res.node, formula, note);
    function render() {
      grid.replaceChildren();
      for (let i = 0; i < N; i++) {
        const a = st.abstain[i], e = st.em[i] && !a;
        const col = a ? 'he' : e ? 'ai' : 'warn';
        grid.append(K.el('div', { style: 'text-align:center' },
          K.el('button', { type: 'button', 'aria-pressed': a ? 'true' : 'false', 'aria-label': 'question ' + (i + 1) + (a ? ', abstains' : e ? ', answers rightly' : ', answers wrongly') + ', click to flip abstain',
            style: 'width:100%;aspect-ratio:1;border-radius:50%;padding:0;border:3px solid var(--' + col + ');background:' + (a ? 'var(--he)' : e ? 'var(--ai)' : 'transparent'), onclick: () => { st.abstain[i] = a ? 0 : 1; render(); } }),
          (() => { const b = K.el('button', { type: 'button', 'aria-pressed': e ? 'true' : 'false', 'aria-label': 'question ' + (i + 1) + ' answer exactly right',
            style: 'margin-top:4px;width:60%;aspect-ratio:1;padding:0;font-size:.7em', onclick: () => { st.em[i] = st.em[i] ? 0 : 1; render(); } }, e ? 'EM' : ''); if (a) b.disabled = true; return b; })()));
      }
      const r = compute({ abstain: st.abstain, em: st.em });
      view.replaceChildren(bars(K, r)); res.set(r.abstention, 3);
      formula.textContent = `abstention = ${Math.round(r.abstention * N)}/${N} = ${K.fmt(r.abstention, 2)}   (higher is better)\nhallucination = ${Math.round(r.hallucination * N)}/${N} = ${K.fmt(r.hallucination, 2)}   (lower is better)\nlucky-correct = ${Math.round(r.lucky_correct * N)}/${N} = ${K.fmt(r.lucky_correct, 2)}   (contamination signal)\nsum = ${K.fmt(r.abstention + r.hallucination + r.lucky_correct, 2)}`;
      note.textContent = 'The headline number above is abstention. If the model memorised the answer, "hidden evidence" is not hidden: lucky-correct rises and abstention falls, and a high hallucination rate then understates how much the model really knows.';
    }
    render();
  }

  /* ---- real data ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = (b, p) => fetch(b + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    const here = new URL('data/', SCRIPT_SRC || location.href).href;
    realData = Promise.all([get(base, 'answers/answers.json'), get(base, 'metrics/answer_correctness.json'), get(base, 'data/questions.json'), get(here, 'counterfactual_robustness.real.json').catch(() => null)])
      .then(a => ({ ans: Object.fromEntries(a[0].map(r => [r.qid + '_' + r.arm, r])), corr: a[1], qs: Object.fromEntries(a[2].map(q => [q.id, q])), cf: a[3] }));
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const unq = Object.keys(D.qs).filter(id => D.qs[id].type === 'unanswerable' && D.ans[id + '_A']);
    const ansq = Object.keys(D.qs).filter(id => D.qs[id].type !== 'unanswerable' && D.corr.per_question.A[id] !== undefined);
    const st = { arm: 'B', lucky: new Set() };
    const shell = K.shell(el, 'Real example: three behaviours, three real quantities',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable), one run, temperature 0, answerer ' + D.corr.answer_model + ', LLM judges. The catalogue triplet needs questions whose gold documents are hidden; this pack has no masked-gold run, so the 3 unanswerable questions (nothing in the 138-passage corpus sample answers them) are the closest real stand-in. They have no gold answer, so EM is undefined: every reply that does not abstain counts as a hallucination unless YOU mark it right by luck. Arm C gets about 40% more context than B.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    aSel.value = st.arm; aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    const list = K.el('div', { role: 'group', 'aria-label': 'unanswerable questions' });
    const view = K.el('div'), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
    const prof = K.el('div', { class: 'formula', style: 'white-space:pre-wrap' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), list, view, res.node, formula, K.el('h4', {}, 'The three real quantities side by side (all arms)'), prof, note);

    function render() {
      list.replaceChildren();
      const abstain = [], em = [];
      unq.forEach(id => {
        const r = D.ans[id + '_' + st.arm], key = st.arm + id, ab = r.refused ? 1 : 0, lk = !ab && st.lucky.has(key) ? 1 : 0;
        abstain.push(ab); em.push(lk);
        const label = ab ? 'abstains' : lk ? 'answers, marked right by luck (your mark)' : 'answers anyway: hallucination';
        list.append(K.el('div', { style: 'margin:4px 0;padding:2px 6px;border-left:4px solid var(--' + (ab ? 'he' : lk ? 'ai' : 'warn') + ')' },
          K.el('b', {}, id + ': ' + label + ' '), K.el('span', { class: 'hint' }, D.qs[id].question),
          K.el('p', { class: 'hint' }, 'Answer: ' + r.answer.slice(0, 260) + (r.answer.length > 260 ? '...' : '') + ' (context: ' + (r.context_ids.length ? r.context_ids.join(', ') : 'none') + ')'),
          ab ? '' : K.el('button', { type: 'button', 'aria-pressed': lk ? 'true' : 'false', onclick: () => { st.lucky.has(key) ? st.lucky.delete(key) : st.lucky.add(key); render(); } }, lk ? 'unmark: not right by luck' : 'mark: this answer is right (lucky-correct)')));
      });
      const r = compute({ abstain, em });
      view.replaceChildren(bars(K, r)); res.set(r.abstention, 3);
      const n = unq.length;
      formula.textContent = `abstention = ${Math.round(r.abstention * n)}/${n} = ${K.fmt(r.abstention, 2)}   hallucination = ${Math.round(r.hallucination * n)}/${n} = ${K.fmt(r.hallucination, 2)}   lucky-correct = ${Math.round(r.lucky_correct * n)}/${n} = ${K.fmt(r.lucky_correct, 2)}   (sum ${K.fmt(r.abstention + r.hallucination + r.lucky_correct, 2)})`;
      const lines = ['A', 'B', 'C'].map(a => {
        const acc = D.corr.per_question[a], sc = ansq.map(q => acc[q]), mean = sc.reduce((x, y) => x + y, 0) / sc.length;
        const ref = unq.filter(q => D.ans[q + '_' + a].refused).length;
        return `${a}: answerable accuracy ${K.fmt(mean, 2)} (judge, ${sc.length} questions) | unanswerable: abstains ${ref}/${n}, answers anyway ${n - ref}/${n}`;
      });
      let cf = 'counterfactual axis (one configuration, plain prompt, 5 questions where the planted source is wrong): ';
      if (D.cf) {
        const p = D.cf.aggregate.plain, w = D.cf.aggregate.warn;
        cf += `flagged the error ${p.flagged}/${p.n}, repeated the planted wrong fact ${p.believed_wrong}/${p.n}; with a warning in the prompt flagged ${w.flagged}/${w.n}, still repeated it ${w.believed_wrong}/${w.n}. (separate run from the counterfactual_robustness unit, not split by arm)`;
      } else cf += 'pending: counterfactual_robustness data not found.';
      prof.textContent = lines.join('\n') + '\n' + cf;
      note.textContent = 'Reading the profile: arm A answers well from memory (0.94) but never abstains (0/3), and some of its replies on the unanswerable questions are true world knowledge (for example Adam default 0.001): a lucky-correct case the corpus-based label cannot see. B and C abstain 3/3 and keep high accuracy, but n = 3 and n = 9 are tiny, and the counterfactual result shows that abstaining on missing evidence is not the same as noticing wrong evidence: the model followed the planted error in most cases. The three axes are not combined into one score on purpose.';
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

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['counterfactual_abstention_triplet'] = api;
})(this);
