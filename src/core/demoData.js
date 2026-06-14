// ═══════════════════════════════════════════════════
// DONNÉES DE DÉMONSTRATION
// Génère un jeu d'employés réaliste et déterministe pour
// démontrer l'outil sans exposer de vraies données client.
// L'entreprise simulée s'appelle "Atlas Propreté SAS" — secteur
// propreté (mixité forte, temps partiel, turnover élevé).
// ═══════════════════════════════════════════════════

import { NOW } from "./parser";

const PRENOMS_F = [
  "Sophie", "Marie", "Camille", "Léa", "Emma", "Julie", "Pauline", "Manon",
  "Sarah", "Clara", "Chloé", "Inès", "Anaïs", "Margot", "Lucie", "Jeanne",
  "Élise", "Charlotte", "Aurélie", "Caroline", "Laure", "Mathilde", "Nathalie",
  "Stéphanie", "Carole", "Patricia", "Sandrine", "Christelle", "Élodie", "Karine",
];

const PRENOMS_M = [
  "Lucas", "Hugo", "Jules", "Maxime", "Théo", "Antoine", "Pierre", "Thomas",
  "Nicolas", "Julien", "Romain", "Benjamin", "Alexandre", "Vincent", "François",
  "Olivier", "Sébastien", "Christophe", "Jérôme", "Laurent", "Cédric", "Stéphane",
  "Mickaël", "Frédéric", "Bruno", "Pascal", "Patrick", "Philippe", "Bernard", "Michel",
];

const NOMS = [
  "MARTIN", "BERNARD", "DUBOIS", "THOMAS", "ROBERT", "RICHARD", "PETIT", "DURAND",
  "LEROY", "MOREAU", "SIMON", "LAURENT", "LEFEBVRE", "MICHEL", "GARCIA", "DAVID",
  "BERTRAND", "ROUX", "VINCENT", "FOURNIER", "MOREL", "GIRARD", "ANDRÉ", "LEFÈVRE",
  "MERCIER", "DUPONT", "LAMBERT", "BONNET", "FRANÇOIS", "MARTINEZ", "LEGRAND",
  "GAUTHIER", "GARNIER", "CHEVALIER", "ROBIN", "MASSON", "SANCHEZ", "GÉRARD",
  "NGUYEN", "PEREZ", "BERTHIER", "MENDES", "DA SILVA", "AHMED", "BENALI", "TRAORÉ",
];

const ETABS = ["01", "02", "03", "04"];
const VILLES = ["PARIS", "LYON", "BORDEAUX", "LILLE"];
const SERVICES = ["Production", "Administration", "Commercial", "Logistique"];

// Emplois variés (5 fréquents pour permettre comparaisons ecart-hf-emploi)
const EMPLOIS = [
  { label: "Agent de propreté", salaireBase: 1900, distri: 0.35 },
  { label: "Chef d'équipe", salaireBase: 2400, distri: 0.18 },
  { label: "Agent administratif", salaireBase: 2200, distri: 0.12 },
  { label: "Commercial(e)", salaireBase: 2800, distri: 0.10 },
  { label: "Manager", salaireBase: 3600, distri: 0.08 },
  { label: "Comptable", salaireBase: 2700, distri: 0.05 },
  { label: "Assistant(e) RH", salaireBase: 2500, distri: 0.04 },
  { label: "Technicien(ne)", salaireBase: 2600, distri: 0.04 },
  { label: "Responsable de site", salaireBase: 3200, distri: 0.03 },
  { label: "Directeur(rice)", salaireBase: 5500, distri: 0.01 },
];

// Helpers temporels — toutes les dates ancrées sur NOW pour reproductibilité
const yearsAgo = (y, m = 0, d = 0) =>
  new Date(NOW.getFullYear() - y, NOW.getMonth() - m, Math.max(1, NOW.getDate() - d));
const yearsAhead = (y, m = 0) =>
  new Date(NOW.getFullYear() + y, NOW.getMonth() + m, 15);

// Sélection déterministe dans un emploi selon distribution cumulée.
// Multiplication par 31 (premier avec 100) pour décorréler l'emploi du sexe (qui est
// basé sur id % 100). Sinon, tous les directeurs seraient du même sexe par construction.
function pickEmploi(i) {
  const ratio = ((i * 31) % 100) / 100;
  let cum = 0;
  for (const e of EMPLOIS) {
    cum += e.distri;
    if (ratio < cum) return e;
  }
  return EMPLOIS[0];
}

const EMPLOIS_TC_OBLIGATOIRE = /directeur|manager|responsable de site|comptable/i;

function makeEmployee(id, opts = {}) {
  const sexe = opts.sexe ?? (id % 100 < 58 ? "Femme" : "Homme"); // 58% F (secteur propreté)
  const prenom = sexe === "Femme"
    ? PRENOMS_F[id % PRENOMS_F.length]
    : PRENOMS_M[id % PRENOMS_M.length];
  const nom = NOMS[(id * 7 + 3) % NOMS.length];
  const age = opts.age ?? 25 + (id * 13) % 42; // 25..66
  const anciennete = opts.anciennete ?? +(0.5 + (id * 11) % 240 / 10).toFixed(1); // 0.5..24.5
  const emploi = opts.emploi ?? pickEmploi(id);

  // Salaire avec écart F/H de ~10% (proxy biais structurel) et bonus d'ancienneté
  const salaireBase = emploi.salaireBase || 2000;
  const ecartGenre = sexe === "Femme" ? 0.90 : 1.00;
  const bonusAnc = 1 + Math.min(anciennete, 20) * 0.012; // +1.2% par an plafonné à 20 ans
  const salaire = opts.salaire ?? Math.round(salaireBase * ecartGenre * bonusAnc);

  // Temps de travail : 70% TC, 25% TP 50-80%, 5% TP <30% (cas garde-fou ETP)
  // Sauf pour emplois d'encadrement (TC obligatoire dans la réalité)
  const tpCase = id % 100;
  const forceTC = EMPLOIS_TC_OBLIGATOIRE.test(emploi.label);
  let tempsComplet = true, heures = 151.67, pctActivite = null;
  if (opts.tempsComplet === false || (!forceTC && opts.tempsComplet === undefined && tpCase >= 70 && tpCase < 95)) {
    tempsComplet = false;
    heures = [76, 90, 121][id % 3]; // ~50%, 60%, 80%
  } else if (!forceTC && opts.tempsComplet === undefined && tpCase >= 95) {
    tempsComplet = false;
    heures = 30; // <20% → exclu de l'ETP
  }

  const dateNaiss = new Date(NOW.getFullYear() - age, (id * 31) % 12, ((id * 17) % 27) + 1);
  const dateEntree = opts.dateEntree ?? new Date(
    NOW.getFullYear() - Math.floor(anciennete),
    NOW.getMonth() - Math.round((anciennete % 1) * 12),
    Math.max(1, ((id * 7) % 27) + 1)
  );

  return {
    id,
    nom,
    prenom,
    sexe,
    dateNaiss,
    age,
    dateEntree,
    anciennete,
    dateSortie: opts.dateSortie ?? null,
    etab: opts.etab ?? ETABS[id % ETABS.length],
    service: opts.service ?? SERVICES[id % SERVICES.length],
    cdd: !!opts.cdd,
    handicap: !!opts.handicap,
    tempsComplet,
    salaire: salaire * (tempsComplet ? 1 : heures / 151.67), // salaire prorata si TP
    heures,
    ville: opts.ville ?? VILLES[id % VILLES.length],
    cp: ["75001", "69001", "33000", "59000"][id % 4],
    motifCode: opts.motifCode ?? null,
    motifLabel: opts.motifLabel ?? "Non renseigné",
    visiteDate: opts.visiteDate ?? null,
    actif: !opts.dateSortie,
    email: "",
    tel: "",
    voie: "",
    pctActivite,
    emploi: emploi.label,
    nationalite: opts.nationalite ?? "Française",
    etranger: opts.etranger ?? false,
    cartesSejourNumero: opts.cartesSejourNumero || "",
    cartesSejourFin: opts.cartesSejourFin ?? null,
    cartesTravailNumero: opts.cartesTravailNumero || "",
    cartesTravailFin: opts.cartesTravailFin ?? null,
  };
}

export function generateDemoEmployees() {
  const list = [];
  let id = 1;

  // ─── 138 actifs « ordinaires » ───
  for (let i = 0; i < 138; i++) {
    const idx = id++;
    // 60% ont une visite médicale renseignée — dont ~30% expirées (>5 ans)
    let visiteDate = null;
    const v = idx % 100;
    if (v < 30) visiteDate = yearsAgo(2, idx % 12); // récente
    else if (v < 45) visiteDate = yearsAgo(4, 0); // récente limite
    else if (v < 60) visiteDate = yearsAgo(6, idx % 12); // expirée (> 5 ans)
    // sinon null

    list.push(makeEmployee(idx, { visiteDate }));
  }

  // ─── 3 salariés RQTH (sur 145 actifs → ~2%, déclenche non-conformité OETH) ───
  list.push(makeEmployee(id++, { handicap: true, visiteDate: yearsAgo(2) }));
  list.push(makeEmployee(id++, { handicap: true, sexe: "Femme", visiteDate: yearsAgo(3) }));
  list.push(makeEmployee(id++, { handicap: true, visiteDate: yearsAgo(1, 6) }));

  // ─── 4 CDD > 18 mois (non-conformité cdd-cadre) ───
  list.push(makeEmployee(id++, { cdd: true, anciennete: 1.8, dateEntree: yearsAgo(1, 9), visiteDate: yearsAgo(1) }));
  list.push(makeEmployee(id++, { cdd: true, anciennete: 2.0, dateEntree: yearsAgo(2), sexe: "Femme", visiteDate: yearsAgo(2) }));
  list.push(makeEmployee(id++, { cdd: true, anciennete: 1.7, dateEntree: yearsAgo(1, 8) }));
  list.push(makeEmployee(id++, { cdd: true, anciennete: 2.5, dateEntree: yearsAgo(2, 6), sexe: "Femme", visiteDate: yearsAgo(3) }));

  // ─── Salariés étrangers (panel pour le critère titre-sejour) ───
  // 1. Marocain, carte valide encore 3 ans → conforme
  list.push(makeEmployee(id++, {
    sexe: "Homme", nationalite: "Marocaine", etranger: true,
    cartesSejourNumero: "MA2024-7821", cartesSejourFin: yearsAhead(3),
    visiteDate: yearsAgo(1),
  }));
  // 2. Tunisien sans aucune doc → non-conforme + risque
  list.push(makeEmployee(id++, {
    sexe: "Homme", nationalite: "Tunisienne", etranger: true,
    visiteDate: yearsAgo(2),
  }));
  // 3. Algérien carte expirée il y a 4 mois → non-conforme + risque
  list.push(makeEmployee(id++, {
    sexe: "Femme", nationalite: "Algérienne", etranger: true,
    cartesSejourNumero: "AL2018-9933", cartesSejourFin: yearsAgo(0, 4),
    visiteDate: yearsAgo(3),
  }));
  // 4. Sénégalais expirant dans 50 jours → vigilance
  list.push(makeEmployee(id++, {
    sexe: "Homme", nationalite: "Sénégalaise", etranger: true,
    cartesSejourNumero: "SN2021-4421", cartesSejourFin: new Date(NOW.getTime() + 50 * 864e5),
    visiteDate: yearsAgo(2),
  }));
  // 5. Brésilien carte valide 1 an
  list.push(makeEmployee(id++, {
    sexe: "Femme", nationalite: "Brésilienne", etranger: true,
    cartesSejourNumero: "BR2023-6677", cartesSejourFin: yearsAhead(1),
    visiteDate: yearsAgo(2),
  }));
  // 6. Portugais (UE) mais marqué étranger=oui par erreur → incohérence (vigilance)
  list.push(makeEmployee(id++, {
    sexe: "Homme", nationalite: "Portugaise", etranger: true,
    visiteDate: yearsAgo(2),
  }));
  // 7. Italien marqué étranger=non correctement
  list.push(makeEmployee(id++, {
    sexe: "Femme", nationalite: "Italienne", etranger: false,
    visiteDate: yearsAgo(3),
  }));

  // ─── Sorties N-1 (avant-dernière année, fenêtre du critère turnover) ───
  // 5 démissions + 2 fins de CDD + 2 licenciements + 1 retraite + 1 rupture conv.
  const motifsN1 = [
    { l: "Démission", c: 59 },
    { l: "Démission", c: 59 },
    { l: "Démission", c: 59 },
    { l: "Démission", c: 59 },
    { l: "Démission", c: 59 },
    { l: "Fin de CDD", c: 31 },
    { l: "Fin de CDD", c: 31 },
    { l: "Licenciement éco.", c: 36 },
    { l: "Licenciement autre", c: 37 },
    { l: "Départ retraite", c: 65 },
    { l: "Rupture conventionnelle", c: 43 },
  ];
  motifsN1.forEach((m, i) => {
    list.push(makeEmployee(id++, {
      age: 30 + i * 3,
      anciennete: 2 + i,
      dateSortie: yearsAgo(0, 6 + (i % 5)), // entre 6 et 10 mois (= avant-dernière année)
      motifLabel: m.l, motifCode: m.c,
    }));
  });

  // ─── Sorties année courante (incomplète) ───
  const motifsN0 = [
    { l: "Démission", c: 59 },
    { l: "Démission", c: 59 },
    { l: "Fin de CDD", c: 31 },
    { l: "Rupture conventionnelle", c: 43 },
  ];
  motifsN0.forEach((m, i) => {
    list.push(makeEmployee(id++, {
      age: 28 + i * 4,
      anciennete: 1 + i * 1.5,
      dateSortie: yearsAgo(0, 1 + i),
      motifLabel: m.l, motifCode: m.c,
    }));
  });

  // ─── Enrichissement DSN simulé (pour démontrer le domaine Santé) ───
  // En usage réel, ces données viennent du croisement NIR avec une vraie DSN.
  const actifs = list.filter((e) => e.actif);
  actifs.forEach((e, idx) => {
    const arrets = [];
    if (idx % 6 === 2) arrets.push({ motif: "01", motifLabel: "Maladie", jours: 6 + (idx % 5) * 3 }); // ~1/6 en arrêt maladie
    if (idx === 12) arrets.push({ motif: "05", motifLabel: "Accident du travail", jours: 24 }); // 1 AT
    if (idx === 30) arrets.push({ motif: "05", motifLabel: "Accident du travail", jours: 9 }); // 2e AT → non-conforme
    if (idx === 21) arrets.push({ motif: "02", motifLabel: "Maternité", jours: 31 }); // exclue de l'absentéisme maladie
    e.dsn = {
      arrets,
      brut: Math.round((e.salaire || 0) * 1.3),
      netVerse: Math.round((e.salaire || 0) * 0.78),
      pcs: "684a",
      natureDsn: e.cdd ? "02" : "01",
      quotiteRef: 151.67,
      quotiteTravail: e.tempsComplet ? 151.67 : 90,
    };
  });

  return list;
}

// Nom de fichier symbolique utilisé pour la traçabilité
export const DEMO_FILENAME = "Démonstration · Atlas Propreté SAS.xlsx";
