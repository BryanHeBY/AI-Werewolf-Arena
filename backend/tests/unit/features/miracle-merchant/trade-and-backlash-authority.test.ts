/**
 * 单元测试：验证奇迹商人直接交易创建一个不透明幸运实例，拒绝变化的 owner／target 权限。输入为语言、技能、梦境与撤权矩阵；有界阶段和伤害的库存、顺序、真实阵营、反噬及隐私断言保持，不运行完整夜或录制器。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { renderRolePrompt } from "../../../../src/game/observation/role-presentation";
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  WinCondition,
  DeathCause,
  COMPONENT,
  StatusMark,
  type BoardConfig,
  type RoleComponent,
  type GameEvent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import {
  getMerchantState,
  projectMerchantState,
} from "../../../../src/game/mechanisms/roles/miracle_merchant/state";
import { MIRACLE_MERCHANT_STAGE } from "../../../../src/game/mechanisms/roles/miracle_merchant/night_stage";
import { allNightAbilities } from "../../../../src/game/mechanisms/roles/abilities";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";


const deck = [Role.MiracleMerchant, Role.Wolf, Role.WolfKing, Role.Seer, Role.Witch, Role.Villager];

const board = (roles = deck): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: roles.length,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterCity],
  selfDestruct: { enabledWindows: [] },
});

const fixture = (roles = deck, locale: "zh-CN" | "en" = "en") => {
  const config = board(roles),
    game = bootstrapGame(config, { fixedRoles: roles, locale });
  return { ...game, config };
};

const role = (game: ReturnType<typeof fixture>, actor = 1) =>
  game.world.getComponent(actor, COMPONENT.Role)!;

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  day = 1,
  isCurrent = () => true,
): NightStageContext {
  const factory = new GameActionRequestFactory(game.world, events, day);
  return {
    world: game.world,
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
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent,
    currentDay: () => day,
    previousExile: null,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: { key: "request.summary.night_action" },
        context: extra,
      }),
    getAliveByRole: (r) => game.world.getAliveEntityIds().filter((id) => role(game, id).role === r),
    ensureMarks: (id) => game.world.getComponent(id, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      guardClaims: [],
      poisonClaims: [],
      merchantBacklashes: [],
    },
  };
}

for (const locale of ["zh-CN", "en"] as const)
  for (const skill of ["check", "poison", "guard"] as const)
    test(`${locale}/${skill}: before-role trade creates one opaque independently owned lucky instance and no immediate outcome leak`, async () => {
      const game = fixture(deck, locale),
        events: GameEvent[] = [],
        ctx = context(game, events, async () => ({
          name: "bestow_ability",
          args: { target_id: 6, skill },
        }));
      await MIRACLE_MERCHANT_STAGE.execute(ctx);
      const own = getMerchantState(role(game))!;
      expect(projectMerchantState(own)).toEqual({
        remaining: 0,
        closedDay: 1,
        choice: { day: 1, targetId: 6, skill },
      });
      expect(role(game).camp).toBe(Camp.Good);
      expect(role(game, 6).role).toBe(Role.Villager);
      const gift = allNightAbilities(role(game, 6))[0];
      expect(gift).toMatchObject({
        id: "gift:miracle",
        activation: "lucky",
        startsOnDay: 1,
        maxUses: 1,
        uses: 0,
        sourceDisclosed: false,
      });
      expect(gift.id).not.toContain("1");
      expect(gift.kind).toBe(
        skill === "check" ? "seer_check" : skill === "guard" ? "guard" : "potion",
      );
      for (const actor of game.world.entityIds()) {
        const feed = buildAgentVisibleEventFeed(game.world, events, actor);
        expect(feed.some((e) => e.type === "merchant_trade_resolved")).toBe(false);
        expect(feed.filter((e) => e.type === "merchant_trade_committed")).toHaveLength(
          actor === 1 ? 1 : 0,
        );
        if (actor === 6) {
          expect(feed.find((e) => e.type === "ability_changed")!.payload.source).toEqual({
            kind: "gift",
          });
          expect(JSON.stringify(feed)).not.toContain('"outcome"');
        }
      }
      if (locale === "en")
        expect(renderRolePrompt(role(game), locale)).not.toMatch(/[\u4e00-\u9fff]/);
      const stages = new NightStageRegistry().getStages(game.config, game.world);
      expect(stages.find((s) => s.id === "miracle_merchant")!.priority).toBe(125);
      expect(stages.find((s) => s.id === "lucky_ability")!.priority).toBe(700);
    });

test("merchant may hold on night one, but a committed trade is once per game and before Dream even by actual stage ordering", async () => {
  const roles = [
      Role.MiracleMerchant,
      Role.Wolf,
      Role.Seer,
      Role.Dreamer,
      Role.Villager,
      Role.Villager,
    ],
    game = fixture(roles),
    events: GameEvent[] = [],
    state = getMerchantState(role(game))!;
  const order = new NightStageRegistry().getStages(game.config, game.world).map((s) => s.id);
  expect(order.indexOf("miracle_merchant")).toBeLessThan(order.indexOf("dreamer_action"));
  await MIRACLE_MERCHANT_STAGE.execute(context(game, events, async () => null));
  expect(state).toEqual({ remaining: 1, closedDay: 1, choice: null });
  await MIRACLE_MERCHANT_STAGE.execute(
    context(game, events, async () => {
      throw new Error("same_night_no_second_wait");
    }),
  );
  await MIRACLE_MERCHANT_STAGE.execute(
    context(
      game,
      events,
      async () => ({ name: "bestow_ability", args: { target_id: 6, skill: "check" } }),
      2,
    ),
  );
  expect(state.remaining).toBe(0);
  await MIRACLE_MERCHANT_STAGE.execute(
    context(
      game,
      events,
      async () => {
        throw new Error("spent_no_new_request");
      },
      3,
    ),
  );
});

for (const dream of [false, true])
  test(`${dream}: true Wolf gift creates only a scoped backlash; ordinary protection cannot block it but Dream does`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      ctx = context(game, events, async () => ({
        name: "bestow_ability",
        args: { target_id: 2, skill: "poison" },
      }));
    await MIRACLE_MERCHANT_STAGE.execute(ctx);
    expect(allNightAbilities(role(game, 2))).toEqual([]);
    expect(getMerchantState(role(game))!.remaining).toBe(0);
    expect(JSON.stringify(getMerchantState(role(game)))).not.toContain("backlash");
    game.world
      .getComponent(1, COMPONENT.StatusMarks)!
      .add(StatusMark.GuardMark);
    game.world
      .getComponent(1, COMPONENT.StatusMarks)!
      .add(StatusMark.HealMark);
    role(game, 2).camp = Camp.Good;
    game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    const damage = new DamageResolutionSystem().resolve(game.world, {
      merchantBacklashes: ctx.state.merchantBacklashes,
      protectedTargets: dream ? [1] : [],
    });
    expect(damage).toEqual(
      dream
        ? { deaths: [], deathSources: {} }
        : { deaths: [1], deathSources: { 1: [DeathCause.MerchantBacklash] } },
    );
    for (const actor of game.world.entityIds())
      expect(
        buildAgentVisibleEventFeed(game.world, events, actor).some(
          (e) => e.type === "merchant_trade_resolved",
        ),
      ).toBe(false);
  });

test("a disguised Hidden Wolf is a true Wolf for trade, while all alive target preflights remain camp-neutral", async () => {
  const roles = [
      Role.MiracleMerchant,
      Role.HiddenWolf,
      Role.Wolf,
      Role.Seer,
      Role.Guard,
      Role.Villager,
    ],
    game = fixture(roles),
    events: GameEvent[] = [],
    state = getMerchantState(role(game))!,
    before = structuredClone(state),
    gateway = new ToolGateway();
  for (const target of [2, 3, 4, 5, 6])
    expect(
      gateway.validateAndSanitize(
        game.world,
        1,
        { name: "bestow_ability", args: { target_id: target, skill: "guard" } },
        { phase: Phase.Night, day: 1 },
      ).ok,
    ).toBe(true);
  expect(state).toEqual(before);
  await MIRACLE_MERCHANT_STAGE.execute(
    context(game, events, async () => ({
      name: "bestow_ability",
      args: { target_id: 2, skill: "guard" },
    })),
  );
  expect(allNightAbilities(role(game, 2))).toEqual([]);
  expect(events.find((e) => e.type === "merchant_trade_resolved")!.payload).toMatchObject({
    outcome: "backlash",
  });
});

for (const revoke of [
  "clock",
  "actor_life",
  "actor_state",
  "target_life",
  "target_role",
  "gateway_target",
  "resource",
] as const)
  test(`${revoke}: merchant await/gateway cannot transfer or spend on a changed owner/target`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      state = getMerchantState(role(game))!;
    let current = true,
      calls = 0;
    const changeTarget = () => game.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    const ctx = context(
      game,
      events,
      async () => {
        calls++;
        if (revoke === "clock") current = false;
        if (revoke === "actor_life")
          game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
        if (revoke === "actor_state")
          (role(game).privateState as Record<string, unknown>).miracle_merchant = { ...state };
        if (revoke === "target_life") changeTarget();
        if (revoke === "target_role")
          game.world.addComponent(6, COMPONENT.Role, { ...role(game, 6) });
        if (revoke === "resource") (state as { remaining: 0 | 1 }).remaining = 0;
        return { name: "bestow_ability", args: { target_id: 6, skill: "poison" } };
      },
      1,
      () => current,
    );
    if (revoke === "gateway_target") {
      const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
      ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        changeTarget();
        return result;
      };
    }
    if (["target_life", "target_role", "gateway_target"].includes(revoke))
      await expect(MIRACLE_MERCHANT_STAGE.execute(ctx)).rejects.toThrow(
        "merchant_valid_action_missing",
      );
    else await MIRACLE_MERCHANT_STAGE.execute(ctx);
    expect(calls).toBe(["target_life", "target_role", "gateway_target"].includes(revoke) ? 3 : 1);
    expect(allNightAbilities(role(game, 6))).toEqual([]);
    expect(events).toEqual([]);
    expect(state.remaining).toBe(revoke === "resource" ? 0 : 1);
  });
