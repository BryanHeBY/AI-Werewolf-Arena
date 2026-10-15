/**
 * 单元测试验证摄梦人持有回复期间替换玩家／目标后的 scope。原已提交前缀及拒绝是预期，检查旧许可不能再请求、付款或提交；输入和样本保留原值，不调用模型或完整对局。受控上下文在原 World 读取点绑定查询。
 */
import { bindNativeNightFailurePolicy } from "../../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type GameEvent,
  type RoleComponent,
} from "../../../../src/domain";
import { AliveComponent, aliveLifeVersion } from "../../../../src/domain/components/alive";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { transferNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { DREAMER_NIGHT_STAGE } from "../../../../src/game/mechanisms/roles/dreamer/night_stages";
import { hasDreamNightCommit, DreamNightFrame, type DreamNightLink } from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
import { readDreamNightLinks, installDreamNightLinks, dreamNightLinksForAppend } from "../../../../src/game/mechanisms/roles/dreamer/night-links";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

function fixture() {
  const roles = [Role.Dreamer, Role.Dreamer, Role.Wolf, Role.Hunter, Role.Villager, Role.Villager];
  const config = {
    ...sixPlayerMvpConfig,
    winConditions: [WinCondition.SlaughterCity],
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((candidate) => candidate === role).length,
    })),
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const role = (actorId: number) =>
    game.world.getComponent(actorId, COMPONENT.Role)!;
  return { ...game, role, ability: (actorId: number) => findNightAbility(role(actorId), "dream")! };
}

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, 1);
  const unused = (): never => {
    throw new Error("unused_dream_stage_dependency");
  };
  return {
    world: game.world,
    get requestFactory() { return GameActionRequestFactory; },
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
    currentDay: () => 1,
    previousExile: null,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: "Dream scope regression",
        context: extra,
      }),
    getAliveByRole: unused,
    ensureMarks: unused,
    pickMajorityTarget: unused,
    shuffleWolves: unused,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
  };
}

for (const change of ["disabled", "spent", "transferred"] as const)
  test(`${change}: a revoked later dream actor gets no request while the earlier committed prefix remains`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      later = game.ability(2),
      laterState = later.state,
      calls: number[] = [];
    const ctx = context(game, events, async (request) => {
      calls.push(request.actorId);
      if (request.actorId === 1) {
        if (change === "disabled") (later as { disabled: boolean }).disabled = true;
        if (change === "spent") {
          (later as { maxUses: number | null }).maxUses = 1;
          (later as { uses: number }).uses = 1;
        }
        if (change === "transferred")
          transferNightAbility(game.world, 2, 6, later.id, "transfer:dream", [], {
            kind: "dream",
            statePolicy: (state) => ({ ...state, history: [...state.history] }),
          });
      }
      return { name: "dream", args: { target_id: 5 } };
    });
    await DREAMER_NIGHT_STAGE.execute(ctx);
    expect(calls).toEqual([1]);
    expect(game.ability(1).state.history).toEqual([{ day: 1, targetId: 5 }]);
    expect(game.ability(1).uses).toBe(1);
    expect(laterState.history).toEqual([]);
    expect(later.lastUsedDay).toBeNull();
    expect(later.uses).toBe(change === "spent" ? 1 : 0);
    expect(readDreamNightLinks(ctx.state).map((link) => link.actorId)).toEqual([1]);
    expect(
      events
        .filter((event) => event.type === "dream_applied")
        .map((event) => event.payload.actorId),
    ).toEqual([1]);
    expect(hasDreamNightCommit(game.world, 1)).toBe(true);
    if (change === "transferred") expect(game.ability(6).uses).toBe(0);
  });

for (const point of ["await", "gateway"] as const)
  for (const change of [
    "source",
    "source_owner",
    "id",
    "activation",
    "private_owner",
    "life",
    "day",
    "starts",
    "max_uses",
  ] as const)
    test(`${point}/${change}: a changed dream scope cannot commit or consume a pending reply`, async () => {
      const game = fixture(),
        events: GameEvent[] = [],
        ability = game.ability(1),
        originalState = ability.state;
      (game.ability(2) as { disabled: boolean }).disabled = true;
      let calls = 0,
        day = 1;
      const revoke = () => {
        if (change === "source")
          (
            ability as {
              source: import("@ai-werewolf-arena/game-contract").AbilitySource;
            }
          ).source = { kind: "gift", actorId: 3 };
        if (change === "source_owner" && ability.source.kind === "native")
          (ability.source as { role: Role }).role = Role.Wolf;
        if (change === "id") (ability as { id: string }).id = "native:renamed";
        if (change === "activation")
          (ability as { activation: "lucky" | "black_market" | undefined }).activation = "lucky";
        if (change === "private_owner")
          (game.role(1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {
            ...game.role(1).privateState,
          };
        if (change === "life") {
          const life = game.world.getComponent(1, COMPONENT.Alive)!;
          life.alive = false;
          life.alive = true;
        }
        if (change === "day") day = 2;
        if (change === "starts") (ability as { startsOnDay: number }).startsOnDay = 0;
        if (change === "max_uses") (ability as { maxUses: number | null }).maxUses = 2;
      };
      const ctx = context(game, events, async () => {
        calls++;
        if (point === "await") revoke();
        return { name: "dream", args: { target_id: 5 } };
      });
      ctx.currentDay = () => day;
      if (point === "gateway") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          revoke();
          return result;
        };
      }
      await DREAMER_NIGHT_STAGE.execute(ctx);
      expect(calls).toBe(1);
      expect(originalState).toEqual({ lastTarget: null, lastDay: null, history: [] });
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(readDreamNightLinks(ctx.state)).toEqual([]);
      expect(events).toEqual([]);
      expect(hasDreamNightCommit(game.world, 1)).toBe(false);
    });

// 以下三个新 ID 验证本族关系 owner；上面的原 scope 用例仅迁观察渠道，原预期没有改写。
test("owned dream links: same array survives frame capture and does not follow cloned state or old getters", () => {
  const game = fixture(), ctx = context(game, [], async () => null);
  const actorLife = game.world.getComponent(1, COMPONENT.Alive)!,
    targetLife = game.world.getComponent(5, COMPONENT.Alive)!,
    nextLife = game.world.getComponent(6, COMPONENT.Alive)!;
  Object.defineProperty(ctx.state, "dreamLinks", { get() { throw new Error("retired_links_must_not_read"); } });
  const empty = readDreamNightLinks(ctx.state);
  expect(readDreamNightLinks(ctx.state)).toBe(empty);
  expect(dreamNightLinksForAppend(ctx.state) as readonly DreamNightLink[]).toBe(empty);
  const links: DreamNightLink[] = [{
    actorId: 1, targetId: 5, day: 1, consecutive: false,
    actorLife, actorVersion: aliveLifeVersion(actorLife),
    targetLife, targetVersion: aliveLifeVersion(targetLife),
  }];
  installDreamNightLinks(ctx.state, links);
  expect(readDreamNightLinks(ctx.state)).toBe(links);
  const frame = new DreamNightFrame(readDreamNightLinks(ctx.state));
  dreamNightLinksForAppend(ctx.state).push({
    actorId: 1, targetId: 6, day: 1, consecutive: false,
    actorLife, actorVersion: aliveLifeVersion(actorLife),
    targetLife: nextLife, targetVersion: aliveLifeVersion(nextLife),
  });
  expect(frame.protectedTargets(game.world)).toEqual([5, 6]);
  expect(readDreamNightLinks({ ...ctx.state })).toEqual([]);
  expect(readDreamNightLinks(ctx.state)).toBe(links);
  // 旧字段退出通用结构，运行数组仍有自己的生命／付款复核，并非权限品牌。
  // @ts-expect-error 通用状态不再携带摄梦人的私有关系数组。
  const retiredKey: keyof NightStageContext["state"] = "dreamLinks";
  expect(retiredKey as string).toBe("dreamLinks");
});

test("owned dream links: push lookup failure keeps paid history and night commit without publishing the dream", async () => {
  const game = fixture(), events: GameEvent[] = [], failure = new Error("dream_push_lookup_rejected");
  (game.ability(2) as { disabled: boolean }).disabled = true;
  const ability = game.ability(1), ctx = context(game, events, async () => ({ name: "dream", args: { target_id: 5 } }));
  const links = dreamNightLinksForAppend(ctx.state);
  Object.defineProperty(links, "push", { get() { throw failure; } });
  await expect(DREAMER_NIGHT_STAGE.execute(ctx)).rejects.toBe(failure);
  expect(ability.state.history).toEqual([{ day: 1, targetId: 5 }]);
  expect(ability.uses).toBe(1);
  expect(ability.lastUsedDay).toBe(1);
  expect(hasDreamNightCommit(game.world, 1)).toBe(true);
  expect(readDreamNightLinks(ctx.state)).toBe(links);
  expect(links).toEqual([]);
  expect(events).toEqual([]);
});

test("owned dream links: link field failure follows push lookup and preserves the already paid prefix", async () => {
  const game = fixture(), events: GameEvent[] = [], trace: string[] = [], failure = new Error("dream_link_field_rejected");
  (game.ability(2) as { disabled: boolean }).disabled = true;
  const ability = game.ability(1), ctx = context(game, events, async () => ({ name: "dream", args: { target_id: 5 } }));
  const links = dreamNightLinksForAppend(ctx.state), push = links.push;
  Object.defineProperty(links, "push", {
    get() {
      trace.push("push:get");
      // 到原追加 callee 点才装故障，避免 scope 的早政策读取先抛错，冒成已付条目构造失败。
      Object.defineProperty(ability.state, "protectionPolicy", { get() { trace.push("policy:get"); throw failure; } });
      return function(this: DreamNightLink[], ...items: DreamNightLink[]) {
        trace.push("push:call");
        return push.apply(this, items);
      };
    },
  });
  await expect(DREAMER_NIGHT_STAGE.execute(ctx)).rejects.toBe(failure);
  expect(trace).toEqual(["push:get", "policy:get"]);
  expect(ability.state.history).toEqual([{ day: 1, targetId: 5 }]);
  expect(ability.uses).toBe(1);
  expect(ability.lastUsedDay).toBe(1);
  expect(hasDreamNightCommit(game.world, 1)).toBe(true);
  expect(links).toEqual([]);
  expect(events).toEqual([]);
});
