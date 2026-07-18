// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// carbone_eq.js - carbone équivalent.
// Réf. spec.md §5 (CE_IIW §5.1, CET EN 1011-2 §5.2, Séférian §5.3).
// Fonctions pures. Composition en % massique ; éléments absents → 0.
// =========================================================================

function v(comp, element) {
  const x = comp ? comp[element] : 0;
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

// CE_IIW (IIW Doc IX-535-67) - spec.md §5.1
// CE = %C + %Mn/6 + (%Cr + %Mo + %V)/5 + (%Ni + %Cu)/15
export function ceIIW(comp) {
  return (
    v(comp, "C") +
    v(comp, "Mn") / 6 +
    (v(comp, "Cr") + v(comp, "Mo") + v(comp, "V")) / 5 +
    (v(comp, "Ni") + v(comp, "Cu")) / 15
  );
}

// CET (EN 1011-2 Méthode B) - spec.md §5.2
// CET = %C + (%Mn + %Mo)/10 + (%Cr + %Cu)/20 + %Ni/40
export function cet(comp) {
  return (
    v(comp, "C") +
    (v(comp, "Mn") + v(comp, "Mo")) / 10 +
    (v(comp, "Cr") + v(comp, "Cu")) / 20 +
    v(comp, "Ni") / 40
  );
}

// Carbone équivalent Séférian - spec.md §5.3
// Ceq = %C + (%Mn + %Cr)/9 + %Ni/18 + 7·%Mo/90
// Formule propre à Séférian, distincte de CE_IIW (§5.1) - à ne pas confondre.
export function ceqSeferian(comp) {
  return (
    v(comp, "C") +
    (v(comp, "Mn") + v(comp, "Cr")) / 9 +
    v(comp, "Ni") / 18 +
    (7 * v(comp, "Mo")) / 90
  );
}

// Correction d'épaisseur générique - spec.md §5.3 (mécanisme Séférian :
// Ceq_compensé = Ceq_base · (1 + 0.005·e), e en mm). Réutilisable pour
// toute méthode dont la compensation suit ce modèle multiplicatif -
// PAS le mécanisme BWRA (core/bwra.js), qui compense l'épaisseur via
// TSN comme axe séparé d'une table, pas par un facteur sur Ceq.
export function corrigerParEpaisseur(ceqBase, epaisseur) {
  const e = Number.isFinite(Number(epaisseur)) ? Number(epaisseur) : 0;
  return ceqBase * (1 + 0.005 * e);
}

// Ceq Séférian compensé épaisseur - spec.md §5.3
export function ceqSeferianCompense(comp, epaisseur) {
  return corrigerParEpaisseur(ceqSeferian(comp), epaisseur);
}

// Préchauffe Séférian - spec.md §6.2
// T_p (°C) = 350 · √(Ceq_compensé − 0.25), valide si Ceq_compensé > 0.25.
// null = pas de préchauffe requis par cette méthode.
export function tpSeferian(ceqCompense) {
  const x = ceqCompense - 0.25;
  return x > 0 ? 350 * Math.sqrt(x) : null;
}
