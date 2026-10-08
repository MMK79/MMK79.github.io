/* Noise robustness (RGB) demo: Acc(r) = share of questions whose answer contains the gold answer when a fraction r of the context is noise.
   Real mode (default): a NEW small experiment (demos/data/noise_robustness.build.py, 54 calls, USD in the data file) on the 9 answerable questions of the answer study:
   5-passage contexts with 0, 2, 4 noise passages (bridge questions: at most 3), gold kept, noise = random non-gold passages of the same ML corpus; qwen3.7-plus answers, deepseek-v4.1-flash judges.
   Accuracy is recomputed live from the stored per-question outcomes. Toy mode: the RGB paper table (counts of 300 questions). compute() is pure. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { N: 300, correct: { '0': 289, '0.6': 270, '0.8': 228 } };   // 96.33 / 90.00 / 76.00 % of 300 (RGB Table, English, ChatGPT)
  const r4 = x => Math.round(x * 1e4) / 1e4;
  /* PURE: Acc(r) = correct(r) / N per noise level; drop = Acc(0) - Acc(0.8). Worked example result as in metrics.json. */
  function compute(inp) {
    const a = k => inp.correct[k] / inp.N, out = { acc_r0: r4(a('0')), 'acc_r0.6': r4(a('0.6')), 'acc_r0.8': r4(a('0.8')) };
    out['drop_0_to_0.8'] = r4(a('0') - a('0.8')); return out;
  }
  const mean = v => v.reduce((s, x) => s + x, 0) / v.length;

  function mountToy(el) {
    const K = root.DemoKit, st = { N: defaults.N, c: Object.assign({}, defaults.correct), label: '' };
    const shell = K.shell(el, 'Toy example (break it)', 'Counts reproduce the RGB paper table (English, ChatGPT: 96.33, 90.00, 76.00 percent of 300 questions); the paper numbers are not re-measured here. Move the sliders to change how many questions are still answered correctly at each noise ratio r.');
    const keys = ['0', '0.6', '0.8'];
    const sl = keys.map(k => K.slider('correct answers at r = ' + k + ' (of 300)', 0, 300, 1, st.c[k], v => { st.c[k] = v; st.label = ''; render(); }));
    const res = K.resultBox(), svg = K.svg('svg', { viewBox: '0 0 300 130', style: 'width:100%;max-width:520px;height:auto;display:block', role: 'img', 'aria-label': 'accuracy against noise ratio' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    const set = (c, label) => { keys.forEach((k, i) => { st.c[k] = c[i]; sl[i].set(c[i]); }); st.label = label || ''; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' }, btn('Worked example (RGB table)', () => set([289, 270, 228])),
      btn('Break it: a response that lists every candidate', () => set([300, 300, 300], 'A response that names every possible answer always contains the gold string: accuracy 1.0 at every noise level, yet it answers nothing. Containment cannot see this.')),
      btn('Break it: noise that fools the model', () => set([289, 150, 40], 'If the noise looks like the answer (same topic, a wrong value), accuracy collapses much faster than the paper curve.'))),
      ...sl.map(s => K.el('div', { class: 'row' }, s.node)), res.node, svg, formula, note);
    function render() {
      const r = compute({ N: st.N, correct: st.c }); res.set(r['drop_0_to_0.8'], 4);
      const X = { '0': 30, '0.6': 150, '0.8': 240 }, pts = keys.map(k => [X[k], 110 - 100 * st.c[k] / st.N]);
      svg.replaceChildren(K.svg('line', { x1: 20, y1: 110, x2: 290, y2: 110, stroke: '#888', 'stroke-width': 1 }), K.svg('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#f2a93b', 'stroke-width': 2.5 }),
        ...keys.flatMap((k, i) => { const t = K.svg('text', { x: pts[i][0], y: pts[i][1] - 6, fill: '#f2a93b', 'font-size': 9, 'text-anchor': 'middle' }); t.textContent = K.fmt(st.c[k] / st.N, 3);
          const a = K.svg('text', { x: X[k], y: 124, fill: '#888', 'font-size': 9, 'text-anchor': 'middle' }); a.textContent = 'r = ' + k; return [K.svg('circle', { cx: pts[i][0], cy: pts[i][1], r: 3.5, fill: '#f2a93b' }), t, a]; }));
      formula.textContent = keys.map(k => 'Acc(' + k + ') = ' + st.c[k] + ' / ' + st.N + ' = ' + K.fmt(st.c[k] / st.N, 4)).join('\n') + '\ndrop = ' + K.fmt(r.acc_r0, 4) + ' - ' + K.fmt(r['acc_r0.8'], 4) + ' = ' + K.fmt(r['drop_0_to_0.8'], 4);
      note.textContent = st.label || 'Accuracy is the share of questions whose gold string appears in the response; the drop from r = 0 to r = 0.8 is the metric of interest.';
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/noise_robustness.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('noise_robustness.real.json ' + r.status); return r.json(); });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, Q = D.questions, byId = {}; Q.forEach(q => { byId[q.id] = q; });
    const st = { q: 'q18', lvl: '4', basis: 'judge' };
    const shell = K.shell(el, 'Real example: 9 questions, 5-passage contexts with 0, 2, 4 noise passages',
      'A NEW small experiment (the pack has no noise run): n = 9 answerable questions, one run, ' + D.calls + ' calls, USD ' + D.usd + ' (' + D.answer_model + ' answers, ' + D.judge_model + ' judges, temperature 0). The gold passages are always kept; the other slots hold the ' +
      'retrieved non-gold fill at noise 0, replaced by random non-gold passages as noise grows. Bridge questions have 2 gold passages, so their top level is 3 noise of 5 (marked capped). ' +
      'The noise comes from the SAME 138-passage ML corpus (hard negatives: related topics, sometimes related facts), not random web text. One question moves accuracy by 0.11. Gold labels cover only the passages judged necessary. Another run can give other numbers.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, Q.map(q => opt(q.id, q.id + ' (' + q.type + '): ' + q.question)));
    const lSel = K.el('select', { 'aria-label': 'noise passages in the context' }, ['0', '2', '4'].map(l => opt(l, l + ' noise of 5')));
    const bSel = K.el('select', { 'aria-label': 'how correctness is decided' }, [opt('judge', 'LLM judge (key facts present)'), opt('rule', 'RGB string rule (all check terms)')]);
    qSel.value = st.q; lSel.value = st.lvl;
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); }); lSel.addEventListener('change', () => { st.lvl = lSel.value; render(); }); bSel.addEventListener('change', () => { st.basis = bSel.value; render(); });
    const jump = (q, l, b) => () => { st.q = q; st.lvl = l; if (b) { st.basis = b; bSel.value = b; } qSel.value = q; lSel.value = l; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Clean context (q18, 0 noise)', jump('q18', '0')), btn('Heavy noise (q18, 4 noise)', jump('q18', '4')),
      btn('Break it: the string rule fails a right answer (q18, 0 noise)', jump('q18', '0', 'rule')), btn('Bridge, capped at 3 noise (q09)', jump('q09', '4')));
    const res = K.resultBox(), pr = K.el('div', { class: 'row' }), ctx = K.el('div', { style: 'overflow-wrap:anywhere' }), ans = K.el('div', { style: 'overflow-wrap:anywhere' });
    const svg = K.svg('svg', { viewBox: '0 0 300 130', style: 'width:100%;max-width:520px;height:auto;display:block', role: 'img', 'aria-label': 'real accuracy against noise level' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tbl = K.el('div'), summ = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    shell.append(presets, K.el('div', { class: 'row' }, K.el('label', {}, 'noise ', lSel), K.el('label', {}, 'correct = ', bSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), pr, res.node, ctx, ans, svg, formula, note, tbl, summ);

    const ok = (q, l) => st.basis === 'judge' ? q.levels[l].correct : q.levels[l].rule_correct;
    const acc = l => Q.reduce((s, q) => s + ok(q, l), 0) / Q.length;
    function render() {
      const q = byId[st.q], L = q.levels[st.lvl], a0 = acc('0'), a4 = acc('4');
      res.set(acc(st.lvl), 3);
      pr.replaceChildren(K.el('span', { class: 'num good' }, 'Acc at ' + st.lvl + ' noise = ' + K.fmt(acc(st.lvl), 3) + ' (' + Q.reduce((s, x) => s + ok(x, st.lvl), 0) + '/' + Q.length + ')'),
        K.el('span', { class: 'num' }, 'this question: ' + (ok(q, st.lvl) ? 'correct' : 'wrong') + ' (judge ' + L.judge_score + ', rule ' + L.rule_correct + ')'), K.el('span', { class: 'num' }, L.noise_count + ' noise of 5' + (L.capped ? ' (capped)' : '')));
      ctx.replaceChildren(K.el('div', { class: 'hint' }, 'context passage ids, in the order the model saw them (gold ' + q.gold_passages.join(', ') + ' in green, noise in red)'),
        ...L.context_ids.map(id => K.el('span', { class: 'num', style: 'margin-right:8px;color:' + (L.noise_ids.includes(id) ? '#ff6b6b' : q.gold_passages.includes(id) ? '#4cc38a' : 'inherit') }, id + (L.noise_ids.includes(id) ? ' noise' : q.gold_passages.includes(id) ? ' gold' : ' fill'))));
      ans.replaceChildren(K.el('div', { class: 'hint' }, 'reference answer: ' + q.gold_answer + '   (check terms: ' + q.check_terms.join(' | ') + ')'), K.el('div', { class: 'hint' }, 'answer'), K.el('div', { style: 'color:var(--k12,#7c9cff)' }, L.answer), K.el('div', { class: 'hint' }, 'judge: ' + L.judge_reason));
      const ls = ['0', '2', '4'], X = { '0': 40, '2': 150, '4': 260 };
      svg.replaceChildren(K.svg('line', { x1: 20, y1: 110, x2: 290, y2: 110, stroke: '#888' }), K.svg('polyline', { points: ls.map(l => X[l] + ',' + (110 - 100 * acc(l))).join(' '), fill: 'none', stroke: '#f2a93b', 'stroke-width': 2.5 }),
        ...ls.flatMap(l => { const y = 110 - 100 * acc(l), t = K.svg('text', { x: X[l], y: y - 6, fill: '#f2a93b', 'font-size': 9, 'text-anchor': 'middle' }); t.textContent = K.fmt(acc(l), 3);
          const a = K.svg('text', { x: X[l], y: 124, fill: '#888', 'font-size': 9, 'text-anchor': 'middle' }); a.textContent = l + ' of 5 noise'; return [K.svg('circle', { cx: X[l], cy: y, r: 3.5, fill: '#f2a93b' }), t, a]; }));
      formula.textContent = ls.map(l => 'Acc(' + l + ' noise) = ' + Q.reduce((s, x) => s + ok(x, l), 0) + ' / ' + Q.length + ' = ' + K.fmt(acc(l), 4)).join('\n') + '\ndrop (0 to 4 noise) = ' + K.fmt(a0, 4) + ' - ' + K.fmt(a4, 4) + ' = ' + K.fmt(a0 - a4, 4);
      note.textContent = 'Verdict on this tiny run: with the LLM judge accuracy stays 9/9 at every level, so this model shows no measurable distraction by same-corpus noise at 5 passages; the data cannot tell a flat curve from a small drop (n = 9). The string rule moves (0.889, 0.667, 0.778) but the misses are paraphrases ("one run" for "single run"), not noise: a brittle rule measures wording, not robustness. ' +
        (L.capped ? 'This question has 2 gold passages, so its 4-noise level has only 3 noise. ' : '');
      drawTable();
    }
    function drawTable() {
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['q', 'type', 'noise 0', 'noise 2', 'noise 4', '(judge / rule)'].map(h => K.el('th', { style: 'padding:1px 5px;text-align:right' }, h))));
      Q.forEach(q => t.append(K.el('tr', { style: q.id === st.q ? 'font-weight:700' : '' }, ...[q.id, q.type, ...['0', '2', '4'].map(l => (q.levels[l].correct ? 'ok' : 'x') + '/' + (q.levels[l].rule_correct ? 'ok' : 'x') + (q.levels[l].capped ? '*' : '')), '* = 3 noise'].map(x => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(x))))));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All 27 (question, level) outcomes'), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t)));
      summ.textContent = 'Judge accuracy 0 / 2 / 4 noise: ' + ['0', '2', '4'].map(l => K.fmt(Q.reduce((s, x) => s + x.levels[l].correct, 0) / Q.length, 3)).join(' / ') + '; string-rule accuracy: ' + ['0', '2', '4'].map(l => K.fmt(Q.reduce((s, x) => s + x.levels[l].rule_correct, 0) / Q.length, 3)).join(' / ') +
        '. Refusals: ' + ['0', '2', '4'].map(l => Q.reduce((s, x) => s + (x.levels[l].refused ? 1 : 0), 0)).join(' / ') + '. n = 9, one run, one model, noise from the same corpus.';
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false'); body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); }).catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy); real();
  }
  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['noise_robustness'] = api;
})(this);
