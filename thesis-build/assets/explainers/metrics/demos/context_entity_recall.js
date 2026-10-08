/* Context entity recall demo. Real mode: entities of the gold answer found in the retrieved passages, using OUR transparent extraction rule. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    re: ['gradient descent', 'learning rate', 'SGD', 'momentum'],     // entities of the reference answer
    ce: ['gradient descent', 'learning rate', 'momentum', 'batch size'], // entities found in the retrieved context
  };
  const norm = s => String(s).toLowerCase().trim();

  /* PURE: CER = |CE ∩ RE| / |RE| (exact string match after lower-casing) */
  function compute(inp) {
    const re = Array.from(new Set(inp.re.map(norm)));
    if (!re.length) return 0;
    const ce = new Set(inp.ce.map(norm));
    return re.filter(e => ce.has(e)).length / re.length;
  }

  /* ---- OUR entity rule (not Ragas'; Ragas uses an LLM). Pure, no DOM. ----
     An entity of a text is: (1) a graph-vocabulary term (node name or alias of graph/graph.json, >= 3 chars) found in it,
     longest match first; (2) a capitalised word or acronym (Hoerl, Tibshirani, ERM) that is not a plain sentence starter;
     (3) a number of 3+ digits (a year). */
  const STOP = new Set('the a an it its this that these those for in on of and or to is are as by with from at when if which while where there their they he she we not no one each both all any some such'.split(' '));
  function vocabFrom(graph) {
    const v = new Set();
    graph.nodes.forEach(n => [n.name].concat(n.aliases || []).forEach(t => { if (t && t.length >= 3) v.add(norm(t)); }));
    return Array.from(v).sort((a, b) => b.length - a.length);
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function hasTerm(text, term) { return new RegExp('(^|[^a-z0-9])' + esc(norm(term)) + '($|[^a-z0-9])').test(norm(text)); }
  function extract(text, vocab) {
    const out = [], seen = new Set();
    const add = e => { const k = norm(e); if (k && !seen.has(k)) { seen.add(k); out.push(k); } };
    let rest = String(text);
    vocab.forEach(t => { const re = new RegExp('(^|[^A-Za-z0-9])' + esc(t) + '(?![A-Za-z0-9])', 'i'); if (re.test(rest)) { add(t); rest = rest.replace(re, ' '); } });
    (rest.match(/[A-Z][A-Za-z0-9]*|\b\d{3,}\b/g) || []).forEach(w => { if (!STOP.has(norm(w))) add(w); });
    return out;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { re: defaults.re.join(', '), ce: defaults.ce.join(', ') };
    const shell = K.shell(el, 'Toy example (break it)',
      'Type the entities of the reference answer and of the retrieved context, separated by commas. Matching is exact on lower-cased strings. No model runs.');
    const mk = (label, key) => { const i = K.el('input', { type: 'text', 'aria-label': label, style: 'width:100%;box-sizing:border-box' }); i.value = st[key]; i.addEventListener('input', () => { st[key] = i.value; render(); }); return K.el('label', { style: 'display:block' }, label, i); };
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), tags = K.el('div'), note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = (re, ce) => { st.re = re; st.ce = ce; shell.querySelectorAll('input').forEach((i, n) => { i.value = n ? st.ce : st.re; }); render(); };
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => set(defaults.re.join(', '), defaults.ce.join(', '))),
      btn('Break it: SGD vs its long name', () => set('stochastic gradient descent, learning rate', 'SGD, learning rate')),
      btn('Break it: names without understanding', () => set('gradient descent, learning rate, momentum', 'gradient descent, learning rate, momentum, a list of keywords only'))),
      mk('reference-answer entities', 're'), mk('retrieved-context entities', 'ce'), tags, res.node, formula, note);
    const parse = s => s.split(',').map(x => x.trim()).filter(Boolean);
    function render() {
      const re = parse(st.re), ce = parse(st.ce), cs = new Set(ce.map(norm));
      const reU = Array.from(new Set(re.map(norm)));
      tags.replaceChildren(...reU.map(e => K.el('span', { style: 'display:inline-block;margin:2px 4px 2px 0;padding:1px 7px;border:2px solid var(--' + (cs.has(e) ? 'he' : 'warn') + ')' }, e + (cs.has(e) ? ' (found)' : ' (missing)'))));
      const h = reU.filter(e => cs.has(e)).length, v = compute({ re, ce });
      res.set(v);
      formula.textContent = reU.length ? `CER = |CE ∩ RE| / |RE| = ${h} / ${reU.length} = ${K.fmt(v)}` : 'CER = 0 / 0 (add reference entities)';
      note.textContent = 'Blind spot: a synonym or abbreviation counts as missing, and a mention is not understanding.';
    }
    render();
  }

  /* ---- Real example from Presentations/_real-examples ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('answers/answers.json'), get('data/corpus.json'), get('graph/graph.json'), get('answers/context_judgments.json')]).then(a => {
      const ctx = {}; a[1].forEach(r => { ctx[r.qid + '_' + r.arm] = r.context_ids; });
      const qs = {}; a[0].forEach(q => { qs[q.id] = q; });
      const pas = {}; a[2].forEach(p => { pas[p.id] = p; });
      const answerable = Array.from(new Set(a[4].map(r => r.qid))).sort();
      return { qs, ctx, pas, vocab: vocabFrom(a[3]), answerable };
    });
    return realData;
  }
  const meanOf = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  function scoreReal(D, qid, arm) {
    const gold = D.qs[qid].gold_answer;
    const re = extract(gold, D.vocab);
    const text = (D.ctx[qid + '_' + arm] || []).map(id => D.pas[id].text).join(' \n ');
    const ce = re.filter(e => hasTerm(text, e));
    return { re, ce, v: re.length ? compute({ re, ce }) : NaN };
  }

  function mountReal(el, D) {
    const K = root.DemoKit;
    const st = { arm: 'B', q: D.answerable[0] };
    const shell = K.shell(el, 'Real example: do the retrieved passages mention the entities of the gold answer?',
      'Scale: n = 9 answerable questions (the 3 unanswerable ones have no entities), one run, demo scale, no human labels. Entities are found by OUR rule, not by an LLM as in Ragas: terms of the graph vocabulary (node names and aliases of graph.json), capitalised words or acronyms, and numbers of 3+ digits. A reference entity counts as found when its string occurs in the retrieved passages (case-insensitive, whole word). Arm A (no retrieval) has no context: n/a. Arm C gets about 40% more context than B.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]);
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.answerable.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question)));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const info = K.el('div', { 'aria-live': 'polite' }), tags = K.el('div', { role: 'group', 'aria-label': 'gold-answer entities' });
    const res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), means = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, tags, res.node, formula, note, means);
    function render() {
      const q = D.qs[st.q], ids = D.ctx[st.q + '_' + st.arm] || [];
      info.replaceChildren(K.el('p', { class: 'hint' }, 'Gold answer: ' + q.gold_answer));
      tags.replaceChildren();
      if (st.arm === 'A') {
        tags.append(K.el('p', { class: 'hint bad' }, 'Arm A retrieves nothing: no context, so context entity recall is undefined (n/a), not zero.'));
        res.set(NaN); formula.textContent = 'CER = n/a (no context)'; note.textContent = '';
      } else {
        info.append(K.el('p', { class: 'hint' }, 'Retrieved passages (' + ids.length + '): ' + ids.join(', ') + (q.gold_passages.length ? '. Gold passage(s): ' + q.gold_passages.join(', ') : '')));
        const s = scoreReal(D, st.q, st.arm), cs = new Set(s.ce);
        s.re.forEach(e => {
          const ok = cs.has(e), where = ok ? ids.filter(id => hasTerm(D.pas[id].text, e)) : [];
          tags.append(K.el('span', { style: 'display:inline-block;margin:2px 4px 2px 0;padding:1px 7px;border:2px solid var(--' + (ok ? 'he' : 'warn') + ')' }, e + (ok ? ' (in ' + where.join(', ') + ')' : ' (not in context)')));
        });
        if (!s.re.length) { tags.append(K.el('p', { class: 'hint bad' }, 'The gold answer has no entity under our rule (no vocabulary term, capitalised word or number), so the score is undefined (n/a), not zero.')); res.set(NaN); formula.textContent = 'CER = n/a (|RE| = 0)'; note.textContent = ''; return rowMeans(); }
        res.set(s.v);
        formula.textContent = `CER = |CE ∩ RE| / |RE| = ${s.ce.length} / ${s.re.length} = ${K.fmt(s.v)}`;
        note.textContent = s.v < 1 ? 'Missing entities are named in the gold answer but never appear in the retrieved text. Check also whether they are a wording difference (synonym) rather than missing facts.' : 'Every reference entity appears in the context. This does not show the context explains anything.';
      }
      rowMeans();
    }
    function rowMeans() {
      const row = a => {
        if (a === 'A') return 'A: n/a (no context)';
        const xs = D.answerable.map(id => scoreReal(D, id, a).v).filter(Number.isFinite);
        return `${a}: ${K.fmt(meanOf(xs), 4)} (n=${xs.length})`;
      };
      means.textContent = 'Arm means (answerable questions with at least one entity, our entity rule): ' + ['A', 'B', 'C'].map(row).join('  |  ');
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real data...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount, extract, vocabFrom, hasTerm };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['context_entity_recall'] = api;
})(this);
