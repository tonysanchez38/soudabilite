// =========================================================================
// analyse.js — contrôleur de l'onglet Analyse (Schaeffler + apports).
// Orchestration : lit l'état DMOS (session), calcule équivalents / JOINT /
// ferrite, pilote le diagramme SVG, classe les 7 meilleurs apports et la
// synthèse. La logique métier vit dans assets/js/core/ (spec.md).
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";
import { rendreCompteur } from "./ui/compteur.js";
import { chargerEtat } from "./ui/etat_dmos.js";
import { creerDiagramme } from "./ui/schaeffler_svg.js";
import {
  crEqSchaeffler, niEqSchaeffler,
  crEqDeLong, niEqDeLong,
  crEqWRC, niEqWRC,
} from "./core/equivalents.js";
import { joint, melangeBases } from "./core/dilution.js";
import { ferriteSchaeffler, verdictSchaeffler } from "./core/schaeffler.js";
import { meilleursApports } from "./core/selection_apport.js";

const $ = (s) => document.querySelector(s);

let BANQUE = {};
let ZONES = {};
let ETAT = null;
let diagPrincipal = null;
let diagMini = null;
let A, B, D; // métaux calculés
let dA = 0, dB = 0, dC = 0;
let selectionC = null; // apport choisi (tableau ou saisie libre)

// Équivalents complets d'une composition (Schaeffler / DeLong / WRC-1992).
function equivalents(comp) {
  return {
    S: { cr: crEqSchaeffler(comp), ni: niEqSchaeffler(comp) },
    De: { cr: crEqDeLong(comp), ni: niEqDeLong(comp) },
    W: { cr: crEqWRC(comp), ni: niEqWRC(comp) },
  };
}

function metal(designation, comp, saisieLibre = false) {
  const eq = equivalents(comp);
  return {
    designation: designation || t("analyse.saisie_libre"),
    saisieLibre,
    comp,
    eq,
    ferrite: ferriteSchaeffler(eq.S.cr, eq.S.ni),
    pos: [eq.S.cr, eq.S.ni],
  };
}

function tooltip(m) {
  return [
    m.designation + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
    `${t("analyse.lbl_creq")} ${m.eq.S.cr.toFixed(2)}`,
    `${t("analyse.lbl_nieq")} ${m.eq.S.ni.toFixed(2)}`,
    `${m.ferrite.toFixed(1)} ${t("analyse.lbl_ferrite")}`,
  ];
}

// --- Calcul des métaux de base A, B et du point D_mélange ---------------
function calculerBase() {
  dA = (ETAT.dA || 0) / 100;
  dB = (ETAT.dB || 0) / 100;
  dC = (ETAT.dC || 0) / 100;
  A = metal(ETAT.A.designation, ETAT.A.composition, ETAT.A.saisieLibre);
  B = metal(ETAT.B.designation, ETAT.B.composition, ETAT.B.saisieLibre);
  D = metal(t("analyse.val_dmelange"), melangeBases(A.comp, B.comp, dA, dB));
}

// --- Diagrammes (principal + mini) --------------------------------------
function initDiagrammes() {
  const opts = { infobulle: $("[data-infobulle]"), isoLabels: true };
  diagPrincipal = creerDiagramme($("#schaeffler"), ZONES, { cr: ZONES._meta.axes.cr_eq, ni: ZONES._meta.axes.ni_eq }, { ...opts, cadreZoom: ZONES.zoom });
  diagMini = creerDiagramme($("#schaeffler-mini"), ZONES, { cr: ZONES.zoom.cr_eq, ni: ZONES.zoom.ni_eq }, { infobulle: opts.infobulle, isoLabels: false });
}

function majDiagrammes() {
  const points = [
    { cr: A.pos[0], ni: A.pos[1], forme: "cercle", couleur: "#22c55e", tooltip: tooltip(A) },
    { cr: B.pos[0], ni: B.pos[1], forme: "cercle", couleur: "#f97316", tooltip: tooltip(B) },
    { cr: D.pos[0], ni: D.pos[1], forme: "carre", couleur: "#94a3b8", tooltip: tooltip(D) },
  ];
  const lignes = [{ de: A.pos, a: B.pos, pointille: true, couleur: "#94a3b8", epaisseur: 1.2 }];

  if (selectionC) {
    const C = selectionC.metal;
    const J = selectionC.jointMetal;
    points.push({ cr: C.pos[0], ni: C.pos[1], forme: "cercle", couleur: "#a855f7", tooltip: tooltip(C) });
    points.push({ cr: J.pos[0], ni: J.pos[1], forme: "triangle", couleur: "#ef4444", tooltip: tooltip(J) });
    lignes.push({ de: D.pos, a: C.pos, pointille: true, couleur: "#38bdf8", epaisseur: 1.2 });
    lignes.push({ de: D.pos, a: J.pos, fleche: true, couleur: "#38bdf8", epaisseur: 2.4 });
  }
  diagPrincipal.majDynamique(points, lignes);
  diagMini.majDynamique(points, lignes);
}

// --- Tableau des 7 meilleurs apports ------------------------------------
function majMeilleursApports() {
  const corps = $("[data-liste=apports]");
  corps.replaceChildren();
  const rows = meilleursApports(BANQUE.metaux_apport, ETAT.procede, {
    A: A.comp, B: B.comp, dA, dB, dC,
    centre: ZONES.centre_ideal,
    joint, crEq: crEqSchaeffler, niEq: niEqSchaeffler, ferrite: ferriteSchaeffler,
    n: 7,
  });

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "note";
    td.textContent = t("analyse.apports_vide");
    tr.appendChild(td);
    corps.appendChild(tr);
    return;
  }

  rows.forEach((r, i) => {
    const v = verdictSchaeffler(r.crEq, r.niEq, ZONES.zones, ZONES.overlays);
    const tr = document.createElement("tr");
    tr.className = "apport-ligne";
    tr.tabIndex = 0;
    tr.dataset.index = String(r.index);
    ajouterCellules(tr, [
      String(i + 1),
      r.designation,
      r.crEq.toFixed(2),
      r.niEq.toFixed(2),
      `${r.ferrite.toFixed(1)} %`,
      r.distance.toFixed(2),
    ]);
    const tdV = document.createElement("td");
    tdV.appendChild(badgeVerdict(v.niveau));
    tr.appendChild(tdV);
    tr.addEventListener("click", () => choisirApport(r, tr));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisirApport(r, tr); }
    });
    corps.appendChild(tr);
  });
}

function ajouterCellules(tr, valeurs) {
  for (const val of valeurs) {
    const td = document.createElement("td");
    td.textContent = val;
    tr.appendChild(td);
  }
}

function badgeVerdict(niveau) {
  const map = {
    ideal: { cls: "verdict--ok", icone: "✓", cle: "analyse.verdict_ideal" },
    acceptable: { cls: "verdict--attention", icone: "⚠", cle: "analyse.verdict_acceptable" },
    hors: { cls: "verdict--refus", icone: "✗", cle: "analyse.verdict_hors" },
  };
  const d = map[niveau] || map.hors;
  const span = document.createElement("span");
  span.className = `verdict ${d.cls}`;
  const ic = document.createElement("span");
  ic.className = "verdict__icone";
  ic.textContent = d.icone;
  const tx = document.createElement("span");
  tx.textContent = t(d.cle);
  span.append(ic, tx);
  return span;
}

// --- Choix d'un apport (tableau ou saisie libre) ------------------------
function definirC(comp, designation, saisieLibre) {
  const C = metal(designation, comp, saisieLibre);
  const jc = joint(A.comp, B.comp, comp, dA, dB, dC);
  const J = metal(t("analyse.val_joint"), jc);
  selectionC = { metal: C, jointMetal: J };
  majDiagrammes();
  majSynthese();
}

function choisirApport(r, tr) {
  document.querySelectorAll(".apport-ligne.is-active").forEach((e) => e.classList.remove("is-active"));
  if (tr) tr.classList.add("is-active");
  definirC(r.composition, r.designation, false);
}

// --- Synthèse Schaeffler ------------------------------------------------
function majSynthese() {
  const zoneVerdict = $("[data-synth=verdict]");
  const corps = $("[data-synth=valeurs]");
  corps.replaceChildren();

  const lignes = [
    [t("analyse.val_metalA"), A],
    [t("analyse.val_metalB"), B],
    [t("analyse.val_dmelange"), D],
  ];
  if (selectionC) {
    lignes.push([t("analyse.val_apportC"), selectionC.metal]);
    lignes.push([t("analyse.val_joint"), selectionC.jointMetal]);
  }
  for (const [label, m] of lignes) corps.appendChild(ligneValeurs(label, m));

  if (!selectionC) {
    zoneVerdict.replaceChildren(noteTexte(t("analyse.synth_choisir")));
    return;
  }
  const J = selectionC.jointMetal;
  const v = verdictSchaeffler(J.eq.S.cr, J.eq.S.ni, ZONES.zones, ZONES.overlays);
  const justif = [`${J.ferrite.toFixed(1)} ${t("analyse.lbl_ferrite")}`];
  const risquesCle = {
    austenite_pure: "analyse.risque_austenite",
    martensite: "analyse.risque_martensite",
    sigma: "analyse.risque_sigma",
    grossissement_grain: "analyse.risque_grossissement_grain",
  };
  for (const rq of v.risques) justif.push(t(risquesCle[rq]));

  const bloc = document.createElement("div");
  bloc.className = "synth-verdict";
  bloc.appendChild(badgeVerdict(v.niveau));
  bloc.appendChild(noteTexte(justif.join(" · ")));
  zoneVerdict.replaceChildren(bloc);
}

function ligneValeurs(label, m) {
  const tr = document.createElement("tr");
  ajouterCellules(tr, [
    label + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
    m.eq.S.cr.toFixed(2), m.eq.S.ni.toFixed(2),
    m.eq.De.cr.toFixed(2), m.eq.De.ni.toFixed(2),
    m.eq.W.cr.toFixed(2), m.eq.W.ni.toFixed(2),
  ]);
  return tr;
}

function noteTexte(txt) {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = txt;
  return p;
}

// --- Saisie manuelle d'un apport C --------------------------------------
function construireBlocC() {
  const conteneur = $("[data-comp=c]");
  if (!conteneur) return;
  const elements = t("analyse.elements_comp") || [];
  const grille = document.createElement("div");
  grille.className = "comp-grille";
  for (const el of elements) {
    const champ = document.createElement("label");
    champ.className = "comp-champ";
    const span = document.createElement("span");
    span.className = "comp-champ__label";
    span.textContent = `%${el}`;
    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.step = "0.001"; input.inputMode = "decimal";
    input.className = "comp-champ__input";
    input.dataset.compInputC = el;
    input.addEventListener("input", onSaisieC);
    champ.append(span, input);
    grille.appendChild(champ);
  }
  conteneur.appendChild(grille);
}

function onSaisieC() {
  const comp = {};
  let aValeur = false;
  document.querySelectorAll("[data-comp-input-c]").forEach((i) => {
    const x = parseFloat(i.value);
    if (Number.isFinite(x)) { comp[i.dataset.compInputC] = x; aValeur = true; }
  });
  document.querySelectorAll(".apport-ligne.is-active").forEach((e) => e.classList.remove("is-active"));
  if (aValeur) definirC(comp, null, true);
}

// --- Initialisation -----------------------------------------------------
function afficherVide() {
  $("[data-analyse=contenu]").hidden = true;
  $("[data-analyse=vide]").hidden = false;
}

async function init() {
  try {
    await chargerChaines("fr");
    appliquerChaines();

    const [banque, zones] = await Promise.all([
      fetch("assets/data/data.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("assets/data/zones_schaeffler.json", { cache: "no-cache" }).then((r) => r.json()),
    ]);
    BANQUE = banque;
    ZONES = zones;
    ETAT = chargerEtat();

    const pret = ETAT && ETAT.A && ETAT.A.composition && ETAT.B && ETAT.B.composition;
    if (!pret) {
      afficherVide();
      rendreCompteur();
      return;
    }

    calculerBase();
    initDiagrammes();
    construireBlocC();
    majMeilleursApports();
    majDiagrammes();
    majSynthese();

    $("[data-toggle-comp-c]")?.addEventListener("click", (e) => {
      const bloc = $("[data-comp=c]");
      bloc.hidden = !bloc.hidden;
      e.currentTarget.setAttribute("aria-expanded", String(!bloc.hidden));
    });

    rendreCompteur();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
