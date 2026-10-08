/* Entity-resolution pairwise F1. Real example: the pack's alias-merging rule vs OUR hand labels on 37 real node pairs (a demo, not a benchmark). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { mentions: ['a', 'b', 'c', 'd', 'e'], gold: { a: 1, b: 1, c: 1, d: 2, e: 2 }, pred: { a: 1, b: 1, c: 2, d: 2, e: 2 } };

  function pairsOf(map, ms) {
    const s = new Set();
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (map[ms[i]] === map[ms[j]]) s.add(ms[i] + '|' + ms[j]);
    return s;
  }
  function prf(tp, np, ng) { const P = np ? tp / np : 0, R = ng ? tp / ng : 0; return { P, R, F1: P + R ? 2 * P * R / (P + R) : 0 }; }
  /* PURE. F1 = 2PR/(P+R); P = |pairs(pred) & pairs(gold)| / |pairs(pred)|, R = same / |pairs(gold)|. */
  function compute(inp) {
    const pp = pairsOf(inp.pred, inp.mentions), gp = pairsOf(inp.gold, inp.mentions);
    let tp = 0; pp.forEach(x => { if (gp.has(x)) tp++; });
    return prf(tp, pp.size, gp.size).F1;
  }
  /* PURE: audit list. pairs[i] = {pack_merged, gold, dice?}; extra rule merges a pair when dice >= t (t > 1 = off). */
  function computePairs(pairs, t, goldOverride) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    pairs.forEach((x, i) => {
      const pred = x.pack_merged || (x.dice >= t), gold = goldOverride ? goldOverride[i] : x.gold;
      if (pred && gold) tp++; else if (pred) fp++; else if (gold) fn++; else tn++;
    });
    const m = prf(tp, tp + fp, tp + fn); return Object.assign({ tp, fp, fn, tn }, m);
  }
  function bigrams(s) { s = ' ' + s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
  function dice(a, b) { const A = bigrams(a), B = bigrams(b); let o = 0, na = 0, nb = 0; A.forEach((v, k) => { na += v; if (B.has(k)) o += Math.min(v, B.get(k)); }); B.forEach(v => { nb += v; }); return 2 * o / (na + nb); }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { gold: Object.assign({}, defaults.gold), pred: Object.assign({}, defaults.pred) };
    const ms = defaults.mentions;
    const shell = K.shell(el, 'Toy example (break it)', 'Five mentions a to e. Give each a gold cluster number and a predicted cluster number. Pairs are all unordered mention pairs in the same cluster.');
    const res = K.resultBox(); const out = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const mk = (which, m) => { const s = K.el('select', { 'aria-label': which + ' cluster of ' + m }, [1, 2, 3, 4, 5].map(v => K.el('option', { value: v }, String(v)))); s.value = st[which][m]; s.addEventListener('change', () => { st[which][m] = +s.value; render(); }); return s; };
    const tbl = K.el('table', {}, K.el('tr', {}, K.el('th', {}, 'mention'), K.el('th', {}, 'gold cluster'), K.el('th', {}, 'predicted cluster')),
      ms.map(m => K.el('tr', {}, K.el('td', {}, m), K.el('td', {}, mk('gold', m)), K.el('td', {}, mk('pred', m)))));
    const sel = {}; tbl.querySelectorAll('select').forEach(s => { sel[s.getAttribute('aria-label')] = s; });
    const set = (g, p) => { st.gold = Object.assign({}, g); st.pred = Object.assign({}, p); ms.forEach(m => { sel['gold cluster of ' + m].value = st.gold[m]; sel['pred cluster of ' + m].value = st.pred[m]; }); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Worked example', () => set(defaults.gold, defaults.pred)),
      btn('Break it: one big wrong merge', () => set({ a: 1, b: 1, c: 2, d: 3, e: 4 }, { a: 1, b: 1, c: 1, d: 1, e: 1 })),
      btn('Perfect', () => set(defaults.gold, defaults.gold)));
    shell.append(presets, tbl, K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' pairwise F1')), out);
    function render() {
      const pp = [...pairsOf(st.pred, ms)], gp = [...pairsOf(st.gold, ms)], ok = pp.filter(x => gp.includes(x));
      const r = prf(ok.length, pp.length, gp.length); res.set(compute({ mentions: ms, gold: st.gold, pred: st.pred }));
      out.textContent = `predicted pairs (${pp.length}): ${pp.join(' ') || '-'}\ngold pairs (${gp.length}): ${gp.join(' ') || '-'}\ncorrect (${ok.length}): ${ok.join(' ') || '-'}\nP = ${ok.length}/${pp.length} = ${K.fmt(r.P, 3)}   R = ${ok.length}/${gp.length} = ${K.fmt(r.R, 3)}   F1 = ${K.fmt(r.F1, 3)}\n` + (pp.length > 6 ? 'One big cluster of n mentions makes n(n-1)/2 pairs: a single wrong merge floods the precision.' : '');
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/entity_resolution_f1.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('audit ' + r.status); return r.json(); }); return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const pairs = D.pairs.map(p => Object.assign({}, p, { dice: dice(p.a, p.b) }));
    const gold = pairs.map(p => p.gold);
    let t = 1.01, open = -1;
    const shell = K.shell(el, 'Real example: the pack\'s merge rule versus our hand labels',
      'OUR HAND LABELS, a demo, not a benchmark. The pack has no gold clusters, so we labelled ' + pairs.length + ' real node pairs from its 662-node graph (same concept or not) by reading the passages. The pairs were chosen by us: the ones the rule merged, plus near-duplicates we spotted. They are not a random sample, so precision and recall describe this list only, not the whole graph. Click "label" to disagree with a label. The pack\'s rule is rule-based (name key + a stated-abbreviation rule), with no embedding merge.');
    const res = K.resultBox(); const nums = K.el('div', { class: 'formula', 'aria-live': 'polite' }); const note = K.el('p', { class: 'hint' });
    const sl = K.slider('extra rule: also merge when name similarity (character bigram Dice) is at least', 0.3, 1.01, 0.01, t, v => { t = v; render(); });
    const rows = K.el('div');
    const btn = (tx, f) => K.el('button', { type: 'button', onclick: f }, tx);
    shell.append(K.el('div', { class: 'row' }, btn('Pack rule only', () => { t = 1.01; sl.set(1.01); render(); }), btn('Add a loose rule (0.6)', () => { t = 0.6; sl.set(0.6); render(); }), btn('Reset my labels', () => { pairs.forEach((p, i) => { gold[i] = p.gold; }); render(); })),
      K.el('div', { class: 'row' }, sl.node), K.el('div', { class: 'row' }, res.node, K.el('span', { class: 'hint' }, ' pairwise F1 on the audit list')), nums, note,
      K.el('details', { open: '' }, K.el('summary', {}, 'The ' + pairs.length + ' audited pairs'), rows));
    function render() {
      const m = computePairs(pairs, t, gold); res.set(m.F1);
      nums.textContent = `merged by rule and same (TP) ${m.tp}   merged but different (FP) ${m.fp}   same but kept apart (FN) ${m.fn}   different and apart (TN) ${m.tn}\nP = ${m.tp}/${m.tp + m.fp} = ${K.fmt(m.P, 3)}   R = ${m.tp}/${m.tp + m.fn} = ${K.fmt(m.R, 3)}   F1 = 2PR/(P+R) = ${K.fmt(m.F1, 3)}`;
      note.textContent = t > 1 ? 'The rule is precise on this list (it merged nothing wrong) but misses ' + m.fn + ' of ' + (m.tp + m.fn) + ' same-concept pairs: SVM / support vector machines, Tikhonov regularization / ridge regression, MSE / mean squared error remain separate nodes.' : 'Loosening the rule recovers some missed pairs but also merges look-alikes such as L1 / L2 regularization or gradient descent / gradient ascent: watch FP rise. Our negatives were picked as look-alikes, so a loose rule looks worse here than it would on a random sample.';
      rows.replaceChildren(...pairs.map((p, i) => {
        const pred = p.pack_merged || p.dice >= t, g = gold[i];
        const cls = pred === !!g ? 'good' : 'bad', out = pred && g ? 'TP' : pred ? 'FP' : g ? 'FN' : 'TN';
        const line = K.el('div', { class: 'row', style: 'gap:8px;margin:2px 0' },
          K.el('code', { class: cls, style: 'min-width:24px' }, out),
          K.el('span', { style: 'flex:1;min-width:180px' }, p.a + '  /  ' + p.b),
          K.el('span', { class: 'hint', style: 'margin:0' }, (p.pack_merged ? 'merged by pack' : p.dice >= t ? 'merged by loose rule' : 'kept apart') + ', Dice ' + K.fmt(p.dice, 2)),
          K.el('button', { type: 'button', 'aria-label': 'toggle our label for ' + p.a + ' and ' + p.b, onclick: () => { gold[i] = gold[i] ? 0 : 1; render(); } }, 'label: ' + (g ? 'same' : 'different') + (g !== p.gold ? ' (yours)' : '')),
          K.el('button', { type: 'button', 'aria-expanded': String(open === i), onclick: () => { open = open === i ? -1 : i; render(); } }, 'why'));
        const w = K.el('div'); w.append(line);
        if (open === i) w.append(K.el('p', { class: 'hint', style: 'margin:2px 0 8px 32px' }, p.why.replace(/\.$/, '') + '. Passages: ' + p.ev_a.passage + ': "' + p.ev_a.text + '"' + (p.ev_b.passage !== p.ev_a.passage || p.ev_b.text !== p.ev_a.text ? '  |  ' + p.ev_b.passage + ': "' + p.ev_b.text + '"' : '')));
        return w;
      }));
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }); const body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy); real();
  }
  const api = { defaults, compute, computePairs, dice, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['entity_resolution_f1'] = api;
})(this);
