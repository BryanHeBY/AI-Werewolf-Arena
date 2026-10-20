/**
 * 单元测试用不可变公开示例核对诡术师准入；字面 predicate 和归一化板子相等断言验证声明的十二人装配。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { tricksterTwelveConfig } from "../../../src/rulesets/presets/trickster-twelve";
test("Public Trickster preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../../../../configs.example/boards/awa_trickster_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(boardDefinitionFromConfig("awa_trickster_12_v1", tricksterTwelveConfig)),
  );
});
