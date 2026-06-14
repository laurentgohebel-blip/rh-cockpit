import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Scale, Coins, ArrowRightLeft, Users, Bell, Database,
  BarChart3, Settings, RotateCcw, FileText, ListChecks, HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeSearch } from "@/components/audit/EmployeeSearch";
import { DsnImport } from "@/components/audit/DsnImport";
import { useData } from "@/context/DataContext";
import { useBrand } from "@/context/BrandContext";
import { SECTORS } from "@/core/sectors";
import { cn } from "@/lib/utils";

const AUDIT_NAV = [
  { to: "/audit", label: "Synthèse", icon: LayoutDashboard, end: true },
  { to: "/audit/conformite", label: "Conformité", icon: Scale },
  { to: "/audit/remuneration", label: "Rémunération", icon: Coins },
  { to: "/audit/sante", label: "Santé & absentéisme", icon: HeartPulse },
  { to: "/audit/mouvements", label: "Mouvements", icon: ArrowRightLeft },
  { to: "/audit/effectifs", label: "Effectifs", icon: Users },
];

const SECONDARY_NAV = [
  { to: "/constats", label: "Constats", icon: Bell },
  { to: "/plan-action", label: "Plan d'action", icon: ListChecks },
  { to: "/data-quality", label: "Qualité des données", icon: Database },
  { to: "/analyses", label: "Analyses détaillées", icon: BarChart3 },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export function AppShell({ children }) {
  const { employees, audit, fileName, sectorId, setSectorId, reset, dsnMeta } = useData();
  const brand = useBrand();
  const navigate = useNavigate();

  const handleReset = () => {
    if (!confirm("Réinitialiser ? Les données chargées seront effacées.")) return;
    reset();
    navigate("/");
  };

  const appName = brand?.name || "RH Cockpit";
  const logo = brand?.logo || "RH";

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-secondary/30 md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
            {logo}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appName}</p>
            <p className="text-[11px] text-muted-foreground">Cockpit d'audit</p>
          </div>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Audit</p>
          {AUDIT_NAV.map((it) => <NavItem key={it.to} {...it} />)}
          <p className="px-2 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Investigation</p>
          {SECONDARY_NAV.map((it) => <NavItem key={it.to} {...it} />)}
        </nav>
        <Separator />
        <div className="px-3 py-3">
          {!brand && (
            <NavLink to="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Settings className="h-3.5 w-3.5" />
              Administration
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-3 border-b bg-background px-6 py-3">
          <div className="min-w-0 flex-1">
            {employees ? (
              <div className="flex flex-col gap-0">
                <p className="truncate text-sm font-semibold">{fileName || "Données chargées"}</p>
                <p className="text-xs text-muted-foreground">
                  {audit?.meta?.effectif ?? employees.filter((e) => e.actif).length} salariés actifs
                  {audit && ` · audit du ${new Date(audit.meta.auditDate).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Aucune donnée chargée</p>
            )}
          </div>

          {employees && (
            <>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger className="h-9 w-48 text-xs" title="Benchmark sectoriel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <EmployeeSearch employees={employees} onSelect={(e) => navigate(`/data-quality?employee=${e.id}`)} />
              {dsnMeta ? (
                <Link to="/audit/sante" className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success-soft/50 px-2.5 py-1.5 text-xs font-medium text-success" title="DSN importée">
                  <HeartPulse className="h-3.5 w-3.5" />DSN {dsnMeta.mois}
                </Link>
              ) : (
                <DsnImport compact />
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/rapport"><FileText className="mr-1 h-4 w-4" />Rapport</Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset} title="Réinitialiser">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background px-6 py-6">
          <div className="mx-auto max-w-6xl">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
