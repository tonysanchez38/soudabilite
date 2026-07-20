# ============================================================
# batch_trcs_overnight.py — version consolidée et blindée
# Fusionne : formules HV corrigées (spec.md §8), normalisation
# des clés de nuance, exclusions, et surtout : un log qui s'écrit
# AVANT toute autre opération, pour qu'une absence de log ne
# puisse plus jamais signifier "je ne sais pas ce qui s'est passé".
# ============================================================

import os, sys, re, json, subprocess, traceback, shutil, unicodedata
from pathlib import Path
from datetime import datetime

# ---------- 0. Chemins et log immédiat, avant tout le reste ----------
DOSSIER_PDF = r"C:\Users\snzto\projets\soudabilite\fiches_trcs"
DOSSIER_SORTIE = r"C:\Users\snzto\projets\soudabilite\trcs_overnight_out"
FICHIER_JSON_EXISTANT = r"C:\Users\snzto\projets\soudabilite\assets\data\trcs\_manifest.json"
FICHIER_BROUILLON = os.path.join(DOSSIER_SORTIE, "trcs_data_DRAFT.json")
FICHIER_RAPPORT = os.path.join(DOSSIER_SORTIE, "rapport_matin.md")
FICHIER_LOG_BRUT = os.path.join(DOSSIER_SORTIE, "log_execution.txt")

NUANCES_EXCLUES = ["Z04CND16.4M", "25M6", "29MV8"]

# Ceci s'exécute EN PREMIER, avant même les imports optionnels plus bas,
# pour prouver que le script a bel et bien démarré.
os.makedirs(DOSSIER_SORTIE, exist_ok=True)
with open(FICHIER_LOG_BRUT, "w", encoding="utf-8") as f:
    f.write(f"Script démarré : {datetime.now()}\n")
    f.write(f"Python utilisé : {sys.executable}\n")
    f.write(f"Version Python : {sys.version}\n")
    f.write(f"Dossier de travail courant : {os.getcwd()}\n")
    f.write(f"DOSSIER_PDF existe : {os.path.isdir(DOSSIER_PDF)}\n")
    if os.path.isdir(DOSSIER_PDF):
        f.write(f"Fichiers PDF trouvés : {len(list(Path(DOSSIER_PDF).glob('*.pdf')))}\n")
    f.write(f"FICHIER_JSON_EXISTANT existe : {os.path.isfile(FICHIER_JSON_EXISTANT)}\n")


def log(message):
    with open(FICHIER_LOG_BRUT, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()} — {message}\n")
    print(message)


try:
    import pytesseract
    OCR_DISPONIBLE = True
    log("pytesseract importé avec succès.")
except ImportError as e:
    OCR_DISPONIBLE = False
    log(f"pytesseract non disponible : {e}")

try:
    from PIL import Image
    import numpy as np
    log("Pillow et numpy importés avec succès.")
except ImportError as e:
    log(f"ERREUR FATALE — Pillow ou numpy manquant : {e}")
    log("Le script ne peut pas continuer sans ces bibliothèques. Exécuter : pip install pillow numpy")
    sys.exit(1)


# ---------- Normalisation des clés ----------
def normaliser_nom_nuance(nom):
    if nom is None:
        return ""
    nom = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode("ascii").upper()
    for c in [" ", ".", "-", "_"]:
        nom = nom.replace(c, "")
    return nom


def construire_index_normalise(base_existante):
    index, collisions = {}, []
    for nom_original in base_existante:
        cle = normaliser_nom_nuance(nom_original)
        if cle in index and index[cle] != nom_original:
            collisions.append((index[cle], nom_original, cle))
        else:
            index[cle] = nom_original
    return index, collisions


def retrouver_entree(nom_nuance_fichier, base_existante, index_normalise):
    if nom_nuance_fichier in base_existante:
        return base_existante[nom_nuance_fichier], "exacte"
    cle = normaliser_nom_nuance(nom_nuance_fichier)
    if cle in index_normalise:
        nom_reel = index_normalise[cle]
        return base_existante[nom_reel], f"normalisee (fichier='{nom_nuance_fichier}' -> base='{nom_reel}')"
    return None, "aucune_correspondance"


def nuance_est_exclue(nom_nuance_fichier, nuances_exclues_brutes):
    cle_fichier = normaliser_nom_nuance(nom_nuance_fichier)
    cles_exclues = {normaliser_nom_nuance(n) for n in nuances_exclues_brutes}
    return cle_fichier in cles_exclues


# ---------- Prérequis ----------
def verifier_prerequis():
    manquants = []
    if shutil.which("pdftoppm") is None:
        manquants.append("pdftoppm (poppler) introuvable dans le PATH")
    if not OCR_DISPONIBLE:
        manquants.append("module pytesseract introuvable")
    if shutil.which("tesseract") is None:
        manquants.append("binaire tesseract introuvable dans le PATH")
    return manquants


# ---------- Rendu PDF ----------
def rendre_pdf_en_images(chemin_pdf, prefixe):
    subprocess.run(["pdftoppm", "-png", "-r", "250", chemin_pdf, prefixe], check=True, timeout=60)
    return sorted(Path(DOSSIER_SORTIE).glob(f"{Path(prefixe).name}-*.png"))


# ---------- Calibrage OCR ----------
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
    cx = sorted([g for g in graduations if g[0] in valeurs_x_attendues], key=lambda g: g[1])
    cy = sorted([g for g in graduations if g[0] in valeurs_y_attendues], key=lambda g: g[2])
    if len(cx) < 2 or len(cy) < 2:
        return {"statut": "echec_calibrage"}
    return {"statut": "ok_a_verifier"}


# ---------- Formules — alignées sur spec.md §8 ----------
def composition_suffisante(comp):
    return comp.get("C") is not None and comp.get("Mn") is not None


def calculer_ce_iiw(comp):
    C = comp.get("C", 0); Mn = comp.get("Mn", 0)
    Cr = comp.get("Cr", 0); Mo = comp.get("Mo", 0); V = comp.get("V", 0)
    Ni = comp.get("Ni", 0); Cu = comp.get("Cu", 0)
    return C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15


def calculer_hv_martensite_spec(comp):
    """HV_m selon spec.md §8 (sourcé) : 884*C*(1-0.3*C^2) + 294."""
    C = comp.get("C", 0)
    return round(884 * C * (1 - 0.3 * C**2) + 294, 0)


def calculer_hv_bainite_spec(comp):
    """HV_B selon spec.md §8 (sourcé) : 122*C + 7.17*Mn + 234."""
    C = comp.get("C", 0); Mn = comp.get("Mn", 0)
    return round(122 * C + 7.17 * Mn + 234, 0)


def fonction_hv_selon_t85_rampe_provisoire(t85, hv_m, hv_b):
    """
    Rampe linéaire 3 segments — PROVISOIRE tant que t* de Yurioka (2004)
    n'est pas sourcé. Ne pas présenter comme la formule arctan de spec.md §8.4.
    """
    if t85 < 5:
        return hv_m
    if t85 > 20:
        return hv_b
    fraction = (t85 - 5) / (20 - 5)
    return hv_m + (hv_b - hv_m) * fraction


def resoudre_t85_critique(hv_m, hv_b, seuil_hv, t85_min=1, t85_max=100, tolerance=0.5):
    fn = lambda t: fonction_hv_selon_t85_rampe_provisoire(t, hv_m, hv_b)
    if fn(t85_min) < seuil_hv:
        return {"statut": "sous_seuil_meme_a_t85_min"}
    if fn(t85_max) > seuil_hv:
        return {"statut": "au_dessus_seuil_meme_a_t85_max"}
    bas, haut = t85_min, t85_max
    while haut - bas > tolerance:
        m = (bas + haut) / 2
        if fn(m) > seuil_hv:
            bas = m
        else:
            haut = m
    return {"statut": "ok", "t85_critique": round((bas + haut) / 2, 1), "methode": "piecewise_lineaire_provisoire"}


# ---------- Orchestration ----------
def traiter_toutes_les_fiches():
    debut = datetime.now()
    log(f"Début du traitement : {debut}")

    prerequis_manquants = verifier_prerequis()
    resultats, compteurs = {}, {"ok": 0, "echec_calibrage": 0, "erreur": 0, "exclu": 0}
    rapport = [f"# Rapport matinal — digitalisation TRCS ({debut:%Y-%m-%d %H:%M})\n"]

    if prerequis_manquants:
        rapport.append("## ⚠️ Prérequis manquants — traitement interrompu avant de commencer\n")
        for m in prerequis_manquants:
            rapport.append(f"- {m}")
        with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
            f.write("\n".join(rapport))
        log("Arrêt : prérequis manquants, voir rapport_matin.md")
        return

    if not os.path.isdir(DOSSIER_PDF):
        log(f"ERREUR FATALE — DOSSIER_PDF introuvable : {DOSSIER_PDF}")
        rapport.append(f"## ⚠️ Dossier PDF introuvable : {DOSSIER_PDF}")
        with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
            f.write("\n".join(rapport))
        return

    if not os.path.isfile(FICHIER_JSON_EXISTANT):
        log(f"ERREUR FATALE — JSON manifest introuvable : {FICHIER_JSON_EXISTANT}")
        rapport.append(f"## ⚠️ Fichier manifest introuvable : {FICHIER_JSON_EXISTANT}")
        with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
            f.write("\n".join(rapport))
        return

    with open(FICHIER_JSON_EXISTANT, encoding="utf-8") as f:
        base_existante = json.load(f).get("nuances", {})
    log(f"{len(base_existante)} nuances chargées depuis le manifest.")

    index_normalise, collisions = construire_index_normalise(base_existante)
    if collisions:
        rapport.append("\n## ⚠️ Collisions de noms détectées après normalisation")
        for a, b, cle in collisions:
            rapport.append(f"- '{a}' et '{b}' se normalisent vers '{cle}' — à vérifier manuellement")

    pdfs_trouves = sorted(Path(DOSSIER_PDF).glob("*.pdf"))
    log(f"{len(pdfs_trouves)} fichiers PDF trouvés dans {DOSSIER_PDF}")

    for pdf in pdfs_trouves:
        nom_nuance = pdf.stem
        rapport.append(f"\n## {nom_nuance}")
        log(f"Traitement : {nom_nuance}")

        if nuance_est_exclue(nom_nuance, NUANCES_EXCLUES):
            rapport.append("- Exclue de ce lot (décision actée), non traitée.")
            compteurs["exclu"] += 1
            continue

        entree, statut_correspondance = retrouver_entree(nom_nuance, base_existante, index_normalise)
        if entree is None:
            rapport.append("- Absente du manifest (aucune correspondance, même normalisée), ignorée.")
            compteurs["erreur"] += 1
            continue
        if statut_correspondance != "exacte":
            rapport.append(f"- Correspondance trouvée par normalisation : {statut_correspondance}")

        try:
            comp = entree.get("composition") or {}
            seuil_hv = entree.get("seuil_hv")

            if not composition_suffisante(comp):
                rapport.append("- Composition insuffisante, ignorée (statut donnee_a_verifier).")
                compteurs["erreur"] += 1
                continue

            images = rendre_pdf_en_images(str(pdf), os.path.join(DOSSIER_SORTIE, nom_nuance))

            ce_iiw = calculer_ce_iiw(comp)
            hv_m = calculer_hv_martensite_spec(comp)
            hv_b = calculer_hv_bainite_spec(comp)

            # seuil_hv absent (cas actuel des 5 nuances au 2026-07-20) : on
            # calcule et on rapporte quand même CE_IIW/HV_m/HV_B - seul
            # t85_critique, qui en dépend, reste indisponible. Un brouillon
            # partiel reste plus utile qu'une nuance totalement ignorée.
            if seuil_hv is not None:
                t85_resultat = resoudre_t85_critique(hv_m, hv_b, seuil_hv)
            else:
                t85_resultat = {"statut": "seuil_hv_absent_du_manifest"}

            rapport.append(f"- CE_IIW : {ce_iiw:.3f}")
            rapport.append(f"- HV_m (spec.md §8, Yurioka) : {hv_m:.0f}")
            rapport.append(f"- HV_B (spec.md §8) : {hv_b:.0f}")
            rapport.append(f"- Seuil normatif : {seuil_hv} HV10" if seuil_hv is not None else "- Seuil normatif : absent du manifest")
            rapport.append(f"- t8/5 critique : {t85_resultat} — **rampe linéaire provisoire, pas l'arctan de spec.md §8.4 (t* non sourcé)**")

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
                rapport.append("- Calibrage automatique échoué — repli sur formules seules pour cette nuance.")

            resultats[nom_nuance] = {
                "ce_iiw": round(ce_iiw, 3), "hv_m": hv_m, "hv_b": hv_b, "seuil_hv": seuil_hv,
                "t85_critique": t85_resultat, "courbe_digitalisee_auto": graduations_ok,
                "correspondance": statut_correspondance, "statut": "brouillon_a_valider"
            }
            compteurs["ok"] += 1
            log(f"  -> OK ({nom_nuance})")

        except Exception as e:
            rapport.append(f"- **ERREUR** : {e}\n  ```\n{traceback.format_exc()}\n  ```")
            compteurs["erreur"] += 1
            log(f"  -> ERREUR ({nom_nuance}) : {e}")
            continue

    duree = datetime.now() - debut
    resume = (f"\n---\n## Résumé\n- Traitées avec succès : {compteurs['ok']}\n"
              f"- Erreurs : {compteurs['erreur']}\n- Exclues : {compteurs['exclu']}\n- Durée : {duree}\n")
    rapport.insert(1, resume)

    with open(FICHIER_BROUILLON, "w", encoding="utf-8") as f:
        json.dump(resultats, f, ensure_ascii=False, indent=2)
    with open(FICHIER_RAPPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(rapport))

    log(f"Terminé en {duree}. Brouillon : {FICHIER_BROUILLON} — Rapport : {FICHIER_RAPPORT}")


if __name__ == "__main__":
    try:
        traiter_toutes_les_fiches()
    except Exception as e:
        log(f"ERREUR FATALE NON CAPTURÉE : {e}")
        log(traceback.format_exc())
        sys.exit(1)
