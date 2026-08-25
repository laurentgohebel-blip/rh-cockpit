import { parseDsn, dsnAggregates, parseDsnDate, dsnToEmployees, SOURCE } from "./dsnParser";

// Fixture DSN synthétique minimale (format normé NEODeS)
const DSN = [
  "S10.G00.00.001,'TestPaie'",
  "S21.G00.06.001,'123456789'",
  "S21.G00.06.003,'TEST SARL'",
  "S20.G00.05.005,'01012026'",
  "S21.G00.11.001,'00001'",
  // Individu 1 — homme, temps plein, 1 arrêt maladie, brut 2000
  "S21.G00.30.001,'1800175123456'",
  "S21.G00.30.002,'DUPONT'",
  "S21.G00.30.004,'JEAN'",
  "S21.G00.30.005,'01'",
  "S21.G00.30.006,'15031980'",
  "S21.G00.40.001,'01012015'",
  "S21.G00.40.004,'684a'",
  "S21.G00.40.006,'AGENT DE SERVICE'",
  "S21.G00.40.007,'01'",
  "S21.G00.40.012,'151.67'",
  "S21.G00.40.013,'151.67'",
  "S21.G00.40.017,'3043'",
  "S21.G00.60.001,'01'",
  "S21.G00.60.002,'31122025'", // dernier jour travaillé
  "S21.G00.60.003,'10012026'", // fin prévisionnelle
  "S21.G00.78.001,'03'",
  "S21.G00.78.004,'2000.00'",
  // Individu 2 — femme, temps partiel 75/151.67, brut 1200, 1 AT
  "S21.G00.30.001,'2850275123456'",
  "S21.G00.30.002,'MARTIN'",
  "S21.G00.30.004,'MARIE'",
  "S21.G00.30.005,'02'",
  "S21.G00.30.006,'20071985'",
  "S21.G00.40.001,'01062020'",
  "S21.G00.40.004,'486e'",
  "S21.G00.40.007,'02'",
  "S21.G00.40.012,'151.67'",
  "S21.G00.40.013,'75.00'",
  "S21.G00.40.017,'3043'",
  "S21.G00.60.001,'05'", // accident du travail
  "S21.G00.60.002,'04012026'",
  "S21.G00.60.010,'09012026'", // reprise
  "S21.G00.78.001,'02'", // base plafonnée (ignorée)
  "S21.G00.78.004,'999.00'",
  "S21.G00.78.001,'03'", // base déplafonnée = brut
  "S21.G00.78.004,'1200.00'",
  "S90.G00.90.001,'40'",
].join("\n");

describe("parseDsn", () => {
  const dsn = parseDsn(DSN);

  test("parse l'en-tête et les 2 individus", () => {
    expect(dsn.meta.raisonSociale).toBe("TEST SARL");
    expect(dsn.meta.siren).toBe("123456789");
    expect(dsn.meta.idcc).toBe("3043");
    expect(dsn.individus).toHaveLength(2);
  });

  test("extrait identité, contrat (PCS, quotité, nature)", () => {
    const [a, b] = dsn.individus;
    expect(a.nom).toBe("DUPONT");
    expect(a.sexe).toBe("Homme");
    expect(a.nirKey).toBe("1800175123456");
    expect(a.contrats[0].pcs).toBe("684a");
    expect(a.contrats[0].nature).toBe("01");
    expect(a.contrats[0].quotiteTravail).toBe(151.67);
    expect(b.sexe).toBe("Femme");
    expect(b.contrats[0].quotiteTravail).toBe(75);
  });

  test("brut = base assujettie code 03 (pas le code 02)", () => {
    expect(dsn.individus[0].versement.brut).toBe(2000);
    expect(dsn.individus[1].versement.brut).toBe(1200); // 1200, pas 999 (code 02)
  });

  test("arrêts : motif + durée en jours", () => {
    // Arrêt maladie : dernier jour 31/12/2025 → début 01/01, fin 10/01 = 10 jours
    const a = dsn.individus[0].arrets[0];
    expect(a.motif).toBe("01");
    expect(a.motifLabel).toBe("Maladie");
    expect(a.jours).toBe(10);
    // AT individu 2 : dernier jour 04/01 → début 05/01, reprise 09/01 → fin 08/01 = 4 jours
    expect(dsn.individus[1].arrets[0].motif).toBe("05");
  });

  test("dsnAggregates — masse brute, absentéisme, AT/MP", () => {
    const agg = dsnAggregates(dsn);
    expect(agg.nbSalaries).toBe(2);
    expect(agg.masseBrute).toBe(3200); // 2000 + 1200
    expect(agg.nbArrets).toBe(2);
    expect(agg.joursAtMp).toBeGreaterThan(0); // l'AT compte
    expect(agg.idcc).toBe("3043");
  });
});

// ─── La DSN comme source autonome ───
describe("dsnToEmployees — auditer sans fichier de paie", () => {
  const employees = dsnToEmployees(parseDsn(DSN));

  test("un salarié par individu, au format du modèle universel", () => {
    expect(employees).toHaveLength(2);
    const [a, b] = employees;
    expect(a.nom).toBe("DUPONT");
    expect(a.prenom).toBe("JEAN");
    expect(a.sexe).toBe("Homme");
    expect(a.dateNaiss.getFullYear()).toBe(1980);
    expect(a.age).toBeGreaterThan(40);
    expect(b.sexe).toBe("Femme");
  });

  test("entrée, ancienneté et emploi viennent du contrat", () => {
    const [a, b] = employees;
    expect(a.dateEntree.getFullYear()).toBe(2015);
    expect(a.anciennete).toBeGreaterThan(9);
    expect(a.emploi).toBe("AGENT DE SERVICE");
    expect(b.emploi).toBe("486e"); // à défaut de libellé, le code PCS
  });

  test("nature de contrat et temps partiel déduits des quotités", () => {
    const [a, b] = employees;
    expect(a.cdd).toBe(false);          // nature 01 = CDI
    expect(a.tempsComplet).toBe(true);  // 151,67 / 151,67
    expect(b.cdd).toBe(true);           // nature 02 = CDD
    expect(b.tempsComplet).toBe(false); // 75 / 151,67
    expect(b.pctActivite).toBe(49);
  });

  test("sans fin de contrat, le salarié est actif", () => {
    expect(employees.every((e) => e.actif)).toBe(true);
    expect(employees.every((e) => e.dateSortie === null)).toBe(true);
  });

  test("les données propres à la DSN restent accessibles aux critères", () => {
    const [a] = employees;
    expect(a.dsn.brut).toBe(2000);
    expect(a.dsn.arrets).toHaveLength(1);
    expect(a.dsn.quotiteRef).toBe(151.67);
    expect(a.dsn.contrats).toHaveLength(1);
  });

  test("CE QUE LA DSN NE PORTE PAS reste vide, jamais faussement à zéro", () => {
    for (const e of employees) {
      // `null` et non `false` : sinon l'audit conclut « aucun bénéficiaire
      // RQTH » et chiffre une contribution AGEFIPH sur une donnée absente.
      expect(e.handicap).toBeNull();
      expect(e.visiteDate).toBeNull();
      expect(e.etranger).toBeNull();
      expect(e.nationalite).toBe("");
      expect(e.cartesSejourFin).toBeNull();
    }
  });

  test("la provenance de chaque champ est tracée", () => {
    const [a] = employees;
    expect(a._src.salaire).toBe(SOURCE.dsn);
    expect(a._src.dateEntree).toBe(SOURCE.dsn);
    // Les champs hors DSN sont marqués absents, pas « venus de la DSN ».
    expect(a._src.handicap).toBe(SOURCE.absent);
    expect(a._src.visiteDate).toBe(SOURCE.absent);
  });

  test("l'ancienneté se compte depuis le PREMIER contrat, pas le dernier", () => {
    const troisCdd = parseDsn([
      "S21.G00.30.001,'1800175123456'", "S21.G00.30.002,'ROUX'", "S21.G00.30.004,'LEA'",
      "S21.G00.30.005,'02'", "S21.G00.30.006,'15031990'",
      "S21.G00.40.001,'01012024'", "S21.G00.40.007,'02'", "S21.G00.40.006,'SERVEUSE'",
      "S21.G00.40.001,'01062025'", "S21.G00.40.007,'02'",
      "S21.G00.40.001,'01012026'", "S21.G00.40.007,'02'", "S21.G00.40.006,'SERVEUSE 3'",
    ].join("\n"));
    const [e] = dsnToEmployees(troisCdd);
    expect(e.dateEntree.getFullYear()).toBe(2024); // premier contrat
    expect(e.emploi).toBe("SERVEUSE 3");           // mais l'emploi est celui du contrat courant
    expect(e.dsn.contrats).toHaveLength(3);        // le chaînage reste disponible
  });

  test("une fin de contrat rend le salarié inactif et porte son motif", () => {
    const sorti = parseDsn([
      "S21.G00.30.001,'1800175123456'", "S21.G00.30.002,'PEREZ'", "S21.G00.30.004,'MANON'",
      "S21.G00.30.005,'02'", "S21.G00.30.006,'15031990'",
      "S21.G00.40.001,'01012025'", "S21.G00.40.007,'02'",
      "S21.G00.65.001,'020'", "S21.G00.65.002,'30062026'",
    ].join("\n"));
    const [e] = dsnToEmployees(sorti);
    expect(e.actif).toBe(false);
    expect(e.dateSortie.getFullYear()).toBe(2026);
    expect(e.motifLabel).toBe("Fin de CDD");
  });

  test("un code de rupture inconnu s'affiche tel quel, jamais traduit à tort", () => {
    const inconnu = parseDsn([
      "S21.G00.30.001,'1800175123456'", "S21.G00.30.002,'X'", "S21.G00.30.004,'Y'",
      "S21.G00.40.001,'01012025'", "S21.G00.40.007,'01'",
      "S21.G00.65.001,'777'", "S21.G00.65.002,'30062026'",
    ].join("\n"));
    expect(dsnToEmployees(inconnu)[0].motifLabel).toBe("Code 777");
  });

  test("DSN vide ou absente → aucun salarié, sans exception", () => {
    expect(dsnToEmployees(null)).toEqual([]);
    expect(dsnToEmployees({ individus: [] })).toEqual([]);
  });
});

test("parseDsnDate — format JJMMAAAA", () => {
  expect(parseDsnDate("15031980").getFullYear()).toBe(1980);
  expect(parseDsnDate("15031980").getMonth()).toBe(2); // mars = index 2
  expect(parseDsnDate("")).toBeNull();
  expect(parseDsnDate("abc")).toBeNull();
});
