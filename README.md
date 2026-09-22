# Soudabilite.com : calculateur de soudabilité en ligne

**[soudabilite.com](https://soudabilite.com)** est un outil gratuit d'aide à la préparation du soudage. Il place un joint soudé sur le diagramme de Schaeffler en tenant compte de la dilution, compare les métaux d'apport candidats et calcule l'énergie de soudage et la température de préchauffage.

Il s'adresse aux étudiants en BTS CRCI et en formation soudage, aux techniciens méthodes, aux préparateurs et aux coordinateurs en soudage.

## Ce que fait l'outil

À partir de deux métaux de base, d'un procédé et d'une géométrie de joint, le calculateur choisit automatiquement l'analyse adaptée.

- **Assemblage inox ou hétérogène** : calcul des équivalents chrome et nickel, construction de la ligne de dilution, position du joint sur le diagramme de Schaeffler, estimation du taux de ferrite et classement de 7 métaux d'apport sur toute la plage de dilution du procédé.
- **Assemblage acier non allié ou faiblement allié** : carbone équivalent, énergie de soudage et température de préchauffage selon la méthode Séférian ou BWRA.
- **Export** d'une fiche de préparation, ou DMOS préliminaire au sens de la NF EN ISO 15607.

La [bibliothèque des matériaux](https://soudabilite.com/bibliotheque-materiaux.html) recense 52 métaux de base et 194 métaux d'apport, avec leur composition chimique complète.

## Ce qu'il ne fait pas

L'outil prépare, il ne qualifie pas. Il ne remplace ni un DMOS qualifié, ni une épreuve de qualification de mode opératoire selon la NF EN ISO 15614-1. Les valeurs proposées sont des points de départ à confronter aux essais et à une macrographie de l'assemblage réel.

## Références normatives

| Référence | Objet |
|---|---|
| NF EN ISO 15607 | Règles générales, DMOS préliminaire |
| NF EN ISO 15609-1 | Contenu du descriptif de mode opératoire |
| NF EN ISO 15614-1 | Épreuve de qualification du mode opératoire |
| NF EN 1011-1 | Énergie de soudage : formule et rendements thermiques (affichée en kJ/cm, 1 kJ/mm = 10 kJ/cm) |
| NF EN 1011-2 | Aciers ferritiques, préchauffage |
| ISO/TR 15608 | Groupement des matériaux |

## Conception

Site statique en HTML, CSS et JavaScript, sans framework ni serveur. Les formules métallurgiques sont isolées dans `assets/js/core/` et les données dans `assets/data/data.json`. Hébergement GitHub Pages derrière Cloudflare.

Outil en version bêta, en développement continu.

## Auteur

Tony Sanchez, BTS CRCI, Pôle Formation UIMM de Savoie. Code sous licence MIT.

---

## English summary

**[soudabilite.com](https://soudabilite.com)** is a free online weldability calculator, in French. It plots a weld joint on the Schaeffler diagram with dilution taken into account, ranks seven candidate filler metals across the whole dilution range of the welding process, and computes heat input in kJ/cm, carbon equivalent and preheat temperature. It includes a database of 52 base metals and 194 filler metals with full chemical composition. It is a preparation aid for welding students and coordinators: it does not qualify a welding procedure and does not replace a qualified WPS or a WPQR.
