/* Joint F1 (HotpotQA): P_j = P_ans * P_sp, R_j = R_ans * R_sp, F1_j = 2 P_j R_j / (P_j + R_j).
   Real mode computes both halves live from the real answers (token F1 vs gold answer) and the real passage sets (cited or retrieved vs gold passages). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { ansP: 1, ansR: 0.5, spP: 1 / 3, spR: 0.5 };

  /* PURE */
  function parts(inp) {
    const Pj = inp.ansP * inp.spP, Rj = inp.ansR * inp.spR;
    return { Pj, Rj, F1: Pj + Rj ? 2 * Pj * Rj / (Pj + Rj) : 0 };
  }
  function compute(inp) { return parts(inp).F1; }
  const f1of = (p, r) => (p + r ? 2 * p * r / (p + r) : 0);

  /* SQuAD token recipe (as token_f1.js) after removing [pNNN] citation markers: they are evidence, not answer words */
  const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
  function tokens(s) {
    return String(s).replace(/\[\s*p\d{3}(?:\s*,\s*p\d{3})*\s*\]|\bp\d{3}\b/g, ' ').toLowerCase().replace(PUNCT, '').replace(/\b(a|an|the)\b/g, ' ').split(/\s+/).filter(Boolean);
  }
  function tokenPR(pred, gold) {
    const pt = tokens(pred), gt = tokens(gold), left = {};
    gt.forEach(w => { left[w] = (left[w] || 0) + 1; });
    let c = 0; pt.forEach(w => { if (left[w] > 0) { left[w]--; c++; } });
    if (!pt.length || !gt.length || !c) return { p: 0, r: 0, c, np: pt.length, ng: gt.length };
    return { p: c / pt.length, r: c / gt.length, c, np: pt.length, ng: gt.length };
  }
  function setPR(pred, gold) {
    const p = new Set(pred), g = new Set(gold), ov = [...p].filter(x => g.has(x)).length;
    return { p: p.size ? ov / p.size : 0, r: g.size ? ov / g.size : 0, ov, np: p.size, ng: g.size };
  }
  /* PURE: one real (question, arm, evidence source) */
  function realJoint(q, a, src) {
    const A = tokenPR(a.answer, q.gold_answer);
    const S = setPR(src === 'cited' ? (a.cited || []) : (a.context_ids || []), q.gold_passages);
    const x = parts({ ansP: A.p, ansR: A.r, spP: S.p, spR: S.r });
    return { A, S, Aprf: f1of(A.p, A.r), Sprf: f1of(S.p, S.r), ...x };
  }

  function mountToy(el) {
    const K = root.DemoKit, st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Four sliders: the answer precision and recall (token overlap) and the evidence precision and recall (supporting passages). Watch the two halves multiply into the joint score.');
    const mk = (l, k) => K.slider(l, 0, 1, 0.01, +st[k].toFixed(2), v => { st[k] = v; render(); });
    const s1 = mk('answer precision P_ans', 'ansP'), s2 = mk('answer recall R_ans', 'ansR'), s3 = mk('evidence precision P_sp', 'spP'), s4 = mk('evidence recall R_sp', 'spR');
    const res = K.resultBox(), fo = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const sl = { ansP: s1, ansR: s2, spP: s3, spR: s4 };
    const set = o => { Object.assign(st, o); Object.keys(sl).forEach(k => sl[k].set(+st[k].toFixed(2))); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: right answer, no evidence', () => set({ ansP: 1, ansR: 1, spP: 0, spR: 0 })),
      btn('Break it: both halves at 0.7', () => set({ ansP: 0.7, ansR: 0.7, spP: 0.7, spR: 0.7 })),
      btn('Perfect', () => set({ ansP: 1, ansR: 1, spP: 1, spR: 1 })));
    shell.append(presets, s1.node, s2.node, s3.node, s4.node, res.node, fo, note);
    function render() {
      const x = parts(st), fa = f1of(st.ansP, st.ansR), fs = f1of(st.spP, st.spR);
      res.set(x.F1);
      fo.textContent = `P_j = ${K.fmt(st.ansP)} x ${K.fmt(st.spP)} = ${K.fmt(x.Pj)}\nR_j = ${K.fmt(st.ansR)} x ${K.fmt(st.spR)} = ${K.fmt(x.Rj)}\nF1_j = 2 x ${K.fmt(x.Pj)} x ${K.fmt(x.Rj)} / (${K.fmt(x.Pj)} + ${K.fmt(x.Rj)}) = ${K.fmt(x.F1)}\n(answer F1 = ${K.fmt(fa)}, evidence F1 = ${K.fmt(fs)}; joint is ${x.F1 < Math.min(fa, fs) - 1e-9 ? 'below both' : 'not below the smaller one'})`;
      note.textContent = x.F1 === 0 ? 'One half is zero, so the product is zero: a perfect answer with no (or wrong) evidence scores 0.'
        : st.ansP === 0.7 && st.ansR === 0.7 && st.spP === 0.7 && st.spR === 0.7 ? 'Two 0.7 halves give 0.49: two good-looking halves, one weak joint score. This is why joint F1 is hard to push above 0.5.' : '';
      note.className = 'hint' + (x.F1 === 0 ? ' bad' : '');
    }
    render();
  }

  /* ---- Real example ---- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realP = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => {
      const ans = {}, qs = {}; a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; }); a[1].forEach(q => { qs[q.id] = q; });
      return { ans, qs };
    }).catch(e => { realP = null; throw e; });
    return realP;
  }
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.qs).filter(id => D.qs[id].gold_passages.length && D.ans[id + '_A']);
    const st = { arm: 'B', src: 'cited', q: qids.includes('q18') ? 'q18' : qids[0] };
    const shell = K.shell(el, 'Real example: joint F1 of real answers, per question and arm',
      'Scale: 12 questions, 9 answerable (shown), one run, temperature 0, answerer qwen3.7-plus. Gold answers and gold passages were written by Claude, not by independent annotators; nothing is judged by an LLM here: both halves are computed in this page. The evidence unit is the PASSAGE (id pNNN), not the HotpotQA sentence, and gold lists only the passages needed, so evidence precision is a lower bound. Answer side: SQuAD token overlap against a SHORT gold answer, with [pNNN] markers removed, so verbose answers lose precision. A demo, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval (no passages cited)'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const sSel = K.el('select', { 'aria-label': 'predicted evidence set', style: 'max-width:100%' }, [opt('cited', 'Predicted evidence = passages the answer cites'), opt('context', 'Predicted evidence = all passages given to the answerer')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; sSel.value = st.src; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    sSel.addEventListener('change', () => { st.src = sSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { style: 'overflow-wrap:anywhere' }), res = K.resultBox(), fo = K.el('div', { class: 'formula', style: 'overflow-wrap:anywhere', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' }), tbl = K.el('div', { style: 'overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, sSel), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, res.node, fo, note, tbl);
    const J = (id, arm) => realJoint(D.qs[id], D.ans[id + '_' + arm], st.src);
    function chips(list, other, color) {
      const box = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin:4px 0' });
      if (!list.length) box.append(K.el('span', { class: 'hint' }, 'none'));
      list.forEach(f => { const m = other.includes(f), c = m ? 'var(--he)' : color; box.append(K.el('span', { class: 'num', style: 'padding:1px 7px;border:1px solid ' + c + ';color:' + c + ';border-radius:6px', title: m ? 'matched' : 'no match' }, f)); });
      return box;
    }
    function render() {
      const q = D.qs[st.q], a = D.ans[st.q + '_' + st.arm], x = J(st.q, st.arm);
      const pred = st.src === 'cited' ? (a.cited || []) : (a.context_ids || []);
      info.replaceChildren(
        K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, 'Gold answer: '), q.gold_answer),
        K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, `System answer (${st.arm}): `), a.answer),
        K.el('b', {}, 'Gold passages S*'), chips(q.gold_passages, pred, 'var(--both)'),
        K.el('b', {}, st.src === 'cited' ? 'Predicted passages S-hat = cited by the answer' : 'Predicted passages S-hat = the context given to the answerer'), chips(pred, q.gold_passages, 'var(--k12)'));
      res.set(x.F1);
      fo.textContent = `answer:    overlap ${x.A.c} of ${x.A.np} answer words and ${x.A.ng} gold words -> P_ans = ${K.fmt(x.A.p)}, R_ans = ${K.fmt(x.A.r)} (F1 ${K.fmt(x.Aprf)})\n` +
        `evidence:  overlap ${x.S.ov} of ${x.S.np} predicted and ${x.S.ng} gold -> P_sp = ${K.fmt(x.S.p)}, R_sp = ${K.fmt(x.S.r)} (F1 ${K.fmt(x.Sprf)})\n` +
        `P_j = ${K.fmt(x.A.p)} x ${K.fmt(x.S.p)} = ${K.fmt(x.Pj)}\nR_j = ${K.fmt(x.A.r)} x ${K.fmt(x.S.r)} = ${K.fmt(x.Rj)}\nF1_j = 2 x ${K.fmt(x.Pj)} x ${K.fmt(x.Rj)} / (${K.fmt(x.Pj)} + ${K.fmt(x.Rj)}) = ${K.fmt(x.F1)}`;
      note.textContent = x.S.np === 0 ? 'No evidence in the predicted set: the evidence half is 0, so the joint score is 0 whatever the answer says (this is all of arm A).'
        : x.S.p === 1 && x.S.r === 1 ? 'Evidence is exactly right (P = R = 1), so the joint F1 equals the answer F1: the product structure leaves the answer score unchanged. Compare with the questions where the evidence is only half right.'
        : `Joint ${K.fmt(x.F1)} is below both the answer F1 (${K.fmt(x.Aprf)}) and the evidence F1 (${K.fmt(x.Sprf)}): the product punishes a weak half twice, in P and in R.`;
      const rows = qids.map(id => ({ id, x: J(id, st.arm) }));
      const t = K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['q', 'answer F1', 'evidence F1', 'joint F1'].map(h => K.el('th', {}, h))),
        ...rows.map(r => K.el('tr', { style: r.id === st.q ? 'background:rgba(242,169,59,.10)' : '' }, K.el('td', {}, r.id), K.el('td', { class: 'num' }, K.fmt(r.x.Aprf, 2)), K.el('td', { class: 'num' }, K.fmt(r.x.Sprf, 2)), K.el('td', { class: 'num' }, K.fmt(r.x.F1, 2)))));
      const armLine = ['A', 'B', 'C'].map(arm => { const r = qids.map(id => J(id, arm)); return `${arm}: answer ${K.fmt(mean(r.map(y => y.Aprf)), 2)}, evidence ${K.fmt(mean(r.map(y => y.Sprf)), 2)}, joint ${K.fmt(mean(r.map(y => y.F1)), 2)}`; });
      tbl.replaceChildren(K.el('p', { class: 'hint', style: 'margin:10px 0 4px' }, `All ${qids.length} answerable questions, arm ${st.arm} (means of per-question F1: answer ${K.fmt(mean(rows.map(r => r.x.Aprf)), 2)}, evidence ${K.fmt(mean(rows.map(r => r.x.Sprf)), 2)}, joint ${K.fmt(mean(rows.map(r => r.x.F1)), 2)}):`), t,
        K.el('p', { class: 'hint', style: 'margin:8px 0 0' }, 'All arms, same evidence source, recomputed here: ' + armLine.join('  |  ') + '. n = 9: not a quality ranking. The joint mean is far below the answer mean mainly because answers are long (low answer precision) and because several answers cite only part of the gold evidence.'));
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
        .catch(e => { body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, realJoint };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['joint_f1'] = api;
})(this);
