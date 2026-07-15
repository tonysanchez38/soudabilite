// soudabilite.com - Tony SANCHEZ - TS-SDB-2026
// =========================================================================
// selection_apport.js - compatibilité procédé ↔ métal d'apport.
// La sélection de l'apport C se fait dans l'onglet Analyse (résultat du
// calcul Schaeffler), pas dans Paramètres. Ce module fournit le filtrage
// des apports par procédé, réutilisé par l'Analyse (étape 5).
//
// Règle : si le champ « procede » de la banque est renseigné, il fait foi.
// Sinon on classe par motifs de désignation (EN ISO 14343 / 2560), avec
// exclusions strictes pour éviter les faux positifs entre procédés.
// =========================================================================

function n(designation) {
  return (designation || "").trim().toLowerCase();
}

// --- Heuristiques de désignation (apport non tagué) ---------------------

// TIG (141) : commence par « tig » / « altig » / « ER » (générique, plus
// exigence de 3 chiffres qui ratait ERNiCr-3, ERCuAl-A2...), ou marque
// INERTROD, ou contient W + 2 chiffres 1x/2x/3x (groupes EN ISO 14343,
// plus générique que l'ancien W 19/23/24). Exclut MAG/MIG/fil/enrobée/SG
// une fois les cas forts (ER/INERTROD) écartés, pour ne pas rejeter par
// erreur un « er » interne ailleurs dans la chaîne.
function heuristTIG(l) {
  if (l.startsWith("inertrod")) return true;
  if (/^er/i.test(l)) return true;
  if (/(mag|mig|fil|enrob|sg)/.test(l)) return false;
  if (l.startsWith("altig") || l.startsWith("tig")) return true;
  if (/\bw\s?[123]\d\b/.test(l)) return true;
  return false;
}

// EE (111) : commence par un code AWS direct « E » + chiffre (ex E6010,
// E308L-16, E2209-16 - n'attrape pas « ER... » car le 2e caractère n'est
// pas un chiffre), ou porte une marque connue de baguette enrobée
// (SAFINOX/STARINOX/FROINOX/FIXINOX/FLAMINOX/INOXAMFER/MOLINOX), ou
// contient « enrobée »/« électrode », ou « E » + code nuance espacé.
// Cas forts vérifiés avant l'exclusion TIG/MIG/MAG/fil/ER pour ne pas
// rejeter par erreur un « er » interne (ex. "E2553-15 super duplex").
function heuristEE(l) {
  if (/^e\d/i.test(l)) return true;
  if (/^(safinox|starinox|froinox|fixinox|flaminox|inoxamfer|molinox)/.test(l))
    return true;
  // Rechargement/fonte : classement "généralement 111" non garanti à
  // 100 % - à signaler si un cas pose problème.
  if (/^(cydur|cyfonte)/.test(l)) return true;
  // ESAB « OK » : seule la marque ne suffit pas à trancher le procédé -
  // on exige un code AWS entre parenthèses commençant par E.
  if (/^ok\b.*\(e\d/i.test(l)) return true;
  if (/(tig|mig|mag|fil|er)/.test(l)) return false;
  if (/enrob|electrode|électrode/.test(l)) return true;
  if (/(^|\s)e\s+[0-9a-z]/.test(l)) return true;
  return false;
}

// MIG/MAG (131/135) : commence par « ER » générique (un fil nu ER est
// utilisable en TIG ou MIG/MAG selon conditionnement) ou marque NERTALIC,
// ou contient SG / fil / MIG / MAG, ou G + 2 chiffres 1x/2x/3x (EN ISO
// 14343). Exclut TIG/enrobée/ALTIG une fois les cas forts écartés.
function heuristMIGMAG(l) {
  if (l.startsWith("nertalic")) return true;
  if (/^er/i.test(l)) return true;
  if (/(tig|enrob|altig)/.test(l)) return false;
  if (/(sg|fil|mig|mag)/.test(l)) return true;
  if (/\bg\s?[123]\d\b/.test(l)) return true;
  return false;
}

// --- Correspondance code banque → bucket procédé ------------------------
function codeBucket(procede) {
  switch (procede) {
    case "111_EE":
      return "111";
    case "141_TIG":
      return "141";
    case "131_MIG":
    case "135_MAG":
      return "131_135";
    default:
      return null;
  }
}

function bucketUI(procedeUI) {
  if (procedeUI === "111") return "111";
  if (procedeUI === "141") return "141";
  return "131_135"; // 131 / 135
}

// Un apport est-il compatible avec le procédé choisi (code UI 111/141/131/135) ?
export function compatible(procedeUI, apport) {
  const cible = bucketUI(procedeUI);
  const cb = codeBucket(apport.procede);
  if (cb) return cb === cible; // procédé renseigné dans la banque → fait foi
  const l = n(apport.designation);
  if (cible === "141") return heuristTIG(l);
  if (cible === "111") return heuristEE(l);
  return heuristMIGMAG(l);
}

// Buckets procédé détectés pour un apport (pour vérification / affichage).
export function bucketsDetectes(apport) {
  return ["111", "141", "131_135"].filter((p) => compatible(p, apport));
}

// Le champ enrobage est-il présent dans la banque ? (n'existe pas encore.)
export function enrobageRenseigne(apports) {
  return (apports || []).some((a) => a && a.enrobage != null);
}

// Apports compatibles pour l'Analyse, avec sous-filtrage par enrobage (EE).
// Si la donnée d'enrobage est absente, tous les apports EE sont conservés
// (le sous-filtrage sera actif quand la banque portera le champ).
export function apportsCompatibles(apports, procedeUI, { enrobage = null } = {}) {
  return (apports || [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => compatible(procedeUI, a))
    .filter(
      ({ a }) =>
        procedeUI !== "111" ||
        enrobage == null ||
        a.enrobage == null ||
        a.enrobage === enrobage
    )
    .map(({ a, i }) => ({ value: String(i), label: a.designation }));
}

// Table de classement complète (désignation, procédé banque, buckets détectés).
export function classementApports(apports) {
  return (apports || []).map((a) => ({
    designation: a.designation,
    procede: a.procede ?? null,
    detecte: bucketsDetectes(a),
  }));
}

// Rang de tri par verdict - idéale d'abord, hors-zone en dernier.
const RANG_VERDICT = { ideal: 0, acceptable: 1, zone_s: 2, hors: 3 };

// --- Sélection des 7 meilleurs apports - spec.md §10 --------------------
// Pour chaque apport compatible : JOINT = D_A·A + D_B·B + D_C·C (spec.md §2.1),
// puis (Cr_eq, Ni_eq) Schaeffler du JOINT, % ferrite et distance euclidienne
// au centre de la zone idéale. Tri à deux clés : 1) rang du verdict (idéale
// > acceptable > zone S > hors, via la cascade niveauIdeal() injectée -
// même logique que le badge affiché, zéro divergence tableau/verdict) ;
// 2) distance croissante au centre à l'intérieur de chaque groupe. n premiers.
//
// Duplex/superduplex (A, B ou l'apport candidat) : le rang et la distance
// de tri sont recalculés sur le critère WRC-1992/ferrite 30-70 % (ISO 17781
// / NORSOK M-601), pas sur les polygones Schaeffler - sans ce branchement,
// le tri pouvait classer « hors » un joint que le badge affiché (calculé
// séparément dans vue_analyse.js avec la même logique duplex) juge idéal,
// et l'apport idéal réel pouvait manquer les 7 premiers. crEq/niEq/ferrite
// renvoyés restent Schaeffler dans tous les cas : l'affichage duplex
// (crEqWRC/niEqWRC) est recalculé côté appelant pour le formatage.
export function meilleursApports(
  apports,
  procedeUI,
  {
    A, B, dA, dB, dC, centre, joint, crEq, niEq, ferrite, niveauIdeal, zones, zoneS,
    estDuplex, verdictDuplex, ferriteApproxWRC, crEqWRC, niEqWRC,
    designationA, designationB,
    n = 7,
  }
) {
  const duplexBase = estDuplex
    ? estDuplex(designationA) || estDuplex(designationB)
    : false;

  return (apports || [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => compatible(procedeUI, a))
    .map(({ a, i }) => {
      const comp = joint(A, B, a.composition, dA, dB, dC);
      const cr = crEq(comp);
      const ni = niEq(comp);
      const fer = ferrite(cr, ni);
      const duplex = duplexBase || (estDuplex ? estDuplex(a.designation) : false);

      let niveau, dist;
      if (duplex && verdictDuplex && ferriteApproxWRC && crEqWRC && niEqWRC) {
        const crW = crEqWRC(comp);
        const niW = niEqWRC(comp);
        const ferW = ferriteApproxWRC(crW, niW);
        niveau = verdictDuplex(ferW).niveau;
        // Cible = milieu de bande idéale 30-70% ferrite (ISO 17781/NORSOK
        // M-601) - hypothèse de tri, à confirmer.
        dist = Math.abs(ferW - 50);
      } else {
        niveau = niveauIdeal ? niveauIdeal(cr, ni, zones, zoneS) : null;
        dist = Math.hypot(cr - centre[0], ni - centre[1]);
      }

      return {
        index: i, designation: a.designation, composition: a.composition, joint: comp,
        crEq: cr, niEq: ni, ferrite: fer, distance: dist, niveau, duplex,
        rangVerdict: RANG_VERDICT[niveau] ?? RANG_VERDICT.hors,
      };
    })
    .sort((x, y) => x.rangVerdict - y.rangVerdict || x.distance - y.distance)
    .slice(0, n);
}
