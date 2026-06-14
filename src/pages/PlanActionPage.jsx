import { useEffect, useMemo, useState } from "react";
import { Download, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useData } from "@/context/DataContext";
import { buildActionPlan, planSummary } from "@/core/actions";

const STORAGE_KEY = "rh-cockpit-action-overrides";

const PRIO_BADGE = {
  haute: "border-destructive/20 bg-destructive-soft text-destructive",
  moyenne: "border-warning/20 bg-warning-soft text-warning",
  basse: "border-info/20 bg-info-soft text-info",
};

const STATE_OPTIONS = [
  { key: "open", label: "À faire" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Fait" },
];

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

function exportCsv(actions) {
  const head = ["Priorité", "Domaine", "Constat", "Action recommandée", "Charge (j)", "Échéance (mois)", "Responsable", "Statut", "Échéance saisie", "Notes"];
  const rows = actions.map((a) => [
    a.priority, a.domainLabel, a.constat, a.action, a.charge, a.deadline, a.owner,
    a.state || "open", a.dueDate || "", (a.notes || "").replace(/\n/g, " "),
  ].join(";"));
  const csv = "﻿" + [head.join(";"), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "plan-action-rh.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function PlanActionPage() {
  const { audit } = useData();
  const baseActions = useMemo(() => buildActionPlan(audit), [audit]);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [filterState, setFilterState] = useState("active"); // active | all | done

  if (!audit) return null;

  const actions = baseActions.map((a) => ({ ...a, ...(overrides[a.id] || {}) }));

  const updateAction = (id, patch) => {
    const next = { ...overrides, [id]: { ...(overrides[id] || {}), ...patch } };
    setOverrides(next);
    saveOverrides(next);
  };

  const visible = actions.filter((a) => {
    const s = a.state || "open";
    if (filterState === "active") return s !== "done";
    if (filterState === "done") return s === "done";
    return true;
  });

  const summary = planSummary(baseActions, overrides);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Plan d'action</h1>
          <p className="text-sm text-muted-foreground">
            Actions recommandées générées à partir des {summary.total} constats. Affectez un responsable, une échéance, suivez l'avancement.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCsv(actions)}>
          <Download className="mr-1 h-4 w-4" />Export CSV
        </Button>
      </header>

      {/* Synthèse */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 text-destructive" />Priorité haute</div>
          <p className="mt-1 text-2xl font-semibold text-destructive">{summary.haute}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 text-warning" />Priorité moyenne</div>
          <p className="mt-1 text-2xl font-semibold text-warning">{summary.moyenne}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4 text-info" />Charge estimée</div>
          <p className="mt-1 text-2xl font-semibold">{summary.totalCharge} <span className="text-sm font-normal text-muted-foreground">j-h</span></p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Avancement</div>
          <p className="mt-1 text-2xl font-semibold">{summary.done}<span className="text-sm font-normal text-muted-foreground"> / {summary.total}</span></p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtre :</span>
        {[
          { key: "active", label: "À traiter" },
          { key: "done", label: "Fait" },
          { key: "all", label: "Tout" },
        ].map((f) => (
          <Button key={f.key} variant={filterState === f.key ? "default" : "outline"} size="sm" onClick={() => setFilterState(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          {filterState === "done" ? "Aucune action terminée pour l'instant." : "Aucune action — l'audit est conforme."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Prio.</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-32">Responsable</TableHead>
                <TableHead className="w-24">Charge</TableHead>
                <TableHead className="w-36">Échéance</TableHead>
                <TableHead className="w-32">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => {
                const isDone = a.state === "done";
                return (
                  <TableRow key={a.id} className={isDone ? "opacity-60" : undefined}>
                    <TableCell>
                      <Badge className={PRIO_BADGE[a.priority]}>{a.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{a.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.domainLabel} · {a.constat}</p>
                      <p className="mt-0.5 text-[11px] text-foreground/60">{a.detail}</p>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={a.owner}
                        onBlur={(e) => updateAction(a.id, { owner: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="tabular-nums">{a.charge} j-h</span>
                      <p className="text-[10px] text-muted-foreground">~{a.deadline} mois</p>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        defaultValue={a.dueDate || ""}
                        onChange={(e) => updateAction(a.id, { dueDate: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={a.state || "open"} onValueChange={(v) => updateAction(a.id, { state: v })}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATE_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
