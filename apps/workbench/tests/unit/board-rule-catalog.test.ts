/** 单元测试负责规则目录与自然语言表单的一致性反例。输入真实运行schema，输出全部可选字段可读性断言；不修改板子或执行对局。 */
import { expect, test } from "bun:test";
import { describeBoardRuleCatalog } from "@ai-werewolf-arena/game-runtime/config/rule-catalog";
import { hasBoardLabel } from "@ai-werewolf-arena/game-text/workbench-board";
import { schemaChoices } from "../../src/client/BoardRuleFields";
import { asObject } from "../../src/client/config-edit";
import { variantRuleSummary } from "../../src/client/board-summary";
import type { JsonObject, BoardCard } from "@ai-werewolf-arena/workbench-contract";

test("all selectable native rules have bilingual field and choice labels", () => {
  const catalog = describeBoardRuleCatalog();
  function inspect(schema: JsonObject) {
    for (const [field, value] of Object.entries(asObject(schema.properties))) {
      const rule = asObject(value),
        choices = schemaChoices(rule);
      if (Object.hasOwn(rule, "const") || (field === "policy" && choices.length === 1)) continue;
      expect(hasBoardLabel(field), field).toBe(true);
      if (rule.type === "object") inspect(rule);
      for (const choice of [...choices, ...schemaChoices(asObject(rule.items))])
        if (typeof choice === "string")
          expect(hasBoardLabel(choice), `${field}:${choice}`).toBe(true);
    }
  }
  const board = catalog.board as JsonObject;
  inspect(asObject(asObject(board.properties).rules));
  inspect(asObject(asObject(board.properties).mechanisms));
  for (const role of catalog.roles) inspect(role.schema as JsonObject);
  expect(catalog.roles.find((role) => role.role === "witch")?.defaults).toMatchObject({
    selfHeal: "disabled",
  });
});
test("variants expose the actual changed rule instead of decoding the filename", () => {
  const base: BoardCard = {
    id: "opaque_a",
    size: 12,
    roles: [],
    supported: true,
    source: "example",
    roleOptions: { witch: { selfHeal: "disabled" } },
  };
  const other = {
    ...base,
    id: "opaque_b",
    roleOptions: { witch: { selfHeal: "first_night_only" } },
  };
  expect(variantRuleSummary(other, [base, other], "zh-CN")).toContain("女巫自救：仅首夜允许");
  expect(variantRuleSummary(other, [base, other], "en")).toContain("First night only");
});
