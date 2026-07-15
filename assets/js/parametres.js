// =========================================================================
// parametres.js - contrôleur de l'onglet Paramètres DMOS.
// Orchestration uniquement : chargement des données, construction des
// listes, calcul live des paramètres électriques. La logique métier vit
// dans assets/js/core/ (spec.md).
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";
import { rendreCompteur, rendreCompteurAnalyses } from "./ui/compteur.js";
import { creerCombobox } from "./ui/combobox.js";
import {
  intensiteEE,
  intensiteTIG,
  tension,
  energieNominale,
  energieCorrigee,
  rendement,
  VITESSE_INDICATIVE,
} from "./core/energie.js";
import { matiereTIG, estInox } from "./core/aiguillage.js";
import { dilutionValide, dilutionParDefaut } from "./core/dilution.js";
import { crEqSchaeffler, niEqSchaeffler } from "./core/equivalents.js";
import { ceIIW } from "./core/carbone_eq.js";
import { initAnalyse, majAnalyse, resumeApportPourImpression } from "./vue_analyse.js";

let BANQUE = { metaux_base: [], metaux_apport: [], electrodes_tungstene: [] };
let ZONES = {};
let comboA = null;
let comboB = null;
let comboTungstene = null;

// Composition manuelle active par rôle. L'apport C est traité dans l'onglet
// Analyse (résultat Schaeffler), pas ici - cf. CLAUDE.md (architecture Lot 4).
const manuel = { a: false, b: false };

// Devient vrai dès que l'utilisateur touche D_A/D_B/D_C à la main : la
// suggestion de dilution par défaut ne les écrase plus tant que le lien
// « Suggestion procédé » n'est pas actionné.
let dilutionModifieeManuel = false;

// Correspondance rôle → source dans la banque + id du <select>.
const ROLES = {
  a: { selectId: "metal-a", source: "metaux_base" },
  b: { selectId: "metal-b", source: "metaux_base" },
};

// --- Utilitaires DOM ----------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const num = (sel) => parseFloat($(sel)?.value);

function remplirSelectNatif(id, items, valeurDefaut) {
  const el = document.getElementById(id);
  if (!el) return;
  el.replaceChildren();
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    el.appendChild(opt);
  }
  if (valeurDefaut != null) el.value = String(valeurDefaut);
}

// Composition de la nuance sélectionnée dans la banque (ou null si aucune).
function compositionNuance(role) {
  const cfg = ROLES[role];
  const idx = document.getElementById(cfg.selectId)?.value;
  if (idx === "" || idx == null) return null;
  return BANQUE[cfg.source]?.[Number(idx)]?.composition ?? null;
}

// Valeurs saisies dans le bloc composition manuelle d'un rôle.
function lireCompManuelle(role) {
  const vals = {};
  let aUneValeur = false;
  document.querySelectorAll(`[data-comp-input="${role}"]`).forEach((input) => {
    const x = parseFloat(input.value);
    if (Number.isFinite(x)) {
      vals[input.dataset.elem] = x;
      aUneValeur = true;
    }
  });
  return { vals, aUneValeur };
}

// Composition effective d'un rôle. La banque (data.json) est en lecture
// seule : la saisie manuelle ne la modifie jamais. Quand le bloc est ouvert,
// les champs (pré-remplis depuis la nuance) SONT la composition de calcul de
// la session. saisieLibre = composition manuelle sans nuance sélectionnée.
function compositionEffective(role) {
  const base = compositionNuance(role);
  if (!manuel[role]) return { comp: base, saisieLibre: false };
  const { vals, aUneValeur } = lireCompManuelle(role);
  const comp = aUneValeur ? vals : base ? { ...base } : null;
  return { comp, saisieLibre: !base && aUneValeur };
}

// Pré-remplit les champs manuels d'un rôle avec la composition de la nuance
// sélectionnée (copie en mémoire ; data.json n'est jamais modifié).
function prefillComp(role) {
  const base = compositionNuance(role);
  const bloc = document.querySelector(`[data-comp="${role}"]`);
  if (!bloc) return;
  bloc.querySelectorAll("[data-comp-input]").forEach((input) => {
    const v = base ? base[input.dataset.elem] : null;
    input.value = v == null || v === "" ? "" : String(v);
  });
}

// --- Construction des listes -------------------------------------------
function construireListes() {
  // Selects simples pilotés par fr.json.
  remplirSelectNatif("procede", t("parametres.procedes"), "111");
  remplirSelectNatif("position", t("parametres.positions"), "PA");
  remplirSelectNatif("assemblage", t("parametres.assemblages"), "BW");
  remplirSelectNatif("chanfrein", t("parametres.chanfreins"), "droit");
  remplirSelectNatif(
    "diametre",
    (t("parametres.diametres") || []).map((d) => ({
      value: String(d),
      label: `${Number(d).toFixed(1)} mm`,
    })),
    "3.2"
  );
  remplirSelectNatif(
    "diametre-fil",
    (t("parametres.diametres_fil") || []).map((d) => ({
      value: String(d),
      label: `${Number(d).toFixed(1)} mm`,
    })),
    "1.2"
  );
  remplirSelectNatif("enrobage", t("parametres.enrobages"), "B");

  // Comboboxes à recherche (Choices.js).
  const basesItems = BANQUE.metaux_base.map((m, i) => ({
    value: String(i),
    label: m.designation,
  }));
  comboA = creerCombobox($("#metal-a"), basesItems, { placeholder: t("parametres.ph_metal") });
  comboB = creerCombobox($("#metal-b"), basesItems, { placeholder: t("parametres.ph_metal") });

  // Électrodes tungstène (TIG) - depuis la banque electrodes_tungstene.
  const tungItems = (BANQUE.electrodes_tungstene || []).map((e, i) => ({
    value: String(i),
    label: e.designation,
  }));
  comboTungstene = creerCombobox($("#tungstene"), tungItems, {
    placeholder: t("parametres.ph_tungstene"),
  });

  // Blocs de saisie manuelle de composition (métaux de base A / B).
  ["a", "b"].forEach(construireBlocComposition);
}

// Construit le bloc dépliant de composition manuelle d'un rôle.
function construireBlocComposition(role) {
  const conteneur = document.querySelector(`[data-comp="${role}"]`);
  if (!conteneur) return;
  const elements = t("parametres.elements_comp") || [];

  const titre = document.createElement("p");
  titre.className = "comp-manuelle__titre";
  titre.textContent = t("parametres.comp_manuelle_titre");

  const grille = document.createElement("div");
  grille.className = "comp-grille";
  for (const el of elements) {
    const champ = document.createElement("label");
    champ.className = "comp-champ";
    const span = document.createElement("span");
    span.className = "comp-champ__label";
    span.textContent = `%${el}`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.001";
    input.inputMode = "decimal";
    input.className = "comp-champ__input";
    input.dataset.compInput = role;
    input.dataset.elem = el;
    champ.append(span, input);
    grille.appendChild(champ);
  }

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn-lien btn-lien--reset";
  reset.dataset.resetComp = role;
  reset.textContent = t("parametres.comp_manuelle_reset");

  conteneur.replaceChildren(titre, grille, reset);
}

// --- Réactions à la sélection du procédé --------------------------------
function majVisibiliteProcede(procede) {
  const est = (code) => procede === code;
  const migMag = est("131") || est("135");
  // EE (111) : diamètre électrode enrobée (l'apport EST l'électrode).
  basculeChamp("diametre", est("111"));
  // TIG (141) : électrode tungstène (épaisseur = moyenne e_A/e_B, ou côté
  // inox seul si hétérogène).
  basculeChamp("tungstene", est("141"));
  // MIG/MAG (131/135) : diamètre de fil + intensité saisie (apport = fil).
  basculeChamp("diametre-fil", migMag);
  basculeChamp("i-manuel", migMag);
  // Type d'enrobage : électrode enrobée uniquement.
  basculeChamp("enrobage", est("111"));
  centrerVitesseSiSeule();
}

// Centre le champ Vitesse quand il est le seul visible de la carte intensité
// (cas EE : ni épaisseur TIG ni intensité manuelle).
function centrerVitesseSiSeule() {
  const grille = document.querySelector('[data-grid="intensite"]');
  if (!grille) return;
  const visibles = [...grille.querySelectorAll(".champ")].filter((c) => !c.hidden);
  grille.classList.toggle("form-grid--centre", visibles.length === 1);
}

function basculeChamp(nom, visible) {
  const el = document.querySelector(`[data-champ="${nom}"]`);
  if (el) el.hidden = !visible;
}

function onProcedeChange() {
  const procede = $("#procede").value;
  majVisibiliteProcede(procede);
  // Vitesse indicative pré-remplie (ajustable).
  const vi = VITESSE_INDICATIVE[procede];
  if (vi) $("#vitesse").value = String(vi.defaut);
  if (!dilutionModifieeManuel) appliquerSuggestionDilution();
  recalculer();
}

// --- Calcul live des paramètres électriques -----------------------------
function calculerIntensite(procede) {
  if (procede === "111") {
    // spec.md §3.1 - EE selon diamètre, position, assemblage.
    return intensiteEE(num("#diametre"), {
      position: $("#position").value,
      assemblage: $("#assemblage").value,
    });
  }
  if (procede === "141") {
    // spec.md §3.2 - TIG selon épaisseur et nature (ferritique/inox).
    const matiere = matiereTIG(
      compositionEffective("a").comp,
      compositionEffective("b").comp
    );
    let eCalcul;
    if (matiere === "heterogene") {
      // Épaisseur retenue = celle du côté inox uniquement (pas de moyenne).
      const aEstInox = estInox(compositionEffective("a").comp);
      eCalcul = num(aEstInox ? "#ep-a" : "#ep-b");
    } else {
      // Cas homogènes (ferritique/inox) : moyenne des épaisseurs A / B.
      const epaisseurs = [num("#ep-a"), num("#ep-b")].filter(Number.isFinite);
      eCalcul =
        epaisseurs.length > 0
          ? epaisseurs.reduce((s, x) => s + x, 0) / epaisseurs.length
          : NaN;
    }
    return intensiteTIG(eCalcul, matiere, $("#assemblage").value);
  }
  // MIG/MAG (131/135) - pas de formule d'intensité (spec.md §3.3) : saisie.
  return num("#i-manuel");
}

function recalculer() {
  const procede = $("#procede").value;
  const vide = t("parametres.res_vide");

  const I = calculerIntensite(procede);
  const Vs = num("#vitesse");
  const k = rendement(procede);
  const iValide = Number.isFinite(I) && I > 0;
  const vsValide = Number.isFinite(Vs) && Vs > 0;

  const U = iValide ? tension(procede, I) : NaN;
  const En = iValide && vsValide ? energieNominale(U, I, Vs).kJ_mm : NaN;
  const Q = Number.isFinite(En) ? energieCorrigee(En, procede) : NaN;

  poser("I", iValide ? Math.round(I) : vide);
  poser("U", iValide ? U.toFixed(1) : vide);
  poser("Vs", vsValide ? String(Vs) : vide);
  poser("En", Number.isFinite(En) ? En.toFixed(3) : vide);
  poser("Q", Number.isFinite(Q) ? Q.toFixed(3) : vide);
  poser("k", k.toFixed(2));

  ["a", "b"].forEach(majEquivalents);
  majNoteTigHetero(procede);
  validerDilution();
  majAnalyse(collecterEtat());
}

// Note « intensité réduite » : TIG avec au moins une base inox (hétérogène).
function majNoteTigHetero(procede) {
  const note = document.querySelector('[data-note="tig-hetero"]');
  if (!note) return;
  const hetero =
    procede === "141" &&
    matiereTIG(compositionEffective("a").comp, compositionEffective("b").comp) === "heterogene";
  note.hidden = !hetero;
}

// Snapshot des paramètres transmis à l'onglet Analyse (via sessionStorage).
function collecterEtat() {
  const donneesRole = (role) => {
    const cfg = ROLES[role];
    const idx = document.getElementById(cfg.selectId)?.value;
    const designation =
      idx !== "" && idx != null ? BANQUE.metaux_base[Number(idx)]?.designation ?? null : null;
    const { comp, saisieLibre } = compositionEffective(role);
    return { designation, composition: comp, saisieLibre };
  };
  return {
    procede: $("#procede").value,
    enrobage: document.getElementById("enrobage")?.value ?? null,
    A: donneesRole("a"),
    B: donneesRole("b"),
    dA: num("#da"),
    dB: num("#db"),
    dC: num("#dc"),
    epA: num("#ep-a"),
    epB: num("#ep-b"),
  };
}

function poser(cle, valeur) {
  const el = document.querySelector(`[data-res="${cle}"]`);
  if (el) el.textContent = valeur;
}

// Affiche Cr_eq / Ni_eq (Schaeffler) et CE_IIW d'un rôle, avec balise
// [saisie libre] le cas échéant. Réf. spec.md §1.1 et §5.1.
function majEquivalents(role) {
  const cible = document.querySelector(`[data-eq="${role}"]`);
  if (!cible) return;
  const { comp, saisieLibre } = compositionEffective(role);
  if (!comp) {
    cible.textContent = "";
    return;
  }
  const parts = [
    `${t("parametres.eq_creq")} ${crEqSchaeffler(comp).toFixed(2)}`,
    `${t("parametres.eq_nieq")} ${niEqSchaeffler(comp).toFixed(2)}`,
  ];
  // CE_IIW = indice de soudabilité des aciers au carbone : non pertinent
  // pour un inox → masqué (spec.md §5.1).
  if (!estInox(comp)) {
    parts.push(`${t("parametres.eq_ce")} ${ceIIW(comp).toFixed(3)}`);
  }
  let texte = parts.join(" · ");
  if (saisieLibre) texte += `  ${t("parametres.saisie_libre")}`;
  cible.textContent = texte;
}

// --- Bloc composition manuelle : ouverture / réinitialisation -----------
function ouvrirComp(role) {
  manuel[role] = true;
  prefillComp(role); // pré-remplissage depuis la nuance sélectionnée
  const bloc = document.querySelector(`[data-comp="${role}"]`);
  const bouton = document.querySelector(`[data-toggle-comp="${role}"]`);
  if (bloc) bloc.hidden = false;
  if (bouton) bouton.hidden = true;
  recalculer();
}

// Réinitialisation : remet les valeurs de la base et referme le bloc.
function reinitComp(role) {
  manuel[role] = false;
  prefillComp(role); // restaure les valeurs de la nuance de base
  const bloc = document.querySelector(`[data-comp="${role}"]`);
  const bouton = document.querySelector(`[data-toggle-comp="${role}"]`);
  if (bloc) bloc.hidden = true;
  if (bouton) bouton.hidden = false;
  recalculer();
}

// Contrôle D_A + D_B + D_C = 100 % (spec.md §2.1) - alerte visuelle, non
// bloquante. Saisie en pourcentage entier ; conversion en fractions pour
// la vérification (le moteur travaille en fractions sommant à 1).
function validerDilution() {
  const dA = num("#da");
  const dB = num("#db");
  const dC = num("#dc");
  const alerte = document.querySelector("[data-erreur-dilution]");
  if (!alerte) return;
  const tousRenseignes = [dA, dB, dC].every(Number.isFinite);
  const ok = tousRenseignes && dilutionValide(dA / 100, dB / 100, dC / 100, 1e-3);
  alerte.hidden = !tousRenseignes || ok;
}

// Applique la suggestion de dilution (procédé/assemblage/chanfrein) aux
// champs D_A/D_B/D_C. Arrondi indépendant par champ : D_C recalculé par
// complément pour garantir une somme exacte de 100 %.
function appliquerSuggestionDilution() {
  const suggestion = dilutionParDefaut(
    $("#procede").value,
    $("#assemblage").value,
    $("#chanfrein").value
  );
  const dA = Math.round(suggestion.dA);
  const dB = Math.round(suggestion.dB);
  $("#da").value = String(dA);
  $("#db").value = String(dB);
  $("#dc").value = String(100 - dA - dB);
}

// --- Valeurs par défaut -------------------------------------------------
function valeursParDefaut() {
  $("#vitesse").value = String(VITESSE_INDICATIVE["111"].defaut);
  appliquerSuggestionDilution();
}

// --- Fiche imprimable (window.print + @media print - CLAUDE.md #25) ----
// Peuple #fiche-impression à partir de l'état courant du formulaire et de
// l'apport retenu (Analyse), juste avant window.print(). Pas de dépendance
// externe (remplace le plan initial jsPDF, cf. CLAUDE.md).
function libelleSelect(id) {
  const opt = document.getElementById(id)?.selectedOptions?.[0];
  // Option placeholder (valeur vide, ex. "Rechercher une électrode…") : pas
  // une vraie sélection - cf. combobox.js.
  return opt && opt.value !== "" ? opt.textContent : "";
}

function remplirFicheImpression() {
  const fiche = document.getElementById("fiche-impression");
  if (!fiche) return;
  const vide = t("fiche.non_applicable");
  const poserFiche = (cle, valeur) => {
    const el = fiche.querySelector(`[data-fiche="${cle}"]`);
    if (el) el.textContent = valeur;
  };

  poserFiche("date", new Date().toLocaleDateString("fr-FR"));

  const etat = collecterEtat();
  ["a", "b"].forEach((role) => {
    const donnees = role === "a" ? etat.A : etat.B;
    const comp = donnees.composition;
    const designation =
      (donnees.designation || t("analyse.saisie_libre")) +
      (donnees.saisieLibre ? ` ${t("analyse.saisie_libre")}` : "");
    poserFiche(`${role}-designation`, comp ? designation : vide);
    poserFiche(`${role}-creq`, comp ? crEqSchaeffler(comp).toFixed(2) : vide);
    poserFiche(`${role}-nieq`, comp ? niEqSchaeffler(comp).toFixed(2) : vide);
    const ep = role === "a" ? etat.epA : etat.epB;
    poserFiche(`${role}-epaisseur`, Number.isFinite(ep) ? `${ep} mm` : vide);
  });

  poserFiche("procede", libelleSelect("procede") || vide);
  poserFiche("tungstene", etat.procede === "141" ? libelleSelect("tungstene") || vide : vide);
  poserFiche("position", libelleSelect("position") || vide);
  poserFiche("assemblage", libelleSelect("assemblage") || vide);
  poserFiche("chanfrein", libelleSelect("chanfrein") || vide);

  const RES_VIDE = t("parametres.res_vide");
  const lireRes = (cle) => document.querySelector(`[data-res="${cle}"]`)?.textContent ?? RES_VIDE;
  const avecUnite = (cle, unite) => {
    const v = lireRes(cle);
    return v === RES_VIDE ? v : `${v} ${unite}`;
  };
  poserFiche("I", avecUnite("I", t("parametres.unite_a")));
  poserFiche("U", avecUnite("U", t("parametres.unite_v")));
  poserFiche("Vs", avecUnite("Vs", t("parametres.unite_cmmin")));
  poserFiche("En", avecUnite("En", t("parametres.unite_kjmm")));
  poserFiche("Q", avecUnite("Q", t("parametres.unite_kjmm")));
  poserFiche("k", lireRes("k"));

  poserFiche("dA", Number.isFinite(etat.dA) ? `${etat.dA} %` : vide);
  poserFiche("dB", Number.isFinite(etat.dB) ? `${etat.dB} %` : vide);
  poserFiche("dC", Number.isFinite(etat.dC) ? `${etat.dC} %` : vide);

  const apport = resumeApportPourImpression();
  poserFiche(
    "apport",
    apport
      ? `${apport.designation}${apport.saisieLibre ? ` ${t("analyse.saisie_libre")}` : ""} - ` +
          `${t("parametres.eq_creq")} ${apport.crEq.toFixed(2)} / ${t("parametres.eq_nieq")} ${apport.niEq.toFixed(2)} - ` +
          `${apport.ferrite.toFixed(1)} ${t("analyse.lbl_ferrite")} - ${apport.verdictLabel}`
      : t("fiche.apport_vide")
  );

}

// Capture le diagramme #schaeffler tel qu'affiché à l'écran (couleurs
// inline fill/stroke, dark mode inclus - voulu, fidélité au site) en PNG
// via un <canvas>, à résolution x2 pour la netteté d'impression. Injecte
// le résultat dans #schaeffler-print (visible seulement en @media print).
// callback() n'est appelé qu'une fois l'image PNG chargée - appeler
// window.print() avant produirait une page blanche (image pas encore prête).
function capturerDiagrammeEnImage(callback) {
  const svg = document.getElementById("schaeffler");
  const cible = document.getElementById("schaeffler-print");
  if (!svg || !cible) return callback();

  const rect = svg.getBoundingClientRect();
  const echelle = 2;
  const largeur = Math.round(rect.width * echelle);
  const hauteur = Math.round(rect.height * echelle);
  if (!largeur || !hauteur) return callback();

  const clone = svg.cloneNode(true);
  clone.setAttribute("width", String(largeur));
  clone.setAttribute("height", String(hauteur));
  const source = new XMLSerializer().serializeToString(clone);
  const donneesSvg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;

  // Fond figé avant clonage : le clone sérialisé (XMLSerializer) est rendu
  // en document SVG isolé, sans accès à main.css - le fond posé en CSS sur
  // .schaeffler-svg (background: var(--fond)) ne s'applique donc jamais à
  // l'image capturée (transparent par défaut). Sans ce correctif, les
  // remplissages semi-transparents des zones (fill-opacity zone neutre/
  // A+M+F) se composent sur transparent -> blanc de la page imprimée au
  // lieu du fond sombre affiché à l'écran, ce qui change leur contraste
  // visible entre l'écran et la fiche PDF.
  const fond = getComputedStyle(svg).backgroundColor || "#0F172A";

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    cible.onload = () => callback();
    cible.onerror = () => callback();
    cible.src = canvas.toDataURL("image/png");
  };
  image.onerror = () => callback(); // repli silencieux : fiche imprimée sans le diagramme
  image.src = donneesSvg;
}

// --- Initialisation -----------------------------------------------------
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

    construireListes();
    initAnalyse(BANQUE, ZONES);
    valeursParDefaut();
    majVisibiliteProcede("111");

    // Recalcul à chaque modification du formulaire.
    $("#form-dmos").addEventListener("input", recalculer);
    $("#form-dmos").addEventListener("change", recalculer);
    $("#procede").addEventListener("change", onProcedeChange);

    // Ouverture / réinitialisation des blocs de composition manuelle.
    $("#form-dmos").addEventListener("click", (e) => {
      const ouvrir = e.target.closest("[data-toggle-comp]");
      if (ouvrir) return ouvrirComp(ouvrir.dataset.toggleComp);
      const reset = e.target.closest("[data-reset-comp]");
      if (reset) return reinitComp(reset.dataset.resetComp);
      const suggestion = e.target.closest("[data-suggestion-dilution]");
      if (suggestion) {
        dilutionModifieeManuel = false;
        appliquerSuggestionDilution();
        return recalculer();
      }
    });

    // Saisie manuelle directe sur D_A/D_B/D_C : la suggestion ne les
    // écrase plus tant qu'on ne redemande pas explicitement.
    ["#da", "#db", "#dc"].forEach((sel) => {
      $(sel).addEventListener("input", () => {
        dilutionModifieeManuel = true;
      });
    });

    // Assemblage / chanfrein : recalcule la suggestion de dilution tant
    // qu'elle n'a pas été modifiée à la main.
    ["#assemblage", "#chanfrein"].forEach((sel) => {
      $(sel).addEventListener("change", () => {
        if (!dilutionModifieeManuel) appliquerSuggestionDilution();
      });
    });

    // Changer de nuance re-pré-remplit le bloc manuel s'il est ouvert.
    [["a", "#metal-a"], ["b", "#metal-b"]].forEach(([role, sel]) => {
      $(sel).addEventListener("change", () => {
        if (manuel[role]) prefillComp(role);
      });
    });

    // Génération de la fiche imprimable (window.print + @media print).
    $("#btn-pdf")?.addEventListener("click", () => {
      remplirFicheImpression();
      capturerDiagrammeEnImage(() => window.print());
    });

    recalculer();
    rendreCompteur();
    rendreCompteurAnalyses();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
