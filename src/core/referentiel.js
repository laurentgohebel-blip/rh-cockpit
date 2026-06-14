// ═══════════════════════════════════════════════════
// RÉFÉRENTIEL D'AUDIT SOCIAL
// La colonne vertébrale du cockpit : domaines pondérés
// et critères auto-portants. Chaque critère sait
// s'évaluer (evaluate) et chiffrer son risque (risk).
// ═══════════════════════════════════════════════════

import { NOW, yearsDiff } from "./parser";

// ─── Constantes légales / cibles (valeurs nationales par défaut) ───
// Surchargeables par secteur en phase ② (benchmark).
export const OETH_RATE = 0.06;
export const OETH_MIN_EFFECTIF = 20;
export const CDD_DUREE_MAX_MOIS = 18;
export const SMIC_HORAIRE = 11.88;
export const SMIC_MENSUEL = 1801.84; // 11,88 × 151,67h (2026)
export const FIELD_RELIABLE_PCT = 0.7; // sous ce taux de complétude → critère « non concluant »
export const RETRAITE_AGES = { proche: 60, legal: 62, imminent: 64 };
// Périodicité par défaut du suivi médical — choix simplifié assumé (VIP générique).
// SIS = 3 ans (postes courants), SIR = 4 ans max (postes à risque), VIP = 5 ans.
// À affiner plus tard avec la distinction par poste/risque.
export const SUIVI_MEDICAL_PERIODICITE_ANS = 5;
export const SUIVI_MEDICAL_ALERTE_JOURS = 90; // expire bientôt si < N jours avant échéance
// Bilan professionnel obligatoire à 6 ans (Art. L.6315-1 C. trav.)
// Sanction : abondement CPF de 3 000 € par salarié dont l'employeur n'aurait pas réalisé
// les entretiens prévus + au moins 1 action de formation non obligatoire sur la période.
export const BILAN_6_ANS_MIN_EFFECTIF = 50;
export const BILAN_6_ANS_SANCTION_CPF = 3000;

// ─── Helpers nationalité (UE/EEE/Suisse → libre circulation, pas de titre requis) ───
const NORMALIZE = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const UE_EEE_CH = new Set([
  "france", "francaise", "francais", "fr", "fra",
  "allemagne", "allemande", "allemand", "de", "deu",
  "autriche", "autrichienne", "autrichien", "at", "aut",
  "belgique", "belge", "be", "bel",
  "bulgarie", "bulgare", "bg", "bgr",
  "chypre", "chypriote", "cy", "cyp",
  "croatie", "croate", "hr", "hrv",
  "danemark", "danoise", "danois", "dk", "dnk",
  "espagne", "espagnole", "espagnol", "es", "esp",
  "estonie", "estonienne", "estonien", "ee", "est",
  "finlande", "finlandaise", "finlandais", "fi", "fin",
  "grece", "grecque", "grec", "gr", "grc",
  "hongrie", "hongroise", "hongrois", "hu", "hun",
  "irlande", "irlandaise", "irlandais", "ie", "irl",
  "italie", "italienne", "italien", "it", "ita",
  "lettonie", "lettone", "lv", "lva",
  "lituanie", "lituanienne", "lituanien", "lt", "ltu",
  "luxembourg", "luxembourgeoise", "luxembourgeois", "lu", "lux",
  "malte", "maltaise", "maltais", "mt", "mlt",
  "pays-bas", "pays bas", "neerlandaise", "neerlandais", "hollandaise", "nl", "nld",
  "pologne", "polonaise", "polonais", "pl", "pol",
  "portugal", "portugaise", "portugais", "portuguaise", "portuguais", "pt", "prt",
  "tchequie", "republique tcheque", "tcheque", "cz", "cze",
  "roumanie", "roumaine", "roumain", "ro", "rou",
  "slovaquie", "slovaque", "sk", "svk",
  "slovenie", "slovene", "si", "svn",
  "suede", "suedoise", "suedois", "se", "swe",
  "islande", "islandaise", "is", "isl",
  "liechtenstein", "li", "lie",
  "norvege", "norvegienne", "no", "nor",
  "suisse", "ch", "che",
]);

// Renvoie true si la nationalité requiert une autorisation de travail (hors UE/EEE/CH)
export function requiresWorkPermit(nationalite) {
  if (!nationalite) return false; // pas de donnée → on ne conclut pas
  return !UE_EEE_CH.has(NORMALIZE(nationalite));
}

// Salarié nécessitant une autorisation de travail :
//   - nationalité hors UE/EEE/CH (critère légal principal), OU
//   - présence d'un titre déclaré (carte de séjour/travail renseignée), OU
//   - drapeau "Étranger=oui" SANS nationalité renseignée (faute de mieux)
// NB : un salarié marqué "Étranger=oui" mais de nationalité UE/EEE/CH ne nécessite PAS
// de titre — c'est une incohérence de saisie (Quadratus marque "étranger" tout non-français).
export function isForeignWorker(emp) {
  if (emp.nationalite) return requiresWorkPermit(emp.nationalite);
  if (emp.cartesSejourNumero || emp.cartesTravailNumero || emp.cartesSejourFin || emp.cartesTravailFin)
    return true;
  if (emp.etranger === true) return true;
  return false;
}

// Détecte un marquage "Étranger=oui" pour un citoyen UE/EEE/CH (incohérence pure)
export function isMislabelledEU(emp) {
  return emp.etranger === true && emp.nationalite && !requiresWorkPermit(emp.nationalite);
}

// État du titre d'un salarié : aucun / expiré / expirantBientôt / valide
// On combine carte de séjour ET carte de travail : un salarié est OK s'il a AU MOINS UNE
// des deux avec une date d'expiration future (ou si aucune date renseignée mais N° présent).
const JOURS_VIGILANCE = 90;
export function permitStatus(emp) {
  const numS = !!emp.cartesSejourNumero, numT = !!emp.cartesTravailNumero;
  const finS = emp.cartesSejourFin, finT = emp.cartesTravailFin;

  if (!numS && !numT && !finS && !finT) return "aucun"; // pas la moindre trace
  // Si on a des dates : retient la plus tardive (le titre encore valide le plus longtemps)
  const dates = [finS, finT].filter(Boolean);
  if (dates.length > 0) {
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const joursRestants = (latest - NOW) / 864e5;
    if (joursRestants < 0) return "expiré";
    if (joursRestants <= JOURS_VIGILANCE) return "expirantBientôt";
    return "valide";
  }
  // N° présent(s) mais aucune date → on suppose une doc partielle (sans pouvoir contrôler l'échéance)
  return "sansDate";
}

// Vrai si aucune des sources de donnée « étranger » n'est renseignée pour quiconque
function noForeignDataAtAll(actifs) {
  return actifs.every((e) =>
    !e.nationalite && e.etranger == null &&
    !e.cartesSejourNumero && !e.cartesTravailNumero &&
    !e.cartesSejourFin && !e.cartesTravailFin
  );
}

export const SEUILS = {
  turnover: { vigilance: 15, alerte: 25 },
  ecartHF: { vigilance: 10, alerte: 25 },
  tempsPartiel: { vigilance: 40 },
  vieillissement: { vigilance: 30, alerte: 40 },
  anciennete2ans: { vigilance: 40 },
  cddRatio: { vigilance: 20, alerte: 35 },
  demission: { vigilance: 40, alerte: 60 },
};

// Coefficient AGEFIPH par unité bénéficiaire manquante (× SMIC horaire)
export function agefiphCoef(effectif) {
  if (effectif < 200) return 400;
  if (effectif < 750) return 500;
  return 600;
}

// ─── États possibles d'un critère ───
export const STATUS = {
  conforme: "conforme",
  vigilance: "vigilance",
  nonConforme: "non-conforme",
  nonConcluant: "non-concluant", // donnée source insuffisante
  nonApplicable: "non-applicable", // seuil d'effectif non atteint
  declaratif: "declaratif", // à vérifier hors données (BDESE, registre…)
};

// ─── Présentation des statuts (tokens sémantiques shadcn-compatibles) ───
// L'UI mappe `tone` → variantes Badge/couleur via src/lib/audit-ui.js
export const STATUS_META = {
  [STATUS.conforme]: { label: "Conforme", tone: "success" },
  [STATUS.vigilance]: { label: "Vigilance", tone: "warning" },
  [STATUS.nonConforme]: { label: "Non conforme", tone: "destructive" },
  [STATUS.nonConcluant]: { label: "Non concluant", tone: "muted" },
  [STATUS.nonApplicable]: { label: "Non applicable", tone: "muted" },
  [STATUS.declaratif]: { label: "À vérifier", tone: "info" },
};

// ─── Domaines pondérés ───
export const DOMAINS = [
  { key: "conformite", label: "Conformité & obligations légales", icon: "⚖️", weight: 0.35 },
  { key: "remuneration", label: "Rémunération & masse salariale", icon: "💰", weight: 0.25 },
  { key: "mouvements", label: "Mouvements, fidélisation & climat", icon: "🔄", weight: 0.2 },
  { key: "effectifs", label: "Effectifs, diversité & égalité", icon: "👥", weight: 0.2 },
];

// ─── Helpers locaux ───
const moisDepuis = (date) => (date ? yearsDiff(date, NOW) * 12 : null);
const moyenne = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const aUnSalaire = (e) => e.salaire != null && e.salaire > 0;

// Reconstitue un salaire équivalent temps plein (ETP).
// Priorité : pctActivite si renseigné, sinon ratio heures/151,67 (base légale 35h),
// sinon brut tel quel (déjà ETP).
// GARDE-FOU : si le salarié est à < 20% du temps plein (entrée en cours de mois,
// fin d'intérim, etc.), on ne peut PAS extrapoler de façon fiable → on retourne null
// pour l'exclure du calcul plutôt que de produire un ETP aberrant.
const HEURES_TEMPS_PLEIN = 151.67;
const ETP_RATIO_MAX = 5; // = activité minimale 20% pour extrapoler
export function salaireETP(emp) {
  if (!aUnSalaire(emp)) return null;
  if (emp.pctActivite && emp.pctActivite > 0 && emp.pctActivite <= 100) {
    if (emp.pctActivite < 100 / ETP_RATIO_MAX) return null;
    return emp.salaire / (emp.pctActivite / 100);
  }
  if (emp.heures && emp.heures > 0 && emp.heures < HEURES_TEMPS_PLEIN) {
    const ratio = HEURES_TEMPS_PLEIN / emp.heures;
    if (ratio > ETP_RATIO_MAX) return null;
    return emp.salaire * ratio;
  }
  return emp.salaire;
}

// Tranches d'ancienneté pour la comparaison salariale ajustée
export const TRANCHES_ANCIENNETE = [
  { key: "<2", label: "< 2 ans", lo: 0, hi: 2 },
  { key: "2-5", label: "2-5 ans", lo: 2, hi: 5 },
  { key: "5-10", label: "5-10 ans", lo: 5, hi: 10 },
  { key: "10-20", label: "10-20 ans", lo: 10, hi: 20 },
  { key: "20+", label: "20+ ans", lo: 20, hi: 999 },
];
export function trancheAnciennete(emp) {
  const a = emp.anciennete;
  if (a == null) return null;
  return TRANCHES_ANCIENNETE.find((t) => a >= t.lo && a < t.hi);
}

// Tranches d'âge officielles Index Égalité Pro F/H (Décret 2019-15)
export const TRANCHES_AGE_INDEX = [
  { key: "<30", label: "< 30 ans", lo: 0, hi: 30 },
  { key: "30-39", label: "30-39 ans", lo: 30, hi: 40 },
  { key: "40-49", label: "40-49 ans", lo: 40, hi: 50 },
  { key: "50+", label: "50 ans et +", lo: 50, hi: 200 },
];
export function trancheAgeIndex(emp) {
  if (emp.age == null) return null;
  return TRANCHES_AGE_INDEX.find((t) => emp.age >= t.lo && emp.age < t.hi);
}

// Seuils Index Égalité Pro indicateur n°1 — barème officiel adapté à notre échelle :
//   - 0% à 5% (seuil tolérance CSP) → conforme (38-40 pts officiels)
//   - 5% à 15%                      → vigilance (10-30 pts officiels)
//   - > 15%                         → non-conforme (< 10 pts officiels)
export const SEUIL_INDEX_TOLERANCE = 5; // %, seuil de tolérance par groupe (méthode CSP)

// ═══════════════════════════════════════════════════
// CRITÈRES
// evaluate(ctx) → { status, value, valueLabel, threshold, evidence }
// risk(ctx)     → { amount, unit, label, basis } | null
// ctx = { metrics, employees, actifs, completeness }
// ═══════════════════════════════════════════════════

export const CRITERIA = [
  // ─────────────── CONFORMITÉ ───────────────
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

  // ─────────────── RÉMUNÉRATION ───────────────
  {
    id: "remu-completude",
    domain: "remuneration",
    label: "Complétude des données de rémunération",
    requiredFields: [],
    evaluate({ seuils = SEUILS, actifs }) {
      const renseignes = actifs.filter(aUnSalaire).length;
      const pct = actifs.length ? (renseignes / actifs.length) * 100 : 0;
      const status = pct >= 90 ? STATUS.conforme : pct >= 70 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: pct,
        valueLabel: `${pct.toFixed(0)}% renseignés (${renseignes}/${actifs.length})`,
        threshold: "≥ 90%",
        evidence: actifs.filter((e) => !aUnSalaire(e)),
      };
    },
  },
  {
    id: "top-remunerations",
    domain: "remuneration",
    label: "Parité dans les plus hautes rémunérations (indicateur n°5 Index Égalité)",
    legalRef: "Décret 2019-15 du 8 janv. 2019 — 10 plus hautes rémunérations (5 si effectif < 250)",
    requiredFields: ["salaire", "sexe"],
    // Barème officiel Index Égalité Pro F/H indicateur 5 :
    //   ≥ 4 femmes / 10 → 10 points (conforme)
    //   2 ou 3 femmes / 10 → 5 points (vigilance)
    //   0 ou 1 femme / 10 → 0 point (non-conforme)
    // Salaire considéré : rémunération brute annuelle équivalent temps plein.
    evaluate({ seuils = SEUILS, actifs, metrics: m }) {
      const N = (m?.totalActifs ?? actifs.length) >= 250 ? 10 : 5;
      const candidats = actifs
        .filter((e) => aUnSalaire(e) && (e.sexe === "Homme" || e.sexe === "Femme"))
        .map((e) => ({ ...e, _etp: salaireETP(e) }))
        .filter((e) => e._etp != null);
      if (candidats.length < N)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: `Moins de ${N} salariés avec salaire renseigné`,
          threshold: `≥ 4 femmes / ${N}`,
          evidence: [],
        };
      const top = candidats.sort((a, b) => b._etp - a._etp).slice(0, N);
      const nbFemmes = top.filter((e) => e.sexe === "Femme").length;

      // Barème adapté à la taille du top (proportionnellement) :
      // N=10 → ≥4 conforme, 2-3 vigilance, 0-1 non-conforme
      // N=5  → ≥2 conforme, 1 vigilance, 0 non-conforme
      const seuilConforme = N === 10 ? 4 : 2;
      const seuilVigilance = N === 10 ? 2 : 1;
      let status;
      if (nbFemmes >= seuilConforme) status = STATUS.conforme;
      else if (nbFemmes >= seuilVigilance) status = STATUS.vigilance;
      else status = STATUS.nonConforme;

      return {
        status,
        value: nbFemmes,
        valueLabel: `${nbFemmes} femme${nbFemmes > 1 ? "s" : ""} dans le top ${N} (en ETP)`,
        threshold: `≥ ${seuilConforme} femmes / ${N}`,
        evidence: top,
      };
    },
  },
  {
    id: "ecart-hf-emploi",
    domain: "remuneration",
    label: "Écart salarial F/H — indicateur n°1 Index Égalité Pro (40 pts officiels)",
    legalRef: "Décret 2019-15 art. 1 — méthode CSP, tolérance 5% par groupe (emploi × tranche d'âge)",
    requiredFields: ["emploi", "salaire", "sexe", "dateNaiss"],
    reliableThreshold: 0.5,
    // Implémentation de l'indicateur n°1 de l'Index Égalité Pro F/H :
    //   - Regroupement par (CSP × tranche d'âge officielle <30/30-39/40-49/50+)
    //   - Notre fichier n'a pas la CSP → on utilise « emploi » comme proxy
    //   - Seuil de tolérance officiel : 5% par groupe (méthode CSP)
    //   - Statut basé sur l'écart pondéré (40 pts si 0%, 0 pt si ≥ 20%)
    evaluate({ seuils = SEUILS, actifs }) {
      const avecEmploi = actifs.filter(
        (e) => e.emploi && aUnSalaire(e) && (e.sexe === "Homme" || e.sexe === "Femme") && e.age != null
      );
      if (avecEmploi.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Colonne « emploi » absente — comparaison Index Égalité impossible",
          threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe (tolérance officielle)`,
          evidence: [],
        };

      // Regroupement par (emploi normalisé × tranche d'âge officielle)
      const groupes = new Map();
      avecEmploi.forEach((e) => {
        const t = trancheAgeIndex(e);
        if (!t) return;
        const key = `${e.emploi.toLowerCase().trim()}||${t.key}`;
        if (!groupes.has(key))
          groupes.set(key, { emploi: e.emploi, tranche: t.label, trancheKey: t.key, h: [], f: [] });
        const g = groupes.get(key);
        const etp = salaireETP(e);
        if (etp == null) return;
        if (e.sexe === "Homme") g.h.push(etp);
        else g.f.push(etp);
      });

      // Méthode officielle : seuls les groupes avec ≥ 3 H ET ≥ 3 F sont comparables
      const comparables = [...groupes.values()].filter((g) => g.h.length >= 3 && g.f.length >= 3);
      if (comparables.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucun groupe (emploi × tranche d'âge) avec ≥ 3 H et ≥ 3 F",
          threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe`,
          evidence: [],
        };

      // Écart moyen pondéré par effectif total du groupe (méthode officielle)
      let sumWeight = 0, sumWeightedEcart = 0;
      const detail = [];
      comparables.forEach((g) => {
        const mh = moyenne(g.h), mf = moyenne(g.f);
        const ecart = mh ? ((mh - mf) / mh) * 100 : 0;
        // Application du seuil de tolérance par groupe (5%)
        const ecartCorrige = Math.abs(ecart) <= SEUIL_INDEX_TOLERANCE ? 0 : ecart - Math.sign(ecart) * SEUIL_INDEX_TOLERANCE;
        const w = g.h.length + g.f.length;
        sumWeight += w;
        sumWeightedEcart += w * ecartCorrige;
        detail.push({ emploi: g.emploi, tranche: g.tranche, trancheKey: g.trancheKey, ecart, ecartCorrige, w });
      });
      const ecartPondere = sumWeight ? sumWeightedEcart / sumWeight : 0;
      const abs = Math.abs(ecartPondere);

      // Barème officiel — adapté en 3 statuts
      const status = abs <= SEUIL_INDEX_TOLERANCE
        ? STATUS.conforme
        : abs <= 15 ? STATUS.vigilance : STATUS.nonConforme;

      // Points indicatifs sur 40 (barème officiel : 0% = 40 pts, 20%+ = 0 pt, linéaire)
      const pointsIndex = Math.max(0, Math.round(40 * (1 - abs / 20)));

      // Évidence : salariés des groupes où l'écart corrigé est non nul (dépasse le seuil)
      const groupesEcartes = new Set(
        detail.filter((d) => d.ecartCorrige !== 0)
          .map((d) => `${d.emploi.toLowerCase().trim()}||${d.trancheKey}`)
      );
      const evidence = avecEmploi.filter((e) => {
        const t = trancheAgeIndex(e);
        if (!t) return false;
        return groupesEcartes.has(`${e.emploi.toLowerCase().trim()}||${t.key}`);
      });

      return {
        status,
        value: ecartPondere,
        valueLabel: `Écart pondéré ${ecartPondere > 0 ? "+" : ""}${ecartPondere.toFixed(1)}% (après tolérance 5%) · ${comparables.length} groupes comparables · ≈ ${pointsIndex}/40 pts Index`,
        threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe (tolérance officielle)`,
        evidence,
      };
    },
    risk({ seuils = SEUILS, actifs, metrics: m }) {
      // Pénalité Index Égalité non publié OU score < 75 : jusqu'à 1% de la masse salariale annuelle
      // Ne s'applique qu'aux entreprises ≥ 50 salariés
      if (m.totalActifs < 50) return null;
      const masseAnnuelle = (m.masse || 0) * 12;
      if (masseAnnuelle <= 0) return null;
      return {
        amount: Math.round(masseAnnuelle * 0.01),
        unit: "€",
        label: "Pénalité max. Index Égalité (publication absente ou score < 75/100 sans rattrapage)",
        basis: "Jusqu'à 1% de la masse salariale annuelle (Art. L.2242-8 C. trav.)",
      };
    },
  },
  {
    id: "decile-d9-d1",
    domain: "remuneration",
    label: "Rapport interdécile D9/D1 (équité salariale)",
    legalRef: "Indicateur Bilan social (Art. R.2312-9 C. trav.) — médiane française tous secteurs ≈ 3,0",
    requiredFields: ["salaire"],
    // Calcule le ratio entre le 9e décile (90e centile) et le 1er décile (10e centile)
    // des salaires ETP renseignés. Indicateur d'équité/dispersion salariale.
    evaluate({ seuils = SEUILS, actifs }) {
      const etps = actifs
        .map((e) => salaireETP(e))
        .filter((v) => v != null && v > 0)
        .sort((a, b) => a - b);
      if (etps.length < 10)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Moins de 10 salaires renseignés — indicateur non significatif",
          threshold: "≤ 3,5 (médiane française)",
          evidence: [],
        };
      // Méthode des centiles : interpolation linéaire
      const percentile = (p) => {
        const idx = (etps.length - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return lo === hi ? etps[lo] : etps[lo] + (etps[hi] - etps[lo]) * (idx - lo);
      };
      const d1 = percentile(0.1);
      const d9 = percentile(0.9);
      const ratio = d1 ? d9 / d1 : 0;
      const status = ratio <= 3.5 ? STATUS.conforme
        : ratio <= 5 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: ratio,
        valueLabel: `D9/D1 = ${ratio.toFixed(2)} · D9 ≈ ${Math.round(d9).toLocaleString("fr-FR")}€ · D1 ≈ ${Math.round(d1).toLocaleString("fr-FR")}€ (ETP)`,
        threshold: "≤ 3,5 (médiane FR)",
        evidence: [],
      };
    },
  },

  // ─────────────── MOUVEMENTS ───────────────
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

  // ─────────────── EFFECTIFS ───────────────
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
