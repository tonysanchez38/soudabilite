// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// selection_apport_carbone.js - sélection du métal d'apport en branche
// carbone/thermique, par isorésistance (NF EN ISO 2560-A) : l'apport doit
// égaler ou dépasser légèrement la limite élastique du métal de base le
// plus faible, jamais s'en approcher par en dessous. Ne remplace pas
// Schaeffler - s'applique uniquement quand l'aiguillage (core/aiguillage.js)
// a orienté vers la branche thermique.
//
// Parqué comme le drapeau DUPLEX_VISIBLE (cf. CLAUDE.md #29) : présent,
// documenté, sans effet tant que data.json ne contient aucune entrée
// metaux_apport de type carbone. Les 218 entrées actuelles sont toutes
// inox (SAFINOX/STARINOX/...), sans champs type/re/typeElectrode/
// classeHydrogene/diametre - filtrerApportsCarbone() renvoie donc [] sur
// la banque réelle aujourd'hui, et selectionnerApportCarbone() répond par
// un statut explicite plutôt qu'un tableau vide silencieux.
// =========================================================================

// Champs attendus sur une future entrée metaux_apport carbone - A
// CONFIRMER AVEC TONY avant que la banque ne les porte réellement : noms
// de travail, pas une lecture du fichier réel.
//
// typeElectrode et classeHydrogene sont deux variables indépendantes :
// typeElectrode pilote le choix Séférian/BWRA (structure de l'enrobage,
// cf. choisirMethodePreachauffe dans prechauffe.js), classeHydrogene
// alimente uniquement la correction CEQ NF EN 1011-2 (Méthode A/B).
// Aucune déduction de l'un à partir de l'autre. Convention de valeur
// alignée sur l'UI existante (ex. { value: "R", label: "Rutile (R)" },
// { value: "B", label: "Basique (B)" }).
export const CHAMPS_APPORT_CARBONE = {
  type: "type", // 'carbone' vs 'inox'
  re: "re", // limite élastique en MPa
  typeElectrode: "typeElectrode", // 'R' (rutile) ou 'B' (basique) - pilote BWRA
  classeHydrogene: "classeHydrogene", // ex. 'H5', 'H10' - pilote la correction CEQ
  procede: "procede",
  diametre: "diametre",
};

// Filtre les entrées carbone compatibles avec le procédé/type d'électrode/
// diamètre déjà choisis dans Paramètres.
export function filtrerApportsCarbone(baseConsommables, procede, typeElectrode, diametre) {
  return (baseConsommables || []).filter((c) => {
    const estCarbone = c[CHAMPS_APPORT_CARBONE.type] === "carbone";
    const memeProcede = c[CHAMPS_APPORT_CARBONE.procede] === procede;
    const memeElectrode =
      typeElectrode == null || c[CHAMPS_APPORT_CARBONE.typeElectrode] === typeElectrode;
    const memeDiametre = diametre == null || c[CHAMPS_APPORT_CARBONE.diametre] === diametre;
    return estCarbone && memeProcede && memeElectrode && memeDiametre;
  });
}

// Isorésistance NF EN ISO 2560-A : ne garde que les apports qui égalent ou
// dépassent le Re minimal des deux métaux de base, triés du plus proche au
// plus surdimensionné.
export function classerParIsoresistance(candidats, reMetalA, reMetalB) {
  const reMin = Math.min(reMetalA, reMetalB);
  return candidats
    .map((c) => ({ apport: c, ecart: c[CHAMPS_APPORT_CARBONE.re] - reMin }))
    .filter((x) => x.ecart >= 0)
    .sort((a, b) => a.ecart - b.ecart);
}

// Point d'entrée appelé depuis la carte Analyse thermique. Ne lève jamais
// d'exception : en l'absence de données, renvoie un statut explicite
// plutôt qu'un tableau vide silencieux (cf. CLAUDE.md #31, "pas de verdict
// plutôt qu'un verdict faux").
export function selectionnerApportCarbone(
  baseConsommables,
  procede,
  typeElectrode,
  diametre,
  reMetalA,
  reMetalB
) {
  if (reMetalA == null || reMetalB == null) {
    return {
      statut: "donnees_manquantes",
      message:
        "Limite élastique (Re) non renseignée pour un des deux métaux de base. Sélection d'apport impossible tant que cette donnée n'est pas complétée.",
    };
  }

  const candidats = filtrerApportsCarbone(baseConsommables, procede, typeElectrode, diametre);
  if (candidats.length === 0) {
    return {
      statut: "base_incomplete",
      message:
        "Aucun métal d'apport carbone référencé pour ce procédé et ce type d'électrode dans la base actuelle. Fonctionnalité en attente d'enrichissement de la base de consommables.",
    };
  }

  const classes = classerParIsoresistance(candidats, reMetalA, reMetalB);
  if (classes.length === 0) {
    return {
      statut: "aucun_compatible",
      message: "Aucun apport disponible n'atteint la limite élastique requise pour ce couple de métaux de base.",
    };
  }

  const retenu = classes[0].apport;
  return {
    statut: "ok",
    apport: retenu,
    typeElectrode: retenu[CHAMPS_APPORT_CARBONE.typeElectrode] ?? null,
    classeHydrogene: retenu[CHAMPS_APPORT_CARBONE.classeHydrogene] ?? null,
  };
}
