# ONZE — BRIEF DE PRODUCTION GRAPHIQUE · DIRECTION ARTISTIQUE COMPLÈTE

ONZE est un auto-battler de football sur mobile (paysage) : huit coachs recrutent des joueurs à un mercato partagé, construisent des synergies d'équipe, et les matchs se jouent automatiquement — l'esprit de Teamfight Tactics, l'univers du foot. Le jeu est terminé et jouable ; il joue actuellement dans une interface fonctionnelle sans direction artistique. Ta mission : lui donner son identité visuelle complète.

## 1 · LA DIRECTION ARTISTIQUE

Cartoon épique, et magnifique. L'énergie d'un dessin animé de foot légendaire — références : Mario Strikers, Captain Tsubasa, Clash Royale, et la générosité visuelle de TFT — exécutée avec un vrai niveau de finition : lumière travaillée, profondeur, matières riches. Jamais mignon-enfantin, jamais plat, jamais générique : épique. Chaque carte est un héros, chaque but une légende.

Le monde : un stade la nuit sous les projecteurs. Fond vert-nuit profond, gazon vert électrique, halos de lumière, or de trophée pour tout ce qui est précieux, couleurs saturées qui claquent sur le sombre. Formes rondes et généreuses, contours épais assumés, typographie display costaude et inclinée, pleine d'élan.

La mission au-dessus de tout : c'est la beauté qui doit rendre le jeu cool à jouer. Chaque carte donne envie d'être achetée, chaque état donne envie d'être atteint. Une capture d'écran du jeu doit faire demander « c'est quoi ce jeu ? ».

## 2 · LES LIVRABLES, PAR LOTS

### LOT 1 — L'IDENTITÉ (FONDATION)
- Logo ONZE (version épique « affiche de finale ») + déclinaisons : horizontal, compact, monochrome, icône seule.
- Palette finale documentée (fond, surfaces, accents, or) + les couleurs signifiantes imposées : postes (G jaune · D bleu · M vert · A rouge) et coûts (1 gris · 2 vert · 3 bleu · 4 violet · 5 or).
- Choix typographiques (display + texte + chiffres tabulaires — polices libres type Google Fonts).
- Icône d'app (le O-ballon d'ONZE), déclinée toutes tailles iOS/Android.

### LOT 2 — L'ALPHABET VISUEL (LE SYSTÈME)
- 23 écussons de familles (11 Écoles + 12 archétypes) : style unifié de collection de blasons, chaque silhouette unique et reconnaissable de 16 à 64 px, chacun en 3 états (mini sur carte · badge éteint · badge actif/illuminé).
- Pastilles de poste ×4, cadres/traitements de coût ×5, étoiles 1-2-3★, pictos monnaies (M€, Ferveur 🔥), les 3 raretés d'orbes de butin (gris/bleu/or), picto Relique et carte Staff.

### LOT 3 — LA CARTE JOUEUR (L'OBJET ROI)
- La carte de boutique (~150×95 px à taille réelle) : hiérarchie stricte — couleur de coût (cadre) → note en badge-écusson → nom incliné → pastille de poste → 2 stats signatures → écussons École + archétype → bouton prix (min 44 px).
- Tous ses états, en couches : normale ×5 coûts · pulsation ★★ (éclat vert) · explosion ★★★ (or) · épinglée (lueur bleue) · carte ICÔNE légendaire · trait Unique ✦ · grisée. Une couleur de lueur = un sens : vert = fusion, bleu = calepin, or = légendaire.
- La carte mini du banc, le pion de terrain et la fiche joueur (affiche de héros : nom énorme, note en médaille, 10 stats en barres).

### LOT 4 — L'INTERFACE COMPLÈTE
- L'écran de jeu maître (844×390) : terrain-star, banc 9 places, bandeau haut (manches + chrono), colonne gauche (synergies + ADN), colonne droite (prestige 8 clubs), barre basse boutique escamotable.
- Le système de panneaux (gabarit commun décliné) : fiche joueur · famille · Calepin · scouting · recap ⚔️ · Labo 🧪 · quêtes · historique 📜 · palmarès.
- Le vocabulaire d'interaction : boutons, cibles ≥ 44 px, drag & drop, toasts, bannières, bulles tuto.
- Les écrans satellites : accueil · fin victoire/défaite · Philosophie 🥈🥇💎 · Mercato d'hiver · orbes · « Tourne ton téléphone » · invite PWA.

### LOT 5 — LES MOMENTS (FX & CÉLÉBRATIONS)
- But (proportionnel à l'enjeu), fusion 2★ et 3★, palier de synergie, arrivée d'un Unique et d'une Icône, déblocage de quête. Livrés en états-clés (keyframes).

## 3 · LES CONTRAINTES TECHNIQUES (DURES)
- Tout implémentable en CSS/SVG : vectoriel, dégradés, ombres, lueurs — oui ; grosses images bitmap par carte — non (DOM/Canvas à 60 fps sur mobile).
- Lisibilité d'abord : les infos se lisent en un quart de seconde. Pas de texte sous 10 px réels.
- Les couleurs de familles et de coûts sont les seules couleurs signifiantes. L'or est réservé au légendaire (coût 5, Icônes, 3★).
- Fond sombre par défaut ; les états ne changent jamais la silhouette d'un composant.

## 4 · MATIÈRE, FORMATS ET MÉTHODE
- Matière : le jeu jouable (gabrieldoulcet-maker.github.io/onze), le doc « État du jeu », le doc de contenu des 71 joueurs (dessiner avec le vrai contenu, jamais de lorem ipsum).
- Livraison : sources vectorielles (SVG), plus une planche de tokens (couleurs, typos, rayons, ombres nommés). Maquettes écrans en 844×390.
- Méthode : Lot 1 → 2 → 3 en itérations serrées (carte validée à taille réelle sur téléphone) → Lots 4-5. La carte de boutique mérite 2-3 propositions divergentes.
- Test d'acceptation : à taille réelle sur téléphone — beau, lisible en ¼ s, donne envie de jouer. Les trois, sinon on itère.

---

## LIVRAISON (ce dossier)
- `Lot 1 - Identité.dc.html` — 2 pistes de logo (1a La Finale ✔ retenue · 1b L'Arcade), palette, typos (Passion One + Archivo), icône d'app, carte test 150×95.
- `Lot 2 - Alphabet visuel.dc.html` — 23 écussons ×3 états, pastilles, cadres de coût, étoiles, monnaies, orbes, Relique, Staff.
- `Lot 3 - La carte joueur.dc.html` — 3 propositions de carte (1a Le Blason ✔ retenue · 1b L'Affiche · 1c Le Maillot), tous les états, banc, pion, fiche héros.
- `Lot 4 - Interface.dc.html` — écran maître 844×390 (panneaux/boutique/chrono via Tweaks), vocabulaire d'interaction, satellites.
- `Lot 5 - Les moments.dc.html` — FX en états-clés chiffrés + règles de mise en scène.
- `Tokens - Planche d'implémentation.dc.html` — variables CSS nommées, la vérité unique.

Ouvrir chaque fichier `.dc.html` dans un navigateur.
