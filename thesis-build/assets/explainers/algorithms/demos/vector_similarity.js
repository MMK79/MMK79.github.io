/* Vector similarity: cosine, dot product, L2.
   Real example (default): real all-MiniLM-L6-v2 vectors (384-d, final normalisation layer removed): 24 questions ranked by three measures + 6 real sentences, raw vs normalised.
   Toy example (break it): 2-D arrows you drag. */
(function (root) {
  const defaults = {
    q: [0.8, 0.6],
    docs: [[0.6, 0.8], [2.4, 1.8], [2.4, 0]],
    normalise: false,
  };
  const NAMES = ['A', 'B', 'C'];
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const len = a => Math.sqrt(dot(a, a));
  const unit = a => { const n = len(a); return n === 0 ? [0, 0] : [a[0] / n, a[1] / n]; };

  /* PURE: returns {cosine:[..], dot:[..], l2:[..]}, one entry per chunk, in input order.
     normalise = scale every vector to length 1 first. A zero vector has no direction: cosine is reported as 0. */
  function compute(inp) {
    const prep = v => (inp.normalise ? unit(v) : v);
    const q = prep(inp.q), docs = inp.docs.map(prep);
    return {
      cosine: docs.map(d => { const n = len(q) * len(d); return n === 0 ? 0 : dot(q, d) / n; }),
      dot: docs.map(d => dot(q, d)),
      l2: docs.map(d => Math.hypot(q[0] - d[0], q[1] - d[1])),
    };
  }

  /* ranks (1 = best) for each metric; L2 ranks ascending */
  function ranks(res) {
    const rk = (arr, asc) => arr.map((v, i) => 1 + arr.filter(w => (asc ? w < v - 1e-9 : w > v + 1e-9)).length);
    return { cosine: rk(res.cosine), dot: rk(res.dot), l2: rk(res.l2, true) };
  }

  const PRESETS = {
    'worked example': { q: [0.8, 0.6], docs: [[0.6, 0.8], [2.4, 1.8], [2.4, 0]], normalise: false },
    'agree (normalised)': { q: [0.8, 0.6], docs: [[0.6, 0.8], [2.4, 1.8], [2.4, 0]], normalise: true },
    'break it: long beats well-aimed': { q: [0.8, 0.6], docs: [[0.64, 0.77], [-0.3, 0.2], [2.3, 0.4]], normalise: false },
  };

  function mountToy(el) {
    const K = DemoKit, S = 78, C = 200, LIM = 2.5;              // svg: 400x400, 78 px per unit, origin at centre
    const COL = { q: 'var(--ai)', 0: 'var(--he)', 1: 'var(--k12)', 2: 'var(--both)' };
    let st = JSON.parse(JSON.stringify(defaults)), sel = 1;
    const shell = K.shell(el, 'Cosine, dot product and L2',
      'Drag the arrow tips (or type numbers, or focus a tip and use the arrow keys). Then switch "normalise" on and watch the three rankings agree.');

    const X = x => C + x * S, Y = y => C - y * S;
    const svg = K.svg('svg', { viewBox: '0 0 400 400', width: '100%', style: 'max-width:420px;touch-action:none;background:var(--panel2);border-radius:8px', role: 'img',
      'aria-label': 'Two-dimensional plane with the query arrow and three chunk arrows' });
    svg.append(K.svg('defs'));
    const grid = K.svg('g'); svg.append(grid);
    for (let i = -2; i <= 2; i++) {
      grid.append(K.svg('line', { x1: X(i), y1: 0, x2: X(i), y2: 400, stroke: i ? 'var(--line)' : 'var(--faint)', 'stroke-width': i ? 1 : 1.5 }));
      grid.append(K.svg('line', { x1: 0, y1: Y(i), x2: 400, y2: Y(i), stroke: i ? 'var(--line)' : 'var(--faint)', 'stroke-width': i ? 1 : 1.5 }));
    }
    grid.append(K.svg('circle', { cx: C, cy: C, r: S, fill: 'none', stroke: 'var(--faint)', 'stroke-dasharray': '4 4' }));
    grid.append(K.svg('text', { x: X(0.1), y: Y(-1.1), style: 'fill:var(--faint);font-size:11px' }, 'length 1'));
    const layer = K.svg('g'); svg.append(layer);

    function arrow(v, color, w) {
      const g = K.svg('g'), x2 = X(v[0]), y2 = Y(v[1]), n = len(v) * S || 1, ux = (v[0] * S) / n, uy = -(v[1] * S) / n;
      const bx = x2 - ux * 10, by = y2 - uy * 10;
      g.append(K.svg('line', { x1: C, y1: C, x2: bx, y2: by, stroke: color, 'stroke-width': w }));
      g.append(K.svg('polygon', { points: `${x2},${y2} ${bx - uy * 5},${by + ux * 5} ${bx + uy * 5},${by - ux * 5}`, fill: color }));
      return g;
    }

    /* inputs table */
    const names = ['q', ...NAMES];
    const vec = i => (i === 0 ? st.q : st.docs[i - 1]);
    const numIn = (i, k) => {
      const inp = K.el('input', { type: 'number', step: '0.1', value: vec(i)[k], 'aria-label': `${names[i]} ${k ? 'y' : 'x'}`, style: 'width:58px' });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { vec(i)[k] = Math.max(-LIM, Math.min(LIM, v)); render(false); } });
      return inp;
    };
    const cells = {};                                            // result cells for flash
    const tbl = K.el('table', {});
    tbl.append(K.el('tr', {}, ...['vector', 'x', 'y', 'length', 'cosine', 'dot', 'L2 distance'].map(h => K.el('th', {}, h))));
    const rows = names.map((nm, i) => {
      const r = K.el('tr', { style: i ? 'cursor:pointer' : '' });
      const nameCell = K.el('td', { style: `color:${COL[i === 0 ? 'q' : i - 1]};font-weight:600` }, i ? nm : 'q');
      const xi = K.el('td', {}, numIn(i, 0)), yi = K.el('td', {}, numIn(i, 1));
      const L = K.el('td', { class: 'num' }), c = K.el('td', { class: 'num' }), d = K.el('td', { class: 'num' }), l = K.el('td', { class: 'num' });
      r.append(nameCell, xi, yi, L, c, d, l);
      if (i) r.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { sel = i - 1; render(false); } });
      cells[i] = { L, c, d, l, xi, yi };
      tbl.append(r); return r;
    });
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const formula = K.el('div', { class: 'formula' });
    const norm = K.el('button', { 'aria-pressed': 'false' }, 'normalise all vectors to length 1');
    norm.addEventListener('click', () => { st.normalise = !st.normalise; render(true); });
    const presetRow = K.el('div', { class: 'row' }, norm,
      ...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = JSON.parse(JSON.stringify(PRESETS[k])); render(true); }); return b; }));

    const wrap = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start' },
      K.el('div', { style: 'flex:1 1 300px;min-width:260px' }, svg),
      K.el('div', { style: 'flex:2 1 320px;min-width:280px;overflow-x:auto' }, presetRow, tbl, verdict, formula));
    shell.append(wrap);

    /* dragging */
    let drag = null;
    const pt = e => { const r = svg.getBoundingClientRect(), k = 400 / r.width; return [((e.clientX - r.left) * k - C) / S, -((e.clientY - r.top) * k - C) / S]; };
    const clamp = v => v.map(x => Math.max(-LIM, Math.min(LIM, Math.round(x * 100) / 100)));
    svg.addEventListener('pointermove', e => { if (drag === null) return; const p = clamp(pt(e)); (drag === 0 ? st.q : st.docs[drag - 1]).splice(0, 2, ...p); render(false); });
    const up = () => { drag = null; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);

    let last = {};
    function setCell(node, text) { if (node.textContent !== text) { node.textContent = text; if (node.dataset.seen) K.flash(node); node.dataset.seen = 1; } }

    function render(syncInputs) {
      const res = compute(st), rk = ranks(res), show = v => (st.normalise ? unit(v) : v);
      norm.setAttribute('aria-pressed', String(st.normalise)); norm.classList.toggle('on', st.normalise);
      layer.replaceChildren();
      // selected chunk: angle wedge + distance segment
      const q = show(st.q), d = show(st.docs[sel]);
      layer.append(K.svg('line', { x1: X(q[0]), y1: Y(q[1]), x2: X(d[0]), y2: Y(d[1]), stroke: 'var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
      const a0 = Math.atan2(q[1], q[0]), a1 = Math.atan2(d[1], d[0]), r = 30;
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (len(q) && len(d)) layer.append(K.svg('path', { d: `M ${X(0) + r * Math.cos(a0)} ${Y(0) - r * Math.sin(a0)} A ${r} ${r} 0 0 ${da > 0 ? 0 : 1} ${X(0) + r * Math.cos(a0 + da)} ${Y(0) - r * Math.sin(a0 + da)}`, fill: 'none', stroke: 'var(--ai)', 'stroke-width': 2 }));
      if (st.normalise) st.docs.concat([st.q]).forEach(v => layer.append(K.svg('line', { x1: C, y1: C, x2: X(v[0]), y2: Y(v[1]), stroke: 'var(--faint)', 'stroke-width': 1, 'stroke-dasharray': '2 4' })));
      st.docs.forEach((v, i) => layer.append(arrow(show(v), COL[i], i === sel ? 4 : 2.5)));
      layer.append(arrow(show(st.q), COL.q, 4));
      names.forEach((nm, i) => {
        const raw = vec(i), p = show(raw), color = COL[i === 0 ? 'q' : i - 1];
        const h = K.svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 11, fill: color, 'fill-opacity': 0.25, stroke: color, 'stroke-width': 2, tabindex: 0, role: 'slider', 'aria-label': `${nm === 'q' ? 'query' : 'chunk ' + nm} tip, x ${p[0].toFixed(2)} y ${p[1].toFixed(2)}`, style: 'cursor:grab;outline:none' });
        h.addEventListener('pointerdown', e => { drag = i; if (i) sel = i - 1; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
        h.addEventListener('keydown', e => {
          const s = e.shiftKey ? 0.25 : 0.05, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
          if (!m) return; e.preventDefault(); const v = vec(i); const n = clamp([v[0] + m[0], v[1] + m[1]]); v[0] = n[0]; v[1] = n[1]; render(true);
          const again = layer.querySelectorAll('circle')[i]; if (again) again.focus();
        });
        layer.append(h); layer.append(K.svg('text', { x: X(p[0]) + 14, y: Y(p[1]) - 10, style: `fill:${color};font-weight:600;font-size:13px` }, i ? nm : 'q'));
      });
      // table
      cells[0].L.textContent = K.fmt(len(show(st.q)), 3);
      st.docs.forEach((v, i) => {
        const c = cells[i + 1], p = show(v);
        setCell(c.L, K.fmt(len(p), 3));
        [['c', 'cosine', 3], ['d', 'dot', 3], ['l', 'l2', 3]].forEach(([cell, key]) => {
          const best = rk[key][i] === 1;
          setCell(c[cell], `${K.fmt(res[key][i], 3)}  #${rk[key][i]}`);
          c[cell].classList.toggle('good', best);
        });
      });
      if (syncInputs) names.forEach((nm, i) => { ['xi', 'yi'].forEach((k, j) => { const inp = cells[i][k].firstChild; if (document.activeElement !== inp) inp.value = vec(i)[j]; }); });
      rows.forEach((r, i) => { r.style.background = i && i - 1 === sel ? 'var(--panel2)' : ''; });
      // verdict
      const order = key => rk[key].map((r, i) => [r, NAMES[i]]).sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' > ');
      const same = order('cosine') === order('dot') && order('dot') === order('l2');
      verdict.replaceChildren(
        K.el('span', {}, 'order by cosine: ', K.el('b', {}, order('cosine')), '   by dot: ', K.el('b', {}, order('dot')), '   by L2 (nearest first): ', K.el('b', {}, order('l2'))),
        K.el('b', { class: same ? 'good' : 'bad' }, same ? 'all three agree' : 'they disagree'));
      // formula with live numbers for the selected chunk
      const f = x => K.fmt(x, 3), qq = show(st.q), dd = show(st.docs[sel]);
      const nm = NAMES[sel], lq = len(qq), ld = len(dd);
      formula.textContent =
        `chunk ${nm} (click a row to choose)\n` +
        `dot    q.d = ${f(qq[0])}*${f(dd[0])} + ${f(qq[1])}*${f(dd[1])} = ${f(res.dot[sel])}\n` +
        `cosine q.d / (|q| |d|) = ${f(res.dot[sel])} / (${f(lq)} * ${f(ld)}) = ${f(res.cosine[sel])}   (angle ${f(Math.acos(Math.max(-1, Math.min(1, res.cosine[sel]))) * 180 / Math.PI)} deg)\n` +
        `L2     sqrt((${f(qq[0])}-${f(dd[0])})^2 + (${f(qq[1])}-${f(dd[1])})^2) = ${f(res.l2[sel])}\n` +
        (st.normalise ? `unit vectors: L2^2 = ${f(res.l2[sel] ** 2)} = 2 - 2*cos = ${f(2 - 2 * res.cosine[sel])}` : `lengths differ, so dot, cosine and L2 can disagree. Normalise to make them agree.`);
    }
    render(true);
  }

  /* PURE helper for real vectors of any dimension */
  function measures(a, b) {
    let d = 0, na = 0, nb = 0, l = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; l += (a[i] - b[i]) ** 2; }
    return { dot: d, cosine: d / Math.sqrt(na * nb), l2: Math.sqrt(l) };
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: three measures on real MiniLM vectors',
      'Real model: sentence-transformers/all-MiniLM-L6-v2 (384 numbers per text), with its final normalisation layer removed, so dot and L2 on the raw vectors really differ from cosine. Part 1: the same 138 Wikipedia passages ranked by each measure for 24 questions. Part 2: six real sentences, every number computed here from the 384-d vectors.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    const MS = [['dense_cosine', 'cosine', 'var(--he)'], ['dense_dot', 'dot', 'var(--k12)'], ['dense_l2', 'L2 (nearest first)', 'var(--both)']];
    Promise.all([get('data/corpus.json'), get('data/questions.json'), get('runs/metrics_by_method.json'), get('data/vectors_sample.json'), ...MS.map(m => get(`runs/${m[0]}.json`))]).then(([corpus, qs, met, vs, ...runs]) => {
      const P = {}; corpus.forEach(p => { P[p.id] = p; });
      const idx = r => { const m = {}; r.questions.forEach(q => { m[q.qid] = q.ranking; }); return m; };
      const R = runs.map(idx);
      const rr = (rk, g) => { const i = rk.findIndex(x => g.includes(x.id)); return i < 0 ? 0 : 1 / (i + 1); };
      /* ---- part 1: questions ---- */
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%;width:100%' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 64)}`)));
      sel.value = 'q01';
      const info = K.el('div', {}), cols = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' }), summ = K.el('div', { 'aria-live': 'polite' }), agg = K.el('div', { class: 'hint' });
      const open = new Set();
      function col(m, i, g, q) {
        const items = R[i][q.id].slice(0, 6);
        const rows = items.map((x, j) => {
          const isG = g.includes(x.id), key = m[1] + x.id;
          const btn = K.el('button', { 'aria-expanded': String(open.has(key)), style: 'text-align:left;width:100%;' + (isG ? 'border-color:var(--he)' : '') },
            `#${j + 1}  ${x.id}  ${K.fmt(m[1] === 'L2 (nearest first)' ? -x.score : x.score, 3)}  ${isG ? 'GOLD  ' : ''}${P[x.id].article}`);
          const txt = K.el('div', { class: 'hint', style: 'display:' + (open.has(key) ? 'block' : 'none') }, P[x.id].text);
          btn.addEventListener('click', () => { open.has(key) ? open.delete(key) : open.add(key); drawQ(); });
          return K.el('div', { style: 'margin:3px 0' }, btn, txt);
        });
        return K.el('div', { style: 'flex:1 1 250px;min-width:0' }, K.el('div', { style: `color:${m[2]};font-weight:600` }, m[1]), ...rows);
      }
      function drawQ() {
        const q = qs.find(x => x.id === sel.value), g = q.gold_passages;
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold: ${g.join(', ') || 'none'}. gold answer: ${q.gold_answer || '(none)'}`));
        cols.replaceChildren(...MS.map((m, i) => col(m, i, g, q)));
        const tops = MS.map((m, i) => R[i][q.id][0].id), same = tops.every(t => t === tops[0]);
        const rrs = MS.map((m, i) => rr(R[i][q.id], g));
        summ.replaceChildren(
          K.el('div', {}, 'top-1: ', K.el('b', {}, tops.join(' / ')), '  ', K.el('b', { class: same ? 'good' : 'bad' }, same ? 'all three agree' : 'they disagree')),
          g.length ? K.el('div', {}, `reciprocal rank of the first gold passage: cosine ${K.fmt(rrs[0], 3)}, dot ${K.fmt(rrs[1], 3)}, L2 ${K.fmt(rrs[2], 3)}`) : K.el('div', { class: 'bad' }, 'Unanswerable question: every measure still returns a nearest passage. A similarity is not an "I do not know".'));
      }
      const nDis = qs.filter(q => new Set(MS.map((m, i) => R[i][q.id][0].id)).size > 1).length;
      const mm = k => MS.map(m => `${m[1].split(' ')[0]} ${K.fmt(met.methods[m[0]][k], 3)}`).join(', ');
      agg.textContent = `Whole set (20 answerable questions): MRR ${mm('mrr')}. nDCG@5 ${mm('ndcg@5')}. recall@5 ${mm('recall@5')}. The three measures name a different top-1 passage on ${nDis} of ${qs.length} questions. One question moves MRR by about 0.05, so most gaps here are inside the noise.`;
      sel.addEventListener('change', drawQ);
      /* ---- part 2: six real sentences ---- */
      const S = vs.sentences;
      let qi = 3, normed = false;
      const ssel = K.el('select', { 'aria-label': 'query sentence', style: 'max-width:100%;width:100%' }, ...S.map((s, i) => K.el('option', { value: i }, `${s.id}: ${s.text.slice(0, 60)}`)));
      ssel.value = String(qi);
      const nb = K.el('button', { 'aria-pressed': 'false' }, 'normalise all vectors to length 1');
      const stbl = K.el('div', { style: 'overflow-x:auto' }), sver = K.el('div', { 'aria-live': 'polite' }), sform = K.el('div', { class: 'formula' });
      function drawS() {
        const vec = s => (normed ? s.embedding_normalized : s.embedding_raw), a = S[qi];
        const rows = S.map((s, j) => (j === qi ? null : { j, s, m: measures(vec(a), vec(s)) })).filter(Boolean);
        const order = key => rows.slice().sort((x, y) => (key === 'l2' ? x.m.l2 - y.m.l2 : y.m[key] - x.m[key])).map(r => r.s.id);
        const rank = (key, r) => order(key).indexOf(r.s.id) + 1;
        const t = K.el('table', {}, K.el('tr', {}, ...['sentence', 'length', 'cosine', 'dot', 'L2'].map(h => K.el('th', {}, h))),
          ...rows.map(r => K.el('tr', {}, K.el('td', { title: r.s.text }, `${r.s.id} (${r.s.passage})`), K.el('td', { class: 'num' }, K.fmt(Math.sqrt(measures(vec(r.s), vec(r.s)).dot), 3)),
            ...['cosine', 'dot', 'l2'].map(k => K.el('td', { class: 'num' + (rank(k, r) === 1 ? ' good' : '') }, `${K.fmt(r.m[k], 3)}  #${rank(k, r)}`)))));
        stbl.replaceChildren(t);
        const oc = order('cosine'), od = order('dot'), ol = order('l2'), same = [oc, od, ol].every(o => o.join() === oc.join());
        sver.replaceChildren(K.el('span', {}, 'order by cosine: ', K.el('b', {}, oc.join(' > ')), '   dot: ', K.el('b', {}, od.join(' > ')), '   L2: ', K.el('b', {}, ol.join(' > '))),
          '  ', K.el('b', { class: same ? 'good' : 'bad' }, same ? 'all three agree' : 'they disagree'));
        const r1 = rows.find(r => r.s.id === oc[0]), c = r1.m;
        sform.textContent = `query ${a.id} vs ${r1.s.id}  (${normed ? 'unit vectors' : 'raw vectors'}, 384 numbers each; |${a.id}| = ${K.fmt(Math.sqrt(measures(vec(a), vec(a)).dot), 3)})\n` +
          `cosine = ${K.fmt(c.cosine, 4)}   dot = ${K.fmt(c.dot, 4)}   L2 = ${K.fmt(c.l2, 4)}\n` +
          (normed ? `unit vectors: L2^2 = ${K.fmt(c.l2 ** 2, 4)} = 2 - 2*cos = ${K.fmt(2 - 2 * c.cosine, 4)}, and dot = cosine. One ordering.` :
            `raw vectors: dot = |q||d|cos = ${K.fmt(Math.sqrt(measures(vec(a), vec(a)).dot) * Math.sqrt(measures(vec(r1.s), vec(r1.s)).dot) * c.cosine, 4)}; L2^2 = |q|^2 + |d|^2 - 2*dot = ${K.fmt(c.l2 ** 2, 4)}. Length enters dot and L2, not cosine.`);
        nb.setAttribute('aria-pressed', String(normed)); nb.classList.toggle('on', normed);
      }
      ssel.addEventListener('change', () => { qi = +ssel.value; drawS(); });
      nb.addEventListener('click', () => { normed = !normed; drawS(); });
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: demo scale, 138 passages, 24 questions written by Claude from the corpus text (not a benchmark), 20 answerable. Gold labels cover only the passages judged necessary, so a "miss" can be a fair hit. The six sentences are a hand-picked sample: they show the mechanics, not how often the measures disagree. Dot and L2 differ from cosine here only because the model\'s own normalisation layer was removed on purpose. Text: Wikipedia contributors, CC BY-SA 4.0.');
      body.replaceChildren(K.el('h4', {}, '1. Same question, three measures (real top-20 runs)'), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', sel)), info, summ, cols, agg,
        K.el('h4', {}, '2. Six real sentences: when do the measures agree?'), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'query ', ssel), nb), stbl, sver, sform, cav);
      drawQ(); drawS();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit;
    const bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, ranks, measures };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['vector_similarity'] = api;
})(this);
