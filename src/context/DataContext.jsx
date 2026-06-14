import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { computeMetrics } from "@/core/metrics";
import { computeAudit } from "@/core/scoring";
import {
  loadEmployees,
  saveEmployees,
  clearEmployees,
  loadMapping,
  saveMapping,
} from "@/core/storage";

const DataContext = createContext(null);

const SECTOR_KEY = "rh-cockpit-sector";

export function DataProvider({ children }) {
  const [employees, setEmployees] = useState(null);
  const [fileName, setFileName] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [sectorId, setSectorIdState] = useState(() => localStorage.getItem(SECTOR_KEY) || "default");
  const [loading, setLoading] = useState(true);

  const setSectorId = useCallback((id) => {
    setSectorIdState(id);
    if (id && id !== "default") localStorage.setItem(SECTOR_KEY, id);
    else localStorage.removeItem(SECTOR_KEY);
  }, []);

  // Boot — recharge IndexedDB
  useEffect(() => {
    let alive = true;
    Promise.all([loadEmployees(), loadMapping()])
      .then(([saved, mapping]) => {
        if (!alive) return;
        if (saved) {
          setEmployees(saved.employees);
          setFileName(saved.fileName);
        }
        if (mapping) setProfileId(mapping.profileId);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const metrics = useMemo(() => (employees ? computeMetrics(employees) : null), [employees]);
  const audit = useMemo(
    () => (metrics ? computeAudit(metrics, { sourceFile: fileName, profileId, sectorId }) : null),
    [metrics, fileName, profileId, sectorId]
  );

  const ingest = useCallback((employees, name, mapping, profileId) => {
    setEmployees(employees);
    setFileName(name);
    setProfileId(profileId || null);
    saveEmployees(employees, name);
    if (mapping) saveMapping(mapping, profileId);
  }, []);

  const reset = useCallback(() => {
    setEmployees(null);
    setFileName("");
    setProfileId(null);
    clearEmployees();
  }, []);

  const value = { loading, employees, fileName, profileId, sectorId, setSectorId, metrics, audit, ingest, reset };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
};
