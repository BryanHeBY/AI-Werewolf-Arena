/**
 * Integration/scenario tests for fragrant pair seer config stock configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import path from "node:path";
import { recordFragrantLiteral } from "../support/fragrant_pair_seer_recording";
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { bootstrapGame } from "../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig as config } from "../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import { isFragrantPairSeerPreset } from "../../src/rulesets";
import { Role, Camp } from "../../src/core/domain/identity";
import { COMPONENT } from "../../src/core/domain/components/names";
import {
  fragrantRuntimeGame as game,
  fragrantRuntimeAction as act,
} from "../support/fragrant_pair_seer_scenarios";
import { ReproductionTrace, parseReproductionRecord } from "../../src/recording/reproduction";
import { captureCheckpoint } from "../../src/runtime/simulation/reproduction_context";
const root = path.resolve(import.meta.dir, "../../.."),
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
for (const dead of [false, true])
  test(`${dead ? "dead" : "alive"} witch N2 flags follow original living-only reset`, async () => {
    const metadata = (await recordFragrantLiteral()).record.metadata;
    const g = game(),
      trace = new ReproductionTrace(
        metadata,
        () => {},
        () => g.phaseManager.getEvents(),
      );
    trace.checkpoint(
      captureCheckpoint(
        g.world,
        g.phaseManager.getSnapshot(),
        0,
        true,
        g.phaseManager.getEvents().length,
      ),
      g.phaseManager.getEvents(),
    );
    for (let day = 1; day <= 2; day++) {
      const plan =
        day === 1 ? { poison: 3, knife: dead ? 10 : 5, exile: 4 } : { knife: 6, exile: 2 };
      await g.phaseManager.runSingleCycle(
        {
          getAction: (r) =>
            trace.decide(r, {
              async getAction(q) {
                if (q.allowedTools.includes("check_pair"))
                  return {
                    name: "check_pair",
                    args: {
                      target_ids: [
                        q.context.pair_check_candidates![0]!,
                        q.context.pair_check_candidates![1]!,
                      ] as const,
                    },
                  };
                return act(q, plan);
              },
            }),
        },
        8,
      );
      trace.checkpoint(
        captureCheckpoint(
          g.world,
          g.phaseManager.getSnapshot(),
          day,
          true,
          g.phaseManager.getEvents().length,
        ),
        g.phaseManager.getEvents(),
      );
      const t = trace as any,
        record = {
          schemaVersion: 2,
          finalized: false,
          metadata: t.metadata,
          decisions: t.decisions,
          checkpoints: t.checkpoints,
          events: g.phaseManager.getEvents(),
          operations: [],
          termination: null,
        };
      expect(() => {
        parseReproductionRecord(record);
      }).not.toThrow();
      const w = t.checkpoints.at(-1).players.find((x: any) => x.id === 10),
        p = w.privateState.abilities["native:potion"];
      expect(w.alive).toBe(!dead);
      expect(p.state.poison).toBe(0);
      expect(p.state.poisonUsedThisNight).toBe(day === 1 || dead);
      if (day === 2) {
        const forged = structuredClone(record);
        forged.checkpoints.at(-1).players.find((x: any) => x.id === 10).privateState.abilities[
          "native:potion"
        ].state.poisonUsedThisNight = !dead;
        expect(() => {
          parseReproductionRecord(forged);
        }).toThrow();
      }
    }
  });
