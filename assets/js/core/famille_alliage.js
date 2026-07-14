// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// famille_alliage.js - détection provisoire de famille d'alliage par
// désignation (duplex/superduplex), en l'absence de groupe_iso_15608
// peuplé dans la banque (ISO/TR 20172 prévu, non encore intégré).
// À REMPLACER dès que groupe_iso_15608 sera renseigné - cf. CLAUDE.md.
// Fonctions pures.
// =========================================================================

import { ferriteSchaeffler } from "./schaeffler.js";

// [APPROXIMATION] Réutilise la table d'interpolation ferrite calibrée
// sur les iso-ferrite Schaeffler (FERRITE_G), appliquée à des
// coordonnées WRC-1992. Les deux diagrammes ont des échelles d'axes
// distinctes (cf. Kotecki & Siewert 1992) - ce %ferrite est indicatif,
// pas une lecture rigoureuse des iso-FN du WRC-1992. Amélioration
// possible : digitaliser les iso-FN WRC-1992 (Fig. 6-7 du papier
// original) pour une table de calibration dédiée.
export function ferriteApproxWRC(crEqW, niEqW) {
  return ferriteSchaeffler(crEqW, niEqW);
}

// Détection duplex/superduplex par motif de désignation. Volontairement
// PAS basée sur l'azote : les superausténitiques (254 SMO...) sont aussi
// fortement alliés N sans être duplex - l'azote seul est un faux critère.
const RE_DUPLEX = /duplex|super.?duplex|\b2205\b|\b2507\b|\b2209\b|\b2594\b|25.22.2/i;

export function estDuplex(designation) {
  return RE_DUPLEX.test(designation || "");
}

// Verdict duplex/superduplex : cible ferrite 30-70 % (ISO 17781 / NORSOK
// M-601, critère d'acceptation du joint soudé - pas le critère taxonomique
// EN 10088-1 FNA 30-50, qui répond à une question différente : « est-ce un
// duplex » plutôt que « ce taux est-il acceptable »).
// Tolérance 20-70 % (NACE Corrosion / OnePetro, « Ferrite Measurement in
// Duplex Stainless Steels » : « should typically contain ferrite... not
// less than 20 or more than 70% »). La borne haute (70 %) est partagée
// entre ideal et acceptable - voulu : aucune marge au-dessus de 70 %,
// une marge 20-30 % en dessous de la cible.
// Pas de lecture des polygones Schaeffler (classifieZone) ni des risques
// martensite/austenite_pure/sigma : ce domaine n'est pas modélisé par ces
// polygones.
export const SOURCE_DUPLEX_IDEAL = "Cible 30-70% ferrite - ISO 17781 / NORSOK M-601, conformité du joint soudé.";

export function verdictDuplex(ferrite) {
  let niveau = "hors";
  if (ferrite >= 30 && ferrite <= 70) niveau = "ideal";
  else if (ferrite >= 20 && ferrite <= 70) niveau = "acceptable";
  return { niveau, risques: [] };
}
