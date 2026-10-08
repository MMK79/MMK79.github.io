/* Hit rate@k demo: four query cards turn green/red as k grows; real mode uses the pack's retrieval runs. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    // four queries, 9-deep rankings; relevant item at rank 2, 8, 1, 5 -> hits in the top 5: yes, no, yes, yes
    queries: [
      { ranking: ['a1', 'REL', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'], relevant: ['REL'] },
      { ranking: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'REL', 'b9'], relevant: ['REL'] },
      { ranking: ['REL', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'], relevant: ['REL'] },
      { ranking: ['d1', 'd2', 'd3', 'd4', 'REL', 'd6', 'd7', 'd8', 'd9'], relevant: ['REL'] },
    ],
    k: 5,
  };

  /* PURE: Hit@k = (1/|Q|) sum_q 1[Rel_q ∩ Ret_{q,k} ≠ ∅] */
  function compute(inp) {
    const qs = inp.queries;
    if (!qs.length) return 0;
    let s = 0;
    qs.forEach(q => {
      const k = Math.max(1, Math.min(inp.k, q.ranking.length));
      const rel = new Set(q.relevant);
      if (q.ranking.slice(0, k).some(d => rel.has(d))) s += 1;
    });
    return s / qs.length;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { k: defaults.k, qs: defaults.queries.map(q => ({ ranking: q.ranking.slice(), relevant: new Set(q.relevant) })) };
    const shell = K.shell(el, 'Toy example (break it)',
      'Four queries, each with a ranked list. Drag k and watch cards flip from miss to hit. Click a document to flip it between relevant and not.');
    const cards = K.el('div');
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const kS = K.slider('k', 1, 9, 1, st.k, v => { st.k = v; render(); });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const reset = () => { st.qs = defaults.queries.map(q => ({ ranking: q.ranking.slice(), relevant: new Set(q.relevant) })); };
    shell.append(K.el('div', { class: 'row' }, kS.node),
      K.el('div', { class: 'row' },
        btn('Worked example (k = 5)', () => { reset(); kS.set(st.k = 5); render(); }),
        btn('Break it: k = 9, hits for everyone', () => { reset(); kS.set(st.k = 9); render(); }),
        btn('Break it: no relevant labels', () => { st.qs.forEach(q => q.relevant.clear()); render(); })),
      cards, res.node, formula, note);

    function render() {
      cards.replaceChildren();
      const flags = [];
      st.qs.forEach((q, qi) => {
        const hit = q.ranking.slice(0, st.k).some(d => q.relevant.has(d)); flags.push(hit);
        const strip = K.el('span', {});
        q.ranking.forEach((d, i) => {
          const inK = i < st.k, rel = q.relevant.has(d);
          strip.append(K.el('button', {
            type: 'button', 'aria-pressed': rel ? 'true' : 'false',
            title: (rel ? 'relevant' : 'not relevant') + (inK ? ', counted' : ', outside top-k'),
            style: 'min-width:40px;' + (inK ? '' : 'opacity:.35;') + (rel ? 'border-color:var(--he);color:var(--he)' : ''),
            onclick: () => { rel ? q.relevant.delete(d) : q.relevant.add(d); render(); },
          }, String(i + 1) + (rel ? '*' : '')));
        });
        cards.append(K.el('div', { style: 'margin:4px 0;padding:4px 6px;border-left:4px solid var(' + (hit ? '--he' : '--warn') + ')' },
          K.el('b', {}, 'query ' + (qi + 1) + ': '), strip, K.el('b', { style: 'margin-left:8px;color:var(' + (hit ? '--he' : '--warn') + ')' }, hit ? 'hit (1)' : 'miss (0)')));
      });
      const score = compute({ queries: st.qs.map(q => ({ ranking: q.ranking, relevant: Array.from(q.relevant) })), k: st.k });
      res.set(score);
      const n = flags.length, h = flags.filter(Boolean).length;
      formula.textContent = `Hit@${st.k} = (${flags.map(f => f ? 1 : 0).join(' + ')}) / ${n} = ${h} / ${n} = ${K.fmt(score)}`;
      note.textContent = 'Starred positions are relevant. One relevant document anywhere in the top-k is a full hit; k only ever raises the score.';
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
      const corpus = a[1].passages || a[1];
      const text = {}; (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      return { questions: a[0].filter(q => q.gold_passages.length), text, runs };
    });
    return realData;
  }
  const hitQ = (ranking, gold, k) => compute({ queries: [{ ranking, relevant: gold }], k });

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { m: 'bm25_lucene', k: 3, q: 'q09' };
    const shell = K.shell(el, 'Real example: Hit rate@k on real retrieval runs',
      'Demo scale: 20 answerable questions over 138 Wikipedia passages, not an evaluation of the thesis system. Gold labels cover only the necessary passages (helper-written questions). Only the top-20 of each run is stored, so k is limited to 20. Hit rate is computed live from the stored rankings and gold ids; the pack does not store it, so there is nothing to compare with.');
    const mSel = K.el('select', { 'aria-label': 'method' }, METHODS.map(m => K.el('option', { value: m }, m)));
    mSel.value = st.m; mSel.addEventListener('change', () => { st.m = mSel.value; render(); });
    const kS = K.slider('k', 1, 20, 1, st.k, v => { st.k = v; render(); });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const list = K.el('div');
    const detail = K.el('div', { 'aria-live': 'polite' });
    const bridge = K.el('p', { class: 'hint' });
    const tbl = K.el('div');
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'method ', mSel)), K.el('div', { class: 'row' }, kS.node),
      res.node, formula, bridge, list, detail, tbl);

    const meanFor = (m, k) => D.questions.reduce((s, q) => s + hitQ(D.runs[m][q.id], q.gold_passages, k), 0) / D.questions.length;
    function render() {
      const k = st.k;
      let h = 0;
      list.replaceChildren();
      const sel = D.questions.find(x => x.id === st.q);
      D.questions.forEach(q => {
        const rk = D.runs[st.m][q.id], gold = new Set(q.gold_passages), hit = hitQ(rk, q.gold_passages, k) === 1; if (hit) h++;
        const got = q.gold_passages.filter(g => rk.slice(0, k).includes(g)).length;
        const b = K.el('button', {
          type: 'button', 'aria-pressed': q.id === st.q ? 'true' : 'false',
          style: 'margin:2px;border-color:var(' + (hit ? '--he' : '--warn') + ');color:var(' + (hit ? '--he' : '--warn') + ')',
          title: q.question + ' | gold ' + q.gold_passages.join(', '),
          onclick: () => { st.q = q.id; render(); },
        }, q.id + (hit ? ' hit' : ' miss') + (hit && got < gold.size ? ' (' + got + '/' + gold.size + ')' : ''));
        list.append(b);
      });
      const score = h / D.questions.length;
      res.set(score);
      formula.textContent = `Hit@${k} = ${h} / ${D.questions.length} = ${K.fmt(score)}   (${st.m}, mean over all answerable questions)`;
      const partial = D.questions.filter(q => hitQ(D.runs[st.m][q.id], q.gold_passages, k) === 1 && q.gold_passages.some(g => !D.runs[st.m][q.id].slice(0, k).includes(g))).map(q => q.id);
      bridge.textContent = partial.length ? `Counted as a hit although a gold passage is still missing (needs 2): ${partial.join(', ')}. Hit rate cannot see this; all-hop recall can.` : `No question is a partial hit at k=${k}.`;
      const rk = D.runs[st.m][sel.id], gold = new Set(sel.gold_passages);
      detail.replaceChildren(K.el('p', { class: 'hint' }, sel.id + ' (' + sel.type + '): ' + sel.question + ' Gold passage(s): ' + sel.gold_passages.join(', ') + '. Gold answer: ' + sel.gold_answer));
      rk.slice(0, k).forEach((id, i) => {
        const g = gold.has(id);
        detail.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (g ? '--he' : '--warn') + ')' },
          K.el('b', {}, (i + 1) + '. ' + id + (g ? '  relevant' : '  not in gold') + ' '),
          K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 100) + (D.text[id] && D.text[id].length > 100 ? '...' : ''))));
      });
      const rows = METHODS.map(m => [m, meanFor(m, k), meanFor(m, 1)]);
      tbl.replaceChildren(K.el('details', {}, K.el('summary', {}, 'All methods at k=' + k + ' (the score saturates: try k = 1 vs 5)'),
        K.el('table', { style: 'width:100%;border-collapse:collapse' },
          K.el('tr', {}, K.el('th', { align: 'left' }, 'method'), K.el('th', { align: 'right' }, 'Hit@' + k), K.el('th', { align: 'right' }, 'Hit@1')),
          rows.map(([m, v, v1]) => K.el('tr', { style: m === st.m ? 'font-weight:bold' : '' }, K.el('td', {}, m),
            K.el('td', { align: 'right', class: 'num' }, K.fmt(v, 3)), K.el('td', { align: 'right', class: 'num' }, K.fmt(v1, 3)))))));
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
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
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['hit_rate_at_k'] = api;
})(this);
