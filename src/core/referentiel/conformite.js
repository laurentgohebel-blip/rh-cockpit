import { NOW, yearsDiff } from "../parser";
import {
  STATUS, SEUILS,
  OETH_MIN_EFFECTIF, OETH_RATE, agefiphCoef, SMIC_HORAIRE, SMIC_MENSUEL,
  SUIVI_MEDICAL_PERIODICITE_ANS, SUIVI_MEDICAL_ALERTE_JOURS,
  moisDepuis, CDD_DUREE_MAX_MOIS,
  noForeignDataAtAll, isForeignWorker, permitStatus, requiresWorkPermit, isMislabelledEU, JOURS_VIGILANCE,
  BILAN_6_ANS_MIN_EFFECTIF, BILAN_6_ANS_SANCTION_CPF,
} from "./constants";

// ─────────────── CONFORMITÉ & OBLIGATIONS LÉGALES ───────────────
export const conformiteCriteria = [
  {
    id: "oeth",
    domain: "conformite",
    label: "Obligation d'emploi des travailleurs handicapés (OETH)",
    legalRef: "Art. L.5212-2 C. trav. — taux 6% (estimation snapshot, calcul ETP officiel à faire en DOETH)",
    requiredFields: [],
    // Calcul simplifié assumé : ratio nb RQTH / nb actifs à l'instant T.
    // L'effectif d'assujettissement OETH officiel est l'effectif moyen annuel ETP (3 ans glissants).
    // À affiner quand on aura des fichiers couvrant l'année entière (cf. roadmap ETP).
    evaluate({ seuils = SEUILS, metrics: m, actifs }) {
      const n = m.totalActifs;
      if (n < OETH_MIN_EFFECTIF)
        return { status: STATUS.nonApplicable, value: null, valueLabel: `Effectif < ${OETH_MIN_EFFECTIF}`, threshold: "≥ 6%", evidence: [] };
      const pct = n ? (m.rqth / n) * 100 : 0;
      const status = pct >= 6 ? STATUS.conforme : pct >= 3 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: pct,
        valueLabel: `${pct.toFixed(1)}% (${m.rqth}/${n}) — calcul snapshot indicatif`,
        threshold: "≥ 6%",
        evidence: actifs.filter((e) => e.handicap),
      };
    },
    risk({ metrics: m }) {
      const n = m.totalActifs;
      if (n < OETH_MIN_EFFECTIF) return null;
      const manquants = Math.ceil(OETH_RATE * n) - m.rqth;
      if (manquants <= 0) return null;
      const coef = agefiphCoef(n);
      return {
        amount: Math.round(manquants * coef * SMIC_HORAIRE),
        unit: "€/an",
        label: `Contribution AGEFIPH estimée (${manquants} bénéficiaire${manquants > 1 ? "s" : ""} manquant${manquants > 1 ? "s" : ""}, snapshot)`,
        basis: `${manquants} × ${coef} × ${SMIC_HORAIRE}€ (SMIC horaire). Estimation indicative — non corrigée des minorations (séniors RQTH, lourdement handicapés, alternants) ni des dépenses déductibles (sous-traitance ESAT/EA). Calcul officiel ETP à effectuer en DOETH.`,
      };
    },
  },
  {
    id: "suivi-medical",
    domain: "conformite",
    label: "Suivi médical à jour",
    legalRef: `Art. R.4624-10 et s. C. trav. — périodicité ${SUIVI_MEDICAL_PERIODICITE_ANS} ans (VIP par défaut, à affiner par poste)`,
    requiredFields: ["visiteDate"],
    reliableThreshold: 0.5,
    // `visiteDate` = date de la DERNIÈRE visite médicale (convention Quadratus).
    // Expirée si > SUIVI_MEDICAL_PERIODICITE_ANS années en arrière.
    // Expirant bientôt si l'échéance (visiteDate + N ans) tombe dans les 90 prochains jours.
    evaluate({ seuils = SEUILS, actifs }) {
      const avecDate = actifs.filter((e) => e.visiteDate);
      if (avecDate.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucune date de visite renseignée",
          threshold: `≤ ${SUIVI_MEDICAL_PERIODICITE_ANS} ans depuis la dernière visite`,
          evidence: [],
        };

      const expirees = [];
      const expirantBientot = [];
      avecDate.forEach((e) => {
        const annees = yearsDiff(e.visiteDate, NOW);
        if (annees > SUIVI_MEDICAL_PERIODICITE_ANS) {
          expirees.push(e);
        } else {
          const joursAvantEcheance =
            (SUIVI_MEDICAL_PERIODICITE_ANS - annees) * 365.25;
          if (joursAvantEcheance <= SUIVI_MEDICAL_ALERTE_JOURS) expirantBientot.push(e);
        }
      });

      let status, valueLabel;
      const parts = [];
      if (expirees.length) parts.push(`${expirees.length} expirée${expirees.length > 1 ? "s" : ""}`);
      if (expirantBientot.length) parts.push(`${expirantBientot.length} <${SUIVI_MEDICAL_ALERTE_JOURS}j`);

      if (expirees.length > 0) {
        status = STATUS.nonConforme;
        valueLabel = `${parts.join(", ")} / ${avecDate.length} renseignée${avecDate.length > 1 ? "s" : ""}`;
      } else if (expirantBientot.length > 0) {
        status = STATUS.vigilance;
        valueLabel = `${parts.join(", ")} / ${avecDate.length} renseignée${avecDate.length > 1 ? "s" : ""}`;
      } else {
        status = STATUS.conforme;
        valueLabel = `${avecDate.length} salarié${avecDate.length > 1 ? "s" : ""} à jour`;
      }

      return {
        status,
        value: expirees.length,
        valueLabel,
        threshold: `≤ ${SUIVI_MEDICAL_PERIODICITE_ANS} ans depuis la dernière visite`,
        evidence: [...expirees, ...expirantBientot],
      };
    },
  },
  {
    id: "cdd-cadre",
    domain: "conformite",
    label: "Encadrement des CDD (durée maximale)",
    legalRef: `Art. L.1242-8-1 C. trav. — ${CDD_DUREE_MAX_MOIS} mois (cas standard ; faux positifs possibles sur CDD à objet défini cadres)`,
    requiredFields: ["dateEntree"],
    // Calcul simplifié assumé : on prend `dateEntree` (entrée dans l'entreprise) comme proxy
    // de la date de début du CDD courant. Minorant : si plusieurs CDD successifs chez le
    // même employeur, la durée du CDD courant peut être surestimée. Acceptable au stade
    // snapshot ; pas de chiffrage du risque associé (à évaluer cas par cas en mission).
    evaluate({ seuils = SEUILS, actifs }) {
      const cddActifs = actifs.filter((e) => e.cdd);
      const longs = cddActifs.filter((e) => e.dateEntree && moisDepuis(e.dateEntree) > CDD_DUREE_MAX_MOIS);
      const status = longs.length === 0 ? STATUS.conforme : longs.length <= 2 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: longs.length,
        valueLabel: cddActifs.length ? `${longs.length} CDD > ${CDD_DUREE_MAX_MOIS} mois / ${cddActifs.length} CDD actifs` : "Aucun CDD actif",
        threshold: `≤ ${CDD_DUREE_MAX_MOIS} mois (depuis entrée dans l'entreprise)`,
        evidence: longs,
      };
    },
  },
  {
    id: "titre-sejour",
    domain: "conformite",
    label: "Salariés étrangers — autorisation de travail",
    legalRef: "Art. L.5221-8 et L.8253-1 C. trav. — vérification de l'autorisation de travail",
    requiredFields: [], // gating non standard — géré dans evaluate
    evaluate({ seuils = SEUILS, actifs }) {
      // 0. Aucune donnée nulle part → non concluant (colonnes absentes du fichier)
      if (noForeignDataAtAll(actifs))
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucune donnée étrangers / titres — colonnes absentes du fichier",
          threshold: "Titre valide & non expiré",
          evidence: [],
        };

      // 1. Détection croisée des salariés étrangers
      const etrangers = actifs.filter(isForeignWorker);
      if (etrangers.length === 0)
        return {
          status: STATUS.conforme,
          value: 0,
          valueLabel: "Aucun salarié étranger identifié",
          threshold: "Titre valide & non expiré",
          evidence: [],
        };

      // 2. Catégorise par état du titre (séjour OU travail, on garde le plus tardif)
      const buckets = { aucun: [], expiré: [], expirantBientôt: [], sansDate: [], valide: [] };
      etrangers.forEach((e) => buckets[permitStatus(e)].push(e));

      // 3. Incohérences de saisie (vigilance — pas un risque légal)
      const incoherent = actifs.filter((e) => {
        // Salarié non-UE marqué étranger=non
        if (
          e.etranger === false &&
          e.nationalite && requiresWorkPermit(e.nationalite)
        )
          return true;
        // Salarié UE marqué étranger=oui (Quadratus le fait par défaut, à corriger)
        if (isMislabelledEU(e)) return true;
        return false;
      });

      // 4. Statut prioritaire : expirés > sans aucun titre > expirant <90j > sans date > incohérence
      const nbProbleme = buckets.aucun.length + buckets.expiré.length;
      let status, valueLabel;
      const parts = [];
      if (buckets.expiré.length) parts.push(`${buckets.expiré.length} titre${buckets.expiré.length > 1 ? "s" : ""} expiré${buckets.expiré.length > 1 ? "s" : ""}`);
      if (buckets.aucun.length) parts.push(`${buckets.aucun.length} sans aucun titre`);
      if (buckets.expirantBientôt.length) parts.push(`${buckets.expirantBientôt.length} expirant <${JOURS_VIGILANCE}j`);
      if (buckets.sansDate.length) parts.push(`${buckets.sansDate.length} sans date renseignée`);
      if (incoherent.length) parts.push(`${incoherent.length} incohérence${incoherent.length > 1 ? "s" : ""}`);

      if (nbProbleme > 0) {
        status = STATUS.nonConforme;
        valueLabel = `${parts.join(", ")} / ${etrangers.length} étranger${etrangers.length > 1 ? "s" : ""}`;
      } else if (buckets.expirantBientôt.length || buckets.sansDate.length || incoherent.length) {
        status = STATUS.vigilance;
        valueLabel = `${etrangers.length} étranger${etrangers.length > 1 ? "s" : ""} identifié${etrangers.length > 1 ? "s" : ""} · ${parts.join(", ")}`;
      } else {
        status = STATUS.conforme;
        valueLabel = `${etrangers.length} étranger${etrangers.length > 1 ? "s" : ""} avec titre valide`;
      }

      // 5. Preuve nominative (déduplication par id)
      const evidenceMap = new Map();
      [...buckets.expiré, ...buckets.aucun, ...buckets.expirantBientôt, ...buckets.sansDate, ...incoherent]
        .forEach((e) => evidenceMap.set(e.id, e));

      return {
        status,
        value: nbProbleme,
        valueLabel,
        threshold: "Titre valide & non expiré",
        evidence: [...evidenceMap.values()],
      };
    },
    risk({ actifs }) {
      if (noForeignDataAtAll(actifs)) return null;
      const etrangers = actifs.filter(isForeignWorker);
      const aRisque = etrangers.filter((e) => {
        const s = permitStatus(e);
        return s === "aucun" || s === "expiré";
      });
      if (aRisque.length === 0) return null;
      // Sanction administrative L.8253-1 : jusqu'à 5 × SMIC mensuel par salarié employé
      // sans autorisation de travail valable. Estimation maximale, hors contentieux pénal.
      return {
        amount: Math.round(aRisque.length * 5 * SMIC_MENSUEL),
        unit: "€",
        label: `Sanction administrative max. — ${aRisque.length} salarié${aRisque.length > 1 ? "s" : ""} sans titre valide`,
        basis: `${aRisque.length} × 5 × ${SMIC_MENSUEL.toFixed(0)}€ (SMIC mensuel brut). Hors contentieux pénal (travail dissimulé).`,
      };
    },
  },
  {
    id: "bilan-6-ans",
    domain: "conformite",
    label: "Bilan professionnel à 6 ans (entretiens & formation)",
    legalRef: `Art. L.6315-1 C. trav. — sanction CPF de ${BILAN_6_ANS_SANCTION_CPF.toLocaleString("fr-FR")} € par salarié sans bilan formalisé`,
    requiredFields: ["dateEntree"],
    // Logique : on ne peut pas savoir depuis le snapshot si les entretiens ont eu lieu.
    // On signale tous les salariés ayant ≥ 6 ans d'ancienneté pour lesquels le bilan
    // devrait être documenté. Statut déclaratif (auditeur valide), risque chiffré sur
    // les salariés concernés (sanction CPF maximale potentielle).
    evaluate({ seuils = SEUILS, actifs, metrics: m }) {
      if ((m.totalActifs || 0) < BILAN_6_ANS_MIN_EFFECTIF)
        return {
          status: STATUS.nonApplicable,
          value: null,
          valueLabel: `Effectif < ${BILAN_6_ANS_MIN_EFFECTIF}`,
          threshold: "Bilans formalisés tous les 6 ans",
          evidence: [],
        };
      const concernes = actifs.filter((e) => e.anciennete != null && e.anciennete >= 6);
      if (concernes.length === 0)
        return {
          status: STATUS.conforme,
          value: 0,
          valueLabel: "Aucun salarié à 6+ ans d'ancienneté — obligation non encore déclenchée",
          threshold: "Bilans formalisés tous les 6 ans",
          evidence: [],
        };
      return {
        status: STATUS.declaratif,
        value: concernes.length,
        valueLabel: `${concernes.length} salarié${concernes.length > 1 ? "s" : ""} à 6+ ans d'ancienneté — vérifier les entretiens & le bilan formalisé`,
        threshold: "Bilans formalisés tous les 6 ans",
        evidence: concernes.sort((a, b) => b.anciennete - a.anciennete),
      };
    },
    risk({ actifs, metrics: m }) {
      if ((m.totalActifs || 0) < BILAN_6_ANS_MIN_EFFECTIF) return null;
      const concernes = actifs.filter((e) => e.anciennete != null && e.anciennete >= 6);
      if (concernes.length === 0) return null;
      return {
        amount: concernes.length * BILAN_6_ANS_SANCTION_CPF,
        unit: "€",
        label: `Abondement CPF max. — ${concernes.length} salarié${concernes.length > 1 ? "s" : ""} sans bilan documenté`,
        basis: `${concernes.length} × ${BILAN_6_ANS_SANCTION_CPF.toLocaleString("fr-FR")} € (sanction Art. L.6323-13 C. trav.). Estimation maximale.`,
      };
    },
  },
];
