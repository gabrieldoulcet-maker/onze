# Les silhouettes du terrain — cahier des charges

Ce document décrit **ce que les nouvelles unités doivent respecter** pour se poser
correctement sur le terrain, et **ce que le code sait déjà faire** en les attendant.
Il est écrit avant les images, exprès : tout est en place côté code, aucune reprise
ne sera nécessaire à leur arrivée.

## Le problème qu'on corrige

Les silhouettes actuelles sont dessinées **de face, à hauteur d'œil**, alors que le
terrain est vu **d'en haut, en perspective**. Un personnage photographié de plain-pied
posé sur une vue plongeante se lit comme une figurine plate collée sur une photo :
les deux images ne partagent pas la même caméra.

## La caméra, mesurée sur les décors

L'angle n'est pas une intention, il est **relevé sur les trois terrains peints** — en
comparant la largeur du rectangle de jeu (104 m) à sa hauteur à l'écran (68 m) :

| Terrain | Plongée mesurée | Fuite (largeur du fond ÷ largeur du premier plan) |
|---|---|---|
| Grand Soir | 33,0° | 0,73 |
| Boxing Day | 31,3° | 0,66 |
| City Stade | 32,9° | 0,70 |

**La caméra regarde le terrain depuis environ 32° au-dessus de l'horizon.** Les
silhouettes doivent être dessinées **depuis ce même point de vue** : on voit un peu le
dessus des épaules et de la tête, les pieds sont plus proches de nous que le visage,
et le personnage est **tourné de trois quarts** (20 à 30° hors de l'axe de la caméra).

## Les trois fichiers d'un joueur

| Fichier | Gabarit | Contenu |
|---|---|---|
| `ONZE_<id>_<Nom>.webp` | 900 × 600 (paysage 3:2) | le key art de la carte de boutique — inchangé |
| `ONZE_<id>_<Nom>_frontale.webp` | 600 × 900 (portrait 2:3) | la silhouette, **vraie transparence**, vue de trois quarts élevée |
| `ONZE_<id>_<Nom>_ombre.webp` | libre, ~600 × 200 | **l'ombre au sol seule**, sur fond transparent |

`<id>` est l'identifiant du joueur : son index au roster, `S1`-`S5` pour les cinq de
départ, le préfixe à lettre pour les unités d'Icône. Chaque fichier reste **sous 150 Ko**.

**L'ombre est un fichier à part, et c'est volontaire** : elle se redimensionne avec le
niveau d'étoiles comme la silhouette, elle garde la forme que le dessinateur lui donne
(un cercle flou n'est pas une ombre de trois quarts), et un joueur qui n'en a pas garde
l'ombre dessinée en CSS sans que rien ne casse.

**L'ombre est centrée dans son image** : son centre est le point de contact avec le sol.
Le code lui donne une largeur de **0,95 × la hauteur de la silhouette** et la pose sous
le point d'appui.

## Le point d'appui

C'est la seule mesure à relever à la main, et c'est elle qui rend le reste indolore.

> **Le point d'appui est l'endroit où le joueur touche le sol** : le milieu entre ses
> deux pieds, à la hauteur du pixel de contact le plus bas.

Il s'exprime **en parts de l'image**, à trois décimales : `x` depuis le bord gauche,
`y` depuis le haut. Une silhouette bien cadrée, pieds au ras du bas et centrée, donne
`{ x: 0.5, y: 1 }` — c'est le défaut, et c'est ce que le code suppose sans indication.
Une silhouette de trois quarts, jambe avancée, donnera plutôt quelque chose comme
`{ x: 0.46, y: 0.965 }`.

**C'est ce point qui est calé sur la ligne de sol, jamais le bord de l'image.** C'est ce
qui permet de changer les proportions d'un visuel — recadrage, pose, longueur de jambes —
sans déplacer personne sur le terrain.

## La table

Tout vit dans `design/portraits.json`. Deux champs facultatifs s'ajoutent aux deux
existants :

```json
"Malandro": {
  "carte":    "da/keyarts/ONZE_67_Malandro.webp",
  "frontale": "da/frontales/ONZE_67_Malandro_frontale.webp",
  "ombre":    "da/ombres/ONZE_67_Malandro_ombre.webp",
  "ancrage":  { "x": 0.46, "y": 0.965 }
}
```

`ancrage` accepte aussi la forme courte `[0.46, 0.965]`. Les deux champs sont
**facultatifs** : sans `ombre`, l'ombre dessinée en CSS reste ; sans `ancrage`, les pieds
sont supposés au bas de l'image. Une valeur abîmée est ignorée plutôt que de casser le
rendu — la table s'édite à la main.

## Ce que les recettes vérifient

- **Le point d'appui tient la ligne de sol** : quel que soit l'ancrage déclaré, les
  points d'appui de tous les joueurs d'une même rangée tombent sur la même ligne, au
  pixel près — et le point d'appui est centré sur l'emplacement, ancrage horizontal
  compris (`tests/rendu.spec.js`). Vérifiée en faisant ignorer l'ancrage au code : elle
  sort rouge avec 14 px d'écart.
- **L'ombre en fichier remplace l'ombre dessinée**, jamais les deux, et **grandit avec les
  étoiles** (rapport 1,38 entre un 1★ et un 3★, mesuré).
- **Les ancrages déclarés sont plausibles** (x entre 0,2 et 0,8 · y entre 0,5 et 1) :
  un ancrage aberrant ne casse rien à l'écran, il décale un joueur en silence
  (`tests/portraits.spec.js`).
- **Les chemins d'ombre** entrent dans les contrôles existants : le fichier existe, il
  n'est attribué qu'à un seul joueur, son numéro est celui du joueur, et il compte dans
  le poids de la banque.

## Les réglages, tous au même endroit

`ECHELLE.ombre` dans `partie.html` : `fichier` (largeur de l'ombre en part de la hauteur
de la silhouette, 0,95) et `opacite` (0,9). Les valeurs de l'ombre dessinée, qui reste le
repli, sont juste à côté.
