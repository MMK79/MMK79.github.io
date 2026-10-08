/* Judge position consistency demo. Real example (default): 36 arm-pair x question pairs judged in both slot orders. Toy: editable counts. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  // toy defaults reproduce worked_example: 38 of 50 pairs agree; first slot wins 55 of 100 verdicts
  const defaults = { N: 50, same: 38, firstWins: 55 };

  /* PURE: Cons = same / N ; FirstPref = firstWins / (2N) */
  function compute(inp) {
    const N = inp.N;
    return { Cons: N ? +(inp.same / N).toFixed(4) : 0, FirstPref: N ? +(inp.firstWins / (2 * N)).toFixed(4) : 0 };
  }
  /* PURE: counts from real pairs (each = {orders:[{winner_arm, winner_position}, ...]}) */
  function countsFrom(pairs) {
    let same = 0, first = 0, ties = 0;
    pairs.forEach(r => {
      const w = r.orders.map(o => o.winner_arm);
      if (w[0] === w[1]) same++;
      r.orders.forEach(o => { if (o.winner_position === '1') first++; else if (o.winner_position === 'tie') ties++; });
    });
    return { N: pairs.length, same, firstWins: first, ties };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)', 'Each pair is judged twice, once per slot order. Set how many pairs gave the same winner and how often the first slot won, and watch both scores.');
    const sN = K.slider('pairs N', 2, 100, 1, st.N, v => { st.N = v; sSame.set(Math.min(st.same, v)); st.same = sSame.get(); sFirst.set(Math.min(st.firstWins, 2 * v)); st.firstWins = sFirst.get(); render(); });
    const sSame = K.slider('pairs with the same winner in both orders', 0, 100, 1, st.same, v => { st.same = Math.min(v, st.N); render(); });
    const sFirst = K.slider('verdicts where the first slot won (of 2N)', 0, 200, 1, st.firstWins, v => { st.firstWins = Math.min(v, 2 * st.N); render(); });
    const res = K.resultBox(), res2 = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const setAll = o => { Object.assign(st, o); sN.set(st.N); sSame.set(st.same); sFirst.set(st.firstWins); render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => setAll(defaults)),
      btn('Break it: judge always picks slot 1', () => setAll({ N: 50, same: 0, firstWins: 100 })),
      btn('Unbiased judge', () => setAll({ N: 50, same: 50, firstWins: 50 }))),
      sN.node, sSame.node, sFirst.node, K.el('div', {}, 'Cons ', res.node), K.el('div', {}, 'FirstPref ', res2.node), formula, note);
    function render() {
      const r = compute(st);
      res.set(r.Cons); res2.set(r.FirstPref);
      formula.textContent = `Cons = ${st.same}/${st.N} = ${K.fmt(r.Cons)}    FirstPref = ${st.firstWins}/${2 * st.N} = ${K.fmt(r.FirstPref)}`;
      note.textContent = r.Cons < 0.5 && r.FirstPref > 0.8
        ? 'A judge that always names the first slot: consistency collapses to 0 and FirstPref goes to 1. The verdict depends on where the answer sits, not on what it says.'
        : 'Cons near 1 and FirstPref near 0.5 is the healthy pattern. Ties count as agreeing, and they lower FirstPref, so read the two numbers together.';
      note.className = 'hint' + (r.Cons < 0.5 ? ' bad' : '');
    }
    render();
  }

  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/judge_position_bias.json'), get('answers/pairwise.json'), get('data/questions.json')])
      .then(a => ({ m: a[0], pw: a[1], qs: Object.fromEntries(a[2].map(q => [q.id, q])) }));
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const shell = K.shell(el, 'Real example: does the judge change its mind when the answers swap places?',
      'Scale: n = 36 pairs (3 arm pairs x 12 questions), each judged in both orders by one LLM judge (' + D.m.judge_A + '), temperature 0, no human labels. A demo, not a benchmark. Consistency says the judge is stable, not that it is right.');
    const st = { sel: 0, filter: 'all' };
    const c = countsFrom(D.pw), r = compute(c);
    const res = K.resultBox(), res2 = K.resultBox();
    res.set(r.Cons); res2.set(r.FirstPref);
    const flips = D.pw.filter(p => p.orders[0].winner_arm !== p.orders[1].winner_arm);
    const flipV = flips.reduce((a, p) => a + p.orders.filter(o => o.winner_position === '1').length, 0);
    const decisive = c.N * 2 - c.ties;
    const formula = K.el('div', { class: 'formula' },
      `Cons = ${c.same}/${c.N} = ${K.fmt(r.Cons)}    FirstPref = ${c.firstWins}/${2 * c.N} = ${K.fmt(r.FirstPref)}`);
    const sum = K.el('p', { class: 'hint' },
      `${c.N * 2} verdicts: ${c.firstWins} name slot 1, ${decisive - c.firstWins} name slot 2, ${c.ties} are ties. Among the ${decisive} decisive verdicts the first slot wins ${K.fmt(c.firstWins / decisive)}. ` +
      `${flips.length} pairs flipped (the same slot won both times): ${flipV} of their ${flips.length * 2} verdicts name slot 1, so ${flipV / (flips.length * 2) * 100}% of flips favour the first slot, ${flips.length / 2} pairs each way. ` +
      `FirstPref ${K.fmt(r.FirstPref)} is below 0.5 only because ties count as neither slot.`);
    const detail = K.el('div', { 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'all 36 pairs' });
    const fsel = K.el('select', { 'aria-label': 'filter' }, ['all', 'flipped only', 'ties both orders'].map(t => K.el('option', { value: t }, t)));
    fsel.addEventListener('change', () => { st.filter = fsel.value; drawList(); });
    shell.append(K.el('div', {}, 'Cons ', res.node), K.el('div', {}, 'FirstPref ', res2.node), formula, sum,
      K.el('div', { class: 'row' }, K.el('label', {}, 'show ', fsel)), list, detail);
    const kind = p => p.orders[0].winner_arm !== p.orders[1].winner_arm ? 'flip' : p.orders[0].winner_arm === 'tie' ? 'tie' : 'same';
    function drawList() {
      list.replaceChildren();
      D.pw.forEach((p, i) => {
        const k = kind(p);
        if ((st.filter === 'flipped only' && k !== 'flip') || (st.filter === 'ties both orders' && k !== 'tie')) return;
        const pos = p.orders.map(o => o.winner_position).join(' / ');
        list.append(K.el('button', { type: 'button', 'aria-label': 'open ' + p.qid + ' ' + p.pair.join(' vs '),
          style: 'display:block;width:100%;text-align:left;margin:1px 0;padding:2px 6px;box-sizing:border-box;' + (i === st.sel ? 'border-color:var(--he);' : '') + (k === 'flip' ? 'color:var(--warn);border-color:var(--warn);' : ''),
          onclick: () => { st.sel = i; drawList(); drawDetail(); } },
          `${p.qid} ${p.pair.join(' vs ')} | slot won: ${pos} | ${k === 'flip' ? 'FLIP' : k === 'tie' ? 'tie both' : 'same winner'}`));
      });
    }
    function drawDetail() {
      const p = D.pw[st.sel], k = kind(p);
      detail.replaceChildren(K.el('h4', {}, `${p.qid} (${(D.qs[p.qid] || {}).type || ''}): ${(D.qs[p.qid] || {}).question || ''}`));
      p.orders.forEach((o, i) => detail.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(--' + (k === 'flip' ? 'warn' : 'he') + ')' },
        K.el('b', {}, `Order ${i + 1}: ${o.first} first, ${o.second} second. Judge: ${o.winner_arm === 'tie' ? 'tie' : 'arm ' + o.winner_arm + ' (slot ' + o.winner_position + ')'}. `), K.el('span', { class: 'hint' }, o.reason))));
      detail.append(K.el('p', { class: k === 'flip' ? 'hint bad' : 'hint' }, k === 'flip'
        ? 'The same slot won both times: the verdict followed the position, not the answer. That is position bias.'
        : k === 'tie' ? 'A tie in both orders counts as consistent.' : 'The same arm won in both orders: consistent.'));
    }
    drawList(); drawDetail();
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

  const api = { defaults, compute, countsFrom, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['judge_position_bias'] = api;
})(this);
