import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { computeMetrics } from "@/core/metrics";
import { computeAudit } from "@/core/scoring";
import { parseDsn, checkDsnCoherence } from "@/core/dsnParser";
import { construireEffectif, couvertureAudit } from "@/core/sources";
import { fmtDsnMois } from "@/lib/utils";
import {
  loadEmployees,
  saveEmployees,
  clearEmployees,
  loadMapping,
  saveMapping,
  saveDsn,
  loadDsn,
  clearDsn,
} from "@/core/storage";

const DataContext = createContext(null);

const SECTOR_KEY = "rh-cockpit-sector";

export function DataProvider({ children }) {
  const [rawEmployees, setRawEmployees] = useState(null);
  const [fileName, setFileName] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [dsn, setDsn] = useState(null); // objet parsé
  const [dsnFileName, setDsnFileName] = useState("");
  const [sectorId, setSectorIdState] = useState(() => localStorage.getItem(SECTOR_KEY) || "default");
  const [loading, setLoading] = useState(true);

  const setSectorId = useCallback((id) => {
    setSectorIdState(id);
    if (id && id !== "default") localStorage.setItem(SECTOR_KEY, id);
    else localStorage.removeItem(SECTOR_KEY);
  }, []);

  // Boot — recharge IndexedDB (employés, mapping, DSN re-parsée)
  useEffect(() => {
    let alive = true;
    Promise.all([loadEmployees(), loadMapping(), loadDsn()])
      .then(([saved, mapping, savedDsn]) => {
        if (!alive) return;
        if (saved) {
          setRawEmployees(saved.employees);
          setFileName(saved.fileName);
        }
        if (mapping) setProfileId(mapping.profileId);
        if (savedDsn) {
          try {
            setDsn(parseDsn(savedDsn.text));
            setDsnFileName(savedDsn.fileName);
          } catch { /* ignore DSN corrompue */ }
        }
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  // Construction de l'effectif à auditer : paie seule, DSN seule, ou les
  // deux (la paie mène, la DSN comble — voir la règle de préséance dans
  // core/sources.js). C'est ici que la DSN cesse d'être un simple
  // enrichissement pour devenir une source de plein droit.
  const { employees, mode, dsnMeta } = useMemo(() => {
    const r = construireEffectif({ paie: rawEmployees, dsn });
    if (!r.employees) return { employees: null, mode: null, dsnMeta: null };
    return {
      employees: r.employees,
      mode: r.mode,
      dsnMeta: dsn
        ? {
            fileName: dsnFileName,
            mois: fmtDsnMois(dsn.meta.moisPrincipal),
            idcc: dsn.meta.idcc,
            raisonSociale: dsn.meta.raisonSociale,
            nbIndividus: dsn.individus.length,
            matched: r.rapproches,
            coverage: rawEmployees?.length ? r.rapproches / rawEmployees.length : 0,
            comblements: r.comblements,
          }
        : null,
    };
  }, [rawEmployees, dsn, dsnFileName]);

  // Ce que la source permet — et ne permet pas — d'auditer.
  const couverture = useMemo(() => couvertureAudit(employees, mode), [employees, mode]);

  // Cohérence des sources (DSN mensuelle vs instantané paie)
  const dsnCoherence = useMemo(
    () => (rawEmployees && dsn ? checkDsnCoherence(rawEmployees, dsn) : null),
    [rawEmployees, dsn]
  );

  const metrics = useMemo(() => (employees ? computeMetrics(employees) : null), [employees]);
  const audit = useMemo(
    () => (metrics ? computeAudit(metrics, { sourceFile: fileName, profileId, sectorId, dsnMeta }) : null),
    [metrics, fileName, profileId, sectorId, dsnMeta]
  );

  const ingest = useCallback((employees, name, mapping, profileId) => {
    setRawEmployees(employees);
    setFileName(name);
    setProfileId(profileId || null);
    saveEmployees(employees, name);
    if (mapping) saveMapping(mapping, profileId);
  }, []);

  // Ingestion d'une DSN (texte brut) — parse + persiste
  const ingestDsn = useCallback((text, name) => {
    const parsed = parseDsn(text);
    setDsn(parsed);
    setDsnFileName(name);
    saveDsn(text, name);
    return parsed;
  }, []);

  const removeDsn = useCallback(() => {
    setDsn(null);
    setDsnFileName("");
    clearDsn();
  }, []);

  const reset = useCallback(() => {
    setRawEmployees(null);
    setFileName("");
    setProfileId(null);
    setDsn(null);
    setDsnFileName("");
    clearEmployees();
    clearDsn();
  }, []);

  const value = {
    loading, employees, fileName, profileId, sectorId, setSectorId,
    metrics, audit, ingest, reset,
    dsn, dsnMeta, dsnCoherence, ingestDsn, removeDsn,
    mode, couverture,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
};
