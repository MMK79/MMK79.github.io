/* Recall-latency (recall-QPS) trade-off curve: the Pareto frontier of an approximate index's settings.
   Default = Real example (real hnswlib sweeps + our own IVFADC run). Toy example (break it) = the catalogue example, draggable. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  // catalogue example: (recall, QPS)
  const defaults = { points: [
    { id: 'A', recall: 0.80, speed: 9000 }, { id: 'B', recall: 0.90, speed: 5000 }, { id: 'C', recall: 0.90, speed: 4000 },
    { id: 'D', recall: 0.95, speed: 2500 }, { id: 'E', recall: 0.93, speed: 2000 }] };

  /* PURE. i is dominated iff some j has recall_j >= recall_i AND speed_j >= speed_i and (recall_j, speed_j) != (recall_i, speed_i).
     Returns the ids of the non-dominated points (the frontier), in input order. "speed" is QPS (higher is better). */
  function compute(inp) {
    const P = inp.points;
    return P.filter(i => !P.some(j => j !== i && j.recall >= i.recall && j.speed >= i.speed && (j.recall !== i.recall || j.speed !== i.speed))).map(p => p.id);
  }
  /* PURE. Cheapest operating point: among points with recall >= target, the fastest one (ties: higher recall). null if none reaches the target. */
  function cheapest(points, target) {
    let best = null;
    for (const p of points) if (p.recall >= target - 1e-12 && (!best || p.speed > best.speed || (p.speed === best.speed && p.recall > best.recall))) best = p;
    return best;
  }
  function dominators(points, p) { return points.filter(j => j !== p && j.recall >= p.recall && j.speed >= p.speed && (j.recall !== p.recall || j.speed !== p.speed)); }

  /* ---------- chart ---------- */
  // pts: {id, recall, cost, col, tip}; front: Set of ids; opts: {logx, xlabel, target, chosen, xfmt, drag(id, recall, cost), step}
  function chart(K, pts, front, o) {
    const W = 640, H = 340, L = 52, R = 14, T = 12, B = 44;
    const costs = pts.map(p => p.cost), rec = pts.map(p => p.recall);
    let x0 = Math.min.apply(null, costs), x1 = Math.max.apply(null, costs);
    if (o.xrange) { x0 = o.xrange[0]; x1 = o.xrange[1]; }
    const lg = o.logx;
    const fx = c => lg ? Math.log(c) : c, a = fx(x0 * (lg ? 0.85 : 1) - (lg ? 0 : (x1 - x0) * 0.05)), b = fx(x1 * (lg ? 1.15 : 1) + (lg ? 0 : (x1 - x0) * 0.05));
    let y0 = o.yrange ? o.yrange[0] : Math.max(0, Math.floor(Math.min.apply(null, rec) * 20) / 20 - 0.05), y1 = o.yrange ? o.yrange[1] : 1.02;
    if (!o.yrange && y0 > 0.9) y0 = 0.9;
    const X = c => L + (fx(c) - a) / (b - a) * (W - L - R), Y = r => T + (1 - (r - y0) / (y1 - y0)) * (H - T - B);
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'recall against cost with Pareto frontier', style: 'width:100%;max-width:880px;height:auto;background:var(--panel2);border-radius:8px;touch-action:none' });
    // grid
    const yt = []; for (let r = Math.ceil(y0 * 20) / 20; r <= y1 + 1e-9; r += 0.05) yt.push(r);
    yt.forEach(r => { svg.append(K.svg('line', { x1: L, x2: W - R, y1: Y(r), y2: Y(r), stroke: 'var(--line)', 'stroke-width': 0.5, opacity: 0.5 }), K.svg('text', { x: L - 6, y: Y(r) + 3, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }, K.fmt(r, 2))); });
    const xt = o.xticks || []; xt.forEach(c => svg.append(K.svg('line', { x1: X(c), x2: X(c), y1: T, y2: H - B, stroke: 'var(--line)', 'stroke-width': 0.5, opacity: 0.5 }), K.svg('text', { x: X(c), y: H - B + 14, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, (o.xfmt || K.fmt)(c))));
    svg.append(K.svg('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, o.xlabel),
      K.svg('text', { x: 12, y: (T + H - B) / 2, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', transform: `rotate(-90 12 ${(T + H - B) / 2})` }, 'recall'));
    // target line
    if (o.target != null) svg.append(K.svg('line', { x1: L, x2: W - R, y1: Y(o.target), y2: Y(o.target), stroke: 'var(--ai)', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }),
      K.svg('text', { x: W - R - 2, y: Y(o.target) - 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--ai)' }, 'target recall ' + K.fmt(o.target, 3)));
    // frontier staircase (cost ascending, recall ascending)
    const fr = pts.filter(p => front.has(p.id)).sort((p, q) => p.cost - q.cost || p.recall - q.recall);
    if (fr.length) {
      let d = `M${X(fr[0].cost)},${Y(fr[0].recall)}`;
      for (let i = 1; i < fr.length; i++) d += ` L${X(fr[i].cost)},${Y(fr[i - 1].recall)} L${X(fr[i].cost)},${Y(fr[i].recall)}`;
      svg.append(K.svg('path', { d, fill: 'none', stroke: 'var(--he)', 'stroke-width': 2, opacity: 0.85 }));
    }
    // points: dominated first so frontier points sit on top
    const order = pts.slice().sort((p, q) => (front.has(p.id) ? 1 : 0) - (front.has(q.id) ? 1 : 0));
    order.forEach(p => {
      const f = front.has(p.id), ch = o.chosen === p.id, cx = X(p.cost), cy = Y(p.recall);
      const attrs = { cx, cy, r: f ? 6 : 4.5, fill: f ? p.col : 'none', stroke: f ? p.col : 'var(--faint)', 'stroke-width': f ? 1.5 : 1.5, tabindex: o.drag ? 0 : -1, style: o.drag ? 'cursor:grab' : '', 'data-id': p.id };
      if (!f) attrs['stroke-dasharray'] = '2 2';
      const c = K.svg('circle', attrs); c.append(K.svg('title', {}, p.tip));
      if (ch) svg.append(K.svg('circle', { cx, cy, r: 11, fill: 'none', stroke: 'var(--ai)', 'stroke-width': 2 }));
      svg.append(c);
      if (o.labels) svg.append(K.svg('text', { x: cx + 9, y: cy - 8, 'font-size': 12, fill: f ? 'var(--text)' : 'var(--faint)' }, p.id));
      if (o.drag) {
        const inv = (px, py) => { const r = svg.getBoundingClientRect(), sx = (px - r.left) / r.width * W, sy = (py - r.top) / r.height * H; const t = (sx - L) / (W - L - R) * (b - a) + a; return [lg ? Math.exp(t) : t, y0 + (1 - (sy - T) / (H - T - B)) * (y1 - y0)]; };
        c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); c.dataset.drag = '1'; });
        c.addEventListener('pointermove', e => { if (c.dataset.drag) { const [cc, rr] = inv(e.clientX, e.clientY); o.drag(p.id, rr, cc); } });
        c.addEventListener('pointerup', () => { delete c.dataset.drag; });
        c.addEventListener('keydown', e => {
          const m = { ArrowUp: [0.01, 1], ArrowDown: [-0.01, 1], ArrowRight: [0, 1.06], ArrowLeft: [0, 1 / 1.06] }[e.key]; if (!m) return; e.preventDefault();
          o.drag(p.id, p.recall + m[0], p.cost * m[1], true);
        });
      }
    });
    return svg;
  }
  function legend(K, items) { return K.el('div', { class: 'row', style: 'font-size:12px;gap:12px' }, items.map(([c, t, hollow]) => K.el('span', {}, K.el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px;${hollow ? 'border:1.5px dashed var(--faint)' : 'background:' + c}` }), t))); }
  const btn = (K, t, f) => { const b = K.el('button', { type: 'button' }, t); b.addEventListener('click', f); return b; };

  /* ---------- TOY ---------- */
  function mountToy(el) {
    const K = root.DemoKit;
    const shell = K.shell(el, 'Toy example (break it)', 'Invented numbers from the catalogue: five runs (recall, QPS). Drag a point (or focus it and use the arrow keys) and watch the frontier and the dominated points update. The x axis is latency = 1000 / QPS, so up and to the LEFT is better.');
    const st = { pts: defaults.points.map(p => ({ id: p.id, recall: p.recall, qps: p.speed })), target: 0.9, logx: false };
    const chartBox = K.el('div'), res = K.el('div', { class: 'result num', 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const sT = K.slider('target recall', 0.7, 1, 0.01, st.target, v => { st.target = v; render(); });
    const logB = K.el('button', { type: 'button', 'aria-pressed': 'false' }, 'log latency axis');
    logB.addEventListener('click', () => { st.logx = !st.logx; logB.setAttribute('aria-pressed', String(st.logx)); render(); });
    const set = arr => { st.pts = defaults.points.map((p, i) => ({ id: p.id, recall: p.recall, qps: arr ? arr[i] : p.speed })); render(); };
    shell.append(K.el('div', { class: 'row' },
      btn(K, 'Worked example', () => { st.target = 0.9; sT.set(0.9); set(); }),
      btn(K, 'Break it: C gets faster than B', () => { st.pts = defaults.points.map(p => ({ id: p.id, recall: p.recall, qps: p.id === 'C' ? 6200 : p.speed })); render(); }),
      btn(K, 'Break it: other machine (noisy +-30%)', () => set([9000 * 0.8, 5000 * 0.78, 4000 * 1.3, 2500 * 0.72, 2000 * 1.35]))),
      K.el('div', { class: 'row' }, sT.node, logB), chartBox, res, formula, note);
    function render() {
      const P = st.pts.map(p => ({ id: p.id, recall: p.recall, speed: p.qps })), fr = new Set(compute({ points: P }));
      const ch = cheapest(P, st.target);
      const pts = P.map(p => ({ id: p.id, recall: p.recall, cost: 1000 / p.speed, col: 'var(--he)', tip: `${p.id}: recall ${K.fmt(p.recall, 3)}, ${K.fmt(p.speed, 0)} QPS (${K.fmt(1000 / p.speed, 3)} ms)` }));
      chartBox.replaceChildren(chart(K, pts, fr, { logx: st.logx, xlabel: 'latency per query (ms) = 1000 / QPS', target: st.target, chosen: ch && ch.id, labels: true, xrange: [0.08, 0.7], yrange: [0.75, 1.0], xticks: st.logx ? [0.1, 0.2, 0.5] : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xfmt: c => K.fmt(c, 2),
        drag: (id, r, c, snap) => { const p = st.pts.find(q => q.id === id); p.recall = Math.max(0.75, Math.min(1, +r.toFixed(3))); p.qps = Math.max(300, Math.min(15000, 1000 / Math.max(0.05, c))); render(); const n = chartBox.querySelector(`circle[data-id="${id}"]`); if (n && snap) n.focus(); } }));
      res.textContent = 'frontier: ' + [...fr].join(', ');
      const dom = P.filter(p => !fr.has(p.id)).map(p => `${p.id} (beaten by ${dominators(P, p).map(q => q.id).join(', ')})`);
      formula.textContent = `i dominated  <=>  exists j: recall_j >= recall_i  and  QPS_j >= QPS_i  (and j != i)\n` + (dom.length ? 'dominated: ' + dom.join('; ') : 'dominated: none') +
        `\ncheapest point with recall >= ${K.fmt(st.target, 2)}: ` + (ch ? `${ch.id} (recall ${K.fmt(ch.recall, 2)}, ${K.fmt(ch.speed, 0)} QPS)` : 'none reaches it');
      note.textContent = 'A frontier from one dataset and one machine does not transfer: the "other machine" preset shuffles QPS by a few tens of percent and the frontier changes. The log axis squeezes big gaps between slow points.';
    }
    render();
  }

  /* ---------- REAL ---------- */
  let realP = null;
  function loadReal() {
    if (realP) return realP;
    const base = SCRIPT_SRC || location.href;
    const get = rel => { const one = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); return one(new URL(rel, base).href).catch(e => { const alt = rel.replace('../../algorithms/', '../../algorithms/'); if (alt === rel) throw e; return one(new URL(alt, base).href); }); }; /* site layout: the algorithms data sits at ../../algorithms/ */
    realP = Promise.all([get('../../_real-examples/data/hnsw_experiment.json'), get('../../algorithms/data/real-ivf_pq.json')]).then(a => ({ hnsw: a[0], ivf: a[1] }));
    return realP;
  }
  // deterministic wobble in [-1, 1] for the what-if slider
  function wob(i) { let s = (i * 2654435761 + 12345) >>> 0; s = (Math.imul(s ^ (s >>> 15), 2246822519) >>> 0); s = (Math.imul(s ^ (s >>> 13), 3266489917) >>> 0); return ((s ^ (s >>> 16)) >>> 0) / 4294967295 * 2 - 1; }

  function mountReal(el, D) {
    const K = root.DemoKit, H = D.hnsw, R = D.ivf;
    const shell = K.shell(el, 'Real example: recall against cost of real approximate indexes',
      'Demo scale, NOT a benchmark. HNSW view: real hnswlib 0.8.0 on this Mac, one thread, cost = mean latency per query (ms), recall against exact brute-force cosine search; the Mac was swapping, so latencies are NOISY (compare shapes, not digits). IVF-PQ view: our own numpy IVFADC (138 passages, codebooks trained on the same vectors) has no timing in the pack, so its cost is the number of vectors scanned (distance evaluations); HNSW has no such count, so the two cannot share one x axis and are not compared.');
    const st = { mode: 'hnsw', set: 'large', qk: 'held', k: 10, ms: ['8', '32'], target: 0.95, logx: true, wob: 0 };
    const nq = () => st.qk === 'q' ? 24 : (st.set === 'large' ? 500 : 138);
    const chartBox = K.el('div'), res = K.el('div', { class: 'result', 'aria-live': 'polite', style: 'font-size:18px' }), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), tbl = K.el('details', {});
    const ctl = K.el('div', { class: 'row' }), ctl2 = K.el('div', { class: 'row' });
    const sel = (lab, opts, get, set) => { const s = K.el('select', { 'aria-label': lab }, opts.map(([v, t]) => K.el('option', Object.assign({ value: v }, String(v) === String(get()) ? { selected: '' } : {}), t))); s.addEventListener('change', () => { set(s.value); build(); }); return K.el('label', {}, lab + ' ', s); };
    const sT = K.slider('target recall', 0.4, 1, 0.005, st.target, v => { st.target = v; render(); });
    const sW = K.slider('what-if: timing wobble (%)', 0, 60, 5, 0, v => { st.wob = v; render(); });
    const logB = K.el('button', { type: 'button', 'aria-pressed': 'true' }, 'log cost axis');
    logB.addEventListener('click', () => { st.logx = !st.logx; logB.setAttribute('aria-pressed', String(st.logx)); render(); });
    function build() {
      ctl.replaceChildren(sel('view', [['hnsw', 'HNSW: recall vs latency (ms)'], ['ivf', 'IVF-PQ: recall vs vectors scanned']], () => st.mode, v => { st.mode = v; st.target = v === 'ivf' ? 0.7 : 0.95; sT.set(st.target); }));
      if (st.mode === 'hnsw') ctl.append(sel('index', [['small', '138 passages'], ['large', '20,000 passages']], () => st.set, v => { st.set = v; }),
        sel('queries', [['held', 'held-out / each passage'], ['q', '24 questions']], () => st.qk, v => { st.qk = v; }), sel('k', [[10, 'k = 10'], [1, 'k = 1']], () => st.k, v => { st.k = Number(v); }));
      else ctl.append(sel('code sizes', [['8,32', 'm = 8 and 32'], ['2,4,8,16,32', 'all five m'], ['2', 'm = 2'], ['8', 'm = 8'], ['32', 'm = 32']], () => st.ms.join(','), v => { st.ms = v.split(','); }));
      ctl2.replaceChildren(sT.node, logB, ...(st.mode === 'hnsw' ? [sW.node] : []));
      render();
    }
    shell.append(ctl, ctl2, chartBox, res, formula, note, tbl);

    function points() {
      if (st.mode === 'hnsw') {
        const out = [];
        H[st.set].runs.filter(r => r.n_queries === nq() && (st.qk === 'q' ? r.queries.startsWith('24') : !r.queries.startsWith('24'))).forEach(r => {
          const tag = r.build.M === 16 ? 'M16' : 'M4', col = r.build.M === 16 ? 'var(--he)' : 'var(--k12)';
          r.points.filter(p => p.k === st.k).forEach((p, i) => {
            const j = 1 + st.wob / 100 * wob(r.build.M * 1000 + p.ef_search + (st.set === 'large' ? 77 : 0) + i);
            const ms = p.ms_per_query * Math.max(0.2, j);
            out.push({ id: `${tag} ef${p.ef_search}`, recall: p.recall, cost: ms, speed: 1000 / ms, col, tip: `${tag} (M=${r.build.M}, efC=${r.build.ef_construction}) efSearch=${p.ef_search}: recall@${p.k} ${p.recall}, ${K.fmt(ms, 4)} ms/query (${K.fmt(1000 / ms, 0)} QPS)${st.wob ? ' [stored ' + p.ms_per_query + ' ms + simulated wobble]' : ' [stored]'}` });
          });
        });
        return out;
      }
      const cols = { 2: 'var(--warn)', 4: 'var(--both)', 8: 'var(--he)', 16: 'var(--ai)', 32: 'var(--k12)' }, out = [];
      st.ms.forEach(m => Object.keys(R.runs[m].agg).forEach(w => { const a = R.runs[m].agg[w]; out.push({ id: `m${m} w${w}`, recall: a.recall10, cost: a.scanned, speed: 1 / a.scanned, col: cols[m], tip: `m=${m}, w=${w} cells: recall@10 ${a.recall10}, scanned ${a.scanned} of ${R.n} vectors on average` }); }));
      return out;
    }
    function render() {
      const pts = points(), P = pts.map(p => ({ id: p.id, recall: p.recall, speed: p.speed })), fr = new Set(compute({ points: P })), ch = cheapest(P, st.target), isH = st.mode === 'hnsw';
      const cs = pts.map(p => p.cost), lo = Math.min.apply(null, cs), hi = Math.max.apply(null, cs);
      const ticks = []; const base = [1, 2, 5]; for (let e = -3; e <= 4; e++) base.forEach(b => { const v = b * Math.pow(10, e); if (v >= lo * 0.9 && v <= hi * 1.1) ticks.push(v); });
      chartBox.replaceChildren(chart(K, pts, fr, { logx: st.logx, xlabel: isH ? 'latency per query (ms)' : 'vectors scanned per query (of ' + R.n + ')', target: st.target, chosen: ch && ch.id, xticks: ticks.length > 1 ? ticks : [lo, hi], xfmt: c => K.fmt(c, 3) }));
      chartBox.append(isH ? legend(K, [['var(--he)', 'HNSW M=16 (standard build)'], ['var(--k12)', 'HNSW M=4 (deliberately weak graph)'], [null, 'dominated (never worth using)', true]])
        : legend(K, [...st.ms.map(m => [{ 2: 'var(--warn)', 4: 'var(--both)', 8: 'var(--he)', 16: 'var(--ai)', 32: 'var(--k12)' }[m], 'm = ' + m]), [null, 'dominated', true]]));
      const dom = pts.filter(p => !fr.has(p.id));
      res.textContent = ch ? `Target recall ${K.fmt(st.target, 3)}: cheapest operating point = ${ch.id}  (recall ${K.fmt(ch.recall, 4)}, ${isH ? K.fmt(pts.find(p => p.id === ch.id).cost, 4) + ' ms/query' : K.fmt(pts.find(p => p.id === ch.id).cost, 2) + ' vectors scanned'})` :
        `Target recall ${K.fmt(st.target, 3)}: no point reaches it. Best recall in this sweep is ${K.fmt(Math.max.apply(null, P.map(p => p.recall)), 4)}.`;
      res.className = 'result' + (ch ? '' : ' bad');
      formula.textContent = `frontier = ${fr.size} of ${pts.length} points (computed live): ${pts.filter(p => fr.has(p.id)).sort((a, b) => a.cost - b.cost).map(p => p.id).join(', ')}\n` +
        `dominated = ${dom.length}: a dominated point has another point with recall >= and cost <= (e.g. ` + (dom[0] ? `${dom[0].id} is beaten by ${dominators(P, P.find(p => p.id === dom[0].id))[0].id}` : 'none here') + ')';
      const sel0 = isH ? `${st.set === 'small' ? '138-passage' : '20,000-passage'} index, ${st.qk === 'q' ? '24 pack questions' : (st.set === 'large' ? '500 held-out passages' : 'each of the 138 passages')} as queries, k=${st.k}.` : `138 passages, 24 questions, recall@10 averaged over the 24 queries; w = cells visited (1-8).`;
      note.className = 'hint';
      note.textContent = sel0 + (isH ? (st.wob ? ` Wobble ${st.wob}% is a SIMULATION on top of the stored latencies: it shows how fragile a frontier built from noisy timings is, it is not data.` : ' Stored values; the Mac was swapping, so a point can look dominated only because of a slow measurement (move the wobble slider to see how fragile this is).') + (st.set === 'large' && st.qk === 'q' ? ' The 24 ML questions are out-of-distribution for a Simple English index, so recall is far lower: a real effect.' : '') + ' M=4 is a graph built too small on purpose: it is cheaper to build but the curve sits lower.'
        : ' PQ compression caps recall (it plateaus below 1 whatever w is), so extra cells scanned past the plateau only add cost: those points are dominated. Cost here is work, not time.') +
        ' A frontier of one dataset and one machine does not transfer. A log axis hides big gaps.';
      tbl.replaceChildren(K.el('summary', {}, `All ${pts.length} points (sorted by cost)`), K.el('div', { style: 'overflow-x:auto;max-width:100%' }, K.el('table', { style: 'border-collapse:collapse;font-size:12px;width:100%' },
        K.el('tr', {}, ['setting', 'recall', isH ? 'ms/query' : 'scanned', 'status'].map(h => K.el('th', { style: 'text-align:left;padding:2px 8px' }, h))),
        ...pts.slice().sort((a, b) => a.cost - b.cost).map(p => K.el('tr', { style: fr.has(p.id) ? '' : 'color:var(--faint)' }, [p.id, K.fmt(p.recall, 4), K.fmt(p.cost, 4), fr.has(p.id) ? 'frontier' : 'dominated by ' + dominators(P, P.find(q => q.id === p.id)).slice(0, 2).map(q => q.id).join(', ')].map(t => K.el('td', { class: 'num', style: 'padding:2px 8px' }, t)))))));
    }
    build();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realP = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, cheapest, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['ann_recall_latency_curve'] = api;
})(this);
