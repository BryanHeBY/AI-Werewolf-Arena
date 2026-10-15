/**
 * 单元组件测试验证复盘的两语文案、显式时区、原文保留和结构化加载错误。
 * 输入为手写事实、畸形文件／显示参数和帧号；输出以独立字幕、时间及状态预期核对纯帧／markup、未知回退和无错误泄漏，不运行真实对局或模型。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { dictionaries, renderMessage, validateDictionaries } from "@ai-werewolf-arena/game-text";
import { eventLabel } from "../../../../src/replay/event-labels";
import { formatReplayTime } from "../../../../src/replay/replay-display";
import { buildReplayFrame, createReplayRenderInput } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import {
  ReplayLoadError,
  parseOfflineReplayJson,
  readOfflineReplay,
} from "../../../../src/replay/offline-replay";
import {
  campName,
  resultReasonName,
  stageName,
  replayResultLabel,
} from "../../../../src/replay/replay-localization";

const event = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-07-29T00:00:00.000Z",
  day: 1,
  phase: "day",
  type,
  payload,
});
const replay: ReplayDocument = {
  schemaVersion: 2,
  perspective: "god",
  sessionId: "bilingual",
  meta: { board: "six", locale: "en", startedAt: "t1", endedAt: "t2" },
  result: { winner: null, reason: null },
  players: [
    { player_id: 1, name: "绿茶·Tea <3>", role: "seer", camp: "good" },
    { player_id: 2, role: "wolf", camp: "wolf" },
  ],
  events: [
    event("day_speech", { actorId: 1, text: "茶茶 says {actor}：我是预言家。" }),
    { ...event("voted_out", { target: 2 }), seq: 2 },
  ],
};

test("both dictionaries cover every replay label with matching parameters", () => {
  validateDictionaries();
  for (const key of Object.keys(dictionaries.en).filter((key) => key.startsWith("replay.")))
    expect(dictionaries.en[key as keyof typeof dictionaries.en]).not.toMatch(/[\u4e00-\u9fff]/);
});

test("labels translate presentation terms and preserve raw player strings and unknown IDs", () => {
  expect(eventLabel(replay.events[0], "zh-CN")).toBe("1号发言：茶茶 says {actor}：我是预言家。");
  expect(eventLabel(replay.events[0], "en")).toBe("Player 1 says: 茶茶 says {actor}：我是预言家。");
  expect(eventLabel(event("custom_event", { text: "raw <html> {role}" }), "en")).toBe(
    "raw <html> {role}",
  );
  expect(eventLabel(event("custom_event", {}), "en")).toBe("custom_event");
  expect(stageName("custom_stage", "en")).toBe("custom_stage");
  expect(campName("camp_x", "en")).toBe("camp_x");
  expect(resultReasonName("custom_reason", "en")).toBe("custom_reason");
  for (const id of ["constructor", "toString", "__proto__"]) {
    expect(resultReasonName(id, "en")).toBe(id);
    expect(eventLabel(event("game_over", { winner: "good", reason: id }), "en")).toBe(
      `Game over: Good team wins (${id})`,
    );
  }
  expect(resultReasonName("slaughter_side_completed", "en")).toBe(
    "All good special roles or all villagers eliminated",
  );
  expect(resultReasonName("slaughter_side", "en")).toBe(
    resultReasonName("slaughter_side_completed", "en"),
  );
  expect(resultReasonName("all_good_eliminated", "en")).not.toBe("all_good_eliminated");
  expect(eventLabel(event("game_over", { winner: null, reason: "runtime_timeout" }), "en")).toBe(
    "Game over: no winner (Runtime deadline reached)",
  );
});

test("event branches have independent English vote, skill, sheriff, death, and unknown oracles", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["wolf_kill_vote_cast", { actorId: 2, abstain: true }, "Player 2 abstains from the kill vote"],
    ["guard_applied", { actorId: 3, targetId: null }, "Player 3 chooses not to guard"],
    ["guard_applied", { actorId: 3, targetId: 1 }, "Player 3 guards player 1"],
    [
      "seer_checked",
      { actorId: 1, targetId: 2, isWerewolf: true },
      "Player 1 checks player 2: Werewolves",
    ],
    ["witch_potion_skipped", { actorId: 4 }, "Player 4 uses no potion"],
    [
      "sheriff_vote_summary",
      { votes: [], winnerId: null },
      "Sheriff votes: None; No sheriff elected",
    ],
    ["sheriff_nomination_summary", { candidates: [] }, "Sheriff candidates: None"],
    [
      "sheriff_badge_transferred",
      { fromId: 1, toId: 3 },
      "Player 1 transfers the sheriff badge to player 3",
    ],
    ["night_resolved", { deaths: [2, 4] }, "Died last night: Player 2, Player 4"],
    [
      "vote_summary",
      {
        votes: [
          { actorId: 1, targetId: 2, weight: 1.5 },
          { actorId: 3, abstain: true },
        ],
      },
      "Exile votes: Player 1 votes for player 2 (weight 1.5), Player 3 abstains",
    ],
    [
      "idiot_revealed",
      { targetId: 3 },
      "Player 3 reveals as Idiot, survives exile, and loses voting rights",
    ],
    ["hunter_silent_due_to_poison", { hunterId: 5 }, "Hunter 5 cannot shoot after poisoning"],
    [
      "sheriff_direction_chosen",
      { sheriffId: 1, direction: "new_direction" },
      "Player 1 chooses new_direction speaking order",
    ],
  ];
  for (const [type, payload, expected] of cases)
    expect(eventLabel(event(type, payload), "en")).toBe(expected);
});

test("time zone is explicit across DST and historical offset-less dates remain raw", () => {
  const en = { locale: "en" as const, timeZone: "UTC" };
  expect(formatReplayTime("2026-07-29T00:00:00.000Z", en)).toBe("2026-07-29 00:00:00 [UTC]");
  expect(formatReplayTime("2026-07-29T00:00:00.000Z", { ...en, timeZone: "Asia/Shanghai" })).toBe(
    "2026-07-29 08:00:00 [Asia/Shanghai]",
  );
  expect(
    formatReplayTime("2026-07-29T00:00:00.000Z", { ...en, timeZone: "America/New_York" }),
  ).toBe("2026-07-28 20:00:00 [America/New_York]");
  expect(
    formatReplayTime("2026-01-29T00:00:00.000Z", { ...en, timeZone: "America/New_York" }),
  ).toBe("2026-01-28 19:00:00 [America/New_York]");
  for (const raw of ["t1", "2026-07-29T00:00:00", "2026-07-29", "not-a-dateZ"])
    expect(formatReplayTime(raw, en)).toBe(raw);
  expect(formatReplayTime(undefined, en)).toBe("—");
  for (const invalid of [undefined, null, 12, ""])
    expect(() => formatReplayTime("t1", { ...en, timeZone: invalid as unknown as string })).toThrow(
      "replay_display_time_zone_invalid",
    );
  expect(() => formatReplayTime("t1", { ...en, timeZone: "invalid" })).toThrow(
    "replay_display_time_zone_invalid",
  );
});

test("same explicit frame renders identically and language changes neither events nor projection", () => {
  const original = structuredClone(replay);
  const en = createReplayRenderInput(replay);
  const zh = createReplayRenderInput(replay, { locale: "zh-CN", timeZone: "Asia/Shanghai" });
  const frame = buildReplayFrame(en, 100);
  const other = buildReplayFrame(zh, 100);
  expect(frame.eventSeq).toBe(2);
  expect(frame.snapshot.players[1].alive).toBe(false);
  expect(frame.snapshot).toEqual(other.snapshot);
  expect(frame.time).toBe("2026-07-29 00:00:00 [UTC]");
  expect(other.time).toBe("2026-07-29 08:00:00 [Asia/Shanghai]");
  const markup = renderToStaticMarkup(<ReplayFrame input={en} frame={100} />);
  expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={en} frame={100} />));
  expect(markup).toContain("Player 2 is exiled");
  expect(markup).toContain("绿茶·Tea &lt;3&gt;");
  expect(renderToStaticMarkup(<ReplayFrame input={zh} frame={100} />)).toContain("2号被放逐出局");
  en.replay.events[0].payload.text = "changed render input";
  expect(replay).toEqual(original);
  expect(() => buildReplayFrame(zh, NaN)).toThrow("replay_frame_invalid");
  expect(
    buildReplayFrame(createReplayRenderInput({ ...replay, events: [] }), 0).eventSeq,
  ).toBeNull();
});

test("loader keeps structured errors renderable after locale changes without raw exception leakage", () => {
  for (const [raw, key] of [
    ["bad-json", "replay.invalid_file"],
    [JSON.stringify({ ...replay, schemaVersion: 99 }), "replay.unsupported_version"],
  ] as const) {
    try {
      parseOfflineReplayJson(raw);
      throw new Error("expected invalid fixture");
    } catch (error) {
      expect(error).toBeInstanceOf(ReplayLoadError);
      const ref = (error as ReplayLoadError).messageRef;
      expect(ref.key).toBe(key);
      expect(renderMessage("en", ref)).not.toMatch(/[\u4e00-\u9fff]/);
    }
  }
});

test("null winner distinguishes terminal outcomes from an in-progress replay in both languages", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const ended = locale === "en" ? "No winner" : "无胜者",
      progress = locale === "en" ? "Unfinished" : "未结束";
    expect(replayResultLabel(replay, locale)).toBe(progress);
    expect(
      replayResultLabel({ ...replay, result: { winner: null, reason: "in_progress" } }, locale),
    ).toBe(progress);
    expect(
      replayResultLabel({ ...replay, result: { winner: null, reason: "custom_reason" } }, locale),
    ).toBe(progress);
    for (const reason of ["max_days_reached", "completed"])
      expect(replayResultLabel({ ...replay, result: { winner: null, reason } }, locale)).toBe(
        ended,
      );
    for (const reason of ["runtime_timeout", "runtime_error"])
      expect(replayResultLabel({ ...replay, result: { winner: null, reason } }, locale)).toBe(
        progress,
      );
    expect(
      replayResultLabel({ ...replay, events: [event("game_over", { winner: null })] }, locale),
    ).toBe(ended);
    expect(
      replayResultLabel(
        { ...replay, events: [event("phase_changed", { phase: "game_over" })] },
        locale,
      ),
    ).toBe(ended);
  }
});

test("file read failures expose a structured safe loader error", async () => {
  const file = {
    text: async () => {
      throw new Error("private-exception-canary");
    },
  } as unknown as File;
  try {
    await readOfflineReplay(file);
    throw new Error("expected read failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ReplayLoadError);
    expect((error as ReplayLoadError).messageRef).toEqual({ key: "replay.read_failed" });
    expect((error as Error).message).not.toContain("private-exception-canary");
  }
});
