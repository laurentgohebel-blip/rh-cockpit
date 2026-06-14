import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CriterionRow } from "@/components/audit/CriterionRow";
import { StatusBadge } from "@/components/audit/StatusBadge";
import { EvidenceSheet } from "@/components/audit/EvidenceSheet";
import { DsnImport, DsnStatusBar, CoherenceBanner } from "@/components/audit/DsnImport";
import { useData } from "@/context/DataContext";
import { STATUS_META } from "@/core/referentiel";
import { toneFor } from "@/lib/audit-ui";

const TONE_TEXT = {
  success: "text-success", warning: "text-warning", destructive: "text-destructive",
  info: "text-info", muted: "text-muted-foreground",
};

export default function DomainPage() {
  const { domain: key } = useParams();
  const { audit } = useData();
  const [evidence, setEvidence] = useState(null);

  if (!audit) return null;
  const domain = audit.domains.find((d) => d.key === key);
  if (!domain) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Domaine inconnu.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/audit"><ArrowLeft className="mr-1 h-4 w-4" />Retour synthèse</Link>
        </Button>
      </div>
    );
  }

  const tone = toneFor(domain.status, STATUS_META);
  // Le domaine santé n'est évaluable qu'avec une DSN. Si non alimenté → invite à l'import.
  const santeSansDsn = key === "sante" && domain.score === null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/audit"><ArrowLeft className="mr-1 h-4 w-4" />Synthèse</Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span>{domain.icon}</span>{domain.label}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {domain.evaluableCount} critère{domain.evaluableCount > 1 ? "s" : ""} évalué{domain.evaluableCount > 1 ? "s" : ""} · poids {(domain.weight * 100).toFixed(0)}% de l'index global
            </p>
          </div>
          <Card className="flex items-center gap-3 px-5 py-3">
            <div className="text-right">
              <p className={`text-2xl font-semibold ${TONE_TEXT[tone]}`}>{domain.score ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
            </div>
            <StatusBadge status={domain.status} />
          </Card>
        </div>
      </div>

      {key === "sante" && <DsnStatusBar />}
      {key === "sante" && <CoherenceBanner />}

      {santeSansDsn ? (
        <DsnImport />
      ) : (
        <div className="space-y-3">
          {domain.criteria.map((c) => (
            <CriterionRow key={c.id} criterion={c} onShowEvidence={setEvidence} />
          ))}
        </div>
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
