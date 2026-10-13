/**
 * Unit tests verify bounded Lucky/native skill resources, target history, transfer/expiry and late-scope commitment.
 * Input: All original direct stage/death operations, literal rosters/actions and controlled owner/life changes.
 * Output and oracle: Exact independent bottles, stock/history, protection and optional prompt assertions remain unchanged; no complete NightPipeline or PM cycle runs.
 */
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/game/mechanisms/roles/night-ability-actors";
import { PotionType } from "../../../src/core";
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
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  grantNightAbility,
  transferNightAbility,
  setNightAbilityEnabled,
} from "../../../src/game/mechanisms/roles/ability_changes";
import {
  allNightAbilities,
  abilityStatus,
  findNightAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import {
  ownNightActions,
  luckyTargetAllowed,
  recordOwnNightAction,
} from "../../../src/game/mechanisms/roles/night_action_history";
import { LUCKY_ABILITY_STAGE } from "../../../src/game/mechanisms/roles/miracle_merchant/lucky_stage";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/game/mechanisms";

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
  game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

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
    ensureMarks: (id) => game.world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
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
  await ordinary("seer_check").execute(ctx);
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
  await LUCKY_ABILITY_STAGE.execute(ctx);
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
  game.world
    .getComponent<StatusMarksComponent>(6, COMPONENT.StatusMarks)!
    .add(StatusMark.WolfKillMark);
  const ctx = context(game, 1, events, async () => ({
    name: "use_potion",
    args: { target_id: 6, potion_type: PotionType.Heal },
  }));
  ctx.state.wolfTarget = 6;
  await ordinary("witch_action").execute(ctx);
  expect(findNightAbility(role(game, 4), "potion")!.state).toMatchObject({ heal: 0, poison: 1 });
  ctx.actionProvider = {
    async getAction(request) {
      expect(request.context.wolf_target).toBeUndefined();
      return null;
    },
  };
  await LUCKY_ABILITY_STAGE.execute(ctx);
  expect(gift.uses).toBe(0);
  expect(gift.lastUsedDay).toBe(1);
  const next = context(game, 2, events, async () => ({
    name: "use_potion",
    args: { target_id: 1, potion_type: PotionType.Poison },
  }));
  await LUCKY_ABILITY_STAGE.execute(next);
  expect(gift.state.poison).toBe(0);
  expect(gift.uses).toBe(1);
  expect(next.state.poisonClaims).toHaveLength(1);
  expect(
    new DamageResolutionSystem().resolve(game.world, { poisonClaims: next.state.poisonClaims }),
  ).toMatchObject({ deaths: [1], deathSources: { 1: [DeathCause.Poison] } });
  const later = context(game, 3, events, async () => {
    throw new Error("spent_no_request");
  });
  await LUCKY_ABILITY_STAGE.execute(later);
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
  await ordinary("guard_action").execute(ctx);
  ctx.actionProvider = {
    async getAction() {
      return { name: "guard", args: { target_id: 4, abstain: false } };
    },
  };
  await LUCKY_ABILITY_STAGE.execute(ctx);
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
  game.world.getComponent<{ alive: boolean }>(6, COMPONENT.Alive)!.alive = true;
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
      await ordinary(kind === "guard" ? "guard_action" : "seer_check").execute(ctx);
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
  await expect(LUCKY_ABILITY_STAGE.execute(ctx)).rejects.toThrow("lucky_valid_action_missing");
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
  await ordinary("guard_action").execute(ctx);
  game.world.getComponent<{ alive: boolean }>(5, COMPONENT.Alive)!.alive = false;
  game.world
    .getComponent<StatusMarksComponent>(6, COMPONENT.StatusMarks)!
    .add(StatusMark.WolfKillMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, { guardClaims: ctx.state.guardClaims }),
  ).toEqual({ deaths: [], deathSources: {} });
  const other = fixture(),
    next = context(other, 1, [], async () => ({
      name: "guard",
      args: { target_id: 6, abstain: false },
    }));
  await ordinary("guard_action").execute(next);
  other.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
  other.world
    .getComponent<StatusMarksComponent>(6, COMPONENT.StatusMarks)!
    .add(StatusMark.WolfKillMark);
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
