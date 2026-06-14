import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConstatRow } from "@/components/audit/ConstatRow";
import { EvidenceSheet } from "@/components/audit/EvidenceSheet";
import { useData } from "@/context/DataContext";
import { topConstats } from "@/core/scoring";
import { generateAlerts } from "@/core/alerts";
import { loadTaskStates, saveTaskStates, markDone, markOpen, isVisible } from "@/core/tasks";

export default function ConstatsPage() {
  const { audit, employees } = useData();
  const [taskStates, setTaskStates] = useState({});
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [evidence, setEvidence] = useState(null);

  useEffect(() => { loadTaskStates().then(setTaskStates); }, []);
  const persist = (next) => { setTaskStates(next); saveTaskStates(next); };

  const constats = useMemo(() => (audit ? topConstats(audit, 50) : []), [audit]);
  const alerts = useMemo(() => (employees ? generateAlerts(employees) : []), [employees]);

  const visibleConstats = constats.filter((c) => {
    if (!showDone && taskStates[`crit-${c.id}`]?.status === "done") return false;
    if (search.length >= 2 && !c.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visibleAlerts = alerts.filter((a) => {
    const state = taskStates[a.id];
    if (!showDone && state?.status === "done") return false;
    if (!isVisible(state)) return false;
    if (search.length >= 2) {
      const q = search.toLowerCase();
      const empName = a.employee ? `${a.employee.nom} ${a.employee.prenom}`.toLowerCase() : "";
      if (!a.title.toLowerCase().includes(q) && !empName.includes(q)) return false;
    }
    return true;
  });

  const doneCount = Object.values(taskStates).filter((s) => s?.status === "done").length;

  if (!audit) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Registre des constats</h1>
          <p className="text-sm text-muted-foreground">
            Constats issus du référentiel d'audit + alertes opérationnelles (visites médicales, périodes d'essai, médailles…).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDone(!showDone)}>
          {showDone ? "Masquer" : "Afficher"} les traités ({doneCount})
        </Button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un constat ou un salarié…" className="pl-8" />
      </div>

      {/* Constats référentiel */}
      {visibleConstats.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Constats du référentiel ({visibleConstats.length})
          </h2>
          <div className="space-y-2">
            {visibleConstats.map((c) => {
              const taskKey = `crit-${c.id}`;
              const isDone = taskStates[taskKey]?.status === "done";
              return (
                <div key={c.id} className={isDone ? "opacity-50" : undefined}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <ConstatRow constat={c} onShowEvidence={setEvidence} />
                    </div>
                    <Button
                      size="sm"
                      variant={isDone ? "outline" : "secondary"}
                      onClick={() => persist(isDone ? markOpen(taskStates, taskKey) : markDone(taskStates, taskKey))}
                    >
                      {isDone ? "↩︎ Rouvrir" : "✓ Fait"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Alertes opérationnelles */}
      {visibleAlerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alertes opérationnelles ({visibleAlerts.length})
          </h2>
          <div className="space-y-2">
            {visibleAlerts.map((a) => {
              const isDone = taskStates[a.id]?.status === "done";
              const toneClass = a.priority === "urgent" ? "border-destructive/30 bg-destructive-soft text-destructive"
                : a.priority === "high" ? "border-warning/30 bg-warning-soft text-warning"
                : "border-info/30 bg-info-soft text-info";
              return (
                <Card key={a.id} className={`flex items-start gap-3 p-3 ${isDone ? "opacity-50" : ""}`}>
                  <Badge className={toneClass}>{a.priority}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                    {a.employee && (
                      <p className="mt-1 text-xs text-foreground/70">
                        {a.employee.nom} {a.employee.prenom} · Étab. {a.employee.etab} · {a.employee.ville}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isDone ? "outline" : "secondary"}
                    onClick={() => persist(isDone ? markOpen(taskStates, a.id) : markDone(taskStates, a.id))}
                  >
                    {isDone ? "↩︎" : "✓"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {visibleConstats.length === 0 && visibleAlerts.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {showDone ? "Aucun constat." : "Tout est traité. 🎉"}
        </div>
      )}

      <EvidenceSheet
        open={!!evidence}
        onOpenChange={(v) => !v && setEvidence(null)}
        title={evidence?.label || ""}
        subtitle={evidence ? `${evidence.evidence.length} salariés concernés` : ""}
        employees={evidence?.evidence || []}
      />
    </div>
  );
}
