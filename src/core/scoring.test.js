import { computeMetrics } from "./metrics";
import { computeAudit, topConstats, domainHeadline } from "./scoring";
import { detectAnomalies } from "./dataQuality";
import { NOW } from "./parser";

// Construit une date relative à NOW (années / mois / jours en arrière)
const yearsAgo = (y, m = 0, d = 0) => new Date(NOW.getFullYear() - y, NOW.getMonth() - m, NOW.getDate() - d);

// Fabrique un employé au format attendu par computeMetrics / computeAudit
function emp(o) {
  const dn = o.age != null ? yearsAgo(o.age) : null;
  const de = o.anc != null ? yearsAgo(Math.floor(o.anc), Math.round((o.anc % 1) * 12)) : null;
  return {
    id: o.id,
    nom: o.nom || "NOM" + o.id,
    prenom: o.prenom || "P" + o.id,
    sexe: o.sexe || "Homme",
    dateNaiss: dn,
    age: o.age ?? null,
    dateEntree: de,
    anciennete: o.anc ?? null,
    dateSortie: o.dateSortie || null,
    etab: o.etab || "01",
    service: "",
    cdd: !!o.cdd,
    handicap: !!o.handicap,
    tempsComplet: !o.tp,
    salaire: o.salaire ?? null,
    heures: o.heures ?? 151,
    ville: o.ville || "PAU",
    cp: "64000",
    motifCode: o.motifCode ?? null,
    motifLabel: o.motifLabel || "Non renseigné",
    visiteDate: o.visiteDate || null,
    actif: !o.dateSortie,
    email: "",
    tel: "",
    voie: "",
    pctActivite: o.pctActivite ?? null,
    emploi: o.emploi || "",
    nationalite: o.nationalite || "",
    etranger: o.etranger ?? null,
    cartesSejourNumero: o.cartesSejourNumero || "",
    cartesSejourFin: o.cartesSejourFin || null,
    cartesTravailNumero: o.cartesTravailNumero || "",
    cartesTravailFin: o.cartesTravailFin || null,
    dsn: o.dsn,
  };
}

function buildEmployees() {
  const list = [];
  let id = 1;

  // 28 actifs de base
  for (let i = 0; i < 28; i++) {
    list.push(
      emp({
        id: id++,
        sexe: i % 2 ? "Femme" : "Homme",
        age: 30 + (i % 30), // 30..57
        anc: 1 + (i % 10),
        etab: i % 3 === 0 ? "02" : "01", // 2 établissements
        salaire: i < 14 ? 1800 + i * 30 : null, // ~50% renseignés → gate rémunération
        // visiteDate = date de la dernière visite. Périodicité 5 ans.
        // i<14 → visite il y a 2 ans (à jour, 14) ; i<21 → il y a 6 ans (expirée, 7) ; reste = null (7)
        // → 21/37 actifs renseignés (>50%, passe le gating qualité)
        visiteDate: i < 14 ? yearsAgo(2) : i < 21 ? yearsAgo(6) : null,
        cdd: i === 5 || i === 6, // 2 CDD…
      })
    );
  }
  // …dont les 2 CDD ont > 18 mois d'ancienneté (i=5 → anc 6, i=6 → anc 7) : déjà le cas

  // Anomalies injectées
  list.push(emp({ id: id++, age: 40, anc: 3, salaire: 0 })); // salaire incohérent
  list.push(emp({ id: id++, age: 35, anc: 1, pctActivite: 120 })); // activité > 100%
  list.push(emp({ id: id++, nom: "DUPONT", prenom: "Jean", age: 50, anc: 5 })); // doublon 1/2
  list.push(emp({ id: id++, nom: "DUPONT", prenom: "Jean", age: 50, anc: 5 })); // doublon 2/2
  // date de sortie antérieure à l'entrée (donc inactif, hors fenêtre mouvements)
  list.push(emp({ id: id++, age: 45, anc: 2, dateSortie: yearsAgo(3) }));

  // Sorties récentes (alimentent turnover & motifs)
  // Avant-dernière année close (cible du critère turnover) : 2 sorties dont 1 Fin de CDD
  list.push(emp({ id: id++, age: 38, anc: 2, dateSortie: yearsAgo(0, 6), motifLabel: "Démission" })); // Déc 2025
  list.push(emp({ id: id++, age: 29, anc: 1, dateSortie: yearsAgo(0, 7), motifLabel: "Fin de CDD" })); // Nov 2025 (à exclure)
  // Année courante (incomplète) : 2 sorties
  list.push(emp({ id: id++, age: 41, anc: 4, dateSortie: yearsAgo(0, 5), motifLabel: "Démission" }));
  list.push(emp({ id: id++, age: 52, anc: 8, dateSortie: yearsAgo(0, 3), motifLabel: "Licenciement éco." }));

  // Salariés étrangers — couvre tous les cas du critère titre-sejour
  // 1 marocain avec carte de séjour valide 2 ans → conforme
  list.push(emp({ id: id++, nom: "BENALI", prenom: "Karim", age: 38, anc: 4,
    etranger: true, nationalite: "Marocaine",
    cartesSejourNumero: "AA1234567",
    cartesSejourFin: new Date(NOW.getFullYear() + 2, NOW.getMonth(), 15) }));
  // 1 tunisien sans aucun titre (ni séjour ni travail) → non-conforme + risque
  list.push(emp({ id: id++, nom: "MAATAR", prenom: "Sami", age: 32, anc: 2,
    etranger: true, nationalite: "Tunisienne" }));
  // 1 algérien carte de séjour expirée il y a 3 mois → non-conforme + risque
  list.push(emp({ id: id++, nom: "BOUMEDIENE", prenom: "Yacine", age: 45, anc: 6,
    nationalite: "Algérienne",
    cartesSejourNumero: "BB7654321",
    cartesSejourFin: yearsAgo(0, 3) }));
  // 1 sénégalais carte de séjour expirant dans 60j → vigilance
  list.push(emp({ id: id++, nom: "DIALLO", prenom: "Moussa", age: 36, anc: 3,
    etranger: true, nationalite: "Sénégalaise",
    cartesSejourNumero: "CC1122334",
    cartesSejourFin: new Date(NOW.getTime() + 60 * 864e5) }));
  // 1 italien : UE, étranger=false correctement saisi → ignoré
  list.push(emp({ id: id++, nom: "ROSSI", prenom: "Marco", age: 40, anc: 5,
    etranger: false, nationalite: "Italienne" }));

  return list;
}

describe("computeAudit — moteur d'audit RH", () => {
  const employees = buildEmployees();
  const metrics = computeMetrics(employees);
  const audit = computeAudit(metrics, { sourceFile: "test.xlsx", profileId: "quadratus" });
  const critById = (id) => audit.domains.flatMap((d) => d.criteria).find((c) => c.id === id);

  test("retourne un index global borné et 5 domaines", () => {
    expect(audit.domains).toHaveLength(5);
    expect(audit.globalScore).toBeGreaterThanOrEqual(0);
    expect(audit.globalScore).toBeLessThanOrEqual(100);
    expect(audit.domains.map((d) => d.key).sort()).toEqual(["conformite", "effectifs", "mouvements", "remuneration", "sante"]);
  });

  test("domaine santé : non concluant sans DSN, exclu du score global", () => {
    // La fixture principale n'a pas de données DSN → tous les critères santé non concluants
    const sante = audit.domains.find((d) => d.key === "sante");
    expect(sante.score).toBeNull();
    expect(sante.criteria.every((c) => c.status === "non-concluant")).toBe(true);
    // Le score global reste calculé sur les autres domaines
    expect(audit.globalScore).toBeGreaterThan(0);
  });

  test("domaine santé : alimenté quand les salariés portent des données DSN", () => {
    const fixture = [
      emp({ id: 950, age: 40, anc: 5, dsn: { arrets: [{ motif: "01", motifLabel: "Maladie", jours: 14 }] } }),
      emp({ id: 951, age: 35, anc: 3, dsn: { arrets: [] } }),
      emp({ id: 952, age: 45, anc: 8, dsn: { arrets: [{ motif: "05", motifLabel: "Accident du travail", jours: 20 }] } }),
    ];
    const a = computeAudit(computeMetrics(fixture));
    const sante = a.domains.find((d) => d.key === "sante");
    expect(sante.score).not.toBeNull();
    const at = sante.criteria.find((c) => c.id === "accidents-travail");
    expect(at.status).toBe("vigilance"); // 1 AT
    expect(at.value).toBe(1);
  });

  test("OETH non conforme + risque AGEFIPH chiffré (idée ①)", () => {
    expect(critById("oeth").status).toBe("non-conforme");
    const agefiph = audit.risks.find((r) => r.critId === "oeth");
    expect(agefiph).toBeDefined();
    // 36 actifs, 0 RQTH → ceil(0,06×36)=3 manquants × 400 × 11,88 = 14256 €/an
    expect(agefiph.amount).toBe(14256);
    expect(audit.totalQuantifiedRisk).toBeGreaterThanOrEqual(14256);
  });

  test("gating qualité : un critère sans données fiables est non concluant et exclu du score", () => {
    // ecart-hf-emploi → non-concluant car la fixture n'a pas d'emploi renseigné
    const ecart = critById("ecart-hf-emploi");
    expect(ecart.status).toBe("non-concluant");
    expect(ecart.score).toBeNull();
    // la rémunération reste notée grâce à remu-completude (qui n'est pas gaté)
    const remu = audit.domains.find((d) => d.key === "remuneration");
    expect(remu.evaluableCount).toBeGreaterThanOrEqual(1);
  });

  test("la fiabilité chute quand des champs sont incomplets", () => {
    expect(audit.reliability).toBeLessThan(100);
    expect(audit.reliability).toBeGreaterThan(0);
  });

  test("détection d'anomalies (idée ③)", () => {
    const types = new Set(audit.anomalies.map((a) => a.type));
    expect(types.has("salaire")).toBe(true);
    expect(types.has("activite")).toBe(true);
    expect(types.has("dates")).toBe(true);
    expect(types.has("doublon")).toBe(true);
  });

  test("traçabilité d'audit (idée ⑤)", () => {
    expect(audit.meta.sourceFile).toBe("test.xlsx");
    expect(audit.meta.profileId).toBe("quadratus");
    expect(audit.meta.effectif).toBe(metrics.totalActifs);
    expect(typeof audit.meta.auditDate).toBe("string");
  });

  test("top-remunerations — barème Index Égalité (top 5 si effectif < 250)", () => {
    // Fixture mini : 6 actifs (effectif < 250 → top 5) avec salaires variables et 3F/3H
    const fixture = [
      emp({ id: 700, nom: "A", sexe: "Homme", age: 35, anc: 5, salaire: 5000 }),
      emp({ id: 701, nom: "B", sexe: "Homme", age: 35, anc: 5, salaire: 4500 }),
      emp({ id: 702, nom: "C", sexe: "Femme", age: 35, anc: 5, salaire: 4200 }),
      emp({ id: 703, nom: "D", sexe: "Femme", age: 35, anc: 5, salaire: 4000 }),
      emp({ id: 704, nom: "E", sexe: "Homme", age: 35, anc: 5, salaire: 3800 }),
      emp({ id: 705, nom: "F", sexe: "Femme", age: 35, anc: 5, salaire: 3500 }),
    ];
    const m = computeMetrics(fixture);
    const a = computeAudit(m);
    const c = a.domains.flatMap((d) => d.criteria).find((x) => x.id === "top-remunerations");
    // Top 5 : 5000H, 4500H, 4200F, 4000F, 3800H → 2 femmes → ≥ seuil conforme (2) → conforme
    expect(c.value).toBe(2);
    expect(c.status).toBe("conforme");
    expect(c.evidence.length).toBe(5);
  });

  test("ecart-hf-emploi — non-concluant si emploi absent partout", () => {
    // La fixture principale n'a pas d'emploi → gating à 50% non franchi
    const c = critById("ecart-hf-emploi");
    expect(c.status).toBe("non-concluant");
  });

  test("ecart-hf-emploi — Index Égalité n°1 : écart brut 10% corrigé à 5% après tolérance", () => {
    // Mini-fixture : 1 emploi "Vendeur", tranche d'âge 30-39, 5H et 5F avec écart brut 10%
    const fixture = [];
    for (let i = 0; i < 5; i++) fixture.push(emp({ id: 600 + i, age: 35, anc: 3, emploi: "Vendeur", sexe: "Homme", salaire: 2000 }));
    for (let i = 0; i < 5; i++) fixture.push(emp({ id: 650 + i, age: 35, anc: 3, emploi: "Vendeur", sexe: "Femme", salaire: 1800 }));
    const m = computeMetrics(fixture);
    const a = computeAudit(m);
    const c = a.domains.flatMap((d) => d.criteria).find((x) => x.id === "ecart-hf-emploi");
    // Écart brut 10% - tolérance officielle 5% = 5% écart corrigé → seuil exactement → conforme
    expect(c.status).toBe("conforme");
    expect(Math.round(c.value)).toBe(5);
    // Le valueLabel mentionne le barème officiel (40 pts max)
    expect(c.valueLabel).toMatch(/pts Index/);
  });

  test("ecart-hf-emploi — non concluant si < 3 H ou < 3 F dans tous les groupes", () => {
    // Mini-fixture : 2 H + 2 F dans un emploi/tranche → en dessous du seuil officiel 3+3
    const fixture = [
      emp({ id: 660, age: 35, anc: 3, emploi: "Vendeur", sexe: "Homme", salaire: 2000 }),
      emp({ id: 661, age: 35, anc: 3, emploi: "Vendeur", sexe: "Homme", salaire: 2100 }),
      emp({ id: 662, age: 35, anc: 3, emploi: "Vendeur", sexe: "Femme", salaire: 1900 }),
      emp({ id: 663, age: 35, anc: 3, emploi: "Vendeur", sexe: "Femme", salaire: 1800 }),
    ];
    const m = computeMetrics(fixture);
    const a = computeAudit(m);
    const c = a.domains.flatMap((d) => d.criteria).find((x) => x.id === "ecart-hf-emploi");
    expect(c.status).toBe("non-concluant");
  });

  test("turnover — exclut les fins normales de CDD du numérateur", () => {
    const c = critById("turnover");
    expect(c).toBeDefined();
    // Fixture : avant-dernière année close a 2 sorties (1 Démission + 1 Fin de CDD)
    // → la Fin de CDD est exclue → 1 sortie subie retenue
    expect(c.valueLabel).toMatch(/hors fins de CDD/);
    expect(c.evidence.length).toBe(1);
    expect(c.evidence[0].motifLabel).toBe("Démission");
  });

  test("motifs-sortie — statut déclaratif (non noté) et seulement démissions strictes", () => {
    const c = critById("motifs-sortie");
    expect(c).toBeDefined();
    expect(c.status).toBe("declaratif");
    expect(c.score).toBeNull();
    expect(c.valueLabel).toMatch(/Top motifs/);
  });

  test("turnover-sites — supprimé du référentiel", () => {
    const c = critById("turnover-sites");
    expect(c).toBeUndefined();
  });

  test("cdd-cadre — détecte CDD > 18 mois, pas de chiffrage de risque", () => {
    const c = critById("cdd-cadre");
    expect(c).toBeDefined();
    // Fixture : i=5 (anc=6 ans) et i=6 (anc=7 ans) sont CDD > 18 mois → 2 longs
    expect(c.value).toBe(2);
    expect(c.status).toBe("vigilance"); // ≤2 longs → vigilance
    expect(c.evidence.length).toBe(2);

    // Pas d'entrée chiffrée dans l'exposition financière pour ce critère
    const risqueCdd = audit.risks.find((r) => r.critId === "cdd-cadre");
    expect(risqueCdd).toBeUndefined();
  });

  test("suivi-medical — périodicité 5 ans (expirée si > 5 ans, vigilance si <90j avant)", () => {
    const c = critById("suivi-medical");
    expect(c).toBeDefined();

    // Fixture : 10 salariés visite il y a 2 ans (à jour), 7 il y a 6 ans (expirées), reste null
    expect(c.status).toBe("non-conforme");
    expect(c.value).toBe(7); // 7 expirées

    // Evidence : les 7 expirés
    expect(c.evidence.length).toBeGreaterThanOrEqual(7);
  });

  test("suivi-medical — vigilance si seulement des expirations à venir <90j", () => {
    // Fixture isolée : 5 actifs, tous visite il y a ~5 ans (à 30 jours de l'expiration)
    const j = 365.25 * 4.92; // 4,92 ans ≈ 30 jours avant l'expiration (5 ans)
    const dateProche = new Date(NOW.getTime() - j * 864e5);
    const fixture = [];
    for (let i = 0; i < 5; i++) {
      fixture.push(emp({ id: 800 + i, age: 35, anc: 4, visiteDate: dateProche }));
    }
    const m = computeMetrics(fixture);
    const a = computeAudit(m);
    const c = a.domains.flatMap((d) => d.criteria).find((x) => x.id === "suivi-medical");
    expect(c.status).toBe("vigilance");
    expect(c.evidence.length).toBe(5);
  });

  test("titre-sejour — détection croisée + état des titres (séjour/travail)", () => {
    const c = critById("titre-sejour");
    expect(c).toBeDefined();

    // 2 à risque (Maatar sans titre + Boumediene expiré) → non-conforme
    expect(c.status).toBe("non-conforme");
    expect(c.value).toBe(2);

    // Preuve : les 3 problématiques (sans titre, expiré, expirant) — pas Benali (valide) ni Rossi (UE)
    const noms = c.evidence.map((e) => e.nom);
    expect(noms).toContain("MAATAR");      // aucun titre
    expect(noms).toContain("BOUMEDIENE");  // expiré
    expect(noms).toContain("DIALLO");      // expirantBientôt
    expect(noms).not.toContain("BENALI");  // titre valide
    expect(noms).not.toContain("ROSSI");   // UE, non concerné

    // Risque chiffré : 2 × 5 × SMIC_MENSUEL ≈ 18018 €
    const risque = audit.risks.find((r) => r.critId === "titre-sejour");
    expect(risque).toBeDefined();
    expect(risque.amount).toBeGreaterThan(17000);
    expect(risque.amount).toBeLessThan(19000);
  });

  test("titre-sejour — non concluant quand aucune donnée étranger", () => {
    // Mini-fixture : 3 actifs sans aucune des 4 colonnes renseignées
    const fixture = [
      emp({ id: 901, nom: "DUR", prenom: "A", age: 30, anc: 1 }),
      emp({ id: 902, nom: "DUR", prenom: "B", age: 35, anc: 2 }),
      emp({ id: 903, nom: "DUR", prenom: "C", age: 40, anc: 3 }),
    ];
    const m = computeMetrics(fixture);
    const a = computeAudit(m);
    const c = a.domains.flatMap((d) => d.criteria).find((x) => x.id === "titre-sejour");
    expect(c.status).toBe("non-concluant");
  });

  test("benchmark sectoriel — seuils ajustés et médianes attachées (phase ④b)", () => {
    const auditProprete = computeAudit(metrics, { sectorId: "proprete" });
    const critTP_default = audit.domains.find((d) => d.key === "effectifs").criteria.find((c) => c.id === "temps-partiel");
    const critTP_proprete = auditProprete.domains.find((d) => d.key === "effectifs").criteria.find((c) => c.id === "temps-partiel");
    // Seuil par défaut = 40%, seuil propreté = 65% → un taux de 48% redevient conforme en propreté
    if (critTP_default.value > 40 && critTP_default.value <= 65) {
      expect(critTP_default.status).toBe("vigilance");
      expect(critTP_proprete.status).toBe("conforme");
    }
    // Le benchmark sectoriel est présent
    expect(critTP_proprete.benchmark).toBeDefined();
    expect(critTP_proprete.benchmark.label).toMatch(/propreté/);
    // Le meta du secteur est porté
    expect(auditProprete.meta.sectorId).toBe("proprete");
    expect(auditProprete.meta.sectorName).toMatch(/propreté/i);
  });

  test("topConstats — priorise les non-conformes et porte la preuve (phase ②)", () => {
    const top = topConstats(audit, 3);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top[0].status).toBe("non-conforme");
    expect(top[0].domainKey).toBeDefined();
  });

  test("domainHeadline — compte les constats du domaine (phase ②)", () => {
    const conf = audit.domains.find((d) => d.key === "conformite");
    const h = domainHeadline(conf);
    expect(typeof h.valueLabel).toBe("string");
    expect(h.nNonConforme).toBeGreaterThanOrEqual(1); // oeth non-conforme
  });

  test("detectAnomalies isolé remonte exactement les cas injectés", () => {
    const anomalies = detectAnomalies(employees);
    expect(anomalies.filter((a) => a.type === "salaire")).toHaveLength(1);
    expect(anomalies.filter((a) => a.type === "activite")).toHaveLength(1);
    expect(anomalies.filter((a) => a.type === "doublon")).toHaveLength(1);
    expect(anomalies.filter((a) => a.type === "dates")).toHaveLength(1);
  });
});
