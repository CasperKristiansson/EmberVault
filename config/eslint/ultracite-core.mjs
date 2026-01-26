// Local copy of the ultracite core config to avoid mutating @eslint/js rules.
import eslintJs from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
// biome-ignore lint/performance/noNamespaceImport: Required for ESLint parser compatibility
import * as typescriptParser from "@typescript-eslint/parser";
import eslintPrettier from "eslint-config-prettier";
// biome-ignore lint/performance/noNamespaceImport: Required for ESLint plugin compatibility
import * as importTypescriptResolver from "eslint-import-resolver-typescript";
import compat from "eslint-plugin-compat";
import cypress from "eslint-plugin-cypress";
import github from "eslint-plugin-github";
import html from "eslint-plugin-html";
// biome-ignore lint/performance/noNamespaceImport: Required for ESLint plugin compatibility
import * as importPlugin from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import n from "eslint-plugin-n";
import prettier from "eslint-plugin-prettier";
import promise from "eslint-plugin-promise";
import sonarjs from "eslint-plugin-sonarjs";
import storybook from "eslint-plugin-storybook";
import tailwindcss from "eslint-plugin-tailwindcss";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import compatRules from "./rules/compat.mjs";
import cypressRules from "./rules/cypress.mjs";
import eslintTypescriptRules from "./rules/eslint-typescript.mjs";
import githubRules from "./rules/github.mjs";
import importRules from "./rules/import.mjs";
import jestRules from "./rules/jest.mjs";
import nRules from "./rules/n.mjs";
import prettierRules from "./rules/prettier.mjs";
import promiseRules from "./rules/promise.mjs";
import sonarjsRules from "./rules/sonarjs.mjs";
import storybookRules from "./rules/storybook.mjs";
import tailwindcssRules from "./rules/tailwindcss.mjs";
import typescriptRules from "./rules/typescript.mjs";
import unicornRules from "./rules/unicorn.mjs";
import unusedImportsRules from "./rules/unused-imports.mjs";

const overrideRules = {
  "no-unused-private-class-members": "off",
  "capitalized-comments": "off",
  complexity: "off",
  "id-length": ["error", { exceptions: ["x", "y", "z"] }],
  "max-lines": "off",
  "max-lines-per-function": "off",
  "max-params": "off",
  "max-statements": "off",
  "no-ternary": "off",
  "no-undefined": "off",
  "one-var": "off",
  "prefer-destructuring": [
    "error",
    {
      array: false,
      object: true,
    },
  ],
  // https://github.com/eslint/eslint/issues/11542
  "sort-imports": "off",
  "sort-keys": "off",
  "sort-vars": "off",
};

const eslintRules = {
  ...eslintJs.configs.all.rules,
  ...overrideRules,
};

const config = [
  importPlugin.configs.typescript,
  {
    ignores: ["**/dist/", "**/build/", "**/.next/", "**/.turbo/"],
  },
  {
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    files: ["**/*.js", "**/*.ts", "**/*.mjs", "**/*.cjs", "**/*.html"],
    plugins: {
      prettier,
      import: importPlugin,
      promise,
      n,
      "unused-imports": unusedImports,
      tailwindcss,
      sonarjs,
      compat,
      unicorn,
      github,
    },
    rules: {
      ...eslintRules,
      ...importRules,
      ...promiseRules,
      ...nRules,
      ...prettierRules,
      ...eslintPrettier.rules,
      ...unusedImportsRules,
      ...tailwindcssRules,
      ...sonarjsRules,
      ...compatRules,
      ...unicornRules,
      ...githubRules,
      "import/enforce-node-protocol-usage": "off",
      "github/filenames-match-regex": "off",
      "import/unambiguous": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/file-header": "off",
      "sonarjs/file-name-differ-from-class": "off",
      "unicorn/require-module-specifiers": "off",
    },

    settings: {
      // https://github.com/import-js/eslint-plugin-import/issues/2556#issuecomment-1419518561
      "import/parsers": {
        espree: [".js", ".cjs", ".mjs", ".ts"],
      },
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      "import/typescript": importTypescriptResolver,
    },
    rules: {
      ...eslintTypescriptRules,
      ...typescriptRules,
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/only-throw-error": "off",
    },
  },
  {
    files: ["**/*.test.js", "tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    plugins: {
      jest,
    },
    rules: {
      ...jestRules,
    },
  },
  {
    files: ["**/*.cy.js"],
    languageOptions: {
      globals: {
        ...globals.cypress,
      },
    },
    plugins: {
      cypress,
    },
    rules: {
      ...cypressRules,
    },
  },
  {
    files: ["**/*.stories.js", "**/*.stories.ts"],
    plugins: {
      storybook,
    },
    rules: {
      ...storybookRules,
    },
  },
  {
    files: ["**/*.html"],
    plugins: {
      html,
    },
    settings: {
      "html/javascript-tag-names": ["script", "Script"],
    },
  },
];

export default config;
