import { construireEffectif, couvertureAudit, manquesAdemander, MODES } from "./sources";
import { parseDsn, SOURCE } from "./dsnParser";

// DSN minimale : 2 individus, dont un rapproché par NIR avec la paie.
const DSN = [
  "S21.G00.06.003,'TEST SARL'",
  "S20.G00.05.005,'01012026'",
  "S21.G00.11.001,'00001'",
  "S21.G00.30.001,'1800175123456'",
  "S21.G00.30.002,'DUPONT'", "S21.G00.30.004,'JEAN'",
  "S21.G00.30.005,'01'", "S21.G00.30.006,'15031980'",
  "S21.G00.40.001,'01012015'", "S21.G00.40.006,'AGENT DE SERVICE'",
  "S21.G00.40.007,'01'", "S21.G00.40.012,'151.67'", "S21.G00.40.013,'151.67'",
  "S21.G00.78.001,'03'", "S21.G00.78.004,'2400.00'",
  "S21.G00.30.001,'2850275123456'",
  "S21.G00.30.002,'MARTIN'", "S21.G00.30.004,'MARIE'",
  "S21.G00.30.005,'02'", "S21.G00.30.006,'20071985'",
  "S21.G00.40.001,'01062020'", "S21.G00.40.007,'02'",
  "S21.G00.40.012,'151.67'", "S21.G00.40.013,'75.00'",
].join("\n");

const dsn = parseDsn(DSN);

// Un salarié de paie complet, rapprochable par NIR du DUPONT de la DSN.
const empPaie = (o = {}) => ({
  id: 1, nom: "DUPONT", prenom: "Jean", sexe: "Homme",
  dateNaiss: new Date(1980, 2, 15), age: 46,
  dateEntree: new Date(2015, 0, 1), anciennete: 11, dateSortie: null,
  etab: "SIEGE", service: "", cdd: false, handicap: false, tempsComplet: true,
  salaire: 2000, heures: 151.67, ville: "Toulon", cp: "83000",
  motifCode: null, motifLabel: "Non renseigné",
  visiteDate: new Date(2025, 0, 10), actif: true,
  email: "", tel: "", voie: "", pctActivite: null, emploi: "Agent",
  nir: "1800175123456", nationalite: "Française", etranger: false,
  cartesSejourNumero: "", cartesSejourFin: null,
  cartesTravailNumero: "", cartesTravailFin: null,
  ...o,
});

describe("construireEffectif — trois sources possibles", () => {
  test("aucune source → rien, sans exception", () => {
    const r = construireEffectif({});
    expect(r.employees).toBeNull();
    expect(r.mode).toBeNull();
  });

  test("paie seule → la paie fait le modèle", () => {
    const r = construireEffectif({ paie: [empPaie()] });
    expect(r.mode).toBe(MODES.paie.cle);
    expect(r.employees).toHaveLength(1);
    expect(r.employees[0]._src.salaire).toBe(SOURCE.paie);
  });

  test("DSN seule → la DSN fait le modèle", () => {
    const r = construireEffectif({ dsn });
    expect(r.mode).toBe(MODES.dsn.cle);
    expect(r.employees).toHaveLength(2);
    expect(r.employees[0].nom).toBe("DUPONT");
    expect(r.employees[0]._src.handicap).toBe(SOURCE.absent);
  });

  test("DSN vide traitée comme absente", () => {
    expect(construireEffectif({ dsn: { individus: [] } }).employees).toBeNull();
    expect(construireEffectif({ paie: [], dsn: null }).employees).toBeNull();
  });
});

describe("préséance quand les deux sources sont là", () => {
  const r = construireEffectif({ paie: [empPaie()], dsn });

  test("mode mixte, salarié rapproché par NIR", () => {
    expect(r.mode).toBe(MODES.mixte.cle);
    expect(r.rapproches).toBe(1);
    // L'effectif reste celui de la paie : la DSN ne rajoute pas MARTIN.
    expect(r.employees).toHaveLength(1);
  });

  test("LE SALAIRE DE BASE N'EST PAS ÉCRASÉ par le brut DSN", () => {
    // 2000 (base contractuelle) et non 2400 (brut versé du mois).
    // L'écart de rémunération de l'Index Égalité se calcule sur la base ;
    // le brut inclut primes et heures supplémentaires.
    expect(r.employees[0].salaire).toBe(2000);
    expect(r.employees[0]._src.salaire).toBe(SOURCE.paie);
    // Le brut DSN reste accessible, à part.
    expect(r.employees[0].dsn.brut).toBe(2400);
  });

  test("les données que la DSN seule porte restent attachées", () => {
    expect(r.employees[0].dsn.quotiteRef).toBe(151.67);
    expect(r.employees[0].dsn.contrats).toHaveLength(1);
  });

  test("la DSN comble les champs que la paie a laissés vides", () => {
    const r2 = construireEffectif({ paie: [empPaie({ emploi: "", etab: "" })], dsn });
    expect(r2.employees[0].emploi).toBe("AGENT DE SERVICE");
    expect(r2.employees[0]._src.emploi).toBe(SOURCE.dsn);
    expect(r2.comblements).toBeGreaterThan(0);
  });

  test("un salarié sans NIR n'est pas rapproché, et rien n'est inventé", () => {
    const r3 = construireEffectif({ paie: [empPaie({ nir: "", emploi: "" })], dsn });
    expect(r3.rapproches).toBe(0);
    expect(r3.employees[0].emploi).toBe("");
    expect(r3.employees[0].dsn).toBeUndefined();
  });
});

describe("couvertureAudit — dire ce qui n'a PAS été examiné", () => {
  test("en DSN seule, les critères sans donnée sont annoncés", () => {
    const { employees, mode } = construireEffectif({ dsn });
    const c = couvertureAudit(employees, mode);
    expect(c.mode).toBe(MODES.dsn.cle);
    expect(c.nonEvaluables.length).toBeGreaterThan(0);
    // L'OETH ne peut pas se juger sans le statut RQTH.
    const oeth = c.nonEvaluables.find((x) => x.id === "oeth");
    expect(oeth).toBeDefined();
    expect(oeth.champsManquants).toContain("handicap");
    expect(oeth.cause).toMatch(/ne figure pas dans une DSN/);
  });

  test("l'avertissement dit qu'un silence ne vaut pas conformité", () => {
    const { employees, mode } = construireEffectif({ dsn });
    const c = couvertureAudit(employees, mode);
    expect(c.avertissement).toMatch(/ne vaut pas conformité/i);
  });

  test("les compteurs sont cohérents", () => {
    const { employees, mode } = construireEffectif({ dsn });
    const c = couvertureAudit(employees, mode);
    expect(c.evaluables + c.nonEvaluables.length).toBe(c.total);
  });

  test("un fichier de paie complet laisse peu d'angles morts", () => {
    const paie = Array.from({ length: 12 }, (_, i) => empPaie({ id: i, nir: `18001751234${String(i).padStart(2, "0")}` }));
    const { employees, mode } = construireEffectif({ paie });
    const c = couvertureAudit(employees, mode);
    // Le suivi médical et le RQTH sont renseignés : ces critères sortent
    // des angles morts, contrairement au mode DSN.
    expect(c.nonEvaluables.find((x) => x.id === "oeth")).toBeUndefined();
    expect(c.nonEvaluables.find((x) => x.id === "suivi-medical")).toBeUndefined();
  });

  test("la cause distingue « absent de la DSN » de « mal rempli »", () => {
    // Paie sans visites médicales : ce n'est pas un problème de format DSN.
    const paie = Array.from({ length: 12 }, (_, i) => empPaie({ id: i, visiteDate: null, nir: `18001751234${String(i).padStart(2, "0")}` }));
    const { employees, mode } = construireEffectif({ paie });
    const c = couvertureAudit(employees, mode);
    const sm = c.nonEvaluables.find((x) => x.id === "suivi-medical");
    expect(sm.cause).toMatch(/absente ou trop incomplète/);
  });

  test("effectif vide → pas de couverture, sans exception", () => {
    expect(couvertureAudit([], MODES.paie.cle)).toBeNull();
    expect(couvertureAudit(null, null)).toBeNull();
  });
});

describe("manquesAdemander — ce qu'il faut réclamer au client", () => {
  test("regroupe les critères bloqués par champ manquant", () => {
    const { employees, mode } = construireEffectif({ dsn });
    const manques = manquesAdemander(couvertureAudit(employees, mode));
    const rqth = manques.find((m) => m.champ === "handicap");
    expect(rqth).toBeDefined();
    expect(rqth.libelle).toMatch(/RQTH/);
    expect(rqth.critères.length).toBeGreaterThan(0);
  });

  test("rien à demander quand rien ne manque", () => {
    expect(manquesAdemander(null)).toEqual([]);
    expect(manquesAdemander({ nonEvaluables: [] })).toEqual([]);
  });
});
