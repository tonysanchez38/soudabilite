// Gardes de périmètre. Détecter une famille exclue ne constitue pas un
// calcul métallurgique : cela sert uniquement à refuser un verdict trompeur.
const RE_DUPLEX = /duplex|super.?duplex|\b2205\b|\b2507\b|\b2209\b|\b2594\b|25.22.2|22\s?9\s?3|25\s?9\s?4/i;

export function estDuplex(designation) {
  return RE_DUPLEX.test(designation || "");
}

// Usage d'un apport (data.json, champ « usage », DECISIONS.md #35).
// assemblage : proposé dans la sélection des 7.
// refractaire : proposé seulement si un métal de base est réfractaire
// (champ « refractaire » de metaux_base) - un fil type 253MA ou 310 ne doit
// pas passer devant un 309L ou un 316L sur un assemblage courant.
// rechargement, fonte : jamais proposés pour un assemblage d'aciers.
export function usageAdmis(apport, baseRefractaire = false) {
  const usage = apport?.usage ?? "assemblage";
  if (usage === "assemblage") return true;
  if (usage === "refractaire") return baseRefractaire === true;
  return false;
}
