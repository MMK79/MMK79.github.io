/* FActScore demo: atomic facts of an answer, each checked against a fixed knowledge source; score = supported / facts.
   Real mode: real claim-level verdicts from the answer study (pack slice 4). Toy mode: editable facts and source. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { verdicts: [1, 1, 1, 1, 1, 1, 1, 0, 0, 0] };
  const SOURCE = 'The course textbook says: k-fold cross-validation splits the sample into k equal folds. Each fold is used once for validation and k-1 folds for training. The scores are averaged.';
  const FACTS = ['The data are split into k equal folds.', 'Each fold is used once for validation.', 'The other k-1 folds are used for training.', 'The k scores are averaged.',
    'The model is trained k times.', 'Folds are chosen at random.', 'k = 10 is a common choice.', 'It was invented in 1974.', 'It always beats a single split.', 'It needs a GPU.'];

  /* PURE: FActScore = supported facts / all atomic facts (verdicts[i] = 1 if fact i is supported by the source). No facts -> 0. */
  function compute(inp) {
    const v = inp.verdicts;
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }

  const STOP = new Set(['a', 'an', 'the', 'it', 'in', 'of', 'is', 'are', 'was', 'to', 'and', 'for', 'be', 'by']);
  const words = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
  function toyJudge(f, src) { const c = new Set(words(src)), w = words(f); return w.length && w.filter(x => c.has(x)).length / w.length >= 0.6 ? 1 : 0; }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { v: defaults.verdicts.slice(), s: FACTS.slice(), src: SOURCE };
    const shell = K.shell(el, 'Toy example (break it)',
      'An answer is split into atomic facts; each is checked against a knowledge source. Click a verdict to flip it, edit the source or the facts, or press the toy judge (word overlap, not an LLM).');
    const ctxBox = K.el('textarea', { rows: '3', style: 'width:100%;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit', 'aria-label': 'knowledge source' }, st.src);
    ctxBox.addEventListener('input', () => { st.src = ctxBox.value; });
    const list = K.el('div', { role: 'group', 'aria-label': 'atomic facts' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example (7 of 10)', () => { st.v = defaults.verdicts.slice(); st.s = FACTS.slice(); st.src = SOURCE; ctxBox.value = SOURCE; render(); }),
      btn('Break it: true fact, thin source', () => { st.src = 'The course textbook says: the sample is split into k folds.'; ctxBox.value = st.src; st.s = ['The data are split into k folds.', 'Each point is used for validation exactly once.', 'The scores are averaged.']; st.v = [1, 0, 0]; render(); }),
      btn('Toy judge (word overlap)', () => { st.v = st.s.map(s => toyJudge(s, st.src)); render(); }),
      btn('+ fact', () => { if (st.s.length < 12) { st.s.push('New fact.'); st.v.push(0); render(); } }),
      btn('- fact', () => { if (st.s.length > 1) { st.s.pop(); st.v.pop(); render(); } }));
    shell.append(K.el('label', {}, 'Knowledge source'), ctxBox, presets, list, res.node, formula, note);
    function render() {
      list.replaceChildren();
      st.s.forEach((s, i) => {
        const x = st.v[i];
        const flip = K.el('button', { type: 'button', 'aria-pressed': x ? 'true' : 'false', title: x ? 'supported by the source' : 'not supported',
          style: 'min-width:120px;' + (x ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'), onclick: () => { st.v[i] = 1 - st.v[i]; render(); } }, x ? 'supported' : 'unsupported');
        const inp = K.el('input', { type: 'text', value: s, 'aria-label': 'fact ' + (i + 1), style: 'flex:1;min-width:140px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:inherit' });
        inp.addEventListener('change', () => { st.s[i] = inp.value; });
        list.append(K.el('div', { class: 'row' }, K.el('span', { class: 'num' }, (i + 1) + '.'), inp, flip));
      });
      const score = compute({ verdicts: st.v }), sup = st.v.reduce((a, b) => a + b, 0);
      res.set(score, 3);
      formula.textContent = `FActScore = supported / facts = ${sup} / ${st.v.length} = ${K.fmt(score, 3)}`;
      note.textContent = 'A true fact that the source does not contain counts as an error, and omissions are not penalised: a one-fact answer that is supported scores 1. The real judge is an LLM, and fact splitting is itself an LLM step.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/ + metrics/faithfulness.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/faithfulness.json'), get('answers/answers.json'), get('answers/verdicts.json'), get('answers/summary.json'), get('data/questions.json'), get('data/corpus.json')]).then(a => {
      const ans = {}; a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      const ver = {}; a[2].forEach(r => { ver[r.judge + '_' + r.qid + '_' + r.arm] = r; });
      const qs = {}; a[4].forEach(q => { qs[q.id] = q; });
      const pas = {}; a[5].forEach(p => { pas[p.id] = p; });
      return { m: a[0], ans, ver, sum: a[3], qs, pas };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  const VCOL = { supported: 'he', unsupported: 'warn', contradicted: 'warn' };
  const bitsOf = r => r.verdicts.map(x => x.verdict === 'supported' ? 1 : 0);

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.m.per_question.B);
    const st = { arm: 'A', q: 'q04', judge: 'A' };
    const shell = K.shell(el, 'Real example: atomic facts of real answers against a fixed source',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable), one run, no human labels. Answerer ' + D.m.answer_model + '; judge A ' + D.m.judge_A + ', judge B ' + D.m.judge_B + ' (both LLMs). Here an atomic fact is one claim extracted by an LLM from the answer.');
    const caveats = K.el('ul', { class: 'hint', style: 'margin:0 0 12px;padding-left:18px' },
      K.el('li', {}, 'Knowledge source here: the shared evidence pool (the 138-passage Wikipedia corpus sample, as retrieved for arms B and C, plus the gold passages), the same for every arm. Original FActScore (Min et al. 2023) uses the whole of Wikipedia and retrieves passages per fact; this is a small fixed sample, and a fact outside the sample counts as unsupported.'),
      K.el('li', {}, 'Arm A has no retrieval: its "unsupported" means "not in the corpus sample", not "false". Many arm-A facts are true world knowledge.'),
      K.el('li', {}, 'Honest overlap with faithfulness: the arithmetic is identical (supported / claims) and these are the same claims and verdicts as the faithfulness demo. The difference is only the source: faithfulness uses the context the answerer was given, FActScore a fixed source for all arms. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.'),
      K.el('li', {}, 'Refusals have no facts: FActScore is undefined, the answer is left out of the arm mean (the original paper also does not score abstentions).'));
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const jSel = K.el('select', { 'aria-label': 'judge', style: 'max-width:100%' }, [opt('A', 'judge A: ' + D.m.judge_A), opt('B', 'judge B: ' + D.m.judge_B)]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q; jSel.value = st.judge;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    jSel.addEventListener('change', () => { st.judge = jSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'atomic facts and verdicts' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint' });
    shell.append(caveats, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, 'judge ', jSel)),
      K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, list, res.node, formula, note, means);

    function render() {
      const key = st.q + '_' + st.arm, q = D.qs[st.q], a = D.ans[key], v = D.ver[st.judge + '_' + key];
      info.replaceChildren(
        K.el('p', { class: 'hint' }, 'Gold answer: ' + q.gold_answer + '  (gold passages: ' + q.gold_passages.join(', ') + ')'),
        K.el('p', {}, K.el('b', {}, 'Answer' + (a.refused ? ' (refusal)' : '') + ': '), a.answer));
      list.replaceChildren();
      const claims = v ? v.claims : [];
      if (!claims.length) {
        list.append(K.el('p', { class: 'hint bad' }, 'No atomic facts: the answer is a refusal, so FActScore is undefined (n/a), not 1, and the answer is left out of the arm mean.'));
        res.set(NaN); formula.textContent = 'FActScore = n/a (0 facts)'; note.textContent = '';
      } else {
        claims.forEach((c, i) => {
          const x = v.verdicts[i], ps = x.passages || [];
          const det = K.el('details', { style: 'margin-top:2px' }, K.el('summary', { class: 'hint' }, 'source passage'),
            ...(ps.length ? ps.map(p => K.el('p', { class: 'hint', style: 'margin:2px 0' }, p + ': ' + (D.pas[p] ? D.pas[p].text.slice(0, 280) + (D.pas[p].text.length > 280 ? ' ...' : '') : ''))) : [K.el('p', { class: 'hint', style: 'margin:2px 0' }, 'no passage in the source supports this fact')]));
          list.append(K.el('div', { style: 'margin:3px 0;padding:2px 6px;border-left:4px solid var(--' + VCOL[x.verdict] + ')' },
            K.el('b', { class: x.verdict === 'supported' ? 'good' : 'bad' }, (i + 1) + '. ' + x.verdict + (ps.length ? ' by ' + ps.join(', ') : '') + ' '),
            K.el('span', { class: 'hint' }, c), det));
        });
        const bits = bitsOf(v), sup = bits.reduce((p, b) => p + b, 0), sc = compute({ verdicts: bits });
        res.set(sc);
        formula.textContent = `FActScore = supported / facts = ${sup} / ${claims.length} = ${K.fmt(sc)}`;
        const stored = (st.judge === 'A' ? D.m.per_question : D.m.per_question_judgeB)[st.arm][st.q];
        const own = st.judge === 'A' ? D.m.per_question_own_context[st.arm][st.q] : undefined;
        const nc = v.verdicts.filter(x => x.verdict === 'contradicted').length;
        note.textContent = (Math.abs(sc - stored) < 5e-4 ? 'Matches the pack value ' + stored : 'MISMATCH with pack value ' + stored) + ' (fixed shared source). Unsupported and contradicted facts both count as not supported' + (nc ? ' (' + nc + ' contradicted)' : '') + '.' +
          (st.judge === 'A' ? (own == null ? ' Faithfulness of this answer (own retrieved context): undefined, ' + (st.arm === 'A' ? 'arm A had no context.' : 'no facts.') + ' FActScore still has a value because the source is fixed.'
            : ' Faithfulness of the same answer against only its own context: ' + K.fmt(own) + (Math.abs(own - sc) > 5e-4 ? ' (differs from FActScore because a fact can be supported by a passage this arm did not retrieve, or by none of its own).' : ' (same here).')) : '') +
          (st.arm === 'A' ? ' Arm A: "unsupported" = not found in the corpus sample, not necessarily false.' : '') +
          (st.q === 'q09' && st.arm === 'B' && st.judge === 'A' ? ' Judge A called two meta-claims ("the source does not specify ...") contradicted, so this honest answer scores low.' : '');
      }
      const row = ar => {
        const rs = qids.map(id => D.ver[st.judge + '_' + id + '_' + ar]).filter(r => r && r.claims.length);
        const macro = meanOf(rs.map(r => compute({ verdicts: bitsOf(r) })));
        const tot = rs.reduce((p, r) => p + r.claims.length, 0), sp = rs.reduce((p, r) => p + bitsOf(r).reduce((x, y) => x + y, 0), 0);
        const s = st.judge === 'A' ? D.m.summary[ar] : D.sum.arms[ar].faithfulness_pool_judgeB;
        return `${ar}: ${K.fmt(macro, 3)} mean over n=${rs.length} answers (pooled over facts ${sp}/${tot} = ${K.fmt(sp / tot, 3)}; stored bootstrap 95% CI [${s.ci95.join(', ')}])`;
      };
      means.textContent = 'FActScore per arm, judge ' + st.judge + ' (mean of per-answer scores, as in the original paper): ' + ['A', 'B', 'C'].map(row).join('  |  ') + '.  The intervals are wide at n = 12.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['factscore'] = api;
})(this);
