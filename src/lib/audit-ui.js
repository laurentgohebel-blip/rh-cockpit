// Mapping pur : tone du moteur (success/warning/destructive/muted/info)
// → classes Tailwind et props d'UI. Aucun import React.

export const TONE_CLASSES = {
  success: {
    text: "text-success",
    bg: "bg-success-soft",
    border: "border-success/30",
    ring: "ring-success/40",
    accent: "bg-success",
    badge: "bg-success-soft text-success border-success/20",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning-soft",
    border: "border-warning/30",
    ring: "ring-warning/40",
    accent: "bg-warning",
    badge: "bg-warning-soft text-warning border-warning/20",
  },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive-soft",
    border: "border-destructive/30",
    ring: "ring-destructive/40",
    accent: "bg-destructive",
    badge: "bg-destructive-soft text-destructive border-destructive/20",
  },
  info: {
    text: "text-info",
    bg: "bg-info-soft",
    border: "border-info/30",
    ring: "ring-info/40",
    accent: "bg-info",
    badge: "bg-info-soft text-info border-info/20",
  },
  muted: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    ring: "ring-border",
    accent: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export function toneFor(status, statusMeta) {
  return statusMeta[status]?.tone || "muted";
}

export function classesFor(status, statusMeta) {
  return TONE_CLASSES[toneFor(status, statusMeta)] || TONE_CLASSES.muted;
}

// Couleur HEX pour SVG (ring de score) — tirée des HSL définies en CSS
export const TONE_HEX = {
  success: "#0a8a5b",
  warning: "#d97706",
  destructive: "#dc2626",
  info: "#3b82f6",
  muted: "#94a3b8",
};
