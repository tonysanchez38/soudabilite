# Pipeline TRCS overnight

Digitalisation semi-automatique des 5 courbes TRCS de référence
(S235JR, S355/E36, P265GH, 15CD4, 25CD4 — CLAUDE.md #18) à partir de
PDF sources, plus calcul de CE_IIW et HV_M/HV_B (formules spec.md §8)
pour chaque nuance.

**Ne modifie jamais `assets/data/trcs/_manifest.json` ni
`assets/data/trcs/*.json`.** Tout sort dans
`trcs_overnight_out/trcs_data_DRAFT.json` + un rapport lisible dans
`trcs_overnight_out/rapport_matin.md`, à vérifier au réveil.

Deux limites connues à vérifier dans le rapport avant usage :
- la digitalisation de courbe (calibrage OCR + repérage du tracé) est
  une approximation, chaque calibrage réussi doit être vérifié
  visuellement ;
- l'interpolation HV(t85) est une rampe linéaire provisoire (pas
  encore l'arctan de Yurioka, spec.md §8.4, dont le paramètre `t*`
  n'est pas sourcé dans ce dépôt) — `methode_interpolation:
  "piecewise_lineaire_provisoire"` dans chaque résultat le rappelle.

## Avant de lancer

1. Exécuter `setup_environnement_trcs.ps1` **une fois**, en PowerShell
   administrateur (installe Poppler/pdftoppm et Tesseract OCR via
   winget, plus les dépendances Python).
2. Compléter `assets/data/trcs/_manifest.json` : au minimum `seuil_hv`
   pour chaque nuance (n'existe encore nulle part dans le dépôt —
   dépend de `hv10_limites.json`, pas encore créé, et du groupe ISO
   15608). La composition de 4 des 5 nuances est déjà reprise de
   `assets/data/data.json` ; **15CD4 est absent de la banque** et doit
   y être ajouté d'abord.
3. Déposer les PDF sources dans `C:\Users\snzto\projets\soudabilite\fiches_trcs\`
   (racine du dépôt, pas dans ce dossier `outils/trcs_batch/`). Le nom
   du fichier est comparé aux clés du manifest (`s235jr`, `s355`,
   `p265gh`, `15cd4`, `25cd4`) de façon normalisée (accents/casse/
   espaces/points/tirets/underscores ignorés) : `25 CD 4.pdf` est donc
   reconnu tel quel, pas besoin de le renommer en `25cd4.pdf`. Le
   rapport signale chaque correspondance faite par normalisation (à
   vérifier) et toute collision (deux clés du manifest qui se
   normaliseraient vers la même forme).

## Lancer

```
python batch_trcs_overnight.py
```

Chemins en dur dans le script (chargé sans supervision, le répertoire
de travail courant n'est pas garanti) : tout est ancré sur
`C:\Users\snzto\projets\soudabilite\`. Si le dépôt est déplacé, mettre
à jour `RACINE_DEPOT` et `DOSSIER_PDF` en tête de fichier.
