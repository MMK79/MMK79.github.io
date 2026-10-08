/* MAP demo. Real example (default): AP per question on real retrieval runs, MAP over 20 questions.
   Toy example: a ranked list of 8 items, toggle which are relevant, set how many relevant exist in total. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  /* toy = worked example: relevant {d1,d3,d4}, ranking [d3,d7,d1,d9,d2] -> hits at ranks 1 and 3, d4 never retrieved */
  const defaults = { rel: [1, 0, 1, 0, 0], totalRel: 3 };

  /* PURE: AP = (1/|Rel|) * sum_k P@k * rel_k ; |Rel| includes relevant items never retrieved */
  function compute(inp) {
    let hits = 0, s = 0;
    inp.rel.forEach((r, i) => { if (r) { hits++; s += hits / (i + 1); } });
    return inp.totalRel > 0 ? s / inp.totalRel : 0;
  }
  /* pure: AP of a stored ranking (ids) given gold ids; gold beyond the stored list adds 0 */
  function apOf(ranking, gold) {
    const g = new Set(gold);
    return compute({ rel: ranking.map(d => (g.has(d) ? 1 : 0)), totalRel: gold.length });
  }

  function mountToy(el) {
    const K = root.DemoKit, LEN = 8;
    const st = { rel: defaults.rel.concat([0, 0, 0]), total: defaults.totalRel };
    const shell = K.shell(el, 'Toy example (break it)',
      'Click a rank to mark it relevant. "Relevant in total" counts relevant items the system never returned: they stay in the denominator. Each hit adds P@k, the precision at its rank.');
    const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'ranking' }), terms = K.el('div'), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const tot = K.el('input', { type: 'range', min: 1, max: 8, value: st.total, 'aria-label': 'relevant in total' });
    const totLab = K.el('span', { class: 'num' });
    tot.addEventListener('input', () => { st.total = +tot.value; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => { st.rel = defaults.rel.concat([0, 0, 0]); st.total = 3; render(); }),
      btn('Break it: 2 of 3 relevant, only at rank 8 and 7', () => { st.rel = [0, 0, 0, 0, 0, 0, 1, 1]; st.total = 3; render(); }),
      btn('Perfect', () => { st.rel = [1, 1, 1, 0, 0, 0, 0, 0]; st.total = 3; render(); }),
      btn('Same hits, late', () => { st.rel = [0, 0, 0, 0, 1, 1, 1, 0]; st.total = 3; render(); })),
      K.el('div', { class: 'row' }, K.el('label', {}, 'relevant in total ', tot, ' ', totLab)), strip, terms, res.node, formula, note);
    function render() {
      st.rel = st.rel.slice(0, LEN);
      strip.replaceChildren(); terms.replaceChildren(); totLab.textContent = String(st.total); tot.value = st.total;
      let hits = 0; const parts = [];
      st.rel.forEach((r, i) => {
        const k = i + 1;
        strip.append(K.el('button', { type: 'button', 'aria-pressed': r ? 'true' : 'false', title: 'rank ' + k, style: 'min-width:34px;' + (r ? 'border-color:var(--he);color:var(--he);background:rgba(60,199,180,.2)' : ''),
          onclick: () => { st.rel[i] = r ? 0 : 1; render(); } }, String(k)));
        if (r) {
          hits++; const p = hits / k; parts.push(`${hits}/${k}`);
          terms.append(K.el('div', { class: 'row' }, K.el('span', { class: 'num' }, `rank ${k}: P@${k} = ${hits}/${k} = ${K.fmt(p)}`),
            K.el('span', { style: `display:inline-block;height:10px;width:${Math.round(p * 120)}px;background:var(--ai,#F2A93B)` })));
        }
      });
      const m = compute({ rel: st.rel, totalRel: st.total });
      res.set(m, 4);
      formula.textContent = `AP = (${parts.join(' + ') || '0'}) / ${st.total} = ${K.fmt(m, 4)}`;
      const missed = st.total - hits;
      note.textContent = missed < 0 ? 'More hits than "relevant in total": raise the slider.'
        : missed > 0 ? `${missed} relevant item(s) never retrieved add nothing but still count in the denominator.` : 'Every relevant item was retrieved; AP now only measures how early.';
      note.className = 'hint' + (missed !== 0 ? ' bad' : '');
    }
    render();
  }

  /* ---- Real example (pack: Presentations/_real-examples) ---- */
  const METHODS = ['bm25_lucene', 'bm25_original', 'tfidf_cosine', 'dense_cosine', 'dense_dot', 'dense_l2',
    'rrf_bm25_dense', 'convex_bm25_dense', 'mmr_dense', 'rerank_ce_bm25', 'rerank_ce_dense', 'rerank_ce_rrf', 'maxsim_minilm'];
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('data/corpus.json')].concat(METHODS.map(m => get('runs/' + m + '.json')))).then(a => {
      const runs = {};
      METHODS.forEach((m, i) => { runs[m] = {}; a[2 + i].questions.forEach(q => { runs[m][q.qid] = q.ranking.map(x => x.id); }); });
      const corpus = a[1].passages || a[1], text = {};
      (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      return { questions: a[0].filter(q => q.gold_passages.length), text, runs };
    });
    return realData;
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'bm25_lucene', q: (D.questions.find(q => q.id === 'q11') || D.questions[0]).id, drop: new Set() };
    const shell = K.shell(el, 'Real example: AP and MAP on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. Questions written by Claude; gold = passages judged necessary (binary), so precision is a lower bound. Only the top-20 of each run is stored: a gold passage beyond rank 20 adds 0, so every AP here is truncated at 20 (a lower bound). Bridge and comparison questions have 2 gold passages and make AP informative; single-hop ones have 1 (AP = 1/rank, like MRR).');
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => K.el('option', { value: m }, m)));
    mSel.value = st.m; mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    const rows = K.el('div'), detail = K.el('div', { 'aria-live': 'polite' }), res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), meanBox = K.el('p', { class: 'hint' }), noise = K.el('p', { class: 'hint' }), tbl = K.el('div');
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)),
      K.el('div', { class: 'row' }, btn('Drop the most influential question', () => {
        const v = D.questions.map(q => [q.id, apFor(st.m, q)]), n = v.length, tot = v.reduce((s, x) => s + x[1], 0), mean = tot / n;
        let best = v[0], gap = -1; v.forEach(x => { const d = Math.abs((tot - x[1]) / (n - 1) - mean); if (d > gap) { gap = d; best = x; } });
        st.drop = new Set([best[0]]); render();
      }), btn('Restore all 20', () => { st.drop = new Set(); render(); })), rows, detail, res.node, formula, meanBox, noise, tbl);
    const apFor = (m, q) => apOf(D.runs[m][q.id], q.gold_passages);
    const meanFor = (m, skip) => { const qs = D.questions.filter(q => !(skip && skip.has(q.id))); return qs.reduce((s, q) => s + apFor(m, q), 0) / qs.length; };
    const looRange = m => { const n = D.questions.length, tot = D.questions.reduce((s, q) => s + apFor(m, q), 0), v = D.questions.map(q => (tot - apFor(m, q)) / (n - 1)); return [Math.min.apply(null, v), Math.max.apply(null, v)]; };
    function render() {
      rows.replaceChildren();
      D.questions.forEach(q => {
        const a = apFor(st.m, q), off = st.drop.has(q.id);
        const cb = K.el('input', { type: 'checkbox', 'aria-label': 'drop ' + q.id, onchange: e => { e.target.checked ? st.drop.add(q.id) : st.drop.delete(q.id); render(); } }); cb.checked = off;
        const pick = K.el('button', { type: 'button', 'aria-pressed': st.q === q.id ? 'true' : 'false', title: q.question,
          style: 'min-width:150px;text-align:left;' + (st.q === q.id ? 'border-color:var(--he);color:var(--he)' : ''), onclick: () => { st.q = q.id; render(); } }, `${q.id} ${q.type} (${q.gold_passages.length} gold)`);
        rows.append(K.el('div', { class: 'row', style: off ? 'opacity:.35' : '' }, cb, pick,
          K.el('span', { style: `display:inline-block;height:10px;width:${Math.round(a * 120)}px;background:var(--ai,#F2A93B);vertical-align:middle;margin:0 6px` }), K.el('span', { class: 'num' }, 'AP = ' + K.fmt(a))));
      });
      const q = D.questions.find(x => x.id === st.q), rk = D.runs[st.m][q.id], gold = new Set(q.gold_passages);
      const ranks = rk.map((d, i) => gold.has(d) ? i + 1 : 0).filter(Boolean), miss = q.gold_passages.filter(g => rk.indexOf(g) < 0);
      let h = 0; const parts = ranks.map(k => { h++; return `${h}/${k}`; });
      detail.replaceChildren(K.el('p', { class: 'hint' }, `${q.id}: ${q.question}  Gold: ${q.gold_passages.join(', ')}. Found at rank ${ranks.join(', ') || 'none'}${miss.length ? '; ' + miss.join(', ') + ' outside the stored top-20 (adds 0)' : ''}.`),
        K.el('div', { class: 'formula' }, `AP = (${parts.join(' + ') || '0'}) / ${q.gold_passages.length} = ${K.fmt(apFor(st.m, q), 4)}`));
      const upto = Math.max(ranks.length ? ranks[ranks.length - 1] : 5, 3);
      rk.slice(0, Math.min(upto, 12)).forEach((id, i) => {
        const hit = gold.has(id);
        detail.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (hit ? '--he' : '--warn') + ')' },
          K.el('b', {}, (i + 1) + '. ' + id + (hit ? '  gold' : '  not gold') + ' '), K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 100) + (D.text[id] && D.text[id].length > 100 ? '...' : ''))));
      });
      if (upto > 12) detail.append(K.el('p', { class: 'hint' }, `(ranks 13-${upto} not listed)`));
      const kept = D.questions.filter(x => !st.drop.has(x.id)), m = meanFor(st.m, st.drop);
      res.set(m, 4);
      formula.textContent = `MAP = (sum of AP over ${kept.length} question${kept.length === 1 ? '' : 's'}) / ${kept.length} = ${K.fmt(m, 4)}`;
      meanBox.textContent = `All ${D.questions.length} questions, ${st.m}: MAP ${K.fmt(meanFor(st.m), 4)} (computed live from runs/ and data/questions.json; the pack stores no MAP, so there is no stored value to compare).`;
      const [lo, hi] = looRange(st.m);
      noise.textContent = `Drop any single question and ${st.m} moves anywhere from ${K.fmt(lo, 4)} to ${K.fmt(hi, 4)}. Method gaps smaller than this are noise.`;
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'method'), K.el('th', { align: 'right' }, 'MAP'), K.el('th', { align: 'right' }, 'drop-one range')),
        METHODS.map(x => { const r = looRange(x); return K.el('tr', { style: x === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, x), K.el('td', { align: 'right', class: 'num' }, K.fmt(meanFor(x), 4)), K.el('td', { align: 'right', class: 'num' }, K.fmt(r[0], 3) + ' to ' + K.fmt(r[1], 3))); }));
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'Compare all methods (overlapping ranges = no clear winner)'), t));
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real runs...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['map'] = api;
})(this);
