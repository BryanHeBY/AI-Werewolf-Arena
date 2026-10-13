/**
 * 单元测试验证注册配置往返至有界角色、Gateway、骑士窗口和双语提示消费者。输入为原女巫规则／窗口矩阵、固定角色与受控空回复；手写自救／窗口／提示／未知字段是预期，不执行完整阶段、录制文件或传输，不替换 golden。
 */
import { expect, spyOn, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { text, term } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  KnightDuelWindow,
  Phase,
  PotionType,
  Role,
  StatusMark,
  WitchSelfHealRule,
  type BoardConfig,
  type GameEvent,
} from "../../../src/core";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import type { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { KnightDuelWindow as DuelExecutor } from "../../../src/game/engine/knight_duel_window";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { getDefaultConfigRenderRegistry } from "../../../src/game/mechanisms/prompt/config_render_registry";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { getWitchState } from "../../../src/game/mechanisms/roles/witch/ports";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";

const roleIds = [Role.Wolf, Role.Witch, Role.Knight, Role.Villager, Role.Villager, Role.Villager];

const base: BoardConfig = {
  ...sixPlayerBase(),
  roleSetups: [...new Set(roleIds)].map((role) => ({
    role,
    count: roleIds.filter((id) => id === role).length,
  })),
};

function sixPlayerBase(): BoardConfig {
  return {
    boardSize: 6,
    enableSheriff: false,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [],
  };
}

for (const rule of Object.values(WitchSelfHealRule))
  for (const windows of [
    [],
    ...Object.values(KnightDuelWindow).map((window) => [window]),
    Object.values(KnightDuelWindow),
  ]) {
    test(`${rule}/${windows.join("+")}: registered parameters survive public defaults, runtime consumption and both prompt locales`, async () => {
      const initial: BoardConfig = {
        ...base,
        witch: { canSelfHeal: rule },
        knight: { enabledWindows: windows },
      };
      const definition = boardDefinitionFromConfig("closure_test", initial);
      expect(definition.ruleset).toEqual(RULESET);
      expect(definition.roles.witch).toEqual({
        selfHeal: rule,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      });
      expect(definition.roles.knight).toEqual({ enabledWindows: windows });
      const resolved = parseBoardDefinition(definition);
      expect(boardDefinitionFromConfig(definition.id, resolved.config)).toEqual(definition);
      expect(boardConfigSchema.parse(resolved.config)).toEqual(resolved.config);
      const omitted = structuredClone(definition);
      if (rule === WitchSelfHealRule.Disabled) omitted.roles.witch = {};
      if (windows.length === 1 && windows[0] === KnightDuelWindow.AfterSpeeches)
        omitted.roles.knight = {};
      expect(parseBoardDefinition(omitted).config).toEqual(resolved.config);
      const game = bootstrapGame(resolved.config, { fixedRoles: roleIds });
      const gateway = new ToolGateway();
      const witch = game.world.getComponent(2, COMPONENT.Role)!;
      expect(getWitchState(witch)?.selfHealRule).toBe(rule);
      game.world
        .getComponent(2, COMPONENT.StatusMarks)!
        .add(StatusMark.WolfKillMark);
      for (const day of [1, 2]) {
        expect(
          gateway.validateAndSanitize(
            game.world,
            2,
            { name: "use_potion", args: { target_id: 2, potion_type: PotionType.Heal } },
            { phase: Phase.Night, day },
          ).ok,
        ).toBe(
          rule === WitchSelfHealRule.Always ||
            (rule === WitchSelfHealRule.FirstNightOnly && day === 1),
        );
      }
      const events: GameEvent[] = [],
        requested: KnightDuelWindow[] = [];
      const requests = new GameActionRequestFactory(game.world, events, 1);
      for (const window of Object.values(KnightDuelWindow))
        await new DuelExecutor(game.world, gateway).execute(
          resolved.config,
          requests,
          {
            async getAction(request) {
              requested.push(request.context.duel_window!);
              return null;
            },
          },
          window,
          () => true,
        );
      expect(requested).toEqual(
        Object.values(KnightDuelWindow).filter((window) => windows.includes(window)),
      );
      for (const locale of ["zh-CN", "en"] as const) {
        const rendered = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(
          resolved.config,
          locale,
        );
        const key =
          rule === WitchSelfHealRule.Always
            ? "prompt.config.self_heal_always"
            : rule === WitchSelfHealRule.FirstNightOnly
              ? "prompt.config.self_heal_first"
              : "prompt.config.self_heal_disabled";
        expect(rendered).toContain(text(locale, key));
        expect(rendered).toContain(
          text(locale, "prompt.config.knight_windows", {
            windows:
              windows.map((window) => term("stage", window, locale)).join(", ") ||
              text(locale, "common.disabled"),
          }),
        );
      }
    });
  }

test("reverse writing calls the contributor and rejects internal fields which have no consumer", () => {
  const contribution = getDefaultRoleCatalog().requireRuntime(Role.Witch).configuration!;
  const serialize = spyOn(contribution, "serialize");
  try {
    boardDefinitionFromConfig("closure_test", base);
    expect(serialize).toHaveBeenCalledTimes(1);
  } finally {
    serialize.mockRestore();
  }
  const extra = { ...base, witch: { canSelfHeal: WitchSelfHealRule.Always, selfHela: true } };
  expect(() => boardDefinitionFromConfig("closure_test", extra)).toThrow("config.witch.selfHela");
  const unknown = { ...base, unusedRule: true };
  expect(() => boardDefinitionFromConfig("closure_test", unknown)).toThrow("config.unusedRule");
});
