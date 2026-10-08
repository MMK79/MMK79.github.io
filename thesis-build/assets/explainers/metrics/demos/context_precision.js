/* Context precision (RAGAS) demo: flip the judge's verdicts, reorder chunks, see CP@K move.
   The LLM judge is simulated: the verdicts are an editable precomputed table. */
(function (root) {
  const SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const defaults = { verdicts: [1, 0, 1, 1] };

  /* PURE: CP@K = sum_k P@k * v_k / sum_k v_k  (0 when no chunk is judged relevant) */
  function compute(inp) {
    const v = inp.verdicts; let hits = 0, num = 0;
    v.forEach((x, i) => { hits += x; if (x) num += hits / (i + 1); });
    return hits ? num / hits : 0;
  }

  function mountToy(el) {
    const K = root.DemoKit;
    const st = { v: defaults.verdicts.slice() };
    const shell = K.shell(el, 'Context precision (RAGAS)',
      'Click a chunk to flip the judge verdict (relevant / not). Use the arrows to reorder, or add and remove chunks. Watch rank change the score.');
    const strip = K.el('div', { class: 'row', role: 'group', 'aria-label': 'retrieved chunks' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite' });
    const note = K.el('p', { class: 'hint' });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const presets = K.el('div', { class: 'row' },
      btn('Worked example', () => { st.v = defaults.verdicts.slice(); render(); }),
      btn('Break it: irrelevant chunk first', () => { st.v = [0, 1, 1, 1]; render(); }),
      btn('Perfect ranking', () => { st.v = [1, 1, 1, 0]; render(); }),
      btn('Judge flips one verdict', () => { st.v[2] = 1 - st.v[2]; render(); }),
      btn('+ chunk', () => { if (st.v.length < 8) { st.v.push(0); render(); } }),
      btn('- chunk', () => { if (st.v.length > 1) { st.v.pop(); render(); } }));
    shell.append(presets, strip, res.node, formula, note);

    function move(i, d) { const j = i + d; if (j < 0 || j >= st.v.length) return; [st.v[i], st.v[j]] = [st.v[j], st.v[i]]; render(); }
    function render() {
      strip.replaceChildren();
      let hits = 0; const terms = [];
      st.v.forEach((x, i) => {
        hits += x; if (x) terms.push({ k: i + 1, h: hits });
        const b = K.el('button', {
          type: 'button', 'aria-pressed': x ? 'true' : 'false',
          title: x ? 'judged relevant' : 'judged not relevant',
          style: 'min-width:84px;' + (x ? 'border-color:var(--he);color:var(--he)' : 'border-color:var(--warn);color:var(--warn)'),
          onclick: () => { st.v[i] = 1 - st.v[i]; render(); },
        }, `${i + 1}. chunk ${i + 1} v=${x}`);
        strip.append(K.el('span', {}, b,
          K.el('button', { type: 'button', 'aria-label': 'move chunk ' + (i + 1) + ' earlier', onclick: () => move(i, -1) }, '←'),
          K.el('button', { type: 'button', 'aria-label': 'move chunk ' + (i + 1) + ' later', onclick: () => move(i, 1) }, '→')));
      });
      const score = compute({ verdicts: st.v });
      res.set(score, 4);
      const n = st.v.length;
      formula.textContent = terms.length
        ? `CP@${n} = (${terms.map(t => `P@${t.k}=${t.h}/${t.k}`).join(' + ')}) / ${terms.length} = ${K.fmt(score, 4)}`
        : `CP@${n} = 0 / 0 → 0 (no chunk judged relevant; this demo returns 0)`;
      note.textContent = 'Only relevant chunks add a term, and each term is the precision at its own rank. Relevant chunks that were never retrieved do not appear at all. One flipped verdict from the judge changes the score.';
    }
    render();
  }

  /* ---- Real example (pack: Presentations/_real-examples; judge A verdicts, 3-arm answer study) ---- */
  let realData = null;
  function loadReal() {
    if (realData) return realData;
    const base = new URL('../../_real-examples/', SCRIPT_SRC || location.href).href;
    const get = p => fetch(base + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
    realData = Promise.all([get('data/questions.json'), get('data/corpus.json'), get('metrics/context_precision.json'), get('answers/context_judgments.json')]).then(a => {
      const corpus = a[1].passages || a[1], text = {};
      (Array.isArray(corpus) ? corpus : Object.values(corpus)).forEach(p => { text[p.id] = p.text || ''; });
      const qs = {}; a[0].forEach(q => { qs[q.id] = q; });
      const j = {}; a[3].forEach(r => { j[r.qid + '_' + r.arm] = r; });
      const m = a[2], ids = Object.keys(m.per_question_plain.B);
      return { qs, text, m, j, ids };
    });
    return realData;
  }
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;

  function mountReal(el, D) {
    const K = root.DemoKit, m = D.m;
    const st = { arm: 'B', q: D.ids[0] };
    const shell = K.shell(el, 'Real example: context precision on retrieved chunks',
      'Demo scale: ' + D.ids.length + ' answerable questions, one run, ' + m.answer_model + ' answers, judge A = ' + m.judge_A + ' (an LLM, no human labels). Intervals are wide. Not a benchmark and not an evaluation of the thesis system. Arm A has no retrieval, so it has no context to judge.');
    const opt = (v, t) => K.el('option', { value: v }, t);
    const aSel = K.el('select', { 'aria-label': 'arm' }, opt('A', 'A: no retrieval'), opt('B', 'B: hybrid RRF top-5'), opt('C', 'C: dense top-5 + graph passages'));
    const qSel = K.el('select', { 'aria-label': 'question', style: 'width:100%;max-width:100%;box-sizing:border-box' }, D.ids.map(i => opt(i, i + ' (' + D.qs[i].type + '): ' + D.qs[i].question)));
    aSel.value = st.arm;
    aSel.addEventListener('change', () => { st.arm = aSel.value; render(); });
    qSel.addEventListener('change', () => { st.q = qSel.value; render(); });
    const list = K.el('div', { 'aria-live': 'polite' });
    const res = K.resultBox();
    const formula = K.el('div', { class: 'formula', 'aria-live': 'polite', style: 'overflow-wrap:anywhere' });
    const note = K.el('p', { class: 'hint' });
    const tbl = K.el('div');
    shell.append(K.el('div', { class: 'row' }, K.el('label', {}, 'arm ', aSel)), K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'question ', qSel)), list, res.node, formula, note, tbl);

    function stats(arm) {
      const cp = [], pl = [], gd = [];
      D.ids.forEach(q => {
        const r = D.j[q + '_' + arm]; if (!r) return;
        const v = r.context_ids.map(id => r.relevant[id]);
        cp.push(compute({ verdicts: v })); pl.push(mean(v));
        const g = new Set(D.qs[q].gold_passages); gd.push(r.context_ids.filter(id => g.has(id)).length / r.context_ids.length);
      });
      return { cp, pl, gd };
    }
    function render() {
      const q = D.qs[st.q];
      list.replaceChildren(K.el('p', { class: 'hint' }, 'Gold passage(s): ' + q.gold_passages.join(', ') + '. Gold answer: ' + q.gold_answer));
      if (st.arm === 'A') {
        list.append(K.el('p', { class: 'bad' }, 'Arm A answers from the model alone: no chunks were retrieved, so there is nothing to judge and context precision is undefined (not 0).'));
        res.set(NaN); formula.textContent = 'CP@K = n/a (K = 0 chunks)';
        note.textContent = 'Arm A is left out of the means below for the same reason.';
      } else {
        const r = D.j[st.q + '_' + st.arm], v = r.context_ids.map(id => r.relevant[id]), gold = new Set(q.gold_passages);
        r.context_ids.forEach((id, i) => {
          const gd = gold.has(id);
          list.append(K.el('div', { style: 'margin:2px 0;padding:2px 6px;border-left:4px solid var(' + (v[i] ? '--he' : '--warn') + ')' },
            K.el('b', {}, (i + 1) + '. ' + id + '  judge: ' + (v[i] ? 'relevant' : 'not relevant') + (gd ? '  (in gold)' : '') + ' '),
            K.el('span', { class: 'hint' }, (D.text[id] || '').slice(0, 110) + (D.text[id] && D.text[id].length > 110 ? '...' : ''))));
        });
        const score = compute({ verdicts: v }); res.set(score, 4);
        let hits = 0; const terms = [];
        v.forEach((x, i) => { hits += x; if (x) terms.push(`P@${i + 1}=${hits}/${i + 1}`); });
        const n = v.length, plain = hits / n;
        formula.textContent = terms.length ? `CP@${n} = (${terms.join(' + ')}) / ${terms.length} = ${K.fmt(score, 4)}   |   plain precision = ${hits}/${n} = ${K.fmt(plain, 4)}` : `CP@${n} = 0 / 0 -> 0 (no chunk judged relevant); plain precision = 0/${n}`;
        const st1 = (m['per_question_ranked'][st.arm] || {})[st.q], st2 = (m['per_question_plain'][st.arm] || {})[st.q];
        const ok = Math.abs(score - st1) < 5e-4 && Math.abs(plain - st2) < 5e-4;
        note.textContent = `Recomputed here vs the pack's stored values (rank-weighted ${st1}, plain ${st2}): ${ok ? 'MATCH' : 'MISMATCH'}. Rank-weighted CP rewards relevant chunks that come first; plain precision ignores order. Gold labels cover only the necessary passages, so the gold-based precision is a lower bound.`;
      }
      const rows = ['B', 'C'].map(a => ({ a, s: stats(a), sm: m.summary[a] }));
      const t = K.el('table', { style: 'width:100%;border-collapse:collapse;font-size:.9em' },
        K.el('tr', {}, K.el('th', { align: 'left' }, 'arm (n=' + D.ids.length + ')'), K.el('th', { align: 'right' }, 'mean CP'), K.el('th', { align: 'right' }, 'mean plain'), K.el('th', { align: 'right' }, 'plain vs gold (95% CI)')),
        K.el('tr', {}, K.el('td', {}, 'A: no retrieval'), K.el('td', { colspan: '3', align: 'right' }, 'n/a (no context)')),
        rows.map(r => K.el('tr', { style: r.a === st.arm ? 'font-weight:bold' : '' }, K.el('td', {}, r.a), K.el('td', { align: 'right', class: 'num' }, K.fmt(mean(r.s.cp), 4)),
          K.el('td', { align: 'right', class: 'num' }, K.fmt(mean(r.s.pl), 4) + (Math.abs(mean(r.s.pl) - r.sm.judge.mean) < 5e-4 ? '' : ' !')),
          K.el('td', { align: 'right', class: 'num' }, K.fmt(mean(r.s.gd), 4) + ' [' + r.sm.gold.ci95.join(', ') + ']'))));
      tbl.replaceChildren(K.el('details', { open: '' }, K.el('summary', {}, 'Arm means over all answerable questions (recomputed live)'), t,
        K.el('p', { class: 'hint' }, 'Bootstrap 95% CI of mean plain precision (judge): B ' + m.summary.B.judge.ci95.join('-') + ', C ' + m.summary.C.judge.ci95.join('-') + '. With n=9 per arm and one run, B vs C is suggestive at most. Arm C passes more chunks (graph passages), which dilutes precision by construction.')));
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
      body.replaceChildren(K.el('p', { class: 'hint' }, 'Loading real answer study...'));
      loadReal().then(D => { body.replaceChildren(); mountReal(body, D); })
        .catch(e => { realData = null; body.replaceChildren(K.el('p', { class: 'hint bad' }, 'Real data not available (' + e.message + '). Showing the toy example.')); mountToy(body); });
    }
    bR.addEventListener('click', real); bT.addEventListener('click', toy);
    real();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['context_precision'] = api;
})(this);
