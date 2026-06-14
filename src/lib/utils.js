import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const fmtEuro = (n) =>
  typeof n === "number" ? n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—";

export const fmtPct = (n, digits = 0) => (typeof n === "number" ? `${n.toFixed(digits)}%` : "—");

export const fmtDateFr = (d) => {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("fr-FR");
};

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Date DSN « JJMMAAAA » (mois principal déclaré) → « janvier 2026 »
export const fmtDsnMois = (s) => {
  const d = String(s || "").trim();
  if (!/^\d{8}$/.test(d)) return "—";
  return `${MOIS_FR[+d.slice(2, 4) - 1] || "?"} ${d.slice(4, 8)}`;
};
