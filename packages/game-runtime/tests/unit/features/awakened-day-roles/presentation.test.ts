/**
 * 单元测试负责守卫／骑士十一事实的两语标签、终端开关及真实玩家受众。输入字面已付／实际事实，输出可见矩阵。
 * 声明和付款不提前改变生命；God阻挡原因不进入任何玩家feed，周期选择即使白天也仅本人可见。
 */
import { expect, test } from "bun:test";
import { Phase, ActionWindow, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_GUARD_POLICY as gp } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { AWAKENED_DUEL_POLICY as kp } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import {
  awakenedGuardEventLabel,
  awakenedDuelEventLabel,
} from "@ai-werewolf-arena/game-presentation";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedKnightTwelveConfig } from "../../../../src/rulesets/presets/awakened-knight-twelve";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/agents/presentation/event-render-registry";
import { getDefaultPhaseStageLocalizationRegistry } from "../../../../src/rulesets/mechanism-api";
const events: GameEvent[] = [
  {
    type: "awakened_guard_cycle_started",
    payload: { policy: gp, day: 1, actorId: 11 },
    audience: [11],
  },
  {
    type: "awakened_protection_chosen",
    payload: {
      policy: gp,
      day: 1,
      actorId: 11,
      timing: "day",
      mode: "protect",
      targetId: 8,
      outcome: "protected",
    },
    audience: [11],
  },
  {
    type: "awakened_protection_revealed",
    payload: { policy: gp, day: 1, actorId: 11, targetId: 8 },
  },
  {
    type: "awakened_protection_block_detail",
    payload: {
      policy: gp,
      day: 1,
      actorId: 11,
      targetId: 8,
      phase: Phase.Day,
      rootPhase: Phase.Day,
      causes: [DeathCause.AwakenedDuel],
    },
    audience: [],
  },
  { type: "awakened_protection_blocked", payload: { policy: gp, day: 1, targetId: 8 } },
  {
    type: "awakened_protection_expired",
    payload: { policy: gp, day: 1, actorId: 11 },
    audience: [],
  },
  {
    type: "awakened_self_destruct_declared",
    payload: { policy: gp, day: 1, actorId: 3, window: ActionWindow.OnPreVote },
  },
  {
    type: "awakened_self_destruct_resolved",
    payload: { policy: gp, day: 1, actorId: 3, window: ActionWindow.OnPreVote, deaths: [] },
  },
  {
    type: "awakened_duel_committed",
    payload: { policy: kp, day: 1, actorId: 12, chain: 1, targetId: 8, branch: "wolf" },
  },
  {
    type: "awakened_duel_resolved",
    payload: { policy: kp, day: 1, actorId: 12, chain: 1, targetId: 8, deaths: [] },
  },
  {
    type: "awakened_duel_chain_ended",
    payload: { policy: kp, day: 1, actorId: 12, chain: 1, reason: "ended" },
  },
].map((e, i) => ({ ...e, timestamp: i })) as GameEvent[];
for (const locale of ["zh-CN", "en"] as const)
  test(`十一事实自然文案与终端受众/${locale}`, () => {
    const registry = getDefaultScriptEventRenderRegistry();
    for (const e of events) {
      const label = (
        e.type.startsWith("awakened_duel") ? awakenedDuelEventLabel : awakenedGuardEventLabel
      )(e.type, e.payload, locale)!;
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/undefined|NaN|policy|targetId/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      const audience = "audience" in e ? e.audience : undefined;
      expect(registry.toLiveRender(e, false, locale)).toEqual(
        audience === undefined ? [{ kind: "system", text: label }] : [],
      );
      expect(registry.toLiveRender(e, true, locale)).toEqual([
        {
          kind: audience === undefined ? "system" : audience.length ? "private" : "god",
          text: label,
        },
      ]);
    }
    for (const stage of [
      "awakened_protection_night",
      "awakened_protection_day",
      "awakened_duel",
      "awakened_duel_continue",
    ])
      expect(getDefaultPhaseStageLocalizationRegistry().stageName(stage, locale)).not.toBe(stage);
  });
test("私有选择只本人，God原因与到期任何玩家均不可读", () => {
  const { world } = bootstrapGame(structuredClone(awakenedKnightTwelveConfig));
  for (let id = 1; id <= 12; id++) {
    const feed = buildAgentVisibleEventFeed(world, events, id);
    expect(feed.map((e) => e.type)).toEqual(
      events
        .filter((e) => {
          const audience = "audience" in e ? e.audience : undefined;
          return audience === undefined || audience.includes(id);
        })
        .map((e) => e.type),
    );
    expect(
      feed.some(
        (e) =>
          e.type === "awakened_protection_block_detail" || e.type === "awakened_protection_expired",
      ),
    ).toBe(false);
  }
});
test("本人库存值端口逐字段脱离，额外字段／访问器不泄漏", async () => {
  const { createRoleComponent } = await import("../../../../src/domain/components/role");
  const { Role } = await import("@ai-werewolf-arena/game-contract");
  const { projectAwakenedGuardKnowledge } =
    await import("../../../../src/features/awakened-guard/observation-ports");
  const { projectAwakenedKnightKnowledge } =
    await import("../../../../src/features/awakened-knight/observation-ports");
  const role = createRoleComponent(Role.Villager),
    g = {
      policy: gp,
      cycles: [{ day: 1, status: "protected" as const, targetId: 8, timing: "day" as const }],
    },
    k = { policy: kp, attempts: [{ day: 1, chain: 1, targetId: 8, branch: "wolf" as const }] };
  expect(Reflect.set(role.privateState, "awakenedGuard", g)).toBe(true);
  expect(Reflect.set(role.privateState, "awakenedKnight", k)).toBe(true);
  const observedG = projectAwakenedGuardKnowledge(role)!,
    observedK = projectAwakenedKnightKnowledge(role)!;
  expect(observedG).toEqual(g);
  expect(observedK).toEqual(k);
  expect(observedG.cycles).not.toBe(g.cycles);
  expect(observedK.attempts).not.toBe(k.attempts);
  g.cycles[0]!.targetId = 9;
  k.attempts[0]!.targetId = 9;
  expect(observedG.cycles[0]).toEqual({ day: 1, status: "protected", targetId: 8, timing: "day" });
  expect(observedK.attempts[0]!.targetId).toBe(8);
  let reads = 0;
  Object.defineProperty(g.cycles[0], "hiddenCamp", {
    enumerable: true,
    get() {
      reads++;
      return "wolf";
    },
  });
  Object.defineProperty(k, "privateProof", {
    enumerable: true,
    get() {
      reads++;
      return "opaque";
    },
  });
  expect(projectAwakenedGuardKnowledge(role)).toBeNull();
  expect(projectAwakenedKnightKnowledge(role)).toBeNull();
  expect(reads).toBe(0);
});
