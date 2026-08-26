import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ISO_FERRITE_SCHAEFFLER,
  ligneIso,
  ordonneeIso,
} from "../assets/js/core/iso_ferrite_schaeffler.js";
import {
  ferriteSchaeffler, niveauIdeal, verdictSchaeffler,
} from "../assets/js/core/schaeffler.js";
import { meilleursApports } from "../assets/js/core/selection_apport.js";
import { joint, dilutionValide, plageDilution } from "../assets/js/core/dilution.js";
import { crEqSchaeffler, niEqSchaeffler } from "../assets/js/core/equivalents.js";
import { aiguille } from "../assets/js/core/aiguillage.js";
import {
  candidatsTungstene, creerReglagesAuto, personnaliserReglage, valeursEffectives,
  propagerReglages, recommanderTungstene,
} from "../assets/js/core/reglages.js";
import { traduireEnrobage } from "../assets/js/core/prechauffe.js";
import {
  energieNominale, energieCorrigee, kjMmVersKjCm, kjCmVersKjMm,
} from "../assets/js/core/energie.js";

const zones = JSON.parse(await readFile(new URL("../assets/data/zones_schaeffler.json", import.meta.url), "utf8"));
const banque = JSON.parse(await readFile(new URL("../assets/data/data.json", import.meta.url), "utf8"));

assert.deepEqual(ISO_FERRITE_SCHAEFFLER.slice(0, 5).map((l) => l.pct), [0, 5, 10, 15, 20]);

// La ligne 15 % interpolée couvre toute l'étendue commune des lignes 10/20,
// afin que son extrémité et son libellé rejoignent le même bord droit.
const fin15 = ligneIso(15).points.at(-1)[0];
const finCommune1020 = Math.min(ligneIso(10).points.at(-1)[0], ligneIso(20).points.at(-1)[0]);
assert.ok(Math.abs(fin15 - finCommune1020) < 1e-9);

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

assert.deepEqual(plageDilution("141"), { min: 0.15, max: 0.30 });
assert.deepEqual(plageDilution("111"), { min: 0.10, max: 0.35 });
assert.equal(dilutionValide(0.08, 0.08, 0.84), true);
assert.equal(dilutionValide(0.5, 0.5, 0.5), false);

// En zone acceptable, aucun risque de fissuration n'est ajouté. En zone
// A+M hors des zones admises, le risque froid remplace le faux risque chaud.
assert.deepEqual(verdictSchaeffler(24, 12, {}, zones.zones, zones.zone_s).risques, []);

const p265 = banque.metaux_base.find((m) => m.designation.startsWith("P265GH"));
const inox316 = banque.metaux_base.find((m) => m.designation.startsWith("316 L"));
const apport309 = banque.metaux_apport.find((m) => m.designation === "INERTROD 309L Si");
const jointFortementDilue = joint(
  p265.composition, inox316.composition, apport309.composition, 0.35, 0.35, 0.30
);
const crFort = crEqSchaeffler(jointFortementDilue);
const niFort = niEqSchaeffler(jointFortementDilue);
const risquesForteDilution = verdictSchaeffler(
  crFort, niFort, jointFortementDilue, zones.zones, zones.zone_s
).risques;
assert.equal(risquesForteDilution.includes("martensite"), true);
assert.equal(risquesForteDilution.includes("austenite_pure"), false);
assert.equal(ferriteSchaeffler(crFort, niFort, zones.zones), null);

// L'assemblage hétérogène reste volontairement sur Schaeffler. Le carbone
// homogène conserve la branche thermique de préchauffage.
assert.deepEqual(aiguille(p265.composition, inox316.composition).branches, ["schaeffler"]);
assert.deepEqual(aiguille(p265.composition, p265.composition).branches, ["thermique"]);

// Cas de référence de l'interface : le 309L Si reste idéal sur toute la
// plage TIG 15 à 30 %. Les apports sensibles sont rétrogradés par leur pire
// verdict, même si le point de dilution saisi est favorable.
const classementPlage = meilleursApports(banque.metaux_apport, "141", {
  A: p265.composition, B: inox316.composition, dA: 0.08, dB: 0.08, dC: 0.84,
  centre: zones.centre_ideal, joint,
  crEq: crEqSchaeffler, niEq: niEqSchaeffler, ferrite: ferriteSchaeffler,
  niveauIdeal, zones: zones.zones, zoneS: zones.zone_s,
  plageDilution: plageDilution("141"), n: 218,
});
assert.equal(classementPlage[0].designation, "INERTROD 309L Si");
assert.equal(classementPlage[0].analysePlage.niveauPire, "ideal");
assert.equal(classementPlage[0].analysePlage.couvertureIdeale, 100);
const altig316 = classementPlage.find((r) => r.designation === "ALTIG 316L");
assert.equal(altig316.analysePlage.niveauPire, "hors");
assert.ok(altig316.analysePlage.couvertureSecurisee < 100);

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

// Même hors top 7 théorique, la proposition manuelle reste visible avec son
// rang réel afin de pouvoir la comparer aux meilleurs apports de la banque.
const banqueFictive = Array.from({ length: 8 }, (_, i) => ({
  designation: `TIG ${i}`, composition: { x: 22 + i / 100, y: 12 }, procede: "141_TIG",
}));
const comparaison = meilleursApports(banqueFictive, "141", {
  A: {}, B: {}, dA: 0, dB: 0, dC: 1,
  centre: [22, 12], joint: (_a, _b, c) => c,
  crEq: identite, niEq: (c) => c.y, ferrite: () => 10,
  niveauIdeal: () => "ideal", zones: [], zoneS: [], n: 7,
  apportsSupplementaires: [{ designation: "TIG proposé", composition: { x: 30, y: 12 }, procede: "141_TIG" }],
  forcerSupplementaires: true,
});
assert.equal(comparaison.length, 7);
assert.equal(comparaison.at(-1).origine, "manuel");
assert.equal(comparaison.at(-1).rangGlobal, 9);

const auto = creerReglagesAuto({ intensite: 100, tension: 14 });
assert.deepEqual(valeursEffectives(personnaliserReglage(auto, "intensite", 90)), { intensite: 90, tension: 14 });
assert.equal(candidatsTungstene([{ diametre_mm: 1.6, plage_courant_A: "70-150" }], { intensite: 100 }).length, 1);
const propages = propagerReglages(
  { intensite: 100, tension: 14, vitesse: 20 }, "vitesse", 10, 0.6
);
assert.equal(propages.energieNominale, 0.84);
assert.equal(propages.energieCorrigee, 0.504);
const depuisQ = propagerReglages(propages, "energieCorrigee", 0.252, 0.6);
assert.ok(Math.abs(depuisQ.energieNominale - 0.42) < 1e-12);
assert.ok(Math.abs(depuisQ.vitesse - 20) < 1e-12);
assert.equal(recommanderTungstene([
  { designation: "WP Ø1.6", diametre_mm: 1.6, plage_courant_A: "70-150" },
  { designation: "WC20 Ø1.6", diametre_mm: 1.6, plage_courant_A: "70-150" },
  { designation: "WL20 Ø1.6", diametre_mm: 1.6, plage_courant_A: "70-150" },
], { intensite: 100, polarite: "DCEN" }).designation, "WC20 Ø1.6");
assert.equal(traduireEnrobage("C"), null);
assert.equal(traduireEnrobage("R"), "rutile");

// Cas visible de la capture : 75 A, 13 V et 12 cm/min donnent 4,875 kJ/cm,
// soit 0,4875 kJ/mm en unité canonique interne ; Q vaut 2,925 kJ/cm à k=0,6.
const energieCapture = energieNominale(13, 75, 12);
assert.equal(energieCapture.kJ_cm, 4.875);
assert.equal(energieCapture.kJ_mm, 0.4875);
assert.equal(kjMmVersKjCm(energieCapture.kJ_mm), 4.875);
assert.equal(kjCmVersKjMm(4.875), 0.4875);
assert.equal(energieCorrigee(energieCapture.kJ_cm, "141"), 2.925);

console.log("Tests Schaeffler : OK");
