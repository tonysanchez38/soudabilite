import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const racine = new URL("../", import.meta.url);
const traductions = JSON.parse(await readFile(new URL("assets/i18n/fr.json", racine), "utf8"));
const zones = JSON.parse(await readFile(new URL("assets/data/zones_schaeffler.json", racine), "utf8"));
const vue = await readFile(new URL("assets/js/vue_analyse.js", racine), "utf8");
const rendu = await readFile(new URL("assets/js/ui/schaeffler_svg.js", racine), "utf8");
const parametres = await readFile(new URL("assets/js/parametres.js", racine), "utf8");
const page = await readFile(new URL("parametres.html", racine), "utf8");
const styles = await readFile(new URL("assets/css/main.css", racine), "utf8");

assert.equal(traductions.analyse.leg_a, "Métal A");
assert.equal(traductions.analyse.leg_b, "Métal B");
assert.equal(traductions.analyse.leg_c, "Métal d'apport");
assert.equal(traductions.analyse.leg_joint, "Joint");
assert.equal(traductions.analyse.leg_dmelange, "Dilution A+B");
assert.equal(traductions.analyse.leg_ideale, "1 — Zone idéale (5-15 % ferrite)");
assert.equal(traductions.analyse.leg_acceptable, "2 — Zone acceptable");
assert.equal(traductions.analyse.leg_zone_s, "3 — Corridor de sécurité blanc");
assert.equal(traductions.analyse.leg_amf, "Zone A+M+F grisée");
assert.match(traductions.analyse.diagramme_intro_court, /estimations métallurgiques/);
assert.equal(
  traductions.analyse.diagramme_difference_titre,
  "Pourquoi ce diagramme diffère-t-il des supports de cours ?",
);
assert.match(traductions.analyse.diagramme_difference_traces_texte, /digitalisées/);
assert.match(traductions.analyse.diagramme_difference_limite_texte, /Il ne garantit ni la structure réelle/);
assert.equal(traductions.analyse.carte_apports, "Sélection des 7 apports les plus robustes");
assert.equal(traductions.analyse.col_plage, "Plage testée");
assert.equal(traductions.analyse.col_couverture_ideale, "Part en zone idéale");
assert.equal(traductions.analyse.plage_ideal, "Idéal sur toute la plage");
assert.match(traductions.analyse.heterogene_note, /Le préchauffage n'est pas calculé/);

const zoneAMF = zones.zones.find((zone) => zone.id === "AMF");
assert.equal(zoneAMF?.couleur, "#94A3B8");

for (const etiquette of ["Métal A", "Métal B", "Dilution", "Métal d'apport", "Joint"]) {
  assert.ok(vue.includes(`etiquette: \"${etiquette}\"`), `Étiquette dynamique manquante : ${etiquette}`);
}
assert.match(rendu, /meilleureAncreBande\(15, 20\), "ACCEPTABLE"/);
assert.match(rendu, /lignes: \["CORRIDOR", "DE SÉCURITÉ"\]/);
assert.match(rendu, /\[10, 15, 20\]\.includes\(pct\)/);
assert.match(parametres, /vue_analyse\.js\?v=20260825-plage-dilution-1/);
assert.match(parametres, /core\/energie\.js\?v=20260824-energie-diagramme-2/);
assert.match(page, /parametres\.js\?v=20260825-plage-dilution-1/);
assert.match(page, /main\.css\?v=20260824-explication-diagramme-4/);
assert.match(page, /<details class="diagramme-explication">/);
assert.match(page, /data-i18n="analyse\.diagramme_difference_limite_texte"/);
assert.match(page, /data-i18n="analyse\.col_plage"/);
assert.match(page, /data-i18n="analyse\.col_couverture_ideale"/);
assert.match(vue, /schaeffler_svg\.js\?v=20260825-plage-dilution-1/);
assert.match(rendu, /iso_ferrite_schaeffler\.js\?v=20260824-energie-diagramme-2/);
assert.doesNotMatch(styles, /min-width:\s*600px/);
assert.match(styles, /\[data-carte="diagramme"\]\s*\{[^}]*padding-inline:\s*var\(--sp-3\)/s);
assert.match(styles, /\.schaeffler-svg\s*\{[^}]*min-width:\s*0;[^}]*max-height:\s*none;/s);
assert.equal(traductions.parametres.unite_kjcm, "kJ/cm");
assert.match(traductions.parametres.label_en, /\(kJ\/cm\)$/);
assert.match(traductions.parametres.label_eq, /\(kJ\/cm\)$/);

console.log("Tests UX diagramme : OK");
