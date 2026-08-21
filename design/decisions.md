# Décisions de game design — ONZE

Registre des décisions actées. Une décision qui n'est pas ici n'existe pas.
(Les documents complets sont liés dans le README ; ce fichier est le résumé opposable.)

## Actées (août 2026)

1. **Squelette TFT assumé** : 8 coachs, boutique/mercato, synergies à paliers, économie, augments (Philosophies), carrousel (Mercato d'hiver), PvE (amicaux). On ne réinvente que là où le foot l'exige.
2. **Chiffres TFT repris tels quels** : pool 30/25/18/10/9 copies ; 71 joueurs en 15/15/15/15/11 ; refresh 2M ; XP 4M ; intérêts +1M/10M (max +5) ; odds de boutique officielles par niveau. Retouche uniquement sur données de playtest.
3. **Trois identités par joueur** : poste (GAR/DÉF/MIL/ATT, contrainte de formation, pas une synergie), École (origine), archétype (classe). ~~Paliers 2/4/6~~ → **v2 : échelles de paliers variées par famille** (11 Écoles, 12 archétypes, 12 traits Uniques, Capitaine unique sinon guerre des égos) — le détail dans `design/synergies.md`.
4. **Montée 5 → 11 titulaires** liée au niveau de club (onze complet au niveau 8 ; niveaux 9–10 = accès aux coûts 4–5).
5. **Match par phases de possession** : ~40 s, terrain en zones (3 lignes × 5 couloirs par moitié), duels zone par zone, tirs façon xG, dégâts de prestige = écart de buts. Zéro action pendant le match.
6. **Joueurs fictifs** (archétypes), pas de licences. Un seul unique : L'Enfant du Pays (Caméléon).
7. **Mode signature : Blitz ~10 min.** La saison classique (~20–25 min) vient après.
8. **F2P strictement cosmétique.** Pas de pay-to-win, pas de gacha compétitif.
9. **Multijoueur asynchrone d'abord** (lobbies fantômes) ; temps réel seulement si le jeu le mérite, bien plus tard.
10. **Les trois tests du fun** (re-clic, récit, spectacle) jugent toute décision.
11. **Le cœur du fun = draft + synergies + staff.** Le système de Staff (composants → spécialisations, façon objets TFT) est le troisième axe qui rend chaque partie unique — système complet dans `design/staff.md`, à intégrer en phase 4.
12. **Match animé en 2D stylisée en phase 3.** Le récit texte actuel est l'échafaudage ; la cible spectacle est une animation 2D lisible sur téléphone.
13. **Le fun principal d'ONZE est LA CONSTRUCTION de l'équipe, pas le match** — le match est la célébration de la construction. Conséquences : le mercato est l'écran prioritaire en polish et en feedback (badges qui s'allument, fusions 3★ mises en scène, arrivée des Uniques), le match reste court et accélérable (×2), et son récit doit nommer les synergies du joueur pour montrer sa compo briller.
14. **Économie de la vraie partie : on démarre pauvre**, comme dans TFT — c'est la montée progressive des revenus (droits TV + intérêts + séries) qui crée la courbe de tension. Le 30M de départ n'existe qu'en mode bac à sable (draft.html).
15. **Jouer sans gardien est permis** : la cage vide se paie en pluie de buts encaissés, mais c'est un choix de compo légitime.
16. **Économie = copie exacte de TFT** (`design/economie.md`) : départ 0M, manches 1-3 amicales PvE sans dégâts, droits TV 2/2/3/4 puis 5M, sponsors avant revenu de base, primes de série 3-4/5/6+, table XP officielle, onze complet au niveau 9.
17. **Le butin d'ouverture (amicaux) est une proposition d'orientation, l'équité porte sur la valeur totale** : composition aléatoire (or, joueur gratuit, carte Staff) qui peut lancer une École imprévue, valeur équivalente pour les 8 coachs, et chaque récompense s'ouvre comme un petit événement (l'orbe).
18. **Les 13 stats** (`design/stats.md`) : les boosts (Écoles, staff, philosophies) ciblent des **stats précises**, jamais un pourcentage global ; à coût/étoile égaux, deux joueurs ne sont **jamais interchangeables** (profils d'archétypes contrastés) ; **l'ADN du club** (6 axes en barres) est central au mercato ; hyper-spécialisation et équilibre doivent être **deux stratégies viables** (à vérifier en simulation — premier sondage : l'hyper-spé gagne, contre-mesure à trouver en playtest).
19. **Écran unique façon TFT mobile, joué en PAYSAGE** (comme TFT). Un seul écran persistant : le **terrain** (notre grille de zones, affichée comme un vrai terrain de foot) au centre, la **boutique en tiroir permanent** en bas, **classement/scouting en volet**. Le match se joue **sur ce terrain** — plus d'écran de match séparé — et pendant qu'il se joue, boutique, banc et scouting restent utilisables : les achats vont au banc, les changements de compo prennent effet à la manche suivante. Le récit devient un **journal compact** par-dessus le terrain. C'est l'architecture cible du match animé 2D : le terrain est la scène permanente du jeu.
20. **La durée d'un match est proportionnelle à ses enjeux.** Amicaux (manches 1-3) : 4 phases, ~13 s — l'essentiel de ces manches est le butin. Premières manches PvP (4-9) : 6 phases, ~25 s. Pleine durée (8 phases, ~40 s) à partir de la manche 10, quand les enjeux sont réels. Le bouton accélérer ×2 reste partout.
21. **Formation libre (1 gardien max), hors-poste autorisé avec malus progressifs** : ligne adjacente au poste −10 %, à deux lignes −25 %, joueur de champ dans les buts −50 % avec réflexes plancher (😱). Le poste affiché reste le poste naturel. **Football Total = l'École qui les ignore** : ses paliers réduisent puis annulent les malus hors-poste (c'est son identité principale) ; Ruud y est immunisé par son Unique.
22. **La pression du temps fait partie du fun de la construction** : ~35 s de préparation par manche (20 s pendant les amicaux), coup d'envoi automatique à zéro, ~30 s sur les écrans d'événement, urgence visuelle et sonore sur les 5 dernières secondes. Le « mode détente » (sans chrono) existe en option, désactivé par défaut — le chrono est l'expérience de référence, calibré pour qu'un joueur qui connaît le jeu ait juste assez de temps, jamais confortablement trop.

## Idées retenues pour plus tard (pas avant le polish de la boucle actuelle)

- **Masse salariale** (contrainte d'effectif au-delà de l'or).
- **Blessures / cartons** (aléas de match qui pèsent sur la manche suivante).
- **Valeur marchande** (cote des joueurs qui évolue, revente spéculative).

## À trancher (phase 1 — le jeu sur papier)

- Les règles chiffrées exactes de la résolution d'une phase de possession (stats des duels, modificateurs École/archétype, table xG).
- La durée/nombre de phases par match (6 à 10 ?), et les dégâts de prestige exacts par écart de buts.
- Les paliers précis de chaque École et archétype (valeurs des bonus 2/4/6).
