/**
 * 单元与组件层验证结构化播报的字段白名单、身份配色、已提交生命和揭晓边界。输入为手写公开record及场景，不运行对局。
 * 预期以独立玩家ID／角色／阵营／原文和中英标签逐项核对；不从编译结果生成答案，不把声明或报告当真实角色与死亡。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { announcementContent } from "../../../src/presentation/announcement-content";
import { sceneContent } from "../../../src/presentation/scene-content";
import { SceneContentBlocks } from "../../../src/presentation/SceneContentBlocks";
import { AnnouncementFields } from "../../../src/presentation/AnnouncementFields";
import { AnnouncementScene } from "../../../src/video/render/broadcast/AnnouncementScene";
import { resolveTheme, themePalette, themeSurface } from "../../../src/themes";
import type { VideoScene } from "../../../src/video/types";

const ids = Array.from({ length: 12 }, (_, index) => index + 1);
const colors = {
  good: "#116688",
  wolf: "#bb2233",
  thirdParty: "#8855bb",
  unknown: "#777777",
  accent: "#998844",
  muted: "#666666",
  danger: "#ee3344",
};
function record(type: string, payload: ReplayEvent["payload"]) {
  return readReplayEvent({ seq: 1, type, payload, day: 1, phase: "night", timestamp: "test" }, ids);
}
function initial() {
  return record("god_private_game_info", {
    players: ids.map((id) => ({
      id,
      seat: id,
      name: "DO NOT COPY NAME",
      model: "DO NOT COPY MODEL",
      role: id === 1 ? "wolf" : id === 2 ? "seer" : "villager",
      ...(id === 3 ? {} : { camp: id === 1 ? "wolf" : id === 4 ? "third_party" : "good" }),
    })),
  });
}
function scene(): VideoScene {
  return {
    kind: "fallback",
    title: "Independent acceptance",
    body: "Original caption and future speech text remain complete.",
    bodySource: "event",
    targetIds: [],
    emphasis: [],
    cues: { establish: 0, travel: 8, impact: 24, settled: 40 },
    visual: {
      family: "god_announcement",
      template: "god_announcement/fact_card",
      process: "notice",
      requestedTargetIds: [],
      effectiveTargetIds: [],
      recipientIds: [],
      source: { eventSeqs: [1], factSeqs: [] },
    },
  };
}

test("initial roles copy only explicit identity fields, preserve unknown camp and detach their JSON", () => {
  const input = initial()!;
  const before = JSON.stringify(input);
  const announcement = announcementContent(input)!;
  expect(announcement.kind).toBe("lineup");
  if (announcement.kind !== "lineup") throw new Error("test_lineup_expected");
  expect(announcement.players[0]).toEqual({ playerId: 1, seat: 1, roleId: "wolf", camp: "wolf" });
  expect(announcement.players[1]).toEqual({ playerId: 2, seat: 2, roleId: "seer", camp: "good" });
  expect(announcement.players[2]).toEqual({
    playerId: 3,
    seat: 3,
    roleId: "villager",
    camp: "unknown",
  });
  expect(announcement.players[3]!.camp).toBe("third_party");
  expect(JSON.stringify(announcement)).not.toContain("DO NOT COPY");
  expect(JSON.parse(JSON.stringify(announcement))).toEqual(announcement);
  announcement.players[0]!.roleId = "witch";
  expect(JSON.stringify(input)).toBe(before);
});

test("invalid records, similar unknown event names and speech claims never produce a lineup", () => {
  expect(
    announcementContent(record("god_private_game_info", { players: [{ id: 99, role: "wolf" }] })),
  ).toBeNull();
  expect(
    announcementContent(
      record("game_initialized", { players: [{ id: 1, role: "wolf", camp: "wolf" }] }),
    ),
  ).toBeNull();
  expect(
    announcementContent(record("day_speech", { actorId: 1, text: "2号是狼，3号是预言家" })),
  ).toBeNull();
  expect(announcementContent(null)).toBeNull();
});

test("short notices keep explicit skill status, direction and relation endpoints without inferring life or faction", () => {
  for (const [type, payload, kind, expected] of [
    ["last_words_granted", { playerId: 2 }, "last-words", "遗言"],
    ["sheriff_direction_chosen", { sheriffId: 2, direction: "clockwise" }, "direction", "顺时针"],
    [
      "ability_changed",
      { actorId: 2, abilityId: "test:guard", kind: "guard", operation: "disabled" },
      "ability",
      "封锁",
    ],
    ["charm_death", { actorId: 8, targetId: 2 }, "notice", "2号"],
    ["hunter_silent_due_to_poison", { hunterId: 2 }, "notice", "毒"],
    ["idiot_revealed", { targetId: 2 }, "notice", "白痴"],
  ] as const) {
    const content = announcementContent(record(type, payload));
    expect(content?.kind).toBe(kind);
    if (!content) throw new Error("test_notice_missing");
    const html = renderToStaticMarkup(
      <AnnouncementFields announcement={content} locale="zh-CN" players={[]} colors={colors} />,
    );
    expect(html).toContain(expected);
    expect(html).not.toContain("data-life-player");
    expect(html).not.toContain("data-lineup-camp");
  }
});

test("explicit rosters retain order, empty withdrawals and badge endpoints without subtracting inferred members", () => {
  expect(announcementContent(record("wolf_tactical_order", { order: [3, 1, 2] }))).toEqual({
    kind: "roster",
    purpose: "wolf-order",
    playerIds: [3, 1, 2],
    ordered: true,
  });
  for (const [type, purpose] of [
    ["sheriff_nomination_summary", "nomination"],
    ["sheriff_candidates_finalized", "candidates"],
    ["sheriff_pk_started", "sheriff-pk"],
    ["exile_pk_started", "exile-pk"],
  ] as const)
    expect(announcementContent(record(type, { candidates: [2, 5] }))).toEqual({
      kind: "roster",
      purpose,
      playerIds: [2, 5],
      ordered: false,
    });
  expect(announcementContent(record("sheriff_withdraw_summary", { withdrawn: [] }))).toEqual({
    kind: "roster",
    purpose: "withdrawal",
    playerIds: [],
    ordered: false,
  });
  expect(
    announcementContent(
      record("sheriff_badge_transferred", { fromId: 2, toId: 5, reason: "night_death" }),
    ),
  ).toEqual({ kind: "badge", operation: "transferred", fromId: 2, playerId: 5 });
  expect(announcementContent(record("sheriff_elected", { winnerId: 5 }))).toEqual({
    kind: "badge",
    operation: "elected",
    playerId: 5,
  });
  expect(
    announcementContent(record("sheriff_badge_destroyed", { targetId: 5, reason: "destroy" })),
  ).toEqual({ kind: "badge", operation: "destroyed", playerId: 5 });
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: twelve opening seats have separate recorded role/camp colors and omit repeated names`, () => {
    const announcement = announcementContent(initial())!;
    const html = renderToStaticMarkup(
      <AnnouncementFields
        announcement={announcement}
        locale={locale}
        players={ids.map((id) => ({ id, name: "HIDDEN LONG NICKNAME", seat: id }))}
        colors={colors}
      />,
    );
    expect(html.match(/data-lineup-player=/g)).toHaveLength(12);
    expect(html).toContain(locale === "en" ? "Werewolf" : "狼人");
    expect(html).toContain(locale === "en" ? "Seer" : "预言家");
    expect(html).toContain(locale === "en" ? "Third party" : "第三方");
    expect(html).toContain(locale === "en" ? "Unknown" : "未知");
    expect(html).toContain('data-lineup-camp="unknown"');
    for (const color of ["#116688", "#bb2233", "#8855bb", "#777777"])
      expect(html).toContain(`color:${color}`);
    expect(html).not.toContain("HIDDEN LONG NICKNAME");
    expect(html).not.toContain("DO NOT COPY");
    const conflict = renderToStaticMarkup(
      <AnnouncementFields
        announcement={{ kind: "lineup", players: [{ playerId: 1, roleId: "wolf", camp: "good" }] }}
        locale={locale}
        players={[]}
        colors={colors}
      />,
    );
    expect(conflict).toContain('data-lineup-role="wolf"');
    expect(conflict).toContain('data-lineup-camp="good"');
    expect(conflict).toContain("color:#116688");
    expect(conflict).not.toContain("color:#bb2233");
  });

test("scene fields never replace caption/TTS text or an authored body", () => {
  const current = scene();
  const before = JSON.stringify(current);
  expect(sceneContent(current, initial()).blocks.map((block) => block.kind)).toEqual([
    "announcement",
  ]);
  expect(JSON.stringify(current)).toBe(before);
  const authored = {
    ...current,
    bodySource: "script" as const,
    body: "Explicit director text, unchanged.",
  };
  expect(sceneContent(authored, initial()).blocks).toEqual([
    { kind: "record", text: "Explicit director text, unchanged.", reason: "recorded_context" },
  ]);
});

test("only committed life yields danger cards and known causes, never an empty generic target", () => {
  const current = scene();
  current.visual!.process = "resolved";
  current.visual!.life = {
    playerIds: [7, 8],
    committed: true,
    causes: { "7": ["wolf_kill", "poison"], "8": ["unrecognized_cause"] },
  };
  const content = sceneContent(current);
  expect(content.blocks).toEqual([
    {
      kind: "life",
      playerIds: [7, 8],
      causes: { "7": ["wolf_kill", "poison"], "8": ["unrecognized_cause"] },
    },
  ]);
  const html = renderToStaticMarkup(
    <SceneContentBlocks content={content} locale="zh-CN" colors={colors} />,
  );
  expect(html.match(/data-life-player=/g)).toHaveLength(2);
  expect(html).toContain("狼刀 / 毒药");
  expect(html).toContain("未知");
  expect(html).toContain("color:#ee3344");
  expect(html).not.toContain("无目标");
  expect(html).not.toContain('data-content-block="action"');
  current.visual!.life.committed = false;
  expect(sceneContent(current).blocks.map((block) => block.kind)).toEqual(["record"]);
});

test("range and inspection reports do not invent an empty target or duplicate an action, but keep actor/report/recipient", () => {
  const current = scene();
  current.visual = {
    ...current.visual!,
    actorId: 2,
    process: "reported",
    report: { kind: "range", signal: "quiet", scope: "adjacent_alive" },
  };
  let content = sceneContent(current);
  expect(content.blocks.map((block) => block.kind)).toEqual(["report"]);
  let html = renderToStaticMarkup(<SceneContentBlocks content={content} locale="zh-CN" />);
  expect(html).toContain('data-content-player="2"');
  expect(html).not.toContain("无目标");
  current.visual = {
    ...current.visual,
    report: { kind: "camp", camp: "wolf" },
    requestedTargetIds: [3],
    recipientIds: [2],
  };
  content = sceneContent(current);
  expect(content.blocks.map((block) => block.kind)).toEqual(["report"]);
  html = renderToStaticMarkup(<SceneContentBlocks content={content} locale="en" colors={colors} />);
  expect(html).toContain('data-content-player="3"');
  expect(html).toContain("Recipient");
  expect(html).toContain("Werewolves");
  expect(html).toContain("color:#bb2233");
});

test("an explicit empty effective target remains distinct from an unavailable requested target", () => {
  const current = scene();
  current.visual = {
    ...current.visual!,
    process: "choice",
    actorId: 2,
    requestedTargetIds: [3],
    effectiveTargetKnown: true,
  };
  const html = renderToStaticMarkup(
    <SceneContentBlocks content={sceneContent(current)} locale="en" />,
  );
  expect(html).toContain('data-content-player="3"');
  expect(html).toContain("data-effective-targets");
  expect(html).toContain("no target");
  current.visual = {
    ...current.visual,
    process: "used",
    requestedTargetIds: [],
    effectiveTargetKnown: false,
  };
  const unknown = renderToStaticMarkup(
    <SceneContentBlocks content={sceneContent(current)} locale="en" />,
  );
  expect(unknown).not.toContain("data-effective-targets");
  expect(unknown).not.toContain("no target");
});

test("announcement DOM reveals the entire grid only at impact and preserves literal authored text", () => {
  const current = scene();
  current.content = sceneContent(current, initial());
  const theme = resolveTheme({ id: "minimal-v1" });
  const props = {
    scene: current,
    caption: {
      text: current.body,
      offset: 0,
      pageIndex: 0,
      pages: [current.body],
      scheduled: false,
      reading: { progress: 0, scrollProgress: 0, active: true },
    },
    metrics: {
      scale: 1,
      stage: { x: 0, y: 0, width: 1100, height: 837 },
      readingWidth: 1040,
      bodySize: 32,
      lineHeight: 1.45,
      padding: 28,
    },
    appearance: {
      theme,
      palette: themePalette(theme, "day"),
      cards: themePalette(theme, "day"),
      surface: themeSurface(theme, "day"),
      gothic: false,
      night: false,
    },
    locale: "en" as const,
    layout: "notice" as const,
  };
  expect(renderToStaticMarkup(<AnnouncementScene {...props} localFrame={23} />)).not.toContain(
    "data-lineup-player",
  );
  const after = renderToStaticMarkup(<AnnouncementScene {...props} localFrame={24} />);
  expect(after.match(/data-lineup-player=/g)).toHaveLength(12);
  expect(after).not.toContain(current.body);
  const authored = renderToStaticMarkup(
    <AnnouncementScene {...props} scene={{ ...current, bodySource: "script" }} localFrame={24} />,
  );
  expect(authored.replace(/<[^>]*>/g, "")).toContain(current.body);
  expect(authored).not.toContain("data-lineup-player");
  const emphasized = renderToStaticMarkup(
    <AnnouncementScene
      {...props}
      scene={{ ...current, emphasis: [{ start: 0, end: 8, text: "Original" }] }}
      localFrame={24}
    />,
  );
  expect(emphasized).toContain("<mark");
  expect(emphasized.replace(/<[^>]*>/g, "")).toContain(current.body);
  expect(emphasized).not.toContain("data-lineup-player");
  const legacy = renderToStaticMarkup(
    <AnnouncementScene
      {...props}
      caption={{ ...props.caption, reading: undefined }}
      localFrame={24}
    />,
  );
  expect(legacy).toContain(current.body);
  expect(legacy).not.toContain("data-lineup-player");
});
