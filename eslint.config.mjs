export default [
  {
    files: ["*.js", "simulations/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly", sessionStorage: "readonly",
        navigator: "readonly", performance: "readonly", requestAnimationFrame: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
        module: "writable", require: "readonly", process: "readonly", console: "readonly",
        AudioContext: "readonly", webkitAudioContext: "readonly", screen: "readonly", confirm: "readonly", alert: "readonly",
        __dirname: "readonly", fetch: "readonly", Image: "readonly", Promise: "readonly",
        // les modules ONZE_* se définissent chacun dans leur fichier et se
        // consomment dans le navigateur — pas des globales de lint
        ONZE: "readonly", ONZE_UI: "readonly", ONZE_SCENE: "readonly", ONZE_JUICE: "readonly", ONZE_ECUSSONS: "readonly", ONZE_IA: "readonly", ONZE_ICONES_SYS: "readonly",
        ONZE_ICONES: "readonly", ONZE_FAMILLES: "readonly", ONZE_ECO: "readonly", ONZE_STADE: "readonly",
        ONZE_LIEN: "readonly", ONZE_PORTRAITS: "readonly", ONZE_TERRAINS: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^(ONZE|_)" }],
      "no-dupe-keys": "error", "no-unreachable": "error",
      "no-redeclare": ["error", { builtinGlobals: false }],
      "eqeqeq": "off", "no-empty": "off",
    },
  },
  {
    /* quetes-lien.js est le pont entre les quêtes (icones.js) et l'état
       de la partie, qui vit dans partie.html. Il lit `partie` et
       `tousLesJoueurs` — toujours sous garde `typeof … !== "undefined"`,
       pour rester chargeable seul (les tests l'exigent). C'est le SEUL
       module autorisé à les nommer. */
    files: ["quetes-lien.js"],
    languageOptions: { globals: { partie: "readonly", tousLesJoueurs: "readonly" } },
  },
  {
    // les specs contiennent du code page.evaluate() exécuté DANS le jeu :
    // les globales du navigateur de jeu y sont légitimes
    files: ["tests/*.js"],
    languageOptions: {
      ecmaVersion: 2023, sourceType: "script",
      globals: { require: "readonly", process: "readonly", console: "readonly", module: "writable",
        setTimeout: "readonly", document: "readonly", window: "readonly", localStorage: "readonly", sessionStorage: "readonly" },
    },
    rules: { "no-undef": "off", "no-unused-vars": "off", "no-dupe-keys": "error", "no-unreachable": "error" },
  },
];
