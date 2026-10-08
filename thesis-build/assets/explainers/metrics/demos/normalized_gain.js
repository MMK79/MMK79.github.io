/* Hake normalised gain. TOY ONLY: real example pending, no pre/post data exists (the classroom study does not exist yet). All classes below are invented. */
(function (root) {
  const defaults = { pre: 40, post: 70, max: 100 };

  /* PURE: g = (post - pre) / (max - pre), with class means. NaN when pre >= max (nothing left to gain). */
  function compute(inp) { return inp.max > inp.pre ? (inp.post - inp.pre) / (inp.max - inp.pre) : NaN; }
  const band = g => !Number.isFinite(g) ? 'undefined' : g >= 0.7 ? 'high' : g >= 0.3 ? 'medium' : 'low';

  function bars(host, arms, max) {
    const K = root.DemoKit, W = 560, H = 190, bw = 34, gap = 34;
    const svg = K.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:600px', role: 'img', 'aria-label': 'pre-test and post-test class means for each arm' });
    const Y = v => 160 - (Math.max(0, Math.min(max, v)) / max) * 130;
    svg.append(K.svg('line', { x1: 20, x2: W - 10, y1: Y(max), y2: Y(max), stroke: '#68707F', 'stroke-dasharray': '4 3' }), K.svg('text', { x: W - 12, y: Y(max) - 4, 'text-anchor': 'end', style: 'fill:#68707F' }, 'maximum ' + max));
    arms.forEach((a, i) => {
      const x0 = 40 + i * (2 * bw + gap + 90);
      svg.append(K.svg('rect', { x: x0, y: Y(a.pre), width: bw, height: 160 - Y(a.pre), fill: '#7C9CFF', rx: 3 }), K.svg('rect', { x: x0 + bw + 4, y: Y(a.post), width: bw, height: 160 - Y(a.post), fill: '#3CC7B4', rx: 3 }),
        K.svg('rect', { x: x0 + bw + 4, y: Y(max), width: bw, height: Y(a.post) - Y(max), fill: 'none', stroke: '#68707F', 'stroke-dasharray': '3 3', rx: 3 }),
        K.svg('text', { x: x0 + bw, y: 178, 'text-anchor': 'middle' }, a.name), K.svg('text', { x: x0 + bw / 2, y: Y(a.pre) - 4, 'text-anchor': 'middle' }, String(a.pre)), K.svg('text', { x: x0 + bw * 1.5 + 4, y: Y(a.post) - 4, 'text-anchor': 'middle' }, String(a.post)));
    });
    svg.append(K.svg('text', { x: 20, y: 14, style: 'fill:#98A0B0' }, 'blue: pre-test mean   green: post-test mean   dashed: room left to gain'));
    host.replaceChildren(svg);
  }

  function mount(el) {
    const K = root.DemoKit;
    const banner = K.el('p', { class: 'hint bad' }, 'Real example pending: no pre/post data exists in the pack, because the classroom study does not exist yet. Everything below is an invented class, to show how the formula behaves.');
    const shell = K.shell(el, 'Toy example (break it): three invented arms',
      'Hake gain is the share of the possible improvement that the class achieved: (post - pre) / (max - pre). Drag the pre-test and post-test means of each invented arm.');
    el.insertBefore(banner, shell);
    const st = { max: 100, arms: [{ name: 'Tutor', pre: 40, post: 70 }, { name: 'Control', pre: 40, post: 55 }, { name: 'Strong class', pre: 85, post: 92 }] };
    const host = K.el('div'), out = K.el('div'), formula = K.el('div', { class: 'formula', 'aria-live': 'polite' }), note = K.el('p', { class: 'hint' }), sl = [];
    const rows = K.el('div');
    st.arms.forEach((a, i) => {
      const s1 = K.slider(a.name + ' pre', 0, 100, 1, a.pre, v => { a.pre = v; render(); }), s2 = K.slider('post', 0, 100, 1, a.post, v => { a.post = v; render(); });
      sl.push([s1, s2]); rows.append(K.el('div', { class: 'row' }, s1.node, s2.node));
    });
    const btn = (t, f) => K.el('button', { type: 'button', onclick: f }, t);
    const set = v => { st.arms.forEach((a, i) => { a.pre = v[i][0]; a.post = v[i][1]; sl[i][0].set(a.pre); sl[i][1].set(a.post); }); render(); };
    shell.append(host, rows, K.el('div', { class: 'row' }, btn('Worked example (40 to 70)', () => set([[40, 70], [40, 55], [85, 92]])),
      btn('Break it: ceiling, 90 to 95 equals 40 to 70', () => set([[40, 70], [90, 95], [85, 92]])),
      btn('Break it: pre-test 100, nothing to gain', () => set([[40, 70], [100, 100], [85, 92]])),
      btn('Class got worse', () => set([[40, 70], [60, 50], [85, 92]]))), out, formula, note);
    function render() {
      bars(host, st.arms, st.max);
      const fm = x => Number.isFinite(x) ? K.fmt(x, 3) : 'undefined';
      out.replaceChildren(K.el('div', { class: 'row' }, ...st.arms.map(a => { const g = compute({ pre: a.pre, post: a.post, max: st.max });
        return K.el('div', {}, K.el('span', { class: 'hint' }, a.name + ' g'), K.el('div', { class: 'result num', style: g < 0 ? 'color:var(--warn)' : '' }, fm(g)), K.el('span', { class: 'hint' }, band(g) + ' gain')); })));
      formula.textContent = st.arms.map(a => `${a.name}: g = (${a.post} - ${a.pre}) / (${st.max} - ${a.pre}) = ${fm(compute({ pre: a.pre, post: a.post, max: st.max }))}`).join('\n');
      const [t, c, s] = st.arms.map(a => compute({ pre: a.pre, post: a.post, max: st.max }));
      note.className = 'hint';
      if (!Number.isFinite(c) || !Number.isFinite(t)) { note.textContent = 'A class that starts at the maximum has nothing left to gain: g is undefined.'; note.className = 'hint bad'; }
      else if (Math.abs(t - c) < 0.01 && st.arms[0].pre !== st.arms[1].pre) { note.textContent = 'Same g, very different classes: 5 points from 90 and 30 points from 40 look equal. g hides the starting level, and it is sensitive to ceiling effects and to how hard the test is.'; note.className = 'hint bad'; }
      else if (t < 0 || c < 0) { note.textContent = 'Negative g: the class scored lower after the intervention. g is not bounded below.'; note.className = 'hint bad'; }
      else note.textContent = 'Bands often quoted from Hake 1998: low below 0.3, medium 0.3 to 0.7, high above 0.7 (from memory, unverified here). g needs a control arm to say anything causal; the offline proxies (faithfulness, pedagogy) only predict it.';
    }
    render();
  }

  const api = { defaults, compute, mount };
  if (typeof module !== 'undefined') module.exports = api; else (root.DEMOS ||= {})['normalized_gain'] = api;
})(this);
