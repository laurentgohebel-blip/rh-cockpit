// ═══════════════════════════════════════════════════
// BENCHMARK SECTORIEL
// Presets par secteur :
//   - seuils ajustés (vigilance/alerte) qui remplacent les SEUILS du référentiel
//   - médianes de référence affichées à côté des indicateurs (« vs médiane »)
//
// Sources des médianes :
//   - DARES (turnover, temps partiel, pyramide des âges, mixité)
//   - INSEE Emploi (structure des contrats)
//   - Conventions collectives & rapports de branche
// Valeurs ordres de grandeur — à ajuster par l'auditeur en mission.
// ═══════════════════════════════════════════════════

// Secteur générique = pas d'override (seuils par défaut du référentiel)
export const SECTORS = [
  {
    id: "default",
    name: "Tous secteurs (générique)",
    description: "Seuils par défaut, sans ajustement sectoriel.",
    overrides: {},
    benchmarks: {},
  },
  {
    id: "proprete",
    name: "Propreté & services associés",
    description: "Convention propreté · forte part de TP, turnover élevé attendu.",
    overrides: {
      turnover:        { vigilance: 22, alerte: 35 },
      tempsPartiel:    { vigilance: 65 },
      anciennete2ans:  { vigilance: 50 },
      cddRatio:        { vigilance: 25, alerte: 40 },
    },
    benchmarks: {
      turnover:           { median: 22, label: "Médiane propreté : 22%" },
      "temps-partiel":    { median: 70, label: "Médiane propreté : 70%" },
      "structure-contrats": { median: 18, label: "Médiane propreté : 18%" },
      mixite:             { median: 60, label: "Médiane propreté : 60% F" },
      vieillissement:     { median: 30, label: "Médiane propreté : 30% de 55+" },
      anciennete:         { median: 45, label: "Médiane propreté : 45% < 2 ans" },
    },
  },
  {
    id: "btp",
    name: "BTP & construction",
    description: "Forte masculinité, turnover modéré, exposition AT élevée.",
    overrides: {
      vieillissement: { vigilance: 25, alerte: 35 },
    },
    benchmarks: {
      turnover:           { median: 14, label: "Médiane BTP : 14%" },
      "temps-partiel":    { median: 4, label: "Médiane BTP : 4%" },
      mixite:             { median: 12, label: "Médiane BTP : 12% F" },
      vieillissement:     { median: 22, label: "Médiane BTP : 22% de 55+" },
      "structure-contrats": { median: 12, label: "Médiane BTP : 12%" },
    },
  },
  {
    id: "sante",
    name: "Santé & action sociale",
    description: "Très forte féminisation, vieillissement marqué, temps partiel fréquent.",
    overrides: {
      tempsPartiel: { vigilance: 50 },
    },
    benchmarks: {
      turnover:           { median: 16, label: "Médiane santé : 16%" },
      "temps-partiel":    { median: 38, label: "Médiane santé : 38%" },
      mixite:             { median: 78, label: "Médiane santé : 78% F" },
      vieillissement:     { median: 32, label: "Médiane santé : 32% de 55+" },
      "structure-contrats": { median: 17, label: "Médiane santé : 17%" },
    },
  },
  {
    id: "tertiaire",
    name: "Tertiaire & services",
    description: "Turnover modéré, mixité équilibrée, CDI dominant.",
    overrides: {},
    benchmarks: {
      turnover:           { median: 15, label: "Médiane tertiaire : 15%" },
      "temps-partiel":    { median: 18, label: "Médiane tertiaire : 18%" },
      mixite:             { median: 52, label: "Médiane tertiaire : 52% F" },
      vieillissement:     { median: 21, label: "Médiane tertiaire : 21% de 55+" },
      "structure-contrats": { median: 10, label: "Médiane tertiaire : 10%" },
      "ecart-hf":         { median: 12, label: "Médiane tertiaire : 12% d'écart H/F" },
    },
  },
  {
    id: "industrie",
    name: "Industrie manufacturière",
    description: "Vieillissement élevé, anciennetés longues, faible TP.",
    overrides: {
      vieillissement: { vigilance: 28, alerte: 38 },
    },
    benchmarks: {
      turnover:           { median: 10, label: "Médiane industrie : 10%" },
      "temps-partiel":    { median: 8, label: "Médiane industrie : 8%" },
      mixite:             { median: 28, label: "Médiane industrie : 28% F" },
      vieillissement:     { median: 28, label: "Médiane industrie : 28% de 55+" },
      "structure-contrats": { median: 8, label: "Médiane industrie : 8%" },
      anciennete:         { median: 18, label: "Médiane industrie : 18% < 2 ans" },
    },
  },
];

export function getSector(id) {
  return SECTORS.find((s) => s.id === id) || SECTORS[0];
}

// Construit les seuils effectifs en fusionnant overrides sectoriels sur les seuils par défaut
export function resolveSeuils(baseSeuils, sectorId) {
  const sector = getSector(sectorId);
  const merged = { ...baseSeuils };
  for (const [key, override] of Object.entries(sector.overrides || {})) {
    merged[key] = { ...merged[key], ...override };
  }
  return merged;
}

// Renvoie l'objet benchmark d'un critère pour le secteur courant ; null si absent
export function getBenchmark(critId, sectorId) {
  const sector = getSector(sectorId);
  return sector.benchmarks?.[critId] || null;
}
