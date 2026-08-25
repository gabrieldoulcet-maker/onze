# ONZE — Poser les 79 unités sur le terrain : la mesure, pas la devinette

Les 79 unités trois-quarts et leurs 79 ombres sont livrées. Contrôle de conformité fait
de mon côté sur les fichiers : **1024 × 1536 PNG RGBA, canal alpha réel, aucun faux
damier, aucun blanc résiduel dans les interstices**. Un seul défaut sur 158 fichiers
(voir § 3). Ce chantier les fait entrer dans le jeu.

## 1 · L'ancrage se mesure sur l'ombre, il ne se saisit pas à la main

L'ombre porte deux taches de contact sombres sous les crampons. **L'ancrage d'une unité
= le milieu horizontal des deux contacts, à la hauteur du contact le plus bas**, exprimé
en parts de l'image. C'est directement le point qui doit tomber sur la case du terrain.

Mesuré sur les 79 : **x = 0,4585 · y = 0,9701** en médiane, écart-type 0,023 et 0,014.

Le script `mesure-ancrages.py` (fourni) produit la table complète en une commande :

```
python3 mesure-ancrages.py da/ombres/ > design/ancrages.json
```

**N'écris jamais ces valeurs à la main dans le code ni dans `portraits.json`.** Fais
tourner le script sur les fichiers nommés et dépose sa sortie. La raison est concrète :
toutes les poses de la série sont canoniques, donc aucune méthode par signature d'image
ne peut dire quelle ombre appartient à quel joueur — seul le nom de fichier le dit. Le
script se contente de mesurer chaque fichier et de garder sa clé, il ne devine rien.

Valeur de repli quand une entrée manque : `{ x: 0.4585, y: 0.9701 }`. Le jeu doit rester
jouable avec `ancrages.json` vide ou partiel, et c'est testé.

## 2 · L'ombre et l'unité se dessinent avec la même transformation

Ombre d'abord, unité par-dessus, **même position, même pivot, même facteur d'échelle**,
aucune translation propre à l'ombre. J'ai vérifié la cohérence de la série : le contact
avant de l'ombre tombe sur le pied avant de l'unité à moins de 3 % de la largeur d'image
— soit 1 à 2 px à la taille d'affichage. C'est une propriété de toute la série, pas de
telle ou telle paire : elle tient donc quel que soit le joueur.

## 3 · Le seul défaut de la livraison

**Une unité porte une bande parasite de 1 px sur son bord droit** : colonne x = 1023,
de y = 187 à y = 1477, gris clair opaque (rgb ≈ 213), alors que la colonne x = 1022 est
totalement transparente. Ce n'est pas le personnage, c'est un reste de détourage.

Deux conséquences si on ne la retire pas : un trait clair vertical visible au zoom, et
surtout une boîte englobante fausse, qui décalerait tout calcul automatique de cadrage.

Ajoute au pipeline d'import une passe qui **efface la première et la dernière colonne et
la première et la dernière ligne de chaque unité** si elles portent de l'alpha, et qui
signale le fichier concerné dans le compte rendu. C'est un garde-fou, pas une retouche :
sur les 158 fichiers livrés il ne déclenche qu'une fois, et j'ai vérifié qu'il sort bien
rouge sur ce fichier-là et vert sur les 157 autres.

## 4 · Le poids : mesuré, pas estimé

Conversion faite de mon côté sur un échantillon de 12 unités et 12 ombres :

| | source PNG | WebP 600 × 900 | 
|---|---|---|
| unité | 1 680 ko | **60 ko** (qualité 82) |
| ombre | 52 ko | **11 ko** (qualité 70) |

Soit **71 ko par joueur habillé** et **5,8 Mo pour la collection entière** — très en
dessous du plafond de 150 ko par visuel. Garde les PNG d'origine à part, convertis en
WebP au build, et charge en différé : à l'écran il n'y a jamais plus de 9 unités au banc
et 11 sur le terrain. Annonce le poids réellement chargé à l'ouverture dans ton compte
rendu.

## 5 · Les 22 entrées à regarder à l'œil

Sur les 79, 22 ancrages s'écartent de plus de 2 % de la médiane, dont 3 où le script ne
détecte qu'un seul contact au lieu de deux (pieds joints, ou ombre incomplète). Le script
les liste sur sa sortie d'erreur. **Ce ne sont pas des bogues à corriger dans le code** :
ce sont des images à regarder, et le cas échéant à faire regénérer. Rends la liste dans
ton compte rendu avec, pour chacune, la valeur mesurée.

Ordre de grandeur pour arbitrer : à la taille d'affichage (72 × 108 px), un écart de
0,02 en x vaut 1,4 px et en y 2,2 px — invisible. L'écart maximal mesuré, 0,12 en x,
vaut 8,6 px : celui-là se voit, la figurine flotte à côté de son ombre.

## 6 · Tests

La suite reste verte. Ajoute des recettes qui vérifient : le jeu tourne avec
`ancrages.json` vide et avec une table partielle ; l'ombre et l'unité d'un même joueur
partagent exactement la même transformation à l'écran ; aucune unité importée ne porte
d'alpha sur sa ligne ou sa colonne de bord ; le poids chargé à l'ouverture reste sous le
plafond annoncé ; 60 fps tenus avec 11 unités et leurs ombres à l'écran.

## Comment tester

Gabriel ouvre l'écran de mise en place : les onze joueurs sont debout sur leurs cases,
chacun avec son ombre exactement sous ses pieds, et les figurines partagent la même
ligne de sol d'un bout à l'autre du terrain.

---

## 7 · Le pont de nommage : 9 exceptions que rien d'automatique ne rattrapera

Les fichiers livrés sont nommés sans accent ni apostrophe, pour être sûrs en système de
fichiers : `units/01_Ecole_de_la_Rue/01_Malandro_unit_alpha.png`. Le jeu, lui, cherche
les noms tels qu'ils sont écrits dans `design/joueurs.json`. **`manifest.tsv` est le
pivot** : sa colonne `joueur` relie chaque nom de fichier à un joueur. Lis-le, ne
redevine pas les noms depuis les chemins.

J'ai comparé ses 79 lignes aux 71 noms de `joueurs.json`. Résultat :

- **62 correspondent exactement** — rien à faire.
- **6 ne diffèrent que par les accents**, et une normalisation Unicode suffit :
  `Jairzao → Jairzão` · `Ruben → Rubén` · `Inaki → Iñaki` · `Theo → Théo` ·
  `Sekou → Sékou` · `Tiemoko → Tiémoko`
- **3 demandent une règle explicite**, parce qu'aucune normalisation ne les trouvera :

  | dans le manifeste | dans `joueurs.json` |
  |---|---|
  | `Don Alvaro` | `Álvaro` |
  | `Joaquin El Santo` | `Joaquín` |
  | `Enfant du Pays` | `L'Enfant du Pays` |

  Le manifeste ajoute un titre aux deux premiers et retire le `L'` au troisième.

- **8 n'ont volontairement pas de fiche dans `joueurs.json`** : les trois Icônes
  (`Le Fidele` = Le Fidèle n° 9, `Gus` et `Titi` = les deux moitiés de la n° 38) et les
  cinq Copains du Club (`Gus Club`, `Marcel`, `Rachid`, `Momo`, `Titi Club`), qui sont
  le cinq de départ codé dans `partie.html`. Ils se raccordent là, pas au roster.

Le compte tombe juste : 62 + 6 + 3 = 71 joueurs, plus 3 Icônes et 5 Copains = **79**.

Dépose cette table de correspondance en configuration, pas en dur dans une fonction, et
**fais échouer l'import bruyamment si une ligne du manifeste ne trouve pas preneur** —
un joueur sans visuel doit apparaître dans ton compte rendu, jamais disparaître en
silence. La règle de non-régression reste la même : le jeu tourne avec une table vide.
