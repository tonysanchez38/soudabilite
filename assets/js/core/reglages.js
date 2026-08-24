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

// Conserve l'identité Q = k·U·I·60/(Vs·10000), avec Q en kJ/mm et Vs
// en cm/min. Une énergie saisie résout Vs ; aucun coefficient nouveau.
export function propagerReglages(valeurs, cleModifiee, valeur, k) {
  const next = { ...valeurs, [cleModifiee]: Number(valeur) };
  const eta = Number(k);
  const I = Number(next.intensite);
  const U = Number(next.tension);

  if (cleModifiee === "energieNominale") {
    const En = Number(next.energieNominale);
    next.vitesse = I > 0 && U > 0 && En > 0 ? (U * I * 60) / (En * 10000) : null;
    next.energieCorrigee = Number.isFinite(eta) && En > 0 ? eta * En : null;
    return next;
  }
  if (cleModifiee === "energieCorrigee") {
    const Q = Number(next.energieCorrigee);
    const En = eta > 0 && Q > 0 ? Q / eta : null;
    next.energieNominale = En;
    next.vitesse = I > 0 && U > 0 && En > 0 ? (U * I * 60) / (En * 10000) : null;
    return next;
  }

  const Vs = Number(next.vitesse);
  const En = I > 0 && U > 0 && Vs > 0 ? (U * I * 60) / (Vs * 10000) : null;
  next.energieNominale = En;
  next.energieCorrigee = En != null && Number.isFinite(eta) ? eta * En : null;
  return next;
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

// Acier/inox/hétérogène : DCEN. Cérié aux faibles/moyens courants,
// lanthané aux moyens/forts ; diamètre contraint par la plage de la banque.
export function recommanderTungstene(electrodes, contexte = {}) {
  const candidats = candidatsTungstene(electrodes, contexte);
  if (candidats.length === 0) return null;
  const preferences = Number(contexte.intensite) <= 150
    ? ["WC20", "WL20", "WL15", "WR"]
    : ["WL20", "WL15", "WR", "WC20"];
  const rangType = (e) => {
    const designation = String(e.designation || "").toUpperCase();
    const rang = preferences.findIndex((type) => designation.startsWith(type));
    return rang < 0 ? preferences.length : rang;
  };
  return [...candidats].sort((a, b) => rangType(a) - rangType(b) || a.diametre_mm - b.diametre_mm)[0];
}
