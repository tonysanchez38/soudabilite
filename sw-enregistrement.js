// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// sw-enregistrement.js - active le fonctionnement hors connexion.
// Chargé en fin de page sur toutes les pages publiées. Aucune logique
// métier, aucune donnée de l'utilisateur conservée (décision #6 : les
// calculs ne sont jamais sauvegardés, seuls les fichiers du site le sont).
// =========================================================================

(function () {
  if (!("serviceWorker" in navigator)) return;
  var local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !local) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {
      // Échec silencieux : le site reste pleinement utilisable en ligne.
    });
  });
})();
