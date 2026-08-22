/* ============================================================
   ONZE — Affichage d'un match (partagé par match.html, draft.html
   et la vraie partie). Le calcul vit dans match-moteur.js : ici on
   rejoue le résultat au rythme du direct, accélérable ×2 à tout
   moment (décision n°13 : le match reste court et accélérable).

   Utilisation :
     ONZE_UI.rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet)
     ONZE_UI.basculerVitesse() → renvoie la nouvelle vitesse (1 ou 2)
   `elements` = { chrono, scoreA, scoreB, recit } (éléments du DOM).
   ============================================================ */

const ONZE_UI = (() => {
  /* Les glyphes de familles — un par École et par archétype, uniques,
     sans conflit avec 🧰⭐🧪🛂🌍🔥🎯🏆🎁😱. Même code visuel partout :
     jetons, boutique, scouting, badges de synergies. */
  const GLYPHES = {
    postes: { "GAR": "G", "DÉF": "D", "MIL": "M", "ATT": "A" },
    ecoles: {
      "Tiki-Taka": "🎹", "Catenaccio": "🛡️", "Kick & Rush": "🚀", "École de la Rue": "🛹",
      "La Grinta": "🐺", "Football Total": "🌀", "L'Académie": "📚", "Les Internationaux": "✈️",
      "Le Douzième Homme": "📣", "Les Pros": "💼", "Les Revanchards": "🥊",
    },
    archetypes: {
      "Mur": "🗿", "Moteur": "🔋", "Sentinelle": "👁️", "Virtuose": "🎩", "Finisseur": "🥅",
      "Créateur": "🪄", "Piston": "💨", "Renard": "🦊", "Chanceux": "🍀", "Guerrier": "💪",
      "Mentor": "🦉", "Capitaine": "🎖️",
    },
  };
  const glyphe = (nom) =>
    (typeof ONZE_ECUSSONS !== "undefined" && ONZE_ECUSSONS.idDe(nom)) ? ONZE_ECUSSONS.mini(nom)
    : (GLYPHES.ecoles[nom] || GLYPHES.archetypes[nom] || "");
  const DELAI_PHASE_MS = 5000;     // 8 phases → ~40 s de match
  const DELAI_EVENEMENT_MS = 1400; // les actions d'une phase s'égrènent
  let vitesse = 1;                 // 1 = direct, 2 = accéléré
  let evenementsJoues = [];        // le fil du match EN COURS (recap live, sans spoiler)

  function basculerVitesse() { vitesse = vitesse === 1 ? 2 : 1; return vitesse; }

  /* Les badges de synergies : compte / seuil suivant (« 3/5 »), et un
     badge éteint ✨ quand il ne manque qu'UN joueur pour allumer une
     famille — l'appel d'achat le plus efficace du mercato. */
  function badges(equipe) {
    const paliersDe = (nom, type) =>
      (type === "ecole" ? ONZE.PALIERS_ECOLES[nom] : ONZE.PALIERS_ARCHETYPES[nom]) || null;
    const rendus = [];
    const vus = new Set();
    for (const sy of equipe.synergies) {
      vus.add(sy.nom);
      const paliers = paliersDe(sy.nom, sy.type);
      const prochain = paliers ? paliers.find((p) => p > sy.nb) : null;
      const libelle = prochain ? `${sy.nb}/${prochain}` : `${sy.nb}`;
      const presque = prochain && prochain - sy.nb === 1 ? " presque" : "";
      const ecusson = typeof ONZE_ECUSSONS !== "undefined" ? ONZE_ECUSSONS.badge(sy.nom, true, 18) : glyphe(sy.nom);
      rendus.push(`<span class="badge synergie-active${presque}" data-famille="${sy.nom}">${ecusson} <span class="badge-texte">${sy.nom}<small>${libelle}${presque ? " ✨" : ""}</small></span></span>`);
    }
    // familles pas encore actives mais à UN joueur du premier palier
    const comptes = {};
    for (const j of equipe.joueurs) {
      if (j.ecole) comptes[j.ecole + "|ecole"] = (comptes[j.ecole + "|ecole"] || 0) + 1;
      if (j.archetype) comptes[j.archetype + "|archetype"] = (comptes[j.archetype + "|archetype"] || 0) + 1;
    }
    for (const [cle, nb] of Object.entries(comptes)) {
      const [nom, type] = cle.split("|");
      if (vus.has(nom) || nom === "Capitaine") continue;
      const paliers = paliersDe(nom, type);
      if (paliers && paliers[0] - nb === 1) {
        const ecussonEteint = typeof ONZE_ECUSSONS !== "undefined" ? ONZE_ECUSSONS.badge(nom, false, 18) : glyphe(nom);
        rendus.push(`<span class="badge inactif" data-famille="${nom}">${ecussonEteint} <span class="badge-texte">${nom}<small>${nb}/${paliers[0]} ✨</small></span></span>`);
      }
    }
    return rendus.join("");
  }

  function blocPhase(recit, minute, numero, total) {
    const bloc = document.createElement("div");
    bloc.className = "phase";
    bloc.innerHTML = `<div class="titre-phase">${minute}ᵉ — Phase ${numero}</div>`;
    recit.appendChild(bloc);
    bloc.scrollIntoView({ behavior: "smooth", block: "end" });
    return bloc;
  }

  function ajouterEvenement(elements, bloc, ev, scores) {
    const ligne = document.createElement("div");
    ligne.className = "evenement";
    let html = ev.texte;
    if (ev.synergie) html += ` <span class="tag-synergie">✦ ${ev.synergie}</span>`;
    if (ev.but) {
      bloc.classList.add("but");
      html += `<br><span class="cri">⚽ ${ev.cri}</span> <strong>${scores.a} – ${scores.b}</strong>`;
      elements.scoreA.textContent = scores.a;
      elements.scoreB.textContent = scores.b;
    }
    ligne.innerHTML = html;
    bloc.appendChild(ligne);
    ligne.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  /* ============================================================
     LE TEMPO DU MATCH — grammaire Football Manager.
     Manuel : design/scene-fm.md (l'original de Gabriel fait foi ;
     les repères « RN » sont la nomenclature interne du code, table
     de correspondance dans design/decisions.md, décision 26).
     R2 : un match = 2 à 4 TEMPS FORTS rendus, séparés par des CUTS
          secs (carton minute + score). Le régime « domination » a
          disparu : entre deux temps forts, on ne montre RIEN.
     R3 : un temps fort = cut → mise en place (~3 s, les 22 pions
          glissent) → 4 à 8 temps, l'issue au dernier seulement.
     R9 : budgets stricts (amical 1 temps fort, manches 4-9 : 2-3,
          match plein : 3-5). Si ça ne rentre pas, on réduit le
          NOMBRE de temps forts, JAMAIS leur lisibilité.
     ============================================================ */
  /* LE RYTHME (arbitrage de Gabriel, règle 3 de la spec).
     0,8 s est un PLANCHER, pas une cible. FM est patient, et c'est sa
     patience qui rend le match lisible :
     - les temps DÉCISIFS (percée, frappe, issue) visent 1,5-2 s ;
     - les relais de transition tiennent 0,8-1,3 s ;
     - et si le budget ne rentre pas, on retire un TEMPS FORT, jamais
       des secondes de jeu. La durée d'un temps n'est plus une variable
       d'ajustement — seul leur NOMBRE l'est. */
  const TEMPS_TRANSITION_MS = 1000;  // récupération, relais, conduite, geste…
  const TEMPS_DECISIF_MS = 1600;     // la percée et l'armement de la frappe
  const TEMPS_ISSUE_MS = 1800;       // la frappe voyage, PUIS l'issue tombe
  const PLANCHER_MS = 800;           // on ne descend JAMAIS dessous
  const CUT_MS = 900;                // le carton minute + score
  const RESPIRATION_MS = 700;        // le souffle après une issue
  const CELEBRATION_MS = 1100;       // le constat d'un but (ou d'un presque-but)
                                     // reste à l'écran : c'est la récompense

  /* ============================================================
     LES DEUX FORMATS DE TEMPS FORT (décision 32).
     FM ne donne pas la même longueur à tous ses temps forts, et
     c'est ce qui réconcilie « tous les buts sont rendus »
     (décision 25) avec le budget de ~40 s (décision 20).

     GRAND FORMAT — l'existant : mise en place pleine (3 s), 4 à 8
       temps patients (1 à 1,8 s), issue. ~13 s.
     FORMAT COURT — pour les buts surnuméraires quand le match
       déborde : mise en place brève (1,2 s), 2 à 3 temps de
       construction (1,15 s), puis l'issue AVEC SA CHORÉGRAPHIE
       COMPLÈTE — micro-ralenti et célébration compris, on n'y
       touche jamais. ~8 s.

     Allocation : tout le monde en grand format tant que ça rentre ;
     si ça déborde, les buts les MOINS importants basculent en
     format court, du moins important au plus important. Le dernier
     but du match garde toujours le grand format.
     ============================================================ */
  const TEMPS_COURT_MS = 1150;             // un temps de construction en format court
  const MISE_EN_PLACE_COURTE_MS = 1200;
  const RESPIRATION_COURTE_MS = 500;
  /* 2 temps de construction (la percée et l'armement) : c'est le bas de
     la fourchette « 2-3 » de l'arbitrage, et c'est ce qui pose le format
     court à ~7,8 s — dans les ~6-8 s visées. À 3 temps il monte à 8,9 s
     et sort de la fourchette. */
  const CONSTRUCTION_COURTE = 2;
  // La cible reste ~40 s (décision 20) ; le plafond dur est ce qui
  // déclenche le basculement en format court.
  const PLAFOND_DUR_MS = 50000;

  const dureeMiseEnPlace = (nbPhases) => nbPhases <= 4 ? 2000 : nbPhases <= 6 ? 2600 : 3000;
  /* Sont DÉCISIFS : la percée, la frappe et l'issue — les trois temps où
     se joue la promesse. Tout le reste est de la construction. */
  const estDecisif = (t) => t.issue || t.decisif || t.type === "percee";
  const dureeTemps = (t, court) => t.issue ? TEMPS_ISSUE_MS
    : court ? TEMPS_COURT_MS
    : estDecisif(t) ? TEMPS_DECISIF_MS : TEMPS_TRANSITION_MS;

  /* Le format court garde l'ossature de l'action : sa naissance, son
     temps le plus parlant, l'armement — et TOUTES les issues (avec
     leurs rebonds, qui font la couture d'un doublé). On ne coupe que
     les relais de circulation. */
  const RANG_UTILITE = { frappe: 0, percee: 1, contre: 2, geste: 3, conduite: 4,
    recuperation: 5, relais_long: 6, stop: 7, hors_jeu: 8, relais: 9 };
  function actionCourte(action) {
    const garde = new Set();
    action.forEach((t, i) => { if (t.issue || t.type === "rebond") garde.add(i); });
    action.map((t, i) => ({ t, i }))
      .filter((x) => !garde.has(x.i))
      .sort((a, b) => (RANG_UTILITE[a.t.type] ?? 9) - (RANG_UTILITE[b.t.type] ?? 9))
      .slice(0, CONSTRUCTION_COURTE)
      .forEach((x) => garde.add(x.i));
    const courte = action.filter((t, i) => garde.has(i));
    courte.situation = action.situation;
    courte.equipe = action.equipe;
    courte.style = action.style;
    return courte;
  }
  /* Un but et un presque-but gagnent un temps d'arrêt sur image : sans
     lui, le constat file en ~0,6 s et la récompense passe inaperçue. */
  const dureeCelebration = (t) => (t.type === "issue_but" || t.pres) ? CELEBRATION_MS : 0;

  const estChaude = (phase) => phase.evenements.some((ev) =>
    ev.but || ev.type === "arret" || ev.type === "blocage" || ev.type === "rebond");
  const aBut = (phase) => phase.evenements.some((ev) => ev.but);
  const prioriteDe = (phase) => Math.max(...phase.evenements.map((ev) =>
    ev.but ? 100 : ev.type === "arret" ? (ev.pres ? 60 : 40) : ev.type === "blocage" ? 30 : ev.type === "rebond" ? 20 : 0));
  const coutTempsFort = (action, miseEnPlaceMs, court) =>
    CUT_MS + (court ? MISE_EN_PLACE_COURTE_MS : miseEnPlaceMs) +
    (court ? RESPIRATION_COURTE_MS : RESPIRATION_MS) +
    (court ? actionCourte(action) : action)
      .reduce((t, tp) => t + dureeTemps(tp, court) + dureeCelebration(tp), 0);

  /* L'IMPORTANCE d'une phase — c'est elle qui décide qui garde le grand
     format. Elle se lit dans le déroulé RÉEL du match : le dernier but
     est le plus important (c'est lui qui scelle le sort), puis les buts
     qui font basculer le score, puis les occasions par danger. */
  function importancesDes(phases, nomA) {
    const score = { a: 0, b: 0 };
    const infos = new Map();
    let derniereAvecBut = null;
    for (const phase of phases) {
      let but = false, bascule = false;
      for (const ev of phase.evenements) {
        if (!ev.but) continue;
        but = true;
        const avant = Math.sign(score.a - score.b);
        if (ev.equipe === nomA) score.a++; else score.b++;
        if (Math.sign(score.a - score.b) !== avant) bascule = true;
      }
      if (but) derniereAvecBut = phase;
      infos.set(phase, { but, bascule });
    }
    const importance = new Map();
    for (const phase of phases) {
      const i = infos.get(phase);
      importance.set(phase,
        (phase === derniereAvecBut ? 10000 : 0) +
        (i.but ? 1000 : 0) + (i.bascule ? 500 : 0) +
        prioriteDe(phase) + phase.numero);
    }
    return { importance, derniereAvecBut };
  }

  /* Le texte de repli quand un temps n'a ni promesse ni événement */
  const texteDuTemps = (t) => {
    if (t.promesse) return t.promesse;
    if (t.ev) return t.ev.texte;
    if (t.type === "relais") return `${t.de || "Le bloc"} cherche ${t.vers}…`;
    if (t.type === "relais_long") return `Long ballon vers ${t.vers} !`;
    if (t.type === "conduite") return `${t.acteur} porte le ballon et fixe la défense…`;
    if (t.type === "frappe") return `${t.tireur ? t.tireur + " arme sa frappe…" : "La frappe part…"}`;
    return null;
  };

  /* ============================================================
     LE PLAN DU MATCH — fonction PURE et testable.
     Décide QUELLES phases deviennent des temps forts, et dans QUEL
     FORMAT. C'est ici que vit l'arbitrage de Gabriel : tous les buts
     sont rendus (décision 25), tout le monde en grand format tant que
     ça rentre sous le plafond dur, puis bascule en format court du
     moins important au plus important — le dernier but du match garde
     toujours le grand format.
     Sortie : { actions, rendues, courtes, miseEnPlaceMs, dureeMorte }
     ============================================================ */
  function planifierTempsForts(resultat, equipeA, equipeB, opts = {}) {
    const { delaiPhase = DELAI_PHASE_MS, vitesse: v = 1, resume = false } = opts;
    const nbPhases = resultat.phases.length;
    const budgetTotal = delaiPhase * nbPhases;
    const miseEnPlaceMs = dureeMiseEnPlace(nbPhases);
    // les budgets de la spec : amical 1 rendu, manches 4-9 : 2-3,
    // match plein : 3-4. En ×2, seuls les buts sont rendus.
    const maxRendus = resume ? 99 : v === 2 ? 0 : nbPhases <= 4 ? 1 : nbPhases <= 6 ? 3 : 4;

    const actions = new Map();
    for (const phase of resultat.phases) {
      if (estChaude(phase)) actions.set(phase, ONZE_SCENE.construireAction(phase, equipeA, equipeB));
    }
    const candidates = [...actions.keys()]
      .sort((a, b) => (aBut(b) - aBut(a)) || (prioriteDe(b) - prioriteDe(a)));
    const rendues = new Set();
    let coutTotal = 0;
    for (const phase of candidates) {
      const cout = coutTempsFort(actions.get(phase), miseEnPlaceMs, false);
      if (aBut(phase)) { rendues.add(phase); coutTotal += cout; continue; }
      if (rendues.size < maxRendus && (resume || coutTotal + cout <= budgetTotal)) {
        rendues.add(phase); coutTotal += cout;
      }
    }

    /* ---- L'ALLOCATION DES FORMATS ---- */
    const { importance, derniereAvecBut } = importancesDes(resultat.phases, equipeA.nom);
    const courtes = new Set();
    if (!resume) {
      const parImportance = [...rendues].sort((a, b) => importance.get(a) - importance.get(b));
      const majeurs = parImportance.slice(-2);           // les 2 moments les plus importants
      const cout = () => [...rendues].reduce((t, p) =>
        t + coutTempsFort(actions.get(p), miseEnPlaceMs, courtes.has(p)), 0);
      // 1er passage : tout sauf les 2 moments majeurs
      for (const phase of parImportance) {
        if (cout() <= PLAFOND_DUR_MS) break;
        if (majeurs.includes(phase)) continue;
        courtes.add(phase);
      }
      // dernier recours (festival de buts) : le 2ᵉ moment majeur bascule
      // lui aussi ; le dernier but du match, JAMAIS.
      for (const phase of parImportance) {
        if (cout() <= PLAFOND_DUR_MS) break;
        if (phase === derniereAvecBut) continue;
        courtes.add(phase);
      }
      coutTotal = cout();
    }

    // le temps mort restant se répartit sur les phases non rendues
    const nbMortes = nbPhases - rendues.size;
    const dureeMorte = Math.max(500, Math.min(1600,
      nbMortes ? (budgetTotal - coutTotal) / nbMortes : 900));
    return { actions, rendues, courtes, miseEnPlaceMs, dureeMorte, nbPhases,
      coutTotal, derniereAvecBut, importance };
  }

  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet, options = {}) {
    const delaiPhase = options.delaiPhase || DELAI_PHASE_MS;
    const delaiEvenement = options.delaiEvenement || DELAI_EVENEMENT_MS;
    elements.recit.innerHTML = "";
    elements.scoreA.textContent = "0";
    elements.scoreB.textContent = "0";
    evenementsJoues = [];
    const scores = { a: 0, b: 0 };
    const etapes = [];
    let blocCourant = null;

    // le facteur de vitesse d'une étape : les froides se sautent en ×2
    /* Les deux vitesses INDÉPENDANTES de FM (R10) : temps forts et
       temps morts. Le bouton ×2 du jeu se multiplie par-dessus. */
    const regVitesse = (typeof ONZE_SCENE !== "undefined") ? ONZE_SCENE.reglages() : { vitesseFort: 1, vitesseMort: 1 };
    const facteurFort = () => (regVitesse.vitesseFort || 1) * (vitesse === 2 ? 1.6 : 1);
    const facteurMort = () => (regVitesse.vitesseMort || 1) * (vitesse === 2 ? 4 : 1);

    const jouerEvenement = (ev) => {
      evenementsJoues.push(ev);
      if (ev.but) { if (ev.equipe === equipeA.nom) scores.a++; else scores.b++; }
      ajouterEvenement(elements, blocCourant, ev, scores);
      if (elements.bandeau && !options.scene) {   // sans scène, le bandeau porte le récit
        const chip = ev.synergie
          ? ` <span class="tag-synergie" style="color:${typeof ONZE_SCENE !== "undefined" ? ONZE_SCENE.couleurFamille(ev.synergie) : "var(--or-trophee)"}">✦ ${ev.synergie}</span>` : "";
        elements.bandeau.innerHTML = (ev.but ? `⚽ ${ev.cri} <strong>${scores.a} – ${scores.b}</strong>` : ev.texte) + chip;
      }
      if (typeof ONZE_JUICE !== "undefined") {
        if (ev.but && ev.equipe === equipeA.nom) ONZE_JUICE.but(options.enjeu || 2, options.scene && options.scene.racine);
        else if (ev.but) ONZE_JUICE.jouer("defaite");
        else if (ev.type === "arret") ONZE_JUICE.jouer("arret");
      }
    };

    if (options.scene) {
      /* ---- Le tempo « moments-clés » (R2/R3/R9) ----
         1. Chaque phase à occasion devient un TEMPS FORT construit
            (4-8 temps) via ONZE_SCENE.construireAction.
         2. Sélection par budget : TOUS les buts sont rendus d'office
            (un but ne se compresse jamais — décision 25), puis les
            meilleures occasions (presque-but > arrêt > blocage) tant
            que le budget ET le plafond de format le permettent.
         3. Les phases NON rendues ne sont pas mises en scène du tout :
            elles filent au journal 📜 avec leur accent sonore, et la
            minute avance. C'est ça, le filtre « moments-clés ».
         4. Réglage « Résumé complet » (R10) : le plafond saute, tout
            ce qui porte une occasion est rendu. ---- */
      const reg = ONZE_SCENE.reglages();
      const plan = planifierTempsForts(resultat, equipeA, equipeB, {
        delaiPhase, vitesse, resume: reg.filtre === "resume",
      });
      const { actions, rendues, courtes, miseEnPlaceMs, dureeMorte } = plan;
      const scoresLobby = (options.scoresLobby || []).slice();
      // la possession affichée vient des VRAIS gains de balle du moteur
      const comptePossession = { moi: 0, eux: 0 };
      const compter = (phase) => {
        for (const ev of phase.evenements) {
          if (ev.type !== "possession" && ev.type !== "contre") continue;
          if (ev.equipe === equipeA.nom) comptePossession.moi++; else comptePossession.eux++;
        }
        options.scene.majPossession(comptePossession);
      };

      /* La file d'étapes attend AVANT d'agir : le délai d'une étape est
         donc la durée de la PRÉCÉDENTE. `pousser` tient ce décalage —
         sans lui, une mise en place annoncée à 3 s ne durait que le
         temps du premier temps de jeu, et l'issue se faisait couper
         par la respiration avant même d'être révélée. */
      let attente = { duree: 300, mort: true, plancher: 0 };
      const pousser = (duree, mort, plancher, action) => {
        etapes.push({ delai: attente.duree, mort: attente.mort, plancher: attente.plancher, action });
        attente = { duree, mort, plancher };
      };

      resultat.phases.forEach((phase) => {
        if (!rendues.has(phase)) {
          /* --- TEMPS MORT : rien à l'écran (R2). Le journal encaisse. --- */
          pousser(dureeMorte, true, 0, () => {
            blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
            options.scene.reglerMinute(phase.minute, dureeMorte / facteurMort());
            options.scene.majJaugeCible(phase);
            phase.evenements.forEach((ev) => { jouerEvenement(ev); options.scene.accent(ev); });
            compter(phase);
            if (scoresLobby.length) options.scene.notifierLobby(scoresLobby.shift());
          });
          return;
        }

        /* --- TEMPS FORT --- */
        const court = courtes.has(phase);
        const action = court ? actionCourte(actions.get(phase)) : actions.get(phase);
        // le journal reste complet : le solde rattrape ce que le format
        // court n'a pas mis en scène
        const couverts = new Set(action.map((t) => t.ev).filter(Boolean));
        const mepMs = court ? MISE_EN_PLACE_COURTE_MS : miseEnPlaceMs;
        const respirationMs = court ? RESPIRATION_COURTE_MS : RESPIRATION_MS;
        const dureeJouee = action.reduce((t, tp) => t + dureeTemps(tp, court) + dureeCelebration(tp), 0) + respirationMs;
        // 1. le CUT sec : carton minute + score
        pousser(CUT_MS, true, 0, () => {
          blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
          // la carte se retire à la vitesse réelle du temps mort (×2, réglage)
          options.scene.cut({ minute: phase.minute, scoreA: scores.a, scoreB: scores.b,
            nomA: equipeA.nom, nomB: equipeB.nom }, CUT_MS / facteurMort());
          options.scene.majJaugeCible(phase);
          compter(phase);
          // le lobby vit pendant ton match : les autres scores tombent
          // pendant les coupures (s'il ne reste aucun temps mort pour eux)
          if (scoresLobby.length) options.scene.notifierLobby(scoresLobby.shift());
        });
        // 2. la MISE EN PLACE : les 22 pions glissent, la promesse tombe,
        //    et l'horloge se remet à courir pour tout le temps fort (R8) —
        //    3 minutes de jeu, jamais plus : au-delà, la scène dépasserait
        //    la minute de la phase suivante et MENTIRAIT.
        pousser(mepMs, false, 0, () => {
          const f = facteurFort();
          options.scene.miseEnPlace(action, mepMs / f);
          options.scene.reglerMinute(phase.minute + 3, (mepMs + dureeJouee) / f);
        });
        // 3. les temps du temps fort
        action.forEach((t) => {
          const duree = dureeTemps(t, court);
          pousser(duree, false, PLANCHER_MS, () => {
            if (t.issue) {
              // l'issue : le journal et le score n'arrivent qu'à la
              // RÉVÉLATION — sinon le tableau spoile la frappe (R7)
              options.scene.jouerTemps(t, duree, () => { if (t.ev) jouerEvenement(t.ev); });
            } else {
              options.scene.jouerTemps(t, duree);
              options.scene.commentaire(texteDuTemps(t));
              if (t.ev) jouerEvenement(t.ev);
            }
          });
          // l'arrêt sur image du but / presque-but : rien ne se passe,
          // le constat et la célébration ont le terrain pour eux
          const fete = dureeCelebration(t);
          if (fete) pousser(fete, false, 0, () => {});
        });
        // 4. le solde (les événements hors chorégraphie) et la respiration
        pousser(respirationMs, false, 0, () => {
          phase.evenements.forEach((ev) => { if (!couverts.has(ev)) jouerEvenement(ev); });
          options.scene.repos();
        });
      });
      // le dernier pas déclaré doit vivre sa durée avant le coup de sifflet
      etapes.push({ delai: attente.duree, mort: attente.mort, action: () => {} });
    } else resultat.phases.forEach((phase) => {
      // ---- Sans scène (match.html, draft.html) : le tempo historique ----
      etapes.push({
        delai: 400,
        action: () => {
          elements.chrono.textContent = `⏱ ${phase.minute}ᵉ minute — phase ${phase.numero}/${resultat.phases.length}`;
          blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
        },
      });
      phase.evenements.forEach((ev) => {
        etapes.push({ delai: delaiEvenement, action: () => jouerEvenement(ev) });
      });
      const reste = delaiPhase - 400 - phase.evenements.length * delaiEvenement;
      etapes.push({ delai: Math.max(reste, 200), action: () => {} });
    });

    etapes.push({
      delai: 600,
      action: () => {
        if (options.scene && options.scene.fin) options.scene.fin();
        elements.chrono.textContent = "⏱ Coup de sifflet final";
        const bloc = document.createElement("div");
        bloc.className = "phase final";
        let verdict;
        if (resultat.scoreA > resultat.scoreB) verdict = `🏆 Victoire de ${equipeA.nom} !`;
        else if (resultat.scoreB > resultat.scoreA) verdict = `🏆 Victoire de ${equipeB.nom} !`;
        else verdict = "🤝 Match nul !";
        const prestige = resultat.ecart > 0 && !options.sansPrestige
          ? `<br><small style="color:var(--craie-sourde)">Dégâts de prestige : ${ONZE.degatsPrestige(resultat.ecart, options.manche)} (base de période + ${resultat.ecart} d'écart)</small>` : "";
        const hdm = ONZE.statsDuMatch ? ONZE.statsDuMatch(resultat, equipeA, equipeB).hommeDuMatch : null;
        const ligneHdm = hdm ? `<br><small style="color:var(--or-trophee)">🌟 Homme du match : ${hdm.nom} (${hdm.equipe}) — le ⚔️ en haut détaille chaque joueur</small>` : "";
        bloc.innerHTML = `Score final : <strong>${resultat.scoreA} – ${resultat.scoreB}</strong><br>${verdict}${ligneHdm}${prestige}`;
        elements.recit.appendChild(bloc);
        bloc.scrollIntoView({ behavior: "smooth", block: "end" });
        if (auCoupDeSifflet) auCoupDeSifflet();
      },
    });

    (function suivante() {
      const etape = etapes.shift();
      if (!etape) return;
      const diviseur = options.scene ? (etape.mort ? facteurMort() : facteurFort()) : vitesse;
      // Le plancher de lisibilité : un temps de temps fort ne se brouille
      // JAMAIS — même le réglage « plus vite » et le ×2 s'arrêtent à
      // 0,8 s. C'est la règle 3 de la spec, prise au mot.
      const delai = Math.max(etape.plancher || 0, etape.delai / diviseur);
      setTimeout(() => { etape.action(); suivante(); }, delai);
    })();
  }

  /* ⚔️ Le recap du match — contributions par joueur (buts, passes
     décisives, duels gagnés, arrêts), barres proportionnelles,
     extensible au camp adverse par les onglets. Ouvrable PENDANT le
     match (il lit le résultat déjà calculé — on n'affiche que le
     récap final, comme l'épée de TFT). */
  function ouvrirRecap(resultat, equipeA, equipeB, opts = {}) {
    // Pendant le match : le recap ne lit QUE les événements déjà joués
    // (zéro spoiler) — les notes sur 10 évoluent en direct, comme FM.
    const source = opts.enCours ? { phases: [{ evenements: evenementsJoues }] } : resultat;
    const stats = ONZE.statsDuMatch(source, equipeA, equipeB);
    const note10 = (l) => Math.min(10, Math.max(5,
      6 + l.buts * 1.5 + l.passes * 0.8 + l.duels * 0.35 + l.arrets * 0.8)).toFixed(1);
    const couleurNote = (n) => n >= 7.5 ? "var(--gazon-electrique)" : n >= 6.5 ? "var(--or-trophee)" : "var(--craie-sourde)";
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    let campActif = equipeA.nom;
    const rendre = () => {
      const lignes = stats.parEquipe[campActif];
      const maxScore = Math.max(...lignes.map((l) => l.score), 1);
      const hdm = stats.hommeDuMatch;
      voile.innerHTML = `<div class="fiche-joueur" style="max-width:460px">
        <h3>⚔️ Le recap du match${opts.enCours ? " <small style='color:var(--craie-sourde)'>(en direct)</small>" : ""}</h3>
        <div class="sous-titre">${hdm ? `🌟 Homme du match${opts.enCours ? " provisoire" : ""} : <strong>${hdm.nom}</strong> (${hdm.equipe})` : "Personne ne s'est encore illustré…"}</div>
        <div style="margin:6px 0">
          ${[equipeA, equipeB].map((eq) =>
            `<button class="onglet-recap" data-camp="${eq.nom.replace(/"/g, "&quot;")}" style="width:auto;margin:0 4px 0 0;padding:5px 10px;font-size:0.7rem;${eq.nom === campActif ? "background:var(--ligne-forte);border-color:var(--gazon-electrique)" : ""}">${eq.nom}</button>`).join("")}
        </div>
        ${lignes.map((l) => `<div class="ligne-stat">
          <span class="note-recap" style="color:${couleurNote(Number(note10(l)))}">${note10(l)}</span>
          <span class="nom-stat">${hdm && l.nom === hdm.nom && campActif === hdm.equipe ? "🌟 " : ""}${l.nom}</span>
          <span class="barre-stat"><div style="width:${Math.round(100 * l.score / maxScore)}%"></div></span>
          <span style="font-size:0.64rem;color:var(--craie-claire);white-space:nowrap">${[
            l.buts ? `⚽×${l.buts}` : "", l.passes ? `🎯×${l.passes}` : "",
            l.duels ? `⚔️×${l.duels}` : "", l.arrets ? `🧤×${l.arrets}` : "",
          ].filter(Boolean).join(" ") || "—"}</span>
        </div>`).join("")}
        <div style="color:var(--craie-sourde);font-size:0.66rem;margin-top:8px">⚽ buts · 🎯 passes décisives · ⚔️ duels gagnés · 🧤 arrêts</div>
        <button class="fermer">Fermer</button>
      </div>`;
    };
    rendre();
    voile.addEventListener("click", (e) => {
      const onglet = e.target.closest(".onglet-recap");
      if (onglet) { campActif = onglet.dataset.camp; rendre(); return; }
      if (e.target === voile || e.target.classList.contains("fermer")) voile.remove();
    });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  /* La fiche complète d'un joueur (au tap sur une carte).
     `calcule` : le joueur passé par equipeDepuisFiches si dispo
     (stats boostées en vert) ; sinon on génère les stats de base. */
  function ouvrirFiche(fiche, calcule) {
    const statsBase = calcule ? calcule.statsBase : ONZE.genererStats(fiche);
    const stats = calcule ? calcule.stats : statsBase;
    const boosts = calcule ? calcule.boosts : {};
    const note = ONZE.noteGlobale(stats);
    const etoiles = (fiche.etoiles || 1) >= 2 ? " " + "★".repeat(fiche.etoiles) : "";
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    // les 2 stats signatures sont DORÉES (l'affiche de héros, Lot 3)
    const signatures = new Set(ONZE.statsSignatures(stats).map((x) => x.nom));
    const lignes = Object.entries(stats).map(([stat, valeur]) => {
      const boost = boosts[stat] || 0;
      const classe = boost > 0 ? "boostee" : boost < 0 ? "malussee" : "";
      const detail = boost ? ` (${statsBase[stat]}${boost > 0 ? "+" : ""}${boost})` : "";
      const sig = signatures.has(ONZE.NOMS_STATS[stat]);
      return `<div class="ligne-stat${sig ? " signature" : ""}"><span class="nom-stat">${ONZE.NOMS_STATS[stat]}</span>` +
        `<span class="valeur-stat ${classe}">${valeur}</span>` +
        `<span class="barre-stat"><div style="width:${valeur}%"></div></span>` +
        `<span style="font-size:0.66rem;color:var(--craie-sourde)">${detail}</span></div>`;
    }).join("");
    const coutCadre = fiche.icone || fiche.cout === 5 ? "var(--cout-5)" : `var(--cout-${fiche.cout || 1}, var(--ligne-forte))`;
    const pilule = (contenu) => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--nuit-profonde);border-radius:var(--r-pilule);padding:2px 8px;font-size:0.66rem;font-weight:700;color:var(--craie-claire)">${contenu}</span>`;
    voile.innerHTML = `<div class="fiche-joueur" style="position:relative;overflow:hidden;border:2.5px solid ${coutCadre}">
      <div class="filigrane-note">${note}</div>
      <div style="display:flex;align-items:center;gap:9px;position:relative">
        <span class="note-heros" style="border-top-color:${coutCadre}">${note}</span>
        <h3 style="flex:1">${fiche.nom}${etoiles}</h3>
        <span class="pastille p-${fiche.poste}" style="font-size:0.8rem;min-width:24px;padding:3px 4px">${GLYPHES.postes[fiche.poste] || fiche.poste}</span>
      </div>
      ${fiche.unique ? `<div class="sous-titre" style="color:var(--or-trophee);font-weight:800;font-style:italic">✦ ${fiche.unique} — UNIQUE</div>` : ""}
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 8px;position:relative">
        ${fiche.ecole ? pilule(glyphe(fiche.ecole) + " " + fiche.ecole) : ""}
        ${fiche.archetype ? pilule(glyphe(fiche.archetype) + " " + fiche.archetype) : ""}
        ${pilule(`<span style="color:${coutCadre}">coût ${fiche.cout}</span>`)}
      </div>
      ${fiche.description ? `<div class="description">${fiche.description}</div>` : ""}
      ${fiche.ecoleBonus ? `<div class="sous-titre">🛂 Emblème : compte aussi comme <strong>${fiche.ecoleBonus}</strong></div>` : ""}
      ${fiche.citoyenDuMonde ? `<div class="sous-titre">🌍 Citoyen du monde : +1 dans toutes tes Écoles actives</div>` : ""}
      ${fiche.relique ? `<div class="sous-titre" style="color:var(--or-trophee)">🏺 <strong>${fiche.relique}</strong> — Relique (définitive)</div>` : ""}
      ${(fiche.specialisations || []).map((nom) => {
        const spec = Object.values(ONZE.SPECIALISATIONS).find((x) => x.nom === nom);
        const iconique = (fiche.specsIconiques || []).includes(nom);
        return `<div class="sous-titre">${iconique ? "🌟" : "🧪"} <strong>${nom}${iconique ? " (Iconique ×1,5)" : ""}</strong>${spec && spec.effet ? " — " + spec.effet : ""}</div>`;
      }).join("")}
      ${(fiche.staffCartes || []).map((c) => `<div class="sous-titre">🧰 ${c} <small>(en attente d'une 2ᵉ carte)</small></div>`).join("")}
      ${lignes}
      <div style="color:var(--craie-sourde);font-size:0.68rem;margin-top:8px">Valeur <span style="color:var(--gazon-electrique)">verte</span> = boostée par tes synergies. Chaque duel du match lit 2 de ces stats.</div>
      <button class="fermer">Fermer</button>
    </div>`;
    voile.addEventListener("click", (e) => { if (e.target === voile || e.target.classList.contains("fermer")) voile.remove(); });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  return { rejouer, badges, basculerVitesse, ouvrirFiche, ouvrirRecap, GLYPHES, glyphe,
           planifierTempsForts, actionCourte, coutTempsFort };
})();
