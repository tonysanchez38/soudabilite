// =========================================================================
// dilution.js — chimie du bain fondu par dilution.
// Réf. spec.md §2 (composition du JOINT, point intermédiaire D_mélange).
// Vocabulaire (CLAUDE.md) : D_A, D_B = contributions des métaux de base
// fondus au bain ; D_C = fraction d'apport dans le bain. D_A+D_B+D_C = 1.
// Fonctions pures : renvoient de nouveaux objets composition.
// =========================================================================

// Éléments suivis (spec.md §2.1).
export const ELEMENTS = ["C", "Mn", "Si", "Cr", "Ni", "Mo", "Nb", "N", "Cu", "Ti"];

function v(comp, element) {
  const x = comp ? comp[element] : 0;
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

// Point intermédiaire D_mélange — métaux de base seuls, avant apport.
// spec.md §2.2 : %x = (D_A·%x_A + D_B·%x_B) / (D_A + D_B)
export function melangeBases(A, B, dA, dB) {
  const somme = dA + dB;
  const out = {};
  for (const e of ELEMENTS) {
    out[e] = somme > 0 ? (dA * v(A, e) + dB * v(B, e)) / somme : 0;
  }
  return out;
}

// Composition du JOINT — barycentre pondéré des deux bases et de l'apport.
// spec.md §2.1 : %x_JOINT = D_A·%x_A + D_B·%x_B + D_C·%x_C
export function joint(A, B, C, dA, dB, dC) {
  const out = {};
  for (const e of ELEMENTS) {
    out[e] = dA * v(A, e) + dB * v(B, e) + dC * v(C, e);
  }
  return out;
}

// Vérifie que les fractions somment à 1 (à la tolérance près).
export function dilutionValide(dA, dB, dC, tolerance = 1e-6) {
  return Math.abs(dA + dB + dC - 1) <= tolerance;
}
