import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { usageAdmis, estDuplex } from "../assets/js/core/perimetre.js";
import { meilleursApports } from "../assets/js/core/selection_apport.js";
import { joint, plageDilution } from "../assets/js/core/dilution.js";
import { crEqSchaeffler, niEqSchaeffler } from "../assets/js/core/equivalents.js";
import { ferriteSchaeffler, niveauIdeal } from "../assets/js/core/schaeffler.js";

const banque = JSON.parse(await readFile(new URL("../assets/data/data.json", import.meta.url), "utf8"));
const zones = JSON.parse(await readFile(new URL("../assets/data/zones_schaeffler.json", import.meta.url), "utf8"));

// Règle d'usage (DECISIONS.md #35).
assert.equal(usageAdmis({}), true);
assert.equal(usageAdmis({ usage: "assemblage" }), true);
assert.equal(usageAdmis({ usage: "refractaire" }), false);
assert.equal(usageAdmis({ usage: "refractaire" }, true), true);
assert.equal(usageAdmis({ usage: "rechargement" }, true), false);
assert.equal(usageAdmis({ usage: "fonte" }, true), false);

// Chaque apport porte un usage connu, chaque désignation est unique.
const USAGES = new Set(["assemblage", "refractaire", "rechargement", "fonte"]);
for (const a of banque.metaux_apport) assert.ok(USAGES.has(a.usage), a.designation);
assert.equal(new Set(banque.metaux_apport.map((a) => a.designation)).size, banque.metaux_apport.length);

// Cas réel : 304L + 304L en TIG, aucun apport réfractaire dans le top 7.
const base = (debut) => banque.metaux_base.find((m) => m.designation.startsWith(debut));
const l304 = base("304 L");
assert.notEqual(l304.refractaire, true);
const candidats = banque.metaux_apport.filter((a) => !estDuplex(a.designation) && usageAdmis(a, false));
const pl = plageDilution("141");
const d = (pl.min + pl.max) / 2;
const top = meilleursApports(candidats, "141", {
  A: l304.composition, B: l304.composition, dA: d / 2, dB: d / 2, dC: 1 - d,
  centre: zones.centre_ideal, joint, crEq: crEqSchaeffler, niEq: niEqSchaeffler,
  ferrite: ferriteSchaeffler, niveauIdeal, zones: zones.zones, zoneS: zones.zone_s,
  plageDilution: pl, n: 7,
});
const parNom = new Map(banque.metaux_apport.map((a) => [a.designation, a]));
for (const r of top) assert.equal(parNom.get(r.designation).usage, "assemblage", r.designation);

// Une base réfractaire (310) rouvre les apports réfractaires.
assert.equal(base("310 ").refractaire, true);
