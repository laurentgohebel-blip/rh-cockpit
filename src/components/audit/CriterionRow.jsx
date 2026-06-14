import { ArrowRight, Scale, Wallet, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { STATUS_META } from "@/core/referentiel";
import { toneFor, TONE_HEX } from "@/lib/audit-ui";
import { fmtEuro } from "@/lib/utils";

export function CriterionRow({ criterion, onShowEvidence }) {
  const tone = toneFor(criterion.status, STATUS_META);
  return (
    <div
      className="rounded-md border bg-card p-4"
      style={{ borderLeft: `3px solid ${TONE_HEX[tone]}` }}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{criterion.label}</h3>
            <StatusBadge status={criterion.status} />
          </div>
          {criterion.valueLabel && (
            <p className="text-sm text-foreground/80">
              {criterion.valueLabel}
              {criterion.threshold && (
                <span className="text-muted-foreground"> · cible {criterion.threshold}</span>
              )}
            </p>
          )}
          {criterion.legalRef && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Scale className="h-3 w-3" />
              {criterion.legalRef}
            </p>
          )}
          {criterion.benchmark && (
            <p className="flex items-center gap-1 text-xs text-info">
              <BarChart3 className="h-3 w-3" />
              {criterion.benchmark.label}
            </p>
          )}
          {criterion.risk && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <Wallet className="h-3 w-3" />
              {criterion.risk.label}
              {typeof criterion.risk.amount === "number" && (
                <span className="font-medium">
                  — ≈ {fmtEuro(criterion.risk.amount)}
                  {criterion.risk.unit === "€/an" && "/an"}
                </span>
              )}
            </p>
          )}
        </div>
        {criterion.evidence?.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => onShowEvidence?.(criterion)} className="shrink-0">
            Voir les {criterion.evidence.length}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
