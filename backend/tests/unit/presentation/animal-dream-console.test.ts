/**
 * 用固定动物梦境事实验证双语终端行为文案和私有输出开关，并独立核对逐玩家事件仍不包含 God 效果。
 * 预期使用字面动作、角色和编号，不依赖模型、真实对局或回放 JSON 文案生成器。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type {
  AnimalDreamEventType,
  AnimalDreamPayloadMap,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { animalDreamLiveLabel } from "../../../src/features/animal-dream/event-presenters";
import { appendAnimalFact } from "../../../src/features/animal-dream/facts";
import { buildAgentVisibleEventFeed } from "../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../src/agents/presentation/event-render-registry";
import { presentStreamEvents } from "../../../src/adapters/console/console-presenter";
import { animalRosterFixture } from "../../support/features/animal-dream/builders/roster";

const policy = "awa_animal_dream_v1" as const;
const cases = [
  {
    type: "animal_fox_chosen",
    payload: { policy, actorId: 10, day: 2, targetId: 1 },
    zh: "10号子狐第2夜迷惑目标：1",
    en: "Fox Cub 10, night 2 distraction target: 1",
    kind: "private",
  },
  {
    type: "animal_fox_chosen",
    payload: { policy, actorId: 10, day: 2, targetId: null },
    zh: "10号子狐第2夜迷惑目标：无",
    en: "Fox Cub 10, night 2 distraction target: None",
    kind: "private",
  },
  {
    type: "animal_fox_effect",
    payload: { policy, actorId: 10, day: 2, targetId: 1, knifeBlocked: true, beautyBlocked: false },
    zh: "第2夜：10号子狐迷惑1号，整队狼刀已封锁，狼美人魅惑未封锁",
    en: "Night 2: Fox Cub 10 distracts player 1; pack knife blocked; Wolf Beauty charm not blocked",
    kind: "god",
  },
  {
    type: "animal_fox_effect",
    payload: { policy, actorId: 10, day: 2, targetId: 1, knifeBlocked: false, beautyBlocked: true },
    zh: "第2夜：10号子狐迷惑1号，整队狼刀未封锁，狼美人魅惑已封锁",
    en: "Night 2: Fox Cub 10 distracts player 1; pack knife not blocked; Wolf Beauty charm blocked",
    kind: "god",
  },
  {
    type: "animal_knife_notified",
    payload: { policy, actorId: 1, day: 2, eligible: true },
    zh: "1号第2夜拥有狼刀资格",
    en: "Player 1 is eligible for the knife on night 2",
    kind: "private",
  },
  {
    type: "animal_knife_notified",
    payload: { policy, actorId: 1, day: 2, eligible: false },
    zh: "1号第2夜无狼刀资格，本夜跳过狼刀投票",
    en: "Player 1 is ineligible for the knife on night 2; skip tonight's knife vote",
    kind: "private",
  },
  {
    type: "animal_beauty_notified",
    payload: {
      policy,
      actorId: 1,
      day: 2,
      charmAllowed: true,
      linkAllowed: false,
      targetId: 6,
      lastActedDay: 1,
      history: [{ day: 1, targetId: 6 }],
    },
    zh: "1号狼美人第2轮：魅惑可用，牵连不可用，当前魅惑目标：6",
    en: "Wolf Beauty 1, cycle 2: charm available; death link unavailable; current charm target: 6",
    kind: "private",
  },
  {
    type: "animal_beauty_notified",
    payload: {
      policy,
      actorId: 1,
      day: 2,
      charmAllowed: false,
      linkAllowed: true,
      targetId: null,
      lastActedDay: null,
      history: [],
    },
    zh: "1号狼美人第2轮：魅惑不可用，牵连可用，当前魅惑目标：无",
    en: "Wolf Beauty 1, cycle 2: charm unavailable; death link available; current charm target: None",
    kind: "private",
  },
  {
    type: "animal_puffer_decided",
    payload: { policy, actorId: 12, day: 2, activate: true },
    zh: "12号河豚第2轮选择发动反击",
    en: "Pufferfish 12, cycle 2: activate retaliation",
    kind: "private",
  },
  {
    type: "animal_puffer_decided",
    payload: { policy, actorId: 12, day: 2, activate: false },
    zh: "12号河豚第2轮选择保留技能",
    en: "Pufferfish 12, cycle 2: preserve the ability",
    kind: "private",
  },
  {
    type: "animal_puffer_targets",
    payload: { policy, actorId: 12, day: 2, targetIds: [1, 3, 5], round: 2 },
    zh: "12号河豚第2轮反击目标（第2轮票）：1, 3, 5",
    en: "Pufferfish 12, cycle 2 retaliation targets (ballot round 2): 1, 3, 5",
    kind: "god",
  },
] as const;

/** 用生产事实发表入口附上原受众，不由测试或展示函数另造权限。 */
function facts() {
  const { world } = animalRosterFixture(),
    events: GameEvent[] = [];
  for (const row of cases)
    appendAnimalFact(
      world,
      events,
      row.type,
      row.payload as AnimalDreamPayloadMap[typeof row.type],
    );
  return { world, events };
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: animal terminal labels describe choices, effects and permissions without raw JSON`, () => {
    const registry = getDefaultScriptEventRenderRegistry(),
      { events } = facts();
    for (const [index, event] of events.entries()) {
      const row = cases[index]!,
        label = animalDreamLiveLabel(event.type, event.payload, locale);
      expect(label).not.toBeNull();
      if (label === null) throw new Error("animal_console_label_missing");
      expect(label).toBe(locale === "zh-CN" ? row.zh : row.en);
      if (locale === "en") expect(label).not.toMatch(/[\u4e00-\u9fff]/);
      expect(label).not.toMatch(/[{}]|"(?:actorId|targetId|eligible|knifeBlocked)"/);
      expect(registry.toLiveRender(event, true, locale)).toEqual([{ kind: row.kind, text: label }]);
      expect(registry.toLiveRender(event, false, locale)).toEqual([]);
    }
    const lines: string[] = [];
    presentStreamEvents(events, false, (line) => lines.push(line), locale);
    expect(lines).toEqual([]);
  });

test("own knife notices reveal neither the Fox identity nor the actual blocking cause", () => {
  for (const locale of ["zh-CN", "en"] as const)
    for (const eligible of [false, true]) {
      const label = animalDreamLiveLabel(
        "animal_knife_notified",
        { policy, day: 2, actorId: 1, eligible },
        locale,
      );
      expect(label).not.toMatch(/子狐|迷惑|Fox|distract|targetId|knifeBlocked/);
    }
});

test("terminal-only animal helper rejects malformed facts and leaves other event labels to the original renderer", () => {
  for (const row of cases) {
    expect(animalDreamLiveLabel(row.type, null, "zh-CN")).toBeNull();
    expect(animalDreamLiveLabel(row.type, { ...row.payload, day: 0 }, "en")).toBeNull();
    expect(animalDreamLiveLabel(row.type, { ...row.payload, extra: true }, "en")).toBeNull();
  }
  for (const [type, payload] of [
    ["animal_night_opened", { policy, day: 2 }],
    ["animal_cat_revealed", { policy, day: 2, actorId: 9 }],
    ["animal_puffer_revealed", { policy, day: 2, actorId: 12, reason: "retaliation" }],
    ["unknown_event", {}],
  ] as const)
    expect(animalDreamLiveLabel(type, payload, "zh-CN")).toBeNull();
});

test("readable terminal effects do not widen Fox feedback, wolf notices or other player feeds", () => {
  const { world } = animalRosterFixture(),
    events: GameEvent[] = [];
  const append = <K extends AnimalDreamEventType>(type: K, payload: AnimalDreamPayloadMap[K]) =>
    appendAnimalFact(world, events, type, payload);
  append("animal_fox_chosen", { policy, actorId: 10, day: 2, targetId: 1 });
  append("animal_fox_effect", {
    policy,
    actorId: 10,
    day: 2,
    targetId: 1,
    knifeBlocked: true,
    beautyBlocked: true,
  });
  for (const actorId of [1, 2, 3, 4])
    append("animal_knife_notified", { policy, actorId, day: 2, eligible: false });
  append("animal_cat_revealed", { policy, actorId: 9, day: 2 });
  events.push({ timestamp: 1, type: "bear_roared", payload: { day: 2, roared: true } });
  const original = structuredClone(events);
  for (const locale of ["zh-CN", "en"] as const)
    presentStreamEvents(events, true, () => {}, locale);
  expect(events).toEqual(original);
  for (const actor of world.entityIds()) {
    const feed = buildAgentVisibleEventFeed(world, events, actor),
      privateRows = feed.filter(
        (event) => !["animal_cat_revealed", "bear_roared"].includes(event.type),
      );
    expect(feed.some((event) => event.type === "animal_fox_effect")).toBe(false);
    if (actor === 10)
      expect(privateRows).toEqual([
        {
          seq: 1,
          type: "animal_fox_chosen",
          payload: { policy, actorId: 10, day: 2, targetId: 1 },
        },
      ]);
    else if ([1, 2, 3, 4].includes(actor))
      expect(privateRows).toEqual([
        {
          seq: 1,
          type: "animal_knife_notified",
          payload: { policy, actorId: actor, day: 2, eligible: false },
        },
      ]);
    else expect(privateRows).toEqual([]);
    expect(feed.slice(-2).map((event) => event.payload)).toEqual([
      { policy, actorId: 9, day: 2 },
      { day: 2, roared: true },
    ]);
  }
});
