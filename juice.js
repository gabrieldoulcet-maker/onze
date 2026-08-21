/* ============================================================
   ONZE — Le juice sonore et visuel.
   ------------------------------------------------------------
   Tous les sons sont SYNTHÉTISÉS en WebAudio (zéro fichier, zéro
   dépendance) : achat, vente, fusion (2★ et 3★), palier de
   synergie, but, arrêt, arrivée d'un Unique / d'une Icône.
   L'AudioContext ne naît qu'au premier geste de l'utilisateur
   (politique des navigateurs) ; s'il est suspendu, on réessaie.
   Un interrupteur 🔇 persiste dans localStorage.
   ============================================================ */

const ONZE_JUICE = (() => {
  const CLE_SONS = "onze-sons";
  let actif = true;
  try { actif = localStorage.getItem(CLE_SONS) !== "off"; } catch (e) {}
  let ctx = null;

  const contexte = () => {
    if (!actif) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx.state === "running" || ctx.state === "suspended" ? ctx : null;
    } catch (e) { return null; }
  };

  /* Une note : oscillateur + enveloppe. type: sine/square/triangle. */
  function note(frequence, debut, duree, { type = "sine", volume = 0.16, glisse = null } = {}) {
    const c = contexte();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    const t = c.currentTime + debut;
    osc.frequency.setValueAtTime(frequence, t);
    if (glisse) osc.frequency.exponentialRampToValueAtTime(glisse, t + duree);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + duree + 0.05);
  }

  /* Un souffle de foule : bruit blanc filtré (pour les buts). */
  function foule(debut, duree, volume) {
    const c = contexte();
    if (!c) return;
    const taille = Math.floor(c.sampleRate * duree);
    const tampon = c.createBuffer(1, taille, c.sampleRate);
    const donnees = tampon.getChannelData(0);
    for (let i = 0; i < taille; i++) donnees[i] = (Math.random() * 2 - 1) * (1 - i / taille);
    const source = c.createBufferSource();
    source.buffer = tampon;
    const filtre = c.createBiquadFilter();
    filtre.type = "bandpass";
    filtre.frequency.value = 900;
    filtre.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.value = volume;
    source.connect(filtre).connect(gain).connect(c.destination);
    source.start(c.currentTime + debut);
  }

  /* ---- La palette ---- */
  const SONS = {
    achat: () => note(520, 0, 0.09, { type: "square", volume: 0.08, glisse: 760 }),
    vente: () => note(440, 0, 0.11, { type: "square", volume: 0.07, glisse: 260 }),
    refresh: () => note(340, 0, 0.06, { type: "triangle", volume: 0.06, glisse: 420 }),
    fusion: () => { note(392, 0, 0.1); note(494, 0.09, 0.1); note(587, 0.18, 0.16, { volume: 0.2 }); },
    fusion3: () => {
      note(392, 0, 0.1); note(494, 0.09, 0.1); note(587, 0.18, 0.1);
      note(784, 0.28, 0.3, { volume: 0.24 }); note(988, 0.38, 0.34, { volume: 0.18 });
      foule(0.3, 0.5, 0.05);
    },
    palier: () => { note(523, 0, 0.09, { type: "triangle" }); note(659, 0.08, 0.14, { type: "triangle", volume: 0.18 }); },
    unique: () => { note(587, 0, 0.12); note(740, 0.11, 0.12); note(880, 0.22, 0.26, { volume: 0.22 }); },
    icone: () => {
      note(523, 0, 0.11); note(659, 0.1, 0.11); note(784, 0.2, 0.11); note(1047, 0.3, 0.4, { volume: 0.24 });
      foule(0.25, 0.6, 0.06);
    },
    arret: () => note(180, 0, 0.1, { type: "triangle", volume: 0.1, glisse: 120 }),
    defaite: () => { note(330, 0, 0.16, { volume: 0.1 }); note(262, 0.15, 0.3, { volume: 0.1, glisse: 220 }); },
  };
  function jouer(nom) {
    if (!actif || !SONS[nom]) return;
    try { SONS[nom](); } catch (e) {}
  }

  /* Le BUT : son + célébration visuelle PROPORTIONNELS à l'enjeu.
     niveau 1 = amical (petit), 2 = PvP/coupe (moyen), 3 = les manches
     qui peuvent éliminer (grand : secousse + confettis). */
  function but(niveau = 2, scene) {
    if (actif) {
      try {
        note(392, 0, 0.1, { volume: 0.14 });
        note(523, 0.09, 0.12, { volume: 0.18 });
        if (niveau >= 2) { note(659, 0.2, 0.2, { volume: 0.2 }); foule(0.05, 0.7, 0.07); }
        if (niveau >= 3) { note(784, 0.3, 0.35, { volume: 0.22 }); foule(0.2, 1.1, 0.1); }
      } catch (e) {}
    }
    const racine = scene || document.querySelector(".scene-match");
    if (!racine) return;
    if (niveau >= 2) {
      racine.classList.remove("secousse");
      void racine.offsetWidth; // relance l'animation
      racine.classList.add("secousse");
    }
    if (niveau >= 3) confettis(racine, 18);
    else if (niveau >= 2) confettis(racine, 8);
  }

  /* Des confettis légers : quelques divs en transform, retirés vite. */
  const TEINTES = ["#E8C547", "#4FC57C", "#9CC4EF", "#E8654F", "#A66BD4"];
  function confettis(racine, nb) {
    for (let i = 0; i < nb; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = 35 + Math.random() * 30 + "%";
      c.style.top = "38%";
      c.style.background = TEINTES[i % TEINTES.length];
      c.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
      c.style.setProperty("--rot", (Math.random() * 500 - 250).toFixed(0) + "deg");
      c.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
      racine.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }

  function basculer() {
    actif = !actif;
    try { localStorage.setItem(CLE_SONS, actif ? "on" : "off"); } catch (e) {}
    return actif;
  }

  return { jouer, but, confettis, basculer, estActif: () => actif };
})();

if (typeof module !== "undefined") module.exports = ONZE_JUICE;
