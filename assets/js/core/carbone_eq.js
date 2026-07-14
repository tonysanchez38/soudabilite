// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// carbone_eq.js - carbone équivalent.
// Réf. spec.md §5 (CE_IIW §5.1, CET EN 1011-2 §5.2, Séférian compensé §5.3).
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

// Carbone équivalent Séférian compensé épaisseur - spec.md §5.3
// CE_compensé = CE_IIW · (1 + 0.005·e), e en mm.
export function ceCompenseSeferian(comp, epaisseur) {
  const e = Number.isFinite(Number(epaisseur)) ? Number(epaisseur) : 0;
  return ceIIW(comp) * (1 + 0.005 * e);
}
