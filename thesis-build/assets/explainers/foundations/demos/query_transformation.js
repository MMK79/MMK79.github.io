/* query_transformation: HyDE, step-back, multi-query and decomposition on the STORED real outputs of the pack
   (data/query_transforms.json = real LLM texts, temperature 0, qwen3.7-plus; runs/hyde_*, stepback_*, multiquery_rrf, decomp_rrf =
   their retrieval runs). Original question -> transformed text(s) -> retrieved passage ids -> gold hit, plus the pack's own caveat
   that on 4-6 questions they mostly tie or lose. No LLM call here. Serves j3-query-understanding-map, j3-query-rewriting
   (multi-query variants used as a proxy), j3-query-expansion-llm (HyDE as the expansion example), j3-hyde, j3-step-back,
   j3-multi-query-rrf, j3-query-decomposition, j3-text-to-cypher and j3-text-to-sql (real stored run: data/text_to_query.real.json, 12 questions, SQL + Cypher, executed).
   compute() is pure (no DOM): pass the pack in. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
  const T2Q_URL = SRC ? new URL('data/text_to_query.real.json', SRC).href : '';
  const PACK = SRC ? new URL('../../_real-examples/', SRC).href : '';

  const TECH = {
    hyde:          { label: 'HyDE',          runs: [['hyde_dense', 'HyDE text alone (stored run hyde_dense)'], ['hyde_plus_query', 'question + HyDE text (stored run hyde_plus_query)']] },
    stepback:      { label: 'Step-back',     runs: [['stepback_dense', 'step-back question alone (stored run stepback_dense)'], ['stepback_rrf', 'step-back fused with original by RRF (stored run stepback_rrf)']] },
    multiquery:    { label: 'Multi-query',   runs: [['multiquery_rrf', '3 variants + original fused by RRF (stored run multiquery_rrf)']] },
    decomposition: { label: 'Decomposition', runs: [['decomp_rrf', 'sub-questions + original fused by RRF (stored run decomp_rrf)']] },
  };
  const TECH_IDS = Object.keys(TECH);
  const RUN_FILES = ['dense_cosine', 'rrf_bm25_dense', 'hyde_dense', 'hyde_plus_query', 'stepback_dense', 'stepback_rrf', 'multiquery_rrf', 'decomp_rrf'];

  const defaults = { technique: 'hyde', k: 5 };

  /* ---------- pure pieces ---------- */
  const ids = L => (L || []).map(r => r.id);
  function firstGoldRank(list, gold) { const i = list.findIndex(x => gold.includes(x)); return i < 0 ? null : i + 1; }
  const recall = (list, gold, k) => gold.filter(g => list.slice(0, k).includes(g)).length / gold.length;
  function rrfFuse(lists, k) {
    const s = new Map();
    for (const L of lists) L.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (k + i + 1)));
    return [...s.entries()].map(([id, score], pos) => ({ id, score, pos })).sort((a, b) => b.score - a.score || a.pos - b.pos).map(({ id, score }) => ({ id, score }));
  }
  /* 'better' / 'same' / 'worse' by first-gold rank in the stored top-20 (absent = rank 21) */
  function change(a, b) { const x = a == null ? 21 : a, y = b == null ? 21 : b; return y < x ? 'better' : y > x ? 'worse' : 'same'; }

  function itemRows(pack, tech) {
    return pack.items.filter(i => i.technique === tech).map(it => {
      const gold = it.gold, base = ids(pack.runs.dense_cosine[it.qid]), k = pack.k || 5;
      const variants = TECH[tech].runs.map(([run, label]) => {
        const list = ids(pack.runs[run][it.qid]);
        return { run, label, list, rank: firstGoldRank(list, gold), change: change(firstGoldRank(base, gold), firstGoldRank(list, gold)), recall: recall(list, gold, k) };
      });
      return { qid: it.qid, gold, item: it, base: { list: base, rank: firstGoldRank(base, gold), recall: recall(base, gold, k) }, variants };
    });
  }

  /* text-to-SQL / text-to-Cypher: re-score the stored real run. A list answer (gold has more than one row) is compared as a set of rows,
     a single-value answer exactly; text lower-cased and trimmed; a query that did not execute is an error. */
  const cell = c => typeof c === 'number' ? String(Math.trunc(c)) : String(c).trim().toLowerCase();
  const normRows = (rows, asSet) => { const r = rows.map(x => x.map(cell).join('\u0001')).sort(); return asSet ? [...new Set(r)] : r; };
  function verdict(run, gold) {
    if (!run.executed) return 'syntax_or_runtime_error';
    const set = gold.rows.length > 1;
    return normRows(run.rows, set).join('\u0002') === normRows(gold.rows, set).join('\u0002') ? 'correct' : 'wrong_result';
  }
  function scoreT2Q(data) {
    const out = { n: data.items.length, sql: { correct: 0, wrong: 0, error: 0 }, cypher: { correct: 0, wrong: 0, error: 0 }, items: [] };
    for (const it of data.items) {
      const v = {};
      for (const l of ['sql', 'cypher']) { v[l] = verdict(it.runs[l], it.gold); out[l][v[l] === 'correct' ? 'correct' : v[l] === 'wrong_result' ? 'wrong' : 'error']++; }
      out.items.push({ id: it.id, kind: it.kind, sql: v.sql, cypher: v.cypher });
    }
    return out;
  }

  function compute(inp) {
    const pack = { ...inp.pack, k: inp.k || defaults.k }, out = {};
    for (const t of TECH_IDS) {
      const rows = itemRows(pack, t), n = rows.length, mean = f => rows.reduce((s, r) => s + f(r), 0) / n;
      const rrfBase = pack.runs.rrf_bm25_dense;
      out[t] = {
        n, qids: rows.map(r => r.qid), rows,
        baseline: { dense_R5: mean(r => r.base.recall), rrf_R5: mean(r => recall(ids(rrfBase[r.qid]), r.gold, pack.k)) },
        variants: TECH[t].runs.map(([run], vi) => ({
          run, R5: mean(r => r.variants[vi].recall),
          better: rows.filter(r => r.variants[vi].change === 'better').length,
          same: rows.filter(r => r.variants[vi].change === 'same').length,
          worse: rows.filter(r => r.variants[vi].change === 'worse').length,
          leftTop5: rows.filter(r => r.base.recall > 0 && r.variants[vi].recall === 0).length,
        })),
      };
    }
    if (inp.t2q) out.t2q = scoreT2Q(inp.t2q);
    return out;
  }
  /* RRF over the stored top-5 lists the user ticks (list 0 = the original). Differs from the stored fused list when that one
     fused the full rankings; the demo shows both. */
  function refuse(lists, k) { return rrfFuse(lists.map(ids), k).slice(0, 5); }

  /* ---------- pack loading ---------- */
  async function loadPack() {
    const J = async p => (await fetch(PACK + p)).json();
    const t2q = await (await fetch(T2Q_URL)).json();
    const [qt, qs, mm, stats, ...rf] = await Promise.all([J('data/query_transforms.json'), J('data/questions.json'), J('runs/metrics_by_method.json'), J('graph/stats.json'), ...RUN_FILES.map(m => J('runs/' + m + '.json'))]);
    const runs = {}; RUN_FILES.forEach((m, i) => { runs[m] = Object.fromEntries(rf[i].questions.map(q => [q.qid, q.ranking])); });
    return { t2q, items: qt.items, note: qt.note, models: qt.models, questions: qs, metrics: mm, stats, runs };
  }

  /* ---------- UI ---------- */
  function mount(el) {
    const K = root.DemoKit, E = K.el, f3 = x => K.fmt(x, 3);
    const shell = K.shell(el, 'Query transformation on real stored outputs',
      'Real example (default): the question, the text the LLM wrote (real, temperature 0), the passages dense search returned for it, and whether the gold passage is there. No live call.');
    shell.classList.add('qtr');
    shell.append(E('style', {}, '.qtr .box{border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:10px 0;background:var(--panel2)}.qtr .pid{font-family:var(--mono);font-size:12px;padding:1px 4px;border-radius:3px;border:1px solid var(--line);margin-right:3px;display:inline-block}.qtr .pid.gold{border-color:var(--he);color:var(--he)}.qtr td,.qtr th{font-size:12px;padding:3px 4px}.qtr h4{margin:14px 0 4px;font-weight:400;font-family:var(--display)}.qtr .gen{white-space:pre-wrap;border-left:3px solid var(--ai);padding-left:8px;margin:6px 0;color:var(--text)}.qtr .tabs button{margin:2px}.qtr .lists{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.qtr .tag{font-size:12px;color:var(--ai)}@media(max-width:600px){.qtr td,.qtr th{font-size:11px;padding:3px 2px}}'));
    shell.append(E('div', { class: 'formula' }, 'Pack caveat (README, slice 2): the query-transformation runs do NOT beat the baselines here. On 4 to 6 questions they mostly tie or lose; the small gains are one question each. The questions were chosen before any result, but 4 to 6 questions cannot rank the techniques. HyDE texts are LLM output and are not checked for truth. The LLM was told to answer from its own knowledge. Demo scale, not an evaluation of the thesis system. Rank = first gold passage in the stored dense top-20.'));
    const body = E('div', {}, 'loading the pack ...'); shell.append(body);
    /* range input: label updates while dragging, the page re-renders on release/keypress (a re-render mid-drag would drop the thumb) */
    const slide = (label, min, max, step, value, on) => { const out = E('span', { class: 'num' }, String(value)), inp = E('input', { type: 'range', min, max, step, value }); inp.addEventListener('input', () => { out.textContent = inp.value; }); inp.addEventListener('change', () => on(Number(inp.value))); return E('label', {}, label + ' ', inp, ' ', out); };
    let pack, tq = null, tech = defaults.technique, qid = null, fk = 60, inc = null;
    const pids = (list, gold) => list.length ? list.map(id => E('span', { class: 'pid' + (gold.includes(id) ? ' gold' : '') }, id)) : [E('span', { class: 'bad' }, '(empty)')];
    const rk = r => r == null ? 'outside top-20' : String(r);
    const chg = c => E('b', { class: c === 'better' ? 'good' : c === 'worse' ? 'bad' : '' }, c);

    function render() {
      const res = compute({ pack }), T = res[tech], out = [];
      if (!qid || !T.qids.includes(qid)) qid = T.qids[0];
      const row = T.rows.find(r => r.qid === qid), it = row.item, gold = row.gold;

      out.push(E('div', { class: 'tabs row' }, ...TECH_IDS.map(t => E('button', { 'aria-pressed': String(t === tech), onclick: () => { tech = t; qid = null; inc = null; render(); } }, TECH[t].label + ' (' + res[t].n + ')'))));
      out.push(E('div', { class: 'tabs row' }, E('label', {}, 'question '), ...T.qids.map(q => E('button', { 'aria-pressed': String(q === qid), onclick: () => { qid = q; inc = null; render(); } }, q))));

      /* the question and the generated text(s) */
      const gen = it.generated;
      const q = pack.questions.find(x => x.id === qid);
      const genBox = E('div', { class: 'box' },
        E('div', {}, E('b', {}, 'Original question (' + q.type + '): '), it.question),
        E('div', { class: 'hint' }, 'gold passages: ' + gold.join(', ') + ' | gold answer: ' + q.gold_answer),
        E('div', {}, E('b', {}, tech === 'hyde' ? 'Hypothetical passage written by the LLM (real output, not checked for truth):' : tech === 'stepback' ? 'Step-back question written by the LLM:' : tech === 'multiquery' ? 'Query variants written by the LLM:' : 'Sub-questions written by the LLM:')),
        ...(Array.isArray(gen) ? gen.map((g, i) => E('div', { class: 'gen' }, (tech === 'multiquery' ? 'variant ' : 'sub-question ') + (i + 1) + ': ' + g)) : [E('div', { class: 'gen' }, gen)]),
        ...(tech !== 'hyde' ? [] : [E('div', { class: 'hint' }, 'The text adds facts the question did not contain; look for names and years that the corpus may or may not hold. Embedding this text replaces the question vector (HyDE, Gao et al. 2022; the topic record read the abstract only).')]));
      out.push(genBox);

      /* retrieved lists */
      const lists = [E('div', {}, E('div', { class: 'tag' }, 'original question, dense top-5'), E('div', {}, ...pids(row.base.list.slice(0, 5), gold)), E('div', { class: 'hint' }, 'first gold rank: ' + rk(row.base.rank) + ' | recall@5 ' + f3(row.base.recall)))];
      row.variants.forEach(v => lists.push(E('div', {}, E('div', { class: 'tag' }, v.label + ' top-5'), E('div', {}, ...pids(v.list.slice(0, 5), gold)), E('div', { class: 'hint' }, 'first gold rank: ' + rk(v.rank) + ' (', chg(v.change), ' vs original) | recall@5 ' + f3(v.recall)))));
      out.push(E('h4', {}, 'Retrieved passage ids (gold in green)'), E('div', { class: 'lists' }, ...lists));

      /* hands-on: tick the lists to fuse (multi-query and decomposition) */
      const per = tech === 'multiquery' ? it.retrieval_per_variant : tech === 'decomposition' ? it.retrieval_per_subquestion : null;
      if (per) {
        const all = [{ name: 'original question', list: it.retrieval_original }, ...per.map((l, i) => ({ name: (tech === 'multiquery' ? 'variant ' : 'sub-question ') + (i + 1), list: l }))];
        if (!inc) inc = all.map(() => true);
        const sel = all.filter((_, i) => inc[i]).map(a => a.list), fused = sel.length ? refuse(sel, fk) : [];
        const stored = ids(it.fused_top5 || pack.runs[TECH[tech].runs[0][0]][qid].slice(0, 5));
        const storedL = ids(pack.runs[TECH[tech].runs[0][0]][qid]).slice(0, 5);
        out.push(E('h4', {}, 'Try it: choose which stored top-5 lists go into the RRF'),
          E('div', { class: 'box' },
            E('div', { class: 'row' }, ...all.map((a, i) => { const cb = E('input', { type: 'checkbox' }); cb.checked = inc[i]; cb.addEventListener('change', () => { inc[i] = cb.checked; render(); }); return E('label', {}, cb, ' ' + a.name + ' '); }),
              slide('k', 1, 120, 1, fk, v => { fk = v; render(); })),
            E('div', { class: 'formula' }, 'RRF(d) = sum over ticked lists of 1/(k + rank(d)); each list is a stored top-5, so ranks 1 to 5 only'),
            E('div', {}, E('b', {}, 'recomputed from the ticked top-5 lists: '), ...pids(fused.map(x => x.id), gold), E('span', { class: 'hint' }, ' first gold rank ' + rk(firstGoldRank(fused.map(x => x.id), gold)))),
            E('div', {}, E('b', {}, 'stored fused top-5 (full rankings, k=60): '), ...pids(storedL, gold)),
            E('div', { class: 'hint' }, 'The two agree only if the passages beyond rank 5 do not matter. ' + (fused.map(x => x.id).join() === storedL.join() && sel.length === all.length && fk === 60 ? 'Here they agree.' : 'Here they may differ: the stored run fused each full ranking, we hold only the top-5.')),
            ...(!(tech === 'multiquery' && qid === 'q02') ? [] : [E('div', { class: 'hint' }, 'Worked check from the topic record: with all four lists ticked and k=60, p005 is rank 1 in every list, so its score is 4/61 = ' + K.fmt(4 / 61, 6) + ', and the stored fused score is ' + K.fmt(it.fused_top5[0].score, 6) + '.')])));
      }

      /* summary across the pack */
      out.push(E('h4', {}, 'All ' + pack.items.length + ' stored items: did the transform help? (recall@5 on the same questions)'),
        E('div', {}, E('table', {}, E('thead', {}, E('tr', {}, ...['technique', 'n', 'dense R@5', 'run', 'R@5', 'rank up/same/down', 'gold left top-5'].map(x => E('th', {}, x)))),
          E('tbody', {}, ...TECH_IDS.flatMap(t => res[t].variants.map((v, vi) => E('tr', { class: t === tech ? 'sel' : '' },
            E('td', {}, vi === 0 ? TECH[t].label : ''), E('td', { class: 'num' }, vi === 0 ? String(res[t].n) : ''), E('td', { class: 'num' }, vi === 0 ? f3(res[t].baseline.dense_R5) : ''),
            E('td', { title: TECH[t].runs[vi][1] }, TECH[t].runs[vi][0].replace('_dense', ' alone').replace('_rrf', ' RRF').replace('_plus_query', ' + query')), E('td', { class: 'num' }, f3(v.R5)), E('td', { class: 'num' }, v.better + ' / ' + v.same + ' / ' + v.worse), E('td', { class: 'num' }, String(v.leftTop5)))))))),
        E('p', { class: 'hint' }, 'Recomputed in the page from the stored runs. Better / worse = first gold passage moves up / down in the dense top-20 against the original question. "Same" is the common outcome. One question changes R@5 by 0.125 to 0.25 on 4 to 6 questions, so none of this ranks the techniques.'));

      /* text-to-SQL / text-to-Cypher panel: stored real run */
      const D = pack.t2q, sc = compute({ pack, t2q: D }).t2q, lab = { correct: 'correct', wrong_result: 'wrong result', syntax_or_runtime_error: 'did not run' };
      const vc = v => E('b', { class: v === 'correct' ? 'good' : 'bad' }, lab[v]);
      const show = rows => rows == null ? '(no result)' : rows.length === 0 ? '(empty result)' : rows.length + ' row' + (rows.length === 1 ? '' : 's') + ': ' + rows.slice(0, 8).map(r => r.join(' | ')).join('; ') + (rows.length > 8 ? '; ...' : '');
      if (!tq) tq = D.items[0].id;
      const ti = D.items.find(x => x.id === tq), ts = sc.items.find(x => x.id === tq);
      const acc = l => sc[l].correct + '/' + sc.n + ' = ' + f3(sc[l].correct / sc.n);
      out.push(E('h4', {}, 'Text-to-SQL and text-to-Cypher: real stored run'),
        E('div', { class: 'formula' }, 'Real run (' + D.date + '): ' + D.model + ', temperature 0, ' + D.n_questions + ' questions over the pack graph (' + D.graph.nodes + ' nodes, ' + D.graph.edges + ' typed edges, public Wikipedia text, LLM-extracted). The model saw only the schema and the question. Each query was executed (SQL on SQLite ' + D.sqlite_version + ', Cypher on Kuzu ' + D.kuzu_version + ') and its answer compared with the gold answer, which comes from a reference query written by hand and executed (the reference SQL and Cypher return the same set). Demo scale: n=' + D.n_questions + ', one model, no repeats, so the numbers below are illustrative, NOT a benchmark and not an evaluation of the thesis system. The questions were written by the helper and the first draft wording was fixed once after a first pass (see status notes).'),
        E('div', { class: 'box' },
          E('table', {}, E('thead', {}, E('tr', {}, ...['language', 'execution accuracy', 'wrong result', 'did not run'].map(x => E('th', {}, x)))),
            E('tbody', {}, ...['sql', 'cypher'].map(l => E('tr', {}, E('td', {}, l === 'sql' ? 'SQL' : 'Cypher'), E('td', { class: 'num' }, acc(l)), E('td', { class: 'num' }, String(sc[l].wrong)), E('td', { class: 'num' }, String(sc[l].error)))))),
          E('div', { class: 'hint' }, 'Execution accuracy = the executed answer equals the gold answer (list answers as sets, single values exactly). Recomputed in the page from the stored rows. Failures are listed, not hidden: pick a question below; red = wrong or did not run.')),
        E('div', { class: 'tabs row' }, E('label', {}, 'question '), ...D.items.map((x, i) => { const s2 = sc.items[i], bad2 = s2.sql !== 'correct' || s2.cypher !== 'correct'; return E('button', { 'aria-pressed': String(x.id === tq), title: x.kind + (bad2 ? ' (a failure)' : ''), onclick: () => { tq = x.id; render(); } }, x.id + (bad2 ? ' !' : '')); })),
        E('div', { class: 'box' },
          E('div', {}, E('b', {}, ti.id + ' (' + ti.kind + '): '), ti.question),
          E('div', { class: 'hint' }, 'gold answer (' + ti.gold.n_rows + ' row' + (ti.gold.n_rows === 1 ? '' : 's') + ', from the reference query): ' + show(ti.gold.rows)),
          E('div', { class: 'tag' }, 'reference SQL (hand-written)'), E('div', { class: 'gen' }, ti.gold.sql),
          E('div', { class: 'tag' }, 'reference Cypher (hand-written)'), E('div', { class: 'gen' }, ti.gold.cypher)),
        E('div', { class: 'lists' }, ...['sql', 'cypher'].map(l => { const r = ti.runs[l]; return E('div', { class: 'box' },
          E('div', { class: 'tag' }, (l === 'sql' ? 'SQL' : 'Cypher') + ' written by the LLM: '), vc(ts[l]),
          E('div', { class: 'gen' }, r.generated),
          E('div', { class: 'hint' }, r.executed ? 'executed: ' + show(r.rows) : 'error from the engine: ' + r.error)); })),
        E('p', { class: 'hint' }, 'Both languages are only as good as the schema in the prompt and the question wording: a query that runs is not a query that is right (the "wrong result" cases ran without error). The schema is given as text; the model never saw the data. Public pack graph only; it has no tables of the thesis system.'));
      body.replaceChildren(...out);
    }
    loadPack().then(p => { pack = p; render(); }).catch(e => { body.textContent = 'cannot load the pack: ' + e; });
  }

  const api = { defaults, compute, mount, scoreT2Q, verdict, TECH, itemRows, firstGoldRank, rrfFuse, refuse, change };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['query_transformation'] = api;
})(typeof window !== 'undefined' ? window : this);
