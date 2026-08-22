/* ============================================================
   ONZE — L'ICONOGRAPHIE SYSTÈME (DA S1, Lot 6, post-playtest 7).
   Les emojis d'interface (pastilles de manche, boutons de
   panneaux, monnaies) remplacés par des icônes SVG dans le style
   Arcade des écussons du Lot 2 : silhouettes grasses, géométrie
   simple, lisibles à 13 px. Les icônes héritent de la couleur du
   texte (currentColor) — le CSS des boutons les colore.
   Planche de référence : design/da/Lot_6__Icones_systeme.dc.html
   ============================================================ */
const ONZE_ICONES_SYS = (() => {
  /* viewBox 0 0 48 48, découpes nuit #0A160D comme les écussons */
  const SYMBOLES = `
  <symbol id="is-poignee" viewBox="0 0 48 48"><circle cx="17" cy="24" r="10.5" fill="none" stroke="currentColor" stroke-width="5"></circle><circle cx="31" cy="24" r="10.5" fill="none" stroke="currentColor" stroke-width="5"></circle></symbol>
  <symbol id="is-epees" viewBox="0 0 48 48"><line x1="11" y1="9" x2="37" y2="39" stroke="currentColor" stroke-width="5"></line><line x1="37" y1="9" x2="11" y2="39" stroke="currentColor" stroke-width="5"></line><line x1="9" y1="32" x2="20" y2="32" stroke="currentColor" stroke-width="4" transform="rotate(49 14 32)"></line><line x1="28" y1="32" x2="39" y2="32" stroke="currentColor" stroke-width="4" transform="rotate(-49 34 32)"></line></symbol>
  <symbol id="is-boussole" viewBox="0 0 48 48"><circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" stroke-width="4.5"></circle><path d="M24 11 L29.5 24 L24 37 L18.5 24 Z" fill="currentColor"></path><circle cx="24" cy="24" r="2.5" fill="#0A160D"></circle></symbol>
  <symbol id="is-flocon" viewBox="0 0 48 48"><line x1="24" y1="5" x2="24" y2="43" stroke="currentColor" stroke-width="4.5"></line><line x1="24" y1="5" x2="24" y2="43" stroke="currentColor" stroke-width="4.5" transform="rotate(60 24 24)"></line><line x1="24" y1="5" x2="24" y2="43" stroke="currentColor" stroke-width="4.5" transform="rotate(120 24 24)"></line><circle cx="24" cy="24" r="4.5" fill="currentColor"></circle></symbol>
  <symbol id="is-trophee" viewBox="0 0 48 48"><path d="M13 6 h22 v13 a11 11 0 0 1 -22 0 Z" fill="currentColor"></path><path d="M12 9 H4 a9 9 0 0 0 9 10" fill="none" stroke="currentColor" stroke-width="3.5"></path><path d="M36 9 h8 a9 9 0 0 1 -9 10" fill="none" stroke="currentColor" stroke-width="3.5"></path><rect x="21" y="29" width="6" height="9" fill="currentColor"></rect><rect x="14" y="37" width="20" height="5" rx="2" fill="currentColor"></rect></symbol>
  <symbol id="is-parchemin" viewBox="0 0 48 48"><rect x="11" y="6" width="26" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="4"></rect><line x1="17" y1="16" x2="31" y2="16" stroke="currentColor" stroke-width="3"></line><line x1="17" y1="24" x2="31" y2="24" stroke="currentColor" stroke-width="3"></line><line x1="17" y1="32" x2="26" y2="32" stroke="currentColor" stroke-width="3"></line></symbol>
  <symbol id="is-calepin" viewBox="0 0 48 48"><rect x="10" y="11" width="28" height="31" rx="4" fill="none" stroke="currentColor" stroke-width="4"></rect><line x1="16" y1="5" x2="16" y2="15" stroke="currentColor" stroke-width="3.5"></line><line x1="24" y1="5" x2="24" y2="15" stroke="currentColor" stroke-width="3.5"></line><line x1="32" y1="5" x2="32" y2="15" stroke="currentColor" stroke-width="3.5"></line><line x1="17" y1="25" x2="31" y2="25" stroke="currentColor" stroke-width="3"></line><line x1="17" y1="33" x2="27" y2="33" stroke="currentColor" stroke-width="3"></line></symbol>
  <symbol id="is-fiole" viewBox="0 0 48 48"><path d="M19 5 h10 M21 5 v11 L33 35 a5 5 0 0 1 -4.5 8 h-9 A5 5 0 0 1 15 35 L27 16 V5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path><path d="M17.5 31 h13 l3 6 a3 3 0 0 1 -3 4.5 H17.5 a3 3 0 0 1 -3 -4.5 Z" fill="currentColor"></path></symbol>
  <symbol id="is-plein-ecran" viewBox="0 0 48 48"><path d="M7 18 V7 h11 M30 7 h11 v11 M41 30 v11 H30 M18 41 H7 V30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path></symbol>
  <symbol id="is-cadenas" viewBox="0 0 48 48"><path d="M16 21 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="currentColor" stroke-width="5"></path><rect x="10" y="21" width="28" height="21" rx="5" fill="currentColor"></rect><circle cx="24" cy="29" r="3.5" fill="#0A160D"></circle><rect x="22.5" y="30" width="3" height="7" fill="#0A160D"></rect></symbol>
  <symbol id="is-cadenas-ouvert" viewBox="0 0 48 48"><path d="M16 21 v-6 a8 8 0 0 1 16 0 v-2" fill="none" stroke="currentColor" stroke-width="5"></path><rect x="10" y="21" width="28" height="21" rx="5" fill="currentColor"></rect><circle cx="24" cy="29" r="3.5" fill="#0A160D"></circle><rect x="22.5" y="30" width="3" height="7" fill="#0A160D"></rect></symbol>
  <symbol id="is-refresh" viewBox="0 0 48 48"><path d="M40 24 a16 16 0 1 1 -5.5 -12" fill="none" stroke="currentColor" stroke-width="5"></path><path d="M35 2 L40 14 L27 13 Z" fill="currentColor"></path></symbol>
  <symbol id="is-xp" viewBox="0 0 48 48"><path d="M6 38 L18 25 L26 31 L38 16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path><path d="M31 12 L42 10 L41 21 Z" fill="currentColor"></path></symbol>
  <symbol id="is-staff" viewBox="0 0 48 48"><path d="M18 17 v-5 h12 v5" fill="none" stroke="currentColor" stroke-width="4.5"></path><rect x="6" y="17" width="36" height="22" rx="5" fill="currentColor"></rect><line x1="6" y1="27" x2="42" y2="27" stroke="#0A160D" stroke-width="3"></line><rect x="20" y="23.5" width="8" height="7" rx="2" fill="#0A160D"></rect></symbol>
  <symbol id="is-cible" viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="4"></circle><circle cx="24" cy="24" r="7.5" fill="none" stroke="currentColor" stroke-width="3.5"></circle><circle cx="24" cy="24" r="2.5" fill="currentColor"></circle><line x1="24" y1="2" x2="24" y2="9" stroke="currentColor" stroke-width="4"></line><line x1="24" y1="39" x2="24" y2="46" stroke="currentColor" stroke-width="4"></line><line x1="2" y1="24" x2="9" y2="24" stroke="currentColor" stroke-width="4"></line><line x1="39" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="4"></line></symbol>
  <symbol id="is-ballon" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="4.5"></circle><polygon points="24,15 33,21.5 29.5,32 18.5,32 15,21.5" fill="currentColor"></polygon></symbol>
  <symbol id="is-flamme" viewBox="0 0 48 48"><path d="M24 3 C27 11 37 15 37 27 A13 13 0 0 1 11 27 C11 19 17 15 18 8 C21 12 23 13 24 3 Z" fill="currentColor"></path><path d="M24 43 a6.5 6.5 0 0 1 -6.5 -6.5 C17.5 32 21 30 24 25.5 C27 30 30.5 32 30.5 36.5 A6.5 6.5 0 0 1 24 43 Z" fill="#0A160D"></path></symbol>
  <symbol id="is-coeur" viewBox="0 0 48 48"><path d="M24 42 C10 32 5 22 9 14 C12 8 20 8 24 15 C28 8 36 8 39 14 C43 22 38 32 24 42 Z" fill="currentColor"></path></symbol>
  <symbol id="is-piece" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="4.5"></circle><path d="M15 32 V16 l9 10.5 9 -10.5 V32" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path></symbol>
  <symbol id="is-vitesse" viewBox="0 0 48 48"><path d="M6 9 L23 24 L6 39 Z" fill="currentColor"></path><path d="M25 9 L42 24 L25 39 Z" fill="currentColor"></path></symbol>
  <symbol id="is-chrono" viewBox="0 0 48 48"><rect x="19" y="3" width="10" height="5" rx="2" fill="currentColor"></rect><circle cx="24" cy="27" r="16" fill="none" stroke="currentColor" stroke-width="4.5"></circle><line x1="24" y1="27" x2="24" y2="17" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line><line x1="24" y1="27" x2="31" y2="31" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line></symbol>
  <symbol id="is-chrono-barre" viewBox="0 0 48 48"><rect x="19" y="3" width="10" height="5" rx="2" fill="currentColor"></rect><circle cx="24" cy="27" r="16" fill="none" stroke="currentColor" stroke-width="4.5"></circle><line x1="24" y1="27" x2="31" y2="31" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line><line x1="7" y1="44" x2="41" y2="10" stroke="currentColor" stroke-width="5" stroke-linecap="round"></line></symbol>
  <symbol id="is-etoile" viewBox="0 0 48 48"><path d="M24 4 L29.5 17.5 L44 18.5 L33 28 L36.5 42 L24 34.5 L11.5 42 L15 28 L4 18.5 L18.5 17.5 Z" fill="currentColor"></path></symbol>
  <symbol id="is-couronne" viewBox="0 0 48 48"><path d="M8 36 L6 13 L17 23 L24 7 L31 23 L42 13 L40 36 Z" fill="currentColor"></path><rect x="8" y="38" width="32" height="4.5" rx="2" fill="currentColor"></rect></symbol>
  <symbol id="is-hp" viewBox="0 0 48 48"><path d="M7 18 h8 L26 8 v32 L15 30 H7 Z" fill="currentColor"></path><path d="M32 16 a9 9 0 0 1 0 16 M36 10 a16 16 0 0 1 0 28" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"></path></symbol>
  <symbol id="is-hp-mute" viewBox="0 0 48 48"><path d="M7 18 h8 L26 8 v32 L15 30 H7 Z" fill="currentColor"></path><line x1="31" y1="18" x2="43" y2="30" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line><line x1="43" y1="18" x2="31" y2="30" stroke="currentColor" stroke-width="4" stroke-linecap="round"></line></symbol>
  <symbol id="is-balai" viewBox="0 0 48 48"><line x1="30" y1="4" x2="18" y2="26" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"></line><path d="M10 30 L22 24 L30 38 a2 2 0 0 1 -2 3 L13 42 a2 2 0 0 1 -3 -2 Z" fill="currentColor"></path></symbol>
  <symbol id="is-loupe" viewBox="0 0 48 48"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="5"></circle><line x1="30" y1="30" x2="42" y2="42" stroke="currentColor" stroke-width="6" stroke-linecap="round"></line></symbol>`;

  const NOMS = ["poignee", "epees", "boussole", "flocon", "trophee", "parchemin", "calepin",
    "fiole", "plein-ecran", "cadenas", "cadenas-ouvert", "refresh", "xp", "staff", "cible",
    "ballon", "flamme", "coeur", "piece", "vitesse", "chrono", "chrono-barre", "etoile",
    "couronne", "hp", "hp-mute", "balai", "loupe"];

  /* Le sprite s'injecte une fois, au premier usage (comme les écussons) */
  let injecte = false;
  function injecter() {
    if (injecte || typeof document === "undefined" || !document.body) return;
    const conteneur = document.createElement("div");
    conteneur.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    conteneur.innerHTML = `<svg width="0" height="0"><defs>${SYMBOLES}</defs></svg>`;
    document.body.appendChild(conteneur);
    injecte = true;
  }

  /* L'icône en ligne, à la taille du texte : ic("trophee", 14) */
  function ic(nom, px = 16) {
    if (!NOMS.includes(nom)) return "";
    injecter();
    return `<svg class="ic-sys" width="${px}" height="${px}" viewBox="0 0 48 48" aria-hidden="true"><use href="#is-${nom}"></use></svg>`;
  }
  return { ic, NOMS, injecter };
})();
if (typeof module !== "undefined") module.exports = ONZE_ICONES_SYS;
