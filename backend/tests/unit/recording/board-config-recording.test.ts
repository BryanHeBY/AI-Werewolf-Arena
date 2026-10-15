/**
 * 单元测试：验证板子录制保留规范化贡献、逆向配置及历史缺席角色参数。输入为原配置与归档；JSON Tape 和初始化相等断言验证元数据无损序列化，不重新生成预期。
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
} from "../../../src/domain";
import type { RoleComponent } from "../../../src/domain/components/role";
import { getWitchState } from "../../../src/features/witch/ports";
import { boardConfigSchema } from "../../../src/domain/board-schema";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { parseReproductionRecord } from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

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
        const role = game.world.getComponent(id, COMPONENT.Role)!;
        return {
          id,
          name: String(id),
          role: role.role,
          camp: game.world.getComponent(id, COMPONENT.Camp)!.camp,
        };
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
        (id) => restored.world.getComponent(id, COMPONENT.Role)?.role === Role.Witch,
      )!;
      expect(
        getWitchState(restored.world.getComponent(witchId, COMPONENT.Role)!)?.selfHealRule,
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
  // 同一个原坏字段现在在 Tape 创建前，于所属运行参数编译处失败。
  expect(() => trace(config)).toThrow("rule_parameters_invalid");
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
