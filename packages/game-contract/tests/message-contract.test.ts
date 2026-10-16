/**
 * 包级单元／类型契约测试验证不绑定语言的消息标识。
 * 独立预期为本轮之前的 1806 键顺序摘要、既有稳定锚点与本轮追加的提示与复盘交互文案；输入包括未知键和可序列化消息引用。
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

const previousSequenceLength = 1806;
const previousSequenceHash = "189bedfe84b12243ded7cd21806f2423f49dafe1975a07c2683dbc52d65cc898";
const appendedPromptKeys = [
  "prompt.system.speaking_style",
  "prompt.user.speech_public",
  "prompt.user.speech_wolves",
  "prompt.user.speech_partner",
  "prompt.user.speech_brew",
  "prompt.retry.optional",
  "prompt.stage.sheriff_vote_pk_first",
  "prompt.stage.sheriff_vote_pk_second",
  "prompt.known_public_facts",
  "rules.ordinary_night_protection",
  "rules.lovers.netease",
  "rules.lovers.lui",
] as const;

const appendedReplayKeys = [
  "replay.open_file",
  "replay.switch_file",
  "replay.retry",
  "replay.current_event_text",
  "replay.playback_rate",
  "replay.search_events",
  "replay.jump_chapter",
  "replay.choose_chapter",
  "replay.following",
  "replay.resume_follow",
  "replay.visible_events",
  "replay.no_matching_events",
  "replay.video_preview",
  "replay.video_back",
  "replay.video_unavailable",
] as const;

test("existing message IDs retain their sequence and prompt additions append after established anchors", () => {
  expect(new Set(MESSAGE_IDS).size).toBe(MESSAGE_IDS.length);
  expect(
    createHash("sha256")
      .update(JSON.stringify(MESSAGE_IDS.slice(0, previousSequenceLength)))
      .digest("hex"),
  ).toBe(previousSequenceHash);
  // 锚点来自本轮变更前的公开注册表，避免旧角色扩展后仍使用失效总数与索引。
  expect(MESSAGE_IDS[0]).toBe("replay.stage.animal_night_opened");
  expect(MESSAGE_IDS[1517]).toBe("prompt.config.badge_choice");
  expect(MESSAGE_IDS[1518]).toBe("console.live.chat");
  expect(MESSAGE_IDS[1563]).toBe("role.crow.brief");
  expect(MESSAGE_IDS[1616]).toBe("role.warden.state");
  expect(MESSAGE_IDS[1796]).toBe("replay.agent_output");
  expect(MESSAGE_IDS[1804]).toBe("prompt.system.players");
  expect(MESSAGE_IDS[1805]).toBe("common.player_reference");
  expect(MESSAGE_IDS.slice(previousSequenceLength)).toEqual([
    ...appendedPromptKeys,
    ...appendedReplayKeys,
  ]);
  for (const key of [...appendedPromptKeys, ...appendedReplayKeys])
    expect(isMessageKey(key)).toBe(true);
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
