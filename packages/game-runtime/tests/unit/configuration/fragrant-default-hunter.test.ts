/**
 * 单元测试以原 Fragrant 配置副本、共享机器板子 ID 及脱离引用的省略字段为输入，核对遗漏 Hunter 政策只恢复固定 Fragrant 默认值。预期为精确预设接受及归一化相等；不运行公开 JSON reader、录制器或阶段循环。
 */
import path from "node:path";
import { test, expect } from "bun:test";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig as config } from "../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { isFragrantPairSeerPreset } from "../../../src/rulesets";

const root = path.resolve(import.meta.dir, "../../../../.."),
  id = "awa_fragrant_pair_seer_12_v1";

test("omitted hunter roundtrip receives only default policy", () => {
  const c = structuredClone(config);
  delete c.hunter;
  expect(isFragrantPairSeerPreset(c)).toBe(true);
  const p = parseBoardDefinition(boardDefinitionFromConfig(id, c));
  expect(p.config).toEqual(config);
  expect(() => {
    bootstrapGame(c);
  }).not.toThrow();
});
