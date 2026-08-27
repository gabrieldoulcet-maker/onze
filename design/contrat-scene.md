# Contrat de couture — la couche de match

Ce document dit **qui possède quoi** entre l'écran de mise en place et la scène de
match. Il existe parce que les deux vivaient dans le même conteneur, et que trois
symptômes distincts venaient de ce seul défaut : deux terrains empilés, un liseré de
2 px autour de la scène, et **53 des 55 px du banc recouverts** — les neuf
remplaçants étaient dans le DOM, mesurables, et invisibles.

## Le partage est par COUTURE, pas par fichier

| à qui | quoi |
|---|---|
| l'écran de mise en place (`partie.html`, `onze.css`) | le conteneur, les couches, le banc, le décor |
| la scène de match (`match-scene.js`) | **tout ce qui est à l'intérieur de `.scene-match`** |

Personne ne traverse cette ligne. Un défaut de placement de la couche se répare d'un
côté, un défaut de rendu du terrain animé se répare de l'autre.

## Les trois clauses

**(a) La scène reçoit un conteneur et ne suppose jamais lequel.**
`ONZE_SCENE.creer(conteneur, …)` reçoit désormais `#couche-match`, pas
`#terrain-scene`. Aucun code de la scène ne doit lire `#terrain-scene`, ni supposer
que son parent contient les lignes de placement, le banc ou les jetons. Le conteneur
est une boîte vide dont la géométrie est déjà posée.

**(b) Quand un décor peint existe, la scène ne peint pas son propre sol.**
Le décor d'arène a sa caméra, sa perspective et ses tribunes ; un dégradé vert à deux
tons posé par-dessus les efface. Le choix se lit sur `terr.image`, exactement comme
`disposerPlateau()` le fait déjà. Sur un thème dessiné (pas d'image), la scène garde
son dégradé — c'est alors elle qui fait le sol.

**(c) Le rectangle de la couche est exactement celui du décor, tolérance 0 px** —
à une exception déclarée : **elle s'arrête au-dessus du banc**. Le banc reste visible
pendant le match ; c'est une demande explicite de Gabriel (« le banc ne s'affiche pas
pendant les match » est signalé comme un manque, pas comme un choix). La couche prend
donc toute la largeur du décor, du haut du cadre au haut de la première tuile de banc.

## Ce qui est vérifié, et où

`tests/zones.spec.js` — pendant un match :
- `#terrain-scene` n'est plus visible (ses lignes et ses jetons ne doivent plus
  exister à l'écran, même couverts) ;
- le rectangle de la couche est celui du décor en largeur, et s'arrête au banc ;
- **les 9 places du banc reçoivent leur propre tap** (`elementFromPoint` sur leur
  centre renvoie le jeton, pas la toile) ;
- aucune zone n'en recouvre une autre.

La règle qui gouverne tout le reste : **on désigne un pixel et on demande au
navigateur qui répond.** Ni classe, ni `z-index`, ni géométrie recalculée — c'est ce
qui a attrapé le défaut que trois livraisons avaient laissé passer.

## Le point ouvert est TRANCHÉ par Gabriel (26 août) : une bande réservée

La contradiction §2/§7 est résolue par la **bande** : la géométrie de la scène
(stade.js, mode arène) réserve les **40 premiers px** de la couche, et le tableau de
score y vit (`top: 5px` en `scene-pleine` — son ancien décalage `--haut-bandeau`
datait d'une couche pleine hauteur et était compté deux fois depuis la couture). Le
terrain peint commence SOUS la bande : le tableau a une place, il ne flotte plus sur
le jeu. `tests/zones.spec.js` continue de faire foi au pixel désigné.

## L'historique du point, tel qu'il était posé

Le brief demande deux choses qui, pendant un match, ne peuvent pas être vraies
ensemble :

- **§2 (clause c)** : « le rectangle de la scène est exactement celui du décor ».
- **§7 (grille)** : « zone terrain : la scène, **et rien d'autre** » — donc ni bandeau,
  ni colonnes par-dessus.

Sur l'écran de **mise en place**, les deux tiennent : le décor est plein cadre, mais
les joueurs se rangent dans un rectangle rentré (`ECHELLE.zone`) qui évite les
colonnes et le bandeau. C'est mesuré et vert.

Pendant un **match**, la scène occupe toute la couche : les colonnes et le bandeau la
recouvrent forcément (mesuré : 844 × 41 px pour le bandeau, 80 × 173 px par colonne).
Deux issues, et c'est un arbitrage de jeu, pas de code :

1. **la scène se rentre entre les colonnes**, comme les joueurs le font déjà sur
   l'écran de placement — le terrain animé rétrécit d'environ 20 % en largeur ;
2. **les colonnes s'effacent pendant le match** — rien n'y est actionnable à ce
   moment-là, et elles reviennent au bilan.

L'assertion reste **rouge** en attendant : un garde-fou déclaré rouge est honnête, un
garde-fou absent ne dit rien.

## Un chiffre à vérifier, côté scène

Relevé en lançant la suite complète le 25 août : `tests/scene.spec.js` sort **rouge sur
son propre contrôle de marquage** — « EN POSITION, le marqueur est goal-side **68 %** du
temps (100/146 relevés cumulés sur 5 matchs), 74 % en comptant ceux qui courent encore ».
L'annonce après avoir borné l'anticipation à 1,5 m était **81 %**.

Soit la fusion a fait régresser, soit c'est l'échantillon — la recette dit elle-même que
la dispersion est forte. **C'est à la conversation scène de le trancher, pas à moi de le
supposer** : le chiffre est reporté ici, pas interprété.
