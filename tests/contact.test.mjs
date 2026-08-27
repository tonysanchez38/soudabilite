import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const racine = new URL("../", import.meta.url);
const page = await readFile(new URL("annonces.html", racine), "utf8");
const traductions = JSON.parse(
  await readFile(new URL("assets/i18n/fr.json", racine), "utf8"),
);
const styles = await readFile(new URL("assets/css/main.css", racine), "utf8");

assert.doesNotMatch(page, /annonces\.linkedin_page/);
assert.doesNotMatch(page, /class="auteur/);
assert.equal("linkedin_page" in traductions.annonces, false);
assert.equal("linkedin_page_url" in traductions.annonces, false);
assert.doesNotMatch(styles, /\.auteur(?:__|\s*\{)/);

assert.match(page, /data-i18n="annonces\.titre"/);
assert.match(page, /data-i18n="footer\.signature"/);
assert.match(page, /data-compteur/);

console.log("Tests page Contact : OK");
