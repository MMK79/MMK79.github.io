/* Semantic cache: serve the stored answer if the best cosine between the new question and a cached question is >= tau.
   Real example (default): 24 real questions as the cache, 18 real LLM-written query variants + the 24 questions themselves as arrivals;
   cosines of all-MiniLM-L6-v2 vectors (data/semantic_cache_real.json, built by data/build_semantic_cache_real.py from _real-examples).
   Toy example: invented 3-D vectors, invented costs and hit rate (the worked example of the catalogue entry). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    cache: [[0.90, 0.35, 0.10], [0.10, 0.20, 0.95], [0.25, 0.30, 0.85]],
    cacheNames: ['How do I reset my password?', 'What is the refund policy?', 'Where can I download my invoice?'],
    queries: [[0.88, 0.40, 0.12], [0.78, 0.22, 0.40], [0.05, 0.90, 0.15]],
    queryNames: ['How can I change my password?', 'How do I delete my account?', 'Who won the 2022 World Cup?'],
    tau: 0.95, c_llm: 0.010, c_emb: 0.0001, h: 0.30,
  };
  const r4 = x => Math.round(x * 1e4) / 1e4, r6 = x => Math.round(x * 1e6) / 1e6;
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const len = a => Math.sqrt(dot(a, a));
  const cosine = (a, b) => { const n = len(a) * len(b); return n === 0 ? 0 : dot(a, b) / n; };
  /* best cosine of v against the cache: {cos, idx} */
  function best(v, cache) { let b = { cos: -2, idx: -1 }; cache.forEach((c, i) => { const s = cosine(v, c); if (s > b.cos) b = { cos: s, idx: i }; }); return b; }

  /* PURE. Rule: hit if max_i cos(q, q_i) >= tau. Cost: C = C_emb + (1-h) C_LLM; saving = 1 - C/C_LLM; break-even h = C_emb / C_LLM. */
  function compute(inp) {
    const b = inp.queries.map(q => best(q, inp.cache));
    const cost = inp.c_emb + (1 - inp.h) * inp.c_llm;
    return {
      sim_paraphrase: r4(b[0].cos), sim_related_different: r4(b[1].cos), sim_unrelated: r4(b[2].cos),
      threshold: inp.tau, hits_at_threshold: b.filter(x => x.cos >= inp.tau).length,
      cost_per_request_with_cache_usd: r6(cost), cost_per_request_no_cache_usd: inp.c_llm,
      saving_pct: Math.round(1e4 * (1 - cost / inp.c_llm)) / 100, break_even_hit_rate: r4(inp.c_emb / inp.c_llm),
    };
  }

  /* PURE, real data. Labels are OURS (inferred): arrival->cached pairs whose stored answers coincide. */
  const SAME = new Set(['q09>q01', 'q01>q09', 'q17>q15']);
  function realRows(d) {
    const ids = d.questions.map(q => q.id), rows = [];
    d.queries.forEach((q, i) => {
      const row = d.cos_query_vs_cache[i]; let j = 0; row.forEach((s, k) => { if (s > row[j]) j = k; });
      rows.push({ group: 'variant', text: q.text, src: q.src, best: ids[j], cos: row[j], own: row[ids.indexOf(q.src)], right: ids[j] === q.src || SAME.has(q.src + '>' + ids[j]) });
    });
    d.questions.forEach((q, i) => {
      const row = d.cos_cache_vs_cache[i]; let j = -1; row.forEach((s, k) => { if (k !== i && (j < 0 || s > row[j])) j = k; });
      rows.push({ group: 'question', text: q.text, src: q.id, best: ids[j], cos: row[j], right: SAME.has(q.id + '>' + ids[j]) });
    });
    return rows;
  }
  /* at tau: variants should hit (their own question), questions should miss unless the answers coincide */
  function realStats(rows, tau) {
    const v = rows.filter(r => r.group === 'variant'), q = rows.filter(r => r.group === 'question');
    const hv = v.filter(r => r.cos >= tau), hq = q.filter(r => r.cos >= tau);
    return {
      variants: v.length, variant_hits_right: hv.filter(r => r.right).length, variant_hits_wrong: hv.filter(r => !r.right).length,
      variant_misses: v.length - hv.length, q_hits_right: hq.filter(r => r.right).length, q_hits_wrong: hq.filter(r => !r.right).length,
      h: v.length ? hv.length / v.length : 0,
    };
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const PRESETS = {
    'worked example (tau 0.95)': defaults,
    'break it: tau 0.90 serves the wrong answer': { ...clone(defaults), tau: 0.90 },
    'break it: real hit rate is only 0.5%': { ...clone(defaults), h: 0.005 },
  };

  /* shared: cosine axis with markers and a tau line */
  function axis(K, items, tau, lo, hi) {
    const W = 600, H = 26 + items.length * 22, X = v => 12 + (W - 24) * (v - lo) / (hi - lo);
    const s = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:640px', role: 'img', 'aria-label': 'best cosine of each query against the cache, with the threshold line' });
    for (let t = Math.ceil(lo * 10) / 10; t <= hi + 1e-9; t += 0.1) {
      s.append(K.svg('line', { x1: X(t), y1: 14, x2: X(t), y2: H - 4, stroke: 'var(--line)' }), K.svg('text', { x: X(t), y: 10, 'text-anchor': 'middle', style: 'fill:var(--faint);font-size:10px' }, t.toFixed(1)));
    }
    s.append(K.svg('rect', { x: X(tau), y: 14, width: Math.max(0, X(hi) - X(tau)), height: H - 18, fill: 'var(--he)', 'fill-opacity': 0.12 }), K.svg('line', { x1: X(tau), y1: 12, x2: X(tau), y2: H - 4, stroke: 'var(--he)', 'stroke-width': 2 }));
    items.forEach((it, i) => {
      const y = 28 + i * 22;
      s.append(K.svg('circle', { cx: X(Math.max(lo, it.cos)), cy: y, r: 6, fill: it.color, stroke: 'var(--bg)' }), K.svg('text', { x: X(Math.max(lo, it.cos)) + (it.cos > (lo + hi) / 2 ? -10 : 10), y: y + 4, 'text-anchor': it.cos > (lo + hi) / 2 ? 'end' : 'start', style: 'font-size:11px' }, it.label));
    });
    return s;
  }

  function costPanel(K, getH, getC, titleNote) {
    const out = K.el('div', {});
    function draw() {
      const c = getC(), h = getH(), cost = c.c_emb + (1 - h) * c.c_llm, sv = 1 - cost / c.c_llm, be = c.c_emb / c.c_llm;
      const bar = (n, v, col) => K.el('div', { style: 'margin:3px 0' }, K.el('div', { style: `font-size:13px;color:${col}` }, `${n}: `, K.el('b', { class: 'num' }, '$' + v.toFixed(6))), K.el('div', { style: `height:10px;border-radius:2px;background:${col};width:${Math.max(1, 100 * v / c.c_llm)}%` }));
      out.replaceChildren(bar('no cache', c.c_llm, 'var(--k12)'), bar('with cache', cost, sv >= 0 ? 'var(--he)' : 'var(--warn)'),
        K.el('div', { class: 'row' }, 'saving ', K.el('b', { class: 'num ' + (sv > 0 ? 'good' : 'bad') }, (100 * sv).toFixed(2) + '%'), ' break-even hit rate ', K.el('b', { class: 'num' }, (100 * be).toFixed(2) + '%'), h < be ? K.el('span', { class: 'bad' }, ' below break-even: the cache costs more than it saves') : ''),
        K.el('div', { class: 'formula', style: 'word-break:break-all' }, `cost = C_emb + (1 - h) C_LLM = ${c.c_emb} + ${K.fmt(1 - h, 4)} x ${c.c_llm} = ${cost.toFixed(6)}` + (titleNote ? '\n' + titleNote : '')));
    }
    return { node: out, draw };
  }

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults);
    const shell = K.shell(el, 'Semantic cache: toy example (invented numbers)',
      'Three cached questions, three new ones, with hand-made 3-D vectors (no model runs). Edit a vector or move tau: a new question is a HIT when its best cosine is at least tau. Costs and hit rate are invented.');
    const presetRow = K.el('div', { class: 'row' }), tbl = K.el('div', { style: 'overflow-x:auto' }), plot = K.el('div', {}), verdict = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula', style: 'word-break:break-all' });
    const tauS = K.slider('threshold tau', 0.5, 0.99, 0.01, st.tau, v => { st.tau = v; render(); });
    const hS = K.slider('hit rate h (invented)', 0, 1, 0.005, st.h, v => { st.h = v; render(); });
    const cost = costPanel(K, () => st.h, () => st, '');
    function numCell(arr, k, label) {
      const inp = K.el('input', { type: 'number', step: '0.05', value: arr[k], 'aria-label': label, style: 'width:56px' });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { arr[k] = v; render(); } });
      return inp;
    }
    function build() {
      const t = K.el('table', {}); t.append(K.el('tr', {}, ...['', 'x', 'y', 'z', 'best cosine', 'verdict'].map(h => K.el('th', {}, h))));
      st.cache.forEach((c, i) => t.append(K.el('tr', {}, K.el('td', { style: 'color:var(--k12)' }, 'cached: ' + st.cacheNames[i]), ...[0, 1, 2].map(k => K.el('td', {}, numCell(c, k, 'cached ' + i + ' ' + 'xyz'[k]))), K.el('td', {}), K.el('td', {}))));
      st.queries.forEach((q, i) => t.append(K.el('tr', {}, K.el('td', { style: 'color:var(--ai)' }, 'new: ' + st.queryNames[i]), ...[0, 1, 2].map(k => K.el('td', {}, numCell(q, k, 'new ' + i + ' ' + 'xyz'[k]))), K.el('td', { class: 'num', 'data-c': i }), K.el('td', { 'data-v': i }))));
      tbl.replaceChildren(t);
    }
    PRESETS && presetRow.append(...Object.keys(PRESETS).map(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = clone(PRESETS[k]); tauS.set(st.tau); hS.set(st.h); build(); render(); }); return b; }));
    function render() {
      const r = compute(st), bs = st.queries.map(q => best(q, st.cache)), names = ['paraphrase', 'related, different answer', 'unrelated'];
      st.queries.forEach((q, i) => {
        const c = tbl.querySelector(`[data-c="${i}"]`), v = tbl.querySelector(`[data-v="${i}"]`), t = K.fmt(bs[i].cos, 4), hit = bs[i].cos >= st.tau;
        if (c.textContent !== t) { c.textContent = t; K.flash(c); }
        v.textContent = (hit ? 'HIT -> ' : 'miss, call LLM') + (hit ? st.cacheNames[bs[i].idx] : ''); v.className = hit ? (i === 1 ? 'bad' : 'good') : '';
      });
      plot.replaceChildren(axis(K, bs.map((b, i) => ({ cos: b.cos, label: `${names[i]} ${K.fmt(b.cos, 3)}`, color: i === 0 ? 'var(--he)' : i === 1 ? 'var(--warn)' : 'var(--faint)' })), st.tau, 0, 1));
      verdict.replaceChildren(K.el('div', {}, `hits at tau = ${st.tau}: `, K.el('b', { class: 'num' }, String(r.hits_at_threshold)), ' of 3'),
        bs[1].cos >= st.tau ? K.el('div', { class: 'bad' }, 'The "delete my account" question was served the cached "reset my password" answer: close in meaning-space, different answer. A threshold cannot see the difference.') : '');
      formula.textContent = `hit if max_i cos(e(q), e(q_i)) >= tau.  Result of compute(): ${JSON.stringify(r)}`;
      cost.draw();
    }
    shell.append(presetRow, tbl, K.el('div', { class: 'row' }, tauS.node), plot, verdict, K.el('div', { class: 'row' }, hS.node), cost.node, formula);
    build(); render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('data/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: when does one real question serve another?',
      'Cache = 24 real questions. Arrivals = (a) 18 real query variants (LLM-written, 3 each for 6 questions; they should hit their own question) and (b) each of the 24 questions asked after the other 23 are cached (they should miss, unless the stored answers coincide). Cosines of all-MiniLM-L6-v2 vectors, computed by code. Move tau and read the counts.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    fetch(base + 'semantic_cache_real.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
      const rows = realRows(d), cR = { c_llm: 0.010, c_emb: 0.0001 };
      const tauS = K.slider('threshold tau', 0.5, 0.99, 0.01, 0.8, v => { tau = v; draw(); });
      let tau = 0.8;
      const stats = K.el('div', { 'aria-live': 'polite' }), plot = K.el('div', {}), sweep = K.el('div', {}), lists = K.el('div', {});
      const cost = costPanel(K, () => realStats(rows, tau).h, () => cR, 'h = share of the 18 variants served from cache (a test set made of repeats, NOT real traffic). Costs are invented.');
      const open = new Set();
      function list(title, rs, note) {
        const det = K.el('details', open.has(title) ? { open: '' } : {}, K.el('summary', {}, title));
        det.addEventListener('toggle', () => { det.open ? open.add(title) : open.delete(title); });
        det.append(K.el('div', { class: 'hint' }, note), K.el('div', { style: 'overflow-x:auto' }, K.el('table', {}, K.el('tr', {}, ...['arrival', 'best match', 'cos', 'at tau'].map(h => K.el('th', {}, h))),
          ...rs.map(r => { const hit = r.cos >= tau; return K.el('tr', {}, K.el('td', {}, (r.group === 'variant' ? `[${r.src}] ` : `${r.src}: `) + r.text), K.el('td', {}, r.best), K.el('td', { class: 'num' }, K.fmt(r.cos, 3)),
            K.el('td', { class: hit ? (r.right ? 'good' : 'bad') : '' }, hit ? (r.right ? 'HIT, right answer' : 'HIT, WRONG answer') : (r.group === 'variant' ? 'miss (LLM call)' : 'miss'))); }))));
        return det;
      }
      function sweepSvg() {
        const W = 600, H = 150, X = t => 30 + (W - 40) * (t - 0.5) / 0.49, Y = v => H - 22 - (H - 40) * v;
        const s = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:640px', role: 'img', 'aria-label': 'right hits, wrong hits and misses against tau' });
        [0, 0.5, 1].forEach(v => s.append(K.svg('line', { x1: 30, y1: Y(v), x2: W - 10, y2: Y(v), stroke: 'var(--line)' }), K.svg('text', { x: 4, y: Y(v) + 4, style: 'fill:var(--faint);font-size:10px' }, v.toFixed(1))));
        [0.5, 0.6, 0.7, 0.8, 0.9, 0.99].forEach(t => s.append(K.svg('text', { x: X(t), y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--faint);font-size:10px' }, t.toFixed(2))));
        const ts = []; for (let t = 0.5; t <= 0.99001; t += 0.01) ts.push(t);
        const line = (f, col) => s.append(K.svg('polyline', { points: ts.map(t => `${X(t)},${Y(f(realStats(rows, t)))}`).join(' '), fill: 'none', stroke: col, 'stroke-width': 2 }));
        line(x => x.variant_hits_right / x.variants, 'var(--he)'); line(x => (x.q_hits_wrong + x.variant_hits_wrong) / 24, 'var(--warn)');
        s.append(K.svg('line', { x1: X(tau), y1: 8, x2: X(tau), y2: H - 20, stroke: 'var(--ai)', 'stroke-width': 2 }));
        return K.el('div', {}, s, K.el('div', { class: 'hint' }, K.el('span', { class: 'good' }, 'teal: share of the 18 variants answered from cache (right answer)'), '  ', K.el('span', { class: 'bad' }, 'orange: wrong-answer hits per 24 questions'), '  amber line: tau.'));
      }
      function draw() {
        const s = realStats(rows, tau);
        stats.replaceChildren(K.el('div', {}, `tau = ${K.fmt(tau, 2)}: of ${s.variants} variants, `, K.el('b', { class: 'good num' }, String(s.variant_hits_right)), ' served with the right answer, ', K.el('b', { class: 'bad num' }, String(s.variant_hits_wrong)), ' with a wrong one, ', K.el('b', { class: 'num' }, String(s.variant_misses)), ' missed (LLM call). Of the 24 questions asked again after the others: ',
          K.el('b', { class: 'good num' }, String(s.q_hits_right)), ' hit with a coinciding answer, ', K.el('b', { class: 'bad num' }, String(s.q_hits_wrong)), ' hit with a WRONG cached answer.'),
          s.variant_hits_right === 0 ? K.el('div', { class: 'bad' }, 'Nothing is served from the cache: the best real variant-to-question cosine is far below a "safe" threshold like 0.95.') : '');
        plot.replaceChildren(axis(K, rows.filter(r => r.group === 'variant').map(r => ({ cos: r.cos, label: r.text.slice(0, 34), color: r.right ? 'var(--he)' : 'var(--warn)' })), tau, 0.5, 1));
        sweep.replaceChildren(sweepSvg());
        lists.replaceChildren(list('18 query variants vs the 24-question cache', rows.filter(r => r.group === 'variant'), 'Variants are terse search queries written by an LLM, not user paraphrases; the question in [brackets] is the one they came from. Variants of q09 best-match q01: both stored answers are "Hoerl and Kennard, 1970", so that hit is right (our label).'),
          list('24 questions asked after the other 23 are cached', rows.filter(r => r.group === 'question').sort((a, b) => b.cos - a.cos), 'Best match among the OTHER questions. Our labels (inferred, by reading the gold answers): q09 and q01 share an answer; q17 is answered by the stored q15 answer; every other pair needs a different answer. Top pairs: q17-q15 (0.907), q11-q03 (0.738: both about the elastic-net quadratic term, different questions).'));
        cost.draw();
      }
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: demo scale. 24 questions about 15 Wikipedia ML articles, 18 variants of 6 of them; written/generated by Claude and qwen3.7-plus, not real user traffic. The variants are keyword-style queries, so their cosines are modest (0.57 to 0.86 to their own question); true user paraphrases would score higher, and a real tau must be tuned on labelled same-answer / different-answer pairs from the real traffic and embedding model. The right-vs-wrong labels are ours. The hit rate here is a property of this test set, not of production traffic. Costs are invented. Source passages: question ids refer to _real-examples/data/questions.json (gold passage ids there). Text: Wikipedia contributors, CC BY-SA 4.0.');
      body.replaceChildren(K.el('div', { class: 'row' }, tauS.node), stats, plot, sweep, K.el('b', {}, 'Cost with the measured hit rate'), cost.node, lists, cav); draw();
    }).catch(e => { body.textContent = 'could not load the real-example data (' + e.message + '). Use the toy example.'; });
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

  const api = { defaults, compute, mount, realRows, realStats };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['semantic_cache'] = api;
})(this);
