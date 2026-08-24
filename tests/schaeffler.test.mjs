import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ISO_FERRITE_SCHAEFFLER,
  ligneIso,
  ordonneeIso,
} from "../assets/js/core/iso_ferrite_schaeffler.js";
import { ferriteSchaeffler, niveauIdeal } from "../assets/js/core/schaeffler.js";
import { meilleursApports } from "../assets/js/core/selection_apport.js";
import { candidatsTungstene, creerReglagesAuto, personnaliserReglage, valeursEffectives } from "../assets/js/core/reglages.js";

const zones = JSON.parse(await readFile(new URL("../assets/data/zones_schaeffler.json", import.meta.url), "utf8"));

assert.deepEqual(ISO_FERRITE_SCHAEFFLER.slice(0, 5).map((l) => l.pct), [0, 5, 10, 15, 20]);

// Les lignes historiques ne sont pas parallèles.
const pentes = [0, 5, 10, 20].map((pct) => {
  const points = ligneIso(pct).points;
  const a = points[0], b = points.at(-1);
  return (b[1] - a[1]) / (b[0] - a[0]);
});
assert.equal(new Set(pentes.map((p) => p.toFixed(3))).size, 4);

// Cas étalons prioritaires Cr_eq 16-25 / Ni_eq 5-15 : chaque contour est
// relu à Cr_eq fixe et l'interpolation 15 % reste entre 10 et 20 %.
for (const cr of [17, 20, 22, 25]) {
  for (const pct of [0, 5, 10, 15, 20]) {
    const ni = ordonneeIso(ligneIso(pct), cr);
    if (ni != null) assert.ok(Math.abs(ferriteSchaeffler(cr, ni) - pct) < 1e-9, `${pct}% à Cr_eq=${cr}`);
  }
  const y10 = ordonneeIso(ligneIso(10), cr);
  const y15 = ordonneeIso(ligneIso(15), cr);
  const y20 = ordonneeIso(ligneIso(20), cr);
  if (y10 != null && y15 != null && y20 != null) assert.ok(y10 > y15 && y15 > y20);
}

assert.equal(niveauIdeal(22, 12, zones.zones, zones.zone_s), "ideal");
assert.equal(niveauIdeal(24, 12, zones.zones, zones.zone_s), "acceptable");
assert.equal(niveauIdeal(24, 10, zones.zones, zones.zone_s), "hors");
assert.equal(niveauIdeal(25.1, 13, zones.zones, zones.zone_s), "hors");

// Un apport manuel emprunte exactement le même pipeline et peut entrer dans
// les sept premiers sans être injecté dans la banque persistante.
const identite = (c) => c.x;
const rows = meilleursApports([], "141", {
  A: { x: 20 }, B: { x: 20 }, dA: 0, dB: 0, dC: 1,
  centre: [22, 12], joint: (_a, _b, c) => c,
  crEq: identite, niEq: (c) => c.y, ferrite: () => 10,
  niveauIdeal: () => "ideal", zones: [], zoneS: [],
  apportsSupplementaires: [{ designation: "TIG manuel", composition: { x: 22, y: 12 }, procede: "141_TIG" }],
});
assert.equal(rows[0].origine, "manuel");

const auto = creerReglagesAuto({ intensite: 100, tension: 14 });
assert.deepEqual(valeursEffectives(personnaliserReglage(auto, "intensite", 90)), { intensite: 90, tension: 14 });
assert.equal(candidatsTungstene([{ diametre_mm: 1.6, plage_courant_A: "70-150" }], { intensite: 100 }).length, 1);

console.log("Tests Schaeffler : OK");
