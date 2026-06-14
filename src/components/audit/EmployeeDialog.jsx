import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtDateFr } from "@/lib/utils";

function Field({ label, value }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export function EmployeeDialog({ emp, open, onOpenChange }) {
  if (!emp) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{emp.nom} {emp.prenom}</DialogTitle>
          <DialogDescription>
            {emp.ville} · Étab. {emp.etab}
            <Badge className={`ml-2 ${emp.actif ? "border-success/20 bg-success-soft text-success" : "border-destructive/20 bg-destructive-soft text-destructive"}`}>
              {emp.actif ? "Actif" : "Sorti"}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-info">Identité</div>
          <Field label="Sexe" value={emp.sexe} />
          <Field label="Âge" value={emp.age ? `${emp.age} ans` : null} />
          <Field label="Date de naissance" value={fmtDateFr(emp.dateNaiss)} />
          {emp.email && <Field label="Email" value={emp.email} />}
          {emp.tel && <Field label="Téléphone" value={emp.tel} />}

          <div className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-wide text-info">Contrat</div>
          <Field label="Type" value={emp.cdd ? "CDD" : "CDI"} />
          <Field label="Temps" value={emp.tempsComplet ? "Temps complet" : "Temps partiel"} />
          <Field label="Date d'entrée" value={fmtDateFr(emp.dateEntree)} />
          <Field label="Ancienneté" value={emp.anciennete != null ? `${emp.anciennete} ans` : null} />
          {emp.dateSortie && <Field label="Date de sortie" value={fmtDateFr(emp.dateSortie)} />}
          {emp.motifLabel && <Field label="Motif sortie" value={emp.motifLabel} />}

          <div className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-wide text-info">Rémunération</div>
          <Field label="Salaire de base" value={emp.salaire ? `${emp.salaire.toFixed(2)} €` : null} />
          <Field label="Heures/mois" value={emp.heures ? `${emp.heures} h` : null} />

          <div className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-wide text-info">Conformité</div>
          <Field label="Visite médicale" value={fmtDateFr(emp.visiteDate)} />
          <Field label="RQTH" value={emp.handicap ? "Oui" : "Non"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
