/**
 * 单元测试验证黑市商人直接交易／接受者阶段保留原身份、不透明赠予及过期资源拒绝。输入为原
 * 技能／变化／转移矩阵、有界夜上下文和显式伤害操作；精确独立库存、等待／反噬／隐私及零 getter
 * 断言保持原样，不运行完整 PhaseManager 周期或记录对局。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  Phase,
  Camp,
  DeathCause,
  StatusMark,
  WinCondition,
  type RoleComponent,
  type ActionProvider,
  type GameEvent,
} from "../../../../src/core";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getBlackMarketState } from "../../../../src/game/mechanisms/roles/black_market_merchant/state";
import {
  BLACK_MARKET_TRADE_STAGE,
  BLACK_MARKET_RECIPIENT_STAGE,
} from "../../../../src/game/mechanisms/roles/black_market_merchant/night_stage";
import { allNightAbilities } from "../../../../src/game/mechanisms/roles/abilities";
import { projectNightAbility } from "../../../../src/game/observation/night-ability-projection";
import { transferNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";

const deck = [Role.Wolf, Role.Wolf, Role.BlackMarketMerchant, Role.Seer, Role.Witch, Role.Villager];

function fixture() {
  const config = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(deck)].map((role) => ({
      role,
      count: deck.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: false,
    selfDestruct: { enabledWindows: [] },
  };
  return { ...bootstrapGame(config, { fixedRoles: deck }), config };
}

type Game = ReturnType<typeof fixture>;

const role = (game: Game, id = 3) => game.world.getComponent(id, COMPONENT.Role)!;

const life = (game: Game, id: number) =>
  game.world.getComponent(id, COMPONENT.Alive)!;

function context(game: Game, getAction: ActionProvider["getAction"], day = 1): NightStageContext {
  const events: GameEvent[] = [],
    factory = new GameActionRequestFactory(game.world, events, day);
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
    isCurrent: () => true,
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
      merchantBacklashes: [],
      blackMarketBacklashes: [],
    },
  };
}

for (const skill of ["check", "poison", "gun"] as const)
  test(`${skill}: true Good gift keeps original identity and uses a fresh stock without immediate native-skill activation`, async () => {
    const game = fixture(),
      ctx = context(game, async (request) => {
        expect(request.context.action_failure_policy).toBe("error");
        expect(request.context.allow_fallback).toBe(false);
        return { name: "black_market_trade", args: { target_id: 6, skill } };
      });
    await BLACK_MARKET_TRADE_STAGE.execute(ctx);
    expect(getBlackMarketState(role(game))).toEqual({
      remaining: 0,
      closedDay: 1,
      choice: { day: 1, targetId: 6, skill },
    });
    expect(role(game, 6)).toMatchObject({ role: Role.Villager, camp: Camp.Good });
    if (skill !== "gun")
      expect(allNightAbilities(role(game, 6))).toMatchObject([
        {
          id: "gift:black-market",
          activation: "black_market",
          startsOnDay: 2,
          maxUses: 1,
          uses: 0,
          sourceDisclosed: false,
        },
      ]);
    expect(buildAgentVisibleEventFeed(game.world, ctx.events, 3).map((e) => e.type)).toEqual([
      "black_market_trade_committed",
    ]);
    expect(buildAgentVisibleEventFeed(game.world, ctx.events, 1)).toEqual([]);
    let calls = 0;
    ctx.actionProvider = {
      async getAction() {
        calls++;
        return null;
      },
    };
    await BLACK_MARKET_RECIPIENT_STAGE.execute(ctx);
    expect(calls).toBe(0);
  });

test("clean optional wait closes only that night, does not expose success and allows a later-night trade", async () => {
  const game = fixture();
  const first = context(game, async () => null);
  await BLACK_MARKET_TRADE_STAGE.execute(first);
  expect(getBlackMarketState(role(game))).toEqual({ remaining: 1, closedDay: 1, choice: null });
  const second = context(
    game,
    async () => ({ name: "black_market_trade", args: { target_id: 6, skill: "check" } }),
    2,
  );
  await BLACK_MARKET_TRADE_STAGE.execute(second);
  expect(allNightAbilities(role(game, 6))[0].startsOnDay).toBe(3);
});

for (const change of [
  "actor_revive",
  "actor_replace",
  "actor_private",
  "target_revive",
  "target_role",
  "target_camp",
] as const)
  test(`${change}: a late trade never spends a replacement owner or uses changed hidden truth`, async () => {
    const game = fixture();
    let calls = 0;
    const ctx = context(game, async () => {
      calls++;
      if (change === "actor_revive") {
        life(game, 3).alive = false;
        life(game, 3).alive = true;
      }
      if (change === "actor_replace")
        game.world.addComponent(3, COMPONENT.Alive, createAliveComponent());
      if (change === "actor_private")
        (role(game) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
      if (change === "target_revive") {
        life(game, 6).alive = false;
        life(game, 6).alive = true;
      }
      if (change === "target_role") role(game, 6).role = Role.Seer;
      if (change === "target_camp") role(game, 6).camp = Camp.Wolf;
      return { name: "black_market_trade", args: { target_id: 6, skill: "check" } };
    });
    if (change.startsWith("actor_")) await BLACK_MARKET_TRADE_STAGE.execute(ctx);
    else {
      ctx.isCurrent = () => calls <= 1;
      await BLACK_MARKET_TRADE_STAGE.execute(ctx);
    }
    expect(ctx.events).toEqual([]);
    expect(allNightAbilities(role(game, 6))).toEqual([]);
  });

test("three invalid choices while targets remain throw instead of becoming a wait or spending stock", async () => {
  const game = fixture(),
    ctx = context(game, async () => ({
      name: "black_market_trade",
      args: { target_id: 3, skill: "gun" },
    }));
  await expect(BLACK_MARKET_TRADE_STAGE.execute(ctx)).rejects.toThrow(
    "black_market_valid_action_missing",
  );
  expect(getBlackMarketState(role(game))!.remaining).toBe(1);
  expect(ctx.events).toEqual([]);
});

test("true Wolf gets no gift/notification and Black backlash is not stopped by heal, guard or Dream", async () => {
  const game = fixture(),
    ctx = context(game, async () => ({
      name: "black_market_trade",
      args: { target_id: 1, skill: "check" },
    }));
  await BLACK_MARKET_TRADE_STAGE.execute(ctx);
  const marks = ctx.ensureMarks(3);
  marks.add(StatusMark.HealMark);
  marks.add(StatusMark.GuardMark);
  expect(
    new DamageResolutionSystem().resolve(game.world, {
      protectedTargets: [3],
      blackMarketBacklashes: ctx.state.blackMarketBacklashes,
    }),
  ).toEqual({ deaths: [3], deathSources: { 3: [DeathCause.BlackMarketBacklash] } });
  expect(allNightAbilities(role(game, 1))).toEqual([]);
  expect(buildAgentVisibleEventFeed(game.world, ctx.events, 1)).toEqual([]);
  expect(JSON.stringify(getBlackMarketState(role(game)))).not.toMatch(/outcome|success|camp|gift:/);
});

test("paid Black backlash ignores consumption/closure but revokes on changed state owner and never kills a revived body", async () => {
  for (const change of ["none", "private", "revive"]) {
    const game = fixture(),
      ctx = context(game, async () => ({
        name: "black_market_trade",
        args: { target_id: 1, skill: "poison" },
      }));
    await BLACK_MARKET_TRADE_STAGE.execute(ctx);
    if (change === "private")
      (role(game) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
    if (change === "revive") {
      life(game, 3).alive = false;
      life(game, 3).alive = true;
    }
    expect(
      new DamageResolutionSystem().resolve(game.world, {
        blackMarketBacklashes: ctx.state.blackMarketBacklashes,
      }).deaths,
    ).toEqual(change === "none" ? [3] : []);
  }
});

test("the final check target disappearing during the third rejected reply closes without spending", async () => {
  const game = fixture(),
    trade = context(game, async () => ({
      name: "black_market_trade",
      args: { target_id: 6, skill: "check" },
    }));
  await BLACK_MARKET_TRADE_STAGE.execute(trade);
  for (const id of [2, 3, 4, 5]) life(game, id).alive = false;
  let calls = 0;
  const recipient = context(
    game,
    async () => {
      if (++calls === 3) life(game, 1).alive = false;
      return { name: "check_identity", args: { target_id: 6 } };
    },
    2,
  );
  await BLACK_MARKET_RECIPIENT_STAGE.execute(recipient);
  const ability = allNightAbilities(role(game, 6))[0];
  expect(calls).toBe(3);
  expect(ability).toMatchObject({ uses: 0, lastUsedDay: 2 });
  expect(recipient.events.map((e) => e.type)).toEqual(["lucky_ability_skipped"]);
});

for (const change of [
  "activation",
  "resources",
  "source_camp",
  "source_life",
  "private",
  "target_life",
] as const)
  test(`${change}: a transfer callback cannot turn a spent Black gift into new inventory or another body's resource`, async () => {
    const game = fixture(),
      trade = context(game, async () => ({
        name: "black_market_trade",
        args: { target_id: 6, skill: "check" },
      }));
    await BLACK_MARKET_TRADE_STAGE.execute(trade);
    const ability = allNightAbilities(role(game, 6))[0];
    (ability as { uses: number }).uses = 1;
    (ability as { lastUsedDay: number | null }).lastUsedDay = 2;
    expect(() =>
      transferNightAbility(game.world, 6, 4, ability.id, ability.id, [], {
        kind: "seer_check",
        statePolicy: (state) => {
          if (change === "activation") {
            (ability as { activation: "lucky" | "black_market" | undefined }).activation =
              undefined;
            (ability as { startsOnDay: number }).startsOnDay = 1;
          }
          if (change === "resources") {
            (ability as { uses: number }).uses = 0;
            (ability as { lastUsedDay: number | null }).lastUsedDay = null;
          }
          if (change === "source_camp") role(game, 6).camp = Camp.Wolf;
          if (change === "source_life") {
            life(game, 6).alive = false;
            life(game, 6).alive = true;
          }
          if (change === "private")
            (role(game, 6) as { privateState: Readonly<Record<string, unknown>> }).privateState =
              {};
          if (change === "target_life") {
            life(game, 4).alive = false;
            life(game, 4).alive = true;
          }
          return structuredClone(state);
        },
      }),
    ).toThrow("ability_black_market_transfer_revoked");
    expect(allNightAbilities(role(game, 4)).some((a) => a.activation === "black_market")).toBe(
      false,
    );
  });

test("Black seer state and nested reports select declared fields without reading unknown getters", async () => {
  const game = fixture(),
    trade = context(game, async () => ({
      name: "black_market_trade",
      args: { target_id: 6, skill: "check" },
    }));
  await BLACK_MARKET_TRADE_STAGE.execute(trade);
  const ability = allNightAbilities(role(game, 6))[0];
  if (ability.kind !== "seer_check") throw new Error("wrong_fixture");
  Object.assign(ability.state, { internalDonor: "SECRET_SENTINEL" });
  let reads = 0;
  Object.defineProperty(ability.state, "unknownGetter", {
    enumerable: true,
    get() {
      reads++;
      return "SECRET_GETTER";
    },
  });
  (
    ability.state.history as {
      targetId: import("@ai-werewolf-arena/game-contract").EntityId;
      isWerewolf: boolean;
      result?: import("@ai-werewolf-arena/game-contract").InspectionResult;
    }[]
  ).push({
    targetId: 1,
    isWerewolf: true,
    result: { kind: "camp", camp: Camp.Wolf, internal: "SECRET_REPORT" } as any,
    internal: "SECRET_ROW",
  } as any);
  const projected = projectNightAbility(ability, 2);
  expect(JSON.stringify(projected)).not.toMatch(/SECRET/);
  expect((projected.state as any).history[0].result).toEqual({ kind: "camp", camp: Camp.Wolf });
  expect(reads).toBe(0);
});
