/**
 * 单元测试验证恶灵骑士受控查验与用药回复。字面反射库存、私密报告和独立枪政策是预期，检验原生阶段结果；保留原输入／样本，不调用模型或完整对局。受控上下文在原 World 读取点绑定查询。
 */
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/game/mechanisms/roles/night-ability-actors";
import { ActionWindow } from "../../../src/core/domain/identity";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { evilKnightTwelveConfig } from "../../../src/runtime/scenarios/evil_knight_twelve";
import { Role, Phase, PotionType, StatusMark, type ToolCall } from "../../../src/core/domain/model";
import { COMPONENT } from "../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import type { AliveComponent } from "../../../src/core/domain/components/alive";
import type { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { DeathCause } from "../../../src/core/domain/deaths";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { getSeerState } from "../../../src/game/mechanisms/roles/seer/ports";
import { getWitchState } from "../../../src/game/mechanisms/roles/witch/ports";
import { getEvilKnightState } from "../../../src/game/mechanisms/roles/evil_knight/state";
import { EVIL_KNIGHT_FRAME_STAGE } from "../../../src/game/mechanisms/roles/evil_knight/night_frame";
import { WITCH_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/witch/night_stages";
import { SEER_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/seer/night_stages";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
function fixture(locale: "zh-CN" | "en") {
  const { world } = bootstrapGame(structuredClone(evilKnightTwelveConfig), { locale });
  const id = (kind: Role) =>
    world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === kind)!;
  const knight = id(Role.EvilKnight),
    witch = id(Role.Witch),
    seer = id(Role.Seer);
  const choices = { poison: false, inspectKnight: true };
  const ctx: NightStageContext = {
    world,
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    events: [],
    previousExile: null,
    isCurrent: () => true,
    currentDay: () => 1,
    actionProvider: {
      getAction: async (request) =>
        request.actorId === witch
          ? {
              name: "use_potion",
              args: {
                potion_type: choices.poison ? PotionType.Poison : PotionType.None,
                target_id: choices.poison ? knight : witch,
              },
            }
          : {
              name: "check_identity",
              args: { target_id: choices.inspectKnight ? knight : id(Role.Villager) },
            },
    },
    makeRequest: (actorId, allowedTools, extras) => ({
      actorId,
      allowedTools,
      phase: Phase.Night,
      context: {
        day: 1,
        ...extras,
        visible_events: [],
        turn_constraints: {
          required_any_tools: allowedTools,
          min_valid_actions: 1,
          max_valid_actions: 1,
        },
      },
    }),
    getAliveByRole: (role) =>
      world
        .getAliveEntityIds()
        .filter((actor) => world.getComponent<RoleComponent>(actor, COMPONENT.Role)?.role === role),
    ensureMarks: (actor) => world.getComponent<StatusMarksComponent>(actor, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
    },
  };
  const run = async () => {
    await EVIL_KNIGHT_FRAME_STAGE.execute(ctx);
    for (const stage of WITCH_NIGHT_STAGES) await stage.execute(ctx);
    for (const stage of SEER_NIGHT_STAGES) await stage.execute(ctx);
    return new DamageResolutionSystem().resolve(world, {
      poisonClaims: ctx.state.poisonClaims,
      retaliationAttacks: ctx.state.retaliationAttacks,
      nightImmunities: ctx.state.nightImmunities,
    });
  };
  return { world, ctx, id, knight, witch, seer, choices, run };
}
for (const locale of ["zh-CN", "en"] as const) {
  for (const poison of [false, true]) {
    test(`real native stages ${locale}/poison=${poison} preserve one reflection and Seer report`, async () => {
      const f = fixture(locale);
      f.choices.poison = poison;
      const victim = poison ? f.witch : f.seer;
      f.ctx.ensureMarks(victim).add(StatusMark.GuardMark);
      f.ctx.ensureMarks(victim).add(StatusMark.HealMark);
      const damage = await f.run();
      expect(damage.deaths).toEqual([victim]);
      expect(damage.deathSources[victim]).toEqual([DeathCause.EvilKnightReflection]);
      expect(f.ctx.state.retaliationAttacks).toHaveLength(1);
      expect(
        getEvilKnightState(f.world.getComponent<RoleComponent>(f.knight, COMPONENT.Role))!
          .reflectionRemaining,
      ).toBe(0);
      expect(
        getSeerState(f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!)!.lastIsWerewolf,
      ).toBe(true);
      expect(
        getWitchState(f.world.getComponent<RoleComponent>(f.witch, COMPONENT.Role)!)!.poison,
      ).toBe(poison ? 0 : 1);
      expect(f.ctx.events.filter((e) => e.type === "seer_checked")).toHaveLength(1);
      expect(f.world.getComponent<AliveComponent>(f.knight, COMPONENT.Alive)!.alive).toBe(true);
      expect(f.world.getComponent<AliveComponent>(victim, COMPONENT.Alive)!.alive).toBe(true);
    });
  }
  test(`passing potion and inspecting another identity do not spend reflection ${locale}`, async () => {
    const f = fixture(locale);
    f.choices.inspectKnight = false;
    expect((await f.run()).deaths).toEqual([]);
    expect(
      getEvilKnightState(f.world.getComponent<RoleComponent>(f.knight, COMPONENT.Role))!
        .reflectionRemaining,
    ).toBe(1);
  });
  for (const target of ["witch", "seer"] as const) {
    for (const invalid of [false, true]) {
      test(`required ${target} ${invalid ? "invalid" : "missing"} response fails closed ${locale}`, async () => {
        const f = fixture(locale),
          original = f.ctx.actionProvider;
        f.ctx.actionProvider = {
          getAction: async (request) =>
            request.actorId === (target === "witch" ? f.witch : f.seer)
              ? invalid
                ? ({
                    name: target === "witch" ? "use_potion" : "check_identity",
                    args: { target_id: 99999, potion_type: "poison" },
                  } as ToolCall)
                : null
              : original.getAction(request),
        };
        await expect(f.run()).rejects.toThrow(
          `evil_knight_${target}_action_${invalid ? "invalid" : "missing"}`,
        );
        expect(
          f.ctx.events.some((e) => e.type === "night_resolved" || e.type === "game_over"),
        ).toBe(false);
      });
    }
  }
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`all pack members reject evil knight as knife target ${locale}`, () => {
    const f = fixture(locale);
    for (const actorId of [...f.ctx.getAliveByRole(Role.Wolf), f.knight]) {
      const result = f.ctx.toolGateway.validateAndSanitize(
        f.world,
        actorId,
        { name: "kill_vote", args: { target_id: f.knight, abstain: false } },
        { phase: Phase.Night, day: 1 },
      );
      expect(result.ok).toBe(false);
      expect(
        f.ctx.toolGateway.validateAndSanitize(
          f.world,
          actorId,
          { name: "kill_vote", args: { target_id: f.id(Role.Villager), abstain: false } },
          { phase: Phase.Night, day: 1 },
        ).ok,
      ).toBe(true);
    }
  });
  test(`evil knight cannot self-destruct in a valid enabled window ${locale}`, () => {
    const f = fixture(locale);
    expect(
      f.ctx.toolGateway.validateAndSanitize(
        f.world,
        f.knight,
        { name: "self_destruct", args: { reason: "test", confirm: true } },
        {
          phase: Phase.Voting,
          day: 1,
          actionWindow: ActionWindow.OnPreVote,
          allowSelfDestruct: true,
        },
      ).ok,
    ).toBe(false);
  });
}
