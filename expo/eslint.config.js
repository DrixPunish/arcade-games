const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `tests/` tourne sous Bun, pas dans React Native : le harnais y appelle
    // les hooks des moteurs à la main, ce que la règle des hooks interdit —
    // à raison — dans du code d'application. La suite est vérifiée en étant
    // exécutée (`bun run test`), pas en étant lintée.
    ignores: ['dist/*', 'tests/*'],
  },
]);
