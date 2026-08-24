// Gardes de périmètre. Détecter une famille exclue ne constitue pas un
// calcul métallurgique : cela sert uniquement à refuser un verdict trompeur.
const RE_DUPLEX = /duplex|super.?duplex|\b2205\b|\b2507\b|\b2209\b|\b2594\b|25.22.2|22\s?9\s?3|25\s?9\s?4/i;

export function estDuplex(designation) {
  return RE_DUPLEX.test(designation || "");
}
