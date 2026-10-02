// Home page: the latest primary-school students-per-teacher map, linked to the full map page.
window.__mini = (PV, K) => {
  const years = K.years.filter(y => y.n_provinces > 0).map(y => y.year_sh), y = years[years.length - 1];
  const v = c => K.data[y]?.[c]?.primary?.total?.students_per_teacher;
  const vals = PV.provinces.map(p => v(p.code)).filter(x => x != null).sort((a, b) => a - b);
  const ramp = ["#1B2244", "#26336E", "#34489B", "#4D66C9", "#7C9CFF", "#B9C8FF"];
  const qs = ramp.slice(1).map((_, i) => vals[Math.floor((i + 1) / ramp.length * (vals.length - 1))]);
  const col = x => x == null ? "#161B25" : ramp[qs.filter(q => x > q).length];
  const fig = document.getElementById("mini");
  const a = document.createElement("a"); a.href = "/thesis/iran-map.html"; a.setAttribute("aria-label", t("home.mini_aria"));
  a.innerHTML = `<svg viewBox="${PV.viewBox.join(" ")}">${PV.provinces.map(p => `<path d="${p.path}" fill="${col(v(p.code))}" stroke="#0B0D12" stroke-width="1.2" fill-rule="evenodd"/>`).join("")}</svg>`;
  fig.prepend(a);
  const nat = K.data[y]?.IRN?.primary?.total?.students_per_teacher;
  const hi = PV.provinces.map(p => [I18N.fa ? p.name_fa : p.name_en, v(p.code)]).filter(r => r[1] != null).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("minicap").innerHTML = t("home.mini_cap", {y: `${y}–${String(y + 1).slice(-2)}`, nat: nat?.toFixed(1), prov: I18N.esc(hi[0]), v: hi[1].toFixed(1)});
};
