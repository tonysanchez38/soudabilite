// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// revendeurs.js - liens revendeurs sous les apports de la sélection.
// Affichés seulement sur les apports au verdict « Idéal sur toute la
// plage » (décision de Tony du 2026-11-02), en TIG et en électrode.
// Données : assets/data/revendeurs.json, séparé de data.json (banque gelée).
// Aucune logique métier : un motif de désignation donne une liste de liens.
// =========================================================================

import { t } from "./i18n.js";
import { envoyerEvenement } from "./analytics.js";

let FAMILLES = null;

// Charge la table une fois. Un échec réseau laisse le tableau intact.
export async function chargerRevendeurs() {
  if (FAMILLES) return FAMILLES;
  try {
    const r = await fetch("/assets/data/revendeurs.json", { cache: "no-cache" });
    FAMILLES = r.ok ? (await r.json()).familles || [] : [];
  } catch {
    FAMILLES = [];
  }
  return FAMILLES;
}

// Famille correspondant à la désignation exacte de la banque (liste
// « designations »), pour le procédé courant, avec au moins un revendeur
// vérifié. Aucun rattachement par motif : une désignation non listée
// n'affiche rien. Sinon null.
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function familleRevendeurs(designation, procede) {
  if (!FAMILLES || !designation) return null;
  const d = norm(designation);
  const f = FAMILLES.find(
    (x) => (x.procedes || []).includes(String(procede)) && (x.designations || []).map(norm).includes(d)
  );
  return f?.revendeurs?.length ? f : null;
}

// Bloc « Équivalents en vente » : liens externes, ouverts dans un nouvel
// onglet, sans propagation du clic vers la ligne (sélection de l'apport).
export function blocRevendeurs(famille) {
  const bloc = document.createElement("div");
  bloc.className = "revendeurs";
  const titre = document.createElement("span");
  titre.className = "revendeurs__titre";
  titre.textContent = `${t("analyse.revendeurs_titre")} ${famille.id} :`;
  bloc.appendChild(titre);
  famille.revendeurs.forEach((rv) => {
    const a = document.createElement("a");
    a.className = "revendeurs__lien";
    a.href = rv.url;
    a.target = "_blank";
    a.rel = "noopener nofollow";
    a.textContent = rv.nom;
    a.title = `${rv.produit} (${rv.pays})`;
    a.addEventListener("click", (e) => {
      e.stopPropagation();
      envoyerEvenement(`revendeur-${famille.id}-${rv.nom}`.toLowerCase().replace(/\s+/g, "-"), `Revendeur ${rv.nom}`);
    });
    a.addEventListener("keydown", (e) => e.stopPropagation());
    bloc.appendChild(a);
  });
  const note = document.createElement("span");
  note.className = "revendeurs__note";
  note.textContent = t("analyse.revendeurs_note").replace("{norme}", famille.norme || "EN ISO");
  bloc.appendChild(note);
  return bloc;
}
