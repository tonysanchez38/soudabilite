import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

globalThis.window = {};
globalThis.document = {
  documentElement: { lang: "" },
  querySelector() {
    return null;
  },
};

const { envoyerEvenement } = await import("../assets/js/ui/analytics.js");
const { chargerChaines } = await import("../assets/js/ui/i18n.js");
const { rendreCompteur } = await import("../assets/js/ui/compteur.js");

let evenementRecu = null;
window.goatcounter = {
  count(evenement) {
    evenementRecu = evenement;
  },
};

assert.equal(envoyerEvenement("pdf-demande", "Demande de fiche PDF"), true);
assert.deepEqual(evenementRecu, {
  path: "pdf-demande",
  title: "Demande de fiche PDF",
  event: true,
  no_session: true,
});

window.goatcounter = undefined;
assert.equal(envoyerEvenement("pdf-demande", "Demande de fiche PDF"), false);

const chaines = JSON.parse(
  await readFile(new URL("../assets/i18n/fr.json", import.meta.url), "utf8")
);
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return chaines;
  },
});
await chargerChaines("fr");

const cible = { hidden: true, textContent: "" };
document.querySelector = (selecteur) =>
  selecteur === "[data-compteur]" ? cible : null;

let urlDemandee = "";
globalThis.fetch = async (url) => {
  urlDemandee = url;
  return {
    ok: true,
    async json() {
      return { count: "1 234" };
    },
  };
};

await rendreCompteur();
assert.equal(urlDemandee, "https://soudabilite.com/gc/counter/TOTAL.json");
assert.equal(cible.textContent, "1 234 consultations de pages");
assert.equal(cible.hidden, false);

const worker = (await import("../cloudflare/gc-proxy-worker.js")).default;
let cibleProxy = "";
globalThis.fetch = async (url) => {
  cibleProxy = url;
  return new Response('{"count":"1 234"}', {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const reponseProxy = await worker.fetch(
  new Request("https://soudabilite.com/gc/counter/TOTAL.json")
);
assert.equal(cibleProxy, "https://soudabilite.goatcounter.com/counter/TOTAL.json");
assert.equal(reponseProxy.status, 200);
assert.deepEqual(await reponseProxy.json(), { count: "1 234" });

console.log("Tests analytics : OK");
