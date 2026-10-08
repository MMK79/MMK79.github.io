/* HNSW: layered graph, greedy descent from the entry point, ef beam on layer 0.
   Real example (default): real hnswlib 0.8.0 recall@k versus efSearch (data/hnsw_experiment.json of the real-example pack) on the 138 passage vectors and on a 20,000-passage Simple English Wikipedia index; M=16 / efConstruction=200 and a deliberately weak M=4 / efConstruction=16.
   Toy example (break it): 60 invented 2-D points (seed 7), our own greedy/beam port. Note: its "15 distance evaluations" depends on the neighbour ORDER (first-improvement greedy; steepest descent gives 20, sorted ids 17), so that count is not canonical. */
(function (root) {
  const DATA = {"pts":[[0.32383276483316237,0.15084917392450192],[0.6509344730398537,0.07243628666754276],[0.5358820043066892,0.36568891691258554],[0.057998924774706806,0.5074357331894203],[0.03749565844198488,0.4336456836623859],[0.06985542357461894,0.09071301334386506],[0.42451918914251396,0.8268521246720381],[0.12380196114964559,0.22323896460701453],[0.6274332224055893,0.9477089424570057],[0.5771029486174987,0.39668047465078016],[0.9762551055929201,0.04658268061775628],[0.8584684590486795,0.28960928633167626],[0.14425508335743753,0.11779223807836836],[0.30848182410193437,0.8161263591200314],[0.18072637992393747,0.5816001636624663],[0.6389134689261841,0.3723975427257312],[0.5477444657095578,0.06278897497332314],[0.05960116996623266,0.20595871281932654],[0.6803999731817859,0.4275923056694029],[0.3141471703767915,0.5855618635076387],[0.45318437637077535,0.29976699686368236],[0.7943794815224912,0.6989944337295713],[0.24409651072215288,0.574423710258671],[0.5251965038114514,0.8751374955734289],[0.7294452894392176,0.2879377648901865],[0.9801748474925821,0.11806577825496212],[0.4181228217852272,0.7571409295652494],[0.15198453466050477,0.4889631004758056],[0.03920725704743766,0.6682158565343952],[0.7645708662128131,0.573025940277384],[0.8754778118308882,0.31374751284809677],[0.6952953662736593,0.5943698771050184],[0.5798952042824922,0.45620533130141305],[0.8399677805125414,0.9446810951079374],[0.47409833741964447,0.6641522054746745],[0.060669427597219716,0.7014920213044239],[0.6471288545276688,0.9930959394666341],[0.8219247866097149,0.28459553209414923],[0.3857914424467108,0.6686527158841882],[0.02256292805558857,0.46169528629976586],[0.16804837890654456,0.11709579448173191],[0.058954419331310404,0.7682329884725208],[0.12934022201868423,0.24761483369691428],[0.3909497031332271,0.8714219741262994],[0.08058130120013862,0.44918740094933096],[0.5494399091440374,0.8833838264415125],[0.8192798378357413,0.8639844696985152],[0.27842106451389714,0.4152965172116986],[0.3587711653316248,0.884192827198217],[0.9577312039639913,0.15092090579110895],[0.17621772849037032,0.23195686681953576],[0.23333608368086112,0.4849627303413566],[0.5891235037322556,0.26274661929853793],[0.004093603385063926,0.41894650112532794],[0.3692535728947254,0.566341223706392],[0.9530979255250953,0.6904936571359779],[0.5154914330707784,0.6175927494091277],[0.6762000824495014,0.053992893223790195],[0.8995330100579522,0.7799694907060728],[0.8745131841344765,0.7978731211965661]],"r":[0.39237890689126864,0.398978832320273,0.10353709371032427,0.634289565685709,0.06224782161868758,0.06734761584302484,0.20876318544616446,0.1623031877720974,0.3400536522323434,0.05257560389026694,0.00023328190135663007,0.15126493227942794,0.10146436802259651,0.363609922034571,0.025500886666145695,0.8743323773738196,0.6140689877884787,0.14855048533089144,0.2522577565570773,0.34738954605370154,0.36416343952828245,0.12284223076219491,0.8489369264846149,0.9931027217047139,0.4659894591599337,0.48383465641626944,0.08588466155616559,0.10218761674816845,0.3426358382430018,0.2647568917171801,0.8288553781215605,0.1614386105264315,0.023095721045248152,0.9509855728747021,0.5282573950421248,0.1466025388990907,0.5431724258821143,0.027042491422168524,0.5281094409383065,0.9785012427189728,0.8633250302896689,0.6961967859078019,0.26111519722936194,0.36669979176117884,0.1670420345343363,0.7719379084020312,0.532592397492879,0.7790548913381772,0.32966499504776237,0.22304167310318512,0.811511246773595,0.9849260505908908,0.8526287987466605,0.8060785847856675,0.8183329433253732,0.7398730203757141,0.2267394900315849,0.5176387242435055,0.3555625433549582,0.028980150741365396],"nbOrder":[{"0":[40,12,16,50,20],"1":[16,57,52,24],"2":[32,9,15,20,52],"3":[35,4,39,44,53,27,28],"4":[3,44,53,39],"5":[40,17,12,7],"6":[43,13,45,48,23,26],"7":[5,40,42,12,17,50],"8":[36,45,46,23],"9":[32,2,15,18,20,52],"10":[25,11,37,49],"11":[37,10,49,24,25,30],"12":[0,5,7,40,42,50],"13":[6,41,43,48,26],"14":[35,41,19,51,22,27,28],"15":[32,2,9,18,52,24],"16":[0,1,52,57],"17":[42,50,5,7],"18":[32,9,15,24,29,31],"19":[38,14,47,51,54,22],"20":[0,9,2,52],"21":[46,55,58,59,29,31],"22":[14,47,51,19,54],"23":[36,6,8,43,45],"24":[1,37,11,15,18,52,57,30],"25":[49,10,11,30],"26":[34,38,6,43,13,48,56],"27":[3,44,14,47,51],"28":[3,41,35,14],"29":[32,18,21,31],"30":[37,11,49,24,25],"31":[32,21,18,29],"32":[2,9,15,18,29,31],"33":[58,59,36,46],"34":[56,54,26,38],"35":[41,3,28,14],"36":[8,33,45,23],"37":[10,11,49,24,30],"38":[34,19,54,56,26],"39":[3,4,53,44],"40":[0,5,7,12,50],"41":[35,28,13,14],"42":[17,50,12,7],"43":[6,13,48,23,26],"44":[3,4,39,53,27],"45":[8,36,6,23],"46":[33,8,21,55,58,59],"47":[27,19,51,22],"48":[26,43,13,6],"49":[37,10,11,25,30],"50":[0,7,40,42,12,17],"51":[14,47,19,22,27],"52":[1,2,9,15,16,20,24,57],"53":[3,4,44,39],"54":[34,38,19,22,56],"55":[58,59,21,46],"56":[54,34,26,38],"57":[16,1,52,24],"58":[33,46,21,55,59],"59":[33,46,21,55,58]},{"15":[33,47,52,54,30],"22":[39,45,47,51,54,23],"23":[33,45,54,22],"30":[52,47,54,15],"33":[15,45,54,23],"39":[51,53,22,47],"40":[50,51,53,47],"45":[33,22,54,23],"47":[39,40,15,50,51,52,53,54,22,30],"50":[40,51,53,47],"51":[39,40,47,50,53,54,22],"52":[54,47,30,15],"53":[39,40,47,50,51],"54":[33,45,15,47,51,52,22,23,30]},{"23":[33,51,39],"33":[51,39,23],"39":[33,51,23],"51":[33,23,39]},{"23":[51],"51":[23]}]};
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const N = DATA.pts.length, PTS = DATA.pts;
  const defaults = { M: 4, ef: 1, q: [0.83, 0.21] };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* PURE: build the toy index for a given M (levels from the stored dice rolls; M = 4 keeps the neighbour order of the catalogue run). */
  const cache = {};
  function build(M) {
    if (cache[M]) return cache[M];
    const mL = 1 / Math.log(M);
    const lvl = DATA.r.map(r => Math.floor(-Math.log(1 - r) * mL));
    const L = Math.max(...lvl);
    const nb = [];
    for (let l = 0; l <= L; l++) {
      const ids = []; for (let i = 0; i < N; i++) if (lvl[i] >= l) ids.push(i);
      const sets = {}; ids.forEach(i => sets[i] = new Set());
      ids.forEach(i => {
        ids.filter(j => j !== i).sort((a, b) => dist(PTS[i], PTS[a]) - dist(PTS[i], PTS[b])).slice(0, M).forEach(j => { sets[i].add(j); sets[j].add(i); });
      });
      const lay = {};
      ids.forEach(i => {
        if (M === 4) lay[i] = DATA.nbOrder[l][i].slice();
        else lay[i] = [...sets[i]].sort((a, b) => dist(PTS[i], PTS[a]) - dist(PTS[i], PTS[b]));
      });
      nb.push(lay);
    }
    const ep = lvl.indexOf(L);
    return (cache[M] = { M, mL, lvl, L, nb, ep, counts: Array.from({ length: L + 1 }, (_, l) => lvl.filter(v => v >= l).length) });
  }

  /* PURE: search with a trace. Upper layers: greedy, first closer neighbour. Layer 0: ef = 1 same greedy, ef > 1 a beam of ef candidates. */
  function search(g, q, ef) {
    const dd = {}; const d = i => (i in dd ? dd[i] : (dd[i] = dist(PTS[i], q)));
    const steps = []; let cur = g.ep; d(cur);
    steps.push({ l: g.L, node: cur, kind: 'enter' });
    for (let l = g.L; l >= 0; l--) {
      if (l === 0 && ef > 1) break;
      let imp = true;
      while (imp) {
        imp = false;
        for (const j of g.nb[l][cur]) if (d(j) < d(cur)) { steps.push({ l, node: j, kind: 'move', from: cur }); cur = j; imp = true; break; }
      }
      if (l > 0) steps.push({ l: l - 1, node: cur, kind: 'down' });
    }
    let found = [cur];
    if (ef > 1) {
      const cand = [cur], res = [cur], vis = new Set([cur]);
      while (cand.length) {
        cand.sort((a, b) => d(a) - d(b));
        const c = cand.shift();
        res.sort((a, b) => d(a) - d(b));
        if (res.length >= ef && d(c) > d(res[res.length - 1])) break;
        for (const e of g.nb[0][c]) {
          if (vis.has(e)) continue; vis.add(e); d(e);
          res.sort((a, b) => d(a) - d(b));
          if (res.length < ef || d(e) < d(res[res.length - 1])) {
            cand.push(e); res.push(e); steps.push({ l: 0, node: e, kind: 'beam', from: c });
            res.sort((a, b) => d(a) - d(b)); if (res.length > ef) res.pop();
          }
        }
      }
      found = res.sort((a, b) => d(a) - d(b));
    }
    return { found, evals: Object.keys(dd).length, steps, visited: Object.keys(dd).map(Number) };
  }
  const exactNN = (q, k) => Array.from({ length: N }, (_, i) => i).sort((a, b) => dist(PTS[a], q) - dist(PTS[b], q)).slice(0, k);

  /* PURE: result in the shape of worked_example.result */
  function compute(inp) {
    const g = build(inp.M), s = search(g, inp.q, inp.ef);
    return { distance_evaluations: s.evals, brute_force_evaluations: N, found_node: s.found[0], true_nearest_node: exactNN(inp.q, 1)[0], nodes_per_layer: g.counts };
  }

  /* fixed bank of 200 queries (small LCG, so the page and node agree) */
  const BANK = (() => { let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; return Array.from({ length: 200 }, () => [rnd(), rnd()]); })();
  function bankStats(M, ef, k) {
    const g = build(M); let hit = 0, ev = 0;
    for (const q of BANK) {
      const s = search(g, q, ef), t = exactNN(q, k), f = s.found.slice(0, k);
      hit += t.filter(x => f.includes(x)).length / k; ev += s.evals;
    }
    return { recall: hit / BANK.length, evals: ev / BANK.length };
  }
  const layerSizes = (Nn, M, n = 6) => Array.from({ length: n }, (_, l) => Nn * Math.pow(M, -l));

  const PRESETS = {
    'worked example (M = 4, ef = 1)': { M: 4, ef: 1, q: [0.83, 0.21] },
    'ef = 16: look wider': { M: 4, ef: 16, q: [0.83, 0.21] },
    'break it: ef = 1 stops at the wrong node': null, // filled below with a query where the walk is wrong
  };

  function mountToy(el) {
    const K = DemoKit;
    let st = JSON.parse(JSON.stringify(defaults)), view = 0, upto = 1e9;
    // break-it query: first bank query where M=4, ef=1 stops at the wrong node but ef=4 finds the true one
    const g4 = build(4);
    const bq = BANK.find(q => search(g4, q, 1).found[0] !== exactNN(q, 1)[0] && search(g4, q, 4).found[0] === exactNN(q, 1)[0]) || BANK[0];
    PRESETS['break it: ef = 1 stops at the wrong node'] = { M: 4, ef: 1, q: bq.slice() };
    const shell = K.shell(el, 'HNSW: a layered graph search',
      'Toy example: 60 invented points, not measured data. Click the plot to move the query (amber). The walk starts at the top-layer entry point and drops one layer at a time. Raise ef to look wider. Note: the 15 distance evaluations of the worked example depend on the neighbour order (first-improvement greedy; steepest descent gives 20, sorted ids 17), so that count is not canonical.');
    const W = 400, S = v => v * W;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${W}`, role: 'img', 'aria-label': 'Toy HNSW graph with the search path', style: 'width:100%;max-width:440px;height:auto;background:var(--panel2);border-radius:8px;cursor:crosshair;touch-action:manipulation' });
    const sizes = K.el('div', {});
    const out = K.el('div', { class: 'row', 'aria-live': 'polite', style: 'gap:18px' });
    const bankBox = K.el('div', { class: 'formula' });
    const formula = K.el('div', { class: 'formula' });
    const layerBtns = K.el('div', { class: 'row' });
    const sM = K.slider('M (links per node)', 2, 8, 1, st.M, v => { st.M = v; upto = 1e9; render(true); });
    const sEf = K.slider('ef (search width)', 1, 24, 1, st.ef, v => { st.ef = v; upto = 1e9; render(true); });
    const presets = K.el('div', { class: 'row' }, ...Object.keys(PRESETS).map(n => {
      const b = K.el('button', {}, n); b.addEventListener('click', () => { st = JSON.parse(JSON.stringify(PRESETS[n])); sM.set(st.M); sEf.set(st.ef); upto = 1e9; render(true); }); return b; }));
    const stepBtn = K.el('button', {}, 'step through the walk');
    stepBtn.addEventListener('click', () => { const n = search(build(st.M), st.q, st.ef).steps.length; upto = upto >= n ? 1 : upto + 1; render(false); });
    const allBtn = K.el('button', {}, 'show whole walk'); allBtn.addEventListener('click', () => { upto = 1e9; render(false); });
    shell.append(presets, K.el('div', { class: 'row' }, sM.node, sEf.node), K.el('div', { class: 'row' }, 'view layer:', layerBtns, stepBtn, allBtn), svg, out, formula, bankBox, K.el('h4', { style: 'margin:14px 0 4px;font-weight:600' }, 'Layer sizes from the formula'), sizes);
    svg.addEventListener('click', e => { const r = svg.getBoundingClientRect(); st.q = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; upto = 1e9; render(false); });
    const nsz = K.el('input', { type: 'number', min: 100, step: 1000, value: 1000000, 'aria-label': 'N vectors', style: 'width:100px' });
    nsz.addEventListener('input', () => render(false));
    const pt = i => `${S(PTS[i][0])},${S(PTS[i][1])}`;

    function render(sync) {
      const g = build(st.M); if (view > g.L) view = g.L;
      const sr = search(g, st.q, st.ef), nn = exactNN(st.q, 1)[0], shown = sr.steps.slice(0, upto);
      const el2 = [];
      for (const i in g.nb[view]) for (const j of g.nb[view][i]) if (+i < j) el2.push(K.svg('line', { x1: S(PTS[i][0]), y1: S(PTS[i][1]), x2: S(PTS[j][0]), y2: S(PTS[j][1]), stroke: 'var(--line)', 'stroke-width': 1.2 }));
      // the walk so far, all layers, drawn in the colour of the layer it ran in
      const lc = ['var(--k12)', 'var(--both)', 'var(--he)', 'var(--ai)'];
      shown.forEach(s => { if (s.from !== undefined) el2.push(K.svg('line', { x1: S(PTS[s.from][0]), y1: S(PTS[s.from][1]), x2: S(PTS[s.node][0]), y2: S(PTS[s.node][1]), stroke: s.kind === 'beam' ? 'var(--faint)' : lc[Math.min(s.l, 3)], 'stroke-width': s.kind === 'beam' ? 1.5 : 3, 'stroke-linecap': 'round' })); });
      const visit = new Set(shown.map(s => s.node));
      for (let i = 0; i < N; i++) {
        const inL = g.lvl[i] >= view;
        el2.push(K.svg('circle', { cx: S(PTS[i][0]), cy: S(PTS[i][1]), r: inL ? 4.5 : 2, fill: visit.has(i) ? 'var(--he)' : inL ? 'var(--text)' : 'var(--faint)', opacity: inL ? 1 : 0.5 }));
      }
      el2.push(K.svg('circle', { cx: S(PTS[g.ep][0]), cy: S(PTS[g.ep][1]), r: 8, fill: 'none', stroke: 'var(--both)', 'stroke-width': 2 }));
      el2.push(K.svg('circle', { cx: S(PTS[nn][0]), cy: S(PTS[nn][1]), r: 9, fill: 'none', stroke: 'var(--k12)', 'stroke-width': 2, 'stroke-dasharray': '3 3' }));
      el2.push(K.svg('path', { d: `M${S(st.q[0]) - 7},${S(st.q[1])}h14M${S(st.q[0])},${S(st.q[1]) - 7}v14`, stroke: 'var(--ai)', 'stroke-width': 3 }));
      svg.replaceChildren(...el2);
      layerBtns.replaceChildren(...Array.from({ length: g.L + 1 }, (_, l) => { const b = K.el('button', { 'aria-pressed': String(l === view) }, `layer ${l} (${g.counts[l]})`); b.addEventListener('click', () => { view = l; render(false); }); return b; }));
      const ok = sr.found[0] === nn;
      out.replaceChildren(
        K.el('span', {}, 'distance evaluations: ', K.el('b', { class: 'num' }, sr.evals), ` of ${N} (brute force)`),
        K.el('span', {}, 'found node ', K.el('b', { class: 'num' }, sr.found[0]), ', true nearest ', K.el('b', { class: 'num' }, nn), ': '),
        K.el('b', { class: ok ? 'good' : 'bad' }, ok ? 'correct' : 'WRONG: stuck in a local minimum'));
      const walk = sr.steps.filter(s => s.kind !== 'beam').map(s => `(${s.l},${s.node})`);
      formula.textContent = `layer sizes (computed) ${JSON.stringify(g.counts)}, entry point = node ${g.ep} on layer ${g.L}\n` +
        `walk (layer, node): ${walk.join(' ')}${st.ef > 1 ? `  then layer 0 beam of ef = ${st.ef}` : ''}\n` +
        `m_L = 1/ln(${st.M}) = ${K.fmt(g.mL, 4)};  P(level >= l) = ${st.M}^-l;  the 60 dice rolls gave ${g.counts.map((c, l) => `${c} in layer ${l}`).join(', ')}`;
      const b = bankStats(st.M, st.ef, 1);
      bankBox.textContent = `over 200 random queries: recall@1 (true nearest found) = ${K.fmt(b.recall, 3)}, average distance evaluations = ${K.fmt(b.evals, 3)}\n` +
        `ef trade-off (M = ${st.M}): ` + [1, 2, 4, 8, 16, 24].map(e => { const s = bankStats(st.M, e, 1); return `ef ${e}: ${K.fmt(s.recall, 2)} @ ${K.fmt(s.evals, 3)}`; }).join('  |  ');
      const Nn = Number(nsz.value) || 1e6, ls = layerSizes(Nn, st.M), mx = Math.max(...ls);
      sizes.replaceChildren(K.el('div', { class: 'row' }, 'N = ', nsz, ` M = ${st.M}: layers about log_M(N) = ${K.fmt(Math.log(Nn) / Math.log(st.M), 3)}`),
        ...ls.filter(v => v >= 1).map((v, l) => K.el('div', { style: 'display:flex;align-items:center;gap:8px;margin:2px 0' },
          K.el('span', { style: 'width:60px;color:var(--muted);font-size:12px' }, `layer ${l}`),
          K.el('div', { style: `height:12px;border-radius:3px;background:var(--he);width:${Math.max(0.5, Math.log10(v + 1) / Math.log10(mx + 1) * 70)}%` }),
          K.el('span', { class: 'num', style: 'font-size:12px;color:var(--muted)' }, Math.round(v).toLocaleString()))));
      if (sync) { sM.set(st.M); sEf.set(st.ef); }
    }
    render(true);
  }

  /* ---------- Real example: recall@k versus efSearch from real hnswlib runs ---------- */
  function mountReal(body) {
    const K = DemoKit, url = new URL('../../_real-examples/data/hnsw_experiment.json', SRC || location.href).href;
    body.textContent = 'loading the real runs...'; const wait = body.firstChild;
    fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }).then(D => {
      const sets = { small: { label: 'Small: 138 passage vectors', d: D.small, n: 138, what: 'the 138 corpus passages (15 English Wikipedia articles, all-MiniLM-L6-v2)' },
                     large: { label: 'Large: 20,000 passage vectors', d: D.large, n: D.large.n_index, what: 'a 20,000-passage index from Simple English Wikipedia (dump 2023-11-01; 20,500 passages cut from 9,524 articles, 500 held out as queries)' } };
      const st = { set: 'large', run: 0, k: 10, ef: 64 };
      wait.remove(); const shell = K.shell(body, 'HNSW: real recall versus efSearch',
        'Real hnswlib 0.8.0 (cosine, single thread, seed 100) against exact brute-force search. Recall@k = share of the exact top-k neighbours that HNSW returns. Every number is read from the pack; nothing is invented.');
      const setBtns = K.el('div', { class: 'row' }), runSel = K.el('select', { 'aria-label': 'queries and build', style: 'max-width:100%;width:100%' }), kBtns = K.el('div', { class: 'row' });
      const chart = K.svg('svg', { viewBox: '0 0 440 250', role: 'img', 'aria-label': 'Recall versus efSearch', style: 'width:100%;max-width:640px;height:auto;background:var(--panel2);border-radius:8px' });
      const sl = K.slider('efSearch', 0, 0, 1, 0, v => { st.ef = EFS()[v]; draw(); });
      const info = K.el('div', { class: 'formula' }), tbl = K.el('div', {}), cav = K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px;margin-top:10px' });
      shell.append(setBtns, K.el('div', { class: 'row' }, K.el('label', { style: 'display:block;width:100%' }, 'queries and build ', runSel), kBtns), chart, K.el('div', { class: 'row' }, sl.node), info, tbl, cav);
      const runs = () => sets[st.set].d.runs;
      const pts = () => runs()[st.run].points.filter(p => p.k === st.k);
      const EFS = () => pts().map(p => p.ef_search);
      function fillRuns() {
        runSel.replaceChildren(...runs().map((r, i) => K.el('option', { value: i }, `${r.queries} - ${r.build.name} (M=${r.build.M}, efConstruction=${r.build.ef_construction})`)));
        runSel.value = String(st.run);
      }
      runSel.addEventListener('change', () => { st.run = +runSel.value; draw(true); });
      function draw(re) {
        const S = sets[st.set], R = runs()[st.run], P = pts(), efs = P.map(p => p.ef_search);
        if (!efs.includes(st.ef)) st.ef = efs.reduce((a, b) => Math.abs(b - st.ef) < Math.abs(a - st.ef) ? b : a);
        sl.node.querySelector('input').max = efs.length - 1; sl.set(efs.indexOf(st.ef)); sl.node.querySelector('.num').textContent = st.ef;
        setBtns.replaceChildren(...Object.keys(sets).map(key => { const b = K.el('button', { 'aria-pressed': String(key === st.set) }, sets[key].label); b.addEventListener('click', () => { st.set = key; st.run = 0; fillRuns(); draw(); }); return b; }));
        kBtns.replaceChildren(...[10, 1].map(k => { const b = K.el('button', { 'aria-pressed': String(k === st.k) }, `recall@${k}`); b.addEventListener('click', () => { st.k = k; draw(); }); return b; }));
        // chart: x = log2(efSearch), y = recall 0..1; the other builds drawn faint for contrast
        const X0 = 44, X1 = 420, Y0 = 20, Y1 = 205, lx = Math.log2(Math.max(...efs)) , x = e => X0 + (Math.log2(e) / lx) * (X1 - X0), y = r => Y1 - r * (Y1 - Y0);
        const kids = [];
        [0, 0.25, 0.5, 0.75, 1].forEach(v => { kids.push(K.svg('line', { x1: X0, x2: X1, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }), K.svg('text', { x: X0 - 6, y: y(v) + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 11 }, String(v))); });
        efs.filter(e => [1, 2, 4, 8, 16, 32, 64, 128, 256].includes(e) || e === st.ef).forEach(e => kids.push(K.svg('text', { x: x(e), y: Y1 + 15, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 10 }, String(e))));
        kids.push(K.svg('text', { x: (X0 + X1) / 2, y: 238, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 }, 'efSearch (log scale)'));
        S.d.runs.forEach((r, i) => { if (i === st.run) return; const Q = r.points.filter(p => p.k === st.k).filter(p => p.ef_search >= 1);
          kids.push(K.svg('polyline', { points: Q.map(p => `${x(p.ef_search)},${y(p.recall)}`).join(' '), fill: 'none', stroke: 'var(--faint)', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' })); });
        kids.push(K.svg('polyline', { points: P.map(p => `${x(p.ef_search)},${y(p.recall)}`).join(' '), fill: 'none', stroke: 'var(--he)', 'stroke-width': 2.5 }));
        P.forEach(p => kids.push(K.svg('circle', { cx: x(p.ef_search), cy: y(p.recall), r: p.ef_search === st.ef ? 6 : 3.5, fill: p.ef_search === st.ef ? 'var(--ai)' : 'var(--he)' })));
        chart.replaceChildren(...kids);
        const cur = P.find(p => p.ef_search === st.ef);
        info.textContent = `${S.what}\nqueries: ${R.queries} (${R.n_queries})   build: M=${R.build.M}, efConstruction=${R.build.ef_construction} (${R.build.name})   built in ${R.build_seconds} s\n` +
          `efSearch = ${st.ef}:  recall@${st.k} = ${K.fmt(cur.recall, 4)}   (${K.fmt(cur.recall * 100, 1)}% of the exact top-${st.k} neighbours found)   about ${K.fmt(cur.ms_per_query, 3)} ms per query\n` +
          `brute force would compute ${S.n.toLocaleString()} distances per query; HNSW computes far fewer, but the pack stores time, not the evaluation count.\n` +
          `Faint dashed lines: the other query set / build of the same index, for contrast.`;
        tbl.replaceChildren(K.el('table', {}, K.el('thead', {}, K.el('tr', {}, K.el('th', {}, 'efSearch'), K.el('th', {}, `recall@${st.k}`), K.el('th', {}, 'ms per query (noisy)'))),
          K.el('tbody', {}, ...P.map(p => K.el('tr', p.ef_search === st.ef ? { style: 'font-weight:600' } : {}, K.el('td', { class: 'num' }, p.ef_search), K.el('td', { class: 'num' }, K.fmt(p.recall, 4)), K.el('td', { class: 'num' }, K.fmt(p.ms_per_query, 3)))))));
        cav.textContent = 'Caveats: ' + (st.set === 'small' ? 'with only 138 vectors exact search is instant and HNSW has no reason to exist here: the curve is nearly flat (recall@10 0.983 at efSearch 10, 1.0 from 48 on the standard build). ' :
          'the large index is Simple English Wikipedia, a different distribution from the 138-passage corpus. The 500 held-out passages are in-distribution (standard build: recall@10 0.90 at efSearch 10, 0.994 at 64). The 24 ML questions are OUT-of-distribution for this index and reach only 0.49 at efSearch 10 and 0.82 at 64: queries far from the data are harder for graph search. That is a real effect, not a bug. ') +
          'Latencies are single-thread wall time on a Mac under heavy swap: indicative only, noisy, not a benchmark. The weak build (M=4, efConstruction=16) is deliberate, to show the graph quality effect. hnswlib is a real implementation, not the toy port below: no step-by-step walk here. Text: Wikipedia contributors, CC BY-SA 4.0.';
      }
      fillRuns(); draw();
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

  const api = { defaults, compute, mount, build, search, bankStats };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['hnsw'] = api;
})(this);
