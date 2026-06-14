# Architecture — RH Cockpit

Cockpit d'audit social. 100 % local (navigateur + IndexedDB), aucune donnée nominative
ne quitte le poste. Vite + React + Tailwind/shadcn.

## Les 5 couches (flux du haut vers le bas)

```
Entrées      Fichier de paie .xlsx (instantané)   |   DSN .dsn (mensuelle)
                              │
Ingestion    parser.js · profiles.js · dsnParser.js · storage.js
                              │  (croisement par NIR)
Moteur       metrics.js → referentiel/ · scoring.js · dataQuality.js
             d'audit       sectors.js · actions.js · alerts.js · tasks.js
                              │  (objet « audit »)
État         context/DataContext (orchestration) · BrandContext (marque blanche)
                              │
Interface    pages/* → components/{audit, ui, layout}
```

## Responsabilité de chaque module cœur (`src/core/`)

| Module | Rôle |
|---|---|
| `parser.js` | Lit le .xlsx, normalise les employés, helpers dates + `nirKey()` (clé de jointure DSN) |
| `profiles.js` | 7 profils logiciels paie + `FIELDS` (modèle universel) + auto-mapping des colonnes |
| `dsnParser.js` | Parse la DSN normée, `enrichWithDsn()` (croisement NIR), `checkDsnCoherence()` |
| `metrics.js` | Agrégats consommés par le moteur + la page Analyses (pyramide, ancienneté, turnover…) |
| `referentiel/` | **Le cœur** : domaines pondérés + ~17 critères. Voir ci-dessous. |
| `scoring.js` | `computeAudit(metrics, meta)` → score global/domaines, fiabilité, risques, anomalies |
| `dataQuality.js` | Complétude par champ + détection d'anomalies |
| `sectors.js` | Benchmark sectoriel (seuils ajustés + médianes par critère) |
| `actions.js` | Bibliothèque d'actions recommandées par critère → plan d'action |
| `alerts.js` | Alertes **opérationnelles** datées/par salarié (≠ constats d'audit, voir ci-dessous) |
| `storage.js` | Persistance IndexedDB (employés, mapping, DSN texte) |
| `demoData.js` | Jeu de démonstration déterministe (bouton « Charger une démo ») |

## Le référentiel (`src/core/referentiel/`)

Découpé par domaine pour rester lisible :

- `constants.js` — seuils légaux, `STATUS`, `STATUS_META`, `DOMAINS` (pondérés), helpers
  partagés (`salaireETP`, nationalités UE, tranches d'âge…). **Source unique des constantes.**
- `conformite.js` · `remuneration.js` · `sante.js` · `mouvements.js` · `effectifs.js` —
  chacun exporte `xCriteria` (le tableau des critères de son domaine).
- `index.js` — réassemble `CRITERIA` et re-exporte tout. Les imports `@/core/referentiel`
  résolvent ici.

### Anatomie d'un critère (objet auto-portant)

```js
{
  id: "oeth",
  domain: "conformite",
  label: "…",
  legalRef: "Art. … C. trav.",
  requiredFields: ["handicap"],        // gating qualité : si < 70% renseigné → non concluant
  reliableThreshold: 0.5,              // (optionnel) seuil de gating spécifique
  evaluate(ctx) {                       // ctx = { metrics, employees, actifs, completeness, seuils }
    return { status, value, valueLabel, threshold, evidence };  // evidence = salariés concernés
  },
  risk(ctx) { return { amount, unit, label, basis } | null; },  // (optionnel) chiffrage €
}
```

`status` ∈ `conforme` (100) · `vigilance` (50) · `non-conforme` (0) · `non-concluant`
(donnée insuffisante, exclu du score) · `non-applicable` · `declaratif` (à vérifier hors données).

### Recette : ajouter un critère

1. Ouvrir le fichier du domaine (`referentiel/<domaine>.js`).
2. Ajouter un objet critère dans le tableau `xCriteria` (copier l'anatomie ci-dessus).
3. Si besoin d'une nouvelle constante/helper → `constants.js` (et l'importer).
4. Si chiffrage → fonction `risk(ctx)`.
5. Action recommandée → ajouter une entrée `<id>` dans `actions.js` (sinon pas de plan d'action).
6. Test → étendre `scoring.test.js` (fixture + assertion).
7. Le critère apparaît **automatiquement** dans la Synthèse, la page Domaine et le Rapport.

## Deux rails d'ingestion

- **Rail 1 — fichier de paie (.xlsx)** : source principale, un instantané. Croisé par NIR.
- **Rail 2 — DSN (.dsn)** : mensuelle, enrichit le snapshot (absentéisme, AT/MP, PCS-ESE,
  masse salariale fine). Alimente le domaine **Santé**. Croisement par `nirKey` (13 chiffres).
  ⚠️ Fréquences différentes → `checkDsnCoherence()` alerte si périodes/périmètres divergent.

## Frontière alertes ↔ constats

- **Constats d'audit** = critères du référentiel (agrégés, notés, dans le score).
- **Alertes opérationnelles** (`alerts.js`) = échéances datées par salarié à traiter au
  quotidien (visite à renouveler, fin de période d'essai, médaille…). Pas de doublon avec
  les critères. Les deux s'affichent sur `/constats`.

## Vérification

```bash
npm run dev      # serveur local
npm run test     # Vitest (moteur)
npm run build    # production Vite
```

Le moteur est garanti par `scoring.test.js` + `dsnParser.test.js`. Tout refacto du moteur
doit garder ces tests verts.
