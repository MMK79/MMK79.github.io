/* Real example (default): the real pack in Presentations/_real-examples/graph (Leiden communities + real LLM reports, 4 real local-search contexts, 2 real map-reduce runs). The pack IMITATES Microsoft GraphRAG, it is not its code.
   Toy example (break it): the invented graph below.
   Microsoft GraphRAG: local search (entities + neighbours + text units + community reports, optional chat history, one fixed-size context window, 1 LLM call) vs global search (map over community summaries, reduce to one answer).
   Toy graph: 8 communities x 4 entities (invented). The LLM step is the precomputed helpfulness column h (editable). 3D with three.js (lazy, pinned copy in _demo-kit/vendor), 2D SVG fallback. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const SUMM = [['C1', 900, 70], ['C2', 1200, 85], ['C3', 800, 0], ['C4', 1100, 40], ['C5', 700, 90], ['C6', 1000, 0], ['C7', 900, 55], ['C8', 600, 20]];
  const defaults = { summ: SUMM, chunk: 2000, ans: 150, budget: 450 };
  const TU_TOKENS = 120;      // invented: every entity has one linked text unit of 120 tokens

  /* PURE. Global search, map-reduce arithmetic. Summaries are packed in order into chunks of at most `chunk` tokens
     (the paper shuffles first; we keep the order so the example is reproducible); a chunk's score is the best h among its summaries (our simplification). */
  function plan(inp) {
    const chunks = []; let cur = [], t = 0;
    for (const s of inp.summ) {
      if (cur.length && t + s[1] > inp.chunk) { chunks.push(cur); cur = []; t = 0; }
      cur.push(s); t += s[1];
    }
    if (cur.length) chunks.push(cur);
    const partial = chunks.map((ch, i) => ({ i: i + 1, ids: ch.map(s => s[0]), tokens: ch.reduce((a, s) => a + s[1], 0), h: Math.max(...ch.map(s => s[2])) }));
    const sorted = partial.filter(p => p.h > 0).sort((a, b) => b.h - a.h || a.i - b.i);
    const kept = []; let used = 0;
    for (const p of sorted) if (used + inp.ans <= inp.budget) { kept.push(p.i); used += inp.ans; }
    return { chunks, partial, sorted, kept, used };
  }
  function compute(inp) {
    const p = plan(inp);
    return { total_summary_tokens: inp.summ.reduce((a, s) => a + s[1], 0), map_calls: p.chunks.length, llm_calls: p.chunks.length + 1, kept_chunks: p.kept, reduce_context_tokens: p.used };
  }

  /* toy graph: community k (1..8) has entities ka kb kc kd; intra edges a-b b-c c-d a-c; ten bridges between communities */
  const COMM = SUMM.map(s => s[0]);
  const ENT = []; COMM.forEach((c, k) => 'abcd'.split('').forEach(l => ENT.push((k + 1) + l)));
  const EDGES = [];
  for (let k = 1; k <= 8; k++) [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'c']].forEach(([x, y]) => EDGES.push([k + x, k + y]));
  [['1b', '2a'], ['2b', '3a'], ['3b', '4a'], ['5b', '6a'], ['6b', '7a'], ['7b', '8a'], ['1d', '5a'], ['2c', '6b'], ['3c', '7b'], ['4d', '8a']].forEach(e => EDGES.push(e));
  const ADJ = {}; EDGES.forEach(([a, b]) => { (ADJ[a] ||= new Set()).add(b); (ADJ[b] ||= new Set()).add(a); });
  const commOf = e => +e[0] - 1;
  /* PURE. Local search context for one matched entity: the entity, its 1-hop neighbours, one text unit each, and the community report of every community they belong to.
     All of it is packed into ONE context window of fixed size; the exact split between the parts is NOT evidenced in a primary source (GraphRAG docs describe the dataflow only), so we show only the text-unit tokens (invented 120 each) and the report count. */
  function local(seed) {
    const ents = [seed, ...[...ADJ[seed]].sort()];
    return { entities: ents, text_units: ents.length, tokens: ents.length * TU_TOKENS, llm_calls: 1, communities: [...new Set(ents.map(commOf))].length, reports: [...new Set(ents.map(commOf))].sort((a, b) => a - b).map(k => COMM[k]) };
  }
  // 3D layout (invented, only for the picture)
  const CPOS = COMM.map((_, k) => { const col = k % 4, row = Math.floor(k / 4); return [(col - 1.5) * 1.9, (0.5 - row) * 1.7, ((col + row) % 2 ? 0.9 : -0.9)]; });
  const OFF = { a: [-0.4, 0.35, 0.3], b: [0.4, 0.35, -0.3], c: [0.4, -0.35, 0.3], d: [-0.4, -0.35, -0.3] };
  const EPOS = {}; ENT.forEach(e => { const c = CPOS[commOf(e)], o = OFF[e[1]]; EPOS[e] = [c[0] + o[0], c[1] + o[1], c[2] + o[2]]; });
  const CHUNKCOL = ['#7C9CFF', '#3CC7B4', '#C28BFF', '#F2A93B', '#E9ECF2', '#98A0B0'];

  function mountToy(el) {
    const K = DemoKit;
    let st = { mode: 'global', summ: SUMM.map(s => s.slice()), chunk: 2000, ans: 150, budget: 450, seed: '2c', yaw: 0.5, pitch: 0.25, scale: 1 };
    const shell = K.shell(el, 'Microsoft GraphRAG: local vs global search',
      'Drag the picture to turn it (3D). Local: click an entity (or use the list) and see what one LLM call receives. Global: edit tokens and scores, move chunk size and budget, and count the LLM calls.');
    shell.append(K.el('style', {}, '@media(max-width:600px){.demo table{font-size:11px}.demo td,.demo th{padding:3px 3px}.demo table input{width:3.2em}}'));
    const modeBtns = ['local', 'global'].map(m => { const b = K.el('button', {}, m + ' search'); b.addEventListener('click', () => { st.mode = m; refresh(); }); return b; });
    const view = K.el('div', { style: 'position:relative;width:100%;max-width:880px;height:340px;background:var(--panel2);border-radius:8px;overflow:hidden;touch-action:pan-y;cursor:grab' });
    const labels = K.el('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    const tilt = K.slider('tilt', -60, 60, 1, 14, v => { st.pitch = v / 57.3; draw(); });
    const seedSel = K.el('select', { 'aria-label': 'matched entity' }, ...ENT.map(e => K.el('option', { value: e }, e)));
    seedSel.value = st.seed; seedSel.addEventListener('change', () => { st.seed = seedSel.value; refresh(); });
    const localBox = K.el('div', {}, K.el('div', { class: 'row' }, 'entity matched by the question (embedding): ', seedSel));
    const localOut = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    localBox.append(localOut);
    // global controls
    const sChunk = K.slider('chunk size (tokens)', 500, 4000, 100, st.chunk, v => { st.chunk = v; refresh(); });
    const sBud = K.slider('reduce budget (tokens)', 150, 1500, 150, st.budget, v => { st.budget = v; refresh(); });
    const sScale = K.slider('corpus size x', 1, 100, 1, 1, v => { st.scale = v; refresh(); });
    const rows = SUMM.map((s, i) => {
      const tk = K.el('input', { type: 'number', min: 100, step: 100, value: s[1], 'aria-label': s[0] + ' tokens', style: 'width:80px' });
      const hh = K.el('input', { type: 'number', min: 0, max: 100, step: 5, value: s[2], 'aria-label': s[0] + ' helpfulness', style: 'width:64px' });
      const ch = K.el('td', { class: 'num' }), stt = K.el('td', {});
      tk.addEventListener('input', () => { st.summ[i][1] = Math.max(1, Number(tk.value) || 1); refresh(); });
      hh.addEventListener('input', () => { st.summ[i][2] = Math.min(100, Math.max(0, Number(hh.value) || 0)); refresh(); });
      return { tr: K.el('tr', {}, K.el('td', {}, s[0]), K.el('td', {}, tk), K.el('td', {}, hh), ch, stt), tk, hh, ch, stt };
    });
    const table = K.el('table', {}, K.el('tr', {}, ...['community', 'summary tokens', 'h (0-100)', 'chunk', 'outcome'].map(t => K.el('th', {}, t))), ...rows.map(r => r.tr));
    const tableWrap = K.el('details', { open: '' }, K.el('summary', {}, 'community summaries (the LLM score h is a precomputed, editable column)'), table);
    const presets = K.el('div', { class: 'row' });
    const preset = (name, fn) => { const b = K.el('button', {}, name); b.addEventListener('click', () => { fn(); syncInputs(); refresh(); }); presets.append(b); };
    const reset = () => { st.summ = SUMM.map(s => s.slice()); st.chunk = 2000; st.budget = 450; st.scale = 1; };
    preset('worked example', reset);
    preset('break it: a good summary scores 0', () => { reset(); st.summ[1][2] = 0; });
    preset('break it: corpus 50x larger', () => { reset(); st.scale = 50; });
    preset('tiny budget (150)', () => { reset(); st.budget = 150; });
    const globOut = K.el('div', { class: 'row', 'aria-live': 'polite', style: 'gap:18px' });
    const globFormula = K.el('div', { class: 'formula' });
    const globalBox = K.el('div', {}, presets, K.el('div', { class: 'row' }, sChunk.node, sBud.node, sScale.node), tableWrap, globOut, globFormula);
    view.append(labels);
    shell.append(K.el('div', { class: 'row' }, modeBtns), view, K.el('div', { class: 'row' }, tilt.node), localBox, globalBox);
    function syncInputs() { sChunk.set(st.chunk); sBud.set(st.budget); sScale.set(st.scale); rows.forEach((r, i) => { r.tk.value = st.summ[i][1]; r.hh.value = st.summ[i][2]; }); seedSel.value = st.seed; }

    /* ---- model: what to draw for the current state (shared by WebGL and the SVG fallback) ---- */
    function model() {
      const m = { nodes: [], edges: [], shells: [], tus: [], tags: [] };
      if (st.mode === 'local') {
        const L = local(st.seed), set = new Set(L.entities), nb = new Set([...ADJ[st.seed]]);
        ENT.forEach(e => m.nodes.push({ id: e, p: EPOS[e], c: e === st.seed ? '#F2A93B' : nb.has(e) ? '#3CC7B4' : '#68707F', r: set.has(e) ? 0.13 : 0.08, o: set.has(e) ? 1 : 0.45 }));
        EDGES.forEach(([a, b]) => { const on = (a === st.seed && nb.has(b)) || (b === st.seed && nb.has(a)); m.edges.push({ a: EPOS[a], b: EPOS[b], c: on ? '#3CC7B4' : '#242B38', o: on ? 1 : 0.7 }); });
        COMM.forEach((c, k) => m.shells.push({ p: CPOS[k], c: L.reports.includes(c) ? '#C28BFF' : '#98A0B0', o: L.reports.includes(c) ? 0.2 : 0.05 }));
        L.entities.forEach(e => m.tus.push({ p: EPOS[e].map((v, i) => v + [0.0, 0.2, 0.2][i]) }));
        COMM.forEach((c, k) => m.tags.push({ p: CPOS[k], t: L.reports.includes(c) ? c + ' report' : c, c: L.reports.includes(c) ? '#E9ECF2' : '#68707F' }));
      } else {
        const p = plan(st.summ.length ? { summ: st.summ, chunk: st.chunk, ans: st.ans, budget: st.budget } : defaults);
        const info = {}; p.partial.forEach(pp => pp.ids.forEach(id => { info[id] = pp; }));
        const keptSet = new Set(p.kept);
        const status = id => info[id].h === 0 ? 'zero' : keptSet.has(info[id].i) ? 'kept' : 'cut';
        ENT.forEach(e => { const id = COMM[commOf(e)], pp = info[id], s = status(id); m.nodes.push({ id: e, p: EPOS[e], c: CHUNKCOL[(pp.i - 1) % CHUNKCOL.length], r: 0.1, o: s === 'kept' ? 1 : 0.35 }); });
        EDGES.forEach(([a, b]) => m.edges.push({ a: EPOS[a], b: EPOS[b], c: '#242B38', o: 0.8 }));
        COMM.forEach((id, k) => { const pp = info[id], s = status(id); m.shells.push({ p: CPOS[k], c: s === 'zero' ? '#FF8A65' : CHUNKCOL[(pp.i - 1) % CHUNKCOL.length], o: s === 'kept' ? 0.22 : s === 'zero' ? 0.12 : 0.06 });
          m.tags.push({ p: CPOS[k], t: `${id} chunk ${pp.i}${s === 'kept' ? '' : s === 'zero' ? ' h=0' : ' cut'}`, c: s === 'kept' ? '#E9ECF2' : '#98A0B0' }); });
      }
      return m;
    }

    /* ---- renderer: WebGL (three.js, lazy) or SVG fallback ---- */
    let T = null, gl = null, svg = null;
    const rot = (p) => { const [x, y, z] = p, cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cx = Math.cos(st.pitch), sx = Math.sin(st.pitch); const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cx - z1 * sx, y * sx + z1 * cx]; };
    function drawSvg(m) {
      if (!svg) { svg = K.svg('svg', { viewBox: '0 0 880 340', role: 'img', 'aria-label': 'GraphRAG communities (2D fallback)', style: 'width:100%;height:100%' }); view.prepend(svg); }
      const P = p => { const [x, y, z] = rot(p), f = 1 / (1 - z * 0.08); return [440 + x * 105 * f, 170 - y * 105 * f]; };
      const out = [];
      m.shells.forEach(s => { const [x, y] = P(s.p); out.push(K.svg('circle', { cx: x, cy: y, r: 52, fill: s.c, opacity: s.o + 0.05 })); });
      m.edges.forEach(e => { const a = P(e.a), b = P(e.b); out.push(K.svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: e.c, 'stroke-width': 2, opacity: e.o })); });
      m.nodes.forEach(n => { const [x, y] = P(n.p); out.push(K.svg('circle', { cx: x, cy: y, r: n.r * 60, fill: n.c, opacity: n.o })); });
      m.tus.forEach(t => { const [x, y] = P(t.p); out.push(K.svg('rect', { x: x - 4, y: y - 4, width: 8, height: 8, fill: '#7C9CFF' })); });
      svg.replaceChildren(...out);
      labels.replaceChildren(...m.tags.map(t => { const [x, y] = P(t.p); const d = K.el('div', { style: `position:absolute;left:${x / 880 * 100}%;top:${(y + 40) / 340 * 100}%;transform:translate(-50%,0);font-size:11px;color:${t.c};white-space:nowrap` }, t.t); return d; }));
    }
    function drawGl(m) {
      const { THREE, renderer, camera, group, objs } = gl;
      const col = c => new THREE.Color(c);
      m.shells.forEach((s, i) => { const o = objs.shells[i]; o.material.color = col(s.c); o.material.opacity = s.o; });
      m.nodes.forEach((n, i) => { const o = objs.nodes[i]; o.material.color = col(n.c); o.material.opacity = n.o; o.scale.setScalar(n.r / 0.1); });
      m.edges.forEach((e, i) => { const o = objs.edges[i]; o.material.color = col(e.c); o.material.opacity = e.o; });
      objs.tus.forEach((o, i) => { const t = m.tus[i]; o.visible = !!t; if (t) o.position.set(...t.p); });
      group.rotation.set(st.pitch, st.yaw, 0, 'XYZ'); group.updateMatrixWorld(true);
      renderer.render(gl.scene, camera);
      const w = view.clientWidth, h = view.clientHeight || 340, v = new THREE.Vector3();
      labels.replaceChildren(...m.tags.map(t => { v.set(...t.p).applyMatrix4(group.matrixWorld).project(camera);
        return K.el('div', { style: `position:absolute;left:${(v.x * 0.5 + 0.5) * w}px;top:${(-v.y * 0.5 + 0.5) * h + 26}px;transform:translate(-50%,0);font-size:11px;color:${t.c};white-space:nowrap` }, t.t); }));
    }
    function draw() { const m = model(); if (gl) drawGl(m); else drawSvg(m); }

    function size() { if (!gl) return; const w = Math.max(280, view.clientWidth), h = view.clientHeight || 340; gl.renderer.setSize(w, h, false); gl.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; gl.camera.aspect = w / h; gl.camera.updateProjectionMatrix(); draw(); }
    async function initGl() {
      let THREE;
      try {
        const url = (window.THREE_URL) || new URL('../../_demo-kit/vendor/three.module.js', SCRIPT_SRC || location.href).href;
        THREE = await import(url);
        const canvas = document.createElement('canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 2, 0.1, 50); camera.position.set(0, 0, 6.6);
        const group = new THREE.Group(); scene.add(group);
        const objs = { nodes: [], edges: [], shells: [], tus: [] };
        const sph = new THREE.SphereGeometry(0.1, 14, 10), shellG = new THREE.SphereGeometry(0.95, 24, 16), box = new THREE.BoxGeometry(0.09, 0.09, 0.09);
        const mat = () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
        CPOS.forEach(p => { const o = new THREE.Mesh(shellG, mat()); o.position.set(...p); group.add(o); objs.shells.push(o); });
        EDGES.forEach(([a, b]) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...EPOS[a]), new THREE.Vector3(...EPOS[b])]); const o = new THREE.Line(g, new THREE.LineBasicMaterial({ transparent: true })); group.add(o); objs.edges.push(o); });
        ENT.forEach(e => { const o = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ transparent: true })); o.position.set(...EPOS[e]); o.userData.id = e; group.add(o); objs.nodes.push(o); });
        for (let i = 0; i < 6; i++) { const o = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x7C9CFF })); o.visible = false; group.add(o); objs.tus.push(o); }
        gl = { THREE, renderer, camera, group, scene, objs };
        svg = null; view.replaceChildren(canvas, labels); size();
        new ResizeObserver(size).observe(view);
        // click on an entity (local mode) = new seed
        const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
        canvas.addEventListener('click', ev => { if (moved > 4 || st.mode !== 'local') return; const r = canvas.getBoundingClientRect(); mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
          const hit = ray.intersectObjects(objs.nodes, false)[0]; if (hit) { st.seed = hit.object.userData.id; seedSel.value = st.seed; refresh(); } });
      } catch (err) { gl = null; view.dataset.fallback = '2D (WebGL unavailable)'; }
      draw();
    }
    // drag to turn (yaw only; tilt has its own slider so vertical page scroll still works on phones)
    let down = null, moved = 0;
    view.addEventListener('pointerdown', e => { down = { x: e.clientX, yaw: st.yaw }; moved = 0; view.style.cursor = 'grabbing'; });
    window.addEventListener('pointermove', e => { if (!down) return; moved = Math.abs(e.clientX - down.x); st.yaw = down.yaw + (e.clientX - down.x) / 120; draw(); });
    window.addEventListener('pointerup', () => { down = null; view.style.cursor = 'grab'; });

    /* ---- text outputs ---- */
    let lastCalls;
    function refresh() {
      modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['local', 'global'][i] === st.mode)));
      localBox.style.display = st.mode === 'local' ? '' : 'none'; globalBox.style.display = st.mode === 'global' ? '' : 'none';
      const L = local(st.seed);
      localOut.textContent = `matched entity ${st.seed}; its neighbours: ${L.entities.slice(1).join(', ')}\n` +
        `context candidates = ${L.entities.length} entities (+ their relationships) + ${L.text_units} text units x ${TU_TOKENS} tokens = ${L.tokens} tokens (invented size) + ${L.reports.length} community reports (${L.reports.join(', ')}) + optional chat history\n` +
        `all packed into ONE context window of fixed size (candidates are ranked and filtered to fit; the exact split is not given in a primary source, so no budget numbers are shown)\n` +
        `LLM calls: ${L.llm_calls} (does not depend on corpus size). The question must name or match an entity; a corpus-wide question has no seed.`;
      const inp = { summ: st.summ, chunk: st.chunk, ans: st.ans, budget: st.budget }, p = plan(inp), r = compute(inp);
      const info = {}; p.partial.forEach(pp => pp.ids.forEach(id => { info[id] = pp; }));
      rows.forEach((row, i) => { const id = st.summ[i][0], pp = info[id], z = st.summ[i][2] === 0, kept = p.kept.includes(pp.i);
        row.ch.textContent = `${pp.i} (best h ${pp.h})`; row.stt.textContent = pp.h === 0 ? 'chunk score 0: dropped' : kept ? 'kept for reduce' + (z ? ' (own h 0, chunk carried by a neighbour)' : '') : 'no room in budget'; row.stt.className = kept ? 'good' : 'bad'; });
      const big = Math.ceil(r.total_summary_tokens * st.scale / st.chunk) + 1;
      globOut.replaceChildren(
        K.el('span', {}, 'summary text: ', K.el('b', { class: 'num' }, r.total_summary_tokens.toLocaleString()), ' tokens'),
        K.el('span', {}, 'map calls: ', K.el('b', { class: 'num' }, r.map_calls)),
        K.el('span', {}, 'LLM calls (global): ', K.el('b', { class: 'num', id: 'calls' }, r.llm_calls), ' vs local: 1'),
        K.el('span', {}, 'kept chunks: ', K.el('b', { class: 'num' }, `[${r.kept_chunks.join(', ')}]`), ` using ${r.reduce_context_tokens} tokens`));
      if (lastCalls !== undefined && lastCalls !== r.llm_calls) K.flash(globOut.children[2]); lastCalls = r.llm_calls;
      globFormula.textContent = `chunks (map): ${p.partial.map(x => `#${x.i} [${x.ids.join('+')}] ${x.tokens} tok, best h ${x.h}`).join('  ')}\n` +
        `reduce: sorted by h = ${p.sorted.map(x => `#${x.i}(${x.h})`).join(' > ')}; each partial answer = ${st.ans} tokens, budget ${st.budget} -> keep ${r.kept_chunks.map(i => '#' + i).join(', ') || 'nothing'}\n` +
        `calls >= ceil(T_sum / T_chunk) + 1 = ceil(${r.total_summary_tokens}${st.scale > 1 ? ' x ' + st.scale : ''} / ${st.chunk}) + 1 = ${big}  (exact count for this table: ${r.llm_calls}${st.scale > 1 ? ', before scaling' : ''})` +
        (st.scale > 1 ? `\ncorpus ${st.scale}x larger: about ${big} calls per question. Local search would still be 1 call.` : '');
      draw();
    }
    refresh(); initGl();
  }

  /* ---------- Real example ---------- */
  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const box = K.shell(el, 'Real example: local and global search over a real graph',
      'Real data: 138 Wikipedia passages on machine learning, a 662-node graph an LLM extracted from them, 57 Leiden communities, LLM reports for the 15 largest. The pack\'s local and global search IMITATE Microsoft GraphRAG (Edge et al. 2024); they are not Microsoft\'s code, and the window split below is ours, untuned. Demo scale: 4 local questions, 2 global questions, one run each. No answer quality is judged here.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('graph/local_search.json'), get('graph/global_search.json'), get('graph/communities.json')]).then(([LS, GS, CM]) => {
      const title = {}; CM.reports.forEach(r => { title[r.id] = r; });
      const items = [...LS.questions.map(q => ({ kind: 'local', id: q.qid, q })), ...GS.questions.map(q => ({ kind: 'global', id: q.id, q }))];
      let cur = items[0];
      const sel = K.el('select', { 'aria-label': 'real question', style: 'max-width:100%' }, ...items.map((it, i) => K.el('option', { value: i }, `${it.kind} search, ${it.id}: ${it.q.question.slice(0, 60)}${it.q.question.length > 60 ? '...' : ''}`)));
      sel.addEventListener('change', () => { cur = items[+sel.value]; draw(); });
      const out = K.el('div', { 'aria-live': 'polite' });
      const bar = (parts, total) => K.el('div', { style: 'display:flex;width:100%;height:26px;border-radius:6px;overflow:hidden;background:var(--panel2);margin:6px 0' },
        ...parts.map(([n, v, c]) => K.el('div', { title: `${n}: ${v} of ${total} tokens`, style: `width:${v / total * 100}%;background:${c};font-size:11px;color:#0b0d12;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap` }, `${n} ${v}`)));
      const det = (sum, text) => K.el('details', {}, K.el('summary', {}, sum), K.el('div', { class: 'formula', style: 'white-space:pre-wrap;max-height:260px;overflow:auto' }, text));
      function drawLocal(q) {
        const sec = {}; q.context.split(/^## /m).slice(1).forEach(p => { const nl = p.indexOf('\n'); sec[p.slice(0, nl).trim()] = p.slice(nl + 1).trim(); });
        const U = q.est_tokens_used, B = q.window_tokens_budget, P = q.proportions;
        const goldIn = new Set(q.gold_in_context), reps = (sec['Community reports'].match(/^\[(c\d+)\]/gm) || []).map(x => x.slice(1, -1));
        const tuList = q.text_unit_ids.map(id => K.el('b', { style: 'margin-right:8px;color:' + (q.gold.includes(id) ? '#3CC7B4' : 'inherit') }, id + (q.gold.includes(id) ? ' (gold)' : '')));
        out.replaceChildren(
          K.el('div', { class: 'formula' }, `question ${q.qid}: ${q.question}\nseeds (entities linked to the question): ${q.seeds.join('; ')}\nONE fixed window of ${B} estimated tokens (words x 1.4, not a tokenizer). Split chosen by us, untuned: community reports ${P.community * 100}% / text units ${P.text * 100}% / entities + relationships ${P.graph * 100}%.`),
          bar([['reports', U.community, '#C28BFF'], ['text units', U.text, '#7C9CFF'], ['entities + relations', U.graph, '#3CC7B4'], ['free', B - q.est_tokens_total, '#242B38']], B),
          K.el('div', { class: 'formula' }, `used: ${U.community} + ${U.text} + ${U.graph} = ${q.est_tokens_total} of ${B} tokens (shares of the window: ${Math.round(P.community * B)} / ${Math.round(P.text * B)} / ${Math.round(P.graph * B)}).\n${q.n_community_reports} community reports (${reps.join(', ')}) + ${q.text_unit_ids.length} text units + ${q.n_entities} entities + ${q.n_relationships} relationships.\nLLM calls: 1 (no answer is generated in this pack).`),
          K.el('div', { class: 'row' }, 'text units packed (source passages): ', ...tuList),
          K.el('div', { class: goldIn.size === q.gold.length ? 'good' : 'bad' }, `gold passages ${q.gold.join(', ')}: ${q.gold.filter(g => goldIn.has(g)).join(', ') || 'none'} in the window` + (goldIn.size < q.gold.length ? ` (missing ${q.gold.filter(g => !goldIn.has(g)).join(', ')}). Gold covers only the passages we judged necessary.` : '.')),
          det('community reports in the window (real LLM reports)', sec['Community reports']),
          det('entities (' + q.n_entities + ')', sec['Entities']), det('relationships (' + q.n_relationships + ')', sec['Relationships']), det('sources: the text units', sec['Sources']));
      }
      function drawGlobal(q) {
        const maps = q.map_outputs.map(m => {
          const pts = m.points.map(pt => K.el('li', {}, K.el('b', { class: 'num', style: 'color:' + (pt.score >= 70 ? '#3CC7B4' : pt.score >= 40 ? '#F2A93B' : '#98A0B0') }, pt.score), ' ', pt.description));
          return K.el('details', { open: '' }, K.el('summary', {}, `map call ${m.chunk + 1}: ${m.report_ids.length} reports (${m.report_ids.map(id => id + ' ' + (title[id] ? title[id].title : '')).join('; ')}), ${m.est_tokens_in} est. tokens in, ${m.points.length} points`), K.el('ul', {}, ...pts));
        });
        out.replaceChildren(
          K.el('div', { class: 'formula' }, `global question ${q.id}: ${q.question}\nreports are shuffled (seed 42) into ${q.n_map_calls} chunks of about 1200 est. tokens; MAP = ${q.n_map_calls} LLM calls, each returns points with a helpfulness score 0-100; REDUCE = points sorted by score, zero scores dropped, filled up to 1500 est. tokens (${q.n_points_kept_for_reduce} of ${q.n_points} points fit), 1 more call.\nLLM calls: ${q.n_map_calls} + 1 = ${q.n_map_calls + 1} (local search: 1). Reduce used ${q.reduce_usage.prompt_tokens} prompt + ${q.reduce_usage.completion_tokens} completion tokens.`),
          ...maps,
          K.el('details', {}, K.el('summary', {}, `reduce input: ${q.kept_points.length} points sorted by score`), K.el('ol', {}, ...q.kept_points.map(pt => K.el('li', {}, `[${pt.score}, map call ${pt.chunk + 1}] ${pt.description}`)))),
          K.el('div', { class: 'formula', style: 'white-space:pre-wrap' }, 'reduce answer (real LLM output, quality not judged here):\n' + q.reduce_answer));
      }
      function draw() { cur.kind === 'local' ? drawLocal(cur.q) : drawGlobal(cur.q); }
      const cav = K.el('div', { class: 'formula' }, 'Honest limits: one run per question, LLM qwen3.7-plus; token counts are estimates (words x 1.4); the local split 20/50/30 and the map chunk size are our choices; Leiden splits by graph structure, so report titles overlap (the graph has near-duplicate nodes); gold labels cover only passages judged necessary; global questions have no gold. The "Toy example (break it)" keeps the 3D picture and the editable table.');
      body.replaceChildren(K.el('div', { class: 'row' }, sel), out, cav);
      draw();
    }).catch(e => { body.textContent = 'could not load the real-example pack (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); if (!r) window.dispatchEvent(new Event('resize')); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy);
    mountReal(real); mountToy(toy); show(true);
  }

  const api = { defaults, compute, mount, plan, local };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ms_local_global'] = api;
})(this);
