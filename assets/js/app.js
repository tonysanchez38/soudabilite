// =========================================================================
// app.js — orchestrateur. Aucune logique métier (règle CLAUDE.md).
// Rôle : charger l'i18n, injecter les chaînes, puis rendre les contenus
// pilotés par les données de la page Présentation (normes, onglets).
// =========================================================================

import { chargerChaines, appliquerChaines, t } from "./ui/i18n.js";

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

// Lit un endpoint /counter/*.json de GoatCounter. Renvoie l'objet
// { count, count_unique } ou null si indisponible (compte absent, accès
// non public, réseau) — dans ce cas on n'affiche simplement rien.
async function litCompteur(url) {
  if (!url) return null;
  try {
    const reponse = await fetch(url, { cache: "no-cache" });
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch (err) {
    return null;
  }
}

// Affiche « X visiteurs — Y calculs réalisés » en pied de page.
// - Visiteurs : visiteurs uniques (count_unique) de l'endpoint TOTAL.
// - Calculs : événement personnalisé « calcul » (câblé à l'étape 8).
// Chaque métrique s'affiche seulement si son chiffre est disponible.
async function rendreCompteur() {
  const cible = document.querySelector("[data-compteur]");
  if (!cible) return;

  const [visites, calculs] = await Promise.all([
    litCompteur(t("footer.compteur_total_url")),
    litCompteur(t("footer.compteur_calcul_url")),
  ]);

  const morceaux = [];

  const nbVisiteurs = visites && (visites.count_unique ?? visites.count);
  if (nbVisiteurs != null) {
    morceaux.push(`${String(nbVisiteurs).trim()} ${t("footer.compteur_visiteurs")}`);
  }

  const nbCalculs = calculs && calculs.count;
  if (nbCalculs != null) {
    morceaux.push(`${String(nbCalculs).trim()} ${t("footer.compteur_calculs")}`);
  }

  if (morceaux.length > 0) {
    cible.textContent = morceaux.join(" — ");
    cible.hidden = false;
  }
}

async function init() {
  try {
    await chargerChaines("fr");
    appliquerChaines();
    rendreNormes();
    rendreOnglets();
    rendreCompteur();
  } catch (err) {
    // En cas d'échec de chargement, on laisse les libellés de repli du HTML.
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
