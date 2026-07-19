# Proxy GoatCounter first-party (Option A)

But : contourner le blocage par nom de domaine de `gc.zgo.at` et
`*.goatcounter.com` par les bloqueurs de pub (AdGuard etc.), en servant
script + endpoints depuis `soudabilite.com/gc/*`.

Le site reste 100 % statique (GitHub Pages) : seul le worker ci-dessous,
hébergé sur Cloudflare, fait le relais. Ça ne change rien à
l'architecture de l'app elle-même.

## Étapes (à faire dans le dashboard Cloudflare, une fois)

1. Ajouter `soudabilite.com` comme site dans Cloudflare (plan gratuit).
2. Chez OVH, remplacer les serveurs DNS du domaine par ceux fournis par
   Cloudflare (Cloudflare affiche les deux à utiliser après l'étape 1).
   Propagation : quelques minutes à quelques heures.
3. Une fois la zone active, vérifier que l'enregistrement DNS existant
   pointant vers GitHub Pages (apex + `www`) est en mode **proxifié**
   (nuage orange, pas gris) — sinon le Worker ne s'exécutera jamais.
4. Workers & Pages > Create > déployer `gc-proxy-worker.js` (soit copier-
   coller le contenu dans l'éditeur en ligne, soit `wrangler deploy`
   depuis ce dossier avec `wrangler.toml`).
5. Sur le Worker déployé : Settings > Triggers > Add route :
   `soudabilite.com/gc/*` (zone `soudabilite.com`).

## Déjà fait côté dépôt (ce commit)

- `index.html`, `parametres.html`, `banque.html`, `annonces.html` : le tag
  GoatCounter pointe désormais sur `/gc/count.js` et
  `https://soudabilite.com/gc/count` au lieu de `gc.zgo.at` et
  `soudabilite.goatcounter.com` directement. Les `<link rel="preconnect">`
  / `dns-prefetch` vers l'ancien domaine ont été retirés (inutiles en
  same-origin).
- `assets/i18n/fr.json` : les URLs du compteur public de pied de page
  (`compteur_total_url`, `compteur_analyses_url`) pointent sur
  `/gc/counter/*.json` au lieu de `soudabilite.goatcounter.com` — même
  raisonnement, ce endpoint était lui aussi bloqué par domaine.

## Limite connue

Tant que les étapes 1-5 ci-dessus ne sont pas faites côté Cloudflare, les
URLs `/gc/...` renvoient une 404 GitHub Pages (aucun fichier de ce nom
dans le dépôt) : la mise à jour du HTML seule ne suffit pas, il faut le
Worker + la route pour que ça reprenne effet.
