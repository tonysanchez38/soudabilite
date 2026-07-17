// =========================================================================
// vue_analyse.js - rendu de la section Analyse (Schaeffler + apports).
// Partagé par parametres.js : la section #analyse vit désormais sur la même
// page que la saisie DMOS (CLAUDE.md #24), état transmis en mémoire (plus
// de sessionStorage pour ce flux). Logique métier déléguée à assets/js/core/.
// =========================================================================

import { t } from "./ui/i18n.js";
import { creerDiagramme } from "./ui/schaeffler_svg.js";
import {
  crEqSchaeffler, niEqSchaeffler,
  crEqDeLong, niEqDeLong,
  crEqWRC, niEqWRC,
} from "./core/equivalents.js";
import { joint, melangeBases } from "./core/dilution.js";
import { ferriteSchaeffler, verdictSchaeffler, niveauIdeal } from "./core/schaeffler.js";
import { meilleursApports } from "./core/selection_apport.js";
import { estDuplex, verdictDuplex, ferriteApproxWRC, SOURCE_DUPLEX_IDEAL } from "./core/famille_alliage.js";
import { DUPLEX_VISIBLE } from "./core/config.js";

const $ = (s) => document.querySelector(s);

// Zone S (dernier recours) : overlay digitalisé du diagramme papier de
// référence - cf. schaeffler_svg.js / core/schaeffler.js (niveauIdeal).
const TITRE_ZONE_S =
  "Zone neutre - dernier recours : vigilance fissuration à chaud côté haut du S (proche 100 % austénite).";

// Titre (tooltip) du badge verdict : source duplex si applicable, sinon
// rappel zone S si le niveau retourné est ce dernier recours.
function titreVerdict(v, duplex) {
  if (duplex) return SOURCE_DUPLEX_IDEAL;
  if (v.niveau === "zone_s") return TITRE_ZONE_S;
  return null;
}

let BANQUE = {};
let ZONES = {};
let ETAT = null;
let diagPrincipal = null;
let A, B, D; // métaux calculés
let dA = 0, dB = 0, dC = 0;
let selectionC = null; // apport choisi (tableau ou saisie libre)
let selectionIndex = null; // index (BANQUE.metaux_apport) de l'apport choisi au tableau

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

// Construit une carte d'explication (titre + texte) depuis fr.json
// (contenu statique, indépendant de ETAT - même pattern que rendreNormes()/
// rendreOnglets() dans app.js). Réutilisé pour "zones-explication" et
// "mecanismes", qui partagent le même gabarit.
function rendreExplications(selecteur, cle) {
  const conteneur = $(`[data-liste=${selecteur}]`);
  if (!conteneur) return;
  const items = t(`analyse.${cle}`) || [];
  conteneur.replaceChildren();
  items.forEach((z) => {
    const bloc = document.createElement("div");
    bloc.className = "zones-explication__item";

    const titre = document.createElement("h3");
    titre.className = "zones-explication__titre";
    titre.textContent = z.titre;

    const texte = document.createElement("p");
    texte.className = "zones-explication__texte";
    texte.textContent = z.texte;

    bloc.append(titre, texte);
    conteneur.appendChild(bloc);
  });
}

// Construit la liste à puces de l'étagement des trois bandes de sécurité
// (rendu <li><strong>titre</strong> texte</li>, pas des cartes).
function rendreEtagement() {
  const liste = $("[data-liste=etagement]");
  if (!liste) return;
  const items = t("analyse.etagement") || [];
  liste.replaceChildren();
  items.forEach((z) => {
    const li = document.createElement("li");
    const fort = document.createElement("strong");
    fort.textContent = z.titre;
    li.append(fort, ` ${z.texte}`);
    liste.appendChild(li);
  });
}

// --- Diagramme --------------------------------------------------------
function initDiagramme() {
  const opts = { infobulle: $("[data-infobulle]"), isoLabels: true };
  diagPrincipal = creerDiagramme($("#schaeffler"), ZONES, { cr: ZONES._meta.axes.cr_eq, ni: ZONES._meta.axes.ni_eq }, opts);
}

function majDiagramme() {
  const points = [
    { cr: A.pos[0], ni: A.pos[1], forme: "cercle", couleur: "#4ade80", tooltip: tooltip(A) },
    { cr: B.pos[0], ni: B.pos[1], forme: "cercle", couleur: "#fb923c", tooltip: tooltip(B) },
    { cr: D.pos[0], ni: D.pos[1], forme: "carre", couleur: "#cbd5e1", tooltip: tooltip(D) },
  ];
  const lignes = [{ de: A.pos, a: B.pos, pointille: true, couleur: "#ffffff", opacite: 0.5, epaisseur: 1.2 }];

  if (selectionC) {
    const C = selectionC.metal;
    const J = selectionC.jointMetal;
    // Convention dilution.js/joint() (inchangée) : ZF = C + d·(Mb − C) -
    // ZF est donc géométriquement sur le segment Mb–C, pas de 3e segment.
    const dilutionPct = ((dA + dB) * 100).toFixed(0);
    points.push({ cr: C.pos[0], ni: C.pos[1], forme: "cercle", couleur: "#c084fc", tooltip: tooltip(C) });
    points.push({
      cr: J.pos[0], ni: J.pos[1], forme: "triangle", couleur: "#f87171", tooltip: tooltip(J),
      etiquette: `ZF - dilution ${dilutionPct}%`,
    });
    lignes.push({ de: D.pos, a: C.pos, couleur: "#facc15", epaisseur: 1.2 });
  }
  diagPrincipal.majDynamique(points, lignes);
}

// --- Tableau des 7 meilleurs apports ------------------------------------
function majMeilleursApports() {
  const corps = $("[data-liste=apports]");
  corps.replaceChildren();
  // Classement/ranking : rang du verdict (idéale > acceptable > zone S >
  // hors) puis distance à centre_ideal à l'intérieur de chaque groupe (la
  // cible duplex 35-65 % ferrite n'est pas concernée par ce tri - cf.
  // classification par ligne, calculée séparément ci-dessous).
  // DUPLEX_VISIBLE (CLAUDE.md #29) : les apports duplex/superduplex sont
  // masqués de la sélection tant que les iso-FN WRC-1992 ne sont pas
  // digitalisées - ne retire aucun code duplex, seulement la liste passée
  // à meilleursApports() (le tri/verdict duplex reste actif si A ou B
  // lui-même est duplex, cf. duplexBase dans selection_apport.js).
  const apportsVisibles = DUPLEX_VISIBLE
    ? BANQUE.metaux_apport
    : (BANQUE.metaux_apport || []).filter((a) => !estDuplex(a.designation));

  const rows = meilleursApports(apportsVisibles, ETAT.procede, {
    A: A.comp, B: B.comp, dA, dB, dC,
    centre: ZONES.centre_ideal,
    joint, crEq: crEqSchaeffler, niEq: niEqSchaeffler, ferrite: ferriteSchaeffler,
    niveauIdeal, zones: ZONES.zones, zoneS: ZONES.zone_s,
    estDuplex, verdictDuplex, ferriteApproxWRC, crEqWRC, niEqWRC,
    designationA: A.designation, designationB: B.designation,
    n: 7,
  });

  const aide = $("[data-aide-dilution]");
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "note";
    td.textContent = t("analyse.apports_vide");
    tr.appendChild(td);
    corps.appendChild(tr);
    if (aide) aide.hidden = false;
    return;
  }

  let uneIdeale = false;
  rows.forEach((r, i) => {
    const duplex = r.duplex; // même source que le tri - zéro divergence possible
    let crAff, niAff, ferAff, v;
    if (duplex) {
      crAff = crEqWRC(r.joint);
      niAff = niEqWRC(r.joint);
      ferAff = ferriteApproxWRC(crAff, niAff);
      v = verdictDuplex(ferAff);
    } else {
      crAff = r.crEq;
      niAff = r.niEq;
      ferAff = r.ferrite;
      v = verdictSchaeffler(r.crEq, r.niEq, r.joint, ZONES.zones, ZONES.zone_s);
    }
    const tr = document.createElement("tr");
    tr.className = "apport-ligne";
    tr.tabIndex = 0;
    tr.dataset.index = String(r.index);
    ajouterCellules(
      tr,
      [String(i + 1), r.designation, crAff.toFixed(2), niAff.toFixed(2), `${ferAff.toFixed(1)} %`, r.distance.toFixed(2)],
      [
        t("analyse.col_rang"), t("analyse.col_designation"), t("analyse.col_creq"),
        t("analyse.col_nieq"), t("analyse.col_ferrite"), t("analyse.col_distance"),
      ]
    );
    if (v.niveau === "ideal") uneIdeale = true;
    const tdV = document.createElement("td");
    tdV.dataset.label = t("analyse.col_verdict");
    tdV.appendChild(badgeVerdict(v.niveau, titreVerdict(v, duplex), noteLimiteFerrite(ferAff)));
    tr.appendChild(tdV);
    if (selectionIndex != null && r.index === selectionIndex) tr.classList.add("is-active");
    tr.addEventListener("click", () => choisirApport(r, tr));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisirApport(r, tr); }
    });
    corps.appendChild(tr);
  });
  if (aide) aide.hidden = uneIdeale;
}

// labels : en-têtes traduits, alignés positionnellement avec valeurs -
// posés en data-label pour l'empilement mobile (::before, main.css).
function ajouterCellules(tr, valeurs, labels = null) {
  valeurs.forEach((val, i) => {
    const td = document.createElement("td");
    td.textContent = val;
    if (labels && labels[i]) td.dataset.label = labels[i];
    tr.appendChild(td);
  });
}

// Écart à la zone idéale (5-15 % ferrite) quand le joint en est proche sans
// l'atteindre : rassure l'utilisateur ("à 0,2 point de la cible") au lieu
// de le laisser croire que l'apport est simplement écarté. Bornes strictes
// [4,5[ et ]15,16] - le seuil normatif 5-15 % lui-même n'est pas modifié.
function noteLimiteFerrite(ferrite) {
  let cle = null;
  if (ferrite >= 4.0 && ferrite < 5.0) cle = "analyse.limite_ideale_basse";
  else if (ferrite > 15.0 && ferrite <= 16.0) cle = "analyse.limite_ideale_haute";
  // Le % ferrite lui-même est déjà affiché dans sa colonne dédiée (tableau
  // des apports) ou dans la ligne justificative (synthèse) - pas la peine
  // de le répéter ici.
  return cle ? t(cle) : null;
}

function badgeVerdict(niveau, titre = null, note = null) {
  const map = {
    ideal: { cls: "verdict--ok", icone: "✓", cle: "analyse.verdict_ideal" },
    acceptable: { cls: "verdict--attention", icone: "⚠", cle: "analyse.verdict_acceptable" },
    zone_s: { cls: "verdict--neutre", icone: "•", cle: "analyse.verdict_zone_s" },
    hors: { cls: "verdict--refus", icone: "✗", cle: "analyse.verdict_hors" },
  };
  const d = map[niveau] || map.hors;
  const span = document.createElement("span");
  span.className = `verdict ${d.cls}`;
  if (titre) span.title = titre;
  const ic = document.createElement("span");
  ic.className = "verdict__icone";
  ic.textContent = d.icone;
  const tx = document.createElement("span");
  tx.textContent = t(d.cle);
  span.append(ic, tx);
  if (note) {
    const nt = document.createElement("span");
    nt.className = "verdict__note";
    nt.textContent = ` (${note})`;
    span.appendChild(nt);
  }
  return span;
}

// --- Choix d'un apport (tableau ou saisie libre) ------------------------
function definirC(comp, designation, saisieLibre) {
  const C = metal(designation, comp, saisieLibre);
  const jc = joint(A.comp, B.comp, comp, dA, dB, dC);
  const J = metal(t("analyse.val_joint"), jc);
  selectionC = { metal: C, jointMetal: J };
  majDiagramme();
  majSynthese();
}

function choisirApport(r, tr) {
  selectionIndex = r.index;
  document.querySelectorAll(".apport-ligne.is-active").forEach((e) => e.classList.remove("is-active"));
  if (tr) tr.classList.add("is-active");
  definirC(r.composition, r.designation, false);
  if (window.goatcounter && typeof window.goatcounter.count === "function") {
    window.goatcounter.count({ path: "analyse-realisee", title: "Sélection d'un apport", event: true });
  }
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
  const duplex = estDuplex(A.designation) || estDuplex(B.designation) || estDuplex(selectionC.metal.designation);
  let ferJ, v;
  if (duplex) {
    const crJ = crEqWRC(J.comp);
    const niJ = niEqWRC(J.comp);
    ferJ = ferriteApproxWRC(crJ, niJ);
    v = verdictDuplex(ferJ);
  } else {
    ferJ = J.ferrite;
    v = verdictSchaeffler(J.eq.S.cr, J.eq.S.ni, J.comp, ZONES.zones, ZONES.zone_s);
  }
  const justif = [`${ferJ.toFixed(1)} ${t("analyse.lbl_ferrite")}`];
  const risquesCle = {
    austenite_pure: "analyse.risque_austenite",
    martensite: "analyse.risque_martensite",
    sigma: "analyse.risque_sigma",
    grossissement_grain: "analyse.risque_grossissement_grain",
  };
  for (const rq of v.risques) justif.push(t(risquesCle[rq]));

  const bloc = document.createElement("div");
  bloc.className = "synth-verdict";
  bloc.appendChild(badgeVerdict(v.niveau, titreVerdict(v, duplex), noteLimiteFerrite(ferJ)));
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
  selectionIndex = null;
  document.querySelectorAll(".apport-ligne.is-active").forEach((e) => e.classList.remove("is-active"));
  if (aValeur) definirC(comp, null, true);
}

// --- Affichage vide / contenu -------------------------------------------
function afficherVide() {
  $("[data-analyse=contenu]").hidden = true;
  $("[data-analyse=vide]").hidden = false;
}

function afficherContenu() {
  $("[data-analyse=contenu]").hidden = false;
  $("[data-analyse=vide]").hidden = true;
}

// --- API publique ---------------------------------------------------------

// Initialise le diagramme et le bloc de saisie manuelle de l'apport C.
// À appeler une fois, après le chargement de la banque et des zones.
export function initAnalyse(banque, zones) {
  BANQUE = banque;
  ZONES = zones;
  initDiagramme();
  rendreExplications("zones-explication", "zones_explication");
  rendreExplications("mecanismes", "mecanismes");
  rendreEtagement();
  construireBlocC();
  $("[data-toggle-comp-c]")?.addEventListener("click", (e) => {
    const bloc = $("[data-comp=c]");
    bloc.hidden = !bloc.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!bloc.hidden));
  });
}

// Recalcule et redessine la section Analyse à partir de l'état DMOS courant
// (transmis en mémoire depuis parametres.js, plus de sessionStorage).
export function majAnalyse(etat) {
  ETAT = etat;
  const pret = ETAT && ETAT.A && ETAT.A.composition && ETAT.B && ETAT.B.composition;
  if (!pret) {
    afficherVide();
    return;
  }
  afficherContenu();
  calculerBase();
  // Rafraîchit le JOINT de l'apport déjà choisi avec la dilution/bases courantes.
  if (selectionC) {
    const jc = joint(A.comp, B.comp, selectionC.metal.comp, dA, dB, dC);
    selectionC.jointMetal = metal(t("analyse.val_joint"), jc);
  }
  majMeilleursApports();
  majDiagramme();
  majSynthese();
}

// Résumé de l'apport C actuellement retenu, pour la fiche imprimable
// (parametres.js) - même calcul de verdict que majSynthese(), sans DOM.
// Renvoie null si aucun apport n'est sélectionné.
export function resumeApportPourImpression() {
  if (!selectionC) return null;
  const J = selectionC.jointMetal;
  const duplex = estDuplex(A.designation) || estDuplex(B.designation) || estDuplex(selectionC.metal.designation);
  let ferJ, v;
  if (duplex) {
    const crJ = crEqWRC(J.comp);
    const niJ = niEqWRC(J.comp);
    ferJ = ferriteApproxWRC(crJ, niJ);
    v = verdictDuplex(ferJ);
  } else {
    ferJ = J.ferrite;
    v = verdictSchaeffler(J.eq.S.cr, J.eq.S.ni, J.comp, ZONES.zones, ZONES.zone_s);
  }
  const verdictCle = {
    ideal: "analyse.verdict_ideal",
    acceptable: "analyse.verdict_acceptable",
    zone_s: "analyse.verdict_zone_s",
    hors: "analyse.verdict_hors",
  };
  return {
    designation: selectionC.metal.designation,
    saisieLibre: selectionC.metal.saisieLibre,
    crEq: J.eq.S.cr,
    niEq: J.eq.S.ni,
    ferrite: ferJ,
    verdictLabel: t(verdictCle[v.niveau] || verdictCle.hors),
  };
}
