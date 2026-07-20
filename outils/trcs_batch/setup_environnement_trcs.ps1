# ============================================================
# setup_environnement_trcs.ps1
# A executer UNE SEULE FOIS, en PowerShell administrateur,
# avant de lancer batch_trcs_overnight.py cette nuit.
# ============================================================

# 1. Poppler (fournit pdftoppm) - package confirmé sur le dépôt winget officiel
winget install --id=oschwartz10612.Poppler -e --accept-package-agreements --accept-source-agreements

# 2. Tesseract OCR - package confirmé sur le dépôt winget officiel (UB-Mannheim)
winget install --id=UB-Mannheim.TesseractOCR -e --accept-package-agreements --accept-source-agreements

# 3. Dépendances Python
pip install pytesseract pillow numpy

Write-Host "Installation terminee. Fermer et rouvrir le terminal pour que le PATH soit pris en compte."
