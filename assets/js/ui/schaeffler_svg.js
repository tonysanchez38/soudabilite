// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// schaeffler_svg.js - rendu SVG natif du diagramme de Schaeffler.
// Coordonnées réelles (Cr_eq en abscisse, Ni_eq en ordonnée). Aucune image
// de fond (CLAUDE.md : projection en coordonnées réelles). Aucune logique
// métier : purement graphique.
// =========================================================================

import { FERRITE_G } from "../core/schaeffler.js";

const NS = "http://www.w3.org/2000/svg";

function el(nom, attrs = {}) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Pose un fond plein arrondi derrière un texte SVG déjà inséré dans le DOM,
// pour garantir la lisibilité même si une ligne ou un autre texte passe dessous.
function fondEtiquette(groupe, texteNode, options = {}) {
  const { padding = 6, couleur = "#0f172a", opacite = 0.82 } = options;
  const bbox = texteNode.getBBox();
  const fond = el("rect", {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
    rx: 3,
    fill: couleur,
    "fill-opacity": opacite,
  });
  groupe.insertBefore(fond, texteNode);
}

// g calibré pour un % ferrite exact de FERRITE_G (source unique, importée
// de core/schaeffler.js - jamais dupliquée ici ni dans zones_schaeffler.json).
function gPourPct(pct) {
  const entree = FERRITE_G.find(([, p]) => p === pct);
  return entree ? entree[0] : null;
}

// Segment d'une droite iso-ferrite (Ni_eq = Cr_eq − g) coupé à la fenêtre.
// Renvoie [[crBas,niBas],[crHaut,niHaut]] (niBas < niHaut), ou null si hors champ.
function segmentIso(g, crMin, crMax, niMin, niMax) {
  const ni0 = Math.max(niMin, crMin - g);
  const ni1 = Math.min(niMax, crMax - g);
  if (ni0 >= ni1) return null;
  return [[ni0 + g, ni0], [ni1 + g, ni1]];
}

// Centroïde (aire pondérée) d'un polygone simple - placement des étiquettes
// de zone. Repli sur la moyenne des sommets si l'aire est dégénérée.
function centroide(poly) {
  let x = 0, y = 0, aire = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cr = x0 * y1 - x1 * y0;
    aire += cr;
    x += (x0 + x1) * cr;
    y += (y0 + y1) * cr;
  }
  aire *= 0.5;
  if (Math.abs(aire) < 1e-9) {
    const n = poly.length;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  return [x / (6 * aire), y / (6 * aire)];
}

// Libellé court d'une zone depuis son id ("AMF" -> "A+M+F").
function libelleCourt(id) {
  return id.split("").join("+");
}

// Étendue verticale [niMin,niMax] d'un polygone à un Cr_eq donné (intersection
// des arêtes avec la verticale x=cr). Sert à ancrer les étiquettes de bande
// dans la zone réellement visible après clipping, pas dans une région
// approximée par formule qui pourrait tomber hors du polygone (ex. sur le
// S blanc là où la bande n'est en réalité pas rendue).
function etendueVerticale(poly, cr) {
  const ys = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[j];
    const [x1, y1] = poly[i];
    if ((x0 <= cr && cr < x1) || (x1 <= cr && cr < x0)) {
      const t = (cr - x0) / (x1 - x0);
      ys.push(y0 + t * (y1 - y0));
    }
  }
  if (ys.length < 2) return null;
  return [Math.min(...ys), Math.max(...ys)];
}

// Étendue horizontale [crMin,crMax] d'un polygone à un Ni_eq donné -
// symétrique de etendueVerticale (axes échangés). Sert à trouver le bord
// gauche de zone_s à une hauteur donnée (cf. clipAMFcontreZoneS).
function etendueHorizontale(poly, ni) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[j];
    const [x1, y1] = poly[i];
    if ((y0 <= ni && ni < y1) || (y1 <= ni && ni < y0)) {
      const t = (ni - y0) / (y1 - y0);
      xs.push(x0 + t * (x1 - x0));
    }
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

// Borne le polygone A+M+F par le bord gauche de zone_s (la zone neutre
// digitalisée) : pour chaque hauteur Ni_eq où les deux zones se côtoient,
// le côté droit de A+M+F s'arrête au bord gauche de zone_s au lieu de
// continuer sur sa propre frontière d'origine (spec Tony - évite que le
// gris A+M+F déborde derrière/à droite de la zone neutre). Implémenté par
// clipping point-à-point (bissection sur les arêtes qui traversent la
// frontière) plutôt qu'une intersection polygonale générale : zone_s n'est
// pas convexe, mais le test « à l'intérieur » (cr ≤ bordGauche(ni)) est
// bien défini en tout point, ce qui suffit ici.
function insideBordGaucheZoneS(cr, ni, zoneS) {
  const ext = etendueHorizontale(zoneS, ni);
  if (!ext) return true; // hors de la plage Ni_eq de zone_s : pas de contrainte
  return cr <= ext[0] + 1e-9;
}

function clipAMFcontreZoneS(poly, zoneS) {
  if (!Array.isArray(zoneS) || zoneS.length < 3) return poly;
  const n = poly.length;
  const dedans = poly.map(([cr, ni]) => insideBordGaucheZoneS(cr, ni, zoneS));
  if (dedans.every(Boolean)) return poly; // rien à découper
  const PAS_BISSECTION = 16;
  const resultat = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const aDedans = dedans[i];
    const bDedans = dedans[(i + 1) % n];
    if (aDedans) resultat.push(a);
    if (aDedans !== bDedans) {
      // bordGauche(ni) n'est pas une droite : pas d'intersection analytique
      // simple, on bissecte le long du segment jusqu'à cerner le croisement.
      let lo = 0, hi = 1;
      for (let k = 0; k < PAS_BISSECTION; k++) {
        const mid = (lo + hi) / 2;
        const cr = a[0] + (b[0] - a[0]) * mid;
        const ni = a[1] + (b[1] - a[1]) * mid;
        if (insideBordGaucheZoneS(cr, ni, zoneS) === aDedans) lo = mid; else hi = mid;
      }
      resultat.push([a[0] + (b[0] - a[0]) * hi, a[1] + (b[1] - a[1]) * hi]);
    }
  }
  return resultat.length >= 3 ? resultat : poly;
}

// Courbe de Catmull-Rom fermée (convertie en Bézier cubiques) passant par
// tous les points, dans l'ordre - pour retrouver les contours organiques
// du diagramme papier (ex. zone_s) plutôt qu'un polygone anguleux.
// pts : [[x,y], ...] déjà projetés en coordonnées écran.
function courbeFermee(pts) {
  const n = pts.length;
  if (n < 3) return "";
  const p = (i) => pts[((i % n) + n) % n];
  let d = `M ${p(0)[0]},${p(0)[1]} `;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += `C ${c1x},${c1y} ${c2x},${c2y} ${x2},${y2} `;
  }
  return `${d}Z`;
}

// Risque métallurgique des zones pures - cf. cahier des charges Tony.
const RISQUE_ZONE = {
  A: "risque de fissuration à chaud",
  M: "risque de fissuration à froid",
  F: "risque de grossissement de grain",
};

const TITRE_MUR_SIGMA =
  "Cr_eq = 25 : limite phase sigma - au-delà, précipitation intermétallique fragilisante";

// Halo sombre derrière un texte clair, lisible sur tout fond de zone.
function halo(txt) {
  txt.setAttribute("paint-order", "stroke");
  txt.setAttribute("stroke", "#0f172a");
  txt.setAttribute("stroke-width", 3);
  txt.setAttribute("stroke-linejoin", "round");
  return txt;
}

// Crée un diagramme dans un <svg>. Renvoie une API pour mettre à jour les
// points et lignes dynamiques.
//   zones     : contenu de zones_schaeffler.json
//   fenetre   : { cr:[min,max], ni:[min,max] }
//   options   : { axes:bool, isoLabels:bool, infobulle:HTMLEl }
export function creerDiagramme(svg, zones, fenetre, options = {}) {
  // Taille globale +18% puis +12% supplémentaires (deux passes de
  // grossissement cumulées) : viewBox et .schaeffler-svg { max-height }
  // (main.css) scalés ensemble pour garder le même ratio pixel/unité -
  // les polices/traits (valeurs absolues en unités SVG) restent donc à
  // la même taille physique à l'écran, mais la géométrie (zones, bandes,
  // points) occupe plus d'espace physique : moins de promiscuité entre
  // étiquettes, sans retoucher chaque constante de mise en page une par une.
  const H = 463;
  const padL = 50;
  const padR = 19;
  const padT = 19;
  const padB = 45;
  svg.setAttribute("viewBox", `0 0 581 ${H}`);
  svg.replaceChildren();

  const [crMin, crMax] = fenetre.cr;
  const [niMin, niMax] = fenetre.ni;
  const plotW = 581 - padL - padR;
  const plotH = H - padT - padB;
  const X = (cr) => padL + ((cr - crMin) / (crMax - crMin)) * plotW;
  const Y = (ni) => padT + (1 - (ni - niMin) / (niMax - niMin)) * plotH;
  const idSvg = svg.id || "d";

  const pts = (poly) => poly.map(([cr, ni]) => `${X(cr)},${Y(ni)}`).join(" ");

  // --- Defs : clip du plot, clip AF, clip mur sigma ---
  const defs = el("defs");

  const clip = el("clipPath", { id: `clip-${idSvg}` });
  clip.appendChild(el("rect", { x: padL, y: padT, width: plotW, height: plotH }));
  defs.appendChild(clip);

  const zoneAF = zones.zones.find((z) => z.id === "AF");
  const clipAF = el("clipPath", { id: `clip-af-${idSvg}` });
  if (zoneAF) clipAF.appendChild(el("polygon", { points: pts(zoneAF.polygone) }));
  defs.appendChild(clipAF);

  const crWallX = Math.min(Math.max(X(25), padL), padL + plotW);
  const clipSigma = el("clipPath", { id: `clip-sigma-${idSvg}` });
  clipSigma.appendChild(el("rect", { x: padL, y: padT, width: Math.max(0, crWallX - padL), height: plotH }));
  defs.appendChild(clipSigma);

  // Troncature basse de la zone S (Ni_eq ≥ 4.5) : clipper au polygone A+F
  // faisait presque disparaître le S (A+F très étroit sur sa plage Cr_eq,
  // cf. diagnostic). Simple coupe horizontale à la place - retire la queue
  // qui mordait sur M+F (sous Ni_eq≈4.5) sans écraser le reste du croissant.
  const yNi45 = Math.min(Math.max(Y(4.5), padT), padT + plotH);
  const clipSBas = el("clipPath", { id: `clip-s-bas-${idSvg}` });
  clipSBas.appendChild(el("rect", { x: padL, y: padT, width: plotW, height: Math.max(0, yNi45 - padT) }));
  defs.appendChild(clipSBas);

  svg.appendChild(defs);

  // --- Groupe clippé au plot : zones, S, iso-ferrite, bandes, mur sigma ---
  // Ordre de dessin (fond → avant) : zones métallurgiques → S crème →
  // iso-ferrite → bande verte → bande bleue → mur sigma. Les étiquettes
  // (noms de zone, %, IDÉALE/ACCEPTABLE) sont groupées à part (gEtiquettes)
  // et posées en tout dernier, par-dessus les segments/points de dilution.
  const gPlan = el("g", { "clip-path": `url(#clip-${idSvg})` });
  svg.appendChild(gPlan);
  const gEtiquettes = el("g"); // non clippé : les % iso-ferrite sortent du plot
  // Attaché tout de suite (et re-attaché plus bas pour repasser au-dessus de
  // gDyn) : fondEtiquette() appelle getBBox() sur les textes au fil de leur
  // création ci-dessous, et un <g> encore détaché du <svg> renvoie une bbox
  // nulle (0,0,0,0) - le fond serait alors un carré de 6x6 posé à l'origine
  // au lieu d'un fond correctement dimensionné derrière le texte.
  svg.appendChild(gEtiquettes);

  // 1. Zones métallurgiques (fond coloré) + <title>, hors S (A+M+F).
  for (const z of zones.zones) {
    if (z.id === "AMF") continue;
    const poly = el("polygon", {
      points: pts(z.polygone), fill: z.couleur, "fill-opacity": 0.55,
      stroke: "#0f172a", "stroke-width": 0.5,
    });
    const titre = el("title");
    const risque = RISQUE_ZONE[z.id];
    titre.textContent = risque ? `${z.nom} - ${risque}` : z.nom;
    poly.appendChild(titre);
    gPlan.appendChild(poly);
  }

  // 2. S crème (A+M+F) : repère du corridor triphasé, en retrait derrière
  // les bandes cibles (opacité réduite, pas de trame). Bornée par le bord
  // gauche de zone_s (clipAMFcontreZoneS) pour ne pas déborder derrière/à
  // droite de la zone neutre - cf. diagnostic chevauchement gris/S.
  const zoneAMF = zones.zones.find((z) => z.id === "AMF");
  let polyAMFVisible = zoneAMF ? zoneAMF.polygone : null;
  if (zoneAMF) {
    polyAMFVisible = clipAMFcontreZoneS(zoneAMF.polygone, zones.zone_s);
    const poly = el("polygon", {
      points: pts(polyAMFVisible), fill: "#F5F0E0", "fill-opacity": 0.55,
      stroke: "#0f172a", "stroke-width": 0.5,
    });
    const titre = el("title");
    titre.textContent = zoneAMF.nom;
    poly.appendChild(titre);
    gPlan.appendChild(poly);
  }

  // Bornes communes des bandes (iso-ferrite en Cr_eq/Ni_eq pleine échelle,
  // pas la fenêtre d'affichage - cf. bandes idéale/acceptable historiques).
  const axesData = zones._meta.axes;
  const bandePolygon = (gLow, gHigh) => {
    const lo = segmentIso(gLow, axesData.cr_eq[0], axesData.cr_eq[1], axesData.ni_eq[0], axesData.ni_eq[1]);
    const hi = segmentIso(gHigh, axesData.cr_eq[0], axesData.cr_eq[1], axesData.ni_eq[0], axesData.ni_eq[1]);
    if (!lo || !hi) return null;
    return [lo[0], lo[1], hi[1], hi[0]];
  };

  // 2b. Zone S blanche : calque overlay digitalisé depuis le diagramme papier
  // de référence (validé Tony), dessiné par-dessus les zones métallurgiques
  // (silhouette en sablier - lobe haut, pincement, lobe bas). Rendu lissé
  // (Catmull-Rom → Bézier) pour retrouver les courbes organiques d'origine ;
  // les bandes verte/acceptable et bleue/idéale se dessinent PAR-DESSUS
  // (plus loin) là où elles chevauchent le S - la cible domine le repère.
  // Troncature basse seulement (Ni_eq ≥ 4.5, clip-s-bas) : clipper au
  // polygone A+F entier écrasait presque tout le S (A+F très étroit sur
  // cette plage de Cr_eq) - cf. diagnostic. Seule la queue basse (côté
  // M+F) est coupée, le reste du croissant reste visible tel que digitalisé.
  if (Array.isArray(zones.zone_s) && zones.zone_s.length >= 3) {
    const gZoneS = el("g", { "clip-path": `url(#clip-s-bas-${idSvg})` });
    const ptsEcranS = zones.zone_s.map(([cr, ni]) => [X(cr), Y(ni)]);
    const zoneS = el("path", {
      d: courbeFermee(ptsEcranS),
      fill: "#FFFFFF",
      "fill-opacity": 0.58, // dernier recours discret, ne domine plus le diagramme
      stroke: "#0f172a", // même contour sombre que les autres zones
      "stroke-width": 0.9,
      "stroke-dasharray": "2 1.5", // pointillé fin : signale "repère", pas une zone dure
    });
    const titre = el("title");
    titre.textContent =
      "Zone S - interstice de transition du Schaeffler historique. Dernier recours si aucun apport ne place le joint en zone idéale ou acceptable.";
    zoneS.appendChild(titre);
    gZoneS.appendChild(zoneS);
    gPlan.appendChild(gZoneS);
  }

  // 3. Iso-ferrite : droites g = Cr_eq − Ni_eq = cste (FERRITE_G, source
  // unique). Étiquetées (0/5/10/15/20 %) au point de sortie du cadre, dans
  // gEtiquettes (non clippé - un texte dans gPlan y serait invisible, rogné
  // par le clip-path du plot) ; non étiquetées (40/80/100 %) en pointillé
  // gris discret.
  for (const [g, pct] of FERRITE_G) {
    const seg = segmentIso(g, crMin, crMax, niMin, niMax);
    if (!seg) continue;
    const [[crBas, niBas], [crHaut, niHaut]] = seg;
    const etiquetee = pct <= 20;
    gPlan.appendChild(
      el("line", {
        x1: X(crBas), y1: Y(niBas), x2: X(crHaut), y2: Y(niHaut),
        stroke: "#e2e8f0",
        "stroke-width": etiquetee ? 0.7 : 0.5,
        "stroke-opacity": 0.32,
        ...(etiquetee ? {} : { "stroke-dasharray": "3 3" }),
      })
    );
    if (etiquetee && options.isoLabels) {
      const surBordHaut = Math.abs(niHaut - niMax) < 1e-6;
      const surBordDroit = Math.abs(crHaut - crMax) < 1e-6;
      let tx, ty, ancre;
      if (surBordHaut) { tx = X(crHaut); ty = Y(niHaut) - 5; ancre = "middle"; }
      else if (surBordDroit) { tx = X(crHaut) + 4; ty = Y(niHaut) + 3; ancre = "start"; }
      else { tx = X(crHaut) + 3; ty = Y(niHaut) - 3; ancre = "start"; }
      const t = el("text", { x: tx, y: ty, fill: "#94a3b8", "font-size": 8, "text-anchor": ancre });
      t.textContent = `${pct}%`;
      gEtiquettes.appendChild(t);
      // Padding réduit (3 au lieu du défaut 6) : ces étiquettes sont
      // serrées le long du bord du plot (ex. 10/15/20 % sur le bord
      // droit) - le padding par défaut ferait chevaucher les fonds entre
      // graduations consécutives.
      fondEtiquette(gEtiquettes, t, { padding: 3 });
    }
  }

  // Frontières historiques soulignées : A en bleu clair, M (beta+gamma) en
  // violet - regroupées avec l'iso-ferrite (lignes de repère structurel).
  const front = zones.frontieres;
  if (front) {
    gPlan.appendChild(el("polyline", { points: pts(front.alpha), fill: "none", stroke: "#38bdf8", "stroke-width": 1.6 }));
    gPlan.appendChild(el("polyline", { points: pts(front.beta), fill: "none", stroke: "#a78bfa", "stroke-width": 1.6 }));
    gPlan.appendChild(el("polyline", { points: pts(front.gamma), fill: "none", stroke: "#a78bfa", "stroke-width": 1.6 }));
  }

  // 4/5. Bandes idéale/acceptable en entonnoir : région entre deux
  // iso-ferrite, clippée à la zone AF ET au mur Cr_eq ≤ 25 (inchangé).
  // La bande bleue (idéale) est l'élément le plus saturé du diagramme et se
  // dessine par-dessus la verte (acceptable).
  const gBandesAF = el("g", { "clip-path": `url(#clip-af-${idSvg})` });
  const gBandesSigma = el("g", { "clip-path": `url(#clip-sigma-${idSvg})` });
  gBandesAF.appendChild(gBandesSigma);
  const gAcceptable = gPourPct(0), gAcceptableHaut = gPourPct(20);
  const gIdeale = gPourPct(5), gIdealeHaut = gPourPct(15);
  const bandeAcceptable = bandePolygon(gAcceptable, gAcceptableHaut);
  const bandeIdeale = bandePolygon(gIdeale, gIdealeHaut);
  if (bandeAcceptable) {
    gBandesSigma.appendChild(el("polygon", {
      points: pts(bandeAcceptable), fill: "#10B981", "fill-opacity": 0.65,
      stroke: "#34D399", "stroke-width": 1.2,
    }));
  }
  if (bandeIdeale) {
    gBandesSigma.appendChild(el("polygon", {
      points: pts(bandeIdeale), fill: "#3B82F6", "fill-opacity": 0.9,
      stroke: "#93C5FD", "stroke-width": 1.5,
    }));
  }
  gPlan.appendChild(gBandesAF);

  // Étiquettes posées sur les bandes. L'ancre n'est pas déduite d'une
  // formule au repère fixe (risque de tomber hors de la zone réellement
  // visible après clipping, ex. sur le S blanc là où la bande n'est pas
  // rendue) : on cherche le Cr_eq où l'intersection bande ∩ AF est la plus
  // épaisse (etendueVerticale), donc un point garanti sur la bande visible.
  const pxParNi = plotH / (niMax - niMin);
  function meilleureAncreBande(gLow, gHigh) {
    if (!zoneAF) return null;
    let meilleur = null;
    for (let cr = 18; cr <= 24.6; cr += 0.4) {
      const niHaut = cr - gLow; // borne haute (moins de ferrite)
      const niBas = cr - gHigh; // borne basse (plus de ferrite)
      const ext = etendueVerticale(zoneAF.polygone, cr);
      if (!ext) continue;
      const visMin = Math.max(niBas, ext[0]);
      const visMax = Math.min(niHaut, ext[1]);
      if (visMax <= visMin) continue;
      const epaisseur = visMax - visMin;
      if (!meilleur || epaisseur > meilleur.epaisseur) {
        meilleur = { cr, ni: (visMin + visMax) / 2, epaisseur };
      }
    }
    return meilleur;
  }
  function etiquetteBande(ancre, texte, couleur, options = {}) {
    if (!ancre) return;
    const { deportForce = false, deportDX = 22, deportDY = -16 } = options;
    const cx = X(ancre.cr);
    const cy = Y(ancre.ni);
    const epaisseurPx = ancre.epaisseur * pxParNi;
    const SEUIL_PX = 11;
    if (!deportForce && epaisseurPx >= SEUIL_PX) {
      const t = el("text", {
        x: cx, y: cy + 3, fill: couleur, "font-size": 7.5, "font-weight": 700,
        "text-anchor": "middle", "pointer-events": "none",
      });
      t.textContent = texte;
      gEtiquettes.appendChild(t);
      fondEtiquette(gEtiquettes, t);
    } else {
      const cxOut = cx + deportDX, cyOut = cy + deportDY;
      const finX = cxOut - 3, finY = cyOut + (deportDY < 0 ? 2 : -2);
      // Halo sombre sous le trait de rappel, même principe que halo() sur
      // le texte : la couleur pâle de la bande (ex. #D1FAE5 vert clair)
      // se fond sinon dans le fond de la bande elle-même qu'elle traverse
      // (constaté sur ACCEPTABLE - invisible sans ce halo).
      gEtiquettes.appendChild(el("line", {
        x1: cx, y1: cy, x2: finX, y2: finY,
        stroke: "#0f172a", "stroke-width": 2.2, "stroke-opacity": 0.55,
      }));
      gEtiquettes.appendChild(el("line", {
        x1: cx, y1: cy, x2: finX, y2: finY,
        stroke: couleur, "stroke-width": 0.8, "stroke-opacity": 0.9,
      }));
      const t = el("text", {
        x: cxOut, y: cyOut, fill: couleur, "font-size": 7.5, "font-weight": 700,
        "text-anchor": "start", "pointer-events": "none",
      });
      t.textContent = texte;
      gEtiquettes.appendChild(t);
      fondEtiquette(gEtiquettes, t);
    }
  }
  // IDÉALE : toujours déportée au-dessus de la bande (dans la zone A, hors
  // S), avec trait de rappel - ne partage jamais l'espace des points de
  // dilution qui gravitent près du centre de la bande elle-même.
  etiquetteBande(meilleureAncreBande(gIdeale, gIdealeHaut), "IDÉALE", "#DBEAFE", {
    deportForce: true, deportDX: 6, deportDY: -36,
  });
  // ACCEPTABLE : toujours déportée (repère franc dans le A+F coloré, à
  // droite/en dessous de la bande bleue) - l'ancrage inline flirtait avec
  // la frontière S/vert selon la géométrie du joint sélectionné.
  etiquetteBande(meilleureAncreBande(gAcceptable, gAcceptableHaut), "ACCEPTABLE", "#D1FAE5", {
    deportForce: true, deportDX: 26, deportDY: 14,
  });

  // 6. Mur phase sigma (Cr_eq = 25), pleine hauteur du plot, avec <title>.
  if (crMin <= 25 && 25 <= crMax) {
    const mur = el("line", {
      x1: X(25), y1: Y(niMin), x2: X(25), y2: Y(niMax),
      stroke: "#fb7185", "stroke-width": 1.3, "stroke-dasharray": "6 4",
    });
    const titre = el("title");
    titre.textContent = TITRE_MUR_SIGMA;
    mur.appendChild(titre);
    gPlan.appendChild(mur);
  }

  // Noms de zones en clair, au centroïde (étiquettes → posées en dernier).
  // A+M+F utilise le centroïde du polygone déjà borné par zone_s
  // (polyAMFVisible, cf. clipAMFcontreZoneS) : le centroïde retombe donc
  // naturellement dans la zone grise réellement visible, sans avoir besoin
  // d'une position fixe pour éviter le S blanc.
  for (const z of zones.zones) {
    const [cx, cy] = centroide(z.id === "AMF" ? polyAMFVisible : z.polygone);
    const t = el("text", {
      x: X(cx), y: Y(cy), fill: "#f8fafc", "font-size": 10, "font-weight": 600,
      "text-anchor": "middle", "pointer-events": "none",
    });
    t.textContent = libelleCourt(z.id);
    gEtiquettes.appendChild(halo(t));
  }

  // --- Axes (formules complètes, graduations tous les 4 points) ---
  if (options.axes !== false) {
    const gAxes = el("g");
    gAxes.appendChild(el("line", { x1: padL, y1: Y(niMin), x2: padL + plotW, y2: Y(niMin), stroke: "#334155", "stroke-width": 1 }));
    gAxes.appendChild(el("line", { x1: padL, y1: padT, x2: padL, y2: padT + plotH, stroke: "#334155", "stroke-width": 1 }));
    const pas = 4;
    for (let cr = Math.ceil(crMin / pas) * pas; cr <= crMax; cr += pas) {
      const tx = el("text", { x: X(cr), y: Y(niMin) + 14, fill: "#94a3b8", "font-size": 9, "text-anchor": "middle" });
      tx.textContent = cr;
      gAxes.appendChild(tx);
    }
    for (let ni = Math.ceil(niMin / pas) * pas; ni <= niMax; ni += pas) {
      const ty = el("text", { x: padL - 6, y: Y(ni) + 3, fill: "#94a3b8", "font-size": 9, "text-anchor": "end" });
      ty.textContent = ni;
      gAxes.appendChild(ty);
    }
    const lx = el("text", { x: padL + plotW / 2, y: H - 4, fill: "#cbd5e1", "font-size": 8.5, "text-anchor": "middle" });
    lx.textContent = "% Eq Cr = Cr + Mo + 1,5 Si + 0,5 Nb";
    gAxes.appendChild(lx);
    const ly = el("text", { x: 10, y: padT + plotH / 2, fill: "#cbd5e1", "font-size": 8.5, "text-anchor": "middle", transform: `rotate(-90 10 ${padT + plotH / 2})` });
    ly.textContent = "% Eq Ni = Ni + 30 C + 0,5 Mn";
    gAxes.appendChild(ly);
    svg.appendChild(gAxes);
  }

  // --- Groupe dynamique (lignes + points + étiquettes des points) ---
  const gDyn = el("g");
  svg.appendChild(gDyn);

  // Étiquettes (zones, %, IDÉALE/ACCEPTABLE) : posées en tout dernier,
  // par-dessus les segments/points de dilution ci-dessus (ordre demandé).
  svg.appendChild(gEtiquettes);

  const infobulle = options.infobulle || null;

  function forme(p) {
    const cx = X(p.cr);
    const cy = Y(p.ni);
    let noeud;
    if (p.forme === "carre") {
      noeud = el("rect", { x: cx - 4.25, y: cy - 4.25, width: 8.5, height: 8.5, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
    } else if (p.forme === "triangle") {
      noeud = el("polygon", { points: `${cx},${cy - 4.2} ${cx + 4.2},${cy + 3.5} ${cx - 4.2},${cy + 3.5}`, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
    } else {
      noeud = el("circle", { cx, cy, r: 3.5, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
    }
    noeud.style.cursor = "pointer";
    if (infobulle && p.tooltip) attacherInfobulle(noeud, p.tooltip, infobulle);
    return noeud;
  }

  function majDynamique(points = [], lignes = []) {
    gDyn.replaceChildren();
    for (const l of lignes) {
      const ligne = el("line", {
        x1: X(l.de[0]), y1: Y(l.de[1]), x2: X(l.a[0]), y2: Y(l.a[1]),
        stroke: l.couleur || "#0d3b66", "stroke-width": l.epaisseur || 1.2,
      });
      if (l.pointille) ligne.setAttribute("stroke-dasharray", "5 4");
      if (l.fleche) ligne.setAttribute("marker-end", `url(#fleche-${idSvg})`);
      if (l.opacite != null) ligne.setAttribute("stroke-opacity", l.opacite);
      gDyn.appendChild(ligne);
    }
    for (const p of points) {
      gDyn.appendChild(forme(p));
    }
  }

  // Marqueur de flèche (défini une fois).
  const mk = el("marker", { id: `fleche-${idSvg}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
  mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#38bdf8" }));
  defs.appendChild(mk);

  return { majDynamique, X, Y };
}

// Attache une infobulle (survol) à un nœud SVG.
function attacherInfobulle(noeud, lignes, bulle) {
  const afficher = (e) => {
    bulle.textContent = lignes.join("\n");
    bulle.hidden = false;
    bulle.style.left = `${e.clientX + 12}px`;
    bulle.style.top = `${e.clientY + 12}px`;
  };
  noeud.addEventListener("pointerenter", afficher);
  noeud.addEventListener("pointermove", afficher);
  noeud.addEventListener("pointerleave", () => (bulle.hidden = true));
}
