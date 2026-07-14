// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// energie.js - paramètres électriques et énergie de soudage.
// Réf. spec.md §3 (intensité, tension par procédé) et §4 (énergie).
// Fonctions pures. Procédés désignés par leur code ISO 4063.
// =========================================================================

// Codes procédés (ISO 4063) manipulés par l'application.
export const PROCEDES = {
  EE: "111", // électrode enrobée
  TIG: "141",
  MIG: "131",
  MAG: "135",
};

// Rendement thermique k (η) par procédé - spec.md §4.2 (NF EN 1011-1).
export const RENDEMENTS = {
  "141": 0.6, // TIG
  "15": 0.6, // Plasma
  "111": 0.8, // EE
  "131": 0.8, // MIG
  "135": 0.8, // MAG
  "136": 0.8, // FCW
  "121": 1.0, // SAW
};

// Vitesses de soudage indicatives (cm/min) par procédé - spec.md §3.1-3.3.
// Ce ne sont pas des formules : valeur par défaut = milieu de plage, ajustable.
export const VITESSE_INDICATIVE = {
  "111": { min: 15, max: 25, defaut: 20 },
  "141": { min: 8, max: 15, defaut: 12 },
  "131": { min: 25, max: 45, defaut: 35 },
  "135": { min: 25, max: 45, defaut: 35 },
};

// --- Intensité électrode enrobée (111) - spec.md §3.1 + CLAUDE.md #21 -----
// Trois cas (les 5 cas conservés s'y ramènent), positions EN ISO 6947 :
//   Plat (PA / PB bout à bout) :                 I = 50·(∅ − 1)
//   Angle intérieur (assemblage FW) :            I = 60·(∅ − 1)
//   Hors position (PC/PD/PE/PF/PG/H-L045) :      I = 40·(∅ − 1)
const POSITIONS_REDUITES = ["PC", "PD", "PE", "PF", "PG", "H-L045"];

export function intensiteEE(diametre, { position = "PA", assemblage = "BW" } = {}) {
  const d = Number(diametre) || 0;
  let coef;
  if (POSITIONS_REDUITES.includes(position)) {
    coef = 40; // corniche / plafond / montante / descendante / inclinée
  } else if (assemblage === "FW") {
    coef = 60; // soudure d'angle à plat / horizontale
  } else {
    coef = 50; // à plat, bout à bout
  }
  return coef * (d - 1);
}

// --- Intensité TIG (141) - spec.md §3.2 ---------------------------------
// Acier ferritique : I ≈ 30·e (e en mm).
// Dès qu'au moins une base est inox (cas "inox" ou "heterogene") : I ≈ 25·e
// - on retient la valeur la plus basse pour protéger le côté inox.
// Bonus +5 A/mm en angle (assemblage FW) : acier 30→35, inox/hétérogène
// 25→30 (plus de métal à fondre en configuration d'angle).
export function intensiteTIG(epaisseur, matiere = "ferritique", assemblage = "BW") {
  const e = Number(epaisseur) || 0;
  let coef = matiere === "ferritique" ? 30 : 25;
  if (assemblage === "FW") coef += 5;
  return coef * e;
}

// --- Tension par procédé - spec.md §3.1 / §3.2 / §3.3 -------------------
export function tension(procede, I) {
  const i = Number(I) || 0;
  switch (procede) {
    case "111": // EE : U = 20 + 0.04·I
      return 20 + 0.04 * i;
    case "141": // TIG : U = 10 + 0.04·I (plafonnée ~34 V)
      return Math.min(10 + 0.04 * i, 34);
    case "131": // MIG : U = 14 + 0.05·I
    case "135": // MAG : idem
      return 14 + 0.05 * i;
    default:
      return 0;
  }
}

// --- Énergie nominale - spec.md §4.1 ------------------------------------
// E_n (kJ/cm) = (U · I · 60) / (V_s · 1000), U en V, I en A, V_s en cm/min.
// Renvoie aussi la valeur en kJ/mm (÷10), unité utilisée par la thermique.
export function energieNominale(U, I, Vs) {
  const u = Number(U) || 0;
  const i = Number(I) || 0;
  const vs = Number(Vs) || 0;
  if (vs <= 0) return { kJ_cm: 0, kJ_mm: 0 };
  const kJ_cm = (u * i * 60) / (vs * 1000);
  return { kJ_cm, kJ_mm: kJ_cm / 10 };
}

// --- Énergie corrigée par le rendement - spec.md §4.2 -------------------
// E_q = k · E_n. Renvoie la valeur dans la même unité que En fournie.
export function rendement(procede) {
  return RENDEMENTS[procede] ?? 1;
}
export function energieCorrigee(En, procede) {
  return (Number(En) || 0) * rendement(procede);
}
