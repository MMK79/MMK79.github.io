/* TF-IDF: edit four short documents and a query. idf bars show how distinctive each word is, the matrix shows tf x idf, the ranking re-sorts live. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    docs: [
      'graph retrieval uses a graph of entities',
      'vector retrieval uses embeddings',
      'the graph of the corpus has communities',
      'retrieval of the answer uses the context',
    ],
    query: 'graph retrieval',
    logtf: false,
  };
  const tokens = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
  const tfOf = (n, logtf) => (n === 0 ? 0 : logtf ? 1 + Math.log(n) : n);

  /* Collection statistics: vocabulary, per-document counts, document frequency n(t), idf = ln(N / n(t)). */
  function stats(inp) {
    const toks = inp.docs.map(tokens), N = toks.length;
    const counts = toks.map(t => { const m = {}; t.forEach(w => { m[w] = (m[w] || 0) + 1; }); return m; });
    const vocab = [...new Set(toks.flat())].sort();
    const df = {}, idf = {};
    vocab.forEach(w => { df[w] = counts.filter(c => c[w]).length; idf[w] = Math.log(N / df[w]); });
    return { N, counts, vocab, df, idf, len: toks.map(t => t.length) };
  }
  /* PURE: score(q,d) = sum over query words of tf(t,d) * idf(t); returns { d1, d2, ... }. */
  function compute(inp) {
    const s = stats(inp), q = tokens(inp.query), out = {};
    s.counts.forEach((c, i) => {
      out['d' + (i + 1)] = q.reduce((a, w) => a + (s.idf[w] === undefined ? 0 : tfOf(c[w] || 0, inp.logtf) * s.idf[w]), 0);
    });
    return out;
  }
  const rankOf = sc => sc.map(v => 1 + sc.filter(w => w > v + 1e-9).length);
  const clone = o => JSON.parse(JSON.stringify(o));

  const PRESETS = {
    'worked example': {},
    'raw count vs log tf': { logtf: true },
    'break it: keyword stuffing': { docs: [
      'graph retrieval uses a graph of entities', 'vector retrieval uses embeddings ' + 'graph '.repeat(30).trim(),
      'the graph of the corpus has communities', 'retrieval of the answer uses the context'] },
    'break it: every doc has the word': { docs: [
      'graph retrieval uses a graph of entities', 'graph vector retrieval uses embeddings',
      'the graph of the corpus has communities', 'graph retrieval of the answer uses the context'], query: 'graph' },
  };

  function mountToy(el) {
    const K = DemoKit;
    let st = clone(defaults), sel = 0, showAll = false;
    const COL = ['var(--he)', 'var(--k12)', 'var(--both)', 'var(--ai)'];
    const shell = K.shell(el, 'TF-IDF: which words are distinctive?',
      'Edit the documents or the query. A word in every document gets idf 0; a word in one document gets the largest idf. Query words are highlighted. Toy corpus (ours), natural log, raw counts by default.');

    const presetRow = K.el('div', { class: 'row' });
    const logBtn = K.el('button', { 'aria-pressed': 'false' }, 'log tf: off');
    logBtn.addEventListener('click', () => { st.logtf = !st.logtf; render(); });
    const allBtn = K.el('button', { 'aria-pressed': 'false' }, 'show all words');
    allBtn.addEventListener('click', () => { showAll = !showAll; render(); });
    const qIn = K.el('input', { type: 'text', value: st.query, 'aria-label': 'query', style: 'background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:inherit;width:200px' });
    qIn.addEventListener('input', () => { st.query = qIn.value; render(); });
    const docIns = st.docs.map((d, i) => {
      const t = K.el('textarea', { rows: 2, 'aria-label': 'document d' + (i + 1), style: 'flex:1 1 180px;min-width:0;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit' });
      t.value = d; t.addEventListener('input', () => { st.docs[i] = t.value; render(); }); return t;
    });
    Object.keys(PRESETS).forEach(k => {
      const b = K.el('button', {}, k);
      b.addEventListener('click', () => {
        st = Object.assign(clone(defaults), clone(PRESETS[k]));
        qIn.value = st.query; docIns.forEach((t, i) => { t.value = st.docs[i]; }); render(true);
      });
      presetRow.append(b);
    });
    const docRows = docIns.map((t, i) => K.el('div', { style: 'display:flex;gap:8px;align-items:flex-start;margin:4px 0' },
      K.el('b', { style: `color:${COL[i]};width:24px;padding-top:6px` }, 'd' + (i + 1)), t));
    const ctl = K.el('div', { class: 'row' }, K.el('label', {}, 'query ', qIn), logBtn, allBtn);
    const tbl = K.el('table', {});
    const verdict = K.el('div', { class: 'row', 'aria-live': 'polite' });
    const raw = K.el('div', { class: 'hint' });
    const formula = K.el('div', { class: 'formula' });
    shell.append(presetRow, ...docRows, ctl, K.el('div', { style: 'overflow-x:auto' }, tbl), verdict, raw, formula);

    function render() {
      const s = stats(st), q = [...new Set(tokens(st.query))], sc = compute(st), scv = Object.values(sc), rk = rankOf(scv);
      logBtn.textContent = 'log tf: ' + (st.logtf ? 'on' : 'off'); logBtn.setAttribute('aria-pressed', String(st.logtf));
      allBtn.setAttribute('aria-pressed', String(showAll));
      const words = showAll ? s.vocab : s.vocab.filter(w => q.includes(w));
      const maxIdf = Math.log(s.N) || 1;
      tbl.replaceChildren(K.el('tr', {}, K.el('th', {}, 'word'), K.el('th', {}, 'n(t)'), K.el('th', {}, 'idf'),
        ...s.counts.map((_, i) => K.el('th', { style: `color:${COL[i]}` }, 'd' + (i + 1) + ' tf-idf'))));
      words.forEach(w => {
        const isQ = q.includes(w), bar = K.el('span', { style: `display:inline-block;height:8px;border-radius:3px;background:var(--k12);width:${Math.max(2, 60 * s.idf[w] / maxIdf)}px;margin-right:6px` });
        tbl.append(K.el('tr', { style: isQ ? 'background:var(--panel2)' : '' },
          K.el('td', { style: isQ ? 'color:var(--ai);font-weight:600' : '' }, w), K.el('td', { class: 'num' }, String(s.df[w])),
          K.el('td', { class: 'num' }, bar, K.fmt(s.idf[w], 3)),
          ...s.counts.map(c => K.el('td', { class: 'num' }, c[w] ? `${K.fmt(tfOf(c[w], st.logtf), 2)} x = ${K.fmt(tfOf(c[w], st.logtf) * s.idf[w], 3)}` : '-'))));
      });
      q.filter(w => s.idf[w] === undefined).forEach(w => tbl.append(K.el('tr', {}, K.el('td', { style: 'color:var(--warn)' }, w), K.el('td', { colspan: 2 }, 'not in any document: ignored'), ...s.counts.map(() => K.el('td', {})))));
      tbl.append(K.el('tr', { style: 'border-top:2px solid var(--line)' }, K.el('td', { colspan: 3, style: 'font-weight:600' }, 'score(q, d)'),
        ...scv.map((v, i) => K.el('td', { class: 'num ' + (rk[i] === 1 ? 'good' : ''), style: 'cursor:pointer;font-weight:600', onclick: () => { sel = i; render(); } }, `${K.fmt(v, 3)}  #${rk[i]}`))));
      const order = rk.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]).map(x => 'd' + (x[1] + 1)).join(' > ');
      verdict.replaceChildren(K.el('span', {}, 'ranking: ', K.el('b', {}, order)));
      const rawc = s.counts.map(c => q.reduce((a, w) => a + (c[w] || 0), 0));
      raw.textContent = 'for comparison, raw count of query words: ' + rawc.map((v, i) => `d${i + 1} = ${v}`).join(', ') +
        (Math.max(...scv) === 0 ? '   (every score is 0: the query words are in all documents, idf = 0)' : '');
      const lines = q.filter(w => s.idf[w] !== undefined).map(w => { const c = s.counts[sel][w] || 0; return `${w}: tf ${K.fmt(tfOf(c, st.logtf), 3)} * ln(${s.N}/${s.df[w]}) = ${K.fmt(tfOf(c, st.logtf), 3)} * ${K.fmt(s.idf[w], 4)} = ${K.fmt(tfOf(c, st.logtf) * s.idf[w], 4)}`; });
      formula.textContent = `d${sel + 1} (click a score to choose)\n` + lines.join('\n') + `\nscore = ${K.fmt(scv[sel], 4)}   (no ceiling on tf, no length term: see BM25)`;
    }
    render();
  }

  /* Real example: one question from the real-example pack (138 Wikipedia passages, 24 questions). Numbers come from precomputed runs. */
  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: TF-IDF vs BM25 on Wikipedia passages',
      'Real data, real run: 138 passages from 15 English Wikipedia articles (ML topics), 24 questions. Pick a question: the gold passage(s) are marked, and you see where TF-IDF (cosine, L2-normalised) and BM25 (Lucene idf, k1 = 1.2, b = 0.75) rank them. Scores come from the stored runs, not from this page.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('data/corpus.json'), get('data/questions.json'), get('runs/tfidf_cosine.json'), get('runs/bm25_lucene.json')]).then(([corpus, qs, tf, bm]) => {
      const P = {}; corpus.forEach(p => { P[p.id] = p; });
      const run = r => { const m = {}; r.questions.forEach(q => { m[q.qid] = q.ranking; }); return m; };
      const T = run(tf), B = run(bm);
      const sel = K.el('select', { 'aria-label': 'question' }, ...qs.map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 80)}`)));
      sel.value = 'q02';
      const info = K.el('div', {}), cols = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' });
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats: n = 24 questions (20 answerable), written by Claude from the corpus text, not a benchmark. Gold labels cover only the passages judged necessary; other passages may also answer, so a "miss" can be a fair hit. The corpus is a sample (at most 10 passages per article). This is demo scale, not an evaluation of the thesis system. This TF-IDF is the cosine variant (raw tf x smooth idf, L2-normalised), a different form from the toy table. Text: Wikipedia contributors, CC BY-SA 4.0.');
      const open = new Set();
      function col(title, color, rk, gold) {
        const rows = rk.slice(0, 6).map((x, i) => {
          const p = P[x.id], isG = gold.includes(x.id), key = title + x.id;
          const btn = K.el('button', { 'aria-expanded': String(open.has(key)), style: 'text-align:left;width:100%;' + (isG ? 'border-color:var(--he)' : '') },
            `#${i + 1}  ${x.id}  ${K.fmt(x.score, 3)}  ${isG ? 'GOLD  ' : ''}${p.article}`);
          const txt = K.el('div', { class: 'hint', style: 'display:' + (open.has(key) ? 'block' : 'none') }, p.text);
          btn.addEventListener('click', () => { open.has(key) ? open.delete(key) : open.add(key); draw(); });
          return K.el('div', { style: 'margin:3px 0' }, btn, txt);
        });
        const gr = gold.map(g => { const i = rk.findIndex(x => x.id === g); return i < 0 ? `${g}: not in top 20` : `${g}: rank ${i + 1}`; }).join(', ');
        return K.el('div', { style: 'flex:1 1 320px;min-width:0' }, K.el('div', { style: `color:${color};font-weight:600` }, title), K.el('div', { class: 'hint' }, gold.length ? 'gold ' + gr : 'no gold passage (unanswerable)'), ...rows);
      }
      function draw() {
        const q = qs.find(x => x.id === sel.value), g = q.gold_passages;
        info.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `type: ${q.type}. gold passages: ${g.join(', ') || 'none'}. gold answer: ${q.gold_answer || '(none)'}`));
        cols.replaceChildren(col('TF-IDF (cosine)', 'var(--k12)', T[q.id], g), col('BM25 (Lucene)', 'var(--he)', B[q.id], g));
      }
      sel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', {}, 'question ', sel)), info, cols, cav); draw();
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

  const api = { defaults, compute, mount, rankOf };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['tfidf'] = api;
})(this);
