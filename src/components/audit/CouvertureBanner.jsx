import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { manquesAdemander } from "@/core/sources";

/**
 * Ce que la source permet — et surtout ne permet pas — d'auditer.
 *
 * C'est le garde-fou du rapport. Un lecteur qui ne voit aucun constat sur
 * le suivi médical doit comprendre que la question n'a pas été examinée,
 * jamais qu'elle est conforme. L'absence de reproche n'est pas un quitus,
 * et c'est à l'outil de le dire — pas à l'auditeur de s'en souvenir.
 */
export function CouvertureBanner({ couverture }) {
  const [ouvert, setOuvert] = useState(false);
  if (!couverture || !couverture.nonEvaluables.length) return null;

  const manques = manquesAdemander(couverture);

  const copierDemande = () => {
    const texte = [
      "Pour compléter l'audit, merci de nous transmettre :",
      "",
      ...manques.map((m) => `— ${m.libelle} (permettrait d'évaluer : ${m.critères.join(", ")})`),
    ].join("\n");
    navigator.clipboard?.writeText(texte);
    toast.success("Demande copiée");
  };

  return (
    <Card className="border-info/30 bg-info-soft/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info/10">
          <Info className="h-4 w-4 text-info" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            Périmètre de l'audit — {couverture.evaluables} critère{couverture.evaluables > 1 ? "s" : ""} sur {couverture.total} évalué{couverture.evaluables > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Source : {couverture.modeLabel}. {couverture.avertissement}
          </p>

          {ouvert && (
            <div className="mt-3 space-y-2">
              {couverture.nonEvaluables.map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.domaine} · {c.cause}
                  </p>
                </div>
              ))}

              {manques.length > 0 && (
                <div className="mt-3 rounded-md border border-border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium">Pour lever ces angles morts</p>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                    {manques.map((m) => (
                      <li key={m.champ}>{m.libelle}</li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="mt-2" onClick={copierDemande}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copier la demande au client
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setOuvert((v) => !v)}>
            {ouvert ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {ouvert ? "Masquer le détail" : `Voir les ${couverture.nonEvaluables.length} critères non évalués`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
