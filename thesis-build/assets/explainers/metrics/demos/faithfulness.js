/* Faithfulness (RAGAS) demo: the answer is split into statements; the "judge" marks each supported or not.
   The LLM judge is simulated: verdicts are an editable table, or a toy lexical-overlap judge. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { verdicts: [1, 1, 1, 0, 1] };
  const CONTEXT = 'Marie Curie was born in Warsaw. She won the Nobel Prize in Physics. She won the Nobel Prize in Chemistry.';
  const STATEMENTS = ['Curie was born in Warsaw.', 'She won a Nobel Prize in Physics.', 'She won a Nobel Prize in Chemistry.', 'She discovered penicillin.', 'She won two Nobel Prizes.'];

  /* PURE: F = |V| / |S|  (verdicts[i] = 1 if statement i is judged inferable from the context). No statements -> 0. */
  function compute(inp) {
    const v = inp.verdicts;
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }

  const STOP = new Set(['a', 'an', 'the', 'she', 'he', 'it', 'in', 'of', 'was', 'is', 'to', 'and']);
  const words = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
  /* toy judge: supported if >= 60% of the statement's content words occur in the context */
  function toyJudge(stmt, ctx) {
    const c = new Set(words(ctx)), w = words(stmt);
    return w.length && w.filter(x => c.has(x)).length / w.length >= 0.6 ? 1 : 0;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { v: defaults.verdicts.slice(), s: STATEMENTS.slice(), ctx: CONTEXT };
    const shell = K.shell(el, 'Toy example (break it)',
      'The answer is split into statements. Click a verdict button to flip it (supported or not). Edit the context or the statements and press the toy judge to try a simple overlap rule.');
    const ctxBox = K.el('textarea', { rows: '3', style: 'width:100%;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit', 'aria-label': 'retrieved context' }, st.ctx);
    ctxBox.addEventListener('input', () => { st.ctx = ctxBox.value; });
    const list = K.el('div', { role: 'group', 'aria-label': 'answer statements' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.v = defaults.verdicts.slice(); st.s = STATEMENTS.slice(); st.ctx = CONTEXT; ctxBox.value = CONTEXT; render(); }),
      btn('Break it: "I do not know"', () => { st.s = ['I do not know.']; st.v = [1]; render(); }),
      btn('Break it: wrong passage', () => { st.ctx = 'Marie Curie was born in Paris.'; ctxBox.value = st.ctx; st.s = ['Curie was born in Paris.']; st.v = [1]; render(); }),
      btn('Toy judge (word overlap)', () => { st.v = st.s.map(s => toyJudge(s, st.ctx)); render(); }),
      btn('+ statement', () => { if (st.s.length < 8) { st.s.push('New statement.'); st.v.push(0); render(); } }),
      btn('- statement', () => { if (st.s.length > 1) { st.s.pop(); st.v.pop(); render(); } }));
    shell.append(K.el('label', {}, 'Retrieved context'), ctxBox, presets, list, res.node, formula, note);

    function render() {
      list.replaceChildren();
      st.s.forEach((s, i) => {
        const x = st.v[i];
        const flip = K.el('button', {
          type: 'button', 'aria-pressed': x ? 'true' : 'false', title: x ? 'judged supported' : 'judged unsupported',
          style: 'min-width:120px;' + (x ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
          onclick: () => { st.v[i] = 1 - st.v[i]; render(); },
        }, x ? 'supported' : 'unsupported');
        const inp = K.el('input', { type: 'text', value: s, 'aria-label': 'statement ' + (i + 1), style: 'flex:1;min-width:140px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font:inherit' });
        inp.addEventListener('change', () => { st.s[i] = inp.value; });
        list.append(K.el('div', { class: 'row' }, K.el('span', { class: 'num' }, (i + 1) + '.'), inp, flip));
      });
      const score = compute({ verdicts: st.v }), n = st.v.length, sup = st.v.reduce((a, b) => a + b, 0);
      res.set(score, 3);
      formula.textContent = `F = |V| / |S| = ${sup} / ${n} = ${K.fmt(score, 3)}`;
      note.textContent = 'F checks the answer against the context, not against the truth. A faithful answer to a wrong passage scores 1, and "I do not know" has no unsupported claim so it also scores 1. The real judge is an LLM and can misread paraphrase.';
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

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.m.per_question.B);
    const st = { arm: 'B', q: 'q09', judge: 'A' };
    const shell = K.shell(el, 'Real example: faithfulness of real answers, claim by claim',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable), one run, temperature 0, no human labels. Answerer ' + D.m.answer_model + '; judge A ' + D.m.judge_A + ', judge B ' + D.m.judge_B + ' (both LLMs, they can be wrong). Claims were extracted by one LLM (judge A) and both judges classify the same claims.');
    const caveats = K.el('ul', { class: 'hint', style: 'margin:0 0 12px;padding-left:18px' },
      K.el('li', {}, 'Arm C gets about 40% more context than arm B (dense top-5 plus graph passages vs hybrid RRF top-5), so B vs C does not isolate the graph.'),
      K.el('li', {}, 'Arm A has no retrieval. Its low score means "not in the corpus sample", not "false": many A claims are true world knowledge.'),
      K.el('li', {}, 'Claims are judged against a shared evidence pool (B context + C context + gold passages), the same for every arm. A claim can be supported by a passage that this arm did not retrieve; such passages are marked.'),
      K.el('li', {}, 'Claim extraction is imperfect: judge A labelled two meta-claims ("the source does not specify ...") in q09/B as contradicted, which pulls that score down.'));
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const jSel = K.el('select', { 'aria-label': 'judge', style: 'max-width:100%' }, [opt('A', 'judge A: ' + D.m.judge_A), opt('B', 'judge B: ' + D.m.judge_B)]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q; jSel.value = st.judge;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    jSel.addEventListener('change', () => { st.judge = jSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'claims and verdicts' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint' });
    shell.append(caveats, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, 'judge ', jSel)),
      K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, list, res.node, formula, note, means);

    function render() {
      const key = st.q + '_' + st.arm, q = D.qs[st.q], a = D.ans[key], v = D.ver[st.judge + '_' + key];
      const own = new Set(a.context_ids);
      info.replaceChildren(
        K.el('p', { class: 'hint' }, 'Gold answer: ' + q.gold_answer + '  (gold passages: ' + q.gold_passages.join(', ') + ')'),
        K.el('p', { class: 'hint' }, st.arm === 'A' ? 'Context given to the answerer: none.' : 'Context given to the answerer (' + a.context_ids.length + ' passages): ' + a.context_ids.join(', ')),
        K.el('p', {}, K.el('b', {}, 'Answer' + (a.refused ? ' (refusal)' : '') + ': '), a.answer));
      list.replaceChildren();
      const claims = v ? v.claims : [];
      if (!claims.length) {
        list.append(K.el('p', { class: 'hint bad' }, 'No claims: the answer is a refusal, so there is nothing to check. Faithfulness is undefined (n/a), not 1, and the answer is left out of the arm mean.'));
        res.set(NaN); formula.textContent = 'F = n/a (0 claims)'; note.textContent = '';
      } else {
        const bits = claims.map((c, i) => {
          const x = v.verdicts[i];
          const ps = (x.passages || []).map(p => own.has(p) || st.arm === 'A' ? p : p + ' (not in this arm\'s context)');
          const det = K.el('details', { style: 'margin-top:2px' }, K.el('summary', { class: 'hint' }, 'evidence'),
            ...((x.passages || []).length ? x.passages.map(p => K.el('p', { class: 'hint', style: 'margin:2px 0' }, p + ': ' + (D.pas[p] ? D.pas[p].text.slice(0, 280) + (D.pas[p].text.length > 280 ? ' ...' : '') : ''))) : [K.el('p', { class: 'hint', style: 'margin:2px 0' }, 'no supporting passage named')]));
          list.append(K.el('div', { style: 'margin:3px 0;padding:2px 6px;border-left:4px solid var(--' + VCOL[x.verdict] + ')' },
            K.el('b', { class: x.verdict === 'supported' ? 'good' : 'bad' }, (i + 1) + '. ' + x.verdict + (ps.length ? ' by ' + ps.join(', ') : '') + ' '),
            K.el('span', { class: 'hint' }, c), det));
          return x.verdict === 'supported' ? 1 : 0;
        });
        const sup = bits.reduce((p, b) => p + b, 0), sc = compute({ verdicts: bits });
        res.set(sc);
        formula.textContent = `F = |V| / |S| = ${sup} supported / ${claims.length} claims = ${K.fmt(sc)}`;
        const stored = (st.judge === 'A' ? D.m.per_question : D.m.per_question_judgeB)[st.arm][st.q];
        const nc = v.verdicts.filter(x => x.verdict === 'contradicted').length;
        note.textContent = (Math.abs(sc - stored) < 5e-4 ? 'Matches the pack value ' + stored : 'MISMATCH with pack value ' + stored) + '. Unsupported and contradicted claims both count as not supported' + (nc ? ' (' + nc + ' contradicted)' : '') + '.' +
          (st.arm === 'A' ? ' Arm A: "unsupported" = not found in the corpus sample, not necessarily false.' : '') +
          (st.q === 'q09' && st.arm === 'B' && st.judge === 'A' ? ' Here judge A called two meta-claims ("the source does not specify ...") contradicted, so this arm scores low although the answer is an honest "not in the sources".' : '');
      }
      const row = ar => {
        const xs = qids.map(id => D.ver[st.judge + '_' + id + '_' + ar]).filter(r => r && r.claims.length)
          .map(r => compute({ verdicts: r.verdicts.map(x => x.verdict === 'supported' ? 1 : 0) }));
        const s = st.judge === 'A' ? D.m.summary[ar] : D.sum.arms[ar].faithfulness_pool_judgeB;
        return `${ar}: ${K.fmt(meanOf(xs), 3)} over n=${xs.length} answers with claims (stored bootstrap 95% CI [${s.ci95.join(', ')}])`;
      };
      const pc = D.sum.paired_comparisons.C_minus_B_faithfulness_pool_judgeA;
      means.textContent = 'Arm means, judge ' + st.judge + ', shared pool: ' + ['A', 'B', 'C'].map(row).join('  |  ') +
        '.  Paired C minus B (judge A, n=' + pc.n + '): ' + K.fmt(pc.mean_diff, 3) + ' [' + pc.ci95.join(', ') + '], not distinguishable from zero.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['faithfulness'] = api;
})(this);
