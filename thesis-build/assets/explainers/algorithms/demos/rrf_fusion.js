/* Reciprocal Rank Fusion: merge a BM25 list and a cosine list by rank only. Edit scores, move k. */
(function (root) {
  const defaults = {
    bm25: [14.2, 9.6, 7.1, 3.4, 1.2],
    cos: [0.79, 0.82, 0.80, 0.74, 0.84],
    k: 60,
  };
  const NAMES = ['A', 'B', 'C', 'D', 'E'];

  /* ranks (1 = best) from scores; equal scores share the better rank */
  function ranksOf(s) { return s.map(v => 1 + s.filter(w => w > v).length); }

  /* PURE: RRF score per chunk, in input order: sum over lists of 1/(k + rank). */
  function compute(inp) {
    const rb = ranksOf(inp.bm25), rc = ranksOf(inp.cos);
    return inp.bm25.map((_, i) => 1 / (inp.k + rb[i]) + 1 / (inp.k + rc[i]));
  }
  const order = s => s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[1]);

  const PRESETS = {
    'worked example (k = 60)': () => ({ bm25: defaults.bm25.slice(), cos: defaults.cos.slice(), k: 60 }),
    'k = 0: first places win': () => ({ bm25: defaults.bm25.slice(), cos: defaults.cos.slice(), k: 0 }),
    'k = 1000: everything flat': () => ({ bm25: defaults.bm25.slice(), cos: defaults.cos.slice(), k: 1000 }),
    'break it: BM25 / 100 (other units)': () => ({ bm25: defaults.bm25.map(v => v / 100), cos: defaults.cos.slice(), k: 60 }),
  };

  /* ---- real example: pack at Presentations/_real-examples (fetched relative to this script) ---- */
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';
  const KS = [0, 1, 5, 10, 20, 60, 100, 200, 1000];
  const byQ = r => Object.fromEntries(r.questions.map(x => [x.qid, x.ranking.map(y => y.id)]));
  /* PURE: RRF over two stored top-20 id lists. A passage missing from a list gets NO term from it
     (its true rank is somewhere in 21..138; contribution at most 1/(k+21)). Ties break by id. */
  function realFuse(bm, dn, k) {
    const rb = Object.fromEntries(bm.map((x, i) => [x, i + 1])), rd = Object.fromEntries(dn.map((x, i) => [x, i + 1]));
    const ids = [...new Set([...bm, ...dn])];
    const rows = ids.map(id => ({ id, rb: rb[id] || null, rd: rd[id] || null,
      tb: rb[id] ? 1 / (k + rb[id]) : 0, td: rd[id] ? 1 / (k + rd[id]) : 0 }));
    rows.forEach(r => { r.rrf = r.tb + r.td; });
    rows.sort((a, b) => b.rrf - a.rrf || (a.id < b.id ? -1 : 1));
    return rows;
  }
  /* PURE: MRR and Recall@5 over answerable questions for one k (gold = list of ids per qid). */
  function realMetrics(pack, k) {
    let mrr = 0, r5 = 0, n = 0;
    for (const q of pack.answerable) {
      const o = realFuse(pack.bm25[q.id], pack.dense[q.id], k).map(r => r.id), g = q.gold_passages;
      const i = o.findIndex(x => g.includes(x)); mrr += i < 0 ? 0 : 1 / (i + 1);
      r5 += g.filter(x => o.slice(0, 5).includes(x)).length / g.length; n++;
    }
    return { mrr: mrr / n, r5: r5 / n, n };
  }
  function loadPack() {
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    return Promise.all([get('data/questions.json'), get('data/corpus.json'), get('runs/bm25_lucene.json'), get('runs/dense_cosine.json'), get('runs/rrf_bm25_dense.json')])
      .then(([questions, corpus, b, d, r]) => ({ questions, answerable: questions.filter(q => q.type !== 'unanswerable' && q.gold_passages.length),
        corpus: Array.isArray(corpus) ? corpus : (corpus.passages || Object.values(corpus)),
        bm25: byQ(b), dense: byQ(d), stored: Object.fromEntries(r.questions.map(x => [x.qid, x.ranking])) }));
  }

  function mount(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Reciprocal Rank Fusion',
      'Two retrievers give scores on different scales. Edit the scores, move k, and compare the naive sum with RRF. Then press "break it".');
    const cells = {};
    const tbl = K.el('table', { style: 'font-size:12px' });
    tbl.append(K.el('tr', {}, ...['', 'BM25', 'rank', 'cosine', 'rank', 'raw sum', 'RRF'].map(h => K.el('th', { style: 'padding:4px 3px;font-size:12px' }, h))));
    const numIn = (arr, i, step, label) => {
      const inp = K.el('input', { type: 'number', step, value: arr()[i], 'aria-label': label, style: 'width:44px;padding:2px 2px;font-size:12px' });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { arr()[i] = v; render(false); } });
      return inp;
    };
    NAMES.forEach((nm, i) => {
      const c = { b: K.el('td', {}, numIn(() => st.bm25, i, '0.1', `BM25 score of ${nm}`)), br: K.el('td', { class: 'num', style: 'padding:4px 3px' }),
        s: K.el('td', {}, numIn(() => st.cos, i, '0.01', `cosine score of ${nm}`)), sr: K.el('td', { class: 'num', style: 'padding:4px 3px' }),
        sum: K.el('td', { class: 'num', style: 'white-space:pre-line;padding:4px 3px' }), rrf: K.el('td', { class: 'num', style: 'white-space:pre-line;padding:4px 3px' }) };
      cells[i] = c; tbl.append(K.el('tr', {}, K.el('td', { style: 'font-weight:600' }, nm), c.b, c.br, c.s, c.sr, c.sum, c.rrf));
    });
    const kS = K.slider('k', 0, 200, 1, st.k, v => { st.k = v; render(true); });
    const kExtra = K.el('input', { type: 'number', min: 0, step: 1, value: st.k, 'aria-label': 'k exact value', style: 'width:70px' });
    kExtra.addEventListener('input', () => { const v = parseFloat(kExtra.value); if (Number.isFinite(v) && v >= 0) { st.k = v; kS.set(Math.min(200, v)); render(false); } });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n); b.addEventListener('click', () => { st = PRESETS[n](); kS.set(Math.min(200, st.k)); render(true); }); return b; }));
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const bars = K.el('div', {});
    const formula = K.el('div', { class: 'formula' });
    const toyBox = K.el('div', {}), realBox = K.el('div', {});
    const modeRow = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const mReal = K.el('button', {}, 'Real example'), mToy = K.el('button', {}, 'Toy example (break it)');
    modeRow.append(mReal, mToy);
    toyBox.append(presets, K.el('div', { class: 'row' }, kS.node, ' exact: ', kExtra), K.el('div', { style: 'overflow-x:auto' }, tbl), verdict, bars, formula);
    shell.append(modeRow, realBox, toyBox);
    function setMode(m) { const real = m === 'real'; realBox.style.display = real ? '' : 'none'; toyBox.style.display = real ? 'none' : ''; mReal.setAttribute('aria-pressed', String(real)); mToy.setAttribute('aria-pressed', String(!real)); mReal.style.outline = real ? '2px solid var(--ai, #F2A93B)' : ''; mToy.style.outline = real ? '' : '2px solid var(--ai, #F2A93B)'; }
    mReal.addEventListener('click', () => setMode('real')); mToy.addEventListener('click', () => setMode('toy'));

    const setCell = (n, t) => { if (n.textContent !== t) { n.textContent = t; if (n.dataset.seen) K.flash(n); n.dataset.seen = 1; } };
    function render(sync) {
      const rb = ranksOf(st.bm25), rc = ranksOf(st.cos), rrf = compute(st), sum = st.bm25.map((v, i) => v + st.cos[i]);
      const rs = ranksOf(sum), rr = ranksOf(rrf.map(v => Math.round(v * 1e12) / 1e12));
      NAMES.forEach((nm, i) => {
        const c = cells[i];
        setCell(c.br, '#' + rb[i]); setCell(c.sr, '#' + rc[i]);
        setCell(c.sum, `${K.fmt(sum[i], 3)}\n#${rs[i]}`);
        setCell(c.rrf, `${K.fmt(rrf[i], 6)}\n#${rr[i]}`);
        c.rrf.classList.toggle('good', rr[i] === 1);
        if (sync) { c.b.firstChild.value = st.bm25[i]; c.s.firstChild.value = st.cos[i]; }
      });
      if (sync && document.activeElement !== kExtra) kExtra.value = st.k;
      const nm = o => o.map(i => NAMES[i]).join(' > ');
      const oS = order(sum), oR = order(rrf.map(v => Math.round(v * 1e12) / 1e12)), oB = order(st.bm25), oC = order(st.cos);
      const followsB = nm(oS) === nm(oB), followsC = nm(oS) === nm(oC);
      verdict.replaceChildren(
        K.el('span', {}, 'BM25 order: ', K.el('b', {}, nm(oB)), '   cosine order: ', K.el('b', {}, nm(oC)), '   raw sum: ', K.el('b', {}, nm(oS)), '   RRF: ', K.el('b', { class: 'good' }, nm(oR))),
        K.el('b', { class: followsB || followsC ? 'bad' : 'good' }, followsB ? 'the raw sum just copies BM25' : followsC ? 'the raw sum just copies cosine' : 'the raw sum mixes both'));
      // bars of RRF score
      const mx = Math.max(...rrf), mn = Math.min(...rrf), lo = st.k > 0 || mn > 0 ? 0 : 0;
      bars.replaceChildren(...oR.map(i => K.el('div', { style: 'display:flex;align-items:center;gap:8px;margin:2px 0' },
        K.el('span', { style: 'width:18px;font-weight:600' }, NAMES[i]),
        K.el('div', { style: `height:12px;border-radius:3px;background:var(--ai);width:${mx > 0 ? (rrf[i] / mx * 70).toFixed(1) : 0}%` }),
        K.el('span', { class: 'num', style: 'color:var(--muted);font-size:12px' }, K.fmt(rrf[i], 6)))));
      const sel = oR[0], f = x => K.fmt(x, 6);
      formula.textContent = `winner ${NAMES[sel]} (ranks ${rb[sel]} and ${rc[sel]}, k = ${K.fmt(st.k, 3)})\n` +
        `RRF = 1/(${K.fmt(st.k, 3)}+${rb[sel]}) + 1/(${K.fmt(st.k, 3)}+${rc[sel]}) = ${f(1 / (st.k + rb[sel]))} + ${f(1 / (st.k + rc[sel]))} = ${f(rrf[sel])}\n` +
        `first place is worth ${K.fmt((st.k + 2) / (st.k + 1), 3)} times the second place (k = 0: 2 times, k = 60: about 1.016 times)`;
    }
    render(true);
    setMode('real');
    realBox.append(K.el('p', { class: 'hint' }, 'Loading the real-example pack ...'));
    loadPack().then(pack => {
      let rq = pack.answerable.find(q => q.id === 'q02') || pack.answerable[0], rk = 60;
      const text = Object.fromEntries(pack.corpus.map(p => [p.id, p]));
      const sel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%' }, ...pack.answerable.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question}`)));
      sel.value = rq.id; sel.addEventListener('change', () => { rq = pack.answerable.find(q => q.id === sel.value); rrender(); });
      const rks = K.slider('k', 0, 200, 1, rk, v => { rk = v; rkx.value = v; rrender(); });
      const rkx = K.el('input', { type: 'number', min: 0, step: 1, value: rk, 'aria-label': 'k exact value', style: 'width:70px' });
      rkx.addEventListener('input', () => { const v = parseFloat(rkx.value); if (Number.isFinite(v) && v >= 0) { rk = v; rks.set(Math.min(200, v)); rrender(); } });
      const info = K.el('div', { class: 'row', 'aria-live': 'polite' }), rtbl = K.el('table', { style: 'font-size:12px;width:100%' }), gold = K.el('div', { class: 'formula' });
      const ktbl = K.el('table', { style: 'font-size:12px;width:100%' }), knote = K.el('p', { class: 'hint' }), cav = K.el('p', { class: 'hint' });
      cav.textContent = 'Real data: 138 Wikipedia passages (CC BY-SA 4.0), 24 questions written by Claude (4 unanswerable, left out here: no gold passage), BM25 (Lucene idf) and all-MiniLM-L6-v2 cosine. Demo scale, n = 20 answerable questions: one question moves Recall@5 by 0.05, so differences between k values are inside the noise. The pack stores only the top 20 of each list. A passage missing from one list gets NO term from it (its true rank is 21 or worse, worth at most 1/(k+21)); this is the only approximation. The pack\'s own RRF run used the full 138-passage rankings, so a few scores in the "stored" column differ slightly at k = 60, and the order can differ below the top few places. RRF never uses the scores, only the ranks.';
      realBox.replaceChildren(K.el('p', { class: 'hint' }, 'Pick a real question. Both lists are real ranks; RRF adds 1/(k + rank) from each list. Move k and watch the gold passage (green).'),
        sel, K.el('div', { class: 'row' }, rks.node, ' exact: ', rkx), info, K.el('div', { style: 'overflow-x:auto' }, rtbl), gold,
        K.el('h4', {}, 'Does k matter? All 20 answerable questions, recomputed'), K.el('div', { style: 'overflow-x:auto' }, ktbl), knote, cav);
      const gRank = (ids, G) => { const i = ids.findIndex(x => G.includes(x)); return i < 0 ? '>20' : '#' + (i + 1); };
      const gNum = (q, k) => { const i = realFuse(pack.bm25[q.id], pack.dense[q.id], k).findIndex(r => q.gold_passages.includes(r.id)); return i < 0 ? 99 : i + 1; };
      function rrender() {
        const G = rq.gold_passages, bm = pack.bm25[rq.id], dn = pack.dense[rq.id], rows = realFuse(bm, dn, rk), st = pack.stored[rq.id];
        const base = realFuse(bm, dn, 60).map(r => r.id), same5 = base.slice(0, 5).join() === st.slice(0, 5).map(x => x.id).join();
        info.replaceChildren(K.el('span', {}, 'gold passage(s): ', K.el('b', { class: 'good' }, G.join(', ')),
          `   BM25 rank ${gRank(bm, G)}   cosine rank ${gRank(dn, G)}   RRF (k = ${K.fmt(rk, 3)}) `, K.el('b', {}, gRank(rows.map(r => r.id), G)),
          `   stored pack RRF (k = 60) ${gRank(st.map(x => x.id), G)}   candidates ${rows.length}`),
          K.el('span', { class: same5 ? 'good' : 'bad' }, same5 ? 'check: my k = 60 top 5 equals the stored RRF top 5' : 'check: my k = 60 top 5 differs from the stored top 5 (missing-rank approximation, see note)'));
        const stScore = Object.fromEntries(st.map(x => [x.id, x.score]));
        const head = ['rank', 'passage', 'BM25 rank', 'cos rank', '1/(k+rb)', '1/(k+rc)', 'RRF', 'stored k=60'];
        const out = [K.el('tr', {}, ...head.map(h => K.el('th', { style: 'padding:3px;font-size:12px' }, h)))];
        rows.slice(0, 8).forEach((r, j) => { const gd = G.includes(r.id), t = text[r.id];
          out.push(K.el('tr', { title: t ? `${t.article}: ${t.text.slice(0, 160)}...` : r.id },
            K.el('td', { class: 'num' }, '#' + (j + 1)), K.el('td', { class: gd ? 'good' : '', style: 'font-weight:600' }, r.id + (gd ? ' (gold)' : '')),
            K.el('td', { class: 'num' }, r.rb ? '#' + r.rb : '>20'), K.el('td', { class: 'num' }, r.rd ? '#' + r.rd : '>20'),
            K.el('td', { class: 'num' }, r.rb ? K.fmt(r.tb, 5) : '0'), K.el('td', { class: 'num' }, r.rd ? K.fmt(r.td, 5) : '0'),
            K.el('td', { class: 'num' }, K.fmt(r.rrf, 5)), K.el('td', { class: 'num' }, r.id in stScore ? K.fmt(stScore[r.id], 5) : 'not in top 20'))); });
        rtbl.replaceChildren(...out);
        const gi = rows.findIndex(r => G.includes(r.id)), gr = gi < 0 ? null : rows[gi], top = text[rows[0].id];
        gold.textContent = `question: ${rq.question}\ngold answer: ${rq.gold_answer}\n` + (gr ? `best gold passage ${gr.id} is at #${gi + 1}: RRF = 1/(${K.fmt(rk, 3)}+${gr.rb || '>20'}) + 1/(${K.fmt(rk, 3)}+${gr.rd || '>20'}) = ${gr.rb ? K.fmt(gr.tb, 5) : '0'} + ${gr.rd ? K.fmt(gr.td, 5) : '0'} = ${K.fmt(gr.rrf, 5)}\n` : 'no gold passage in either top-20 list\n') +
          `top passage ${rows[0].id}${top ? ' (' + top.article + ')' : ''}\n">20" = not in that list's stored top 20: no term from that list`;
        K.flash(info);
      }
      const ref = KS.map(k => [k, realMetrics(pack, k)]), m60 = ref.find(x => x[0] === 60)[1];
      const mv = KS.map(k => pack.answerable.filter(q => gNum(q, k) !== gNum(q, 60)).length);
      ktbl.replaceChildren(K.el('tr', {}, ...['k', ...KS.map(String)].map(h => K.el('th', { style: 'padding:3px;font-size:12px' }, h))),
        K.el('tr', {}, K.el('td', {}, 'MRR'), ...ref.map(([, m]) => K.el('td', { class: 'num' }, K.fmt(m.mrr, 3)))),
        K.el('tr', {}, K.el('td', {}, 'Recall@5'), ...ref.map(([, m]) => K.el('td', { class: 'num' }, K.fmt(m.r5, 3)))),
        K.el('tr', {}, K.el('td', {}, 'gold moves vs k=60'), ...mv.map(n => K.el('td', { class: 'num' }, String(n)))));
      const mlo = Math.min(...ref.map(x => x[1].mrr)), mhi = Math.max(...ref.map(x => x[1].mrr)), lo = Math.min(...ref.map(x => x[1].r5)), hi = Math.max(...ref.map(x => x[1].r5));
      knote.textContent = `n = ${m60.n}. At k = 60 the recomputed MRR ${K.fmt(m60.mrr, 3)} and Recall@5 ${K.fmt(m60.r5, 3)} match the pack's stored RRF run (0.975, 0.85). Across k = 0 to 1000 MRR ${mlo === mhi ? 'stays at ' + K.fmt(mlo, 3) : 'moves ' + K.fmt(mlo, 3) + ' to ' + K.fmt(mhi, 3)} and Recall@5 moves ${K.fmt(lo, 3)} to ${K.fmt(hi, 3)}: a spread of ${Math.round((hi - lo) / 0.05)} question${Math.round((hi - lo) / 0.05) === 1 ? '' : 's'} at most. That is within the noise of n = 20. Do not read it as "k = 60 is best"; the data cannot tell the k values apart. The last row counts the questions whose gold passage changes place against k = 60.`;
      rrender();
    }).catch(e => { realBox.replaceChildren(K.el('p', { class: 'bad' }, 'Could not load the real-example pack (' + e.message + '). Showing the toy example.')); setMode('toy'); });
  }

  const api = { defaults, compute, mount, ranksOf, realFuse, realMetrics };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['rrf_fusion'] = api;
})(this);
