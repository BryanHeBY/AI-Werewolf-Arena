/**
 * 单元测试以双语原生／复制枪源为输入，用精确中立字幕和 replay 阶段核对文字不声称无证据的 Hunter 身份。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "../../../src/domain";
import { getDefaultScriptEventRenderRegistry } from "../../../src/engine/game-api";

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
