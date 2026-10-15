// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// compteur.js - compteur de pied de page (GoatCounter, RGPD - DECISIONS.md #22).
// Affiche « X visiteurs » et, séparément, « Y analyses générées ».
// Partagé par toutes les pages. Aucune logique métier.
// =========================================================================

import { t } from "./i18n.js";
import { COMPTEUR_PAGE_VISIBLE } from "../core/config.js";

// Adresse GoatCounter réelle, derrière le proxy first-party /gc/.
// Sert uniquement de repli de lecture : voir urlsLecture().
const GOATCOUNTER_DIRECT = "https://soudabilite.goatcounter.com";

// Donne les adresses à essayer dans l'ordre pour lire un compteur.
// Le proxy first-party passe en premier (il traverse les bloqueurs de
// pub, DECISIONS.md #22). S'il est en panne - le 15/10/2026, la route
// /gc/* renvoyait HTTP 525 - l'appel direct prend le relais : un
// visiteur sans bloqueur voit le chiffre malgré la panne du proxy.
function urlsLecture(url) {
  if (!url) return [];
  const coupe = url.indexOf("/gc/");
  if (coupe === -1) return [url];
  return [url, GOATCOUNTER_DIRECT + url.slice(coupe + 3)];
}

// Un appel, avec expiration. Résout l'objet { count, count_unique }
// ou rejette (compte absent, accès non public, réseau, proxy en panne) :
// le rejet est ce qui permet à Promise.any de passer à l'autre adresse.
async function appel(url, expirationMs) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), expirationMs);
  try {
    const reponse = await fetch(url, { cache: "no-cache", signal: controleur.signal });
    if (!reponse.ok) throw new Error(String(reponse.status));
    return await reponse.json();
  } finally {
    clearTimeout(minuterie);
  }
}

// Lit un endpoint /counter/*.json de GoatCounter, en deux temps.
//   1. Le proxy first-party seul, avec une expiration courte. Tant qu'il
//      répond, aucune requête ne part vers goatcounter.com : le blocage
//      par nom de domaine reste contourné (DECISIONS.md #22).
//   2. S'il n'a pas répondu, les deux adresses en parallèle, et la
//      première qui aboutit l'emporte.
// Mesure du 15/10/2026 : la route /gc/* renvoyait HTTP 525 un appel sur
// deux. En série, l'attente cumulée dépassait souvent la patience du
// visiteur et le compteur restait vide ; en parallèle, le chiffre
// s'affiche dès qu'une des deux sources répond.
async function litCompteur(url) {
  const adresses = urlsLecture(url);
  if (adresses.length === 0) return null;

  try {
    return await appel(adresses[0], 3000);
  } catch (err) {
    // Le proxy n'a pas répondu : on élargit ci-dessous.
  }

  if (adresses.length === 1) return null;

  // Deux salves parallèles : la source qui vient d'échouer peut répondre
  // à l'essai suivant, la panne observée étant intermittente.
  for (let salve = 0; salve < 2; salve += 1) {
    try {
      return await Promise.any(adresses.map((adresse) => appel(adresse, 4000)));
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return null;
}

export async function rendreCompteur() {
  const cible = document.querySelector("[data-compteur]");
  if (!cible) return;

  // TOTAL est le chemin spécial fourni par GoatCounter pour le cumul global.
  // Il inclut automatiquement les nouvelles pages, sans liste à maintenir.
  const total = await litCompteur(t("footer.compteur_total_url"));
  const nb = total && total.count;
  if (nb != null) {
    cible.textContent = `${String(nb).trim()} ${t("footer.compteur_consultations")}`;
    cible.hidden = false;
  }
}

// Compteur dédié à l'événement « analyse-realisee » (émis par
// choisirApport() dans vue_analyse.js, à la sélection d'une ligne du
// tableau des 7 meilleurs apports) - même principe que rendreCompteur(),
// sur un élément distinct pour ne pas mélanger les deux mesures.
// Format figé : "<nombre> analyses générées".
export async function rendreCompteurAnalyses() {
  const cible = document.querySelector("[data-compteur-analyses]");
  if (!cible) return;

  const analyses = await litCompteur(t("footer.compteur_analyses_url"));

  const nb = analyses && analyses.count;
  if (nb != null) {
    cible.textContent = `${String(nb).trim()} ${t("footer.compteur_analyses")}`;
    cible.hidden = false;
  }
}

// Compteur de visiteurs uniques sur la page courante (page Présentation
// uniquement - élément absent des autres pages). Masqué tant que
// COMPTEUR_PAGE_VISIBLE (core/config.js) est à false : à activer plus
// tard sans autre changement de code.
export async function rendreCompteurPage() {
  if (!COMPTEUR_PAGE_VISIBLE) return;

  const cible = document.querySelector("[data-compteur-page]");
  if (!cible) return;

  const url = t("analytics.compteur_page_url_base") + encodeURIComponent(location.pathname) + ".json";
  const donnees = await litCompteur(url);

  const nb = donnees && (donnees.count_unique ?? donnees.count);
  if (nb != null) {
    cible.textContent = `${String(nb).trim()} ${t("analytics.compteur_page_libelle")}`;
    cible.hidden = false;
  }
}
