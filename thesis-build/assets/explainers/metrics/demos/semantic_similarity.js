/* Embedding semantic similarity demo: sim(a, a*) = cos(E(a), E(a*)).
   Real mode: 12 real gold answers and 36 real system answers (arms A/B/C) embedded locally with all-MiniLM-L6-v2 (data/semantic_similarity.build.py);
   the cosine is recomputed live in the page from the stored 384-d vectors. Toy mode: 2-D arrows (invented vectors).
   3-D picture: three.js loaded lazily (never from compute()), 2-D SVG fallback. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { a: [0.6, 0.8], b: [0.8, 0.6] };

  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = a => Math.sqrt(dot(a, a));
  /* PURE: cosine of two vectors of any dimension (the worked example result: 0.96) */
  function compute(inp) { const n = norm(inp.a) * norm(inp.b); return n === 0 ? 0 : dot(inp.a, inp.b) / n; }

  function ranks(v) { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function pearson(a, b) { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN; }
  const spearman = (a, b) => pearson(ranks(a), ranks(b));

  /* ---------------- toy: two arrows in a plane ---------------- */
  function mountToy(el) {
    const K = root.DemoKit, TAU = Math.PI / 180;
    const st = { angA: Math.atan2(0.8, 0.6) / TAU, angB: Math.atan2(0.6, 0.8) / TAU, lenA: 1, lenB: 1, label: '' };
    const shell = K.shell(el, 'Toy example (break it)', 'Two invented 2-D vectors (not model output). Only the angle between the arrows changes the cosine; stretching an arrow does not.');
    const sA = K.slider('angle of E(a), degrees', 0, 180, 1, Math.round(st.angA), v => { st.angA = v; st.label = ''; render(); });
    const sB = K.slider('angle of E(a*), degrees', 0, 180, 1, Math.round(st.angB), v => { st.angB = v; st.label = ''; render(); });
    const lA = K.slider('length of E(a)', 0.3, 1.5, 0.1, 1, v => { st.lenA = v; render(); });
    const lB = K.slider('length of E(a*)', 0.3, 1.5, 0.1, 1, v => { st.lenB = v; render(); });
    const svg = K.svg('svg', { viewBox: '-1.7 -1.7 3.4 2.2', style: 'width:100%;max-width:520px;height:auto;display:block', role: 'img', 'aria-label': 'two arrows' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }), note = K.el('p', { class: 'hint' });
    const set = (a, b, la, lb, label) => { st.angA = a; st.angB = b; st.lenA = la; st.lenB = lb; st.label = label || ''; sA.set(Math.round(a)); sB.set(Math.round(b)); lA.set(la); lB.set(lb); render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(Math.atan2(0.8, 0.6) / TAU, Math.atan2(0.6, 0.8) / TAU, 1, 1)),
      btn('Break it: same angle, different length', () => set(60, 60, 0.4, 1.5, 'Same direction, very different length: cosine is 1.')),
      btn('Break it: negation', () => set(30, 38, 1, 1, 'Invented pair: "Adam converges" vs "Adam does not converge". Embedding models put them close: same topic, opposite truth.')),
      btn('Opposite directions', () => set(10, 170, 1, 1)));
    shell.append(presets, K.el('div', { class: 'row' }, sA.node), K.el('div', { class: 'row' }, sB.node), K.el('div', { class: 'row' }, lA.node), K.el('div', { class: 'row' }, lB.node), res.node, svg, formula, note);
    function render() {
      const a = [st.lenA * Math.cos(st.angA * TAU), st.lenA * Math.sin(st.angA * TAU)], b = [st.lenB * Math.cos(st.angB * TAU), st.lenB * Math.sin(st.angB * TAU)];
      const c = compute({ a, b });
      res.set(c, 4);
      const arrow = (v, col, t) => { const g = K.svg('g'); g.append(K.svg('line', { x1: 0, y1: 0, x2: v[0], y2: -v[1], stroke: col, 'stroke-width': 0.03, 'stroke-linecap': 'round' }), K.svg('circle', { cx: v[0], cy: -v[1], r: 0.05, fill: col }));
        const tx = K.svg('text', { x: v[0] * 1.08 + 0.04, y: -v[1] * 1.08, fill: col, 'font-size': 0.13 }); tx.textContent = t; g.append(tx); return g; };
      const half = K.svg('path', { d: 'M -1.6 0 L 1.6 0', stroke: 'rgba(128,128,128,.4)', 'stroke-width': 0.01 });
      const d = Math.abs(st.angA - st.angB), arc = K.svg('path', { d: `M ${0.35 * Math.cos(st.angA * TAU)} ${-0.35 * Math.sin(st.angA * TAU)} A 0.35 0.35 0 0 ${st.angA > st.angB ? 1 : 0} ${0.35 * Math.cos(st.angB * TAU)} ${-0.35 * Math.sin(st.angB * TAU)}`, fill: 'none', stroke: '#f2a93b', 'stroke-width': 0.02 });
      svg.replaceChildren(half, arrow(a, '#7c9cff', 'E(a)'), arrow(b, '#3cc7b4', 'E(a*)'), arc);
      formula.textContent = `E(a) = (${K.fmt(a[0], 2)}, ${K.fmt(a[1], 2)}), E(a*) = (${K.fmt(b[0], 2)}, ${K.fmt(b[1], 2)})\ndot = ${K.fmt(dot(a, b), 3)}, |E(a)| = ${K.fmt(norm(a), 3)}, |E(a*)| = ${K.fmt(norm(b), 3)}\ncos = ${K.fmt(dot(a, b), 3)} / (${K.fmt(norm(a), 3)} x ${K.fmt(norm(b), 3)}) = ${K.fmt(c, 4)}   (angle ${K.fmt(d, 1)} degrees)`;
      note.textContent = st.label || 'Cosine only sees direction. It does not know which of two close sentences is true.';
    }
    render();
  }

  /* ---------------- real: 12 gold + 36 system answers ---------------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const url = new URL('data/semantic_similarity.real.json', SCRIPT_SRC || location.href).href;
    realData = fetch(url).then(r => { if (!r.ok) throw new Error('semantic_similarity.real.json ' + r.status); return r.json(); });
    return realData;
  }
  const ARMS = { A: 'A: no retrieval', B: 'B: hybrid RRF top-5', C: 'C: dense top-5 + graph' }, ACOL = { A: '#f2a93b', B: '#7c9cff', C: '#3cc7b4' };

  function mountReal(el, D) {
    const K = root.DemoKit, Q = D.questions, byId = {}; Q.forEach(q => { byId[q.id] = q; });
    const st = { q: 'q06', arm: 'B', view: '3d' };
    const shell = K.shell(el, 'Real example: cosine between real gold and real system answers',
      'Scale: n = 12 questions (9 answerable, 3 unanswerable), 3 arms, one run at temperature 0; gold answers written by the study helper; a demo, not a benchmark. ' +
      'Embeddings: all-MiniLM-L6-v2 (384-d), run locally for this page (CPU, USD 0; data/semantic_similarity.build.py); the cosine below is recomputed live from the stored vectors (rounded to 4 decimals; matches numpy to about 1e-4). ' +
      'The "judge" is LLM judge A\'s correctness verdict (1 / 0.5 / 0) from the answer study, not a human label.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, Object.keys(ARMS).map(a => opt(a, ARMS[a])));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, Q.map(q => opt(q.id, q.id + ' (' + q.type + '): ' + q.question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const jump = (q, arm) => () => { st.q = q; st.arm = arm; aSel.value = arm; qSel.value = q; render(); };
    const presets = K.el('div', { class: 'row' },
      btn('Short correct vs long correct (q06 B / A)', jump('q06', 'A')),
      btn('Break it: wrong refusal scores like a good answer (q09 B)', jump('q09', 'B')),
      btn('Break it: correct refusal vs hallucination (q21 B / A)', jump('q21', 'A')));
    const res = K.resultBox(), pr = K.el('div', { class: 'row' }), txt = K.el('div', { style: 'overflow-wrap:anywhere' });
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'white-space:pre-wrap;overflow-wrap:anywhere' });
    const bar = K.el('div', { style: 'height:14px;border-radius:7px;background:rgba(128,128,128,.25);position:relative;max-width:520px', 'aria-hidden': 'true' });
    const fill = K.el('div', { style: 'height:100%;border-radius:7px;background:var(--ai,#f2a93b)' }); bar.append(fill);
    const note = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' }), tbl = K.el('div'), summ = K.el('p', { class: 'hint', style: 'overflow-wrap:anywhere' });
    const plotBox = K.el('div', { style: 'position:relative;width:100%;max-width:880px;aspect-ratio:16/10;border:1px solid rgba(128,128,128,.3);border-radius:8px;overflow:hidden;touch-action:none' }),
      plotTip = K.el('p', { class: 'hint' });
    shell.append(presets, K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), pr, res.node, bar, formula, txt, note,
      K.el('h4', {}, 'Where the 48 answers sit (PCA of the real vectors)'), plotBox, plotTip, tbl, summ);

    const cosOf = (q, a) => compute({ a: q.arms[a].vec, b: q.gold_vec });
    function render() {
      const q = byId[st.q], A = q.arms[st.arm], a = A.vec, g = q.gold_vec, c = compute({ a, b: g });
      res.set(c, 3); fill.style.width = Math.max(0, Math.min(1, c)) * 100 + '%';
      pr.replaceChildren(K.el('span', { class: 'num good' }, 'cos = ' + K.fmt(c, 3)), K.el('span', { class: 'num' }, 'judge A correctness = ' + A.judge_correctness), K.el('span', { class: 'num' }, A.refused ? 'system refused' : 'system answered'));
      formula.textContent = `a = system answer (arm ${st.arm}), a* = gold answer, 384 dimensions\ndot(E(a), E(a*)) = ${K.fmt(dot(a, g), 3)}\n|E(a)| = ${K.fmt(norm(a), 3)}, |E(a*)| = ${K.fmt(norm(g), 3)}\ncos = ${K.fmt(dot(a, g), 3)} / (${K.fmt(norm(a), 3)} x ${K.fmt(norm(g), 3)}) = ${K.fmt(c, 4)}`;
      txt.replaceChildren(K.el('div', { class: 'hint' }, 'gold answer (' + q.id + ', data/questions.json)'), K.el('div', { style: 'color:var(--he,#3cc7b4)' }, q.gold),
        K.el('div', { class: 'hint' }, 'system answer, arm ' + st.arm + ' (answers/answers.json)'), K.el('div', { style: 'color:var(--k12,#7c9cff)' }, A.answer));
      const gw = q.gold.split(/\s+/).length, aw = A.answer.split(/\s+/).length;
      note.textContent = (q.type === 'unanswerable' && A.refused ? 'A correct refusal scores ' + K.fmt(c, 2) + ' because the system wording ("The answer is not in the sources.") differs from the gold wording ("Not answerable from the corpus."): same meaning, only moderate cosine. ' : '') +
        (q.type === 'unanswerable' && !A.refused ? 'The system answered a question that has no answer in the corpus (judge: wrong). Its cosine to the "not answerable" gold is low here, which looks right, but only because the gold is a refusal sentence. ' : '') +
        (q.id === 'q09' && st.arm === 'B' ? 'Arm B refused although the answer is in the corpus (judge: 0) yet its cosine to the gold (' + K.fmt(c, 2) + ') is about the same as the correct answers of arm A and C. Topic overlap (ridge regression, LASSO, elastic net) drives the score, not whether the year and names were given. ' : '') +
        (aw > 4 * gw ? 'The answer is ' + K.fmt(aw / gw, 1) + 'x longer than the gold, which pulls the cosine down even when it is correct (judge ' + A.judge_correctness + '). ' : '') +
        'The cosine only measures closeness in the embedding space of this one model.';
      drawTable(); drawPlot();
    }
    function drawTable() {
      const t = K.el('table', { style: 'border-collapse:collapse;font-size:12px' });
      t.append(K.el('tr', {}, ...['q', 'type', 'arm', 'cos', 'judge', 'refused'].map(h => K.el('th', { style: 'padding:1px 5px;text-align:right' }, h))));
      const xs = [], ys = [], xa = [], ya = [], per = { A: [], B: [], C: [] }, jper = { A: [], B: [], C: [] };
      Q.forEach(q => ['A', 'B', 'C'].forEach(arm => { const c = cosOf(q, arm), j = q.arms[arm].judge_correctness; xs.push(c); ys.push(j);
        if (q.type !== 'unanswerable') { xa.push(c); ya.push(j); per[arm].push(c); jper[arm].push(j); }
        t.append(K.el('tr', { style: (q.id === st.q && arm === st.arm) ? 'font-weight:700' : '' }, ...[q.id, q.type, arm, K.fmt(c, 3), j, q.arms[arm].refused ? 'yes' : ''].map(x => K.el('td', { style: 'padding:1px 5px;text-align:right' }, String(x))))); }));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All 36 (question, arm) pairs'), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, t)));
      const mean = v => v.reduce((s, x) => s + x, 0) / v.length;
      summ.textContent = 'Mean cosine over the 9 answerable questions: A ' + K.fmt(mean(per.A), 3) + ', B ' + K.fmt(mean(per.B), 3) + ', C ' + K.fmt(mean(per.C), 3) +
        '. Mean judge correctness on the same 9: A ' + K.fmt(mean(jper.A), 2) + ', B ' + K.fmt(mean(jper.B), 2) + ', C ' + K.fmt(mean(jper.C), 2) +
        '. Across all 36 pairs the Spearman correlation between cosine and judge verdict is ' + K.fmt(spearman(xs, ys), 2) + ' (Pearson ' + K.fmt(pearson(xs, ys), 2) + '); on the 27 answerable pairs alone it is ' + K.fmt(spearman(xa, ya), 2) + ' (Pearson ' + K.fmt(pearson(xa, ya), 2) + '), i.e. no relation: the all-36 value comes from the 3 unanswerable questions where arm A hallucinated. With n = 36 and three verdict values treat it as rough. Cosine scores here fall in a narrow band (about 0.05 to 0.9) and depend on the model: do not read 0.6 as "60% correct".';
    }
    /* ---- picture: three.js lazy, SVG fallback ---- */
    let three = null, yaw = 0.5, pitch = 0.3, drag = null;
    const pts = () => { const out = []; Q.forEach(q => { out.push({ q: q.id, arm: 'gold', p: q.gold_pca }); ['A', 'B', 'C'].forEach(a => out.push({ q: q.id, arm: a, p: q.arms[a].pca })); }); return out; };
    const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
    const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function drawPlot() {
      if (three && st.view === '3d') return draw3();
      if (st.view === '3d' && three === null) return init3();
      drawSvg();
    }
    function drawSvg() {
      const P = pts(), xs = P.map(o => o.p[0]), ys = P.map(o => o.p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const X = v => 20 + (v - x0) / (x1 - x0) * 560, Y = v => 270 - (v - y0) / (y1 - y0) * 250;
      const s = K.svg('svg', { viewBox: '0 0 600 290', style: 'position:absolute;inset:0;width:100%;height:100%', role: 'img', 'aria-label': 'PCA of the 48 answer embeddings' });
      const q = byId[st.q];
      P.forEach(o => { const sel = o.q === st.q; s.append(K.svg('circle', { cx: X(o.p[0]), cy: Y(o.p[1]), r: sel ? 6 : 3.5, fill: o.arm === 'gold' ? '#e9ecf2' : ACOL[o.arm], opacity: sel ? 1 : 0.55, stroke: (sel && o.arm === st.arm) ? '#fff' : 'none', 'stroke-width': 2 })); });
      ['A', 'B', 'C'].forEach(a => { if (a === st.arm) s.append(K.svg('line', { x1: X(q.gold_pca[0]), y1: Y(q.gold_pca[1]), x2: X(q.arms[a].pca[0]), y2: Y(q.arms[a].pca[1]), stroke: ACOL[a], 'stroke-width': 1.5 })); });
      plotBox.replaceChildren(s);
      plotTip.textContent = 'PC1 vs PC2 of the 48 vectors (' + K.fmt(D.pca_variance[0] * 100, 1) + '% and ' + K.fmt(D.pca_variance[1] * 100, 1) + '% of the variance; 3 axes keep only ' + K.fmt(D.pca_variance.reduce((s, x) => s + x, 0) * 100, 0) + '%). Flat picture: distances here are NOT the cosines. White = gold answer, amber = arm A, blue = B, teal = C; the chosen question is large. ' + (st.note || '');
    }
    async function init3() {
      if (!webgl()) { three = false; st.view = '2d'; st.note = 'WebGL is unavailable, so the 2-D view is shown.'; return drawSvg(); }
      three = 'loading'; plotTip.textContent = 'Loading 3-D view...'; drawSvg();
      try {
        const T = await import(new URL('../../_demo-kit/vendor/three.module.js', SCRIPT_SRC || location.href).href);
        const r = new T.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1.6, 0.1, 100); cam.position.set(0, 0, 4.2);
        const grp = new T.Group(); scene.add(grp);
        const P = pts(), sc = 1 / Math.max(...P.flatMap(o => o.p.map(Math.abs))) * 1.3, sph = new T.SphereGeometry(0.04, 12, 8), meshes = [];
        P.forEach(o => { const m = new T.Mesh(sph, new T.MeshBasicMaterial({ color: o.arm === 'gold' ? 0xe9ecf2 : parseInt(ACOL[o.arm].slice(1), 16), transparent: true })); m.position.set(o.p[0] * sc, o.p[1] * sc, o.p[2] * sc); grp.add(m); meshes.push(m); });
        const lines = {}; ['A', 'B', 'C'].forEach(a => { const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: parseInt(ACOL[a].slice(1), 16) })); grp.add(l); lines[a] = l; });
        const cv = r.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:grab'; cv.tabIndex = 0; cv.setAttribute('aria-label', '3-D PCA of the answer embeddings; drag or use arrow keys to rotate');
        three = { T, r, scene, cam, grp, meshes, lines, P, sc };
        const dn = e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); }, mv = e => { if (!drag) return; yaw += (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; draw3(); }, up = () => { drag = null; };
        cv.addEventListener('pointerdown', dn); cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        cv.addEventListener('keydown', e => { const d = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key]; if (d) { e.preventDefault(); yaw += d[0]; pitch += d[1]; draw3(); } });
        plotBox.replaceChildren(cv); draw3();
      } catch (e) { three = false; st.view = '2d'; st.note = '3-D could not load (' + e.message + '); 2-D view shown.'; drawSvg(); }
    }
    function draw3() {
      if (!three || three === 'loading') return;
      const { r, scene, cam, grp, meshes, lines, P, sc } = three, w = plotBox.clientWidth || 600, h = plotBox.clientHeight || 375;
      r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); grp.rotation.set(pitch, yaw, 0);
      const q = byId[st.q];
      P.forEach((o, i) => { const sel = o.q === st.q; meshes[i].material.opacity = sel ? 1 : 0.4; meshes[i].scale.setScalar(sel ? 2 : 1); });
      ['A', 'B', 'C'].forEach(a => { const l = lines[a], on = a === st.arm; l.visible = on; if (on) l.geometry.setFromPoints([new three.T.Vector3(...q.gold_pca.map(x => x * sc)), new three.T.Vector3(...q.arms[a].pca.map(x => x * sc))]); });
      r.render(scene, cam);
      plotTip.textContent = 'Drag (or arrow keys) to rotate. First 3 PCA axes keep only ' + K.fmt(D.pca_variance.reduce((s, x) => s + x, 0) * 100, 0) + '% of the variance, so distances in this picture are NOT the cosines. White = gold answer, amber = arm A, blue = B, teal = C; the chosen question is large, its line joins gold to the chosen arm.' + (reduce() ? '' : '');
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

  const api = { defaults, compute, mount, spearman, pearson };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['semantic_similarity'] = api;
})(this);
