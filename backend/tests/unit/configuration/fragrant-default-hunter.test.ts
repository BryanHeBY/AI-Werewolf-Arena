/**
 * Unit test verifies omitted Hunter policy restores only the fixed Fragrant board default.
 * Input: Original imported Fragrant configuration clone, shared machine board ID and detached omitted field.
 * Output and oracle: Exact preset acceptance and normalized configuration equality retain the original assertion; no public JSON reader, recorder or phase cycle runs.
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

const root = path.resolve(import.meta.dir, "../../../.."),
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
