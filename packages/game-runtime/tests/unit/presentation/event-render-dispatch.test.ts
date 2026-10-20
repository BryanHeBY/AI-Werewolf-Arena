/**
 * 单元测试负责有序事件展示的读取、短路与失败边界。输入为独立label贡献、手写事件和同一Error，输出字面调用顺序及分类行。
 * 预期不由生产分派生成；只验证原引用读取、孤女truthy例外、私有短路和null/空数组回退，不执行游戏规则。
 */
import { expect, test } from "bun:test";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { PlayerText } from "@ai-werewolf-arena/game-presentation";
import type { GameEvent } from "../../../src/domain/model";
import { ScriptEventRenderRegistry } from "../../../src/agents/presentation/event-render-registry";
import {
  firstJudgeLabel,
  firstLiveRender,
  labelLiveContribution,
  privateLabelRows,
} from "../../../src/agents/presentation/event-render-dispatch";

function observedEvent(reads: string[]): GameEvent {
  return {
    timestamp: 1,
    get type() {
      reads.push("type");
      return "day_speech";
    },
    get payload() {
      reads.push("payload");
      return { actorId: 1, text: "Original words" };
    },
  } as GameEvent;
}

test("judge traversal rereads the original type/payload in order and only the explicit truthy entry skips an empty string", () => {
  const reads: string[] = [];
  const event = observedEvent(reads);
  const result = firstJudgeLabel(
    [
      {
        label: () => {
          reads.push("first");
          return null;
        },
      },
      {
        label: () => {
          reads.push("lonely");
          return "";
        },
        truthy: true,
      },
      {
        label: () => {
          reads.push("last");
          return "END";
        },
      },
    ],
    event,
    "en",
    text,
  );
  expect(result).toBe("END");
  expect(reads).toEqual([
    "type",
    "payload",
    "first",
    "type",
    "payload",
    "lonely",
    "type",
    "payload",
    "last",
  ]);
  reads.length = 0;
  expect(
    firstJudgeLabel(
      [
        { label: () => "" },
        {
          label: () => {
            throw new Error("must not be reached");
          },
        },
      ],
      event,
      "en",
      text,
    ),
  ).toBe("");
  expect(reads).toEqual(["type", "payload"]);
});

test("hidden live labels still evaluate the label first and an empty result array terminates traversal", () => {
  const reads: string[] = [];
  const event = observedEvent(reads);
  const result = firstLiveRender(
    [
      labelLiveContribution(() => {
        reads.push("label");
        return "PRIVATE";
      }, privateLabelRows("private")),
      () => {
        throw new Error("must not fall through a hidden event");
      },
    ],
    event,
    false,
    "en",
    text,
  );
  expect(result).toEqual([]);
  expect(reads).toEqual(["type", "payload", "label"]);
  expect(
    firstLiveRender(
      [() => null, () => [{ kind: "system", text: "PUBLIC" }]],
      event,
      false,
      "en",
      text,
    ),
  ).toEqual([{ kind: "system", text: "PUBLIC" }]);
});

test("a label failure preserves the same error and the already observed prefix", () => {
  const reads: string[] = [];
  const error = new Error("label failed");
  let caught: unknown;
  try {
    firstLiveRender(
      [
        labelLiveContribution(() => {
          reads.push("label");
          throw error;
        }, privateLabelRows("god")),
        () => {
          reads.push("late");
          return [];
        },
      ],
      observedEvent(reads),
      false,
      "en",
      text,
    );
  } catch (failure) {
    caught = failure;
  }
  expect(caught).toBe(error);
  expect(reads).toEqual(["type", "payload", "label"]);
});

test("ordered label calls keep the direct function receiver rather than binding the contribution object", () => {
  let receiver: unknown = "not called";
  const label = function (this: unknown) {
    receiver = this;
    return "DIRECT";
  };
  expect(firstJudgeLabel([{ label }], observedEvent([]), "en", text)).toBe("DIRECT");
  expect(receiver).toBeUndefined();
});

test("the native guard handler does not read a secret target while private rendering is disabled", () => {
  const error = new Error("secret target read");
  let reads = 0;
  const event = {
    type: "guard_applied",
    timestamp: 1,
    payload: {
      actorId: 1,
      abstain: false,
      get targetId() {
        reads++;
        throw error;
      },
    },
  } as unknown as GameEvent;
  const registry = new ScriptEventRenderRegistry();
  expect(registry.toLiveRender(event, false, "en")).toEqual([]);
  expect(reads).toBe(0);
  let caught: unknown;
  try {
    registry.toLiveRender(event, true, "en");
  } catch (failure) {
    caught = failure;
  }
  expect(caught).toBe(error);
  expect(reads).toBe(1);
});

test("the registry retains dynamic judge fallback but a native empty array suppresses it", () => {
  let calls = 0;
  class CustomRegistry extends ScriptEventRenderRegistry {
    override toJudgeLine(_event: GameEvent, _locale?: Locale, _text?: PlayerText) {
      calls++;
      return "OVERRIDE";
    }
  }
  const registry = new CustomRegistry();
  const customText = ((_locale, key, parameters) =>
    `${key}:${parameters?.line ?? ""}`) as PlayerText;
  expect(
    registry.toLiveRender(
      { type: "future_event", timestamp: 1, payload: {} } as unknown as GameEvent,
      false,
      "en",
      customText,
    ),
  ).toEqual([{ kind: "god", text: "console.live.god:OVERRIDE" }]);
  expect(calls).toBe(1);
  expect(
    registry.toLiveRender(
      { type: "sheriff_elected", timestamp: 1, payload: { winnerId: 2 } } as GameEvent,
      false,
      "en",
      customText,
    ),
  ).toEqual([]);
  expect(calls).toBe(1);
});
