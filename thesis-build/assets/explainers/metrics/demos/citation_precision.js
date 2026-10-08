/* Citation precision (ALCE) demo. NLI is precomputed: each citation has an editable set of "facts" it contains
   and each statement needs N facts. phi(set, s) = 1 iff the set covers all N facts (stand-in for the NLI verdict).
   ALCE rule: c_i irrelevant iff phi(c_i)=0 and phi(C_s minus c_i)=1; if recall of s is 0, all its citations score 0. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    statements: [
      { need: 2, cites: [{ id: 1, facts: [0] }, { id: 2, facts: [1] }] },
      { need: 1, cites: [{ id: 3, facts: [] }] },
      { need: 3, cites: [{ id: 2, facts: [0] }, { id: 4, facts: [0, 1] }, { id: 5, facts: [2] }] },
    ],
  };
  const phi = (need, facts) => { for (let i = 0; i < need; i++) if (!facts.has(i)) return false; return true; };
  const union = cs => new Set(cs.flatMap(c => c.facts));

  function perCitation(s) {
    const recall = phi(s.need, union(s.cites));
    return s.cites.map((c, i) => {
      const rest = union(s.cites.filter((_, j) => j !== i));
      const irrelevant = !phi(s.need, new Set(c.facts)) && phi(s.need, rest);
      return recall && !irrelevant ? 1 : 0;
    });
  }
  /* PURE: sum of non-irrelevant citations / total citations; 0 if no citations. */
  function compute(inp) {
    let ok = 0, tot = 0;
    inp.statements.forEach(s => { ok += perCitation(s).reduce((a, b) => a + b, 0); tot += s.cites.length; });
    return tot ? ok / tot : 0;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it)',
      'Each statement needs some facts. Each citation contains some of them (the NLI verdict is precomputed here). Click a fact under a citation to add or remove it, and watch which citations turn irrelevant.');
    const list = K.el('div', { role: 'group', 'aria-label': 'statements' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const reset = () => { st.statements = JSON.parse(JSON.stringify(defaults)).statements; render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', reset),
      btn('Break it: under-cite', () => { st.statements = [{ need: 1, cites: [{ id: 1, facts: [0] }] }]; render(); }),
      btn('Break it: redundant citations', () => { st.statements = [{ need: 2, cites: [{ id: 1, facts: [0] }, { id: 2, facts: [0] }, { id: 3, facts: [1] }] }]; render(); }),
      btn('Remove [2] from s3', () => { st.statements[2] && (st.statements[2].cites = st.statements[2].cites.filter(c => c.id !== 2)); render(); })),
      list, res.node, formula, note);

    function render() {
      list.replaceChildren();
      let ok = 0, tot = 0;
      st.statements.forEach((s, i) => {
        const v = perCitation(s), recall = phi(s.need, union(s.cites));
        ok += v.reduce((a, b) => a + b, 0); tot += s.cites.length;
        const needBtn = K.el('button', { type: 'button', title: 'facts this statement needs (1 to 4)',
          onclick: () => { s.need = s.need % 4 + 1; render(); } }, 'needs ' + s.need + ' fact' + (s.need > 1 ? 's' : ''));
        const row = K.el('div', { class: 'row' }, K.el('span', { class: 'num' }, 's' + (i + 1)), needBtn);
        s.cites.forEach((c, j) => {
          const facts = [0, 1, 2, 3].slice(0, s.need).map(f => K.el('button', {
            type: 'button', 'aria-pressed': c.facts.includes(f) ? 'true' : 'false', title: 'citation [' + c.id + '] contains fact ' + (f + 1),
            onclick: () => { c.facts = c.facts.includes(f) ? c.facts.filter(x => x !== f) : c.facts.concat(f).sort(); render(); },
          }, 'f' + (f + 1)));
          row.append(K.el('span', { style: 'border:2px solid ' + (v[j] ? 'var(--he)' : 'var(--warn)') + ';border-radius:8px;padding:2px 6px;display:inline-flex;gap:4px;align-items:center' },
            K.el('b', {}, '[' + c.id + '] ' + (v[j] ? 'ok' : (recall ? 'irrelevant' : 'recall 0'))), ...facts));
        });
        list.append(row);
      });
      const score = compute(st);
      res.set(score, 3);
      formula.textContent = `CitPrec = (citations not irrelevant) / (all citations) = ${ok} / ${tot} = ${K.fmt(score, 3)}`;
      note.textContent = 'A citation is irrelevant if it alone does not entail the statement and the other citations still do. If the statement is not fully supported (recall 0), all its citations score 0. Under-citing is rewarded (one entailing citation gives 1.0), and redundant citations can flag each other. phi is an editable fact table here, not a live NLI model.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/ + metrics/citation_precision.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/citation_precision.json'), get('answers/verdicts.json'), get('answers/claims.json'), get('data/questions.json'), get('answers/answers.json')]).then(a => {
      const ver = {}; a[1].filter(r => r.judge === 'A').forEach(r => { ver[r.qid + '_' + r.arm] = r; });
      const qs = {}; a[3].forEach(q => { qs[q.id] = q; });
      const ans = {}; a[4].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      return { m: a[0], ver, qs, ans };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  /* PURE (real mode): share of distinct cited ids flagged relevant; NaN when nothing is cited. */
  function realPrecision(flags) { return flags.length ? flags.filter(Boolean).length / flags.length : NaN; }

  function judgeCites(D, q, arm) {
    const cited = D.m.cited[arm][q] || [], gold = D.qs[q].gold_passages;
    const v = D.ver[q + '_' + arm], sup = {};
    if (v) v.verdicts.forEach((x, i) => { if (x.verdict === 'supported') (x.passages || []).forEach(p => (sup[p] = sup[p] || []).push(i + 1)); });
    return cited.map(id => ({ id, gold: gold.includes(id), claims: sup[id] || [], ok: gold.includes(id) || !!sup[id] }));
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.m.per_question.B);
    const st = { arm: 'B', q: 'q09' };
    const shell = K.shell(el, 'Real example: Citation precision on real answers',
      'Scale: n = 12 questions, one run, temperature 0, LLM judges (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Citations are the [pNNN] ids the answerer wrote. Caveat: this pack uses a simpler rule than ALCE leave-one-out. A cited passage counts as relevant if it is a gold passage or the judge says it supports a supported claim; gold labels cover only the necessary passages, so this is a lower bound. Arm A has no sources, so no citations.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm', style: 'max-width:100%' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'citations' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const means = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, list, res.node, formula, note, means);

    function render() {
      const q = D.qs[st.q], key = st.q + '_' + st.arm;
      info.replaceChildren(K.el('p', { class: 'hint' }, 'Gold passage(s): ' + q.gold_passages.join(', ') + '. Answer: ' + ((D.ans[key] || {}).answer || '')));
      list.replaceChildren();
      const cs = judgeCites(D, st.q, st.arm);
      if (!cs.length) {
        list.append(K.el('p', { class: 'hint bad' }, st.arm === 'A' ? 'Arm A has no sources, so it cites nothing: citation precision is undefined (n/a), not zero.' :
          'This answer cites nothing (' + q.type + (q.type === 'unanswerable' ? ': the system refused' : '') + '), so it is left out of the mean: n/a.'));
        res.set(NaN); formula.textContent = 'CitPrec = n/a (no citations)'; note.textContent = '';
      } else {
        cs.forEach(c => list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (c.ok ? 'he' : 'warn') + ')' },
          K.el('b', {}, '[' + c.id + '] ' + (c.ok ? 'relevant' : 'not relevant') + ' '),
          K.el('span', { class: 'hint' }, (c.gold ? 'gold passage' : 'not a gold passage') + '; ' +
            (c.claims.length ? 'supports supported claim ' + c.claims.join(', ') : 'supports no supported claim')))));
        const h = cs.filter(c => c.ok).length, v = realPrecision(cs.map(c => c.ok)), stored = D.m.per_question[st.arm][st.q];
        res.set(v);
        formula.textContent = `CitPrec = ${h} relevant / ${cs.length} distinct cited = ${K.fmt(v, 3)}`;
        note.textContent = (Math.abs(v - stored) < 5e-4 ? 'Matches the pack value ' + stored : 'MISMATCH with pack value ' + stored) +
          '.' + (v < 1 ? ' Cited passages that are neither gold nor support a supported claim are the noise the metric counts against the answer.' : '');
      }
      const row = a => {
        if (a === 'A') return 'A: n/a (no sources)';
        const xs = qids.map(id => realPrecision(judgeCites(D, id, a).map(c => c.ok))).filter(x => !isNaN(x));
        const s = D.m.summary[a];
        return `${a}: ${K.fmt(meanOf(xs), 4)} recomputed over n=${xs.length} (pack ${s.mean}, 95% CI [${s.ci95.join(', ')}])`;
      };
      means.textContent = 'Arm means (answers with citations): ' + ['A', 'B', 'C'].map(row).join('  |  ');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['citation_precision'] = api;
})(this);
