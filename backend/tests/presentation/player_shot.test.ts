import { expect, test } from "bun:test";
import type { GameEvent } from "../../src/core";
import { getDefaultScriptEventRenderRegistry } from "../../src/game";

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: neutral gun text and replay stage do not assert a native Hunter role`, () => {
  const event: GameEvent = { timestamp: 1, type: "player_shot", payload: { actorId: 7, targetId: 2 } };
  const registry = getDefaultScriptEventRenderRegistry(), label = locale === "en" ? "Player 7 shoots player 2" : "7号开枪带走2号";
  expect(registry.toJudgeLine(event, locale)).toBe(label);
  expect(registry.toLiveRender(event, false, locale)).toEqual([{ kind: "action", text: label }]);
  expect(registry.toLiveRender(event, true, locale)).toEqual([{ kind: "action", text: label }]);
  expect(registry.toReplayStage(event)).toBe("death_shot");
  expect(registry.toChatLine(event, locale)).toBeNull();
});
