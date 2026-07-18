# Spécification technique — Calculateur de Soudabilité

Ce fichier est la référence unique pour toutes les formules du moteur. Une
formule ne doit apparaître qu'ici. Le code des modules JS se contente de
l'implémenter, en citant la référence.

**Convention** : les compositions sont en pourcentage massique (%wt).
Les températures en °C. Les épaisseurs en mm. Les énergies en kJ/mm.

---

## 1. Équivalents en Chrome et en Nickel

### 1.1 Schaeffler (1949) — usage : placement visuel sur le diagramme de Tony
```
Cr_eq = %Cr + %Mo + 1.5 · %Si + 0.5 · %Nb
Ni_eq = %Ni + 30 · %C + 0.5 · %Mn
```
Source : Schaeffler A.L., *Constitution diagram for stainless steel weld
metal*, Metal Progress, 1949.

### 1.2 DeLong (1974) — variante Schaeffler intégrant l'azote
```
Cr_eq = %Cr + %Mo + 1.5 · %Si + 0.5 · %Nb        (identique Schaeffler)
Ni_eq = %Ni + 30 · %C + 30 · %N + 0.5 · %Mn
```
Source : DeLong W.T., *Ferrite in austenitic stainless steel weld metal*,
Welding Journal 53(7), 1974.

### 1.3 WRC-1992 — usage : Ferrite Number rigoureux, référence duplex
```
Cr_eq = %Cr + %Mo + 0.7 · %Nb
Ni_eq = %Ni + 35 · %C + 20 · %N + 0.25 · %Cu
```
Source : Kotecki D.J., Siewert T.A., *WRC-1992 constitution diagram for
stainless steel weld metals*, Welding Journal 71(5), 1992.

**Décision d'usage** : Schaeffler/DeLong pour le placement des points et le
tracé des zones sur le diagramme (cohérence avec l'image de fond de Tony).
WRC-1992 pour la valeur chiffrée du % ferrite, affichée à côté du point.

---

## 2. Chimie du bain (Zone Fondue)

### 2.1 Composition du JOINT
Pour chaque élément x (C, Mn, Si, Cr, Ni, Mo, Nb, N, Cu, Ti) :
```
%x_JOINT = D_A · %x_A + D_B · %x_B + D_C · %x_C
avec D_A + D_B + D_C = 1
```

### 2.2 Point intermédiaire D_mélange (métaux de base seuls, avant apport)
```
%x_Dmélange = (D_A · %x_A + D_B · %x_B) / (D_A + D_B)
```
À tracer pour la lecture pédagogique : D_mélange → tir vers C → JOINT.

### 2.3 Taux de dilution par procédé (valeurs typiques, plage à afficher)

| Procédé | Code ISO 4063 | Dilution base (D_A + D_B) |
|---------|---------------|----------------------------|
| TIG     | 141           | 15 % à 30 %                |
| EE      | 111           | 10 % à 35 %                |
| MIG/MAG | 131 / 135     | 20 % à 40 %                |
| SAW     | 121           | 30 % à 60 %                |

Source : ta doc « Cadre normatif », section 5 (croisée avec EN 1011-1).

---

## 3. Paramètres électriques par procédé

### 3.1 Électrode enrobée (111)

Intensité selon position et diamètre ∅ (mm) :
```
Plat (PA) :               I = 50 · (∅ − 1)
Angle intérieur (FW) :    I = 60 · (∅ − 1)
Corniche / Montante :     I = 40 · (∅ − 1)
```

Tension :
```
U = 20 + 0.04 · I
```

Vitesse : 15 à 25 cm/min (indicative).

### 3.2 TIG (141)

Intensité selon épaisseur e (mm) :
```
Acier ferritique : I ≈ 30 · e
Acier inox :       I ≈ 25 · e
```

Tension :
```
U = 10 + 0.04 · I     (jusqu'à ~34 V pour très forte intensité)
```

Vitesse : 8 à 15 cm/min (indicative).

### 3.3 MIG (131) / MAG (135)

Tension :
```
U = 14 + 0.05 · I
```

Vitesse : 25 à 45 cm/min en semi-automatique.

Vitesse de fil V_f : abaque à intégrer plus tard (Lot 4), dépend du diamètre
de fil et de I. **[À VÉRIFIER]** — formule empirique à confirmer.

Source : ta doc « Composition d'un DMOS », section 3.

---

## 4. Énergie de soudage

### 4.1 Énergie nominale
```
E_n (kJ/cm) = (U · I · 60) / (V_s · 1000)
```
avec U en volts, I en ampères, V_s en cm/min.

### 4.2 Énergie corrigée par le rendement thermique (EN 1011-1)
```
E_q = k · E_n
```

Rendement k (ou η) par procédé :

| Procédé | k |
|---------|---|
| TIG (141), Plasma (15)              | 0.6 |
| EE (111), MIG/MAG (131/135), FCW (136) | 0.8 |
| SAW (121)                          | 1.0 |

Source : NF EN 1011-1.

### 4.3 Correction géométrie du joint (facteur k_j)

Le rendement thermique effectif dépend aussi de la géométrie du chanfrein.
Table à intégrer :

| Chanfrein | k_j |
|-----------|-----|
| Bord droit / V à plat, k = 1 (référence) | 1.00 |
| V à plat (fillet ratio 0.25)             | 0.97 |
| V à plat (fillet ratio 0.5)              | 0.89 |
| V à plat (fillet ratio 0.75)             | 0.78 |
| V à plat (fillet ratio 1.0)              | 0.67 |
| Chanfrein Y (avec talon)                 | 0.6 à 0.7 (selon angle) |
| Chanfrein X                              | 0.75 à 1.2 |

Source : ta doc « Méthodes de préchauffe », abaque IRSID, colonne « géométrie ».

---

## 5. Carbone équivalent

### 5.1 CE_IIW (International Institute of Welding)
```
CE_IIW = %C + %Mn/6 + (%Cr + %Mo + %V)/5 + (%Ni + %Cu)/15
```
Interprétation :
- CE_IIW < 0.42 % : acier soudable sans préchauffe (indication de principe)
- 0.42 % ≤ CE_IIW ≤ 0.60 % : préchauffe recommandée à évaluer
- CE_IIW > 0.60 % : préchauffe obligatoire

Source : IIW Doc IX-535-67.

### 5.2 CET (EN 1011-2 Méthode B)
```
CET = %C + (%Mn + %Mo)/10 + (%Cr + %Cu)/20 + %Ni/40
```
Utilisé pour la formule de préchauffe CET (§6.3).

Source : NF EN 1011-2 Annexe C.

### 5.3 Carbone équivalent Séférian
```
Ceq_Séférian = %C + (%Mn + %Cr)/9 + %Ni/18 + 7·%Mo/90
```
Formule propre à Séférian, distincte de CE_IIW (§5.1) - à ne pas confondre
(erreur corrigée : une version antérieure de `carbone_eq.js` réutilisait
CE_IIW à la place).

Compensé épaisseur :
```
Ceq_compensé = Ceq_Séférian · (1 + 0.005 · e)
```
avec e en mm.

Source : Séférian D., *Metallurgy of welding*, Chapman & Hall, 1962.

---

## 6. Préchauffe

**Ordre d'affichage** : IRSID et CET en principal (côte à côte, méthodes de
référence). Séférian, BWRA, Baus-Chapeau en secondaires dépliables. Verdict
T_p final = **max** des méthodes principales (position conservative).

### 6.1 IRSID (Institut de Recherche de la Sidérurgie)

Méthode abaque : croiser E_q (kJ/cm) avec l'épaisseur e (mm) sur l'abaque
IRSID pour lire directement le t8/5 puis, si zone de trempe, la T_p requise.

**Implémentation** : abaque à digitaliser en tableau de valeurs (T_p en
fonction de CE_IIW, e, E_q). **[À DIGITALISER]** — Tony fournira les
coordonnées.

Source : ta doc « Méthodes de préchauffe », section A.

### 6.2 Séférian
```
T_p (°C) = 350 · √(CE_compensé − 0.25)
```
Avec CE_compensé défini en §5.3.

**Précaution** : formule valide si CE_compensé > 0.25 ; sinon T_p = 0.

### 6.3 CET (EN 1011-2 Méthode B) — RÉFÉRENCE INDUSTRIELLE ACTUELLE
```
T_p (°C) = 697 · CET + 160 · tanh(d/35) + 62 · HD^0.35
             + (53 · CET − 32) · Q − 328
```
avec :
- d = épaisseur combinée (mm) (voir §7.4)
- HD = taux d'hydrogène diffusible (ml/100 g de métal déposé)
- Q = apport de chaleur = E_q en kJ/mm

Classes HD par consommable :

| Classe | HD (ml/100 g) | Consommable typique |
|--------|---------------|---------------------|
| H5     | ≤ 5           | Électrode basique séchée, fil massif propre |
| H10    | 5 à 10        | Électrode basique standard |
| H15    | 10 à 15       | Électrode rutile |

Source : NF EN 1011-2:2001 Annexe C, Méthode B.

### 6.4 BWRA (British Welding Research Association)

Méthode par indice de sévérité thermique :
```
TSN = (somme des épaisseurs des tôles au joint) / 6
```
Croisement TSN × CE × diamètre électrode dans un tableau BWRA →
T_p et diamètre d'électrode admissible.

**[À DIGITALISER]** — table BWRA à intégrer.

Source : ta doc « Méthodes de préchauffe », section C.

### 6.5 Baus et Chapeau (tôles épaisses, e > 25 mm)

Utilise l'énergie dissipée :
```
E_d = E_n · r
```
où r est le facteur de dissipation (~ 1 en 3D, dépend de la géométrie).

Épaisseur combinée e' via abaque à digitaliser.

**[À DIGITALISER]** — abaque Baus-Chapeau.

Source : ta doc « Méthodes de préchauffe », section D.

---

## 7. Temps de refroidissement t8/5

### 7.1 Formule 3D (tôles épaisses, EN 1011-2 Annexe D)
```
t8/5 (s) = (6700 − 5·T_p) · Q · [1/(500−T_p) − 1/(800−T_p)] · F_3
```
avec Q en kJ/mm, T_p en °C, F_3 facteur de forme du joint 3D.

### 7.2 Formule 2D (tôles minces, EN 1011-2 Annexe D)
```
t8/5 (s) = (4300 − 4.3·T_p) · 10^5 · (Q²/d²)
           · [1/(500−T_p)² − 1/(800−T_p)²] · F_2
```
avec d épaisseur de tôle en mm.

### 7.3 Épaisseur de transition d_t (formule EN 1011-2)
```
d_t = √[  (4300 − 4.3·T_p) · 10^5 · Q · [1/(500−T_p)² − 1/(800−T_p)²] · F_2
       / ((6700 − 5·T_p) · [1/(500−T_p) − 1/(800−T_p)] · F_3)  ]
```

Règle d'aiguillage :
- si d ≥ d_t → utiliser formule 3D (§7.1)
- si d < d_t → utiliser formule 2D (§7.2)

### 7.4 Facteurs de forme (F_2, F_3)

| Type de joint | F_2  | F_3  |
|---------------|------|------|
| Bout à bout (BW) | 1.0 | 1.0 |
| Angle passe unique (FW) | 0.45 à 0.67 | 0.67 |
| Renforcement passe unique | 0.9 | 0.9 |

**[À COMPLÉTER]** — table complète à intégrer depuis EN 1011-2 Annexe D.

Source : NF EN 1011-2:2001 Annexe D.

---

## 8. Dureté prédite

### 8.1 Dureté 100 % martensite (HV_m)

**Formule de Düren** :
```
HV_m = 802 · %C + 305
```

**Formule de Yurioka** (plus précise) :
```
HV_m = 884 · %C · (1 − 0.3 · %C²) + 294
```

**Formule IRSID simplifiée** :
```
HV_max = 289 + 930 · %C
```

Source : Yurioka N., Kasuya T., *A chart method to determine necessary
preheat in steel welding*, Welding in the World 35, 1995.

### 8.2 Dureté 100 % ferrito-perlite
```
HV_FP = 275 · %C + 15.4 · %Mn + 309
```

### 8.3 Dureté 100 % bainite
```
HV_B = 122 · %C + 7.17 · %Mn + 234
```

### 8.4 Dureté prédite Yurioka (interpolation martensite ↔ bainite selon t8/5)
```
HV = (HV_m + HV_B)/2 − (HV_m − HV_B)/2.2 · arctan(t*)
```
où t* est un paramètre logarithmique lié au t8/5 et à la chimie.

Formulation détaillée : voir Yurioka N., *Comparison of preheat predictive
methods*, Welding in the World 48, 2004.

### 8.5 Résistance en traction depuis dureté
```
R_m (MPa) ≈ 3.0 · HV + 22.3
```

### 8.6 Dureté critique admissible (formule Düren, hors norme)
```
HV_c = 240 + 790 · CE_IIW
```
Utilisée quand la norme ISO 15614-1 ne couvre pas le matériau. Sinon, la
limite normative HV10 par groupe (§9) prévaut.

---

## 9. Groupes ISO 15608 et limites HV10 normatives (EN ISO 15614-1)

### 9.1 Attribution du groupe (ISO/TR 15608 via ISO/TR 20172)

**[À COMPLÉTER]** — inférence à partir de la nuance et de la composition.
Table de correspondance à intégrer.

Cas courants pour la validation MVP :

| Nuance | Groupe ISO 15608 |
|--------|-------------------|
| S235JR, S275JR | 1.1 |
| S355J2, E36    | 1.2 |
| P265GH         | 1.1 |
| 15CD4          | 5.1 |
| 25CD4          | 5.1 |
| 304L, 1.4307   | 8.1 |
| 316L, 1.4404   | 8.1 |
| Duplex 2205    | 10.1 |

### 9.2 Limites de dureté HV10 par groupe

| Groupe | Sans TTAS (brut) | Avec TTAS |
|--------|-------------------|-----------|
| 1, 2   | 380 HV10          | 320 HV10  |
| 3      | 450 HV10          | 380 HV10  |
| 4, 5   | 380 HV10          | 350 HV10 (rév. 2017) |
| 6      | —                 | 350 HV10  |
| 9.1    | 350 HV10          | 300 HV10  |
| 9.2, 9.3 | 450 HV10        | 350 HV10  |
| 11     | 380 HV10          | 320 HV10  |

### 9.3 Contrainte NACE MR0175 / ISO 15156 (milieux H2S)

Plafond dureté ZAT + métal fondu aciers carbone : **250 HV**.
Active une case dans l'onglet Paramètres DMOS pour écraser les limites §9.2.

Source : ta doc « Système expert », section 1 et 3.

---

## 10. Sélection des 7 meilleurs métaux d'apport C

Algorithme :

1. Récupérer (Cr_eq_D, Ni_eq_D) du D_mélange (métaux de base seuls).
2. Pour chaque apport C_k de la base de données correspondant au procédé
   choisi :
   - Calculer (Cr_eq_JOINT, Ni_eq_JOINT) = D_A·A + D_B·B + D_C·C_k
   - Calculer la distance euclidienne D_k au **centre de la zone idéale**
     (point cible = Cr_eq ≈ 21.5, Ni_eq ≈ 14.5, cf. `centre_ideal` dans
     zones_schaeffler.json) ou distance à la zone (distance nulle si dans
     la zone).
3. Trier par D_k croissante, garder les 7 premiers.
4. Filtrer : exclure les apports qui projettent le JOINT dans les zones
   martensite pure, austénite pure, ferrite pure, ou A+F avec sigma.
5. Afficher la marge à la zone (positive = dans la zone, négative = à
   l'extérieur) pour chaque apport retenu.

---

## 11. Fissuration à chaud (UCS — Unit of Crack Susceptibility)

Pour aciers carbone/manganèse en soudage sous flux :
```
UCS = 230·%C + 190·%S + 75·%P + 45·%Nb − 12.3·%Si − 5.4·%Mn − 1
```

Interprétation :
- UCS < 10 : risque faible
- 10 ≤ UCS ≤ 30 : risque modéré, ajuster vitesse et dilution
- UCS > 30 : risque très élevé

Source : ta doc « Système expert », section 2.

**Statut** : à activer en Lot 4.

---

## 12. Fragilité au réchauffage (Facteur X de Bruscato)

Pour aciers Cr-Mo en TTAS ou service à haute température :
```
X = (10·%P + 5·%Sb + 4·%Sn + %As) / 100
```

Interprétation (CODAP) :
- X ≤ 15 : conforme
- X > 15 : risque de fragilisation au revenu, réévaluer TTAS

Source : ta doc « Système expert », section 2.

**Statut** : à activer en Lot 4.

---

## Annexe A — Points ouverts

- Digitalisation abaques IRSID, BWRA, Baus-Chapeau (Lot 6).
- Digitalisation courbes TRCS S235JR, S355, P265GH, 15CD4, 25CD4 (Lot 7).
- Digitalisation frontières zones Schaeffler (Lot 5, extractibles de
  l'onglet Diag de l'Excel de Tony, colonnes A/B).
- Correspondance nuance → groupe ISO 15608 (à générer, cf. §9.1).
- Vitesse de fil V_f MIG/MAG (formule empirique, cf. §3.3).

## Annexe B — Références normatives citées

- NF EN ISO 15609-1 : DMOS – Contenu du descriptif de mode opératoire
- NF EN ISO 15614-1 : Épreuve de qualification de mode opératoire de soudage
- NF EN 1011-1 : Soudage à l'arc – Généralités (rendements thermiques)
- NF EN 1011-2 : Soudage à l'arc des aciers ferritiques (préchauffe, t8/5)
- ISO/TR 15608 : Système de groupement des matériaux métalliques
- ISO/TR 20172 : Attribution du groupe matériau depuis désignation
- NF EN ISO 4063 : Numérotation des procédés de soudage
- NF EN ISO 6947 : Positions de soudage
- NF EN ISO 6848 : Électrodes de tungstène (TIG)
- NF EN ISO 14175 : Gaz de protection pour soudage
- NF EN ISO 14343 : Fils et baguettes pour soudage inox (TIG/MIG)
- NF EN ISO 14341 : Fils MAG acier
- NF EN ISO 5817 : Critères d'acceptation des défauts de soudure
- NACE MR0175 / ISO 15156 : Aciers pour milieux H2S
- IIW Doc IX-535-67 : Carbone équivalent IIW

## Fin

Tout écart de formule par rapport à cette spec doit être justifié dans le
commit Git et documenté ici avant d'être fusionné.
