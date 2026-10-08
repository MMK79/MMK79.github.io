/* KG groundedness rate demo. Real example (default): do the claims of the answers (arms B, C) match at least one triple of the real KG? OUR crude rule, compared with the two LLM judges' 'supported'. Toy example: the catalogue's triple-vs-passage form (2/3). */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = {
    title: 'Alias Billy the Kid',
    text: 'Thomas Carr directed Alias Billy the Kid, released in 1946.',
    triples: [
      { s: 'Alias Billy the Kid', p: 'director', o: 'Thomas Carr' },
      { s: 'Alias Billy the Kid', p: 'publication date', o: '1946' },
      { s: 'Alias Billy the Kid', p: 'country', o: 'United States' },
    ],
  };
  /* The pack's normalisation: lower-case, NFKD, strip punctuation, '&' -> and, hyphen -> space, drop leading the/a/an, trailing 's' off words of 4+ letters (not ss/is/us). */
  function norm(s) {
    let w = String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/-/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);
    while (w.length && ['the', 'a', 'an'].includes(w[0])) w = w.slice(1);
    return w.map(x => (x.length >= 4 && x.endsWith('s') && !/(ss|is|us)$/.test(x)) ? x.slice(0, -1) : x).join(' ');
  }
  const has = (textNorm, key) => key !== '' && (' ' + textNorm + ' ').includes(' ' + key + ' ');

  /* PURE (toy form from the catalogue): Grounded = |{t : object in text/title AND subject = title or in text}| / |T| */
  function tripleGrounded(inp, t) {
    const tn = norm(inp.text), ti = norm(inp.title);
    const objOk = has(tn, norm(t.o)) || has(ti, norm(t.o)) || norm(t.o) === ti;
    const subOk = norm(t.s) === ti || has(tn, norm(t.s));
    return objOk && subOk;
  }
  function compute(inp) {
    if (!inp.triples.length) return 0;
    return inp.triples.filter(t => tripleGrounded(inp, t)).length / inp.triples.length;
  }

  /* ---------- OUR claim-vs-KG rule (pure, no DOM) ----------
     A claim is KG-grounded if at least one edge (directed triple) of the graph has BOTH end nodes in the claim text:
     a node counts as present when its name (or, optionally, an alias) as a whole-word normalised phrase of >= 3 characters occurs in the claim.
     Crude: it checks that the claim talks about two linked entities, NOT that the claim says what the edge says. */
  function compileGraph(g, useAlias) {
    const keys = {};
    g.nodes.forEach(n => { keys[n.id] = Array.from(new Set((useAlias === false ? [n.name] : [n.name].concat(n.aliases || [])).map(norm).filter(k => k.length >= 3))); });
    return { g, keys };
  }
  function claimEdges(C, claim) {
    const t = norm(claim), memo = {};
    const pres = id => (id in memo) ? memo[id] : (memo[id] = C.keys[id].some(k => has(t, k)));
    const out = [];
    C.g.edges.forEach((e, i) => { if (e.source !== e.target && pres(e.source) && pres(e.target)) out.push(i); });
    return out;
  }
  const rate = rows => rows.length ? rows.filter(r => r.grounded).length / rows.length : NaN;
  function agreement(rows, judge) {
    const c = { tp: 0, fp: 0, fn: 0, tn: 0 };           // rule-grounded vs judge 'supported'
    rows.forEach(r => { const s = r[judge] === 'supported'; if (r.grounded && s) c.tp++; else if (r.grounded && !s) c.fp++; else if (!r.grounded && s) c.fn++; else c.tn++; });
    c.n = rows.length; c.agree = rows.length ? (c.tp + c.tn) / rows.length : NaN; return c;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = JSON.parse(JSON.stringify(defaults));
    const shell = K.shell(el, 'Toy example (break it)', 'The catalogue form: triples an LLM extracted from ONE passage, checked against that passage by string match (invented example, no model runs). Edit the passage or the triples; each triple turns green or orange.');
    const txt = K.el('textarea', { 'aria-label': 'passage text', rows: 2, style: 'width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit' });
    txt.value = st.text;
    const ti = K.el('input', { type: 'text', 'aria-label': 'title', style: 'width:100%;box-sizing:border-box' }); ti.value = st.title;
    const list = K.el('div'), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    function setAll(o) { st.title = o.title; st.text = o.text; st.triples = JSON.parse(JSON.stringify(o.triples)); txt.value = st.text; ti.value = st.title; draw(); }
    shell.append(K.el('div', { class: 'row' },
      btn('Worked example', () => setAll(defaults)),
      btn('Break it: a true fact the passage only implies', () => setAll({ title: defaults.title, text: defaults.text, triples: defaults.triples.concat([{ s: 'Alias Billy the Kid', p: 'genre', o: 'western' }]) })),
      btn('Break it: right words, wrong relation', () => setAll({ title: defaults.title, text: defaults.text, triples: [{ s: 'Alias Billy the Kid', p: 'director', o: '1946' }, { s: 'Alias Billy the Kid', p: 'cast member', o: 'Thomas Carr' }] }))),
      K.el('label', { style: 'display:block' }, 'passage text', txt), K.el('label', { style: 'display:block' }, 'title', ti), list, res.node, formula, note);
    txt.addEventListener('input', () => { st.text = txt.value; draw(); }); ti.addEventListener('input', () => { st.title = ti.value; draw(); });
    function draw() {
      list.replaceChildren();
      st.triples.forEach((t, i) => {
        const ok = tripleGrounded(st, t);
        const f = (k, w) => { const x = K.el('input', { type: 'text', 'aria-label': k + ' of triple ' + (i + 1), style: 'width:' + w + ';max-width:100%;box-sizing:border-box' }); x.value = t[k]; x.addEventListener('input', () => { t[k] = x.value; update(); }); return x; };
        const badge = K.el('span', { class: ok ? 'good' : 'bad' }, ok ? ' grounded' : ' ungrounded');
        const row = K.el('div', { class: 'row', style: 'border-left:4px solid var(--' + (ok ? 'he' : 'warn') + ');padding-left:8px' }, f('s', '30%'), K.el('span', { class: 'hint' }, '-'), f('p', '22%'), K.el('span', { class: 'hint' }, '->'), f('o', '28%'), badge);
        row.dataset.i = i; list.append(row);
      });
      update();
    }
    function update() {
      const rows = list.querySelectorAll('.row');
      st.triples.forEach((t, i) => { const ok = tripleGrounded(st, t); rows[i].style.borderLeftColor = 'var(--' + (ok ? 'he' : 'warn') + ')'; const b = rows[i].lastChild; b.className = ok ? 'good' : 'bad'; b.textContent = ok ? ' grounded' : ' ungrounded'; });
      const g = st.triples.filter(t => tripleGrounded(st, t)).length, v = compute(st);
      res.set(v, 4);
      formula.textContent = `Grounded = ${g} / ${st.triples.length} = ${K.fmt(v, 4)}`;
      note.textContent = 'Blind spot: it measures string presence, not truth. An implied fact is "ungrounded"; a right-words-wrong-relation triple is "grounded".';
    }
    draw();
  }

  /* ---------- real ---------- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('graph/graph.json'), get('answers/claims.json'), get('answers/verdicts.json'), get('data/questions.json')]).then(a => buildReal(a[0], a[1], a[2], a[3]));
    return realData;
  }
  function buildReal(g, claims, verdicts, questions) {
    const V = {}; verdicts.forEach(v => { V[v.judge + '|' + v.qid + '|' + v.arm] = v.verdicts; });
    const qs = {}; questions.forEach(q => { qs[q.id] = q; });
    const nm = {}; g.nodes.forEach(n => { nm[n.id] = n.name; });
    const base = [];
    claims.forEach(c => { if (c.arm === 'A') return; c.claims.forEach((t, i) => base.push({ qid: c.qid, arm: c.arm, i, claim: t, jA: V['A|' + c.qid + '|' + c.arm][i].verdict, jB: V['B|' + c.qid + '|' + c.arm][i].verdict })); });
    const qids = Array.from(new Set(base.map(r => r.qid))).sort();
    return { g, qs, nm, base, qids, cache: {} };
  }
  function rowsFor(D, useAlias) {
    const k = useAlias ? 1 : 0;
    if (!D.cache[k]) { const C = compileGraph(D.g, useAlias); D.cache[k] = D.base.map(r => { const e = claimEdges(C, r.claim); return Object.assign({}, r, { edges: e, grounded: e.length > 0 }); }); }
    return D.cache[k];
  }

  function mountReal(el, D) {
    const K = root.DemoKit, st = { arm: 'C', q: 'q16', alias: true };
    const shell = K.shell(el, 'Real example: are the answer claims backed by a triple of the knowledge graph?',
      'Scale: 12 questions, of which 9 have claims (on the 3 unanswerable ones arms B and C refused, so there is nothing to ground), arms B (hybrid RRF top-5) and C (dense top-5 + graph passages), 71 claims, a graph of 662 nodes and 762 edges extracted by an LLM (qwen3.8-flash). OUR rule is crude: a claim is "KG-grounded" if some edge has BOTH end nodes (name or alias) in the claim text. It checks that the claim talks about two linked entities, not that it says what the edge says. We compare it with the two LLM judges (A deepseek-v4.1-flash, B glm-5.1) that labelled each claim "supported" against the retrieved passages. n=12 is demo scale; the graph is noisy and its aliases do not merge ("SVM" and "support vector machine" are two nodes), which hides matches. A demo, not a benchmark.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, [opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph')]); aSel.value = st.arm;
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.qids.map(id => opt(id, id + ' (' + D.qs[id].type + '): ' + D.qs[id].question.slice(0, 70)))); qSel.value = st.q;
    const alias = K.el('input', { type: 'checkbox', checked: 'checked', 'aria-label': 'match aliases' });
    const info = K.el('p', { class: 'hint' }), res = K.resultBox(), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const list = K.el('div', { role: 'group', 'aria-label': 'claims' }), sum = K.el('div', { class: 'formula', style: 'overflow-x:auto' }), note = K.el('p', { class: 'hint' });
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel), K.el('label', {}, alias, ' match node aliases')),
      K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), info, res.node, formula, list, K.el('h3', { style: 'font-size:16px' }, 'Rule vs the LLM judges, the 9 questions with claims'), sum, note);
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); }); qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    alias.addEventListener('change', () => { st.alias = alias.checked; render(); });
    const badge = (t, cls) => K.el('span', { class: cls, style: 'display:inline-block;margin:0 6px 0 0' }, t);
    const jc = v => v === 'supported' ? 'good' : 'bad';
    function render() {
      const all = rowsFor(D, st.alias), mine = all.filter(r => r.qid === st.q && r.arm === st.arm), arm = all.filter(r => r.arm === st.arm);
      info.textContent = D.qs[st.q].question + '  | gold answer: ' + D.qs[st.q].gold_answer;
      const v = rate(mine);
      res.set(v, 3);
      formula.textContent = `Grounded(${st.q}, ${st.arm}) = claims with >= 1 matching triple / claims = ${mine.filter(r => r.grounded).length} / ${mine.length} = ${K.fmt(v)}     arm ${st.arm} over the 9 questions with claims: ${arm.filter(r => r.grounded).length} / ${arm.length} = ${K.fmt(rate(arm))}`;
      list.replaceChildren();
      mine.forEach(r => {
        const sv = r.jA === 'supported', dis = (r.grounded !== sv);
        const ev = r.edges.slice(0, 2).map(i => { const e = D.g.edges[i]; return D.nm[e.source] + ' -' + e.relation + '-> ' + D.nm[e.target] + ' [' + e.passages.join(', ') + ']'; });
        list.append(K.el('div', { style: 'margin:6px 0;padding:4px 8px;border-left:4px solid var(--' + (r.grounded ? 'he' : 'warn') + ')' },
          K.el('div', {}, r.claim),
          K.el('div', { class: 'hint', style: 'margin:2px 0' }, badge(r.grounded ? 'rule: grounded (' + r.edges.length + ' edge' + (r.edges.length > 1 ? 's' : '') + ')' : 'rule: no triple', r.grounded ? 'good' : 'bad'), badge('judge A: ' + r.jA, jc(r.jA)), badge('judge B: ' + r.jB, jc(r.jB)), dis ? badge('disagree with judge A', 'bad') : badge('agree with judge A', 'good')),
          ev.length ? K.el('div', { class: 'hint', style: 'margin:0' }, 'e.g. ' + ev.join('  ;  ')) : ''));
      });
      const row = (name, rows) => { const a = agreement(rows, 'jA'), b = agreement(rows, 'jB'); return name.padEnd(5) + String(rows.length).padStart(4) + '  ' + K.fmt(rate(rows), 3).padStart(6) + '   ' + K.fmt(rows.filter(r => r.jA === 'supported').length / rows.length, 3).padStart(6) + '  ' + K.fmt(rows.filter(r => r.jB === 'supported').length / rows.length, 3).padStart(6) + '   ' + K.fmt(a.agree, 2).padStart(5) + ' (' + a.fn + ' judge-yes/rule-no, ' + a.fp + ' rule-yes/judge-no)  ' + K.fmt(b.agree, 2) + ' vs B'; };
      sum.textContent = 'arm  claims  rule  judgeA  judgeB   agreement with judge A\n' + ['B', 'C'].map(a => row(a, all.filter(r => r.arm === a))).join('\n') + '\n' + row('both', all);
      const A = agreement(all, 'jA');
      note.textContent = `Reading: the rule's groundedness (${K.fmt(rate(all), 2)}) is far below the judges' supported share, because ${A.fn} claims that the judge finds supported by the passages have no KG triple: the graph covers only part of what passages say, claims name things the graph never merged, and many claims are about wording, not entities. Agreement is ${K.fmt(A.agree, 2)}, mostly by coincidence of base rates (the judges call ${K.fmt(all.filter(r => r.jA === 'supported').length / all.length, 2)} of claims supported). The rule measures how much of an answer the KG could vouch for, not whether the answer is true.`;
    }
    render();
  }

  function mount(el) {
    const K = root.DemoKit, bar = K.el('div', { class: 'row', role: 'group', 'aria-label': 'mode' }), body = K.el('div');
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

  const api = { defaults, compute, mount, norm, compileGraph, claimEdges, buildReal, rowsFor, rate, agreement };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['kg_groundedness_rate'] = api;
})(this);
