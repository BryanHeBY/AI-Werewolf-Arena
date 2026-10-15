/**
 * 包级单元／类型契约测试验证不绑定语言的消息标识。
 * 独立预期为原有 1513 键顺序摘要及明确追加的终端标签、动物行动和共享事件细节文案；输入包括未知键和可序列化消息引用。
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

test("existing message IDs retain their exact sequence and presentation messages are appended", () => {
  expect(MESSAGE_IDS).toHaveLength(1610);
  expect(new Set(MESSAGE_IDS).size).toBe(1610);
  expect(
    createHash("sha256")
      .update(JSON.stringify(MESSAGE_IDS.slice(0, 1513)))
      .digest("hex"),
  ).toBe(fixedSequenceHash);
  expect(MESSAGE_IDS[0]).toBe("replay.stage.animal_night_opened");
  expect(MESSAGE_IDS[1512]).toBe("prompt.config.badge_choice");
  expect(MESSAGE_IDS.slice(1513)).toEqual([
    "console.live.chat",
    "console.live.action",
    "console.live.private",
    "console.live.god_private",
    "console.animal.fox_choice",
    "console.animal.fox_effect",
    "console.animal.knife_available",
    "console.animal.knife_blocked",
    "console.animal.beauty",
    "console.animal.puffer_decision",
    "console.animal.puffer_targets",
    "console.animal.blocked",
    "console.animal.not_blocked",
    "console.animal.available",
    "console.animal.unavailable",
    "console.animal.activate",
    "console.animal.pass",
    "animal.unit.exile",
    "animal.unit.skipped_day",
    "death.wolf_kill",
    "death.poison",
    "death.exile",
    "death.self_destruct",
    "death.shot",
    "death.charm",
    "death.puffer_retaliation",
    "death.white_cat_expiry",
    "death.servant_expiry",
    "death.fragrant_link",
    "event.death_detail",
    "event.night_choice",
    "common.used",
    "common.unused",
    "noble.contract.summary",
    "noble.contract.pending",
    "noble.contract.cleared",
    "noble.contract.expired",
    "noble.contract.target_dead",
    "noble.contract.closed_on",
    "secret_body.resource.intact",
    "secret_body.resource.spent",
    "secret_body.resource.exile_revealed",
    "fragrant.knife_notice",
    "console.wall.note",
    "console.wall.author",
    "role.crow.brief",
    "role.crow.state",
    "action.curse_exile.hint",
    "action.curse_exile.directive",
    "event.crow_curse_chosen",
    "event.crow_curse_applied",
    "crow.ballot.first",
    "crow.ballot.all",
    "crow.action.optional",
    "crow.action.required",
    "crow.self.allowed",
    "crow.self.forbidden",
    "crow.pass",
    "replay.stage.crow_curse_chosen",
    "replay.stage.crow_curse_applied",
    "stage.crow_curse",
    "prompt.config.crow",
    "role.silence_elder.brief",
    "role.silence_elder.state",
    "silence.choice",
    "silence.round.day",
    "silence.round.pk",
    "action.silence.hint",
    "action.silence.directive",
    "action.gesture.hint",
    "action.gesture.directive",
    "action.translate_silence.hint",
    "action.translate_silence.directive",
    "request.summary.silence_elder",
    "request.summary.silence_gesture",
    "request.summary.silence_translation",
    "stage.silence_elder",
    "stage.silence_gesture",
    "stage.silence_translation",
    "prompt.config.silence_elder",
    "prompt.stage.silence_candidates",
    "prompt.stage.silence_gesture",
    "prompt.stage.silence_translation",
    "event.silence_chosen",
    "event.silence_announced",
    "event.silence_gesture",
    "event.silence_translated",
    "event.silence_translation_declined",
    "event.silence_expired",
    "replay.stage.silence_chosen",
    "replay.stage.silence_announced",
    "replay.stage.silence_gesture",
    "replay.stage.silence_translated",
    "replay.stage.silence_translation_declined",
    "replay.stage.silence_expired",
    "bot.silence.gesture",
    "bot.silence.translation",
  ]);
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
  // @ts-expect-error 未登记的机器键不能成为 MessageKey。
  const unknownKey: MessageKey = "does.not.exist";
  // @ts-expect-error 消息引用同样受闭合机器键集合约束。
  const unknownReference: MessageRef = { key: "does.not.exist" };
  // @ts-expect-error 参数保留原字符串／数字值契约。
  const booleanParameter: MessageRef = { key, parameters: { id: true } };
  if (false) {
    // @ts-expect-error 不得通过引用修改只读参数表。
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
