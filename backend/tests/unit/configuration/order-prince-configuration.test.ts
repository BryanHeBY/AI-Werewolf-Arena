/**
 * 单元测试读取不可变 Order Prince 公开板子，用精确反向配置及不支持政策断言核对具名有限装配，不虚构变体。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { orderPrinceTwelveConfig } from "../../../src/rulesets/presets/order-prince-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { boardConfigSchema } from "../../../src/domain/board-schema";
test("Order Prince public board roundtrip", async () => {
  const config = structuredClone(orderPrinceTwelveConfig);
  expect(boardConfigSchema.parse(config)).toEqual(config);
  expect(bootstrapGame(config).playerIds).toHaveLength(12);
  const id = "awa_order_prince_12_v1";
  const definition = await Bun.file(
    new URL("../../../../configs.example/boards/" + id + ".json", import.meta.url),
  ).json();
  expect(parseBoardDefinition(definition).config).toEqual(config);
  expect(boardDefinitionFromConfig(id, config)).toEqual(definition);
});
test("Order Prince rejects invented policies and unknown configuration", () => {
  for (const value of [
    { policy: "all_rounds" },
    { policy: "awa_order_prince_first_ballot_v1", tieActivation: "skip" },
  ])
    expect(() =>
      boardConfigSchema.parse({ ...orderPrinceTwelveConfig, orderPrince: value }),
    ).toThrow();
});
