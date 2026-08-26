# Étape 4 — la prédiction, écrite AVANT de commencer

*26 août 2026. Ce document est daté et poussé avant la première ligne de code de l'étape 4.
Il énonce une hypothèse de cause, et ce que chaque mesure devrait faire si cette cause est
la bonne. Le relire après coup n'a de valeur que parce qu'il a été écrit avant — c'est la
discipline du critère pré-enregistré (règle M2 bis), appliquée cette fois à un changement de
CONCEPTION et non à une mesure. Et cette fois la référence est déjà bonne.*

---

## L'hypothèse

**Trois des quatre dettes ont la même cause : pendant un temps fort, une grande partie des
pions est tenue par une chorégraphie écrite, donc indisponible pour presser, défendre ou se
proposer.**

Ce n'est pas une intuition, c'est un relevé. Sur 4 820 pions échantillonnés en régime
« action » (un match, 482 relevés) :

| rôle | part | qui le donne |
|---|---:|---|
| `scenario` | 26,3 % | la chorégraphie |
| `tireur` · `battu` · `percee` · `suit` | 14,9 % | la chorégraphie |
| gardien | 17,8 % | le cerveau |
| marquage · ligne · appel · équilibre | 33,9 % | le cerveau |
| **soutien** | **4,0 %** | le cerveau |
| **pressing** | **2,6 %** | le cerveau |
| porteur | 0,5 % | le cerveau |

**41,1 % des pions sont tenus par un scénario** — pas « la moitié », comme je l'ai écrit
d'abord. Et les deux rôles qui portent nos dettes sont les deux plus rares : soutien 4,0 %,
pressing 2,6 %.

---

## Les prédictions, par mesure

| Mesure | Aujourd'hui | Prédit après l'étape 4 | Confiance |
|---|---:|---|---|
| Options de passe ouvertes (1 à 3) | 53 % | **75 – 88 %** (+22 à +35 points) | forte |
| Densité de pressing | 5,50/min | **7,5 – 9,0/min** (+35 à +65 %) | forte |
| Fermeture sous 3 m | 53 % | **56 – 65 %** (+3 à +12 points) | **faible** |
| Dispersion entre matchs | 0,64 – 1,16 | **1,0 – 2,0** | moyenne |

**Pourquoi les deux premières sont fortes.** Elles mesurent une *disponibilité*. Un
coéquipier tenu par un scénario ne se propose pas ; un défenseur tenu par un scénario ne
presse pas. Libérer 41 % des pions doit augmenter mécaniquement le nombre de soutiens à
distance de passe et le nombre de défenseurs assez proches pour presser.

### Ce que l'instrument peut VOIR — la moitié basse de la troisième prédiction est invisible

Une prédiction n'a de valeur que si l'échantillon peut la distinguer de « rien n'a bougé ».
Puissance simulée pour détecter un mouvement depuis 53 % :

| mouvement | n = 200 | n = 400 | n = 600 |
|---|---:|---:|---:|
| 53 → 56 % | 17 % | 33 % | 42 % |
| 53 → 58 % | 36 % | 63 % | 79 % |
| 53 → 60 % | 59 % | 86 % | 97 % |
| 53 → 65 % | 95 % | 100 % | 100 % |

**À n ≈ 200, un atterrissage à 56 % n'a que 17 % de chances d'être vu.** Autrement dit, si
l'étape 4 produit exactement le bas de ma fourchette, je ne le saurai pas. Et le piège est
pire que l'absence de résultat : un 56 % mesuré se lirait spontanément comme *« ça a bougé
un peu, comme prévu, confiance faible »* — **une prédiction faible confirmée par du bruit**,
la forme la plus séduisante du faux positif, parce qu'elle a l'air modeste.

**Règle de lecture, fixée d'avance** : à n ≈ 200, seul un atterrissage **≥ 60 %** se
distingue de « rien n'a bougé ». Entre 53 et 58 %, la conclusion s'écrit **« non
mesurable »** — jamais « petit mouvement ». Pour conclure sur la moitié basse, il faudrait
n ≈ 600, soit une douzaine de passages cumulés.

**Pourquoi la troisième est faible, et c'est le point qui compte.** La fermeture ne mesure
pas une disponibilité mais une *réussite* : un presseur, par définition, n'a jamais de cible
imposée — la chorégraphie ne le retient pas. Ce qui devrait l'aider est autre chose : le
**tempo**. Une phase de construction (0,04 m/s) laisse à un défenseur le temps d'arriver au
contact ; une phase de jeu direct (13 m/s) ne le laisse pas. C'est un mécanisme différent, et
je m'attends donc à un mouvement plus petit et moins sûr.

---

## Ce que chaque issue voudra dire

- **Les trois bougent dans le sens prédit** → la cause commune est confirmée. On aura gagné
  plus qu'un correctif : on saura *pourquoi*.
- **Les deux premières bougent, la troisième peu ou pas** → la disponibilité était bien la
  cause commune de *deux* dettes, et la fermeture était un symptôme voisin avec sa propre
  cause. C'est l'issue que je considère la plus probable, et c'est pour ça que la troisième
  prédiction est déclarée faible **à l'avance** plutôt qu'expliquée après coup.
- **Seule la troisième bouge** → l'hypothèse est fausse. Ce n'était pas une cause commune,
  c'étaient trois symptômes qui se ressemblaient.
- **Aucune ne bouge** → les gabarits n'ont pas libéré les pions, et il faut chercher ailleurs
  que dans la chorégraphie.

## La règle de lecture

Une prédiction ratée qui a été écrite d'avance vaut mieux qu'une explication reconstruite
après coup. Le tableau ci-dessus ne se retouche pas : il se compare.


---

## Amendement du 26 août, AVANT de commencer : un second levier, et une question de référence

Un fil tiré avant d'écrire le premier gabarit — parce qu'une prédiction qui vise le mauvais
levier coûte plus cher à découvrir après huit gabarits qu'avant.

**Le soupçon de départ ne tient pas, et c'est une erreur de dénominateur.** L'idée était que
« deux tiers des pions mis en rôle de presseur ne produisent jamais d'engagement mesurable »,
d'après un rapport de 3,1× entre la part en rôle (2,6 %) et la part en engagement calculée
(0,83 %). Mais ce 0,83 % divisait par **22 joueurs**, alors que nos matchs de manche 10 en
comptent **dix**. Mesuré directement plutôt que calculé : **1,56 % du temps-joueur en rôle,
1,46 % en épisode ≥ 1 s — un rapport de 1,06×**. Le rôle se convertit presque entièrement.
*(C'est encore la famille M2 : un chiffre emprunté à une population de 22 appliqué à une
population de 10.)*

**Mais le fil menait ailleurs, et à deux choses réelles.**

**(a) 60 % du temps passé en rôle de presseur se joue alors que PERSONNE ne tient le
ballon** — il est en vol ou libre. La mission de pressing est un compte à rebours de deux
secondes qui ne regarde pas si le porteur existe encore : quand la passe part à 17 m/s, le
presseur continue de « presser » un ballon parti. D'où une distance au ballon pendant le
rôle de **p10 4,6 · médiane 7,9 · p90 29,4 m** — le p90 à trente mètres est la queue du
ballon en vol.

**(b) Nos durées de pressing sont un pic, pas une distribution.** Mesuré **p10 1,36 · médiane
2,01 · p90 2,02 s** contre un réel **1,10 · 2,10 · 4,40**. La médiane tombe juste *par
construction* — la mission dure 2,0 s en dur — et **le p90 est à 2,02 là où la réalité dit
4,40**. Aucun de nos pressings ne dure plus que le minuteur. C'est un défaut de **forme** que
la médiane cachait, et il est **indépendant de l'hypothèse de chorégraphie**.

**Conséquence sur la prédiction** : la densité de pressing a donc **deux leviers possibles**,
pas un. Si elle bouge après l'étape 4, il faudra distinguer lequel a joué — et c'est pour ça
que les deux sont écrits ici, avant.

**Et une question de référence que je ne tranche pas seul.** Les 7,01 épisodes/minute sont
mesurés sur du football à **22 joueurs**. Sur nos matchs à **dix**, la même densité de
surface est conservée (324 m²/joueur) mais il y a deux fois moins de défenseurs. Deux
lectures s'opposent, et elles ne donnent pas le même verdict :

| lecture | notre chiffre | le réel | verdict |
|---|---:|---:|---|
| **par match** (épisodes/minute) | 5,50 | 7,01 | nous sommes **22 % en dessous** |
| **par joueur** (part du temps-joueur) | 1,46 % | 1,12 % | nous sommes **31 % au-dessus** |

Les deux sont exacts ; ils ne mesurent pas la même chose. Tant que la question n'est pas
tranchée, **la dette de densité repose sur une référence dont la transférabilité n'est pas
établie** — et la règle est qu'une référence se remesure sur la population pertinente, elle
ne se réinterprète pas.
