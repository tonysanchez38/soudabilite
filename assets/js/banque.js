// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// banque.js - page Data : tableaux de référence des métaux de base et
// d'apport. Aucune donnée dupliquée en dur : composition lue depuis
// data.json, Cr_eq/Ni_eq recalculés à la volée (equivalents.js), groupes
// de compatibilité procédé recalculés à la volée (bucketsDetectes,
// selection_apport.js). Aucune logique métier propre à ce module.
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";
import { rendreCompteur, rendreCompteurPdf } from "./ui/compteur.js";
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

// Colonnes visibles par défaut : Désignation, Cr_eq, Ni_eq, + une colonne
// bouton (sans intitulé). Groupe ISO et les 10 éléments de composition
// sont repoussés dans la ligne dépliante (ligneDetail) pour éviter le
// scroll horizontal d'un tableau à 14 colonnes.
const NB_COLONNES_VISIBLES = 4;

function enteteColonnes() {
  const cles = ["banque.col_designation", "banque.col_creq", "banque.col_nieq"];
  const ths = cles.map((cle) => {
    const th = document.createElement("th");
    th.textContent = t(cle);
    return th;
  });
  ths.push(document.createElement("th")); // colonne bouton, sans intitulé
  return ths;
}

// Ligne dépliante (masquée par défaut) : Groupe ISO + les 10 éléments de
// composition, en pleine largeur (comp-grille s'adapte à l'espace dispo).
function ligneDetail(metal) {
  const tr = document.createElement("tr");
  tr.className = "banque-detail";
  tr.hidden = true;
  const td = document.createElement("td");
  td.colSpan = NB_COLONNES_VISIBLES;
  const grille = document.createElement("div");
  grille.className = "comp-grille";
  const champs = [
    [t("banque.col_groupe_iso"), metal.groupe_iso_15608 ?? t("banque.non_applicable")],
    ...ELEMENTS.map((e) => [t(COL_ELEMENT[e]), fmt(metal.composition?.[e], 3)]),
  ];
  for (const [libelle, valeur] of champs) {
    const champ = document.createElement("div");
    champ.className = "comp-champ";
    const label = document.createElement("span");
    label.className = "comp-champ__label";
    label.textContent = libelle;
    const val = document.createElement("span");
    val.className = "comp-champ__valeur";
    val.textContent = valeur;
    champ.append(label, val);
    grille.appendChild(champ);
  }
  td.appendChild(grille);
  tr.appendChild(td);
  return tr;
}

function ligneMetal(metal) {
  const cr = crEqSchaeffler(metal.composition);
  const ni = niEqSchaeffler(metal.composition);
  const tr = document.createElement("tr");
  const valeurs = [metal.designation, fmt(cr), fmt(ni)];
  const labels = [t("banque.col_designation"), t("banque.col_creq"), t("banque.col_nieq")];
  valeurs.forEach((val, i) => {
    const td = document.createElement("td");
    td.textContent = val;
    td.dataset.label = labels[i];
    tr.appendChild(td);
  });

  const trDetail = ligneDetail(metal);
  const tdBouton = document.createElement("td");
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "btn-lien";
  bouton.textContent = t("banque.detail_ajouter");
  bouton.addEventListener("click", () => {
    const ouverture = trDetail.hidden;
    trDetail.hidden = !ouverture;
    bouton.textContent = t(ouverture ? "banque.detail_retirer" : "banque.detail_ajouter");
  });
  tdBouton.appendChild(bouton);
  tr.appendChild(tdBouton);

  const frag = document.createDocumentFragment();
  frag.append(tr, trDetail);
  return frag;
}

function construireTable(corpsId, metaux) {
  const table = document.createElement("table");
  table.className = "tableau tableau--banque";
  const thead = document.createElement("thead");
  const trEntete = document.createElement("tr");
  enteteColonnes().forEach((th) => trEntete.appendChild(th));
  thead.appendChild(trEntete);
  const tbody = document.createElement("tbody");
  if (metaux.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = NB_COLONNES_VISIBLES;
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
    rendreCompteurPdf();
    const banque = await fetch("assets/data/data.json").then((r) => r.json());
    rendreMetauxBase(banque.metaux_base || []);
    rendreMetauxApport(banque.metaux_apport || []);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
