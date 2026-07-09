// =========================================================================
// etat_dmos.js — pont de session entre Paramètres DMOS et Analyse.
// sessionStorage uniquement : vidé à la fermeture de l'onglet (aucune
// persistance archivée — cohérent avec CLAUDE.md #6). Sert à transmettre
// les sélections de Paramètres à l'onglet Analyse dans la même session.
// =========================================================================

const CLE = "soudabilite:dmos";

export function sauverEtat(etat) {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(etat));
  } catch (err) {
    // sessionStorage indisponible (mode privé strict) : on ignore.
  }
}

export function chargerEtat() {
  try {
    const brut = sessionStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch (err) {
    return null;
  }
}

export function effacerEtat() {
  try {
    sessionStorage.removeItem(CLE);
  } catch (err) {
    /* rien */
  }
}
