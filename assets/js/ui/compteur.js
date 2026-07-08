// =========================================================================
// compteur.js — compteur de pied de page (GoatCounter, RGPD — CLAUDE.md #22).
// Affiche « X visiteurs — Y calculs réalisés » de façon discrète.
// Partagé par toutes les pages. Aucune logique métier.
// L'événement « calcul » sera émis à l'étape 8 (synthèse) ; ici, lecture seule.
// =========================================================================

import { t } from "./i18n.js";

// Lit un endpoint /counter/*.json de GoatCounter. Renvoie l'objet
// { count, count_unique } ou null si indisponible (compte absent, accès
// non public, réseau) — dans ce cas on n'affiche simplement rien.
async function litCompteur(url) {
  if (!url) return null;
  try {
    const reponse = await fetch(url, { cache: "no-cache" });
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch (err) {
    return null;
  }
}

export async function rendreCompteur() {
  const cible = document.querySelector("[data-compteur]");
  if (!cible) return;

  const [visites, calculs] = await Promise.all([
    litCompteur(t("footer.compteur_total_url")),
    litCompteur(t("footer.compteur_calcul_url")),
  ]);

  const morceaux = [];

  const nbVisiteurs = visites && (visites.count_unique ?? visites.count);
  if (nbVisiteurs != null) {
    morceaux.push(`${String(nbVisiteurs).trim()} ${t("footer.compteur_visiteurs")}`);
  }

  const nbCalculs = calculs && calculs.count;
  if (nbCalculs != null) {
    morceaux.push(`${String(nbCalculs).trim()} ${t("footer.compteur_calculs")}`);
  }

  if (morceaux.length > 0) {
    cible.textContent = morceaux.join(" — ");
    cible.hidden = false;
  }
}
