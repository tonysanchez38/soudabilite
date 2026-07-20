// =========================================================================
// app.js - orchestrateur. Aucune logique métier (règle CLAUDE.md).
// Rôle : charger l'i18n, injecter les chaînes, puis rendre les contenus
// pilotés par les données de la page Présentation (normes, onglets).
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";
import { rendreCompteur, rendreCompteurAnalyses, rendreCompteurPage } from "./ui/compteur.js";

// Retire le paragraphe de secours SEO (index.html, [data-fallback-seo])
// une fois le hero i18n rendu : il ne doit jamais rester affiché en même
// temps que le hero (doublon visuel), ni être masqué par CSS tout en
// restant lisible par les crawlers (cf. décision du 2026-07-20).
function retirerParagrapheSecours() {
  document.querySelector("[data-fallback-seo]")?.remove();
}

// Construit le corps du tableau du cadre normatif depuis fr.json.
function rendreNormes() {
  const corps = document.querySelector('[data-liste="normes"]');
  if (!corps) return;
  const normes = t("presentation.normes") || [];
  corps.replaceChildren();
  normes.forEach((n) => {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    tdCode.className = "normes__code";
    tdCode.textContent = n.code;

    const tdObjet = document.createElement("td");
    tdObjet.textContent = n.objet;

    tr.append(tdCode, tdObjet);
    corps.appendChild(tr);
  });
}

// Construit les cartes du sommaire des onglets depuis fr.json.
function rendreOnglets() {
  const conteneur = document.querySelector('[data-liste="onglets"]');
  if (!conteneur) return;
  const onglets = t("presentation.onglets") || [];
  conteneur.replaceChildren();
  onglets.forEach((o) => {
    const lien = document.createElement("a");
    lien.className = "carte carte--onglet";
    lien.href = o.lien;

    const titre = document.createElement("h3");
    titre.className = "carte__titre";
    titre.append(document.createTextNode(o.titre));

    const texte = document.createElement("p");
    texte.className = "carte__texte";
    texte.textContent = o.description;

    lien.append(titre, texte);
    conteneur.appendChild(lien);
  });
}

async function init() {
  try {
    await chargerChaines("fr");
    appliquerChaines();
    retirerParagrapheSecours();
    rendreNormes();
    rendreOnglets();
    rendreCompteur();
    rendreCompteurAnalyses();
    rendreCompteurPage();
  } catch (err) {
    // En cas d'échec de chargement, on laisse les libellés de repli du HTML.
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
