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
    stade: "municipal",   // le thème de stade (R13)
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

  const ligneDuJoueur = (j) => j.ligne || j.poste;
  const lerp = (a, b, t) => a + (b - a) * t;
  const borne = (v, min, max) => Math.max(min, Math.min(max, v));

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
    const xLigne = (camp, ligne) => {
      const base = { "GAR": 5, "DÉF": 22, "MIL": 38, "ATT": 50 }[ligne] || 40;
      const st = styles[camp];
      let x = base;
      if (st.style === "catenaccio" && ligne !== "GAR") x -= 6;
      if (st.style === "kickrush" && ligne === "ATT") x += 5;
      if (st.style === "grinta" && ligne !== "GAR") x += 3;
      if (st.style === "tiki" && ligne === "MIL") x += 2;
      return camp === "moi" ? x : 100 - x;
    };
    const BUTS = { moi: { x: 1.5, y: 50 }, eux: { x: 98.5, y: 50 } };
    const sensDe = (camp) => (camp === "moi" ? 1 : -1);   // vers quel but on attaque
    /* Un joueur de champ ne va JAMAIS au fond du terrain : sans cette
       borne, une percée « course » finit le tireur sur le poteau de
       corner et la frappe n'a plus de sens. */
    const dansLeJeu = (x) => borne(x, 11, 89);

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
          let y = n === 1 ? 50 : 16 + (68 * i) / (n - 1);
          if (st.couloirs && n >= 2 && (i === 0 || i === n - 1)) y = i === 0 ? 10 : 90;
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
            vMax: 11 + (vit / 100) * 13,  // 11 à 24 % de terrain / seconde
            accel: 3.2 + (vit / 100) * 2.6,
            role: null, etiquette: false, aura: 0, auraCouleur: null, flash: 0,
            echelle: 1, phase: Math.random() * 6.28, plonge: 0,
          };
          pions[j.nom] = p;
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
      x: 50, y: 50, z: 0, vx: 0, vy: 0,
      porteur: null,   // nom du pion qui conduit
      vol: null,       // { x0,y0,x1,y1, t, duree, hauteur, versNom, apres }
      trainee: [],
    };
    const campDe = (nomEquipe) => (nomEquipe === eqA.nom ? "moi" : "eux");
    const adverse = (camp) => (camp === "moi" ? "eux" : "moi");
    const pionDe = (nom) => pions[nom] || null;
    const gardienDe = (camp) => listePions.find((p) => p.camp === camp && p.gardien) || null;

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
    const butsMarques = { moi: 0, eux: 0 };
    let cartonCut = null;

    /* ---- Le replay de but : un tampon des ~3 s précédentes ---- */
    const tampon = [];
    let replay = null;

    /* ============================================================
       4.1 LES COMPORTEMENTS AMBIANTS — ce qui fait « vrai match »
       même quand aucun temps n'est joué (R4).
       ============================================================ */

    /* Le coulissement des blocs : les deux équipes suivent le ballon.
       Celle qui attaque monte et s'étire, celle qui défend recule et se
       resserre. C'est la lecture « qui domine » en un coup d'œil. */
    function cibleAmbiante(p) {
      const sens = sensDe(p.camp);
      if (p.gardien) {
        // le gardien ajuste sur sa ligne, et sort quand ça chauffe
        const but = BUTS[p.camp];
        const proche = Math.abs(ballon.x - but.x) < 22;
        const sortie = proche ? borne((22 - Math.abs(ballon.x - but.x)) * 0.35, 0, 7) : 0;
        return {
          x: but.x + sens * (2.5 + sortie),
          y: 50 + (ballon.y - 50) * (proche ? 0.55 : 0.3),
        };
      }
      const attaque = possession === p.camp;
      // le glissement longitudinal : le bloc suit la ligne du ballon
      const glisse = (ballon.x - 50) * (attaque ? 0.62 : 0.66);
      // la compression latérale : on se resserre du côté du ballon
      const resserre = attaque ? 0.94 : 0.80;
      const glisseY = (ballon.y - 50) * (attaque ? 0.20 : 0.34);
      let x = p.baseX + glisse;
      let y = 50 + (p.baseY - 50) * resserre + glisseY;
      // l'étirement de l'attaque : les attaquants prennent la profondeur
      if (attaque && p.ligne === "ATT") x += sens * 5;
      if (!attaque && p.ligne === "ATT") x -= sens * 3;  // le repli du premier rideau
      // la dérive permanente : personne n'est jamais figé
      const t = performance.now();
      x += Math.sin(t * 0.0011 + p.phase) * 1.1;
      y += Math.cos(t * 0.0009 + p.phase * 1.3) * 1.4;
      return { x: borne(x, 2, 98), y: borne(y, 4, 96) };
    }

    /* Le pressing : les deux défenseurs les plus proches du ballon
       viennent dessus, côté but (ils ne traversent pas le porteur). */
    function appliquerPressing() {
      if (!possession) return;
      const camp = adverse(possession);
      const sens = sensDe(camp);
      const proches = listePions
        .filter((p) => p.camp === camp && !p.gardien && p.cx === null)
        .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))
        .slice(0, 2);
      for (const p of proches) {
        p.role = "pressing";
        p.presseX = ballon.x - sens * 2.5;
        p.presseY = ballon.y + (p.y > ballon.y ? 1.2 : -1.2);
      }
    }

    /* ============================================================
       4.2 LA PHYSIQUE DU BALLON
       ============================================================ */
    /* Le ballon part TOUJOURS d'où il est (jamais du passeur théorique :
       ce serait une téléportation) et vise le receveur, devant sa course. */
    function passer(deNom, versNom, opts = {}) {
      const vers = pionDe(versNom);
      // R4 : la passe est donnée DEVANT la course du receveur
      const avance = opts.devantLaCourse === false ? 0 : 0.28;
      const x1 = vers ? borne(vers.x + vers.vx * avance, 2, 98) : (opts.x1 !== undefined ? opts.x1 : ballon.x);
      const y1 = vers ? borne(vers.y + vers.vy * avance, 3, 97) : (opts.y1 !== undefined ? opts.y1 : ballon.y);
      const dist = Math.hypot(x1 - ballon.x, y1 - ballon.y);
      const vitesse = opts.vitesse || 62;                       // % de terrain / seconde
      ballon.porteur = null;
      ballon.vol = {
        x0: ballon.x, y0: ballon.y, x1, y1, t: 0,
        duree: Math.max(0.14, dist / vitesse),
        hauteur: opts.cloche ? Math.min(dist * 0.11, 9) : (opts.hauteur || 0),
        versNom: vers ? vers.nom : null,
        apres: opts.apres || null,
      };
      return ballon.vol.duree;
    }
    function frapper(deNom, campAttaque, opts = {}) {
      const but = BUTS[adverse(campAttaque)];
      const cible = {
        x1: but.x + sensDe(campAttaque) * -0.5,
        y1: borne(50 + (opts.cote || 0) * 6, 41, 59),
      };
      return passer(deNom, null, { ...cible, vitesse: opts.vitesse || 105, hauteur: opts.hauteur || 2.5, apres: opts.apres });
    }
    /* Donner le ballon à un joueur : s'il est loin, le ballon y VOYAGE
       (R4 — aucune téléportation, jamais, même sur un changement de
       porteur). S'il est déjà dans ses pieds, on l'accroche. */
    function donnerLeBallon(nom, vitesse) {
      const p = pionDe(nom);
      if (!p) return 0;
      const dist = Math.hypot(p.x - ballon.x, p.y - ballon.y);
      if (dist < 3.5 && !ballon.vol) { ballon.vol = null; ballon.porteur = p.nom; return 0; }
      return passer(null, nom, { vitesse: vitesse || 64, devantLaCourse: false });
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
        const devant = 1.6 + Math.min(v / 14, 1) * 2.2;
        const cibleX = p.x + ux * devant, cibleY = p.y + uy * devant;
        const dx = cibleX - ballon.x, dy = cibleY - ballon.y;
        const d = Math.hypot(dx, dy);
        // le ballon roule vers le pied, à vitesse de course + marge
        const vBallon = Math.max(v * 1.6, 26);
        const pas = Math.min(d, vBallon * dt);
        if (d > 0.001) { ballon.x += (dx / d) * pas; ballon.y += (dy / d) * pas; }
        ballon.z = 0;
      } else {
        // ballon libre : il roule et s'arrête
        ballon.x += ballon.vx * dt; ballon.y += ballon.vy * dt;
        ballon.vx *= 0.94; ballon.vy *= 0.94;
        ballon.x = borne(ballon.x, 1, 99); ballon.y = borne(ballon.y, 2, 98);
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

    /* ---- LE CUT (R2) : carton sec minute + score entre deux temps forts ---- */
    function cut(info, duree = 900) {
      regime = "cut";
      bande.classList.remove("visible");
      barrePossession.classList.remove("visible");
      const carte = document.createElement("div");
      carte.className = "carton-cut";
      carte.innerHTML =
        `<div class="cut-minute">${info.minute}ᵉ</div>` +
        `<div class="cut-score"><span>${info.nomA || eqA.nom}</span>` +
        `<strong>${info.scoreA} – ${info.scoreB}</strong>` +
        `<span>${info.nomB || eqB.nom}</span></div>`;
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
      situationCourante = situation;
      possession = camp;
      const sens = sensDe(camp);
      // où naît l'action, selon la situation (données du moteur)
      const zone = {
        placee: { x: 50 + sens * 6, y: 50 },
        contre: { x: 50 - sens * 12, y: 50 },
        aile: { x: 50 + sens * 22, y: Math.random() < 0.5 ? 14 : 86 },
        aerien: { x: 50 + sens * 26, y: 50 },
        long: { x: 50 - sens * 14, y: 50 },
      }[situation] || { x: 50, y: 50 };

      for (const p of listePions) {
        p.cx = null; p.cy = null; p.role = null; p.etiquette = false;
        if (p.gardien) continue;
        const attaque = p.camp === camp;
        // le bloc se pose autour de la zone de naissance de l'action
        const glisse = (zone.x - 50) * (attaque ? 0.62 : 0.66);
        p.cx = borne(p.baseX + glisse + (attaque && p.ligne === "ATT" ? sensDe(p.camp) * 5 : 0), 4, 96);
        p.cy = borne(50 + (p.baseY - 50) * (attaque ? 0.94 : 0.80) + (zone.y - 50) * (attaque ? 0.24 : 0.38), 5, 95);
      }
      // le ballon rejoint le premier acteur de la séquence
      const premier = sequence.find && sequence.find((t) => t.acteur || t.de);
      const nomPremier = premier ? (premier.acteur || premier.de) : null;
      const porteur = nomPremier && pionDe(nomPremier);
      if (porteur) {
        porteur.cx = borne(zone.x, 5, 95); porteur.cy = borne(zone.y, 6, 94);
        // le ballon est à SES pieds tout de suite : il l'emmène en glissant
        // la mise en place suit un CUT : c'est le seul endroit où le
        // ballon peut se reposer d'un coup — la coupe le justifie.
        ballon.vol = null; ballon.porteur = porteur.nom;
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
        return Math.hypot(x - zone.x, (y - zone.y) * 0.55) < 30;
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
    function etiqueter(noms) {
      if (!reg.etiquettes) return;
      const set = new Set((noms || []).filter(Boolean));
      for (const p of listePions) p.etiquette = set.has(p.nom);
    }
    function etiqueterTous() {
      if (!reg.etiquettes) return;
      for (const p of listePions) p.etiquette = true;
    }
    /* Les courses d'appel : le terrain vit autour du porteur */
    function coursesAppel(camp, sauf) {
      const sens = sensDe(camp);
      listePions
        .filter((p) => p.camp === camp && !p.gardien && !(sauf || []).includes(p.nom))
        .sort((a, b) => (b.ligne === "ATT") - (a.ligne === "ATT"))
        .slice(0, 3)
        .forEach((p, i) => {
          p.cx = borne(p.x + sens * (7 + i * 3), 5, 95);
          p.cy = borne(p.y + (i % 2 ? 7 : -7), 6, 94);
          p.role = "appel";
        });
    }

    function jouerTemps(t, duree, surIssue) {
      const ms = Math.max(400, duree || 800);
      const camp = t.equipe ? campDe(t.equipe) : "moi";
      const sens = sensDe(camp);
      if (!t.issue) regime = "action";

      switch (t.type) {

        case "recuperation": {
          const p = pionDe(t.acteur);
          possession = camp;
          if (p) {
            p.flash = 420;
            donnerLeBallon(p.nom, 70);
            p.cx = borne(p.x + sens * 5, 5, 95); p.cy = p.y;
            etiqueter([p.nom]);
            coursesAppel(camp, [p.nom]);
          }
          break;
        }

        case "contre": {
          possession = camp;
          const p = pionDe(t.acteur);
          if (p) { donnerLeBallon(p.nom, 80); p.flash = 400; etiqueter([p.nom]); }
          // tout le bloc part vers l'avant : c'est CE mouvement qui dit « contre »
          for (const q of listePions) {
            if (q.camp !== camp || q.gardien) continue;
            q.cx = borne(q.x + sens * (14 + (q.ligne === "ATT" ? 10 : 0)), 5, 95);
            q.cy = borne(q.y + (Math.sin(q.phase) * 6), 6, 94);
            q.role = "contre";
          }
          // la défense adverse est prise à revers : elle se replie en courant
          for (const q of listePions) {
            if (q.camp === camp || q.gardien) continue;
            q.cx = borne(q.x - sens * 12, 5, 95);
            q.role = "repli";
          }
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "relais": {
          possession = camp;
          const de = pionDe(t.de), vers = pionDe(t.vers);
          if (vers) {
            const cadence = { tiki: 78, kickrush: 95, catenaccio: 58, rue: 62, total: 74, grinta: 80 };
            passer(t.de, t.vers, { vitesse: cadence[styles[camp].style] || 70 });
            if (de) { de.cx = borne(de.x + sens * 4, 5, 95); de.role = "suit"; }   // il suit sa passe
            vers.cx = borne(vers.x + sens * 4, 5, 95);
            etiqueter([t.de, t.vers]);
            coursesAppel(camp, [t.de, t.vers]);
          }
          break;
        }

        case "relais_long": {
          possession = camp;
          const vers = pionDe(t.vers);
          if (vers) {
            // la cloche : le ballon monte, l'ombre au sol le trahit
            vers.cx = borne(vers.x + sens * 12, 5, 95);
            vers.cy = borne(vers.y + (Math.sin(vers.phase) * 5), 6, 94);
            passer(t.de, t.vers, { vitesse: 52, cloche: true });
          } else {
            passer(t.de, null, { x1: borne(50 + sens * 30, 5, 95), y1: 30 + Math.random() * 40, vitesse: 52, cloche: true });
          }
          etiqueter([t.de, t.vers]);
          coursesAppel(camp, [t.de, t.vers]);
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "conduite": {
          possession = camp;
          const p = pionDe(t.acteur);
          if (p) {
            donnerLeBallon(p.nom, 66);
            // la Rue : conduite en crochets, le pion serpente vers le but
            p.cx = borne(p.x + sens * 13, 5, 95);
            p.cy = borne(p.y + (Math.sin(performance.now() * 0.002 + p.phase) * 11), 6, 94);
            p.role = "conduite";
            etiqueter([p.nom]);
            coursesAppel(camp, [p.nom]);
          }
          break;
        }

        case "geste": {
          possession = camp;
          const p = pionDe(t.acteur);
          if (p) {
            donnerLeBallon(p.nom, 66);
            p.cx = borne(p.x + sens * 7, 5, 95);
            p.cy = borne(p.y + 6 * (Math.random() < 0.5 ? 1 : -1), 6, 94);
            ephemere("eclat-geste", p.x, p.y, "✨", ms);
            etiqueter([p.nom]);
            // le défenseur le plus proche part dans le décor
            const battu = listePions.filter((q) => q.camp !== camp && !q.gardien)
              .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
            if (battu) { battu.plonge = 420; battu.cx = borne(battu.x - sens * 4, 5, 95); battu.cy = borne(battu.y + 6, 6, 94); }
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "percee": {
          possession = camp;
          const p = pionDe(t.acteur), battu = pionDe(t.battu);
          etiqueter([t.acteur, t.battu]);
          if (p) {
            p.role = "percee";
            if (t.sousType === "course") {
              // le sprint dans le couloir : il prend la profondeur, plein axe
              const couloir = p.y < 50 ? Math.max(10, p.y - 8) : Math.min(90, p.y + 8);
              p.cx = dansLeJeu(p.x + sens * 22); p.cy = couloir;
              donnerLeBallon(p.nom, 76);
            } else if (t.sousType === "dribble") {
              // le crochet sec : un décalage latéral franc devant le défenseur
              p.cx = dansLeJeu(p.x + sens * 12);
              p.cy = borne(p.y + (battu && battu.y > p.y ? -9 : 9), 8, 92);
              donnerLeBallon(p.nom, 70);
              ephemere("eclat-geste", p.x, p.y, "⚡", ms * 0.8);
            } else if (t.sousType === "aerien") {
              // le duel aérien : cloche vers lui, il saute (l'échelle grandit)
              const cible = { x: dansLeJeu(p.x + sens * 10), y: p.y };
              p.cx = cible.x; p.cy = cible.y;
              passer(null, null, { x1: cible.x, y1: cible.y, vitesse: 48, cloche: true,
                apres: () => { p.echelle = 1.35; setTimeout(() => { if (!detruit) p.echelle = 1; }, 320); } });
            } else { // centre
              // le centre traverse la surface, devant la course des attaquants
              const cibleAtt = listePions.filter((q) => q.camp === camp && !q.gardien && q !== p)
                .sort((a, b) => Math.abs(b.x - BUTS[adverse(camp)].x) * -1 - Math.abs(a.x - BUTS[adverse(camp)].x) * -1)[0];
              if (cibleAtt) { cibleAtt.cx = dansLeJeu(BUTS[adverse(camp)].x - sens * 12); cibleAtt.cy = borne(45 + Math.random() * 10, 25, 75); }
              passer(p.nom, cibleAtt ? cibleAtt.nom : null, { vitesse: 74, cloche: true });
            }
          }
          if (battu) {
            // le défenseur battu se JETTE — et se retrouve à contretemps
            battu.plonge = 520;
            battu.cx = borne(battu.x - sens * 3, 4, 96);
            battu.cy = borne(battu.y + (p && p.cy !== null ? (battu.y - p.cy) * 0.4 : 4), 5, 95);
            battu.role = "battu";
          }
          coursesAppel(camp, [t.acteur, t.battu]);
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "stop": {
          const p = pionDe(t.acteur);
          possession = camp;
          if (p) {
            p.flash = 480; p.plonge = 320;
            donnerLeBallon(p.nom, 72);
            etiqueter([t.acteur]);
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        case "hors_jeu": {
          const attaquant = listePions.filter((q) => q.camp !== camp && !q.gardien)
            .sort((a, b) => Math.abs(b.x - 50) - Math.abs(a.x - 50))[0];
          if (attaquant) { attaquant.cx = borne(attaquant.x + sensDe(attaquant.camp) * 10, 5, 95); etiqueter([attaquant.nom]); }
          ephemere("chip-arbitre", ballon.x, ballon.y, "🚩 Hors-jeu", ms);
          chipEtSynergie(t.ev, ballon, ms);
          break;
        }

        case "rebond": {
          const p = pionDe(t.acteur);
          possession = camp;
          if (p) {
            p.cx = borne(ballon.x, 5, 95); p.cy = borne(ballon.y, 6, 94);
            p.role = "rebond";
            etiqueter([t.acteur]);
            setTimeout(() => { if (!detruit) donnerLeBallon(p.nom, 60); }, ms * 0.5);
          }
          chipEtSynergie(t.ev, p || ballon, ms);
          break;
        }

        /* --- LE TEMPS DÉCISIF : l'armement. Le ballon NE PART PAS
           encore : le tireur se place, le gardien ferme l'angle, les
           défenseurs se jettent. Personne ne peut deviner l'issue. --- */
        case "frappe": {
          possession = camp;
          const tireur = pionDe(t.tireur);
          const gk = gardienDe(adverse(camp));
          etiqueter([t.tireur, t.passeur, gk && gk.nom]);
          if (tireur) {
            donnerLeBallon(tireur.nom, 74);
            // il se replace dans un angle jouable : ni sur la ligne de but,
            // ni dans le couloir — entre 12 et 26 % du fond, axe resserré
            const but = BUTS[adverse(camp)];
            const distanceBut = borne(Math.abs(tireur.x - but.x), 12, 26);
            tireur.cx = borne(but.x - sens * distanceBut, 11, 89);
            tireur.cy = borne(lerp(tireur.y, 50, 0.45), 24, 76);
            tireur.role = "tireur";
          }
          if (gk) { gk.cx = borne(BUTS[gk.camp].x + sensDe(gk.camp) * 4, 2, 98); gk.cy = borne(lerp(50, ballon.y, 0.6), 40, 60); }
          // deux défenseurs se jettent dans la trajectoire (mêlée permise)
          listePions.filter((q) => q.camp !== camp && !q.gardien)
            .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))
            .slice(0, 2).forEach((q) => { q.cx = borne(ballon.x - sens * 2, 4, 96); q.cy = borne(ballon.y + (q.y > ballon.y ? 2 : -2), 5, 95); });
          break;
        }

        /* --- LES ISSUES : même départ de frappe pour les trois. La
           révélation (texte + effet) tombe à ~55 % du temps. --- */
        case "issue_but":
        case "issue_arret":
        case "issue_blocage": {
          possession = camp;
          const tireur = pionDe(t.tireur);
          const gk = pionDe(t.gardien) || gardienDe(adverse(camp));
          const cote = (Math.abs((tireur ? tireur.y : 50) - 50) > 8 ? ((tireur.y < 50) ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1));
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
              if (gk) { gk.plonge = 640; gk.flash = 500; gk.cy = borne(50 + cote * 7, 40, 60); }
              ballon.vol = null; ballon.porteur = null;
              ballon.vx = sensDe(adverse(camp)) * 22; ballon.vy = cote * 12;
              if (t.pres) ephemere("chip-arbitre", 50, 22, "OHHH !", 900);
            } else {
              const mur = listePions.filter((q) => q.camp !== camp && !q.gardien)
                .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))[0];
              if (mur) { mur.plonge = 520; mur.flash = 480; }
              ballon.vol = null; ballon.porteur = null;
              ballon.vx = sensDe(adverse(camp)) * 16; ballon.vy = cote * 10;
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
          if (gk) { gk.cx = borne(BUTS[gk.camp].x + sensDe(gk.camp) * 2.5, 1, 99); }
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
    }
    dimensionner();
    const surResize = () => dimensionner();
    window.addEventListener("resize", surResize);
    const rayonPion = () => Math.max(geo.h * 0.052, 7.5);

    function dessinerPion(p, temps) {
      const r = rayonPion() * p.echelle;
      const X = geo.px(p.x), Y = geo.py(p.y);
      ctx.save();
      // l'ombre portée sur le gazon
      ctx.beginPath();
      ctx.ellipse(X + r * 0.18, Y + r * 0.62, r * 0.92, r * 0.34, 0, 0, 6.283);
      ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.fill();
      if (p.aura > 0) { ctx.shadowColor = p.auraCouleur; ctx.shadowBlur = 14; }
      else if (p.flash > 0) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 10; }
      // le jeton en relief (DA Arcade, Lot 3) : lumière haut-gauche
      const grad = ctx.createRadialGradient(X - r * 0.36, Y - r * 0.48, r * 0.15, X, Y, r);
      if (p.gardien) { grad.addColorStop(0, "#F8DE8E"); grad.addColorStop(1, "#B8860B"); }
      else if (p.camp === "moi") { grad.addColorStop(0, "#4FE07E"); grad.addColorStop(1, "#1B7A3A"); }
      else { grad.addColorStop(0, "#E87F6F"); grad.addColorStop(1, "#8E2E1F"); }
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.283);
      ctx.fillStyle = grad; ctx.fill();
      ctx.shadowBlur = 0;
      const ombre = ctx.createLinearGradient(X, Y - r, X, Y + r);
      ombre.addColorStop(0.55, "rgba(0,0,0,0)");
      ombre.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = ombre; ctx.fill();
      // l'anneau du porteur de balle : le point focal unique
      if (ballon.porteur === p.nom) {
        ctx.beginPath(); ctx.arc(X, Y, r + 3.4 + Math.sin(temps * 0.008) * 1.1, 0, 6.283);
        ctx.strokeStyle = "rgba(253,248,234,0.92)"; ctx.lineWidth = 1.8; ctx.stroke();
      }
      // le pion qui se jette : un trait de glissade derrière lui
      if (p.plonge > 0) {
        ctx.beginPath();
        ctx.moveTo(X - p.vx * 0.9, Y - p.vy * 0.9);
        ctx.lineTo(X, Y);
        ctx.strokeStyle = "rgba(253,248,234,0.35)"; ctx.lineWidth = r * 0.5; ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.fillStyle = p.gardien ? "#1A1405" : p.camp === "moi" ? "#04240E" : "#1F0704";
      ctx.font = `800 ${Math.max(r * 0.9, 7)}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(p.num), X, Y + 0.5);
      if (p.etoiles >= 2) {
        ctx.fillStyle = "#F2C14E";
        ctx.font = `${Math.max(r * 0.5, 6)}px system-ui, sans-serif`;
        ctx.fillText("★".repeat(Math.min(p.etoiles, 3)), X, Y - r - 3.5);
      }
      // R6 : l'étiquette de nom, seulement sur les protagonistes
      if (p.etiquette) {
        const nom = p.nom.length > 12 ? p.nom.slice(0, 11) + "." : p.nom;
        ctx.font = `700 ${Math.max(r * 0.62, 7)}px Archivo, system-ui, sans-serif`;
        const l = ctx.measureText(nom).width + 8;
        const yb = Y + r + 3;
        ctx.fillStyle = "rgba(8,14,10,0.72)";
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(X - l / 2, yb, l, r * 1.05, 3); ctx.fill(); }
        else ctx.fillRect(X - l / 2, yb, l, r * 1.05);
        ctx.fillStyle = "rgba(253,248,234,0.94)";
        ctx.textBaseline = "top";
        ctx.fillText(nom, X, yb + r * 0.18);
      }
      ctx.restore();
    }

    function dessinerBallon(x, y, z, trainee) {
      const r = Math.max(geo.h * 0.017, 3);
      // l'ombre au sol : c'est elle qui donne la hauteur (le long ballon)
      const X = geo.px(x), Ysol = geo.py(y), Y = Ysol - geo.uy(z);
      ctx.save();
      ctx.beginPath();
      const ec = 1 + z * 0.05;
      ctx.ellipse(X, Ysol + r * 0.5, r * 0.95 * ec, r * 0.42 * ec, 0, 0, 6.283);
      ctx.fillStyle = `rgba(0,0,0,${borne(0.34 - z * 0.012, 0.1, 0.34)})`; ctx.fill();
      for (let i = 0; i < trainee.length; i++) {
        const t = trainee[i];
        ctx.beginPath();
        ctx.arc(geo.px(t.x), geo.py(t.y) - geo.uy(t.z || 0), r * 0.62, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${((i + 1) / trainee.length) * 0.34})`; ctx.fill();
      }
      ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(X, Y, r * (1 + z * 0.02), 0, 6.283);
      ctx.fillStyle = "#FFFFFF"; ctx.fill();
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
    let precedent = performance.now();
    function boucle(temps) {
      if (detruit) return;
      const dtBrut = Math.min((temps - precedent) / 1000, 0.05);
      precedent = temps;
      const dt = dtBrut * facteurTemps;

      // le pressing est recalculé à chaque frame (il suit le ballon)
      for (const p of listePions) if (p.role === "pressing") p.role = null;
      appliquerPressing();

      for (const p of listePions) {
        let cible;
        if (p.cx !== null) cible = { x: p.cx, y: p.cy };
        else if (p.role === "pressing") cible = { x: p.presseX, y: p.presseY };
        else cible = cibleAmbiante(p);
        const dx = cible.x - p.x, dy = cible.y - p.y;
        const dist = Math.hypot(dx, dy);
        // vitesse voulue : plein régime tant qu'on est loin, freinage à l'arrivée
        const v = Math.min(p.vMax, dist * 4.5);
        const vxVoulu = dist > 0.05 ? (dx / dist) * v : 0;
        const vyVoulu = dist > 0.05 ? (dy / dist) * v : 0;
        const k = Math.min(1, dtBrut * p.accel);
        p.vx = lerp(p.vx, vxVoulu, k);
        p.vy = lerp(p.vy, vyVoulu, k);
        p.x = borne(p.x + p.vx * dt, 1, 99);
        p.y = borne(p.y + p.vy * dt, 2, 98);
        // une cible atteinte se relâche : le pion reprend la vie ambiante
        if (p.cx !== null && dist < 1.2) { p.cx = null; p.cy = null; if (p.role !== "pressing") p.role = null; }
        if (p.aura > 0) p.aura -= dtBrut * 1000;
        if (p.flash > 0) p.flash -= dtBrut * 1000;
        if (p.plonge > 0) p.plonge -= dtBrut * 1000;
      }
      // R4 : espacement en jeu ouvert, mêlées permises dans la surface
      separerDisques(listePions, geo.w, geo.h, rayonPion());
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
        for (const p of listePions) dessinerPion(p, temps);
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

    /* ============================================================
       7. L'API rendue à match-ui.js
       ============================================================ */
    return {
      racine, cut, miseEnPlace, jouerTemps, repos, commentaire, majPossession,
      majJaugeCible, reglerMinute, dominationDe,
      /* Les autres scores du lobby, en toast discret pendant les temps
         morts (le lobby vit pendant ton match). */
      notifierLobby: (texte) => {
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
        jauge: { affichee: jauge.affichee, cible: jauge.cible },
        possessionPct: { moi: possessionPct.moi, eux: possessionPct.eux },
        nbDisques: listePions.length,
        ballon: { x: ballon.x, y: ballon.y, z: ballon.z, porteur: ballon.porteur, enVol: !!ballon.vol },
        minute: minute.affichee, porteur: ballon.porteur,
        etiquettes: listePions.filter((p) => p.etiquette).map((p) => p.nom),
        theme: theme.nom, replayEnCours: !!replay,
        positions: listePions.map((p) => ({ nom: p.nom, camp: p.camp, x: p.x, y: p.y, base: p.baseX,
          vitesse: Math.hypot(p.vx, p.vy) })),
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
  function separerDisques(disques, largeur, hauteur, rayonPx) {
    const dansLaSurface = (d) => (d.x < 16 || d.x > 84) && d.y > 20 && d.y < 80;
    for (let i = 0; i < disques.length; i++) {
      for (let j = i + 1; j < disques.length; j++) {
        const a = disques[i], b = disques[j];
        const melee = dansLaSurface(a) && dansLaSurface(b);
        const facteur = melee ? 0.62 : 0.8;
        const minDist = facteur * (rayonPx * (a.echelle || 1) + rayonPx * (b.echelle || 1));
        let dxPx = (b.x - a.x) * largeur / 100, dyPx = (b.y - a.y) * hauteur / 100;
        const dist = Math.hypot(dxPx, dyPx);
        if (dist >= minDist) continue;
        if (dist < 0.01) { dxPx = Math.cos((a.phase || 0) + i); dyPx = Math.sin((a.phase || 0) + i); }
        const norme = Math.hypot(dxPx, dyPx);
        const pousse = (minDist - dist) / 2;
        const uxPct = (dxPx / norme) * pousse * 100 / largeur;
        const uyPct = (dyPx / norme) * pousse * 100 / hauteur;
        a.x -= uxPct; a.y -= uyPct;
        b.x += uxPct; b.y += uyPct;
      }
    }
    for (const d of disques) { d.x = Math.max(1, Math.min(99, d.x)); d.y = Math.max(2, Math.min(98, d.y)); }
  }

  return { creer, couleurFamille, styleDe, construireAction, separerDisques,
           reglages, majReglages, REGLAGES_DEFAUT };
})();

if (typeof module !== "undefined") module.exports = ONZE_SCENE;
