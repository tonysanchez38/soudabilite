// =========================================================================
// schaeffler_svg.js — rendu SVG natif du diagramme de Schaeffler.
// Coordonnées réelles (Cr_eq en abscisse, Ni_eq en ordonnée). Aucune image
// de fond (CLAUDE.md : projection en coordonnées réelles). Aucune logique
// métier : purement graphique.
// =========================================================================

const NS = "http://www.w3.org/2000/svg";

function el(nom, attrs = {}) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Crée un diagramme dans un <svg>. Renvoie une API pour mettre à jour les
// points et lignes dynamiques.
//   zones     : contenu de zones_schaeffler.json
//   fenetre   : { cr:[min,max], ni:[min,max] }
//   options   : { axes:bool, isoLabels:bool, cadreZoom:{cr,ni}, infobulle:HTMLEl }
export function creerDiagramme(svg, zones, fenetre, options = {}) {
  const W = 100 * (fenetre.cr[1] - fenetre.cr[0] > 12 ? 4.4 : 3);
  const H = 340;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  svg.setAttribute("viewBox", `0 0 ${440} ${H}`);
  svg.replaceChildren();

  const [crMin, crMax] = fenetre.cr;
  const [niMin, niMax] = fenetre.ni;
  const plotW = 440 - padL - padR;
  const plotH = H - padT - padB;
  const X = (cr) => padL + ((cr - crMin) / (crMax - crMin)) * plotW;
  const Y = (ni) => padT + (1 - (ni - niMin) / (niMax - niMin)) * plotH;

  // --- Defs : hachure (zone A+M+F) + clip du plot ---
  const defs = el("defs");
  const hachure = el("pattern", {
    id: `hachure-${svg.id || "d"}`,
    width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)",
  });
  hachure.appendChild(el("rect", { width: 6, height: 6, fill: "#a16207", "fill-opacity": 0.35 }));
  hachure.appendChild(el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#eab308", "stroke-width": 1.4 }));
  defs.appendChild(hachure);
  const clip = el("clipPath", { id: `clip-${svg.id || "d"}` });
  clip.appendChild(el("rect", { x: padL, y: padT, width: plotW, height: plotH }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // --- Groupe clippé : zones, overlays, iso-ferrite ---
  const gPlan = el("g", { "clip-path": `url(#clip-${svg.id || "d"})` });
  svg.appendChild(gPlan);

  const pts = (poly) => poly.map(([cr, ni]) => `${X(cr)},${Y(ni)}`).join(" ");

  for (const z of zones.zones) {
    gPlan.appendChild(
      el("polygon", {
        points: pts(z.polygone),
        fill: z.hachure ? `url(#hachure-${svg.id || "d"})` : z.couleur,
        "fill-opacity": z.hachure ? 1 : 0.55,
        stroke: "#0f172a",
        "stroke-width": 0.5,
      })
    );
  }

  // Overlays zone idéale (bleu) et acceptable (vert), semi-transparents.
  gPlan.appendChild(
    el("polygon", { points: pts(zones.overlays.acceptable.polygone), fill: zones.overlays.acceptable.couleur, "fill-opacity": 0.18, stroke: zones.overlays.acceptable.couleur, "stroke-width": 1 })
  );
  gPlan.appendChild(
    el("polygon", { points: pts(zones.overlays.ideale.polygone), fill: zones.overlays.ideale.couleur, "fill-opacity": 0.28, stroke: zones.overlays.ideale.couleur, "stroke-width": 1.2 })
  );

  // Iso-ferrite : droites g = Cr_eq − Ni_eq = cste.
  for (const iso of zones.isoferrite) {
    const g = iso.g;
    const ni0 = Math.max(niMin, crMin - g);
    const ni1 = Math.min(niMax, crMax - g);
    if (ni0 >= ni1) continue;
    gPlan.appendChild(
      el("line", { x1: X(ni0 + g), y1: Y(ni0), x2: X(ni1 + g), y2: Y(ni1), stroke: "#e2e8f0", "stroke-width": 0.6, "stroke-opacity": 0.5 })
    );
    if (options.isoLabels) {
      const t = el("text", { x: X(ni1 + g) - 2, y: Y(ni1) + 9, fill: "#94a3b8", "font-size": 8, "text-anchor": "end" });
      t.textContent = `${iso.pct}%`;
      gPlan.appendChild(t);
    }
  }

  // Cadre de zoom (sur le grand diagramme) montrant la fenêtre du mini.
  if (options.cadreZoom) {
    const c = options.cadreZoom;
    gPlan.appendChild(
      el("rect", { x: X(c.cr[0]), y: Y(c.ni[1]), width: X(c.cr[1]) - X(c.cr[0]), height: Y(c.ni[0]) - Y(c.ni[1]), fill: "none", stroke: "#38bdf8", "stroke-width": 1, "stroke-dasharray": "4 3" })
    );
  }

  // --- Axes ---
  if (options.axes !== false) {
    const gAxes = el("g");
    gAxes.appendChild(el("line", { x1: padL, y1: Y(niMin), x2: padL + plotW, y2: Y(niMin), stroke: "#334155", "stroke-width": 1 }));
    gAxes.appendChild(el("line", { x1: padL, y1: padT, x2: padL, y2: padT + plotH, stroke: "#334155", "stroke-width": 1 }));
    const pasCr = crMax - crMin > 12 ? 4 : 2;
    for (let cr = Math.ceil(crMin); cr <= crMax; cr += pasCr) {
      const tx = el("text", { x: X(cr), y: H - 8, fill: "#94a3b8", "font-size": 9, "text-anchor": "middle" });
      tx.textContent = cr;
      gAxes.appendChild(tx);
    }
    const pasNi = niMax - niMin > 12 ? 4 : 2;
    for (let ni = Math.ceil(niMin); ni <= niMax; ni += pasNi) {
      const ty = el("text", { x: padL - 5, y: Y(ni) + 3, fill: "#94a3b8", "font-size": 9, "text-anchor": "end" });
      ty.textContent = ni;
      gAxes.appendChild(ty);
    }
    const lx = el("text", { x: padL + plotW / 2, y: H - 0.5, fill: "#cbd5e1", "font-size": 9, "text-anchor": "middle" });
    lx.textContent = "Cr_eq";
    gAxes.appendChild(lx);
    const ly = el("text", { x: 10, y: padT + plotH / 2, fill: "#cbd5e1", "font-size": 9, "text-anchor": "middle", transform: `rotate(-90 10 ${padT + plotH / 2})` });
    ly.textContent = "Ni_eq";
    gAxes.appendChild(ly);
    svg.appendChild(gAxes);
  }

  // --- Groupe dynamique (lignes + points) ---
  const gDyn = el("g");
  svg.appendChild(gDyn);
  const infobulle = options.infobulle || null;

  function forme(p) {
    const cx = X(p.cr);
    const cy = Y(p.ni);
    let noeud;
    if (p.forme === "carre") {
      noeud = el("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
    } else if (p.forme === "triangle") {
      noeud = el("polygon", { points: `${cx},${cy - 6} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
    } else {
      noeud = el("circle", { cx, cy, r: 6, fill: p.couleur, stroke: "#0f172a", "stroke-width": 1 });
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
        stroke: l.couleur || "#0d3b66", "stroke-width": l.epaisseur || 1.5,
      });
      if (l.pointille) ligne.setAttribute("stroke-dasharray", "5 4");
      if (l.fleche) ligne.setAttribute("marker-end", `url(#fleche-${svg.id || "d"})`);
      gDyn.appendChild(ligne);
    }
    for (const p of points) gDyn.appendChild(forme(p));
  }

  // Marqueur de flèche (défini une fois).
  const mk = el("marker", { id: `fleche-${svg.id || "d"}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
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
