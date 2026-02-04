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
];

export default config;
