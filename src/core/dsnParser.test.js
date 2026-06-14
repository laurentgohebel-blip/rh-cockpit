import { parseDsn, dsnAggregates, parseDsnDate } from "./dsnParser";

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

test("parseDsnDate — format JJMMAAAA", () => {
  expect(parseDsnDate("15031980").getFullYear()).toBe(1980);
  expect(parseDsnDate("15031980").getMonth()).toBe(2); // mars = index 2
  expect(parseDsnDate("")).toBeNull();
  expect(parseDsnDate("abc")).toBeNull();
});
