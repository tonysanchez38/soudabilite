# Calculateur de Soudabilité — Aide au DMOS

**Auteur** : Tony SANCHEZ — alternant Préparateur Technique / Chiffreur Projets,
EQUANS Process Solutions, Crolles (38). BTS CRCI 2025-2027.

**URL cible** : https://soudabilite.com (OVH → GitHub Pages).

**Statut** : mission de construction. Ce fichier est la mémoire permanente du
projet, à relire au début de chaque session Claude Code.

---

## Mission

Application web 100 % client-side (aucun backend, aucun serveur applicatif) d'aide
à la préparation du DMOS (Descriptif de Mode Opératoire de Soudage). Publiée
gratuitement à destination des coordinateurs en soudage IWE/IWT et des étudiants
en soudage/métallurgie (BTS CRCI, licence pro, école d'ingénieur).

L'outil calcule, positionne et propose. Il ne qualifie pas. La QMOS
(EN ISO 15614-1) et l'essai réel tranchent toujours.

## Positionnement métier

Là où Rocd@cier fragmente les outils, où SSAB WeldCalc reste enfermé dans son
catalogue, cet outil intègre en une interface unique :

- Aiguillage automatique acier carbone / inox / hétérogène
- Diagramme de Schaeffler interactif (placement A / B / C / D_mélange / JOINT
  par dilution + sélection des 7 meilleurs apports vers la zone idéale)
- Analyse thermique complète (préchauffe IRSID + CET + méthodes secondaires,
  t8/5 EN 1011-2 avec transition 2D/3D, dureté Yurioka/Düren vs limites
  HV10 par groupe ISO 15608)
- Ferrite Number rigoureux (WRC-1992) affiché à côté du placement Schaeffler
- Export PDF traçable
- Contenu bilingue prévu (structure i18n prête, FR uniquement au Lot 1)

## Décisions actées (16, verrouillées par Tony)

### Fond

1. **Public cible** : étudiants/enseignants + IWE/IWT. Deux modes UI
   (Pédagogique par défaut / Expert). Bascule persistée en localStorage.
2. **Périmètre matériaux** : inox + acier carbone + hétérogène. Aiguillage
   automatique selon les seuils indicatifs :
   - Si A ou B contient Cr ≥ 10.5 % OU Ni ≥ 8 % → branche Schaeffler active
   - Si A ET B sont carbone/faiblement alliés (Cr < 5 %, Ni < 3 %) → branche
     thermique active
   - Si un des deux est inox et l'autre carbone → les deux branches actives
     en parallèle avec verdict croisé
3. **Disclaimer** : encart pied de page permanent + rappel dans la synthèse
   Analyse.
   Formulation figée : *"Aide à la préparation du DMOS. Ne se substitue ni
   à un DMOS qualifié ni à la QMOS (EN ISO 15614-1)."*
4. **Export** : PDF unique dès le MVP (jsPDF côté navigateur, aucun backend).
5. **Signature PDF** : *"Généré par Tony SANCHEZ"* en pied de page, discret.
   Nom en capitales (convention formelle française).
6. **Persistance** : aucune. Chaque ouverture de page repart de zéro.
   L'utilisateur doit générer le PDF s'il veut archiver. Bandeau visible dans
   l'onglet Analyse : *"Ce calcul n'est pas sauvegardé. Générer le PDF pour
   archiver."*
7. **Banque matériaux** : figée + saisie libre pour nuance hors-liste (session
   uniquement, perdue à la fermeture). Une nuance saisie libre est balisée
   *"[saisie libre]"* dans les listes et dans le PDF.
8. **Direction esthétique** : ingénierie moderne épurée. Blanc dominant, accent
   bleu profond (couleur exacte à trancher au Lot 2 parmi : navy Excel #0D1B5E,
   bleu doux #0D3B66, bleu Tailwind #1E3A8A). Typographie Inter ou IBM Plex
   Sans. Espacement généreux.
9. **Densité Analyse** : scroll long structuré par cartes. Une carte = une
   section du PDF (Schaeffler / Thermique / TRCS / Synthèse globale).
   Zéro divergence entre écran et rapport.
10. **Interactivité diagrammes** : hover partout (infobulles coordonnées).
    Mini-diagramme zoomé sur voisinage du JOINT à côté du grand Schaeffler
    (Cr_eq 18-26, Ni_eq 8-16). Pas de drag ni de zoom molette au Lot 1.
11. **Listes matériaux** : combobox à recherche libre (l'utilisateur ouvre,
    tape "309", les 309 s'affichent). Sans tags de famille. Lib légère type
    Choices.js.
12. **Verdicts normatifs** : icône (✓ ⚠ ✗) + texte + justification courte.
    Lisible en noir et blanc.
13. **Onglet Présentation** : court et institutionnel. Une vue, pas de scroll.
    Titre / description 3-4 lignes / tableau des normes / sommaire onglets /
    lien LinkedIn discret / disclaimer.
14. **Responsive** : de base au Lot 1 (cartes qui s'empilent, saisie
    tactile OK). Polissage mobile en Lot 2 avant diffusion publique.
15. **Nom + URL** : *Calculateur de Soudabilité* — `soudabilite.com` acheté
    chez OVH pour 3 ans. Hébergement GitHub Pages gratuit.
16. **Titre app** : *Calculateur de Soudabilité* (sobre, nom seul).

### Techniques

17. **% ferrite** : convention WRC-1992 rigoureuse pour la valeur chiffrée du
    Ferrite Number. Placement visuel sur axes Schaeffler/DeLong (image de
    fond de Tony). Diagramme WRC en visuel plein → Lot 4 (duplex).
18. **TRCS** : axes linéaires. X = t8/5 en secondes (0-60 s). Y gauche =
    température °C (800 en haut → 500 en bas). Y droit = dureté HV5. Cinq
    TRCS prioritaires à digitaliser : S235JR, S355/E36, P265GH, 15CD4, 25CD4.
19. **Onglets** : 4 (Présentation / Paramètres DMOS / Analyse / Banque).
    L'Analyse regroupe Schaeffler + thermique + TRCS + synthèse en cartes.
20. **Ordre méthodes préchauffe** : IRSID en principal (le plus précis d'après
    la doc de Tony), CET en principal secondaire (référence industrielle EN
    1011-2 actuelle). Séférian, BWRA, Baus-Chapeau en méthodes comparatives
    dépliables. Verdict Tp final = max des méthodes principales (conservative).
21. **Formules d'intensité par procédé** : les 5 cas conservés (EE plat 111
    à plat, EE angle, EE corniche/montante, TIG acier, TIG inox). Voir spec.md.
22. **Analytics** : GoatCounter (RGPD sans bandeau cookies, compteur public
    affichable). Compteur discret en pied de page Présentation.
23. **Architecture** : modulaire dès le Lot 1. Moteur isolé dans modules JS
    séparés. Banque JSON externe. Chaînes i18n extraites dans `i18n/fr.json`
    (le fichier `en.json` sera créé au Lot 3).

## Séquence de construction — 11 étapes

1. Fond et architecture (CLAUDE.md, arborescence, spec.md, data.json)
2. Achat `soudabilite.com` sur OVH ✅ FAIT
3. Design system + onglet Présentation
4. Banque de données matière + moteur de calcul + formules + méthodes + normes
   + onglet Paramètres DMOS (alimentation du moteur)
5. Schaeffler (placement + sélection des 7 apports + verdict)
   → **La sélection du métal d'apport C se fait dans l'onglet Analyse, après
   le calcul Schaeffler, pas dans Paramètres DMOS.** L'apport n'est pas une
   donnée d'entrée mais un résultat de l'analyse (proposition des 7 meilleurs
   apports, puis choix de l'utilisateur). Paramètres DMOS ne saisit que les
   métaux de base A/B, le procédé/électrode, la géométrie et la dilution.
   Le module `core/selection_apport.js` porte le filtrage apport ↔ procédé.
6. Préchauffe (IRSID, CET principaux ; Séférian, BWRA, Baus-Chapeau secondaires)
7. Temps de refroidissement t8/5 + point de dureté (EN 1011-2, transition
   2D/3D, Yurioka, Düren, vs limites HV10 par groupe ISO 15608)
8. Analyse et confirmation de soudabilité (synthèse croisée, verdicts, alertes)
9. Export PDF (jsPDF, mise en page, cartouche, sections)
10. Polissage responsive mobile
11. Série de tests avant première diffusion (5-8 cas de validation)

Estimation honnête : 5 à 6 séances de travail sérieuses. Diffusion beta d'ici
2 à 3 semaines à raison d'une séance tous les 2-3 jours.

**Règle de conduite** : rien ne passe à l'étape suivante tant que l'étape
courante n'est pas testable seule.

## Stack technique imposée

- HTML5 + CSS3 + JavaScript vanilla (ES2020+). Pas de framework lourd
  (pas de React, Vue, Angular). Le poids compte pour une appli statique.
- Bibliothèques externes autorisées, chargées depuis CDN :
  - **jsPDF** (export PDF)
  - **Choices.js** (combobox à recherche)
  - **GoatCounter** (script d'analytics, 1 ligne)
- SVG natif pour tous les diagrammes (Schaeffler, TRCS, Fer-Carbone).
  JAMAIS de calage sur image de fond en pixels — projection en coordonnées
  réelles (Cr_eq / Ni_eq pour Schaeffler ; t8/5 / T ou HV pour TRCS).
- Aucun backend, aucune base de données. Tout tient dans un dépôt Git
  déployé statiquement sur GitHub Pages.

## Arborescence du dépôt (à créer)

```
soudabilite/
├── index.html                    # onglet Présentation (point d'entrée)
├── parametres.html               # onglet Paramètres DMOS
├── analyse.html                  # onglet Analyse
├── banque.html                   # onglet Banque
├── assets/
│   ├── css/
│   │   ├── main.css              # design system global
│   │   └── print.css             # styles PDF
│   ├── js/
│   │   ├── core/
│   │   │   ├── equivalents.js    # Cr_eq / Ni_eq (Schaeffler, DeLong, WRC-1992)
│   │   │   ├── dilution.js       # calcul JOINT et D_mélange par dilution
│   │   │   ├── carbone_eq.js     # CE_IIW, CET
│   │   │   ├── energie.js        # I, U, Vs, En, Q corrigée (5 procédés)
│   │   │   ├── thermique.js      # t8/5, transition dt 2D/3D
│   │   │   ├── prechauffe.js     # IRSID, CET, Séférian, BWRA, Baus-Chapeau
│   │   │   ├── durete.js         # Yurioka, Düren, HV_FP, HV_B
│   │   │   ├── normes.js         # ISO 15608 groupes, limites HV10
│   │   │   ├── aiguillage.js     # règle inox / carbone / hétérogène
│   │   │   └── selection_apport.js  # sélection des 7 meilleurs C
│   │   ├── ui/
│   │   │   ├── schaeffler_svg.js # rendu SVG Schaeffler
│   │   │   ├── trcs_svg.js       # rendu SVG TRCS
│   │   │   ├── combobox.js       # binding Choices.js
│   │   │   ├── verdicts.js       # affichage icônes ✓ ⚠ ✗
│   │   │   └── pdf_export.js     # jsPDF, mise en page
│   │   └── app.js                # orchestrateur, aucune logique métier
│   ├── data/
│   │   ├── data.json             # nuances aciers + apports (fournie)
│   │   ├── zones_schaeffler.json # polygones des zones (à digitaliser)
│   │   ├── trcs/                 # une courbe par acier (à digitaliser)
│   │   │   ├── s235jr.json
│   │   │   ├── s355.json
│   │   │   ├── p265gh.json
│   │   │   ├── 15cd4.json
│   │   │   └── 25cd4.json
│   │   └── normes/
│   │       ├── iso_15608_groupes.json
│   │       └── hv10_limites.json
│   ├── i18n/
│   │   └── fr.json               # toutes les chaînes visibles
│   └── img/
│       └── schaeffler_bg.svg     # fond Schaeffler vectorisé (à faire)
├── CLAUDE.md                     # ce fichier
├── spec.md                       # formules et sources normatives
├── README.md                     # présentation projet publique
├── LICENSE                       # à trancher (MIT probable pour diffusion libre)
└── CNAME                         # contient "soudabilite.com" pour GitHub Pages
```

## Règles métallurgiques verrouillées

- **Cr_eq / Ni_eq Schaeffler (1949)** :
  Cr_eq = Cr + Mo + 1.5·Si + 0.5·Nb
  Ni_eq = Ni + 30·C + 0.5·Mn
- **Cr_eq / Ni_eq DeLong (1974)** : identique Schaeffler pour Cr_eq ;
  Ni_eq = Ni + 30·C + 30·N + 0.5·Mn (ajout de l'azote)
- **Cr_eq / Ni_eq WRC-1992** :
  Cr_eq = Cr + Mo + 0.7·Nb
  Ni_eq = Ni + 35·C + 20·N + 0.25·Cu
- **JOINT** = barycentre pondéré : D_A·A + D_B·B + D_C·C, avec D_A+D_B+D_C=1.
- **D_mélange** = (D_A·A + D_B·B) / (D_A + D_B). À tracer aussi (lecture
  pédagogique : métal de base mixte → tir vers l'apport).
- **Vocabulaire figé** : D_A, D_B = contributions des métaux de base fondus
  au bain ; D_C = fraction d'apport dans le bain (= 1 − dilution au sens
  usuel). Définir explicitement en tête d'onglet.
- **Zone idéale** = corridor Schaeffler central (bande bleue de Tony),
  ferrite 5-10 % (variante 5-15 % acceptée), Cr_eq < 25 % (anti-sigma).
- **Zone acceptable** = reste du volume en S (bande verte de Tony).
- **Frontières de zones** = polygones (droites entre sommets mesurés).
  JAMAIS de contour bitmap.

## Style d'output attendu de Claude Code

- Français partout (interface, commentaires code, messages Git).
- Commentaires code sourcent la formule ou la norme utilisée.
- Un module = une responsabilité. Fonctions pures autant que possible.
- Aucun style inline ni JS dans le HTML — tout externalisé.
- Toute chaîne visible passe par `i18n/fr.json`. Zéro texte en dur.
- Après chaque étape achevée : commit Git avec message explicite.

## Points à NE PAS trancher seul — demander à Tony

- Choix final de la couleur bleu principale (parmi 3 options au Lot 2).
- Coordonnées digitalisées des 5 TRCS (Tony fournit).
- Formules d'intensité manquantes pour MIG/MAG (V_fil = f(I), abaque).
- Ajout d'un cas hors des 5 TRCS de référence.
- Passage à la version anglaise (Lot 3).
- Ajout des modules Lot 4 (WRC-1992 visuel, UCS, Bruscato, PWHT, PED/CND).

## Points de vigilance à afficher dans l'app

- Erreur des pinces ampèremétriques TRMS en TIG AC (surestimation 17-70 %).
  Recommander wattmètre pour calcul énergie réelle.
- Effet de régénération thermique en soudage multipasse (affinement grain,
  revenu ZAT).
- QMOS ±25 % : alerter si l'énergie sort de la fenêtre qualifiée.

## Ce que le fichier Excel actuel a de bon et de mauvais

**Bon** : les équivalents Cr_eq/Ni_eq sont corrects, le JOINT par dilution
est un vrai barycentre, les 7 meilleurs apports sont classés proprement.
On transporte cette logique telle quelle.

**Mauvais** : le placement visuel décale (axes chart 0-36 / 0-28 vs axes du
fond 0-32 / 0-24), la branche thermique est débranchée (cellules d'entrée
non reliées à la saisie DMOS). On reconstruit en SVG à axes uniques, on
recâble la thermique en repartant des formules dans spec.md.

## Références externes

- SSAB WeldCalc — benchmark leader du marché (approche WPS)
- Migal.co — Schaeffler online, benchmark technique simple
- WeldStack.io — préchauffage EN 1011-2, benchmark UX moderne
- JWES — méthode Yurioka de référence
- Institut de Soudure, IIW/EWF — corpus normatif

## Fin

Rappel : les 16 décisions actées sont fermes. Tout écart doit remonter à
Tony avant intégration.
