import * as XLSX from "xlsx";

// Libellés DSN des motifs de sortie (codes officiels). Auparavant dans theme.js.
const MOTIF_LABELS = {
  20: "Fin de CDD", 31: "Fin de CDD", 33: "Rupture anticipée CDD",
  34: "Fin PE (employeur)", 35: "Fin PE (salarié)",
  36: "Licenciement éco.", 37: "Licenciement autre",
  39: "Licenciement inaptitude", 43: "Rupture conventionnelle",
  59: "Démission", 65: "Départ retraite", 66: "Mise à la retraite",
  81: "Fin apprentissage", 84: "Fin contrat aidé",
  87: "Transfert", 91: "Mutation / Transfert",
  92: "Décès", 95: "Autre motif",
  109: "Rupture apprentissage", 998: "Non renseigné", 999: "Autre",
};

// ─── Date helpers ───
export function parseDate(d) {
  if (!d) return null;
  const s = String(d).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

// ─── NIR (numéro de sécurité sociale) ───
// Donnée sensible (RGPD) : utilisée UNIQUEMENT comme clé de jointure avec la DSN.
// Jamais affichée en UI ni exportée. On garde les chiffres (13 ou 15 avec clé).
export function normalizeNir(s) {
  const digits = String(s || "").replace(/\D/g, "");
  return digits.length >= 13 ? digits.slice(0, 15) : "";
}

// Clé de rapprochement : les 13 chiffres du NIR (hors clé de contrôle à 2 chiffres).
export function nirKey(nir) {
  const d = normalizeNir(nir);
  return d ? d.slice(0, 13) : "";
}

export function fmtDate(d) {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function yearsDiff(a, b) {
  return (b - a) / (365.25 * 864e5);
}

export const NOW = new Date();

// ─── Header row detection ───
function detectHeaderRow(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "string") {
        const v = cell.v.trim().toLowerCase();
        if (["nom", "name", "last name", "nom de famille", "patronyme"].includes(v)) return r;
      }
    }
  }
  return 0;
}

// ─── STEP 1: Read file and extract headers + sample rows ───
export function readExcelFile(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const hr = detectHeaderRow(sheet);
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = raw[hr].map((h) => String(h).trim());
  const dataRows = raw.slice(hr + 1).filter((r) => {
    // Keep rows that have at least some non-empty values
    return r.some((cell) => cell !== "" && cell != null);
  });

  return {
    headers,
    dataRows,
    sampleRows: dataRows.slice(0, 5),
    totalRows: dataRows.length,
    sheetName: wb.SheetNames[0],
  };
}

// ─── STEP 2: Parse employees using a column mapping ───
// mapping = { nom: 3, prenom: 5, sexe: 24, ... } (column indices)
export function parseWithMapping(dataRows, mapping) {
  const g = (row, key) => {
    const idx = mapping[key];
    if (idx == null || idx < 0) return "";
    return String(row[idx] ?? "").trim();
  };
  const gn = (row, key) => {
    const v = parseFloat(g(row, key));
    return isNaN(v) ? null : v;
  };
  // Booléen oui/non/yes/no/1/0 → true/false/null si vide ou ambigu
  const gb = (row, key) => {
    const s = g(row, key).toLowerCase();
    if (!s) return null;
    if (["oui", "yes", "y", "vrai", "true", "1", "x"].includes(s)) return true;
    if (["non", "no", "n", "faux", "false", "0"].includes(s)) return false;
    return null;
  };

  const employees = dataRows
    .filter((r) => g(r, "nom") !== "")
    .map((r, idx) => {
      const sortieStr = g(r, "dateSortie");
      const dn = parseDate(g(r, "dateNaiss"));
      const de = parseDate(g(r, "dateEntree"));

      // Type contrat detection (flexible)
      const typeContratRaw = g(r, "typeContrat").toLowerCase();
      const isCDD =
        typeContratRaw === "oui" ||
        typeContratRaw === "cdd" ||
        typeContratRaw.includes("cdd") ||
        typeContratRaw.includes("déterminée");

      // Temps complet detection (flexible)
      const tempsRaw = g(r, "tempsComplet").toLowerCase();
      const isTC =
        tempsRaw.includes("complet") ||
        tempsRaw === "tc" ||
        tempsRaw === "oui" ||
        tempsRaw === "100%";

      // Handicap : `null` quand la colonne n'est pas mappée — jamais
      // `false`. Un fichier sans colonne RQTH ne dit pas « aucun
      // bénéficiaire », il ne dit rien ; et le critère OETH chiffre une
      // contribution AGEFIPH sur cette donnée. Une cellule vide dans une
      // colonne mappée reste un « non », comme avant.
      const handicapMappe = mapping.handicap != null && mapping.handicap >= 0;
      const handicapRaw = g(r, "handicap").toLowerCase();
      const isHandicap = !handicapMappe
        ? null
        : handicapRaw === "oui" ||
          handicapRaw === "true" ||
          handicapRaw === "1" ||
          handicapRaw.includes("rqth");

      // Motif de sortie
      const motifRaw = g(r, "motifSortie");
      const motifCode = gn(r, "motifSortie");
      let motifLabel = motifRaw;
      if (motifCode != null && MOTIF_LABELS[Math.round(motifCode)]) {
        motifLabel = MOTIF_LABELS[Math.round(motifCode)];
      }

      // Sexe normalization
      const sexeRaw = g(r, "sexe").toLowerCase();
      let sexe = g(r, "sexe");
      if (sexeRaw.includes("f") || sexeRaw.includes("femme") || sexeRaw === "mme" || sexeRaw === "madame") sexe = "Femme";
      else if (sexeRaw.includes("h") || sexeRaw.includes("homme") || sexeRaw === "m" || sexeRaw === "monsieur") sexe = "Homme";

      return {
        id: idx,
        nom: g(r, "nom"),
        prenom: g(r, "prenom"),
        sexe,
        dateNaiss: dn,
        age: dn ? Math.floor(yearsDiff(dn, NOW)) : null,
        dateEntree: de,
        anciennete: de ? Math.round(yearsDiff(de, NOW) * 10) / 10 : null,
        dateSortie: sortieStr ? parseDate(sortieStr) : null,
        etab: g(r, "etablissement"),
        service: g(r, "service"),
        cdd: isCDD,
        handicap: isHandicap,
        tempsComplet: isTC,
        salaire: gn(r, "salaire"),
        heures: gn(r, "heuresMois"),
        ville: g(r, "ville"),
        cp: g(r, "cp"),
        motifCode,
        motifLabel: motifLabel || "Non renseigné",
        visiteDate: parseDate(g(r, "visiteMedicale")),
        actif: !sortieStr,
        email: g(r, "email"),
        tel: g(r, "telephone"),
        voie: "",
        pctActivite: gn(r, "pctActivite") || null,
        emploi: g(r, "emploi") || "",
        nir: normalizeNir(g(r, "nir")),
        nationalite: g(r, "nationalite") || "",
        etranger: gb(r, "etranger"),
        cartesSejourNumero: g(r, "cartesSejourNumero") || "",
        cartesSejourFin: parseDate(g(r, "cartesSejourFin")),
        cartesTravailNumero: g(r, "cartesTravailNumero") || "",
        cartesTravailFin: parseDate(g(r, "cartesTravailFin")),
      };
    });

  if (employees.length === 0) {
    throw new Error("Aucun employé détecté après mapping.");
  }

  return employees;
}
