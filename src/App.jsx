import { Navigate, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "@/context/DataContext";
import { BrandProvider } from "@/context/BrandContext";
import { AppShell } from "@/components/layout/AppShell";
import UploadPage from "@/pages/UploadPage";
import MappingPage from "@/pages/MappingPage";
import SynthesePage from "@/pages/SynthesePage";
import DomainPage from "@/pages/DomainPage";
import ConstatsPage from "@/pages/ConstatsPage";
import PlanActionPage from "@/pages/PlanActionPage";
import DataQualityPage from "@/pages/DataQualityPage";
import AnalysesPage from "@/pages/AnalysesPage";
import AdminPage from "@/pages/AdminPage";
import RapportPage from "@/pages/RapportPage";

// Garde-fou : si pas de données chargées, retour à l'upload
function RequireData({ children }) {
  const { employees, loading } = useData();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  if (!employees) return <Navigate to="/" replace />;
  return children;
}

function HomeOrAudit() {
  const { employees, loading } = useData();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  return employees ? <Navigate to="/audit" replace /> : <UploadPage />;
}

export default function App() {
  return (
    <BrandProvider>
      <DataProvider>
        <Routes>
          <Route path="/" element={<AppShell><HomeOrAudit /></AppShell>} />
          <Route path="/mapping" element={<AppShell><MappingPage /></AppShell>} />
          <Route element={<AppShell />}>
            <Route path="/audit" element={<RequireData><SynthesePage /></RequireData>} />
            <Route path="/audit/:domain" element={<RequireData><DomainPage /></RequireData>} />
            <Route path="/constats" element={<RequireData><ConstatsPage /></RequireData>} />
            <Route path="/plan-action" element={<RequireData><PlanActionPage /></RequireData>} />
            <Route path="/data-quality" element={<RequireData><DataQualityPage /></RequireData>} />
            <Route path="/analyses" element={<RequireData><AnalysesPage /></RequireData>} />
            <Route path="/rapport" element={<RequireData><RapportPage /></RequireData>} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </BrandProvider>
  );
}
