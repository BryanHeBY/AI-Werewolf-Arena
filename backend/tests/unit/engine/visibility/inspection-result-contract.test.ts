/**
 * 单元测试验证查验标签、严格结果 reader、历史展示和脱离投票投影的数据边界。输入为内存身份 fixture、合法／畸形字面量、getter 与 Proxy；原字段及隐私断言拒绝无效证据，不猜测好人阵营。展示预期保留既有 text helper 耦合，不执行夜间流水线。
 */
import { expect, test } from "bun:test";
import { readInspectionResult, readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, type GameEvent, type RoleComponent } from "../../../../src/core";
import { RoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms/script/event_render_registry";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: camp/role/combined projections are exact detached labels, independent of real identity and wolf permissions`, () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles, locale });
    const wolf = world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
    const catalog = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((profile) =>
        profile.metadata.role !== Role.Wolf
          ? profile
          : {
              ...profile,
              runtime: {
                ...profile.runtime,
                inspectionLabels: (state: RoleComponent) =>
                  (state.privateState as { readonly unmasked?: unknown }).unmasked === true
                    ? { camp: Camp.Wolf, role: Role.Wolf }
                    : { camp: Camp.Good, role: Role.Villager },
              },
            },
      ),
    });
    const before = structuredClone(wolf.privateState);
    expect(resolveInspection(world, 1, "camp", catalog)).toEqual({ kind: "camp", camp: "good" });
    expect(resolveInspection(world, 1, "role", catalog)).toEqual({
      kind: "role",
      role: "villager",
    });
    const combined = resolveInspection(world, 1, "combined", catalog)!;
    expect(combined).toEqual({ kind: "combined", role: "villager", camp: "good" });
    expect(wolf.privateState).toEqual(before);
    expect(wolf.role).toBe(Role.Wolf);
    expect(wolf.camp).toBe(Camp.Wolf);
    expect(catalog.runtime(Role.Wolf)?.wolfTeam).toEqual(
      getDefaultRoleCatalog().runtime(Role.Wolf)?.wolfTeam,
    );
    (wolf.privateState as Record<string, unknown>).unmasked = true;
    expect(resolveInspection(world, 1, "combined", catalog)).toEqual({
      kind: "combined",
      role: "wolf",
      camp: "wolf",
    });
    expect(combined).toEqual({ kind: "combined", role: "villager", camp: "good" });
    world.getComponent<RoleComponent>(6, COMPONENT.Role)!.camp = Camp.ThirdParty;
    expect(resolveInspection(world, 6, "camp", catalog)).toEqual({
      kind: "camp",
      camp: "third_party",
    });
    expect(resolveInspection(world, 999, "camp", catalog)).toBeNull();
    expect(inspectionLabel(combined, locale)).toBe(
      locale === "en" ? "Villager (Good)" : "平民（好人）",
    );
  });
}

test("serialized readers preserve legitimate legacy booleans and never replace unknown or malformed typed results with a Good guess", () => {
  expect(readSeerInspectionResult({ isWerewolf: true })).toEqual({ kind: "camp", camp: "wolf" });
  expect(readSeerInspectionResult({ isWerewolf: false })).toEqual({ kind: "camp", camp: "good" });
  expect(readSeerInspectionResult({})).toBeNull();
  expect(readSeerInspectionResult({ isWerewolf: "false" })).toBeNull();
  for (const bad of [
    null,
    [],
    {},
    { kind: "camp", camp: "unknown" },
    { kind: "role", role: "custom" },
    { kind: "combined", camp: "good" },
    { kind: "camp", camp: "good", role: "wolf" },
    { kind: "future", camp: "wolf" },
  ]) {
    expect(readInspectionResult(bad)).toBeNull();
    expect(readSeerInspectionResult({ isWerewolf: false, result: bad })).toBeNull();
  }
  for (const result of [
    { kind: "camp", camp: "third_party" },
    { kind: "role", role: "seer" },
    { kind: "combined", camp: "wolf", role: "wolf" },
  ] as const) {
    const parsed = readInspectionResult(result);
    expect(parsed).toEqual(result);
    expect(parsed).not.toBe(result);
  }
});

test("unknown result decoding reads only own data, never evaluates changing/inherited getters, and handles throwing Proxy traps", () => {
  let reads = 0;
  const changing = {
    kind: "camp",
    get camp() {
      reads++;
      return reads === 1 ? "wolf" : "synthetic-invalid-camp";
    },
  };
  expect(readInspectionResult(changing)).toBeNull();
  expect(reads).toBe(0);
  expect(readInspectionResult(Object.create({ kind: "camp", camp: "wolf" }))).toBeNull();
  expect(readSeerInspectionResult(Object.create({ isWerewolf: true }))).toBeNull();
  const legacy = {
    get isWerewolf() {
      reads++;
      return true;
    },
  };
  expect(readSeerInspectionResult(legacy)).toBeNull();
  expect(reads).toBe(0);
  const accessor = {
    get result() {
      reads++;
      throw new Error("must-not-read");
    },
    isWerewolf: false,
  };
  expect(readSeerInspectionResult(accessor)).toBeNull();
  expect(reads).toBe(0);
  const trap = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error("untrusted-trap");
      },
    },
  );
  expect(readInspectionResult(trap)).toBeNull();
  expect(readSeerInspectionResult(trap)).toBeNull();
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  expect(readInspectionResult(revoked.proxy)).toBeNull();
  expect(readSeerInspectionResult(revoked.proxy)).toBeNull();
  const tagged = { kind: "camp", camp: "wolf", [Symbol("extra")]: true };
  expect(readInspectionResult(tagged)).toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: terminal old/manual result compatibility is strict and never guesses Good for missing or invalid evidence`, () => {
    const render = (payload: Record<string, unknown>) =>
      getDefaultScriptEventRenderRegistry().toLiveRender(
        {
          timestamp: 0,
          type: "seer_checked",
          payload: { actorId: 3, targetId: 1, ...payload },
        } as unknown as GameEvent,
        true,
        locale,
      );
    for (const [payload, expected] of [
      [{ result: null, isWerewolf: false }, "null"],
      [{ isWerewolf: "false" }, "?"],
      [{}, "?"],
      [
        { result: { kind: "future", original: "Raw 原文" }, isWerewolf: false },
        JSON.stringify({ kind: "future", original: "Raw 原文" }),
      ],
    ] as const) {
      expect(render(payload)).toEqual([
        {
          kind: "private",
          text: text(locale, "console.live.check", { actor: 3, target: 1, camp: expected }),
        },
      ]);
    }
  });

test("nested public vote evidence is detached from the authority before being given to a decision provider", () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles });
  const event: GameEvent = {
    timestamp: 0,
    type: "vote_summary",
    payload: {
      votes: [{ actorId: 1, targetId: 6, abstain: false, weight: 1 }],
      tally: { 6: 1 },
      target: 6,
    },
  };
  const view = buildAgentVisibleEventFeed(world, [event], 3);
  (view[0].payload.votes as Array<Record<string, unknown>>)[0].targetId = 3;
  expect(event.payload.votes).toEqual([{ actorId: 1, targetId: 6, abstain: false, weight: 1 }]);
  expect(view[0].payload).not.toHaveProperty("tally");
});
