/* Maximal Marginal Relevance: greedy pick of k chunks, trading relevance to Q against similarity to the picks so far.
   Real example (default): 24 real questions over 138 Wikipedia passages, real all-MiniLM-L6-v2 cosines (data/real-mmr.json, derived from the pack's raw/embeddings.npz); plain top-k vs MMR, and the metric effect over 20 answerable questions.
   Toy example (break it): toy points are unit vectors at angles (query at 0 deg), Sim = cosine. Drag a dot around the circle (or use arrow keys), move lambda. */
(function (root) {
  const defaults = { angles: [10, 17, 24, 55, -40, 78], lambda: 0.4, k: 3 };
  const NAMES = 'ABCDEFGH';
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const rad = d => d * Math.PI / 180;
  const vec = a => [Math.cos(rad(a)), Math.sin(rad(a))];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1];

  /* PURE. Greedy MMR. First pick: S is empty, the redundancy term is taken as 0 (our convention; the paper does not spell it out).
     Ties go to the lower index. Returns the picked indices (0-based) and the MMR score each had when picked. */
  function run(inp) {
    const u = inp.angles.map(vec), q = [1, 0];
    const rel = u.map(v => dot(v, q));
    const S = [], scores = [], steps = [];
    const k = Math.min(inp.k, u.length);
    while (S.length < k) {
      let best = -1, bestV = -Infinity; const rows = {};
      for (let i = 0; i < u.length; i++) {
        if (S.includes(i)) continue;
        let red = 0, near = -1;
        if (S.length) { red = -Infinity; S.forEach(j => { const s = dot(u[i], u[j]); if (s > red) { red = s; near = j; } }); }
        const v = inp.lambda * rel[i] - (1 - inp.lambda) * red;
        rows[i] = { rel: rel[i], red, near, v };
        if (v > bestV + 1e-12) { bestV = v; best = i; }
      }
      S.push(best); scores.push(bestV); steps.push(rows);
    }
    return { selected: S, scores, rel, steps };
  }
  function compute(inp) { const r = run(inp); return { selected: r.selected, scores: r.scores }; }

  const PRESETS = {
    'worked example (lambda 0.4)': () => ({ angles: defaults.angles.slice(), lambda: 0.4, k: 3 }),
    'break it: lambda = 1 (near-duplicates)': () => ({ angles: defaults.angles.slice(), lambda: 1, k: 3 }),
    'lambda = 0 (ignores the query)': () => ({ angles: defaults.angles.slice(), lambda: 0, k: 3 }),
    'break it 2: all six are copies': () => ({ angles: [8, 10, 12, 14, 16, 18], lambda: 0.4, k: 3 }),
  };

  function mountToy(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Maximal Marginal Relevance',
      'Each dot is a chunk (a unit vector); Q points right. Drag dots around the circle, move lambda, and watch which three chunks MMR keeps. Then press "break it".');
    const W = 360, C = 180, R = 140;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${W}`, role: 'img', 'aria-label': 'chunks on a circle around the query', style: 'width:100%;max-width:360px;touch-action:none;display:block;margin:0 auto' });
    const pt = a => [C + R * Math.cos(rad(a)), C - R * Math.sin(rad(a))];
    svg.append(K.svg('circle', { cx: C, cy: C, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2 }));
    svg.append(K.svg('line', { x1: C, y1: C, x2: C + R * 0.82, y2: C, stroke: 'var(--k12)', 'stroke-width': 3 }));
    svg.append(K.svg('text', { x: C + R * 0.82 - 4, y: C + 18, 'text-anchor': 'end', fill: 'var(--k12)' }, 'Q'));
    const lines = K.svg('g', {}), dots = K.svg('g', {});
    svg.append(lines, dots);
    const gs = [];
    const place = (i, a) => { st.angles[i] = Math.round(Math.max(-90, Math.min(90, a)) * 10) / 10; render(); };
    st.angles.forEach((_, i) => {
      const g = K.svg('g', { tabindex: 0, role: 'slider', 'aria-label': `chunk ${NAMES[i]} angle`, 'aria-valuemin': -90, 'aria-valuemax': 90, style: 'cursor:grab;outline:none' });
      const ring = K.svg('circle', { r: 13, fill: 'none', 'stroke-width': 3 }), c = K.svg('circle', { r: 8 }), t = K.svg('text', { 'text-anchor': 'middle', 'font-size': 12, dy: -16 }, NAMES[i]);
      const n = K.svg('text', { 'text-anchor': 'middle', 'font-size': 11, dy: 4, style: 'fill:#0B0D12;font-weight:700;pointer-events:none' });
      g.append(ring, c, t, n); dots.append(g); gs.push({ g, ring, c, n });
      const move = ev => { const r = svg.getBoundingClientRect(), s = W / r.width; const x = (ev.clientX - r.left) * s - C, y = C - (ev.clientY - r.top) * s; place(i, Math.atan2(y, x) * 180 / Math.PI); };
      g.addEventListener('pointerdown', ev => { g.setPointerCapture(ev.pointerId); g.dataset.drag = 1; g.style.cursor = 'grabbing'; move(ev); });
      g.addEventListener('pointermove', ev => { if (g.dataset.drag) move(ev); });
      g.addEventListener('pointerup', () => { delete g.dataset.drag; g.style.cursor = 'grab'; });
      g.addEventListener('keydown', ev => { const d = { ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, ArrowRight: 2 }[ev.key]; if (d) { ev.preventDefault(); place(i, st.angles[i] + d); gs[i].g.focus(); } });
    });
    const lamS = K.slider('lambda', 0, 1, 0.05, st.lambda, v => { st.lambda = v; render(); });
    const kS = K.slider('k (how many to pick)', 1, 6, 1, st.k, v => { st.k = v; render(); });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n); b.addEventListener('click', () => { st = PRESETS[n](); lamS.set(st.lambda); kS.set(st.k); render(); }); return b; }));
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const tbl = K.el('table', { style: 'font-size:12px' });
    const formula = K.el('div', { class: 'formula' });
    shell.append(presets, K.el('div', { class: 'row' }, lamS.node, kS.node), svg, verdict, tbl, formula);
    const plain = () => compute({ angles: st.angles, lambda: 1, k: st.k }).selected;

    function render() {
      const r = run(st), S = r.selected;
      lines.replaceChildren();
      st.angles.forEach((a, i) => {
        const [x, y] = pt(a), o = S.indexOf(i), s = gs[i];
        s.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        s.g.setAttribute('aria-valuenow', a); s.g.setAttribute('aria-valuetext', `${K.fmt(a, 1)} degrees`);
        s.c.setAttribute('fill', o >= 0 ? 'var(--he)' : 'var(--text)');
        s.ring.setAttribute('stroke', o >= 0 ? 'var(--he)' : 'transparent');
        s.n.textContent = o >= 0 ? String(o + 1) : '';
      });
      /* dashed line from each pick to its nearest earlier pick */
      S.forEach((p, o) => { if (o > 0) { const near = r.steps[o][p].near, [x1, y1] = pt(st.angles[p]), [x2, y2] = pt(st.angles[near]);
        lines.append(K.svg('line', { x1, y1, x2, y2, stroke: 'var(--warn)', 'stroke-dasharray': '4 4', 'stroke-width': 2 })); } });
      const nm = s => s.map(i => NAMES[i]).join(' ');
      const pl = plain(), same = pl.slice().sort().join() === S.slice().sort().join();
      /* spread: smallest cosine gap between picks (1 = copies) */
      let mx = -2; for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) mx = Math.max(mx, dot(vec(st.angles[S[a]]), vec(st.angles[S[b]])));
      verdict.replaceChildren(K.el('span', {}, 'MMR picks: ', K.el('b', { class: 'good' }, nm(S)), '   plain relevance picks: ', K.el('b', {}, nm(pl))),
        K.el('b', { class: mx > 0.98 ? 'bad' : same ? 'bad' : 'good' }, mx > 0.98 ? `near-duplicates: two picks have cosine ${K.fmt(mx, 3)}` : same ? 'same as plain relevance (no diversity gained)' : `most similar pair of picks: cosine ${K.fmt(mx, 3)}`));
      tbl.replaceChildren(K.el('tr', {}, ...['pick', 'chunk', 'relevance', 'max sim to picks', 'MMR score'].map(h => K.el('th', { style: 'padding:3px;font-size:12px' }, h))),
        ...S.map((p, o) => { const row = r.steps[o][p]; return K.el('tr', {}, K.el('td', { class: 'num' }, '#' + (o + 1)), K.el('td', { style: 'font-weight:600' }, NAMES[p]),
          K.el('td', { class: 'num' }, K.fmt(row.rel, 3)), K.el('td', { class: 'num' }, o ? `${K.fmt(row.red, 3)} (to ${NAMES[row.near]})` : '0 (S empty)'), K.el('td', { class: 'num good' }, K.fmt(row.v, 3))); }));
      const last = S.length - 1, row = r.steps[last][S[last]], f = x => K.fmt(x, 3), l = K.fmt(st.lambda, 2);
      formula.textContent = `pick #${last + 1} = ${NAMES[S[last]]}:  ${l} x ${f(row.rel)} - ${K.fmt(1 - st.lambda, 2)} x ${last ? f(row.red) : '0'} = ${f(row.v)}\n` +
        `lambda = 1: plain relevance order.  lambda = 0: only diversity (the first pick is then a tie, lowest index wins here).`;
    }
    render();
  }

  /* PURE. MMR over precomputed cosines: rel[i] = cosine(query, passage i), pp[i][j] = cosine(passage i, passage j). Same rule as run(). */
  function mmrIdx(rel, pp, lambda, k) {
    const S = [], n = rel.length;
    while (S.length < Math.min(k, n)) {
      let b = -1, bv = -Infinity;
      for (let i = 0; i < n; i++) { if (S.includes(i)) continue;
        const red = S.length ? Math.max(...S.map(j => pp[i][j])) : 0, v = lambda * rel[i] - (1 - lambda) * red;
        if (v > bv + 1e-12) { bv = v; b = i; } }
      S.push(b);
    }
    return S;
  }
  function metricsAt(ids, gold, k) {
    const top = ids.slice(0, k), hit = top.filter(x => gold.includes(x)).length;
    let dcg = 0; top.forEach((x, i) => { if (gold.includes(x)) dcg += 1 / Math.log2(i + 2); });
    let idcg = 0; for (let i = 0; i < Math.min(gold.length, k); i++) idcg += 1 / Math.log2(i + 2);
    return { recall: gold.length ? hit / gold.length : 0, ndcg: idcg ? dcg / idcg : 0 };
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href, mine = new URL('../data/real-mmr.json', SRC || location.href).href;
    const box = K.shell(el, 'Real example: plain top-k vs MMR on real passages',
      'Real data: 138 Wikipedia passages (15 articles), 24 questions, real all-MiniLM-L6-v2 cosines. Relevance = cosine(question, passage); redundancy = largest cosine between the candidate and the passages already picked; candidates = the 30 most relevant passages. The pack\'s own run (runs/mmr_dense.json) used lambda 0.7 and 50 candidates; here the same rule is re-run live so lambda can move.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    Promise.all([get(base + 'data/corpus.json'), get(base + 'data/questions.json'), get(base + 'runs/metrics_by_method.json'), get(base + 'runs/mmr_dense.json'), get(mine)]).then(([corpus, qs, met, stored, D]) => {
      const P = {}; corpus.forEach(p => { P[p.id] = p; });
      const stor = {}; stored.questions.forEach(q => { stor[q.qid] = q.ranking.map(x => x.id); });
      let lam = 0.7, k = 5, qid = 'q06';
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%;width:100%' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 64)}`)));
      sel.value = qid;
      const lamS = K.slider('lambda (1 = plain relevance)', 0, 1, 0.05, lam, v => { lam = v; draw(); });
      const kS = K.slider('k (passages to keep)', 1, 10, 1, k, v => { k = v; draw(); });
      const hurt = K.el('button', {}, 'show a question where MMR hurts (q10)'), help = K.el('button', {}, 'where MMR helps (q09)'), six = K.el('button', {}, 'lambda 0.7 (the pack run)');
      const go = id => { sel.value = id; qid = id; draw(); };
      hurt.addEventListener('click', () => { go('q10'); lamS.set(0.7); lam = 0.7; draw(); }); help.addEventListener('click', () => { go('q09'); lamS.set(0.7); lam = 0.7; draw(); });
      six.addEventListener('click', () => { lamS.set(0.7); lam = 0.7; draw(); });
      sel.addEventListener('change', () => { qid = sel.value; draw(); });
      const info = K.el('div', {}), cols = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' }), summ = K.el('div', { 'aria-live': 'polite' }), form = K.el('div', { class: 'formula' }),
        agg = K.el('div', {}), sweep = K.el('div', { style: 'overflow-x:auto' }), open = new Set();
      function col(title, color, idsList, gold, Q, marks) {
        const rows = idsList.map((id, j) => {
          const isG = gold.includes(id), key = title + id, a = Q.ids.indexOf(id);
          const btn = K.el('button', { 'aria-expanded': String(open.has(key)), style: 'text-align:left;width:100%;' + (isG ? 'border-color:var(--he)' : '') },
            `#${j + 1}  ${id}  rel ${K.fmt(Q.rel[a], 3)}${marks && marks[j] ? '  ' + marks[j] : ''}  ${isG ? 'GOLD  ' : ''}${P[id].article}`);
          const txt = K.el('div', { class: 'hint', style: 'display:' + (open.has(key) ? 'block' : 'none') }, P[id].text);
          btn.addEventListener('click', () => { open.has(key) ? open.delete(key) : open.add(key); draw(); });
          return K.el('div', { style: 'margin:3px 0' }, btn, txt);
        });
        return K.el('div', { style: 'flex:1 1 250px;min-width:0' }, K.el('div', { style: `color:${color};font-weight:600` }, title), ...rows);
      }
      const answerable = qs.filter(q => q.gold_passages.length);
      function draw() {
        const q = qs.find(x => x.id === qid), g = q.gold_passages, Q = D.questions[qid];
        const pl = mmrIdx(Q.rel, Q.pp, 1, k), mm = mmrIdx(Q.rel, Q.pp, lam, k), plIds = pl.map(i => Q.ids[i]), mmIds = mm.map(i => Q.ids[i]);
        const marks = mm.map((i, o) => { if (!o) return 'first pick: redundancy taken as 0'; let r = -9, nr = -1; mm.slice(0, o).forEach(j => { if (Q.pp[i][j] > r) { r = Q.pp[i][j]; nr = j; } }); return `max sim ${K.fmt(r, 2)} to ${Q.ids[nr]}`; });
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold: ${g.join(', ') || 'none'}. gold answer: ${q.gold_answer || '(none)'}`));
        cols.replaceChildren(col(`plain top-${k} (lambda = 1)`, 'var(--k12)', plIds, g, Q), col(`MMR top-${k} (lambda = ${K.fmt(lam, 2)})`, 'var(--he)', mmIds, g, Q, marks));
        const art = a => new Set(a.map(i => P[i].article)).size, hit = a => a.filter(i => g.includes(i)).length;
        const gain = mmIds.filter(i => !plIds.includes(i)), lose = plIds.filter(i => !mmIds.includes(i));
        summ.replaceChildren(K.el('div', {}, `distinct articles in the ${k}: plain ${art(plIds)}, MMR ${art(mmIds)}.  gold passages kept: plain ${hit(plIds)} of ${g.length}, MMR ${hit(mmIds)} of ${g.length}.`),
          K.el('div', {}, `MMR brings in: ${gain.join(', ') || 'nothing'}.  MMR drops: ${lose.join(', ') || 'nothing'}.`),
          g.length ? K.el('b', { class: hit(mmIds) > hit(plIds) ? 'good' : hit(mmIds) < hit(plIds) ? 'bad' : '' }, hit(mmIds) > hit(plIds) ? 'MMR finds more gold here' : hit(mmIds) < hit(plIds) ? 'MMR lost a gold passage here' : 'same number of gold passages') : K.el('b', { class: 'bad' }, 'Unanswerable: both lists are just the nearest passages; MMR does not make them correct.'));
        const last = mm.length - 1;
        if (last > 0) { const i = mm[last], r = Math.max(...mm.slice(0, last).map(j => Q.pp[i][j]));
          form.textContent = `pick #${last + 1} = ${Q.ids[i]}:  ${K.fmt(lam, 2)} x ${K.fmt(Q.rel[i], 3)} - ${K.fmt(1 - lam, 2)} x ${K.fmt(r, 3)} = ${K.fmt(lam * Q.rel[i] - (1 - lam) * r, 3)}`; }
        else form.textContent = `pick #1 = ${Q.ids[mm[0]]}: ${K.fmt(lam, 2)} x ${K.fmt(Q.rel[mm[0]], 3)} - ${K.fmt(1 - lam, 2)} x 0 = ${K.fmt(lam * Q.rel[mm[0]], 3)}  (S is empty)`;
        /* whole-set metrics, recomputed live over the 20 answerable questions */
        const ev = (l, kk) => { let r = 0, nd = 0, ar = 0; answerable.forEach(x => { const Z = D.questions[x.id], ids = mmrIdx(Z.rel, Z.pp, l, kk).map(i => Z.ids[i]), m = metricsAt(ids, x.gold_passages, kk); r += m.recall; nd += m.ndcg; ar += new Set(ids.map(i => P[i].article)).size; }); const n = answerable.length; return { recall: r / n, ndcg: nd / n, art: ar / n }; };
        const cur = ev(lam, k), pla = ev(1, k);
        const store = (m, key) => met.methods[m][key];
        agg.replaceChildren(K.el('div', {}, K.el('b', {}, `Over the ${answerable.length} answerable questions, top-${k}, lambda ${K.fmt(lam, 2)} (recomputed here): `), `recall@${k} ${K.fmt(cur.recall, 3)} (plain ${K.fmt(pla.recall, 3)}), nDCG@${k} ${K.fmt(cur.ndcg, 3)} (plain ${K.fmt(pla.ndcg, 3)}), mean distinct articles ${K.fmt(cur.art, 2)} (plain ${K.fmt(pla.art, 2)}).`),
          K.el('div', { class: 'hint' }, `Read from the pack, no recomputation (runs/mmr_dense.json at lambda 0.7 vs dense_cosine): recall@5 ${K.fmt(store('mmr_dense', 'recall@5'), 3)} vs ${K.fmt(store('dense_cosine', 'recall@5'), 3)}, nDCG@5 ${K.fmt(store('mmr_dense', 'ndcg@5'), 3)} vs ${K.fmt(store('dense_cosine', 'ndcg@5'), 3)}, MRR ${K.fmt(store('mmr_dense', 'mrr'), 3)} vs ${K.fmt(store('dense_cosine', 'mrr'), 3)}, nDCG@10 ${K.fmt(store('mmr_dense', 'ndcg@10'), 3)} vs ${K.fmt(store('dense_cosine', 'ndcg@10'), 3)}. MMR is not better on any of them: it trades relevance for variety, and (our reading, not tested) the gold passages here are often the closest ones, so pushing for variety drops them. One question moves recall@5 by up to 0.05, so the gaps are inside the noise.`));
        const ls = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3, 0.1];
        sweep.replaceChildren(K.el('table', {}, K.el('tr', {}, ...['lambda', `recall@${k}`, `nDCG@${k}`, 'distinct articles'].map(h => K.el('th', {}, h))),
          ...ls.map(l => { const e = ev(l, k); return K.el('tr', {}, K.el('td', { class: 'num' }, K.fmt(l, 2) + (l === 1 ? ' (plain)' : '')), K.el('td', { class: 'num' }, K.fmt(e.recall, 3)), K.el('td', { class: 'num' }, K.fmt(e.ndcg, 3)), K.el('td', { class: 'num' }, K.fmt(e.art, 2))); })));
      }
      /* check: live recompute at lambda 0.7 must equal the pack run (top-10) */
      let bad = 0, bad5 = 0; qs.forEach(q => { const Z = D.questions[q.id], r = mmrIdx(Z.rel, Z.pp, 0.7, 10).map(i => Z.ids[i]); if (r.join() !== stor[q.id].slice(0, 10).join()) bad++; if (r.slice(0, 5).join() !== stor[q.id].slice(0, 5).join()) bad5++; });
      const ok = K.el('div', { class: 'hint' }, `Check: re-running the rule at lambda 0.7 here gives the same top-5 as the pack run on ${qs.length - bad5} of ${qs.length} questions and the same top-10 on ${qs.length - bad} (the pack used 50 candidates, this page 30, so deep picks can differ). Recomputed here from stored vectors: every MMR list and metric on this page. Read from the pack: the passage text, gold labels and the stored-run metrics line.`);
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: demo scale, 138 passages (at most 10 per article, so a sample), 24 questions written by Claude from the corpus text (not a benchmark), 20 answerable. Gold labels cover only the passages judged necessary, so a dropped "non-gold" passage may have been useful: precision is a lower bound and MMR is judged harshly. Cosine is the pack\'s dense model (all-MiniLM-L6-v2, no reranker). Text: Wikipedia contributors, CC BY-SA 4.0.');
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', sel)), K.el('div', { class: 'row' }, help, hurt, six), K.el('div', { class: 'row' }, lamS.node, kS.node), info, summ, cols, form,
        K.el('h4', {}, 'Does it help? The whole set, live'), agg, sweep, ok, cav);
      draw();
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

  const api = { defaults, compute, mount, run, mmrIdx };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['mmr'] = api;
})(this);
