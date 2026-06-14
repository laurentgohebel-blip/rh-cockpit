import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDateFr } from "@/lib/utils";

const COLS = [
  { key: "nom", label: "Nom", w: 130 },
  { key: "prenom", label: "Prénom", w: 110 },
  { key: "sexe", label: "Sexe", w: 60, fmt: (v) => (v === "Femme" ? "F" : v === "Homme" ? "H" : "—") },
  { key: "age", label: "Âge", w: 60, fmt: (v) => (v ?? "—") },
  { key: "etab", label: "Étab.", w: 70 },
  { key: "ville", label: "Ville", w: 110 },
  { key: "cdd", label: "Contrat", w: 90, render: (v) => (
    <Badge className={v ? "border-warning/20 bg-warning-soft text-warning" : "border-success/20 bg-success-soft text-success"}>
      {v ? "CDD" : "CDI"}
    </Badge>
  ) },
  { key: "tempsComplet", label: "Temps", w: 70, fmt: (v) => (v ? "TC" : "TP") },
  { key: "salaire", label: "Salaire", w: 90, fmt: (v) => (v ? `${Math.round(v)} €` : "—") },
  { key: "anciennete", label: "Anc.", w: 70, fmt: (v) => (v != null ? `${v} a` : "—") },
  { key: "dateEntree", label: "Entrée", w: 100, fmt: fmtDateFr },
  { key: "dateSortie", label: "Sortie", w: 100, fmt: fmtDateFr },
];

function exportCsv(rows, title) {
  const head = COLS.map((c) => c.label).join(";");
  const body = rows.map((e) =>
    COLS.map((c) => {
      const v = e[c.key];
      if (v instanceof Date) return fmtDateFr(v);
      if (typeof v === "boolean") return v ? "Oui" : "Non";
      return v ?? "";
    }).join(";")
  );
  const csv = "﻿" + [head, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evidence-${title.replace(/\s+/g, "_").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EvidenceSheet({ open, onOpenChange, title, subtitle, employees, onSelectEmployee }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("nom");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let list = employees || [];
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        `${e.nom || ""} ${e.prenom || ""}`.toLowerCase().includes(q) ||
        (e.ville || "").toLowerCase().includes(q) ||
        (e.etab || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (va instanceof Date && vb instanceof Date) return sortAsc ? va - vb : vb - va;
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      va = String(va ?? "").toLowerCase(); vb = String(vb ?? "").toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [employees, search, sortKey, sortAsc]);

  const sortToggle = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortAsc ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{subtitle || `${employees?.length || 0} salariés concernés`}</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-3 border-b px-6 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer par nom, ville, établissement…" className="pl-8" />
          </div>
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> salarié{filtered.length > 1 ? "s" : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, title)}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLS.map((c) => (
                  <TableHead key={c.key} style={{ width: c.w }} onClick={() => sortToggle(c.key)} className="cursor-pointer select-none">
                    {c.label}
                    <SortIcon k={c.key} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLS.length} className="py-8 text-center text-muted-foreground">
                    Aucun résultat
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id} className={onSelectEmployee ? "cursor-pointer" : ""} onClick={() => onSelectEmployee?.(e)}>
                  {COLS.map((c) => (
                    <TableCell key={c.key}>
                      {c.render ? c.render(e[c.key], e) : c.fmt ? c.fmt(e[c.key]) : e[c.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
