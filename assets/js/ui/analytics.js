// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// analytics.js - envoi centralisé des événements GoatCounter.
// Renvoie false si le script analytique est indisponible : aucune action
// utilisateur ne doit échouer à cause du suivi.
// =========================================================================

export function envoyerEvenement(path, titre) {
  if (!path || !window.goatcounter || typeof window.goatcounter.count !== "function") {
    return false;
  }

  window.goatcounter.count({
    path,
    title: titre,
    event: true,
    no_session: true,
  });
  return true;
}
