import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import vitest from "@vitest/eslint-plugin";
import tseslint from "typescript-eslint";

const sharedExtends = [
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
];

const sharedLanguageOptions = {
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
};

const sharedRules: Linter.RulesRecord = {
  "sort-imports": ["error", { ignoreDeclarationSort: true }],
  "object-shorthand": "error",
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", ".temp/**", "docs/.local/**"]),
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "*.config.ts"],
    extends: sharedExtends,
    languageOptions: sharedLanguageOptions,
    rules: sharedRules,
  },
  {
    files: ["tests/**/*.ts"],
    extends: sharedExtends,
    plugins: { vitest },
    languageOptions: sharedLanguageOptions,
    rules: {
      ...vitest.configs.recommended.rules,
      ...sharedRules,
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expectTxFail", "factSucceeds"] }],
    },
  },
  {
    files: ["tests/specs/integration/**/*.ts"],
    rules: {
      // Successful ledger operations also assert by rejecting unsuccessful transactions.
      "vitest/expect-expect": "off",
      // Ledger response guards narrow optional metadata before checking its fields.
      "vitest/no-conditional-expect": "off",
    },
  },
]);
