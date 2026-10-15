/**
 * 单元测试验证有界幸运／原生技能资源、目标历史、转移／到期及晚 scope 提交。输入保留所有原
 * 直接阶段／死亡操作、字面名单／行动和受控 owner／生命变化；精确独立药瓶、库存／历史、
 * 防护和可选提示断言不变，不运行完整 NightPipeline 或 PhaseManager 周期。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/features/night-abilities/night-ability-actors";
import { PotionType } from "../../../src/domain";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  Camp,
  Phase,
  WinCondition,
  WitchSelfHealRule,
  StatusMark,
  DeathCause,
  type GameEvent,
  type RoleComponent,
  type BoardConfig,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { setNightAbilityEnabled } from "../../../src/features/night-abilities/abilities";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../src/features/night-abilities/night-ability-grants";
import {
  allNightAbilities,
  abilityStatus,
  findNightAbility,
} from "../../../src/features/night-abilities/abilities";
import {
  ownNightActions,
  luckyTargetAllowed,
  recordOwnNightAction,
} from "../../../src/features/night-abilities/night-action-history";
import { LUCKY_ABILITY_STAGE } from "../../../src/features/miracle-merchant/lucky-stage";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import { getDefaultRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import type { TrustedNightStageRuntime as NightStageContext } from "../../../src/engine/night/trusted-runtime";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";

import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { PlayerPromptPolicy } from "../../../src/agents/player/player-prompt-policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/rulesets/mechanism-api";

const deck = [Role.Wolf, Role.WolfKing, Role.Seer, Role.Witch, Role.Guard, Role.Villager];

const config: BoardConfig = {
  ...sixPlayerMvpConfig,
  roleSetups: [...new Set(deck)].map((role) => ({
    role,
    count: deck.filter((r) => r === role).length,
  })),
  winConditions: [WinCondition.SlaughterCity],
  selfDestruct: { enabledWindows: [] },
};

const fixture = () => bootstrapGame(config, { fixedRoles: deck });

const role = (game: ReturnType<typeof fixture>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const seer = () => ({ lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] });

const potion = () => ({
  heal: 0,
  poison: 1,
  selfHealRule: WitchSelfHealRule.Disabled,
  canSelfHeal: false,
  healUsedThisNight: false,
  poisonUsedThisNight: false,
});

function context(
  game: ReturnType<typeof fixture>,
  day: number,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
  current = () => true,
): NightStageContext {
  const factory = new GameActionRequestFactory(game.world, events, day);
  return {
    world: game.world,
    // 构造端口使用已有 Ctor；原 makeRequest 仍复用上方实例，不额外创建请求工厂。
    get requestFactory() {
      return GameActionRequestFactory;
    },
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
    isCurrent: current,
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
      poisonClaims: [],
      guardClaims: [],
    },
  };
}

const ordinary = (id: string) =>
  new NightStageRegistry().getStages(config).find((s) => s.id === id)!;

test("Lucky check acts only in late slot, shares actor target limits with native check, and preserves independent resources", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    gift = grantNightAbility(
      game.world,
      3,
      {
        id: "gift:miracle",
        kind: "seer_check",
        activation: "lucky",
        state: seer(),
        source: { kind: "gift", actorId: 4 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    ),
    native = findNightAbility(role(game, 3), "seer_check")!;
  const ctx = context(game, 1, events, async () => ({
    name: "check_identity",
    args: { target_id: 1 },
  }));
  await executeNightStage(ordinary("seer_check"))(ctx);
  expect(native.uses).toBe(1);
  expect(gift.uses).toBe(0);
  expect(ownNightActions(game.world, 3, 1)).toEqual([
    { day: 1, kind: "check", targetId: 1, lucky: false },
  ]);
  let attempts = 0;
  ctx.actionProvider = {
    async getAction(request) {
      expect(request.context.stage).toBe("lucky");
      attempts++;
      return { name: "check_identity", args: { target_id: attempts === 1 ? 1 : 2 } };
    },
  };
  await executeNightStage(LUCKY_ABILITY_STAGE)(ctx);
  expect(attempts).toBe(2);
  expect(gift.uses).toBe(1);
  expect(gift.state.history).toEqual([
    { targetId: 2, isWerewolf: true, result: { kind: "camp", camp: Camp.Wolf } },
  ]);
  expect(ownNightActions(game.world, 3, 1).map((r) => [r.targetId, r.lucky])).toEqual([
    [1, false],
    [2, true],
  ]);
  expect(
    luckyTargetAllowed(game.world, 5, findNightAbility(role(game, 5), "guard")!, 1, "guard", 1),
  ).toBe(true);
});

test("native Witch heal and Lucky poison have independent bottles; Lucky waits then uses exactly once without knife information", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    gift = grantNightAbility(
      game.world,
      4,
      {
        id: "gift:miracle",
        kind: "potion",
        activation: "lucky",
        state: potion(),
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  game.world.getComponent(6, COMPONENT.StatusMarks)!.add(StatusMark.WolfKillMark);
  const ctx = context(game, 1, events, async () => ({
    name: "use_potion",
    args: { target_id: 6, potion_type: PotionType.Heal },
  }));
  ctx.state.wolfTarget = 6;
  await executeNightStage(ordinary("witch_action"))(ctx);
  expect(findNightAbility(role(game, 4), "potion")!.state).toMatchObject({ heal: 0, poison: 1 });
  ctx.actionProvider = {
    async getAction(request) {
      expect(request.context.wolf_target).toBeUndefined();
      return null;
    },
  };
  await executeNightStage(LUCKY_ABILITY_STAGE)(ctx);
  expect(gift.uses).toBe(0);
  expect(gift.lastUsedDay).toBe(1);
  const next = context(game, 2, events, async () => ({
    name: "use_potion",
    args: { target_id: 1, potion_type: PotionType.Poison },
  }));
  await executeNightStage(LUCKY_ABILITY_STAGE)(next);
  expect(gift.state.poison).toBe(0);
  expect(gift.uses).toBe(1);
  expect(next.state.poisonClaims).toHaveLength(1);
  expect(
    new DamageResolutionSystem().resolve(game.world, { poisonClaims: next.state.poisonClaims }),
  ).toMatchObject({ deaths: [1], deathSources: { 1: [DeathCause.Poison] } });
  const later = context(game, 3, events, async () => {
    throw new Error("spent_no_request");
  });
  await executeNightStage(LUCKY_ABILITY_STAGE)(later);
});

test("Guard's next native turn rejects both its own prior native and Lucky targets, even after the Lucky instance transfers away", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    gift = grantNightAbility(
      game.world,
      5,
      {
        id: "gift:miracle",
        kind: "guard",
        activation: "lucky",
        state: { lastTarget: null },
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  const ctx = context(game, 1, events, async () => ({
    name: "guard",
    args: { target_id: 6, abstain: false },
  }));
  await executeNightStage(ordinary("guard_action"))(ctx);
  ctx.actionProvider = {
    async getAction() {
      return { name: "guard", args: { target_id: 4, abstain: false } };
    },
  };
  await executeNightStage(LUCKY_ABILITY_STAGE)(ctx);
  expect(ownNightActions(game.world, 5, 2).map((r) => r.targetId)).toEqual([6, 4]);
  transferNightAbility(game.world, 5, 6, gift.id, "transfer:spent-guard", events, {
    kind: "guard",
    statePolicy: (s) => structuredClone(s),
  });
  const gateway = new ToolGateway();
  expect(
    gateway.validateAndSanitize(
      game.world,
      5,
      { name: "guard", args: { target_id: 4, abstain: false } },
      { phase: Phase.Night, day: 2 },
    ),
  ).toMatchObject({ ok: false, error: "lucky_target_repeat" });
  expect(
    gateway.validateAndSanitize(
      game.world,
      5,
      { name: "guard", args: { target_id: 6, abstain: false } },
      { phase: Phase.Night, day: 2 },
    ).ok,
  ).toBe(false);
  expect(
    gateway.validateAndSanitize(
      game.world,
      5,
      { name: "guard", args: { target_id: 3, abstain: false } },
      { phase: Phase.Night, day: 2 },
    ).ok,
  ).toBe(true);
  expect(abilityStatus(allNightAbilities(role(game, 6))[0], 2)).toBe("spent");
});

test("Lucky actual death permanently expires an unused gift, and neither revival, enable, transfer nor copying restores it", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    gift = grantNightAbility(
      game.world,
      6,
      {
        id: "gift:miracle",
        kind: "seer_check",
        activation: "lucky",
        state: seer(),
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  const state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
  await new DeathResolution(
    game.world,
    events,
    new ToolGateway(),
    new EventRegistry(),
    state,
  ).resolve(
    [6],
    { 6: [DeathCause.Poison] },
    {
      async getAction() {
        throw new Error("no_night_two_words_or_gun");
      },
    },
    Phase.Night,
    Phase.Day,
  );
  expect(gift).toMatchObject({ uses: 0, disabled: true, deathExpired: true });
  game.world.getComponent(6, COMPONENT.Alive)!.alive = true;
  expect(() => setNightAbilityEnabled(game.world, 6, gift.id, true, events)).toThrow(
    "ability_lucky_expired_on_death",
  );
  transferNightAbility(game.world, 6, 5, gift.id, "transfer:dead-gift", events, {
    kind: "seer_check",
    statePolicy: (s) => structuredClone(s),
  });
  const moved = allNightAbilities(role(game, 5)).find((a) => a.id === "transfer:dead-gift")!;
  expect(moved.activation).toBe("lucky");
  expect(abilityStatus(moved, 3)).toBe("disabled");
  expect(() =>
    grantNightAbility(
      game.world,
      6,
      {
        id: "copy:wash",
        kind: "seer_check",
        state: seer(),
        source: { kind: "copy", actorId: 5, abilityId: moved.id },
        startsOnDay: 3,
        maxUses: 1,
      },
      events,
    ),
  ).toThrow("ability_copy_lucky_not_supported");
});

for (const kind of ["seer_check", "guard"] as const)
  for (const revoke of [
    "actor_life",
    "state",
    "activation",
    "id",
    "target_life",
    "gateway_target",
  ] as const)
    test(`${kind}/${revoke}: ordinary awaited skills never populate Lucky target history through a stale scope`, async () => {
      const game = fixture(),
        events: GameEvent[] = [],
        actor = kind === "guard" ? 5 : 3,
        ability = findNightAbility(role(game, actor), kind)!;
      const targetChange = () =>
        game.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
      const ctx = context(game, 1, events, async () => {
        if (revoke === "actor_life")
          game.world.addComponent(actor, COMPONENT.Alive, createAliveComponent());
        if (revoke === "state")
          (
            ability as {
              state:
                | import("@ai-werewolf-arena/game-contract").SeerReadState
                | import("@ai-werewolf-arena/game-contract").GuardReadState;
            }
          ).state = structuredClone(ability.state);
        if (revoke === "activation")
          (ability as { activation: "lucky" | "black_market" | undefined }).activation = "lucky";
        if (revoke === "id") (ability as { id: string }).id = "renamed:old-request";
        if (revoke === "target_life") targetChange();
        return kind === "guard"
          ? { name: "guard", args: { target_id: 1, abstain: false } }
          : { name: "check_identity", args: { target_id: 1 } };
      });
      if (revoke === "gateway_target") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          targetChange();
          return result;
        };
      }
      await executeNightStage(ordinary(kind === "guard" ? "guard_action" : "seer_check"))(ctx);
      expect(ability.uses).toBe(0);
      expect(ownNightActions(game.world, actor, 1)).toEqual([]);
      expect(events).toEqual([]);
      expect(ctx.state.guardClaims).toEqual([]);
    });

test("a successful gateway cannot bypass a new same-actor target constraint at actual Lucky commitment", async () => {
  const game = fixture(),
    events: GameEvent[] = [],
    gift = grantNightAbility(
      game.world,
      6,
      {
        id: "gift:miracle",
        kind: "seer_check",
        activation: "lucky",
        state: seer(),
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 1,
      },
      events,
    );
  const ctx = context(game, 1, events, async () => ({
      name: "check_identity",
      args: { target_id: 1 },
    })),
    validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
  events.length = 0;
  ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
    const result = validate(world, actorId, call, validationContext);
    recordOwnNightAction(game.world, 6, 1, "check", 1, false);
    return result;
  };
  await expect(executeNightStage(LUCKY_ABILITY_STAGE)(ctx)).rejects.toThrow(
    "lucky_valid_action_missing",
  );
  expect(gift.uses).toBe(0);
  expect(gift.state.history).toEqual([]);
  expect(events).toEqual([]);
  expect(ownNightActions(game.world, 6, 1).every((row) => row.lucky === false)).toBe(true);
});

test("an already committed ordinary guard protects its original target after caster death, but never a replacement target life", async () => {
  const game = fixture(),
    ctx = context(game, 1, [], async () => ({
      name: "guard",
      args: { target_id: 6, abstain: false },
    }));
  await executeNightStage(ordinary("guard_action"))(ctx);
  game.world.getComponent(5, COMPONENT.Alive)!.alive = false;
  game.world.getComponent(6, COMPONENT.StatusMarks)!.add(StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, { guardClaims: ctx.state.guardClaims }),
  ).toEqual({ deaths: [], deathSources: {} });
  const other = fixture(),
    next = context(other, 1, [], async () => ({
      name: "guard",
      args: { target_id: 6, abstain: false },
    }));
  await executeNightStage(ordinary("guard_action"))(next);
  other.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
  other.world.getComponent(6, COMPONENT.StatusMarks)!.add(StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(other.world, { guardClaims: next.state.guardClaims }),
  ).toEqual({ deaths: [6], deathSources: { 6: [DeathCause.WolfKill] } });
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Lucky poison prompt is optional, names no Witch turn, and none-self remains possible outside poison target IDs`, () => {
    const game = bootstrapGame(config, { fixedRoles: deck, locale }),
      events: GameEvent[] = [],
      gift = grantNightAbility(
        game.world,
        4,
        {
          id: "gift:miracle",
          kind: "potion",
          activation: "lucky",
          state: potion(),
          source: { kind: "gift", actorId: 3 },
          startsOnDay: 1,
          maxUses: 1,
        },
        events,
      );
    recordOwnNightAction(game.world, 4, 1, "poison", 4, false);
    const policy = new PlayerPromptPolicy(game.world, {
        boardConfig: config,
        roleCatalog: getDefaultRoleCatalog(),
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      }),
      request = context(game, 1, events, async () => null).makeRequest(4, ["use_potion"], {
        stage: "lucky",
        requiresAction: false,
        ability_id: gift.id,
      });
    const prompt = policy.buildUser(request, {
      turnId: "t1",
      allowedTools: ["use_potion"],
      actionSubmissionHint: "submit",
    });
    expect(prompt).toContain(
      locale === "en" ? "This is the Lucky recipient stage" : "当前是幸运儿阶段",
    );
    expect(prompt).not.toContain(
      locale === "en"
        ? "This is the Witch stage: submit use_potion"
        : "当前女巫阶段：必须调用use_potion",
    );
    expect(prompt).toContain(
      locale === "en" ? "none always uses your own ID 4" : "none始终使用你自己的编号4",
    );
    expect(
      new ToolGateway().validateAndSanitize(
        game.world,
        4,
        { name: "use_potion", args: { target_id: 4, potion_type: PotionType.None } },
        { phase: Phase.Night, day: 1, abilityId: gift.id },
      ).ok,
    ).toBe(true);
  });

import { executeNightStage } from "../../support/builders/night-stage-context";
