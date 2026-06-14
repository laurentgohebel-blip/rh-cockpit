import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { parseWithMapping } from "@/core/parser";
import { FIELDS, PROFILES, detectProfile, applyProfileMapping, autoMapColumns } from "@/core/profiles";
import { useData } from "@/context/DataContext";

export default function MappingPage() {
  const { ingest } = useData();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [profileId, setProfileId] = useState("auto");
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    const raw = sessionStorage.getItem("pending-upload");
    if (!raw) { navigate("/"); return; }
    const data = JSON.parse(raw);
    setPending(data);
    const detected = detectProfile(data.headers);
    if (detected) {
      setProfileId(detected.id);
      setMapping(applyProfileMapping(detected, data.headers));
    } else {
      setMapping(autoMapColumns(data.headers));
    }
  }, [navigate]);

  const mappedCount = useMemo(() => Object.values(mapping).filter((v) => v >= 0).length, [mapping]);
  const missingRequired = useMemo(
    () => FIELDS.filter((f) => f.required && (mapping[f.key] ?? -1) === -1),
    [mapping]
  );

  if (!pending) return null;

  const handleProfileChange = (id) => {
    setProfileId(id);
    if (id === "auto") setMapping(autoMapColumns(pending.headers));
    else {
      const p = PROFILES.find((x) => x.id === id);
      if (p) setMapping(applyProfileMapping(p, pending.headers));
    }
  };

  const handleConfirm = () => {
    try {
      const employees = parseWithMapping(pending.dataRows, mapping);
      ingest(employees, pending.fileName, mapping, profileId === "auto" ? null : profileId);
      sessionStorage.removeItem("pending-upload");
      toast.success(`${employees.length} salariés importés`);
      navigate("/audit");
    } catch (e) {
      toast.error("Erreur : " + e.message);
    }
  };

  const preview = (idx) => {
    if (idx < 0 || !pending.sampleRows?.length) return "—";
    return pending.sampleRows.slice(0, 3).map((r) => String(r[idx] ?? "").trim()).filter(Boolean).join(" · ") || "—";
  };

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Configuration des colonnes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.headers.length} colonnes détectées · {pending.totalRows} lignes · associez chaque champ RH attendu à une colonne du fichier.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Profil logiciel :</span>
        <Select value={profileId} onValueChange={handleProfileChange}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Détection automatique</SelectItem>
            {PROFILES.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} — {p.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{mappedCount}/{FIELDS.length} champs mappés</div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Champ RH</TableHead>
              <TableHead className="w-2/5">Colonne du fichier</TableHead>
              <TableHead>Aperçu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FIELDS.map((f) => {
              const idx = mapping[f.key] ?? -1;
              const isMapped = idx >= 0;
              const isMissing = f.required && !isMapped;
              return (
                <TableRow key={f.key} className={isMissing ? "bg-destructive-soft/30" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{f.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{f.label}</p>
                        {f.required && <p className="text-[10px] font-semibold uppercase text-destructive">Obligatoire</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={idx >= 0 ? String(idx) : "-1"}
                      onValueChange={(v) => setMapping((prev) => ({ ...prev, [f.key]: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">— Non mappé —</SelectItem>
                        {pending.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>{h || `Colonne ${i + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{isMapped ? preview(idx) : "Aucune donnée"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {missingRequired.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Champs obligatoires manquants</p>
            <p className="text-xs">{missingRequired.map((f) => f.label).join(", ")}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center gap-3">
          {missingRequired.length === 0 && (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" /> Prêt à analyser
            </span>
          )}
          <Button onClick={handleConfirm} disabled={missingRequired.length > 0}>
            Valider et analyser
          </Button>
        </div>
      </div>
    </div>
  );
}
