import { get, set, del } from "idb-keyval";

const KEY_EMPLOYEES = "rh-cockpit-employees";
const KEY_FILENAME = "rh-cockpit-filename";
const KEY_API_KEY = "rh-cockpit-apikey";
const KEY_MAPPING = "rh-cockpit-mapping";
const KEY_PROFILE = "rh-cockpit-profile";

export async function saveEmployees(employees, fileName) {
  // Serialize dates to ISO strings for storage
  const serialized = employees.map((e) => ({
    ...e,
    dateNaiss: e.dateNaiss?.toISOString() || null,
    dateEntree: e.dateEntree?.toISOString() || null,
    dateSortie: e.dateSortie?.toISOString() || null,
    visiteDate: e.visiteDate?.toISOString() || null,
    cartesSejourFin: e.cartesSejourFin?.toISOString() || null,
    cartesTravailFin: e.cartesTravailFin?.toISOString() || null,
  }));
  await set(KEY_EMPLOYEES, serialized);
  await set(KEY_FILENAME, fileName);
}

export async function loadEmployees() {
  const data = await get(KEY_EMPLOYEES);
  const fileName = await get(KEY_FILENAME);
  if (!data || !data.length) return null;

  // Deserialize ISO strings back to Date objects
  const employees = data.map((e) => ({
    ...e,
    dateNaiss: e.dateNaiss ? new Date(e.dateNaiss) : null,
    dateEntree: e.dateEntree ? new Date(e.dateEntree) : null,
    dateSortie: e.dateSortie ? new Date(e.dateSortie) : null,
    visiteDate: e.visiteDate ? new Date(e.visiteDate) : null,
    cartesSejourFin: e.cartesSejourFin ? new Date(e.cartesSejourFin) : null,
    cartesTravailFin: e.cartesTravailFin ? new Date(e.cartesTravailFin) : null,
  }));

  return { employees, fileName: fileName || "Données sauvegardées" };
}

export async function clearEmployees() {
  await del(KEY_EMPLOYEES);
  await del(KEY_FILENAME);
  // Le mapping doit aussi être effacé : sinon un mapping ancien (sans les nouveaux champs
  // du modèle) reste utilisé au prochain upload et masque silencieusement les colonnes.
  await del(KEY_MAPPING);
  await del(KEY_PROFILE);
}

export async function saveApiKey(key) {
  await set(KEY_API_KEY, key);
}

export async function loadApiKey() {
  return (await get(KEY_API_KEY)) || "";
}

export async function saveMapping(mapping, profileId) {
  await set(KEY_MAPPING, mapping);
  await set(KEY_PROFILE, profileId);
}

export async function loadMapping() {
  const mapping = await get(KEY_MAPPING);
  const profileId = await get(KEY_PROFILE);
  return mapping ? { mapping, profileId } : null;
}
