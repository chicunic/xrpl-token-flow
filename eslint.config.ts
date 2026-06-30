import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import vitest from "@vitest/eslint-plugin";
import tseslint from "typescript-eslint";

const sharedRules: Linter.RulesRecord = {
  "sort-imports": ["error", { ignoreDeclarationSort: true }],
  "object-shorthand": "error",
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**"]),
  {
    files: ["src/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintConfigPrettier,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { ...sharedRules },
  },
  {
    files: ["tests/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintConfigPrettier,
    ],
    plugins: { vitest },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      ...sharedRules,
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "vitest/expect-expect": "off",
      "vitest/no-conditional-expect": "off",
    },
  },
]);
