// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// i18n.js - chargement des chaînes visibles et injection dans le DOM.
// Décision DECISIONS.md #23 : toute chaîne visible provient de
// assets/i18n/<lang>.json. Aucune logique métier ici : uniquement du binding.
// Deux dictionnaires : fr.json et en.json.
// =========================================================================

const LANG_DEFAUT = "fr";
const LANGUES = ["fr", "en"];

// Langue de la page : attribut lang de <html>, sinon français.
export function langueCourante() {
  const lang = (document.documentElement.getAttribute("lang") || "").slice(0, 2);
  return LANGUES.includes(lang) ? lang : LANG_DEFAUT;
}

// Chaîne traduite avec repli sur le texte français fourni par l'appelant.
export function tr(cle, secours) {
  const valeur = t(cle);
  return typeof valeur === "string" ? valeur : secours;
}
let CHAINES = {};

// Résout une clé pointée ("presentation.titre") vers sa valeur dans l'objet.
export function t(cle) {
  return cle
    .split(".")
    .reduce(
      (obj, k) => (obj != null && obj[k] != null ? obj[k] : undefined),
      CHAINES
    );
}

// Charge le fichier de langue. Nécessite un service HTTP (fetch) :
// fonctionne sur GitHub Pages et via un serveur local, pas en file://.
export async function chargerChaines(lang = langueCourante()) {
  const reponse = await fetch(`/assets/i18n/${lang}.json`, { cache: "no-cache" });
  if (!reponse.ok) {
    throw new Error(
      `i18n : chargement de ${lang}.json impossible (HTTP ${reponse.status})`
    );
  }
  CHAINES = await reponse.json();
  document.documentElement.lang = lang;
  return CHAINES;
}

// Applique les chaînes aux éléments porteurs de :
//   data-i18n="cle"                → remplace le textContent
//   data-i18n-attr="attr:cle;..."  → renseigne un ou plusieurs attributs
export function appliquerChaines(racine = document) {
  racine.querySelectorAll("[data-i18n]").forEach((el) => {
    const valeur = t(el.dataset.i18n);
    if (typeof valeur === "string") el.textContent = valeur;
  });

  racine.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((paire) => {
      const [attr, cle] = paire.split(":").map((s) => s.trim());
      const valeur = t(cle);
      if (attr && typeof valeur === "string") el.setAttribute(attr, valeur);
    });
  });
}
