// Cloudflare Worker - proxy first-party pour GoatCounter.
// Route a creer dans Cloudflare : soudabilite.com/gc/*
//
// But : les bloqueurs de pub (AdGuard, uBlock...) bloquent le DOMAINE
// gc.zgo.at et *.goatcounter.com dans leurs listes de filtres. En servant
// le script, les evenements et le compteur JSON depuis le domaine du site
// lui-meme (soudabilite.com/gc/...), ce blocage par nom de domaine ne
// s'applique plus.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const chemin = url.pathname.replace(/^\/gc/, "");

    let cible;
    if (chemin === "/count.js") {
      cible = "https://gc.zgo.at/count.js";
    } else if (chemin.startsWith("/counter/")) {
      cible = "https://soudabilite.goatcounter.com" + chemin;
    } else {
      cible = "https://soudabilite.goatcounter.com/count" + url.search;
    }

    // En-tetes reconstruits a la main, et NON relayes tels quels.
    // request.headers porte "host: soudabilite.com" : une sous-requete
    // Worker qui transporte un en-tete Host est routee vers CE host, pas
    // vers l'URL demandee. La requete repartait donc sur la zone
    // soudabilite.com au lieu d'atteindre GoatCounter, et Cloudflare
    // renvoyait HTTP 525 (echec du handshake TLS avec l'origine).
    // On ne transmet que ce dont GoatCounter a besoin.
    const entetes = new Headers();
    for (const nom of ["user-agent", "referer", "accept", "accept-language", "content-type"]) {
      const valeur = request.headers.get(nom);
      if (valeur) entetes.set(nom, valeur);
    }

    // IP du visiteur : GoatCounter s'en sert pour l'unicite de visite.
    // Cloudflare l'a deja resolue a l'entree du edge.
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) entetes.set("x-forwarded-for", ip);

    // Le corps est lu une seule fois : une relance ne peut pas rejouer
    // un flux deja consomme.
    const corps = request.method === "POST" ? await request.arrayBuffer() : undefined;

    // Deux tentatives. Mesure du 15/10/2026 : un appel sur deux vers
    // soudabilite.goatcounter.com repartait en HTTP 525 (echec du
    // handshake TLS avec l'origine), ce qui perdait la moitie des
    // visites comptees. Une relance ramene l'echec attendu de 50 % a
    // environ 25 %, sans masquer une panne franche.
    for (let tentative = 0; tentative < 2; tentative += 1) {
      try {
        const reponse = await fetch(cible, {
          method: request.method,
          headers: entetes,
          body: corps,
          redirect: "follow",
        });

        if (reponse.status >= 500 && tentative === 0) continue;

        const sortie = new Response(reponse.body, reponse);
        // Autorise la lecture du compteur par le script du site.
        sortie.headers.set("access-control-allow-origin", "https://soudabilite.com");
        return sortie;
      } catch (err) {
        // Seconde tentative ci-dessous, puis abandon.
      }
    }

    // Proxy indisponible : reponse courte plutot qu'une page d'erreur
    // Cloudflare de 8 ko. Le site sait retomber sur l'appel direct a
    // GoatCounter (voir assets/js/ui/compteur.js).
    return new Response("proxy goatcounter indisponible", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
