# Le système d'objets d'ONZE — v2, architecture copiée de TFT

Copie fidèle de la structure d'objets de TFT : **9 composants** (dont l'équivalent de la Spatule), **36 objets combinés**, **emblèmes d'École** (craftables ou non, comme dans TFT), **Reliques** (les artefacts d'Ornn), **Staff du club** (les objets de soutien), **versions Iconiques** (les Radiants) et **consommables**. Habillage : l'organigramme d'un club de football.

## Règles (identiques à TFT)

- Les composants tombent sur les **matchs amicaux** (PvE) et au **Mercato d'hiver**.
- Un composant seul donne un petit bonus. **Deux composants sur le même joueur fusionnent** en spécialisation définitive.
- **3 spécialisations max par joueur.**
- Les quantités par partie copient TFT (~8–10 composants par partie, à calibrer).

## Les 9 composants (les membres du staff)

| # | Membre | Bonus seul | Équivalent TFT |
|---|---|---|---|
| 1 | Prépa physique | Endurance | B.F. Sword |
| 2 | Coach mental | Sang-froid | Chain Vest |
| 3 | Analyste vidéo | Anticipation | Negatron Cloak |
| 4 | Coach de finition | Précision (xG) | Recurve Bow |
| 5 | Coach technique | Toucher | Needlessly Large Rod |
| 6 | Kiné | Récupération | Giant's Belt |
| 7 | Adjoint tactique | Discipline de zone | Tear of the Goddess |
| 8 | Scout | Vision du jeu | Sparring Gloves |
| 9 | **Passeport** (rare) | Rien seul ; combiné → emblème d'École | **Spatule** |

## Les 36 spécialisations (objets combinés)

| Combo | Nom | Effet |
|---|---|---|
| Prépa + Prépa | **Marathonien** | Stats constantes tout le match, aucune baisse de régime |
| Prépa + Mental | **Ironman** | Ne perd jamais son premier duel du match |
| Prépa + Analyste | **Pressing machine** | Force un duel supplémentaire à chaque transition adverse |
| Prépa + Finition | **Percuteur** | Gros bonus d'xG sur les tirs après course |
| Prépa + Technique | **Second souffle** | Dribbles bonifiés dans les 3 dernières phases |
| Prépa + Kiné | **Increvable** | Revient en position une phase plus tôt après chaque duel |
| Prépa + Adjoint | **Soldat** | Sa zone ne peut pas être en infériorité numérique |
| Prépa + Scout | **Contre-attaquant** | Contre-attaque immédiate sur ballon récupéré |
| Mental + Mental | **Capitaine d'acier** | Immunise l'équipe contre les bonus de remontada adverses |
| Mental + Analyste | **Joueur d'échecs** | Gagne les égalités dans tous ses duels |
| Mental + Finition | **Tueur froid** | xG massif dans les deux dernières phases |
| Mental + Technique | **Maître du tempo** | Peut ralentir une phase adverse |
| Mental + Kiné | **Roc mental** | Insensible aux capacités signatures adverses |
| Mental + Adjoint | **Général** | Les joueurs adjacents gagnent son sang-froid |
| Mental + Scout | **Vista** | Sa première passe décisive du match est imparable |
| Analyste + Analyste | **Professeur** | Annule la première occasion adverse du match |
| Analyste + Finition | **Charognard** | Les ballons qui traînent dans la surface deviennent ses tirs |
| Analyste + Technique | **Relance éclair** | Chaque interception devient une occasion |
| Analyste + Kiné | **Couverture** | Défend deux zones adjacentes |
| Analyste + Adjoint | **Cerveau** | Sa zone gagne toutes les égalités de duel |
| Analyste + Scout | **Directeur sportif** | Révèle la compo adverse pendant le mercato |
| Finition + Finition | **Sniper** | Débloque le tir lointain (depuis le milieu) |
| Finition + Technique | **Feuille morte** | Une occasion directe sur coup franc par match |
| Finition + Kiné | **Double détente** | Si son tir est arrêté, il retente immédiatement |
| Finition + Adjoint | **Point de fixation** | Les centres vers lui sont bonifiés |
| Finition + Scout | **Appel parfait** | Jamais hors-jeu, surgit côté faible |
| Technique + Technique | **Magicien** | Son premier dribble de chaque phase réussit toujours |
| Technique + Kiné | **Porteur d'eau de luxe** | Ne perd jamais le ballon sous pression |
| Technique + Adjoint | **Métronome** | Sa zone garde le ballon une phase de plus |
| Technique + Scout | **Chef d'orchestre** | Ses passes créent une occasion supplémentaire |
| Kiné + Kiné | **Immortel** | Ignore le premier malus/blessure du match |
| Kiné + Adjoint | **Libéro** | Peut reculer d'une ligne pour couvrir |
| Kiné + Scout | **Relanceur** | Chaque récupération remonte le ballon d'une zone |
| Adjoint + Adjoint | **Verrou** | Sa ligne entière +1 en duels défensifs |
| Adjoint + Scout | **Capitaine de vestiaire** | Une Philosophie de club en plus au prochain choix |
| Scout + Scout | **Œil de lynx** | Le mercato propose 6 joueurs au lieu de 5 |

## Les emblèmes d'École (Passeport + composant)

Comme dans TFT, **certains emblèmes sont craftables, d'autres non** — c'est ce qui protège les paliers chimères :

- **Craftables** : Prépa → Kick & Rush · Mental → Les Revanchards · Analyste → Catenaccio · Finition → Les Internationaux · Technique → École de la Rue · Kiné → Football Total · Adjoint → Tiki-Taka · Scout → Les Pros
- **Non craftables** (uniquement via quêtes et récompenses) : **La Grinta, L'Académie, Le Douzième Homme** — leurs hauts paliers restent des événements
- **Passeport + Passeport** → **Citoyen du monde** : compte pour +1 dans TOUTES tes Écoles actives

## Les 8 Reliques (copie des artefacts d'Ornn — uniques, non craftables, très rares)

| Relique | Effet |
|---|---|
| **Le Brassard du Fondateur** | Annule la guerre des égos : DEUX Capitaines peuvent coexister (le levier gardé en réserve — le voilà) |
| **La Chaussure Dépareillée** | Tire des deux pieds : xG doublé, mais 10 % de tirs dans les nuages — le chaos |
| **Le Sifflet Avalé** | L'arbitre ne voit plus rien : ses duels ignorent tous les malus |
| **Le Maillot Retourné** | Rage de l'ancien : gros bonus contre l'École dont le porteur est issu |
| **La Cage Immaculée** (GAR) | Chaque mi-temps sans encaisser rend +3 prestige |
| **Le Crampon d'Or 1958** | Le porteur gagne +1 étoile tant qu'il reste sur le terrain |
| **La Radio du Coach** | Tu peux changer UNE consigne pendant le match (seule action en direct du jeu — à tester avec prudence) |
| **Le Ballon Fétiche** | La première action du porteur chaque manche est un geste d'anthologie |

## Le Staff du club (copie des objets de soutien — non assignés, effets d'équipe)

**Le Chef Cuisinier** (+endurance d'équipe) · **L'Intendant** (+1M par manche) · **Le Bus du Club** (le premier duel d'équipe de chaque match est gagné) · **Le Jardinier** (duels bonifiés dans ta moitié de terrain) · **Le Kiné en Chef** (efface un malus par match) · **La Mascotte** (+1 Ferveur par manche — voir les quêtes).

## Les versions Iconiques (copie des objets Radiants)

Une spécialisation peut être sublimée en version **Iconique** (dorée, ~x1,5) via certaines quêtes ou un choix rare au Mercato d'hiver. Une seule par partie.

## Les consommables

**Rupture de contrat** (retire les cartes staff d'un joueur — le Remover) · **Reconversion** (relance aléatoirement une spécialisation — le Reforger) · **La Doublure** (duplique un joueur coût 1–3 — le Duplicator).
