# Génère les fiches nuances (nuances/*.html) et leur index (nuances/index.html)
# à partir de donnees.json, produit par calculer.mjs avec le moteur du site.
# Usage : node outils/fiches_nuances/calculer.mjs <racine> outils/fiches_nuances/donnees.json "$(cat outils/fiches_nuances/nuances.json)"
#         python3 outils/fiches_nuances/generer.py <racine>
# Aucune valeur n'est saisie ici : tout vient de data.json via le moteur.
import json, re, sys, html
R = sys.argv[1]
D = json.load(open(f"{R}/outils/fiches_nuances/donnees.json", encoding="utf-8"))
TPL = open(f"{R}/calcul-energie-soudage.html", encoding="utf-8").read()
DATE = "2026-11-01"
B = "https://soudabilite.com"

def f(x, n=2):
    return f"{x:.{n}f}".replace(".", ",")

# Libellés repris du calculateur (assets/i18n/fr.json, analyse.plage_*) pour
# qu'une fiche et l'écran d'analyse disent la même chose.
_FR = json.load(open(f"{R}/assets/i18n/fr.json", encoding="utf-8"))["analyse"]
VERDICT = {k: _FR[f"plage_{k}"] for k in ("ideal", "acceptable", "zone_s", "hors")}

def absolu(s):
    s = re.sub(r'(href|src)="(?!https?:|/|#|mailto:|data:)([^"]+)"', r'\1="/\2"', s)
    return s

def page(titre, desc, url, h1_crumb, article, ld_extra=None):
    s = TPL
    s = re.sub(r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{html.escape(desc)}" />', s, count=1)
    s = re.sub(r'<title>[^<]*</title>', f'<title>{html.escape(titre)}</title>', s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', s, count=1)
    s = re.sub(r'\n\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" />', '', s)
    s = re.sub(r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{html.escape(titre.split(" | ")[0])}" />', s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{html.escape(desc)}" />', s, count=1)
    s = re.sub(r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />', s, count=1)
    crumbs = [("Accueil", B + "/"), ("Bibliothèque des matériaux", B + "/bibliotheque-materiaux.html")]
    if url != B + "/nuances/":
        crumbs.append(("Fiches nuances", B + "/nuances/"))
    crumbs.append((h1_crumb, url))
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "TechArticle", "headline": titre.split(" | ")[0], "inLanguage": "fr",
         "author": {"@type": "Person", "name": "Tony SANCHEZ"}, "publisher": {"@type": "Organization", "name": "Soudabilite.com"},
         "mainEntityOfPage": url, "datePublished": DATE, "dateModified": DATE},
        {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(crumbs)]}]}
    s = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda m: '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2) + '\n    </script>', s, count=1, flags=re.S)
    s = re.sub(r'(<a class="langues__lien" href=")[^"]*(")', r'\1/en/\2', s, count=1)
    s = re.sub(r'        <article class="gm__corps">.*?</article>', lambda m: article.rstrip("\n"), s, count=1, flags=re.S)
    s = absolu(s)
    assert "—" not in article
    return s

def fil(crumb):
    return f'<p class="gm__doux"><a href="/">Accueil</a> &rsaquo; <a href="/bibliotheque-materiaux.html">Bibliothèque des matériaux</a> &rsaquo; <a href="/nuances/">Fiches nuances</a> &rsaquo; {crumb}</p>'

def table_compo(c):
    el = ["C", "Mn", "Si", "Cr", "Ni", "Mo", "Nb", "Ti", "N", "Cu"]
    tete = "".join(f"<th>%{e}</th>" for e in el if e in c)
    ligne = "".join(f"<td>{f(c[e], 3)}</td>" for e in el if e in c)
    return f'<div class="defile">\n              <table>\n                <thead><tr>{tete}</tr></thead>\n                <tbody><tr>{ligne}</tr></tbody>\n              </table>\n            </div>'

def table_apports(rows):
    l = "".join(f'<tr><td>{i+1}</td><td>{html.escape(r["designation"])}</td><td>{VERDICT[r["niveau"]]}</td><td>{r["ideal"]} %</td></tr>\n                  ' for i, r in enumerate(rows))
    return f'<div class="defile">\n              <table>\n                <thead><tr><th>Rang</th><th>Apport</th><th>Verdict sur 15 à 30 %</th><th>Part en zone idéale</th></tr></thead>\n                <tbody>\n                  {l.strip()}\n                </tbody>\n              </table>\n            </div>'

def fiche(d):
    n = d["nom"]; carbone = d["type"] == "carbone"
    url = f"{B}/nuances/{d['slug']}.html"
    sources = [f"{d['norme']} : composition et caractéristiques de la nuance {n}.",
               "A. L. Schaeffler, diagramme de constitution du métal fondu des aciers inoxydables, 1949."]
    if carbone:
        ce = d["ceIIW"]; tps = d["tp"]
        sous = ce < 0.42
        phrase_ce = (f"Le {n} reste sous le repère de 0,42 : il est réputé soudable sans préchauffage dans des conditions courantes."
                     if sous else
                     f"Le {n} dépasse le repère de 0,42 : le préchauffage doit être examiné.")
        lignes = "".join(f'<tr><td>{t["e"]} mm</td><td>{f(t["ceqc"], 3)}</td><td>{"aucun préchauffage calculé" if t["tp"] is None else str(t["tp"]) + " °C"}</td></tr>\n                  ' for t in tps)
        avec_tp = [t for t in tps if t["tp"] is not None]
        if not avec_tp:
            phrase_sef = "Séférian ne donne aucune température sur ces trois épaisseurs : le Ceq corrigé reste sous 0,25."
        elif sous:
            phrase_sef = (f"Les deux indicateurs ne disent pas la même chose : le CE trie, Séférian chiffre. "
                          f"À {avec_tp[0]['e']} mm, Séférian donne déjà {avec_tp[0]['tp']} °C. Quand ils divergent, la NF EN 1011-2 tranche.")
        else:
            phrase_sef = f"À 20 mm, le calculateur affiche {tps[1]['tp']} °C. L'épaisseur pèse, mais la composition pèse davantage."
        h = d["hetero"]
        assert h[0]["niveau"] == "ideal", d["slug"]
        corps = f'''
          <section id="composition" aria-labelledby="t-compo">
            <h2 id="t-compo">Composition retenue</h2>
            <p>Valeurs de la bibliothèque du site, utilisées par le calculateur. Elles restent des valeurs types : pour un dossier qualifié, le certificat matière 3.1 fait foi.</p>
            {table_compo(d["composition"])}
          </section>

          <section id="prechauffage" aria-labelledby="t-pre">
            <h2 id="t-pre">Faut-il préchauffer le {n} ?</h2>
            <p><strong>Le carbone équivalent IIW vaut {f(ce, 3)}.</strong> {phrase_ce}</p>
            <p>Le calculateur chiffre ensuite la température par la méthode de Séférian, sur trois épaisseurs :</p>
            <div class="defile">
              <table>
                <thead><tr><th>Épaisseur</th><th>Ceq Séférian corrigé</th><th>Température de préchauffage</th></tr></thead>
                <tbody>
                  {lignes.strip()}
                </tbody>
              </table>
            </div>
            <p>{phrase_sef} Le détail des formules est dans la page <a href="/calcul-prechauffage-soudage.html">calcul du préchauffage</a>.</p>
          </section>

          <section id="heterogene" aria-labelledby="t-hetero">
            <h2 id="t-hetero">Souder le {n} sur un inox 316L</h2>
            <p>Cas calculé : bout à bout chanfreiné en V, procédé TIG, dilution partagée à parts égales, apport testé sur toute la plage de 15 à 30 %. Les trois apports les plus robustes :</p>
            {table_apports(h)}
            <p>L'apport classé premier, {html.escape(h[0]["designation"])}, est idéal sur toute la plage : sa réserve de chrome et de nickel compense la part de {n} fondue. Le raisonnement complet est déroulé dans la page <a href="/diagramme-schaeffler-en-ligne.html">diagramme de Schaeffler en ligne</a>.</p>
          </section>'''
        sources.insert(1, "NF EN 1011-2 et méthode de Séférian : préchauffage des aciers ferritiques.")
        h1 = f"{n} : préchauffage et soudage sur inox"
        chapo = f"Le {n} ({d['num']}) est un {d['famille']} de la {d['norme']}. Avant de le souder, deux questions se posent : faut-il le préchauffer, et quel métal d'apport prendre face à un inox ? Voici les réponses du calculateur, chiffrées sur la composition de la bibliothèque."
        desc = f"Soudabilité du {n} ({d['num']}) : carbone équivalent {f(ce, 3)}, préchauffage Séférian à 10, 20 et 30 mm, métal d'apport pour un assemblage avec un inox 316L."
        cloture = "Une nuance se soude d'après sa composition, pas d'après son nom."
    else:
        h = d["hetero"]
        corps = f'''
          <section id="composition" aria-labelledby="t-compo">
            <h2 id="t-compo">Composition retenue</h2>
            <p>Valeurs de la bibliothèque du site, utilisées par le calculateur. Elles restent des valeurs types : pour un dossier qualifié, le certificat matière 3.1 fait foi.</p>
            {table_compo(d["composition"])}
          </section>

          <section id="schaeffler" aria-labelledby="t-sch">
            <h2 id="t-sch">Équivalents de Schaeffler</h2>
            <p><strong>Chrome équivalent {f(d["crEq"])} ; nickel équivalent {f(d["niEq"])}.</strong> Ce sont les coordonnées du {n} sur le diagramme de Schaeffler, avant mélange avec le métal d'apport.</p>
            <p>Les aciers inoxydables austénitiques ne se préchauffent pas : on limite l'apport de chaleur et on surveille la température entre passes. La page <a href="/calcul-energie-soudage.html">calcul de l'énergie de soudage</a> détaille la mesure de cet apport.</p>
          </section>

          <section id="homogene" aria-labelledby="t-homo">
            <h2 id="t-homo">Souder le {n} sur lui-même</h2>
            <p>Pour un assemblage homogène, le métal d'apport se choisit d'abord dans la même famille chimique que la nuance, pour conserver sa tenue à la corrosion. Le diagramme de Schaeffler vérifie ensuite la teneur en ferrite du joint ; il ne remplace pas ce premier choix.</p>
          </section>

          <section id="heterogene" aria-labelledby="t-hetero">
            <h2 id="t-hetero">Souder le {n} sur un acier S235JR</h2>
            <p>Cas calculé : bout à bout chanfreiné en V, procédé TIG, dilution partagée à parts égales, apport testé sur toute la plage de 15 à 30 %. Les trois apports les plus robustes :</p>
            {table_apports(h)}
            <p>Face à un acier carbone, l'apport doit compenser la part d'acier fondue. Le raisonnement complet est déroulé dans la page <a href="/diagramme-schaeffler-en-ligne.html">diagramme de Schaeffler en ligne</a>.</p>
          </section>'''
        h1 = f"{n} : soudabilité et choix du métal d'apport"
        chapo = f"Le {n} ({d['num']}) est un {d['famille']} de la {d['norme']}. Avant de le souder, une question décide du reste : quel métal d'apport, et face à quelle nuance ? Voici les réponses du calculateur, chiffrées sur la composition de la bibliothèque."
        desc = f"Soudabilité de l'inox {n} ({d['num']}) : composition, équivalents de Schaeffler Cr {f(d['crEq'])} et Ni {f(d['niEq'])}, métal d'apport pour un assemblage avec un acier S235JR."
        cloture = "Le métal d'apport se choisit sur la composition, puis se vérifie sur le diagramme."
    art = f'''        <article class="gm__corps">

          <header class="gm__tete">
            {fil(n)}
            <h1>{h1}</h1>
            <p class="gm__chapo">{chapo}</p>
            <a class="cta" href="/analyse-thermique-metallurgique.html">Analyser mon assemblage avec le {n}</a>
          </header>
{corps}

          <section id="limites" aria-labelledby="t-limites">
            <h2 id="t-limites">Ce que cette fiche ne couvre pas</h2>
            <ul>
              <li>La composition réelle d'une coulée, donnée par le certificat matière.</li>
              <li>Le temps de refroidissement t8/5 et la dureté prévisible, pas encore calculés.</li>
              <li>Les conditions de service : corrosion, température, fatigue.</li>
            </ul>
            <p>Les valeurs servent à préparer un DMOS préliminaire. La validation repose sur la qualification du mode opératoire selon la NF EN ISO 15614-1.</p>
            <a class="cta" href="/analyse-thermique-metallurgique.html">Ouvrir le calculateur</a>
          </section>

          <section id="sources" aria-labelledby="t-sources">
            <h2 id="t-sources">Sources</h2>
            <ul class="sources">
              {"".join(f"<li>{html.escape(x)}</li>" for x in sources)}
            </ul>
            <p class="gm__cloture">{cloture}</p>
          </section>

        </article>
'''
    titre = f"{n} ({d['num']}) : soudabilité, préchauffage et métal d'apport | Soudabilite.com" if carbone else f"{n} ({d['num']}) : soudabilité et métal d'apport | Soudabilite.com"
    return page(titre, desc, url, n, art)

for d in D:
    open(f"{R}/nuances/{d['slug']}.html", "w", encoding="utf-8").write(fiche(d))

# Index
def lien(d): return f'<a href="/nuances/{d["slug"]}.html">{d["nom"]}</a>'
ac = "".join(f'<tr><td>{lien(d)}</td><td>{d["num"]}</td><td>{f(d["ceIIW"], 3)}</td><td>{"aucun" if d["tp"][1]["tp"] is None else str(d["tp"][1]["tp"]) + " °C"}</td></tr>\n                  ' for d in D if d["type"] == "carbone")
ix = "".join(f'<tr><td>{lien(d)}</td><td>{d["num"]}</td><td>{f(d["crEq"])}</td><td>{f(d["niEq"])}</td></tr>\n                  ' for d in D if d["type"] != "carbone")
art = f'''        <article class="gm__corps">

          <header class="gm__tete">
            <p class="gm__doux"><a href="/">Accueil</a> &rsaquo; <a href="/bibliotheque-materiaux.html">Bibliothèque des matériaux</a> &rsaquo; Fiches nuances</p>
            <h1>Fiches nuances : soudabilité des aciers courants</h1>
            <p class="gm__chapo">Une fiche par nuance, calculée par le moteur du site sur la composition de la bibliothèque : préchauffage pour les aciers, équivalents de Schaeffler pour les inox, métal d'apport pour un assemblage hétérogène.</p>
            <a class="cta" href="/analyse-thermique-metallurgique.html">Ouvrir le calculateur</a>
          </header>

          <section id="aciers" aria-labelledby="t-aciers">
            <h2 id="t-aciers">Aciers non alliés et faiblement alliés</h2>
            <div class="defile">
              <table>
                <thead><tr><th>Nuance</th><th>Numéro</th><th>CE IIW</th><th>Séférian à 20 mm</th></tr></thead>
                <tbody>
                  {ac.strip()}
                </tbody>
              </table>
            </div>
          </section>

          <section id="inox" aria-labelledby="t-inox">
            <h2 id="t-inox">Aciers inoxydables austénitiques</h2>
            <div class="defile">
              <table>
                <thead><tr><th>Nuance</th><th>Numéro</th><th>Cr éq</th><th>Ni éq</th></tr></thead>
                <tbody>
                  {ix.strip()}
                </tbody>
              </table>
            </div>
            <p class="gm__cloture">Chaque valeur sort du calculateur. Le certificat matière garde le dernier mot.</p>
          </section>

        </article>
'''
open(f"{R}/nuances/index.html", "w", encoding="utf-8").write(page("Fiches nuances : soudabilité des aciers courants | Soudabilite.com",
     "Fiches de soudabilité par nuance : S235JR, S355, P235GH, P355NL1, 16Mo3, 304L, 316L et autres. Carbone équivalent, préchauffage, équivalents de Schaeffler, métal d'apport.",
     B + "/nuances/", "Fiches nuances", art))
print("ok", len(D) + 1, "pages")
