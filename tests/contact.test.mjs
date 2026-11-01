import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// La page Annonces a été fusionnée dans l'accueil (section #contact) ;
// annonces.html n'est plus qu'un renvoi, doublé d'une redirection 301
// Cloudflare. Le test porte donc sur la section Contact de l'accueil.
const racine = new URL("../", import.meta.url);
const accueil = await readFile(new URL("index.html", racine), "utf8");
const renvoi = await readFile(new URL("annonces.html", racine), "utf8");
const traductions = JSON.parse(
  await readFile(new URL("assets/i18n/fr.json", racine), "utf8"),
);
const styles = await readFile(new URL("assets/css/main.css", racine), "utf8");

assert.equal("linkedin_page" in traductions.annonces, false);
assert.equal("linkedin_page_url" in traductions.annonces, false);
assert.doesNotMatch(styles, /\.auteur(?:__|\s*\{)/);

assert.match(accueil, /id="contact"/);
assert.doesNotMatch(accueil, /class="auteur/);
assert.match(accueil, /data-i18n="footer\.signature"/);
assert.match(accueil, /data-compteur/);
assert.match(renvoi, /index\.html#contact/);
assert.match(renvoi, /noindex/);

console.log("Tests page Contact : OK");
