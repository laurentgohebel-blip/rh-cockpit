// ═══════════════════════════════════════════════════
// MOTEUR DE SCORING D'AUDIT
// Évalue chaque critère du référentiel, applique le
// gating qualité (« non concluant »), agrège par domaine
// puis en un index global, et compile risques + anomalies.
// ═══════════════════════════════════════════════════

import { DOMAINS, CRITERIA, STATUS, FIELD_RELIABLE_PCT, SEUILS } from "./referentiel";
import { completenessMap, detectAnomalies, computeFieldCompleteness } from "./dataQuality";
import { NOW } from "./parser";
import { resolveSeuils, getSector, getBenchmark } from "./sectors";

// Statuts notés → score
const SCORED = { [STATUS.conforme]: 100, [STATUS.vigilance]: 50, [STATUS.nonConforme]: 0 };
// Statuts « data-dépendants » : entrent dans le calcul de fiabilité
const DATA_DEPENDENT = new Set([STATUS.conforme, STATUS.vigilance, STATUS.nonConforme, STATUS.nonConcluant]);

export function statusToScore(status) {
  return SCORED[status]; // undefined si non noté
}

export function scoreToStatus(score) {
  if (score == null) return STATUS.nonConcluant;
  if (score >= 75) return STATUS.conforme;
  if (score >= 50) return STATUS.vigilance;
  return STATUS.nonConforme;
}

// ─── Calcul d'audit complet à partir des métriques ───
// metrics : sortie de computeMetrics() (contient metrics.employees)
// meta    : { sourceFile, profileId }
export function computeAudit(metrics, meta = {}) {
  const employees = metrics.employees || [];
  const actifs = employees.filter((e) => e.actif);
  const completeness = completenessMap(employees);
  const sectorId = meta.sectorId || "default";
  const sector = getSector(sectorId);
  const seuils = resolveSeuils(SEUILS, sectorId);
  const ctx = { metrics, employees, actifs, completeness, seuils, sectorId };

  // 1. Évaluer chaque critère (avec gating qualité)
  const evaluated = CRITERIA.map((crit) => {
    const gate = crit.reliableThreshold ?? FIELD_RELIABLE_PCT;
    const gatedOut = (crit.requiredFields || []).some((f) => (completeness[f] ?? 1) < gate);

    const res = gatedOut
      ? { status: STATUS.nonConcluant, value: null, valueLabel: "Donnée source insuffisante", threshold: "", evidence: [] }
      : crit.evaluate(ctx);

    const score = SCORED[res.status];
    const risk = !gatedOut && crit.risk ? crit.risk(ctx) : null;
    const benchmark = getBenchmark(crit.id, sectorId);

    return {
      id: crit.id,
      domain: crit.domain,
      label: crit.label,
      legalRef: crit.legalRef || null,
      weight: crit.weight ?? 1,
      ...res,
      score: score == null ? null : score,
      risk,
      benchmark,
    };
  });

  // 2. Agrégation par domaine (moyenne pondérée des critères évaluables)
  const domains = DOMAINS.map((d) => {
    const crits = evaluated.filter((c) => c.domain === d.key);
    const scored = crits.filter((c) => c.score != null);
    const wsum = scored.reduce((s, c) => s + c.weight, 0);
    const score = wsum ? Math.round(scored.reduce((s, c) => s + c.score * c.weight, 0) / wsum) : null;
    return { ...d, score, status: scoreToStatus(score), evaluableCount: scored.length, criteria: crits };
  });

  // 3. Index global (pondération des domaines évaluables, renormalisée)
  const dScored = domains.filter((d) => d.score != null);
  const dw = dScored.reduce((s, d) => s + d.weight, 0);
  const globalScore = dw ? Math.round(dScored.reduce((s, d) => s + d.score * d.weight, 0) / dw) : null;

  // 4. Fiabilité = part des critères data-dépendants réellement évaluables
  const dataDependent = evaluated.filter((c) => DATA_DEPENDENT.has(c.status));
  const evaluable = dataDependent.filter((c) => c.status !== STATUS.nonConcluant);
  const reliability = dataDependent.length ? Math.round((100 * evaluable.length) / dataDependent.length) : 100;

  // 5. Risques chiffrés (idée ①)
  const risks = evaluated.filter((c) => c.risk).map((c) => ({ critId: c.id, ...c.risk }));
  const totalQuantifiedRisk = risks.filter((r) => typeof r.amount === "number").reduce((s, r) => s + r.amount, 0);

  // 6. Anomalies + complétude (idée ③)
  const anomalies = detectAnomalies(employees);
  const fieldCompleteness = computeFieldCompleteness(employees);

  return {
    globalScore,
    globalStatus: scoreToStatus(globalScore),
    reliability,
    domains,
    risks,
    totalQuantifiedRisk,
    anomalies,
    fieldCompleteness,
    // 7. Traçabilité (idée ⑤)
    meta: {
      auditDate: NOW.toISOString(),
      sourceFile: meta.sourceFile || null,
      profileId: meta.profileId || null,
      sectorId,
      sectorName: sector.name,
      effectif: metrics.totalActifs,
      effectifHistorique: metrics.totalHistorique,
    },
  };
}

// ─── Helpers de présentation (purs, testables) ───

// Critère représentatif + comptage des constats d'un domaine
export function domainHeadline(domain) {
  const crits = domain.criteria || [];
  const nNonConforme = crits.filter((c) => c.status === STATUS.nonConforme).length;
  const nVigilance = crits.filter((c) => c.status === STATUS.vigilance).length;
  const rep =
    crits.find((c) => c.status === STATUS.nonConforme) ||
    crits.find((c) => c.status === STATUS.vigilance) ||
    crits.find((c) => c.valueLabel) ||
    crits[0];
  return { valueLabel: rep ? rep.valueLabel || "" : "", nNonConforme, nVigilance };
}

// Constats prioritaires aplatis (non-conformes puis vigilances), avec réf. domaine
const CONSTAT_ORDER = { [STATUS.nonConforme]: 0, [STATUS.vigilance]: 1 };
export function topConstats(audit, limit = 5) {
  const flat = [];
  audit.domains.forEach((d) => {
    d.criteria.forEach((c) => {
      if (c.status === STATUS.nonConforme || c.status === STATUS.vigilance)
        flat.push({ ...c, domainKey: d.key, domainLabel: d.label });
    });
  });
  flat.sort(
    (a, b) =>
      (CONSTAT_ORDER[a.status] - CONSTAT_ORDER[b.status]) || ((b.evidence?.length || 0) - (a.evidence?.length || 0))
  );
  return flat.slice(0, limit);
}
