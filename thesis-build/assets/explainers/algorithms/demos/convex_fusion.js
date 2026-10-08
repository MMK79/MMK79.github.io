/* Convex fusion: alpha*dense + (1-alpha)*lexical after score normalisation. Edit scores, switch normaliser, move alpha. */
(function (root) {
  const defaults = {
    bm25: [12.4, 9.1, 3.2, 0.0, 6.0],
    cos: [0.41, 0.78, 0.83, 0.55, 0.62],
    alpha: 0.5,
  };
  const NAMES = ['A', 'B', 'C', 'D', 'E'];
  const FLOOR = { bm25: 0, cos: -1 };           // theoretical minimum of each scorer
  const r3 = x => Math.round(x * 1000) / 1000;

  function minmax(s) { const m = Math.min(...s), M = Math.max(...s); return s.map(v => M > m ? (v - m) / (M - m) : 0); }
  function tmm(s, lo) { const M = Math.max(...s); return s.map(v => M > lo ? (v - lo) / (M - lo) : 0); }
  function zscore(s) { const n = s.length, mu = s.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(s.reduce((a, b) => a + (b - mu) ** 2, 0) / n); return s.map(v => sd > 0 ? (v - mu) / sd : 0); }
  const order = (s, names = NAMES) => s.map((v, i) => [Math.round(v * 1e9) / 1e9, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => names[x[1]]);
  const mix = (a, x, y) => x.map((v, i) => a * v + (1 - a) * y[i]);   // x = dense, y = lexical

  function fuse(inp, norm) {
    const a = inp.alpha;
    if (norm === 'none') return mix(a, inp.cos, inp.bm25);
    if (norm === 'minmax') return mix(a, minmax(inp.cos), minmax(inp.bm25));
    if (norm === 'tmm') return mix(a, tmm(inp.cos, FLOOR.cos), tmm(inp.bm25, FLOOR.bm25));
    return mix(a, zscore(inp.cos), zscore(inp.bm25));
  }

  /* PURE: rankings and scores for the raw sum, min-max, theoretical-min; ranking sweep over alpha (min-max). */
  function compute(inp) {
    const names = inp.names || NAMES;
    const obj = s => Object.fromEntries(names.map((n, i) => [n, r3(s[i])]));
    const raw = fuse(inp, 'none'), mm = fuse(inp, 'minmax'), tm = fuse(inp, 'tmm');
    const sweep = {};
    for (const a of [0, 0.25, 0.5, 0.75, 1.0]) sweep[a === 1 ? '1.0' : String(a)] = order(fuse({ ...inp, alpha: a }, 'minmax'), names);
    return { raw_sum_ranking: order(raw, names), minmax_ranking: order(mm, names), tmm_ranking: order(tm, names),
      minmax_scores: obj(mm), tmm_scores: obj(tm), raw_scores: obj(raw), rank_by_alpha: sweep,
      zscore_ranking: order(fuse(inp, 'z'), names) };
  }

  const PRESETS = {
    'worked example (alpha 0.5)': () => JSON.parse(JSON.stringify(defaults)),
    'alpha = 0 (BM25 only)': () => ({ ...JSON.parse(JSON.stringify(defaults)), alpha: 0 }),
    'alpha = 1 (dense only)': () => ({ ...JSON.parse(JSON.stringify(defaults)), alpha: 1 }),
    'break it: one BM25 outlier (D = 40)': () => { const d = JSON.parse(JSON.stringify(defaults)); d.bm25[3] = 40; return d; },
  };
  const NORMS = [['none', 'no normalisation'], ['minmax', 'min-max'], ['tmm', 'theoretical min'], ['z', 'z-score']];

  /* ---- real example: pack at Presentations/_real-examples (fetched relative to this script) ---- */
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const byQ = r => Object.fromEntries(r.questions.map(x => [x.qid, x.ranking]));
  /* PURE: one real question -> compute() input. Candidates = union of the two stored top-20 lists;
     a passage missing from one list gets that list's lowest stored score (upper bound; real score unknown). */
  function realInput(qid, pack, alpha) {
    const b = pack.bm25[qid], d = pack.dense[qid];
    const bm = Object.fromEntries(b.map(x => [x.id, x.score])), dm = Object.fromEntries(d.map(x => [x.id, x.score]));
    const lb = Math.min(...b.map(x => x.score)), ld = Math.min(...d.map(x => x.score));
    const names = [...new Set([...b.map(x => x.id), ...d.map(x => x.id)])];
    return { names, bm25: names.map(n => n in bm ? bm[n] : lb), cos: names.map(n => n in dm ? dm[n] : ld), alpha: alpha ?? 0.5,
      missingBm25: names.filter(n => !(n in bm)), missingCos: names.filter(n => !(n in dm)) };
  }
  function loadPack() {
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    return Promise.all([get('data/questions.json'), get('data/corpus.json'), get('runs/bm25_lucene.json'), get('runs/dense_cosine.json'), get('runs/convex_bm25_dense.json')])
      .then(([questions, corpus, b, d, c]) => ({ questions, corpus: Array.isArray(corpus) ? corpus : (corpus.passages || Object.values(corpus)), bm25: byQ(b), dense: byQ(d), convex: byQ(c) }));
  }

  function mount(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults)), norm = 'minmax';
    K.shell(el, 'Convex fusion: weighted score combination',
      'Dense (cosine) and lexical (BM25) scores live on different scales. Pick a normaliser, move alpha, edit a score. Then press "break it".');
    const shell = el.lastChild;
    const cells = {};
    const tbl = K.el('table', { style: 'font-size:12px' });
    tbl.append(K.el('tr', {}, ...['', 'BM25', 'cosine', 'BM25 norm', 'cos norm', 'fused', 'rank'].map(h => K.el('th', { style: 'padding:4px 3px;font-size:12px' }, h))));
    const numIn = (arr, i, step, label) => {
      const inp = K.el('input', { type: 'number', step, value: arr()[i], 'aria-label': label, style: 'width:54px;padding:2px;font-size:12px' });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { arr()[i] = v; render(false); } });
      return inp;
    };
    NAMES.forEach((nm, i) => {
      const td = () => K.el('td', { class: 'num', style: 'padding:4px 3px' });
      const c = { b: K.el('td', {}, numIn(() => st.bm25, i, '0.1', `BM25 score of ${nm}`)), s: K.el('td', {}, numIn(() => st.cos, i, '0.01', `cosine score of ${nm}`)), nb: td(), ns: td(), f: td(), r: td() };
      cells[i] = c; tbl.append(K.el('tr', {}, K.el('td', { style: 'font-weight:600' }, nm), c.b, c.s, c.nb, c.ns, c.f, c.r));
    });
    const aS = K.slider('alpha', 0, 1, 0.05, st.alpha, v => { st.alpha = v; render(true); });
    const normRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'normaliser' });
    const normBtns = NORMS.map(([k, t]) => { const b = K.el('button', { 'aria-pressed': 'false' }, t); b.addEventListener('click', () => { norm = k; render(true); }); normRow.append(b); return [k, b]; });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n); b.addEventListener('click', () => { st = PRESETS[n](); aS.set(st.alpha); render(true); }); return b; }));
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const bars = K.el('div', {});
    const sweep = K.el('div', { class: 'num', style: 'font-size:12px;white-space:pre-line' });
    const formula = K.el('div', { class: 'formula' });
    const toyBox = K.el('div', {}), realBox = K.el('div', {});
    const modeRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const mReal = K.el('button', {}, 'Real example'), mToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(mReal, mToy);
    toyBox.append(presets, normRow, K.el('div', { class: 'row' }, aS.node), K.el('div', { style: 'overflow-x:auto' }, tbl), verdict, bars, sweep, formula);
    shell.append(modeRow, realBox, toyBox);
    function setMode(m) { const real = m === 'real'; realBox.style.display = real ? '' : 'none'; toyBox.style.display = real ? 'none' : ''; mReal.setAttribute('aria-pressed', String(real)); mToy.setAttribute('aria-pressed', String(!real)); mReal.style.outline = real ? '2px solid var(--ai, #F2A93B)' : ''; mToy.style.outline = real ? '' : '2px solid var(--ai, #F2A93B)'; }
    mReal.addEventListener('click', () => setMode('real')); mToy.addEventListener('click', () => setMode('toy'));

    const setCell = (n, t) => { if (n.textContent !== t) { n.textContent = t; if (n.dataset.seen) K.flash(n); n.dataset.seen = 1; } };
    function norms(n) {
      if (n === 'none') return [st.bm25, st.cos];
      if (n === 'minmax') return [minmax(st.bm25), minmax(st.cos)];
      if (n === 'tmm') return [tmm(st.bm25, FLOOR.bm25), tmm(st.cos, FLOOR.cos)];
      return [zscore(st.bm25), zscore(st.cos)];
    }
    function render(sync) {
      const [nb, ns] = norms(norm), f = mix(st.alpha, ns, nb), o = order(f);
      NAMES.forEach((nm, i) => {
        const c = cells[i];
        setCell(c.nb, K.fmt(nb[i], 3)); setCell(c.ns, K.fmt(ns[i], 3)); setCell(c.f, K.fmt(f[i], 3)); setCell(c.r, '#' + (o.indexOf(nm) + 1));
        c.r.classList.toggle('good', o[0] === nm);
        if (sync) { c.b.firstChild.value = st.bm25[i]; c.s.firstChild.value = st.cos[i]; }
      });
      normBtns.forEach(([k, b]) => { b.setAttribute('aria-pressed', String(k === norm)); b.style.outline = k === norm ? '2px solid var(--ai, #F2A93B)' : ''; });
      const oB = order(st.bm25), oC = order(st.cos), j = x => x.join(' > ');
      const copiesB = j(o) === j(oB), copiesC = j(o) === j(oC);
      verdict.replaceChildren(K.el('span', {}, 'BM25 order: ', K.el('b', {}, j(oB)), '   cosine order: ', K.el('b', {}, j(oC)), '   fused: ', K.el('b', { class: 'good' }, j(o))),
        K.el('b', { class: copiesB || copiesC ? 'bad' : 'good' }, copiesB ? (st.alpha > 0 && st.alpha < 1 ? 'the fused list just copies BM25' : 'pure BM25') : copiesC ? (st.alpha > 0 && st.alpha < 1 ? 'the fused list just copies cosine' : 'pure dense') : 'the fused list mixes both'));
      const mx = Math.max(...f.map(Math.abs), 1e-9);
      bars.replaceChildren(...o.map(n => { const v = f[NAMES.indexOf(n)]; return K.el('div', { style: 'display:flex;align-items:center;gap:8px;margin:2px 0' },
        K.el('span', { style: 'width:18px;font-weight:600' }, n),
        K.el('div', { style: `height:12px;border-radius:3px;background:${v < 0 ? 'var(--warn,#FF8A65)' : 'var(--ai,#F2A93B)'};width:${(Math.abs(v) / mx * 70).toFixed(1)}%` }),
        K.el('span', { class: 'num', style: 'color:var(--muted);font-size:12px' }, K.fmt(v, 3))); }));
      const [snb, sns] = norms(norm);
      const sw = [0, 0.25, 0.5, 0.75, 1].map(a => `alpha ${a.toFixed(2)}: ${order(mix(a, sns, snb)).join(' > ')}`);
      sweep.textContent = 'ranking as alpha moves (current normaliser)\n' + sw.join('\n');
      const w = o[0], wi = NAMES.indexOf(w), a = K.fmt(st.alpha, 2);
      formula.textContent = `winner ${w}\nfused = ${a} * ${K.fmt(ns[wi], 3)} + ${K.fmt(1 - st.alpha, 2)} * ${K.fmt(nb[wi], 3)} = ${K.fmt(f[wi], 3)}   (dense part + BM25 part)\n` +
        (norm === 'minmax' ? `min-max: (s - min) / (max - min); BM25 range ${K.fmt(Math.min(...st.bm25), 2)}..${K.fmt(Math.max(...st.bm25), 2)} is used for every BM25 score` : norm === 'tmm' ? 'theoretical min: (s - floor) / (max - floor), floor 0 for BM25, -1 for cosine' : norm === 'z' ? 'z-score: (s - mean) / standard deviation, so scores can be negative' : 'no normalisation: BM25 (0 to 12) outweighs cosine (0.4 to 0.8) at any middle alpha');
    }
    render(true);
    setMode('toy');
    /* ---------- real example ---------- */
    setMode('real');
    realBox.append(K.el('p', { class: 'hint' }, 'Loading the real-example pack ...'));
    loadPack().then(pack => {
      const ans = pack.questions.filter(q => q.type !== 'unanswerable' && q.gold_passages.length);
      let rq = ans.find(q => q.id === 'q02') || ans[0], ra = 0.5, rn = 'minmax';
      const text = Object.fromEntries(pack.corpus.map(p => [p.id, p]));
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%' }, ...ans.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question}`)));
      sel.value = rq.id; sel.addEventListener('change', () => { rq = ans.find(q => q.id === sel.value); rrender(); });
      const ras = K.slider('alpha', 0, 1, 0.05, ra, v => { ra = v; rrender(); });
      const rnorm = K.el('div', { class: 'row', role: 'group', 'aria-label': 'normaliser' });
      const rb = NORMS.map(([k, t]) => { const b = K.el('button', {}, t); b.addEventListener('click', () => { rn = k; rrender(); }); rnorm.append(b); return [k, b]; });
      const info = K.el('div', { class: 'row', 'aria-live': 'polite' }), rtbl = K.el('table', { style: 'font-size:12px;width:100%' }), gold = K.el('div', { class: 'formula' }), cav = K.el('p', { class: 'hint' });
      cav.textContent = 'Real data: 138 Wikipedia passages (CC BY-SA 4.0), 24 questions written by Claude, BM25 (Lucene idf) and all-MiniLM-L6-v2 cosine. Demo scale, n = 20 answerable questions: one question moves MRR by about 0.05, so gaps between methods are inside the noise. alpha = 0.5 was not tuned. The pack stores only the top 20 of each list, so a passage missing from one list gets that list\'s 20th stored score (an upper bound; the true score is lower). Min-max here runs over the union of the two top-20 lists, not over all 138 passages as in the pack\'s own convex run; that difference is itself the candidate-set blind spot.';
      realBox.replaceChildren(K.el('p', { class: 'hint' }, 'Pick a real question. BM25 scores (about 0 to 13) and cosine (about 0.2 to 0.7) are real; choose a normaliser and move alpha to see the gold passage move.'),
        sel, rnorm, K.el('div', { class: 'row' }, ras.node), info, K.el('div', { style: 'overflow-x:auto' }, rtbl), gold, cav);
      function rrender() {
        const inp = realInput(rq.id, pack, ra), [nb, ns] = (() => { const x = { ...inp }; return rn === 'none' ? [x.bm25, x.cos] : rn === 'minmax' ? [minmax(x.bm25), minmax(x.cos)] : rn === 'tmm' ? [tmm(x.bm25, FLOOR.bm25), tmm(x.cos, FLOOR.cos)] : [zscore(x.bm25), zscore(x.cos)]; })();
        const f = mix(ra, ns, nb), o = order(f, inp.names), G = rq.gold_passages;
        const rk = (list, g) => { const i = list.findIndex(x => g.includes(x)); return i < 0 ? '>20' : '#' + (i + 1); };
        const ob = inp.names.slice().sort((a, b) => inp.bm25[inp.names.indexOf(b)] - inp.bm25[inp.names.indexOf(a)]), od = inp.names.slice().sort((a, b) => inp.cos[inp.names.indexOf(b)] - inp.cos[inp.names.indexOf(a)]);
        const packRank = rk(pack.convex[rq.id].map(x => x.id), G);
        info.replaceChildren(K.el('span', {}, 'gold passage(s): ', K.el('b', { class: 'good' }, G.join(', ')), `   BM25 rank ${rk(ob, G)}   cosine rank ${rk(od, G)}   fused (this view) `, K.el('b', {}, rk(o, G)), `   pack convex run (alpha 0.5, min-max over 138): ${packRank}   candidates: ${inp.names.length}`));
        rb.forEach(([k, b]) => { b.style.outline = k === rn ? '2px solid var(--ai, #F2A93B)' : ''; b.setAttribute('aria-pressed', String(k === rn)); });
        const rows = [K.el('tr', {}, ...['rank', 'passage', 'BM25', 'cosine', 'BM25 norm', 'cos norm', 'fused'].map(h => K.el('th', { style: 'padding:3px;font-size:12px' }, h)))];
        o.slice(0, 8).forEach((id, j) => { const i = inp.names.indexOf(id), gd = G.includes(id), t = text[id];
          const mb = inp.missingBm25.includes(id), mc = inp.missingCos.includes(id);
          rows.push(K.el('tr', { title: t ? `${t.article}: ${t.text.slice(0, 160)}...` : id },
            K.el('td', { class: 'num' }, '#' + (j + 1)), K.el('td', { class: gd ? 'good' : '', style: 'font-weight:600' }, id + (gd ? ' (gold)' : '')),
            K.el('td', { class: 'num' }, K.fmt(inp.bm25[i], 2) + (mb ? '*' : '')), K.el('td', { class: 'num' }, K.fmt(inp.cos[i], 3) + (mc ? '*' : '')),
            K.el('td', { class: 'num' }, K.fmt(nb[i], 3)), K.el('td', { class: 'num' }, K.fmt(ns[i], 3)), K.el('td', { class: 'num' }, K.fmt(f[i], 3)))); });
        rtbl.replaceChildren(...rows);
        const gi = o.findIndex(x => G.includes(x)), gid = gi < 0 ? null : o[gi];
        const top = text[o[0]];
        gold.textContent = `question: ${rq.question}\ngold answer: ${rq.gold_answer}\n` + (gid ? `best gold passage ${gid} is at #${gi + 1}: fused = ${K.fmt(ra, 2)} * ${K.fmt(ns[inp.names.indexOf(gid)], 3)} + ${K.fmt(1 - ra, 2)} * ${K.fmt(nb[inp.names.indexOf(gid)], 3)} = ${K.fmt(f[inp.names.indexOf(gid)], 3)}\n` : '') +
          `top passage ${o[0]}${top ? ' (' + top.article + ')' : ''}\n* = not in that list's top 20: filled with the 20th stored score`;
        K.flash(info);
      }
      rrender();
    }).catch(e => { realBox.replaceChildren(K.el('p', { class: 'bad' }, 'Could not load the real-example pack (' + e.message + '). Showing the toy example.')); setMode('toy'); });
  }

  const api = { defaults, compute, mount, realInput };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['convex_fusion'] = api;
})(this);
