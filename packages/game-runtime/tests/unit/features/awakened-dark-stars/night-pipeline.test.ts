/**
 * 集成测试以真实原十人装配运行三整夜流水线，核N1/N3魅惑、N2零请求和原狼／普通神职能力共存。
 * 人工动作与预期独立于生产规则；不通过Agent mock兜底生成应答，不使用付费模型或隐藏狼名单作为提示。
 */
import { expect, test } from "bun:test";
import {
  Role,
  Phase,
  PotionType,
  ActionWindow,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedDarkStarsTenConfig } from "../../../../src/rulesets/presets/awakened-dark-stars";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { COMPONENT } from "../../../../src/domain/components/names";
import { getAwakenedBeautyState } from "../../../../src/features/awakened-wolf-beauty/state";
import { getAwakenedPatrolState } from "../../../../src/features/awakened-hunter/state";
import type { ActionProvider } from "../../../../src/domain/actions";
test("完整三夜真实工厂/网关/贡献登记保隔夜请求且猎人绑定不产生Agent轮次", async () => {
  const g = bootstrapGame(structuredClone(awakenedDarkStarsTenConfig), {
    fixedRoles: [
      Role.AwakenedWolfBeauty,
      Role.Villager,
      Role.Wolf,
      Role.Villager,
      Role.AwakenedHunter,
      Role.Guard,
      Role.Seer,
      Role.Witch,
      Role.Villager,
      Role.Wolf,
    ],
  });
  const events: GameEvent[] = [],
    requests: ActionRequest[] = [],
    gateway = new ToolGateway(),
    night = new NightPipeline({
      world: g.world,
      events,
      toolGateway: gateway,
      damageResolutionSystem: new DamageResolutionSystem(),
    });
  const provider: ActionProvider = {
    async getAction(r): Promise<ToolCall | null> {
      requests.push(r);
      switch (r.allowedTools[0]) {
        case "speak_to_wolves":
          return { name: "speak_to_wolves", args: { text: "literal pack", end_chat: true } };
        case "kill_vote":
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        case "awakened_charm":
          return { name: "awakened_charm", args: { target_id: 2 } };
        case "guard":
          return { name: "guard", args: { target_id: null, abstain: true } };
        case "check_identity":
          return { name: "check_identity", args: { target_id: 1 } };
        case "use_potion":
          return {
            name: "use_potion",
            args: { potion_type: PotionType.None, target_id: r.actorId },
          };
        default:
          throw new Error(`literal_unexpected_${r.context.stage}`);
      }
    },
  };
  for (const day of [1, 2, 3]) {
    const r = await night.execute(g.boardConfig, provider, day);
    expect(r.interrupted).toBe(false);
    if (!r.interrupted) expect(r.damage.deaths).toEqual([]);
  }
  expect(
    requests
      .filter((r) => r.context.stage === "awakened_charm")
      .map((r) => [r.context.day, r.actorId]),
  ).toEqual([
    [1, 1],
    [3, 1],
  ]);
  expect(requests.some((r) => r.actorId === 5)).toBe(false);
  expect(getAwakenedPatrolState(g.world.getComponent(5, COMPONENT.Role))!.payment).toBeNull();
  expect(getAwakenedBeautyState(g.world.getComponent(1, COMPONENT.Role))!.choices).toEqual([
    { day: 1, targetId: 2 },
    { day: 3, targetId: 2 },
  ]);
  expect(events.filter((e) => e.type === "awakened_charm_chosen").map((e) => e.audience)).toEqual([
    [1],
    [1],
  ]);
  expect(
    gateway.validateAndSanitize(
      g.world,
      1,
      { name: "kill_vote", args: { target_id: 1, abstain: false } },
      { phase: Phase.Night, day: 3 },
    ).ok,
  ).toBe(false);
  expect(
    gateway.validateAndSanitize(
      g.world,
      1,
      { name: "self_destruct", args: { confirm: true, reason: "literal self blast" } },
      {
        phase: Phase.Day,
        day: 3,
        allowSelfDestruct: true,
        actionWindow: ActionWindow.OnPreElection,
      },
    ).ok,
  ).toBe(false);
  expect(
    gateway.validateAndSanitize(
      g.world,
      3,
      { name: "kill_vote", args: { target_id: 1, abstain: false } },
      { phase: Phase.Night, day: 3 },
    ).ok,
  ).toBe(true);
});
