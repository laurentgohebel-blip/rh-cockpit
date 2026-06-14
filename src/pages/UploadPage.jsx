import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload as UploadIcon, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { readExcelFile, parseWithMapping } from "@/core/parser";
import { detectProfile, applyProfileMapping, autoMapColumns, FIELDS, PROFILES } from "@/core/profiles";
import { loadMapping } from "@/core/storage";
import { generateDemoEmployees, DEMO_FILENAME } from "@/core/demoData";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";

export default function UploadPage() {
  const { ingest } = useData();
  const navigate = useNavigate();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const result = readExcelFile(buf);

      // 1. Mapping sauvegardé — complété si des clés actuelles du modèle sont absentes
      //    (ex : un mapping pré-existant ne connaissait pas les nouveaux champs étrangers)
      const saved = await loadMapping();
      if (saved) {
        const merged = { ...saved.mapping };
        const missing = FIELDS.filter((f) => !(f.key in merged));
        if (missing.length > 0) {
          // Récupère via le profil sauvegardé si possible, sinon auto-detection floue
          const profile = saved.profileId ? PROFILES.find((p) => p.id === saved.profileId) : null;
          const fallback = profile
            ? applyProfileMapping(profile, result.headers)
            : autoMapColumns(result.headers);
          missing.forEach((f) => { merged[f.key] = fallback[f.key] ?? -1; });
        }
        try {
          const employees = parseWithMapping(result.dataRows, merged);
          ingest(employees, file.name, merged, saved.profileId);
          toast.success(`${employees.length} salariés importés`);
          navigate("/audit");
          return;
        } catch { /* fallthrough */ }
      }

      // 2. Profil auto-détecté
      const profile = detectProfile(result.headers);
      if (profile) {
        const mapping = applyProfileMapping(profile, result.headers);
        if (mapping.nom >= 0 && mapping.prenom >= 0 && mapping.sexe >= 0 && mapping.dateEntree >= 0) {
          try {
            const employees = parseWithMapping(result.dataRows, mapping);
            ingest(employees, file.name, mapping, profile.id);
            toast.success(`Profil détecté : ${profile.name} · ${employees.length} salariés`);
            navigate("/audit");
            return;
          } catch { /* fallthrough */ }
        }
      }

      // 3. Mapping manuel requis
      sessionStorage.setItem("pending-upload", JSON.stringify({
        headers: result.headers,
        dataRows: result.dataRows,
        sampleRows: result.sampleRows,
        totalRows: result.totalRows,
        fileName: file.name,
      }));
      navigate("/mapping");
    } catch (e) {
      toast.error("Erreur : " + e.message);
    } finally {
      setBusy(false);
    }
  }, [ingest, navigate]);

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleDemo = useCallback(() => {
    setBusy(true);
    try {
      const employees = generateDemoEmployees();
      ingest(employees, DEMO_FILENAME, null, "demo");
      toast.success(`Données de démonstration chargées · ${employees.filter((e) => e.actif).length} salariés actifs`);
      navigate("/audit");
    } catch (e) {
      toast.error("Erreur lors du chargement de la démo : " + e.message);
    } finally {
      setBusy(false);
    }
  }, [ingest, navigate]);

  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Démarrer un audit social</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Glissez un export Excel de votre logiciel de paie. Le traitement est 100 % local — aucune donnée ne quitte le navigateur.
        </p>
      </div>

      <Card
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 border-2 border-dashed py-16 transition",
          drag ? "border-accent bg-accent/5" : "border-border",
          busy && "opacity-60"
        )}
      >
        <UploadIcon className="h-12 w-12 text-muted-foreground" />
        <p className="text-base font-medium">Glissez votre fichier Excel ici</p>
        <p className="text-xs text-muted-foreground">ou</p>
        <label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={busy}
          />
          <Button asChild disabled={busy}>
            <span>{busy ? "Analyse en cours…" : "Sélectionner un fichier"}</span>
          </Button>
        </label>
        <p className="mt-4 text-xs text-muted-foreground">Formats supportés : .xlsx, .xls</p>
      </Card>

      {/* Démo */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Card className="flex items-center gap-4 border-info/30 bg-info-soft/30 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info/10">
          <Sparkles className="h-5 w-5 text-info" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Pas de fichier sous la main ?</p>
          <p className="text-xs text-muted-foreground">
            Découvrez l'outil avec un jeu de données fictif (≈ 150 salariés, anonymisé). Idéal pour les démos commerciales.
          </p>
        </div>
        <Button onClick={handleDemo} disabled={busy} variant="outline">
          <Sparkles className="mr-1 h-4 w-4" />
          Charger une démo
        </Button>
      </Card>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <Card className="p-4">
          <FileSpreadsheet className="mb-2 h-5 w-5 text-info" />
          <p className="text-sm font-medium">7 logiciels supportés</p>
          <p className="text-xs text-muted-foreground">Quadratus, Sage, Cegid, Silaé, PayFit, ADP, Lucca — détection automatique.</p>
        </Card>
        <Card className="p-4">
          <ShieldCheck className="mb-2 h-5 w-5 text-success" />
          <p className="text-sm font-medium">100 % local</p>
          <p className="text-xs text-muted-foreground">Traitement dans votre navigateur, données stockées en IndexedDB.</p>
        </Card>
        <Card className="p-4">
          <div className="mb-2 inline-flex h-5 w-5 items-center justify-center rounded bg-accent text-[10px] font-semibold text-accent-foreground">17</div>
          <p className="text-sm font-medium">Critères d'audit</p>
          <p className="text-xs text-muted-foreground">Référentiel basé sur les obligations légales françaises et seuils sectoriels.</p>
        </Card>
      </div>
    </div>
  );
}
