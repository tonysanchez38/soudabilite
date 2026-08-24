// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// config.js - indicateurs de fonctionnalité (feature flags).
// =========================================================================

// Numéro de build (affichable en pied de page / logs de diagnostic).
export const BUILD_SIGNATURE = "TS-SDB-2026";

// Compteur de visites uniques sur la page Présentation, masqué par défaut.
// Pour l'activer : passer à true (aucune autre modification nécessaire,
// le fetch/rendu existent déjà dans compteur.js/rendreCompteurPage).
export const COMPTEUR_PAGE_VISIBLE = false;
