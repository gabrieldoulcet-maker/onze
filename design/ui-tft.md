# Audit UI/UX — ce que TFT mobile fait, et quoi changer dans ONZE

Source : étude de l'interface réelle de TFT mobile (layout, gestes, outils). Statuts : ✅ ONZE l'a déjà (ou en sprint) · 🔶 à changer · 🆕 à ajouter.

## Ce que TFT mobile fait — et où ONZE en est

| Élément TFT mobile | Détail | ONZE |
|---|---|---|
| Boutique **escamotable** (toggle sac d'or) | La boutique se replie pour voir tout le plateau ; refresh, verrou et odds restent accrochés au bord | 🔶 notre boutique est fixe |
| **Team Planner** (haut droite) | Tu épingles ta compo cible → les joueurs planifiés **brillent en boutique** ; bouton « snapshot » qui importe ton équipe actuelle | 🆕 le manque le plus important |
| Éclat de montée en boutique | Une carte en boutique **brille avec ★** si l'acheter crée une fusion (tu possèdes déjà 2 copies) | 🆕 crucial pour la construction |
| **Recap de combat** (icône épée) | Barres de contribution par unité, code couleur, extensible au camp adverse | 🆕 chez nous : buts/xG/duels gagnés par joueur — « l'homme du match » |
| Scouting à barre jaune | Icône joueurs → tu visites les plateaux ; **barre jaune** = plateau visité, bouton bleu = retour instantané ; dispo même pendant le carrousel | 🔶 nous : scouting par le classement, pas d'indicateur ni de retour rapide, indisponible pendant certains écrans |
| Vente par glisser **vers les coins bas** | Deux zones de vente, toujours au même endroit | ✅ en sprint (aligner : les 2 coins) |
| Aperçu d'objet en survol | Tenir un composant au-dessus d'un joueur montre la spécialisation résultante SANS engager | ✅ en sprint (confirmation avant fusion) |
| Bascule gauche synergies ⇄ objets | L'icône hexagone alterne le panneau gauche entre synergies et inventaire d'objets | 🆕 résout notre colonne gauche surchargée (ADN + synergies + staff + quêtes) |
| Tap = détail, partout | « Dans le doute, tape dessus, ça s'ouvre » — philosophie générale | ✅ (fiches, familles, quêtes) |
| Barre de stage avec icônes d'événements | Les rencontres à venir sont visibles dans la ligne de temps | ✅ en sprint |
| XP / refresh / verrou / odds groupés au bord de la boutique | Zone de main droite, tout sous le pouce | ✅ à vérifier au polish |

## Les 5 changements, par ordre d'impact

1. **🆕 Le Calepin du recruteur (Team Planner).** Un bouton en haut à droite ouvre la galerie des 71 joueurs (+ Icônes découvertes) ; tu épingles ta compo rêvée (jusqu'à 11) ; dès lors, **ces joueurs brillent quand ils apparaissent en boutique**, et le calepin montre les paliers que ta compo cible activerait. Bouton « photographier mon équipe » pour partir de l'existant. C'est LE service au « fun = construction » : le jeu te laisse rêver ta compo puis t'aide à la chasser.
2. **🆕 L'éclat de fusion en boutique.** Carte = 2 copies possédées → elle brille avec ★★ (or si elle complète une 3★). Zéro clic, dopamine immédiate, et c'est le compagnon naturel du « chasseur de paires ».
3. **🆕 Le recap du match (l'épée).** Pendant et après le match : contributions par joueur (buts, passes décisives, duels gagnés, arrêts — nos stats alimentent tout), extensible au camp adverse. Donne l'« homme du match » — et plus tard, la Ferveur peut s'y accrocher.
4. **🔶 La boutique escamotable.** Toggle sur le sac d'or ; repliée, il reste refresh + verrou + or. Indispensable quand le terrain deviendra la scène animée du match.
5. **🔶 Le scouting fluide.** Un bandeau d'avatars des 8 clubs (leurs barres de prestige déjà là) : tap = son vestiaire avec **liseré jaune** « tu visites », bouton retour fixe, navigation par swipe gauche/droite entre les clubs, disponible à tout moment (pendant le match et le Mercato d'hiver inclus).

Et un 6ᵉ pour la colonne gauche : **la bascule** synergies ⇄ staff/quêtes (façon hexagone TFT) au lieu de tout empiler.

## Règle générale retenue de TFT

Chaque information a UNE maison fixe (les joueurs à droite, la construction à gauche, l'économie en bas, le temps en haut), les panneaux se remplacent au lieu de s'empiler, et tout ce qui se tape s'ouvre. Aucune fenêtre ne bloque le terrain plus de quelques secondes.
