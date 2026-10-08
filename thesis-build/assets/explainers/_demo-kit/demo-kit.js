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
    /* slider(label, min, max, step, value, onInput) -> {node, get, set} */
    slider(label, min, max, step, value, on) {
      const out = K.el('span', { class: 'num' }, String(value));
      const inp = K.el('input', { type: 'range', min, max, step, value });
      inp.addEventListener('input', () => { out.textContent = inp.value; on(Number(inp.value)); });
      return { node: K.el('label', {}, label + ' ', inp, ' ', out), get: () => Number(inp.value), set: v => { inp.value = v; out.textContent = v; } };
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
