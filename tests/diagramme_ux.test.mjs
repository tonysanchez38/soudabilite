import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const racine = new URL("../", import.meta.url);
const traductions = JSON.parse(await readFile(new URL("assets/i18n/fr.json", racine), "utf8"));
const zones = JSON.parse(await readFile(new URL("assets/data/zones_schaeffler.json", racine), "utf8"));
const vue = await readFile(new URL("assets/js/vue_analyse.js", racine), "utf8");
const rendu = await readFile(new URL("assets/js/ui/schaeffler_svg.js", racine), "utf8");

assert.equal(traductions.analyse.leg_a, "Métal A");
assert.equal(traductions.analyse.leg_b, "Métal B");
assert.equal(traductions.analyse.leg_c, "Métal d'apport");
assert.equal(traductions.analyse.leg_joint, "Joint");
assert.match(traductions.analyse.leg_zone_s, /Corridor de sécurité A\+M\+F/);
assert.match(traductions.analyse.leg_amf, /Austénite \+ Martensite \+ Ferrite/);

const zoneAMF = zones.zones.find((zone) => zone.id === "AMF");
assert.equal(zoneAMF?.couleur, "#94A3B8");

for (const etiquette of ["Métal A", "Métal B", "Dilution", "Métal d'apport", "Joint"]) {
  assert.ok(vue.includes(`etiquette: \"${etiquette}\"`), `Étiquette dynamique manquante : ${etiquette}`);
}
assert.match(rendu, /meilleureAncreBande\(15, 20\), "ACCEPTABLE"/);
assert.match(rendu, /lignes: \["CORRIDOR", "DE SÉCURITÉ"\]/);

console.log("Tests UX diagramme : OK");
