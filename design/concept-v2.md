# ONZE v2 — Le concept : du draft TFT au club de football

Verdict de Gabriel après playtests : « ce concept de TFT sur du foot, ce
n'est pas hyper fun ni adapté ». Diagnostic partagé : la fusion par
copies et la montée 5→11 sont des abstractions de jeu de plateau qui se
battent contre le fantasme du football. Le pivot : **on ne drafte plus
des cartes, on dirige un club.**

Le fantasme cible, en une phrase : *je prends un club de bras cassés et
j'en fais une équipe — transfert par transfert, minute par minute.*

---

## 1. LA BOUCLE (inchangée dans sa forme)

Mercato → Placement → Match, sur **le même nombre de manches
qu'aujourd'hui**, contre les 8 coachs fantômes, avec les dégâts de
prestige et la survie. Rien ne bouge dans la structure de la partie —
tout bouge dans ce qu'on y décide.

## 2. L'EFFECTIF : onze dès le coup d'envoi

- Chaque coach démarre avec **11 joueurs faibles** (notes ~40, tirés
  avec leurs familles). Plus de réservistes bouche-trous, plus de
  montée 5→11 : chaque match est un vrai match de football.
- Effectif plafonné à **~15** (11 + 4 remplaçants). **Chaque achat est
  un remplacement** : qui sort — vendu ou libéré ? C'est la décision
  d'entraîneur, plus profonde qu'« ajouter au banc ».
- Le placement choisit le onze ET la rotation (voir §7 — la rotation
  n'est pas cosmétique, elle nourrit la progression et pare la
  suffisance).

## 3. LA BOUTIQUE : le niveau ouvre le talent

- 5 offres de transfert par manche, Relancer et Verrouiller conservés.
- **La table d'odds par niveau existante est resservie telle quelle** :
  les tiers de coût 1–5 deviennent des tiers de qualité de joueur.
  « Plus on monte de niveau, plus on a accès à des joueurs forts » —
  c'est littéralement la mécanique actuelle, re-signifiée.
- Acheter de l'XP garde son sens : investir dans la structure du club
  pour accéder aux grands joueurs.

## 4. LA NOTE DE MATCH — la pièce maîtresse

Chaque joueur sort du match avec une **note** (échelle football, 3–10),
calculée depuis ce que le moteur trace déjà (`statsSaison` : buts,
passes décisives, arrêts, duels gagnés — plus le poste pour pondérer).

La note alimente TOUT le reste :
- la **progression** (§5) — jouer fait grandir ;
- la **valeur marchande** (§6) — briller fait monter la cote ;
- le récit — l'homme du match, les séries, le joueur en feu.

C'est le système à spécifier et simuler en premier : tout pend à lui.

## 5. LA FOURCHETTE DE TALENT, LES MINUTES ET LES COPAINS

Chaque joueur porte **deux nombres : sa note actuelle et son plafond**
(sa fourchette de talent, tirée à la génération). Un 45 plafonné à 72
est une pépite ; un 60 plafonné à 62 est un joueur fini. **La décision
d'achat devient double : le présent ou le potentiel.**

La progression vers le plafond est nourrie par deux choses :
1. **Les minutes** — un joueur qui joue progresse (pondéré par sa
   note : bien jouer accélère). Un joueur qui ne joue jamais stagne.
2. **Les copains** — les automatismes : jouer aux côtés de coéquipiers
   de sa famille (École ou archétype) accélère la progression, et les
   **duos nommés du lore existant** (Gus & Titi, Malandro & Didico,
   Billy & Jamie…) portent un lien fort explicite, affiché sur la
   fiche. « Plus il joue et plus il a des copains, meilleur il est. »

Les jeunes à grand plafond sont volontairement présents dès les
premiers niveaux de boutique : la pépite pas chère est LE pari du début
de partie.

## 6. LA VALEUR MARCHANDE ET LA REVENTE

- Chaque joueur a une **valeur** : base par tier, multipliée par sa
  forme (moyenne des notes récentes) et sa progression.
- **Vendre est toujours possible**, au prix courant. Le dilemme
  central du jeu : *ta pépite enchaîne les 8/10 — tu la gardes ou tu
  encaisses ?* Garder, c'est la force ; vendre, c'est financer deux
  recrues. C'est le remplaçant du frisson de la fusion 3★.
- **Contrepoids anti-boule de neige n°1 : la masse salariale.** Plus la
  valeur totale de l'effectif est haute, plus elle rogne les revenus de
  la manche. Un club de stars coûte cher. (Paramètre ouvert, à régler
  en simulation — voir §10.)

## 7. LA SUFFISANCE — le contrepoids narratif

**Après 4–5 victoires de suite, une équipe peut prendre de haut un
adversaire plus faible.** Anti-boule de neige n°2, et il est
football-vrai : c'est le match piège, le petit qui fait tomber le
leader.

Règles de lisibilité, non négociables (héritées de la décision 24 — le
moteur ne triche jamais en silence) :
- **Elle se voit AVANT** : un signal au placement (« ⚠ 4 victoires —
  ils prennent ce match de haut ») quand les conditions sont réunies
  (série de victoires + écart de niveau avec l'adversaire).
- **Elle se raconte PENDANT** : le commentaire la nomme (« ils jouent
  en marchant… »), les joueurs concernés ont une note dégradée.
- **Elle a un remède actionnable : la rotation.** Aligner des
  remplaçants et des jeunes contre le petit = pas de suffisance, ET des
  minutes pour les pépites (§5). Le triangle se referme : la suffisance
  pousse à faire tourner, la rotation fait grandir les jeunes.

## 8. CE QUI SURVIT TEL QUEL

Le moteur de match et la scène (arène, figurines, étape 4 en cours) ·
les traits — Écoles et archétypes — **avec leurs paliers de synergie**
(3 Tiki-Taka = bonus d'équipe : c'est ce qui oriente les achats au-delà
de « le plus fort dispo », et Gabriel le confirme comme cœur du fun) ·
l'économie de revenus (droits TV, intérêts, séries) · les 9 manches,
les 8 coachs, le prestige, les tirs au but · la refonte UI (cartes
carrées, trois tenues, pastilles de synergies) · les quêtes (celles
liées au staff se re-signifient) · le carnet.

**Deux re-significations gratuites** — mêmes mécanismes, habillage
football, zéro système en plus :
- **Les Philosophies deviennent les SPONSORS.** Même mécanique d'augment
  (trois choix, on en prend un, il oriente la partie), contenus
  re-signifiés : « l'équipementier paie par victoire », « le sponsor
  local double les revenus mais impose deux joueurs du cru », « le
  fonds avance 20M contre la masse salariale »…
- **Le butin devient le CENTRE DE FORMATION.** Le flux de récompenses
  des orbes se ré-habille : de temps en temps, un jeune à petit niveau
  et grande fourchette monte du centre, gratuitement. Il alimente
  directement la boucle pépite → rotation → minutes (§5, §7). Pas de
  bâtiment, pas de jauge : le flux existant, mieux nommé.

## 9. CE QUI MEURT

Le pool de copies (30/25/18/10/9) · la fusion et les étoiles 1–3★ (la
taille/aura des cartes se réaffecte : la **forme** remplace l'étoile
comme signal visuel) · la montée 5→11 · les réservistes bouche-trous ·
le carrousel du Mercato d'hiver sous sa forme « copies » (à re-signifier
plus tard en marché d'hiver de transferts) · **le staff-objets**
(composants → spécialisations posées sur un joueur).

Pourquoi le staff meurt : les objets de TFT sont l'investissement
durable d'un jeu où les unités sont jetables. Dans la v2, c'est le
JOUEUR qui est l'investissement durable — la fourchette de talent fait
déjà, en plus football, le travail que faisait le staff. Deux systèmes
pour le même rôle, on garde le plus football. S'il revient un jour, ce
sera du **staff de club** (entraîneur des jeunes, préparateur mental —
deux ou trois postes qui modifient les systèmes de la v2), après que le
cœur a prouvé qu'il tourne. La décision 11 du registre (« le cœur du
fun = draft + synergies + staff ») est révisée en : **construction +
synergies + progression**.

**La règle qui a tranché ces choix, à graver avec la décision 76 : sur
9 manches, un système n'a le droit d'exister que s'il produit une vraie
décision par manche — ou une décision mémorable par partie.** C'est ce
critère qui garde les sponsors (une décision mémorable), garde le centre
de formation (un flux existant re-signifié), et écarte l'infrastructure
FM à faire mûrir (niveaux de centre, jauges, réseaux de scouts) : sur
9 manches ça n'a pas le temps de payer, donc c'est du menu en plus.

Les Icônes et Uniques se re-signifient : un Unique reste un joueur à
trait spécial ; les duos deviennent des liens de copains forts (§5).

## 10. LES PARAMÈTRES OUVERTS — à trancher PAR SIMULATION, avant le code

L'outillage existe (`simulations/` : parties, difficulté, méta). On
simule des milliers de parties AVANT d'écrire le jeu, prédictions
enregistrées d'abord, comme toujours :

1. La formule de note (pondérations par poste) — distribution cible :
   médiane ~6, les 8+ rares.
2. La courbe de progression (minutes × note × copains) — un joueur
   moyen doit gagner ~10–15 points de note en une partie, une pépite
   bien gérée ~25.
3. La formule de valeur et la masse salariale — critères : la boule de
   neige est contenue (le 1er de la manche 5 gagne < 65 % des parties),
   un club moyen peut remonter, et vendre sa pépite est parfois
   optimal (sinon le dilemme est faux).
4. Le déclencheur et le poids de la suffisance — critère : le leader
   qui n'y répond pas perd ~1 match sur 3 contre un faible, celui qui
   fait tourner n'en perd presque aucun.
5. L'équilibre synergies vs talent brut : une équipe à synergies doit
   battre une équipe de mercenaires plus chers ~la moitié du temps.

## 11. LE PLAN DE TRAVAIL

1. **Validation de ce document par Gabriel** → consigné en décision 76.
2. **La simulation** (Claude Code, `simulations/v2.js`) : les cinq
   paramètres du §10, prédictions écrites avant, rapport chiffré.
3. **Implémentation en phases**, seulement après le rapport :
   effectif 11 + achat-remplacement → notes → valeur/revente →
   fourchette/copains/progression → suffisance → retrait de la fusion
   et du staff-objets → re-signification Sponsors et Centre de
   formation.
   Chaque phase avec ses recettes rouges d'abord, comme d'habitude.
4. **La conversation scène n'est pas concernée** : son étape 4 continue
   en parallèle. Seul ajout à terme : le commentaire de la suffisance
   et les notes affichées en fin de match.
