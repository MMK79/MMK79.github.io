/* Pairwise win rate demo: ten pairs, each judged in two slot orders. Click a verdict to cycle it. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  // each pair: [verdict when A shown first, verdict when B shown first]; value = system preferred: 'A' | 'B' | 'T'
  const defaults = {
    pairs: [['A', 'A'], ['A', 'A'], ['A', 'A'], ['A', 'A'], ['A', 'A'], ['A', 'A'],
            ['T', 'T'], ['T', 'T'], ['B', 'B'], ['B', 'B']],
    requireConsistent: true, // false = trust order 1 only (position bias goes unseen)
  };

  function outcome(p, consistent) {
    if (!consistent) return p[0] === 'A' ? 'W' : p[0] === 'B' ? 'L' : 'T';
    if (p[0] === 'A' && p[1] === 'A') return 'W';
    if (p[0] === 'B' && p[1] === 'B') return 'L';
    return 'T'; // tie, or the two orders disagree
  }

  /* PURE: WR = (W + T/2) / N */
  function compute(inp) {
    const c = inp.requireConsistent !== false;
    const o = inp.pairs.map(p => outcome(p, c));
    const W = o.filter(x => x === 'W').length, T = o.filter(x => x === 'T').length;
    return (W + 0.5 * T) / inp.pairs.length;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { pairs: defaults.pairs.map(p => p.slice()), cons: true };
    const shell = K.shell(el, 'Toy example (break it)',
      'Each pair was judged twice, once with A shown first and once with B shown first. Click a verdict to cycle A, tie, B. Watch what happens when the two orders disagree.');
    const grid = K.el('div', { class: 'row', role: 'group', 'aria-label': 'judged pairs' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const tog = K.el('label', {}, K.el('input', { type: 'checkbox', checked: 'checked', onchange: e => { st.cons = e.target.checked; render(); } }), ' count order-inconsistent pairs as ties');
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.pairs = defaults.pairs.map(p => p.slice()); st.cons = true; tog.firstChild.checked = true; render(); }),
      btn('Break it: judge always picks the first slot', () => { st.pairs = st.pairs.map(() => ['A', 'B']); render(); }));
    shell.append(presets, tog, grid, res.node, formula, note);
    const next = { A: 'T', T: 'B', B: 'A' };
    const colour = { W: 'var(--he)', T: 'var(--muted, #9aa3b2)', L: 'var(--warn)' };
    function render() {
      grid.replaceChildren();
      st.pairs.forEach((p, i) => {
        const o = outcome(p, st.cons), bad = p[0] !== p[1];
        const mk = (slot, label) => K.el('button', {
          type: 'button', 'aria-label': `pair ${i + 1}, ${label} first: judge picks ${p[slot]}. Click to change`,
          style: 'min-width:34px;', onclick: () => { p[slot] = next[p[slot]]; render(); }
        }, p[slot]);
        grid.append(K.el('span', { style: `display:inline-flex;flex-direction:column;align-items:center;gap:2px;border:1px solid ${bad && st.cons ? 'var(--warn)' : 'transparent'};border-radius:8px;padding:2px;` },
          mk(0, 'A'), mk(1, 'B'),
          K.el('b', { style: `color:${colour[o]}` }, o)));
      });
      const inp = { pairs: st.pairs, requireConsistent: st.cons };
      const os = st.pairs.map(p => outcome(p, st.cons));
      const W = os.filter(x => x === 'W').length, T = os.filter(x => x === 'T').length, L = os.length - W - T;
      const wr = compute(inp);
      res.set(wr);
      formula.textContent = `WR = (W + ½T) / N = (${W} + ½·${T}) / ${os.length} = ${K.fmt(wr)}   (L = ${L})`;
      const dis = st.pairs.filter(p => p[0] !== p[1]).length;
      const naive = compute({ pairs: st.pairs, requireConsistent: false });
      note.textContent = dis
        ? `${dis} pair(s) flip when the order flips: that is position bias. Trusting order 1 alone would give ${K.fmt(naive)}; the order-consistent rate is ${K.fmt(compute({ pairs: st.pairs, requireConsistent: true }))}.`
        : 'Both orders agree on every pair. A win rate still says who is better, not by how much.';
      note.className = 'hint' + (dis ? ' bad' : '');
    }
    render();
  }

  /* ---- Real example: pack Presentations/_real-examples (answers/pairwise.json + metrics/pairwise_win_rate.json) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/pairwise_win_rate.json'), get('metrics/judge_position_bias.json'), get('answers/pairwise.json'), get('answers/answers.json'), get('data/questions.json')]).then(a => {
      const ans = {}, qs = {}, pw = {};
      a[3].forEach(r => { ans[r.qid + '_' + r.arm] = r; });
      a[4].forEach(q => { qs[q.id] = q; });
      a[2].forEach(r => { pw[r.qid + '_' + r.pair.join('')] = r; });
      return { m: a[0], bias: a[1], pw, ans, qs };
    });
    return realData;
  }
  /* PURE: first arm x's score on one question = mean over the two order-swapped verdicts (win 1, tie 0.5, loss 0). */
  function pairScore(orders, x) {
    return orders.reduce((a, o) => a + (o.winner_arm === x ? 1 : o.winner_arm === 'tie' ? 0.5 : 0), 0) / orders.length;
  }
  const consistent = orders => orders[0].winner_arm === orders[1].winner_arm;
  const ARM = { A: 'A: no retrieval', B: 'B: hybrid RRF top-5', C: 'C: dense top-5 + graph' };

  function mountReal(el, D) {
    const K = root.DemoKit;
    const pairs = Object.keys(D.m.pairs);
    const qids = D.m.pairs[pairs[0]].n_questions ? Object.keys(D.m.pairs[pairs[0]].per_question_score_x) : [];
    const st = { pair: pairs[0], q: qids[0] };
    const shell = K.shell(el, 'Real example: pairwise win rate on real answers and a real judge',
      'Scale: n = 12 questions, one run, temperature 0, LLM judge (judge A ' + D.m.judge_A + '), no human labels; wide intervals. A demo, not a benchmark. Verdicts are the real judge output, not editable. Arm C gets about 40% more context than B and starts from a different first-stage list, so B vs C does not isolate the graph. "First-named arm" means the arm listed first in the pair name, not a better arm.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const pSel = K.el('select', { 'aria-label': 'pair of arms', style: 'max-width:100%' }, pairs.map(p => opt(p, p.replace('-vs-', ' vs ') + ' (first-named: ' + p[0] + ')')));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    pSel.addEventListener('change', () => { st.pair = pSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' });
    const orders = K.el('div', { role: 'group', 'aria-label': 'verdicts in both orders' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const tbl = K.el('div', { role: 'group', 'aria-label': 'all questions for this pair' });
    const sum = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'pair ', pSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, orders, res.node, formula, note, K.el('h4', {}, 'All 12 questions, this pair (click a row to open it)'), tbl, sum);

    const ordersOf = (q, p) => (D.pw[q + '_' + p.replace('-vs-', '')] || {}).orders;
    const cell = (w, x) => w === 'tie' ? 'tie' : w + (w === x ? ' (first-named)' : '');
    function render() {
      const [x, y] = st.pair.split('-vs-'), o = ordersOf(st.q, st.pair);
      const ax = D.ans[st.q + '_' + x], ay = D.ans[st.q + '_' + y];
      info.replaceChildren(
        K.el('p', { class: 'hint' }, 'Gold answer: ' + D.qs[st.q].gold_answer),
        K.el('details', {}, K.el('summary', {}, 'Answer from arm ' + x + ' (first-named)'), K.el('p', { class: 'hint' }, ax ? ax.answer : '')),
        K.el('details', {}, K.el('summary', {}, 'Answer from arm ' + y), K.el('p', { class: 'hint' }, ay ? ay.answer : '')));
      orders.replaceChildren();
      o.forEach((r, i) => {
        orders.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (r.winner_arm === 'tie' ? 'muted, #9aa3b2' : 'he') + ')' },
          K.el('b', {}, 'Order ' + (i + 1) + ': ' + r.first + ' shown first, ' + r.second + ' second. Judge: ' + (r.winner_arm === 'tie' ? 'tie' : 'arm ' + r.winner_arm + ' (slot ' + r.winner_position + ')') + '. '),
          K.el('span', { class: 'hint' }, r.reason)));
      });
      const ok = consistent(o), sc = pairScore(o, x);
      orders.append(K.el('p', { class: ok ? 'hint' : 'hint bad' }, ok
        ? 'Both orders agree: ' + (o[0].winner_arm === 'tie' ? 'a tie both ways, each verdict counts 0.5.' : 'arm ' + o[0].winner_arm + ' wins both ways, so the verdict does not depend on slot.')
        : 'The orders DISAGREE: the verdict flipped when the slots swapped. That is position bias in this pair. Scored as win + loss averaged = ' + K.fmt(sc, 3) + '.'));
      res.set(sc, 3);
      const sv = r => r.winner_arm === x ? 1 : r.winner_arm === 'tie' ? 0.5 : 0;
      formula.textContent = `score(${x}) on ${st.q} = (${sv(o[0])} + ${sv(o[1])}) / 2 = ${K.fmt(sc, 3)}   (win 1, tie 0.5, loss 0)`;
      note.textContent = 'Win rate of ' + x + ' over ' + y + ' = mean of these scores over all questions. Ties count half, and an order flip averages to 0.5, the same as a tie.';
      tbl.replaceChildren();
      const head = K.el('div', { class: 'row hint', style: 'font-weight:600' }, 'q | order 1 winner | order 2 winner | score');
      tbl.append(head);
      const scores = [];
      qids.forEach(id => {
        const oo = ordersOf(id, st.pair), s = pairScore(oo, x), c = consistent(oo); scores.push(s);
        const row = K.el('button', { type: 'button', 'aria-label': 'open ' + id, style: 'display:block;width:100%;text-align:left;margin:1px 0;padding:2px 6px;box-sizing:border-box;' + (id === st.q ? 'border-color:var(--he);' : '') + (c ? '' : 'border-color:var(--warn);color:var(--warn);'),
          onclick: () => { st.q = id; qSel.value = id; render(); } },
          id + ' | ' + oo.map(r => r.winner_arm).join(' | ') + ' | ' + K.fmt(s, 2) + (c ? '' : ' | flip'));
        tbl.append(row);
      });
      const wr = scores.reduce((a, b) => a + b, 0) / scores.length, P = D.m.pairs[st.pair];
      const cons = qids.filter(id => consistent(ordersOf(id, st.pair))).length;
      const flips = qids.length - cons;
      sum.textContent = `Win rate of ${x} over ${y} = (sum of ${scores.length} scores) / ${scores.length} = ${K.fmt(wr, 3)}  (pack: ${P.win_rate_first_arm.mean}, 95% bootstrap CI [${P.win_rate_first_arm.ci95.join(', ')}]). ` +
        `Position consistency for this pair: ${cons}/${qids.length} = ${K.fmt(cons / qids.length, 3)}; ${flips} question(s) flipped with the order. ` +
        `Overall (3 pairs, ${D.bias.overall.n_pairs} pairs of answers): consistency ${D.bias.overall.position_consistency}; share of verdicts naming the first slot ${D.bias.overall.first_position_preference} (0.5 would mean no slot preference; for B vs C it is ${D.bias.per_pair['B-vs-C'].first_position_preference} because most verdicts are ties). ` +
        `This pair: ${P.outcome_counts_pair_level.tie_both_orders} ties both ways, ${P.tie_share_of_verdicts * 100}% of verdicts are ties. A win rate of ${K.fmt(wr, 3)} below 0.5 only says the first-named arm is the weaker one; the interval is wide at n = 12.`;
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['pairwise_win_rate'] = api;
})(this);
