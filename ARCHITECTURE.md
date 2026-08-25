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
| `dsnParser.js` | Parse la DSN normée, `dsnToEmployees()` (DSN comme source autonome), `enrichWithDsn()`, `checkDsnCoherence()` |
| `metrics.js` | Agrégats consommés par le moteur + la page Analyses (pyramide, ancienneté, turnover…) |
| `referentiel/` | **Le cœur** : domaines pondérés + ~17 critères. Voir ci-dessous. |
| `scoring.js` | `computeAudit(metrics, meta)` → score global/domaines, fiabilité, risques, anomalies |
| `sources.js` | Choisit l'effectif à auditer selon les sources, applique la préséance, calcule la couverture |
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

## Deux rails d'ingestion, trois modes d'audit

Chaque source peut mener un audit **à elle seule** (`core/sources.js`) :

| Mode | Source | Effectif construit par |
|---|---|---|
| `paie` | fichier .xlsx seul | `parseWithMapping()` |
| `dsn` | fichier .dsn seul | `dsnToEmployees()` |
| `mixte` | les deux | la paie, complétée par la DSN |

- **Rail 1 — fichier de paie (.xlsx)** : instantané, porte le salaire de BASE et les
  données que la DSN ignore (suivi médical, RQTH, titres de séjour).
- **Rail 2 — DSN (.dsn)** : mensuelle, porte identité, contrats, quotités, arrêts,
  AT/MP, PCS-ESE et le BRUT VERSÉ. Croisement par `nirKey` (13 chiffres).
  ⚠️ Fréquences différentes → `checkDsnCoherence()` alerte si périodes/périmètres divergent.

### Règle de préséance (mode mixte)

**La paie mène, la DSN comble.** Ce n'est pas une commodité :

- le fichier de paie porte le salaire de **base** contractuel, la DSN le **brut versé**
  du mois (primes et heures supplémentaires comprises). L'écart de rémunération de
  l'Index Égalité — 40 points — se calcule sur la base : écraser l'un par l'autre
  fausserait l'indicateur ;
- la paie porte des champs absents de la DSN mensuelle.

La DSN remplit tout champ que la paie a laissé vide (`CHAMPS_COMBLABLES`), et ses
données propres restent attachées sous `e.dsn`. Chaque champ porte sa provenance dans
`e._src` : `paie`, `dsn` ou `absent`.

### Couverture — ce qui n'a PAS été audité

`couvertureAudit()` rejoue le gating de `computeAudit()` (mêmes `requiredFields`, même
seuil) et liste les critères inévaluables **avec leur cause**. Affiché en tête de la
Synthèse (`CouvertureBanner`) et en première page du Rapport.

> Un lecteur qui ne voit aucun constat sur le suivi médical doit comprendre que la
> question n'a pas été examinée — jamais qu'elle est conforme. L'absence de reproche
> n'est pas un quitus, et c'est à l'outil de le dire.

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
