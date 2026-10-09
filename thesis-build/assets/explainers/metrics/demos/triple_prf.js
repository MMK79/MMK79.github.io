/* Triple precision / recall / F1 demo: toggle extracted triples and gold triples, switch the matching rule. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const GOLD = [['Newton', 'formulated', 'Laws of Motion'], ['Force', 'measured_in', 'Newton'], ['Mass', 'affects', 'Inertia'],
    ['Velocity', 'derivative_of', 'Position'], ['Acceleration', 'derivative_of', 'Velocity'], ['Momentum', 'equals', 'Mass x Velocity'],
    ['Energy', 'conserved_in', 'Closed System'], ['Gravity', 'causes', 'Free Fall'], ['Friction', 'opposes', 'Motion'],
    ['Work', 'measured_in', 'Joule'], ['Power', 'equals', 'Work / Time'], ['Torque', 'causes', 'Rotation']];
  const POOL = [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4], GOLD[5], GOLD[7],
    ['Energy', 'conserved in', 'Closed System'],   // near miss: relation spelling
    ['friction', 'opposes', 'Motion'],             // near miss: case
    ['Speed', 'derivative_of', 'Position'],        // plausible, not in gold
    ['Weight', 'depends_on', 'Gravity']];          // TRUE but missing from gold (off by default)
  const defaults = { gold: GOLD, pred: POOL.slice(0, 10), normalise: false };

  const norm = t => t.map(x => x.toLowerCase().replace(/_/g, ' ').trim()).join('|');
  const raw = t => t.join('|');

  function stats(inp) {
    const f = inp.normalise ? norm : raw;
    const p = new Set(inp.pred.map(f)), g = new Set(inp.gold.map(f));
    let tp = 0; p.forEach(k => { if (g.has(k)) tp++; });
    const P = p.size ? tp / p.size : 0, R = g.size ? tp / g.size : 0;
    return { tp, np: p.size, ng: g.size, P, R, F1: P + R ? 2 * P * R / (P + R) : 0, p, g, f };
  }
  /* PURE: F1 = 2PR/(P+R) over the sets of (head, relation, tail) triples */
  function compute(inp) { return stats(inp).F1; }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { gold: new Set(GOLD.map((_, i) => i)), pred: new Set(defaults.pred.map(t => POOL.indexOf(t))), normalise: false };
    const shell = K.shell(el, 'Triple precision / recall / F1',
      'Click a triple to add or remove it. Blue = extracted, teal = gold. A green tick means it matches the other side under the current rule.');
    const res = K.resultBox();
    const line = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const gridG = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    const gridP = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    const cb = K.el('input', { type: 'checkbox', id: 'tprf-norm' });
    cb.addEventListener('change', () => { st.normalise = cb.checked; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.gold = new Set(GOLD.map((_, i) => i)); st.pred = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); cb.checked = st.normalise = false; render(); }),
      btn('Break it: normalised matching', () => { cb.checked = st.normalise = true; render(); }),
      btn('Break it: add a true triple gold lacks', () => { st.pred.add(10); render(); }),
      btn('Predict everything in gold', () => { st.pred = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); st.gold = new Set(GOLD.map((_, i) => i)); render(); }));
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, cb, ' normalise (lowercase, _ to space)')), presets,
      K.el('h4', { style: 'margin:10px 0 4px;color:var(--he)' }, 'Gold triples (click to remove / add)'), gridG,
      K.el('h4', { style: 'margin:10px 0 4px;color:var(--k12)' }, 'Extracted triples (click to remove / add)'), gridP,
      res.node, line, note);

    function chip(t, on, matched, col, onclick) {
      return K.el('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false',
        style: 'font-size:12px;' + (on ? `border-color:${col};color:${col}` : 'opacity:.35') , onclick },
        (on ? (matched ? '✓ ' : '✗ ') : '') + `(${t.join(', ')})`);
    }
    function render() {
      const gold = GOLD.filter((_, i) => st.gold.has(i)), pred = POOL.filter((_, i) => st.pred.has(i));
      const s = stats({ gold, pred, normalise: st.normalise });
      gridG.replaceChildren(...GOLD.map((t, i) => chip(t, st.gold.has(i), s.p.has(s.f(t)), 'var(--he)', () => { st.gold.has(i) ? st.gold.delete(i) : st.gold.add(i); render(); })));
      gridP.replaceChildren(...POOL.map((t, i) => chip(t, st.pred.has(i), s.g.has(s.f(t)), 'var(--k12)', () => { st.pred.has(i) ? st.pred.delete(i) : st.pred.add(i); render(); })));
      res.set(s.F1, 4);
      line.textContent = `P = ${s.tp}/${s.np} = ${K.fmt(s.P)}   R = ${s.tp}/${s.ng} = ${K.fmt(s.R)}\nF1 = 2 x ${K.fmt(s.P)} x ${K.fmt(s.R)} / (${K.fmt(s.P)} + ${K.fmt(s.R)}) = ${K.fmt(s.F1, 4)}`;
      note.textContent = st.normalise ? 'Normalised matching: near-miss spellings now count as hits.'
        : 'Exact matching: (Energy, conserved in, ...) and (friction, ...) look wrong although they mean the gold triples.';
      note.className = 'hint';
    }
    render();
  }

  /* ---- Real example (2026-10-09): demos/data/kg_gold.real.json = 59 real extracted triples of 8 Wikipedia passages (graph.json, qwen3.8-flash),
     each labelled correct / partly / incorrect against the passage text by an LLM labeller (qwen3.7-plus) and re-read by us; plus 13 LLM-proposed missed triples
     whose quote occurs word for word in the passage. Pure scoring function below; the mount only edits labels. ---- */
  const MODES = { strict: ['correct'], lenient: ['correct', 'partly'] };
  /* PURE: P, R, F1 over labelled triples. labels = array of 'correct'|'partly'|'incorrect' (one per extracted triple); missed = number of gold triples the extractor did not produce. */
  function scoreLabels(labels, missed, mode) {
    const pos = MODES[mode] || MODES.strict, tp = labels.filter(l => pos.includes(l)).length, np = labels.length, ng = tp + missed;
    const P = np ? tp / np : 0, R = ng ? tp / ng : 0;
    return { tp, np, ng, P, R, F1: P + R ? 2 * P * R / (P + R) : 0 };
  }
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    realData = fetch(new URL('data/kg_gold.real.json', SCRIPT_SRC || location.href).href).then(r => { if (!r.ok) throw new Error('kg_gold.real.json ' + r.status); return r.json(); });
    return realData;
  }
  function mountReal(el, D) {
    const K = root.DemoKit, NEXT = { correct: 'partly', partly: 'incorrect', incorrect: 'correct' }, COL = { correct: 'var(--he)', partly: 'var(--warn)', incorrect: 'var(--k12)' }, MARK = { correct: '✓ ', partly: '~ ', incorrect: '✗ ' };
    const all = []; D.passages.forEach(p => p.triples.forEach(t => all.push({ pid: p.id, t, lab: t.final })));
    const st = { mode: 'strict', pid: 'all', missed: true, useLlm: false };
    const shell = K.shell(el, 'Real example: a small gold set for triple P / R / F1',
      'MEASURED here: the 59 triples that the pack extractor (qwen3.8-flash) really produced from 8 Wikipedia passages (p002 p005 p016 p004 p013 p051 p031 p127, chosen before labelling because they are the gold passages of 7 questions). Each triple was labelled correct / partly / incorrect against the passage text by an LLM labeller (' + D.model + ', 2026-10-09, a different model from the extractor), then we re-read ALL 59 against the passage and changed ' + D.stats.n_overridden + ' labels (agreement ' + K.fmt(D.stats.agreement, 3) + '; the disagreements are mostly "incorrect" vs "partly"). PROXY: recall needs gold triples the extractor missed; the LLM proposed ' + D.stats.missed_kept + ' (each with a word-for-word quote that code checked), so recall is a rough upper bound on what is missed. n = 59 triples, 8 passages, no human annotator, no kappa. A demo gold set, not a benchmark, not a measurement of the thesis extractor. Click a triple to cycle our label.');
    const res = K.resultBox(), line = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap' }), note = K.el('p', { class: 'hint' });
    const rule = K.el('details', {}, K.el('summary', {}, 'Labelling rule given to the LLM (verbatim)'), K.el('pre', { class: 'hint', style: 'white-space:pre-wrap;max-width:100%;overflow-wrap:anywhere' }, D.rule));
    const pSel = K.el('select', { 'aria-label': 'passage', style: 'max-width:100%' }, K.el('option', { value: 'all' }, 'all 8 passages'), ...D.passages.map(p => K.el('option', { value: p.id }, p.id + ' (' + p.triples.length + ' triples)')));
    pSel.addEventListener('change', () => { st.pid = pSel.value; render(); });
    const txt = K.el('p', { class: 'hint', style: 'white-space:pre-wrap' });
    const grid = K.el('div', { style: 'display:flex;flex-direction:column;gap:6px' }), gridM = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }), tbl = K.el('div', { class: 'formula', style: 'white-space:pre-wrap;overflow-x:auto' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Strict: only "correct" counts', () => { st.mode = 'strict'; render(); }), btn('Lenient: "partly" counts too', () => { st.mode = 'lenient'; render(); }),
      btn('Our final labels', () => { all.forEach(x => { x.lab = x.t.final; }); st.useLlm = false; render(); }), btn('LLM labels only (before our read)', () => { all.forEach(x => { x.lab = x.t.llm; }); st.useLlm = true; render(); }),
      btn('Break it: no missed triples in gold', () => { st.missed = false; render(); }), btn('Missed triples back', () => { st.missed = true; render(); }));
    shell.append(rule, presets, res.node, line, tbl, note, K.el('label', {}, 'show ', pSel), txt, K.el('h4', { style: 'margin:10px 0 4px' }, 'Extracted triples (click to cycle the label: correct, partly, incorrect). Hover: LLM label and reason, then our note.'), grid,
      K.el('h4', { style: 'margin:10px 0 4px;color:var(--he)' }, 'Triples the extractor missed (LLM-proposed, quote verified)'), gridM);
    function render() {
      const sel = all.filter(x => st.pid === 'all' || x.pid === st.pid), P = D.passages.filter(p => st.pid === 'all' || p.id === st.pid);
      txt.textContent = st.pid === 'all' ? '' : 'Passage ' + st.pid + ' (' + P[0].article + '): ' + P[0].text;
      grid.replaceChildren(...sel.map(x => K.el('button', { type: 'button', 'aria-pressed': x.lab === 'correct' ? 'true' : 'false',
        title: 'LLM: ' + x.t.llm + ' (' + x.t.reason + ')' + (x.t.mine ? ' | ours: ' + x.t.final + ' (' + x.t.mine + ')' : ''), style: `font-size:12px;text-align:left;border-color:${COL[x.lab]};color:${COL[x.lab]};max-width:100%;white-space:normal`,
        onclick: () => { x.lab = NEXT[x.lab]; render(); } }, MARK[x.lab] + x.pid + ': (' + x.t.source + ', ' + x.t.relation + ', ' + x.t.target + ')' + (x.lab !== x.t.llm ? '  [LLM said ' + x.t.llm + ']' : ''))));
      const missed = P.flatMap(p => p.missed.map(m => ({ p: p.id, m })));
      gridM.replaceChildren(...missed.map(x => K.el('span', { class: 'hint', title: 'quote: ' + x.m.quote, style: 'border:1px solid var(--he);border-radius:6px;padding:1px 6px;font-size:12px;' + (st.missed ? '' : 'opacity:.35') }, x.p + ': (' + x.m.source + ', ' + x.m.relation + ', ' + x.m.target + ')')));
      const mcount = st.missed ? missed.length : 0, sc = scoreLabels(sel.map(x => x.lab), mcount, st.mode);
      res.set(sc.F1, 4);
      line.textContent = `mode: ${st.mode} (${MODES[st.mode].join(' + ')} count as right)   labels: ${st.useLlm ? 'LLM only' : 'ours, after re-reading'}\nP = ${sc.tp}/${sc.np} = ${K.fmt(sc.P)}   R = ${sc.tp}/${sc.ng} = ${K.fmt(sc.R)}   (gold = ${sc.tp} right extracted + ${mcount} missed)\nF1 = 2 x ${K.fmt(sc.P)} x ${K.fmt(sc.R)} / (${K.fmt(sc.P)} + ${K.fmt(sc.R)}) = ${K.fmt(sc.F1, 4)}`;
      const n = a => a.length, c = (a, l) => a.filter(x => x.lab === l).length;
      tbl.textContent = `labels in view: correct ${c(sel, 'correct')}, partly ${c(sel, 'partly')}, incorrect ${c(sel, 'incorrect')} of ${n(sel)}\nwhole set, strict / lenient, ours: P ${K.fmt(D.stats.final_labels.correct / D.stats.n_triples)} / ${K.fmt((D.stats.final_labels.correct + D.stats.final_labels.partly) / D.stats.n_triples)}; LLM alone: P ${K.fmt(D.stats.llm_labels.correct / D.stats.n_triples)} / ${K.fmt((D.stats.llm_labels.correct + D.stats.llm_labels.partly) / D.stats.n_triples)}`;
      note.textContent = 'Read it like this: with strict labels fewer than half the extracted triples are right, because the extractor often picks a vague or reversed relation ("improves overfitting" for a technique that lessens it). With lenient labels most are acceptable. The gap between the two is the matching-rule blind spot of the metric, now measured on real triples. The LLM labeller alone was harsher than us on "improves" and "partly" cases: the same triples score differently under two labellers.';
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

  const api = { defaults, compute, mount, scoreLabels };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['triple_prf'] = api;
})(this);
