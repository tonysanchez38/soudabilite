# ============================================================
# batch_trcs_overnight.py — version finale, autonome
# Tourne seul cette nuit. N'écrit JAMAIS dans assets/data/trcs/_manifest.json
# ni dans assets/data/trcs/*.json : tout sort dans un brouillon + un
# rapport, à valider au réveil.
# Chaque fiche est traitée dans son propre try/except : une erreur
# sur une nuance n'interrompt jamais le traitement des suivantes.
#
# Formules HV_m/HV_B et interpolation : voir note de bas de fichier
# (« Choix de formules ») - synchronisées avec spec.md §8 le 2026-07-20.
# ============================================================

import os, re, json, subprocess, traceback, shutil, unicodedata
from pathlib import Path
from datetime import datetime
from PIL import Image
import numpy as np

try:
    import pytesseract
    OCR_DISPONIBLE = True
except ImportError:
    OCR_DISPONIBLE = False

# Chemins absolus - le script est lancé sans supervision (tâche planifiée
# overnight), le répertoire de travail courant n'est pas garanti.
RACINE_DEPOT = r"C:\Users\snzto\projets\soudabilite"
DOSSIER_PDF = r"C:\Users\snzto\projets\soudabilite\fiches_trcs"
DOSSIER_SORTIE = os.path.join(RACINE_DEPOT, "trcs_overnight_out")
FICHIER_JSON_EXISTANT = os.path.join(RACINE_DEPOT, "assets", "data", "trcs", "_manifest.json")
FICHIER_BROUILLON = os.path.join(DOSSIER_SORTIE, "trcs_data_DRAFT.json")
FICHIER_RAPPORT = os.path.join(DOSSIER_SORTIE, "rapport_matin.md")

# Ces trois désignations ne correspondent à aucune clé de _manifest.json
# ni à aucune "designation" de assets/data/data.json au 2026-07-20 - sans
# effet tant qu'aucun fiches_trcs/<une-de-ces-3>.pdf n'existe (la boucle
# ne traite que ce qui est déposé dans DOSSIER_PDF). Comparaison
# normalisée (nuance_est_exclue) : accents/casse/séparateurs ignorés.
# À vérifier avant qu'elles ne deviennent pertinentes.
NUANCES_EXCLUES = {"Z04CND16.4M", "25M6", "29MV8"}  # hors périmètre ce soir, cf. décisions actées

os.makedirs(DOSSIER_SORTIE, exist_ok=True)


# ---------- Vérifications préalables, avant tout traitement ----------
def verifier_prerequis():
    manquants = []
    if shutil.which("pdftoppm") is None:
        manquants.append("pdftoppm (poppler) introuvable dans le PATH")
    if not OCR_DISPONIBLE:
        manquants.append("module pytesseract introuvable (pip install pytesseract)")
    if shutil.which("tesseract") is None:
        manquants.append("binaire tesseract introuvable dans le PATH")
    return manquants


# ---------- Étape 1 : rendu PDF -> images ----------
def rendre_pdf_en_images(chemin_pdf, prefixe):
    subprocess.run(["pdftoppm", "-png", "-r", "250", chemin_pdf, prefixe], check=True, timeout=60)
    return sorted(Path(DOSSIER_SORTIE).glob(f"{Path(prefixe).name}-*.png"))


# ---------- Étape 2 : calibrage automatique des axes par OCR ----------
def detecter_graduations(image_pil):
    if not OCR_DISPONIBLE:
        return []
    data = pytesseract.image_to_data(image_pil, output_type=pytesseract.Output.DICT)
    graduations = []
    for i, texte in enumerate(data["text"]):
        texte = texte.strip()
        if re.fullmatch(r"\d{2,3}", texte):
            x = data["left"][i] + data["width"][i] // 2
            y = data["top"][i] + data["height"][i] // 2
            graduations.append((int(texte), x, y))
    return graduations


def calibrer_axes(graduations, valeurs_x_attendues, valeurs_y_attendues):
    candidats_x = sorted([g for g in graduations if g[0] in valeurs_x_attendues], key=lambda g: g[1])
    candidats_y = sorted([g for g in graduations if g[0] in valeurs_y_attendues], key=lambda g: g[2])
    if len(candidats_x) < 2 or len(candidats_y) < 2:
        return {"statut": "echec_calibrage"}
    return {
        "statut": "ok_a_verifier",
        "x0_val": candidats_x[0][0], "x0_px": candidats_x[0][1],
        "x1_val": candidats_x[-1][0], "x1_px": candidats_x[-1][1],
        "y0_val": candidats_y[0][0], "y0_px": candidats_y[0][2],
        "y1_val": candidats_y[-1][0], "y1_px": candidats_y[-1][2],
    }


# ---------- Étape 3 : calculs métallurgiques (formules spec.md §8) ----------
def composition_suffisante(comp):
    """Refuse de calculer sur une chimie trop incomplète plutôt que d'inventer des zéros porteurs de sens."""
    return comp.get("C") is not None and comp.get("Mn") is not None


def calculer_ce_iiw(comp):
    C = comp.get("C", 0); Mn = comp.get("Mn", 0)
    Cr = comp.get("Cr", 0); Mo = comp.get("Mo", 0); V = comp.get("V", 0)
    Ni = comp.get("Ni", 0); Cu = comp.get("Cu", 0)
    return C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15


def calculer_hv_martensite_securitaire(comp):
    """
    HV_m par Düren et par Yurioka (spec.md §8.1 - la formule Yurioka
    exacte est quadratique en %C, pas 884*C+287) ; retient
    systématiquement la valeur la plus haute : en cas de désaccord entre
    les deux méthodes, le choix le plus prudent, jamais l'inverse.
    """
    C = comp.get("C", 0)
    hv_duren = 802 * C + 305
    hv_yurioka = 884 * C * (1 - 0.3 * C**2) + 294
    if hv_yurioka >= hv_duren:
        return {"hv_m_retenue": round(hv_yurioka, 0), "methode_retenue": "yurioka",
                "hv_m_yurioka": round(hv_yurioka, 0), "hv_m_duren": round(hv_duren, 0)}
    return {"hv_m_retenue": round(hv_duren, 0), "methode_retenue": "duren",
            "hv_m_yurioka": round(hv_yurioka, 0), "hv_m_duren": round(hv_duren, 0)}


def calculer_hv_bainite(comp):
    """HV_B 100% bainite, spec.md §8.3. Pas de formule CE*-Düren ici : non sourcée dans ce dépôt."""
    C = comp.get("C", 0); Mn = comp.get("Mn", 0)
    return round(122 * C + 7.17 * Mn + 234, 0)


def fonction_hv_selon_t85(t85, hv_m, hv_b):
    """
    APPROXIMATION PROVISOIRE (pas la formule Yurioka de spec.md §8.4) :
    spec.md cite l'interpolation arctan HV=(HV_m+HV_B)/2-(HV_m-HV_B)/2.2*arctan(t*)
    mais ne définit pas t* (renvoie à Yurioka, Welding in the World 48,
    2004 - absent du dépôt). Repli le temps de sourcer t* :
      t85 < 5s   -> proche de HV_M (zone critique martensitique)
      5s-20s     -> transition linéaire vers HV_B (zone bainitique)
      t85 > 20s  -> HV_B (palier bas)
    À remplacer par l'arctan dès que t* est sourcé (cf. rapport, champ
    methode_interpolation).
    """
    if t85 < 5:
        return hv_m
    if t85 > 20:
        return hv_b
    fraction = (t85 - 5) / (20 - 5)
    return hv_m + (hv_b - hv_m) * fraction


def resoudre_t85_critique(hv_m, hv_b, seuil_hv, t85_min=1, t85_max=100, tolerance=0.5):
    fn = lambda t: fonction_hv_selon_t85(t, hv_m, hv_b)
    if fn(t85_min) < seuil_hv:
        return {"statut": "sous_seuil_meme_a_t85_min", "detail": f"HV({t85_min}s)={fn(t85_min):.0f} déjà < {seuil_hv}"}
    if fn(t85_max) > seuil_hv:
        return {"statut": "au_dessus_seuil_meme_a_t85_max", "detail": f"HV({t85_max}s)={fn(t85_max):.0f} encore > {seuil_hv}"}
    bas, haut = t85_min, t85_max
    while haut - bas > tolerance:
        milieu = (bas + haut) / 2
        if fn(milieu) > seuil_hv:
            bas = milieu
        else:
            haut = milieu
    return {"statut": "ok", "t85_critique": round((bas + haut) / 2, 1)}


# ---------- Normalisation des clés de nuance ----------
def normaliser_nom_nuance(nom):
    """
    Réduit un nom de nuance à une forme comparable, insensible à :
    - la casse (MAJ/min)
    - les espaces, points, tirets, underscores
    - les accents éventuels
    Permet de faire correspondre un nom de fichier PDF (ex. '25 CD 4.pdf')
    à une clé de _manifest.json (ex. '25cd4') sans renommage manuel.
    """
    if nom is None:
        return ""
    nom = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode("ascii")
    nom = nom.upper()
    for caractere in [" ", ".", "-", "_"]:
        nom = nom.replace(caractere, "")
    return nom


def construire_index_normalise(base_existante):
    """
    Construit un dictionnaire {nom_normalise: nom_original} pour retrouver
    une entrée du manifest même si l'orthographe exacte diffère entre
    _manifest.json et les noms de fichiers PDF.
    Si deux clés distinctes se normalisent vers la même forme, c'est
    signalé comme collision plutôt que résolu au hasard.
    """
    index = {}
    collisions = []
    for nom_original in base_existante:
        cle = normaliser_nom_nuance(nom_original)
        if cle in index and index[cle] != nom_original:
            collisions.append((index[cle], nom_original, cle))
        else:
            index[cle] = nom_original
    return index, collisions


def retrouver_entree(nom_nuance_fichier, base_existante, index_normalise):
    """
    Cherche l'entrée correspondant à un nom de fichier PDF dans le
    manifest, d'abord par correspondance exacte, puis par correspondance
    normalisée. Retourne (entree, statut_correspondance).
    """
    if nom_nuance_fichier in base_existante:
        return base_existante[nom_nuance_fichier], "exacte"

    cle = normaliser_nom_nuance(nom_nuance_fichier)
    if cle in index_normalise:
        nom_reel = index_normalise[cle]
        return base_existante[nom_reel], f"normalisee (fichier='{nom_nuance_fichier}' -> base='{nom_reel}')"

    return None, "aucune_correspondance"


def nuance_est_exclue(nom_nuance_fichier, nuances_exclues_brutes):
    """
    Remplace le test 'nom_nuance in NUANCES_EXCLUES' par une comparaison
    normalisée, pour que l'exclusion fonctionne même si le nom de fichier
    PDF diffère légèrement de celui écrit dans NUANCES_EXCLUES.
    """
    cle_fichier = normaliser_nom_nuance(nom_nuance_fichier)
    cles_exclues = {normaliser_nom_nuance(n) for n in nuances_exclues_brutes}
    return cle_fichier in cles_exclues


# ---------- Orchestration, résiliente fiche par fiche ----------
def traiter_toutes_les_fiches():
    debut = datetime.now()
    prerequis_manquants = verifier_prerequis()

    resultats = {}
    compteurs = {"ok": 0, "echec_calibrage": 0, "erreur": 0, "exclu": 0}
    rapport = [f"# Rapport matinal — digitalisation TRCS ({debut:%Y-%m-%d %H:%M})\n"]

    if prerequis_manquants:
        rapport.append("## ⚠️ Prérequis manquants — traitement interrompu avant de commencer\n")
        for m in prerequis_manquants:
            rapport.append(f"- {m}")
        with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
            f.write("\n".join(rapport))
        print("Prérequis manquants, voir rapport.")
        return

    with open(FICHIER_JSON_EXISTANT, encoding="utf-8") as f:
        base_existante = json.load(f)["nuances"]

    index_normalise, collisions = construire_index_normalise(base_existante)
    if collisions:
        rapport.append("\n## ⚠️ Collisions de noms détectées après normalisation")
        for a, b, cle in collisions:
            rapport.append(f"- '{a}' et '{b}' se normalisent tous deux vers '{cle}' — à vérifier manuellement")

    for pdf in sorted(Path(DOSSIER_PDF).glob("*.pdf")):
        nom_nuance = pdf.stem
        rapport.append(f"\n## {nom_nuance}")

        if nuance_est_exclue(nom_nuance, NUANCES_EXCLUES):
            rapport.append("- Exclue de ce lot (décision actée), non traitée.")
            compteurs["exclu"] += 1
            continue

        entree, statut_correspondance = retrouver_entree(nom_nuance, base_existante, index_normalise)
        if entree is None:
            rapport.append("- Absente de _manifest.json existant (aucune correspondance, même normalisée), ignorée. (clés attendues : s235jr, s355, p265gh, 15cd4, 25cd4)")
            compteurs["erreur"] += 1
            continue
        if statut_correspondance != "exacte":
            rapport.append(f"- Correspondance trouvée par normalisation : {statut_correspondance}")

        try:
            comp = entree.get("composition") or {}
            seuil_hv = entree.get("seuil_hv")

            if not composition_suffisante(comp):
                rapport.append("- Composition insuffisante pour calculer, ignorée.")
                compteurs["erreur"] += 1
                continue

            images = rendre_pdf_en_images(str(pdf), os.path.join(DOSSIER_SORTIE, nom_nuance))

            ce_iiw = calculer_ce_iiw(comp)
            hv_b = calculer_hv_bainite(comp)
            hv_m_info = calculer_hv_martensite_securitaire(comp)

            if seuil_hv is not None:
                t85_resultat = resoudre_t85_critique(hv_m_info["hv_m_retenue"], hv_b, seuil_hv)
            else:
                t85_resultat = {"statut": "seuil_hv_absent_du_manifest"}

            rapport.append(f"- CE_IIW : {ce_iiw:.3f}")
            rapport.append(f"- HV_M retenue : {hv_m_info['hv_m_retenue']:.0f} ({hv_m_info['methode_retenue']}, "
                            f"Yurioka={hv_m_info['hv_m_yurioka']:.0f} / Düren={hv_m_info['hv_m_duren']:.0f})")
            rapport.append(f"- HV_B (spec.md §8.3) : {hv_b:.0f}")
            rapport.append(f"- Seuil normatif : {seuil_hv} HV10" if seuil_hv is not None else "- Seuil normatif : absent du manifest")
            rapport.append(f"- t8/5 critique (interpolation provisoire, pas encore l'arctan Yurioka §8.4) : {t85_resultat}")

            graduations_ok = False
            for img_path in images:
                img = Image.open(img_path)
                graduations = detecter_graduations(img)
                calibrage = calibrer_axes(graduations, range(0, 70, 10), range(200, 550, 50))
                if calibrage["statut"] == "ok_a_verifier":
                    graduations_ok = True
                    rapport.append(f"- Calibrage OCR réussi sur {img_path.name} — **À VÉRIFIER VISUELLEMENT.**")
                    break
            if not graduations_ok:
                rapport.append("- Calibrage automatique de la courbe échoué — repli sur Düren/Yurioka/HV_B uniquement pour cette nuance.")

            resultats[nom_nuance] = {
                "ce_iiw": round(ce_iiw, 3),
                "hv_m": hv_m_info,
                "hv_b": hv_b,
                "seuil_hv": seuil_hv,
                "methode_interpolation": "piecewise_lineaire_provisoire",
                "t85_critique": t85_resultat,
                "courbe_digitalisee_auto": graduations_ok,
                "statut": "brouillon_a_valider"
            }
            compteurs["ok"] += 1

        except Exception as e:
            rapport.append(f"- **ERREUR** : {e}")
            rapport.append(f"  ```\n{traceback.format_exc()}\n  ```")
            compteurs["erreur"] += 1
            continue

    duree = datetime.now() - debut
    resume = (f"\n---\n## Résumé\n- Traitées avec succès : {compteurs['ok']}\n"
              f"- Erreurs : {compteurs['erreur']}\n- Exclues (décision actée) : {compteurs['exclu']}\n"
              f"- Durée totale : {duree}\n")
    rapport.insert(1, resume)

    with open(FICHIER_BROUILLON, "w", encoding="utf-8") as f:
        json.dump(resultats, f, ensure_ascii=False, indent=2)
    with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(rapport))

    print(f"Terminé en {duree}. Brouillon : {FICHIER_BROUILLON} — Rapport : {FICHIER_RAPPORT}")


if __name__ == "__main__":
    traiter_toutes_les_fiches()


# ============================================================
# Choix de formules (2026-07-20, réconciliés avec spec.md §8) :
# - HV_m Düren  = 802*C+305           (spec.md §8.1, identique au script)
# - HV_m Yurioka = 884*C*(1-0.3*C^2)+294  (spec.md §8.1 - PAS 884*C+287)
# - HV_B        = 122*C+7.17*Mn+234   (spec.md §8.3 - pas de CE*/Düren)
# - Interpolation HV(t85) : rampe linéaire 3 segments, PROVISOIRE.
#   spec.md §8.4 cite l'arctan Yurioka mais ne définit pas t* (renvoie à
#   Yurioka, Welding in the World 48, 2004, absent du dépôt). À remplacer
#   dès que Tony fournit la définition de t*.
# ============================================================
