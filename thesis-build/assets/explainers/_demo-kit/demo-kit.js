/* Tiny helpers for demos (no framework). Browser only: demos keep compute() pure so node can test it. */
(function (root) {
  const K = {
    el(tag, attrs = {}, ...kids) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
      for (const c of kids.flat()) e.append(c instanceof Node ? c : document.createTextNode(c));
      return e;
    },
    svg(tag, attrs = {}, ...kids) {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      for (const c of kids.flat()) e.append(c instanceof Node ? c : document.createTextNode(c));
      return e;
    },
    /* arrow(svg, x1, y1, x2, y2, {color, width, r1, r2, curve, head, opacity, dash}) -> <g>
       Directed edge: each end is pulled back to the node radius (r1 at the tail, r2 at the head) so the head is never hidden
       under a node; `curve` bends it (fraction of the length, sign = side) and the head follows the end tangent. Own
       userSpaceOnUse marker (head size ignores stroke width, survives svg.replaceChildren), id unique per page. svg=null: just return the <g>. */
    arrow(svg, x1, y1, x2, y2, o = {}) {
      const col = o.color || 'currentColor', w = o.width || 2, head = o.head || 9, r1 = o.r1 || 0, r2 = o.r2 || 0, curve = o.curve || 0;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const cx = (x1 + x2) / 2 + nx * curve * L, cy = (y1 + y2) / 2 + ny * curve * L;
      const tx = curve ? cx - x1 : dx, ty = curve ? cy - y1 : dy, tl = Math.hypot(tx, ty) || 1;     /* tail tangent */
      const ex = curve ? x2 - cx : dx, ey = curve ? y2 - cy : dy, el = Math.hypot(ex, ey) || 1;      /* head tangent */
      const sx = x1 + tx / tl * r1, sy = y1 + ty / tl * r1, tipx = x2 - ex / el * r2, tipy = y2 - ey / el * r2;
      const hl = Math.max(0, Math.min(head, Math.hypot(tipx - sx, tipy - sy) * 0.9));   /* shaft stops at the head base: a wide stroke never pokes out beside the tip */
      const fx = tipx - ex / el * hl, fy = tipy - ey / el * hl;
      const id = 'dk-ah-' + (K._aid = (K._aid || 0) + 1);   /* page-unique, so two mounted demos never share a marker */
      const g = K.svg('g', {}, K.svg('defs', {}, K.svg('marker', { id, viewBox: '0 0 10 10', refX: 0, refY: 5, markerWidth: hl || head, markerHeight: hl || head, markerUnits: 'userSpaceOnUse', orient: 'auto' },
        K.svg('path', { d: 'M0,1 L10,5 L0,9 z', fill: col }))));
      const d = curve ? `M${sx},${sy} Q${cx},${cy} ${fx},${fy}` : `M${sx},${sy} L${fx},${fy}`;
      const path = K.svg('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'butt', 'marker-end': `url(#${id})` });
      if (o.dash) path.setAttribute('stroke-dasharray', o.dash);
      if (o.opacity !== undefined) path.setAttribute('opacity', o.opacity);
      g.append(path); if (svg) svg.append(g);
      return g;
    },
    /* slider(label, min, max, step, value, onInput) -> {node, get, set} */
    slider(label, min, max, step, value, on) {
      const dec = (String(step).split('.')[1] || '').length, show = v => (Number.isFinite(Number(v)) ? Number(Number(v).toFixed(dec)) : v);   // readout at the step's precision (a log10 value must not print 2.1398759864012365)
      const out = K.el('span', { class: 'num' }, String(show(value)));
      const inp = K.el('input', { type: 'range', min, max, step, value });
      inp.addEventListener('input', () => { out.textContent = String(show(inp.value)); on(Number(inp.value)); });
      return { node: K.el('label', {}, label + ' ', inp, ' ', out), get: () => Number(inp.value), set: v => { inp.value = v; out.textContent = String(show(v)); } };
    },
    /* flash(node): highlight a value that just changed */
    flash(node) { node.classList.add('changed'); setTimeout(() => node.classList.remove('changed'), 900); },
    fmt(x, d = 3) { return Number.isFinite(x) ? String(+x.toFixed(d)) : String(x); },
    /* resultBox: shows a number and flashes it when it changes */
    resultBox() {
      const n = K.el('div', { class: 'result num' }); let last;
      return { node: n, set(v, d = 3) { const s = K.fmt(v, d); if (s !== last) { n.textContent = s; if (last !== undefined) K.flash(n); last = s; } } };
    },
    /* shell(title, hint) -> {root, body} appended into el */
    shell(el, title, hint) {
      const root = K.el('div', { class: 'demo' }, K.el('h3', {}, title), K.el('p', { class: 'hint' }, hint || ''));
      el.append(root); return root;
    },
  };
  root.DemoKit = K;
})(typeof window !== 'undefined' ? window : globalThis);
