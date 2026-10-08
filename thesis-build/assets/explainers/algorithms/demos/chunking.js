/* Chunking (size, overlap, structure).
   Real example (default): chunk-size experiment over 15 full Wikipedia articles, MiniLM cosine, top-5 chunks (data/chunking_experiment.json).
   Toy example: a 1000-word strip, exact enumeration of where a fact of f words stays whole (invented document, exact arithmetic). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = {
    L: 1000, f1: 30, f2: 60,
    configs: [['S100_O0', 100, 0], ['S100_O20', 100, 20], ['S100_O50', 100, 50], ['S200_O0', 200, 0], ['S200_O40', 200, 40], ['S50_O0', 50, 0], ['S50_O10', 50, 10]],
  };
  const r3 = x => Math.round(x * 1e3) / 1e3;
  /* chunk starts: every T = S-O words, the last chunk is moved to end at the document end */
  function starts(L, S, O) {
    const T = S - O, n = Math.ceil((L - O) / T), out = [];
    for (let k = 0; k < n; k++) out.push(Math.min(k * T, Math.max(0, L - S)));
    return out;
  }
  /* share of fact start positions (0..L-f) where the fact lies fully inside at least one chunk */
  function kept(L, S, O, f) {
    const st = starts(L, S, O); let ok = 0, tot = 0;
    for (let p = 0; p + f <= L; p++) { tot++; if (st.some(s => p >= s && p + f <= s + S)) ok++; }
    return tot ? ok / tot : 0;
  }
  /* PURE. Same shape as worked_example.result. */
  function compute(inp) {
    const out = {};
    inp.configs.forEach(([key, S, O]) => {
      out[key] = { chunks: starts(inp.L, S, O).length, storage_factor: r3(starts(inp.L, S, O).length * S / inp.L), fact30_kept: r3(kept(inp.L, S, O, inp.f1)), fact60_kept: r3(kept(inp.L, S, O, inp.f2)) };
    });
    return out;
  }
  /* storage factor in the catalogue = n*S/L rounded to 3 decimals; check below in node */

  const PRESETS = {
    'worked example (S=100, O=0)': { S: 100, O: 0, f: 30, p: 130 },
    'break it: fact longer than the chunk': { S: 50, O: 10, f: 60, p: 300 },
    'break it: fact on a border, no overlap': { S: 100, O: 0, f: 30, p: 85 },
    'overlap rescues it (O=50)': { S: 100, O: 50, f: 30, p: 85 },
  };

  function mountToy(el) {
    const K = DemoKit, L = 1000, st = { S: 100, O: 0, f: 30, p: 130 };
    const shell = K.shell(el, 'Chunking: cut a document, see which facts survive',
      'Invented 1000-word document. A chunk of S words starts every S - O words. The amber bar is a fact of f words; it is "whole" if one chunk covers all of it. Pure arithmetic: no embedding model, so it shows cuts, not retrieval quality.');
    const presets = K.el('div', { class: 'row' }), sl = K.el('div', { class: 'row' }), svgBox = K.el('div'), res = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' });
    const sS = K.slider('chunk size S', 10, 300, 5, st.S, v => { st.S = v; if (st.O >= v) { st.O = v - 5; sO.set(st.O); } render(); });
    const sO = K.slider('overlap O', 0, 295, 5, st.O, v => { st.O = Math.min(v, st.S - 1); render(); });
    const sF = K.slider('fact length f', 5, 150, 5, st.f, v => { st.f = v; render(); });
    const sP = K.slider('fact position', 0, 1000, 5, st.p, v => { st.p = v; render(); });
    sl.append(sS.node, sO.node, sF.node, sP.node);
    Object.keys(PRESETS).forEach(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { Object.assign(st, PRESETS[k]); sS.set(st.S); sO.set(st.O); sF.set(st.f); sP.set(st.p); render(); }); presets.append(b); });
    shell.append(presets, sl, svgBox, res, formula);
    let last = '';
    function render() {
      const S = st.S, O = Math.min(st.O, S - 1), f = st.f, p = Math.min(st.p, L - f), sts = starts(L, S, O), n = sts.length;
      const x = v => 10 + v * 780 / L, rowH = 14, rows = Math.min(n, 40), H = 40 + rows * 0 + 70;
      const inC = sts.map(s => p >= s && p + f <= s + S), whole = inC.some(Boolean);
      const g = [];
      // chunks stacked in 2 alternating lanes so overlap is visible
      sts.forEach((s, i) => g.push(K.svg('rect', { x: x(s), y: 30 + (i % 3) * 16, width: Math.max(1, x(S) - x(0)), height: 12, rx: 2, fill: inC[i] ? 'var(--he)' : 'var(--k12)', opacity: inC[i] ? 0.9 : 0.45, stroke: 'var(--bg)', 'stroke-width': 1 })));
      g.push(K.svg('rect', { x: x(p), y: 20, width: Math.max(2, x(f) - x(0)), height: 4, fill: whole ? 'var(--ai)' : 'var(--warn)' }));
      g.push(K.svg('text', { x: 10, y: 12 }, 'document, 0 to ' + L + ' words'));
      g.push(K.svg('line', { x1: 10, y1: 92, x2: 790, y2: 92, stroke: 'var(--line)' }));
      const svg = K.svg('svg', { viewBox: '0 0 800 100', width: '100%', role: 'img', 'aria-label': 'chunk windows over the document' }, ...g);
      svgBox.replaceChildren(svg);
      const stor = n * S / L, pw = kept(L, S, O, f), approx = Math.max(0, Math.min(1, (S - f + 1) / (S - O)));
      res.replaceChildren(
        K.el('div', {}, whole ? K.el('b', { class: 'good' }, 'The fact sits whole in a chunk.') : K.el('b', { class: 'bad' }, f > S ? 'The fact is longer than a chunk: no chunk can ever hold it.' : 'The fact is cut by a border: no chunk holds all of it.')),
        K.el('div', {}, `chunks n = ${n}, stride T = ${S - O}, storage factor = ${K.fmt(stor, 2)} (text stored ${K.fmt(stor, 2)} times)`),
        K.el('div', {}, 'chance a fact of this length at a random position stays whole: ', K.el('b', { class: pw > 0.8 ? 'good' : 'bad' }, K.fmt(pw, 3)), `   (approximation min(1, max(0, (S-f+1)/T)) = ${K.fmt(approx, 3)})`));
      formula.textContent = `T = S - O = ${S - O}    n = ceil((L-O)/T) = ceil(${L - O}/${S - O}) = ${n}    storage ~ nS/L = ${K.fmt(stor, 3)}`;
      const sig = `${S}|${O}|${f}|${p}`; if (sig !== last) { K.flash(res); last = sig; }
    }
    render();
  }

  function mountReal(el) {
    const K = DemoKit, base = new URL('../../_real-examples/', SRC || location.href).href;
    const box = K.shell(el, 'Real example: chunk size versus retrieval',
      'Real run: the 15 full Wikipedia articles (53,064 words) were cut into whole-sentence chunks of a target size (no overlap) and searched with all-MiniLM-L6-v2 cosine, top 5 chunks, for 20 answerable questions. Numbers are stored results of that run (not computed in this page).');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    Promise.all([get('data/chunking_experiment.json'), get('data/questions.json')]).then(([ex, qs]) => {
      const R = ex.results;
      const M = [['mean_sentence_recall_top5', 'share of answer sentences found in the top-5 chunks', 'good'], ['share_full_coverage_top5', 'questions with ALL answer sentences in the top 5', 'good'],
        ['top1_has_answer', 'top-1 chunk contains an answer sentence', 'good'], ['share_intact_per_passage', 'answer sentences of each gold passage stay in one chunk', 'good'],
        ['mean_context_words_top5', 'context handed to the LLM: words in top 5 (cost)', 'warn'], ['n_chunks', 'chunks to embed and store', 'warn']];
      const sel = K.el('select', { 'aria-label': 'metric' }, ...M.map((m, i) => K.el('option', { value: i }, m[1])));
      const chart = K.el('div'), tbl = K.el('div'), qsel = K.el('select', { 'aria-label': 'question', style: 'max-width:100%' }, ...qs.filter(q => q.gold_passages.length).map(q => K.el('option', { value: q.id }, `${q.id} (${q.type}): ${q.question.slice(0, 60)}`))), perq = K.el('div');
      const cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' },
        'Caveats. (1) "Answer-bearing sentence" is a lexical proxy: a sentence of a gold passage that contains one of the question\'s check strings; it is not human-annotated. (2) all-MiniLM-L6-v2 truncates its input at 256 tokens: most 200-word and all 300-word chunks lose their tail (see the "over 256 tokens" column), so the fall at 200-300 words is partly this model limit, not chunk size alone. (3) 20 questions: a gap of 0.05 is one question; the curve is jagged (top-1 at 300 words is the highest). (4) No overlap and no structure-aware split were tested: overlap and structure appear only in the toy example. (5) Demo scale, not an evaluation of the thesis system. Text: Wikipedia contributors, CC BY-SA 4.0.');
      function draw() {
        const m = M[+sel.value], key = m[0], isCount = key === 'n_chunks' || key.startsWith('mean_context'), mx = Math.max(...R.map(r => r[key])) || 1;
        chart.replaceChildren(...R.map(r => {
          const trunc = r.chunks_over_256_tokens / r.n_chunks, w = 100 * r[key] / mx;
          return K.el('div', { style: 'margin:5px 0' }, K.el('div', { class: 'num', style: 'font-size:13px' }, `${r.target_words} words  `, K.el('b', {}, isCount ? K.fmt(r[key], 0) : K.fmt(r[key], 3)), `   (${r.n_chunks} chunks, ${r.chunks_over_256_tokens} over 256 tokens${trunc > 0.5 ? ', MOST TRUNCATED' : ''})`),
            K.el('div', { style: `height:10px;width:${w}%;background:${m[2] === 'good' ? (trunc > 0.5 ? 'var(--warn)' : 'var(--he)') : 'var(--ai)'};border-radius:2px` }));
        }));
        tbl.replaceChildren(K.el('div', { class: 'hint' }, m[2] === 'good' ? 'Teal bars: higher is better. Orange bars: more than half of the chunks exceed the 256-token limit of the embedder.' : 'Amber bars: cost grows with chunk size.'));
        const q = qs.find(x => x.id === qsel.value);
        perq.replaceChildren(K.el('div', {}, K.el('b', {}, q.question)), K.el('div', { class: 'hint' }, `gold passages (source ids in corpus.json): ${q.gold_passages.join(', ')}. gold answer: ${q.gold_answer}`),
          K.el('table', {}, K.el('tr', {}, ...['target', 'answer sentences', 'all in one chunk', 'top-1 has answer', 'found in top 5', 'top-5 words'].map(h => K.el('th', {}, h))),
            ...R.map(r => { const p = r.per_question.find(z => z.qid === q.id); return p ? K.el('tr', {}, K.el('td', {}, String(r.target_words)), K.el('td', {}, String(p.n_answer_sentences)), K.el('td', { class: p.all_in_one_chunk ? 'good' : 'bad' }, p.all_in_one_chunk ? 'yes' : 'no'), K.el('td', { class: p.top1_has_answer ? 'good' : 'bad' }, p.top1_has_answer ? 'yes' : 'no'), K.el('td', {}, K.fmt(p.sentence_recall_top5, 2)), K.el('td', {}, String(p.context_words_top5))) : K.el('tr'); })));
      }
      sel.addEventListener('change', draw); qsel.addEventListener('change', draw);
      body.replaceChildren(K.el('div', { class: 'row' }, K.el('label', {}, 'show ', sel)), chart, tbl,
        K.el('div', { class: 'hint' }, 'Reading: small chunks cut answer sentences apart (65% intact at 20 words, 100% at 120) but give the retriever less to match; recall in the top 5 rises to 120 words, then falls at 200-300 words (partly truncation). Bigger chunks also cost more context.'),
        K.el('div', { class: 'row' }, K.el('label', {}, 'one question ', qsel)), perq, cav); draw();
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

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['chunking'] = api;
})(this);
