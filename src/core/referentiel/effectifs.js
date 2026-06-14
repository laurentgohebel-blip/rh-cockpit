import { STATUS, SEUILS } from "./constants";

// ─────────────── EFFECTIFS, DIVERSITÉ & ÉGALITÉ ───────────────
export const effectifsCriteria = [
  {
    id: "structure-contrats",
    domain: "effectifs",
    label: "Structure des contrats (part de CDD)",
    requiredFields: [],
    evaluate({ seuils = SEUILS, metrics: m }) {
      const n = m.totalActifs;
      const pct = n ? (m.cdd / n) * 100 : 0;
      const status = pct <= seuils.cddRatio.vigilance ? STATUS.conforme : pct <= seuils.cddRatio.alerte ? STATUS.vigilance : STATUS.nonConforme;
      return { status, value: pct, valueLabel: `${pct.toFixed(0)}% CDD (${m.cdd}/${n})`, threshold: `≤ ${seuils.cddRatio.vigilance}%`, evidence: [] };
    },
  },
  {
    id: "temps-partiel",
    domain: "effectifs",
    label: "Recours au temps partiel",
    requiredFields: [],
    evaluate({ seuils = SEUILS, metrics: m }) {
      const n = m.totalActifs;
      const pct = n ? (m.tp / n) * 100 : 0;
      const status = pct <= seuils.tempsPartiel.vigilance ? STATUS.conforme : STATUS.vigilance;
      return { status, value: pct, valueLabel: `${pct.toFixed(0)}% à temps partiel (${m.tp}/${n})`, threshold: `≤ ${seuils.tempsPartiel.vigilance}%`, evidence: [] };
    },
  },
  {
    id: "vieillissement",
    domain: "effectifs",
    label: "Pyramide des âges — vieillissement",
    requiredFields: ["dateNaiss"],
    evaluate({ seuils = SEUILS, metrics: m, actifs }) {
      const n = m.totalActifs;
      const seniors = m.ageBuckets ? m.ageBuckets[m.ageBuckets.length - 1] : null; // tranche 55+
      const c55 = seniors ? seniors.h + seniors.f : actifs.filter((e) => e.age != null && e.age >= 55).length;
      const pct = n ? (c55 / n) * 100 : 0;
      const status = pct <= seuils.vieillissement.vigilance ? STATUS.conforme : pct <= seuils.vieillissement.alerte ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: pct,
        valueLabel: `${pct.toFixed(0)}% de 55 ans et + (${c55}/${n})`,
        threshold: `≤ ${seuils.vieillissement.vigilance}%`,
        evidence: actifs.filter((e) => e.age != null && e.age >= 55),
      };
    },
  },
  {
    id: "mixite",
    domain: "effectifs",
    label: "Mixité femmes / hommes",
    requiredFields: ["sexe"],
    evaluate({ seuils = SEUILS, metrics: m }) {
      const n = m.totalActifs;
      if (!n) return { status: STATUS.nonConcluant, value: null, valueLabel: "", threshold: "", evidence: [] };
      const pctF = (m.femmes / n) * 100;
      const status = pctF >= 25 && pctF <= 75 ? STATUS.conforme : pctF >= 15 && pctF <= 85 ? STATUS.vigilance : STATUS.nonConforme;
      return { status, value: pctF, valueLabel: `${pctF.toFixed(0)}% F / ${(100 - pctF).toFixed(0)}% H`, threshold: "25–75%", evidence: [] };
    },
  },
  {
    id: "anciennete",
    domain: "effectifs",
    label: "Stabilité — part de faible ancienneté",
    requiredFields: ["dateEntree"],
    evaluate({ seuils = SEUILS, metrics: m }) {
      const n = m.totalActifs;
      const b = m.ancBuckets ? m.ancBuckets[0] : null; // < 2 ans
      const c = b ? b.value : 0;
      const pct = n ? (c / n) * 100 : 0;
      const status = pct <= seuils.anciennete2ans.vigilance ? STATUS.conforme : STATUS.vigilance;
      return { status, value: pct, valueLabel: `${pct.toFixed(0)}% ont moins de 2 ans (${c}/${n})`, threshold: `≤ ${seuils.anciennete2ans.vigilance}%`, evidence: [] };
    },
  },
  {
    id: "taux-encadrement",
    domain: "effectifs",
    label: "Taux d'encadrement (managers / effectif)",
    legalRef: "Indicateur de structure (ISO 30414 « Leadership ») — informatif",
    requiredFields: ["emploi"],
    reliableThreshold: 0.5,
    // Détection des fonctions d'encadrement via le libellé d'emploi.
    // Statut informatif (déclaratif) : on affiche le ratio sans le noter,
    // car le « bon » taux dépend fortement de l'activité.
    evaluate({ seuils = SEUILS, actifs }) {
      const avecEmploi = actifs.filter((e) => e.emploi);
      if (avecEmploi.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Colonne « emploi » absente — taux d'encadrement non calculable",
          threshold: "indicateur de structure",
          evidence: [],
        };
      const ENCADREMENT = /directeur|directrice|manager|responsable|chef|encadrant|superviseur|cadre dirigeant/i;
      const managers = avecEmploi.filter((e) => ENCADREMENT.test(e.emploi));
      const pct = avecEmploi.length ? (managers.length / avecEmploi.length) * 100 : 0;
      return {
        status: STATUS.declaratif,
        value: pct,
        valueLabel: `${pct.toFixed(1)}% d'encadrants (${managers.length}/${avecEmploi.length}) · 1 manager pour ${managers.length ? Math.round(avecEmploi.length / managers.length) : "—"} salariés`,
        threshold: "indicateur de structure",
        evidence: managers,
      };
    },
  },
];
