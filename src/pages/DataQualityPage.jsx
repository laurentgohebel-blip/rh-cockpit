import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useData } from "@/context/DataContext";

export default function DataQualityPage() {
  const { audit } = useData();
  if (!audit) return null;

  const completeness = audit.fieldCompleteness;
  const anomalies = audit.anomalies;
  const erreurs = anomalies.filter((a) => a.severity === "erreur");
  const alertes = anomalies.filter((a) => a.severity === "alerte");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Qualité des données</h1>
        <p className="text-sm text-muted-foreground">
          Complétude des champs et anomalies détectées. Conditionne la fiabilité de l'audit.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" />Fiabilité globale</div>
          <p className="mt-1 text-2xl font-semibold">{audit.reliability}%</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 text-destructive" />Erreurs</div>
          <p className="mt-1 text-2xl font-semibold text-destructive">{erreurs.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 text-warning" />Alertes</div>
          <p className="mt-1 text-2xl font-semibold text-warning">{alertes.length}</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complétude par champ</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Champ</TableHead>
                <TableHead className="w-1/3">Taux</TableHead>
                <TableHead className="w-32 text-right">Renseignés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completeness.map((c) => {
                const pct = Math.round(c.pct * 100);
                const tone = pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-destructive";
                return (
                  <TableRow key={c.field}>
                    <TableCell className="font-medium">{c.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} indicatorClassName={tone} className="flex-1" />
                        <span className="w-10 text-right text-xs font-medium tabular-nums">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.filled} / {c.total}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      {anomalies.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anomalies détectées ({anomalies.length})</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Sévérité</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Salarié</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge className={a.severity === "erreur" ? "border-destructive/20 bg-destructive-soft text-destructive" : "border-warning/20 bg-warning-soft text-warning"}>
                        {a.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.type}</TableCell>
                    <TableCell>
                      {a.employee ? <span className="text-sm">{a.employee.nom} {a.employee.prenom}</span> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{a.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <p className="mt-2 text-sm font-medium">Aucune anomalie détectée</p>
          <p className="text-xs text-muted-foreground">Le jeu de données est cohérent.</p>
        </Card>
      )}
    </div>
  );
}
