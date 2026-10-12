/**
 * Configuration filesystem integration tests verify Fragrant public policy declarations, native counts, roundtrip and setup agree.
 * Input: Original top-level public board JSON read, public game/board loaders and literal cloned policy alterations.
 * Output and oracle: Fixed role/camp/count and conflicting policy assertions remain unchanged; the actual file read is retained in this owner rather than labeled a pure unit input.
 */
import path from "node:path";
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/runtime/config/board_definition";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig as config } from "../../../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import { isFragrantPairSeerPreset } from "../../../../src/rulesets";
import { Role, Camp } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";

const root = path.resolve(import.meta.dir, "../../../../.."),
  id = "awa_fragrant_pair_seer_12_v1";

const raw = JSON.parse(readFileSync(root + "/configs.example/boards/" + id + ".json", "utf8"));

test("public example load, roundtrip, game resolve and bootstrap agree", async () => {
  const resolved = await loadBoardDefinition(root + "/configs.example", id);
  expect(resolved.config).toEqual(config);
  expect(parseBoardDefinition(boardDefinitionFromConfig(id, config)).config).toEqual(config);
  const rt = parseRuntimeConfig({
    environment: {},
    providers: { default: "fake", items: { fake: { type: "openai", apiKey: "synthetic-only" } } },
    agents: {
      default: "deepseek_v4_flash",
      items: { deepseek_v4_flash: { kind: "llm", provider: "fake", model: "fake" } },
    },
    game: JSON.parse(
      readFileSync(root + "/configs.example/games/twelve_player_fragrant_pair_seer.json", "utf8"),
    ),
  });
  const setup = resolveGameSetup(rt, {}, resolved);
  expect(setup.boardConfig).toEqual(config);
  const g = bootstrapGame(setup.boardConfig);
  expect(g.playerIds).toHaveLength(12);
  for (const row of config.roleSetups)
    expect(
      g.playerIds.filter((i) => g.world.getComponent<any>(i, COMPONENT.Role).role === row.role),
    ).toHaveLength(row.count);
  for (const i of g.playerIds) {
    const role = g.world.getComponent<any>(i, COMPONENT.Role);
    expect(role.camp).toBe(
      [Role.Wolf, Role.FragrantPhantom].includes(role.role) ? Camp.Wolf : Camp.Good,
    );
    expect(g.world.getComponent<any>(i, COMPONENT.Camp).camp).toBe(role.camp);
  }
});

test("alternate hunter policy rejected publicly and internally", () => {
  for (const deathActionPolicy of ["awa_knife_or_exile_v1", "awa_day_deaths_v1"]) {
    const r = structuredClone(raw);
    r.roles.hunter = { deathActionPolicy };
    expect(() => {
      parseBoardDefinition(r);
    }).toThrow();
    const c = { ...config, hunter: { deathActionPolicy } } as any;
    expect(isFragrantPairSeerPreset(c)).toBe(false);
    expect(() => {
      bootstrapGame(c);
    }).toThrow("fragrant_pair_seer_preset_invalid");
  }
});

test("both role policy contributions reject conflicts in either object order", () => {
  for (const bad of ["fragrant_phantom", "awakened_seer"])
    for (const reverse of [false, true]) {
      const r = structuredClone(raw);
      r.roles[bad].policy = "not_the_fixed_policy";
      if (reverse) r.roles = Object.fromEntries(Object.entries(r.roles).reverse());
      expect(() => {
        parseBoardDefinition(r);
      }).toThrow("board_config_invalid_field");
    }
  for (const omitted of ["fragrant_phantom", "awakened_seer"]) {
    const r = structuredClone(raw);
    delete r.roles[omitted];
    expect(parseBoardDefinition(r).config).toEqual(config);
  }
});

test("wrong native counts fail publicly and at bootstrap", () => {
  const r = structuredClone(raw);
  r.board.roleSetups.find((x: any) => x.role === "wolf").count = 2;
  r.board.roleSetups.find((x: any) => x.role === "villager").count = 5;
  expect(() => {
    parseBoardDefinition(r);
  }).toThrow("fragrant_pair_seer_preset_invalid");
  const c = { ...config, roleSetups: r.board.roleSetups };
  expect(() => {
    bootstrapGame(c);
  }).toThrow("fragrant_pair_seer_preset_invalid");
});
