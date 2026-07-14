// soudabilite.com — Tony SANCHEZ — TS-SDB-2026
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

// Suggestion de dilution par défaut selon procédé/assemblage/chanfrein.
// Valeur indicative de préparation DMOS — pas une mesure : la précision
// réelle nécessite une macrographie de l'assemblage réel.
const PLAGES_DILUTION = {
  "111": [0.10, 0.35],
  "141": [0.15, 0.30],
  "131": [0.20, 0.40],
  "135": [0.20, 0.40],
};

export function dilutionParDefaut(procede, assemblage, chanfrein) {
  const [min, max] = PLAGES_DILUTION[procede] || [0.15, 0.30];
  // Bords droits = peu de vide à combler = dilution totale haute.
  // Chanfreinés (V/Y/X/demi-V) = dilution totale basse.
  const totale = chanfrein === "droit" ? max : min;
  let dA, dB;
  if (assemblage === "FW") {
    // Angle intérieur : répartition asymétrique (gravité). Convention :
    // A = pièce posée à plat (2/3), B = pièce dressée (1/3). À signaler
    // en tooltip UI pour que l'utilisateur sache inverser si besoin.
    dA = totale * (2 / 3);
    dB = totale * (1 / 3);
  } else {
    // Bout à bout : répartition symétrique.
    dA = totale / 2;
    dB = totale / 2;
  }
  return { dA: dA * 100, dB: dB * 100, dC: (1 - totale) * 100 };
}
