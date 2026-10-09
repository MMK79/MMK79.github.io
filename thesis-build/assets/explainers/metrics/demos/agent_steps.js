/* Steps per query and failure-to-stop rate. Real mode: the pack has NO agent loop; shows LLM calls per answer in the evaluation harness + query-transform counts, honestly labelled. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { steps: [8, 8, 8, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2], cap: 8 };

  /* PURE: steps are the TRUE step counts the agent wanted; the recorded n_q is min(true, cap).
     mean = (1/N) sum n_q ; FTS = #{q: n_q >= cap} / N. */
  function compute(inp) {
    const N = inp.steps.length;
    const rec = inp.steps.map(n => Math.min(n, inp.cap));
    return { mean_steps: rec.reduce((a, b) => a + b, 0) / N, FTS: inp.steps.filter(n => n >= inp.cap).length / N };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { steps: defaults.steps.slice(), cap: defaults.cap };
    const shell = K.shell(el, 'Toy example (break it)',
      'Toy numbers, not measured. Edit the true steps each query wanted, move the cap. The recorded count is min(true, cap): a cap hides runaway loops.');
    const res = K.resultBox(), res2 = K.resultBox();
    const out = K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' mean steps (recorded)'), res2.node, K.el('span', { class: 'hint' }, ' FTS'));
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const capS = K.slider('cap n_max', 1, 50, 1, st.cap, v => { st.cap = v; render(); });
    const grid = K.el('div', { class: 'row' });
    const inputs = st.steps.map((n, i) => {
      const inp = K.el('input', { type: 'number', min: 1, max: 99, value: n, 'aria-label': 'steps of query ' + (i + 1), style: 'width:3.4em' });
      inp.addEventListener('input', () => { st.steps[i] = Math.max(1, Math.min(99, Number(inp.value) || 1)); render(); });
      return inp;
    });
    inputs.forEach((x, i) => grid.append(K.el('label', {}, 'q' + (i + 1) + ' ', x)));
    const W = 600, H = 120, svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'steps per query with cap line' });
    const set = (steps, cap) => { st.steps = steps.slice(); st.cap = cap; inputs.forEach((x, i) => { x.value = st.steps[i]; }); capS.set(cap); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults.steps, 8)),
      btn('Break it: 3 runaway loops hidden by the cap', () => set([40, 25, 31].concat(defaults.steps.slice(3)), 8)),
      btn('Raise the cap to 50', () => { st.cap = 50; capS.set(50); render(); }));
    shell.append(presets, K.el('div', { class: 'row' }, capS.node), grid, out, svg, formula, note);
    function render() {
      const r = compute(st), N = st.steps.length;
      res.set(r.mean_steps, 3); res2.set(r.FTS, 3);
      const trueMean = st.steps.reduce((a, b) => a + b, 0) / N;
      const mx = Math.max(st.cap, ...st.steps, 10), bw = W / N, sy = (H - 14) / mx;
      svg.replaceChildren();
      st.steps.forEach((n, i) => {
        const hit = n >= st.cap, shown = Math.min(n, st.cap);
        svg.append(K.svg('rect', { x: i * bw + 2, y: H - shown * sy, width: bw - 4, height: shown * sy, fill: hit ? '#FF8A65' : '#7C9CFF' }));
        if (n > st.cap) svg.append(K.svg('rect', { x: i * bw + 2, y: H - n * sy, width: bw - 4, height: (n - st.cap) * sy, fill: 'none', stroke: '#FF8A65', 'stroke-dasharray': '3 2' }));
      });
      svg.append(K.svg('line', { x1: 0, x2: W, y1: H - st.cap * sy, y2: H - st.cap * sy, stroke: '#FF8A65', 'stroke-dasharray': '4 3' }), K.svg('text', { x: W - 4, y: H - st.cap * sy - 3, 'text-anchor': 'end' }, 'cap ' + st.cap));
      const rec = st.steps.map(n => Math.min(n, st.cap));
      formula.textContent = `mean = ${rec.reduce((a, b) => a + b, 0)} / ${N} = ${K.fmt(r.mean_steps, 3)}\nFTS  = ${st.steps.filter(n => n >= st.cap).length} / ${N} = ${K.fmt(r.FTS, 3)}`;
      note.textContent = `True mean without a cap: ${K.fmt(trueMean, 2)} steps (the dashed outlines are the steps the cap cut off). The recorded mean ${K.fmt(r.mean_steps, 2)} hides that; the cost of those steps was paid anyway.`;
    }
    render();
  }

  /* ---- Real example ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all(['answers/answers.json', 'answers/claims.json', 'answers/verdicts.json', 'answers/correctness.json', 'answers/context_judgments.json', 'answers/cost_latency.json', 'data/query_transforms.json', 'data/questions.json'].map(get)).then(a => {
      const calls = {}; const add = (r, k, n) => { const key = r.qid + '|' + r.arm; (calls[key] ||= { qid: r.qid, arm: r.arm }); calls[key][k] = (calls[key][k] || 0) + (n || 1); };
      a[0].forEach(r => add(r, 'answer')); a[1].forEach(r => add(r, 'claims')); a[2].forEach(r => add(r, 'verdicts')); a[3].forEach(r => add(r, 'correctness')); a[4].forEach(r => add(r, 'context', 2));
      const qs = {}; a[7].forEach(q => { qs[q.id] = q; });
      return { calls: Object.values(calls), cl: a[5], qt: a[6].items, qs };
    });
    return realData;
  }

  let agentData = null;
  function loadAgent() {
    if (agentData) return agentData;
    const url = new URL('data/agent_steps.real.json', SCRIPT_SRC || location.href).href;
    agentData = fetch(url).then(r => { if (!r.ok) throw new Error('agent_steps.real.json ' + r.status); return r.json(); });
    return agentData;
  }

  /* real agent loop: 24 questions, steps = searches the agent made (data/agent_steps.real.json, built by agent_steps.build.py) */
  function mountAgent(el, A) {
    const K = root.DemoKit, st = { cap: A.cap, q: 0 };
    const shell = K.shell(el, 'Real example: a small search agent, 24 questions',
      'Our own run on 2026-10-09: ' + A.model + ' (temperature 0, JSON replies) may search or answer; the tool is BM25 over the 138 public Wikipedia passages of the pack (top 3, 90-word excerpts). One search = one step. Cap n_max = ' + A.cap + ': a 9th search request would be stopped and recorded as capped. 24 questions (20 answerable, 4 unanswerable), ONE run, ' + A.llm_calls + ' LLM calls, USD ' + A.usd + ' (public text only). Demo scale: a toy agent with one tool, not the thesis tutor; lowering the cap with the slider only RE-CAPS the recorded steps; the agent is not re-run.');
    const capS = K.slider('cap n_max (re-caps the recorded steps)', 1, A.cap, 1, st.cap, v => { st.cap = v; render(); });
    const res = K.resultBox(), res2 = K.resultBox();
    const out = K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' mean steps (recorded)'), res2.node, K.el('span', { class: 'hint' }, ' FTS'));
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' }), tbl = K.el('div'), note = K.el('p', { class: 'hint' });
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, A.rows.map((r, i) => K.el('option', { value: i }, r.qid + ' (' + r.type + '): ' + r.steps + ' steps, ' + r.outcome)));
    qSel.addEventListener('change', () => { st.q = +qSel.value; render(); });
    const trace = K.el('div', { class: 'formula', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, capS.node), out, formula, tbl, K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'trace ', qSel)), trace, note);
    function render() {
      const steps = A.rows.map(r => r.steps), r = compute({ steps, cap: st.cap }), N = steps.length;
      res.set(r.mean_steps, 3); res2.set(r.FTS, 3);
      const hit = steps.filter(n => n >= st.cap).length, trueMean = steps.reduce((a, b) => a + b, 0) / N;
      formula.textContent = `mean = ${steps.map(n => Math.min(n, st.cap)).reduce((a, b) => a + b, 0)} / ${N} = ${K.fmt(r.mean_steps, 3)}   (true mean of this run: ${K.fmt(trueMean, 3)})\nFTS  = ${hit} / ${N} = ${K.fmt(r.FTS, 3)}   (at cap ${st.cap})`;
      const tb = K.el('table'); tb.append(K.el('tr', {}, ['question type', 'n', 'mean steps', 'max steps'].map(h => K.el('th', {}, h))));
      ['single-hop', 'bridge', 'comparison', 'unanswerable'].forEach(t => { const x = A.rows.filter(q => q.type === t).map(q => q.steps); tb.append(K.el('tr', {}, [t, x.length, K.fmt(x.reduce((a, b) => a + b, 0) / x.length, 2), Math.max(...x)].map(v => K.el('td', {}, String(v))))); });
      tbl.replaceChildren(K.el('div', { style: 'overflow-x:auto;max-width:100%' }, tb));
      const q = A.rows[st.q];
      trace.textContent = `${q.qid} (${q.type}): ${q.steps} search${q.steps === 1 ? '' : 'es'}, outcome ${q.outcome}\n` + q.queries.map((x, i) => `step ${i + 1}: search "${x}"`).join('\n') + (q.answer ? `\nanswer: ${q.answer}` : '');
      note.textContent = 'What it shows: this model on this tiny corpus almost always stops after one search (only the 4 unanswerable questions take more than 2 steps: 3 on average, up to 5), so the failure-to-stop rate at cap ' + A.cap + ' is ' + K.fmt(compute({ steps, cap: A.cap }).FTS, 2) + '. Lower the cap and FTS rises only because the cap now bites, not because the agent changed. The metric counts effort, not quality: an agent that answers an unanswerable question after 3 searches is not shown as wrong here. n = 24, one run, one model, one tool.';
    }
    render();
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { mode: 'all', cap: 6, q: D.calls[0].qid };
    const shell = K.shell(el, 'Proxy: LLM calls of the evaluation harness (not an agent)',
      'Honest scope: our three arms are single-shot pipelines (retrieve once, answer once), not agents, so there are no tool-call traces and no real failure-to-stop rate. What the pack does contain: (1) LLM calls per answer in the evaluation harness (answer + judging calls, evaluator overhead, not agent behaviour; pairwise calls are per question pair and excluded) and (2) how many sub-questions or rewrites the query-transform runs produced. We use them as "steps" only to show the formula on real counts. n = 12 questions, one run, demo scale.');
    const counts = r => st.mode === 'answer' ? 1 : st.mode === 'gen' ? (r.answer || 0) + (r.claims || 0) : (r.answer || 0) + (r.claims || 0) + (r.verdicts || 0) + (r.correctness || 0) + (r.context || 0);
    const modeSel = K.el('select', { 'aria-label': 'which calls to count' }, [['all', 'all harness calls (answer + judges)'], ['gen', 'answer + claim extraction'], ['answer', 'answer call only']].map(([v, t]) => K.el('option', { value: v }, t)));
    modeSel.value = st.mode; modeSel.addEventListener('change', () => { st.mode = modeSel.value; render(); });
    const capS = K.slider('harness cap n_max', 1, 10, 1, st.cap, v => { st.cap = v; render(); });
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, [...new Set(D.calls.map(r => r.qid))].map(id => K.el('option', { value: id }, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const tbl = K.el('div'), per = K.el('div', { class: 'formula', 'aria-live': 'polite' }), qt = K.el('div', { class: 'formula' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'count ', modeSel), capS.node), tbl, K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), per, K.el('h4', {}, 'Query-transform runs (real LLM outputs)'), qt, note);
    function render() {
      const tb = K.el('table'); tb.append(K.el('tr', {}, ['arm', 'mean calls (capped at n_max)', 'FTS at cap ' + st.cap, 'mean latency (answer call)', 'USD per answer (answer model)'].map(h => K.el('th', {}, h))));
      ['A', 'B', 'C'].forEach(a => {
        const rows = D.calls.filter(r => r.arm === a), r = compute({ steps: rows.map(counts), cap: st.cap }), c = D.cl.answer_cost_per_arm[a];
        tb.append(K.el('tr', {}, [a, K.fmt(r.mean_steps, 2), K.fmt(r.FTS, 2) + ' (' + Math.round(r.FTS * rows.length) + '/' + rows.length + ')', K.fmt(c.latency_s_mean, 2) + ' s', '$' + K.fmt(c.usd_per_answer_mean, 5)].map(t => K.el('td', {}, t))));
      });
      tbl.replaceChildren(tb);
      per.textContent = ['A', 'B', 'C'].map(a => { const r = D.calls.find(x => x.qid === st.q && x.arm === a); return `${a}: answer ${r.answer || 0}, claims ${r.claims || 0}, verdicts ${r.verdicts || 0} (2 judges), correctness ${r.correctness || 0}, context judgments ${r.context || 0}  => counted ${counts(r)}`; }).join('\n');
      const g = {}; D.qt.forEach(i => { (g[i.technique] ||= []).push(i); });
      qt.textContent = Object.keys(g).map(t => { const it = g[t], n = it.map(i => Array.isArray(i.generated) ? i.generated.length : 1); return `${t.padEnd(12)} ${it.length} runs, outputs per run: ${n.join(', ')}  (1 LLM call each, ${K.fmt(it.reduce((s, i) => s + i.usage.completion_tokens, 0) / it.length, 0)} completion tokens on average)`; }).join('\n');
      note.textContent = 'Reading: arm A has fewer harness calls because it has no retrieved context to judge; B and C are equal on average. Latency (about 3.7 s) is the answer call only and is nearly flat. The context-judgment count (2 calls per judged answer) is inferred from the pack call totals: 36 answer + 36 claim + 60 verdict + 27 correctness + 36 context + 72 pairwise = 267. The failure-to-stop rate here only counts answers above the cap of evaluator calls; it is not an agent failure rate. Real agent traces are pending.';
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
      Promise.all([loadReal(), loadAgent()]).then(([D, A]) => { body.replaceChildren(); mountAgent(body, A); const det = K.el('details', {}, K.el('summary', {}, 'Proxy from the answer study: LLM calls per answer in the evaluation harness (evaluator overhead, not agent behaviour)')); body.append(det); mountReal(det, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['agent_steps'] = api;
})(this);
