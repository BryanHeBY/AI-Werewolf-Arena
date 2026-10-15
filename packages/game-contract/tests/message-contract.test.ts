/**
 * 包级单元／类型契约测试验证不绑定语言的消息标识。
 * 独立预期为迁移前 Git 2d36e4d 冻结的 1513 键顺序摘要与端点键；输入包括未知键和可序列化消息引用。
 * DTO 不按每个键约束参数，运行参数格式归 game-text；本文件不加载词典、展示器、World 或模型。
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  MESSAGE_IDS,
  isMessageKey,
  type MessageKey,
  type MessageRef,
} from "@ai-werewolf-arena/game-contract";

const fixedSequenceHash = "cd750ba72a9b5902562d650125797b2417126bdb82b2aaa199822b05cd22ec78";

test("the 1513 message IDs retain the exact fixed-commit sequence", () => {
  expect(MESSAGE_IDS).toHaveLength(1513);
  expect(new Set(MESSAGE_IDS).size).toBe(1513);
  expect(createHash("sha256").update(JSON.stringify(MESSAGE_IDS)).digest("hex")).toBe(
    fixedSequenceHash,
  );
  expect(MESSAGE_IDS[0]).toBe("replay.stage.animal_night_opened");
  expect(MESSAGE_IDS.at(-1)).toBe("prompt.config.badge_choice");
});

test("the canonical registry is frozen and key validation grants no inherited object names", () => {
  expect(Object.isFrozen(MESSAGE_IDS)).toBe(true);
  for (const value of [
    null,
    undefined,
    1,
    {},
    [],
    Symbol("message"),
    "",
    "constructor",
    "__proto__",
    "hasOwnProperty",
    "does.not.exist",
  ])
    expect(isMessageKey(value)).toBe(false);
  expect(isMessageKey("replay.stage.animal_night_opened")).toBe(true);
  expect(isMessageKey("prompt.config.badge_choice")).toBe(true);
  expect(isMessageKey("role.witch.state")).toBe(true);
  expect(isMessageKey("request.summary.exile_vote")).toBe(true);
  expect(isMessageKey("request.retry.exile_vote")).toBe(true);
});

test("unknown key guards do not inspect object properties or execute a Proxy", () => {
  let traps = 0;
  const value = new Proxy(
    {},
    {
      get() {
        traps++;
        return "common.player";
      },
      getPrototypeOf() {
        traps++;
        return Object.prototype;
      },
    },
  );
  expect(isMessageKey(value)).toBe(false);
  expect(traps).toBe(0);
});

test("closed key typing and optional readonly parameter shape preserve existing interfaces", () => {
  const key: MessageKey = "common.player";
  const omitted: MessageRef = { key: "common.none" };
  const numeric: MessageRef = { key, parameters: { id: 12 } };
  const raw = "苏茶茶\nExact custom text {role}";
  const original: MessageRef = { key: "role.generic.state", parameters: { role: raw } };
  // 此 DTO 原本不提供逐键参数泛型或格式政策。
  const missingParameters: MessageRef = { key: "role.witch.state" };
  const extraParameters: MessageRef = { key: "common.none", parameters: { extra: "literal" } };
  const nonfinite: MessageRef = { key, parameters: { id: NaN } };
  // @ts-expect-error Unknown machine keys cannot become a MessageKey.
  const unknownKey: MessageKey = "does.not.exist";
  // @ts-expect-error References also retain the closed machine key set.
  const unknownReference: MessageRef = { key: "does.not.exist" };
  // @ts-expect-error Parameters retain the original string/number value contract.
  const booleanParameter: MessageRef = { key, parameters: { id: true } };
  if (false) {
    // @ts-expect-error Existing readonly parameter maps cannot be mutated through a reference.
    numeric.parameters!.id = 13;
  }
  void [unknownKey, unknownReference, booleanParameter, nonfinite];
  expect(omitted).toEqual({ key: "common.none" });
  expect(numeric.parameters).toEqual({ id: 12 });
  expect(JSON.parse(JSON.stringify(original))).toEqual(original);
  expect(original.parameters!.role).toBe(raw);
  expect(missingParameters).toEqual({ key: "role.witch.state" });
  expect(extraParameters.parameters).toEqual({ extra: "literal" });
});
