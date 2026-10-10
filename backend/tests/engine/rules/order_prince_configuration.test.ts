import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { orderPrinceTwelveConfig } from "../../../src/runtime/scenarios/order_prince_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
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
