// Challenges page: renders D.challenges (see templates/challenges.html for where the data comes from).
// Persian: text comes from D.challenges_fa (i18n/fa/challenges.json), keyed by challenge id and "<for|against>:<atlas id>";
// a field without a translation is shown in English with a small «انگلیسی» tag. Quotes stay in the original
// language; the Persian gloss is shown under them.
(() => {
  const C = D.challenges, $ = id => document.getElementById(id), I = I18N, esc = I.esc;
  if (!C) { $("list").innerHTML = `<p class="note-box">${esc(t("ch.nodata"))}</p>`; return; }
  const F = I.fa ? (D.challenges_fa || {}) : {}, FC = F.challenges || {};
  const LV = {k12: [t("lv.k12"), "--k12"], he: [t("lv.he"), "--he"], both: [t("lv.both"), "--both"]};
  const RANK = ["causal", "measured", "small study", "correlational", "survey", "synthesis / guidance"];
  const tier = x => x === "—" ? x : I.fa ? (F.tier?.[x] || x) : x;
  const pdf = u => /\.pdf($|[?#])/i.test(u || "");
  // evidence keys, the same rule as the translation file: "<side>:<atlas or event id>", "#2" for a repeat in one column
  C.challenges.forEach(c => { const seen = new Set();
    for (const side of ["for", "against"]) for (const e of c[side]) { let k = `${side}:${e.atlas || e.event}`; if (seen.has(k)) k += "#2"; seen.add(k); e._k = k; e._fa = FC[c.id]?.evidence?.[k] || {}; } });
  const cf = c => FC[c.id] || {};
  const all = C.challenges.flatMap(c => [...c.for, ...c.against]);
  const sources = new Set(all.map(e => e.source).filter(Boolean));
  const nCh = C.challenges.filter(c => c.group === "challenge").length;
  $("stats").innerHTML = [[nCh, t("ch.st_ch")], [C.challenges.length - nCh, t("ch.st_ben")], [all.length, t("ch.st_links")],
    [sources.size, t("ch.st_src")], [all.filter(e => e.verified === false).length, t("ch.st_unv")]]
    .map(([b, s]) => `<div><b class="num">${b}</b><span>${esc(s)}</span></div>`).join("");
  $("framing").innerHTML = I.tx(C.note, F.note) + " " + esc(t("ch.asof", {d: I.dmy(C.asof)}));

  const best = c => { const r = [...c.for, ...c.against].map(e => RANK.indexOf(e.tier)).filter(i => i >= 0); return r.length ? RANK[Math.min(...r)] : "—"; };
  const short = s => s.split(/[:;]/)[0];
  let ov = "", grp = "";
  C.challenges.forEach(c => {
    if (c.group !== grp) { grp = c.group; ov += `<tr class="grp ${c.group}"><td colspan="5">${esc(grp === "challenge" ? t("nav.challenges") : t("ch.benefits"))}</td></tr>`; }
    ov += `<tr class="${c.group}"><td><a href="#c-${esc(c.id)}">${I.tx(c.title, cf(c).title)}</a></td><td class="n">${c.for.length}</td><td class="n">${c.against.length}</td>
      <td class="hide-m">${esc(tier(best(c)))}</td><td class="sev hide-m">${I.tx(short(c.severity), cf(c).severity && short(cf(c).severity))}</td></tr>`;
  });
  $("ov").tBodies[0].innerHTML = ov;

  function ev(e) {
    const lv = LV[e.level] || LV.both, f = e._fa;
    const src = e.source ? `<a href="${esc(e.source + (e.page && pdf(e.source) ? "#page=" + e.page : ""))}" target="_blank" rel="noopener">${esc(e.page ? t("ch.source_p", {p: e.page}) : t("ch.source"))} ↗</a>` : "";
    const tl = e.event ? `<a href="/thesis/timelines/world/edu-story.html#e-${encodeURIComponent(e.event)}">${esc(t("ch.on_tl"))}</a>` : "";
    const vendor = e.funding === "vendor";
    const quote = String(e.quote).replace(/^[“"]|[”"]$/g, "");
    const gloss = I.fa && f.quote_fa ? `<span class="gloss"><b>${esc(t("ch.gloss"))}</b>${esc(f.quote_fa)}</span>` : "";
    return `<li class="ev${vendor ? " vendor" : ""}" style="--c:var(${lv[1]})">
      ${e.value ? `<div class="v"><b>${I.val(e.value)}</b><span>${e.label ? I.tx(e.label, f.label) : ""}</span></div>` : `<div class="t">${I.tx(e.title, f.title)}</div>`}
      <q lang="en" dir="ltr">${esc(quote)}</q>${gloss}
      <div class="meta"><span><span lang="en" dir="ltr">${esc(e.who)}</span> · ${esc(I.date(e.date))}</span><span class="tag lv">${esc(lv[0])}</span><span class="tag" title="${esc(t("ch.study_t"))}">${esc(I.fa ? (F.study?.[e.study] || e.study || "") : e.study || "")}</span>
        ${e.funding ? `<span class="tag" title="${esc(t("ch.funding_t"))}">${esc(I.fa ? (F.funding?.[e.funding] || e.funding) : e.funding)}</span>` : ""}
        ${e.verified === false ? `<span class="tag warn" title="${esc(t("ch.unv_t"))}">${esc(t("ch.unv"))}</span>` : ""}
        ${e.ours ? `<span class="tag ours" title="${esc(t("ch.ours_t"))}">${esc(t("ch.ours"))}</span>` : ""}</div>
      ${e.caveat ? `<div class="cav">${I.tx(e.caveat, f.caveat)}</div>` : ""}
      <div class="links">${src}${tl}</div></li>`;
  }
  const SHOW = 5;
  // strongest study type first, then newest; unverified items sink within their tier
  const order = items => [...items].sort((a, b) => (RANK.indexOf(a.tier) - RANK.indexOf(b.tier)) || ((a.verified === false) - (b.verified === false)) || String(b.date).localeCompare(String(a.date)));
  const showAll = n => t("ch.show_all", {n});
  function col(title, items, emptyMsg) {
    items = order(items);
    const lis = items.map((e, i) => ev(e).replace("<li ", i >= SHOW ? "<li hidden " : "<li ")).join("");
    return `<div class="col"><h3>${esc(title)}<span class="num">${items.length}</span></h3>${items.length ? `<ul class="evs">${lis}</ul>` : `<p class="none">${esc(emptyMsg)}</p>`}
      ${items.length > SHOW ? `<button class="btn more" aria-expanded="false">${esc(showAll(items.length))}</button>` : ""}</div>`;
  }
  let n = 0;
  $("list").innerHTML = C.challenges.map(c => {
    const k = c.group === "challenge" ? t("ch.eyebrow_ch", {n: String(++n).padStart(2, "0")}) : t("ch.eyebrow_ben");
    const x = cf(c);
    return `<article class="ch ${c.group}" id="c-${esc(c.id)}" aria-labelledby="h-${esc(c.id)}">
      <div class="eyebrow">${esc(k)}</div><h2 id="h-${esc(c.id)}">${I.tx(c.title, x.title)}</h2>
      <p class="claim"><b>${esc(t("ch.the_claim"))}</b> ${I.tx(c.claim, x.claim)}</p>
      <p class="summary">${I.tx(c.summary, x.summary)}</p>
      <p class="sev-line"><span>${esc(t("ch.th_big"))}</span>${I.tx(c.severity, x.severity)}</p>
      <div class="means"><b>${esc(t("ch.means"))}</b>${I.tx(c.means, x.means)} <small>${esc(t("ch.our_reading"))}</small></div>
      <div class="cols">${col(t("ch.ev_for"), c.for, t("ch.none_for"))}${col(t("ch.ev_against"), c.against, t("ch.none_against"))}</div>
      <a class="back" href="#ov">${esc(t("ch.back"))}</a>
    </article>`;
  }).join("");

  document.addEventListener("click", ev => {
    const b = ev.target.closest(".more"); if (!b) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.closest(".col").querySelectorAll("li.ev").forEach((li, i) => { if (i >= SHOW) li.hidden = !open; });
    b.setAttribute("aria-expanded", open); b.textContent = open ? t("ch.show_fewer") : showAll(b.closest(".col").querySelectorAll("li.ev").length);
  });
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    document.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
    document.body.classList.remove("only-challenge", "only-impact");
    if (b.dataset.g !== "all") document.body.classList.add("only-" + b.dataset.g);
    count();
  });
  $("novendor").onclick = () => { const on = $("novendor").getAttribute("aria-pressed") !== "true";
    $("novendor").setAttribute("aria-pressed", on); document.body.classList.toggle("novendor", on); count(); };
  // live count of what the filters leave visible (flashes on change via the site header)
  function count() {
    const g = document.body.classList.contains("only-challenge") ? "challenge" : document.body.classList.contains("only-impact") ? "impact" : null;
    const nov = document.body.classList.contains("novendor");
    const cs = C.challenges.filter(c => !g || c.group === g);
    const ne = cs.flatMap(c => [...c.for, ...c.against]).filter(e => !nov || e.funding !== "vendor").length;
    $("ccount").textContent = t("ch.count", {a: cs.length, b: C.challenges.length, c: ne, d: all.length});
  }
  count();
  $("foot").innerHTML = esc(t("ch.foot_src")) + " " + I.tx(C.source, F.source) + ". " + esc(t("ch.foot"));
})();
