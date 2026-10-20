/**
 * 负责原十二人板的真实NightPipeline/ToolGateway/死亡链集成测试。
 * 人工固定牌堆与夜间选择给出独立预期，核三轮人数、混合毒因、首夜遗言和无枪，
 * 不用生产协作结果反推oracle，也不把Provider返回伪装成已付款。
 */
import { expect, test } from "bun:test";
import {
  Role,
  Phase,
  DeathCause,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
  type Locale,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedWitchTwelveConfig } from "../../../../src/rulesets/presets/awakened-witch-twelve";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { COMPONENT } from "../../../../src/domain/components/names";
import { getAwakenedWitchState } from "../../../../src/features/awakened-witch/state";
import { ownedAwakenedClaws } from "../../../../src/features/awakened-wolf-king/state";
const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.AwakenedWolfKing,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Seer,
  Role.Guard,
  Role.Hunter,
  Role.AwakenedWitch,
] as const;
function fixture(locale: Locale = "zh-CN") {
  const config = structuredClone(awakenedWitchTwelveConfig),
    f = bootstrapGame(config, { locale, fixedRoles: roles }),
    events: GameEvent[] = [],
    gateway = new ToolGateway(),
    pipeline = new NightPipeline({
      world: f.world,
      events,
      toolGateway: gateway,
      damageResolutionSystem: new DamageResolutionSystem(),
    });
  return { ...f, config, events, gateway, pipeline };
}
function provider(
  f: ReturnType<typeof fixture>,
  options: {
    day?: number;
    heal?: boolean;
    pass?: boolean;
    target?: number;
    knife?: number;
    assistants?: number[];
    veto?: number;
    missing?: string;
  } = {},
) {
  const seen: ActionRequest[] = [];
  return {
    seen,
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      seen.push(r);
      const tool = r.allowedTools[0];
      if (options.missing === tool) return null;
      switch (tool) {
        case "speak_to_wolves":
          return { name: "speak_to_wolves", args: { text: "本夜建议", end_chat: true } };
        case "bequeath_claw":
          return { name: "bequeath_claw", args: { target_id: null } };
        case "kill_vote":
          return { name: "kill_vote", args: { target_id: options.knife ?? 5, abstain: false } };
        case "guard":
          return { name: "guard", args: { target_id: null, abstain: true } };
        case "check_identity":
          return { name: "check_identity", args: { target_id: 1 } };
        case "awakened_brew":
          return {
            name: "awakened_brew",
            args: options.pass
              ? { mode: "pass", target_id: null, assistant_ids: [] }
              : options.heal
                ? { mode: "heal", target_id: options.knife ?? 5, assistant_ids: [] }
                : {
                    mode: "poison",
                    target_id: options.target ?? 1,
                    assistant_ids: options.assistants ?? [6],
                  },
          };
        case "brew_discuss":
          return { name: "brew_discuss", args: { text: r.actorId === 6 ? "" : "独立讨论" } };
        case "brew_approve":
          return { name: "brew_approve", args: { approve: r.actorId !== options.veto } };
        case "speak":
          return { name: "speak", args: { text: "本次遗言" } };
        default:
          throw Error("unexpected_test_tool:" + tool);
      }
    },
  };
}
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}三夜真实管线先狼刀后1/2/3人秘密协作，否决不退资格`, async () => {
    const f = fixture(locale),
      all: ActionRequest[] = [];
    for (const [day, ids, veto] of [
      [1, [6], undefined],
      [2, [7, 8], 8],
      [3, [1, 2, 3], undefined],
    ] as const) {
      const p = provider(f, { assistants: [...ids], veto });
      const result = await f.pipeline.execute(f.config, p, day);
      all.push(...p.seen);
      expect(result.interrupted).toBe(false);
      if (result.interrupted) throw Error("literal_expected_complete_night");
      expect(result.damage.deaths).toEqual(day === 2 ? [5] : [1, 5]);
      expect(p.seen.findIndex((r) => r.allowedTools[0] === "kill_vote")).toBeLessThan(
        p.seen.findIndex((r) => r.allowedTools[0] === "awakened_brew"),
      );
      expect(
        p.seen.filter((r) => r.allowedTools[0] === "brew_discuss").map((r) => r.actorId),
      ).toEqual([...ids]);
    }
    const state = getAwakenedWitchState(f.world.getComponent(12, COMPONENT.Role))!;
    expect(
      state.nights.map((n) =>
        n.mode === "poison" ? [n.ordinal, n.outcome, n.assistantIds] : n.mode,
      ),
    ).toEqual([
      [1, "poison", [6]],
      [2, "vetoed", [7, 8]],
      [3, "poison", [1, 2, 3]],
    ]);
    // 所有角色都可被真实协助请求命中，身份不改变；请求不带女巫座位或先前秘密批准。
    for (const r of all.filter((r) => r.context.stage === "brew_approval")) {
      expect(Object.keys(r.context.brew_collaboration!)).toEqual([
        "ordinal",
        "targetId",
        "assistantIds",
      ]);
      expect(r.context.visible_events.filter((e) => e.type === "brew_approval")).toEqual([]);
    }
  });
for (const target of [11, 4])
  test(`真实刀毒复合${target === 11 ? "猎人" : "持双爪狼王"}无死亡枪；N1初波仍有且仅一次遗言`, async () => {
    const f = fixture(),
      p = provider(f, { target, knife: target }),
      night = await f.pipeline.execute(f.config, p, 1);
    if (night.interrupted) throw Error("literal_expected_complete_night");
    expect(night.damage.deathSources[target]).toEqual([DeathCause.Poison, DeathCause.WolfKill]);
    const requests: ActionRequest[] = [];
    const resolution = new DeathResolution(f.world, f.events, f.gateway, new EventRegistry(), {
      day: 1,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    });
    await resolution.resolve(
      night.damage.deaths,
      night.damage.deathSources,
      {
        async getAction(r) {
          requests.push(r);
          if (r.allowedTools.includes("shoot")) throw Error("poison_must_forbid_shot");
          return { name: "speak", args: { text: "首夜真实初波遗言" } };
        },
      },
      Phase.Night,
      Phase.Day,
      Object.fromEntries(night.damage.deaths.map((id) => [id, Phase.Night])),
    );
    expect(
      requests.filter((r) => r.actorId === target && r.context.trigger === "last_words"),
    ).toHaveLength(1);
    expect(requests.some((r) => r.allowedTools.includes("shoot"))).toBe(false);
    expect(f.world.getComponent(target, COMPONENT.Alive)!.alive).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
    if (target === 4)
      expect(ownedAwakenedClaws(f.world, 4)!.units.map((u) => u.status)).toEqual([
        "expired",
        "expired",
      ]);
  });
for (const missing of ["awakened_brew", "brew_discuss", "brew_approve"])
  test(`真实网关与管线${missing}缺失为失败且不合成行动`, async () => {
    const f = fixture(),
      p = provider(f, { missing });
    await expect(f.pipeline.execute(f.config, p, 1)).rejects.toThrow();
    const state = getAwakenedWitchState(f.world.getComponent(12, COMPONENT.Role))!;
    expect(state.nights).toHaveLength(missing === "awakened_brew" ? 0 : 1);
    expect(f.events.filter((e) => e.type === "brew_resolved")).toEqual([]);
  });
test("真实网关非法协助名单在付款前拒绝，不降为pass", async () => {
  const f = fixture(),
    p = provider(f, { assistants: [6, 7] });
  await expect(f.pipeline.execute(f.config, p, 1)).rejects.toThrow("awakened_witch_action_invalid");
  expect(getAwakenedWitchState(f.world.getComponent(12, COMPONENT.Role))!.nights).toEqual([]);
});
