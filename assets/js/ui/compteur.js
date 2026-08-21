// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// compteur.js - compteur de pied de page (GoatCounter, RGPD - CLAUDE.md #22).
// Affiche « X visiteurs » et, séparément, « Y analyses générées ».
// Partagé par toutes les pages. Aucune logique métier.
// =========================================================================

import { t } from "./i18n.js";
import { COMPTEUR_PAGE_VISIBLE } from "../core/config.js";

// Lit un endpoint /counter/*.json de GoatCounter. Renvoie l'objet
// { count, count_unique } ou null si indisponible (compte absent, accès
// non public, réseau) - dans ce cas on n'affiche simplement rien.
async function litCompteur(url) {
  if (!url) return null;
  for (let tentative = 0; tentative < 2; tentative += 1) {
    const controleur = new AbortController();
    const expiration = setTimeout(() => controleur.abort(), 4000);
    try {
      const reponse = await fetch(url, {
        cache: "no-cache",
        signal: controleur.signal,
      });
      if (reponse.ok) return await reponse.json();
    } catch (err) {
      // Une seconde tentative est effectuée ci-dessous.
    } finally {
      clearTimeout(expiration);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
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
