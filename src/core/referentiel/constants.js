// ═══════════════════════════════════════════════════
// RÉFÉRENTIEL D'AUDIT SOCIAL
// La colonne vertébrale du cockpit : domaines pondérés
// et critères auto-portants. Chaque critère sait
// s'évaluer (evaluate) et chiffrer son risque (risk).
// ═══════════════════════════════════════════════════

import { NOW, yearsDiff } from "../parser";

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
export const JOURS_VIGILANCE = 90;
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
export function noForeignDataAtAll(actifs) {
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
  absenteisme: { vigilance: 5, alerte: 8 }, // % — moyenne nationale ~5% (maladie)
};

// Absentéisme (DSN bloc 60) — catégories de motifs
export const JOURS_OUVRES_MOIS = 21;
export const MOTIFS_MALADIE = new Set(["01", "08"]); // maladie + maladie de droit commun
export const MOTIFS_AT_MP = new Set(["05", "06", "07"]); // AT, maladie pro, accident de trajet
// (motifs 02/03/04 = maternité/paternité/adoption → congés protégés, exclus de l'absentéisme)

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
// Le domaine « santé » n'est alimenté que si une DSN est importée ; sinon ses
// critères ressortent « non concluant » et le domaine est exclu du score global
// (renormalisation automatique sur les domaines évaluables).
export const DOMAINS = [
  { key: "conformite", label: "Conformité & obligations légales", icon: "⚖️", weight: 0.3 },
  { key: "remuneration", label: "Rémunération & masse salariale", icon: "💰", weight: 0.22 },
  { key: "sante", label: "Santé, sécurité & absentéisme", icon: "🏥", weight: 0.18 },
  { key: "mouvements", label: "Mouvements, fidélisation & climat", icon: "🔄", weight: 0.16 },
  { key: "effectifs", label: "Effectifs, diversité & égalité", icon: "👥", weight: 0.14 },
];

// ─── Helpers locaux ───
export const moisDepuis = (date) => (date ? yearsDiff(date, NOW) * 12 : null);
export const moyenne = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
export const aUnSalaire = (e) => e.salaire != null && e.salaire > 0;

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
