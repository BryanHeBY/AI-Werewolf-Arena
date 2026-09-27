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
              function check(node, source) {
                const specifier = source?.value ?? (source?.type === "TemplateLiteral" && source.expressions.length === 0
                  ? source.quasis[0].value.cooked : null);
                if (typeof specifier !== "string") return;
                const violation = importBoundaryViolation(path.join(__dirname, "src"), context.filename, specifier);
                if (violation) context.report({ node, messageId: "forbidden", data: { violation } });
              }
              return {
                ImportDeclaration: (node) => check(node, node.source),
                ExportNamedDeclaration: (node) => check(node, node.source),
                ExportAllDeclaration: (node) => check(node, node.source),
                ImportExpression: (node) => check(node, node.source),
                TSImportType: (node) => check(node, node.argument),
                TSExternalModuleReference: (node) => check(node, node.expression),
                CallExpression(node) {
                  if (node.callee.type === "Identifier" && node.callee.name === "require") check(node, node.arguments[0]);
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
