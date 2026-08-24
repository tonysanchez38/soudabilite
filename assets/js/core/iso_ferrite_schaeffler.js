// Iso-ferrite du diagramme de Schaeffler, coordonnées (Cr_eq, Ni_eq).
// Les segments 0/5/10/20/40/80 sont digitalisés depuis la reproduction
// vectorielle du diagramme historique référencée dans spec.md §3.2.
// 15 % est l'interpolation géométrique à mi-distance entre 10 et 20 %.

function pointsSegment([x0, y0], [x1, y1]) {
  const points = [[x0, y0]];
  for (let x = Math.ceil(x0); x <= Math.floor(x1); x += 1) {
    if (x === x0 || x === x1) continue;
    points.push([x, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)]);
  }
  points.push([x1, y1]);
  return points;
}

const LIGNES_SOURCE = [
  { pct: 0, points: pointsSegment([6.45, 0], [33.35, 28]), origine: "digitalisee" },
  { pct: 5, points: pointsSegment([15.02, 7.38], [35.86, 28]), origine: "digitalisee" },
  { pct: 10, points: pointsSegment([15.55, 6.97], [35.94, 24.50]), origine: "digitalisee" },
  { pct: 20, points: pointsSegment([16.63, 6.14], [35.97, 20.15]), origine: "digitalisee" },
  { pct: 40, points: pointsSegment([17.56, 5.39], [36.00, 17.18]), origine: "digitalisee" },
  { pct: 80, points: pointsSegment([18.73, 4.43], [35.97, 12.94]), origine: "digitalisee" },
];

export function ordonneeIso(ligne, crEq) {
  const points = ligne?.points || [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (crEq >= x0 && crEq <= x1) {
      if (x1 === x0) return (y0 + y1) / 2;
      return y0 + ((crEq - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return null;
}

function ligneInterpolee(pct, basse, haute) {
  const points = [];
  const xMin = Math.ceil(Math.max(basse.points[0][0], haute.points[0][0]));
  const xMax = Math.floor(Math.min(basse.points.at(-1)[0], haute.points.at(-1)[0]));
  for (let cr = xMin; cr <= xMax; cr += 1) {
    const y0 = ordonneeIso(basse, cr);
    const y1 = ordonneeIso(haute, cr);
    points.push([cr, y0 + ((pct - basse.pct) / (haute.pct - basse.pct)) * (y1 - y0)]);
  }
  return { pct, points, origine: "interpolation_10_20" };
}

const dix = LIGNES_SOURCE.find((l) => l.pct === 10);
const vingt = LIGNES_SOURCE.find((l) => l.pct === 20);

export const ISO_FERRITE_SCHAEFFLER = [
  ...LIGNES_SOURCE.filter((l) => l.pct < 15),
  ligneInterpolee(15, dix, vingt),
  ...LIGNES_SOURCE.filter((l) => l.pct > 15),
];

export function ligneIso(pct) {
  return ISO_FERRITE_SCHAEFFLER.find((l) => l.pct === pct) || null;
}

// Polyligne échantillonnée sur une plage, utile au rendu des bandes.
export function echantillonneIso(pct, crMin, crMax, pas = 0.25) {
  const ligne = ligneIso(pct);
  if (!ligne) return [];
  const debut = Math.max(crMin, ligne.points[0][0]);
  const fin = Math.min(crMax, ligne.points.at(-1)[0]);
  const points = [];
  for (let cr = debut; cr <= fin + 1e-9; cr += pas) {
    const ni = ordonneeIso(ligne, Math.min(cr, fin));
    if (ni != null) points.push([Math.min(cr, fin), ni]);
  }
  return points;
}
