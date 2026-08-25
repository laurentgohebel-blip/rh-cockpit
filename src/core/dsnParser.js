// ═══════════════════════════════════════════════════
// PARSER DSN (Déclaration Sociale Nominative)
// Format normé NEODeS — fichier texte plat « rubrique,'valeur' ».
// On extrait uniquement les blocs à forte valeur d'audit (pas toute la norme).
//
// DEUX USAGES :
//   — ENRICHIR un snapshot de paie (`enrichWithDsn`, croisement par NIR) ;
//   — SERVIR DE SOURCE À ELLE SEULE (`dsnToEmployees`), pour auditer une
//     entreprise dont on n'a que les DSN.
// ═══════════════════════════════════════════════════

import { nirKey, yearsDiff, NOW } from "./parser";

// ─── Tables de libellés (codes normés DSN) ───
export const MOTIFS_ARRET = {
  "01": "Maladie",
  "02": "Maternité",
  "03": "Paternité / accueil de l'enfant",
  "04": "Congé d'adoption",
  "05": "Accident du travail",
  "06": "Maladie professionnelle",
  "07": "Accident de trajet",
  "08": "Temps partiel thérapeutique",
};

export const NATURE_CONTRAT = {
  "01": "CDI",
  "02": "CDD",
  "03": "Intérim",
  "07": "CDI intermittent",
  "08": "CDI intérimaire",
  "09": "Contrat de travail temporaire",
  "10": "Apprentissage",
  "20": "Professionnalisation",
};

// ─── Helpers ───
// Date DSN = JJMMAAAA (8 chiffres)
export function parseDsnDate(s) {
  const d = String(s || "").trim();
  if (!/^\d{8}$/.test(d)) return null;
  const jour = +d.slice(0, 2), mois = +d.slice(2, 4), annee = +d.slice(4, 8);
  const dt = new Date(annee, mois - 1, jour);
  return isNaN(dt) ? null : dt;
}

const num = (s) => {
  const v = parseFloat(String(s || "").replace(",", "."));
  return isNaN(v) ? null : v;
};

const joursEntre = (a, b) => (a && b ? Math.max(0, Math.round((b - a) / 864e5)) : 0);

// ─── Parser principal ───
// Renvoie une structure exploitable + des agrégats prêts à l'emploi.
export function parseDsn(text) {
  const lines = String(text).split(/\r?\n/);

  const meta = { logiciel: "", siren: "", raisonSociale: "", nic: "", idcc: "", moisPrincipal: null };
  const individus = [];
  let ind = null; // individu courant
  let ctr = null; // contrat courant

  for (const line of lines) {
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const code = line.slice(0, comma);
    const val = line.slice(comma + 1).replace(/^'|'$/g, "").trim();

    // En-tête / entreprise / établissement
    if (code === "S10.G00.00.001") meta.logiciel = val;
    else if (code === "S21.G00.06.001") meta.siren = val;
    else if (code === "S21.G00.06.003") meta.raisonSociale = val;
    else if (code === "S21.G00.11.001") meta.nic = val;
    else if (code === "S20.G00.05.005") meta.moisPrincipal = val; // date du mois principal déclaré

    // ── Individu (bloc 30) ──
    else if (code === "S21.G00.30.001") {
      ind = {
        nir: val, nirKey: nirKey(val),
        nom: "", prenom: "", sexe: "", dateNaiss: null, matricule: "",
        contrats: [], arrets: [], suspensions: [], finsContrat: [],
        remunerations: [], primes: [],
        versement: { netFiscal: null, netVerse: null, brut: 0 },
        _curBase: null,
      };
      individus.push(ind);
      ctr = null;
    } else if (ind && code === "S21.G00.30.002") ind.nom = val;
    else if (ind && code === "S21.G00.30.004") ind.prenom = val;
    else if (ind && code === "S21.G00.30.005") ind.sexe = val === "01" ? "Homme" : val === "02" ? "Femme" : "";
    else if (ind && code === "S21.G00.30.006") ind.dateNaiss = parseDsnDate(val);
    else if (ind && code === "S21.G00.30.019") ind.matricule = val;

    // ── Contrat (bloc 40) ──
    else if (ind && code === "S21.G00.40.001") {
      ctr = { dateDebut: parseDsnDate(val), pcs: "", libelleEmploi: "", nature: "", quotiteRef: null, quotiteTravail: null, idcc: "" };
      ind.contrats.push(ctr);
    } else if (ctr && code === "S21.G00.40.004") ctr.pcs = val;
    else if (ctr && code === "S21.G00.40.006") ctr.libelleEmploi = val;
    else if (ctr && code === "S21.G00.40.007") ctr.nature = val;
    else if (ctr && code === "S21.G00.40.012") ctr.quotiteRef = num(val);
    else if (ctr && code === "S21.G00.40.013") ctr.quotiteTravail = num(val);
    else if (ctr && code === "S21.G00.40.017") { ctr.idcc = val; if (!meta.idcc) meta.idcc = val; }

    // ── Arrêt de travail (bloc 60) ──
    else if (ind && code === "S21.G00.60.001") {
      ind.arrets.push({ motif: val, motifLabel: MOTIFS_ARRET[val] || `Code ${val}`, dernierJour: null, dateFin: null, dateReprise: null });
    } else if (ind?.arrets.length && code === "S21.G00.60.002") ind.arrets.at(-1).dernierJour = parseDsnDate(val);
    else if (ind?.arrets.length && code === "S21.G00.60.003") ind.arrets.at(-1).dateFin = parseDsnDate(val);
    else if (ind?.arrets.length && code === "S21.G00.60.010") ind.arrets.at(-1).dateReprise = parseDsnDate(val);

    // ── Autre suspension (bloc 62) ──
    else if (ind && code === "S21.G00.62.001") {
      ind.suspensions.push({ debut: parseDsnDate(val), motif: "", fin: null });
    } else if (ind?.suspensions.length && code === "S21.G00.62.002") ind.suspensions.at(-1).motif = val;
    else if (ind?.suspensions.length && code === "S21.G00.62.006") ind.suspensions.at(-1).fin = parseDsnDate(val);

    // ── Fin de contrat (bloc 65) ──
    else if (ind && code === "S21.G00.65.001") {
      ind.finsContrat.push({ motif: val, dateFin: null });
    } else if (ind?.finsContrat.length && code === "S21.G00.65.002") ind.finsContrat.at(-1).dateFin = parseDsnDate(val);

    // ── Versement (bloc 50) — net fiscal / net versé ──
    else if (ind && code === "S21.G00.50.002") ind.versement.netFiscal = num(val);
    else if (ind && code === "S21.G00.50.004") ind.versement.netVerse = num(val);

    // ── Base assujettie (bloc 78) — le brut = code 03 (assiette brute déplafonnée SS) ──
    else if (ind && code === "S21.G00.78.001") ind._curBase = val;
    else if (ind && code === "S21.G00.78.004" && ind._curBase === "03") {
      ind.versement.brut += num(val) || 0;
    }

    // ── Rémunération (bloc 51) ──
    else if (ind && code === "S21.G00.51.011") {
      ind.remunerations.push({ type: val, montant: null });
    } else if (ind?.remunerations.length && code === "S21.G00.51.013") ind.remunerations.at(-1).montant = num(val);

    // ── Prime (bloc 52) ──
    else if (ind && code === "S21.G00.52.001") {
      ind.primes.push({ type: val, montant: null });
    } else if (ind?.primes.length && code === "S21.G00.52.002") ind.primes.at(-1).montant = num(val);
  }

  // Calcule la durée des arrêts (jours) + nettoyage des champs internes
  individus.forEach((i) => {
    delete i._curBase;
    if (i.versement.brut === 0) i.versement.brut = null;
    i.arrets.forEach((a) => {
      const debut = a.dernierJour ? new Date(a.dernierJour.getTime() + 864e5) : null; // 1er jour d'absence
      const fin = a.dateReprise ? new Date(a.dateReprise.getTime() - 864e5) : a.dateFin;
      a.jours = joursEntre(debut, fin) + (debut && fin ? 1 : 0);
    });
  });

  return { meta, individus };
}

// ═══════════════════════════════════════════════════
// RAIL 2 AUTONOME — la DSN comme source PREMIÈRE
//
// Jusqu'ici la DSN ne pouvait qu'enrichir un snapshot de paie. Elle porte
// pourtant l'essentiel du modèle universel : identité, contrats, quotités,
// rémunérations, fins de contrat. `dsnToEmployees` en fait une source
// autonome — on audite avec la paie, avec la DSN, ou avec les deux.
//
// CE QUE LA DSN MENSUELLE NE PORTE PAS, et qui doit rester VIDE plutôt que
// faussement à zéro : suivi médical, RQTH, nationalité et titres de séjour.
// Ces champs sortent à `null` : les critères qui en dépendent deviennent
// « non concluants » au lieu de conclure « non conforme » sur une donnée
// absente. Un rapport ne doit jamais reprocher à une entreprise ce que le
// fichier ne permettait pas de vérifier.
// ═══════════════════════════════════════════════════

// Origine de chaque champ d'un salarié, pour que le rapport puisse dire
// d'où vient un constat. Un critère lu depuis la DSN (déclaratif officiel)
// et le même lu depuis un export de paie n'ont pas la même force.
export const SOURCE = { paie: "paie", dsn: "dsn", absent: "absent" };

// Champs qu'une DSN mensuelle ne contient pas.
export const CHAMPS_HORS_DSN = ["visiteDate", "handicap", "nationalite", "etranger",
  "cartesSejourNumero", "cartesSejourFin", "cartesTravailNumero", "cartesTravailFin"];

// Le contrat retenu pour la fiche : le plus récemment commencé.
const contratCourant = (contrats) =>
  [...(contrats || [])].filter((c) => c.dateDebut).sort((a, b) => b.dateDebut - a.dateDebut)[0]
  || (contrats || [])[0] || {};

// L'ancienneté se compte depuis le PREMIER contrat connu, pas depuis le dernier :
// un salarié enchaînant trois CDD n'a pas trois mois d'ancienneté.
const premiereEntree = (contrats) =>
  [...(contrats || [])].filter((c) => c.dateDebut).sort((a, b) => a.dateDebut - b.dateDebut)[0]?.dateDebut || null;

export function dsnToEmployees(dsn, { motifLabels = {} } = {}) {
  if (!dsn || !dsn.individus?.length) return [];
  const nic = dsn.meta?.nic || "";

  return dsn.individus.map((ind, idx) => {
    const c = contratCourant(ind.contrats);
    const entree = premiereEntree(ind.contrats);
    // Fin de contrat la plus récente : c'est elle qui rend le salarié inactif.
    const fin = [...(ind.finsContrat || [])].filter((f) => f.dateFin).sort((a, b) => b.dateFin - a.dateFin)[0] || null;
    const motifCode = fin && /^\d+$/.test(String(fin.motif)) ? parseInt(fin.motif, 10) : null;

    // Temps partiel : la quotité travaillée rapportée à la quotité de
    // référence de l'établissement. Sans quotité de référence, on ne
    // tranche pas — `null` plutôt qu'un « temps complet » supposé.
    const qRef = c.quotiteRef, qTrav = c.quotiteTravail;
    const tempsComplet = qRef != null && qRef > 0 && qTrav != null ? qTrav >= qRef : null;

    const brut = ind.versement?.brut ?? null;

    return {
      id: idx,
      nom: ind.nom || "",
      prenom: ind.prenom || "",
      sexe: ind.sexe || "",
      dateNaiss: ind.dateNaiss || null,
      age: ind.dateNaiss ? Math.floor(yearsDiff(ind.dateNaiss, NOW)) : null,
      dateEntree: entree,
      anciennete: entree ? Math.round(yearsDiff(entree, NOW) * 10) / 10 : null,
      dateSortie: fin?.dateFin || null,
      etab: nic,
      service: "",
      cdd: c.nature === "02",
      // Hors DSN mensuelle → null, jamais false (voir l'en-tête de section).
      handicap: null,
      tempsComplet,
      // Le brut du mois n'est pas le salaire de base contractuel : il inclut
      // primes et heures supplémentaires. On le reprend faute de mieux, et
      // la provenance le dit — un écart salarial calculé sur du brut mensuel
      // se lit autrement qu'un écart calculé sur des salaires de base.
      salaire: brut,
      heures: qTrav ?? null,
      ville: "", cp: "",
      motifCode,
      motifLabel: (motifCode != null && motifLabels[motifCode]) || MOTIFS_FIN_CONTRAT[String(fin?.motif || "").padStart(3, "0")] || (fin ? `Code ${fin.motif}` : "Non renseigné"),
      visiteDate: null,
      actif: !fin,
      email: "", tel: "", voie: "",
      pctActivite: qRef != null && qRef > 0 && qTrav != null ? Math.round((qTrav / qRef) * 100) : null,
      emploi: c.libelleEmploi || c.pcs || "",
      nir: ind.nir || "",
      nationalite: "", etranger: null,
      cartesSejourNumero: "", cartesSejourFin: null,
      cartesTravailNumero: "", cartesTravailFin: null,
      // Les données propres à la DSN restent accessibles aux critères.
      dsn: {
        arrets: ind.arrets, suspensions: ind.suspensions,
        brut, netVerse: ind.versement?.netVerse ?? null,
        pcs: c.pcs || "", natureDsn: c.nature || "",
        quotiteRef: qRef, quotiteTravail: qTrav,
        contrats: ind.contrats || [], finsContrat: ind.finsContrat || [],
      },
      _src: sourceMap(SOURCE.dsn),
    };
  });
}

// Marque la provenance de chaque champ du modèle.
function sourceMap(origine) {
  const m = {};
  for (const champ of CHAMPS_MODELE) m[champ] = origine;
  if (origine === SOURCE.dsn) for (const champ of CHAMPS_HORS_DSN) m[champ] = SOURCE.absent;
  return m;
}

const CHAMPS_MODELE = ["nom", "prenom", "sexe", "dateNaiss", "dateEntree", "dateSortie",
  "motifLabel", "etab", "service", "cdd", "handicap", "tempsComplet", "salaire", "heures",
  "ville", "cp", "visiteDate", "emploi", "nir", "nationalite", "etranger",
  "cartesSejourNumero", "cartesSejourFin", "cartesTravailNumero", "cartesTravailFin"];

/* Motifs de rupture DSN (bloc « fin de contrat »).
   ⚠ Table de LIBELLÉS, à confronter au cahier technique NEODeS en vigueur :
   la nomenclature évolue d'une version à l'autre. Un code absent de cette
   table s'affiche tel quel (« Code 062 ») plutôt que d'être traduit à tort. */
export const MOTIFS_FIN_CONTRAT = {
  "011": "Licenciement suite à liquidation ou redressement judiciaire",
  "012": "Licenciement pour motif économique",
  "014": "Licenciement pour fin de chantier",
  "015": "Licenciement pour autre motif",
  "020": "Fin de CDD",
  "025": "Fin de période d'essai à l'initiative de l'employeur",
  "026": "Fin de période d'essai à l'initiative du salarié",
  "031": "Démission",
  "034": "Prise d'acte de la rupture",
  "035": "Rupture conventionnelle",
  "036": "Départ à la retraite à l'initiative du salarié",
  "037": "Mise à la retraite par l'employeur",
  "038": "Rupture pour force majeure",
  "039": "Rupture d'un commun accord",
  "043": "Rupture conventionnelle collective",
  "059": "Rupture anticipée d'un CDD",
  "065": "Décès",
  "081": "Fin de contrat d'apprentissage",
  "084": "Fin de contrat de professionnalisation",
};

// ─── Croisement DSN ↔ snapshot paie (par NIR) ───
// Attache à chaque salarié rapproché un objet `dsn` exploitable par les critères.
export function enrichWithDsn(employees, dsn) {
  if (!dsn || !dsn.individus?.length) return { employees, matched: 0, coverage: 0 };
  const byKey = new Map();
  dsn.individus.forEach((i) => { if (i.nirKey) byKey.set(i.nirKey, i); });

  let matched = 0;
  const enriched = employees.map((e) => {
    const key = nirKey(e.nir);
    const ind = key ? byKey.get(key) : null;
    if (!ind) return e;
    matched++;
    const c = ind.contrats[0] || {};
    return {
      ...e,
      dsn: {
        arrets: ind.arrets,
        suspensions: ind.suspensions,
        brut: ind.versement.brut,
        netVerse: ind.versement.netVerse,
        pcs: c.pcs || "",
        natureDsn: c.nature || "",
        quotiteRef: c.quotiteRef,
        quotiteTravail: c.quotiteTravail,
      },
    };
  });
  return { employees: enriched, matched, coverage: employees.length ? matched / employees.length : 0 };
}

// ─── Cohérence des sources (fréquences/périodes différentes) ───
// La DSN est mensuelle ; le fichier de paie est un instantané sans date explicite.
// On détecte les divergences de périmètre/période via le croisement NIR.
const MOIS_FR_COH = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function checkDsnCoherence(employees, dsn) {
  if (!dsn || !dsn.individus?.length) return null;
  const actifs = (employees || []).filter((e) => e.actif);
  const paieKeys = new Set(actifs.map((e) => nirKey(e.nir)).filter(Boolean));
  const dsnKeys = dsn.individus.map((i) => i.nirKey).filter(Boolean);
  const dsnKeySet = new Set(dsnKeys);

  const matched = dsnKeys.filter((k) => paieKeys.has(k)).length;
  const dsnOnly = dsnKeys.filter((k) => !paieKeys.has(k)).length;       // payés en DSN, absents de la paie
  const paieOnly = [...paieKeys].filter((k) => !dsnKeySet.has(k)).length; // actifs paie sans ligne DSN

  // Mois DSN + ancienneté du fichier par rapport à aujourd'hui
  const m = String(dsn.meta.moisPrincipal || "").trim();
  let moisLabel = "—", moisAgeMois = null;
  if (/^\d{8}$/.test(m)) {
    const mois = +m.slice(2, 4), annee = +m.slice(4, 8);
    moisLabel = `${MOIS_FR_COH[mois - 1] || "?"} ${annee}`;
    const now = new Date();
    moisAgeMois = (now.getFullYear() - annee) * 12 + (now.getMonth() + 1 - mois);
  }

  const warnings = [];
  const pctDsnOnly = dsn.individus.length ? dsnOnly / dsn.individus.length : 0;
  if (pctDsnOnly > 0.15) {
    warnings.push({
      level: "warning",
      message: `${dsnOnly} salarié${dsnOnly > 1 ? "s" : ""} déclaré${dsnOnly > 1 ? "s" : ""} dans la DSN ${dsnOnly > 1 ? "sont absents" : "est absent"} du fichier de paie. Les deux sources portent peut-être sur des périodes ou périmètres différents (sorties depuis l'export paie ? établissement distinct ?).`,
    });
  }
  if (moisAgeMois != null && moisAgeMois >= 3) {
    warnings.push({
      level: "info",
      message: `La DSN porte sur ${moisLabel}, soit il y a ~${moisAgeMois} mois. Vérifiez qu'elle est contemporaine du fichier de paie ; sinon les indicateurs croisés mélangent deux temporalités.`,
    });
  }

  return {
    dsnMois: moisLabel,
    moisAgeMois,
    dsnEffectif: dsn.individus.length,
    paieEffectif: actifs.length,
    matched,
    dsnOnly,
    paieOnly,
    warnings,
  };
}

// ─── Agrégats d'audit ───
export function dsnAggregates(dsn) {
  const inds = dsn.individus;
  const n = inds.length;

  // Absentéisme (bloc 60) par motif
  const absParMotif = {};
  let joursArretTotal = 0;
  inds.forEach((i) => i.arrets.forEach((a) => {
    absParMotif[a.motifLabel] = (absParMotif[a.motifLabel] || 0) + a.jours;
    joursArretTotal += a.jours;
  }));

  // AT/MP = motifs 05, 06, 07
  const joursAtMp = inds.reduce((s, i) =>
    s + i.arrets.filter((a) => ["05", "06", "07"].includes(a.motif)).reduce((x, a) => x + a.jours, 0), 0);
  const nbArrets = inds.reduce((s, i) => s + i.arrets.length, 0);

  // Masse salariale — somme du brut bloc 50.013
  const masseBrute = inds.reduce((s, i) => s + (i.versement.brut || 0), 0);
  const masseNetVerse = inds.reduce((s, i) => s + (i.versement.netVerse || 0), 0);

  // ETP réel via quotité
  const etpTotal = inds.reduce((s, i) => {
    const c = i.contrats[0];
    if (!c || !c.quotiteRef) return s + 1;
    return s + Math.min(1, (c.quotiteTravail || c.quotiteRef) / c.quotiteRef);
  }, 0);

  return {
    nbSalaries: n,
    nbArrets,
    joursArretTotal,
    joursAtMp,
    absParMotif,
    masseBrute: Math.round(masseBrute),
    masseNetVerse: Math.round(masseNetVerse),
    etpTotal: Math.round(etpTotal * 10) / 10,
    idcc: dsn.meta.idcc,
  };
}
