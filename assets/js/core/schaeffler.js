// =========================================================================
// schaeffler.js — géométrie du diagramme de Schaeffler.
// Réf. spec.md §1 (Cr_eq / Ni_eq) et CLAUDE.md #17 (ferrite) / zone idéale.
// Fonctions pures. Placement/lecture sur axes Schaeffler (Cr_eq, Ni_eq).
//
// % ferrite : estimation calibrée sur les iso-ferrite du diagramme de
// Schaeffler (droites g = Cr_eq − Ni_eq = constante). Le Ferrite Number
// rigoureux WRC-1992 (diagramme plein) est prévu au Lot 4.
// =========================================================================

// Points d'ancrage (g = Cr_eq − Ni_eq ; % ferrite) — cf. zones_schaeffler.json.
const FERRITE_G = [
  [4, 0],
  [7, 5],
  [9.5, 10],
  [13, 20],
  [17, 40],
  [22, 80],
  [25, 100],
];

// % ferrite estimé pour un point (Cr_eq, Ni_eq) par interpolation linéaire.
export function ferriteSchaeffler(crEq, niEq) {
  const g = crEq - niEq;
  if (g <= FERRITE_G[0][0]) return 0;
  if (g >= FERRITE_G[FERRITE_G.length - 1][0]) return 100;
  for (let i = 1; i < FERRITE_G.length; i++) {
    if (g <= FERRITE_G[i][0]) {
      const [g0, f0] = FERRITE_G[i - 1];
      const [g1, f1] = FERRITE_G[i];
      return f0 + ((g - g0) / (g1 - g0)) * (f1 - f0);
    }
  }
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

// Verdict Schaeffler : niveau (idéal / acceptable / hors) + risques.
// niveau par appartenance aux overlays (cohérent avec l'affichage) ;
// risques par appartenance à la zone métallurgique réelle (classifieZone),
// sauf sigma qui reste un seuil Cr_eq (CLAUDE.md, spec.md §11/§12).
export function verdictSchaeffler(crEq, niEq, zones, overlays) {
  const p = [crEq, niEq];
  let niveau = "hors";
  if (pointDansPolygone(p, overlays.ideale.polygone)) niveau = "ideal";
  else if (pointDansPolygone(p, overlays.acceptable.polygone)) niveau = "acceptable";

  const zone = classifieZone(crEq, niEq, zones);
  const risques = [];
  if (zone === "A") risques.push("austenite_pure"); // fissuration à chaud
  if (zone && zone.includes("M")) risques.push("martensite"); // fissuration à froid
  if (crEq > 25) risques.push("sigma"); // fragilisation phase sigma
  if (zone === "F") risques.push("grossissement_grain"); // grain grossier en ferrite pure

  return { niveau, risques };
}
