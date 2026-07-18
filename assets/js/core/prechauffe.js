// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// prechauffe.js - sélection de méthode de préchauffe (Séférian / BWRA) et
// compensation Ceq associée. Une seule méthode affichée à la fois - jamais
// les deux en parallèle (cf. vue_analyse.js, branche carbone/carbone).
// Fonctions pures.
// =========================================================================

import { corrigerParEpaisseur } from "./carbone_eq.js";

// BWRA seulement si procédé 111 (électrode enrobée) ET classe hydrogène du
// consommable renseignée (donnée non encore collectée dans l'app - cf.
// classeHydrogene toujours null pour l'instant côté appelant). Sinon repli
// systématique sur Séférian, seule méthode utilisable avec les données
// aujourd'hui disponibles.
export function choisirMethodePreachauffe(procede, classeHydrogene) {
  const electrodeEnrobee = procede === "111";
  const bwraApplicable = electrodeEnrobee && classeHydrogene != null;
  return bwraApplicable ? "bwra" : "seferian";
}

export const MESSAGES_METHODE = {
  seferian: "analyse.methode_seferian_msg",
  bwra: "analyse.methode_bwra_msg",
};

// Ajustement Ceq par classe d'hydrogène du consommable - formule NON
// SOURCÉE (à définir avec Tony). Volontairement bloquant plutôt que
// silencieux : tant que la formule n'est pas fournie, appeler cette
// fonction avec une classe renseignée produirait un Tp métallurgiquement
// faux si on la laissait passer sans erreur (cf. CLAUDE.md #31, "pas de
// verdict plutôt qu'un verdict faux"). N'est atteinte dans l'app que si
// classeHydrogene devient non-null quelque part - pas le cas aujourd'hui.
export function ajusterParHydrogene(ceq, classeHydrogene) {
  throw new Error(
    `ajusterParHydrogene() : formule non sourcée pour la classe "${classeHydrogene}" - à définir avec Tony avant d'activer ce chemin.`
  );
}

// Ceq compensé pour la méthode Séférian (seule méthode dont la
// compensation suit ce modèle multiplicatif épaisseur/hydrogène - PAS
// BWRA, qui compense via TSN, cf. corrigerParEpaisseur dans carbone_eq.js).
// Correction hydrogène ajoutée seulement si classeHydrogene est réellement
// fournie - jamais une valeur par défaut arbitraire.
export function calculerCeqCompense(ceqBase, epaisseurCombinee, classeHydrogene) {
  let ceq = corrigerParEpaisseur(ceqBase, epaisseurCombinee);
  if (classeHydrogene != null) {
    ceq = ajusterParHydrogene(ceq, classeHydrogene);
  }
  return ceq;
}
