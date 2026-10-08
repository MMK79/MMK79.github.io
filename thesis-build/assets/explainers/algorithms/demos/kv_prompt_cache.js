/* KV / prompt caching: cost of n requests that share a prefix, with and without a cache; plus KV bytes per token.
   Real example (default): (1) the 36 REAL provider calls of the answer study (qwen3.7-plus; measured prompt/completion tokens, latency, USD; stored prompts) and (2) a wider 24-question what-if.
   Older real panel: the 24 real questions of the Wikipedia pack. Each prompt = fixed instruction + the real top-5 dense passages + question.
   Token counts are real BERT-wordpiece counts of that text (indicative, not the provider's tokenizer). Prices are the Anthropic table row used in the entry.
   Toy example: invented prefix sizes; editable. compute() is pure. */
(function (root) {
  const SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const defaults = { L: 5000, U: 200, n: 10, Pin: 3.0, mw: 1.25, mr: 0.1, dModel: 5120, nLayers: 40, bytes: 2 };
  const r5 = x => Math.round(x * 1e5) / 1e5;

  /* PURE. Prices per million tokens: Pin, write = mw*Pin, read = mr*Pin. */
  function compute(i) {
    const Pi = i.Pin / 1e6, Pw = Pi * i.mw, Pr = Pi * i.mr, T = i.L + i.U;
    const none = n => n * Pi * T;
    const cache = n => (Pw * i.L + Pi * i.U) + (n - 1) * (Pr * i.L + Pi * i.U);
    const c = cache(i.n), z = none(i.n);
    let be = 0; for (let n = 1; n <= 10000; n++) if (cache(n) < none(n)) { be = n; break; }
    return { cost_no_cache_usd: r5(z), cost_with_cache_usd: r5(c), saving_pct: Math.round((1 - c / z) * 1e4) / 100, break_even_requests: be,
      cost_prefix_changes_every_time_usd: r5(i.n * (Pw * i.L + Pi * i.U)), kv_bytes_per_token_opt13b: 2 * i.dModel * i.nLayers * i.bytes };
  }

  /* PURE. Real pack: requests in order; each prompt = [pad static tokens] + system + top-5 passages + question.
     "static" layout: shared prefix with an earlier request = pad + system + leading identical passages. "volatile" layout: a changing token first = no shared prefix.
     Every prompt of length >= minLen is cached whole (newly written tokens cost mw x), hits cost mr x; below minLen nothing is cached (all tokens cost 1 x). */
  function realCompute(real, o) {
    const sysT = real.system_tokens + o.pad, Q = real.questions, P = real.passages;
    let tot = 0, totNone = 0, hitTok = 0, allTok = 0, cachedReq = 0, hits = 0; const rows = [];
    Q.forEach((q, i) => {
      const toks = sysT + q.top5.reduce((s, p) => s + P[p].tokens, 0) + q.tokens;
      let h = 0;
      if (o.layout === 'static') for (let j = 0; j < i; j++) {
        let k = 0, t = sysT; while (k < 5 && Q[j].top5[k] === q.top5[k]) { t += P[q.top5[k]].tokens; k++; }
        h = Math.max(h, t);
      }
      const cacheable = toks >= o.minLen && o.layout !== 'off';
      if (!cacheable) h = 0;
      const base = o.Pin / 1e6, cost = cacheable ? h * base * o.mr + (toks - h) * base * o.mw : toks * base;
      tot += cost; totNone += toks * base; hitTok += h; allTok += toks; if (cacheable) cachedReq++; if (h > 0) hits++;
      rows.push({ id: q.id, toks, h, cost });
    });
    return { totNone: r5(totNone), tot: r5(tot), saving_pct: Math.round((1 - tot / totNone) * 1e4) / 100, hitTok, allTok, cachedReq, hits, rows };
  }


  /* PURE. Real answer-study calls (slice 4), one arm = one request stream in the recorded order. Each call = segments [key, tokens(est)];
     real layout is  head, passages, question, instruction  (instruction LAST). Layouts: asrun | stable (instruction moved first) | volatile (timestamp first) | off.
     A hit needs a shared leading prefix of at least minLen tokens (provider minimum); a prompt shorter than minLen is never cached. Output tokens are never cached. */
  function realCallsCompute(data, o) {
    const calls = data.calls.filter(c => c.arm === o.arm), Pi = o.Pin / 1e6, Po = data.prices_usd_per_mtok.output / 1e6, lay = [];
    calls.forEach((c, i) => {
      let segs = c.segs.map(x => [x[0], x[1]]); const ins = segs.pop();
      if (o.layout === 'stable' || o.layout === 'volatile') segs.unshift(ins); else segs.push(ins);
      if (o.pad > 0 && o.layout !== 'off') segs.unshift(['pad', o.pad]);
      if (o.layout === 'volatile') segs.unshift(['ts' + i, 12]);
      lay.push(segs);
    });
    let inNone = 0, inCache = 0, out = 0, hitTok = 0, allTok = 0, hits = 0, big = 0; const rows = [];
    lay.forEach((segs, i) => {
      const T = segs.reduce((s, x) => s + x[1], 0); let h = 0;
      if (o.layout !== 'off') for (let j = 0; j < i; j++) { let t = 0, k = 0; while (k < segs.length && k < lay[j].length && segs[k][0] === lay[j][k][0]) { t += segs[k][1]; k++; } if (t > h) h = t; }
      const reuse = h >= o.minLen ? h : 0, ok = o.layout !== 'off' && T >= o.minLen;
      const c = ok ? reuse * Pi * o.mr + (T - reuse) * Pi * o.mw : T * Pi;
      inNone += T * Pi; inCache += c; hitTok += reuse; allTok += T; if (reuse > 0) hits++; if (T >= o.minLen) big++;
      out += calls[i].completion_tokens * Po; rows.push({ qid: calls[i].qid, T, shared: Math.round(h), reuse: Math.round(reuse), cost: c });
    });
    const tNone = inNone + out, tCache = inCache + out;
    return { n: calls.length, inNone: r5(inNone), inCache: r5(inCache), out: r5(out), totNone: r5(tNone), totCache: r5(tCache), in_saving_pct: Math.round((1 - inCache / inNone) * 1e4) / 100, total_saving_pct: Math.round((1 - tCache / tNone) * 1e4) / 100, hitTok: Math.round(hitTok), allTok: Math.round(allTok), hits, promptsAtMin: big, rows };
  }

  const PRESETS = {
    'worked example': {},
    'break it: timestamp first (prefix changes every time)': { __changing: true },
    'cache lifetime too short (n = 1)': { n: 1 },
    'prefix below the minimum (L = 600)': { L: 600 },
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const usd = x => '$' + x.toFixed(5);

  function mountToy(el) {
    const K = DemoKit; let st = clone(defaults), changing = false;
    const shell = K.shell(el, 'Prompt caching: what do we save when a prefix repeats?',
      'Toy numbers (invented scenario, prices from the Anthropic pricing table row in the entry, dated 2026-10-08, input tokens only). Move the sliders; the cached part of the prompt is the left block of the strip.');
    const pr = K.el('div', { class: 'row' }), ctl = K.el('div', { class: 'row' }), strip = K.el('div', {}), res = K.el('div', { 'aria-live': 'polite' }), formula = K.el('div', { class: 'formula' }), bars = K.el('div', {});
    const S = {
      L: K.slider('prefix L (tokens)', 0, 20000, 100, st.L, v => { st.L = v; draw(); }),
      U: K.slider('unique tail U', 0, 2000, 10, st.U, v => { st.U = v; draw(); }),
      n: K.slider('requests n inside the lifetime', 1, 50, 1, st.n, v => { st.n = v; draw(); }),
      mr: K.slider('read price x', 0.05, 1, 0.05, st.mr, v => { st.mr = v; draw(); }),
    };
    function setAll() { for (const k of Object.keys(S)) S[k].set(st[k]); }
    Object.keys(PRESETS).forEach(k => { const b = K.el('button', {}, k); b.addEventListener('click', () => { st = { ...clone(defaults), ...PRESETS[k] }; changing = !!st.__changing; delete st.__changing; setAll(); draw(); }); pr.append(b); });
    ctl.append(...Object.values(S).map(s => s.node));
    shell.append(pr, ctl, strip, res, bars, formula);
    function draw() {
      const r = compute(st), T = st.L + st.U || 1, none = st.n * st.Pin / 1e6 * T, cc = changing ? r.cost_prefix_changes_every_time_usd : r.cost_with_cache_usd;
      strip.replaceChildren(K.el('div', { class: 'hint' }, 'one prompt, left to right (tokens)'),
        K.el('div', { style: 'display:flex;height:22px;border-radius:3px;overflow:hidden;background:var(--line)' },
          K.el('div', { style: `width:${100 * st.L / T}%;background:${changing ? 'var(--warn)' : 'var(--he)'}`, title: 'prefix' }),
          K.el('div', { style: `width:${100 * st.U / T}%;background:var(--k12)`, title: 'unique' })),
        K.el('div', { class: 'hint' }, changing ? 'a timestamp at the top changes every request: the prefix never matches, every request WRITES it (1.25 x)' : `prefix ${st.L} tokens (cached after request 1) + unique tail ${st.U} tokens (always full price)`));
      const sv = (1 - cc / none) * 100;
      const row = (name, v, col) => K.el('div', { style: 'margin:4px 0' }, K.el('div', { style: `color:${col};font-size:13px` }, name + ': ', K.el('b', {}, usd(v))), K.el('div', { style: `height:10px;border-radius:2px;background:${col};width:${Math.max(1, 100 * v / Math.max(none, cc, 1e-9))}%` }));
      bars.replaceChildren(row('no cache', none, 'var(--k12)'), row(changing ? 'cache, prefix changes every time' : 'with cache', cc, sv >= 0 ? 'var(--he)' : 'var(--warn)'));
      res.replaceChildren(K.el('div', {}, 'saving: ', K.el('b', { class: sv >= 0 ? 'good' : 'bad' }, K.fmt(sv, 2) + '%')),
        changing ? K.el('div', { class: 'bad' }, 'No break-even: the prefix never repeats, so there is never a read.') : K.el('div', {}, 'break-even: the cache pays off from request ', K.el('b', {}, r.break_even_requests || 'never')),
        st.L < 1024 ? K.el('div', { class: 'bad' }, 'Below the provider minimum (about 1,024 tokens for OpenAI; model-specific at Anthropic) nothing is cached and no error is returned: the real cost is the no-cache number.') : '',
        K.el('div', { class: 'hint' }, `KV tensors stored per cached token: 2 x ${st.dModel} x ${st.nLayers} x ${st.bytes} = ${r.kv_bytes_per_token_opt13b.toLocaleString('en-US')} bytes (OPT-13B FP16, vLLM paper); a ${st.L}-token prefix is about ${K.fmt(st.L * r.kv_bytes_per_token_opt13b / 1e9, 2)} GB.`));
      formula.textContent = `C_cache = (1.25 x ${st.Pin} x L + ${st.Pin} x U)/1e6 + (n-1)(${st.mr} x ${st.Pin} x L + ${st.Pin} x U)/1e6 = ${usd(r.cost_with_cache_usd)}    C_none = n x ${st.Pin} x (L+U)/1e6 = ${usd(r.cost_no_cache_usd)}`;
    }
    draw();
  }


  function mountCalls(el) {
    const K = DemoKit, url = new URL('data/kv_prompt_cache.calls.json', SRC || location.href).href;
    const box = K.shell(el, 'Real example: the 36 provider calls of the answer study',
      'Real data: 36 answer calls to qwen3.7-plus (12 questions x 3 arms: A no retrieval, B hybrid top-5, C dense top-5 + graph passages), 2026-10-08. Measured: prompt and completion tokens, latency, USD per call. Segment sizes inside a prompt are estimates (stored text split by characters, scaled to the real prompt tokens). Demo scale, n = 12 per arm, one run.');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
      const o = { arm: 'B', layout: 'asrun', minLen: 1024, Pin: data.prices_usd_per_mtok.input, mw: 1.25, mr: 0.1, pad: 0 };
      const ctl = K.el('div', { class: 'row' }), out = K.el('div', { 'aria-live': 'polite' }), tbl = K.el('div', {}), cmp = K.el('div', {});
      const armS = K.el('select', { 'aria-label': 'arm' }, ...['A', 'B', 'C'].map(a => K.el('option', { value: a }, 'arm ' + a + { A: ' (no retrieval)', B: ' (hybrid top-5)', C: ' (dense + graph)' }[a])));
      armS.value = 'B'; armS.addEventListener('change', () => { o.arm = armS.value; draw(); });
      const layS = K.el('select', { 'aria-label': 'layout' }, K.el('option', { value: 'asrun' }, 'as run: sources, question, instruction last'), K.el('option', { value: 'stable' }, 'stable first: instruction, sources, question'), K.el('option', { value: 'volatile' }, 'break it: timestamp first'), K.el('option', { value: 'off' }, 'no caching'));
      layS.addEventListener('change', () => { o.layout = layS.value; draw(); });
      const sMin = K.slider('provider minimum (tokens)', 0, 2048, 64, o.minLen, v => { o.minLen = v; draw(); });
      const sPad = K.slider('extra fixed block, e.g. tool list (INVENTED tokens)', 0, 8000, 250, o.pad, v => { o.pad = v; draw(); });
      const sMr = K.slider('read price x (ASSUMED)', 0.05, 1, 0.05, o.mr, v => { o.mr = v; draw(); });
      ctl.append(K.el('label', {}, 'arm ', armS), K.el('label', {}, 'layout ', layS), sMin.node, sPad.node, sMr.node);
      const armRows = a => data.calls.filter(c => c.arm === a), mean = (a, k) => armRows(a).reduce((s, c) => s + c[k], 0) / 12;
      function draw() {
        const r = realCallsCompute(data, o), rows = armRows(o.arm), maxP = Math.max(...rows.map(c => c.prompt_tokens)), minP = Math.min(...rows.map(c => c.prompt_tokens));
        out.replaceChildren(
          K.el('div', {}, `arm ${o.arm}: prompts ${minP} to ${maxP} tokens (mean ${K.fmt(mean(o.arm, 'prompt_tokens'), 0)}), ${r.promptsAtMin} of ${r.n} at or above the ${o.minLen}-token minimum. Provider-reported cached_tokens on all 36 calls: ${[...new Set(data.calls.map(c => c.provider_cached_tokens))].join(', ')} (no cache was in play).`),
          K.el('div', {}, `real bill (measured): input+output ${usd(rows.reduce((s, c) => s + c.usd, 0))}; mean latency ${K.fmt(mean(o.arm, 'latency_s'), 2)} s per call; mean ${K.fmt(mean(o.arm, 'completion_tokens'), 0)} output tokens.`),
          K.el('div', {}, `what-if, layout "${o.layout}": input cost ${usd(r.inNone)} to `, K.el('b', { class: r.inCache <= r.inNone ? 'good' : 'bad' }, usd(r.inCache)), ' (saving ', K.el('b', {}, K.fmt(r.in_saving_pct, 2) + '%'), `); with the output cost ${usd(r.out)} added: saving `, K.el('b', {}, K.fmt(r.total_saving_pct, 2) + '%'), `. Hit tokens ${r.hitTok} of ${r.allTok}; requests with a hit: ${r.hits} of ${r.n}.`),
          r.hits === 0 && o.layout !== 'off' ? K.el('div', { class: 'bad' }, o.layout === 'asrun' ? 'As run, the instruction is LAST and the sources differ per question, so the shared leading text is only "Sources:" and a bracket: no reusable prefix. Move the instruction first, then lower the minimum or add the invented fixed block.' : `No hit: the shared prefix (about ${data.instruction_tokens_mean_est[o.arm === 'A' ? 'A' : 'BC']} instruction tokens plus any identical leading passages) is below the ${o.minLen}-token minimum.`) : '',
          r.promptsAtMin > 0 && r.in_saving_pct < 0 ? K.el('div', { class: 'bad' }, 'Caching costs MORE here: prompts are written at the write price and almost never read back.') : '',
          K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px' }, `Measured: tokens, latency, USD (one run). Estimated: segment split. Assumed: write 1.25 x and read ${o.mr} x of the input price (the Anthropic-style table of the toy; Alibaba's own cache rates not checked), all 12 requests inside the cache lifetime, minimum ${o.minLen} tokens (OpenAI's value; Anthropic's is model-specific). Invented: the "extra fixed block". Latency saving from caching is NOT measured: no call hit a cache. The graph arm C has ~40% more context than B.`));
        cmp.replaceChildren(K.el('div', { class: 'hint' }, 'all three layouts, this arm, same assumptions'), ...['asrun', 'stable', 'volatile'].map(l => { const x = realCallsCompute(data, { ...o, layout: l }); return K.el('div', { style: 'font-size:13px' }, `${{ asrun: 'as run', stable: 'stable first', volatile: 'timestamp first' }[l]}: input ${usd(x.inNone)} to ${usd(x.inCache)} (${K.fmt(x.in_saving_pct, 2)}%), hits ${x.hits}/${x.n}`); }));
        const sc = 1400;
        tbl.replaceChildren(K.el('div', { class: 'hint' }, `per call: tokens over the ${o.minLen}-token minimum are marked by the tick; teal = reusable prefix, blue = full price`), ...r.rows.map(x => K.el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:12px' }, K.el('span', { style: 'width:34px' }, x.qid), K.el('div', { style: 'flex:1;position:relative;display:flex;height:10px;background:var(--line);border-radius:2px;overflow:hidden' }, K.el('div', { style: `width:${100 * x.reuse / sc}%;background:var(--he)` }), K.el('div', { style: `width:${100 * (x.T - x.reuse) / sc}%;background:var(--k12)` }), K.el('div', { style: `position:absolute;left:${100 * o.minLen / sc}%;top:0;bottom:0;width:2px;background:var(--warn)` })), K.el('span', { class: 'num', style: 'width:120px' }, `${Math.round(x.T)} tok, ${x.reuse} hit`))));
      }
      body.replaceChildren(ctl, out, cmp, tbl); draw();
    }).catch(e => { body.textContent = 'could not load the real call data (' + e.message + ').'; });
  }

  function mountReal(el) {
    const K = DemoKit, url = new URL('data/kv_prompt_cache.real.json', SRC || location.href).href;
    const box = K.shell(el, 'Wider what-if: 24 questions, real passages, estimated tokens',
      'Real data: the 24 questions and top-5 retrieved passages (dense cosine) of the Wikipedia pack, in order, as 24 requests. Token counts are real BERT-wordpiece counts of the real text (indicative: a provider tokenizer gives different numbers). Prices are the toy price table, not a measured bill (the measured per-call numbers are in the panel above). The instruction text is ours (37 tokens).');
    const body = K.el('div', {}, 'loading real data...'); box.append(body);
    fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(real => {
      const o = { Pin: 3, mw: 1.25, mr: 0.1, minLen: 1024, pad: 0, layout: 'static' };
      const ctl = K.el('div', { class: 'row' }), out = K.el('div', { 'aria-live': 'polite' }), tbl = K.el('div', {});
      const ls = K.el('select', { 'aria-label': 'prompt layout' }, K.el('option', { value: 'static' }, 'stable first: instruction, passages, question'), K.el('option', { value: 'volatile' }, 'break it: timestamp first'), K.el('option', { value: 'off' }, 'no caching'));
      ls.addEventListener('change', () => { o.layout = ls.value; draw(); });
      const sMin = K.slider('provider minimum (tokens)', 0, 2048, 64, o.minLen, v => { o.minLen = v; draw(); });
      const sPad = K.slider('extra fixed block, e.g. tool list (invented tokens)', 0, 8000, 250, o.pad, v => { o.pad = v; draw(); });
      ctl.append(K.el('label', {}, 'layout ', ls), sMin.node, sPad.node);
      function draw() {
        const r = realCompute(real, o), mean = Math.round(r.allTok / real.questions.length);
        out.replaceChildren(
          K.el('div', {}, `24 requests, mean prompt ${mean} tokens (instruction ${real.system_tokens + o.pad} + 5 passages + question).`),
          K.el('div', {}, 'input cost no cache ', K.el('b', {}, usd(r.totNone)), ' to with cache ', K.el('b', { class: r.tot <= r.totNone ? 'good' : 'bad' }, usd(r.tot)), '  saving ', K.el('b', {}, K.fmt(r.saving_pct, 2) + '%')),
          K.el('div', {}, `requests that were cacheable: ${r.cachedReq} of 24; requests with a cache hit: ${r.hits}; hit tokens ${r.hitTok} of ${r.allTok}.`),
          r.cachedReq === 0 && o.layout !== 'off' ? K.el('div', { class: 'bad' }, `Every real prompt is below the minimum (${o.minLen}): nothing is cached, you pay the plain price. Lower the minimum or add the fixed block to see what a long static prefix would change.`) : '',
          r.cachedReq > 0 && r.saving_pct < 0 ? K.el('div', { class: 'bad' }, 'Caching costs MORE here: new tokens are written at 1.25 x and the per-question passages almost never repeat.') : '',
          K.el('div', { class: 'hint', style: 'border-left:3px solid var(--warn);padding-left:8px' }, 'Caveats: demo scale (24 requests, 138 passages, questions written by Claude); only the cache lifetime is assumed (all 24 inside it); each prompt is cached whole (automatic prefix caching), a simplification. A real RAG system puts retrieved chunks that change per question AFTER the static part, so only the static part is cacheable.'));
        tbl.replaceChildren(...real.questions.map((q, i) => { const x = r.rows[i]; return K.el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:12px' }, K.el('span', { style: 'width:34px' }, q.id), K.el('div', { style: 'flex:1;display:flex;height:10px;background:var(--line);border-radius:2px;overflow:hidden' }, K.el('div', { style: `width:${100 * x.h / 3000}%;background:var(--he)` }), K.el('div', { style: `width:${100 * (x.toks - x.h) / 3000}%;background:var(--k12)` })), K.el('span', { class: 'num', style: 'width:130px' }, `${x.toks} tok, ${x.h} hit`)); }));
      }
      body.replaceChildren(ctl, out, K.el('div', { class: 'hint' }, 'per request: cache hit (teal) + full price (blue)'), tbl); draw();
    }).catch(e => { body.textContent = 'could not load the real data (' + e.message + '). Use the toy example.'; });
  }

  function mount(el) {
    const K = DemoKit, bar = K.el('div', { class: 'row' }), real = K.el('div', {}), toy = K.el('div', {});
    const b1 = K.el('button', {}, 'Real example'), b2 = K.el('button', {}, 'Toy example (break it)');
    const show = r => { real.style.display = r ? '' : 'none'; toy.style.display = r ? 'none' : ''; b1.setAttribute('aria-pressed', String(r)); b2.setAttribute('aria-pressed', String(!r)); };
    b1.addEventListener('click', () => show(true)); b2.addEventListener('click', () => show(false));
    bar.append(b1, b2); el.append(bar, real, toy); const rc = K.el('div', {}), rw = K.el('div', {}); real.append(rc, rw); mountCalls(rc); mountReal(rw); mountToy(toy); show(true);
  }

  const api = { defaults, compute, realCompute, realCallsCompute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['kv_prompt_cache'] = api;
})(this);
