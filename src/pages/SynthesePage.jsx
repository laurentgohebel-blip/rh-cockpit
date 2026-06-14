import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScoreRing } from "@/components/audit/ScoreRing";
import { ReliabilityGauge } from "@/components/audit/ReliabilityGauge";
import { DomainCard } from "@/components/audit/DomainCard";
import { RiskCard } from "@/components/audit/RiskCard";
import { ConstatRow } from "@/components/audit/ConstatRow";
import { EvidenceSheet } from "@/components/audit/EvidenceSheet";
import { Link } from "react-router-dom";
import { ListChecks, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataContext";
import { topConstats } from "@/core/scoring";
import { STATUS_META } from "@/core/referentiel";
import { buildActionPlan } from "@/core/actions";
import { toneFor } from "@/lib/audit-ui";

export default function SynthesePage() {
  const { audit } = useData();
  const [evidence, setEvidence] = useState(null);

  if (!audit) return null;

  const allCrit = audit.domains.flatMap((d) => d.criteria);
  const nNC = allCrit.filter((c) => c.status === "non-conforme").length;
  const nV = allCrit.filter((c) => c.status === "vigilance").length;
  const nNonConcluant = allCrit.filter((c) => c.status === "non-concluant").length;
  const constats = topConstats(audit, 4);
  const actions = buildActionPlan(audit);
  const hautes = actions.filter((a) => a.priority === "haute").length;
  const totalCharge = actions.reduce((s, a) => s + (a.charge || 0), 0);
  const tone = toneFor(audit.globalStatus, STATUS_META);
  const toneLabel = STATUS_META[audit.globalStatus]?.label || "—";
  const toneTextClass = {
    success: "text-success", warning: "text-warning", destructive: "text-destructive",
    info: "text-info", muted: "text-muted-foreground",
  }[tone];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Synthèse d'audit social</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble du score, des risques et des constats à traiter en priorité.</p>
      </header>

      {/* Score global + fiabilité */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-5 p-5">
          <ScoreRing score={audit.globalScore} status={audit.globalStatus} size={100} />
          <div>
            <p className="text-xs text-muted-foreground">Index de maturité RH</p>
            <p className={`text-lg font-semibold ${toneTextClass}`}>{toneLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nNC + nV} constat{nNC + nV > 1 ? "s" : ""} · dont {nNC} non conforme{nNC > 1 ? "s" : ""}
            </p>
          </div>
        </Card>
        <Card className="p-5">
          <ReliabilityGauge value={audit.reliability} nonConcluants={nNonConcluant} />
        </Card>
      </div>

      {/* Domaines */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scores par domaine</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {audit.domains.map((d) => <DomainCard key={d.key} domain={d} />)}
        </div>
      </section>

      {/* Exposition financière */}
      {audit.risks?.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exposition financière estimée</h2>
          <RiskCard risks={audit.risks} total={audit.totalQuantifiedRisk} />
        </section>
      )}

      {/* Plan d'action — résumé + CTA */}
      {actions.length > 0 && (
        <Card className="flex items-center gap-4 border-info/30 bg-info-soft/30 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info/10">
            <ListChecks className="h-5 w-5 text-info" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Plan d'action généré : {actions.length} actions recommandées</p>
            <p className="text-xs text-muted-foreground">
              dont {hautes} en priorité haute · charge estimée {totalCharge} jours-homme · à arbitrer avec la direction.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/plan-action">Ouvrir le plan<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </Card>
      )}

      {/* Constats prioritaires */}
      {constats.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Constats prioritaires</h2>
          <div className="space-y-2">
            {constats.map((c) => (
              <ConstatRow key={c.id} constat={c} onShowEvidence={setEvidence} />
            ))}
          </div>
        </section>
      )}

      <EvidenceSheet
        open={!!evidence}
        onOpenChange={(v) => !v && setEvidence(null)}
        title={evidence?.label || ""}
        subtitle={evidence ? `${evidence.evidence.length} salariés concernés · ${evidence.valueLabel}` : ""}
        employees={evidence?.evidence || []}
      />
    </div>
  );
}
