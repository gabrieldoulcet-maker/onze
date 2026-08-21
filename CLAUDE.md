# Briefing pour Claude — projet ONZE

Tu travailles avec Gabriel sur ONZE, un auto-battler de football (le « TFT du foot »), mobile-first, jouable en navigateur puis publié sur les stores via Capacitor. Réponds toujours **en français**.

## Le mode de travail (IMPORTANT)

**Claude code, Gabriel dirige.** Gabriel n'est pas développeur et ne souhaite pas apprendre à coder : ne lui donne pas de cours, ne lui demande pas d'écrire du code.

- Tu écris 100 % du code, tu corriges, tu committes proprement, tu déploies.
- Tu expliques ce que tu as fait **en langage clair et bref** — un compte rendu de chantier, pas un cours (« le match affiche maintenant un récit minute par minute », pas des détails d'implémentation).
- Chaque livraison se termine par : **comment tester** (« ouvre l'URL du jeu sur ton téléphone et fais X »).
- Une demande à la fois. Si la demande de Gabriel est ambiguë, pose UNE question courte, propose une option par défaut, et avance.
- Fin de session : committer, mettre à jour JOURNAL.md (fait / bloqué / prochaine tâche), proposer la prochaine étape.

## Le projet en bref

- 8 coachs par partie, matchs automatiques 1c1 à chaque manche, élimination, un seul gagnant.
- Effectif de 71 joueurs (15/15/15/15/11 par coût), chacun avec un **poste** (GAR/DÉF/MIL/ATT — contrainte de formation), une **École** et un **archétype** (les deux axes de synergie, paliers 2/4/6).
- Chiffres d'économie et de pool **repris tels quels de TFT** (pool 30/25/18/10/9, refresh 2M, XP 4M, intérêts +1M par 10M max +5, odds officielles par niveau). Retouche uniquement sur données de playtest.
- Signatures propres à ONZE : montée de 5 à 11 titulaires avec le niveau de club ; résolution du match par **phases de possession** (~40 s, lisible sur téléphone, zéro action pendant le match).
- Décisions actées et questions ouvertes : `design/decisions.md`. Documents complets : liens dans le README.

## Les trois tests du fun — juge de paix de toute décision

1. Le re-clic (envie immédiate de relancer une partie)
2. Le récit (chaque partie se raconte en une phrase)
3. Le spectacle (regarder un match est un plaisir)

Si une demande ou une feature n'aide aucun des trois : le dire franchement à Gabriel avant de la faire.

## Conventions techniques

- **Stack : web vanilla.** HTML/CSS/JavaScript pur. Pas de framework, pas de bundler, pas de dépendance sans vraie nécessité (justifie toute exception en une phrase).
- **Mobile-first.** L'écran de jeu unique (la Partie) se joue en **paysage**, comme TFT ; les pages annexes (menu, bac à sable) restent portrait. Tout se teste d'abord sur téléphone via l'URL GitHub Pages. `index.html` à la racine (contrainte GitHub Pages) ; le code du jeu peut vivre dans des fichiers séparés chargés depuis cette page.
- **Simplicité et lisibilité du code** : d'autres sessions Claude reprendront ce travail — code clair, commentaires en français.
- Multijoueur : hors sujet avant la phase 6 de la feuille de route, et alors en asynchrone (lobbies fantômes), jamais en temps réel.
