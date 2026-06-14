import { yearsDiff, fmtDate, NOW } from "./parser";

// Couleurs des projections retraite (sémantique : urgence décroissante)
const RETRAITE_COLORS = { red: "#dc2626", amber: "#d97706", purple: "#7c3aed", accent: "#3b82f6" };

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

  // ─── Mouvements mensuels ───
  const mLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const mvtByYear = {};
  all.forEach((e) => {
    [["dateEntree", "entrees"], ["dateSortie", "sorties"]].forEach(([f, k]) => {
      const dt = e[f];
      if (dt && dt.getFullYear() >= NOW.getFullYear() - 2) {
        const y = dt.getFullYear(), m = dt.getMonth();
        if (!mvtByYear[y]) mvtByYear[y] = mLabels.map((l) => ({ mois: l, entrees: 0, sorties: 0 }));
        mvtByYear[y][m][k]++;
      }
    });
  });

  // ─── Motifs de sortie ───
  const motifMap = {};
  all.filter((e) => e.dateSortie).forEach((e) => {
    motifMap[e.motifLabel] = (motifMap[e.motifLabel] || 0) + 1;
  });
  const motifData = Object.entries(motifMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ─── Turnover par établissement ───
  const turnoverByEtab = etabs.map((et) => {
    const s = all.filter((e) => e.etab === et.name && e.dateSortie && e.dateSortie.getFullYear() >= NOW.getFullYear() - 1).length;
    return { name: et.label, actifs: et.value, sorties: s, taux: et.value > 0 ? Math.round(s / (et.value + s) * 100) : 0 };
  }).sort((a, b) => b.taux - a.taux);

  // ─── Turnover annuel ───
  const turnoverAnnuel = Object.keys(mvtByYear).sort().map((y) => {
    const dd = mvtByYear[y];
    const e = dd.reduce((s, m) => s + m.entrees, 0);
    const s = dd.reduce((a, m) => a + m.sorties, 0);
    return { annee: y, entrees: e, sorties: s, taux: e + s > 0 ? Math.round(s / ((e + s) / 2) * 100) : 0 };
  });

  // ─── Géo ───
  const geoPoints = {};
  actifs.forEach((e) => {
    const v = e.ville;
    if (!v) return;
    // Carte géo supprimée — on garde le comptage par ville pour les analyses tabulaires.
    if (!geoPoints[v]) geoPoints[v] = { ville: v, count: 0, coords: null, etab: e.etab };
    geoPoints[v].count++;
  });
  const geoData = Object.values(geoPoints).filter((g) => g.coords).sort((a, b) => b.count - a.count);

  // ─── Retraite ───
  const retraiteDetail = [];
  actifs.forEach((e) => {
    if (!e.dateNaiss) return;
    const age = yearsDiff(e.dateNaiss, NOW);
    if (age >= 55) retraiteDetail.push({ age: Math.floor(age), etab: e.etab, ville: e.ville, sexe: e.sexe });
  });
  const retraiteByAge = {};
  retraiteDetail.forEach((r) => { retraiteByAge[r.age] = (retraiteByAge[r.age] || 0) + 1; });
  const retraiteChart = Object.entries(retraiteByAge).map(([age, count]) => ({ age: +age, count })).sort((a, b) => a.age - b.age);
  const retraiteProjection = [
    { horizon: "Déjà 64+", count: retraiteDetail.filter((r) => r.age >= 64).length, color: RETRAITE_COLORS.red },
    { horizon: "D'ici 2028 (60+)", count: retraiteDetail.filter((r) => r.age >= 60).length, color: RETRAITE_COLORS.amber },
    { horizon: "D'ici 2031 (57+)", count: retraiteDetail.filter((r) => r.age >= 57).length, color: RETRAITE_COLORS.purple },
    { horizon: "Tous 55+", count: retraiteDetail.length, color: RETRAITE_COLORS.accent },
  ];

  // ─── Ruptures ───
  const ruptures = all
    .filter((e) => e.dateSortie)
    .sort((a, b) => b.dateSortie - a.dateSortie);

  const ruptureYears = [...new Set(ruptures.map((e) => e.dateSortie.getFullYear()))].sort();

  const ruptCodeYearMap = {};
  ruptures.forEach((e) => {
    const label = e.motifLabel;
    const y = e.dateSortie.getFullYear();
    if (!ruptCodeYearMap[label]) ruptCodeYearMap[label] = {};
    ruptCodeYearMap[label][y] = (ruptCodeYearMap[label][y] || 0) + 1;
  });
  const rupturesByCodeYear = Object.entries(ruptCodeYearMap)
    .map(([label, years]) => ({ label, total: Object.values(years).reduce((s, v) => s + v, 0), ...years }))
    .sort((a, b) => b.total - a.total);

  // ─── Visites médicales ───
  const vmA = actifs.filter((e) => e.visiteDate);
  const vmE = vmA.filter((e) => e.visiteDate < NOW);

  // ─── Alertes ───
  const alertes = [];
  if (vmE.length > 0)
    alertes.push({ id: 1, type: "urgent", label: `${vmE.length} visites médicales expirées`, detail: `sur ${vmA.length} renseignées` });
  if (cdd > 0)
    alertes.push({ id: 2, type: "warning", label: `${cdd} CDD en cours`, detail: "Vérifier échéances" });
  const fp = n ? (femmes / n) * 100 : 0;
  if (fp > 65 || fp < 35)
    alertes.push({ id: 3, type: "warning", label: `Féminisation : ${fp.toFixed(1)}%`, detail: "Index égalité" });
  if (tp / n > 0.5)
    alertes.push({ id: 4, type: "warning", label: `${Math.round((tp / n) * 100)}% temps partiel`, detail: `${tp} salariés` });
  const ret64 = retraiteDetail.filter((r) => r.age >= 64).length;
  if (ret64 > 0)
    alertes.push({ id: 7, type: "urgent", label: `${ret64} salariés 64+`, detail: "Retraite imminente" });
  if (rqth > 0 && rqth / n < 0.06 && n >= 20)
    alertes.push({ id: 6, type: "warning", label: `RQTH ${((rqth / n) * 100).toFixed(1)}%`, detail: "Obligation 6%" });
  alertes.push({ id: 5, type: "info", label: `Ancienneté moy. : ${ancMoy.toFixed(1)} ans`, detail: `${ancBuckets[0].value} ont < 2 ans` });

  return {
    totalActifs: n, totalHistorique: all.length,
    femmes, hommes, cdi, cdd, tc, tp, rqth,
    masse, salMoy, hMoy, ancMoy,
    ageBuckets, ancBuckets, etabs, mvtByYear,
    vmTotal: vmA.length, vmExp: vmE.length, alertes,
    sexeData: [{ name: "Femmes", value: femmes }, { name: "Hommes", value: hommes }],
    contratData: [{ name: "CDI", value: cdi }, { name: "CDD", value: cdd }],
    tempsData: [{ name: "T. partiel", value: tp }, { name: "T. complet", value: tc }],
    availableYears: Object.keys(mvtByYear).sort().reverse(),
    motifData, turnoverByEtab, turnoverAnnuel, geoData,
    retraiteChart, retraiteProjection, retraiteCount: retraiteDetail.length,
    ruptures, ruptureYears, rupturesByCodeYear,
    employees: all,
  };
}

// ─── AI context builder ───
export function buildAIContext(d) {
  const actifs = d.employees.filter((e) => e.actif);
  const vmExpList = actifs.filter((e) => e.visiteDate && e.visiteDate < NOW).slice(0, 15).map((e) => `${e.nom} ${e.prenom} (${fmtDate(e.visiteDate)})`);
  const cddList = actifs.filter((e) => e.cdd).map((e) => `${e.nom} ${e.prenom}, Étab ${e.etab}, ${e.ville}`);
  const seniors = actifs.filter((e) => e.age && e.age >= 60).map((e) => `${e.nom} ${e.prenom}, ${e.age} ans, Étab ${e.etab}`);
  const etabSummary = d.etabs.map((e) => `Étab ${e.name} (${Object.entries(e.villes).sort((a, b) => b[1] - a[1])[0]?.[0] || "?"}): ${e.value} actifs, ${e.f}F/${e.h}H`);

  return `Tu es l'assistant IA du dashboard RH. Données actuelles :
EFFECTIF: ${d.totalActifs} actifs / ${d.totalHistorique} historique. ${d.femmes}F/${d.hommes}H. ${d.cdi} CDI, ${d.cdd} CDD. ${d.tp} TP, ${d.tc} TC. ${d.rqth} RQTH.
RÉMUNÉRATION: ${d.masse.toFixed(0)}€ masse, ${d.salMoy.toFixed(0)}€ moy, ${d.hMoy.toFixed(1)}h moy.
ANCIENNETÉ: ${d.ancMoy.toFixed(1)} ans. ${d.ancBuckets.map((b) => `${b.tranche}:${b.value}`).join(", ")}.
AGES: ${d.ageBuckets.map((b) => `${b.tranche}:${b.h + b.f}`).join(", ")}. ${d.retraiteCount} 55+.
ÉTABLISSEMENTS:\n${etabSummary.join("\n")}
MOTIFS: ${d.motifData.slice(0, 8).map((m) => `${m.name}:${m.value}`).join(", ")}
TURNOVER: ${d.turnoverAnnuel.map((t) => `${t.annee}:${t.entrees}E/${t.sorties}S`).join(", ")}
CDD: ${cddList.join("; ")}
SENIORS 60+: ${seniors.join("; ")}
VM EXPIRÉES: ${vmExpList.join("; ")}

SALARIÉS ACTIFS (${actifs.length}):
${actifs.map((e) => `${e.nom} ${e.prenom}|${e.sexe}|${e.age || "?"}a|Ét${e.etab}|${e.ville}|${e.cdd ? "CDD" : "CDI"}|${e.tempsComplet ? "TC" : "TP"}|${e.salaire || "?"}€|anc${e.anciennete || "?"}a|VM:${e.visiteDate ? fmtDate(e.visiteDate) : "—"}${e.handicap ? "|RQTH" : ""}`).join("\n")}

Réponds en français, concis, avec des chiffres précis.`;
}
