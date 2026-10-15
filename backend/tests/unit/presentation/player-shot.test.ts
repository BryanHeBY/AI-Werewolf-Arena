/**
 * Unit tests: Gun presentation uses native and copied origins in both locales; exact
 * neutral captions and replay stages check that text never asserts an unsupported Hunter
 * identity. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "../../../src/domain";
import { getDefaultScriptEventRenderRegistry } from "../../../src/game";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: neutral gun text and replay stage do not assert a native Hunter role`, () => {
    const event: GameEvent = {
      timestamp: 1,
      type: "player_shot",
      payload: { actorId: 7, targetId: 2 },
    };
    const registry = getDefaultScriptEventRenderRegistry(),
      label = locale === "en" ? "Player 7 shoots player 2" : "7号开枪带走2号";
    expect(registry.toJudgeLine(event, locale)).toBe(label);
    expect(registry.toLiveRender(event, false, locale)).toEqual([{ kind: "action", text: label }]);
    expect(registry.toLiveRender(event, true, locale)).toEqual([{ kind: "action", text: label }]);
    expect(registry.toReplayStage(event)).toBe("death_shot");
    expect(registry.toChatLine(event, locale)).toBeNull();
  });
