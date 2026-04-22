const tsParser = require("@typescript-eslint/parser");

/**
 * 依赖方向守卫：
 * 通过 no-restricted-imports 阻断跨层反向依赖。
 */
module.exports = [
  {
    files: ["src/**/*.ts"],
    ignores: ["dist/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../engine/*", "../gateway/*", "../server/*", "../infra/*", "../v3/*"],
        },
      ],
    },
  },
  {
    files: ["src/memory/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../engine/*", "../gateway/*", "../server/*", "../infra/*", "../v3/*"],
        },
      ],
    },
  },
  {
    files: ["src/gateway/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../server/*", "../infra/*", "../v3/*"],
        },
      ],
    },
  },
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../server/*"],
        },
      ],
    },
  },
  {
    files: ["src/scenarios/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../engine/*", "../gateway/*", "../memory/*", "../server/*", "../infra/*", "../v3/*"],
        },
      ],
    },
  },
  {
    files: ["src/v3/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../engine/*", "../gateway/*", "../server/*", "../infra/*"],
        },
      ],
    },
  },
];

