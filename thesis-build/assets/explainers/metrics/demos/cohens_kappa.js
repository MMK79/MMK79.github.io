/* Cohen's kappa demo: edit the 2x2 table of judge vs human labels; see observed agreement, chance agreement and kappa. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { yy: 40, yn: 10, ny: 5, nn: 45 };   // yy both yes; yn judge yes/human no; ny judge no/human yes; nn both no

  /* PURE: kappa = (po - pe) / (1 - pe). Returns NaN when pe = 1 (both raters always give one label). */
  function compute(inp) {
    const { yy, yn, ny, nn } = inp, n = yy + yn + ny + nn;
    if (n <= 0) return NaN;
    const po = (yy + nn) / n;
    const jy = (yy + yn) / n, hy = (yy + ny) / n;
    const pe = jy * hy + (1 - jy) * (1 - hy);
    return pe >= 1 ? NaN : (po - pe) / (1 - pe);
  }
  function parts(inp) {
    const n = inp.yy + inp.yn + inp.ny + inp.nn;
    const jy = (inp.yy + inp.yn) / n, hy = (inp.yy + inp.ny) / n;
    return { n, po: (inp.yy + inp.nn) / n, jy, hy, pe: jy * hy + (1 - jy) * (1 - hy) };
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el, 'Toy example (break it)',
      'Edit the four counts. Kappa is the agreement left over after removing what two raters would agree on by luck. Try the "break it" preset.');
    const cells = {};
    const mk = (key, lab) => {
      const inp = K.el('input', { type: 'number', min: 0, max: 1000, step: 1, value: st[key], 'aria-label': lab, style: 'width:72px' });
      inp.addEventListener('input', () => { st[key] = Math.max(0, Math.floor(Number(inp.value) || 0)); render(); });
      cells[key] = inp; return inp;
    };
    const table = K.el('table', {},
      K.el('tr', {}, K.el('th', {}, ''), K.el('th', {}, 'Human: yes'), K.el('th', {}, 'Human: no')),
      K.el('tr', {}, K.el('th', {}, 'Judge: yes'), K.el('td', {}, mk('yy', 'both yes')), K.el('td', {}, mk('yn', 'judge yes, human no'))),
      K.el('tr', {}, K.el('th', {}, 'Judge: no'), K.el('td', {}, mk('ny', 'judge no, human yes')), K.el('td', {}, mk('nn', 'both no'))));
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = o => { Object.assign(st, o); for (const k in cells) cells[k].value = st[k]; render(); };
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: 90% agreement, kappa below 0', () => set({ yy: 90, yn: 5, ny: 5, nn: 0 })),
      btn('Perfect agreement', () => set({ yy: 50, yn: 0, ny: 0, nn: 50 })),
      btn('Judge flips a coin', () => set({ yy: 25, yn: 25, ny: 25, nn: 25 })));
    const bars = K.el('div', {});
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(table, presets, bars, res.node, formula, note);

    const bar = (lab, v, col) => K.el('div', { class: 'row', style: 'margin:4px 0;gap:8px;flex-wrap:nowrap' },
      K.el('span', { style: 'width:130px;font-size:13px;color:var(--muted)' }, lab),
      K.el('div', { style: 'flex:1;background:var(--panel2);border-radius:4px;height:14px' },
        K.el('div', { style: `width:${Math.max(0, Math.min(1, v)) * 100}%;background:${col};height:14px;border-radius:4px;transition:width .3s` })),
      K.el('span', { class: 'num', style: 'width:48px;text-align:right' }, K.fmt(v, 3)));

    function render() {
      const n = st.yy + st.yn + st.ny + st.nn;
      bars.replaceChildren();
      if (n <= 0) { formula.textContent = 'Enter at least one item.'; return; }
      const p = parts(st), k = compute(st);
      bars.append(bar('observed p_o', p.po, 'var(--he)'), bar('by chance p_e', p.pe, 'var(--warn)'), bar('judge says yes', p.jy, 'var(--k12)'), bar('human says yes', p.hy, 'var(--both)'));
      if (Number.isNaN(k)) { res.set(NaN); formula.textContent = `p_e = ${K.fmt(p.pe)}: both raters always give the same label, kappa is undefined.`; note.textContent = ''; return; }
      res.set(k);
      formula.textContent =
        `n = ${n}\np_o = (${st.yy} + ${st.nn}) / ${n} = ${K.fmt(p.po)}\n` +
        `p_e = ${K.fmt(p.jy)} x ${K.fmt(p.hy)} + ${K.fmt(1 - p.jy)} x ${K.fmt(1 - p.hy)} = ${K.fmt(p.pe)}\n` +
        `kappa = (${K.fmt(p.po)} - ${K.fmt(p.pe)}) / (1 - ${K.fmt(p.pe)}) = ${K.fmt(k)}`;
      const lvl = k < 0 ? 'worse than chance' : k < 0.2 ? 'slight' : k < 0.4 ? 'fair' : k < 0.6 ? 'moderate' : k < 0.8 ? 'substantial' : 'almost perfect';
      note.textContent = `Landis-Koch label (a convention, not a law): ${lvl}.` +
        (p.po > 0.8 && k < 0.4 ? ' High raw agreement but low kappa: one label dominates, so chance already explains most of it.' : '') +
        (n < 100 ? ` Only ${n} items: kappa from a sample this small is noisy (aim for about 100 or more).` : '');
      note.className = 'hint' + (p.po > 0.8 && k < 0.4 ? ' bad' : '');
    }
    render();
  }

  /* ---- Real example: two LLM judges on the same 140 claims (pack _real-examples/metrics/cohens_kappa.json) ---- */
  const CLS = ['supported', 'unsupported', 'contradicted'], SHORT = { supported: 'supp.', unsupported: 'unsupp.', contradicted: 'contr.' };
  /* PURE: k x k matrix (rows = rater 1, cols = rater 2) -> {n, po, pe, kappa} */
  function kappaMatrix(m) {
    const k = m.length; let n = 0, diag = 0; const r = new Array(k).fill(0), c = new Array(k).fill(0);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { n += m[i][j]; r[i] += m[i][j]; c[j] += m[i][j]; if (i === j) diag += m[i][j]; }
    if (n <= 0) return { n, po: NaN, pe: NaN, kappa: NaN };
    let pe = 0; for (let i = 0; i < k; i++) pe += (r[i] / n) * (c[i] / n);
    const po = diag / n;
    return { n, po, pe, kappa: pe >= 1 ? NaN : (po - pe) / (1 - pe), r, c };
  }
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('metrics/cohens_kappa.json'), get('answers/claims.json')]).then(a => {
      const claims = {}; a[1].forEach(r => { claims[r.qid + '_' + r.arm] = r.claims; });
      return { m: a[0], claims };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit, M = D.m;
    const mat = CLS.map(a => CLS.map(b => M.confusion_judgeA_rows_judgeB_cols[a][b]));
    const st = { cell: null, pos: 'contradicted' };
    const shell = K.shell(el, 'Real example: two LLM judges on the same 140 claims',
      'This is LLM vs LLM agreement, not human agreement: the pack has no human labels. Judge A (' + M.judge_A + ') and judge B (' + M.judge_B + ') labelled the same claims from 12 answers (n = 12 questions, 3 arms, one run, temperature 0). Kappa here says the two judges are consistent with each other; it does not say either is right. A demo, not a benchmark.');
    const tbl = K.el('div', { style: 'overflow-x:auto' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', style: 'white-space:pre-wrap', 'aria-live': 'polite' });
    const bin = K.el('div', {}); const binBar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'class to collapse to' });
    const list = K.el('div', { 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    shell.append(K.el('p', { class: 'hint' }, 'Rows = judge A, columns = judge B. (supp. = supported, unsupp. = unsupported, contr. = contradicted.) Click a cell to list its claims (green = agree, red = disagree).'),
      tbl, res.node, formula, K.el('h4', {}, 'Binary collapse: one class vs the rest'), binBar, bin, list, note);

    function render() {
      const g = kappaMatrix(mat);
      const head = K.el('tr', {}, K.el('th', {}, 'A \\ B'), ...CLS.map(c => K.el('th', { title: c }, SHORT[c])), K.el('th', {}, 'total'));
      const rows = CLS.map((a, i) => K.el('tr', {}, K.el('th', { title: a }, SHORT[a]),
        ...CLS.map((b, j) => K.el('td', {}, K.el('button', { type: 'button', 'aria-pressed': st.cell && st.cell[0] === i && st.cell[1] === j ? 'true' : 'false',
          'aria-label': 'judge A ' + a + ', judge B ' + b + ': ' + mat[i][j] + ' claims',
          style: 'min-width:40px;padding:4px 6px;border:3px solid ' + (i === j ? 'var(--he)' : 'var(--warn)'),
          onclick: () => { st.cell = [i, j]; render(); } }, String(mat[i][j])))),
        K.el('td', { class: 'num' }, String(g.r[i]))));
      const foot = K.el('tr', {}, K.el('th', {}, 'col total'), ...g.c.map(x => K.el('td', { class: 'num' }, String(x))), K.el('td', { class: 'num' }, String(g.n)));
      tbl.replaceChildren(K.el('table', {}, head, ...rows, foot));
      res.set(g.kappa, 3);
      const diag = mat.map((r, i) => r[i]);
      formula.textContent = `n = ${g.n}\np_o = (${diag.join(' + ')}) / ${g.n} = ${K.fmt(g.po)}\n` +
        `p_e = ${CLS.map((c, i) => `${K.fmt(g.r[i] / g.n)} x ${K.fmt(g.c[i] / g.n)}`).join(' + ')} = ${K.fmt(g.pe)}\n` +
        `kappa = (${K.fmt(g.po)} - ${K.fmt(g.pe)}) / (1 - ${K.fmt(g.pe)}) = ${K.fmt(g.kappa)}   (pack: ${M.kappa_3class}, agreement ${M.observed_agreement})`;

      binBar.replaceChildren(...CLS.map(c => K.el('button', { type: 'button', 'aria-pressed': c === st.pos ? 'true' : 'false', onclick: () => { st.pos = c; render(); } }, c + ' vs rest')));
      const p = CLS.indexOf(st.pos);
      const a = mat[p][p], b = g.r[p] - a, c2 = g.c[p] - a, d = g.n - a - b - c2;
      const bk = kappaMatrix([[a, b], [c2, d]]);
      bin.replaceChildren(K.el('div', { class: 'formula', style: 'white-space:pre-wrap' },
        `${st.pos}: both ${a}, A only ${b}, B only ${c2}, neither ${d}\nagreement ${K.fmt(bk.po)}, kappa ${K.fmt(bk.kappa)}   (judge A labelled ${g.r[p]}, judge B ${g.c[p]})`));
      const rare = g.r[p] < 20 || g.c[p] < 20;
      bin.append(K.el('p', { class: 'hint' + (rare ? ' bad' : '') }, rare
        ? 'Rare class: only ' + g.r[p] + ' and ' + g.c[p] + ' labels. Agreement is high (' + K.fmt(bk.po, 2) + ') but kappa is ' + K.fmt(bk.kappa, 2) + ' and unstable: one or two claims move it a lot. Do not read it as a finding.'
        : 'Common class, enough labels for kappa to be steadier.'));

      list.replaceChildren();
      if (st.cell) {
        const [i, j] = st.cell;
        const items = M.claim_pairs.filter(x => x.judgeA === CLS[i] && x.judgeB === CLS[j]);
        list.append(K.el('p', { class: 'hint' }, 'Judge A ' + CLS[i] + ' / judge B ' + CLS[j] + ': ' + items.length + ' claims' + (items.length > 12 ? ' (first 12 shown)' : '') + '.'));
        items.slice(0, 12).forEach(x => list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid ' + (i === j ? 'var(--he)' : 'var(--warn)') },
          K.el('b', {}, x.qid + '/' + x.arm + '#' + x.claim_index + ' '), K.el('span', { class: 'hint' }, (D.claims[x.qid + '_' + x.arm] || [])[x.claim_index] || ''))));
      }
      note.textContent = 'Agreement ' + K.fmt(g.po, 2) + ' looks strong; kappa ' + K.fmt(g.kappa, 2) + ' discounts chance (most claims are "supported", so chance alone already gives p_e ' + K.fmt(g.pe, 2) + '). Of the ' + (g.n - diag.reduce((x, y) => x + y, 0)) + ' disagreements, most are supported vs unsupported or judge B calling a claim contradicted that judge A called supported. Not human labels.';
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['cohens_kappa'] = api;
})(this);
