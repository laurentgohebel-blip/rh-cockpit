import { useCallback, useState } from "react";
import { FileUp, CheckCircle2, X, AlertTriangle, Info, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";

// Lit un fichier .dsn (texte latin1 le plus souvent) et l'ingère.
export function DsnImport({ compact = false }) {
  const { ingestDsn, employees } = useData();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      // DSN = ISO-8859-1 (latin1) dans la quasi-totalité des cas
      const text = new TextDecoder("iso-8859-1").decode(buf);
      const parsed = ingestDsn(text, file.name);
      const nb = parsed.individus.length;
      toast.success(`DSN importée · ${nb} salariés déclarés`);
    } catch (e) {
      toast.error("Erreur lecture DSN : " + e.message);
    } finally {
      setBusy(false);
    }
  }, [ingestDsn]);

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const input = (
    <label>
      <input type="file" accept=".dsn,.txt" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} disabled={busy} />
      <Button asChild size={compact ? "sm" : "default"} disabled={busy} variant={compact ? "outline" : "default"}>
        <span><FileUp className="mr-1 h-4 w-4" />{busy ? "Lecture…" : "Importer une DSN"}</span>
      </Button>
    </label>
  );

  if (compact) return input;

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-2 border-dashed py-12 text-center transition",
        drag ? "border-accent bg-accent/5" : "border-border",
        busy && "opacity-60"
      )}
    >
      <FileUp className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-base font-medium">Importez une DSN pour activer ce domaine</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          La Déclaration Sociale Nominative apporte l'absentéisme, les AT/MP et la masse salariale fine.
          Croisée par NIR avec {employees ? `vos ${employees.filter((e) => e.actif).length} salariés` : "votre fichier de paie"}.
          Traitement 100 % local.
        </p>
      </div>
      {input}
      <p className="text-xs text-muted-foreground">Fichier .dsn (format normé)</p>
    </Card>
  );
}

// Bandeau d'état affiché quand une DSN est chargée
export function DsnStatusBar() {
  const { dsnMeta, removeDsn } = useData();
  if (!dsnMeta) return null;
  const pct = Math.round(dsnMeta.coverage * 100);
  return (
    <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success-soft/40 px-4 py-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-success" />
      <div className="flex-1">
        <span className="font-medium">DSN {dsnMeta.mois}</span>
        <span className="text-muted-foreground">
          {" "}· {dsnMeta.nbIndividus} salariés déclarés · {dsnMeta.matched} rapprochés ({pct} %)
          {dsnMeta.idcc && ` · IDCC ${dsnMeta.idcc}`}
        </span>
      </div>
      {/* Marquage temporel : la DSN est mensuelle, jamais annualisée */}
      <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
        <CalendarClock className="h-3 w-3" />1 mois — non annualisé
      </span>
      <Button variant="ghost" size="sm" onClick={removeDsn} title="Retirer la DSN">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Bandeau d'alerte de cohérence des sources (périodes/fréquences différentes)
export function CoherenceBanner() {
  const { dsnCoherence } = useData();
  if (!dsnCoherence || dsnCoherence.warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {dsnCoherence.warnings.map((w, i) => {
        const danger = w.level === "warning";
        const Icon = danger ? AlertTriangle : Info;
        return (
          <div
            key={i}
            className={
              "flex items-start gap-2 rounded-md border px-4 py-2.5 text-sm " +
              (danger
                ? "border-warning/30 bg-warning-soft text-warning"
                : "border-info/30 bg-info-soft text-info")
            }
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-medium">{danger ? "Cohérence des sources" : "À vérifier"} — </span>
              <span className="text-foreground/80">{w.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
