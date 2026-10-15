/**
 * 女巫场景测试通过完整夜晚验证耗尽狼刀信息的隐私及守／救／毒复合死因。输入保留原 locale 计划、受控 NightPipeline 行动和当前标记／库存；原请求与提示知识、隐藏事件和被毒猎人禁枪是明确预期，不重新计算预期结果。
 */
import { completedNight } from "../../../support/builders/night-stage-context";
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  DeathCause,
  WitchSelfHealRule,
  type ActionRequest,
  type GameEvent,
  type RoleComponent,
} from "../../../../src/domain";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { BaselineBotActionProvider } from "../../../../src/game/drivers/privileged-baseline";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { hunterDeathHook } from "../../../../src/game/mechanisms/roles/hunter/death_hook";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/game/mechanisms";
import { text } from "@ai-werewolf-arena/game-text";

const roles12 = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: roles12 });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: an exhausted antidote removes the knife from requests and prompts but preserves legitimate past knowledge`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [],
      requests: ActionRequest[] = [],
      rejectionCodes: string[] = [];
    const pipeline = new NightPipeline({
      world,
      events,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const provider = {
      async getAction(input: ActionRequest) {
        if (input.context.stage === "wolf_vote")
          return {
            name: "kill_vote" as const,
            args: { target_id: input.context.day === 1 ? 9 : 10, abstain: false },
          };
        if (input.actorId === 6 && input.context.stage === "witch") {
          requests.push(structuredClone(input));
          if (input.context.day === 2)
            for (const target of [9, 10, 999]) {
              const receipt = new ActionReception(world).validate(input, "use_potion", {
                target_id: target,
                potion_type: PotionType.Heal,
              });
              rejectionCodes.push(receipt.ok ? "accepted" : receipt.error);
            }
          return {
            name: "use_potion" as const,
            args: {
              target_id: input.context.day === 1 ? 9 : 6,
              potion_type:
                input.context.day === 1 ? (PotionType.Heal as const) : (PotionType.None as const),
            },
          };
        }
        return new BaselineBotActionProvider(world).getAction(input);
      },
    };
    await pipeline.execute(twelvePlayerStandardConfig, provider, 1);
    expect(requests[0].context.wolf_target).toBe(9);
    expect(getWitchState(role(world, 6))!.heal).toBe(0);
    await pipeline.execute(twelvePlayerStandardConfig, provider, 2);
    expect(Object.hasOwn(requests[1].context, "wolf_target")).toBe(false);
    const policy = new PlayerPromptPolicy(world, {
      boardConfig: twelvePlayerStandardConfig,
      roleCatalog: getDefaultRoleCatalog(),
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    const prompt = policy.buildUser(requests[1], {
      turnId: "t2",
      allowedTools: ["use_potion"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).not.toContain(text(locale, "prompt.stage.wolf_target", { target: 10 }));
    expect(prompt).toContain(text(locale, "prompt.stage.unknown_wolf_target"));
    expect(
      requests[1].context.visible_events
        .filter((event) => event.type === "witch_potion_used")
        .map((event) => event.payload.targetId),
    ).toEqual([9]);
    expect(
      buildAgentVisibleEventFeed(world, events, 6).some(
        (event) => event.type === "wolf_kill_vote_cast",
      ),
    ).toBe(false);
    expect(rejectionCodes).toEqual(["heal_unavailable", "heal_unavailable", "heal_unavailable"]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual guard+heal+poison night preserves compound sources and never authorizes a poisoned Hunter's gun`, async () => {
    const { world } = fixture(locale),
      events: GameEvent[] = [];
    grantNightAbility(
      world,
      9,
      {
        id: "gift:guard",
        kind: "guard",
        state: { lastTarget: null },
        source: { kind: "gift", actorId: 5 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    grantNightAbility(
      world,
      10,
      {
        id: "gift:poison",
        kind: "potion",
        state: {
          heal: 0,
          poison: 1,
          selfHealRule: WitchSelfHealRule.Disabled,
          canSelfHeal: false,
          healUsedThisNight: false,
          poisonUsedThisNight: false,
        },
        source: { kind: "gift", actorId: 5 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
    const pipeline = new NightPipeline({
      world,
      events,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const result = await pipeline.execute(
      twelvePlayerStandardConfig,
      {
        async getAction(input) {
          if (input.context.stage === "wolf_vote")
            return { name: "kill_vote", args: { target_id: 7, abstain: false } };
          if (input.actorId === 9) return { name: "guard", args: { target_id: 7, abstain: false } };
          if (input.actorId === 6 && input.context.stage === "witch")
            return { name: "use_potion", args: { target_id: 7, potion_type: PotionType.Heal } };
          if (input.actorId === 10)
            return { name: "use_potion", args: { target_id: 7, potion_type: PotionType.Poison } };
          return new BaselineBotActionProvider(world).getAction(input);
        },
      },
      1,
    );
    expect(completedNight(result).damage).toEqual({
      deaths: [7],
      deathSources: { 7: [DeathCause.Poison, DeathCause.WolfKill] },
    });
    let shots = 0;
    world.getComponent(7, COMPONENT.Alive)!.alive = false;
    await hunterDeathHook(
      world,
      [7],
      completedNight(result).damage.deathSources,
      async () => {
        shots++;
        return { kind: "invalid" };
      },
      events,
    );
    expect(shots).toBe(0);
    expect(getHunterState(role(world, 7))!.canShoot).toBe(false);
    expect(getWitchState(role(world, 6))!.heal).toBe(0);
  });
