import { yearsDiff, NOW } from "./parser";

// Agrégats consommés par le moteur d'audit (referentiel/scoring) et la page Analyses.
export function computeMetrics(employees) {
  const actifs = employees.filter((e) => e.actif);
  const all = employees;
  const n = actifs.length;

  // ─── Effectifs ───
  const femmes = actifs.filter((e) => e.sexe === "Femme").length;
  const hommes = n - femmes;
  const cdi = actifs.filter((e) => !e.cdd).length;
  const cdd = n - cdi;
  const tc = actifs.filter((e) => e.tempsComplet).length;
  const tp = n - tc;
  const rqth = actifs.filter((e) => e.handicap).length;

  // ─── Rémunération ───
  const sals = actifs.map((e) => e.salaire).filter((v) => v != null && v > 0);
  const masse = sals.reduce((s, v) => s + v, 0);
  const salMoy = sals.length ? masse / sals.length : 0;
  const hrs = actifs.map((e) => e.heures).filter((v) => v != null && v > 0);
  const hMoy = hrs.length ? hrs.reduce((s, v) => s + v, 0) / hrs.length : 0;

  // ─── Pyramide des âges ───
  const ageBuckets = [
    { tranche: "< 25", lo: 0, hi: 25, h: 0, f: 0 },
    { tranche: "25-34", lo: 25, hi: 35, h: 0, f: 0 },
    { tranche: "35-44", lo: 35, hi: 45, h: 0, f: 0 },
    { tranche: "45-54", lo: 45, hi: 55, h: 0, f: 0 },
    { tranche: "55+", lo: 55, hi: 200, h: 0, f: 0 },
  ];
  actifs.forEach((e) => {
    if (!e.dateNaiss) return;
    const a = yearsDiff(e.dateNaiss, NOW);
    const b = ageBuckets.find((b) => a >= b.lo && a < b.hi);
    if (b) e.sexe === "Homme" ? b.h++ : b.f++;
  });

  // ─── Ancienneté ───
  const ancBuckets = [
    { tranche: "< 2 ans", lo: 0, hi: 2, value: 0 },
    { tranche: "2-5 ans", lo: 2, hi: 5, value: 0 },
    { tranche: "5-10 ans", lo: 5, hi: 10, value: 0 },
    { tranche: "10-20 ans", lo: 10, hi: 20, value: 0 },
    { tranche: "20+ ans", lo: 20, hi: 999, value: 0 },
  ];
  let tAnc = 0, nAnc = 0;
  actifs.forEach((e) => {
    if (!e.dateEntree) return;
    const a = yearsDiff(e.dateEntree, NOW);
    tAnc += a; nAnc++;
    const b = ancBuckets.find((b) => a >= b.lo && a < b.hi);
    if (b) b.value++;
  });
  const ancMoy = nAnc ? tAnc / nAnc : 0;

  // ─── Établissements ───
  const etabMap = {};
  actifs.forEach((e) => {
    const k = e.etab || "?";
    if (!etabMap[k]) etabMap[k] = { name: k, value: 0, f: 0, h: 0, cdi: 0, cdd: 0, villes: {} };
    etabMap[k].value++;
    e.sexe === "Femme" ? etabMap[k].f++ : etabMap[k].h++;
    e.cdd ? etabMap[k].cdd++ : etabMap[k].cdi++;
    if (e.ville) etabMap[k].villes[e.ville] = (etabMap[k].villes[e.ville] || 0) + 1;
  });
  const etabs = Object.values(etabMap).sort((a, b) => b.value - a.value);
  etabs.forEach((et) => {
    const tv = Object.entries(et.villes).sort((a, b) => b[1] - a[1])[0];
    et.label = tv ? `Étab. ${et.name} (${tv[0]})` : `Étab. ${et.name}`;
  });

  // ─── Mouvements mensuels (sur les 2 dernières années) → turnover annuel ───
  const mvtByYear = {};
  all.forEach((e) => {
    [["dateEntree", "entrees"], ["dateSortie", "sorties"]].forEach(([f, k]) => {
      const dt = e[f];
      if (dt && dt.getFullYear() >= NOW.getFullYear() - 2) {
        const y = dt.getFullYear(), m = dt.getMonth();
        if (!mvtByYear[y]) mvtByYear[y] = Array.from({ length: 12 }, () => ({ entrees: 0, sorties: 0 }));
        mvtByYear[y][m][k]++;
      }
    });
  });
  const turnoverAnnuel = Object.keys(mvtByYear).sort().map((y) => {
    const dd = mvtByYear[y];
    const entrees = dd.reduce((s, m) => s + m.entrees, 0);
    const sorties = dd.reduce((a, m) => a + m.sorties, 0);
    return { annee: y, entrees, sorties };
  });

  // ─── Motifs de sortie ───
  const motifMap = {};
  all.filter((e) => e.dateSortie).forEach((e) => {
    motifMap[e.motifLabel] = (motifMap[e.motifLabel] || 0) + 1;
  });
  const motifData = Object.entries(motifMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ─── Retraite (graphique par âge, 55+) ───
  const retraiteByAge = {};
  actifs.forEach((e) => {
    if (!e.dateNaiss) return;
    const age = Math.floor(yearsDiff(e.dateNaiss, NOW));
    if (age >= 55) retraiteByAge[age] = (retraiteByAge[age] || 0) + 1;
  });
  const retraiteChart = Object.entries(retraiteByAge)
    .map(([age, count]) => ({ age: +age, count }))
    .sort((a, b) => a.age - b.age);

  return {
    totalActifs: n, totalHistorique: all.length,
    femmes, hommes, cdi, cdd, tc, tp, rqth,
    masse, salMoy, hMoy, ancMoy,
    ageBuckets, ancBuckets, etabs,
    sexeData: [{ name: "Femmes", value: femmes }, { name: "Hommes", value: hommes }],
    contratData: [{ name: "CDI", value: cdi }, { name: "CDD", value: cdd }],
    tempsData: [{ name: "T. partiel", value: tp }, { name: "T. complet", value: tc }],
    motifData, turnoverAnnuel, retraiteChart,
    employees: all,
  };
}
