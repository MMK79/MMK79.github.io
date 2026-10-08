/* MRR demo: four queries, each a ranked list. Click a box to make it the relevant one (click again to clear),
   drag the lists' relevant item with the slider, watch 1/rank and the mean move. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    firstRanks: [1, 3, null, 2],   // 1-based rank of the first relevant item per query; null = not found
  };

  /* PURE: MRR = (1/|Q|) * sum 1/rank_q  (0 for a miss) */
  function compute(inp) {
    const r = inp.firstRanks;
    return r.reduce((s, x) => s + (x ? 1 / x : 0), 0) / r.length;
  }

  function mountToy(el) {
    const K = root.DemoKit, LEN = 10;
    const st = { r: defaults.firstRanks.slice(), n: 4 };
    const shell = K.shell(el, 'Toy example (break it)',
      'Click a box to mark the first relevant passage for that query (click it again for "not found"). Watch 1/rank shrink as it slides down.');
    const area = K.el('div'), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.r = defaults.firstRanks.slice(); render(); }),
      btn('Break it: relevant at 1, 2, 5, 10', () => { st.r = [1, 2, 5, 10]; render(); }),
      btn('Perfect', () => { st.r = [1, 1, 1, 1]; render(); }),
      btn('All missed', () => { st.r = [null, null, null, null]; render(); }));
    shell.append(presets, area, res.node, formula, note);

    function render() {
      area.replaceChildren();
      st.r.forEach((f, qi) => {
        const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'query ' + (qi + 1) });
        for (let k = 1; k <= LEN; k++) {
          const on = f === k;
          strip.append(K.el('button', {
            type: 'button', 'aria-pressed': on ? 'true' : 'false',
            title: 'rank ' + k + (on ? ' (first relevant)' : ''),
            style: 'min-width:34px;' + (on ? 'border-color:var(--he);color:var(--he);background:rgba(60,199,180,.2)' : ''),
            onclick: () => { st.r[qi] = on ? null : k; render(); },
          }, String(k)));
        }
        const rr = f ? 1 / f : 0, w = Math.round(rr * 100);
        const bar = K.el('span', { style: `display:inline-block;height:10px;width:${w}px;background:var(--ai,#F2A93B);vertical-align:middle;margin-right:6px` });
        strip.append(K.el('span', { class: 'num' }, bar, f ? `1/${f} = ${K.fmt(rr)}` : 'not found = 0'));
        area.append(K.el('div', {}, K.el('p', { class: 'hint' }, 'Query ' + (qi + 1)), strip));
      });
      const terms = st.r.map(f => f ? `1/${f}` : '0').join(' + ');
      const m = compute({ firstRanks: st.r });
      res.set(m, 4);
      formula.textContent = `MRR = (${terms}) / ${st.r.length} = ${K.fmt(m, 4)}`;
      const found = st.r.filter(Boolean).length;
      note.textContent = found < st.r.length
        ? `${st.r.length - found} query(ies) with no relevant hit add 0 but still count in the denominator.`
        : 'Only the first relevant hit counts: a second or third relevant passage would change nothing here.';
      note.className = 'hint' + (found < st.r.length ? ' bad' : '');
    }
    render();
  }

  /* ---- Real example: self-contained loader (pack: Presentations/_real-examples) ---- */
  const METHODS = ['bm25_lucene', 'bm25_original', 'tfidf_cosine', 'dense_cosine', 'dense_dot', 'dense_l2',
    'rrf_bm25_dense', 'convex_bm25_dense', 'mmr_dense', 'rerank_ce_bm25', 'rerank_ce_dense', 'rerank_ce_rrf', 'maxsim_minilm'];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('data/corpus.json'), get('runs/metrics_by_method.json')]
      .concat(METHODS.map(m => get('runs/' + m + '.json')))).then(a => {
      const runs = {};
      METHODS.forEach((m, i) => { runs[m] = {}; a[3 + i].questions.forEach(q => { runs[m][q.qid] = q.ranking.map(x => x.id); }); });
      const corpus = a[1].passages || a[1];
      const text = {}; (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      return { questions: a[0].filter(q => q.gold_passages.length), text, stored: a[2], runs };
    });
    return realData;
  }
  /* pure: 1-based rank of the first gold id in a stored top-20 ranking, or null */
  function firstRank(ranking, gold) {
    const g = new Set(gold), i = ranking.findIndex(d => g.has(d));
    return i < 0 ? null : i + 1;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'bm25_lucene', q: D.questions[0].id, drop: new Set() };
    const shell = K.shell(el, 'Real example: MRR on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. Questions written by Claude, gold = passages judged necessary. A gold passage outside the stored top-20 counts as 0. With n=20, one question moves MRR by about 0.05: tick "drop" boxes to see it.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => opt(m, m)));
    mSel.value = st.m;
    mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    const rows = K.el('div'), detail = K.el('div', { 'aria-live': 'polite' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const meanBox = K.el('p', { class: 'hint' }), noise = K.el('p', { class: 'hint' }), tbl = K.el('div');
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)),
      K.el('div', { class: 'row' }, btn('Drop the most influential question', () => {
        const rr = D.questions.map(q => { const f = firstRank(D.runs[st.m][q.id], q.gold_passages); return [q.id, f ? 1 / f : 0]; });
        const n = rr.length, tot = rr.reduce((s, x) => s + x[1], 0), mean = tot / n;
        let best = rr[0], gap = -1;
        rr.forEach(x => { const d = Math.abs((tot - x[1]) / (n - 1) - mean); if (d > gap) { gap = d; best = x; } });
        st.drop = new Set([best[0]]); render();
      }), btn('Restore all 20', () => { st.drop = new Set(); render(); })),
      rows, detail, res.node, formula, meanBox, noise, tbl);

    const rrOf = (m, q) => { const f = firstRank(D.runs[m][q.id], q.gold_passages); return f ? 1 / f : 0; };
    const meanFor = (m, skip) => { const qs = D.questions.filter(q => !(skip && skip.has(q.id))); return qs.reduce((s, q) => s + rrOf(m, q), 0) / qs.length; };
    /* range of the mean when any single question is left out */
    const looRange = m => {
      const all = D.questions, n = all.length, tot = all.reduce((s, q) => s + rrOf(m, q), 0);
      const v = all.map(q => (tot - rrOf(m, q)) / (n - 1));
      return [Math.min.apply(null, v), Math.max.apply(null, v)];
    };
    function render() {
      rows.replaceChildren();
      D.questions.forEach(q => {
        const rk = D.runs[st.m][q.id], f = firstRank(rk, q.gold_passages), rr = f ? 1 / f : 0, off = st.drop.has(q.id);
        const bar = K.el('span', { style: `display:inline-block;height:10px;width:${Math.round(rr * 120)}px;background:var(--ai,#F2A93B);vertical-align:middle;margin:0 6px` });
        const cb = K.el('input', { type: 'checkbox', 'aria-label': 'drop ' + q.id, onchange: e => { e.target.checked ? st.drop.add(q.id) : st.drop.delete(q.id); render(); } });
        cb.checked = off;
        const pick = K.el('button', { type: 'button', 'aria-pressed': st.q === q.id ? 'true' : 'false', title: q.question,
          style: 'min-width:140px;text-align:left;' + (st.q === q.id ? 'border-color:var(--he);color:var(--he)' : ''), onclick: () => { st.q = q.id; render(); } }, q.id + ' ' + q.type);
        rows.append(K.el('div', { class: 'row', style: off ? 'opacity:.35' : '' }, cb, pick, bar,
          K.el('span', { class: 'num' }, f ? `1/${f} = ${K.fmt(rr)}` : 'not in top-20 = 0')));
      });
      const q = D.questions.find(x => x.id === st.q), rk = D.runs[st.m][q.id], gold = new Set(q.gold_passages), f = firstRank(rk, q.gold_passages);
      detail.replaceChildren(K.el('p', { class: 'hint' }, `${q.id}: ${q.question}  Gold passage(s): ${q.gold_passages.join(', ')}. First gold at ${f ? 'rank ' + f : 'no rank in the stored top-20'}.`));
      const upto = f || 5;
      rk.slice(0, Math.max(upto, 3)).forEach((id, i) => {
        const hit = gold.has(id);
        detail.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (hit ? '--he' : '--warn') + ')' },
          K.el('b', {}, (i + 1) + '. ' + id + (hit ? '  gold (first hit counts)' : '  not gold') + ' '),
          K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 100) + (D.text[id] && D.text[id].length > 100 ? '...' : ''))));
      });
      const kept = D.questions.filter(x => !st.drop.has(x.id)), m = meanFor(st.m, st.drop);
      res.set(m, 4);
      formula.textContent = `MRR = (sum of 1/rank over ${kept.length} question${kept.length === 1 ? '' : 's'}) / ${kept.length} = ${K.fmt(m, 4)}`;
      const sv = D.stored.methods[st.m] && D.stored.methods[st.m].mrr, full = meanFor(st.m);
      meanBox.textContent = `All ${D.questions.length} questions, ${st.m}: ${K.fmt(full, 4)}` +
        (sv !== undefined ? `; pack's stored MRR ${sv}: ${Math.abs(full - sv) < 5e-5 ? 'MATCH' : 'MISMATCH'}.` : '.');
      const [lo, hi] = looRange(st.m);
      noise.textContent = `Drop any single question and ${st.m} moves anywhere from ${K.fmt(lo, 4)} to ${K.fmt(hi, 4)} (spread ${K.fmt(hi - lo, 3)}). Method gaps smaller than this are noise.`;
      noise.className = 'hint';
      const tr = METHODS.map(x => { const v = meanFor(x), s = D.stored.methods[x] && D.stored.methods[x].mrr, r = looRange(x); return [x, v, s, r]; });
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'method'), K.el('th', { align: 'right' }, 'MRR'), K.el('th', { align: 'right' }, 'stored'), K.el('th', { align: 'right' }, 'drop-one range')),
        tr.map(([x, v, s, r]) => K.el('tr', { style: x === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, x), K.el('td', { align: 'right', class: 'num' }, K.fmt(v, 4)),
          K.el('td', { align: 'right', class: 'num' }, s === undefined ? 'n/a' : String(s)), K.el('td', { align: 'right', class: 'num' }, K.fmt(r[0], 3) + ' to ' + K.fmt(r[1], 3)))));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'Compare all methods (recomputed vs stored; ranges overlap = no clear winner)'), t));
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['mrr'] = api;
})(this);
