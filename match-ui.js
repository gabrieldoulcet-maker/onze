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
  const glyphe = (nom) => GLYPHES.ecoles[nom] || GLYPHES.archetypes[nom] || "";
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
      rendus.push(`<span class="badge${presque}" data-famille="${sy.nom}">${glyphe(sy.nom)} ${sy.nom} ${libelle}${presque ? " ✨" : ""}</span>`);
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
        rendus.push(`<span class="badge inactif" data-famille="${nom}">${glyphe(nom)} ${nom} ${nb}/${paliers[0]} ✨</span>`);
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

  /* File d'étapes jouée en chaîne : la vitesse peut changer en cours
     de match, chaque étape relit `vitesse` au moment de s'armer.

     Avec une SCÈNE (décision 24), le match alterne deux régimes dans
     le budget de temps acté (décision 20) :
     - la DOMINATION : les phases sans occasion se jouent compressées
       (~2-3 s) — circulation stylée par École, jauge, minute qui défile ;
     - le RENDU complet : dès qu'une occasion existe (tir, blocage,
       rebond), chorégraphie temps réel, montée de tension avant,
       micro-ralenti sur les buts.
     La domination est la variable d'ajustement du budget temps —
     jamais les rendus de buts. L'accéléré ×2 SAUTE les phases froides
     (÷4) et resserre à peine les chaudes (÷1,6). */
  /* Décision 25 : plancher de 0,8 s par temps de jeu — JAMAIS en
     dessous. Le temps décisif (la frappe) s'étire à ~1 s. Si le budget
     serre, on réduit le NOMBRE de rendus, jamais leur lisibilité. */
  const TEMPS_MS = 800;
  const TEMPS_DECISIF_MS = 1000;
  const estChaude = (phase) => phase.evenements.some((ev) =>
    ev.but || ev.type === "arret" || ev.type === "blocage" || ev.type === "rebond");
  const aBut = (phase) => phase.evenements.some((ev) => ev.but);
  const prioriteDe = (phase) => Math.max(...phase.evenements.map((ev) =>
    ev.but ? 100 : ev.type === "arret" ? (ev.pres ? 60 : 40) : ev.type === "blocage" ? 30 : ev.type === "rebond" ? 20 : 0));
  const coutRendu = (action) => 300 + 500 +
    action.reduce((t, tp) => t + (tp.decisif ? TEMPS_DECISIF_MS : TEMPS_MS), 0);
  /* Le texte du bandeau pour les temps sans événement moteur */
  const texteDuTemps = (t) => {
    if (t.ev) return t.ev.texte;
    if (t.type === "relais") return `${t.de || "Le bloc"} remise pour ${t.vers} — ça circule.`;
    if (t.type === "relais_long") return `Long ballon vers ${t.vers} !`;
    if (t.type === "conduite") return `${t.acteur} porte le ballon et fixe la défense…`;
    if (t.type === "frappe") return `${t.tireur ? t.tireur + " arme sa frappe…" : "La frappe part…"}`;
    return null;
  };

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
    const facteurDe = (rapide) => vitesse === 1 ? 1 : (rapide ? 4 : 1.6);

    const jouerEvenement = (ev) => {
      evenementsJoues.push(ev);
      if (ev.but) { if (ev.equipe === equipeA.nom) scores.a++; else scores.b++; }
      ajouterEvenement(elements, blocCourant, ev, scores);
      if (elements.bandeau) {
        const chip = ev.synergie
          ? ` <span class="tag-synergie" style="color:${typeof ONZE_SCENE !== "undefined" ? ONZE_SCENE.couleurFamille(ev.synergie) : "#E8C547"}">✦ ${ev.synergie}</span>` : "";
        elements.bandeau.innerHTML = (ev.but ? `⚽ ${ev.cri} <strong>${scores.a} – ${scores.b}</strong>` : ev.texte) + chip;
      }
      if (typeof ONZE_JUICE !== "undefined") {
        if (ev.but && ev.equipe === equipeA.nom) ONZE_JUICE.but(options.enjeu || 2, options.scene && options.scene.racine);
        else if (ev.but) ONZE_JUICE.jouer("defaite");
        else if (ev.type === "arret") ONZE_JUICE.jouer("arret");
      }
    };

    if (options.scene) {
      /* ---- Le tempo décision 25 : on ne rend que des promesses,
         dans le budget strict de la décision 20.
         1. Chaque phase chaude devient une ACTION construite (3-6
            temps) via ONZE_SCENE.construireAction.
         2. Sélection par budget : TOUS les buts sont rendus d'office,
            puis les meilleures occasions (presque-but > arrêt >
            blocage) tant que le budget le permet — plafonné par
            format (amical 2, M4-9 3, M10+ 5). En ×2 : buts seulement.
         3. Les occasions NON retenues passent au régime compressé
            avec un accent (flash + OHHH léger).
         4. Les respirations de domination (1-2 s) absorbent le reste
            du budget — jamais les rendus. ---- */
      const budgetTotal = delaiPhase * resultat.phases.length;
      const nbPhases = resultat.phases.length;
      const maxRendus = vitesse === 2 ? 99 : nbPhases <= 4 ? 2 : nbPhases <= 6 ? 3 : 5;
      const actions = new Map(); // phase → temps[]
      for (const phase of resultat.phases) {
        if (estChaude(phase)) actions.set(phase, ONZE_SCENE.construireAction(phase, equipeA, equipeB));
      }
      const candidates = [...actions.keys()]
        .sort((a, b) => (aBut(b) - aBut(a)) || (prioriteDe(b) - prioriteDe(a)));
      const rendues = new Set();
      let coutTotal = 0;
      for (const phase of candidates) {
        const cout = coutRendu(actions.get(phase));
        const resteApres = budgetTotal - coutTotal - cout - (nbPhases - rendues.size - 1) * 1000;
        const obligatoire = aBut(phase); // un but ne se compresse JAMAIS
        if (vitesse === 2 && !obligatoire) continue;
        if (obligatoire || (rendues.size < maxRendus && resteApres > 0)) {
          rendues.add(phase);
          coutTotal += cout;
        }
      }
      const nbNonRendues = nbPhases - rendues.size;
      const dureeFroide = Math.max(1000, Math.min(2000,
        nbNonRendues ? (budgetTotal - coutTotal) / nbNonRendues : 1200));
      const scoresLobby = (options.scoresLobby || []).slice();
      resultat.phases.forEach((phase) => {
        const rendue = rendues.has(phase);
        // un rendu SANS but se dégrade en compressé si le spectateur
        // passe en ×2 en cours de match — un BUT se rend toujours
        const degradable = rendue && !aBut(phase);
        const enX2Degrade = () => vitesse === 2 && degradable;
        etapes.push({
          delai: 300, rapide: !rendue, optionnelle: degradable,
          action: () => {
            blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
            const compresse = !rendue || enX2Degrade();
            options.scene.debutPhase(phase, {
              regime: compresse ? "domination" : "rendu",
              duree: (compresse ? dureeFroide : coutRendu(actions.get(phase))) / facteurDe(compresse),
            });
          },
        });
        if (rendue) {
          const action = actions.get(phase);
          const couverts = new Set(action.map((t) => t.ev).filter(Boolean));
          // la montée de tension : le spectateur sent l'occasion ARRIVER
          etapes.push({ delai: 500, optionnelle: degradable, delaiRapide: 120,
            action: () => { if (!enX2Degrade()) options.scene.tension(500 / facteurDe(false)); } });
          action.forEach((t) => {
            // plancher 0,8 s : un temps RENDU ne se brouille jamais
            const delai = t.decisif ? TEMPS_DECISIF_MS : TEMPS_MS;
            etapes.push({
              delai, plancher: TEMPS_MS, optionnelle: degradable, delaiRapide: 260,
              action: () => {
                if (enX2Degrade()) { // dégradé : journal + accent, pas de chorégraphie
                  if (t.ev) { jouerEvenement(t.ev); options.scene.evenementDomination(t.ev); }
                  return;
                }
                if (t.ev) jouerEvenement(t.ev);
                else if (elements.bandeau) {
                  const texte = texteDuTemps(t);
                  if (texte) elements.bandeau.innerHTML = texte;
                }
                options.scene.jouerTemps(t, Math.max(TEMPS_MS, delai / facteurDe(false)));
              },
            });
          });
          // le SOLDE : tout événement de la phase absent de l'action est
          // consigné (journal, score, juice) — le récit reste complet
          etapes.push({
            delai: 200,
            action: () => phase.evenements.forEach((ev) => { if (!couverts.has(ev)) jouerEvenement(ev); }),
          });
        } else {
          const pas = Math.max(300, (dureeFroide - 300) / (phase.evenements.length + 1));
          phase.evenements.forEach((ev, iEv) => {
            etapes.push({
              delai: pas, rapide: true,
              action: () => {
                jouerEvenement(ev);
                options.scene.evenementDomination(ev);
                // les autres scores du lobby vivent pendant le compressé
                if (iEv === 0 && scoresLobby.length) options.scene.notifierLobby(scoresLobby.shift());
              },
            });
          });
          etapes.push({ delai: pas, rapide: true, action: () => {} });
        }
      });
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
          ? `<br><small style="color:#96A699">Dégâts de prestige : ${ONZE.degatsPrestige(resultat.ecart, options.manche)} (base de période + ${resultat.ecart} d'écart)</small>` : "";
        const hdm = ONZE.statsDuMatch ? ONZE.statsDuMatch(resultat, equipeA, equipeB).hommeDuMatch : null;
        const ligneHdm = hdm ? `<br><small style="color:#E8C547">🌟 Homme du match : ${hdm.nom} (${hdm.equipe}) — le ⚔️ en haut détaille chaque joueur</small>` : "";
        bloc.innerHTML = `Score final : <strong>${resultat.scoreA} – ${resultat.scoreB}</strong><br>${verdict}${ligneHdm}${prestige}`;
        elements.recit.appendChild(bloc);
        bloc.scrollIntoView({ behavior: "smooth", block: "end" });
        if (auCoupDeSifflet) auCoupDeSifflet();
      },
    });

    (function suivante() {
      const etape = etapes.shift();
      if (!etape) return;
      const diviseur = options.scene ? facteurDe(etape.rapide) : vitesse;
      // le plancher de lisibilité (décision 25) : un temps de jeu RENDU
      // ne descend JAMAIS sous ~0,8 s — en ×2, un rendu sans but se
      // DÉGRADE en compressé (on réduit le nombre, pas la lisibilité)
      const delai = (etape.optionnelle && vitesse === 2)
        ? (etape.delaiRapide || 250)
        : Math.max(etape.plancher || 0, etape.delai / diviseur);
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
    const couleurNote = (n) => n >= 7.5 ? "#4FC57C" : n >= 6.5 ? "#E8C547" : "#96A699";
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    let campActif = equipeA.nom;
    const rendre = () => {
      const lignes = stats.parEquipe[campActif];
      const maxScore = Math.max(...lignes.map((l) => l.score), 1);
      const hdm = stats.hommeDuMatch;
      voile.innerHTML = `<div class="fiche-joueur" style="max-width:460px">
        <h3>⚔️ Le recap du match${opts.enCours ? " <small style='color:#96A699'>(en direct)</small>" : ""}</h3>
        <div class="sous-titre">${hdm ? `🌟 Homme du match${opts.enCours ? " provisoire" : ""} : <strong>${hdm.nom}</strong> (${hdm.equipe})` : "Personne ne s'est encore illustré…"}</div>
        <div style="margin:6px 0">
          ${[equipeA, equipeB].map((eq) =>
            `<button class="onglet-recap" data-camp="${eq.nom.replace(/"/g, "&quot;")}" style="width:auto;margin:0 4px 0 0;padding:5px 10px;font-size:0.7rem;${eq.nom === campActif ? "background:#2E4E39;border-color:#4FC57C" : ""}">${eq.nom}</button>`).join("")}
        </div>
        ${lignes.map((l) => `<div class="ligne-stat">
          <span class="note-recap" style="color:${couleurNote(Number(note10(l)))}">${note10(l)}</span>
          <span class="nom-stat">${hdm && l.nom === hdm.nom && campActif === hdm.equipe ? "🌟 " : ""}${l.nom}</span>
          <span class="barre-stat"><div style="width:${Math.round(100 * l.score / maxScore)}%"></div></span>
          <span style="font-size:0.64rem;color:#C8D6C9;white-space:nowrap">${[
            l.buts ? `⚽×${l.buts}` : "", l.passes ? `🎯×${l.passes}` : "",
            l.duels ? `⚔️×${l.duels}` : "", l.arrets ? `🧤×${l.arrets}` : "",
          ].filter(Boolean).join(" ") || "—"}</span>
        </div>`).join("")}
        <div style="color:#96A699;font-size:0.66rem;margin-top:8px">⚽ buts · 🎯 passes décisives · ⚔️ duels gagnés · 🧤 arrêts</div>
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
    const lignes = Object.entries(stats).map(([stat, valeur]) => {
      const boost = boosts[stat] || 0;
      const classe = boost > 0 ? "boostee" : boost < 0 ? "malussee" : "";
      const detail = boost ? ` (${statsBase[stat]}${boost > 0 ? "+" : ""}${boost})` : "";
      return `<div class="ligne-stat"><span class="nom-stat">${ONZE.NOMS_STATS[stat]}</span>` +
        `<span class="valeur-stat ${classe}">${valeur}</span>` +
        `<span class="barre-stat"><div style="width:${valeur}%"></div></span>` +
        `<span style="font-size:0.66rem;color:#96A699">${detail}</span></div>`;
    }).join("");
    voile.innerHTML = `<div class="fiche-joueur">
      <h3>${fiche.nom}${etoiles} <span style="float:right;color:#E8C547">${note}</span></h3>
      <div class="sous-titre">${fiche.poste} · ${fiche.cout}M${fiche.unique ? " · ⭐ " + fiche.unique : ""}${fiche.ecole ? " · " + fiche.ecole : ""}${fiche.archetype ? " · " + fiche.archetype : ""}</div>
      ${fiche.description ? `<div class="description">${fiche.description}</div>` : ""}
      ${fiche.ecoleBonus ? `<div class="sous-titre">🛂 Emblème : compte aussi comme <strong>${fiche.ecoleBonus}</strong></div>` : ""}
      ${fiche.citoyenDuMonde ? `<div class="sous-titre">🌍 Citoyen du monde : +1 dans toutes tes Écoles actives</div>` : ""}
      ${fiche.relique ? `<div class="sous-titre" style="color:#E8C547">🏺 <strong>${fiche.relique}</strong> — Relique (définitive)</div>` : ""}
      ${(fiche.specialisations || []).map((nom) => {
        const spec = Object.values(ONZE.SPECIALISATIONS).find((x) => x.nom === nom);
        const iconique = (fiche.specsIconiques || []).includes(nom);
        return `<div class="sous-titre">${iconique ? "🌟" : "🧪"} <strong>${nom}${iconique ? " (Iconique ×1,5)" : ""}</strong>${spec && spec.effet ? " — " + spec.effet : ""}</div>`;
      }).join("")}
      ${(fiche.staffCartes || []).map((c) => `<div class="sous-titre">🧰 ${c} <small>(en attente d'une 2ᵉ carte)</small></div>`).join("")}
      ${lignes}
      <div style="color:#96A699;font-size:0.68rem;margin-top:8px">Valeur <span style="color:#4FC57C">verte</span> = boostée par tes synergies. Chaque duel du match lit 2 de ces stats.</div>
      <button class="fermer">Fermer</button>
    </div>`;
    voile.addEventListener("click", (e) => { if (e.target === voile || e.target.classList.contains("fermer")) voile.remove(); });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  return { rejouer, badges, basculerVitesse, ouvrirFiche, ouvrirRecap, GLYPHES, glyphe };
})();
