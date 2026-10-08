/* Token F1 (SQuAD) demo: P = overlap/|pred|, R = overlap/|gold|, F1 = 2PR/(P+R), on bags of tokens (multiplicities kept).
   Everything is computed live in the page from the strings: no LLM, nothing precomputed. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { pred: 'stochastic gradient descent method', gold: 'gradient descent' };

  /* SQuAD normalisation: lower case, drop ASCII punctuation, drop the articles a / an / the, collapse spaces */
  const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
  function tokens(s) { return String(s).toLowerCase().replace(PUNCT, '').replace(/\b(a|an|the)\b/g, ' ').split(/\s+/).filter(Boolean); }

  /* PURE: full breakdown. matched[i] = token i of the prediction found in the gold (each gold token used once). */
  function breakdown(pred, gold) {
    const pt = tokens(pred), gt = tokens(gold), left = {};
    gt.forEach(w => { left[w] = (left[w] || 0) + 1; });
    const matched = pt.map(w => { if (left[w] > 0) { left[w]--; return true; } return false; });
    const c = matched.filter(Boolean).length;
    let p, r, f;
    if (!pt.length || !gt.length) { p = r = f = (pt.length === gt.length) ? 1 : 0; }   // SQuAD convention: both empty = 1
    else { p = c / pt.length; r = c / gt.length; f = c ? 2 * p * r / (p + r) : 0; }
    return { pt, gt, matched, common: c, p, r, f };
  }
  function compute(inp) { return breakdown(inp.pred, inp.gold).f; }

  const el = (K, tag, a, ...k) => K.el(tag, a, ...k);
  function chips(K, b, side) {
    const box = K.el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin:6px 0' });
    const toks = side === 'pred' ? b.pt : b.gt;
    let flags = b.matched;
    if (side === 'gold') {   // mark gold tokens that were found (consume in order)
      const left = {}; b.pt.forEach((w, i) => { if (b.matched[i]) left[w] = (left[w] || 0) + 1; });
      flags = toks.map(w => { if (left[w] > 0) { left[w]--; return true; } return false; });
    }
    toks.forEach((w, i) => box.append(K.el('span', { style: 'border:1px solid ' + (flags[i] ? 'var(--he)' : 'var(--warn)') + ';border-radius:5px;padding:0 5px;font-size:12px;' + (flags[i] ? 'background:rgba(60,199,180,.15)' : '') }, w)));
    return box;
  }
  function numbers(K, b) {
    return K.el('div', { class: 'row' },
      K.el('span', { class: 'num', style: 'color:var(--k12)' }, `P = ${b.common}/${b.pt.length} = ${K.fmt(b.p, 3)}`),
      K.el('span', { class: 'num', style: 'color:var(--both)' }, `R = ${b.common}/${b.gt.length} = ${K.fmt(b.r, 3)}`));
  }
  const fText = (K, b) => `F1 = 2 x ${K.fmt(b.p, 3)} x ${K.fmt(b.r, 3)} / (${K.fmt(b.p, 3)} + ${K.fmt(b.r, 3)}) = ${K.fmt(b.f, 4)}`;

  /* ---------------- Toy example ---------------- */
  function mountToy(el0) {
    const K = root.DemoKit;
    const st = Object.assign({}, defaults);
    const shell = K.shell(el0, 'Toy example (break it)', 'Edit the two answers. The score is recomputed on every keystroke from the words. Blue-green chips are shared words, orange chips are not.');
    const ip = K.el('input', { type: 'text', value: st.pred, 'aria-label': 'prediction', style: 'width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit' });
    const ig = K.el('input', { type: 'text', value: st.gold, 'aria-label': 'gold answer', style: ip.getAttribute('style') });
    const out = K.el('div'), res = K.resultBox(), fo = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const set = o => { Object.assign(st, o); ip.value = st.pred; ig.value = st.gold; render(); };
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults)),
      btn('Break it: verbose answer', () => set({ pred: 'The method is called gradient descent, an iterative first-order optimisation algorithm that repeatedly steps against the gradient', gold: 'gradient descent' })),
      btn('Break it: opposite meaning', () => set({ pred: 'not true', gold: 'true' })),
      btn('Break it: word forms', () => set({ pred: 'it overshoot', gold: 'it overshoots' })));
    ip.addEventListener('input', () => { st.pred = ip.value; render(); });
    ig.addEventListener('input', () => { st.gold = ig.value; render(); });
    shell.append(presets, K.el('label', { style: 'display:block' }, 'prediction ', ip), K.el('label', { style: 'display:block;margin-top:6px' }, 'gold answer ', ig), out, res.node, fo, note);
    function render() {
      const b = breakdown(st.pred, st.gold);
      out.replaceChildren(K.el('b', {}, `prediction (${b.pt.length} words)`), chips(K, b, 'pred'), K.el('b', {}, `gold (${b.gt.length} words)`), chips(K, b, 'gold'), numbers(K, b));
      res.set(b.f, 4); fo.textContent = fText(K, b);
      note.textContent = b.f === 1 && st.pred.trim() !== st.gold.trim() ? 'Perfect score, different text: only the bag of words counts.'
        : (b.p < 0.3 && b.r === 1) ? 'Every gold word is found (R = 1) but the answer is long, so precision and F1 collapse: F1 is dominated by length.'
        : (b.f > 0.6 && /\bnot\b/i.test(st.pred) !== /\bnot\b/i.test(st.gold)) ? 'High F1 although the meaning is the opposite: word order and negation are invisible.'
        : 'Words are lower-cased, punctuation and the articles a / an / the are removed first (the SQuAD recipe). No stemming: "overshoot" is not "overshoots".';
    }
    render();
  }

  /* ---------------- Real example ---------------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('answers/answers.json'), get('data/questions.json')]).then(a => {
      const ans = {}, qs = {}; a[0].forEach(r => { ans[r.qid + '_' + r.arm] = r; }); a[1].forEach(q => { qs[q.id] = q; });
      return { ans, qs };
    });
    return realData;
  }
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  function mountReal(el0, D) {
    const K = root.DemoKit;
    const qids = Object.keys(D.qs).filter(id => D.qs[id].type !== 'unanswerable' && D.ans[id + '_A']);
    const st = { arm: 'A', q: qids.includes('q06') ? 'q06' : qids[0], keep: 100 };
    const shell = K.shell(el0, 'Real example: token F1 of real answers against real gold answers',
      'Scale: n = 12 questions (9 answerable, shown here), one run, temperature 0, answerer qwen3.7-plus; the questions and short gold answers were written by Claude from the corpus text (gold answers are short paraphrases of the passages), not by independent annotators. Nothing is judged by an LLM: P, R and F1 are computed in this page from the real strings with the SQuAD recipe. A demo, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm; qSel.value = st.q;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const keepSl = K.slider('keep only the first % of the answer words', 5, 100, 5, st.keep, v => { st.keep = v; render(); });
    const info = K.el('div', { style: 'overflow-wrap:anywhere' }), res = K.resultBox(), fo = K.el('div', { class: 'formula', style: 'overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint' }), tbl = K.el('div', { style: 'overflow-wrap:anywhere' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)),
      info, K.el('div', { class: 'row' }, keepSl.node), res.node, fo, note, tbl);

    const full = (qid, arm) => breakdown(D.ans[qid + '_' + arm].answer, D.qs[qid].gold_answer);
    function render() {
      const q = D.qs[st.q], a = D.ans[st.q + '_' + st.arm];
      const all = tokens(a.answer), n = Math.max(1, Math.round(all.length * st.keep / 100));
      /* trimmed answer: take the first n normalised tokens (what-if, NOT a real system answer) */
      const trimmed = st.keep === 100;
      const b = trimmed ? breakdown(a.answer, q.gold_answer) : breakdown(all.slice(0, n).join(' '), q.gold_answer);
      info.replaceChildren(
        K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, 'Gold answer: '), q.gold_answer),
        K.el('p', { style: 'margin:6px 0' }, K.el('b', {}, `System answer (${st.arm}, ${a.context_ids && a.context_ids.length ? 'context ' + a.context_ids.join(', ') : 'no context'}): `), a.answer),
        K.el('b', {}, `answer words after clean-up (${b.pt.length}${trimmed ? '' : ' of ' + all.length + ', what-if trim'})`), chips(K, b, 'pred'),
        K.el('b', {}, `gold words (${b.gt.length})`), chips(K, b, 'gold'), numbers(K, b));
      res.set(b.f, 3);
      fo.textContent = fText(K, b);
      note.textContent = trimmed
        ? (b.r >= 0.5 && b.p < 0.3 ? 'Most gold words are in the answer (high recall) but the answer is ' + Math.round(b.pt.length / Math.max(1, b.gt.length)) + 'x longer than the gold, so precision and F1 are low. The answer may be correct; the metric measures overlap, not truth. Drag the slider to trim it and watch the score rise.'
          : b.f >= 0.5 ? 'A short answer close to the gold wording scores well.' : 'Few shared words: either the answer is wrong, or it says the same thing in other words (no synonyms, no stems).')
        : 'What-if: the real answer cut to its first ' + st.keep + '% of words. Shorter answers raise precision; this is why F1 is dominated by length, not a claim about correctness.';
      /* per-question table, chosen arm, whole answers (not trimmed) */
      const rows = qids.map(id => ({ id, b: full(id, st.arm) }));
      const t = K.el('table', { style: 'font-size:12px' }, K.el('tr', {}, ...['q', 'ans. words', 'gold words', 'P', 'R', 'F1'].map(h => K.el('th', {}, h))),
        ...rows.map(r => K.el('tr', { style: r.id === st.q ? 'background:rgba(242,169,59,.10)' : '' },
          K.el('td', {}, r.id), K.el('td', { class: 'num' }, String(r.b.pt.length)), K.el('td', { class: 'num' }, String(r.b.gt.length)),
          K.el('td', { class: 'num' }, r.b.p.toFixed(2)), K.el('td', { class: 'num' }, r.b.r.toFixed(2)), K.el('td', { class: 'num' }, r.b.f.toFixed(2)))));
      const m = k => mean(rows.map(r => r.b[k]));
      const armMeans = ['A', 'B', 'C'].map(arm => {
        const bs = qids.map(id => full(id, arm));
        return `${arm}: P ${K.fmt(mean(bs.map(x => x.p)), 2)}, R ${K.fmt(mean(bs.map(x => x.r)), 2)}, F1 ${K.fmt(mean(bs.map(x => x.f)), 2)}, mean ${K.fmt(mean(bs.map(x => x.pt.length)), 0)} words`;
      });
      tbl.replaceChildren(K.el('p', { class: 'hint', style: 'margin:10px 0 4px' }, `All ${qids.length} answerable questions, arm ${st.arm} (mean P ${K.fmt(m('p'), 2)}, R ${K.fmt(m('r'), 2)}, F1 ${K.fmt(m('f'), 2)}):`), t,
        K.el('p', { class: 'hint', style: 'margin:8px 0 0' }, 'Arm means, recomputed here: ' + armMeans.join('  |  ') + '. Gold answers average ' + K.fmt(mean(qids.map(id => full(id, 'A').gt.length)), 1) + ' words. Differences between arms mostly follow answer length (arm A writes the longest answers, B and C cite passages like [p093], which also count as words), and n = 9, so this is not a quality ranking.'));
    }
    render();
  }

  function mount(el0) {
    const K = root.DemoKit;
    const bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' });
    const body = K.el('div');
    const bR = K.el('button', { type: 'button' }, 'Real example'), bT = K.el('button', { type: 'button' }, 'Toy example (break it)');
    bar.append(bR, bT); el0.append(bar, body);
    function toy() { body.replaceChildren(); mountToy(body); bT.setAttribute('aria-pressed', 'true'); bR.setAttribute('aria-pressed', 'false'); }
    function real() {
      bR.setAttribute('aria-pressed', 'true'); bT.setAttribute('aria-pressed', 'false');
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, tokens, breakdown };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['token_f1'] = api;
})(this);
