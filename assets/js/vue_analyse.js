// =========================================================================
// vue_analyse.js - rendu de la section Analyse (Schaeffler + apports).
// Partagé par parametres.js : la section #analyse vit désormais sur la même
// page que la saisie DMOS (CLAUDE.md #24), état transmis en mémoire (plus
// de sessionStorage pour ce flux). Logique métier déléguée à assets/js/core/.
// =========================================================================

import { t } from "./ui/i18n.js";
import { envoyerEvenement } from "./ui/analytics.js";
import { creerDiagramme } from "./ui/schaeffler_svg.js?v=20260824-reglages-3";
import {
  crEqSchaeffler, niEqSchaeffler,
  crEqDeLong, niEqDeLong,
} from "./core/equivalents.js";
import { joint, melangeBases } from "./core/dilution.js";
import { ferriteSchaeffler, verdictSchaeffler, niveauIdeal } from "./core/schaeffler.js";
import { meilleursApports } from "./core/selection_apport.js";
import { estDuplex } from "./core/perimetre.js";
import { aiguille } from "./core/aiguillage.js";
import { ceIIW, ceqSeferian, tpSeferian } from "./core/carbone_eq.js";
import { ceqBWRA, tpBWRA } from "./core/bwra.js";
import { choisirMethodePreachauffe, MESSAGES_METHODE, calculerCeqCompense, traduireEnrobage } from "./core/prechauffe.js";

const $ = (s) => document.querySelector(s);

// Zone S (dernier recours) : overlay digitalisé du diagramme papier de
// référence - cf. schaeffler_svg.js / core/schaeffler.js (niveauIdeal).
const TITRE_ZONE_S =
  "Zone neutre - dernier recours : vigilance fissuration à chaud côté haut du S (proche 100 % austénite).";

// Titre (tooltip) du badge verdict : source duplex si applicable, sinon
// rappel zone S si le niveau retourné est ce dernier recours.
function titreVerdict(v) {
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
let apportManuel = null; // candidat temporaire injecté dans le même classement
let MODE = { duplexEnBase: false, type: "inox" }; // cf. determinerMode()

function codeProcedeApport(procede) {
  return { "111": "111_EE", "141": "141_TIG", "131": "131_MIG", "135": "135_MAG" }[procede];
}

// Le duplex est seulement détecté pour bloquer le classement hors périmètre.
// L'aiguillage carbone/hétérogène/inox décide ensuite si Schaeffler s'applique.
function determinerMode() {
  const duplexEnBase = estDuplex(A.designation) || estDuplex(B.designation);
  const { type } = aiguille(A.comp, B.comp);
  return { duplexEnBase, type };
}

// Équivalents actifs d'une composition (Schaeffler et DeLong).
function equivalents(comp) {
  return {
    S: { cr: crEqSchaeffler(comp), ni: niEqSchaeffler(comp) },
    De: { cr: crEqDeLong(comp), ni: niEqDeLong(comp) },
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

function ferriteDisponible(valeur) {
  return Number.isFinite(valeur);
}

function texteFerrite(valeur) {
  return ferriteDisponible(valeur)
    ? `${valeur.toFixed(1)} ${t("analyse.lbl_ferrite")}`
    : t("analyse.ferrite_hors_domaine");
}

function tooltip(m) {
  return [
    m.designation + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
    `${t("analyse.lbl_creq")} ${m.eq.S.cr.toFixed(2)}`,
    `${t("analyse.lbl_nieq")} ${m.eq.S.ni.toFixed(2)}`,
    texteFerrite(m.ferrite),
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

// --- Aiguillage carbone/hétérogène/inox (CLAUDE.md #32) -----------------
// Bascule les cartes Diagramme/Synthèse Schaeffler et l'encart carbone
// selon MODE.type. Le tableau des 7 apports gère sa propre carte dans
// majMeilleursApports() (cascade duplex-en-base -> carbone -> normal).
function majModeAffichage() {
  const carteDiagramme = $("[data-carte=diagramme]");
  const carteSynthese = $("[data-carte=synthese]");
  const carteCarbone = $("[data-carte=carbone]");
  const noteHeterogene = $("[data-heterogene-note]");
  const intro = $("[data-analyse-intro]");

  const carbone = MODE.type === "carbone";
  if (carteDiagramme) carteDiagramme.hidden = carbone;
  if (carteSynthese) carteSynthese.hidden = carbone;
  if (carteCarbone) carteCarbone.hidden = !carbone;
  if (noteHeterogene) noteHeterogene.hidden = MODE.type !== "heterogene";
  // Sous-titre de la section : reflète la branche active (Schaeffler pour
  // inox/hétérogène, préchauffe pour carbone) - jamais un texte générique
  // qui mentionnerait les deux systématiquement.
  if (intro) intro.textContent = t(carbone ? "analyse.intro_carbone" : "analyse.intro");

  if (carbone) majCarbone();
}

// Encart carbone/carbone : CE_IIW de chaque métal de base (rappel du seuil
// indicatif 0.42), puis préchauffe - une seule méthode affichée à la fois
// (core/prechauffe.js, CLAUDE.md #32).
function majCarbone() {
  const liste = $("[data-liste=carbone-ce]");
  if (!liste) return;
  liste.replaceChildren();
  for (const m of [A, B]) {
    const dt = document.createElement("dt");
    dt.textContent = m.designation + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : "");
    const dd = document.createElement("dd");
    dd.textContent = `${t("analyse.lbl_ce_iiw")} ${ceIIW(m.comp).toFixed(4)} %`;
    liste.append(dt, dd);
  }

  // choisirMethodePreachauffe() se pilote par typeElectrode (rutile/basique,
  // traduit depuis ETAT.enrobage par traduireEnrobage() - core/prechauffe.js),
  // pas par classeHydrogene. BWRA s'active donc désormais dès que le procédé
  // est 111, quel que soit l'enrobage choisi (traduireEnrobage ne renvoie
  // null que si ETAT.enrobage lui-même est null). classeHydrogene reste
  // séparément non collectée (aucun champ dédié dans le formulaire ni la
  // banque d'apports) - toujours null, n'affecte que la correction CEQ
  // (ajusterParHydrogeneSecurise), jamais le choix de méthode.
  const typeElectrode = traduireEnrobage(ETAT.enrobage);
  const classeHydrogene = null;
  const methode = choisirMethodePreachauffe(ETAT.procede, typeElectrode);

  const messageMethode = $("[data-methode-message]");
  if (messageMethode) messageMethode.textContent = t(MESSAGES_METHODE[methode]);
  const blocSeferian = $("[data-methode-bloc=seferian]");
  const blocBWRA = $("[data-methode-bloc=bwra]");
  if (blocSeferian) blocSeferian.hidden = methode !== "seferian";
  if (blocBWRA) blocBWRA.hidden = methode !== "bwra";

  if (methode === "seferian") majSeferian(classeHydrogene);
  else majBWRA();
}

function texteTp(tp) {
  return tp == null ? t("analyse.tp_aucun") : `${tp.toFixed(0)} °C`;
}

// Préchauffe Séférian (spec.md §5.3/§6.2) - épaisseur propre à chaque
// métal de base (pas l'épaisseur combinée du joint). calculerCeqCompense
// (core/prechauffe.js) applique la correction épaisseur, et hydrogène
// seulement si classeHydrogene est fournie (jamais aujourd'hui, cf. appelant).
function majSeferian(classeHydrogene) {
  const corps = $("[data-liste=seferian]");
  if (!corps) return;
  corps.replaceChildren();
  const labels = [
    t("analyse.col_metal"), t("analyse.col_ceq_seferian"),
    t("analyse.col_ceqc_seferian"), t("analyse.col_tp"),
  ];
  for (const [m, ep] of [[A, ETAT.epA], [B, ETAT.epB]]) {
    const ceq = ceqSeferian(m.comp);
    const ceqC = calculerCeqCompense(ceq, ep, classeHydrogene);
    const tr = document.createElement("tr");
    ajouterCellules(tr, [
      m.designation + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
      ceq.toFixed(3),
      ceqC.toFixed(3),
      texteTp(tpSeferian(ceqC)),
    ], labels);
    corps.appendChild(tr);
  }
}

// Préchauffe BWRA (core/bwra.js) - appelée uniquement quand
// choisirMethodePreachauffe() a retenu "bwra" (majCarbone()). Compense
// l'épaisseur via TSN comme axe de table, PAS via calculerCeqCompense
// (mécanisme Séférian, cf. carbone_eq.js) - les deux méthodes ne doivent
// pas être mélangées. TSN (épaisseur combinée du joint) partagée entre A
// et B ; Ceq_BWRA propre à chaque métal de base. typeElectrode recalculé
// ici via traduireEnrobage() (core/prechauffe.js, même traduction que le
// gate de majCarbone() - source unique, cf. commentaire sur cette fonction).
function majBWRA() {
  const corps = $("[data-liste=bwra]");
  if (!corps) return;
  corps.replaceChildren();

  const diametre = Number($("#bwra-diametre")?.value) || 4;
  const typeElectrode = traduireEnrobage(ETAT.enrobage);
  const epaisseurs = [ETAT.epA, ETAT.epB];
  const labels = [
    t("analyse.col_metal"), t("analyse.col_ceq_bwra"),
    t("analyse.col_indice_bwra"), t("analyse.col_tp"), t("analyse.col_tracabilite"),
  ];

  for (const m of [A, B]) {
    const ceq = ceqBWRA(m.comp);
    const r = tpBWRA(ceq, typeElectrode, epaisseurs, diametre);
    const tr = document.createElement("tr");
    ajouterCellules(tr, [
      m.designation + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
      ceq.toFixed(3),
      r.indice,
      texteTp(r.valeur),
      r.note,
    ], labels);
    corps.appendChild(tr);
  }
}

// --- Diagramme --------------------------------------------------------
function initDiagramme() {
  const opts = { infobulle: $("[data-infobulle]"), isoLabels: true };
  diagPrincipal = creerDiagramme($("#schaeffler"), ZONES, { cr: ZONES._meta.axes.cr_eq, ni: ZONES._meta.axes.ni_eq }, opts);
}

function majDiagramme() {
  const points = [
    { cr: A.pos[0], ni: A.pos[1], forme: "cercle", couleur: "#4ade80", etiquette: "A", tooltip: tooltip(A) },
    {
      cr: B.pos[0], ni: B.pos[1], forme: "cercle", couleur: "#fb923c", etiquette: "B",
      etiquetteDx: -9, etiquetteDy: -8, etiquetteAncre: "end", tooltip: tooltip(B),
    },
    { cr: D.pos[0], ni: D.pos[1], forme: "carre", couleur: "#cbd5e1", etiquette: "D", tooltip: tooltip(D) },
  ];
  const lignes = [{ de: A.pos, a: B.pos, pointille: true, couleur: "#ffffff", opacite: 0.5, epaisseur: 1.2 }];

  if (selectionC) {
    const C = selectionC.metal;
    const J = selectionC.jointMetal;
    // Convention dilution.js/joint() (inchangée) : ZF = C + d·(Mb − C) -
    // ZF est donc géométriquement sur le segment Mb–C, pas de 3e segment.
    const dilutionPct = ((dA + dB) * 100).toFixed(0);
    points.push({ cr: C.pos[0], ni: C.pos[1], forme: "cercle", couleur: "#c084fc", etiquette: "C", tooltip: tooltip(C) });
    points.push({
      cr: J.pos[0], ni: J.pos[1], forme: "triangle", couleur: "#f87171", tooltip: tooltip(J),
      etiquette: `ZF (${dilutionPct} %)`,
    });
    lignes.push({ de: D.pos, a: C.pos, couleur: "#facc15", epaisseur: 1.2 });
  }
  diagPrincipal.majDynamique(points, lignes);
}

// --- Tableau des 7 meilleurs apports ------------------------------------
function majMeilleursApports() {
  const carteApports = $("[data-carte=apports]");
  const corps = $("[data-liste=apports]");
  const zoneTableau = $("[data-zone-apports]");
  const noteApports = $("[data-apports-note]");
  const messageIndispo = $("[data-duplex-indisponible]");
  const aide = $("[data-aide-dilution]");
  corps.replaceChildren();

  // Un métal de base duplex bloque le classement : aucun moteur de secours.
  const baseDuplex = estDuplex(A.designation) || estDuplex(B.designation);
  if (baseDuplex) {
    if (carteApports) carteApports.hidden = false;
    if (zoneTableau) zoneTableau.hidden = true;
    if (noteApports) noteApports.hidden = true;
    if (messageIndispo) messageIndispo.hidden = false;
    if (aide) aide.hidden = true;
    return;
  }

  // 2) CLAUDE.md #32 : aciers non/faiblement alliés des deux côtés - le
  // diagramme de Schaeffler (et donc la sélection d'apport par proximité de
  // zone) ne s'applique pas. Carte entière masquée, cf. majModeAffichage().
  if (MODE.type === "carbone") {
    if (carteApports) carteApports.hidden = true;
    return;
  }

  if (carteApports) carteApports.hidden = false;
  if (zoneTableau) zoneTableau.hidden = false;
  if (noteApports) noteApports.hidden = false;
  if (messageIndispo) messageIndispo.hidden = true;

  // Classement : verdict puis distance au centre. Les candidats duplex sont
  // exclus car cette famille est hors périmètre du moteur actuel.
  const apportsVisibles = (BANQUE.metaux_apport || []).filter((a) => !estDuplex(a.designation));

  const rows = meilleursApports(apportsVisibles, ETAT.procede, {
    A: A.comp, B: B.comp, dA, dB, dC,
    centre: ZONES.centre_ideal,
    joint, crEq: crEqSchaeffler, niEq: niEqSchaeffler, ferrite: ferriteSchaeffler,
    niveauIdeal, zones: ZONES.zones, zoneS: ZONES.zone_s,
    apportsSupplementaires: apportManuel ? [apportManuel] : [],
    forcerSupplementaires: true,
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
    if (aide) aide.hidden = false;
    return;
  }

  let uneIdeale = false;
  rows.forEach((r) => {
    const crAff = r.crEq;
    const niAff = r.niEq;
    const ferAff = r.ferrite;
    const v = verdictSchaeffler(r.crEq, r.niEq, r.joint, ZONES.zones, ZONES.zone_s);
    const tr = document.createElement("tr");
    tr.className = "apport-ligne";
    tr.tabIndex = 0;
    tr.dataset.index = String(r.index);
    ajouterCellules(
      tr,
      [
        String(r.rangGlobal),
        r.origine === "manuel" ? `${r.designation} · ${t("analyse.apport_manuel_badge")}` : r.designation,
        crAff.toFixed(2), niAff.toFixed(2),
        ferriteDisponible(ferAff) ? `${ferAff.toFixed(1)} %` : "—", r.distance.toFixed(2),
      ],
      [
        t("analyse.col_rang"), t("analyse.col_designation"), t("analyse.col_creq"),
        t("analyse.col_nieq"), t("analyse.col_ferrite"), t("analyse.col_distance"),
      ]
    );
    if (v.niveau === "ideal") uneIdeale = true;
    const tdV = document.createElement("td");
    tdV.dataset.label = t("analyse.col_verdict");
    tdV.appendChild(badgeVerdict(v.niveau, titreVerdict(v), noteLimiteFerrite(ferAff)));
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
  definirC(r.composition, r.designation, r.origine === "manuel");
  envoyerEvenement("analyse-realisee", "Sélection d'un apport");
  envoyerEvenementAnalyse(r.designation);
}

// Événement dédié par nuance d'apport (en plus du compteur générique
// "analyse-realisee" ci-dessus) : permet de savoir quels apports sont
// réellement choisis dans le tableau des 7 meilleurs, pas seulement qu'un
// choix a eu lieu.
function envoyerEvenementAnalyse(nomApport) {
  envoyerEvenement(
    "analyse-effectuee/" + encodeURIComponent(nomApport),
    "Analyse effectuée : " + nomApport
  );
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
  const ferJ = J.ferrite;
  const v = verdictSchaeffler(J.eq.S.cr, J.eq.S.ni, J.comp, ZONES.zones, ZONES.zone_s);
  const justif = [texteFerrite(ferJ)];
  const risquesCle = {
    austenite_pure: "analyse.risque_austenite",
    martensite: "analyse.risque_martensite",
    sigma: "analyse.risque_sigma",
    grossissement_grain: "analyse.risque_grossissement_grain",
  };
  for (const rq of v.risques) justif.push(t(risquesCle[rq]));

  const bloc = document.createElement("div");
  bloc.className = "synth-verdict";
  bloc.appendChild(badgeVerdict(v.niveau, titreVerdict(v), noteLimiteFerrite(ferJ)));
  bloc.appendChild(noteTexte(justif.join(" · ")));
  zoneVerdict.replaceChildren(bloc);
}

function ligneValeurs(label, m) {
  const tr = document.createElement("tr");
  ajouterCellules(tr, [
    label + (m.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""),
    m.eq.S.cr.toFixed(2), m.eq.S.ni.toFixed(2),
    m.eq.De.cr.toFixed(2), m.eq.De.ni.toFixed(2),
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
  const nom = $("[data-apport-manuel-nom]");
  nom?.addEventListener("input", onSaisieC);
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
  if (!ETAT || !A || !B) return;
  if (!aValeur) {
    apportManuel = null;
    selectionC = null;
    majMeilleursApports();
    majDiagramme();
    majSynthese();
    return;
  }
  const procedure = codeProcedeApport(ETAT.procede);
  const designation = $("[data-apport-manuel-nom]")?.value.trim() || t("analyse.apport_manuel_defaut");
  apportManuel = { designation, composition: comp, procede: procedure };
  selectionIndex = "manuel-0";
  majMeilleursApports();
  definirC(comp, designation, true);
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
  // Diamètre BWRA : contrôle local à l'Analyse (pas dans ETAT/DMOS), relit
  // sa valeur au changement sans redemander tout le formulaire. Repasse par
  // majCarbone() (pas majBWRA() directement) pour rester cohérent avec le
  // choix de méthode courant.
  $("#bwra-diametre")?.addEventListener("change", () => {
    if (MODE.type === "carbone") majCarbone();
  });
}

// Recalcule et redessine la section Analyse à partir de l'état DMOS courant
// (transmis en mémoire depuis parametres.js, plus de sessionStorage).
export function majAnalyse(etat) {
  ETAT = etat;
  if (apportManuel) apportManuel.procede = codeProcedeApport(ETAT?.procede);
  const pret = ETAT && ETAT.A && ETAT.A.composition && ETAT.B && ETAT.B.composition;
  if (!pret) {
    afficherVide();
    return;
  }
  afficherContenu();
  calculerBase();
  MODE = determinerMode();
  // Rafraîchit le JOINT de l'apport déjà choisi avec la dilution/bases courantes.
  if (selectionC) {
    const jc = joint(A.comp, B.comp, selectionC.metal.comp, dA, dB, dC);
    selectionC.jointMetal = metal(t("analyse.val_joint"), jc);
  }
  majModeAffichage();
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
  const ferJ = J.ferrite;
  const v = verdictSchaeffler(J.eq.S.cr, J.eq.S.ni, J.comp, ZONES.zones, ZONES.zone_s);
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
