import { useState } from "react";
import { Copy, ExternalLink, Trash2, Plus, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { encodeBrand } from "@/context/BrandContext";

const PALETTES = [
  { name: "Bleu", accent: "hsl(217 91% 60%)" },
  { name: "Rouge", accent: "hsl(0 72% 51%)" },
  { name: "Vert", accent: "hsl(160 84% 28%)" },
  { name: "Violet", accent: "hsl(262 83% 58%)" },
  { name: "Orange", accent: "hsl(20 90% 48%)" },
  { name: "Cyan", accent: "hsl(190 84% 39%)" },
  { name: "Indigo", accent: "hsl(243 75% 58%)" },
  { name: "Rose", accent: "hsl(330 81% 60%)" },
];

const loadClients = () => { try { return JSON.parse(localStorage.getItem("rh-cockpit-clients") || "[]"); } catch { return []; } };
const saveClients = (clients) => localStorage.setItem("rh-cockpit-clients", JSON.stringify(clients));

export default function AdminPage() {
  const [clients, setClients] = useState(loadClients);
  const [editing, setEditing] = useState(null);

  const clientUrl = (client) => `${window.location.origin}/?brand=${encodeBrand(client)}`;

  const handleNew = () => setEditing({
    id: Date.now().toString(36),
    name: "", logo: "", accent: PALETTES[0].accent,
    createdAt: new Date().toISOString(),
  });

  const handleSave = () => {
    if (!editing.name.trim()) { toast.error("Nom du client requis"); return; }
    const final = { ...editing, logo: editing.logo || editing.name.slice(0, 2).toUpperCase() };
    const next = [...clients.filter((c) => c.id !== final.id), final];
    setClients(next); saveClients(next);
    setEditing(null);
    toast.success("Client enregistré");
  };

  const handleDelete = (id) => {
    if (!confirm("Supprimer ce client ?")) return;
    const next = clients.filter((c) => c.id !== id);
    setClients(next); saveClients(next);
  };

  const copyUrl = (c) => {
    navigator.clipboard.writeText(clientUrl(c));
    toast.success("Lien copié");
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setEditing(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" />Retour
        </Button>
        <h1 className="text-xl font-semibold">{editing.name ? `Configurer ${editing.name}` : "Nouveau client"}</h1>

        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nom du client *</label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex : Atlas Propreté" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Logo (2-3 lettres)</label>
              <Input value={editing.logo} onChange={(e) => setEditing({ ...editing, logo: e.target.value.slice(0, 3).toUpperCase() })} placeholder="AP" className="mt-1 font-semibold uppercase tracking-wider" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Couleur principale</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setEditing({ ...editing, accent: p.accent })}
                  style={{ background: p.accent }}
                  className={`flex h-10 w-10 items-center justify-center rounded-md text-white transition ${editing.accent === p.accent ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                  title={p.name}
                >
                  {editing.accent === p.accent && "✓"}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Aperçu</label>
            <Card className="mt-2 overflow-hidden">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold text-white" style={{ background: editing.accent }}>
                  {editing.logo || editing.name.slice(0, 2).toUpperCase() || "RH"}
                </div>
                <div>
                  <p className="text-sm font-semibold">{editing.name || "RH Cockpit"}</p>
                  <p className="text-[11px] text-muted-foreground">Cockpit d'audit · 120 actifs</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {["Conformité", "Rémunération", "Mouvements"].map((k) => (
                  <div key={k} className="rounded-md border bg-secondary/30 p-3">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="text-xl font-semibold" style={{ color: editing.accent }}>72</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {editing.name && (
            <div className="rounded-md bg-secondary p-3">
              <p className="text-xs font-medium text-muted-foreground">Lien client</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Input value={clientUrl(editing)} readOnly className="font-mono text-xs" />
                <Button size="sm" onClick={() => copyUrl(editing)}>
                  <Copy className="mr-1 h-3.5 w-3.5" />Copier
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gestion des clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} client{clients.length > 1 ? "s" : ""} configuré{clients.length > 1 ? "s" : ""} en marque blanche.</p>
        </div>
        <Button onClick={handleNew}><Plus className="mr-1 h-4 w-4" />Nouveau client</Button>
      </header>

      {clients.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm font-medium">Aucun client configuré</p>
          <p className="text-xs text-muted-foreground">Créez votre premier client en 30 secondes</p>
          <Button onClick={handleNew} className="mt-4"><Plus className="mr-1 h-4 w-4" />Créer un client</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {clients.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <Card key={c.id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold text-white" style={{ background: c.accent }}>
                {c.logo || c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">Créé le {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyUrl(c)}><Copy className="mr-1 h-3.5 w-3.5" />Lien</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(clientUrl(c), "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Modifier</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive hover:bg-destructive-soft"><Trash2 className="h-3.5 w-3.5" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
