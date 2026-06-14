import { STATUS, SEUILS, MOTIFS_MALADIE, MOTIFS_AT_MP, JOURS_OUVRES_MOIS } from "./constants";

// ─────────────── SANTÉ, SÉCURITÉ & ABSENTÉISME (DSN) ───────────────
export const santeCriteria = [
  {
    id: "absenteisme-maladie",
    domain: "sante",
    label: "Taux d'absentéisme maladie (sur le mois DSN)",
    legalRef: "Indicateur Bilan social — source DSN bloc 60. Moyenne nationale ≈ 5%",
    requiredFields: [], // gating custom : présence de données DSN
    evaluate({ seuils = SEUILS, actifs }) {
      const avecDsn = actifs.filter((e) => e.dsn);
      if (avecDsn.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucune DSN importée — importez une DSN pour activer ce domaine",
          threshold: `≤ ${seuils.absenteisme.vigilance}%`,
          evidence: [],
        };
      let joursMaladieCal = 0;
      const concernes = [];
      avecDsn.forEach((e) => {
        const j = (e.dsn.arrets || []).filter((a) => MOTIFS_MALADIE.has(a.motif)).reduce((s, a) => s + (a.jours || 0), 0);
        if (j > 0) { joursMaladieCal += j; concernes.push(e); }
      });
      // Conversion jours calendaires → jours ouvrés (≈ 5/7)
      const joursOuvres = joursMaladieCal * (5 / 7);
      const n = avecDsn.length;
      const taux = n ? (joursOuvres / (n * JOURS_OUVRES_MOIS)) * 100 : 0;
      const status = taux <= seuils.absenteisme.vigilance ? STATUS.conforme
        : taux <= seuils.absenteisme.alerte ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: taux,
        valueLabel: `${taux.toFixed(1)}% sur le mois (${Math.round(joursMaladieCal)} j maladie · ${concernes.length} salarié${concernes.length > 1 ? "s" : ""} sur ${n} couverts par la DSN)`,
        threshold: `≤ ${seuils.absenteisme.vigilance}%`,
        evidence: concernes,
      };
    },
  },
  {
    id: "accidents-travail",
    domain: "sante",
    label: "Accidents du travail & maladies professionnelles (sur le mois DSN)",
    legalRef: "Art. L.4121-1 C. trav. — source DSN bloc 60 (motifs 05/06/07)",
    requiredFields: [],
    evaluate({ seuils = SEUILS, actifs }) {
      const avecDsn = actifs.filter((e) => e.dsn);
      if (avecDsn.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucune DSN importée",
          threshold: "0 AT/MP",
          evidence: [],
        };
      const concernes = [];
      let nbAt = 0, joursAt = 0;
      avecDsn.forEach((e) => {
        const ats = (e.dsn.arrets || []).filter((a) => MOTIFS_AT_MP.has(a.motif));
        if (ats.length) { concernes.push(e); nbAt += ats.length; joursAt += ats.reduce((s, a) => s + (a.jours || 0), 0); }
      });
      const status = nbAt === 0 ? STATUS.conforme : nbAt <= 1 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: nbAt,
        valueLabel: nbAt
          ? `${nbAt} arrêt${nbAt > 1 ? "s" : ""} AT/MP · ${joursAt} jours d'arrêt (${concernes.length} salarié${concernes.length > 1 ? "s" : ""})`
          : "Aucun AT/MP déclaré sur le mois",
        threshold: "0 AT/MP",
        evidence: concernes,
      };
    },
  },
  {
    id: "absenteisme-detail",
    domain: "sante",
    label: "Répartition des absences par motif (sur le mois DSN)",
    legalRef: "Source DSN bloc 60 — informatif",
    requiredFields: [],
    evaluate({ actifs }) {
      const avecDsn = actifs.filter((e) => e.dsn);
      if (avecDsn.length === 0)
        return { status: STATUS.nonConcluant, value: null, valueLabel: "Aucune DSN importée", threshold: "", evidence: [] };
      const parMotif = {};
      avecDsn.forEach((e) => (e.dsn.arrets || []).forEach((a) => {
        parMotif[a.motifLabel] = (parMotif[a.motifLabel] || 0) + (a.jours || 0);
      }));
      const entries = Object.entries(parMotif).sort((a, b) => b[1] - a[1]);
      return {
        status: STATUS.declaratif,
        value: null,
        valueLabel: entries.length ? entries.map(([k, v]) => `${k} : ${v} j`).join(" · ") : "Aucun arrêt sur le mois",
        threshold: "répartition (mois)",
        evidence: [],
      };
    },
  },
];
