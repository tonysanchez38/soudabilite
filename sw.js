// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// sw.js - service worker : fonctionnement hors connexion du site et de
// l'application Android.
//
// Aucune logique métier ici. Ce fichier ne lit, ne calcule et ne modifie
// aucune donnée métallurgique : il se contente de garder une copie des
// fichiers publiés pour les resservir quand le réseau manque.
//
// Trois règles de service :
//  1. Pages HTML : réseau d'abord (contenu toujours frais en ligne),
//     copie locale si le réseau ne répond pas dans le délai.
//  2. Fichiers versionnés (?v=... ou CDN avec numéro de version) :
//     copie locale d'abord, le numéro garantit qu'elle est à jour.
//  3. Fichiers non versionnés (data.json, modules JS, i18n) : réseau
//     d'abord, copie locale en repli. Évite tout mélange d'anciennes et
//     de nouvelles versions des modules de calcul.
// Les compteurs de visite (GoatCounter, Cloudflare) ne sont jamais mis
// en cache : hors connexion, ils échouent en silence.
//
// Mise à jour : changer VERSION uniquement quand la liste PRECACHE
// change (page ajoutée ou supprimée). Les simples mises à jour de
// contenu se propagent seules grâce aux règles 1 et 3.
// =========================================================================

const VERSION = "sdb-2026-11-05b";
const CACHE = `soudabilite-${VERSION}`;

// Délai d'attente du réseau avant de servir la copie locale (atelier,
// chantier, sous-sol : un réseau faible ne doit pas bloquer l'outil).
const DELAI_RESEAU_MS = 4000;

const PRECACHE = [
  "/",
  "/404.html",
  "/analyse-thermique-metallurgique.html",
  "/analyse.html",
  "/annonces.html",
  "/assets/css/main.css",
  "/assets/css/print.css",
  "/assets/css/hors-ligne.css",
  "/assets/data/data.json",
  "/assets/data/revendeurs.json",
  "/assets/data/trcs/_manifest.json",
  "/assets/data/zones_schaeffler.json",
  "/assets/i18n/en.json",
  "/assets/i18n/fr.json",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/assets/img/icon-maskable-512.png",
  "/assets/img/logo.png",
  "/assets/js/app.js",
  "/assets/js/banque.js",
  "/assets/js/core/aiguillage.js",
  "/assets/js/core/bwra.js",
  "/assets/js/core/carbone_eq.js",
  "/assets/js/core/config.js",
  "/assets/js/core/dilution.js",
  "/assets/js/core/energie.js",
  "/assets/js/core/equivalents.js",
  "/assets/js/core/iso_ferrite_schaeffler.js",
  "/assets/js/core/perimetre.js",
  "/assets/js/core/prechauffe.js",
  "/assets/js/core/reglages.js",
  "/assets/js/core/schaeffler.js",
  "/assets/js/core/selection_apport.js",
  "/assets/js/core/selection_apport_carbone.js",
  "/assets/js/parametres.js",
  "/assets/js/ui/analytics.js",
  "/assets/js/ui/combobox.js",
  "/assets/js/ui/compteur.js",
  "/assets/js/ui/etat_dmos.js",
  "/assets/js/ui/i18n.js",
  "/assets/js/ui/revendeurs.js",
  "/assets/js/ui/schaeffler_svg.js",
  "/assets/js/vue_analyse.js",
  "/banque.html",
  "/bibliotheque-materiaux.html",
  "/calcul-energie-soudage.html",
  "/calcul-prechauffage-soudage.html",
  "/confidentialite.html",
  "/diagramme-schaeffler-en-ligne.html",
  "/en.html",
  "/en/",
  "/en/materials-library.html",
  "/en/schaeffler-diagram-calculator.html",
  "/en/weldability-calculator.html",
  "/en/welding-heat-input-calculation.html",
  "/favicon.svg",
  "/guide-metallurgique.html",
  "/hors-ligne.html",
  "/manifest.json",
  "/nuances/",
  "/nuances/13crmo4-5.html",
  "/nuances/16mo3.html",
  "/nuances/304.html",
  "/nuances/304l.html",
  "/nuances/316.html",
  "/nuances/316l.html",
  "/nuances/316ti.html",
  "/nuances/321.html",
  "/nuances/p235gh.html",
  "/nuances/p295gh.html",
  "/nuances/p355nl1.html",
  "/nuances/s235jr.html",
  "/nuances/s275jr.html",
  "/nuances/s355j0.html",
  "/nuances/s355k2.html",
  "/parametres.html",
  "/reglementation-dmos.html",
  "/sw-enregistrement.js",
  "/welding-preheat-calculation.html",
  // Bibliothèque de listes déroulantes (page d'analyse FR et EN).
  "https://cdn.jsdelivr.net/npm/choices.js@10.2.0/public/assets/scripts/choices.min.js",
  "https://cdn.jsdelivr.net/npm/choices.js@10.2.0/public/assets/styles/choices.min.css",
];

// Adresses de mesure d'audience : jamais en cache.
const MESURE = [
  "/gc/",
  "goatcounter.com",
  "cloudflareinsights.com",
];

// ---- Installation : copie de tous les fichiers publiés ------------------
// Fichier par fichier : un seul fichier manquant ne doit pas faire échouer
// toute l'installation (cache.addAll serait tout ou rien).
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        PRECACHE.map(async (url) => {
          const externe = url.startsWith("http");
          const requete = new Request(url, {
            cache: "reload",
            mode: externe ? "cors" : "same-origin",
          });
          const reponse = await fetch(requete);
          if (reponse.ok) await cache.put(url, reponse);
        })
      );
      await self.skipWaiting();
    })()
  );
});

// ---- Activation : suppression des anciennes versions --------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((nom) => nom.startsWith("soudabilite-") && nom !== CACHE)
          .map((nom) => caches.delete(nom))
      );
      await self.clients.claim();
    })()
  );
});

// ---- Outils -------------------------------------------------------------

function estMesure(url) {
  return MESURE.some((motif) => url.href.includes(motif));
}

function estVersionne(url) {
  return url.searchParams.has("v") || url.hostname === "cdn.jsdelivr.net";
}

// Variantes d'une adresse de page : /guide, /guide.html, /dossier/index.html
function variantesPage(url) {
  const chemin = url.pathname;
  const liste = [chemin];
  if (chemin.endsWith("/index.html")) liste.push(chemin.slice(0, -10));
  else if (chemin.endsWith("/")) liste.push(chemin + "index.html");
  else if (!chemin.endsWith(".html")) liste.push(chemin + ".html", chemin + "/");
  return liste;
}

// Une réponse issue d'une redirection ne peut pas servir une navigation :
// on la reconstruit à l'identique, sans le marqueur de redirection.
async function nettoyer(reponse) {
  if (!reponse || !reponse.redirected) return reponse;
  const corps = await reponse.blob();
  return new Response(corps, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers: reponse.headers,
  });
}

async function chercherEnCache(cache, request, url) {
  const exacte = await cache.match(request);
  if (exacte) return exacte;
  return cache.match(url.href.split("?")[0], { ignoreSearch: true });
}

// Réseau avec délai : rejette si le réseau tarde ou échoue.
function reseauAvecDelai(request) {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => rejeter(new Error("delai")), DELAI_RESEAU_MS);
    fetch(request).then(
      (reponse) => { clearTimeout(minuterie); resoudre(reponse); },
      (erreur) => { clearTimeout(minuterie); rejeter(erreur); }
    );
  });
}

async function mettreEnCache(cache, request, reponse) {
  if (reponse && reponse.ok && request.method === "GET") {
    try { await cache.put(request, reponse.clone()); } catch (_) { /* quota */ }
  }
}

// ---- Règle 1 : pages HTML ----------------------------------------------
async function servirPage(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const reponse = await reseauAvecDelai(request);
    if (reponse.ok) {
      const cle = url.origin + url.pathname;
      await cache.put(cle, reponse.clone());
    }
    return reponse;
  } catch (_) {
    for (const chemin of variantesPage(url)) {
      const copie = await cache.match(chemin, { ignoreSearch: true });
      if (copie) return nettoyer(copie);
    }
    const secours = await cache.match("/hors-ligne.html");
    return (await nettoyer(secours)) || new Response("Hors connexion", { status: 503 });
  }
}

// ---- Règle 2 : fichiers versionnés -------------------------------------
async function servirVersionne(request, url) {
  const cache = await caches.open(CACHE);
  const exacte = await cache.match(request);
  if (exacte) return exacte;
  try {
    const reponse = await fetch(request);
    await mettreEnCache(cache, request, reponse);
    return reponse;
  } catch (erreur) {
    const copie = await chercherEnCache(cache, request, url);
    if (copie) return copie;
    throw erreur;
  }
}

// ---- Règle 3 : fichiers non versionnés ---------------------------------
async function servirReseauDabord(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const reponse = await reseauAvecDelai(request);
    await mettreEnCache(cache, request, reponse);
    return reponse;
  } catch (erreur) {
    const copie = await chercherEnCache(cache, request, url);
    if (copie) return copie;
    throw erreur;
  }
}

// ---- Aiguillage des requêtes -------------------------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (estMesure(url)) {
    // Mesure d'audience : réseau seul, réponse vide si hors connexion.
    event.respondWith(
      fetch(request).catch(() => new Response("", { status: 204 }))
    );
    return;
  }

  const memeOrigine = url.origin === self.location.origin;
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (!memeOrigine && !cdn) return; // liens externes : comportement normal

  if (request.mode === "navigate") {
    event.respondWith(servirPage(request, url));
  } else if (estVersionne(url)) {
    event.respondWith(servirVersionne(request, url));
  } else {
    event.respondWith(servirReseauDabord(request, url));
  }
});
