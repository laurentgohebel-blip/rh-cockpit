import { createContext, useContext, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const BrandContext = createContext(null);

function decode(encoded) {
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return {
      name: json.n || "",
      logo: json.l || "",
      accent: json.a || null,
      modules: json.m || [],
    };
  } catch {
    return null;
  }
}

export function BrandProvider({ children }) {
  const [params] = useSearchParams();
  const brand = useMemo(() => {
    const raw = params.get("brand");
    return raw ? decode(raw) : null;
  }, [params]);

  // Applique la couleur accent via variable CSS — Tailwind la consomme via `text-accent`/`bg-accent`
  useEffect(() => {
    const root = document.documentElement;
    if (brand?.accent) {
      root.style.setProperty("--color-accent", brand.accent);
      root.style.setProperty("--color-brand", brand.accent);
    } else {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-brand");
    }
  }, [brand]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);

export function encodeBrand(config) {
  const compact = { n: config.name, l: config.logo, a: config.accent, m: config.modules || [] };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
}
