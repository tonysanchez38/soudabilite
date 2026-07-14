// soudabilite.com — Tony SANCHEZ — TS-SDB-2026
// =========================================================================
// equivalents.js — équivalents en chrome et en nickel.
// Réf. spec.md §1 (Schaeffler 1949, DeLong 1974, WRC-1992).
// Fonctions pures. La composition est un objet { C, Mn, Si, Cr, Ni, Mo,
// Nb, N, Cu, Ti } en % massique ; toute valeur absente ou null vaut 0.
// =========================================================================

// Lecture sûre d'un élément (null / undefined / "" → 0).
function v(comp, element) {
  const x = comp ? comp[element] : 0;
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

// --- Schaeffler (1949) — spec.md §1.1 -----------------------------------
// Cr_eq = %Cr + %Mo + 1.5·%Si + 0.5·%Nb
export function crEqSchaeffler(comp) {
  return v(comp, "Cr") + v(comp, "Mo") + 1.5 * v(comp, "Si") + 0.5 * v(comp, "Nb");
}
// Ni_eq = %Ni + 30·%C + 0.5·%Mn
export function niEqSchaeffler(comp) {
  return v(comp, "Ni") + 30 * v(comp, "C") + 0.5 * v(comp, "Mn");
}

// --- DeLong (1974) — spec.md §1.2 ---------------------------------------
// Cr_eq identique à Schaeffler ; Ni_eq ajoute l'azote (30·%N).
export function crEqDeLong(comp) {
  return crEqSchaeffler(comp);
}
export function niEqDeLong(comp) {
  return v(comp, "Ni") + 30 * v(comp, "C") + 30 * v(comp, "N") + 0.5 * v(comp, "Mn");
}

// --- WRC-1992 — spec.md §1.3 --------------------------------------------
// Cr_eq = %Cr + %Mo + 0.7·%Nb
export function crEqWRC(comp) {
  return v(comp, "Cr") + v(comp, "Mo") + 0.7 * v(comp, "Nb");
}
// Ni_eq = %Ni + 35·%C + 20·%N + 0.25·%Cu
export function niEqWRC(comp) {
  return v(comp, "Ni") + 35 * v(comp, "C") + 20 * v(comp, "N") + 0.25 * v(comp, "Cu");
}

// Renvoie les trois jeux d'équivalents pour une composition donnée.
export function equivalents(comp) {
  return {
    Schaeffler: { Cr_eq: crEqSchaeffler(comp), Ni_eq: niEqSchaeffler(comp) },
    DeLong: { Cr_eq: crEqDeLong(comp), Ni_eq: niEqDeLong(comp) },
    WRC_1992: { Cr_eq: crEqWRC(comp), Ni_eq: niEqWRC(comp) },
  };
}
