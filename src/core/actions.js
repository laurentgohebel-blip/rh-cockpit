// ═══════════════════════════════════════════════════
// PLAN D'ACTION
// Bibliothèque d'actions recommandées par critère.
// buildActionPlan(audit) produit la feuille de route :
//   - filtre les constats non-conformes (priorité haute) et vigilance (priorité moyenne)
//   - associe l'action canonique, la charge estimée et l'échéance suggérée
//   - tri par priorité × criticité du domaine
// ═══════════════════════════════════════════════════

// Charge symbolique en jours-homme · échéance en mois calendaires
// owner ∈ "RH" | "Direction" | "Manager" | "Légal/RH"
const ACTION_LIBRARY = {
  oeth: {
    action: "Plan d'embauche de bénéficiaires de l'OETH ou recours à secteur protégé / ESAT",
    charge: 10, deadline: 12, owner: "Direction",
    detail: "Identifier postes ouverts compatibles, contacter Cap Emploi, viser un objectif de recrutement progressif sur 12 mois.",
  },
  "suivi-medical": {
    action: "Relance massive des visites médicales expirées auprès du SPST",
    charge: 3, deadline: 2, owner: "RH",
    detail: "Constituer la liste nominative, planifier les RDV avec le service de prévention en santé au travail.",
  },
  "cdd-cadre": {
    action: "Revue contractuelle des CDD longs : requalification CDI ou non-renouvellement maîtrisé",
    charge: 5, deadline: 3, owner: "Légal/RH",
    detail: "Audit juridique de chaque CDD > 18 mois pour qualifier le risque de requalification et arrêter la stratégie au cas par cas.",
  },
  "titre-sejour": {
    action: "Régulariser les titres expirés et anticiper les renouvellements (relance 90 jours avant échéance)",
    charge: 3, deadline: 1, owner: "RH",
    detail: "Recenser nominativement les salariés étrangers, vérifier la validité de la carte de séjour ET/OU de la carte de travail, anticiper les renouvellements avant échéance, mettre en place une alerte automatisée à 90 jours, formaliser le contrôle à l'embauche.",
  },
  "remu-completude": {
    action: "Fiabilisation des données de rémunération dans le SIRH",
    charge: 5, deadline: 3, owner: "RH",
    detail: "Identifier les salariés sans salaire renseigné, corriger les saisies et auditer le flux d'intégration paie → SIRH.",
  },
  "top-remunerations": {
    action: "Plan de mixité dans les hautes rémunérations (talents féminins, mobilité interne)",
    charge: 8, deadline: 12, owner: "Direction",
    detail: "Identifier les viviers internes, sécuriser les passages au top management des femmes à potentiel, revoir les processus de promotion et le grading. Indicateur n°5 Index Égalité Pro F/H.",
  },
  "ecart-hf-emploi": {
    action: "Plan de correction des écarts F/H à emploi et ancienneté égaux",
    charge: 8, deadline: 6, owner: "Direction",
    detail: "Identifier les couples emploi×ancienneté où l'écart dépasse le seuil, vérifier la justification objective (compétence, performance), définir une enveloppe de rattrapage si nécessaire.",
  },
  turnover: {
    action: "Plan de fidélisation et analyse des départs",
    charge: 8, deadline: 6, owner: "Direction",
    detail: "Entretiens de sortie systématiques, baromètre engagement, plan d'action managériaux ciblés sur les populations à risque.",
  },
  "motifs-sortie": {
    action: "Baromètre climat social et plan d'action managérial",
    charge: 6, deadline: 4, owner: "Direction",
    detail: "Enquête de climat ou groupes d'expression, identification des irritants, action sur le management de proximité.",
  },
  "retraite-anticipation": {
    action: "Plan de transmission des compétences et de remplacement",
    charge: 10, deadline: 9, owner: "RH",
    detail: "Cartographier les postes critiques, identifier les binômes, structurer un tutorat ou un parcours d'intégration des successeurs.",
  },
  "turnover-sites": {
    action: "Diagnostic spécifique sur le ou les établissements en surchauffe",
    charge: 6, deadline: 3, owner: "Manager",
    detail: "Entretiens managériaux sur site, analyse des conditions de travail et de la rotation.",
  },
  "structure-contrats": {
    action: "Réduction du recours au CDD et CDIsation ciblée",
    charge: 5, deadline: 6, owner: "RH",
    detail: "Identifier les CDD récurrents ou sur poste permanent, plan de CDIsation, revue des motifs de recours.",
  },
  "temps-partiel": {
    action: "Audit du recours au temps partiel et politique d'augmentation des durées",
    charge: 5, deadline: 6, owner: "RH",
    detail: "Distinguer TP subi / choisi, proposer aux TP subis une augmentation du temps de travail conformément aux obligations légales.",
  },
  vieillissement: {
    action: "Plan d'anticipation du vieillissement (transmission, prévention)",
    charge: 8, deadline: 9, owner: "RH",
    detail: "Cartographie des départs à 5 ans, identification des postes critiques, plan de transmission de compétences.",
  },
  mixite: {
    action: "Plan mixité et attractivité auprès du genre sous-représenté",
    charge: 6, deadline: 12, owner: "RH",
    detail: "Revue des offres d'emploi, partenariats écoles, marraine/parrainage, communication employeur ciblée.",
  },
  anciennete: {
    action: "Plan d'onboarding et de fidélisation des nouveaux entrants",
    charge: 4, deadline: 4, owner: "Manager",
    detail: "Renforcer le parcours d'intégration sur les 6 premiers mois, suivi régulier en première année, mentorat.",
  },
};

// Priorité du constat selon le statut
function priorityOf(status) {
  if (status === "non-conforme") return "haute";
  if (status === "vigilance") return "moyenne";
  return "basse";
}

const DOMAIN_WEIGHT_ORDER = { conformite: 0, remuneration: 1, mouvements: 2, effectifs: 3 };
const PRIO_ORDER = { haute: 0, moyenne: 1, basse: 2 };

// Construit le plan d'action à partir d'un audit complet
export function buildActionPlan(audit) {
  if (!audit) return [];
  const actions = [];
  audit.domains.forEach((d) => {
    d.criteria.forEach((c) => {
      if (c.status !== "non-conforme" && c.status !== "vigilance") return;
      const lib = ACTION_LIBRARY[c.id];
      if (!lib) return;
      actions.push({
        id: `act-${c.id}`,
        critId: c.id,
        domain: d.key,
        domainLabel: d.label,
        critLabel: c.label,
        constat: c.valueLabel,
        priority: priorityOf(c.status),
        status: c.status, // "non-conforme" / "vigilance"
        action: lib.action,
        detail: lib.detail,
        charge: lib.charge,
        deadline: lib.deadline,
        owner: lib.owner,
        evidence: c.evidence?.length || 0,
        risk: c.risk?.amount || null,
      });
    });
  });

  actions.sort((a, b) =>
    (PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]) ||
    (DOMAIN_WEIGHT_ORDER[a.domain] - DOMAIN_WEIGHT_ORDER[b.domain]) ||
    (b.risk || 0) - (a.risk || 0)
  );

  return actions;
}

// Métriques de synthèse du plan
export function planSummary(actions, overrides = {}) {
  const enriched = actions.map((a) => ({ ...a, ...(overrides[a.id] || {}) }));
  const open = enriched.filter((a) => (overrides[a.id]?.state || "open") !== "done");
  return {
    total: enriched.length,
    open: open.length,
    done: enriched.length - open.length,
    haute: open.filter((a) => a.priority === "haute").length,
    moyenne: open.filter((a) => a.priority === "moyenne").length,
    totalCharge: open.reduce((s, a) => s + (a.charge || 0), 0),
  };
}
