// Contrats préparatoires des réglages AUTO / PERSONNALISÉ.
// Ce module ne contient aucun coefficient de soudage : il transporte des
// valeurs calculées par les modules métier et mémorise les surcharges.

export const MODE_REGLAGES = Object.freeze({ AUTO: "auto", PERSONNALISE: "personnalise" });

export function creerReglagesAuto(valeurs) {
  return { mode: MODE_REGLAGES.AUTO, auto: { ...valeurs }, surcharges: {} };
}

export function personnaliserReglage(etat, cle, valeur) {
  return {
    ...etat,
    mode: MODE_REGLAGES.PERSONNALISE,
    surcharges: { ...etat.surcharges, [cle]: valeur },
  };
}

export function valeursEffectives(etat) {
  return { ...etat.auto, ...etat.surcharges };
}

// Présélection TIG prudente : plage d'intensité obligatoire ; matière et
// polarité ne filtrent que si la banque porte explicitement ces métadonnées.
// En leur absence, aucun type de tungstène n'est préféré artificiellement.
export function candidatsTungstene(electrodes, { intensite, matiere, polarite } = {}) {
  const i = Number(intensite);
  if (!Number.isFinite(i)) return [];
  return (electrodes || [])
    .filter((e) => {
      const plage = String(e.plage_courant_A || "").match(/([0-9.]+)\s*-\s*([0-9.]+)/);
      if (!plage || i < Number(plage[1]) || i > Number(plage[2])) return false;
      if (e.matieres?.length && matiere && !e.matieres.includes(matiere)) return false;
      if (e.polarites?.length && polarite && !e.polarites.includes(polarite)) return false;
      return true;
    })
    .sort((a, b) => a.diametre_mm - b.diametre_mm);
}
