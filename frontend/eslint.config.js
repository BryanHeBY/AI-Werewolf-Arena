/**
 * 负责前端源码的静态错误规则配置。输入为 ESLint 文件集合，输出解析选项、忽略路径与错误级别。
 * 仅声明配置，不编译或执行播放器；浏览器行为与跨包依赖仍由各自验证入口检查。
 */
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**"] },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-sparse-arrays": "error",
    },
  },
];
