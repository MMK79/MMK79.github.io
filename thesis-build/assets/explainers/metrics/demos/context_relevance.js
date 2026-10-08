/* Context relevance (RAGAS / TruLens): share of the retrieved context that is needed to answer.
   Toy: click sentences to mark them necessary. Real: judge A's passage-level verdicts on the retrieved passages (not sentence-level). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { necessary: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] };

  /* PURE: CR = necessary items / all items (0 for an empty context) */
  function compute(inp) {
    const v = inp.necessary;
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
  }
  const cpOf = v => { let h = 0, n = 0; v.forEach((x, i) => { h += x; if (x) n += h / (i + 1); }); return h ? n / h : 0; };
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { v: defaults.necessary.slice() };
    const shell = K.shell(el, 'Context relevance (RAGAS): toy example',
      'A context of sentences. Click a sentence to mark it as necessary (this plays the LLM judge). The score is the share marked necessary.');
    const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'context sentences' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example (3 of 12)', () => { st.v = defaults.necessary.slice(); render(); }),
      btn('Break it: add 12 padding sentences', () => { st.v = st.v.concat(new Array(12).fill(0)); render(); }),
      btn('Break it: judge marks all', () => { st.v = st.v.map(() => 1); render(); }),
      btn('+ sentence', () => { if (st.v.length < 40) { st.v.push(0); render(); } }),
      btn('- sentence', () => { if (st.v.length > 1) { st.v.pop(); render(); } })), strip, res.node, formula, note);
    function render() {
      strip.replaceChildren();
      st.v.forEach((x, i) => strip.append(K.el('button', {
        type: 'button', 'aria-pressed': x ? 'true' : 'false', title: x ? 'necessary' : 'not necessary',
        style: 'min-width:64px;' + (x ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
        onclick: () => { st.v[i] = 1 - st.v[i]; render(); },
      }, 's' + (i + 1) + (x ? ' yes' : ' no'))));
      const s = compute({ necessary: st.v }), k = st.v.reduce((a, b) => a + b, 0);
      res.set(s, 4);
      formula.textContent = `CR = ${k} / ${st.v.length} = ${K.fmt(s, 4)}`;
      note.textContent = 'Padding the context with irrelevant sentences lowers CR without changing the answer; useful background and redundancy count as "not necessary". Rank is ignored: moving a sentence changes nothing.';
    }
    render();
  }

  /* ---- Real example ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('data/corpus.json'), get('metrics/context_precision.json'), get('answers/context_judgments.json')]).then(a => {
      const corpus = a[1].passages || a[1], text = {};
      (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      const qs = {}; a[0].forEach(q => { qs[q.id] = q; });
      const j = {}; a[3].forEach(r => { j[r.qid + '_' + r.arm] = r; });
      return { qs, text, m: a[2], j, ids: Object.keys(a[2].per_question_plain.B) };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, m = D.m;
    const st = { arm: 'B', q: D.ids[0] };
    const shell = K.shell(el, 'Real example: context relevance of retrieved passages',
      'Demo scale: ' + D.ids.length + ' answerable questions, one run, answers by ' + m.answer_model + ', judge A = ' + m.judge_A + ' (an LLM, no human labels). The pack\'s verdicts are PASSAGE-level (each retrieved passage is relevant or not), not sentence-level as in the RAGAS paper, so this is the passage share, not the sentence share. Click a verdict to see how the score moves. Not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph passages'));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.ids.map(i => opt(i, i + ' (' + D.qs[i].type + '): ' + D.qs[i].question)));
    aSel.value = st.arm;
    const list = K.el('div', { 'aria-live': 'polite' }), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint' }), tbl = K.el('div');
    let ov = null; // user overrides of the judge verdicts for the current (arm, q)
    aSel.addEventListener('change', () => { st.arm = aSel.value; ov = null; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; ov = null; render(); });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), list, res.node, formula, note, tbl);

    const verd = (q, a) => { const r = D.j[q + '_' + a]; return r ? r.context_ids.map(id => r.relevant[id]) : null; };
    function render() {
      const q = D.qs[st.q];
      list.replaceChildren(K.el('p', { class: 'hint' }, 'Gold passage(s): ' + q.gold_passages.join(', ') + '. Gold answer: ' + q.gold_answer));
      if (st.arm === 'A') {
        list.append(K.el('p', { class: 'bad' }, 'Arm A answers from the model alone: no passages were retrieved, so context relevance is undefined (not 0).'));
        res.set(NaN); formula.textContent = 'CR = n/a (0 passages)'; note.textContent = 'Arm A is left out of the means below for the same reason.';
      } else {
        const r = D.j[st.q + '_' + st.arm], orig = verd(st.q, st.arm), v = ov || orig.slice(), gold = new Set(q.gold_passages);
        r.context_ids.forEach((id, i) => {
          const b = K.el('button', {
            type: 'button', 'aria-pressed': v[i] ? 'true' : 'false', title: 'click to flip the judge verdict',
            style: 'min-width:150px;text-align:left;' + (v[i] ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
            onclick: () => { ov = (ov || orig.slice()); ov[i] = 1 - ov[i]; render(); },
          }, (i + 1) + '. ' + id + ' ' + (v[i] ? 'relevant' : 'not relevant') + (gold.has(id) ? ' (in gold)' : ''));
          list.append(K.el('div', { style: 'margin:2px 0' }, b, ' ', K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 100) + (D.text[id] && D.text[id].length > 100 ? '...' : ''))));
        });
        const k = v.reduce((a, b) => a + b, 0), n = v.length, s = compute({ necessary: v }), cp = cpOf(v);
        res.set(s, 4);
        formula.textContent = `CR = ${k} / ${n} = ${K.fmt(s, 4)}   |   context precision (rank-aware) on the same verdicts = ${K.fmt(cp, 4)}`;
        const p1 = m.per_question_plain[st.arm][st.q], p2 = m.per_question_ranked[st.arm][st.q];
        const same = !ov ? (Math.abs(s - p1) < 5e-4 && Math.abs(cp - p2) < 5e-4 ? ' Recomputed here vs the pack\'s stored values (plain ' + p1 + ', rank-weighted ' + p2 + '): MATCH.' : ' MISMATCH vs the pack (' + p1 + ', ' + p2 + ').') : ' (verdicts edited: no longer the real run).';
        note.textContent = 'CR ignores order; context precision rewards relevant passages that come first. Same verdicts, different question being asked.' + same;
      }
      const rows = ['B', 'C'].map(a => ({ a, v: D.ids.map(q => verd(q, a)).filter(Boolean), sm: m.summary[a].judge }));
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse;font-size:.9em' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'arm (n=' + D.ids.length + ')'), K.el('th', { align: 'right' }, 'mean CR'), K.el('th', { align: 'right' }, 'mean CP'), K.el('th', { align: 'right' }, 'CR 95% CI')),
        K.el('tr', {}, K.el('td', {}, 'A: no retrieval'), K.el('td', { colspan: '3', align: 'right' }, 'n/a (no context)')),
        rows.map(r => { const cr = mean(r.v.map(x => compute({ necessary: x })));
          return K.el('tr', { style: r.a === st.arm ? 'font-weight:bold' : '' }, K.el('td', {}, r.a),
            K.el('td', { align: 'right', class: 'num' }, K.fmt(cr, 4) + (Math.abs(cr - r.sm.mean) < 5e-4 ? '' : ' !')),
            K.el('td', { align: 'right', class: 'num' }, K.fmt(mean(r.v.map(cpOf)), 4)),
            K.el('td', { align: 'right', class: 'num' }, '[' + r.sm.ci95.join(', ') + ']')); }));
      tbl.replaceChildren(K.el('details', { open: '' }, K.el('summary', {}, 'Arm means over all answerable questions (recomputed live)'), t,
        K.el('p', { class: 'hint' }, 'n=9 per arm, one run: B vs C is suggestive at most. Arm C passes more passages (graph passages), which lowers the share by construction. Mean CR here equals the pack\'s mean plain precision by judge A.')));
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real answer study...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['context_relevance'] = api;
})(this);
