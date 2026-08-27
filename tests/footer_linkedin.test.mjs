import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const racine = new URL("../", import.meta.url);
const pages = ["index.html", "parametres.html", "banque.html", "annonces.html"];
const traductions = JSON.parse(
  await readFile(new URL("assets/i18n/fr.json", racine), "utf8"),
);
const styles = await readFile(new URL("assets/css/main.css", racine), "utf8");

for (const nom of pages) {
  const page = await readFile(new URL(nom, racine), "utf8");
  assert.match(page, /class="pied__signature"/);
  assert.match(page, /class="pied__linkedin-icone" aria-hidden="true">in<\/span>/);
  assert.match(page, /class="pied__signature-texte" data-i18n="footer\.signature"/);
  assert.match(page, /aria-label:footer\.signature_lien_aria/);
  assert.match(page, /main\.css\?v=20260827-icone-linkedin-1/);
}

assert.equal(
  traductions.footer.signature_lien_aria,
  "Profil LinkedIn de Tony SANCHEZ (nouvel onglet)",
);
assert.match(styles, /\.pied__signature\s*\{[^}]*display:\s*inline-flex/s);
assert.match(styles, /\.pied__linkedin-icone\s*\{[^}]*background:\s*#0a66c2/s);

console.log("Tests icône LinkedIn du pied de page : OK");
