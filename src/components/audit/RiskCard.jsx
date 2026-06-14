import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtEuro } from "@/lib/utils";

export function RiskCard({ risks, total }) {
  if (!risks || risks.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Exposition financière estimée</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {risks.length} risque{risks.length > 1 ? "s" : ""} identifié{risks.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul>
        {risks.map((r, i) => (
          <li key={r.critId} className={`flex items-center gap-3 px-5 py-3 ${i < risks.length - 1 ? "border-b" : ""}`}>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.basis}</p>
            </div>
            <div className="whitespace-nowrap text-right">
              {typeof r.amount === "number" ? (
                <p className="text-base font-semibold text-destructive">
                  ≈ {fmtEuro(r.amount)}
                  {r.unit === "€/an" && <span className="ml-1 text-xs font-normal text-muted-foreground">/an</span>}
                </p>
              ) : (
                <p className="text-sm font-medium text-warning">à évaluer</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <div className="border-t bg-secondary/40 px-5 py-2 text-xs text-muted-foreground">
          Total chiffré : ≈ {fmtEuro(total)} · estimations indicatives, à confirmer par l'auditeur.
        </div>
      )}
    </Card>
  );
}
