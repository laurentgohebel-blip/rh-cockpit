// ═══════════════════════════════════════════════════
// SOURCES DE L'AUDIT
// Un audit se mène à partir d'un fichier de paie, d'une DSN, ou des deux.
// Ce module décide quel effectif alimente le moteur, avec quelle règle de
// préséance, et dit ce que la source retenue permet — ou non — d'auditer.
// ═══════════════════════════════════════════════════

import { CRITERIA, DOMAINS, FIELD_RELIABLE_PCT } from "./referentiel";
import { completenessMap } from "./dataQuality";
import { dsnToEmployees, SOURCE, CHAMPS_HORS_DSN } from "./dsnParser";
import { nirKey } from "./parser";

export const MODES = {
  paie: { cle: "paie", label: "Fichier de paie", court: "paie" },
  dsn: { cle: "dsn", label: "DSN", court: "DSN" },
  mixte: { cle: "mixte", label: "Fichier de paie + DSN", court: "paie + DSN" },
};

/* ── Règle de préséance ──────────────────────────────────────────────
   Quand les deux sources sont là, LA PAIE RESTE LA SOURCE DU MODÈLE et
   la DSN comble ses trous. Ce n'est pas un choix de commodité :

   — le fichier de paie porte le salaire de BASE contractuel, la DSN porte
     le BRUT VERSÉ du mois, primes et heures supplémentaires comprises.
     Ce ne sont pas la même grandeur, et l'écart de rémunération de
     l'Index Égalité se calcule sur le salaire de base. Écraser l'un par
     l'autre fausserait l'indicateur qui pèse 40 points ;
   — la paie porte des données que la DSN mensuelle ignore : suivi
     médical, RQTH, titres de séjour.

   La DSN garde sa force propre : ses données spécifiques (arrêts,
   quotités, contrats, brut) restent attachées sous `e.dsn`, et elle
   remplit tout champ que la paie a laissé vide. Chaque comblement est
   tracé dans `_src`, pour que le rapport puisse dire d'où vient un
   constat. */

// Champs que la DSN peut combler quand la paie ne les porte pas.
const CHAMPS_COMBLABLES = ["sexe", "dateNaiss", "dateEntree", "dateSortie",
  "emploi", "etab", "salaire", "heures", "motifLabel"];

const vide = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

/* Construit l'effectif à auditer à partir des sources disponibles.
   Rend toujours un objet, même sans aucune source — l'appelant teste
   `employees` plutôt que d'attraper une exception. */
export function construireEffectif({ paie = null, dsn = null } = {}) {
  const aPaie = Array.isArray(paie) && paie.length > 0;
  const aDsn = !!dsn && Array.isArray(dsn.individus) && dsn.individus.length > 0;

  if (!aPaie && !aDsn) return { employees: null, mode: null, comblements: 0, rapproches: 0 };

  // DSN seule : elle devient le modèle.
  if (!aPaie) return { employees: dsnToEmployees(dsn), mode: MODES.dsn.cle, comblements: 0, rapproches: 0 };

  // Paie seule : on marque simplement la provenance.
  const base = paie.map((e) => ({ ...e, _src: e._src || marquerTout(e, SOURCE.paie) }));
  if (!aDsn) return { employees: base, mode: MODES.paie.cle, comblements: 0, rapproches: 0 };

  // Les deux : la paie mène, la DSN comble.
  const parNir = new Map();
  for (const d of dsnToEmployees(dsn)) if (d.nir) parNir.set(nirKey(d.nir), d);

  let comblements = 0, rapproches = 0;
  const employees = base.map((e) => {
    const d = e.nir ? parNir.get(nirKey(e.nir)) : null;
    if (!d) return e;
    rapproches++;
    const fusion = { ...e, dsn: d.dsn, _src: { ...e._src } };
    for (const champ of CHAMPS_COMBLABLES) {
      if (vide(fusion[champ]) && !vide(d[champ])) {
        fusion[champ] = d[champ];
        fusion._src[champ] = SOURCE.dsn;
        comblements++;
      }
    }
    return fusion;
  });
  return { employees, mode: MODES.mixte.cle, comblements, rapproches };
}

function marquerTout(e, origine) {
  const m = {};
  for (const champ of Object.keys(e)) m[champ] = origine;
  return m;
}

/* ── Couverture de l'audit ───────────────────────────────────────────
   Ce que la source permet d'auditer, et surtout ce qu'elle ne permet
   PAS. C'est le point le plus important de tout le module : un lecteur
   qui ne voit aucun constat sur le suivi médical doit comprendre que la
   question n'a pas été examinée — jamais qu'elle est conforme.

   On rejoue exactement le gating de `computeAudit` : même seuil, mêmes
   `requiredFields`. Si les deux divergeaient, l'écran mentirait sur le
   rapport. */
export function couvertureAudit(employees, mode) {
  if (!employees?.length) return null;
  const completeness = completenessMap(employees);
  const libelleDomaine = Object.fromEntries(DOMAINS.map((d) => [d.key, d.label]));

  const nonEvaluables = [];
  for (const crit of CRITERIA) {
    const seuil = crit.reliableThreshold ?? FIELD_RELIABLE_PCT;
    const manquants = (crit.requiredFields || []).filter((f) => (completeness[f] ?? 1) < seuil);
    if (!manquants.length) continue;
    nonEvaluables.push({
      id: crit.id,
      label: crit.label,
      domaine: libelleDomaine[crit.domain] || crit.domain,
      champsManquants: manquants,
      // La cause tient en une phrase, et elle est différente selon que la
      // source ne porte PAS le champ ou qu'elle le porte mal rempli.
      cause: mode === MODES.dsn.cle && manquants.every((f) => CHAMPS_HORS_DSN.includes(f))
        ? "Cette information ne figure pas dans une DSN mensuelle."
        : "Donnée absente ou trop incomplète dans le fichier fourni.",
    });
  }

  return {
    mode,
    modeLabel: MODES[mode]?.label || "—",
    total: CRITERIA.length,
    evaluables: CRITERIA.length - nonEvaluables.length,
    nonEvaluables,
    // Pour l'avertissement en tête de rapport.
    avertissement: nonEvaluables.length
      ? `${nonEvaluables.length} critère${nonEvaluables.length > 1 ? "s n'ont" : " n'a"} pas pu être évalué${nonEvaluables.length > 1 ? "s" : ""} faute de données. L'absence de constat ne vaut pas conformité.`
      : null,
  };
}

/* Ce qu'il faudrait fournir pour lever les angles morts — la phrase que
   l'auditeur envoie au client pour compléter sa mission. */
export function manquesAdemander(couverture) {
  if (!couverture?.nonEvaluables?.length) return [];
  const parChamp = new Map();
  for (const c of couverture.nonEvaluables)
    for (const f of c.champsManquants) {
      if (!parChamp.has(f)) parChamp.set(f, []);
      parChamp.get(f).push(c.label);
    }
  return [...parChamp].map(([champ, critères]) => ({ champ, libelle: LIBELLES_CHAMPS[champ] || champ, critères }));
}

const LIBELLES_CHAMPS = {
  visiteDate: "dates des visites médicales",
  handicap: "statut RQTH / travailleur handicapé",
  salaire: "salaires de base",
  heures: "heures mensuelles contractuelles",
  sexe: "sexe",
  dateNaiss: "dates de naissance",
  dateEntree: "dates d'entrée",
  emploi: "libellés d'emploi",
  nir: "numéros de sécurité sociale",
  nationalite: "nationalités",
  etranger: "statut étranger (oui/non)",
  cartesSejourNumero: "numéros de titre de séjour",
  cartesSejourFin: "dates de fin de titre de séjour",
  cartesTravailNumero: "numéros d'autorisation de travail",
  cartesTravailFin: "dates de fin d'autorisation de travail",
  etab: "établissements",
  ville: "villes",
};
