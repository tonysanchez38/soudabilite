// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// bwra.js - méthode BWRA (British Welding Research Association) de
// préchauffe pour aciers au carbone/faiblement alliés soudés à
// l'électrode enrobée (111). Réf. doc « Méthodes de préchauffe », Tony.
// Fonctions pures.
// =========================================================================

export const CEQ_INDICE_TABLE = {
  rutile: [[0, 0.20, "A"], [0.21, 0.23, "B"], [0.24, 0.27, "C"], [0.28, 0.32, "D"], [0.33, 0.38, "E"], [0.39, 0.45, "F"], [0.45, Infinity, "G"]],
  basique: [[0, 0.25, "A"], [0.26, 0.30, "B"], [0.31, 0.35, "C"], [0.36, 0.40, "D"], [0.41, 0.45, "E"], [0.46, 0.50, "F"], [0.50, Infinity, "G"]],
};

// Carbone équivalent BWRA - Ceq = %C + %Mn/20 + %Ni/15 + (%Cr + %Mo + %V)/10
export function ceqBWRA(comp) {
  const v = (e) => Number(comp?.[e]) || 0;
  return v("C") + v("Mn") / 20 + v("Ni") / 15 + (v("Cr") + v("Mo") + v("V")) / 10;
}

// TSN (Total Section Number) = somme des épaisseurs des pièces du joint / 6.
export function tsn(epaisseurs) {
  return epaisseurs.reduce((s, e) => s + Number(e || 0), 0) / 6;
}

// Indice de soudabilité (lettre A-G) par tranche de Ceq, selon le type
// d'électrode (rutile ou basique - seules distinctions couvertes par la
// table BWRA source).
export function indiceSoudabilite(ceq, typeElectrode) {
  const table = CEQ_INDICE_TABLE[typeElectrode] || CEQ_INDICE_TABLE.basique;
  for (const [min, max, lettre] of table) if (ceq > min && ceq <= max) return lettre;
  return table[0][2];
}

// Table TSN x indice -> Tp par diamètre (3.2/4/5/6/8), digitalisée depuis
// le support de cours BTS CRCI de Tony (page 10). ATTENTION : validée sur
// 6 cellules précises contre les exemples corrigés du cours (TSN4-F,
// TSN6-F, TSN16-A, TSN16/24-D). Les autres cellules sont à vérifier
// visuellement par Tony au premier test contre le tableau original.
export const TABLE_BWRA_TP = {
  2: { D: [75], E: [125, 25], F: [null] },
  3: { C: [75], D: [100, 25], E: [150, 100], F: [null] },
  4: { D: [25], E: [50], F: [175, 125, 75] },
  6: { B: [25], C: [50], D: [100, 75], E: [125], F: [225, 175, 75] },
  8: { A: [25], B: [75], C: [125, 25], D: [175, 75], E: [200, 150, 25], F: [225, 175, 125, 50] },
  12: { A: [75], B: [125, 75, 25], C: [150, 125, 75], D: [175, 125, 100], E: [200, 175, 125, 50], F: [225, 200, 175, 125, 25] },
  16: { A: [75], B: [125, 75, 25], C: [150, 125, 75], D: [175, 150, 125, 75], E: [200, 175, 150, 100], F: [225, 200, 175, 150, 125] },
  24: { A: [75], B: [125, 75, 25], C: [175, 150, 125, 75], D: [175, 150, 125], E: [225, 200, 175, 150, 100], F: [250, 225, 200, 175, 150] },
};

// Interpole entre les deux TSN encadrant la valeur réelle, colonne
// diamètre. Renvoie null (dégourdissement/pas de préchauffe) si absent.
export function tpBWRA(ceq, typeElectrode, epaisseurs, diametreElectrode) {
  const indice = indiceSoudabilite(ceq, typeElectrode);
  const t = tsn(epaisseurs);
  const paliers = Object.keys(TABLE_BWRA_TP).map(Number).sort((a, b) => a - b);
  const diamIdx = [3.2, 4, 5, 6, 8].indexOf(Number(diametreElectrode));
  const lireCell = (palier) => {
    const row = TABLE_BWRA_TP[palier]?.[indice];
    return row ? (row[diamIdx] ?? null) : null;
  };
  let lo = paliers.filter((p) => p <= t).pop();
  let hi = paliers.filter((p) => p >= t)[0];
  if (lo == null) lo = hi;
  if (hi == null) hi = lo;
  const vLo = lireCell(lo), vHi = lireCell(hi);
  if (vLo == null && vHi == null) return { valeur: 25, note: "dégourdissement (hors tableau, indice/TSN faibles)", indice, tsn: t };
  if (vLo == null) return { valeur: vHi, note: `TSN=${hi} indice=${indice}`, indice, tsn: t };
  if (vHi == null) return { valeur: vLo, note: `TSN=${lo} indice=${indice}`, indice, tsn: t };
  const valeur = lo === hi ? vLo : ((vHi - vLo) / 2) + vLo;
  return { valeur, note: `interpolé entre TSN=${lo}(${vLo}) et TSN=${hi}(${vHi}), indice=${indice}`, indice, tsn: t };
}
