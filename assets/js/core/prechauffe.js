// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// prechauffe.js - sélection de méthode de préchauffe (Séférian / BWRA) et
// compensation Ceq associée. Une seule méthode affichée à la fois - jamais
// les deux en parallèle (cf. vue_analyse.js, branche carbone/carbone).
// Fonctions pures.
// =========================================================================

import { corrigerParEpaisseur } from "./carbone_eq.js";

// Traduit la lettre d'enrobage saisie en Paramètres (fr.json
// parametres.enrobages : R, B, C, A, RB, RC) vers le typeElectrode que
// tpBWRA()/indiceSoudabilite() savent lire. core/bwra.js CEQ_INDICE_TABLE
// n'a que deux familles sourcées (rutile/basique) - pas de bucket
// "cellulosique" séparé : seul "B" bascule en basique, les cinq autres
// lettres (y compris C, A, RB, RC) sont classées rutile, la famille non
// basique la plus proche disponible dans la table. Seule traduction
// lettre -> typeElectrode dans tout le code - ne pas la dupliquer côté UI.
export function traduireEnrobage(lettre) {
  if (lettre == null) return null;
  return lettre === "B" ? "basique" : "rutile";
}

// BWRA seulement si procédé 111 (électrode enrobée) ET type d'électrode
// (rutile/basique) renseigné - c'est la structure de l'enrobage qui pilote
// tpBWRA() (core/bwra.js), pas la classe hydrogène (qui n'alimente que la
// correction CEQ NF EN 1011-2, cf. ajusterParHydrogeneSecurise). Sinon
// repli systématique sur Séférian.
export function choisirMethodePreachauffe(procede, typeElectrode) {
  const electrodeEnrobee = procede === "111";
  const bwraApplicable = electrodeEnrobee && typeElectrode != null;
  return bwraApplicable ? "bwra" : "seferian";
}

export const MESSAGES_METHODE = {
  seferian: "analyse.methode_seferian_msg",
  bwra: "analyse.methode_bwra_msg",
};

// Ajustement Ceq par classe d'hydrogène du consommable - formule NON
// SOURCÉE à ce jour (à valider avec Tony contre le support de cours BTS
// CRCI). Ne fabrique jamais de correction sans formule sourcée : le CEQ
// est renvoyé inchangé, avec un indicateur d'approximation plutôt qu'une
// exception qui casserait l'affichage (cf. CLAUDE.md #31, "pas de verdict
// plutôt qu'un verdict faux" - ici appliqué sans bloquer le rendu).
export function ajusterParHydrogeneSecurise(ceq, classeHydrogene) {
  if (classeHydrogene == null) {
    return { ceq, approxime: false };
  }
  return {
    ceq,
    approxime: true,
    note: `Classe hydrogène ${classeHydrogene} connue mais non encore intégrée au calcul (formule à sourcer).`,
  };
}

// Ceq compensé pour la méthode Séférian (seule méthode dont la
// compensation suit ce modèle multiplicatif épaisseur/hydrogène - PAS
// BWRA, qui compense via TSN, cf. corrigerParEpaisseur dans carbone_eq.js).
// Un seul point d'entrée pour tout appelant : passe toujours par la
// version sécurisée, plus de chemin d'exception.
// TODO Lot 6/7 : renvoie aujourd'hui un nombre brut pour ne pas casser les
// appelants existants (carte préchauffe, export PDF, tableau de synthèse).
// À refactoriser en { valeur, approxime, note } une fois tous ces
// appelants mis à jour pour lire resultat.valeur au lieu du nombre direct
// - ce jour-là, note pourra s'afficher à l'écran quand approxime === true.
export function calculerCeqCompense(ceqBase, epaisseurCombinee, classeHydrogene) {
  const ceq = corrigerParEpaisseur(ceqBase, epaisseurCombinee);
  return ajusterParHydrogeneSecurise(ceq, classeHydrogene).ceq;
}
