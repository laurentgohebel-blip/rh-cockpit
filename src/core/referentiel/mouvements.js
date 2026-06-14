import { STATUS, SEUILS, RETRAITE_AGES } from "./constants";

// ─────────────── MOUVEMENTS, FIDÉLISATION & CLIMAT ───────────────
export const mouvementsCriteria = [
  {
    id: "turnover",
    domain: "mouvements",
    label: "Taux de turnover (hors fins de CDD, dernier exercice clos)",
    legalRef: "Indicateur de rotation — seuils sectoriels ajustables via le profil secteur",
    requiredFields: ["dateEntree"],
    // Formule simplifiée : sorties exercice clos (hors fins normales CDD/apprentissage/contrat aidé)
    // divisées par effectif actif actuel. Approximation acceptée (pas d'effectif moyen annuel).
    evaluate({ seuils = SEUILS, metrics: m, employees }) {
      const ta = m.turnoverAnnuel || [];
      if (!ta.length)
        return { status: STATUS.nonConcluant, value: null, valueLabel: "Pas de mouvements datés", threshold: "", evidence: [] };
      // Dernière année close = avant-dernière dans le tableau (évite année en cours)
      const last = ta.length >= 2 ? ta[ta.length - 2] : ta[ta.length - 1];
      const anneeClose = +last.annee;

      // Recompte les sorties de l'année close en excluant les fins normales
      const FIN_NORMALE = /fin de cdd|fin apprentissage|fin contrat aidé|fin contrat aide/i;
      const CODES_FIN_NORMALE = new Set([20, 31, 81, 84]);
      const sortiesSubies = (employees || []).filter((e) => {
        if (!e.dateSortie || e.dateSortie.getFullYear() !== anneeClose) return false;
        if (e.motifCode != null && CODES_FIN_NORMALE.has(Math.round(e.motifCode))) return false;
        if (e.motifLabel && FIN_NORMALE.test(e.motifLabel)) return false;
        return true;
      });

      const n = m.totalActifs;
      const taux = n ? Math.round((sortiesSubies.length / n) * 100) : 0;
      const status = taux <= seuils.turnover.vigilance ? STATUS.conforme
        : taux <= seuils.turnover.alerte ? STATUS.vigilance : STATUS.nonConforme;

      return {
        status,
        value: taux,
        valueLabel: `${taux}% en ${anneeClose} (${sortiesSubies.length} sorties hors fins de CDD / ${n} actifs)`,
        threshold: `≤ ${seuils.turnover.vigilance}%`,
        evidence: sortiesSubies,
      };
    },
  },
  {
    id: "motifs-sortie",
    domain: "mouvements",
    label: "Part des démissions (indicateur informatif)",
    legalRef: "Indicateur climat — non noté, pour information de l'auditeur",
    requiredFields: [],
    // Indicateur informatif (déclaratif) : on calcule le % mais on ne le note pas.
    // Décision utilisateur : seules les démissions stricto sensu (pas les RC), pas de seuil.
    evaluate({ seuils = SEUILS, metrics: m }) {
      const md = m.motifData || [];
      const total = md.reduce((s, x) => s + x.value, 0);
      if (!total)
        return { status: STATUS.nonConcluant, value: null, valueLabel: "Aucune sortie historisée", threshold: "", evidence: [] };
      const dem = md.filter((x) => /^démission$|^demission$/i.test(x.name)).reduce((s, x) => s + x.value, 0);
      const pct = (dem / total) * 100;
      const topMotifs = md.slice(0, 5).map((m) => `${m.name} (${m.value})`).join(" · ");
      return {
        status: STATUS.declaratif,
        value: pct,
        valueLabel: `${pct.toFixed(0)}% de démissions (${dem} / ${total} sorties). Top motifs : ${topMotifs}`,
        threshold: "indicateur informatif",
        evidence: [],
      };
    },
  },
  {
    id: "retraite-anticipation",
    domain: "mouvements",
    label: "Départs en retraite à anticiper",
    requiredFields: ["dateNaiss"],
    evaluate({ seuils = SEUILS, metrics: m, actifs }) {
      const n = m.totalActifs;
      const p60 = actifs.filter((e) => e.age != null && e.age >= RETRAITE_AGES.proche).length;
      const p64 = actifs.filter((e) => e.age != null && e.age >= RETRAITE_AGES.imminent).length;
      const pct = n ? (p60 / n) * 100 : 0;
      const status = p64 === 0 && pct < 10 ? STATUS.conforme : pct < 20 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: p60,
        valueLabel: `${p60} salarié${p60 > 1 ? "s" : ""} de 60+ dont ${p64} de 64+`,
        threshold: "succession à préparer",
        evidence: actifs.filter((e) => e.age != null && e.age >= RETRAITE_AGES.proche),
      };
    },
  },
];
