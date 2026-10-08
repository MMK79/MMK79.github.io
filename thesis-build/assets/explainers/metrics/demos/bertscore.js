/* BERTScore demo: greedy matching of token vectors. R = mean over reference tokens of the best cosine, P = mean over candidate tokens
   of the best cosine, F1 = 2PR/(P+R), optional idf weights.
   Real mode: 5 real (gold answer, system answer) pairs from the answer study. Tokens and the full cosine matrix come from
   all-MiniLM-L6-v2 contextual token vectors (data/bertscore.build.py) -- NOT roberta-large BERTScore; P/R/F1 are recomputed live in the page
   from the stored matrix. Toy mode: 2-D unit vectors. Rendering: 2-D SVG heatmap (no 3-D: the lesson is the matrix with its row/column maxima). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const unit = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
  const defaults = { ref: [[1, 0], [0, 1], [0.707, 0.707]], cand: [[0.9, 0.436], [0.2, 0.98]] };   /* worked example (normalised inside compute) */

  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const simOf = (ref, cand) => { const R = ref.map(unit), C = cand.map(unit); return R.map(r => C.map(c => dot(r, c))); };
  const wmean = (v, w) => { if (!w) return v.reduce((s, x) => s + x, 0) / v.length; let n = 0, d = 0; v.forEach((x, i) => { n += w[i] * x; d += w[i]; }); return d ? n / d : 0; };
  /* PURE: {R, P, F1} from either token vectors {ref, cand} or a ready cosine matrix {sim}; optional idf weights {wr, wc} */
  function scores(inp) {
    const S = inp.sim || simOf(inp.ref, inp.cand);
    const rowMax = S.map(r => Math.max(...r)), colMax = S[0].map((_, j) => Math.max(...S.map(r => r[j])));
    const R = wmean(rowMax, inp.wr), P = wmean(colMax, inp.wc), F1 = (P + R) ? 2 * P * R / (P + R) : 0;
    return { R, P, F1, rowMax, colMax };
  }
  /* PURE: F1 (worked example result 0.9517) */
  function compute(inp) { return scores(inp).F1; }

  const COL = { row: '#3cc7b4', col: '#f2a93b' };
  const heat = v => { const t = Math.max(0, Math.min(1, v)); return `rgba(124,156,255,${(0.08 + 0.7 * t).toFixed(2)})`; };

  /* shared matrix drawing (SVG, fluid width). rows = reference tokens, cols = candidate tokens. */
  function drawMatrix(K, S, rt, ct, o) {
    const nr = rt.length, nc = ct.length, cw = Math.min(44, 720 / nc), lw = 78, top = 74, W = lw + nc * cw + 6, H = top + nr * 26 + 6;
    const sv = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;max-width:880px;height:auto;display:block', role: 'img', 'aria-label': 'cosine matrix, reference tokens by candidate tokens, row maxima teal, column maxima amber' });
    const sc = scores({ sim: S }), showNum = nc <= 18;
    ct.forEach((t, j) => { const tx = K.svg('text', { x: lw + j * cw + cw / 2, y: top - 6, 'font-size': 11, fill: 'currentColor', transform: `rotate(-55 ${lw + j * cw + cw / 2} ${top - 6})`, 'text-anchor': 'start' }); tx.textContent = t; sv.append(tx); });
    rt.forEach((t, i) => { const tx = K.svg('text', { x: lw - 6, y: top + i * 26 + 17, 'font-size': 12, fill: 'currentColor', 'text-anchor': 'end' }); tx.textContent = t; sv.append(tx); });
    S.forEach((row, i) => row.forEach((v, j) => {
      const g = K.svg('g'), isR = v === sc.rowMax[i], isC = v === sc.colMax[j];
      g.append(K.svg('rect', { x: lw + j * cw, y: top + i * 26, width: cw - 1, height: 25, fill: heat(v), stroke: isR ? COL.row : 'none', 'stroke-width': 2.2 }));
      if (isC) g.append(K.svg('rect', { x: lw + j * cw + 3, y: top + i * 26 + 3, width: cw - 7, height: 19, fill: 'none', stroke: COL.col, 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
      if (showNum) { const tx = K.svg('text', { x: lw + j * cw + cw / 2, y: top + i * 26 + 17, 'font-size': cw < 30 ? 8 : 10, fill: 'currentColor', 'text-anchor': 'middle' }); tx.textContent = K.fmt(v, 2).replace(/^0\./, '.').replace(/^-0\./, '-.'); g.append(tx); }
      if (o && o.onCell) { g.style.cursor = 'pointer'; g.addEventListener('click', () => o.onCell(i, j, v)); }
      sv.append(g);
    }));
    return sv;
  }

  /* ---------------- toy ---------------- */
  function mountToy(el) {
    const K = root.DemoKit, TAU = Math.PI / 180;
    const ang = v => Math.round(Math.atan2(v[1], v[0]) / TAU * 10) / 10;
    const st = { ra: defaults.ref.map(ang), ca: defaults.cand.map(ang), useIdf: false };
    const shell = K.shell(el, 'Toy example (break it)', 'Invented 2-D unit vectors, not model output. Each token is an angle; the cosine of two tokens is cos(angle difference). Every token takes its single best partner, nothing forces a partner to be used once.');
    const sR = st.ra.map((_, i) => K.slider('reference token x' + (i + 1) + ' angle', 0, 180, 1, Math.round(st.ra[i]), v => { st.ra[i] = v; render(); }));
    const sC = st.ca.map((_, i) => K.slider('candidate token x^' + (i + 1) + ' angle', 0, 180, 1, Math.round(st.ca[i]), v => { st.ca[i] = v; render(); }));
    const set = (ra, ca) => { st.ra = ra.slice(); st.ca = ca.slice(); sR.forEach((s, i) => s.set(ra[i])); sC.forEach((s, i) => s.set(ca[i])); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults.ref.map(ang), defaults.cand.map(ang))),
      btn('Break it: one candidate token covers all three reference tokens', () => set([40, 40, 40], [40, 170])),
      btn('Break it: perfect precision, weaker recall (candidate says less)', () => set([20, 60, 100], [20, 100])));
    const res = K.resultBox(), line = K.el('div', { class: 'row' }), box = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    shell.append(presets, ...sR.map(s => K.el('div', { class: 'row' }, s.node)), ...sC.map(s => K.el('div', { class: 'row' }, s.node)), res.node, line, box, formula, note);
    function render() {
      const ref = st.ra.map(a => [Math.cos(a * TAU), Math.sin(a * TAU)]), cand = st.ca.map(a => [Math.cos(a * TAU), Math.sin(a * TAU)]);
      const S = simOf(ref, cand), r = scores({ ref, cand }), f = x => K.fmt(x, 3);
      res.set(r.F1, 4);
      line.replaceChildren(...[['R (recall)', r.R], ['P (precision)', r.P], ['F1', r.F1]].map(([n, v]) => K.el('span', { class: 'num' }, n + ' = ' + f(v))));
      box.replaceChildren(drawMatrix(K, S, st.ra.map((a, i) => 'x' + (i + 1)), st.ca.map((a, i) => 'x^' + (i + 1))));
      const used = new Set(r.rowMax.map((m, i) => S[i].indexOf(m)));
      formula.textContent = `R = (${r.rowMax.map(f).join(' + ')}) / ${r.rowMax.length} = ${f(r.R)}   (best cosine of each reference token, teal outline)\nP = (${r.colMax.map(f).join(' + ')}) / ${r.colMax.length} = ${f(r.P)}   (best cosine of each candidate token, amber dashed)\nF1 = 2 x ${f(r.P)} x ${f(r.R)} / (${f(r.P)} + ${f(r.R)}) = ${f(r.F1)}`;
      note.textContent = used.size < r.rowMax.length ? 'Several reference tokens picked the same candidate token: greedy matching has no one-to-one constraint, so one good word can "cover" many.' : 'Each reference token and each candidate token takes its own best partner independently.';
    }
    render();
  }

  /* ---------------- real ---------------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/bertscore.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('bertscore.real.json ' + r.status); return r.json(); });
    return realData;
  }
  function mountReal(el, D) {
    const K = root.DemoKit, P = D.pairs, st = { i: 0, idf: false };
    const shell = K.shell(el, 'Real example: greedy token matching on real gold and system answers',
      'Scale: 5 hand-picked pairs from the answer study (12 questions, 3 arms, demo scale; not a benchmark). IMPORTANT: the encoder is all-MiniLM-L6-v2 (a sentence model, last-layer contextual token vectors, 384-d, WordPiece tokens), NOT roberta-large BERTScore. Raw cosines of this model sit around 0.3 to 0.9, no baseline rescaling, so absolute values are not comparable to published BERTScore numbers. Run locally, CPU, USD 0 (data/bertscore.build.py). The matrix is stored (4 decimals); R, P, F1 are recomputed live below. idf is taken over the 12 gold answers (tiny). Reference = gold answer, candidate = system answer; [p093]-style citation tags were removed; answers longer than 40 word pieces are cut at 40 (flagged). "Judge" = LLM judge A correctness (1 / 0.5 / 0), not a human label.');
    const sel = K.el('select', { 'aria-label': 'pair', style: 'width:100%;max-width:100%;box-sizing:border-box' }, P.map((p, i) => K.el('option', { value: i }, `${p.id} arm ${p.arm}: ${p.refused ? 'refusal' : 'answer'}, judge ${p.judge_correctness} (${p.type})`)));
    sel.addEventListener('change', () => { st.i = +sel.value; render(); });
    const idfCb = K.el('input', { type: 'checkbox', 'aria-label': 'use idf weights' }); idfCb.addEventListener('change', () => { st.idf = idfCb.checked; render(); });
    const jump = i => () => { st.i = i; sel.value = i; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' }, btn('Short correct answer (q06 B)', jump(0)), btn('Long correct answer: precision collapses (q06 A)', jump(1)),
      btn('Break it: WRONG refusal (q09 B, judge 0)', jump(3)), btn('...vs correct refusal (q21 B, judge 1)', jump(4)));
    const res = K.resultBox(), line = K.el('div', { class: 'row' }), box = K.el('div'), cellInfo = K.el('p', { class: 'hint' }), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }),
      txt = K.el('div', { style: 'overflow-wrap:anywhere' }), best = K.el('div'), note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tbl = K.el('div');
    shell.append(presets, K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'pair ', sel)), K.el('div', { class: 'row' }, K.el('label', {}, idfCb, ' idf weights')), res.node, line, txt, box, cellInfo, formula, best, note, tbl);
    function render() {
      const p = P[st.i], inp = { sim: p.sim, wr: st.idf ? p.idf_ref : null, wc: st.idf ? p.idf_cand : null }, r = scores(inp), f = x => K.fmt(x, 3);
      res.set(r.F1, 3);
      line.replaceChildren(...[['R', r.R], ['P', r.P], ['F1', r.F1]].map(([n, v]) => K.el('span', { class: 'num good' }, n + ' = ' + f(v))), K.el('span', { class: 'num' }, 'judge A = ' + p.judge_correctness), K.el('span', { class: 'num' }, p.refused ? 'system refused' : 'system answered'));
      txt.replaceChildren(K.el('div', { class: 'hint' }, `reference = gold answer (${p.id}, data/questions.json), ${p.ref_tokens.length} word pieces`), K.el('div', { style: 'color:var(--he,#3cc7b4)' }, p.gold),
        K.el('div', { class: 'hint' }, `candidate = system answer, arm ${p.arm} (answers/answers.json), ${p.cand_tokens.length} word pieces` + (p.cand_truncated ? ` (cut from ${p.cand_tokens_full})` : '')), K.el('div', { style: 'color:var(--k12,#7c9cff)' }, p.system));
      box.replaceChildren(drawMatrix(K, p.sim, p.ref_tokens, p.cand_tokens, { onCell: (i, j, v) => { cellInfo.textContent = `cos("${p.ref_tokens[i]}", "${p.cand_tokens[j]}") = ${K.fmt(v, 4)}`; } }));
      cellInfo.textContent = 'Rows = reference (gold) tokens, columns = candidate (system) tokens. Teal outline = row maximum (feeds recall R), amber dashed = column maximum (feeds precision P). Click a cell to read its cosine.' + (p.cand_tokens.length > 18 ? ' Cell numbers are hidden for wide matrices; see the match lists below.' : '');
      formula.textContent = `R = ${st.idf ? 'idf-weighted mean' : 'mean'} of ${p.ref_tokens.length} row maxima = ${f(r.R)}\nP = ${st.idf ? 'idf-weighted mean' : 'mean'} of ${p.cand_tokens.length} column maxima = ${f(r.P)}\nF1 = 2 x ${f(r.P)} x ${f(r.R)} / (${f(r.P)} + ${f(r.R)}) = ${f(r.F1)}\nnumpy check (build script): F1 = ${f(p.numpy[st.idf ? 'F1_idf' : 'F1'])}`;
      const lst = (title, toks, other, max, S, byRow) => K.el('div', { style: 'flex:1 1 280px;min-width:240px;overflow-wrap:anywhere' }, K.el('b', {}, title),
        K.el('div', { class: 'hint' }, toks.map((t, k) => { const m = max[k], idx = byRow ? S[k].indexOf(m) : S.map(rw => rw[k]).indexOf(m); return `${t} -> ${other[idx]} (${K.fmt(m, 2)})`; }).join('; ')));
      best.replaceChildren(K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px' }, lst('Each reference token picks (recall side)', p.ref_tokens, p.cand_tokens, r.rowMax, p.sim, true), lst('Each candidate token picks (precision side)', p.cand_tokens, p.ref_tokens, r.colMax, p.sim, false)));
      note.textContent = (p.cand_tokens.length > 3 * p.ref_tokens.length ? 'The system answer is much longer than the gold: most of its tokens have no good partner, so precision P falls while recall R stays higher, even though the judge calls it correct. ' : '') +
        (p.id === 'q09' ? 'This is a WRONG refusal (the answer was in the corpus, judge 0) yet F1 is about the same as the CORRECT refusal of q21 B (judge 1): the score sees overlapping topic words, not truth. ' : '') +
        (p.id === 'q21' ? 'This is a CORRECT refusal (judge 1) with moderate F1 only because its wording differs from the gold wording. ' : '') +
        'Greedy matching has no one-to-one constraint; contextual vectors of the same word depend on its neighbours.';
      drawTable();
    }
    function drawTable() {
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['pair', 'R', 'P', 'F1', 'F1 idf', 'judge'].map(h => K.el('th', { style: 'padding:1px 6px;text-align:right' }, h))));
      P.forEach((p, i) => { const a = scores({ sim: p.sim }), b = scores({ sim: p.sim, wr: p.idf_ref, wc: p.idf_cand });
        t.append(K.el('tr', { style: i === st.i ? 'font-weight:700' : '' }, ...[p.id + ' ' + p.arm, K.fmt(a.R, 3), K.fmt(a.P, 3), K.fmt(a.F1, 3), K.fmt(b.F1, 3), p.judge_correctness].map(x => K.el('td', { style: 'padding:1px 6px;text-align:right' }, String(x))))); });
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All 5 pairs'), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t), K.el('p', { class: 'hint' }, 'Five pairs are far too few for any correlation with the judge; they only show the mechanism and the blind spots.')));
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, scores };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['bertscore'] = api;
})(this);
