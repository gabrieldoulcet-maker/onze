/* ============================================================
   ONZE — LA SCÈNE DE MATCH, grammaire Football Manager.
   Manuel : design/scene-fm.md — la spec d'observation de Gabriel,
   qui FAIT FOI. Les repères « RN » semés dans ce fichier sont la
   nomenclature INTERNE du code (elle regroupe plusieurs règles
   observées par thème) : la table de correspondance avec les 13
   règles de la spec est dans design/decisions.md, décision 26.
   ------------------------------------------------------------
   Ce fichier MET EN SCÈNE la chaîne causale émise par le moteur
   (match-moteur.js). Le moteur décide qui, quoi et l'issue ; la
   scène ne décide QUE le mouvement — et le mouvement ne ment
   jamais sur les données (décision 24).

   Les partis pris, en clair :
   - R1  caméra FIXE, terrain entier, tribunes et projecteurs
         dans le cadre. Aucun zoom, jamais.
   - R2  « moments-clés » seulement : 2 à 4 temps forts rendus,
         séparés par des CUTS secs (carton minute + score). Il
         n'existe plus de régime « domination ».
   - R3  un temps fort = mise en place (~3 s, les 22 pions
         glissent) puis jeu continu, 4 à 8 temps, issue au dernier.
   - R4  football CONTINU : mini-simulation de mouvement (cibles
         poursuivies avec inertie), conduite de balle visible,
         passes qui VOYAGENT devant la course du receveur, blocs
         qui coulissent, mêlées permises dans la surface.
   - R5  le commentaire écrit la PROMESSE au futur, quantifie le
         danger, puis constate. Au repos : barre de possession.
   - R6  numéros par défaut, étiquettes sur les protagonistes,
         tous les noms au but.
   - R13 le décor vient de stade.js (thème séparé, skinnable).

   API (pilotée par match-ui.js) :
     ONZE_SCENE.construireAction(phase, eqA, eqB) → séquence
     ONZE_SCENE.reglages() / majReglages(patch)
     scene.cut(info, duree) · scene.miseEnPlace(seq, duree)
     scene.jouerTemps(temps, duree) · scene.repos()
     scene.majPossession({moi, eux}) · scene.fin()
     scene.diagnostic() · scene.detruire()
   ============================================================ */

const ONZE_SCENE = (() => {

  /* ============================================================
     1. LES FAMILLES (couleurs d'auras et de chips de synergie)
     ============================================================ */
  const COULEURS_FAMILLES = {
    "Tiki-Taka": "#3E9BE0", "Catenaccio": "#98A79D", "Kick & Rush": "#E8503F",
    "École de la Rue": "#F2C14E", "La Grinta": "#C54F5E", "Football Total": "#9CC4EF",
    "L'Académie": "#3DE26B", "Les Internationaux": "#A85CE8", "Le Douzième Homme": "#F0A055",
    "Les Pros": "#C0C8CC", "Les Revanchards": "#B5654F",
    "Mur": "#98A79D", "Moteur": "#3DE26B", "Sentinelle": "#3E9BE0", "Virtuose": "#A85CE8",
    "Finisseur": "#E8503F", "Créateur": "#9CC4EF", "Piston": "#F0A055", "Renard": "#F2C14E",
    "Chanceux": "#6BD4A6", "Guerrier": "#C54F5E", "Mentor": "#C0C8CC", "Capitaine": "#F2C14E",
  };
  const couleurFamille = (nom) => COULEURS_FAMILLES[nom] || "#F2C14E";

  /* L'École dominante d'une équipe → son style de MOUVEMENT (R11/R12).
     C'est le test de l'ADN : 3 matchs suffisent à le deviner. */
  const STYLES_ECOLES = {
    "Tiki-Taka": "tiki", "Kick & Rush": "kickrush", "École de la Rue": "rue",
    "Catenaccio": "catenaccio", "Football Total": "total", "La Grinta": "grinta",
  };
  function styleDe(equipe) {
    let ecole = null, meilleurS = 0;
    for (const sy of equipe.synergies || []) {
      if (sy.type === "ecole" && sy.s > meilleurS) { meilleurS = sy.s; ecole = sy.nom; }
    }
    if (!ecole) {
      const comptes = {};
      for (const j of equipe.joueurs) if (j.ecole) comptes[j.ecole] = (comptes[j.ecole] || 0) + 1;
      ecole = Object.entries(comptes).sort((a, b) => b[1] - a[1]).map(([n]) => n)[0] || null;
    }
    const pistons = equipe.joueurs.filter((j) => j.archetype === "Piston").length;
    return { ecole, style: STYLES_ECOLES[ecole] || "defaut", couloirs: pistons >= 2 };
  }

  /* ============================================================
     2. LES RÉGLAGES DE MATCH (R10 — calqués sur l'écran
     « Paramètres matchs » de FM26 Mobile).
     Persistés en localStorage, lus par la scène ET par match-ui.
     ============================================================ */
  const CLE_REGLAGES = "onze-reglages-match";
  const REGLAGES_DEFAUT = {
    vue: "terrain",       // terrain | bandeau  (« Vue » de FM)
    filtre: "moments",    // moments | resume   (« Temps forts » de FM)
    vitesseFort: 1,       // 0.7 (plus lent) … 1.6 (plus vite)
    vitesseMort: 1,       // idem, pour les temps morts (cuts)
    replay: true,         // « Revoir les buts »
    etiquettes: true,     // les noms sur les protagonistes
    trainee: true,        // « Ballon animé » : la traînée
    tempsMorts: "scores", // « Affichage des temps morts » : scores | stats | les-deux
    stade: "emeraude",    // le thème de stade (R13) — un décor PEINT par défaut :
                          // un joueur neuf voit le Grand Soir sans rien régler
  };
  let _reglages = null;
  function reglages() {
    if (_reglages) return _reglages;
    _reglages = { ...REGLAGES_DEFAUT };
    try {
      const brut = localStorage.getItem(CLE_REGLAGES);
      if (brut) Object.assign(_reglages, JSON.parse(brut));
      // migration de l'ancien réglage isolé du replay
      if (localStorage.getItem("onze-replay") === "off") _reglages.replay = false;
    } catch (e) { /* stockage indisponible : les défauts suffisent */ }
    return _reglages;
  }
  function majReglages(patch) {
    const r = reglages();
    Object.assign(r, patch);
    try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(r)); } catch (e) { /* ignoré */ }
    return r;
  }

  /* ============================================================
     LE TERRAIN, EN MÈTRES (design/football-chiffre.md §1).
     Densité constante du football réel : 324 m² par joueur, comptés
     sur le TOTAL des deux équipes, en gardant le rapport
     longueur/largeur du football (1,53). Au-delà de 22 joueurs on ne
     dépasse pas le rectangle peint.
     Tout le reste de la scène calcule en MÈTRES — jamais en pourcents,
     jamais en pixels. C'est ce qui rend les chiffres du football
     directement utilisables, et le mouvement identique à toute taille
     d'écran et à tout effectif.
     ============================================================ */
  const M2_PAR_JOUEUR = 324;
  const RAPPORT_TERRAIN = 1.53;
  function dimensionsTerrain(nbJoueurs) {
    const n = Math.max(2, nbJoueurs || 22);
    if (n >= 22) return { L: 104, W: 68 };
    const surface = n * M2_PAR_JOUEUR;
    const W = Math.sqrt(surface / RAPPORT_TERRAIN);
    return { L: Math.round(W * RAPPORT_TERRAIN), W: Math.round(W) };
  }

  const ligneDuJoueur = (j) => j.ligne || j.poste;
  const lerp = (a, b, t) => a + (b - a) * t;
  /* Borne NaN-safe : dans une couche de rendu, un seul NaN se propage à
     tout et fige la scène. On le stoppe à la source (le milieu de la
     plage), et la recette vérifie qu'aucune position n'est non finie —
     une vraie régression se voit donc en test, pas à l'écran. */
  const borne = (v, min, max) => (isFinite(v) ? Math.max(min, Math.min(max, v)) : (min + max) / 2);

  /* ============================================================
     3. LE DÉCOUPAGE D'UNE ACTION — fonction PURE et testable.
     À partir des événements RÉELS d'une phase, construit la
     séquence de temps du temps fort : situation de départ →
     construction (l'expression du style) → percée (le vrai
     perceur, le vrai battu) → frappe → issue (cachée jusque-là).
     Chaque temps porte sa PROMESSE (texte au futur, R5) ; le
     texte du moteur ne sert que de CONSTAT sur le temps d'issue.
     ============================================================ */
  function construireAction(phase, eqA, eqB) {
    const evts = phase.evenements;
    const temps = [];
    const evPossession = evts.find((e) => e.type === "possession");
    const evPercee = evts.find((e) => e.type === "percee");
    const evGeste = evts.find((e) => e.type === "geste");
    const evContre = evts.find((e) => e.type === "contre");
    const evLong = evts.find((e) => e.type === "ballon_long" || e.type === "lambretta");
    const evFinal = evts.find((e) => e.but || e.type === "arret" || e.type === "blocage");
    const evStop = evts.find((e) => e.type === "percee_stoppee" || e.type === "interception");
    const evHorsJeu = evts.find((e) => e.type === "hors_jeu");
    const evRebonds = evts.filter((e) => e.type === "rebond");
    const equipeAttaque = evFinal ? (evFinal.but ? evFinal.equipe : (eqA.nom === evFinal.equipe ? eqB.nom : eqA.nom))
      : evPercee ? evPercee.equipe : evContre ? evContre.equipe : evPossession ? evPossession.equipe : eqA.nom;
    const equipe = eqA.nom === equipeAttaque ? eqA : eqB;
    const style = styleDe(equipe).style;

    // --- la situation de départ : ce que la mise en place doit poser ---
    const situation = evContre ? "contre"
      : evPercee && evPercee.sousType === "centre" ? "aile"
      : evPercee && evPercee.sousType === "aerien" ? "aerien"
      : evLong ? "long"
      : "placee";

    // 1. la récupération — l'action commence à sa naissance, jamais au tir
    if (evPossession) temps.push({
      type: "recuperation", ev: evPossession, acteur: evPossession.acteurs[0], equipe: equipeAttaque,
      promesse: `${evPossession.acteurs[0]} va essayer d'en prendre possession…`,
    });
    if (evContre) temps.push({
      type: "contre", ev: evContre, acteur: (evContre.acteurs || [])[0], equipe: evContre.equipe,
      promesse: `Contre éclair — ${evContre.equipe} part à toute vitesse !`,
    });

    // 2. la construction : l'ADN de l'École se lit ICI
    const porteur = evPossession && evPossession.acteurs[0];
    const finisseur = evFinal && (evFinal.buteur || (evFinal.acteurs && evFinal.acteurs[0]));
    const perceur = evPercee && evPercee.acteurs[0];
    const passeur = evFinal && evFinal.passeur;
    const relaisPossibles = equipe.joueurs
      .filter((j) => ligneDuJoueur(j) !== "GAR")
      .map((j) => j.nom)
      .filter((n) => n !== porteur && n !== finisseur && n !== perceur);
    if (evLong) {
      temps.push({ type: "relais_long", ev: evLong, de: porteur, vers: perceur || finisseur || relaisPossibles[0],
        equipe: equipeAttaque, promesse: `Le ballon part loin devant — ça peut trouver ${perceur || finisseur || "un homme"} !` });
    } else if (style === "tiki" && relaisPossibles.length >= 1) {
      temps.push({ type: "relais", de: porteur, vers: relaisPossibles[0], equipe: equipeAttaque,
        promesse: `Ça circule court — ${relaisPossibles[0]} cherche l'intervalle…` });
      if (relaisPossibles.length >= 2 && evts.length <= 3)
        temps.push({ type: "relais", de: relaisPossibles[0], vers: passeur || relaisPossibles[1], equipe: equipeAttaque,
          promesse: `Une passe de plus… la défense recule.` });
    } else if (style === "kickrush") {
      temps.push({ type: "relais_long", de: porteur, vers: perceur || finisseur || relaisPossibles[0], equipe: equipeAttaque,
        promesse: `Ballon balancé dans le dos de la défense !` });
    } else if (style === "rue") {
      temps.push({ type: "conduite", acteur: porteur || perceur, equipe: equipeAttaque,
        promesse: `${porteur || perceur} part balle au pied — il va tenter quelque chose…` });
    } else if (relaisPossibles.length) {
      temps.push({ type: "relais", de: porteur, vers: passeur || relaisPossibles[0], equipe: equipeAttaque,
        promesse: `${passeur || relaisPossibles[0]} se propose dans l'axe…` });
    }
    if (evGeste) temps.push({ type: "geste", ev: evGeste, acteur: evGeste.acteurs[0], equipe: evGeste.equipe,
      promesse: `${evGeste.acteurs[0]} est bloqué… il tente le geste !` });

    // 3. la percée : la chaîne causale du moteur, telle quelle
    if (evPercee) temps.push({
      type: "percee", ev: evPercee, sousType: evPercee.sousType,
      acteur: evPercee.acteurs[0], battu: evPercee.acteurs[1], equipe: evPercee.equipe,
      promesse: evPercee.sousType === "course" ? `${evPercee.acteurs[0]} lance le sprint dans le couloir…`
        : evPercee.sousType === "dribble" ? `${evPercee.acteurs[0]} attaque ${evPercee.acteurs[1] || "son défenseur"} en un-contre-un…`
        : evPercee.sousType === "aerien" ? `Le ballon monte — ${evPercee.acteurs[0]} va au duel aérien…`
        : `Le centre arrive dans la surface…`,
    });
    if (evStop) temps.push({ type: "stop", ev: evStop, acteur: evStop.acteurs[0], equipe: evStop.equipe,
      promesse: `${evStop.acteurs[0]} vient à la rencontre…` });
    if (evHorsJeu) temps.push({ type: "hors_jeu", ev: evHorsJeu, equipe: evHorsJeu.equipe,
      promesse: `L'appel est lancé… mais la ligne défensive est montée !` });

    // 4-5. la frappe (temps DÉCISIF) puis les issues. Même chorégraphie
    // pour un but, un arrêt ou un poteau : le suspense est la règle (R7).
    const finitions = evts.filter((e) => e.but || e.type === "arret" || e.type === "blocage");
    if (finitions.length) {
      temps.push({ type: "frappe", decisif: true, tireur: finisseur, passeur, equipe: equipeAttaque,
        promesse: `${finisseur} arme sa frappe…` });
      finitions.forEach((f, i) => {
        if (i > 0) {
          const rb = evRebonds[i - 1];
          temps.push({ type: "rebond", ev: rb || null,
            acteur: rb ? rb.acteurs[0] : (f.buteur || (f.acteurs && f.acteurs[0])), equipe: rb ? rb.equipe : f.equipe,
            promesse: `Le ballon traîne dans la surface…` });
        }
        temps.push({
          type: f.but ? "issue_but" : f.type === "arret" ? "issue_arret" : "issue_blocage",
          ev: f, tireur: f.buteur || (f.acteurs && f.acteurs[0]),
          gardien: f.acteurs && f.acteurs[1], equipe: f.equipe, pres: !!f.pres, issue: true,
        });
      });
    }

    // bornage 4-8 temps (R3) : on coupe les relais du milieu, JAMAIS une issue
    while (temps.length > 8) {
      const idx = temps.findIndex((t) => t.type === "relais" || t.type === "conduite");
      if (idx === -1) break;
      temps.splice(idx, 1);
    }
    temps.situation = situation;
    temps.equipe = equipeAttaque;
    temps.style = style;
    return temps;
  }

  /* ============================================================
     4. LA SCÈNE — mini-simulation continue de mouvement (R4).
     ============================================================ */
  function creer(conteneur, eqA, eqB, options = {}) {
    const reg = reglages();
    const racine = document.createElement("div");
    racine.className = "scene-match";
    const canvas = document.createElement("canvas");
    canvas.className = "toile-match";
    racine.appendChild(canvas);
    const couche = document.createElement("div");   // les superpositions DOM
    couche.className = "couche-scene";
    racine.appendChild(couche);
    // la bande de commentaire (R5) : une seule ligne, en bas
    const bande = document.createElement("div");
    bande.className = "bande-commentaire";
    bande.innerHTML = `<span class="texte-commentaire"></span>`;
    racine.appendChild(bande);
    const texteCommentaire = bande.querySelector(".texte-commentaire");
    /* RÈGLE 12 de design/scene-fm.md : LA TIMELINE DES TEMPS FORTS —
       une rangée de points en haut,
       un par temps fort rendu du match, le courant en surbrillance.
       C'est le fil du match d'un coup d'œil : combien de moments, où on
       en est. Placée à droite du tableau de score, comme chez FM. */
    const timeline = document.createElement("div");
    timeline.className = "timeline-tf";
    racine.appendChild(timeline);
    // la barre de possession, qui prend la place du commentaire au repos
    const barrePossession = document.createElement("div");
    barrePossession.className = "barre-possession";
    barrePossession.innerHTML =
      `<span class="pc pc-moi">50 %</span><div class="rail"><div class="part-moi"></div></div><span class="pc pc-eux">50 %</span>`;
    racine.appendChild(barrePossession);
    conteneur.appendChild(racine);
    const ctx = canvas.getContext("2d");

    const theme = ONZE_STADE.theme(reg.stade);
    const styles = { moi: styleDe(eqA), eux: styleDe(eqB) };

    /* ---- Les positions de base d'une formation ----
       En pourcentage de terrain, camp « moi » à gauche. Le style de
       l'École déforme le bloc : Catenaccio recule, Kick & Rush pousse
       son pivot, La Grinta monte d'un cran (R11/R12). */
    /* Le terrain de CE match, en mètres : la densité de 324 m² par
       joueur commande ses dimensions (décision 50). */
    const TERRAIN = dimensionsTerrain(eqA.joueurs.length + eqB.joueurs.length);
    const DEMI_L = TERRAIN.L / 2, DEMI_W = TERRAIN.W / 2;
    /* Le repère du football réel : origine au CENTRE, x vers le but de
       « eux » (positif), y latéral. C'est le repère des données de
       design/football-chiffre.md, donc leurs chiffres s'appliquent sans
       conversion. */
    const BUTS = { moi: { x: -DEMI_L, y: 0 }, eux: { x: DEMI_L, y: 0 } };
    /* L'encombrement d'un pion, EN MÈTRES : c'est ce rayon qui sert à
       l'espacement (R4) comme au dessin. 2,7 % de la largeur du terrain
       → ~1,8 m de rayon, soit un diamètre de ~5 % de la hauteur affichée,
       l'échelle FM (décision 33). Un seul chiffre, deux usages : le pion
       dessiné et le pion qui pousse son voisin ne peuvent plus diverger. */
    const RAYON_PION_M = TERRAIN.W * 0.027;
    const sensDe = (camp) => (camp === "moi" ? 1 : -1);   // vers quel but on attaque
    /* Les lignes d'une formation, en fraction de la demi-longueur
       depuis son propre but. La dernière ligne à 0,35 donne les 18 m du
       football réel sur un terrain complet. */
    const FRACTION_LIGNE = { "GAR": 0.05, "DÉF": 0.35, "MIL": 0.62, "ATT": 0.85 };
    const xLigne = (camp, ligne) => {
      let f = FRACTION_LIGNE[ligne] !== undefined ? FRACTION_LIGNE[ligne] : 0.62;
      const st = styles[camp];
      if (st.style === "catenaccio" && ligne !== "GAR") f -= 0.12;
      if (st.style === "kickrush" && ligne === "ATT") f += 0.10;
      if (st.style === "grinta" && ligne !== "GAR") f += 0.06;
      if (st.style === "tiki" && ligne === "MIL") f += 0.04;
      const depuisSonBut = f * DEMI_L;
      return camp === "moi" ? -DEMI_L + depuisSonBut : DEMI_L - depuisSonBut;
    };
    /* Un joueur de champ ne va JAMAIS au fond du terrain : sans cette
       borne, une percée « course » finit le tireur sur le poteau de
       corner et la frappe n'a plus de sens. */
    const dansLeJeu = (x) => borne(x, -DEMI_L + 8, DEMI_L - 8);
    const dansLaLargeur = (y) => borne(y, -DEMI_W + 1.5, DEMI_W - 1.5);

    const pions = {};
    const listePions = [];
    const poserEquipe = (equipe, camp) => {
      const parLigne = {};
      for (const j of equipe.joueurs) (parLigne[ligneDuJoueur(j)] = parLigne[ligneDuJoueur(j)] || []).push(j);
      let numero = 1;
      for (const ligne of ["GAR", "DÉF", "MIL", "ATT"]) {
        for (let i = 0; i < (parLigne[ligne] || []).length; i++) {
          const j = parLigne[ligne][i];
          const n = parLigne[ligne].length;
          const st = styles[camp];
          // étalés sur 68 % de la largeur ; les Pistons collent aux couloirs
          let y = n === 1 ? 0 : (-0.34 + (0.68 * i) / (n - 1)) * TERRAIN.W;
          if (st.couloirs && n >= 2 && (i === 0 || i === n - 1)) y = (i === 0 ? -0.40 : 0.40) * TERRAIN.W;
          const stats = j.stats || {};
          // R12 : la VITESSE de la fiche pilote la vitesse VISIBLE du pion
          const vit = stats.vitesse || 50;
          const p = {
            nom: j.nom, num: numero++, camp, gardien: ligneDuJoueur(j) === "GAR", ligne: ligneDuJoueur(j),
            etoiles: j.etoiles || 1, icone: !!j.icone, unique: !!j.unique,
            ecole: j.ecole, archetype: j.archetype,
            baseX: xLigne(camp, ligne), baseY: y,
            x: xLigne(camp, ligne), y, vx: 0, vy: 0,
            cx: null, cy: null,           // cible imposée par un temps (sinon ambiante)
            /* LES CHIFFRES DU FOOTBALL RÉEL (design/football-chiffre.md
               §3 du plan) : pointe de 6,5 m/s pour un lent à 9,5 pour un
               rapide, accélération 3,5 m/s², décélération 5 m/s². Un
               joueur ne démarre ni ne s'arrête d'un coup — c'est
               l'inertie qui sépare un footballeur d'un curseur. */
            vMax: 6.5 + (vit / 100) * 3,   // m/s de pointe
            accel: 3.5,                     // m/s²
            decel: 5,                       // m/s²
            braquage: Math.PI,              // rad/s à pleine vitesse (180°/s)
            role: null, etiquette: false, aura: 0, auraCouleur: null, flash: 0,
            echelle: 1, phase: Math.random() * 6.28, plonge: 0,
          };
          /* Une clé DOIT désigner un seul pion. « camp|nom » ne suffit
             pas : un club peut aligner deux copies non fusionnées du
             même joueur (le pool en contient plusieurs). Le second
             reçoit donc un suffixe, et c'est le PREMIER que la
             résolution par nom renvoie — le moteur, lui, ne connaît que
             les noms, on ne peut pas être plus fin que lui. */
          let cle = camp + "|" + j.nom;
          for (let n = 2; pions[cle]; n++) cle = camp + "|" + j.nom + "#" + n;
          p.cle = cle;
          pions[cle] = p;
          listePions.push(p);
        }
      }
    };
    poserEquipe(eqA, "moi");
    poserEquipe(eqB, "eux");

    /* ---- LE BALLON : un objet physique (R4) ----
       Il n'est JAMAIS téléporté. Trois états :
       - conduit  : collé au porteur, posé DEVANT lui (la conduite se voit)
       - en vol   : trajet à durée réelle, avec cloche et ombre au sol
       - libre    : il roule et ralentit (ballon qui traîne dans la surface) */
    const ballon = {
      x: 0, y: 0, z: 0, vx: 0, vy: 0,
      porteur: null,   // nom du pion qui conduit
      vol: null,       // { x0,y0,x1,y1, t, duree, hauteur, versNom, apres }
      trainee: [],
    };
    const campDe = (nomEquipe) => (nomEquipe === eqA.nom ? "moi" : "eux");
    const adverse = (camp) => (camp === "moi" ? "eux" : "moi");
    /* FIDÉLITÉ (décision 24) : le pool contient plusieurs copies de chaque
       joueur, donc DEUX CLUBS peuvent aligner un « Esteban » chacun. Un
       pion s'identifie donc par CAMP + NOM, jamais par le nom seul —
       sinon la scène met l'anneau du porteur sur les deux, et peut
       montrer le mauvais homme en train de faire l'action du moteur.
       `camp` omis = on cherche dans les deux (cas où le moteur ne dit
       pas de quel côté vient l'acteur). */
    const pionDe = (nom, camp) => {
      if (!nom) return null;
      if (camp) return pions[camp + "|" + nom] || null;
      return pions["moi|" + nom] || pions["eux|" + nom] || null;
    };
    const gardienDe = (camp) => listePions.find((p) => p.camp === camp && p.gardien) || null;

    /* ============================================================
       RÈGLE 11 — LES PERSONNAGES DU DÉCOR.
       L'arbitre (disque noir « A ») suit le jeu près du ballon, les
       assistants tiennent leur touche à la hauteur de l'avant-dernier
       défenseur (la ligne de hors-jeu, comme dans la vraie vie).
       Ils ne sont PAS des joueurs : hors de `listePions`, donc hors du
       cerveau de placement, hors de la répulsion, hors des recettes de
       rôles. Ce sont des figurants, et ils se comportent comme tels —
       ils ne gênent jamais la lecture du jeu.
       ============================================================ */
    const arbitre = { x: 0, y: 6, vx: 0, vy: 0, vMax: 7, accel: 3.5 };
    const assistants = [
      { x: 0, y: 0, vx: 0, vy: 0, vMax: 8, accel: 4, cote: "haut" },
      { x: 0, y: 0, vx: 0, vy: 0, vMax: 8, accel: 4, cote: "bas" },
    ];
    /* L'arbitre se tient EN DIAGONALE du ballon, jamais dessus : il suit
       à distance, du côté où il ne coupe pas la ligne de jeu. */
    function cibleArbitre() {
      const cote = ballon.y > 0 ? -1 : 1;       // il se décale côté opposé
      return { x: dansLeJeu(ballon.x - 5), y: borne(ballon.y + cote * 8, -DEMI_W + 4, DEMI_W - 4) };
    }
    /* Un assistant tient sa touche et se cale sur la ligne de hors-jeu
       de la moitié qu'il couvre : l'avant-dernier défenseur. */
    function cibleAssistant(a) {
      const camp = ballon.x < 0 ? "moi" : "eux";
      const arriere = listePions
        .filter((p) => p.camp === camp && !p.gardien)
        .sort((q, w) => Math.abs(q.x - BUTS[camp].x) - Math.abs(w.x - BUTS[camp].x));
      const ligne = arriere.length >= 2 ? arriere[1].x : ballon.x;
      return { x: borne(lerp(ligne, ballon.x, 0.25), -DEMI_L + 2, DEMI_L - 2), y: a.y };
    }
    function majFigurants(dt, dtBrut) {
      const bouger = (f, cible) => {
        const dx = cible.x - f.x, dy = cible.y - f.y;
        const d = Math.hypot(dx, dy);
        const v = Math.min(f.vMax, d * 3.4);
        const vx = d > 0.02 ? (dx / d) * v : 0, vy = d > 0.02 ? (dy / d) * v : 0;
        const ax = vx - f.vx, ay = vy - f.vy;
        const norme = Math.hypot(ax, ay);
        const budget = f.accel * dtBrut;
        const k = norme > budget ? budget / norme : 1;
        f.vx += ax * k; f.vy += ay * k;
        f.x = borne(f.x + f.vx * dt, -DEMI_L, DEMI_L);
        f.y = borne(f.y + f.vy * dt, -DEMI_W - 1, DEMI_W + 1);
      };
      bouger(arbitre, cibleArbitre());
      for (const a of assistants) bouger(a, cibleAssistant(a));
    }
    function dessinerFigurants() {
      const r = rayonPion() * 0.82;            // un peu plus petits qu'un joueur
      ctx.save();
      // les assistants : un trait sur la touche, discret
      for (const a of assistants) {
        const Xa = X(a.x), Ya = Y(a.y);
        ctx.beginPath();
        ctx.ellipse(Xa, Ya, r * 0.72, r * 0.5, 0, 0, 6.283);
        ctx.fillStyle = "rgba(18,22,20,0.9)"; ctx.fill();
        ctx.lineWidth = Math.max(r * 0.2, 0.6);
        ctx.strokeStyle = "rgba(242,193,78,0.75)"; ctx.stroke();   // le drapeau
      }
      // l'arbitre : disque noir marqué « A »
      const Xa = X(arbitre.x), Ya = Y(arbitre.y);
      ctx.beginPath();
      ctx.ellipse(Xa + r * 0.16, Ya + r * 0.55, r * 0.9, r * 0.36, 0, 0, 6.283);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
      ctx.beginPath(); ctx.arc(Xa, Ya, r, 0, 6.283);
      ctx.fillStyle = "#14181A"; ctx.fill();
      ctx.lineWidth = Math.max(r * 0.16, 0.6);
      ctx.strokeStyle = "rgba(253,248,234,0.5)"; ctx.stroke();
      if (r >= 4) {
        ctx.fillStyle = "rgba(253,248,234,0.9)";
        ctx.font = `800 ${(r * 1.05).toFixed(1)}px Archivo, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("A", Xa, Ya + 0.3);
      }
      ctx.restore();
    }

    /* ---- État de la scène ---- */
    let regime = "repos";       // repos | miseEnPlace | action | ralenti | cut | replay
    let possession = null;      // le camp qui a le ballon : les blocs coulissent
    let facteurTemps = 1;       // le micro-ralenti (R8 : 0,5 s sur les frappes de but)
    let detruit = false, finDeMatch = false;
    const jauge = { affichee: 0, cible: 0, pulse: false };
    const minute = { affichee: 0, cible: 0, duree: 1, depart: 0, t0: 0 };
    const possessionPct = { moi: 50, eux: 50, afficheMoi: 50 };
    const tremblements = { moi: 0, eux: 0 };
    let situationCourante = "placee";
    /* La scène garde la chorégraphie du temps fort EN ENTIER : c'est ce
       qui permet au receveur du temps suivant de commencer sa course
       avant que la passe parte (décision 33, la règle reine). */
    let sequenceCourante = null;
    let indexCourant = -1;
    const butsMarques = { moi: 0, eux: 0 };
    let cartonCut = null;

    /* ---- Le replay de but : un tampon des ~3 s précédentes ---- */
    const tampon = [];
    let replay = null;

    /* ============================================================
       4.1 LES COMPORTEMENTS AMBIANTS — ce qui fait « vrai match »
       même quand aucun temps n'est joué (R4).
       ============================================================ */

    /* ============================================================
       LE CERVEAU DE PLACEMENT (design/scene-intention.md, décision 33).
       À chaque tick, chacun des 22 pions reçoit une CIBLE et une RAISON
       nommée. On doit pouvoir mettre pause, pointer n'importe quel pion
       et expliquer sa position avec un mot de football.
       Interdit absolu : plus AUCUNE position ne dépend d'une fonction
       périodique du temps. Le mouvement permanent émerge des
       micro-décisions — le marquage qui se réajuste, l'angle de passe
       qui se rouvre, la ligne qui respire.
       Les rôles, par PRIORITÉ (le premier qui s'applique gagne) :
       scénario > gardien > porteur > appel > soutien > pressing >
       marquage > ligne > équilibre.
       ============================================================ */

    /* --- Outils de géométrie de terrain --- */
    // en mètres, x et y ont la même échelle : plus de facteur correctif
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    /* La distance d'un pion au segment de passe : c'est elle qui dit si
       une ligne de passe est ouverte ou fermée. */
    function distanceAuSegment(q, a, b) {
      const vx = b.x - a.x, vy = b.y - a.y;
      const wx = q.x - a.x, wy = q.y - a.y;
      const l2 = vx * vx + vy * vy;
      const t = l2 ? borne((wx * vx + wy * vy) / l2, 0, 1) : 0;
      return Math.hypot(wx - vx * t, wy - vy * t);
    }
    /* Une ligne de passe est OUVERTE si aucun adversaire ne la coupe. */
    function ligneOuverte(de, vers, camp) {
      for (const q of listePions) {
        if (q.camp === camp || q.gardien) continue;
        if (distanceAuSegment(q, de, vers) < 2) return false;   // 2 m : la ligne est coupée
      }
      return true;
    }
    /* La hauteur de la ligne défensive d'un camp : elle SUIT le ballon —
       basse quand il approche, remontée quand il s'éloigne. Les
       défenseurs la partagent, ils montent et descendent ensemble. */
    function hauteurLigne(camp) {
      const sens = sensDe(camp);
      const but = BUTS[camp].x;
      const ecart = Math.abs(refBloc.x - but);
      // mesures réelles : dernière ligne à 17,7 m du but en médiane,
      // p10 0,3 m (bloc écrasé) et p90 39,5 m (bloc haut)
      const bas = styles[camp].style === "catenaccio" ? 4 : 7;
      const haut = styles[camp].style === "grinta" ? 44 : 38;
      return but + sens * borne(ecart * 0.35, bas, haut);
    }

    /* ============================================================
       LA RÉFÉRENCE DU BLOC — un bloc ne se téléporte pas.
       Un ballon frappé file à 27 m/s ; une équipe coulisse à quelques
       mètres par seconde. Faire suivre la FORME au ballon lui-même
       donnait aux 22 pions une cible plus rapide qu'eux : ils
       couraient à fond en permanence sans jamais arriver. La forme
       suit donc une référence RETARDÉE, bornée à 4,5 m/s.
       Ce n'est pas un lissage cosmétique : c'est ce que fait un vrai
       bloc, et c'est un ÉTAT, pas une fonction du temps.
       ============================================================ */
    const VITESSE_BLOC = 4.5;                    // m/s
    const refBloc = { x: 0, y: 0 };
    function majReferenceBloc(dtBrut) {
      const dx = ballon.x - refBloc.x, dy = ballon.y - refBloc.y;
      const d = Math.hypot(dx, dy);
      const pas = VITESSE_BLOC * dtBrut;
      if (!isFinite(d)) return;                      // ballon hors du réel : on ne bouge pas
      if (!(d > pas) || d < 1e-6) { refBloc.x = ballon.x; refBloc.y = ballon.y; return; }
      refBloc.x += (dx / d) * pas; refBloc.y += (dy / d) * pas;
    }

    /* UNE CIBLE EST UN POINT, PAS UNE DIRECTION.
       « Trois mètres devant moi », recalculé à chaque frame, est une
       carotte au bout d'un bâton : le pion ne l'atteint jamais, l'arrivée
       douce ne s'enclenche jamais, et il court à fond du début à la fin.
       On ANCRE donc le point une fois pour toutes ; on n'en donne un
       nouveau qu'une fois celui-là ATTEINT (ou le rôle changé). C'est ce
       qui produit le rythme d'arrêts et de relances du vrai football —
       un porteur qui avance de 1,75 m en 1 s, un appel de 10,7 m en
       2,1 s (design/football-chiffre.md §2 et §4). */
    function ancrer(p, cle, calcul, arrive) {
      const a = p.ancre;
      if (!a || a.cle !== cle || Math.hypot(a.x - p.x, a.y - p.y) < arrive) {
        const c = calcul();
        p.ancre = { cle, x: c.x, y: c.y };
      }
      return { x: p.ancre.x, y: p.ancre.y };
    }

    /* --- 8. LE GARDIEN : sur l'axe ballon-but, il sort quand ça chauffe --- */
    function cibleGardien(g) {
      const sens = sensDe(g.camp);
      const but = BUTS[g.camp];
      const ecart = Math.abs(refBloc.x - but.x);
      const proche = ecart < 20;
      const sortie = proche ? borne((20 - ecart) * 0.30, 0, 6) : 0;
      return { x: but.x + sens * (1.5 + sortie),
        y: refBloc.y * (proche ? 0.55 : 0.3) };
    }

    /* --- 1. LE PORTEUR : il conduit vers l'avant, vers l'espace libre.
       Il FUIT le presseur le plus proche : il dévie plutôt que de lui
       rentrer dedans. --- */
    function cibleConduite(p) {
      const sens = sensDe(p.camp);
      const but = BUTS[adverse(p.camp)];
      /* Mesure réelle : un porteur garde le ballon 1 s et parcourt
         1,75 m en médiane, à 2,5 m/s. Il ne part pas en cavalcade — il
         avance de deux ou trois mètres et cherche une solution. */
      let x = p.x + sens * 2;
      let y = lerp(p.y, but.y, 0.08);
      const presseur = listePions
        .filter((q) => q.camp !== p.camp && !q.gardien)
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (presseur && distance(presseur, p) < 6) {   // il ferme à 2,6 m
        const cote = presseur.y > p.y ? -1 : 1;
        y = p.y + cote * 4;
        x = p.x + sens * 2;
      }
      return { x: dansLeJeu(x), y: dansLaLargeur(y) };
    }

    /* --- 2. L'APPEL EN PROFONDEUR — la règle reine de la projection.
       La scène connaît la chorégraphie à l'avance : le receveur du temps
       SUIVANT commence sa course maintenant, AVANT que la passe parte.
       C'est elle qui permet au spectateur d'anticiper.
       L'appel CONTOURNE la ligne adverse (arc dans son dos), il ne la
       traverse pas de face. --- */
    function receveurAttendu() {
      if (!sequenceCourante) return null;
      const suivant = sequenceCourante[indexCourant + 1];
      if (!suivant) return null;
      const nom = suivant.vers || suivant.tireur || suivant.acteur;
      const campSuivant = suivant.equipe ? campDe(suivant.equipe)
        : sequenceCourante.equipe ? campDe(sequenceCourante.equipe) : null;
      const p = nom && pionDe(nom, campSuivant);
      if (!p || p.cle === ballon.porteur) return null;
      return p;
    }
    function cibleAppel(p) {
      const sens = sensDe(p.camp);
      const but = BUTS[adverse(p.camp)];
      const ligne = hauteurLigne(adverse(p.camp));
      // longueur d'appel réelle : 10,7 m en médiane (8,3 pour un
      // décrochage, 19,4 pour un débordement extérieur)
      let x = p.x + sens * 10;
      let y = lerp(p.y, but.y, 0.12);
      // s'il s'apprête à traverser la ligne de face, il l'élargit d'abord
      const traverse = sens > 0 ? (p.x < ligne && x > ligne) : (p.x > ligne && x < ligne);
      if (traverse) {
        const cote = p.y < 0 ? -1 : 1;
        y = p.y + cote * 6;
      }
      return { x: dansLeJeu(x), y: dansLaLargeur(y) };
    }

    /* --- 3. LES SOUTIENS : le triangle permanent du football.
       Les 2 coéquipiers les plus proches du porteur se placent à
       distance de passe, dans un angle OUVERT. Si un défenseur ferme la
       ligne, ils se déplacent pour la rouvrir — et c'est ce
       réajustement continu qui remplace la sinusoïde. --- */
    // distance de passe réelle : p10 6 m, médiane 12,9, p90 23,3
    const DISTANCE_SOUTIEN = { tiki: 9, catenaccio: 13, kickrush: 18, rue: 10, total: 13, grinta: 13 };
    function cibleSoutien(p, porteur) {
      const sens = sensDe(p.camp);
      const d = DISTANCE_SOUTIEN[styles[p.camp].style] || 15;
      let meilleure = null, meilleurScore = -Infinity;
      for (let k = 0; k < 12; k++) {
        const angle = (k / 12) * 6.283;
        const c = { x: porteur.x + Math.cos(angle) * d,
                    y: porteur.y + Math.sin(angle) * d, camp: p.camp };
        if (Math.abs(c.x) > DEMI_L - 5 || Math.abs(c.y) > DEMI_W - 3) continue;
        let score = ligneOuverte(porteur, c, p.camp) ? 12 : 0;   // l'angle ouvert d'abord
        score += (c.x - porteur.x) * sens * 0.35;                // on préfère l'avant
        score -= distance(c, p) * 0.30;                          // sans courir à l'autre bout
        // INERTIE DE DÉCISION : on ne change pas d'idée pour un cheveu.
        // Sans ça, le meilleur angle bascule à chaque frame et le joueur
        // fait des allers-retours — un bruit pire que la sinusoïde.
        if (p.soutienMemo) score += 6 - Math.min(6, distance(c, p.soutienMemo));   // 6 m d'inertie
        if (score > meilleurScore) { meilleurScore = score; meilleure = c; }
      }
      if (meilleure) p.soutienMemo = { x: meilleure.x, y: meilleure.y };
      return meilleure ? { x: meilleure.x, y: meilleure.y } : { x: p.x, y: p.y };
    }

    /* --- 5. LE MARQUAGE : goal-side, entre son homme et son propre but.
       Un attaquant sans défenseur goal-side dans notre tiers, c'est un
       TROU — et ça doit se voir, parce que c'est une information. --- */
    function cibleMarquage(d, homme) {
      const but = BUTS[d.camp];
      // un défenseur ANTICIPE : il se place sur où son homme VA être,
      // pas sur où il est — sinon il court derrière toute la phase
      const vise = { x: homme.x + (homme.vx || 0) * 0.35,
                     y: homme.y + (homme.vy || 0) * 0.35 };
      const dx = but.x - vise.x, dy = but.y - vise.y;
      const n = Math.hypot(dx, dy) || 1;
      return { x: borne(vise.x + (dx / n) * 2.5, -DEMI_L + 1, DEMI_L - 1),
               y: dansLaLargeur(vise.y + (dy / n) * 2.5) };
    }

    /* --- 7. L'ÉQUILIBRE : la forme du bloc (coulissement, compression,
       étirement des attaquants). C'est le rôle par DÉFAUT, plus le seul
       comportement — et il n'a plus de dérive parasite. --- */
    function cibleEquilibre(p) {
      const sens = sensDe(p.camp);
      const attaque = possession === p.camp;
      const glisse = refBloc.x * (attaque ? 0.62 : 0.66);
      const resserre = attaque ? 0.94 : 0.80;
      const glisseY = refBloc.y * (attaque ? 0.20 : 0.34);
      let x = p.baseX + glisse;
      let y = p.baseY * resserre + glisseY;
      if (attaque && p.ligne === "ATT") x += sens * 4;
      if (!attaque && p.ligne === "ATT") x -= sens * 2.5;
      return { x: borne(x, -DEMI_L + 1, DEMI_L - 1), y: dansLaLargeur(y) };
    }

    /* ============================================================
       LE CERVEAU : une passe par frame sur les 22 pions.
       ============================================================ */
    function cerveauDePlacement() {
      const porteur = ballon.porteur ? pions[ballon.porteur] : null;
      const campAtt = porteur ? porteur.camp : possession;
      const campDef = campAtt ? adverse(campAtt) : null;
      /* Entre deux temps forts, il ne se passe RIEN : le ballon est mort.
         Personne ne presse un ballon mort et personne ne marque à
         l'arrêt — seule la forme tient (ligne, équilibre, gardien).
         C'est aussi ce qui fait que la scène se CALME au repos. */
      const jeuVivant = regime === "action" || regime === "miseEnPlace" || regime === "ralenti";

      for (const p of listePions) {
        // la mémoire d'une décision ne survit pas au changement de rôle
        if (p.role !== "soutien") p.soutienMemo = null;
        if (p.role !== "porteur" && p.role !== "appel") p.ancre = null;
        if (p.role !== "marquage") p.marque = null;
        p.role = null; p.cible = null;
      }

      /* 0. LE SCÉNARIO prime : quand le moteur a parlé, on obéit.
         Une chorégraphie peut ne contraindre QU'UN axe (« il suit sa
         passe » ne dit rien du couloir) : l'axe libre reste tenu par la
         forme du bloc, jamais par une valeur nulle. */
      for (const p of listePions) {
        if (p.cx === null && p.cy === null) continue;
        const forme = cibleEquilibre(p);
        p.cible = { x: p.cx !== null ? p.cx : forme.x, y: p.cy !== null ? p.cy : forme.y };
        p.role = p.roleScenario || "scenario";
      }
      // 8. les gardiens n'ont jamais d'autre rôle
      for (const camp of ["moi", "eux"]) {
        const g = gardienDe(camp);
        if (!g || g.cx !== null) continue;
        g.role = "gardien"; g.cible = cibleGardien(g);
      }
      // 1. le porteur
      if (jeuVivant && porteur && !porteur.cible) {
        porteur.role = "porteur";
        /* Il va VRAIMENT au bout de ses deux mètres avant d'en demander
           deux autres : c'est ce qui le fait ralentir, s'arrêter presque,
           et chercher une solution — 1 s de possession, 1,75 m parcourus.
           Un seuil d'arrivée large relançait la course avant l'arrêt et
           le porteur cavalcadait à 4 m/s. */
        porteur.cible = ancrer(porteur, "porteur", () => cibleConduite(porteur), 0.5);
      }
      // 2. l'appel en profondeur — un seul appel tranchant à la fois
      const receveur = jeuVivant ? receveurAttendu() : null;
      if (receveur && !receveur.cible && !receveur.gardien) {
        receveur.role = "appel";
        receveur.cible = ancrer(receveur, "appel", () => cibleAppel(receveur), 1.5);
      }
      // 3. les soutiens : les 2 plus proches du porteur
      if (jeuVivant && porteur) {
        listePions
          .filter((q) => q.camp === porteur.camp && !q.gardien && !q.cible &&
            distance(q, porteur) < 32)          // on ne traverse pas le terrain pour se proposer
          .sort((a, b) => distance(a, porteur) - distance(b, porteur))
          .slice(0, 2)
          .forEach((q) => { q.role = "soutien"; q.cible = cibleSoutien(q, porteur); });
      }
      // 4. le pressing : les 2 défenseurs les plus proches du ballon,
      //    côté but. Fidélité moteur : le défenseur que le moteur a
      //    désigné battu est justement celui qui arrive en retard.
      if (campDef) {
        const sens = sensDe(campDef);
        const zoneBasse = Math.abs(ballon.x - BUTS[campDef].x) < 30;
        const candidatsPress = listePions
          .filter((q) => q.camp === campDef && !q.gardien && !q.cible &&
            // presser, c'est partir de PRÈS : 5,9 m en médiane, 9,5 au
            // p90 (design/football-chiffre.md §5). Celui qui est à
            // trente mètres ne presse pas, il tient son bloc.
            distance(q, ballon) < 16 &&
            !(zoneBasse && q.ligne === "ATT"));  // le point haut ne redescend pas presser
        // INERTIE : celui qui pressait déjà garde la mission (6 m de
        // bonus) — sinon les deux plus proches changent chaque frame
        candidatsPress
          .sort((a, b) => (distance(a, ballon) - (a.pressait ? 6 : 0)) -
                          (distance(b, ballon) - (b.pressait ? 6 : 0)))
          .slice(0, 2)
          .forEach((q) => {
            q.role = "pressing";
            q.cible = { x: borne(ballon.x - sens * 2.6, -DEMI_L + 1, DEMI_L - 1),
                        y: dansLaLargeur(ballon.y + (q.y > ballon.y ? 1 : -1)) };
          });
      }
      // 5. le marquage : dans NOTRE tiers, chaque danger a son homme
      if (jeuVivant && campDef) {
        const sens = sensDe(campDef);
        const but = BUTS[campDef].x;
        const tiers = but + sens * 33;
        const dansNotreTiers = sens > 0 ? ballon.x < tiers : ballon.x > tiers;
        if (dansNotreTiers) {
          const dangers = listePions
            .filter((q) => q.camp === campAtt && !q.gardien &&
              (sens > 0 ? q.x < tiers + 8 : q.x > tiers - 8))
            .sort((a, b) => Math.abs(a.x - but) - Math.abs(b.x - but));
          const aMarquer = dangers.slice(0, 2);        // deux hommes au plus
          const candidats = listePions.filter((q) => q.camp === campDef && !q.gardien && !q.cible &&
            (q.ligne === "DÉF" || q.ligne === "MIL"));
          const pris = new Set();
          const libres = [];
          // on GARDE son homme tant qu'il reste dangereux
          for (const d of candidats) {
            const homme = d.marque && aMarquer.find((h) => h.cle === d.marque);
            if (homme && !pris.has(homme.nom)) {
              pris.add(homme.nom);
              d.role = "marquage"; d.cible = cibleMarquage(d, homme);
            } else libres.push(d);
          }
          // puis on couvre les dangers encore libres, au plus proche
          for (const homme of aMarquer) {
            if (pris.has(homme.nom) || !libres.length) continue;
            libres.sort((a, b) => distance(a, homme) - distance(b, homme));
            const d = libres.shift();
            pris.add(homme.nom);
            d.role = "marquage"; d.marque = homme.cle; d.cible = cibleMarquage(d, homme);
          }
          for (const d of libres) d.marque = null;   // il a lâché son homme
        }
      }
      // 6. la ligne défensive : les défenseurs restants partagent une
      //    hauteur commune — ils montent et descendent ENSEMBLE
      for (const camp of ["moi", "eux"]) {
        const h = hauteurLigne(camp);
        listePions
          .filter((q) => q.camp === camp && !q.gardien && !q.cible && q.ligne === "DÉF")
          .forEach((q) => {
            q.role = "ligne";
            const eq = cibleEquilibre(q);
            q.cible = { x: borne(h, -DEMI_L + 1, DEMI_L - 1), y: eq.y };
          });
      }
      // 7. l'équilibre : tous les autres tiennent la forme
      for (const p of listePions) {
        if (p.cible) continue;
        p.role = "equilibre"; p.cible = cibleEquilibre(p);
      }
      for (const p of listePions) p.pressait = p.role === "pressing";
    }

    /* ============================================================
       4.2 LA PHYSIQUE DU BALLON
       ============================================================ */
    /* Le ballon part TOUJOURS d'où il est (jamais du passeur théorique :
       ce serait une téléportation) et vise le receveur, devant sa course. */
    function passer(deNom, versNom, opts = {}) {
      const vers = pionDe(versNom, opts.camp);
      // R4 : la passe est donnée DEVANT la course du receveur
      const avance = opts.devantLaCourse === false ? 0 : 0.28;
      const x1 = vers ? borne(vers.x + vers.vx * avance, -DEMI_L, DEMI_L) : (opts.x1 !== undefined ? opts.x1 : ballon.x);
      const y1 = vers ? borne(vers.y + vers.vy * avance, -DEMI_W, DEMI_W) : (opts.y1 !== undefined ? opts.y1 : ballon.y);
      const dist = Math.hypot(x1 - ballon.x, y1 - ballon.y);
      // vitesses réelles : passe au sol 15-20 m/s, frappe 25-30
      const vitesse = opts.vitesse || 17;                       // m/s
      ballon.porteur = null;
      ballon.vol = {
        x0: ballon.x, y0: ballon.y, x1, y1, t: 0,
        duree: Math.max(0.12, dist / vitesse),
        hauteur: opts.cloche ? Math.min(dist * 0.16, 8) : (opts.hauteur || 0),   // mètres
        versNom: vers ? vers.cle : null,
        apres: opts.apres || null,
      };
      return ballon.vol.duree;
    }
    function frapper(deNom, campAttaque, opts = {}) {
      const but = BUTS[adverse(campAttaque)];
      const cible = {
        x1: but.x + sensDe(campAttaque) * -0.5,
        y1: borne((opts.cote || 0) * 2.8, -3.5, 3.5),   // la cage fait 7,32 m
      };
      return passer(deNom, null, { ...cible, vitesse: opts.vitesse || 27, hauteur: opts.hauteur || 1.2, apres: opts.apres, camp: campAttaque });
    }
    /* Donner le ballon à un joueur : s'il est loin, le ballon y VOYAGE
       (R4 — aucune téléportation, jamais, même sur un changement de
       porteur). S'il est déjà dans ses pieds, on l'accroche. */
    function donnerLeBallon(nom, vitesse, camp) {
      const p = pionDe(nom, camp);
      if (!p) return 0;
      const dist = Math.hypot(p.x - ballon.x, p.y - ballon.y);
      if (dist < 2 && !ballon.vol) { ballon.vol = null; ballon.porteur = p.cle; return 0; }
      return passer(null, nom, { vitesse: vitesse || 17, devantLaCourse: false, camp });
    }

    function majBallon(dt) {
      if (ballon.vol) {
        const v = ballon.vol;
        v.t += dt / v.duree;
        const t = Math.min(1, v.t);
        ballon.x = lerp(v.x0, v.x1, t);
        ballon.y = lerp(v.y0, v.y1, t);
        ballon.z = v.hauteur * Math.sin(Math.PI * t);
        if (v.t >= 1) {
          ballon.z = 0;
          ballon.porteur = v.versNom;
          const fin = v.apres;
          ballon.vol = null;
          if (fin) fin();
        }
      } else if (ballon.porteur && pions[ballon.porteur]) {
        // la CONDUITE : le ballon est posé devant le porteur, dans le sens
        // de sa course — c'est ce détail qui fait « il conduit la balle »
        const p = pions[ballon.porteur];
        const v = Math.hypot(p.vx, p.vy);
        const ux = v > 0.5 ? p.vx / v : sensDe(p.camp);
        const uy = v > 0.5 ? p.vy / v : 0;
        // le ballon reste devant le pied : 0,8 m à l'arrêt, 2 m lancé
        const devant = 0.8 + Math.min(v / 7, 1) * 1.2;
        const cibleX = p.x + ux * devant, cibleY = p.y + uy * devant;
        const dx = cibleX - ballon.x, dy = cibleY - ballon.y;
        const d = Math.hypot(dx, dy);
        // le ballon roule vers le pied, à vitesse de course + marge
        const vBallon = Math.max(v * 1.6, 6);   // m/s : il roule au pied
        const pas = Math.min(d, vBallon * dt);
        if (d > 0.001) { ballon.x += (dx / d) * pas; ballon.y += (dy / d) * pas; }
        ballon.z = 0;
      } else {
        // ballon libre : il roule et s'arrête
        ballon.x += ballon.vx * dt; ballon.y += ballon.vy * dt;
        const amorti = Math.pow(0.25, dt);        // par SECONDE, pas par frame
        ballon.vx *= amorti; ballon.vy *= amorti;
        ballon.x = borne(ballon.x, -DEMI_L, DEMI_L); ballon.y = borne(ballon.y, -DEMI_W, DEMI_W);
      }
      if (reg.trainee) {
        ballon.trainee.push({ x: ballon.x, y: ballon.y, z: ballon.z });
        if (ballon.trainee.length > 10) ballon.trainee.shift();
      } else if (ballon.trainee.length) ballon.trainee.length = 0;
    }

    /* ============================================================
       4.3 LES SUPERPOSITIONS DOM (chips de synergie, cris, cut)
       ============================================================ */
    const ephemere = (classe, x, y, contenu, ms, style) => {
      const e = document.createElement("div");
      e.className = classe;
      if (contenu) e.innerHTML = contenu;
      e.style.left = x + "%";
      e.style.top = y + "%";
      if (style) Object.assign(e.style, style);
      couche.appendChild(e);
      setTimeout(() => e.remove(), ms);
      return e;
    };
    const chipSynergie = (nom, x, y, ms) => {
      const glyphe = (typeof ONZE_UI !== "undefined" && ONZE_UI.glyphe(nom)) || "✦";
      ephemere("chip-synergie", borne(x, 12, 88), Math.max(y - 13, 6),
        `${glyphe} ${nom}`, ms, { borderColor: couleurFamille(nom), color: couleurFamille(nom) });
    };
    const auraFamille = (nomFamille, camp, ms) => {
      for (const p of listePions) {
        if (p.camp !== camp) continue;
        if (p.ecole === nomFamille || p.archetype === nomFamille) {
          p.aura = ms; p.auraCouleur = couleurFamille(nomFamille);
        }
      }
    };
    const chipEtSynergie = (ev, ancre, ms) => {
      if (!ev || !ev.synergie) return;
      auraFamille(ev.synergie, ev.equipe ? campDe(ev.equipe) : "moi", 1100);
      chipSynergie(ev.synergie, ancre.x, ancre.y, Math.max(ms, 800));
    };

    /* ---- LE COMMENTAIRE (R5) : une ligne, au futur, puis le constat ---- */
    function commentaire(texte, constat) {
      if (!texte) return;
      bande.classList.toggle("constat", !!constat);
      bande.classList.add("visible");
      barrePossession.classList.remove("visible");
      texteCommentaire.innerHTML = texte;
    }
    function repos() {
      regime = "repos";
      sequenceCourante = null; indexCourant = -1;
      bande.classList.remove("visible");
      barrePossession.classList.add("visible");
      for (const p of listePions) { p.cx = null; p.cy = null; p.role = null; p.etiquette = false; }
    }
    /* La possession affichée vient des VRAIS événements du moteur
       (match-ui les compte) — jamais d'un chiffre décoratif. */
    function majPossession(compte) {
      const total = (compte.moi || 0) + (compte.eux || 0);
      if (!total) return;
      possessionPct.moi = Math.round((compte.moi / total) * 100);
      possessionPct.eux = 100 - possessionPct.moi;
    }

    /* Règle 12 : la timeline. `programmer` pose les points au coup d'envoi
       (on connaît le nombre de temps forts dès la planification),
       `avancer` allume le courant et éteint les précédents. */
    let tfCourant = -1, tfTotal = 0;
    function programmerTimeline(nb) {
      tfTotal = Math.max(0, nb | 0);
      tfCourant = -1;
      timeline.innerHTML = "";
      for (let i = 0; i < tfTotal; i++) {
        const point = document.createElement("span");
        point.className = "point-tf";
        point.dataset.tf = String(i);
        timeline.appendChild(point);
      }
      timeline.classList.toggle("visible", tfTotal > 0);
    }
    function avancerTimeline() {
      tfCourant = Math.min(tfCourant + 1, tfTotal - 1);
      timeline.querySelectorAll(".point-tf").forEach((p, i) => {
        p.classList.toggle("passe", i < tfCourant);
        p.classList.toggle("courant", i === tfCourant);
      });
    }

    /* ---- LE CUT (R2) : carton sec minute + score entre deux temps forts ---- */
    function cut(info, duree = 900) {
      regime = "cut";
      avancerTimeline();        // le cut ouvre un temps fort : le point s'allume
      bande.classList.remove("visible");
      barrePossession.classList.remove("visible");
      /* Annexe FM — L'AFFICHAGE DES TEMPS MORTS. Le carton de coupe est
         le temps mort d'ONZE : selon le réglage, il porte les stats du
         match en plus de la minute et du score. Les chiffres viennent
         des événements DÉJÀ JOUÉS — zéro spoiler. */
      const avecStats = (reg.tempsMorts === "stats" || reg.tempsMorts === "les-deux") && info.stats;
      const barre = (libelle, a, b, suffixe) => {
        const total = (a + b) || 1;
        return `<div class="cut-stat">
          <span class="cut-val">${a}${suffixe || ""}</span>
          <span class="cut-jauge"><i style="width:${Math.round((a / total) * 100)}%"></i></span>
          <span class="cut-nom">${libelle}</span>
          <span class="cut-jauge droite"><i style="width:${Math.round((b / total) * 100)}%"></i></span>
          <span class="cut-val">${b}${suffixe || ""}</span></div>`;
      };
      const carte = document.createElement("div");
      carte.className = "carton-cut";
      carte.innerHTML =
        `<div class="cut-minute">${info.minute}ᵉ</div>` +
        `<div class="cut-score"><span>${info.nomA || eqA.nom}</span>` +
        `<strong>${info.scoreA} – ${info.scoreB}</strong>` +
        `<span>${info.nomB || eqB.nom}</span></div>` +
        (avecStats ? `<div class="cut-stats">
          ${barre("possession", info.stats.possession.moi, info.stats.possession.eux, " %")}
          ${barre("occasions", info.stats.moi.occasions, info.stats.eux.occasions)}
          ${barre("buts", info.stats.moi.buts, info.stats.eux.buts)}
        </div>` : "");
      couche.appendChild(carte);
      cartonCut = carte;
      requestAnimationFrame(() => carte.classList.add("visible"));
      setTimeout(() => {
        carte.classList.remove("visible");
        setTimeout(() => { carte.remove(); if (cartonCut === carte) cartonCut = null; }, 240);
      }, Math.max(240, duree - 240));
      minute.depart = minute.affichee;
      minute.cible = info.minute;
      minute.duree = Math.max(duree, 300);
      minute.t0 = performance.now();
    }

    /* ============================================================
       4.4 LA MISE EN PLACE (R3) — ~3 s : les 22 pions glissent vers
       leurs positions de SITUATION, et le commentaire pose la
       promesse en QUANTIFIANT le danger (« Ils sont 3 face à 3 »).
       Les positions viennent de la situation réelle de la phase.
       ============================================================ */
    function miseEnPlace(sequence, duree = 3000) {
      regime = "miseEnPlace";
      barrePossession.classList.remove("visible");
      const camp = sequence.equipe ? campDe(sequence.equipe) : "moi";
      const situation = sequence.situation || "placee";
      sequenceCourante = sequence;
      indexCourant = -1;
      situationCourante = situation;
      possession = camp;
      const sens = sensDe(camp);
      // où naît l'action, selon la situation (données du moteur)
      const zone = {
        placee: { x: sens * 4, y: 0 },
        contre: { x: -sens * 9, y: 0 },
        aile: { x: sens * 16, y: (Math.random() < 0.5 ? -1 : 1) * DEMI_W * 0.72 },
        aerien: { x: sens * 19, y: 0 },
        long: { x: -sens * 10, y: 0 },
      }[situation] || { x: 0, y: 0 };

      for (const p of listePions) {
        p.cx = null; p.cy = null; p.role = null; p.etiquette = false;
        if (p.gardien) continue;
        const attaque = p.camp === camp;
        // le bloc se pose autour de la zone de naissance de l'action
        const glisse = zone.x * (attaque ? 0.62 : 0.66);
        p.cx = borne(p.baseX + glisse + (attaque && p.ligne === "ATT" ? sensDe(p.camp) * 4 : 0), -DEMI_L + 1, DEMI_L - 1);
        p.cy = dansLaLargeur(p.baseY * (attaque ? 0.94 : 0.80) + zone.y * (attaque ? 0.24 : 0.38));
      }
      // le ballon rejoint le premier acteur de la séquence
      const premier = sequence.find && sequence.find((t) => t.acteur || t.de);
      const nomPremier = premier ? (premier.acteur || premier.de) : null;
      const porteur = nomPremier && pionDe(nomPremier, camp);
      if (porteur) {
        porteur.cx = dansLeJeu(zone.x); porteur.cy = dansLaLargeur(zone.y);
        // le ballon est à SES pieds tout de suite : il l'emmène en glissant
        // la mise en place suit un CUT : c'est le seul endroit où le
        // ballon peut se reposer d'un coup — la coupe le justifie.
        ballon.vol = null; ballon.porteur = porteur.cle;
        ballon.x = porteur.x; ballon.y = porteur.y; ballon.z = 0;
        if (reg.etiquettes) porteur.etiquette = true;
      } else {
        ballon.vol = null; ballon.porteur = null;
        ballon.x = zone.x; ballon.y = zone.y;
      }
      // R5 : la promesse QUANTIFIE le danger — comptage RÉEL des pions
      // engagés autour de la zone où naît l'action (rayon de 30 % de
      // terrain, gardiens exclus). Le chiffre vient des positions qu'on
      // vient de poser : il ne peut pas mentir.
      const engages = (c) => listePions.filter((p) => {
        if (p.camp !== c || p.gardien) return false;
        const x = p.cx !== null ? p.cx : p.x, y = p.cy !== null ? p.cy : p.y;
        return Math.hypot(x - zone.x, y - zone.y) < 22;   // 22 m autour de la zone
      }).length;
      const att = Math.max(1, engages(camp));
      const def = Math.max(1, engages(adverse(camp)));
      const nomEquipe = sequence.equipe || (camp === "moi" ? eqA.nom : eqB.nom);
      const LIBELLES = {
        placee: `${nomEquipe} installe le jeu…`,
        contre: `Ballon récupéré — ${nomEquipe} part en contre !`,
        aile: `${nomEquipe} déborde sur l'aile…`,
        aerien: `${nomEquipe} cherche la tête dans la surface…`,
        long: `${nomEquipe} tente le ballon dans la profondeur…`,
      };
      const rapport = att === 1 && def === 1 ? `Un contre un.`
        : att <= def ? `Ils sont <b>${att}</b> face à <b>${def}</b>.`
        : `<b>${att}</b> contre <b>${def}</b> — le surnombre est pour ${nomEquipe} !`;
      commentaire(`${LIBELLES[situation] || LIBELLES.placee} ${rapport}`);
      return { attaquants: att, defenseurs: def, situation };
    }

    /* ============================================================
       4.5 JOUER UN TEMPS (R3) — chaque temps pose des INTENTIONS ;
       la simulation continue fait le reste du mouvement. L'issue
       n'est révélée qu'au temps d'issue, à ~55 % de sa durée (R7).
       `surIssue` : rappel de match-ui pour le journal et le score —
       appelé au moment EXACT de la révélation, jamais avant.
       ============================================================ */

    /* R6 : les noms suivent l'action — 2 ou 3 protagonistes étiquetés */
    /* On étiquette des PIONS, plus des noms : deux joueurs homonymes
       dans les deux camps ne doivent pas s'allumer ensemble. */
    function etiqueter(cibles) {
      if (!reg.etiquettes) return;
      const set = new Set((cibles || []).filter(Boolean).map((c) => (typeof c === "string" ? c : c.cle)));
      for (const p of listePions) p.etiquette = set.has(p.cle);
    }
    function etiqueterTous() {
      if (!reg.etiquettes) return;
      for (const p of listePions) p.etiquette = true;
    }
    /* Les courses hors-ballon ne sont PLUS scénarisées ici : c'est le
       cerveau de placement (décision 33) qui les décide, avec une
       raison — appel du receveur attendu, soutien dans l'angle ouvert.
       L'ancienne fonction `coursesAppel` envoyait des coéquipiers vers
       l'avant sans motif : c'était le bruit que ce chantier supprime. */

    function jouerTemps(t, duree, surIssue) {
      const ms = Math.max(400, duree || 800);
      // où en est-on dans la chorégraphie ? (pour l'appel du receveur suivant)
      if (sequenceCourante) {
        const i = sequenceCourante.indexOf(t);
        indexCourant = i >= 0 ? i : indexCourant + 1;
      }
      const camp = t.equipe ? campDe(t.equipe) : "moi";
      const sens = sensDe(camp);
      if (!t.issue) regime = "action";

      switch (t.type) {

        case "recuperation": {
          const p = pionDe(t.acteur, camp);
          possession = camp;
          if (p) {
            p.flash = 420;
            donnerLeBallon(p.nom, 17, camp);
            p.cx = dansLeJeu(p.x + sens * 2.5); p.cy = p.y;
            etiqueter([p]);
          }
          break;
        }

        case "contre": {
          possession = camp;
          const p = pionDe(t.acteur, camp);
          if (p) { donnerLeBallon(p.nom, 19, camp); p.flash = 400; etiqueter([p]); }
          // tout le bloc part vers l'avant : c'est CE mouvement qui dit « contre »
          for (const q of listePions) {
            if (q.camp !== camp || q.gardien) continue;
            q.cx = dansLeJeu(q.x + sens * (10 + (q.ligne === "ATT" ? 7 : 0)));
            q.cy = dansLaLargeur(lerp(q.y, q.baseY, 0.35) + q.baseY * 0.12);
            q.roleScenario = "contre";
          }
          // la défense adverse est prise à revers : elle se replie en courant
          for (const q of listePions) {
            if (q.camp === camp || q.gardien) continue;
            q.cx = dansLeJeu(q.x - sens * 9);
            q.roleScenario = "repli";
          }
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "relais": {
          possession = camp;
          const de = pionDe(t.de, camp), vers = pionDe(t.vers, camp);
          if (vers) {
            // m/s : le Tiki joue vite et court, le Catenaccio pose
            const cadence = { tiki: 19, kickrush: 21, catenaccio: 15, rue: 16, total: 18, grinta: 19 };
            passer(t.de, t.vers, { vitesse: cadence[styles[camp].style] || 17, camp });
            if (de) { de.cx = dansLeJeu(de.x + sens * 2); de.roleScenario = "suit"; }   // il suit sa passe
            vers.cx = dansLeJeu(vers.x + sens * 2);
            etiqueter([de, vers]);
          }
          break;
        }

        case "relais_long": {
          possession = camp;
          const vers = pionDe(t.vers, camp);
          if (vers) {
            // la cloche : le ballon monte, l'ombre au sol le trahit
            vers.cx = dansLeJeu(vers.x + sens * 9);
            vers.cy = dansLaLargeur(lerp(vers.y, vers.baseY, 0.4));
            passer(t.de, t.vers, { vitesse: 16, cloche: true, camp });
          } else {
            passer(t.de, null, { x1: dansLeJeu(ballon.x + sens * 22), y1: dansLaLargeur((Math.random() - 0.5) * TERRAIN.W * 0.6), vitesse: 16, cloche: true });
          }
          etiqueter([pionDe(t.de, camp), vers]);
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "conduite": {
          possession = camp;
          const p = pionDe(t.acteur, camp);
          if (p) {
            donnerLeBallon(p.nom, 16, camp);
            // la Rue : conduite en crochets, le pion serpente vers le but
            // le crochet part du CÔTÉ OPPOSÉ au défenseur le plus proche :
            // une décision de football, pas une fonction du temps
            const genant = listePions.filter((q) => q.camp !== p.camp && !q.gardien)
              .sort((a, b) => distance(a, p) - distance(b, p))[0];
            const cote = genant ? (genant.y > p.y ? -1 : 1) : (p.y > 0 ? -1 : 1);
            p.cx = dansLeJeu(p.x + sens * 5);
            p.cy = dansLaLargeur(p.y + cote * 4);
            p.roleScenario = "conduite";
            etiqueter([p]);
          }
          break;
        }

        case "geste": {
          possession = camp;
          const p = pionDe(t.acteur, camp);
          if (p) {
            donnerLeBallon(p.nom, 16, camp);
            p.cx = dansLeJeu(p.x + sens * 3);
            p.cy = dansLaLargeur(p.y + 3 * (Math.random() < 0.5 ? 1 : -1));
            ephemere("eclat-geste", p.x, p.y, "✨", ms);
            etiqueter([p]);
            // le défenseur le plus proche part dans le décor
            const battu = listePions.filter((q) => q.camp !== camp && !q.gardien)
              .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
            if (battu) { battu.plonge = 420; battu.cx = dansLeJeu(battu.x - sens * 2); battu.cy = dansLaLargeur(battu.y + 3); }
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "percee": {
          possession = camp;
          const p = pionDe(t.acteur, camp), battu = pionDe(t.battu, adverse(camp));
          etiqueter([p, battu]);
          if (p) {
            p.roleScenario = "percee";
            if (t.sousType === "course") {
              // le sprint dans le couloir : il prend la profondeur, plein axe
              const couloir = dansLaLargeur(p.y + (p.y < 0 ? -8 : 8));
              p.cx = dansLeJeu(p.x + sens * 22); p.cy = couloir;
              donnerLeBallon(p.nom, 18, camp);
            } else if (t.sousType === "dribble") {
              // le crochet sec : un décalage latéral franc devant le défenseur
              p.cx = dansLeJeu(p.x + sens * 12);
              p.cy = dansLaLargeur(p.y + (battu && battu.y > p.y ? -5 : 5));
              donnerLeBallon(p.nom, 17, camp);
              ephemere("eclat-geste", p.x, p.y, "⚡", ms * 0.8);
            } else if (t.sousType === "aerien") {
              // le duel aérien : cloche vers lui, il saute (l'échelle grandit)
              const cible = { x: dansLeJeu(p.x + sens * 10), y: p.y };
              p.cx = cible.x; p.cy = cible.y;
              passer(null, null, { x1: cible.x, y1: cible.y, vitesse: 15, cloche: true,
                apres: () => { p.echelle = 1.35; setTimeout(() => { if (!detruit) p.echelle = 1; }, 320); } });
            } else { // centre
              // le centre traverse la surface, devant la course des attaquants
              const cibleAtt = listePions.filter((q) => q.camp === camp && !q.gardien && q !== p)
                .sort((a, b) => Math.abs(b.x - BUTS[adverse(camp)].x) * -1 - Math.abs(a.x - BUTS[adverse(camp)].x) * -1)[0];
              if (cibleAtt) { cibleAtt.cx = dansLeJeu(BUTS[adverse(camp)].x - sens * 10); cibleAtt.cy = borne((Math.random() - 0.5) * 12, -8, 8); }
              passer(p.nom, cibleAtt ? cibleAtt.nom : null, { vitesse: 20, cloche: true, camp });
            }
          }
          if (battu) {
            // le défenseur battu se JETTE — et se retrouve à contretemps
            battu.plonge = 520;
            battu.cx = borne(battu.x - sens * 2, -DEMI_L + 1, DEMI_L - 1);
            battu.cy = dansLaLargeur(battu.y + (p && p.cy !== null ? (battu.y - p.cy) * 0.4 : 2));
            battu.roleScenario = "battu";
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "stop": {
          const p = pionDe(t.acteur, camp);
          possession = camp;
          if (p) {
            p.flash = 480; p.plonge = 320;
            donnerLeBallon(p.nom, 17, camp);
            etiqueter([p]);
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "hors_jeu": {
          const attaquant = listePions.filter((q) => q.camp !== camp && !q.gardien)
            .sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0];
          if (attaquant) { attaquant.cx = dansLeJeu(attaquant.x + sensDe(attaquant.camp) * 7); etiqueter([attaquant]); }
          ephemere("chip-arbitre", ballon.x, ballon.y, "🚩 Hors-jeu", ms);
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "rebond": {
          const p = pionDe(t.acteur, camp);
          possession = camp;
          if (p) {
            p.cx = dansLeJeu(ballon.x); p.cy = dansLaLargeur(ballon.y);
            p.roleScenario = "rebond";
            etiqueter([p]);
            setTimeout(() => { if (!detruit) donnerLeBallon(p.nom, 15, camp); }, ms * 0.5);
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        /* --- LE TEMPS DÉCISIF : l'armement. Le ballon NE PART PAS
           encore : le tireur se place, le gardien ferme l'angle, les
           défenseurs se jettent. Personne ne peut deviner l'issue. --- */
        case "frappe": {
          possession = camp;
          const tireur = pionDe(t.tireur, camp);
          const gk = gardienDe(adverse(camp));
          etiqueter([tireur, pionDe(t.passeur, camp), gk]);
          if (tireur) {
            donnerLeBallon(tireur.nom, 18, camp);
            // il se replace dans un angle jouable : ni sur la ligne de but,
            // ni dans le couloir — entre 12 et 26 % du fond, axe resserré
            const but = BUTS[adverse(camp)];
            const distanceBut = borne(Math.abs(tireur.x - but.x), 8, 20);   // mètres
            tireur.cx = dansLeJeu(but.x - sens * distanceBut);
            tireur.cy = borne(tireur.y * 0.55, -14, 14);
            tireur.roleScenario = "tireur";
          }
          if (gk) { gk.cx = borne(BUTS[gk.camp].x + sensDe(gk.camp) * 2.5, -DEMI_L, DEMI_L); gk.cy = borne(ballon.y * 0.6, -4, 4); }
          // deux défenseurs se jettent dans la trajectoire (mêlée permise)
          listePions.filter((q) => q.camp !== camp && !q.gardien)
            .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))
            .slice(0, 2).forEach((q) => { q.cx = borne(ballon.x - sens * 1.5, -DEMI_L + 1, DEMI_L - 1); q.cy = dansLaLargeur(ballon.y + (q.y > ballon.y ? 1.2 : -1.2)); });
          break;
        }

        /* --- LES ISSUES : même départ de frappe pour les trois. La
           révélation (texte + effet) tombe à ~55 % du temps. --- */
        case "issue_but":
        case "issue_arret":
        case "issue_blocage": {
          possession = camp;
          const tireur = pionDe(t.tireur, camp);
          const gk = pionDe(t.gardien, adverse(camp)) || gardienDe(adverse(camp));
          const cote = (tireur && Math.abs(tireur.y) > 5) ? (tireur.y < 0 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
          const revele = () => {
            if (detruit) return;
            if (t.type === "issue_but") {
              tremblements[adverse(camp)] = 1;
              butsMarques[camp] = (butsMarques[camp] || 0) + 1;
              etiqueterTous();                       // R6 : tous les noms au but
              if (gk) gk.plonge = 700;
              ephemere("flash-but", 50, 50, "", 700);
              // micro-ralenti de 0,5 s (R8)
              facteurTemps = 0.45;
              setTimeout(() => { facteurTemps = 1; }, 500);
              if (reg.replay) armerReplay();
            } else if (t.type === "issue_arret") {
              if (gk) { gk.plonge = 640; gk.flash = 500; gk.cy = borne(cote * 3, -4, 4); }
              ballon.vol = null; ballon.porteur = null;
              ballon.vx = sensDe(adverse(camp)) * 9; ballon.vy = cote * 5;
              if (t.pres) ephemere("chip-arbitre", 50, 22, "OHHH !", 900);
            } else {
              const mur = listePions.filter((q) => q.camp !== camp && !q.gardien)
                .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))[0];
              if (mur) { mur.plonge = 520; mur.flash = 480; }
              ballon.vol = null; ballon.porteur = null;
              ballon.vx = sensDe(adverse(camp)) * 7; ballon.vy = cote * 4;
            }
            // le constat : pour un but, le CRI du moteur ferme la phrase
            const texteIssue = !t.ev ? ""
              : t.type === "issue_but" ? `${t.ev.texte} <b>⚽ ${t.ev.cri || "BUT !"}</b>`
              : t.pres ? `${t.ev.texte} <b>OHHH !</b>`
              : t.ev.texte;
            commentaire(texteIssue, true);
            chipEtSynergie(t.ev, ballon, 900);
            if (surIssue) surIssue();
          };
          // Le tir part de façon à ce que le ballon ARRIVE vers 55 % du
          // temps : la frappe voyage à l'écran, l'issue tombe ensuite —
          // jamais au premier quart, sinon le suspense meurt (R7).
          const but = BUTS[adverse(camp)];
          const distance = Math.hypot(but.x - ballon.x, but.y - ballon.y);
          const volMs = (distance / 105) * 1000;
          const attente = Math.max(0, ms * 0.55 - volMs);
          if (gk) { gk.cx = borne(BUTS[gk.camp].x + sensDe(gk.camp) * 1.5, -DEMI_L, DEMI_L); }
          setTimeout(() => { if (!detruit) frapper(t.tireur, camp, { cote, apres: revele }); }, attente);
          return attente + volMs;
        }

        default: break;
      }
      return 0;
    }

    /* ============================================================
       4.6 LE REPLAY DE BUT (R10 « Revoir les buts ») — relecture
       ralentie du tampon des ~3 dernières secondes.
       ============================================================ */
    function armerReplay() {
      if (!tampon.length) return;
      setTimeout(() => {
        if (detruit || finDeMatch) return;
        replay = { etats: tampon.slice(-90), indice: 0 };
        // sous le tableau de score, sinon il passe dessous et on ne le voit pas
        const bandeauReplay = ephemere("bandeau-replay", 50, 26, "⏪ Le but", 2400);
        bandeauReplay.style.transform = "translate(-50%,0)";
      }, 700);
    }

    /* ============================================================
       4.7 LA JAUGE DE DOMINATION — lecture des VRAIS événements
       d'une phase (décision 24). Fonction pure, testée.
       ============================================================ */
    function dominationDe(phase) {
      let score = 0, poids = 0;
      for (const ev of phase.evenements) {
        const signe = ev.equipe ? (campDe(ev.equipe) === "moi" ? 1 : -1) : 0;
        const p = { possession: 0.5, percee: 0.7, percee_stoppee: 0.45, interception: 0.45,
          geste: 0.3, contre: 0.5, ballon_long: 0.3, lambretta: 0.4, rebond: 0.5, blocage: 0.4 }[ev.type]
          || (ev.but ? 1 : ev.type === "arret" ? 0.7 : 0.2);
        const signeCorrige = (ev.type === "arret" || ev.type === "blocage") ? -signe : signe;
        score += signeCorrige * p; poids += p;
      }
      return poids ? borne(score / poids, -1, 1) : 0;
    }
    function majJaugeCible(phase) {
      jauge.cible = dominationDe(phase);
    }
    /* Le carton de fin de match remet l'horloge en place */
    function reglerMinute(m, duree) {
      minute.depart = minute.affichee; minute.cible = m;
      minute.duree = Math.max(duree || 600, 300); minute.t0 = performance.now();
    }

    /* ============================================================
       5. LE DESSIN — décor (stade.js) mis en cache, pions, ballon.
       ============================================================ */
    let largeur = 0, hauteur = 0, dpr = 1, geo = null;
    let fond = null;   // le décor statique, rendu une fois par taille/thème
    function dimensionner() {
      const boite = racine.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      largeur = Math.max(boite.width, 40); hauteur = Math.max(boite.height, 30);
      canvas.width = largeur * dpr; canvas.height = hauteur * dpr;
      canvas.style.width = largeur + "px"; canvas.style.height = hauteur + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geo = ONZE_STADE.geometrie(largeur, hauteur, theme);
      // R1 : caméra fixe → le décor ne bouge JAMAIS, on le peint une fois
      fond = document.createElement("canvas");
      fond.width = Math.round(largeur * dpr); fond.height = Math.round(hauteur * dpr);
      const gf = fond.getContext("2d");
      gf.setTransform(dpr, 0, 0, dpr, 0, 0);
      ONZE_STADE.dessiner(gf, geo, theme, 0);
      // l'image d'arène peut arriver APRÈS ce premier jet : on repeint le
      // décor une fois qu'elle est là (le jeu ne l'attend jamais)
      if (theme.fond) ONZE_STADE.precharger(theme).then((prete) => {
        if (prete && fond && !detruit) ONZE_STADE.dessiner(fond.getContext("2d"), geo, theme, 0);
      });
    }
    dimensionner();
    const surResize = () => dimensionner();
    /* La conversion MÈTRES → PIXELS, le seul endroit où elle a lieu.
       Le terrain de ce match (TERRAIN.L × TERRAIN.W) est étiré dans le
       rectangle peint : le mouvement reste identique à toute taille
       d'écran, et les chiffres du football restent lisibles dans le
       code. (Le cadrage du décor sur la portion utile est l'étape 2.) */
    const X = (xm) => geo.x + ((xm + DEMI_L) / TERRAIN.L) * geo.w;
    const Y = (ym) => geo.y + ((ym + DEMI_W) / TERRAIN.W) * geo.h;
    const enPixels = (m) => (m / TERRAIN.W) * geo.h;   // une longueur verticale
    window.addEventListener("resize", surResize);
    /* L'ÉCHELLE DES PIONS (décision 33, campagne de mesures FM n°2).
       FM affiche des disques d'un diamètre ≈ 5 % de la hauteur du
       terrain. On était au double (10,4 %), et ça écrasait l'espace :
       à cette taille on ne lit plus ni les blocs ni les courses.
       Cible : diamètre 5-6 % → rayon = 2,7 % de la hauteur, avec un
       plancher de lisibilité pour les très petits écrans. */
    const rayonPion = () => Math.max(enPixels(RAYON_PION_M), 2.4);

    /* Le pion de scène, habillage ALLÉGÉ (décision 33) : à 5 % de la
       hauteur du terrain, un jeton en relief avec étoiles n'a plus de
       place — c'est anneau + numéro, comme FM. Les étoiles passent sur
       l'étiquette, le détail vit dans la fiche joueur.
       L'identité tient sur trois choses qui restent lisibles à cette
       taille : la COULEUR du camp, l'OR du gardien, l'ANNEAU du porteur. */
    function dessinerPion(p, temps) {
      const r = rayonPion() * p.echelle;
      const Xp = X(p.x), Yp = Y(p.y);
      const numeroLisible = r >= 4;      // en dessous, le chiffre ne rentre plus
      ctx.save();
      // l'ombre portée : elle décolle le pion du gazon
      ctx.beginPath();
      ctx.ellipse(Xp + r * 0.16, Yp + r * 0.55, r * 0.95, r * 0.38, 0, 0, 6.283);
      ctx.fillStyle = "rgba(0,0,0,0.34)"; ctx.fill();
      if (p.aura > 0) { ctx.shadowColor = p.auraCouleur; ctx.shadowBlur = 10; }
      else if (p.flash > 0) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 8; }
      // le disque : aplat franc + liseré sombre, pour trancher sur le vert
      ctx.beginPath(); ctx.arc(Xp, Yp, r, 0, 6.283);
      // Règle 11 : les gardiens portent des couleurs À PART — jaune d'un
      // côté, grenat de l'autre — et jamais celles de leur équipe.
      ctx.fillStyle = p.gardien ? (p.camp === "moi" ? "#F0C64B" : "#8E2F45")
        : p.camp === "moi" ? "#3DE26B" : "#E8503F";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(r * 0.16, 0.7);
      ctx.strokeStyle = "rgba(6,12,8,0.55)";
      ctx.stroke();
      // l'anneau du porteur de balle : le point focal unique
      if (ballon.porteur === p.cle) {
        ctx.beginPath(); ctx.arc(Xp, Yp, r + Math.max(r * 0.7, 2.6), 0, 6.283);
        ctx.strokeStyle = "rgba(253,248,234,0.95)";
        ctx.lineWidth = Math.max(r * 0.34, 1.3); ctx.stroke();
      }
      // le pion qui se jette : un trait de glissade derrière lui
      if (p.plonge > 0) {
        ctx.beginPath();
        ctx.moveTo(Xp - p.vx * 0.7, Yp - p.vy * 0.7);
        ctx.lineTo(Xp, Yp);
        ctx.strokeStyle = "rgba(253,248,234,0.35)"; ctx.lineWidth = r * 0.7; ctx.lineCap = "round";
        ctx.stroke();
      }
      if (numeroLisible) {
        ctx.fillStyle = p.gardien ? (p.camp === "moi" ? "#1A1405" : "#FBE9EE")
          : p.camp === "moi" ? "#04240E" : "#2A0A05";
        ctx.font = `800 ${(r * 1.15).toFixed(1)}px Archivo, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(p.num), Xp, Yp + 0.3);
      }
      ctx.restore();
    }

    /* R6 : les étiquettes, dessinées en SECOND PASSAGE — au-dessus de
       tous les pions, et surtout sans se chevaucher : quand deux
       protagonistes sont côte à côte, la seconde étiquette descend d'un
       cran plutôt que d'écraser la première.
       Leur taille ne suit PLUS celle du pion : elles doivent rester
       lisibles quand le disque devient minuscule. Ce sont elles qui
       portent le numéro et les étoiles, que le disque n'a plus la place
       d'afficher. */
    function dessinerEtiquettes() {
      const r = rayonPion();
      const taille = borne(geo.h * 0.055, 8, 11);
      ctx.save();
      ctx.font = `700 ${taille}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const hb = taille * 1.32;
      const posees = [];
      for (const p of listePions) {
        if (!p.etiquette) continue;
        const court = p.nom.length > 12 ? p.nom.slice(0, 11) + "." : p.nom;
        const etoiles = p.etoiles >= 2 ? " " + "★".repeat(Math.min(p.etoiles, 3)) : "";
        const nom = `${p.num} ${court}${etoiles}`;
        const l = ctx.measureText(nom).width + 8;
        const Xe = X(p.x);
        let yb = Y(p.y) + r + 2.5;
        // évitement : on descend tant que ça recouvre une étiquette posée
        for (let essai = 0; essai < 4; essai++) {
          const gene = posees.some((q) => Math.abs(q.X - Xe) < (q.l + l) / 2 && Math.abs(q.yb - yb) < hb + 1);
          if (!gene) break;
          yb += hb + 2;
        }
        posees.push({ X: Xe, yb, l });
        ctx.fillStyle = "rgba(8,14,10,0.78)";
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(Xe - l / 2, yb, l, hb, 3); ctx.fill(); }
        else ctx.fillRect(Xe - l / 2, yb, l, hb);
        ctx.fillStyle = p.etoiles >= 2 ? "#F2C14E" : "rgba(253,248,234,0.96)";
        ctx.fillText(nom, Xe, yb + hb * 0.16);
      }
      ctx.restore();
    }

    function dessinerBallon(x, y, z, trainee) {
      const r = Math.max(geo.h * 0.013, 2.2);   // ~la moitié d'un pion
      // l'ombre au sol : c'est elle qui donne la hauteur (le long ballon)
      const Xb = X(x), Ysol = Y(y), Yb = Ysol - enPixels(z);
      ctx.save();
      ctx.beginPath();
      const ec = 1 + z * 0.05;
      ctx.ellipse(Xb, Ysol + r * 0.5, r * 0.95 * ec, r * 0.42 * ec, 0, 0, 6.283);
      ctx.fillStyle = `rgba(0,0,0,${borne(0.34 - z * 0.012, 0.1, 0.34)})`; ctx.fill();
      for (let i = 0; i < trainee.length; i++) {
        const t = trainee[i];
        ctx.beginPath();
        ctx.arc(X(t.x), Y(t.y) - enPixels(t.z || 0), r * 0.62, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${((i + 1) / trainee.length) * 0.34})`; ctx.fill();
      }
      // le ballon est un JETON DE THÈME : halo et contour viennent du stade,
      // pour rester lisible aussi bien sur bitume sombre que sur gazon clair
      const jeton = ONZE_STADE.ballon(theme);
      ctx.shadowColor = jeton.halo; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(Xb, Yb, r * (1 + z * 0.02), 0, 6.283);
      ctx.fillStyle = jeton.corps; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(0.9, r * 0.26); ctx.strokeStyle = jeton.contour; ctx.stroke();
      ctx.restore();
    }

    function majJauge(dt) {
      jauge.affichee = lerp(jauge.affichee, jauge.cible, Math.min(1, dt * 2.2));
      if (options.jauge) {
        const v = jauge.affichee;
        const moitie = Math.min(Math.abs(v), 1) * 50;
        options.jauge.style.left = v >= 0 ? (50 - moitie) + "%" : "50%";
        options.jauge.style.width = moitie + "%";
        options.jauge.style.background = v >= 0 ? "#3DE26B" : "#E8503F";
        options.jauge.classList.toggle("pulse", jauge.pulse);
      }
      possessionPct.afficheMoi = lerp(possessionPct.afficheMoi, possessionPct.moi, Math.min(1, dt * 1.6));
      const rail = barrePossession.querySelector(".part-moi");
      if (rail) rail.style.width = possessionPct.afficheMoi.toFixed(1) + "%";
      barrePossession.querySelector(".pc-moi").textContent = Math.round(possessionPct.afficheMoi) + " %";
      barrePossession.querySelector(".pc-eux").textContent = (100 - Math.round(possessionPct.afficheMoi)) + " %";
    }
    function majMinute(temps) {
      const t = Math.min(1, (temps - minute.t0) / minute.duree);
      minute.affichee = lerp(minute.depart, minute.cible, t);
      if (options.chrono && !finDeMatch) options.chrono.textContent = `⏱ ${Math.max(1, Math.round(minute.affichee))}ᵉ`;
    }

    /* ============================================================
       6. LA BOUCLE — 60 fps. Tout le mouvement passe par ici :
       chaque pion poursuit sa cible avec inertie, jamais en
       téléportation, et le ballon suit sa physique.
       ============================================================ */
    /* INSTRUMENTATION (étape 1, design/scene-simulation.md §10). La
       scène relève ses propres chiffres AU TICK PHYSIQUE : un test qui
       échantillonne toutes les 50 ms ne verrait jamais le vrai pic
       d'accélération, il verrait la moyenne d'un intervalle inconnu.
       Coût : trois comparaisons par pion et par frame. */
    const mesures = { accelMax: 0, vitesseMax: 0, surVitesse: 0, surAccel: 0, nonFinis: 0, ticks: 0 };

    let precedent = performance.now();
    function boucle(temps) {
      if (detruit) return;
      /* Le pas de temps ne peut être ni négatif ni énorme. L'horodatage
         de requestAnimationFrame peut PRÉCÉDER le performance.now() qui a
         initialisé `precedent` : un dt négatif retournait toute la
         physique et fabriquait des NaN. */
      const dtBrut = Math.min(Math.max((temps - precedent) / 1000, 0), 0.05);
      precedent = temps;
      const dt = dtBrut * facteurTemps;

      /* Le CERVEAU décide, la PHYSIQUE exécute (décision 33). Une passe
         par frame sur 22 pions : quelques microsecondes. */
      majReferenceBloc(dtBrut);
      cerveauDePlacement();

      for (const p of listePions) {
        const cible = p.cible || { x: p.x, y: p.y };
        const dx = cible.x - p.x, dy = cible.y - p.y;
        const dist = Math.hypot(dx, dy);
        /* LA PHYSIQUE DE COURSE (design/football-chiffre.md).
           ARRIVÉE DOUCE, physiquement juste : la vitesse qu'on peut
           encore tenir sans dépasser la cible, sachant qu'on freine à
           `decel`. Le joueur ralentit en approchant au lieu de piler. */
        let vVoulue = Math.min(p.vMax, Math.sqrt(2 * p.decel * Math.max(dist, 0)));
        /* LE BRAQUAGE (mesure : ~180°/s à pleine vitesse, davantage à
           l'arrêt). Un joueur lancé ne pivote pas sur place : il décrit
           une courbe. Le plafond se desserre quand il ralentit.
           LE POINT CLÉ, et l'erreur d'une première version : on ne
           tourne pas à pleine vitesse. Faire pivoter la vitesse VOULUE
           en lui gardant sa norme, c'est demander à un joueur qui doit
           faire demi-tour d'ACCÉLÉRER dans le mauvais sens — il partait
           alors à fond vers le poteau de corner et n'en revenait jamais
           (le gardien filait à 7 m/s le long de sa ligne de touche).
           Un virage serré se paie donc en vitesse : on freine d'abord,
           on tourne ensuite. C'est ça, l'inertie. */
        const allure = Math.hypot(p.vx, p.vy);
        let ecart = 0;
        if (allure > 0.5 && dist > 0.05) {
          const cap = Math.atan2(p.vy, p.vx);
          ecart = Math.atan2(dy, dx) - cap;
          while (ecart > Math.PI) ecart -= 2 * Math.PI;
          while (ecart < -Math.PI) ecart += 2 * Math.PI;
          // plus le virage est serré, moins on peut le prendre vite
          vVoulue *= Math.max(0.12, 1 - Math.abs(ecart) / Math.PI);
        }
        let vxVoulu = dist > 0.05 ? (dx / dist) * vVoulue : 0;
        let vyVoulu = dist > 0.05 ? (dy / dist) * vVoulue : 0;
        if (allure > 0.5 && (vxVoulu || vyVoulu)) {
          const cap = Math.atan2(p.vy, p.vx);
          const plafond = p.braquage * (1 + 2 * (1 - Math.min(1, allure / p.vMax))) * dtBrut;
          if (Math.abs(ecart) > plafond) {
            const nouveau = cap + Math.sign(ecart) * plafond;
            const norme = Math.hypot(vxVoulu, vyVoulu);
            vxVoulu = Math.cos(nouveau) * norme;
            vyVoulu = Math.sin(nouveau) * norme;
          }
        }
        /* ACCÉLÉRER et FREINER n'ont pas le même budget : 3,5 m/s²
           pour lancer la machine, 5 m/s² pour l'arrêter. */
        const ax = vxVoulu - p.vx, ay = vyVoulu - p.vy;
        const norme = Math.hypot(ax, ay);
        const budget = (Math.hypot(vxVoulu, vyVoulu) >= allure ? p.accel : p.decel) * dtBrut;
        const k = norme > budget ? budget / norme : 1;
        const vxAvant = p.vx, vyAvant = p.vy;
        p.vx += ax * k; p.vy += ay * k;
        /* Le relevé, pris AU TICK. Une vitesse non finie n'est pas une
           mesure : c'est un défaut, et on le compte comme tel plutôt que
           de laisser un NaN contaminer les maxima. */
        const allureApres = Math.hypot(p.vx, p.vy);
        if (!isFinite(allureApres)) { mesures.nonFinis++; } else {
          if (dtBrut > 0.001) {
            const acc = Math.hypot(p.vx - vxAvant, p.vy - vyAvant) / dtBrut;
            if (isFinite(acc)) {
              mesures.accelMax = Math.max(mesures.accelMax, acc);
              if (acc > p.decel + 0.5) mesures.surAccel++;
            }
          }
          mesures.vitesseMax = Math.max(mesures.vitesseMax, allureApres);
          if (allureApres > p.vMax + 0.05) mesures.surVitesse++;
        }
        mesures.ticks++;
        p.x = borne(p.x + p.vx * dt, -DEMI_L, DEMI_L);
        p.y = borne(p.y + p.vy * dt, -DEMI_W, DEMI_W);
        // filet : un pion ne peut pas sortir de la réalité (voir `borne`)
        if (!isFinite(p.vx) || !isFinite(p.vy)) { p.vx = 0; p.vy = 0; }
        // une cible SCÉNARISÉE atteinte se relâche : le cerveau reprend la main
        if ((p.cx !== null || p.cy !== null) && dist < 1) { p.cx = null; p.cy = null; p.roleScenario = null; }
        if (p.aura > 0) p.aura -= dtBrut * 1000;
        if (p.flash > 0) p.flash -= dtBrut * 1000;
        if (p.plonge > 0) p.plonge -= dtBrut * 1000;
      }
      // R4 : espacement en jeu ouvert, mêlées permises dans la surface
      separerDisques(listePions, TERRAIN, RAYON_PION_M);
      majFigurants(dt, dtBrut);      // règle 11 : arbitre et assistants
      majBallon(dt);

      // le tampon du replay (~3 s à 30 états/s)
      if (!replay && (!tampon.length || temps - tampon[tampon.length - 1].t > 33)) {
        tampon.push({ t: temps, bx: ballon.x, by: ballon.y, bz: ballon.z,
          pos: listePions.map((p) => [p.x, p.y]) });
        if (tampon.length > 95) tampon.shift();
      }
      for (const camp of ["moi", "eux"]) {
        if (tremblements[camp] > 0) tremblements[camp] = Math.max(0, tremblements[camp] - dtBrut * 0.9);
      }

      // ---- peinture ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fond, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (replay) {
        const etat = replay.etats[Math.min(Math.floor(replay.indice), replay.etats.length - 1)];
        replay.indice += 0.45;
        if (replay.indice >= replay.etats.length) replay = null;
        if (etat) {
          listePions.forEach((p, i) => dessinerPion({ ...p, x: etat.pos[i][0], y: etat.pos[i][1] }, temps));
          dessinerBallon(etat.bx, etat.by, etat.bz || 0, []);
          ctx.fillStyle = "rgba(6, 12, 8, 0.14)";
          ctx.fillRect(0, 0, largeur, hauteur);
        }
      } else {
        dessinerFigurants();          // sous les joueurs : ils ne masquent rien
        for (const p of listePions) dessinerPion(p, temps);
        dessinerEtiquettes();
        dessinerBallon(ballon.x, ballon.y, ballon.z, ballon.trainee);
        if (facteurTemps < 1) {  // le micro-ralenti : un voile et le ballon appuyé
          ctx.fillStyle = "rgba(6, 12, 8, 0.22)";
          ctx.fillRect(0, 0, largeur, hauteur);
          dessinerBallon(ballon.x, ballon.y, ballon.z, []);
        }
      }
      ONZE_STADE.dessinerCages(ctx, geo, theme, tremblements, temps);
      ONZE_STADE.dessinerAmbiance(ctx, geo, theme);

      majJauge(dtBrut);
      majMinute(temps);
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);
    repos();
    // le cerveau tourne une fois AVANT la première frame : sans ça, la
    // scène existe un instant sans que personne ait de raison d'être là
    cerveauDePlacement();

    /* ============================================================
       7. L'API rendue à match-ui.js
       ============================================================ */
    return {
      racine, cut, miseEnPlace, jouerTemps, repos, commentaire, majPossession,
      timeline: programmerTimeline,
      majJaugeCible, reglerMinute, dominationDe,
      /* Les autres scores du lobby, en toast discret pendant les temps
         morts (le lobby vit pendant ton match). */
      notifierLobby: (texte) => {
        // « Affichage des temps morts » : les derniers scores du lobby
        if (reg.tempsMorts !== "scores" && reg.tempsMorts !== "les-deux") return;
        const toast = document.createElement("div");
        toast.className = "toast-lobby";
        toast.textContent = texte;
        couche.appendChild(toast);
        setTimeout(() => toast.classList.add("visible"), 30);
        setTimeout(() => { toast.classList.remove("visible"); setTimeout(() => toast.remove(), 400); }, 2300);
      },
      /* Un événement non rendu (hors temps fort) : il n'est PAS mis en
         scène — R2 : plus de régime intermédiaire. On garde seulement
         l'accent sonore des presque-buts, qui appartient au récit. */
      accent: (ev) => {
        if (typeof ONZE_JUICE !== "undefined" && ev && ev.pres) ONZE_JUICE.jouer("ohhh");
      },
      fin: () => {
        finDeMatch = true; jauge.pulse = false; replay = null; facteurTemps = 1;
        repos();
      },
      diagnostic: () => ({
        styles, regime, possession, situation: situationCourante,
        // R1 : le cadre du terrain — il ne doit JAMAIS bouger (caméra fixe)
        cadre: geo ? { x: geo.x, y: geo.y, w: geo.w, h: geo.h } : null,
        // décision 50 : le terrain en MÈTRES (densité 324 m²/joueur) —
        // tout le diagnostic parle mètres, la conversion en pixels ne
        // sert qu'au dessin
        terrain: { L: TERRAIN.L, W: TERRAIN.W },
        // étape 1 : les relevés de physique, pris au tick
        mesures: { ...mesures },
        // décision 33 : l'échelle des pions, mesurée par la recette
        rayonPion: geo ? rayonPion() : null,
        rayonPionM: RAYON_PION_M,
        ratioPion: geo ? (2 * rayonPion()) / geo.h : null,
        jauge: { affichee: jauge.affichee, cible: jauge.cible },
        possessionPct: { moi: possessionPct.moi, eux: possessionPct.eux },
        nbDisques: listePions.length,
        ballon: { x: ballon.x, y: ballon.y, z: ballon.z, porteur: ballon.porteur, enVol: !!ballon.vol },
        minute: minute.affichee, porteur: ballon.porteur,
        etiquettes: listePions.filter((p) => p.etiquette).map((p) => p.nom),
        theme: theme.nom, replayEnCours: !!replay,
        timeline: { total: tfTotal, courant: tfCourant },
        // règle 11 : les personnages du décor
        figurants: { arbitre: { x: arbitre.x, y: arbitre.y },
          assistants: assistants.map((a) => ({ x: a.x, y: a.y })) },
        positions: listePions.map((p) => ({ nom: p.nom, cle: p.cle, camp: p.camp, x: p.x, y: p.y, base: p.baseX,
          vitesse: Math.hypot(p.vx, p.vy),          // m/s
          vx: p.vx, vy: p.vy,                       // pour mesurer l'accélération
          cap: Math.atan2(p.vy, p.vx),   // pour mesurer le braquage
          vMax: p.vMax, accel: p.accel, decel: p.decel,
          porteur: ballon.porteur === p.cle,
          // décision 33 : « pourquoi es-tu là ? » — la raison, et la cible
          role: p.role, marque: p.marque || null,
          cible: p.cible ? { x: p.cible.x, y: p.cible.y } : null,
          ecartCible: p.cible ? Math.hypot(p.cible.x - p.x, p.cible.y - p.y) : null })),
        ligneDefensive: { moi: hauteurLigne("moi"), eux: hauteurLigne("eux") },
        // la clé (camp|nom) : un homonyme dans l'autre camp ne doit pas
        // pouvoir se faire passer pour lui
        receveurAttendu: (() => { const r = receveurAttendu(); return r ? r.cle : null; })(),
      }),
      detruire: () => {
        detruit = true;
        window.removeEventListener("resize", surResize);
        racine.remove();
      },
    };
  }

  /* ============================================================
     8. L'ESPACEMENT DES PIONS (R4).
     En jeu ouvert, deux pions ne se recouvrent jamais à plus de
     ~20 % : la lisibilité prime. DANS LA SURFACE, la contrainte
     se relâche — une mêlée qui se bouscule est une INFORMATION,
     pas un défaut. Fonction pure, appelée à chaque frame.
     ============================================================ */
  function separerDisques(disques, terrain, rayonM) {
    const L = (terrain && terrain.L) || 104, W = (terrain && terrain.W) || 68;
    const demiL = L / 2, demiW = W / 2;
    // la surface de réparation : 16,5 m de la ligne de but, 40,3 m de large
    const dansLaSurface = (d) => Math.abs(d.x) > demiL - 16.5 && Math.abs(d.y) < 20.15;
    for (let i = 0; i < disques.length; i++) {
      for (let j = i + 1; j < disques.length; j++) {
        const a = disques[i], b = disques[j];
        const melee = dansLaSurface(a) && dansLaSurface(b);
        const facteur = melee ? 0.62 : 0.8;
        const minDist = facteur * (rayonM * (a.echelle || 1) + rayonM * (b.echelle || 1));
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.001) { dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); }
        const norme = Math.hypot(dx, dy);
        const pousse = (minDist - dist) / 2;
        const ux = (dx / norme) * pousse, uy = (dy / norme) * pousse;
        a.x -= ux; a.y -= uy;
        b.x += ux; b.y += uy;
      }
    }
    for (const d of disques) {
      d.x = Math.max(-demiL, Math.min(demiL, d.x));
      d.y = Math.max(-demiW, Math.min(demiW, d.y));
    }
  }

  return { creer, couleurFamille, styleDe, construireAction, separerDisques,
           reglages, majReglages, REGLAGES_DEFAUT };
})();

if (typeof module !== "undefined") module.exports = ONZE_SCENE;
