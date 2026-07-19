// Cloudflare Worker — proxy first-party pour GoatCounter.
// Route à créer dans Cloudflare : soudabilite.com/gc/*
//
// But : les bloqueurs de pub (AdGuard, uBlock...) bloquent le DOMAINE
// gc.zgo.at et *.goatcounter.com dans leurs listes de filtres. En servant
// le script, les événements et le compteur JSON depuis le domaine du site
// lui-même (soudabilite.com/gc/...), ce blocage par nom de domaine ne
// s'applique plus.
//
// request.headers est relayé tel quel : Cloudflare a déjà injecté
// X-Forwarded-For/CF-Connecting-IP à l'entrée du edge avec la vraie IP
// visiteur, donc GoatCounter calcule correctement l'unicité de visite
// sans qu'on ait besoin de reconstruire les en-têtes à la main.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const chemin = url.pathname.replace(/^\/gc/, '');

    let cible;
    if (chemin === '/count.js') {
      cible = 'https://gc.zgo.at/count.js';
    } else if (chemin.startsWith('/counter/')) {
      cible = 'https://soudabilite.goatcounter.com' + chemin;
    } else {
      cible = 'https://soudabilite.goatcounter.com/count' + url.search;
    }

    const reponse = await fetch(cible, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined
    });

    return new Response(reponse.body, reponse);
  }
};
