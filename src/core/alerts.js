// ═══════════════════════════════════════════════════
// MOTEUR D'ALERTES RH
// Scanne les données employés et génère des alertes
// priorisées et actionnables.
// ═══════════════════════════════════════════════════

import { yearsDiff, fmtDate, NOW } from "./parser";
import { SUIVI_MEDICAL_PERIODICITE_ANS, SUIVI_MEDICAL_ALERTE_JOURS } from "./referentiel";

// ─────────────────────────────────────────────────────────────
// FRONTIÈRE avec le référentiel d'audit :
//   - alerts.js  = alertes OPÉRATIONNELLES datées / par salarié (échéances à
//     traiter au quotidien : visite à renouveler, fin de période d'essai,
//     entretien à planifier, départ retraite, médaille). Affichées sur /constats.
//   - referentiel = CONSTATS d'audit (critères agrégés, notés, dans le score).
// On ne duplique pas ici les obligations déjà couvertes par un critère
// (RQTH, écart F/H, index égalité, CDD > 18 mois…).
// ─────────────────────────────────────────────────────────────

// ─── Priority levels ───
export const PRIORITY = {
  urgent: { key: "urgent", label: "Urgent", color: "#DC2626", bg: "#FEF2F2", icon: "🔴", order: 0 },
  high:   { key: "high",   label: "Cette semaine", color: "#D97706", bg: "#FFFBEB", icon: "🟡", order: 1 },
  medium: { key: "medium", label: "Ce mois", color: "#2563EB", bg: "#EEF2FF", icon: "🔵", order: 2 },
  info:   { key: "info",   label: "À noter", color: "#475569", bg: "#F4F5F7", icon: "⚪", order: 3 },
};

// ─── Alert categories ───
export const CATEGORIES = {
  visite_medicale:    { label: "Visite médicale",        icon: "🏥" },
  cdd:               { label: "CDD",                     icon: "📝" },
  periode_essai:     { label: "Période d'essai",         icon: "⏳" },
  entretien:         { label: "Entretien professionnel",  icon: "🗣️" },
  retraite:          { label: "Départ retraite",          icon: "🎯" },
  conformite:        { label: "Conformité",               icon: "⚖️" },
  document:          { label: "Document obligatoire",     icon: "📄" },
  anniversaire:      { label: "Ancienneté",               icon: "🏅" },
};

// ─── Helper: generate deterministic task ID ───
function taskId(category, employeeId, suffix = "") {
  return `${category}-${employeeId}${suffix ? "-" + suffix : ""}`;
}

// ─── Main alert generator ───
export function generateAlerts(employees) {
  const actifs = employees.filter((e) => e.actif);
  const n = actifs.length;
  const alerts = [];

  // ══════════════════════════════════
  // 1. VISITES MÉDICALES
  // ══════════════════════════════════
  actifs.forEach((e) => {
    if (!e.visiteDate) {
      // Pas de date renseignée
      alerts.push({
        id: taskId("vm-missing", e.id),
        category: "visite_medicale",
        priority: "medium",
        title: "Visite médicale non renseignée",
        description: `Aucune date de visite médicale enregistrée`,
        employee: e,
        actionLabel: "Planifier",
        deadline: null,
      });
    } else {
      // visiteDate = dernière visite. Échéance = + périodicité (alignée sur le critère).
      const anneesDepuis = yearsDiff(e.visiteDate, NOW);
      const joursAvantEcheance = (SUIVI_MEDICAL_PERIODICITE_ANS - anneesDepuis) * 365.25;

      if (anneesDepuis > SUIVI_MEDICAL_PERIODICITE_ANS) {
        const joursDepasse = Math.floor(-joursAvantEcheance);
        alerts.push({
          id: taskId("vm-expired", e.id),
          category: "visite_medicale",
          priority: joursDepasse > 180 ? "urgent" : "high",
          title: "Visite médicale expirée",
          description: `Dernière visite le ${fmtDate(e.visiteDate)} (> ${SUIVI_MEDICAL_PERIODICITE_ANS} ans).`,
          employee: e,
          actionLabel: "Replanifier",
          deadline: e.visiteDate,
          daysOverdue: joursDepasse,
        });
      } else if (joursAvantEcheance <= SUIVI_MEDICAL_ALERTE_JOURS) {
        alerts.push({
          id: taskId("vm-soon", e.id),
          category: "visite_medicale",
          priority: "high",
          title: "Visite médicale à renouveler",
          description: `Échéance dans ~${Math.round(joursAvantEcheance)} jours (dernière le ${fmtDate(e.visiteDate)}).`,
          employee: e,
          actionLabel: "Planifier",
          deadline: e.visiteDate,
        });
      }
    }
  });

  // ══════════════════════════════════
  // 2. PÉRIODES D'ESSAI
  // ══════════════════════════════════
  actifs.forEach((e) => {
    if (!e.dateEntree) return;
    const monthsSince = yearsDiff(e.dateEntree, NOW) * 12;

    // CDI: PE de 2 mois (employé) à 4 mois (cadre), renouvelable une fois
    // On alerte si l'entrée est dans les 8 derniers mois (PE max avec renouvellement)
    if (!e.cdd && monthsSince >= 0 && monthsSince <= 8) {
      const peEndEstimate = new Date(e.dateEntree);
      peEndEstimate.setMonth(peEndEstimate.getMonth() + 4); // Estimation 4 mois
      const daysUntilEnd = Math.floor((peEndEstimate - NOW) / 864e5);

      if (daysUntilEnd > 0 && daysUntilEnd <= 30) {
        alerts.push({
          id: taskId("pe", e.id),
          category: "periode_essai",
          priority: daysUntilEnd <= 7 ? "urgent" : "high",
          title: "Fin de période d'essai",
          description: `Estimation fin PE dans ~${daysUntilEnd} jours. Confirmer ou rompre.`,
          employee: e,
          actionLabel: "Confirmer",
          deadline: peEndEstimate,
        });
      }
    }
  });

  // ══════════════════════════════════
  // 4. ENTRETIENS PROFESSIONNELS
  // ══════════════════════════════════
  actifs.forEach((e) => {
    if (!e.dateEntree) return;
    const yearsIn = yearsDiff(e.dateEntree, NOW);

    // Obligatoire tous les 2 ans
    if (yearsIn >= 2) {
      const lastEntretienEstimate = Math.floor(yearsIn / 2) * 2;
      const nextDue = yearsIn - lastEntretienEstimate;

      // Si on est proche d'un multiple de 2 ans (dans les 2 mois avant/après)
      if (nextDue >= 1.8 || (yearsIn >= 2 && yearsIn < 2.2)) {
        alerts.push({
          id: taskId("entretien", e.id, Math.floor(yearsIn / 2).toString()),
          category: "entretien",
          priority: nextDue >= 2.2 ? "high" : "medium",
          title: "Entretien professionnel à réaliser",
          description: `Ancienneté : ${yearsIn.toFixed(1)} ans. Entretien obligatoire tous les 2 ans.`,
          employee: e,
          actionLabel: "Planifier",
        });
      }

      // Bilan à 6 ans
      if (yearsIn >= 5.8 && yearsIn <= 6.5) {
        alerts.push({
          id: taskId("entretien-bilan", e.id),
          category: "entretien",
          priority: "high",
          title: "Bilan professionnel 6 ans obligatoire",
          description: `Ancienneté : ${yearsIn.toFixed(1)} ans. État des lieux récapitulatif requis.`,
          employee: e,
          actionLabel: "Planifier",
        });
      }
    }
  });

  // ══════════════════════════════════
  // 5. DÉPARTS RETRAITE
  // ══════════════════════════════════
  actifs.forEach((e) => {
    if (e.age == null) return;
    if (e.age >= 64) {
      alerts.push({
        id: taskId("retraite", e.id),
        category: "retraite",
        priority: "urgent",
        title: "Départ retraite imminent",
        description: `${e.age} ans. Préparer le transfert de compétences et le remplacement.`,
        employee: e,
        actionLabel: "Planifier succession",
      });
    } else if (e.age >= 62) {
      alerts.push({
        id: taskId("retraite", e.id),
        category: "retraite",
        priority: "high",
        title: "Retraite à anticiper",
        description: `${e.age} ans. Âge légal atteint. Échanger sur le projet du salarié.`,
        employee: e,
        actionLabel: "Échanger",
      });
    } else if (e.age >= 60) {
      alerts.push({
        id: taskId("retraite", e.id),
        category: "retraite",
        priority: "medium",
        title: "Retraite à horizon 2-4 ans",
        description: `${e.age} ans. Commencer à anticiper le remplacement.`,
        employee: e,
        actionLabel: "Anticiper",
      });
    }
  });

  // (Conformité RQTH / index égalité / féminisation : couverts par les critères
  //  d'audit, non dupliqués ici — voir frontière en tête de fichier.)

  // ══════════════════════════════════
  // 5. DOCUMENTS OBLIGATOIRES
  // ══════════════════════════════════
  alerts.push({
    id: "doc-bdese",
    category: "document",
    priority: "medium",
    title: "BDESE — vérifier la mise à jour",
    description: "Base de données économiques, sociales et environnementales. Mise à jour régulière obligatoire.",
    actionLabel: "Mettre à jour",
  });

  if (n >= 50) {
    alerts.push({
      id: "doc-bilan-social",
      category: "document",
      priority: "medium",
      title: "Bilan social à préparer",
      description: `Obligatoire pour les entreprises ≥ 50 salariés. ${n} salariés actuels.`,
      actionLabel: "Générer",
    });
  }

  alerts.push({
    id: "doc-registre",
    category: "document",
    priority: "info",
    title: "Registre du personnel — vérifier la complétude",
    description: `${n} salariés actifs, ${employees.length} fiches historiques.`,
    actionLabel: "Vérifier",
  });

  // ══════════════════════════════════
  // 8. ANNIVERSAIRES & MÉDAILLES
  // ══════════════════════════════════
  const medailles = [20, 30, 35, 40];
  actifs.forEach((e) => {
    if (e.anciennete == null) return;
    for (const seuil of medailles) {
      if (e.anciennete >= seuil - 0.5 && e.anciennete <= seuil + 0.5) {
        alerts.push({
          id: taskId("medaille", e.id, seuil.toString()),
          category: "anniversaire",
          priority: "info",
          title: `Médaille du travail — ${seuil} ans`,
          description: `Ancienneté : ${e.anciennete.toFixed(1)} ans. Éligible à la médaille ${seuil === 20 ? "d'argent" : seuil === 30 ? "de vermeil" : seuil === 35 ? "d'or" : "grand or"}.`,
          employee: e,
          actionLabel: "Préparer",
        });
        break;
      }
    }
  });

  // ─── Sort by priority then by overdue days ───
  alerts.sort((a, b) => {
    const pa = PRIORITY[a.priority]?.order ?? 99;
    const pb = PRIORITY[b.priority]?.order ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.daysOverdue || 0) - (a.daysOverdue || 0);
  });

  return alerts;
}

// ─── Summary stats ───
export function alertSummary(alerts, taskStates) {
  const active = alerts.filter((a) => {
    const state = taskStates[a.id];
    return !state || state.status === "open";
  });
  return {
    total: active.length,
    urgent: active.filter((a) => a.priority === "urgent").length,
    high: active.filter((a) => a.priority === "high").length,
    medium: active.filter((a) => a.priority === "medium").length,
    info: active.filter((a) => a.priority === "info").length,
  };
}
