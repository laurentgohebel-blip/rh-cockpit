// ═══════════════════════════════════════════════════
// QUALITÉ DES DONNÉES
// Complétude par champ (pour le gating « non concluant »)
// et détection d'anomalies (valeurs aberrantes, doublons).
// ═══════════════════════════════════════════════════

import { NOW } from "./parser";

// Champs porteurs d'une sémantique « renseigné / absent » exploitable.
// (Les booléens normalisés comme cdd/handicap ne sont pas mesurables ici.)
const COMPLETENESS_FIELDS = [
  { field: "sexe", label: "Sexe", filled: (e) => e.sexe === "Homme" || e.sexe === "Femme" },
  { field: "dateNaiss", label: "Date de naissance", filled: (e) => !!e.dateNaiss },
  { field: "dateEntree", label: "Date d'entrée", filled: (e) => !!e.dateEntree },
  { field: "salaire", label: "Salaire de base", filled: (e) => e.salaire != null && e.salaire > 0 },
  { field: "visiteDate", label: "Visite médicale", filled: (e) => !!e.visiteDate },
  { field: "heures", label: "Heures / mois", filled: (e) => e.heures != null && e.heures > 0 },
  { field: "etab", label: "Établissement", filled: (e) => !!e.etab },
  { field: "ville", label: "Ville", filled: (e) => !!e.ville },
  { field: "emploi", label: "Emploi / libellé poste", filled: (e) => !!e.emploi },
  { field: "nationalite", label: "Nationalité", filled: (e) => !!e.nationalite },
  { field: "etranger", label: "Étranger (oui/non)", filled: (e) => e.etranger != null },
  { field: "cartesSejourNumero", label: "N° carte de séjour", filled: (e) => !!e.cartesSejourNumero },
  { field: "cartesSejourFin", label: "Date fin carte de séjour", filled: (e) => !!e.cartesSejourFin },
  { field: "cartesTravailNumero", label: "N° carte de travail", filled: (e) => !!e.cartesTravailNumero },
  { field: "cartesTravailFin", label: "Date fin carte de travail", filled: (e) => !!e.cartesTravailFin },
];

// ─── Taux de complétude par champ (sur l'effectif actif) ───
export function computeFieldCompleteness(employees) {
  const actifs = employees.filter((e) => e.actif);
  const total = actifs.length;
  return COMPLETENESS_FIELDS.map((f) => {
    const filled = actifs.filter(f.filled).length;
    return { field: f.field, label: f.label, filled, total, pct: total ? filled / total : 0 };
  });
}

// ─── Map { field: pct } pour le gating dans scoring.js ───
export function completenessMap(employees) {
  const map = {};
  computeFieldCompleteness(employees).forEach((c) => {
    map[c.field] = c.pct;
  });
  return map;
}

// ─── Détection d'anomalies ───
// Renvoie [{ type, severity, employee?, field, message }]
export function detectAnomalies(employees) {
  const anomalies = [];
  const seen = {};

  employees.forEach((e) => {
    if (e.salaire != null && (e.salaire <= 0 || e.salaire > 20000))
      anomalies.push({ type: "salaire", severity: "alerte", employee: e, field: "salaire", message: `Salaire incohérent : ${e.salaire}€` });

    if (e.age != null && (e.age < 16 || e.age > 75))
      anomalies.push({ type: "age", severity: "alerte", employee: e, field: "age", message: `Âge hors plage : ${e.age} ans` });

    if (e.dateEntree && e.dateSortie && e.dateSortie < e.dateEntree)
      anomalies.push({ type: "dates", severity: "erreur", employee: e, field: "dateSortie", message: "Date de sortie antérieure à la date d'entrée" });

    if (e.dateEntree && e.dateEntree > NOW)
      anomalies.push({ type: "dates", severity: "erreur", employee: e, field: "dateEntree", message: "Date d'entrée dans le futur" });

    if (e.pctActivite != null && e.pctActivite > 100)
      anomalies.push({ type: "activite", severity: "alerte", employee: e, field: "pctActivite", message: `Taux d'activité > 100% : ${e.pctActivite}%` });

    if (e.nom) {
      const key = `${e.nom.toLowerCase()}|${(e.prenom || "").toLowerCase()}|${e.dateNaiss ? e.dateNaiss.getTime() : ""}`;
      if (seen[key])
        anomalies.push({ type: "doublon", severity: "alerte", employee: e, field: "nom", message: `Doublon potentiel : ${e.nom} ${e.prenom}` });
      else seen[key] = true;
    }
  });

  return anomalies;
}
