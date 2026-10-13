/**
 * 场景测试驱动真实猎魔人原生阶段并检查完整／失败 checkpoint。输入为原库存、外来 getter、
 * 替换躯体和受控迟到失败；字面资源前缀、原名单与元数据撤销是预期。checkpoint 证据保留，
 * 不能把生产投影称为新的独立结果算法。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test, spyOn } from "bun:test";
import { COMPONENT, PotionType, type ActionRequest, type RoleComponent } from "../../../../src/core";
import { demonHunterFixture } from "../../../support/features/demon-hunter/builders/candidate-world";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { demonHunterAuditPlayer } from "../../../../src/game/mechanisms/roles/demon_hunter/authority";
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";

function stock(f: ReturnType<typeof demonHunterFixture>, id: number, key: string) {
  return (
    demonHunterAuditPlayer(f.world, id)!.abilities as Record<
      string,
      { state: Record<string, unknown>; uses: number; lastUsedDay: number | null }
    >
  )[`native:${key}`]!;
}

const role = (f: ReturnType<typeof demonHunterFixture>, id: number) =>
  f.world.getComponent(id, COMPONENT.Role)!;

for (const size of [6, 12] as const)
  test(`actual ${size} native night stock commits enter CP, including Guard pass`, async () => {
    const f = demonHunterFixture(size),
      seer = size === 6 ? 4 : 8;
    const p = { getAction: async (r: ActionRequest) => demonNightChoice(r, f.witchId) };
    await f.phaseManager.runSingleCycle(p, 10);
    await f.phaseManager.runSingleCycle(p, 10);
    expect(stock(f, seer, "seer_check")).toMatchObject({
      uses: 2,
      lastUsedDay: 2,
      state: { lastTarget: 1, lastIsWerewolf: true, lastResult: { kind: "camp", camp: "wolf" } },
    });
    expect(stock(f, seer, "seer_check").state.history as unknown[]).toHaveLength(2);
    if (size === 12)
      expect(stock(f, 11, "guard")).toMatchObject({
        uses: 0,
        lastUsedDay: 2,
        state: { lastTarget: null, repeatPolicy: "netease_consecutive_nights_v1" },
      });
    const cp = captureCheckpoint(
      f.world,
      f.phaseManager.getSnapshot(),
      2,
      true,
      f.phaseManager.getEvents().length,
    );
    expect(cp.players).toHaveLength(size);
    for (const player of cp.players)
      expect(player.privateState).toEqual(demonHunterAuditPlayer(f.world, player.id)!);
    cp.players[seer - 1]!.privateState = {};
    expect(demonHunterAuditPlayer(f.world, seer)).not.toEqual({});
  });

test("actual Guard target/pass/target keeps finite consecutive-night stock and Seer self inspect", async () => {
  const f = demonHunterFixture(12);
  for (const guard of [12, null, 12])
    await f.phaseManager.runSingleCycle(
      {
        getAction: async (r) =>
          r.allowedTools.includes("check_identity")
            ? { name: "check_identity", args: { target_id: 8 } }
            : demonNightChoice(r, 9, { guard }),
      },
      10,
    );
  expect(stock(f, 11, "guard")).toMatchObject({
    uses: 2,
    lastUsedDay: 3,
    state: { lastTarget: 12 },
  });
  expect(stock(f, 8, "seer_check").state).toMatchObject({
    lastTarget: 8,
    lastIsWerewolf: false,
    lastResult: { kind: "camp", camp: "good" },
  });
});

test("actual missing hunt retains lawful Seer/Guard/Witch prefixes in failed CP", async () => {
  const f = demonHunterFixture(12);
  await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10);
  await expect(
    f.phaseManager.runSingleCycle(
      {
        getAction: async (r) =>
          (r.allowedTools as string[]).includes("demon_hunt")
            ? null
            : demonNightChoice(r, 9, {
                guard: 12,
                potion: { target: 12, type: PotionType.Poison },
              }),
      },
      10,
    ),
  ).rejects.toThrow();
  const cp = captureCheckpoint(
    f.world,
    f.phaseManager.getSnapshot(),
    2,
    false,
    f.phaseManager.getEvents().length,
    new Error("actual_failure"),
  );
  expect(cp.complete).toBe(false);
  expect(stock(f, 8, "seer_check").uses).toBe(2);
  expect(stock(f, 11, "guard")).toMatchObject({
    uses: 1,
    lastUsedDay: 2,
    state: { lastTarget: 12 },
  });
  expect(stock(f, 9, "potion")).toMatchObject({ uses: 1, lastUsedDay: 2, state: { poison: 0 } });
  for (const player of cp.players)
    expect(player.privateState).toEqual(demonHunterAuditPlayer(f.world, player.id)!);
});

for (const kind of ["seer_check", "guard"] as const)
  for (const mutation of ["refund", "getter", "readonly", "extra"] as const)
    test(`native ${kind} ${mutation} cannot become a committed stock`, async () => {
      const f = demonHunterFixture(12),
        id = kind === "guard" ? 11 : 8,
        key = `native:${kind}`;
      await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10);
      const before = demonHunterAuditPlayer(f.world, id),
        ability = (
          (role(f, id).privateState as { readonly abilities?: unknown }).abilities as Record<
            string,
            Record<string, unknown>
          >
        )[key]!;
      let reads = 0;
      if (mutation === "refund") ability.uses = 9;
      if (mutation === "getter")
        Object.defineProperty(ability, "uses", {
          get() {
            reads++;
            return 1;
          },
          enumerable: true,
        });
      if (mutation === "readonly")
        Object.defineProperty(ability, "lastUsedDay", { writable: false });
      if (mutation === "extra") ability.extra = "forged";
      await expect(
        f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 9) }, 10),
      ).rejects.toThrow();
      expect(demonHunterAuditPlayer(f.world, id)).toEqual(before!);
      expect(reads).toBe(0);
      const cp = captureCheckpoint(
        f.world,
        f.phaseManager.getSnapshot(),
        2,
        false,
        f.phaseManager.getEvents().length,
      );
      expect(cp.players[id - 1]!.privateState).toEqual(before!);
    });

for (const shot of [null, 1] as const)
  test(`actual Hunter ${shot === null ? "pass" : "shot"} consumes lawful gun in CP`, async () => {
    const f = demonHunterFixture(12);
    await f.phaseManager.runSingleCycle(
      { getAction: async (r) => demonNightChoice(r, 9, { knife: 10, shot }) },
      10,
    );
    expect(demonHunterAuditPlayer(f.world, 10)).toMatchObject({
      hunter: { canShoot: false, deathActionPolicy: "awa_knife_or_exile_v1" },
    });
    const cp = captureCheckpoint(
      f.world,
      f.phaseManager.getSnapshot(),
      1,
      true,
      f.phaseManager.getEvents().length,
    );
    expect(cp.players[9]).toMatchObject({
      alive: false,
      privateState: { hunter: { canShoot: false } },
    });
  });

test("actual poisoned Hunter consumes gun without prompting, failed CP cannot adopt refunded gun", async () => {
  const f = demonHunterFixture(12);
  let prompts = 0;
  await f.phaseManager.runSingleCycle(
    {
      getAction: async (r) => {
        if (r.allowedTools.includes("shoot")) prompts++;
        return demonNightChoice(r, 9, { potion: { target: 10, type: PotionType.Poison } });
      },
    },
    10,
  );
  const before = demonHunterAuditPlayer(f.world, 10);
  expect(before).toMatchObject({ hunter: { canShoot: false } });
  expect(prompts).toBe(0);
  (getHunterState(role(f, 10))! as { canShoot: boolean }).canShoot = true;
  expect(() => captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 1, true, 0)).toThrow(
    "original_state_revoked",
  );
  expect(
    captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 1, false, 0).players[9]!.privateState,
  ).toEqual(before!);
});

test("failed CP uses original roster/life/inventory despite added entity, component replacement and getters", async () => {
  const f = demonHunterFixture(6);
  await f.phaseManager.runSingleCycle({ getAction: async (r) => demonNightChoice(r, 5) }, 10);
  const baseline = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 1, true, 0);
  let reads = 0;
  for (const key of [
    COMPONENT.Role,
    COMPONENT.Identity,
    COMPONENT.Victory,
    COMPONENT.Badge,
    COMPONENT.VotingRight,
    COMPONENT.StatusMarks,
    COMPONENT.Alive,
  ]) {
    const foreign = new Proxy(
      {},
      {
        get() {
          reads++;
          throw new Error("foreign");
        },
        ownKeys() {
          reads++;
          throw new Error("foreign");
        },
        getOwnPropertyDescriptor() {
          reads++;
          throw new Error("foreign");
        },
      },
    );
    // 动态槽里的原 Proxy 是刻意非法输入；只作槽写入类型断言，所有 trap 与样本保持原样。
    f.world.addComponent(4, key, foreign as unknown as import("../../../../src/core/domain/component-map").ComponentWrite<typeof key>);
  }
  f.world.createEntity();
  const cp = captureCheckpoint(
    f.world,
    f.phaseManager.getSnapshot(),
    2,
    false,
    0,
    new Error("failure"),
  );
  expect(cp.players).toEqual(baseline.players);
  expect(reads).toBe(0);
  expect(() => captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 2, true, 0)).toThrow();
  expect(reads).toBe(0);
});

test("failed CP takes original dead body instead of replacement revived Alive", async () => {
  const f = demonHunterFixture(12);
  await f.phaseManager.runSingleCycle(
    { getAction: async (r) => demonNightChoice(r, 9, { knife: 10 }) },
    10,
  );
  f.world.addComponent(10, COMPONENT.Alive, createAliveComponent());
  expect(
    captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 1, false, 0).players[9],
  ).toMatchObject({ alive: false, privateState: { hunter: { canShoot: false } } });
});

for (const kind of ["seer", "guard", "hunter"] as const)
  test(`actual ${kind} late Gateway getter is rejected before legacy policy reads`, async () => {
    const f = demonHunterFixture(12),
      id = kind === "seer" ? 8 : kind === "guard" ? 11 : 10;
    const before = demonHunterAuditPlayer(f.world, id);
    let reads = 0;
    const original = f.gateway.validateAndSanitize.bind(f.gateway);
    const gateway = spyOn(f.gateway, "validateAndSanitize").mockImplementation(
      (world, actor, action, context) => {
        const result = original(world, actor, action, context);
        if (
          actor === id &&
          action.name ===
            (kind === "seer" ? "check_identity" : kind === "guard" ? "guard" : "shoot")
        ) {
          const ability =
            kind === "hunter"
              ? getHunterState(role(f, id))!
              : (
                  (role(f, id).privateState as { readonly abilities?: unknown })
                    .abilities as Record<string, Record<string, unknown>>
                )[`native:${kind === "seer" ? "seer_check" : "guard"}`]!;
          const object =
            kind === "guard" ? ((ability as Record<string, unknown>).state as object) : ability;
          Object.defineProperty(
            object,
            kind === "seer" ? "uses" : kind === "guard" ? "repeatPolicy" : "canShoot",
            {
              get() {
                reads++;
                throw new Error("getter_executed");
              },
              enumerable: true,
            },
          );
        }
        return result;
      },
    );
    try {
      await expect(
        f.phaseManager.runSingleCycle(
          {
            getAction: async (r) =>
              demonNightChoice(r, 9, { knife: kind === "hunter" ? 10 : null, shot: 1 }),
          },
          10,
        ),
      ).rejects.toThrow();
      expect(reads).toBe(0);
      expect(demonHunterAuditPlayer(f.world, id)).toEqual(before!);
      const cp = captureCheckpoint(
        f.world,
        f.phaseManager.getSnapshot(),
        1,
        false,
        f.phaseManager.getEvents().length,
      );
      expect(cp.players[id - 1]!.privateState).toEqual(before!);
      expect(reads).toBe(0);
    } finally {
      gateway.mockRestore();
    }
  });

test("actual sheriff election survives later day speech failure in CP", async () => {
  const f = demonHunterFixture(12);
  await expect(
    f.phaseManager.runSingleCycle(
      {
        getAction: async (r) => {
          if (r.allowedTools.includes("run_for_sheriff"))
            return { name: "run_for_sheriff", args: { run: r.actorId === 4 } };
          if (r.context.stage === "sheriff_vote")
            return { name: "vote_for_sheriff", args: { target_id: 4, abstain: false } };
          if (r.context.stage === "day_speech") throw new Error("actual_speech_failure");
          return demonNightChoice(r, 9);
        },
      },
      10,
    ),
  ).rejects.toThrow("actual_speech_failure");
  expect(
    f.phaseManager
      .getEvents()
      .some((e) => e.type === "sheriff_elected" && e.payload.winnerId === 4),
  ).toBe(true);
  const cp = captureCheckpoint(
    f.world,
    f.phaseManager.getSnapshot(),
    1,
    false,
    f.phaseManager.getEvents().length,
  );
  expect(cp.players[3]).toMatchObject({
    badge: { isSheriff: true, destroyed: false, voteWeight: 1.5 },
    vote: { weight: 1.5, canVote: true },
  });
});

test("optional badge accessor differs from absence: CP and next actual Night reject with zero reads", async () => {
  const { assignSheriff } = await import("../../../../src/game/mechanisms/sheriff/badge");
  const f = demonHunterFixture(12);
  let reads = 0;
  expect(assignSheriff(f.world, 4, f.config)).toBe(true);
  const baseline = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, true, 0);
  const badge = f.world.getComponent(
    4,
    COMPONENT.Badge,
  )!;
  Object.defineProperty(badge, "handoffPolicy", {
    get() {
      reads++;
      return undefined;
    },
    enumerable: true,
    configurable: true,
  });
  expect(() => captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, true, 0)).toThrow(
    "metadata_revoked",
  );
  await expect(
    f.phaseManager.runSingleCycle(
      { getAction: async (r) => demonNightChoice(r, 9, { knife: 4 }) },
      10,
    ),
  ).rejects.toThrow("badge_unreadable");
  expect(reads).toBe(0);
  expect(
    captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 1, false, 0).players[3]!.badge,
  ).toEqual(baseline.players[3]!.badge);
  expect(reads).toBe(0);
});
