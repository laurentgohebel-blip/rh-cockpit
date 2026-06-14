// Réassemble le référentiel à partir des fichiers par domaine.
// Les imports existants `from "@/core/referentiel"` résolvent ici (index.js).
export * from "./constants";

import { conformiteCriteria } from "./conformite";
import { remunerationCriteria } from "./remuneration";
import { mouvementsCriteria } from "./mouvements";
import { effectifsCriteria } from "./effectifs";
import { santeCriteria } from "./sante";

export const CRITERIA = [
  ...conformiteCriteria,
  ...remunerationCriteria,
  ...mouvementsCriteria,
  ...effectifsCriteria,
  ...santeCriteria,
];
