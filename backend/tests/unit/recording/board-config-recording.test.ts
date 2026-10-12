/**
 * Unit tests: Board recording uses normalized contributions, reverse configurations and
 * historical absent-role parameters; literal JSON Tape and initialization equality check
 * lossless metadata serialization. Inputs and expected outcomes remain the original
 * literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  KnightDuelWindow,
  Role,
  WitchSelfHealRule,
  createRandom,
  type BoardConfig,
} from "../../../src/core";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import { getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { ReproductionTrace, parseReproductionRecord } from "../../../src/recording/reproduction";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

const roles = [Role.Wolf, Role.Witch, Role.Knight, Role.Villager, Role.Villager, Role.Villager];
function trace(config: BoardConfig) {
  const game = bootstrapGame(config, {
    fixedRoles: config.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role)),
    random: createRandom("config-closure"),
  });
  const recorder = new ReproductionTrace(
    {
      engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
      ruleset: RULESET,
      boardId: "closure_test",
      normalizedBoard: config,
      random: game.random.metadata,
      locale: "en",
      maxDays: 10,
      dealMode: "fixed",
      players: game.playerIds.map((id) => {
        const role = game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
        return { id, name: String(id), role: role.role, camp: role.camp };
      }),
    },
    () => {},
  );
  recorder.checkpoint(
    captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0),
    [],
  );
  return recorder.build();
}

for (const rule of Object.values(WitchSelfHealRule))
  for (const windows of [[], [KnightDuelWindow.AfterSpeeches], Object.values(KnightDuelWindow)]) {
    test(`${rule}/${windows.join("+")}: JSON Tape retains the normalized contribution and identical role initialization`, () => {
      const raw: BoardConfig = {
        ...sixPlayerMvpConfig,
        roleSetups: [...new Set(roles)].map((role) => ({
          role,
          count: roles.filter((id) => id === role).length,
        })),
        witch: { canSelfHeal: rule },
        knight: { enabledWindows: windows },
      };
      const config = parseBoardDefinition(boardDefinitionFromConfig("closure_test", raw)).config;
      const record = parseReproductionRecord(JSON.parse(JSON.stringify(trace(config))));
      expect(record.metadata.normalizedBoard).toEqual(config);
      expect(record.metadata.ruleset).toEqual(RULESET);
      expect(record.schemaVersion).toBe(2);
      expect(boardDefinitionFromConfig("closure_test", record.metadata.normalizedBoard)).toEqual(
        boardDefinitionFromConfig("closure_test", config),
      );
      const restored = bootstrapGame(record.metadata.normalizedBoard);
      const witchId = restored.playerIds.find(
        (id) => restored.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Witch,
      )!;
      expect(
        getWitchState(restored.world.getComponent<RoleComponent>(witchId, COMPONENT.Role)!)
          ?.selfHealRule,
      ).toBe(rule);
    });
  }

test("public serialization emits present roles while Tape retains historically supported absent-role parameters", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    witch: { canSelfHeal: WitchSelfHealRule.Always },
  };
  const publicBoard = boardDefinitionFromConfig("closure_test", config);
  expect(publicBoard.roles).not.toHaveProperty("witch");
  expect(trace(config).metadata.normalizedBoard).toEqual(config);
  expect(config.witch).toEqual({ canSelfHeal: WitchSelfHealRule.Always });
});

test("reverse writing and Tape reject the same unknown nested configuration field", () => {
  const config = {
    ...sixPlayerMvpConfig,
    witch: { canSelfHeal: WitchSelfHealRule.Always, unused: true },
  };
  expect(boardConfigSchema.safeParse(config).success).toBe(false);
  expect(() => boardDefinitionFromConfig("closure_test", config)).toThrow("config.witch.unused");
  expect(() => trace(config)).toThrow("reproduction_record_invalid");
});

for (const targetPolicy of ["awa_alive_v1", "awa_fresh_others_v1"] as const)
  for (const actionPolicy of ["awa_optional_v1", "awa_required_when_legal_v1"] as const)
    test(`${targetPolicy}/${actionPolicy}: Seer policy identity survives JSON Tape and checkpoint restoration`, () => {
      const raw: BoardConfig = { ...sixPlayerMvpConfig, seer: { targetPolicy, actionPolicy } };
      const config = parseBoardDefinition(boardDefinitionFromConfig("seer_policy", raw)).config;
      const record = parseReproductionRecord(JSON.parse(JSON.stringify(trace(config))));
      expect(record.metadata.normalizedBoard.seer).toEqual({ targetPolicy, actionPolicy });
      const restored = trace(record.metadata.normalizedBoard);
      expect(restored.checkpoints).toEqual(trace(config).checkpoints);
    });

for (const knifeVisibility of ["awa_with_heal_v1", "awa_always_v1"] as const)
  for (const potionPolicy of ["awa_one_native_v1", "awa_both_native_experimental_v1"] as const)
    test(`${knifeVisibility}/${potionPolicy}: Witch policy identity survives strict JSON Tape and checkpoints`, () => {
      const raw: BoardConfig = {
        ...sixPlayerMvpConfig,
        roleSetups: [
          { role: Role.Wolf, count: 1 },
          { role: Role.Witch, count: 1 },
          { role: Role.Villager, count: 4 },
        ],
        witch: { knifeVisibility, potionPolicy },
      };
      const config = parseBoardDefinition(boardDefinitionFromConfig("witch_policy", raw)).config;
      const record = parseReproductionRecord(JSON.parse(JSON.stringify(trace(config))));
      expect(record.metadata.normalizedBoard.witch).toEqual(config.witch);
      expect(trace(record.metadata.normalizedBoard).checkpoints).toEqual(trace(config).checkpoints);
    });
