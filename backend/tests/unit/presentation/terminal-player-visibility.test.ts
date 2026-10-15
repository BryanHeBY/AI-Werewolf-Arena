/**
 * 验证同一组动物梦境事实在终端观察与玩家事件流之间保持不同的信息边界。
 * 输入为手写受众、子狐选择、God 命中效果、狼人刀权及匿名熊公告；预期逐字段独立给出。
 * 不运行模型或对局，也不把终端可见内容当作玩家知识；隐藏事实不得留下玩家序号缺口。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { buildAgentVisibleEventFeed } from "../../../src/agents/observation/event-feed";
import { presentStreamEvents } from "../../../src/adapters/console/console-presenter";

function facts(): GameEvent[] {
  return [
    {
      timestamp: 1,
      type: "animal_fox_chosen",
      audience: [2],
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 2, targetId: 4 },
    },
    {
      timestamp: 2,
      type: "animal_fox_effect",
      audience: [],
      payload: {
        policy: "awa_animal_dream_v1",
        day: 2,
        actorId: 2,
        targetId: 4,
        knifeBlocked: true,
        beautyBlocked: true,
      },
    },
    {
      timestamp: 3,
      type: "animal_knife_notified",
      audience: [4],
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 4, eligible: false },
    },
    { timestamp: 4, type: "bear_roared", payload: { day: 2, roared: true } },
  ];
}

test("子狐、狼人和村民只收到已授权事实，God 命中效果不占玩家序号", () => {
  // 历史受众已在发表时固定；无当前角色组件的 World 不能据现阵营补发秘密。
  const world = new World(),
    events = facts();
  expect(buildAgentVisibleEventFeed(world, events, 2)).toEqual([
    {
      seq: 1,
      type: "animal_fox_chosen",
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 2, targetId: 4 },
    },
    { seq: 2, type: "bear_roared", payload: { day: 2, roared: true } },
  ]);
  expect(buildAgentVisibleEventFeed(world, events, 4)).toEqual([
    {
      seq: 1,
      type: "animal_knife_notified",
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 4, eligible: false },
    },
    { seq: 2, type: "bear_roared", payload: { day: 2, roared: true } },
  ]);
  expect(buildAgentVisibleEventFeed(world, events, 7)).toEqual([
    { seq: 1, type: "bear_roared", payload: { day: 2, roared: true } },
  ]);
  for (let actorId = 1; actorId <= 12; actorId++) {
    const feed = buildAgentVisibleEventFeed(world, events, actorId);
    expect(feed.some((event) => event.type === "animal_fox_effect")).toBe(false);
    expect(feed.map((event) => event.seq)).toEqual(feed.map((_, index) => index + 1));
  }
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}：私有终端可解释封刀，关闭私有输出后只显示匿名熊公告`, () => {
    const events = facts(),
      original = structuredClone(events),
      world = new World(),
      before = [2, 4, 7].map((actorId) => buildAgentVisibleEventFeed(world, events, actorId)),
      privateLines: string[] = [],
      publicLines: string[] = [];
    presentStreamEvents(events, true, (line) => privateLines.push(line), locale);
    presentStreamEvents(events, false, (line) => publicLines.push(line), locale);
    expect(privateLines).toEqual(
      locale === "zh-CN"
        ? [
            "[live][私有] 2号子狐第2夜迷惑目标：4",
            "[live][上帝私有] 第2夜：2号子狐迷惑4号，整队狼刀已封锁，狼美人魅惑已封锁",
            "[live][私有] 4号第2夜无狼刀资格，本夜跳过狼刀投票",
            "[live][上帝] 第2天：熊咆哮了",
          ]
        : [
            "[live][Private] Fox Cub 2, night 2 distraction target: 4",
            "[live][God private] Night 2: Fox Cub 2 distracts player 4; pack knife blocked; Wolf Beauty charm blocked",
            "[live][Private] Player 4 is ineligible for the knife on night 2; skip tonight's knife vote",
            "[live][God] Day 2: Bear roared",
          ],
    );
    expect(publicLines).toEqual([
      locale === "zh-CN" ? "[live][上帝] 第2天：熊咆哮了" : "[live][God] Day 2: Bear roared",
    ]);
    // 输出完整 God 原因不会追加玩家事实，也不会篡改下一轮可见信息。
    expect(events).toEqual(original);
    expect([2, 4, 7].map((actorId) => buildAgentVisibleEventFeed(world, events, actorId))).toEqual(
      before,
    );
  });
