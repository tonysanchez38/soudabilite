// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// banque.js - page Data : tableaux de référence des métaux de base et
// d'apport. Aucune donnée dupliquée en dur : composition lue depuis
// data.json, Cr_eq/Ni_eq recalculés à la volée (equivalents.js), groupes
// de compatibilité procédé recalculés à la volée (bucketsDetectes,
// selection_apport.js). Aucune logique métier propre à ce module.
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";
import { rendreCompteur } from "./ui/compteur.js";
import { crEqSchaeffler, niEqSchaeffler } from "./core/equivalents.js";
import { ELEMENTS } from "./core/dilution.js";
import { bucketsDetectes } from "./core/selection_apport.js";

// Ordre d'affichage des colonnes élément, aligné sur dilution.ELEMENTS.
const COL_ELEMENT = {
  C: "banque.col_c", Mn: "banque.col_mn", Si: "banque.col_si",
  Cr: "banque.col_cr", Ni: "banque.col_ni", Mo: "banque.col_mo",
  Nb: "banque.col_nb", N: "banque.col_n", Cu: "banque.col_cu", Ti: "banque.col_ti",
};

const GROUPES_APPORT = [
  { bucket: "111", cle: "banque.groupe_111" },
  { bucket: "141", cle: "banque.groupe_141" },
  { bucket: "131_135", cle: "banque.groupe_131_135" },
];

function fmt(valeur, decimales = 2) {
  const n = Number(valeur);
  return valeur == null || !Number.isFinite(n) ? t("banque.non_applicable") : n.toFixed(decimales);
}

function enteteColonnes() {
  const cles = [
    "banque.col_designation", "banque.col_groupe_iso", "banque.col_creq", "banque.col_nieq",
    ...ELEMENTS.map((e) => COL_ELEMENT[e]),
  ];
  return cles.map((cle) => {
    const th = document.createElement("th");
    th.textContent = t(cle);
    return th;
  });
}

function ligneMetal(metal) {
  const cr = crEqSchaeffler(metal.composition);
  const ni = niEqSchaeffler(metal.composition);
  const tr = document.createElement("tr");
  const valeurs = [
    metal.designation,
    metal.groupe_iso_15608 ?? t("banque.non_applicable"),
    fmt(cr), fmt(ni),
    ...ELEMENTS.map((e) => fmt(metal.composition?.[e], 3)),
  ];
  const labels = [
    t("banque.col_designation"), t("banque.col_groupe_iso"), t("banque.col_creq"), t("banque.col_nieq"),
    ...ELEMENTS.map((e) => t(COL_ELEMENT[e])),
  ];
  valeurs.forEach((val, i) => {
    const td = document.createElement("td");
    td.textContent = val;
    td.dataset.label = labels[i];
    tr.appendChild(td);
  });
  return tr;
}

function construireTable(corpsId, metaux) {
  const table = document.createElement("table");
  table.className = "tableau";
  const thead = document.createElement("thead");
  const trEntete = document.createElement("tr");
  enteteColonnes().forEach((th) => trEntete.appendChild(th));
  thead.appendChild(trEntete);
  const tbody = document.createElement("tbody");
  if (metaux.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4 + ELEMENTS.length;
    td.className = "note";
    td.textContent = t("banque.apport_vide");
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    metaux.forEach((m) => tbody.appendChild(ligneMetal(m)));
  }
  table.append(thead, tbody);
  const defilant = document.createElement("div");
  defilant.className = "tableau-defilant";
  defilant.id = corpsId;
  defilant.appendChild(table);
  return defilant;
}

function rendreMetauxBase(metaux) {
  const conteneur = document.querySelector("[data-banque=base]");
  if (!conteneur) return;
  conteneur.replaceChildren(construireTable("table-base", metaux));
}

function rendreMetauxApport(apports) {
  const conteneur = document.querySelector("[data-banque=apport]");
  if (!conteneur) return;
  conteneur.replaceChildren();
  for (const { bucket, cle } of GROUPES_APPORT) {
    const sousListe = apports.filter((a) => bucketsDetectes(a).includes(bucket));
    const titre = document.createElement("h3");
    titre.className = "tableau-groupe__titre";
    titre.textContent = t(cle);
    conteneur.append(titre, construireTable(`table-apport-${bucket}`, sousListe));
  }
}

async function init() {
  try {
    await chargerChaines("fr");
    appliquerChaines();
    rendreCompteur();
    const banque = await fetch("assets/data/data.json").then((r) => r.json());
    rendreMetauxBase(banque.metaux_base || []);
    rendreMetauxApport(banque.metaux_apport || []);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
