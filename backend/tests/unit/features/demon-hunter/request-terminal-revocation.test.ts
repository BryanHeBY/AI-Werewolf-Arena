/**
 * 单元／真实装配测试验证猎魔请求的新单调撤权政策。输入是合法六人或十二人 bootstrap、
 * 真实 factory／controller／gateway 及独立的正文、引用、领域和时钟故障；每个案例使用新 World。
 * 预期来自手写的拒绝码、库存／历史字面值、同 Error、原 scope 与完成通知断言，
 * 不调用生产结算生成预期，不重跑旧恢复探针，也不把请求关闭当作撤销已付来源。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  ActionWindow,
  Camp,
  COMPONENT,
  Phase,
  PotionType,
  Role,
  WinCondition,
  WitchSelfHealRule,
  World,
  assertRequestDelivery,
  deferRequestDelivery,
  deriveBoundedRequest,
  inheritRequestAlias,
  type ActionProvider,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type ToolCall,
} from "../../../../src/domain";
import { createRandom } from "../../../../src/domain/random";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  demonHunterRequestScope,
  demonHunterAuditPlayer,
  freezeDemonHunt,
} from "../../../../src/features/demon-hunter/authority";
import { getDemonHunterState } from "../../../../src/features/demon-hunter/state-slot";
import { executeDemonHunterTurn } from "../../../../src/features/demon-hunter/controller";
import {
  executeDemonWitchTurn,
  sealDeliveredDemonWitchSources,
  freezeDeliveredDemonNightSources,
} from "../../../../src/features/demon-hunter/native-potion-controller";
import { executeDemonNativeNight } from "../../../../src/features/demon-hunter/native-night-controller";
import { demonWitchRequestCurrent } from "../../../../src/features/demon-hunter/native-potion-requests";
import type { NightStageState } from "../../../../src/engine/night/contracts";
import type { TrustedNightStageRuntime as NightStageContext } from "../../../../src/engine/night/trusted-runtime";

type Family = "hunt" | "potion";
function fixture(label: string, twelve = false) {
  const roles = twelve
    ? [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Seer,
        Role.Witch,
        Role.Hunter,
        Role.Guard,
        Role.DemonHunter,
      ]
    : [Role.Wolf, Role.Wolf, Role.Villager, Role.Seer, Role.Witch, Role.DemonHunter];
  const config: BoardConfig = {
    boardSize: roles.length,
    enableSheriff: twelve,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    tieBreaker: {
      wolfKillVote: "min_id",
      exileVote: "min_id",
      ...(twelve ? { sheriffVote: "min_seat" as const } : {}),
    },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    demonHunter: { policy: "awa_netease_demon_hunter_v1" },
    ...(twelve
      ? {
          sheriff: {
            electionPolicy: "awa_final_candidates_v1" as const,
            badgePolicy: "awa_next_seat_v1" as const,
            voteWeight: 1.5,
          },
          guard: { repeatPolicy: "netease_consecutive_nights_v1" as const },
          hunter: { deathActionPolicy: "awa_knife_or_exile_v1" as const },
        }
      : {}),
  };
  const game = bootstrapGame(config, { fixedRoles: roles, random: createRandom(label) });
  const f = {
    ...game,
    events: [] as GameEvent[],
    current: true,
    currentError: undefined as Error | undefined,
  };
  expect(game.boardConfig).toBe(game.parameters.board);
  expect(game.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function begin(f: Fixture, day: number) {
  beginDemonHunterNight(f.world, day, () => {
    if (f.currentError) throw f.currentError;
    return f.current;
  });
}
const construction = {
  get requestFactory() {
    return GameActionRequestFactory;
  },
};
const reply = (family: Family): ToolCall =>
  family === "hunt"
    ? { name: "demon_hunt", args: { target_id: 1, abstain: false } }
    : { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } };
const current = (family: Family, world: World, request: ActionRequest) =>
  family === "hunt"
    ? demonHunterRequestScope(world, request) !== undefined
    : demonWitchRequestCurrent(world, request);
const revoked = (family: Family) =>
  family === "hunt" ? "demon_hunter_turn_revoked" : "demon_hunter_native_witch_revoked";
function run(family: Family, f: Fixture, getAction: ActionProvider["getAction"]) {
  const common = {
    world: f.world,
    events: f.events,
    gateway: new ToolGateway(),
    construction,
    provider: { getAction },
  };
  return family === "hunt"
    ? executeDemonHunterTurn({ ...common, day: 2 })
    : executeDemonWitchTurn({ ...common, day: 1, wolfTarget: 3 });
}
function unchanged(f: Fixture) {
  expect(getDemonHunterState(f.world.getComponent(6, COMPONENT.Role))?.history).toEqual([]);
  const ability = findNightAbility(
    f.world.getComponent(5, COMPONENT.Role),
    "potion",
    "native:potion",
  )!;
  expect({
    heal: ability.state.heal,
    poison: ability.state.poison,
    uses: ability.uses,
    day: ability.lastUsedDay,
  }).toEqual({ heal: 1, poison: 1, uses: 0, day: null });
  expect(f.events).toEqual([]);
  expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
}

test("猎魔板的独立原生药剂预检接受无目标 none，但仍要求真实且当前的请求", async () => {
  const f = fixture("potion/schema-none"),
    receive = new ActionReception(f.world);
  begin(f, 1);
  try {
    const result = await run("potion", f, async (request) => {
      expect(
        receive.validate({ ...request, context: { ...request.context } }, "use_potion", {
          potion_type: "none",
        }).ok,
      ).toBe(false);
      expect(demonWitchRequestCurrent(f.world, request)).toBe(true);
      expect(receive.validate(request, "use_potion", { potion_type: "heal" }).ok).toBe(false);
      expect(receive.validate(request, "use_potion", { potion_type: "none", extra: true }).ok).toBe(
        false,
      );
      const accepted = receive.validate(request, "use_potion", { potion_type: "none" });
      expect(accepted).toEqual({
        ok: true,
        action: { name: "use_potion", args: { target_id: 5, potion_type: PotionType.None } },
      });
      return accepted.ok ? accepted.action : null;
    });
    expect(result).toMatchObject({ used: false });
    expect(f.events).toHaveLength(1);
    expect(f.events[0]).toMatchObject({
      type: "witch_potion_skipped",
      payload: { actorId: 5, targetId: 5, potionType: PotionType.None },
    });
    const stock = findNightAbility(
      f.world.getComponent(5, COMPONENT.Role),
      "potion",
      "native:potion",
    )!;
    expect(stock.uses).toBe(0);
    expect(stock.state).toMatchObject({ heal: 1, poison: 1 });
  } finally {
    closeDemonHunterNight(f.world);
  }
});

for (const family of ["hunt", "potion"] as const) {
  for (const fault of ["stage", "context", "domain", "earliest_deadline"] as const) {
    test(`${family}/${fault}: observed original or shared failure cannot be restored into an unpaid commit`, async () => {
      const f = fixture(`${family}/${fault}`),
        receipts: boolean[] = [];
      begin(f, family === "hunt" ? 2 : 1);
      try {
        await expect(
          run(family, f, async (request) => {
            expect(current(family, f.world, request)).toBe(true);
            expect(deferRequestDelivery(request, (accepted) => receipts.push(accepted))).toBe(true);
            const context = request.context,
              oldNow = Date.now;
            try {
              if (fault === "stage") {
                const data = context as unknown as { stage: string },
                  stage = data.stage;
                data.stage = "invalid_demon_probe_stage";
                expect(current(family, f.world, request)).toBe(false);
                data.stage = stage;
              } else if (fault === "context") {
                request.context = { ...context };
                expect(current(family, f.world, request)).toBe(false);
                request.context = context;
              } else if (fault === "domain") {
                f.current = false;
                expect(current(family, f.world, request)).toBe(false);
                f.current = true;
              } else {
                const now = oldNow(),
                  alias = deriveBoundedRequest(request, now + 60000);
                expect(current(family, f.world, alias)).toBe(true);
                Date.now = () => now + 60001;
                expect(current(family, f.world, request)).toBe(false);
                Date.now = () => now;
                expect(current(family, f.world, alias)).toBe(false);
              }
              expect(current(family, f.world, request)).toBe(false);
              expect(() => assertRequestDelivery(request)).toThrow(
                "action_request_delivery_authority_revoked",
              );
              return reply(family);
            } finally {
              Date.now = oldNow;
              request.context = context;
              f.current = true;
            }
          }),
        ).rejects.toThrow(revoked(family));
        expect(receipts).toEqual([false]);
        unchanged(f);
      } finally {
        closeDemonHunterNight(f.world);
      }
    });
  }

  test(`${family}: unknown and wrong-world queries stay isolated while a malformed registered alias is permanently retired`, async () => {
    const f = fixture(`${family}/alias`),
      receipts: boolean[] = [];
    begin(f, family === "hunt" ? 2 : 1);
    try {
      await run(family, f, async (request) => {
        const originalScope =
          family === "hunt" ? demonHunterRequestScope(f.world, request) : undefined;
        expect(current(family, new World(), request)).toBe(false);
        expect(current(family, f.world, { ...request })).toBe(false);
        expect(current(family, f.world, request)).toBe(true);
        const alias = deriveBoundedRequest(request, Date.now() + 60000),
          context = alias.context;
        expect(current(family, f.world, alias)).toBe(true);
        alias.context = { ...context };
        expect(current(family, f.world, alias)).toBe(false);
        expect(current(family, f.world, request)).toBe(true);
        alias.context = context;
        expect(current(family, f.world, alias)).toBe(false);
        inheritRequestAlias(request, alias);
        expect(current(family, f.world, alias)).toBe(false);
        expect(current(family, f.world, request)).toBe(true);
        if (family === "hunt")
          expect(demonHunterRequestScope(f.world, request)).toBe(originalScope);
        expect(deferRequestDelivery(request, (accepted) => receipts.push(accepted))).toBe(true);
        return reply(family);
      });
      expect(receipts).toEqual([true]);
      if (family === "hunt") {
        expect(getDemonHunterState(f.world.getComponent(6, COMPONENT.Role))?.history).toEqual([
          { day: 2, targetId: 1 },
        ]);
      } else {
        const ability = findNightAbility(
          f.world.getComponent(5, COMPONENT.Role),
          "potion",
          "native:potion",
        )!;
        expect({
          poison: ability.state.poison,
          uses: ability.uses,
          day: ability.lastUsedDay,
        }).toEqual({ poison: 0, uses: 1, day: 1 });
        expect(f.events.map((e) => e.type)).toEqual(["witch_potion_used"]);
      }
    } finally {
      closeDemonHunterNight(f.world);
    }
  });

  test(`${family}: the original domain Error is preserved and restoration cannot reopen the failed request`, async () => {
    const f = fixture(`${family}/same-error`),
      failure = new Error("literal_demon_domain_failure"),
      receipts: boolean[] = [];
    begin(f, family === "hunt" ? 2 : 1);
    try {
      await expect(
        run(family, f, async (request) => {
          expect(deferRequestDelivery(request, (accepted) => receipts.push(accepted))).toBe(true);
          f.currentError = failure;
          let caught: unknown;
          try {
            current(family, f.world, request);
          } catch (error) {
            caught = error;
          } finally {
            f.currentError = undefined;
          }
          expect(caught).toBe(failure);
          expect(current(family, f.world, request)).toBe(false);
          return reply(family);
        }),
      ).rejects.toThrow(revoked(family));
      expect(receipts).toEqual([false]);
      unchanged(f);
    } finally {
      closeDemonHunterNight(f.world);
    }
  });
}

test("paid hunt remains frozen after its original receipt Error and later request rejection", async () => {
  const f = fixture("paid-hunt"),
    failure = new Error("literal_hunt_receipt_failure"),
    receipts: boolean[] = [];
  let original!: ActionRequest;
  begin(f, 2);
  try {
    await expect(
      run("hunt", f, async (request) => {
        original = request;
        deferRequestDelivery(request, (accepted) => {
          receipts.push(accepted);
          if (accepted) throw failure;
        });
        return reply("hunt");
      }),
    ).rejects.toBe(failure);
    expect(current("hunt", f.world, original)).toBe(false);
    expect(receipts).toEqual([true]);
    expect(getDemonHunterState(f.world.getComponent(6, COMPONENT.Role))?.history).toEqual([
      { day: 2, targetId: 1 },
    ]);
    expect(freezeDemonHunt(f.world)).toEqual({
      choice: { day: 2, targetId: 1 },
      damage: { targetId: 1, cause: "demon_hunt" },
      cancelled: null,
    });
    expect(f.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  } finally {
    closeDemonHunterNight(f.world);
  }
});

test("paid native poison and audit survive publication Error and the closed request's terminal flag", async () => {
  const f = fixture("paid-poison"),
    failure = new Error("literal_native_publication_failure"),
    receipts: boolean[] = [];
  let original!: ActionRequest;
  Object.defineProperty(f.events, "push", {
    value: () => {
      throw failure;
    },
  });
  begin(f, 1);
  try {
    await expect(
      run("potion", f, async (request) => {
        original = request;
        deferRequestDelivery(request, (accepted) => receipts.push(accepted));
        return reply("potion");
      }),
    ).rejects.toBe(failure);
    expect(current("potion", f.world, original)).toBe(false);
    expect(receipts).toEqual([true]);
    const ability = findNightAbility(
      f.world.getComponent(5, COMPONENT.Role),
      "potion",
      "native:potion",
    )!;
    expect({ poison: ability.state.poison, uses: ability.uses, day: ability.lastUsedDay }).toEqual({
      poison: 0,
      uses: 1,
      day: 1,
    });
    expect(
      (demonHunterAuditPlayer(f.world, 5)!.abilities as Record<string, { uses: number }>)[
        "native:potion"
      ]!.uses,
    ).toBe(1);
    const token = sealDeliveredDemonWitchSources(f.world, 1),
      result = freezeDeliveredDemonNightSources(f.world, token);
    expect(result.poisonOverrides).toEqual([{ targetId: 1, poison: true }]);
    expect(f.events).toHaveLength(0);
  } finally {
    closeDemonHunterNight(f.world);
  }
});

for (const kind of ["seer_check", "guard"] as const) {
  test(`actual native ${kind} controller uses the shared terminal request owner without spending stock`, async () => {
    const f = fixture(`native-${kind}`, true),
      receipts: boolean[] = [],
      state: NightStageState = {
        wolfChatOrder: [],
        endedWolves: new Set(),
        wolfVotes: {},
        wolfTarget: null,
        seerChecks: [],
      };
    begin(f, 2);
    const input = {
      world: f.world,
      events: f.events,
      currentDay: () => 2,
      requestFactory: GameActionRequestFactory,
      state,
      toolGateway: new ToolGateway(),
      actionProvider: {
        async getAction(request: ActionRequest): Promise<ToolCall> {
          expect(demonWitchRequestCurrent(f.world, request)).toBe(true);
          expect(deferRequestDelivery(request, (accepted) => receipts.push(accepted))).toBe(true);
          const context = request.context;
          request.context = { ...context };
          expect(demonWitchRequestCurrent(f.world, request)).toBe(false);
          request.context = context;
          expect(demonWitchRequestCurrent(f.world, request)).toBe(false);
          return kind === "guard"
            ? { name: "guard", args: { target_id: 1, abstain: false } }
            : { name: "check_identity", args: { target_id: 1 } };
        },
      },
    } satisfies Pick<
      NightStageContext,
      | "world"
      | "events"
      | "currentDay"
      | "requestFactory"
      | "state"
      | "toolGateway"
      | "actionProvider"
    >;
    try {
      // 该拒绝路径只消费上述真实字段；其余 handler 端口不注入，新增读取会在运行时暴露而非 dummy 放行。
      await expect(
        executeDemonNativeNight(input as unknown as NightStageContext, kind),
      ).rejects.toThrow("demon_hunter_native_night_revoked");
      const actorId = kind === "guard" ? 11 : 8;
      const ability = findNightAbility(
        f.world.getComponent(actorId, COMPONENT.Role),
        kind,
        `native:${kind}`,
      )!;
      expect({ uses: ability.uses, day: ability.lastUsedDay }).toEqual({ uses: 0, day: null });
      expect(receipts).toEqual([false]);
      expect(f.events).toEqual([]);
      expect(state.seerChecks).toEqual([]);
      expect(state.guardClaims).toBeUndefined();
    } finally {
      closeDemonHunterNight(f.world);
    }
  });
}
