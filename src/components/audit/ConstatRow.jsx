import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_META } from "@/core/referentiel";
import { toneFor, TONE_HEX } from "@/lib/audit-ui";

export function ConstatRow({ constat, onShowEvidence }) {
  const tone = toneFor(constat.status, STATUS_META);
  return (
    <div
      className="flex items-center gap-3 rounded-md border bg-card px-4 py-3"
      style={{ borderLeft: `3px solid ${TONE_HEX[tone]}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{constat.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {constat.domainLabel} · {constat.valueLabel}
        </p>
      </div>
      {constat.evidence?.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => onShowEvidence?.(constat)} className="shrink-0">
          Voir les {constat.evidence.length}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
