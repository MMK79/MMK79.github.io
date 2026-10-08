/* Embeddings and the embedding space: mean pooling of invented 3-D token vectors, cosine between texts, a 3-D point cloud (three.js, lazy) with a 2-D SVG fallback.
   All vectors are INVENTED toy numbers, not model output. compute() is pure (no DOM, no THREE). */
(function (root) {
  const VOCAB = {
    the: [0, 0, 0], cat: [0.9, 0.1, 0], kitten: [0.85, 0.2, 0.05], sat: [0.1, 0.8, 0.1], slept: [0.15, 0.75, 0.2], on: [0, 0.1, 0.1],
    mat: [0.5, 0.3, 0], rug: [0.55, 0.25, 0.05], stock: [0, 0, 0.95], prices: [0, 0.05, 0.9], fell: [0, 0.1, 0.8],
  };
  /* extra invented words, used only for the background cloud of ~30 invented sentences */
  const EXTRA = {
    dog: [0.9, 0.15, 0], puppy: [0.85, 0.2, 0.05], ran: [0.1, 0.85, 0.05], barked: [0.15, 0.7, 0.1], sofa: [0.5, 0.3, 0], carpet: [0.55, 0.25, 0.05],
    bank: [0.05, 0.1, 0.8], loan: [0, 0.05, 0.9], rates: [0, 0.1, 0.85], rose: [0, 0.2, 0.8], shares: [0, 0.05, 0.9], dropped: [0, 0.3, 0.7],
    storm: [0.2, 0.5, 0.2], rain: [0.25, 0.4, 0.15], wind: [0.2, 0.55, 0.1], city: [0.3, 0.35, 0.3], river: [0.35, 0.4, 0.1], flooded: [0.2, 0.6, 0.2],
  };
  const BREAK_VOCAB = { drug: [0.3, 0.1, 0.6], is: [0, 0.1, 0.1], safe: [0.1, 0.6, 0.3], not: [0, 0.05, 0.02], stock: VOCAB.stock, prices: VOCAB.prices, fell: VOCAB.fell };
  const defaults = {
    vocab: VOCAB,
    texts: ['the cat sat on the mat', 'the kitten slept on the rug', 'stock prices fell'],
    pooling: 'mean',            // 'mean' | 'first'
  };

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.sqrt(dot(a, a));
  const tokens = s => s.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  /* e(x): mean of the token vectors (all n tokens count, unknown words = zero vector) or the first token only */
  function embed(text, vocab, pooling) {
    const toks = tokens(text), vs = toks.map(t => vocab[t] || [0, 0, 0]);
    if (!vs.length) return [0, 0, 0];
    if (pooling === 'first') return vs[0].slice();
    const s = [0, 0, 0]; vs.forEach(v => { for (let k = 0; k < 3; k++) s[k] += v[k]; });
    return s.map(x => x / vs.length);
  }
  const cosine = (a, b) => { const n = len(a) * len(b); return n === 0 ? 0 : dot(a, b) / n; };

  /* PURE: toy mode: [cos(A,B), cos(A,C), cos(B,C)]. Real mode ({mode:'real', real: vectors_sample.json}): the 15 pairwise cosines of the real 384-d sentence vectors, row by row. */
  function compute(inp) {
    if (inp.mode === 'real') { const E = inp.real.sentences.map(s => s[inp.space || 'embedding_raw']), out = []; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const n = Math.sqrt(E[i].reduce((a, x) => a + x * x, 0) * E[j].reduce((a, x) => a + x * x, 0)); out.push(E[i].reduce((a, x, k) => a + x * E[j][k], 0) / n); } return out; }
    const e = inp.texts.map(t => embed(t, inp.vocab, inp.pooling));
    return [cosine(e[0], e[1]), cosine(e[0], e[2]), cosine(e[1], e[2])];
  }
  const jaccard = (a, b) => { const x = new Set(tokens(a)), y = new Set(tokens(b)); let i = 0; x.forEach(w => { if (y.has(w)) i++; }); return i / (x.size + y.size - i); };

  /* invented background sentences: 3 clusters x 10, made from fixed word lists (deterministic) */
  function cloudTexts() {
    const sets = [['cat', 'dog', 'kitten', 'puppy', 'sat', 'ran', 'barked', 'slept', 'mat', 'rug', 'sofa', 'carpet'],
                  ['stock', 'prices', 'fell', 'rose', 'shares', 'bank', 'loan', 'rates', 'dropped'],
                  ['storm', 'rain', 'wind', 'city', 'river', 'flooded', 'fell', 'on']];
    const out = []; let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    sets.forEach(ws => { for (let i = 0; i < 10; i++) { const n = 3 + Math.floor(rnd() * 3), t = []; for (let j = 0; j < n; j++) t.push(ws[Math.floor(rnd() * ws.length)]); out.push(t.join(' ')); } });
    return out;
  }

  /* PCA of a list of 3-D points -> two orthonormal axes (Jacobi eigen of the 3x3 covariance) */
  function pca(P) {
    const n = P.length, m = [0, 0, 0]; P.forEach(p => { for (let k = 0; k < 3; k++) m[k] += p[k] / n; });
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    P.forEach(p => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - m[i]) * (p[j] - m[j]) / n; });
    let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 30; it++) {
      let p = 0, q = 1, mx = 0;
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(C[i][j]) > mx) { mx = Math.abs(C[i][j]); p = i; q = j; }
      if (mx < 1e-12) break;
      const th = 0.5 * Math.atan2(2 * C[p][q], C[q][q] - C[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const a = C[k][p], b = C[k][q]; C[k][p] = c * a - s * b; C[k][q] = s * a + c * b; }
      for (let k = 0; k < 3; k++) { const a = C[p][k], b = C[q][k]; C[p][k] = c * a - s * b; C[q][k] = s * a + c * b; }
      for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
    }
    const idx = [0, 1, 2].sort((a, b) => C[b][b] - C[a][a]);
    return { mean: m, axes: idx.map(i => [V[0][i], V[1][i], V[2][i]]), var: idx.map(i => C[i][i]) };
  }

  const PRESETS = {
    'toy example (default)': defaults,
    'break it: negation': { vocab: BREAK_VOCAB, texts: ['the drug is safe', 'the drug is not safe', 'stock prices fell'], pooling: 'mean' },
    'first token only': { vocab: VOCAB, texts: defaults.texts.slice(), pooling: 'first' },
  };

  function mount(el) {
    const K = DemoKit, scriptSrc = (document.currentScript && document.currentScript.src) || (function () { const s = document.querySelector('script[src*="embeddings.js"]'); return s ? s.src : location.href; })();
    let st = JSON.parse(JSON.stringify(defaults)), mode = 'pca', view = '3d', yaw = 0.6, pitch = 0.35, three = null, src = 'toy', real = null, pa = 0, pb = 1, loading = false;
    const HEX = [0x3cc7b4, 0x7c9cff, 0xff8a65, 0xf2a93b, 0xc28bff, 0xe9ecf2], COL = ['var(--he)', 'var(--k12)', 'var(--warn)', 'var(--ai)', 'var(--both)', 'var(--text)'];
    const tnames = ['A', 'B', 'C'], rnames = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const NAMES = () => (src === 'real' ? rnames : tnames);
    const shell = K.shell(el, 'Text becomes a point',
      'Real example (default): six real sentences from Wikipedia, embedded by a real model (all-MiniLM-L6-v2, 384 numbers each). Pick two and read their cosine. Drag the 3-D view. "Toy example" shows the mechanics (mean pooling) with invented 3-number word vectors you can edit.');
    const rtl = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    const srcReal = K.el('button', {}, 'Real example'), srcToy = K.el('button', {}, 'Toy example (break it)');
    srcReal.addEventListener('click', () => { if (real) { src = 'real'; render(); } }); srcToy.addEventListener('click', () => { src = 'toy'; render(); });
    const srcRow = K.el('div', { class: 'row' }, srcReal, srcToy);

    /* toy controls */
    const inputs = tnames.map((n, i) => { const inp = K.el('input', { type: 'text', value: st.texts[i], 'aria-label': 'sentence ' + n, style: 'flex:1 1 220px;min-width:0;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:inherit' });
      inp.addEventListener('input', () => { st.texts[i] = inp.value; render(); }); return K.el('div', { class: 'row', style: 'flex-wrap:nowrap' }, K.el('b', { style: `color:${COL[i]};width:1.2em` }, n), inp); });
    const poolBtn = K.el('button', { 'aria-pressed': 'false' }, 'pooling: mean');
    poolBtn.addEventListener('click', () => { st.pooling = st.pooling === 'mean' ? 'first' : 'mean'; render(); });
    const presetRow = K.el('div', { class: 'row' }, poolBtn,
      ...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = JSON.parse(JSON.stringify(PRESETS[k])); inputs.forEach((d, i) => { d.lastChild.value = st.texts[i]; }); buildWords(); render(); }); return b; }));
    const wordBox = K.el('details', {}, K.el('summary', { style: 'cursor:pointer;color:var(--muted);font-size:13px' }, 'word vectors (editable, invented)'), K.el('div', {}));
    function buildWords() {
      const t = K.el('table', {}); t.append(K.el('tr', {}, ...['word', 'dim 1', 'dim 2', 'dim 3'].map(h => K.el('th', {}, h))));
      Object.keys(st.vocab).forEach(w => { const r = K.el('tr', {}, K.el('td', {}, w));
        for (let k = 0; k < 3; k++) { const i = K.el('input', { type: 'number', step: '0.05', value: st.vocab[w][k], 'aria-label': `${w} dim ${k + 1}`, style: 'width:62px' });
          i.addEventListener('input', () => { const v = parseFloat(i.value); if (Number.isFinite(v)) { st.vocab[w][k] = v; render(); } }); r.append(K.el('td', {}, i)); }
        t.append(r); });
      wordBox.lastChild.replaceChildren(t);
    }
    const toyBox = K.el('div', {}, ...inputs, presetRow, wordBox);

    /* real controls */
    const selA = K.el('select', { 'aria-label': 'first sentence' }), selB = K.el('select', { 'aria-label': 'second sentence' });
    selA.addEventListener('change', () => { pa = +selA.value; render(); }); selB.addEventListener('change', () => { pb = +selB.value; render(); });
    const spaceBtn = K.el('button', { 'aria-pressed': 'false' }, 'vectors: raw (as the model outputs)');
    let space = 'embedding_raw'; spaceBtn.addEventListener('click', () => { space = space === 'embedding_raw' ? 'embedding_normalized' : 'embedding_raw'; render(); });
    const realList = K.el('div', { style: 'font-size:13px;color:var(--muted)' });
    const realBox = K.el('div', {}, K.el('div', { class: 'row' }, K.el('label', {}, 'compare ', selA), K.el('label', {}, 'with ', selB), spaceBtn), realList);

    const modeBtn = K.el('button', {}, 'flat view'), viewBtn = K.el('button', {}, '2-D only');
    modeBtn.addEventListener('click', () => { mode = mode === 'pca' ? 'raw' : 'pca'; render(); });
    viewBtn.addEventListener('click', () => { view = view === '3d' ? '2d' : '3d'; if (view === '3d') ensure3d(); render(); });
    const viewRow = K.el('div', { class: 'row' }, modeBtn, viewBtn);

    const out = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), caveat = K.el('div', { style: 'font-size:12px;color:var(--faint);margin-top:6px' });
    const stage = K.el('div', { style: 'position:relative;width:100%;max-width:640px;aspect-ratio:1/1;max-height:420px;background:var(--panel2);border-radius:8px;overflow:hidden;touch-action:none;margin:8px 0' });
    const canvasHost = K.el('div', { style: 'position:absolute;inset:0', tabindex: 0, role: 'img', 'aria-label': 'three-dimensional embedding space with the highlighted sentence points' });
    const svgHost = K.el('div', { style: 'position:absolute;inset:0;display:none' });
    const tip = K.el('div', { style: 'position:absolute;left:8px;bottom:6px;font-size:12px;color:var(--muted);pointer-events:none' }, '');
    stage.append(canvasHost, svgHost, tip);
    shell.append(K.el('div', {}, srcRow, realBox, toyBox, viewRow, stage, out, formula, caveat));

    const cloud = cloudTexts();
    function points() {
      if (src === 'real' && real) return { bg: [], main: real.sentences.map((s, i) => ({ t: s.text, p: s.pca3.map(x => x * 0.55), n: rnames[i] })) };
      const V = Object.assign({}, EXTRA, st.vocab);
      return { bg: cloud.map(t => ({ t, p: embed(t, V, 'mean') })), main: st.texts.map((t, i) => ({ t, p: embed(t, st.vocab, st.pooling), n: tnames[i] })) };
    }
    function project(p, d) {
      if (src === 'real') return p.slice();
      if (mode === 'raw') return [p[0] * 2 - 0.9, p[1] * 2 - 0.9, p[2] * 2 - 0.9];
      const q = [p[0] - d.mean[0], p[1] - d.mean[1], p[2] - d.mean[2]];
      return [dot(q, d.axes[0]) * 2.2, dot(q, d.axes[1]) * 2.2, 0];
    }
    const flat = () => src === 'real' || mode === 'pca';

    function draw2d(P, pr) {
      const S = 300, c = S / 2, svg = K.svg('svg', { viewBox: `0 0 ${S} ${S}`, width: '100%', height: '100%', role: 'img', 'aria-label': 'two-dimensional view of the embedding space' });
      const X = v => c + v[0] * 110, Y = v => c - (src !== 'real' && mode === 'raw' ? v[2] : v[1]) * 110;
      svg.append(K.svg('line', { x1: 0, y1: c, x2: S, y2: c, stroke: 'var(--line)' }), K.svg('line', { x1: c, y1: 0, x2: c, y2: S, stroke: 'var(--line)' }));
      svg.append(K.svg('text', { x: 6, y: 14, style: 'fill:var(--faint);font-size:10px' }, src === 'real' ? 'x, y = first two PCA directions (fitted on 138 passages)' : mode === 'raw' ? 'x = dim 1, y = dim 3 (dim 2 hidden)' : 'x, y = the two directions with most spread (PCA)'));
      P.bg.forEach((b, i) => { const v = pr.bg[i]; svg.append(K.svg('circle', { cx: X(v), cy: Y(v), r: 4, fill: 'var(--faint)', 'fill-opacity': 0.55 }, K.svg('title', {}, b.t))); });
      P.main.forEach((m, i) => { const v = pr.main[i], sel = src !== 'real' || i === pa || i === pb;
        svg.append(K.svg('circle', { cx: X(v), cy: Y(v), r: sel ? 8 : 5, fill: COL[i], 'fill-opacity': sel ? 1 : 0.5, stroke: 'var(--text)', 'stroke-width': sel ? 1.5 : 0 }, K.svg('title', {}, m.t)));
        svg.append(K.svg('text', { x: X(v) + 11, y: Y(v) - 8, style: `fill:${COL[i]};font-weight:700;font-size:13px` }, m.n)); });
      svgHost.replaceChildren(svg);
    }

    function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
    async function ensure3d() {
      if (three || three === false || loading) return; loading = true;
      if (!webgl()) { three = false; view = '2d'; tip.textContent = 'WebGL unavailable: showing the 2-D view'; render(); return; }
      try {
        const T = await import(new URL('../../_demo-kit/vendor/three.module.js', scriptSrc).href);
        const r = new T.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setClearColor(0x000000, 0);
        canvasHost.append(r.domElement); r.domElement.style.cssText = 'width:100%;height:100%;display:block';
        const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 50); cam.position.set(0, 0, 4.2);
        const grp = new T.Group(); scene.add(grp);
        const ax = (a, b, c) => new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: c }));
        grp.add(ax(new T.Vector3(-1.2, 0, 0), new T.Vector3(1.2, 0, 0), 0x3a4252), ax(new T.Vector3(0, -1.2, 0), new T.Vector3(0, 1.2, 0), 0x3a4252), ax(new T.Vector3(0, 0, -1.2), new T.Vector3(0, 0, 1.2), 0x3a4252));
        three = { T, r, scene, cam, grp, bg: [], main: [], lines: [] };
        const sph = new T.SphereGeometry(1, 16, 12);
        for (let i = 0; i < cloud.length; i++) { const m = new T.Mesh(sph, new T.MeshBasicMaterial({ color: 0x68707f, transparent: true, opacity: 0.7 })); m.scale.setScalar(0.035); grp.add(m); three.bg.push(m); }
        for (let i = 0; i < 6; i++) { const m = new T.Mesh(sph, new T.MeshBasicMaterial({ color: HEX[i] })); m.scale.setScalar(0.075); grp.add(m); three.main.push(m);
          const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: HEX[i] })); grp.add(l); three.lines.push(l); }
        three.tags = COL.map((c, i) => { const d = K.el('div', { style: `position:absolute;font-weight:700;font-size:13px;color:${c};pointer-events:none;text-shadow:0 0 3px #000` }, ''); stage.append(d); return d; });
        new ResizeObserver(() => draw()).observe(stage);
        wire3d(); render();
      } catch (e) { three = false; view = '2d'; tip.textContent = '3-D could not load (' + e.message + '): showing the 2-D view'; render(); }
    }
    let cur = null, anim = 0;
    function draw() {
      if (!three || view !== '3d') return;
      const w = canvasHost.clientWidth || 300, h = canvasHost.clientHeight || 300;
      three.r.setSize(w, h, false); three.cam.aspect = w / h; three.cam.updateProjectionMatrix();
      if (flat() && src !== 'real') three.grp.rotation.set(pitch * 0.4, yaw * 0.4, 0); else three.grp.rotation.set(pitch, yaw, 0);
      three.r.render(three.scene, three.cam);
      if (cur) cur.main.forEach((v, i) => { const t = three.tags[i]; if (!three.main[i].visible) { t.style.display = 'none'; return; } t.style.display = '';
        const p = new three.T.Vector3(...v).applyEuler(three.grp.rotation).project(three.cam); t.textContent = NAMES()[i]; t.style.left = ((p.x + 1) / 2 * w + 10) + 'px'; t.style.top = ((1 - p.y) / 2 * h - 20) + 'px'; });
    }
    function setPos(pr) {
      const nm = pr.main.length, from = three.main.map(m => m.position.toArray()), fromBg = three.bg.map(m => m.position.toArray());
      three.main.forEach((m, i) => { m.visible = i < nm; three.lines[i].visible = i < nm; m.scale.setScalar(src === 'real' && i !== pa && i !== pb ? 0.05 : 0.075); });
      three.bg.forEach((m, i) => { m.visible = i < pr.bg.length; });
      const apply = k => {
        pr.bg.forEach((p, i) => three.bg[i].position.set(...[0, 1, 2].map(j => fromBg[i][j] + (p[j] - fromBg[i][j]) * k)));
        pr.main.forEach((q, i) => { const p = [0, 1, 2].map(j => from[i][j] + (q[j] - from[i][j]) * k); three.main[i].position.set(...p);
          three.lines[i].geometry.setFromPoints([new three.T.Vector3(), new three.T.Vector3(...p)]); });
        cur = { main: three.main.map(m => m.position.toArray()) }; draw();
      };
      cancelAnimationFrame(anim);
      if (rtl) return apply(1);
      const t0 = performance.now(); (function step(now) { const k = Math.min(1, (now - t0) / 450); apply(k * (2 - k)); if (k < 1) anim = requestAnimationFrame(step); })(t0);
    }
    function wire3d() {
      let d = null;
      canvasHost.addEventListener('pointerdown', e => { d = [e.clientX, e.clientY]; canvasHost.setPointerCapture(e.pointerId); });
      canvasHost.addEventListener('pointermove', e => { if (!d) return; yaw += (e.clientX - d[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - d[1]) * 0.01)); d = [e.clientX, e.clientY]; draw(); });
      const up = () => { d = null; }; canvasHost.addEventListener('pointerup', up); canvasHost.addEventListener('pointercancel', up);
      canvasHost.addEventListener('keydown', e => { const m = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (!m) return; e.preventDefault(); yaw += m[0]; pitch = Math.max(-1.4, Math.min(1.4, pitch + m[1])); draw(); });
    }

    let lastTxt = {};
    const cell = (key, text, cls) => { const td = K.el('td', { class: 'num ' + (cls || '') }, text); if (lastTxt[key] !== undefined && lastTxt[key] !== text) K.flash(td); lastTxt[key] = text; return td; };
    function renderReal() {
      const S = real.sentences, f = x => K.fmt(x, 3), E = space === 'embedding_raw' ? 'embedding_raw' : 'embedding_normalized';
      const a = S[pa][E], b = S[pb][E], d = a.reduce((s, x, k) => s + x * b[k], 0), na = Math.sqrt(a.reduce((s, x) => s + x * x, 0)), nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
      const l2 = Math.sqrt(a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0)), c = d / (na * nb);
      spaceBtn.textContent = space === 'embedding_raw' ? 'vectors: raw (as the model outputs)' : 'vectors: scaled to length 1'; spaceBtn.setAttribute('aria-pressed', String(space !== 'embedding_raw'));
      const t = K.el('table', {}); t.append(K.el('tr', {}, ...['', ...rnames].map(h => K.el('th', {}, h))));
      S.forEach((si, i) => { const r = K.el('tr', {}, K.el('td', { style: `color:${COL[i]};font-weight:700` }, rnames[i]));
        S.forEach((sj, j) => { const v = sj === si ? 1 : (function () { const x = si.embedding_raw, y = sj.embedding_raw; return x.reduce((s, q, k) => s + q * y[k], 0) / (Math.hypot(...x) * Math.hypot(...y)); })();
          const td = cell(`m${i}${j}`, f(v), (i === pa && j === pb) || (i === pb && j === pa) ? 'good' : ''); r.append(td); }); t.append(r); });
      out.replaceChildren(t);
      formula.textContent = `${rnames[pa]} vs ${rnames[pb]}  (${real.dim} numbers each, vectors ${space === 'embedding_raw' ? 'raw' : 'scaled to length 1'})\n` +
        `dot      a.b = ${f(d)}\n|a| = ${f(na)}   |b| = ${f(nb)}\ncosine   a.b / (|a| |b|) = ${f(d)} / (${f(na)} * ${f(nb)}) = ${f(c)}\nL2       |a - b| = ${f(l2)}`;
      realList.replaceChildren(...S.map((s, i) => K.el('div', { style: 'margin:3px 0' }, K.el('b', { style: `color:${COL[i]}` }, rnames[i]), `  [${s.passage}${s.article ? ', ' + s.article : ''}] `, s.text.length > 150 ? s.text.slice(0, 147) + '...' : s.text)));
      caveat.textContent = 'Real vectors from ' + real.model + '. Only 6 sentences, chosen by the pack author (not a benchmark), from the demo corpus of 138 Wikipedia passages (CC BY-SA 4.0, see _real-examples/README.md). The 3-D picture is a PCA fitted on the 138 passages; its first 3 directions keep only about ' + Math.round(real.pca_explained_variance_ratio_first3.reduce((s, x) => s + x, 0) * 100) + '% of the variance, so distances in the picture are NOT the true distances: read the cosine table, not the picture. The raw vectors have different lengths, so dot product and L2 on them differ from cosine; the model normally normalises them.';
    }
    function renderToy() {
      poolBtn.textContent = 'pooling: ' + (st.pooling === 'mean' ? 'mean (all tokens)' : 'first token only'); poolBtn.setAttribute('aria-pressed', String(st.pooling !== 'mean'));
      const res = compute(st), e = st.texts.map(t => embed(t, st.vocab, st.pooling));
      const unk = st.texts.map(t => tokens(t).filter(w => !st.vocab[w]));
      const rows = [['A vs B', res[0], jaccard(st.texts[0], st.texts[1])], ['A vs C', res[1], jaccard(st.texts[0], st.texts[2])], ['B vs C', res[2], jaccard(st.texts[1], st.texts[2])]];
      const t = K.el('table', {}); t.append(K.el('tr', {}, ...['pair', 'cosine of the embeddings', 'shared words (Jaccard)'].map(h => K.el('th', {}, h))));
      rows.forEach(([n, c, j]) => t.append(K.el('tr', {}, K.el('td', {}, n), cell(n, K.fmt(c, 3), c > 0.9 ? 'good' : c < 0.5 ? 'bad' : ''), K.el('td', { class: 'num' }, K.fmt(j, 2)))));
      out.replaceChildren(t, ...unk.map((u, i) => u.length ? K.el('div', { class: 'bad', style: 'font-size:13px' }, `sentence ${tnames[i]}: no vector for "${u.join('", "')}" (counted as zero)`) : ''));
      const f = x => K.fmt(x, 3), n0 = tokens(st.texts[0]).length;
      formula.textContent = `e(A) = ${st.pooling === 'mean' ? `sum of ${n0} token vectors / ${n0}` : 'vector of the first token'} = [${e[0].map(f).join(', ')}]\n` +
        `e(B) = [${e[1].map(f).join(', ')}]   e(C) = [${e[2].map(f).join(', ')}]\ncos(A,B) = e(A).e(B) / (|e(A)| |e(B)|) = ${f(res[0])}`;
      caveat.textContent = 'Toy: all vectors are INVENTED 3-number word vectors, not model output. The picture shows mechanics (pool, then compare), not what a real model produces.';
    }

    function render() {
      srcReal.setAttribute('aria-pressed', String(src === 'real')); srcToy.setAttribute('aria-pressed', String(src === 'toy'));
      realBox.style.display = src === 'real' ? '' : 'none'; toyBox.style.display = src === 'toy' ? '' : 'none'; modeBtn.style.display = src === 'toy' ? '' : 'none';
      modeBtn.textContent = mode === 'pca' ? 'raw view (dims 1-3)' : 'flat view (PCA)'; viewBtn.textContent = view === '3d' ? '2-D only' : (three === false ? '3-D unavailable' : '3-D view');
      if (src === 'real') renderReal(); else renderToy();
      const P = points(), all = P.bg.map(b => b.p).concat(P.main.map(m => m.p)), basis = src === 'real' ? null : pca(all);
      const pr = { bg: P.bg.map(b => project(b.p, basis)), main: P.main.map(m => project(m.p, basis)) };
      const is3 = view === '3d' && three;
      canvasHost.style.display = is3 ? '' : 'none'; svgHost.style.display = is3 ? 'none' : '';
      if (three) three.tags.forEach(tg => { if (!is3) tg.style.display = 'none'; });
      if (is3) setPos(pr); else draw2d(P, pr);
    }
    buildWords(); render();
    ensure3d();
    const base = new URL('../../_real-examples/data/', scriptSrc).href;
    Promise.all([fetch(base + 'vectors_sample.json').then(r => r.json()), fetch(base + 'corpus.json').then(r => r.json()).catch(() => null)]).then(([v, c]) => {
      if (c) { const by = {}; (c.passages || c).forEach && (c.passages || c).forEach(p => { by[p.id] = p; }); v.sentences.forEach(s => { const p = by[s.passage]; if (p) s.article = p.article; }); }
      real = v; src = 'real'; selA.replaceChildren(...v.sentences.map((s, i) => K.el('option', { value: i }, rnames[i]))); selB.replaceChildren(...v.sentences.map((s, i) => K.el('option', { value: i }, rnames[i]))); selA.value = pa; selB.value = pb; render();
    }).catch(e => { src = 'toy'; tip.textContent = 'real data could not load (' + e.message + '): toy example'; render(); });
  }

  const api = { defaults, compute, mount, embed, pca, PRESETS };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['embeddings'] = api;
})(this);
