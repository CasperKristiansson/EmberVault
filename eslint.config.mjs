import sveltePlugin from "eslint-plugin-svelte";
import tsParser from "@typescript-eslint/parser";
import core from "./config/eslint/ultracite-core.mjs";

const svelteConfigs = sveltePlugin.configs["flat/recommended"];

const config = [
  {
    ignores: [
      "**/.svelte-kit/**",
      "**/.vscode/**",
      "**/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/test-results/**",
      "infra/**",
      "config/eslint/**",
    ],
  },
  ...core,
  ...svelteConfigs,
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
    rules: {
      "svelte/no-restricted-html-elements": "off",
    },
  },
  {
    // SvelteKit intentionally excludes service worker files from the generated tsconfig.
    // Use a dedicated tsconfig so type-aware linting still works for the SW file.
    files: ["src/service-worker.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.service-worker.json"],
      },
    },
  },
];

export default config;
