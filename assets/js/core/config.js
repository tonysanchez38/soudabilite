// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// config.js - indicateurs de fonctionnalité (feature flags).
// =========================================================================

// Apports duplex/superduplex masqués de la sélection des 7 meilleurs
// apports tant que les iso-FN WRC-1992 ne sont pas digitalisées (le tri
// duplex actuel utilise une approximation via la table Schaeffler - cf.
// ferriteApproxWRC, core/famille_alliage.js). CLAUDE.md #29.
export const DUPLEX_VISIBLE = false;

// Numéro de build (affichable en pied de page / logs de diagnostic).
export const BUILD_SIGNATURE = "TS-SDB-2026";

// Compteur de visites uniques sur la page Présentation, masqué par défaut.
// Pour l'activer : passer à true (aucune autre modification nécessaire,
// le fetch/rendu existent déjà dans compteur.js/rendreCompteurPage).
export const COMPTEUR_PAGE_VISIBLE = false;
