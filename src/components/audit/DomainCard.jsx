import { Link } from "react-router-dom";
import { ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_META } from "@/core/referentiel";
import { domainHeadline } from "@/core/scoring";
import { classesFor } from "@/lib/audit-ui";
import { cn } from "@/lib/utils";

const ICONS = {
  conformite: "ti-scale",
  remuneration: "ti-coin",
  mouvements: "ti-arrows-exchange",
  effectifs: "ti-users",
};

export function DomainCard({ domain }) {
  const c = classesFor(domain.status, STATUS_META);
  const h = domainHeadline(domain);
  const nb = h.nNonConforme + h.nVigilance;
  return (
    <Link to={`/audit/${domain.key}`} className="block">
      <Card className="group flex flex-col gap-3 p-5 transition hover:border-foreground/20 hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="text-base">{domain.icon}</span>
            <span>{domain.label}</span>
          </div>
          <span className={cn("rounded-md px-2.5 py-1 text-base font-semibold", c.badge)}>{domain.score ?? "—"}</span>
        </div>
        <p className="text-xs text-muted-foreground">{h.valueLabel || "—"}</p>
        <div className="flex items-center justify-between text-xs">
          {nb > 0 ? (
            <span className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {nb} constat{nb > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aucun constat
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
