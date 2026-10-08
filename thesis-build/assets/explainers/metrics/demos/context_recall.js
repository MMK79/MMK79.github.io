/* Context recall demo: tick which reference claims the judge found in the retrieved context. The judge step is an editable table. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    claims: [
      'Paris is the capital of France',
      'Paris lies on the Seine',
      'Paris has about 2.1 million residents',
      'The Louvre is in Paris',
    ],
    supported: [true, true, false, true],   // the LLM judge's verdict per claim (precomputed, editable)
  };

  /* PURE: CRec = supported claims / all reference claims */
  function compute(inp) {
    const n = inp.supported.length;
    if (!n) return 0;
    return inp.supported.filter(Boolean).length / n;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { claims: defaults.claims.slice(), supported: defaults.supported.slice(), extra: false };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each row is one claim of the reference answer. Tick it when the judge finds support in the retrieved context. The judge is a table you edit; no model runs here.');
    const list = K.el('div', { role: 'group', 'aria-label': 'reference claims' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const addInp = K.el('input', { type: 'text', placeholder: 'add a claim', 'aria-label': 'new claim' });
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.claims = defaults.claims.slice(); st.supported = defaults.supported.slice(); render(); }),
      btn('Break it: lenient judge accepts all', () => { st.supported = st.supported.map(() => true); render(); }),
      btn('Break it: add an unrelated claim', () => { st.claims.push('Paris hosted the 1900 Olympics'); st.supported.push(false); render(); }));
    const adder = K.el('div', { class: 'row' }, addInp, btn('Add', () => {
      const v = addInp.value.trim(); if (!v) return;
      st.claims.push(v); st.supported.push(false); addInp.value = ''; render();
    }));
    shell.append(presets, list, adder, res.node, formula, note);

    function render() {
      list.replaceChildren();
      st.claims.forEach((c, i) => {
        const ok = st.supported[i];
        const cb = K.el('input', { type: 'checkbox', 'aria-label': 'supported: ' + c });
        cb.checked = ok;
        cb.addEventListener('change', () => { st.supported[i] = cb.checked; render(); });
        const rm = K.el('button', { type: 'button', 'aria-label': 'remove claim ' + (i + 1), onclick: () => { st.claims.splice(i, 1); st.supported.splice(i, 1); render(); } }, 'x');
        list.append(K.el('div', { class: 'row', style: 'color:var(--' + (ok ? 'he' : 'warn') + ')' },
          K.el('label', {}, cb, ' ' + (i + 1) + '. ' + c + (ok ? '  (supported)' : '  (no support)')), rm));
      });
      const n = st.claims.length, h = st.supported.filter(Boolean).length;
      res.set(compute({ supported: st.supported }));
      formula.textContent = n ? `CRec = ${h} supported / ${n} claims = ${K.fmt(h / n)}` : 'CRec = 0 / 0 (add a claim)';
      note.textContent = h === n && n > 0
        ? 'Score is 1, but the metric only trusts the judge. A loose paraphrase counts as support, and extra useful context is never rewarded.'
        : `${n - h} claim(s) have no support in the retrieved context: that is the missing information.`;
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/ + metrics/context_recall.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/context_recall.json'), get('answers/context_judgments.json'), get('data/questions.json')]).then(a => {
      const ctx = {}; a[1].forEach(r => { ctx[r.qid + '_' + r.arm] = r.context_ids; });
      const qs = {}; a[2].forEach(q => { qs[q.id] = q; });
      return { m: a[0], ctx, qs };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.m.per_question.B);
    const st = { arm: 'B', q: qids[0] };
    const shell = K.shell(el, 'Real example: Context recall on real retrieval and a real judge',
      'Scale: n = 12 questions (9 answerable), one run, temperature 0, LLM judges (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Arm A (no retrieval) has no context, so the metric is undefined there. Claims are split from the gold answer by the judge; verdicts are the real judge output, not editable.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'gold-answer claims' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, list, res.node, formula, note, means);

    function render() {
      const key = st.q + '_' + st.arm, q = D.qs[st.q], js = D.m.judgments[key];
      info.replaceChildren(K.el('p', { class: 'hint' }, 'Gold answer: ' + q.gold_answer));
      list.replaceChildren();
      if (st.arm === 'A' || !js) {
        list.append(K.el('p', { class: 'hint bad' }, 'Arm A retrieves nothing, so there is no context to check the gold claims against: context recall is undefined (n/a), not zero.'));
        res.set(NaN); formula.textContent = 'CRec = n/a (no context)'; note.textContent = '';
      } else {
        const ids = D.ctx[key] || [];
        info.append(K.el('p', { class: 'hint' }, 'Retrieved context (' + ids.length + ' passages): ' + ids.join(', ')));
        js.forEach((c, i) => {
          const ok = !!c.supported;
          list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (ok ? 'he' : 'warn') + ')' },
            K.el('b', {}, (i + 1) + '. ' + (ok ? 'supported' : 'no support') + (c.passages && c.passages.length ? ' by ' + c.passages.join(', ') : '') + ' '),
            K.el('span', { class: 'hint' }, c.text)));
        });
        const h = js.filter(c => c.supported).length;
        const v = compute({ supported: js.map(c => !!c.supported) });
        res.set(v);
        formula.textContent = `CRec = ${h} supported / ${js.length} claims = ${K.fmt(v)}`;
        const gold = D.m.per_question_gold_labels[st.arm][st.q];
        const stored = D.m.per_question[st.arm][st.q];
        note.textContent = (Math.abs(v - stored) < 5e-4 ? 'Matches the pack value ' + stored : 'MISMATCH with pack value ' + stored) +
          '. Comparison: gold-passage recall (does the context contain the passage that was labelled necessary) = ' + K.fmt(gold) + '.' +
          (v < 1 ? ' Unsupported claims are information missing from the retrieved context.' : '');
      }
      const row = a => {
        if (a === 'A') return 'A: n/a (no context)';
        const xs = qids.filter(id => (D.m.judgments[id + '_' + a] || []).length)
          .map(id => compute({ supported: D.m.judgments[id + '_' + a].map(c => !!c.supported) }));
        const s = D.m.summary[a].judge;
        return `${a}: ${K.fmt(meanOf(xs), 4)} recomputed over n=${xs.length} (pack ${s.mean}, 95% CI [${s.ci95.join(', ')}])`;
      };
      means.textContent = 'Arm means (answerable questions, judge A): ' + ['A', 'B', 'C'].map(row).join('  |  ');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['context_recall'] = api;
})(this);
