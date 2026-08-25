#!/usr/bin/env python3
"""
ONZE - Mesure automatique des ancrages a partir des ombres livrees.

Principe : l'ombre porte deux taches de contact sombres sous les crampons.
L'ancrage d'une unite = milieu horizontal des deux contacts, a la hauteur
du contact le plus bas. Le resultat est en parts de l'image (0-1), donc
valable quelle que soit la taille a laquelle le jeu affiche la figurine.

Usage :
    python3 mesure-ancrages.py shadows/ > ancrages.json

Sortie : { "<nom de fichier sans extension>": { "x": 0.4585, "y": 0.9701 }, ... }
Les fichiers dont la mesure est douteuse sortent en commentaire sur stderr :
c'est la liste a verifier a l'oeil, pas a corriger a la main dans le code.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image

SEUIL_ALPHA   = 128   # au-dela : pixel present
SEUIL_SOMBRE  = 110   # luminance en-deca : tache de contact (le corps de
                      # l'ombre est un gris clair ~180, les contacts ~50)
ECART_GROUPE  = 25    # px : deux taches separees de plus de ca sont deux pieds
TAILLE_MIN    = 50    # px : en-deca c'est du bruit

# valeurs de reference mesurees sur la serie des 79 (mediane)
REF_X, REF_Y  = 0.4585, 0.9701
TOLERANCE     = 0.02  # au-dela on signale


def contacts(chemin):
    a = np.array(Image.open(chemin).convert("RGBA"))
    alpha = a[:, :, 3]
    lum   = a[:, :, :3].mean(axis=2)
    masque = (alpha > SEUIL_ALPHA) & (lum < SEUIL_SOMBRE)
    ys, xs = np.nonzero(masque)
    if len(xs) == 0:
        return []
    o = np.argsort(xs)
    xs, ys = xs[o], ys[o]
    coupures = np.nonzero(np.diff(xs) > ECART_GROUPE)[0]
    groupes = []
    for p in np.split(np.arange(len(xs)), coupures + 1):
        if len(p) < TAILLE_MIN:
            continue
        groupes.append((xs[p].mean(), ys[p].max()))
    return groupes


def ancrage(chemin):
    h, l = Image.open(chemin).size[1], Image.open(chemin).size[0]
    g = contacts(chemin)
    if not g:
        return None, "aucun contact sombre detecte"
    x = (g[0][0] + g[-1][0]) / 2 / l
    y = max(c[1] for c in g) / h
    alerte = None
    if len(g) == 1:
        alerte = "un seul contact detecte (pieds joints ou ombre incomplete)"
    elif abs(x - REF_X) > TOLERANCE or abs(y - REF_Y) > TOLERANCE:
        alerte = "hors tolerance : x=%.4f y=%.4f" % (x, y)
    return {"x": round(x, 4), "y": round(y, 4)}, alerte


def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else "."
    fichiers = sorted(glob.glob(os.path.join(dossier, "*.png")))
    table, alertes = {}, []
    for f in fichiers:
        val, alerte = ancrage(f)
        cle = os.path.splitext(os.path.basename(f))[0]
        if val:
            table[cle] = val
        if alerte:
            alertes.append("%s : %s" % (cle, alerte))
    json.dump(table, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    for a in alertes:
        sys.stderr.write("A VERIFIER  " + a + "\n")
    sys.stderr.write("%d ancrages mesures, %d a verifier\n" % (len(table), len(alertes)))


if __name__ == "__main__":
    main()
