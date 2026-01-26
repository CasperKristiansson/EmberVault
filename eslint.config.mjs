import sveltePlugin from "eslint-plugin-svelte";
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
      "config/eslint/**",
    ],
  },
  ...core,
  ...svelteConfigs,
  {
    files: ["**/*.svelte"],
    rules: {
      "svelte/no-restricted-html-elements": "off",
    },
  },
];

export default config;
