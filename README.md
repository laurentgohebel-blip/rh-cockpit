# RH Cockpit v3.0

**Cockpit d'audit social 360°** — diagnostic RH structuré, noté et défendable à partir d'un export paie.

Traitement **100 % local** dans le navigateur (IndexedDB). Aucune donnée nominative ne transite par un serveur. Pensé pour les cabinets d'audit / conseil RH.

---

## Stack

- **Vite 5** + React 18 + React Router 6
- **Tailwind v4** + **shadcn/ui** + Lucide icons
- **Recharts** pour les graphiques
- **idb-keyval** pour la persistance locale
- **Vitest** pour les tests

## Démarrage

```bash
npm install
npm run dev       # → http://localhost:3000
npm run test      # tests unitaires (Vitest)
npm run build     # production (Vite → dist/)
```

## Logiciels paie supportés (détection automatique)

Quadratus · Sage Paie · Cegid HR · Silaé · PayFit · ADP · Lucca/Pagga.
Mapping manuel possible via l'écran « Configuration des colonnes ».

## Architecture

```
src/
├── core/                ← moteur métier (parser, scoring, référentiel)
│   ├── parser.js        — lecture xlsx, normalisation
│   ├── profiles.js      — 7 profils logiciels paie
│   ├── metrics.js       — agrégats (effectif, pyramide, turnover…)
│   ├── referentiel.js   — domaines pondérés + ~15 critères auto-portants
│   ├── scoring.js       — computeAudit() → score global + risques + anomalies
│   ├── dataQuality.js   — complétude + détection d'anomalies
│   ├── sectors.js       — benchmark sectoriel
│   ├── actions.js       — plan d'action recommandé par critère
│   ├── alerts.js        — alertes opérationnelles (visites, périodes d'essai…)
│   └── tasks.js         — persistance des tâches du Cockpit
├── components/
│   ├── ui/              — primitives shadcn
│   ├── audit/           — composants métier (ScoreRing, EvidenceSheet, …)
│   └── layout/          — AppShell
├── pages/               — écrans routés (/audit, /audit/:domain, /constats, …)
├── context/             — DataContext + BrandContext (marque blanche)
└── styles/              — globals.css (Tailwind + print stylesheet)
```

## Domaines audités

| Domaine | Poids | Critères |
|---|---|---|
| Conformité & obligations légales | 35 % | OETH, suivi médical, CDD ≤ 18 mois, titres de séjour |
| Rémunération & masse salariale | 25 % | Complétude, parité top 10 ETP (Index Égalité), écart F/H par emploi |
| Mouvements, fidélisation & climat | 20 % | Turnover, motifs de sortie, départs retraite, points chauds |
| Effectifs, diversité & égalité | 20 % | Structure contrats, temps partiel, vieillissement, mixité, ancienneté |

Chaque critère sort un statut **Conforme / Vigilance / Non-conforme**, ou **Non-concluant** si la donnée source est insuffisante (la fiabilité globale en tient compte).

## Marque blanche

URL `?brand=<base64>` → couleurs + logo client appliqués. Configuration via la page Admin (`/admin`) — stockée en `localStorage`, génère le lien à envoyer au client.

## Sécurité & RGPD

- Aucune donnée ne sort du navigateur (pas de backend, pas d'API tierce)
- IndexedDB pour la persistance entre sessions
- Reset → effacement complet (employés + mapping + profil)

## Déploiement

Application statique : déployable sur Azure Static Web Apps, Vercel, Netlify, GitHub Pages.
SPA fallback nécessaire (`/audit/conformite` → `index.html`).
