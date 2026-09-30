// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // ADR-39: screens and modules read the live dictionary (`t` / `useT()` from '@/lib/i18n');
  // importing es.ts directly would pin Spanish.
  {
    files: ["app/**", "components/**", "lib/**", "hooks/**"],
    ignores: ["lib/i18n/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["**/i18n/es", "@/lib/i18n/es"], message: "Use t or useT() from '@/lib/i18n' (ADR-39)." }],
      }],
    },
  },
]);
