/* Hallucination rate demo: 20 answers; click a dot to mark it as containing an unsupported claim.
   The judge (LLM or human) is NOT run: the marks are editable. Headline = response-level HR; claim-level HR and a Wilson interval are shown beside it. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const N = 20;
  const defaults = { bad: [2, 7, 13], n: N, claimsPer: 5, wrongPer: 1 };   // 3 of 20 -> 0.15

  /* PURE: HR_resp = (#answers with >= 1 unsupported claim) / N. Returns a number. */
  function compute(inp) {
    const n = inp.n === undefined ? N : inp.n;
    return n > 0 ? new Set(inp.bad).size / n : 0;
  }
  /* claim level: wrong claims / all claims (each bad answer has wrongPer wrong claims out of claimsPer) */
  function claimLevel(inp) {
    const n = inp.n === undefined ? N : inp.n, tot = n * inp.claimsPer;
    return tot > 0 ? (new Set(inp.bad).size * inp.wrongPer) / tot : 0;
  }
  function wilson(k, n, z = 1.96) {
    if (!n) return [0, 0];
    const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - m) / d, (c + m) / d];
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { bad: new Set(defaults.bad), claimsPer: defaults.claimsPer, wrongPer: defaults.wrongPer };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each dot is one answer. Click (or press Enter on) a dot to mark it as containing at least one unsupported claim. The judge is not run here: the marks are yours. Then compare the response-level and claim-level numbers.');
    const grid = K.el('div', { role: 'group', 'aria-label': 'answers', style: 'display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px;max-width:520px' });
    const sl = {
      cp: K.slider('claims per answer', 1, 10, 1, st.claimsPer, v => { st.claimsPer = v; if (st.wrongPer > v) st.wrongPer = v; render(); }),
      wp: K.slider('wrong claims in each bad answer', 1, 10, 1, st.wrongPer, v => { st.wrongPer = Math.min(v, st.claimsPer); render(); }),
    };
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.bad = new Set(defaults.bad); st.claimsPer = 5; st.wrongPer = 1; sync(); render(); }),
      btn('Break it: same answers, claim level', () => { st.bad = new Set(defaults.bad); st.claimsPer = 10; st.wrongPer = 1; sync(); render(); }),
      btn('Clear', () => { st.bad = new Set(); render(); }));
    function sync() { sl.cp.set(st.claimsPer); sl.wp.set(st.wrongPer); }
    shell.append(presets, grid, sl.cp.node, sl.wp.node, res.node, formula, note);

    function render() {
      grid.replaceChildren();
      for (let i = 0; i < N; i++) {
        const bad = st.bad.has(i);
        grid.append(K.el('button', {
          type: 'button', 'aria-pressed': bad ? 'true' : 'false', 'aria-label': 'answer ' + (i + 1) + (bad ? ', has an unsupported claim' : ', supported'),
          style: 'aspect-ratio:1;border-radius:50%;padding:0;border:3px solid ' + (bad ? 'var(--warn)' : 'var(--he)') + ';background:' + (bad ? 'var(--warn)' : 'transparent'),
          onclick: () => { bad ? st.bad.delete(i) : st.bad.add(i); render(); },
        }));
      }
      const inp = { bad: [...st.bad], n: N, claimsPer: st.claimsPer, wrongPer: st.wrongPer };
      const r = compute(inp), c = claimLevel(inp), k = st.bad.size, [lo, hi] = wilson(k, N);
      res.set(r, 3);
      formula.textContent = `HR_resp = ${k} / ${N} = ${K.fmt(r, 3)}   (95% Wilson interval ${K.fmt(lo, 2)} to ${K.fmt(hi, 2)})\n` +
        `HR_claim = ${k * st.wrongPer} / ${N * st.claimsPer} = ${K.fmt(c, 3)}`;
      formula.style.whiteSpace = 'pre-wrap';
      note.textContent = 'The same marked answers give two different rates, so numbers from different definitions do not compare. Also say whether "unsupported" means against the context or against the truth. With only 20 answers the interval is wide.';
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/ + metrics/hallucination_rate.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/hallucination_rate.json'), get('answers/answers.json'), get('answers/verdicts.json'), get('data/questions.json')]).then(a => {
      const ans = {}, ver = {}, qs = {};
      a[1].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[2].filter(r => r.judge === 'A').forEach(r => { ver[r.qid + '_' + r.arm] = r; });
      a[3].forEach(q => { qs[q.id] = q; });
      return { m: a[0], ans, ver, qs };
    });
    return realData;
  }
  const BAD = v => v && (v.verdict === 'unsupported' || v.verdict === 'contradicted');
  /* per arm: answered questions, flagged answers (response level), flagged claims / all claims (claim level) */
  function armStats(D, arm) {
    const out = { rows: [], bad: 0, claims: 0, badClaims: 0 };
    Object.keys(D.m.per_question[arm]).forEach(q => {
      const a = D.ans[q + '_' + arm], v = D.ver[q + '_' + arm];
      if (D.m.per_question[arm][q] == null || !a || !v) { out.rows.push({ q, refused: true }); return; }
      const flagged = v.claims.map((t, i) => ({ text: t, verdict: (v.verdicts[i] || {}).verdict, passages: (v.verdicts[i] || {}).passages || [] })).filter(c => BAD(c));
      out.rows.push({ q, flagged, n: v.claims.length, hall: flagged.length > 0 });
      out.claims += v.claims.length; out.badClaims += flagged.length; if (flagged.length) out.bad++;
    });
    out.n = out.rows.filter(r => !r.refused).length;
    return out;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: null };
    const shell = K.shell(el, 'Real example: hallucination rate on real answers and a real judge',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable that arms B and C refuse); judge A labelled two meta-claims in q09/B contradicted although the answer honestly says the year is missing, so that answer counts as flagged, one run, temperature 0, LLM judges (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Response level = share of non-refused answers with at least one unsupported or contradicted claim; claim level = flagged claims / all claims. In arm A (no retrieval) "unsupported" means not in the corpus sample, not necessarily false. Arm C gets about 40% more context than B, so B vs C does not isolate the graph.');
    const res = K.resultBox();
    const table = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' });
    const armBar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'arm' });
    const grid = K.el('div', { role: 'group', 'aria-label': 'responses', class: 'row' });
    const info = K.el('div', { 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(res.node, table, K.el('p', { class: 'hint' }, 'Pick an arm, then click a response (red = at least one flagged claim, green = none, grey = refused).'), armBar, grid, info, note);
    const names = { A: 'A: no retrieval', B: 'B: hybrid RRF top-5', C: 'C: dense top-5 + graph' };
    const S = {}; ['A', 'B', 'C'].forEach(x => { S[x] = armStats(D, x); });

    function render() {
      const s = S[st.arm];
      armBar.replaceChildren(...['A', 'B', 'C'].map(x => K.el('button', { type: 'button', 'aria-pressed': x === st.arm ? 'true' : 'false', onclick: () => { st.arm = x; st.q = null; render(); } }, names[x])));
      const hr = compute({ bad: s.rows.map((r, i) => r.hall ? i : -1).filter(i => i >= 0), n: s.n });
      res.set(hr, 3);
      const line = x => {
        const t = S[x], [lo, hi] = wilson(t.bad, t.n), c = t.claims ? t.badClaims / t.claims : 0, g = D.m.summary[x];
        return `${x}  response-level ${t.bad}/${t.n} = ${K.fmt(t.n ? t.bad / t.n : 0, 3)}  Wilson [${K.fmt(lo, 2)}, ${K.fmt(hi, 2)}]  (pack bootstrap [${g.response_level.ci95.join(', ')}])\n   claim-level ${t.badClaims}/${t.claims} = ${K.fmt(c, 3)}`;
      };
      table.textContent = ['A', 'B', 'C'].map(line).join('\n');
      grid.replaceChildren(...s.rows.map(r => K.el('button', {
        type: 'button', 'aria-pressed': st.q === r.q ? 'true' : 'false', title: D.qs[r.q].question,
        style: 'min-width:48px;border:3px solid ' + (r.refused ? 'var(--muted,#888)' : r.hall ? 'var(--warn)' : 'var(--he)'),
        onclick: () => { st.q = r.q; render(); },
      }, r.q)));
      info.replaceChildren();
      if (st.q) {
        const r = s.rows.find(x => x.q === st.q), a = D.ans[st.q + '_' + st.arm];
        info.append(K.el('p', { class: 'hint' }, st.q + ' (' + D.qs[st.q].type + '): ' + D.qs[st.q].question),
          K.el('p', { class: 'hint' }, 'Answer: ' + (a ? a.answer : '')));
        if (r.refused) info.append(K.el('p', { class: 'hint' }, 'Refused (pack counts no hallucination rate for it), so it is left out of the denominator.'));
        else if (!r.flagged.length) info.append(K.el('p', { class: 'hint' }, 'All ' + r.n + ' claims supported: not a hallucinated response.'));
        else r.flagged.forEach(c => info.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--warn)' },
          K.el('b', {}, c.verdict + ' '), K.el('span', { class: 'hint' }, c.text + (c.passages.length ? ' (judge cites ' + c.passages.join(', ') + ')' : '')))));
        if (!r.refused && r.flagged.length) info.append(K.el('p', { class: 'hint' }, r.flagged.length + ' of ' + r.n + ' claims flagged: the response counts once at response level.'));
      }
      note.textContent = 'The two definitions give different numbers on the same answers. With 9 to 12 answers the intervals are wide: the B vs C difference is one answer each and is not distinguishable.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['hallucination_rate'] = api;
})(this);
