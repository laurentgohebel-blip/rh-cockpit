import { Printer, ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/audit/ScoreRing";
import { StatusBadge } from "@/components/audit/StatusBadge";
import { useData } from "@/context/DataContext";
import { useBrand } from "@/context/BrandContext";
import { topConstats } from "@/core/scoring";
import { STATUS_META } from "@/core/referentiel";
import { buildActionPlan } from "@/core/actions";
import { toneFor } from "@/lib/audit-ui";
import { fmtEuro, fmtDateFr } from "@/lib/utils";

const TONE_TEXT = {
  success: "text-success", warning: "text-warning", destructive: "text-destructive",
  info: "text-info", muted: "text-muted-foreground",
};

function SectionTitle({ number, title, subtitle }) {
  return (
    <div className="mb-6 border-b border-foreground/15 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Section {number}</p>
      <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default function RapportPage() {
  const { audit, metrics } = useData();
  const brand = useBrand();

  if (!audit) return null;

  const auditDate = new Date(audit.meta.auditDate);
  const constats = topConstats(audit, 30);
  const actions = buildActionPlan(audit);
  const totalCharge = actions.reduce((s, a) => s + (a.charge || 0), 0);
  const constatsNC = constats.filter((c) => c.status === "non-conforme");
  const constatsVig = constats.filter((c) => c.status === "vigilance");
  const tone = toneFor(audit.globalStatus, STATUS_META);
  const clientName = brand?.name || "Client";
  const sourceLabel = audit.meta.sourceFile || "Données importées";

  return (
    <div className="print-root">
      {/* Toolbar — masquée à l'impression */}
      <div className="no-print mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/audit"><ArrowLeft className="mr-1 h-4 w-4" />Retour synthèse</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileText className="mr-1 h-4 w-4" />Exporter en PDF
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />Imprimer
          </Button>
        </div>
      </div>

      <div className="no-print mb-4 rounded-md border border-info/20 bg-info-soft px-3 py-2 text-xs text-info">
        💡 Pour exporter en PDF : cliquez « Exporter en PDF » puis choisissez « Enregistrer au format PDF » dans la boîte de dialogue d'impression.
      </div>

      {/* ═══════════ COUVERTURE ═══════════ */}
      <section className="print-section flex min-h-[260mm] flex-col justify-between bg-white py-8">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            {brand?.logo || "RH"}
          </div>
          <div>
            <p className="text-sm font-semibold">{brand?.name || "RH Cockpit"}</p>
            <p className="text-xs text-muted-foreground">Cockpit d'audit social</p>
          </div>
        </header>

        <div className="my-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rapport d'audit social</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{clientName}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Diagnostic complet sur la base d'un snapshot RH du {auditDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Effectif analysé</p>
              <p className="mt-1 text-2xl font-semibold">{audit.meta.effectif}</p>
              <p className="text-xs text-muted-foreground">salariés actifs</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Historique</p>
              <p className="mt-1 text-2xl font-semibold">{audit.meta.effectifHistorique}</p>
              <p className="text-xs text-muted-foreground">fiches au total</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Référentiel</p>
              <p className="mt-1 text-2xl font-semibold">{audit.domains.reduce((s, d) => s + d.criteria.length, 0)}</p>
              <p className="text-xs text-muted-foreground">critères évalués</p>
            </div>
          </div>
        </div>

        <footer className="border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
          <p>Document confidentiel — usage interne client</p>
          <p>Source : {sourceLabel} · Émis le {fmtDateFr(auditDate)}</p>
        </footer>
      </section>

      {/* ═══════════ SECTION 1 — SYNTHÈSE EXÉCUTIVE ═══════════ */}
      <section className="print-page-break print-section py-8">
        <SectionTitle number="1" title="Synthèse exécutive" subtitle="Vue d'ensemble du score, du niveau de risque et des points d'attention majeurs." />

        <div className="grid grid-cols-2 gap-6">
          <div className="flex items-center gap-5 rounded-md border border-foreground/15 p-5">
            <ScoreRing score={audit.globalScore} status={audit.globalStatus} size={110} />
            <div>
              <p className="text-xs text-muted-foreground">Index de maturité RH</p>
              <p className={`text-xl font-semibold ${TONE_TEXT[tone]}`}>{STATUS_META[audit.globalStatus]?.label}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {constatsNC.length} non conforme{constatsNC.length > 1 ? "s" : ""} ·{" "}
                {constatsVig.length} vigilance{constatsVig.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-foreground/15 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fiabilité des données</p>
            <p className="mt-1 text-2xl font-semibold">{audit.reliability}%</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {audit.fieldCompleteness.filter((c) => c.pct < 0.7).length} champ
              {audit.fieldCompleteness.filter((c) => c.pct < 0.7).length > 1 ? "s" : ""} sous le seuil de 70% de complétude.
              Voir annexe A pour le détail.
            </p>
            {audit.anomalies.length > 0 && (
              <p className="mt-2 text-xs text-warning">
                ⚠ {audit.anomalies.length} anomalie{audit.anomalies.length > 1 ? "s" : ""} détectée{audit.anomalies.length > 1 ? "s" : ""} dans les données sources.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-md border border-foreground/15 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faits saillants</p>
          <ul className="mt-3 space-y-2 text-sm">
            {audit.domains.map((d) => {
              const t = toneFor(d.status, STATUS_META);
              return (
                <li key={d.key} className="flex items-baseline gap-2">
                  <span className={`text-base ${TONE_TEXT[t]}`}>●</span>
                  <span className="font-medium">{d.label}</span>
                  <span className="text-muted-foreground">— {d.score ?? "—"}/100 ({STATUS_META[d.status]?.label.toLowerCase()})</span>
                </li>
              );
            })}
            {audit.totalQuantifiedRisk > 0 && (
              <li className="flex items-baseline gap-2 pt-2">
                <span className="text-base text-destructive">●</span>
                <span className="font-medium">Exposition financière estimée</span>
                <span className="text-muted-foreground">— ≈ {fmtEuro(audit.totalQuantifiedRisk)} (estimations indicatives)</span>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* ═══════════ SECTION 2 — MÉTHODOLOGIE ═══════════ */}
      <section className="print-page-break print-section py-8">
        <SectionTitle number="2" title="Méthodologie" subtitle="Cadre du référentiel et règles de scoring." />

        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <p className="font-semibold">Référentiel d'audit</p>
            <p className="mt-1 text-foreground/80">
              L'audit s'appuie sur un référentiel de {audit.domains.reduce((s, d) => s + d.criteria.length, 0)} critères répartis en{" "}
              {audit.domains.length} domaines pondérés. Les seuils sont issus du droit du travail français (Code du travail,
              obligations DSN, OETH, Index égalité) et de pratiques sectorielles.
            </p>
          </div>

          <div>
            <p className="font-semibold">Notation</p>
            <p className="mt-1 text-foreground/80">
              Chaque critère reçoit un statut : <span className="font-medium">Conforme</span> (100), <span className="font-medium">Vigilance</span> (50),
              ou <span className="font-medium">Non conforme</span> (0). Un critère dont la donnée source est insuffisamment renseignée
              (couverture &lt; 70%) est marqué <span className="font-medium">Non concluant</span> et exclu du calcul du score, mais
              fait baisser l'indice de fiabilité. Le score par domaine est la moyenne pondérée des critères évaluables. Le score global
              applique les poids domaines :
            </p>
            <ul className="mt-2 ml-4 list-disc text-foreground/80">
              {audit.domains.map((d) => (
                <li key={d.key}>{d.label} — {(d.weight * 100).toFixed(0)}%</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-semibold">Sources & traçabilité</p>
            <div className="mt-1 rounded-md bg-secondary/40 p-3 text-xs">
              <table className="w-full">
                <tbody>
                  <tr><td className="py-0.5 pr-3 text-muted-foreground">Client</td><td className="font-medium">{clientName}</td></tr>
                  <tr><td className="py-0.5 pr-3 text-muted-foreground">Fichier source</td><td className="font-medium">{sourceLabel}</td></tr>
                  {audit.meta.profileId && <tr><td className="py-0.5 pr-3 text-muted-foreground">Profil détecté</td><td className="font-medium">{audit.meta.profileId}</td></tr>}
                  {audit.meta.sectorId && audit.meta.sectorId !== "default" && (
                    <tr><td className="py-0.5 pr-3 text-muted-foreground">Benchmark sectoriel</td><td className="font-medium">{audit.meta.sectorName}</td></tr>
                  )}
                  <tr><td className="py-0.5 pr-3 text-muted-foreground">Date d'audit</td><td className="font-medium">{auditDate.toLocaleString("fr-FR")}</td></tr>
                  <tr><td className="py-0.5 pr-3 text-muted-foreground">Effectif analysé</td><td className="font-medium">{audit.meta.effectif} actifs / {audit.meta.effectifHistorique} fiches</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-semibold">Limites</p>
            <p className="mt-1 text-foreground/80">
              Les estimations financières (AGEFIPH, pénalités, requalifications) sont indicatives et doivent être confirmées
              par l'auditeur. Le traitement est intégralement local — aucune donnée nominative n'a transité par un service externe.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION 3 — SCORES PAR DOMAINE ═══════════ */}
      <section className="print-page-break print-section py-8">
        <SectionTitle number="3" title="Scores par domaine" subtitle="Détail de la notation et indicateurs sous-jacents." />

        <div className="space-y-6">
          {audit.domains.map((d) => {
            const t = toneFor(d.status, STATUS_META);
            return (
              <div key={d.key} className="print-section rounded-md border border-foreground/15 p-5">
                <div className="mb-3 flex items-center justify-between border-b border-foreground/10 pb-3">
                  <h3 className="text-base font-semibold">{d.icon} {d.label}</h3>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={d.status} />
                    <span className={`text-2xl font-semibold tabular-nums ${TONE_TEXT[t]}`}>
                      {d.score ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span>
                    </span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-foreground/10 text-muted-foreground">
                      <th className="py-1.5 text-left font-semibold">Critère</th>
                      <th className="py-1.5 text-left font-semibold">Indicateur</th>
                      <th className="py-1.5 text-left font-semibold">Cible / médiane</th>
                      <th className="py-1.5 text-right font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.criteria.map((c) => (
                      <tr key={c.id} className="border-b border-foreground/5">
                        <td className="py-1.5 pr-2 align-top">
                          <p className="font-medium">{c.label}</p>
                          {c.legalRef && <p className="text-[10px] text-muted-foreground">{c.legalRef}</p>}
                        </td>
                        <td className="py-1.5 pr-2 align-top text-foreground/80">{c.valueLabel || "—"}</td>
                        <td className="py-1.5 pr-2 align-top">
                          <p className="text-muted-foreground">{c.threshold || "—"}</p>
                          {c.benchmark && <p className="text-[10px] text-info">{c.benchmark.label}</p>}
                        </td>
                        <td className="py-1.5 text-right align-top">
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ SECTION 4 — EXPOSITION FINANCIÈRE ═══════════ */}
      {audit.risks?.length > 0 && (
        <section className="print-page-break print-section py-8">
          <SectionTitle number="4" title="Exposition financière estimée" subtitle="Chiffrage indicatif des risques quantifiables identifiés." />

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/20 text-muted-foreground">
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider">Risque</th>
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider">Base de calcul</th>
                <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider">Montant estimé</th>
              </tr>
            </thead>
            <tbody>
              {audit.risks.map((r) => (
                <tr key={r.critId} className="border-b border-foreground/10">
                  <td className="py-2.5 pr-3 align-top font-medium">{r.label}</td>
                  <td className="py-2.5 pr-3 align-top text-xs text-muted-foreground">{r.basis}</td>
                  <td className="whitespace-nowrap py-2.5 text-right align-top font-semibold text-destructive">
                    {typeof r.amount === "number"
                      ? `≈ ${fmtEuro(r.amount)}${r.unit === "€/an" ? "/an" : ""}`
                      : "à évaluer"}
                  </td>
                </tr>
              ))}
              {audit.totalQuantifiedRisk > 0 && (
                <tr className="border-t-2 border-foreground/30 font-semibold">
                  <td className="py-3" colSpan="2">Total chiffré</td>
                  <td className="py-3 text-right text-destructive">≈ {fmtEuro(audit.totalQuantifiedRisk)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-4 text-xs italic text-muted-foreground">
            Estimations indicatives sur la base des données fournies. À confirmer par l'auditeur avec les éléments contextuels
            (conventions collectives, accords d'entreprise, contentieux en cours). Ne constituent pas un conseil juridique.
          </p>
        </section>
      )}

      {/* ═══════════ SECTION 5 — PLAN D'ACTION ═══════════ */}
      {actions.length > 0 && (
        <section className="print-page-break print-section py-8">
          <SectionTitle
            number="5"
            title={`Plan d'action recommandé (${actions.length})`}
            subtitle={`Charge estimée totale : ${totalCharge} jours-homme · à valider et arbitrer avec la direction.`}
          />

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-foreground/20 text-muted-foreground">
                <th className="py-2 text-left font-semibold">Prio.</th>
                <th className="py-2 text-left font-semibold">Action</th>
                <th className="py-2 text-left font-semibold">Pilote</th>
                <th className="py-2 text-right font-semibold">Charge</th>
                <th className="py-2 text-right font-semibold">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b border-foreground/5">
                  <td className="py-2 align-top">
                    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                      a.priority === "haute" ? "bg-destructive-soft text-destructive"
                      : a.priority === "moyenne" ? "bg-warning-soft text-warning"
                      : "bg-info-soft text-info"
                    }`}>{a.priority}</span>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <p className="font-medium">{a.action}</p>
                    <p className="text-[10px] text-muted-foreground">{a.domainLabel} · {a.constat}</p>
                    <p className="text-[10px] italic text-foreground/60">{a.detail}</p>
                  </td>
                  <td className="py-2 pr-3 align-top">{a.owner}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{a.charge} j-h</td>
                  <td className="whitespace-nowrap py-2 text-right align-top text-muted-foreground">~{a.deadline} mois</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ═══════════ SECTION 6 — CONSTATS ═══════════ */}
      <section className="print-page-break print-section py-8">
        <SectionTitle
          number={actions.length > 0 ? "6" : "5"}
          title={`Constats détaillés (${constats.length})`}
          subtitle="Liste exhaustive des écarts identifiés, classés par criticité."
        />

        {constats.length === 0 ? (
          <p className="rounded-md border border-success/30 bg-success-soft p-4 text-sm text-success">
            Aucun constat. L'ensemble des critères évaluables sont conformes.
          </p>
        ) : (
          <ol className="space-y-3">
            {constats.map((c, i) => {
              const t = toneFor(c.status, STATUS_META);
              return (
                <li key={c.id} className="print-section rounded-md border border-foreground/15 p-4 text-sm">
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      <span className={`mr-2 ${TONE_TEXT[t]}`}>#{i + 1}</span>
                      {c.label}
                    </p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{c.domainLabel}</p>
                  <p className="mt-1.5"><span className="text-xs text-muted-foreground">Constat : </span>{c.valueLabel}</p>
                  {c.threshold && <p className="text-xs"><span className="text-muted-foreground">Référence : </span>{c.threshold}</p>}
                  {c.legalRef && <p className="text-xs text-muted-foreground">{c.legalRef}</p>}
                  {c.evidence?.length > 0 && (
                    <p className="mt-1.5 text-xs text-info">
                      ↳ Liste nominative de {c.evidence.length} salarié{c.evidence.length > 1 ? "s" : ""} disponible dans l'outil.
                    </p>
                  )}
                  {c.risk && (
                    <p className="mt-1.5 rounded-sm bg-destructive-soft px-2 py-1.5 text-xs text-destructive">
                      <span className="font-semibold">Exposition : </span>{c.risk.label}
                      {typeof c.risk.amount === "number" && ` — ≈ ${fmtEuro(c.risk.amount)}${c.risk.unit === "€/an" ? "/an" : ""}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ═══════════ ANNEXE A — QUALITÉ DES DONNÉES ═══════════ */}
      <section className="print-page-break print-section py-8">
        <SectionTitle number="A" title="Annexe — Qualité des données" subtitle="Complétude et anomalies détectées sur le jeu de données source." />

        <h3 className="mb-2 text-sm font-semibold">Complétude par champ</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-foreground/20 text-muted-foreground">
              <th className="py-1.5 text-left font-semibold">Champ</th>
              <th className="py-1.5 text-right font-semibold">Renseignés</th>
              <th className="py-1.5 text-right font-semibold">Couverture</th>
            </tr>
          </thead>
          <tbody>
            {audit.fieldCompleteness.map((c) => {
              const pct = Math.round(c.pct * 100);
              const cls = pct >= 90 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive";
              return (
                <tr key={c.field} className="border-b border-foreground/5">
                  <td className="py-1.5 font-medium">{c.label}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{c.filled} / {c.total}</td>
                  <td className={`py-1.5 text-right font-semibold tabular-nums ${cls}`}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {audit.anomalies.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold">Anomalies détectées ({audit.anomalies.length})</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-foreground/20 text-muted-foreground">
                  <th className="py-1.5 text-left font-semibold">Sévérité</th>
                  <th className="py-1.5 text-left font-semibold">Type</th>
                  <th className="py-1.5 text-left font-semibold">Salarié</th>
                  <th className="py-1.5 text-left font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {audit.anomalies.map((a, i) => (
                  <tr key={i} className="border-b border-foreground/5">
                    <td className={`py-1.5 font-semibold ${a.severity === "erreur" ? "text-destructive" : "text-warning"}`}>
                      {a.severity}
                    </td>
                    <td className="py-1.5 font-mono text-[10px]">{a.type}</td>
                    <td className="py-1.5">{a.employee ? `${a.employee.nom} ${a.employee.prenom}` : "—"}</td>
                    <td className="py-1.5 text-foreground/80">{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="mt-12 border-t border-foreground/10 pt-3 text-center text-[10px] text-muted-foreground">
          Rapport généré par {brand?.name || "RH Cockpit"} · Cockpit d'audit social ·
          Émis le {auditDate.toLocaleDateString("fr-FR")} sur la base de {sourceLabel}
        </footer>
      </section>
    </div>
  );
}
