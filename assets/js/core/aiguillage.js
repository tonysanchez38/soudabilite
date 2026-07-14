// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// aiguillage.js - choix de la branche d'analyse selon les métaux de base.
// Réf. CLAUDE.md décision #2 (seuils indicatifs d'aiguillage).
// Fonctions pures.
//   - Cr ≥ 10.5 % OU Ni ≥ 8 %                → métal inox (branche Schaeffler)
//   - sinon                                  → carbone / faiblement allié
//   - un inox + un carbone                   → hétérogène (deux branches)
// =========================================================================

function v(comp, element) {
  const x = comp ? comp[element] : 0;
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

// Un métal est-il inoxydable au sens des seuils d'aiguillage ?
export function estInox(comp) {
  return v(comp, "Cr") >= 10.5 || v(comp, "Ni") >= 8;
}

// Classe un métal isolé : "inox" ou "carbone".
export function classeMetal(comp) {
  return estInox(comp) ? "inox" : "carbone";
}

// Détermine la branche pour un assemblage A + B.
// Renvoie : "inox" | "carbone" | "heterogene" et les branches actives.
export function aiguille(A, B) {
  const a = classeMetal(A);
  const b = classeMetal(B);

  if (a === "inox" && b === "inox") {
    return { type: "inox", branches: ["schaeffler"] };
  }
  if (a === "carbone" && b === "carbone") {
    return { type: "carbone", branches: ["thermique"] };
  }
  // Un inox + un carbone : les deux branches en parallèle (verdict croisé).
  return { type: "heterogene", branches: ["schaeffler", "thermique"] };
}

// Pour l'intensité TIG (spec.md §3.2), matière = "inox", "ferritique" ou
// "heterogene" (une base inox + une base carbone). L'intensité de chaque cas
// est définie dans energie.intensiteTIG.
export function matiereTIG(A, B) {
  const a = classeMetal(A);
  const b = classeMetal(B);
  if (a === "inox" && b === "inox") return "inox";
  if (a === "carbone" && b === "carbone") return "ferritique";
  return "heterogene";
}
