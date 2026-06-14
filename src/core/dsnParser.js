// ═══════════════════════════════════════════════════
// PARSER DSN (Déclaration Sociale Nominative)
// Format normé NEODeS — fichier texte plat « rubrique,'valeur' ».
// On extrait uniquement les blocs à forte valeur d'audit (pas toute la norme).
// Rail 2 : ces données enrichissent le snapshot paie via le NIR (clé de jointure).
// ═══════════════════════════════════════════════════

import { nirKey } from "./parser";

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
