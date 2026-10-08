/* Shared page-layout module (opt-in per page). Plain JS, no libraries. Pair: layout.css.
   Vertical page only: NO columns, NO sideways scrolling, NO wheel/key hijack (changed 2026-10-07; the first version, commit 79d9c85,
   used scrolling newspaper columns and a column-width slider; those, the .hx-on class, the scrolling table box and the
   hx.region/width/hint/table i18n keys are gone).

   HTML CONTRACT (unchanged names; only data-hx-priority is new)
   - Page:    <link rel="stylesheet" href="/thesis/assets/layout.css"> in <head>, <script src="/thesis/assets/layout.js"></script> at the
              END of <body> (after any script that builds the content). Content root: <main class="hx"> (one per page);
              .hx is a normal block, max-width 1180px like site.css main.
   - Section: <section data-hx-section id="unique-id"> directly inside .hx (ids are the storage keys; siblings are reordered
              among themselves). The first h1/h2/h3 child stays visible when collapsed. Optional data-hx-title overrides the label.
   - Table:   <table data-hx-table [id="x"]> with a <thead> of single-row <th> and a <tbody> (no colspan/rowspan). Optional:
              <th data-hx-nosort>, <td data-sort="123"> (sort key), <th data-hx-keep> (column cannot be hidden),
              <th data-hx-priority="low"> (hidden by default when the table does not fit, and on phones).
              Tables added later: call HX.initTable(tableEl). Re-scan: HX.refresh().
   - A <footer> after .hx is left alone (normal page flow).

   WHAT IT DOES
   - Toolbar (built here, before .hx): "Reset layout" only (clears saved order, collapsed sections, column choices).
   - Sections: collapse (aria-expanded), move earlier/later buttons (aria-disabled at the ends), drag handle (HTML5 drag; dropping
     on the upper half of a section puts the dragged one before it, on the lower half after it). A polite live region announces moves.
   - Tables: text wraps, the table is always 100% of the container width, the page never scrolls sideways. A "Columns (shown/total)"
     picker hides columns. Default (until the reader changes the picker): if the table is wider than its container, columns marked
     data-hx-priority="low" are hidden; if it still does not fit, the right-most non-keep columns are hidden one by one (at least two
     columns stay). On phones (<= 720px) the table becomes stacked cards (one card per row, each cell labelled by its header, the
     header row becomes a row of sort buttons) and low-priority columns are hidden by default. Header buttons sort (numeric-aware incl.
     Persian digits; asc -> desc -> original; th[aria-sort]).
   - State (localStorage, always try/catch, page works without it): hx:<path>:order, hx:<path>:collapsed, hx:<path>#<tableId>:hidden
     (only written when the reader touches the picker; a table without id keeps its choice in memory only).
   - i18n: strings come from t("hx.*"). RTL works through logical CSS properties. prefers-reduced-motion: no smooth scrolling.
     Limit: the browser decides the drag image; drag is mouse/pen only, touch and keyboard users use the up/down buttons. */
(() => {
  const root = document.querySelector("main.hx, .hx");
  if (!root) return;
  const T = (k, v) => (window.t ? window.t(k, v) : k);
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const PHONE = matchMedia("(max-width: 720px)");
  const path = location.pathname;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const K = {order: `hx:${path}:order`, coll: `hx:${path}:collapsed`};
  const dg = s => (window.I18N && I18N.fa ? I18N.digits(String(s)) : String(s));

  const live = document.createElement("div");
  live.className = "hx-live"; live.setAttribute("aria-live", "polite"); live.setAttribute("role", "status");
  document.body.appendChild(live);
  const say = s => { live.textContent = ""; setTimeout(() => { live.textContent = s; }, 30); };

  // ---------- toolbar ----------
  const bar = document.createElement("div");
  bar.className = "hx-bar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", T("hx.toolbar"));
  bar.innerHTML = `<button type="button" class="btn hx-reset"></button>`;
  root.parentNode.insertBefore(bar, root);
  bar.querySelector(".hx-reset").textContent = T("hx.reset");

  // ---------- sections: collapse, reorder, drag ----------
  const secs = () => [...root.querySelectorAll(":scope > section[data-hx-section]")];
  const title = s => s.dataset.hxTitle || (s.querySelector("h1,h2,h3")?.textContent || s.id).trim();
  const saveOrder = () => store.set(K.order, secs().map(s => s.id));
  const saveColl = () => store.set(K.coll, secs().filter(s => s.classList.contains("hx-collapsed")).map(s => s.id));
  function applyOrder() {
    const ids = store.get(K.order); if (!Array.isArray(ids)) return;
    const list = secs(), rank = s => { const i = ids.indexOf(s.id); return i < 0 ? 1e6 + list.indexOf(s) : i; };
    const marks = list.map(s => { const m = document.createComment(""); s.before(m); return m; });
    [...list].sort((a, b) => rank(a) - rank(b)).forEach((s, i) => { marks[i].replaceWith(s); });
  }
  function refreshCtl() {
    const list = secs();
    list.forEach((s, i) => {
      s.querySelector(".hx-up")?.setAttribute("aria-disabled", String(i === 0));
      s.querySelector(".hx-down")?.setAttribute("aria-disabled", String(i === list.length - 1));
    });
  }
  function move(s, by, btnClass) {
    const list = secs(), i = list.indexOf(s), j = i + by;
    if (j < 0 || j >= list.length) return;
    by < 0 ? list[j].before(s) : list[j].after(s);
    saveOrder(); refreshCtl();
    say(T("hx.moved", {title: title(s), n: dg(j + 1), m: dg(list.length)}));
    s.querySelector("." + btnClass)?.focus({preventScroll: true});
    s.scrollIntoView({block: "nearest", behavior: RM.matches ? "auto" : "smooth"});
  }
  function setCollapsed(s, on, save) {
    s.classList.toggle("hx-collapsed", on);
    const b = s.querySelector(".hx-fold");
    if (b) { b.setAttribute("aria-expanded", String(!on)); b.textContent = on ? "▸" : "▾";
      const l = T(on ? "hx.expand" : "hx.collapse", {title: title(s)}); b.title = l; b.setAttribute("aria-label", l); }
    if (save) saveColl();
  }
  let dragged = null;
  function decorate(s) {
    if (s.querySelector(":scope > .hx-sec-head")) return;
    const h = s.querySelector(":scope > h1,:scope > h2,:scope > h3");
    const head = document.createElement("div"); head.className = "hx-sec-head";
    const ctl = document.createElement("div"); ctl.className = "hx-sec-ctl"; ctl.setAttribute("role", "group");
    ctl.setAttribute("aria-label", T("hx.sec_ctl", {title: title(s)}));
    const mk = (cls, txt, label) => { const b = document.createElement("button"); b.type = "button"; b.className = cls;
      b.textContent = txt; b.title = label; b.setAttribute("aria-label", label); return b; };
    const drag = mk("hx-drag", "⠿", T("hx.drag", {title: title(s)})); drag.draggable = true;
    const up = mk("hx-up", "▲", T("hx.up", {title: title(s)})), down = mk("hx-down", "▼", T("hx.down", {title: title(s)})), fold = mk("hx-fold", "▾", "");
    ctl.append(drag, up, down, fold);
    if (h) { h.before(head); head.append(h, ctl); } else { s.prepend(head); head.append(document.createElement("span"), ctl); }
    up.onclick = () => move(s, -1, "hx-up"); down.onclick = () => move(s, 1, "hx-down");
    fold.onclick = () => setCollapsed(s, !s.classList.contains("hx-collapsed"), true);
    drag.addEventListener("dragstart", e => { dragged = s; s.classList.add("hx-dragging");
      e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.setDragImage(head, 10, 10); } catch (x) {} });
    drag.addEventListener("dragend", () => { dragged = null; secs().forEach(x => x.classList.remove("hx-dragging", "hx-over")); });
    s.addEventListener("dragover", e => { if (dragged && dragged !== s) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; s.classList.add("hx-over"); } });
    s.addEventListener("dragleave", e => { if (!s.contains(e.relatedTarget)) s.classList.remove("hx-over"); });
    s.addEventListener("drop", e => { if (!dragged || dragged === s) return; e.preventDefault(); s.classList.remove("hx-over");
      const list = secs(), r = s.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) s.before(dragged); else s.after(dragged);
      saveOrder(); refreshCtl();
      say(T("hx.moved", {title: title(dragged), n: dg(secs().indexOf(dragged) + 1), m: dg(list.length)})); });
  }
  applyOrder();
  secs().forEach(decorate);
  const collapsed = store.get(K.coll) || [];
  secs().forEach(s => setCollapsed(s, collapsed.includes(s.id), false));
  refreshCtl();

  bar.querySelector(".hx-reset").onclick = () => {
    store.del(K.order); store.del(K.coll);
    root.querySelectorAll("table[data-hx-table][id]").forEach(t => store.del(`hx:${path}#${t.id}:hidden`));
    location.reload();
  };

  // ---------- tables ----------
  const FD = "۰۱۲۳۴۵۶۷۸۹", AD = "٠١٢٣٤٥٦٧٨٩";
  const latin = s => s.replace(/[۰-۹]/g, d => FD.indexOf(d)).replace(/[٠-٩]/g, d => AD.indexOf(d)).replace(/٫/g, ".")
    .replace(/[٬،,\s %$€£≈~]/g, "").replace(/[−–]/g, "-");
  const num = s => { const x = latin(String(s)); return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(x) ? parseFloat(x) : NaN; };
  function initTable(tb) {
    if (tb.dataset.hxInit) return;
    const ths = [...(tb.tHead?.rows[0]?.cells || [])], body = tb.tBodies[0];
    if (!ths.length || !body) return;
    tb.dataset.hxInit = "1";
    const wrap = document.createElement("div"); wrap.className = "hx-twrap";
    tb.before(wrap); wrap.append(tb);
    const orig = [...body.rows];
    ths.forEach((th, c) => { const lab = th.textContent.trim(); orig.forEach(r => r.cells[c]?.setAttribute("data-label", lab)); });
    ths.forEach((th, c) => {                                                // sorting
      if (th.hasAttribute("data-hx-nosort")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "hx-sort";
      while (th.firstChild) b.appendChild(th.firstChild);
      const name = b.textContent.trim();
      const a = document.createElement("span"); a.className = "hx-arrow"; a.setAttribute("aria-hidden", "true"); b.appendChild(a);
      b.title = T("hx.sort", {col: name}); th.appendChild(b); th.setAttribute("aria-sort", "none");
      b.onclick = () => {
        const cur = th.getAttribute("aria-sort"), nxt = cur === "none" ? "ascending" : cur === "ascending" ? "descending" : "none";
        ths.forEach(o => o.hasAttribute("aria-sort") && o.setAttribute("aria-sort", "none")); th.setAttribute("aria-sort", nxt);
        const rows = orig.slice();
        if (nxt !== "none") {
          const dir = nxt === "ascending" ? 1 : -1, key = r => { const td = r.cells[c]; return td ? (td.dataset.sort ?? td.textContent).trim() : ""; };
          const empty = v => v === "" || v === "—";
          rows.sort((r1, r2) => { const x = key(r1), y = key(r2);
            if (empty(x)) return empty(y) ? 0 : 1;                          // empty cells always last
            if (empty(y)) return -1;
            const nx = num(x), ny = num(y);
            return dir * (!isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, document.documentElement.lang, {numeric: true, sensitivity: "base"})); });
        }
        rows.forEach(r => body.appendChild(r));
        say(T("hx.sorted", {col: name, dir: T("hx.dir_" + nxt)}));
      };
    });
    // column picker + default fit
    const sk = `hx:${path}#${tb.id}:hidden`, saved = tb.id ? store.get(sk) : null;
    let touched = Array.isArray(saved);
    const hidden = new Set(touched ? saved : []);
    const keep = i => ths[i].hasAttribute("data-hx-keep");
    const cbs = [];
    const sum = document.createElement("summary");
    const show = () => { [...tb.rows].forEach(r => [...r.cells].forEach((cell, i) => cell.classList.toggle("hx-hidecol", hidden.has(i))));
      cbs.forEach((cb, i) => { if (cb) cb.checked = !hidden.has(i); });
      sum.textContent = `${T("hx.columns")} (${dg(ths.length - hidden.size)}/${dg(ths.length)})`; };
    const overflows = () => tb.scrollWidth > wrap.clientWidth + 1;
    const autoFit = () => {
      if (touched) return;
      hidden.clear(); show();
      const lows = ths.map((th, i) => i).filter(i => ths[i].dataset.hxPriority === "low" && !keep(i));
      if (PHONE.matches) { lows.forEach(i => hidden.add(i)); show(); return; }       // cards: priority columns only
      if (!overflows()) return;
      lows.forEach(i => hidden.add(i)); show();
      for (let i = ths.length - 1; i >= 0 && overflows() && ths.length - hidden.size > 2; i--)
        if (!hidden.has(i) && !keep(i)) { hidden.add(i); show(); }
    };
    const det = document.createElement("details"); det.className = "hx-cols";
    det.appendChild(sum);
    const box = document.createElement("div"); box.className = "hx-colbox"; box.setAttribute("role", "group");
    box.setAttribute("aria-label", T("hx.columns")); det.appendChild(box);
    ths.forEach((th, i) => {
      if (keep(i)) { cbs.push(null); return; }
      const l = document.createElement("label"), cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !hidden.has(i);
      cb.onchange = () => { touched = true; if (cb.checked) hidden.delete(i); else hidden.add(i);
        show(); if (tb.id) store.set(sk, [...hidden]); };
      cbs.push(cb); l.append(cb, document.createTextNode(th.textContent.trim())); box.appendChild(l);
    });
    const tools = document.createElement("div"); tools.className = "hx-ttools"; tools.appendChild(det);
    wrap.before(tools); show(); autoFit();
    let tm; addEventListener("resize", () => { clearTimeout(tm); tm = setTimeout(autoFit, 120); });
    document.fonts?.ready.then(autoFit);
    tb._hxFit = autoFit;
  }
  const refresh = () => root.querySelectorAll("table[data-hx-table]").forEach(initTable);
  refresh();
  window.HX = {initTable, refresh, root};
})();
