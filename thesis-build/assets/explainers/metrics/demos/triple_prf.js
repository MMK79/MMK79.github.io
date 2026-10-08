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

  /* ---- Real example: Presentations/_real-examples/graph/graph.json (762 real LLM-extracted typed edges, 138 passages).
     The pack has NO gold triples. The labels below are OUR hand labels for two passages (a demo, not a benchmark). ---- */
  const PASSAGES = ['p001', 'p002'];
  /* hand label: 1 = correct per the passage text, 0 = wrong; reason in the note */
  const LABELS = {
    'ridge regression|applied_to|multiple-regression models': [1, 'text: "method of estimating the coefficients of multiple-regression models"'],
    'ridge regression|is_a|regularization': [1, 'text: "a method of regularization"'],
    'ridge regression|improves|multicollinearity': [1, 'text: "mitigate the problem of multicollinearity"'],
    'multicollinearity|part_of|linear regression': [0, 'multicollinearity is a problem that occurs in linear regression, not a part of it'],
    'ridge regression|applied_to|parameter estimation': [1, 'text: "improved efficiency in parameter estimation problems"'],
    'ridge regression|related_to|bias–variance tradeoff': [1, 'text: "(see bias–variance tradeoff)"'],
    'ridge regression|introduced_by|Hoerl': [1, 'text: "introduced by Hoerl and Kennard in 1970"'],
    'ridge regression|introduced_by|Kennard': [1, 'text: "introduced by Hoerl and Kennard in 1970"'],
    'ridge regression|alternative_to|least square estimators': [1, 'a solution to the imprecision of least square estimators'],
    'ridge regression|applied_to|linear regression models': [1, 'text: "linear regression models have some multicollinear variables"'],
    'linear regression models|requires|multicollinearity': [0, 'wrong: multicollinearity is a problem in these models, they do not require it'],
    'ridge regression|uses|ridge regression estimator': [0, 'circular: the estimator is the method itself'],
    'ridge regression estimator|improves|least square estimators': [1, 'text: variance and mean square error "often smaller than the least square estimators"'],
  };
  /* triples a careful reader would add from the same two passages that the extractor did NOT produce (our hand-written gold additions) */
  const MISSED = [['ridge regression', 'also_known_as', 'Tikhonov regularization'], ['ridge regression', 'used_in', 'econometrics'],
    ['ridge regression', 'used_in', 'chemistry'], ['ridge regression', 'used_in', 'engineering'], ['ridge regression', 'applied_to', 'ill-posed inverse problems']];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    realData = Promise.all([fetch(base + 'graph/graph.json'), fetch(base + 'data/corpus.json')].map(p => p.then(r => { if (!r.ok) throw new Error(r.url + ' ' + r.status); return r.json(); })))
      .then(a => ({ g: a[0], c: a[1] }));
    return realData;
  }
  function mountReal(el, D) {
    const K = root.DemoKit;
    const N = {}; D.g.nodes.forEach(n => { N[n.id] = n.name; });
    const triples = D.g.edges.filter(e => e.passages.length === 1 && PASSAGES.includes(e.passages[0]))
      .map(e => ({ t: [N[e.source], e.relation, N[e.target]], pid: e.passages[0] }));
    const txt = pid => (D.c.find(p => p.id === pid) || {}).text || '';
    const st = { lab: triples.map(x => (LABELS[x.t.join('|')] || [1])[0]), miss: new Set(MISSED.map((_, i) => i)) };
    const shell = K.shell(el, 'Real example: auditing real extracted triples by hand',
      'DEMO ONLY: our hand labels, not a benchmark. The real-example pack holds 762 real LLM-extracted edges but NO gold triples, so no P/R/F1 can be reported for the whole graph. Here we read two passages (p001, p002 of the ridge regression article) and label each extracted triple ourselves. Click a triple to flip our label. Recall needs a gold list, so we also wrote 5 triples the extractor missed (click to drop one). Every number below is only as good as these labels.');
    const res = K.resultBox(), line = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const gridP = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }), gridM = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    const src = PASSAGES.map(pid => K.el('details', {}, K.el('summary', {}, 'Passage ' + pid + ' (source text)'), K.el('p', { class: 'hint' }, txt(pid))));
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Our labels', () => { st.lab = triples.map(x => (LABELS[x.t.join('|')] || [1])[0]); st.miss = new Set(MISSED.map((_, i) => i)); render(); }),
      btn('Break it: no missed triples in gold', () => { st.miss = new Set(); render(); }),
      btn('Break it: label everything correct', () => { st.lab = triples.map(() => 1); render(); }));
    shell.append(...src, presets,
      K.el('h4', { style: 'margin:10px 0 4px;color:var(--k12)' }, 'Real extracted triples (click to flip our label)'), gridP,
      K.el('h4', { style: 'margin:10px 0 4px;color:var(--he)' }, 'Triples the extractor missed, written by us (click to drop)'), gridM,
      res.node, line, note);
    function render() {
      gridP.replaceChildren(...triples.map((x, i) => {
        const ok = st.lab[i] === 1, col = ok ? 'var(--he)' : 'var(--k12)';
        return K.el('button', { type: 'button', 'aria-pressed': ok ? 'true' : 'false', title: (LABELS[x.t.join('|')] || ['', ''])[1],
          style: `font-size:12px;border-color:${col};color:${col}`, onclick: () => { st.lab[i] = ok ? 0 : 1; render(); } },
          (ok ? '✓ ' : '✗ ') + `(${x.t.join(', ')})`);
      }));
      gridM.replaceChildren(...MISSED.map((t, i) => K.el('button', { type: 'button', 'aria-pressed': st.miss.has(i) ? 'true' : 'false',
        style: 'font-size:12px;' + (st.miss.has(i) ? 'border-color:var(--he);color:var(--he)' : 'opacity:.35'),
        onclick: () => { st.miss.has(i) ? st.miss.delete(i) : st.miss.add(i); render(); } }, `(${t.join(', ')})`)));
      const tp = st.lab.reduce((a, b) => a + b, 0), np = triples.length, ng = tp + st.miss.size;
      const P = np ? tp / np : 0, R = ng ? tp / ng : 0, F1 = P + R ? 2 * P * R / (P + R) : 0;
      res.set(F1, 4);
      line.textContent = `P = ${tp}/${np} = ${K.fmt(P)}   R = ${tp}/${ng} = ${K.fmt(R)}   (gold = ${tp} correct extracted + ${st.miss.size} missed, hand-made)\nF1 = 2 x ${K.fmt(P)} x ${K.fmt(R)} / (${K.fmt(P)} + ${K.fmt(R)}) = ${K.fmt(F1, 4)}`;
      note.textContent = 'Demo of two passages and 13 triples, one labeller (us), no second annotator, no kappa. Not a measurement of the thesis extractor. A real P/R/F1 needs an independent gold set. Notice: the extractor also had to pick a relation name ("is_a", "related_to"); a stricter labeller would mark some of these wrong.';
      note.className = 'hint';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['triple_prf'] = api;
})(this);
