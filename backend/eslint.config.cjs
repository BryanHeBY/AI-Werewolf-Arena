/**
 * 负责将旧层级路径规则接入后端 ESLint。输入为 src 下的导入／导出和字面模块名；
 * 输出为原路径判定器的违规诊断，不解析动态拼接路径或执行被检查模块。
 * 本配置只注册扫描入口；角色间依赖、共享包出口等约束另由架构门禁核对。
 */
const path = require("node:path");
const tsParser = require("@typescript-eslint/parser");
const { importBoundaryViolation } = require("./scripts/import_boundaries.cjs");

module.exports = [
  {
    files: ["src/**/*.ts"],
    ignores: ["dist/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      boundaries: {
        rules: {
          imports: {
            meta: { type: "problem", schema: [], messages: { forbidden: "{{violation}}" } },
            create(context) {
              // 普通字面与无插值模板共用判定器；遇到可执行表达式时不求值猜测模块名。
              function check(node, source) {
                const specifier =
                  source?.value ??
                  (source?.type === "TemplateLiteral" && source.expressions.length === 0
                    ? source.quasis[0].value.cooked
                    : null);
                if (typeof specifier !== "string") return;
                const violation = importBoundaryViolation(
                  path.join(__dirname, "src"),
                  context.filename,
                  specifier,
                );
                if (violation)
                  context.report({ node, messageId: "forbidden", data: { violation } });
              }
              return {
                ImportDeclaration: (node) => check(node, node.source),
                ExportNamedDeclaration: (node) => check(node, node.source),
                ExportAllDeclaration: (node) => check(node, node.source),
                ImportExpression: (node) => check(node, node.source),
                TSImportType: (node) => check(node, node.argument),
                TSExternalModuleReference: (node) => check(node, node.expression),
                CallExpression(node) {
                  if (node.callee.type === "Identifier" && node.callee.name === "require")
                    check(node, node.arguments[0]);
                },
              };
            },
          },
        },
      },
    },
    rules: { "boundaries/imports": "error" },
  },
];
