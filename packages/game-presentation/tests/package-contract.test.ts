/**
 * 包级单元测试验证公开展示出口的两语结果与原文边界。
 * 输入是字面量查验、无胜者结果和惰性事件 payload；手写输出作为独立预期。
 * 不启动 World、React、应用 preload、模型或完整对局，不用生产输出生成预期。
 */
import { expect, test } from "bun:test";
import {
  inspectionLabel,
  outcomeLabel,
  debateEventLabel,
  hybridEventLabel,
} from "@ai-werewolf-arena/game-presentation";

test("language interleaving renders literal inspection and outcome labels without shared state", () => {
  expect(inspectionLabel({ kind: "camp", camp: "wolf" }, "zh-CN")).toBe("狼人");
  expect(inspectionLabel({ kind: "camp", camp: "wolf" }, "en")).toBe("Werewolves");
  expect(inspectionLabel({ kind: "camp", camp: "wolf" }, "zh-CN")).toBe("狼人");
  expect(outcomeLabel({ kind: "no_winner" }, "en")).toBe("No winner");
  expect(outcomeLabel({ kind: "no_winner" }, "zh-CN")).toBe("无胜者");
});

test("raw user speech remains intact within both language templates", () => {
  const raw = "苏茶茶\nExact custom text {role}";
  const payload = { actorId: 7, text: raw };
  expect(debateEventLabel("debate_speech", payload, "zh-CN")).toBe(`开杠发言（7号）：${raw}`);
  expect(debateEventLabel("debate_speech", payload, "en")).toBe(
    `Debate statement (player 7): ${raw}`,
  );
  expect(payload).toEqual({ actorId: 7, text: raw });
});

test("an unsupported event leaves its payload unread while malformed known facts keep the unknown label", () => {
  let reads = 0;
  const payload = new Proxy(
    {},
    {
      get() {
        reads++;
        throw Error("payload_must_not_be_read");
      },
      getOwnPropertyDescriptor() {
        reads++;
        throw Error("payload_must_not_be_read");
      },
      ownKeys() {
        reads++;
        throw Error("payload_must_not_be_read");
      },
    },
  );
  expect(hybridEventLabel("unregistered_event", payload, "en")).toBeNull();
  expect(reads).toBe(0);
  expect(debateEventLabel("debate_speech", { actorId: -1, text: "raw" }, "en")).toBe("Unknown");
});
