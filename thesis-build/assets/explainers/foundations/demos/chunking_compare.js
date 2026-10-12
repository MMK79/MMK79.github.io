/* chunking_compare: fixed / recursive / sentence / semantic / parent-document chunk boundaries on a REAL passage of the pack,
   next to the stored real chunk-size experiment. Serves j2-chunking-taxonomy, j2-fixed-size-chunking, j2-recursive-chunking,
   j2-semantic-chunking (real cuts from stored sentence cosines, data/chunking_semantic.real.json), j2-parent-document-small-to-big, j2-structure-aware-chunking (section field).
   compute() is pure (no DOM). Pack files are fetched relative to this script (../../_real-examples/). */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';

  /* ---------- pure chunkers: everything works on word index ranges [a, b) of one passage ---------- */
  const words = t => t.trim().split(/\s+/).filter(Boolean);
  /* sentence ranges: a word ends a sentence if it ends in . ! ? (plus closing quote/bracket) and the next word starts with a capital, digit or quote. */
  function sentences(w) {
    const out = []; let s = 0;
    for (let i = 0; i < w.length; i++) {
      const end = /[.!?]["')\]]*$/.test(w[i]) && (i === w.length - 1 || /^["'(\[]?[A-Z0-9]/.test(w[i + 1])) && !/^(e\.g|i\.e|vs|etc|Fig|al)\.$/i.test(w[i]);
      if (end || i === w.length - 1) { out.push([s, i + 1]); s = i + 1; }
    }
    return out;
  }
  const len = r => r[1] - r[0];
  function fixed(n, N, O) { // sliding window, stride S = N - O (at least 1)
    if (n <= N) return n ? [[0, n]] : [];
    const S = Math.max(1, N - O), out = [];
    for (let a = 0; ; a += S) { out.push([a, Math.min(a + N, n)]); if (a + N >= n) break; }
    return out;
  }
  /* greedy merge of units (ranges) up to N words; carry trailing whole units of at most O words into the next chunk */
  function merge(units, N, O) {
    const out = []; let cur = [];
    const size = c => c.reduce((s, u) => s + len(u), 0);
    for (const u of units) {
      if (cur.length && size(cur) + len(u) > N) {
        out.push([cur[0][0], cur[cur.length - 1][1]]);
        let carry = [], tot = 0;
        for (let k = cur.length - 1; k >= 0 && tot + len(cur[k]) <= O; k--) { carry.unshift(cur[k]); tot += len(cur[k]); }
        cur = (tot + len(u) <= N) ? carry : [];
      }
      cur.push(u);
    }
    if (cur.length) out.push([cur[0][0], cur[cur.length - 1][1]]);
    return out;
  }
  function sentenceChunks(w, N, O) { return merge(sentences(w), N, O); } // never splits a sentence, even a longer one
  function recursiveChunks(w, N, O) { // separator list: [paragraph (none in this corpus)], sentence, word
    function rec(range, lvl) {
      if (len(range) <= N) return [range];
      let units;
      if (lvl === 0) { const ss = sentences(w.slice(range[0], range[1])).map(r => [r[0] + range[0], r[1] + range[0]]); units = ss.length > 1 ? ss : null; }
      if (!units) { units = []; for (let i = range[0]; i < range[1]; i++) units.push([i, i + 1]); }
      const pieces = []; units.forEach(u => (len(u) > N ? rec(u, lvl + 1) : [u]).forEach(p => pieces.push(p)));
      return merge(pieces, N, O);
    }
    return w.length ? rec([0, w.length], 0) : [];
  }
  const lc = s => s.toLowerCase();
  /* answer-bearing sentences: sentences that contain one of the question's check_terms (lexical proxy, same idea as the pack's experiment) */
  function answerSentences(w, terms) {
    const t = (terms || []).map(lc);
    return sentences(w).filter(r => { const s = lc(w.slice(r[0], r[1]).join(' ')); return t.some(x => s.includes(x)); });
  }
  const whole = (chunks, r) => chunks.some(c => c[0] <= r[0] && c[1] >= r[1]);
  function chunkBy(strategy, w, N, O) { return strategy === 'fixed' ? fixed(w.length, N, O) : strategy === 'recursive' ? recursiveChunks(w, N, O) : sentenceChunks(w, N, O); }

  /* PURE. inp = {texts:[passage text,...], size, overlap}. Returns chunk counts over all given passages per strategy. */
  function compute(inp) {
    const res = { fixed: 0, recursive: 0, sentence: 0, words: 0, passages: inp.texts.length };
    for (const t of inp.texts) {
      const w = words(t); res.words += w.length;
      res.fixed += fixed(w.length, inp.size, inp.overlap).length;
      res.recursive += recursiveChunks(w, inp.size, inp.overlap).length;
      res.sentence += sentenceChunks(w, inp.size, inp.overlap).length;
    }
    return res;
  }
  /* PURE. share of answer-bearing sentences that stay whole in one chunk, over the gold passages of the answerable questions. */
  function intactShare(strategy, corpus, questions, N, O) {
    const byId = {}; corpus.forEach(p => byId[p.id] = p); let ok = 0, tot = 0;
    for (const q of questions) for (const pid of q.gold_passages) {
      const w = words(byId[pid].text), ch = chunkBy(strategy, w, N, O);
      for (const r of answerSentences(w, q.check_terms)) { tot++; if (whole(ch, r)) ok++; }
    }
    return { ok, tot, share: tot ? ok / tot : 0 };
  }
  /* PURE. adjacent cosine distance rule of semantic chunking (j2-semantic-chunking): d_i = 1 - cos(e_i, e_i+1); cut where d_i > mean + z*sd. */
  function semanticCuts(vecs, z) {
    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), nrm = a => Math.sqrt(dot(a, a));
    const d = []; for (let i = 0; i + 1 < vecs.length; i++) d.push(1 - dot(vecs[i], vecs[i + 1]) / (nrm(vecs[i]) * nrm(vecs[i + 1])));
    const mu = d.reduce((s, x) => s + x, 0) / d.length, sd = Math.sqrt(d.reduce((s, x) => s + (x - mu) ** 2, 0) / d.length);
    return { d, mu, sd, cuts: d.map(x => x > mu + z * sd) };
  }
  /* PURE. same rule from STORED adjacent cosines of one article (data/chunking_semantic.real.json): cos[i] = cos(e_i, e_i+1); d_i = 1 - cos[i];
     threshold = mean(d) + z*sd(d) over the whole article (population sd); cut after sentence i if d_i > threshold. Returns chunks as [first, last+1) sentence ranges. */
  function cosCuts(cos, z) {
    const d = cos.map(c => 1 - c), n = d.length, mu = d.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(d.reduce((s, x) => s + (x - mu) ** 2, 0) / n), thr = mu + z * sd;
    const cuts = d.map(x => x > thr), chunks = []; let a = 0;
    cuts.forEach((c, i) => { if (c) { chunks.push([a, i + 1]); a = i + 1; } });
    chunks.push([a, n + 1]);
    return { d, mu, sd, thr, cuts, chunks };
  }
  /* PURE. parent-document grouping over sentence word counts: children = whole sentences packed to >= childW words, parents = whole children packed to >= parentW words
     (same packing rule as the pack's chunker). Returns {children:[[s0,s1)...], parents:[[s0,s1)...]}. */
  function parentGroups(wc, childW, parentW) {
    const packTo = (units, W) => { const out = []; let a = null, w = 0, last = 0; units.forEach(u => { if (a === null) a = u[0]; w += u[2]; last = u[1]; if (w >= W) { out.push([a, last, w]); a = null; w = 0; } }); if (a !== null) out.push([a, last, w]); return out; };
    const sent = wc.map((x, i) => [i, i + 1, x]), children = packTo(sent, childW), parents = packTo(children, parentW);
    return { children: children.map(c => [c[0], c[1]]), parents: parents.map(c => [c[0], c[1]]) };
  }
  const defaults = { texts: ['One sentence of seven words here. A second sentence follows with a few more words in it. Third one.'], size: 8, overlap: 0 };
  const api = { defaults, compute, intactShare, semanticCuts, cosCuts, parentGroups, fixed, recursiveChunks, sentenceChunks, sentences, words, answerSentences, whole };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['chunking_compare'] = api;

  /* ---------- browser part ---------- */
  function mount(el) {
    const K = DemoKit, E = K.el;
    const shell = K.shell(el, 'Chunking: where do the cuts fall?', 'Real Wikipedia passages from the pack. Move the sliders: four strategies cut the same passage, and the stored real experiment shows what chunk size does to retrieval.');
    const box = E('div'); shell.append(box);
    box.append(E('p', { class: 'hint' }, 'Loading the pack...'));
    const get = f => fetch(PACK + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    Promise.all([get('data/corpus.json'), get('data/questions.json'), get('data/chunking_experiment.json'), get('data/vectors_sample.json'), fetch(new URL('data/chunking_semantic.real.json', SRC).href).then(r => { if (!r.ok) throw new Error('chunking_semantic.real.json ' + r.status); return r.json(); })]).then(([corpus, questions, exp, vec, sem]) => build(box, corpus, questions, exp, vec, sem)).catch(e => { box.textContent = 'Cannot load the real pack (' + e.message + '). Serve the Presentations folder so ../../_real-examples/ resolves.'; });
  }
  function build(box, corpus, questions, exp, vec, SEM) {
    const K = DemoKit, E = K.el, byId = {}; corpus.forEach(p => byId[p.id] = p);
    document.head.append(E('style', {}, '.demo select{max-width:100%}.demo .tw{overflow-x:auto;max-width:100%}.demo .tw table{font-size:12px}.demo .tw td,.demo .tw th{padding:3px 5px}.demo label{display:block;max-width:100%}.demo .row>label:has(input[type=range]){display:inline-block}'));
    const answerable = questions.filter(q => q.gold_passages.length);
    const st = { qid: 'q01', pid: 'p002', size: 40, overlap: 0, z: 0.5 };
    box.textContent = '';
    box.append(E('p', { class: 'hint bad' }, 'Demo scale: 138 passages from 15 Wikipedia articles, 24 questions (20 answerable), helper-written, one embedding model (all-MiniLM-L6-v2). Differences of 0.05 in the stored experiment are ONE question. Real vs toy: boundaries and counts are computed live on the real passages; semantic cut points are computed live from stored real sentence similarities; retrieval numbers are read from data/chunking_experiment.json and demos/data/chunking_semantic.real.json (full articles, whole-sentence chunks, no overlap, top-5).'));
    const qSel = E('select', {}, answerable.map(q => E('option', { value: q.id }, q.id + ' - ' + q.question.slice(0, 60))));
    const pSel = E('select', {}, corpus.map(p => E('option', { value: p.id }, p.id + ' ' + p.article + ' / ' + p.section + ' (' + p.words + ' w)')));
    const sz = K.slider('chunk size (words)', 10, 300, 5, st.size, v => { st.size = v; fitOv(); draw(); });
    const ov = K.slider('overlap (words)', 0, 60, 1, st.overlap, v => { st.overlap = v; draw(); });
    const ovMax = () => Math.min(60, Math.floor(st.size / 2)), fitOv = () => { ov.node.querySelector('input').max = ovMax(); if (st.overlap > ovMax()) ov.set(st.overlap = ovMax()); }; fitOv();
    const preset = (label, s, o) => E('button', { onclick: () => { sz.set(st.size = s); fitOv(); ov.set(st.overlap = o); draw(); } }, label);
    qSel.addEventListener('change', () => { st.qid = qSel.value; st.pid = answerable.find(q => q.id === st.qid).gold_passages[0]; pSel.value = st.pid; draw(); });
    pSel.addEventListener('change', () => { st.pid = pSel.value; draw(); });
    pSel.value = st.pid;
    box.append(E('div', { class: 'row' }, E('label', {}, 'question ', qSel), E('label', {}, 'passage ', pSel)));
    box.append(E('div', { class: 'row' }, sz.node, ov.node));
    box.append(E('div', { class: 'row' }, preset('40 words, no overlap (pack: 342 chunks)', 40, 0), preset('40 words, 10 overlap (pack: 423)', 40, 10), preset('Break it: 15 words', 15, 0), preset('Real best size: 120 words', 120, 0)));
    const out = E('div'); box.append(out);
    const colours = ['#7C9CFF', '#3CC7B4', '#C28BFF', '#F2A93B'];

    function strip(name, note, chunks, w, ans, parentOf) {
      const div = E('div', { style: 'margin:10px 0' });
      const cut = ans.filter(r => !whole(chunks, r)).length;
      div.append(E('div', {}, E('b', {}, name), ' ', E('span', { class: 'num' }, chunks.length + ' chunk' + (chunks.length === 1 ? '' : 's')), ' ', E('span', { class: 'hint' }, note), cut ? E('span', { class: 'bad' }, ' | answer sentence CUT by a boundary') : (ans.length ? E('span', { class: 'good' }, ' | answer sentence kept whole') : '')));
      chunks.forEach((c, i) => {
        const prevEnd = i ? chunks[i - 1][1] : 0, col = colours[i % 4];
        const body = E('div', { style: 'border-left:3px solid ' + col + ';padding:2px 8px;margin:3px 0;font-size:13px' }, E('span', { class: 'num', style: 'color:' + col }, '#' + (i + 1) + ' [' + len(c) + 'w] '));
        for (let k = c[0]; k < c[1]; k++) {
          const isAns = ans.some(r => k >= r[0] && k < r[1]);
          body.append(E('span', { style: (k < prevEnd ? 'opacity:.55;font-style:italic;' : '') + (isAns ? 'text-decoration:underline;text-decoration-color:var(--he);' : '') }, w[k] + ' '));
        }
        div.append(body);
      });
      return div;
    }


    /* ---------- real semantic chunking + parent-document panels (data/chunking_semantic.real.json) ---------- */
    const SA = SEM.arms, f2 = (x, k = 2) => K.fmt(x, k), pct = x => f2(x, 4);
    const wcOf = S => S.map(x => x.split(/\s+/).filter(Boolean).length);
    function armRow(name, label, hl) {
      const a = SA[name]; if (!a) return null;
      return E('tr', { style: hl ? 'background:#F2A93B22' : '' }, E('td', {}, label || name), E('td', { class: 'num' }, a.n_embedded_units), E('td', { class: 'num' }, a.mean_words_embedded), E('td', { class: 'num' }, a.mean_words_returned || a.mean_words_embedded), E('td', { class: 'num' }, pct(a.top1_has_answer)), E('td', { class: 'num' }, pct(a.answer_hit_top5)), E('td', { class: 'num' }, pct(a.mean_sentence_recall_top5)), E('td', { class: 'num' }, a.mean_context_words_top5));
    }
    const HEAD = E('tr', {}, ['arm', 'units embedded', 'words / unit', 'words returned / unit', 'top-1 has answer', 'any answer in top-5', 'share of answer sentences in top-5', 'context words (top-5)'].map(h => E('th', {}, h)));
    function cmpRows(prefix) {
      return Object.keys(SEM.comparisons).filter(k => k.startsWith(prefix)).map(k => { const c = SEM.comparisons[k].sentence_recall_top5, h = SEM.comparisons[k].answer_hit_top5; return E('tr', {}, E('td', {}, k), E('td', { class: 'num' }, (c.mean_diff >= 0 ? '+' : '') + c.mean_diff + ' [' + c.ci95.join(', ') + ']'), E('td', { class: 'num' }, c.questions_better + ' / ' + c.questions_worse), E('td', { class: 'num' }, (h.mean_diff >= 0 ? '+' : '') + h.mean_diff + ' [' + h.ci95.join(', ') + ']')); });
    }
    const CMPHEAD = E('tr', {}, ['A minus B', 'recall of answer sentences in top-5: mean diff [95% bootstrap CI]', 'questions A better / worse', 'any answer in top-5: mean diff [95% CI]'].map(h => E('th', {}, h)));
    function semanticPanel(out, p, q) {
      const loc = SEM.passage_location[p.id];
      out.append(E('h4', {}, 'Semantic chunking: real cut points (all-MiniLM-L6-v2, 15 full articles)'));
      if (!loc) { out.append(E('p', { class: 'hint' }, p.id + ' was not located in its article stream (3 of 138 passages), so no stored sentence similarities for it.')); }
      else {
        const A = SEM.adjacent_cosine[loc.article], S = A.sentences, r = cosCuts(A.cos, st.z), a0 = loc.start, a1 = loc.start + loc.n;
        const zs = K.slider('z (cut where d > mean + z*sd)', 0, 2, 0.1, st.z, v => { st.z = v; draw(); });
        out.append(E('div', { class: 'row' }, zs.node));
        out.append(E('p', { class: 'hint' }, 'Rule (inferred practice rule, topic j2-semantic-chunking; TextTiling is the verified ancestor and uses a depth score, not this): d_i = 1 - cos(e_i, e_i+1) for adjacent sentences; the threshold is computed over the WHOLE article: mean ' + f2(r.mu, 3) + ' + z ' + f2(st.z, 1) + ' x sd ' + f2(r.sd, 3) + ' = ' + f2(r.thr, 3) + ' (' + A.cos.length + ' distances). The cosines below are stored real values; the cuts are computed by this page. Article "' + loc.article + '": ' + S.length + ' sentences -> ' + r.chunks.length + ' semantic chunks at this z.'));
        const body = E('div', { style: 'margin:6px 0;font-size:13px' });
        for (let i = a0; i < a1; i++) {
          body.append(E('span', {}, S[i] + ' '));
          if (i < a1 - 1) { const cut = r.cuts[i], d = r.d[i]; body.append(E('div', { class: 'num', style: 'margin:2px 0 4px 10px;font-size:12px;color:' + (cut ? '#F2605B' : 'var(--mut,#888)') }, (cut ? '--- CUT --- ' : '') + 'cos ' + f2(A.cos[i], 3) + ' (d ' + f2(d, 3) + (cut ? ' > ' : ' <= ') + f2(r.thr, 3) + ')')); }
        }
        out.append(body);
        const inWin = r.chunks.filter(c => c[1] > a0 && c[0] < a1).length;
        out.append(E('p', { class: 'hint' }, 'In this ' + loc.n + '-sentence passage: ' + (r.cuts.slice(a0, a1 - 1).filter(Boolean).length) + ' cut(s); chunks overlapping it: ' + inWin + ' (a chunk may extend past the passage edge). Neighbouring sentences of ONE passage are usually on one topic, so few cuts here is normal; try z = 0 to see the weakest links.'));
      }
      out.append(E('p', {}, E('b', {}, 'Real retrieval, same protocol as the table above'), ' (' + SEM.n_questions + ' questions, top-5, whole-sentence chunks, no overlap; the first rows reproduce the stored experiment exactly):'));
      const names = ['sentence-packing 40w', 'sentence-packing 120w', 'single sentence', 'semantic z=0.0', 'semantic z=0.5', 'semantic z=1.0'].concat(Object.keys(SA).filter(k => k.includes('matched')));
      out.append(E('div', { class: 'tw' }, E('table', {}, HEAD, names.map(n => armRow(n, null, n === 'semantic z=' + f2(st.z, 1))))));
      out.append(E('div', { class: 'tw' }, E('table', {}, CMPHEAD, cmpRows('semantic'))));
      out.append(E('p', { class: 'hint bad' }, 'Result: semantic chunking did NOT beat sentence packing here. At matched chunk counts it is lower on every metric (recall of answer sentences -0.13 [-0.30, +0.02] at both 400 and 957 chunks; any-answer-in-top-5 -0.20 [-0.40, -0.05] at 400 chunks). Only the 400-chunk "any answer" CI excludes 0; with n = 20 questions and one embedding model, treat the rest as "no sign of a benefit", not as proof of harm. Semantic chunks are uneven (a few very long ones: mean context 1,022 words vs 659 for packing at the same count), and the z rule is a practice rule, not tuned. Consistent with Qu 2024 (cited in the topic record) that the extra cost is not consistently justified; this run alone does not establish that.'));
    }
    function parentPanel(out, p, q, ans, w) {
      const loc = SEM.passage_location[p.id];
      out.append(E('h4', {}, 'Parent-document (small-to-big): real retrieval'));
      out.append(E('p', { class: 'hint' }, 'Rule: embed small children, search them, return the parent that holds the best child; parents deduplicated and ranked by their best child (topic j2-parent-document-small-to-big; no origin paper, so the method is inferred). Children = whole sentences packed to the child size; parents = whole children packed to the parent size, so a child never crosses a parent.'));
      if (loc) {
        const A = SEM.adjacent_cosine[loc.article], S = A.sentences, g = parentGroups(wcOf(S), 20, 120), a0 = loc.start, a1 = loc.start + loc.n;
        const ps = g.parents.filter(c => c[1] > a0 && c[0] < a1), qs = SEM.arms['parent-document: children 20w -> parent 120w'];
        out.append(E('p', { class: 'hint' }, 'In "' + loc.article + '", children of ~20 words (' + g.children.length + ' in the article) are embedded; the ' + ps.length + ' parent(s) of ~120 words overlapping this passage are shown (small boxes = children, outer line = parent). Underlined = answer-bearing sentence for the chosen question.'));
        ps.forEach((pr, k) => {
          const box = E('div', { style: 'border:1px solid #7C9CFF66;border-radius:6px;padding:4px 6px;margin:4px 0;font-size:12px' }, E('div', { class: 'num hint' }, 'parent ' + (k + 1) + ' (sentences ' + pr[0] + '-' + (pr[1] - 1) + ', ' + wcOf(S.slice(pr[0], pr[1])).reduce((x, y) => x + y, 0) + ' words)'));
          g.children.filter(c => c[0] >= pr[0] && c[1] <= pr[1]).forEach((c, j) => {
            const txt = S.slice(c[0], c[1]).join(' '), isAns = (q.check_terms || []).some(t => txt.toLowerCase().includes(t.toLowerCase()));
            box.append(E('span', { style: 'display:inline;border-left:3px solid ' + colours[j % 4] + ';padding:0 4px;margin-right:4px;' + (isAns ? 'text-decoration:underline;text-decoration-color:var(--he)' : '') }, txt + ' '));
          });
          out.append(box);
        });
      }
      const names = ['sentence-packing 20w', 'parent-document: children 20w -> parent 120w', 'sentence-packing 120w', 'parent-document: children 40w -> parent 120w', 'parent-document: children 1 sentence -> parent 120w', 'parent-document: children 20w -> parent 200w', 'parent-document: children 20w -> parent 300w', 'sentence-packing 300w'];
      out.append(E('div', { class: 'tw' }, E('table', {}, HEAD, names.map(n => armRow(n)))));
      out.append(E('div', { class: 'tw' }, E('table', {}, CMPHEAD, cmpRows('parent'))));
      out.append(E('p', { class: 'hint' }, 'Reading: with the SAME 1,533 small vectors, returning the 120-word parent raises the share of answer sentences found in top-5 from 0.5833 to 0.7333 (+0.15 [+0.04, +0.28], 5 questions better, 0 worse), but it hands the LLM 688 context words instead of 176. Against just embedding 120-word chunks directly (0.7833, 659 words) it does NOT win (-0.05 [-0.18, +0.05]; any-answer -0.10). So at this demo scale small-to-big gives about the recall of big chunks at about the same context, but with a much larger index (1,533 vs 400 vectors); it is not better than big chunks. n = 20; the larger parents (200, 300 words) raise recall further (0.83, 0.86) only because they return more words (1,099 and 1,590), and no downstream answer quality was measured.'));
    }

    function draw() {
      const q = questions.find(x => x.id === st.qid), p = byId[st.pid], w = words(p.text), N = st.size, O = st.overlap;
      out.textContent = '';
      const ans = answerSentences(w, q.check_terms);
      out.append(E('p', { class: 'hint' }, E('b', {}, p.article), ' / section "' + p.section + '" (a structure-aware chunker would use this heading path; here the whole Lead is one block). ', ' Question: ', E('i', {}, q.question), ' Answer-bearing sentence (underlined, lexical proxy: contains ' + JSON.stringify(q.check_terms) + '): ' + ans.length + ' found in this passage' + (q.gold_passages.includes(p.id) ? ' (gold passage).' : ' (this is not a gold passage of the question).')));
      const fx = fixed(w.length, N, O), rc = recursiveChunks(w, N, O), sc = sentenceChunks(w, N, O);
      out.append(strip('Fixed-size', 'window ' + N + ' words, stride ' + Math.max(1, N - O) + '; italic faded words = overlap copied from the previous chunk', fx, w, ans));
      out.append(strip('Recursive (paragraph > sentence > word)', 'this corpus has no paragraph breaks, so it packs whole sentences and splits only a sentence longer than the target', rc, w, ans));
      out.append(strip('Sentence packing', 'whole sentences up to the target size (this is how the pack experiment chunks, without overlap)', sc, w, ans));

      // counts + intact share on the whole corpus
      const texts = corpus.map(x => x.text), cnt = compute({ texts, size: N, overlap: O });
      const rows = [['Fixed-size', 'fixed'], ['Recursive', 'recursive'], ['Sentence packing', 'sentence']].map(([nm, k]) => { const s = intactShare(k, corpus, answerable, N, O); return E('tr', {}, E('td', {}, nm), E('td', { class: 'num' }, cnt[k]), E('td', { class: 'num' }, K.fmt(cnt.words / cnt[k], 1)), E('td', { class: 'num' }, s.ok + '/' + s.tot + ' = ' + K.fmt(s.share, 2))); });
      out.append(E('h4', {}, 'Counts on all 138 passages (' + cnt.words + ' words), computed by this page'));
      out.append(E('div', { class: 'tw' }, E('table', {}, E('tr', {}, E('th', {}, 'strategy'), E('th', {}, 'chunks'), E('th', {}, 'mean words'), E('th', {}, 'answer sentences kept whole (gold passages of 20 questions)')), rows)));
      out.append(E('p', { class: 'hint' }, 'Check against the pack: fixed 40/0 gives 342 and 40/10 gives 423 (+23.7% index size, topic j2-fixed-size-chunking). Now: ' + cnt.fixed + ' chunks at ' + N + '/' + O + (N === 40 && O === 0 ? (cnt.fixed === 342 ? ' (matches 342)' : ' (MISMATCH with 342)') : N === 40 && O === 10 ? (cnt.fixed === 423 ? ' (matches 423)' : ' (MISMATCH with 423)') : '') + '. These counts are on the 138 passages, NOT on the full articles of the experiment below.'));
      const gain = compute({ texts, size: N, overlap: 0 }).fixed;
      out.append(E('p', { class: 'hint' }, 'Overlap cost at this size: ' + gain + ' fixed chunks without overlap, ' + cnt.fixed + ' with ' + O + '-word overlap (' + (gain ? (cnt.fixed / gain * 100 - 100 >= 0 ? '+' : '') + K.fmt(cnt.fixed / gain * 100 - 100, 1) : 0) + '% index size). Recursive and sentence packing differ only where a sentence is longer than the target.'));

      // stored experiment
      const sizes = exp.sizes, near = sizes.reduce((b, s) => Math.abs(s - N) < Math.abs(b - N) ? s : b, sizes[0]);
      out.append(E('h4', {}, 'Retrieval effect: stored real experiment (' + exp.model.split('/').pop() + ', ' + exp.n_questions + ' answerable questions, full articles, sentence chunks, no overlap, top-5)'));
      const er = exp.results.map(r => E('tr', { style: r.target_words === near ? 'background:#F2A93B22' : '' }, E('td', { class: 'num' }, r.target_words), E('td', { class: 'num' }, r.n_chunks), E('td', { class: 'num' }, r.mean_words), E('td', { class: r.chunks_over_256_tokens ? 'bad num' : 'num' }, r.chunks_over_256_tokens), E('td', { class: 'num' }, r.share_intact_per_passage), E('td', { class: 'num' }, r.top1_has_answer), E('td', { class: 'num' }, r.mean_sentence_recall_top5), E('td', { class: 'num' }, r.mean_context_words_top5)));
      out.append(E('div', { class: 'tw' }, E('table', {}, E('tr', {}, ['target words', 'chunks', 'mean words', '> 256 tokens', 'answer kept whole', 'top-1 has answer', 'share of answer sentences in top-5', 'context words (top-5)'].map(h => E('th', {}, h))), er)));
      out.append(E('p', { class: 'hint' }, 'Highlighted row = the tested size nearest to your slider (' + near + ' words; only these six sizes were run). The fall at 200-300 words is partly the model limit: all-MiniLM-L6-v2 truncates at 256 tokens (red column). Top-1 stays within 0.45-0.60 (noise at n=20); the share found in top-5 peaks at 120 words (0.7833) and context cost grows with size. Counts in this table are for the experiment\'s full articles (53,064 words), read from the file, not reproduced here.'));
      // per question
      const pq = exp.results.map(r => r.per_question.find(x => x.qid === q.id));
      if (pq[0]) {
        out.append(E('p', {}, E('b', {}, q.id + ' on the real runs: '), pq.map((x, i) => E('div', { class: 'num' }, exp.results[i].target_words + 'w: ', E('span', { class: x.top1_has_answer ? 'good' : 'bad' }, x.top1_has_answer ? 'top-1 hit' : 'top-1 miss'), ' recall ' + x.sentence_recall_top5 + ' (' + x.context_words_top5 + ' ctx words)'))));
      } else out.append(E('p', { class: 'hint' }, q.id + ' has no row in the experiment file (not located).'));
      semanticPanel(out, p, q);
      parentPanel(out, p, q, ans, w);
      out.append(E('p', { class: 'hint' }, 'Not covered by the pack: proposition chunking (needs an LLM per passage), late chunking (needs a long-context embedder), structure-aware chunking beyond the section name (corpus holds only Lead/section labels, no tables or lists).'));
    }
    draw();
  }
  api.mount = mount;
})(this);
