/* ============================================================
   ONZE — L'ALPHABET VISUEL (DA S1, Lot 2) : les 23 écussons de
   familles en SVG, chacun en 3 états (mini sur carte · badge
   éteint · badge actif illuminé). Source : design/da/Lot 2.
   Style commun : silhouette craie pleine, découpes nuit, un seul
   accent or par écusson. Chaque silhouette reste lisible à 16 px.
   ============================================================ */
const ONZE_ECUSSONS = (() => {
  /* Les symboles, tracés EXACTS de l'artboard (viewBox 0 0 48 48) */
  const SYMBOLES = `
  <symbol id="ec-tiki" viewBox="0 0 48 48"><line x1="24" y1="11" x2="11" y2="36" stroke="#FDF8EA" stroke-width="4"></line><line x1="24" y1="11" x2="37" y2="36" stroke="#FDF8EA" stroke-width="4"></line><line x1="11" y1="36" x2="37" y2="36" stroke="#FDF8EA" stroke-width="4"></line><circle cx="24" cy="10" r="6.5" fill="#FDF8EA" stroke="#0A160D" stroke-width="2.5"></circle><circle cx="10" cy="37" r="6.5" fill="#FDF8EA" stroke="#0A160D" stroke-width="2.5"></circle><circle cx="38" cy="37" r="6.5" fill="#FDF8EA" stroke="#0A160D" stroke-width="2.5"></circle></symbol>
  <symbol id="ec-cate" viewBox="0 0 48 48"><path d="M16 21 v-7 a8 8 0 0 1 16 0 v7" fill="none" stroke="#FDF8EA" stroke-width="5"></path><rect x="11" y="21" width="26" height="20" rx="5" fill="#FDF8EA"></rect><circle cx="24" cy="29" r="3.5" fill="#0A160D"></circle><rect x="22.5" y="30" width="3" height="7" fill="#0A160D"></rect></symbol>
  <symbol id="ec-kick" viewBox="0 0 48 48"><circle cx="9" cy="38" r="6" fill="#FDF8EA"></circle><path d="M10 34 Q22 8 38 16" fill="none" stroke="#FDF8EA" stroke-width="5"></path><path d="M34 8 L46 18 L32 22 Z" fill="#FDF8EA"></path></symbol>
  <symbol id="ec-rue" viewBox="0 0 48 48"><path d="M24 3 L45 24 L24 45 L3 24 Z" fill="#FDF8EA"></path><path d="M24 11 L37 24 L24 37 L11 24 Z" fill="#0A160D"></path><circle cx="24" cy="24" r="6" fill="#FDF8EA"></circle></symbol>
  <symbol id="ec-total" viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="none" stroke="#FDF8EA" stroke-width="5"></circle><path d="M39 16 L46 24 L36 26 Z" fill="#FDF8EA"></path><path d="M14 8 L22 4 L20 14 Z" fill="#FDF8EA"></path><path d="M10 38 L4 30 L14 30 Z" fill="#FDF8EA"></path></symbol>
  <symbol id="ec-grinta" viewBox="0 0 48 48"><path d="M7 10 L16 40 L23 16 Z" fill="#FDF8EA"></path><path d="M25 16 L32 40 L41 10 Z" fill="#FDF8EA"></path></symbol>
  <symbol id="ec-acad" viewBox="0 0 48 48"><path d="M24 8 L45 19 L24 30 L3 19 Z" fill="#FDF8EA"></path><path d="M15 25 v9 q9 7 18 0 v-9" fill="#FDF8EA"></path><line x1="42" y1="21" x2="42" y2="33" stroke="#F2C14E" stroke-width="3"></line><circle cx="42" cy="35" r="3" fill="#F2C14E"></circle></symbol>
  <symbol id="ec-inter" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="none" stroke="#FDF8EA" stroke-width="4.5"></circle><ellipse cx="24" cy="24" rx="8.5" ry="18" fill="none" stroke="#FDF8EA" stroke-width="3.5"></ellipse><line x1="6" y1="24" x2="42" y2="24" stroke="#FDF8EA" stroke-width="3.5"></line></symbol>
  <symbol id="ec-douze" viewBox="0 0 48 48"><line x1="11" y1="5" x2="11" y2="44" stroke="#FDF8EA" stroke-width="5"></line><path d="M14 7 H40 L33 15.5 L40 24 H14 Z" fill="#FDF8EA"></path></symbol>
  <symbol id="ec-pros" viewBox="0 0 48 48"><path d="M18 17 v-5 h12 v5" fill="none" stroke="#FDF8EA" stroke-width="4.5"></path><rect x="7" y="17" width="34" height="22" rx="5" fill="#FDF8EA"></rect><rect x="20" y="24" width="8" height="7" rx="2" fill="#0A160D"></rect></symbol>
  <symbol id="ec-revan" viewBox="0 0 48 48"><path d="M24 4 L38 21 H30 V32 H18 V21 H10 Z" fill="#FDF8EA"></path><circle cx="12" cy="40" r="4" fill="#FDF8EA"></circle><circle cx="24" cy="42" r="4" fill="#FDF8EA"></circle><circle cx="36" cy="40" r="4" fill="#FDF8EA"></circle></symbol>
  <symbol id="ec-mur" viewBox="0 0 48 48"><rect x="6" y="12" width="17" height="9" fill="#FDF8EA"></rect><rect x="25" y="12" width="17" height="9" fill="#FDF8EA"></rect><rect x="6" y="23" width="11" height="9" fill="#FDF8EA"></rect><rect x="19" y="23" width="16" height="9" fill="#FDF8EA"></rect><rect x="37" y="23" width="5" height="9" fill="#FDF8EA"></rect><rect x="6" y="34" width="17" height="9" fill="#FDF8EA"></rect><rect x="25" y="34" width="17" height="9" fill="#FDF8EA"></rect></symbol>
  <symbol id="ec-sent" viewBox="0 0 48 48"><path d="M15 44 L17.5 16 H30.5 L33 44 Z" fill="#FDF8EA"></path><rect x="14" y="8" width="6" height="9" fill="#FDF8EA"></rect><rect x="21" y="8" width="6" height="9" fill="#FDF8EA"></rect><rect x="28" y="8" width="6" height="9" fill="#FDF8EA"></rect><rect x="21.5" y="24" width="5" height="9" rx="2.5" fill="#0A160D"></rect></symbol>
  <symbol id="ec-piston" viewBox="0 0 48 48"><path d="M24 3 L33 14 H28.5 V34 H33 L24 45 L15 34 H19.5 V14 H15 Z" fill="#FDF8EA"></path></symbol>
  <symbol id="ec-crea" viewBox="0 0 48 48"><path d="M24 4 L37 25 L24 44 L11 25 Z" fill="#FDF8EA"></path><circle cx="24" cy="25" r="4.5" fill="#0A160D"></circle><line x1="24" y1="30" x2="24" y2="42" stroke="#0A160D" stroke-width="3"></line></symbol>
  <symbol id="ec-virt" viewBox="0 0 48 48"><path d="M24 3 L29 19 L45 24 L29 29 L24 45 L19 29 L3 24 L19 19 Z" fill="#FDF8EA"></path><circle cx="38" cy="9" r="3.5" fill="#F2C14E"></circle></symbol>
  <symbol id="ec-moteur" viewBox="0 0 48 48"><rect x="20" y="4" width="8" height="40" rx="3" fill="#FDF8EA"></rect><rect x="20" y="4" width="8" height="40" rx="3" fill="#FDF8EA" transform="rotate(60 24 24)"></rect><rect x="20" y="4" width="8" height="40" rx="3" fill="#FDF8EA" transform="rotate(120 24 24)"></rect><circle cx="24" cy="24" r="11" fill="#FDF8EA"></circle><circle cx="24" cy="24" r="5" fill="#0A160D"></circle></symbol>
  <symbol id="ec-fini" viewBox="0 0 48 48"><circle cx="24" cy="24" r="17.5" fill="none" stroke="#FDF8EA" stroke-width="4.5"></circle><circle cx="24" cy="24" r="9" fill="none" stroke="#FDF8EA" stroke-width="4"></circle><circle cx="24" cy="24" r="3.5" fill="#FDF8EA"></circle></symbol>
  <symbol id="ec-renard" viewBox="0 0 48 48"><path d="M8 6 L19 17 L7 21 Z" fill="#FDF8EA"></path><path d="M40 6 L29 17 L41 21 Z" fill="#FDF8EA"></path><path d="M7 19 L41 19 L24 44 Z" fill="#FDF8EA"></path><circle cx="17" cy="24" r="2.5" fill="#0A160D"></circle><circle cx="31" cy="24" r="2.5" fill="#0A160D"></circle></symbol>
  <symbol id="ec-chanc" viewBox="0 0 48 48"><circle cx="24" cy="13" r="8.5" fill="#FDF8EA"></circle><circle cx="14" cy="27" r="8.5" fill="#FDF8EA"></circle><circle cx="34" cy="27" r="8.5" fill="#FDF8EA"></circle><path d="M24 28 Q26 38 30 44" fill="none" stroke="#FDF8EA" stroke-width="4"></path></symbol>
  <symbol id="ec-guer" viewBox="0 0 48 48"><line x1="11" y1="9" x2="37" y2="39" stroke="#FDF8EA" stroke-width="5"></line><line x1="37" y1="9" x2="11" y2="39" stroke="#FDF8EA" stroke-width="5"></line><line x1="9" y1="32" x2="20" y2="32" stroke="#FDF8EA" stroke-width="4" transform="rotate(49 14 32)"></line><line x1="28" y1="32" x2="39" y2="32" stroke="#FDF8EA" stroke-width="4" transform="rotate(-49 34 32)"></line></symbol>
  <symbol id="ec-mentor" viewBox="0 0 48 48"><path d="M24 3 C32 12 34 17 24 24 C14 17 16 12 24 3 Z" fill="#F2C14E"></path><rect x="19" y="24" width="10" height="19" rx="4" fill="#FDF8EA"></rect><rect x="17" y="27" width="14" height="4" rx="2" fill="#0A160D"></rect></symbol>
  <symbol id="ec-capi" viewBox="0 0 48 48"><rect x="5" y="15" width="38" height="18" rx="9" fill="#FDF8EA"></rect><path d="M24 17 L26 22.5 L32 22.5 L27.5 26 L29 32 L24 28.5 L20.5 26 L16 22.5 L22 22.5 Z" fill="#0A160D"></path></symbol>`;

  const IDS = {
    "Tiki-Taka": "ec-tiki", "Catenaccio": "ec-cate", "Kick & Rush": "ec-kick",
    "École de la Rue": "ec-rue", "Football Total": "ec-total", "La Grinta": "ec-grinta",
    "L'Académie": "ec-acad", "Les Internationaux": "ec-inter", "Le Douzième Homme": "ec-douze",
    "Les Pros": "ec-pros", "Les Revanchards": "ec-revan",
    "Mur": "ec-mur", "Sentinelle": "ec-sent", "Piston": "ec-piston", "Créateur": "ec-crea",
    "Virtuose": "ec-virt", "Moteur": "ec-moteur", "Finisseur": "ec-fini", "Renard": "ec-renard",
    "Chanceux": "ec-chanc", "Guerrier": "ec-guer", "Mentor": "ec-mentor", "Capitaine": "ec-capi",
  };

  /* Le sprite s'injecte une fois, au premier usage */
  let injecte = false;
  function injecter() {
    if (injecte || typeof document === "undefined" || !document.body) return;
    const conteneur = document.createElement("div");
    conteneur.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    conteneur.innerHTML = `<svg width="0" height="0"><defs>${SYMBOLES}</defs></svg>`;
    document.body.appendChild(conteneur);
    injecte = true;
  }

  const idDe = (nom) => IDS[nom] || null;
  /* mini : la pastille ronde 14-16 px posée sur les cartes */
  function mini(nom, px = 14) {
    const id = idDe(nom);
    if (!id) return "";
    injecter();
    const s = Math.round(px * 0.72);
    return `<span class="ecusson-mini" title="${nom}" style="width:${px}px;height:${px}px">` +
      `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><use href="#${id}"></use></svg></span>`;
  }
  /* badge : la version des colonnes/panneaux — actif (illuminé) ou éteint */
  function badge(nom, actif, px = 22) {
    const id = idDe(nom);
    if (!id) return "";
    injecter();
    const s = Math.round(px * 0.64);
    return `<span class="ecusson-badge${actif ? " actif" : " eteint"}" style="width:${px}px;height:${px}px">` +
      `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><use href="#${id}"></use></svg></span>`;
  }
  return { mini, badge, idDe, injecter };
})();
if (typeof module !== "undefined") module.exports = ONZE_ECUSSONS;
