/* Pedagogical win rate vs a reference teacher (MathTutorBench style). TOY ONLY: real example pending, the pack has no pedagogy reward model and no tutor-vs-teacher dialogue data. */
(function (root) {
  /* [reward of the system's reply, reward of the reference teacher's reply] for 10 dialogue turns. Invented numbers; the system wins turns 1, 3, 5, 6, 8, 10. */
  const defaults = { pairs: [[0.71, 0.64], [0.55, 0.62], [0.80, 0.60], [0.48, 0.52], [0.66, 0.59], [0.73, 0.70], [0.40, 0.58], [0.69, 0.61], [0.52, 0.57], [0.77, 0.65]], bias: 0 };

  /* PURE: WR = (1/N) sum 1[R(x, y_model) + bias > R(x, y_teacher)]. A tie is not a win. `bias` is a constant the reward model adds to the system's reply (for example a liking for long replies). */
  function compute(inp) {
    const b = inp.bias || 0, n = inp.pairs.length;
    return n ? inp.pairs.filter(p => p[0] + b > p[1]).length / n : NaN;
  }
  /* Wilson 95% interval for a proportion k/n */
  function wilson(k, n) { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; }

  function mount(el) {
    const K = root.DemoKit, st = { pairs: defaults.pairs.map(p => p.slice()), bias: 0 };
    const banner = K.el('p', { class: 'hint bad' }, 'Real example pending: no pedagogy reward model and no tutor-versus-teacher data exist in the real-example pack (its answer study asks factual questions, not tutoring turns; its pairwise win rate compares two arms with an LLM judge, which is a different measurement). This page is a toy with invented reward scores.');
    const shell = K.shell(el, 'Toy example (break it)',
      'Ten dialogue turns. A trained pedagogy reward model scores the system reply and the reference teacher reply; the system wins a turn when its score is higher. Edit the scores, or add a constant bias to the system scores to see what a biased reward model does. All numbers are invented.');
    el.insertBefore(banner, shell);
    const tbl = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const bias = K.slider('bias added to the system reward', -0.3, 0.3, 0.01, 0, v => { st.bias = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = (pairs, b) => { st.rebuild = true; st.pairs = pairs.map(p => p.slice()); st.bias = b; bias.set(b); render(); };
    shell.append(tbl, K.el('div', { class: 'row' }, bias.node), K.el('div', { class: 'row' },
      btn('Worked example (6 of 10)', () => set(defaults.pairs, 0)),
      btn('Break it: reward model likes the system by +0.12, replies unchanged', () => set(defaults.pairs, 0.12)),
      btn('Break it: all turns tie', () => set(defaults.pairs.map(p => [p[1], p[1]]), 0)),
      btn('Parity', () => set(defaults.pairs.map((p, i) => [p[1] + (i % 2 ? -0.05 : 0.05), p[1]]), 0))), res.node, formula, note);
    function build() {
      st.cells = [];
      const head = K.el('tr', {}, K.el('th', {}, 'turn'), K.el('th', {}, 'system'), K.el('th', {}, 'teacher'), K.el('th', {}, 'win?'));
      const rows = st.pairs.map((p, i) => {
        const mk = j => { const inp = K.el('input', { type: 'number', min: 0, max: 1, step: 0.01, value: p[j], style: 'width:70px', 'aria-label': 'turn ' + (i + 1) + (j ? ' teacher' : ' system') + ' reward' }); inp.addEventListener('input', () => { st.pairs[i][j] = Number(inp.value) || 0; render(); }); return inp; };
        const win = K.el('td', {}); st.cells.push({ win });
        return K.el('tr', {}, K.el('td', { class: 'num' }, String(i + 1)), K.el('td', {}, mk(0)), K.el('td', {}, mk(1)), win);
      });
      tbl.replaceChildren(K.el('table', {}, head, ...rows));
    }
    function render() {
      const wins = st.pairs.map(p => p[0] + st.bias > p[1]), k = wins.filter(Boolean).length, n = st.pairs.length;
      if (!tbl.firstChild || tbl.dataset.n !== String(n) || st.rebuild) { st.rebuild = false; tbl.dataset.n = String(n); build(); }
      st.pairs.forEach((p, i) => { const c = st.cells[i]; c.win.className = wins[i] ? 'good' : 'bad'; c.win.textContent = wins[i] ? 'win' : (p[0] + st.bias === p[1] ? 'tie (no win)' : 'loss'); });
      const wr = compute({ pairs: st.pairs, bias: st.bias }), [lo, hi] = wilson(k, n);
      res.set(wr, 3);
      formula.textContent = `WR = ${k} wins / ${n} turns = ${K.fmt(wr, 3)}   (0.5 = parity with the teacher)\n95% interval for ${n} turns (Wilson): [${K.fmt(lo, 2)}, ${K.fmt(hi, 2)}]`;
      note.className = 'hint' + (st.bias !== 0 ? ' bad' : '');
      note.textContent = (st.bias !== 0 ? 'The replies did not change, only the reward model\'s bias did: the win rate moved to ' + K.fmt(wr, 2) + '. A reward model has its own biases (length, style), so a win rate is only as good as the model. ' : '') + 'With ' + n + ' turns the interval is wide: 6 of 10 is compatible with parity. MathTutorBench is about math tutoring; transfer to ML concepts is unchecked. Real example pending.';
    }
    render();
  }

  const api = { defaults, compute, mount, wilson };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['pedagogy_reward_winrate'] = api;
})(this);
