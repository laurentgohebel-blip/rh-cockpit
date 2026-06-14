// ═══════════════════════════════════════════════════
// PROFILS LOGICIELS RH
// Chaque profil définit les noms de colonnes attendus
// pour un logiciel donné. Le système tente de matcher
// automatiquement à l'import.
// ═══════════════════════════════════════════════════

// Champs du modèle de données universel
export const FIELDS = [
  { key: "nom",            label: "Nom",                required: true,  icon: "👤" },
  { key: "prenom",         label: "Prénom",             required: true,  icon: "👤" },
  { key: "sexe",           label: "Sexe",               required: true,  icon: "⚧" },
  { key: "dateNaiss",      label: "Date de naissance",  required: false, icon: "🎂" },
  { key: "dateEntree",     label: "Date d'entrée",      required: true,  icon: "📅" },
  { key: "dateSortie",     label: "Date de sortie",     required: false, icon: "📅" },
  { key: "motifSortie",    label: "Motif de sortie",    required: false, icon: "📋" },
  { key: "etablissement",  label: "Établissement",      required: false, icon: "🏢" },
  { key: "ville",          label: "Ville",              required: false, icon: "📍" },
  { key: "cp",             label: "Code postal",        required: false, icon: "📍" },
  { key: "typeContrat",    label: "CDD / CDI",          required: false, icon: "📝" },
  { key: "tempsComplet",   label: "Temps complet/partiel", required: false, icon: "⏱️" },
  { key: "salaire",        label: "Salaire de base",    required: false, icon: "💰" },
  { key: "heuresMois",     label: "Heures / mois",      required: false, icon: "🕐" },
  { key: "visiteMedicale", label: "Date visite médicale", required: false, icon: "🏥" },
  { key: "handicap",       label: "Handicap / RQTH",    required: false, icon: "♿" },
  { key: "email",          label: "Email",              required: false, icon: "✉️" },
  { key: "telephone",      label: "Téléphone",          required: false, icon: "📞" },
  { key: "service",        label: "Service",            required: false, icon: "🏷️" },
  { key: "nir",            label: "N° sécurité sociale (NIR)", required: false, icon: "🔑" },
  { key: "emploi",         label: "Emploi / libellé poste", required: false, icon: "💼" },
  { key: "nationalite",        label: "Nationalité",                required: false, icon: "🌍" },
  { key: "etranger",           label: "Étranger (oui/non)",          required: false, icon: "🛂" },
  { key: "cartesSejourNumero", label: "N° carte de séjour",          required: false, icon: "📄" },
  { key: "cartesSejourFin",    label: "Date fin carte de séjour",    required: false, icon: "📅" },
  { key: "cartesTravailNumero",label: "N° carte de travail",         required: false, icon: "📄" },
  { key: "cartesTravailFin",   label: "Date fin carte de travail",   required: false, icon: "📅" },
];

// ─── Profils logiciels ───
// Chaque entrée: clé du champ → liste de noms de colonnes possibles (insensible à la casse)
export const PROFILES = [
  {
    id: "quadratus",
    name: "Quadratus",
    description: "Export \"Liste des employés\"",
    // Mots-clés pour détecter automatiquement ce profil
    detect: ["quadratus", "numéro insee", "code cipdz", "catégorie tds"],
    mapping: {
      nom:            ["nom"],
      prenom:         ["prénom", "prenom"],
      sexe:           ["sexe"],
      dateNaiss:      ["date naiss"],
      dateEntree:     ["date d'entrée", "date d'entree", "date entree"],
      dateSortie:     ["date de sortie", "date sortie"],
      motifSortie:    ["motif"],
      etablissement:  ["étab", "etab"],
      ville:          ["ville"],
      cp:             ["cp"],
      typeContrat:    ["cdd"],
      tempsComplet:   ["code cipdz"],
      salaire:        ["salaire de base", "salaire"],
      heuresMois:     ["nbheuremois", "nb heure"],
      visiteMedicale: ["date visite"],
      handicap:       ["handicapé", "handicape"],
      email:          ["e-mail", "email"],
      telephone:      ["tél", "tel"],
      service:        ["service"],
      nir:            ["numéro insee", "n° insee", "n°insee"],
      emploi:         ["emploi", "libellé poste", "intitulé poste"],
      nationalite:         ["nationalité"],
      etranger:            ["étranger"],
      // Quadratus a 3 paires "N°/Date obt./Date expir." (séjour, travail, permis conduire)
      // → on cible la N-ème occurrence de "Date expir." (0=séjour, 1=travail, 2=permis)
      cartesSejourNumero:  ["n° carte séjour"],
      cartesSejourFin:     [{ contains: "date expir", nth: 0 }],
      cartesTravailNumero: ["n° carte travail"],
      cartesTravailFin:    [{ contains: "date expir", nth: 1 }],
    },
  },
  {
    id: "sage",
    name: "Sage Paie",
    description: "Export liste salariés",
    detect: ["matricule", "catégorie professionnelle", "coefficient"],
    mapping: {
      nom:            ["nom", "nom salarié", "nom salarie"],
      prenom:         ["prénom", "prenom", "prenom salarié"],
      sexe:           ["sexe", "civilité", "civilite"],
      dateNaiss:      ["date de naissance", "date naissance", "né(e) le"],
      dateEntree:     ["date d'entrée", "date entree", "date embauche"],
      dateSortie:     ["date de sortie", "date sortie", "date départ"],
      motifSortie:    ["motif sortie", "motif départ", "motif"],
      etablissement:  ["établissement", "etablissement", "code établissement"],
      ville:          ["ville", "commune"],
      cp:             ["code postal", "cp"],
      typeContrat:    ["type contrat", "nature contrat", "contrat"],
      tempsComplet:   ["temps travail", "type horaire", "modalité temps"],
      salaire:        ["salaire base", "salaire mensuel", "base mensuelle"],
      heuresMois:     ["horaire mensuel", "heures mensuelles", "durée mensuelle"],
      visiteMedicale: ["visite médicale", "date visite"],
      handicap:       ["travailleur handicapé", "rqth", "handicap"],
      email:          ["email", "e-mail", "adresse mail"],
      telephone:      ["téléphone", "tel", "portable"],
      service:        ["service", "département"],
      nir:            ["n° sécurité sociale", "numéro sécurité sociale", "nir", "n° sécu", "matricule sécurité sociale"],
      emploi:         ["emploi", "libellé emploi", "intitulé poste", "fonction"],
      nationalite:         ["nationalité", "pays"],
      etranger:            ["étranger", "salarié étranger"],
      cartesSejourNumero:  ["n° carte séjour", "numéro carte séjour", "n° titre"],
      cartesSejourFin:     ["fin carte séjour", "expiration carte séjour", "validité carte séjour"],
      cartesTravailNumero: ["n° carte travail", "numéro carte travail", "n° autorisation travail"],
      cartesTravailFin:    ["fin carte travail", "expiration carte travail", "validité autorisation travail"],
    },
  },
  {
    id: "cegid",
    name: "Cegid HR",
    description: "Export données salariés",
    detect: ["cegid", "code société", "numéro salarié"],
    mapping: {
      nom:            ["nom", "nom de famille"],
      prenom:         ["prénom", "prenom"],
      sexe:           ["sexe", "genre"],
      dateNaiss:      ["date de naissance", "date naissance"],
      dateEntree:     ["date d'entrée", "date entrée"],
      dateSortie:     ["date de sortie", "date sortie"],
      motifSortie:    ["motif de sortie", "code sortie"],
      etablissement:  ["établissement", "code établissement", "site"],
      ville:          ["ville", "commune"],
      cp:             ["code postal"],
      typeContrat:    ["type de contrat", "nature contrat"],
      tempsComplet:   ["type temps", "modalité"],
      salaire:        ["salaire de base", "rémunération"],
      heuresMois:     ["heures contractuelles", "durée travail"],
      visiteMedicale: ["visite médicale"],
      handicap:       ["handicap", "rqth"],
      email:          ["email", "courriel"],
      telephone:      ["téléphone"],
      service:        ["service", "direction"],
      nir:            ["n° sécurité sociale", "numéro insee", "nir", "n° insee"],
      emploi:         ["emploi", "libellé poste", "intitulé fonction", "fonction"],
      nationalite:         ["nationalité", "pays naissance"],
      etranger:            ["étranger"],
      cartesSejourNumero:  ["n° carte séjour", "numéro de carte séjour", "n° titre séjour"],
      cartesSejourFin:     ["fin carte séjour", "expiration carte séjour"],
      cartesTravailNumero: ["n° carte travail", "n° autorisation travail"],
      cartesTravailFin:    ["fin carte travail", "expiration carte travail"],
    },
  },
  {
    id: "silae",
    name: "Silaé",
    description: "Export paie Silaé",
    detect: ["silaé", "silae", "n° salarié"],
    mapping: {
      nom:            ["nom", "nom salarié"],
      prenom:         ["prénom", "prenom"],
      sexe:           ["sexe"],
      dateNaiss:      ["date de naissance"],
      dateEntree:     ["date d'entrée", "date entrée dans l'entreprise"],
      dateSortie:     ["date de sortie"],
      motifSortie:    ["motif de sortie", "motif"],
      etablissement:  ["établissement", "code étab"],
      ville:          ["ville"],
      cp:             ["code postal", "cp"],
      typeContrat:    ["type contrat", "nature du contrat"],
      tempsComplet:   ["temps de travail", "type durée"],
      salaire:        ["salaire de base", "salaire brut"],
      heuresMois:     ["horaire mensuel", "heures mensuelles"],
      visiteMedicale: ["visite médicale", "date dernière visite"],
      handicap:       ["rqth", "handicapé"],
      email:          ["email", "mail"],
      telephone:      ["téléphone", "portable"],
      service:        ["service"],
      nir:            ["n° sécurité sociale", "numéro sécurité sociale", "nir", "n° insee"],
      emploi:         ["emploi", "libellé poste", "intitulé"],
      nationalite:         ["nationalité"],
      etranger:            ["étranger"],
      cartesSejourNumero:  ["n° titre séjour", "n° carte séjour", "numéro titre séjour"],
      cartesSejourFin:     ["fin titre séjour", "expiration titre séjour", "validité titre séjour"],
      cartesTravailNumero: ["n° autorisation travail", "n° carte travail"],
      cartesTravailFin:    ["fin autorisation travail", "expiration autorisation travail"],
    },
  },
  {
    id: "payfit",
    name: "PayFit",
    description: "Export collaborateurs",
    detect: ["payfit", "manager direct", "département"],
    mapping: {
      nom:            ["nom", "last name", "nom de famille"],
      prenom:         ["prénom", "first name"],
      sexe:           ["genre", "sexe", "gender"],
      dateNaiss:      ["date de naissance", "birth date"],
      dateEntree:     ["date d'embauche", "date d'entrée", "start date"],
      dateSortie:     ["date de sortie", "date de fin", "end date"],
      motifSortie:    ["motif de départ", "raison de sortie"],
      etablissement:  ["établissement", "site", "entité"],
      ville:          ["ville", "city"],
      cp:             ["code postal", "zip"],
      typeContrat:    ["type de contrat", "contract type"],
      tempsComplet:   ["temps de travail", "work time"],
      salaire:        ["salaire brut", "salaire de base", "gross salary"],
      heuresMois:     ["heures hebdomadaires", "weekly hours"],
      visiteMedicale: ["visite médicale"],
      handicap:       ["rqth", "handicap"],
      email:          ["email", "e-mail", "adresse email"],
      telephone:      ["téléphone", "phone"],
      service:        ["département", "équipe", "service"],
      nir:            ["n° sécurité sociale", "numéro sécurité sociale", "social security number", "nir"],
      emploi:         ["job title", "intitulé poste", "fonction", "poste"],
      nationalite:         ["nationalité", "nationality"],
      etranger:            ["foreign worker", "étranger"],
      cartesSejourNumero:  ["residence permit number", "n° titre séjour", "n° carte séjour"],
      cartesSejourFin:     ["residence permit expiry", "fin titre séjour"],
      cartesTravailNumero: ["work permit number", "n° autorisation travail"],
      cartesTravailFin:    ["work permit expiry", "fin autorisation travail"],
    },
  },
  {
    id: "adp",
    name: "ADP",
    description: "Export ADP GSI / Decidium",
    detect: ["adp", "decidium", "n° badge"],
    mapping: {
      nom:            ["nom patronymique", "nom", "nom usage"],
      prenom:         ["prénom", "prenom"],
      sexe:           ["sexe"],
      dateNaiss:      ["date de naissance"],
      dateEntree:     ["date d'entrée", "date ancienneté"],
      dateSortie:     ["date de sortie"],
      motifSortie:    ["motif sortie", "motif fin contrat"],
      etablissement:  ["établissement", "code société"],
      ville:          ["ville", "localité"],
      cp:             ["code postal"],
      typeContrat:    ["nature contrat", "type contrat"],
      tempsComplet:   ["régime horaire", "régime travail"],
      salaire:        ["salaire de base", "salaire mensuel"],
      heuresMois:     ["base horaire", "horaire contractuel"],
      visiteMedicale: ["date visite médicale"],
      handicap:       ["travailleur handicapé", "rqth"],
      email:          ["email", "courriel"],
      telephone:      ["téléphone", "n° téléphone"],
      service:        ["service", "unité organisationnelle"],
      nir:            ["n° sécurité sociale", "numéro insee", "nir", "n° insee"],
      emploi:         ["emploi", "libellé emploi", "intitulé fonction", "fonction"],
      nationalite:         ["nationalité", "code pays nationalité"],
      etranger:            ["salarié étranger", "étranger"],
      cartesSejourNumero:  ["n° titre séjour", "n° carte séjour"],
      cartesSejourFin:     ["fin titre séjour", "validité titre séjour", "date expir titre"],
      cartesTravailNumero: ["n° autorisation travail", "n° carte travail"],
      cartesTravailFin:    ["fin autorisation travail", "validité autorisation travail"],
    },
  },
  {
    id: "lucca",
    name: "Lucca / Pagga",
    description: "Export Lucca RH",
    detect: ["lucca", "pagga", "legal entity"],
    mapping: {
      nom:            ["nom", "last name", "nom de famille"],
      prenom:         ["prénom", "first name"],
      sexe:           ["genre", "sexe"],
      dateNaiss:      ["date de naissance", "birth date"],
      dateEntree:     ["date d'entrée", "hire date", "date embauche"],
      dateSortie:     ["date de sortie", "end date", "date départ"],
      motifSortie:    ["motif", "leaving reason"],
      etablissement:  ["établissement", "department", "legal entity"],
      ville:          ["ville", "city"],
      cp:             ["code postal", "zip code"],
      typeContrat:    ["type de contrat", "contract"],
      tempsComplet:   ["temps de travail", "work schedule"],
      salaire:        ["salaire", "salary", "salaire brut"],
      heuresMois:     ["heures", "hours"],
      visiteMedicale: ["visite médicale"],
      handicap:       ["rqth"],
      email:          ["email"],
      telephone:      ["téléphone", "phone"],
      service:        ["service", "team"],
      nir:            ["n° sécurité sociale", "social security number", "nir", "numéro insee"],
      emploi:         ["job title", "position", "role", "intitulé poste"],
      nationalite:         ["nationalité", "nationality", "country"],
      etranger:            ["foreign worker", "étranger"],
      cartesSejourNumero:  ["residence permit number", "n° titre séjour"],
      cartesSejourFin:     ["residence permit expiry", "fin titre séjour"],
      cartesTravailNumero: ["work permit number", "n° autorisation travail"],
      cartesTravailFin:    ["work permit expiry", "fin autorisation travail"],
    },
  },
];

// ─── Auto-detection engine ───
export function detectProfile(headers) {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const allText = lowerHeaders.join(" ");

  for (const profile of PROFILES) {
    const matchCount = profile.detect.filter((keyword) =>
      allText.includes(keyword.toLowerCase())
    ).length;
    if (matchCount >= 1) return profile;
  }

  return null;
}

// ─── Apply profile mapping to headers ───
// Un candidat peut être :
//   - une string : on prend la première colonne dont le header contient cette string
//   - un objet { contains, nth } : on prend la N-ème colonne (0-indexée) qui contient la string
//     (pour les libellés dupliqués comme "Date expir." répété 3 fois dans Quadratus)
export function applyProfileMapping(profile, headers) {
  const result = {};
  const lowerHeaders = headers.map((h) => String(h).toLowerCase().trim());

  for (const field of FIELDS) {
    const candidates = profile.mapping[field.key];
    if (!candidates) { result[field.key] = -1; continue; }

    let found = -1;
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const idx = lowerHeaders.findIndex((h) => h.includes(candidate.toLowerCase()));
        if (idx >= 0) { found = idx; break; }
      } else if (candidate && typeof candidate === "object") {
        const needle = candidate.contains.toLowerCase();
        const nth = candidate.nth ?? 0;
        let seen = 0, picked = -1;
        for (let i = 0; i < lowerHeaders.length; i++) {
          if (lowerHeaders[i].includes(needle)) {
            if (seen === nth) { picked = i; break; }
            seen++;
          }
        }
        if (picked >= 0) { found = picked; break; }
      }
    }
    result[field.key] = found;
  }

  return result;
}

// ─── Smart auto-map without profile (fuzzy) ───
export function autoMapColumns(headers) {
  const result = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const fuzzyMap = {
    nom: ["nom", "name", "last name", "nom de famille", "patronyme"],
    prenom: ["prénom", "prenom", "first name"],
    sexe: ["sexe", "genre", "gender", "civilité"],
    dateNaiss: ["naissance", "birth", "né(e)", "date naiss"],
    dateEntree: ["entrée", "entree", "embauche", "hire", "start", "début"],
    dateSortie: ["sortie", "départ", "end", "fin"],
    motifSortie: ["motif", "raison", "reason"],
    etablissement: ["établissement", "etab", "site", "agence", "entity"],
    ville: ["ville", "city", "commune", "localité"],
    cp: ["postal", "zip", "cp"],
    typeContrat: ["contrat", "contract", "cdd", "cdi"],
    tempsComplet: ["temps", "horaire", "cipdz", "durée", "schedule"],
    salaire: ["salaire", "salary", "rémunération", "base"],
    heuresMois: ["heure", "hour", "durée", "horaire mensuel"],
    visiteMedicale: ["visite", "médical", "medical"],
    handicap: ["handicap", "rqth"],
    email: ["mail", "email", "courriel", "e-mail"],
    telephone: ["tél", "tel", "phone", "portable", "téléphone"],
    service: ["service", "département", "team", "direction"],
    emploi: ["emploi", "libellé poste", "libellé emploi", "intitulé poste", "intitulé fonction", "fonction", "poste", "job title", "position", "role"],
    nir: ["numéro insee", "n° insee", "n° sécurité sociale", "numéro sécurité sociale", "nir", "social security"],
    nationalite: ["nationalité", "nationalite", "nationality", "pays naissance", "country"],
    etranger: ["étranger", "etranger", "foreign", "salarié étranger"],
    cartesSejourNumero: ["n° carte séjour", "n° titre séjour", "numéro carte séjour", "residence permit number"],
    cartesSejourFin: ["fin carte séjour", "expiration carte séjour", "validité titre séjour", "residence permit expiry"],
    cartesTravailNumero: ["n° carte travail", "n° autorisation travail", "work permit number"],
    cartesTravailFin: ["fin carte travail", "expiration carte travail", "work permit expiry"],
  };

  for (const [field, keywords] of Object.entries(fuzzyMap)) {
    let found = -1;
    for (const kw of keywords) {
      const idx = lowerHeaders.findIndex((h) => h.includes(kw));
      if (idx >= 0 && !Object.values(result).includes(idx)) {
        found = idx;
        break;
      }
    }
    result[field] = found;
  }

  return result;
}
