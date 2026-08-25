// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// schaeffler.js - géométrie du diagramme de Schaeffler.
// Réf. spec.md §1 (Cr_eq / Ni_eq) et CLAUDE.md #17 (ferrite) / zone idéale.
// Fonctions pures. Placement/lecture sur axes Schaeffler (Cr_eq, Ni_eq).
//
// % ferrite : estimation par interpolation entre les iso-ferrite réelles.
// =========================================================================

// Source unique des coordonnées : iso_ferrite_schaeffler.js.
import { ISO_FERRITE_SCHAEFFLER, ordonneeIso } from "./iso_ferrite_schaeffler.js";

// % ferrite estimé pour un point (Cr_eq, Ni_eq) par interpolation linéaire.
export function ferriteSchaeffler(crEq, niEq, zones = null) {
  // Quand la géométrie est disponible, les iso-ferrite ne sont lues que
  // dans la zone austéno-ferritique. Ailleurs, un chiffre créerait une
  // fausse précision.
  if (Array.isArray(zones)) {
    const af = zones.find((z) => z.id === "AF");
    if (!af || !pointDansPolygone([crEq, niEq], af.polygone)) return null;
  }
  const disponibles = ISO_FERRITE_SCHAEFFLER
    .map((ligne) => ({ pct: ligne.pct, ni: ordonneeIso(ligne, crEq) }))
    .filter((x) => x.ni != null);
  if (disponibles.length === 0) return null;
  // À Cr_eq fixé, Ni_eq décroît lorsque la ferrite augmente.
  if (niEq >= disponibles[0].ni) return disponibles[0].pct;
  for (let i = 1; i < disponibles.length; i++) {
    const haut = disponibles[i - 1];
    const bas = disponibles[i];
    if (niEq >= bas.ni) {
      return haut.pct + ((haut.ni - niEq) / (haut.ni - bas.ni)) * (bas.pct - haut.pct);
    }
  }
  // Au-dessous de la dernière isoplèthe documentée : aucune valeur précise
  // n'est inventée ; 100 signifie seulement la saturation de l'échelle.
  return 100;
}

// Test point-dans-polygone (ray casting). poly : [[x,y], ...].
export function pointDansPolygone([x, y], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersecte =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersecte) dedans = !dedans;
  }
  return dedans;
}

// Identifiant de la zone métallurgique contenant le point (ou null).
export function classifieZone(crEq, niEq, zones) {
  const p = [crEq, niEq];
  for (const z of zones) {
    if (pointDansPolygone(p, z.polygone)) return z.id;
  }
  return null;
}

// Distance euclidienne au centre de la zone idéale.
export function distanceCentre(crEq, niEq, centre) {
  return Math.hypot(crEq - centre[0], niEq - centre[1]);
}

// Indice martensitique Walker & Gooch (1986), cité EN 10088-1:2005 Annexe C
// Tableau C.1. Plage 100-300 = structure martensitique.
export function msWalkerGooch(comp) {
  const v = (e) => Number(comp?.[e]) || 0;
  return 540 - 497 * v("C") - 6.3 * v("Mn") - 10.8 * v("Cr")
             - 36.3 * v("Ni") - 46.6 * v("Mo");
}

// Niveau idéal/acceptable/zone_s/hors : depuis la refonte du diagramme, la
// zone idéale n'est plus un polygone indépendant mais un entonnoir entre
// deux iso-ferrite (5-15 % idéal, 0-20 % acceptable), restreint à la zone AF
// et à Cr_eq ≤ 25 (mur sigma) - même définition géométrique que le rendu
// (schaeffler_svg.js), pour zéro divergence écran/verdict (CLAUDE.md #9).
// Cascade de priorité (validée Tony) : ideal > acceptable > zone_s (dernier
// recours, overlay digitalisé du diagramme papier de référence) > hors. Le
// classement des 7 apports (distance au centre) n'utilise pas cette cascade.
export function niveauIdeal(crEq, niEq, zones, zoneS) {
  if (crEq <= 25) {
    const af = (zones || []).find((z) => z.id === "AF");
    if (af && pointDansPolygone([crEq, niEq], af.polygone)) {
      const fer = ferriteSchaeffler(crEq, niEq);
      if (fer != null && fer >= 5 && fer <= 15) return "ideal";
      if (fer != null && fer >= 0 && fer <= 20) return "acceptable";
    }
  }
  if (zoneS && pointDansPolygone([crEq, niEq], zoneS)) return "zone_s";
  return "hors";
}

// Verdict Schaeffler : niveau (idéal / acceptable / zone_s / hors) + risques.
// risques par appartenance à la zone métallurgique réelle (classifieZone),
// sauf sigma (seuil Cr_eq) et martensite (indice Walker-Gooch sur la
// composition, cf. spec.md §11/§12, CLAUDE.md).
export function verdictSchaeffler(crEq, niEq, comp, zones, zoneS) {
  const niveau = niveauIdeal(crEq, niEq, zones, zoneS);

  const zone = classifieZone(crEq, niEq, zones);
  const risques = [];
  // Les zones validées par Tony ne portent pas d'alerte de fissuration.
  // Hors de ces zones, le type de risque vient de la zone métallurgique,
  // sans extrapoler la ferrite ni utiliser Ms comme verdict autonome.
  if (["ideal", "acceptable", "zone_s"].includes(niveau)) return { niveau, risques };
  if (zone === "A") risques.push("austenite_pure");
  if (["AM", "M", "MF", "AMF"].includes(zone)) risques.push("martensite");
  if (crEq > 25) risques.push("sigma");
  if (zone === "F") risques.push("grossissement_grain");

  return { niveau, risques };
}
