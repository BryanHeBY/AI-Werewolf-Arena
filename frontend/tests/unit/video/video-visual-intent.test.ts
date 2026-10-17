/**
 * 单元层核对显式视觉全集与独立手写的报告、映射、关系、胜利记录；预期不由设计JSON或生产投影生成。
 * 不运行对局规则，不从玩家真角色推查验结果；本测试将模板覆盖与权限／死亡证明严格分开。
 */
import { expect, test } from "bun:test";
import { ACTION_STAGES, ROLE_IDS, type GameOutcome } from "@ai-werewolf-arena/game-contract";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { KNOWN_REPLAY_EVENT_TYPES } from "../../../src/replay/replay-event-reader";
import { eventScene, compileScene } from "../../../src/video/semantic-scenes";
import {
  eventVisualIntent,
  factVisualIntent,
  videoVisualReport,
} from "../../../src/video/visual-intent";
import {
  VIDEO_EVENT_VISUAL_ROUTES,
  VIDEO_ROLE_VISUAL_FAMILIES,
  VIDEO_STAGE_VISUAL_ROUTES,
} from "../../../src/video/visual-routes";
import { VIDEO_VISUAL_FAMILIES } from "../../../src/video/visual-vocabulary";

const playerIds = [1, 2, 3, 4, 5, 6];
function event(type: string, payload: Record<string, unknown>): ReplayEvent {
  return { seq: 7, type, payload, timestamp: "2026-10-17T00:00:00Z", day: 2, phase: "night" };
}
test("recorded gun, claw, patrol, retaliation and three duel mechanisms select distinct tools without guessing a blocked source", () => {
  const rows = [
    ["player_shot", { actorId: 1, targetId: 3 }, "gun"],
    [
      "awakened_claws_expired",
      {
        policy: "awa_awakened_wolf_king_v1",
        day: 2,
        actorId: 1,
        unitIds: ["awakened_claw:native:1"],
      },
      "claw",
    ],
    [
      "awakened_patrol_resolved",
      { policy: "awa_directional_patrol_v1", day: 2, actorId: 1, direction: null, targetId: null },
      "patrol",
    ],
    [
      "animal_puffer_decided",
      { policy: "awa_animal_dream_v1", day: 2, actorId: 1, activate: false },
      "retaliation",
    ],
  ] as const;
  for (const [type, payload, expected] of rows) {
    const input = event(type, { ...payload });
    if (type === "animal_puffer_decided") input.phase = "voting";
    const intent = eventVisualIntent(input, playerIds);
    expect(intent.deathTool).toBe(expected);
    expect(intent.life).toBeUndefined();
  }
  const blocked = eventVisualIntent(
    event("death_shot_blocked", { actorId: 1, targetId: 3, reason: "night_protection" }),
    playerIds,
  );
  expect(blocked.process).toBe("blocked");
  expect(blocked.deathTool).toBeUndefined();
  expect(blocked.life).toBeUndefined();
  const ordinary = eventVisualIntent(
    event("knight_duel", { actorId: 1, targetId: 3, result: "not_wolf" }),
    playerIds,
  );
  expect(ordinary.duelKind).toBe("knight");
  expect(ordinary.duel?.branch).toBe("not_wolf");
  expect(ordinary.process).toBe("reported");
  expect(ordinary.fallbackReason).toBeUndefined();
  expect(ordinary.life).toBeUndefined();
  const wolfDuel = eventVisualIntent(
    event("knight_duel", { actorId: 1, targetId: 3, result: "wolf" }),
    playerIds,
  );
  expect(wolfDuel.duel?.branch).toBe("wolf");
  expect(wolfDuel.process).toBe("reported");
  expect(wolfDuel.fallbackReason).toBeUndefined();
  expect(wolfDuel.life).toBeUndefined();
  expect(
    eventVisualIntent(
      {
        ...event("awakened_duel_committed", {
          policy: "awa_awakened_duel_chain_v1",
          day: 2,
          actorId: 1,
          chain: 1,
          targetId: 3,
          branch: "wolf",
        }),
        phase: "day",
      },
      playerIds,
    ).duelKind,
  ).toBe("awakened_knight");
  const demon = eventVisualIntent(
    event("demon_hunter_chosen", {
      policy: "awa_netease_demon_hunter_v1",
      day: 2,
      actorId: 1,
      targetId: 3,
    }),
    playerIds,
  );
  expect(demon.duelKind).toBe("demon_hunter");
  expect(demon.duel).toBeUndefined();
  expect(demon.report).toBeUndefined();
  expect(demon.life).toBeUndefined();
});
test("explicit routes cover exactly 217 known events, 98 request stages and 64 registered roles", () => {
  expect(Object.keys(VIDEO_EVENT_VISUAL_ROUTES).sort()).toEqual(
    [...KNOWN_REPLAY_EVENT_TYPES].sort(),
  );
  expect(Object.keys(VIDEO_STAGE_VISUAL_ROUTES).sort()).toEqual([...ACTION_STAGES].sort());
  expect(Object.keys(VIDEO_ROLE_VISUAL_FAMILIES).sort()).toEqual([...ROLE_IDS].sort());
  expect(VIDEO_VISUAL_FAMILIES).toHaveLength(31);
  expect(
    new Set(Object.values(VIDEO_EVENT_VISUAL_ROUTES).map((route) => route.template)).size,
    // 夜聊结束与发言共用对白模板，原孤立pack compact notice不再占专属模板。
  ).toBe(85);
  expect(VIDEO_EVENT_VISUAL_ROUTES.awakened_self_destruct_resolved.family).toBe("pack_attack");
  expect(VIDEO_EVENT_VISUAL_ROUTES.mechanical_poison_reflected.family).toBe("reflection");
  const blast = eventVisualIntent(
    event("wolf_self_destruct", { wolfId: 1, window: "before_exile" }),
    playerIds,
  );
  expect(blast.template).toBe("pack_attack/self_destruct_declared");
  expect(blast.actorId).toBe(1);
  expect(blast.life).toBeUndefined();
  const targeted = eventVisualIntent(
    event("white_wolf_king_self_destruct", { actorId: 1, targetId: 3, window: "before_exile" }),
    playerIds,
  );
  expect(targeted.template).toBe("pack_attack/self_destruct_declared");
  expect(targeted.requestedTargetIds).toEqual([3]);
  expect(targeted.life).toBeUndefined();
});
test("camp, role and combined are reports, while paired and range feedback never identify a hidden wolf", () => {
  expect(videoVisualReport({ kind: "camp", camp: "third_party" })).toEqual({
    kind: "camp",
    camp: "third_party",
  });
  expect(videoVisualReport({ kind: "combined", camp: "good", role: "wolf" })).toEqual({
    kind: "combined",
    camp: "good",
    roleId: "wolf",
  });
  expect(videoVisualReport({ kind: "role", role: "not_a_role" })).toEqual({
    kind: "unknown",
    reason: "report_not_recorded",
  });
  const inspect = eventVisualIntent(
    event("role_inspected", {
      actorId: 1,
      targetId: 3,
      day: 2,
      result: { kind: "role", role: "wolf" },
    }),
    playerIds,
  );
  expect(inspect.report).toEqual({ kind: "role", roleId: "wolf" });
  expect(inspect.recipientIds).toEqual([1]);
  expect(inspect.requestedTargetIds).toEqual([3]);
  expect(inspect.effectiveTargetIds).toEqual([]);
  const pair = eventVisualIntent(
    event("fragrant_pair_inspected", {
      policy: "awa_fragrant_pair_seer_v1",
      actorId: 1,
      day: 2,
      targetIds: [2, 5],
      containsWerewolf: true,
    }),
    playerIds,
  );
  expect(pair.report).toEqual({ kind: "pair", targetIds: [2, 5], containsWerewolf: true });
  expect(pair.life).toBeUndefined();
  expect(
    eventVisualIntent(event("bear_roared", { day: 2, roared: true }), playerIds).report,
  ).toEqual({ kind: "range", signal: "roar", scope: "adjacent_alive" });
});
test("requests, mapped effects, hidden sources and independent God life facts remain separate", () => {
  const mapped = eventVisualIntent(
    {
      ...event("exile_target_mapped", { requestedId: 2, effectiveId: 5, missed: false }),
      phase: "voting",
    },
    playerIds,
  );
  expect(mapped.requestedTargetIds).toEqual([2]);
  expect(mapped.effectiveTargetIds).toEqual([5]);
  expect(mapped.life).toBeUndefined();
  const reflection = eventVisualIntent(
    event("time_consort_reflected", {
      actorId: 2,
      day: 2,
      sourceId: 1,
      requestedId: 3,
      effectiveId: 1,
      kind: "check",
    }),
    playerIds,
  );
  expect(reflection.actorId).toBe(2);
  expect(reflection.effectSourceId).toBe(1);
  expect(reflection.effectKind).toBe("check");
  expect(reflection.requestedTargetIds).toEqual([3]);
  expect(reflection.effectiveTargetIds).toEqual([1]);
  const used = eventVisualIntent(
    event("witch_potion_used", { actorId: 1, targetId: 4, potionType: "heal" }),
    playerIds,
  );
  expect(used.process).toBe("paid");
  expect(used.life).toBeUndefined();
  const knife = factVisualIntent({
    seq: 3,
    afterSeq: 7,
    day: 2,
    kind: "wolf_knife_committed",
    participantIds: [1, 3],
    requestedTargetId: 2,
    effectiveTargetId: 5,
  });
  expect(knife.actorId).toBeUndefined();
  expect(knife.participantIds).toEqual([1, 3]);
  expect(knife.requestedTargetIds).toEqual([2]);
  expect(knife.effectiveTargetIds).toEqual([5]);
  expect(knife.life).toBeUndefined();
  expect(knife.source).toEqual({ eventSeqs: [], factSeqs: [3] });
  const emptyKnife = factVisualIntent({
    seq: 4,
    afterSeq: 7,
    day: 2,
    kind: "wolf_knife_committed",
    participantIds: [1],
    requestedTargetId: 3,
    effectiveTargetId: null,
  });
  expect(emptyKnife.requestedTargetIds).toEqual([3]);
  expect(emptyKnife.effectiveTargetKnown).toBe(true);
  expect(emptyKnife.effectiveTargetIds).toEqual([]);
  expect(
    factVisualIntent({
      seq: 4,
      afterSeq: 7,
      day: 2,
      kind: "life_committed",
      playerId: 5,
      alive: false,
      causes: ["wolf_kill"],
    }).life,
  ).toEqual({ playerIds: [5], committed: true, causes: { 5: ["wolf_kill"] } });
});
test("five additional typed dialogue forms retain their own actor and text with translation and recipient provenance", () => {
  const rows = [
    event("debate_speech", { actorId: 2, text: "原话一" }),
    event("ghost_bride_partner_chat", {
      policy: "awa_melbourne_ghost_bride_v1",
      groupId: "ghost-bride:1:2",
      day: 2,
      actorId: 2,
      recipientId: 5,
      text: "原话二",
    }),
    event("brew_discussion", {
      policy: "awa_awakened_witch_v1",
      day: 2,
      actorId: 2,
      ordinal: 1,
      text: "原话三",
    }),
    {
      ...event("secret_body_reveal_speech", {
        policy: "awa_noble_secret_body_v1",
        day: 2,
        actorId: 2,
        text: "原话四",
      }),
      phase: "voting",
    },
    {
      ...event("silence_translated", {
        policy: "awa_melbourne_gestures_v1",
        day: 2,
        actorId: 2,
        targetId: 5,
        round: "day",
        text: "原话五",
      }),
      phase: "day",
    },
  ];
  for (const row of rows) {
    const scene = eventScene(row, [row], "not used", "stage", playerIds, "zh-CN");
    expect(scene.kind).toBe("speech");
    expect(scene.speaker).toBe("player:2");
    expect(scene.body).toBe(row.payload.text as string);
  }
  expect(eventVisualIntent(rows[1], playerIds).recipientIds).toEqual([5]);
  expect(eventVisualIntent(rows[4], playerIds).requestedTargetIds).toEqual([5]);
  const unknown = eventVisualIntent(
    event("future_role_event", { actorId: 1, targetId: 5, text: "我是预言家，五号是狼" }),
    playerIds,
  );
  expect(unknown.family).toBe("god_announcement");
  expect(unknown.process).toBe("unknown");
  expect(unknown.report).toBeUndefined();
  expect(unknown.requestedTargetIds).toEqual([]);
});

test("native hunter and last-words identifiers stay explicit while private ability sources are never inferred", () => {
  expect(
    eventVisualIntent(event("hunter_shot", { hunterId: 2, targetId: 5 }), playerIds).actorId,
  ).toBe(2);
  expect(
    eventVisualIntent(event("last_words_spoken", { playerId: 5, text: "最后的话" }), playerIds)
      .actorId,
  ).toBe(5);
  const hidden = eventVisualIntent(
    event("ability_changed", {
      actorId: 5,
      abilityId: "gift:potion",
      kind: "potion",
      operation: "granted",
      source: { kind: "gift", actorId: 2 },
      sourceDisclosed: false,
      startsOnDay: 2,
      maxUses: 1,
    }),
    playerIds,
  );
  expect(hidden.actorId).toBeUndefined();
  expect(hidden.recipientIds).toEqual([5]);
  expect(JSON.stringify(hidden)).not.toContain('"actorId":2');
  expect(hidden.life).toBeUndefined();
});

test("poison, cancellation and duel branch details state only their explicit recorded result", () => {
  expect(
    eventVisualIntent(
      event("mechanical_poison_used", { actorId: 1, targetId: 5, day: 2 }),
      playerIds,
    ).potion,
  ).toBe("poison");
  const cancellation = factVisualIntent({
    seq: 2,
    afterSeq: 7,
    day: 2,
    kind: "night_protection_resolved",
    targetId: 5,
    interaction: "guard_heal_cancelled",
  });
  expect(cancellation.protection).toEqual({ interaction: "guard_heal_cancelled" });
  expect(cancellation.life).toBeUndefined();
  const duel = eventVisualIntent(
    event("knight_duel", { actorId: 1, targetId: 5, result: "not_wolf" }),
    playerIds,
  );
  expect(duel.duel).toEqual({ branch: "not_wolf" });
  expect(duel.life).toBeUndefined();
  expect(duel.effectiveTargetIds).toEqual([]);
});

test("individual victory members and editorial target notes never come from current camp or override recorded targets", () => {
  const outcome: GameOutcome = {
    kind: "victory",
    primary: {
      kind: "individual",
      goalId: "netease_cursed_fox_last_faction_v1",
      playerId: 5,
      winningPlayerIds: [5],
    },
    additional: [],
    winningPlayerIds: [5],
  };
  // 个人胜利没有兼容主阵营winner；不能把null误译成无胜者或擅改成third_party。
  const result = eventVisualIntent(
    event("game_over", {
      winner: null,
      reason: "individual_survived",
      outcome,
      decidedAt: { day: 2, phase: "night", checkpoint: "night_settled" },
    }),
    playerIds,
  );
  expect(result.victory).toEqual({
    winner: null,
    reason: "individual_survived",
    winningPlayerIds: [5],
    outcome,
  });
  const row = event("seer_checked", {
    actorId: 1,
    targetId: 3,
    result: { kind: "camp", camp: "good" },
  });
  const base = eventScene(row, [row], "literal report", "stage", playerIds, "en");
  const authored = compileScene(base, { targetIds: [5], actorId: 2 }, undefined, 30, 90, playerIds);
  expect(authored.editorial).toEqual({ targetIds: [5], actorId: 2 });
  expect(authored.visual?.requestedTargetIds).toEqual([3]);
  expect(authored.visual?.actorId).toBe(1);
  expect(base.editorial).toBeUndefined();
});
