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
  const DUREES_RENDU = {
    but: 2400, arret: 1600, blocage: 1300, rebond: 900, percee: 1200,
    possession: 750, geste: 950, contre: 950, ballon_long: 850, lambretta: 950,
    percee_stoppee: 1000, interception: 950, hors_jeu: 800,
  };
  const estChaude = (phase) => phase.evenements.some((ev) =>
    ev.but || ev.type === "arret" || ev.type === "blocage" || ev.type === "rebond");
  const dureeRendu = (phase) => 300 + 500 +
    phase.evenements.reduce((t, ev) => t + (DUREES_RENDU[ev.but ? "but" : ev.type] || 800), 0);

  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet, options = {}) {
    const delaiPhase = options.delaiPhase || DELAI_PHASE_MS;
    const delaiEvenement = options.delaiEvenement || DELAI_EVENEMENT_MS;
    elements.recit.innerHTML = "";
    elements.scoreA.textContent = "0";
    elements.scoreB.textContent = "0";
    const scores = { a: 0, b: 0 };
    const etapes = [];
    let blocCourant = null;

    // le facteur de vitesse d'une étape : les froides se sautent en ×2
    const facteurDe = (rapide) => vitesse === 1 ? 1 : (rapide ? 4 : 1.6);

    const jouerEvenement = (ev) => {
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
      // ---- Le tempo à deux régimes, dans le budget strict (décision 20) ----
      const budgetTotal = delaiPhase * resultat.phases.length;
      const chaudes = resultat.phases.filter(estChaude);
      const coutChaudes = chaudes.reduce((t, p) => t + dureeRendu(p), 0);
      const nbFroides = resultat.phases.length - chaudes.length;
      const dureeFroide = Math.max(1500, Math.min(3400,
        nbFroides ? (budgetTotal - coutChaudes) / nbFroides : 2000));
      resultat.phases.forEach((phase) => {
        const chaude = estChaude(phase);
        etapes.push({
          delai: 300, rapide: !chaude,
          action: () => {
            blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
            options.scene.debutPhase(phase, {
              regime: chaude ? "rendu" : "domination",
              duree: (chaude ? dureeRendu(phase) : dureeFroide) / facteurDe(!chaude),
            });
          },
        });
        if (chaude) {
          // la montée de tension : le spectateur sent l'occasion ARRIVER
          etapes.push({ delai: 500, action: () => options.scene.tension(500 / facteurDe(false)) });
          phase.evenements.forEach((ev) => {
            const delai = DUREES_RENDU[ev.but ? "but" : ev.type] || 800;
            etapes.push({
              delai,
              action: () => { jouerEvenement(ev); options.scene.evenement(ev, delai / facteurDe(false)); },
            });
          });
        } else {
          const pas = Math.max(300, (dureeFroide - 300) / (phase.evenements.length + 1));
          phase.evenements.forEach((ev) => {
            etapes.push({
              delai: pas, rapide: true,
              action: () => { jouerEvenement(ev); options.scene.evenementDomination(ev); },
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
      setTimeout(() => { etape.action(); suivante(); }, etape.delai / diviseur);
    })();
  }

  /* ⚔️ Le recap du match — contributions par joueur (buts, passes
     décisives, duels gagnés, arrêts), barres proportionnelles,
     extensible au camp adverse par les onglets. Ouvrable PENDANT le
     match (il lit le résultat déjà calculé — on n'affiche que le
     récap final, comme l'épée de TFT). */
  function ouvrirRecap(resultat, equipeA, equipeB) {
    const stats = ONZE.statsDuMatch(resultat, equipeA, equipeB);
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    let campActif = equipeA.nom;
    const rendre = () => {
      const lignes = stats.parEquipe[campActif];
      const maxScore = Math.max(...lignes.map((l) => l.score), 1);
      const hdm = stats.hommeDuMatch;
      voile.innerHTML = `<div class="fiche-joueur" style="max-width:460px">
        <h3>⚔️ Le recap du match</h3>
        <div class="sous-titre">${hdm ? `🌟 Homme du match : <strong>${hdm.nom}</strong> (${hdm.equipe})` : "Personne ne s'est illustré…"}</div>
        <div style="margin:6px 0">
          ${[equipeA, equipeB].map((eq) =>
            `<button class="onglet-recap" data-camp="${eq.nom.replace(/"/g, "&quot;")}" style="width:auto;margin:0 4px 0 0;padding:5px 10px;font-size:0.7rem;${eq.nom === campActif ? "background:#2E4E39;border-color:#4FC57C" : ""}">${eq.nom}</button>`).join("")}
        </div>
        ${lignes.map((l) => `<div class="ligne-stat">
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
      ${(fiche.specialisations || []).map((nom) => {
        const spec = Object.values(ONZE.SPECIALISATIONS).find((x) => x.nom === nom);
        return `<div class="sous-titre">🧪 <strong>${nom}</strong>${spec && spec.effet ? " — " + spec.effet : ""}</div>`;
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
