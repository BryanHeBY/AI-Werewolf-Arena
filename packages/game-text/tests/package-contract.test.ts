/**
 * 包级单元测试验证公共双语词典与格式政策。
 * 独立字面输出、完整键／占位符比较核对文本格式；本包覆盖六十四个机器 ID 的名称，完整双语字面预期另见 role-names 单元测试。
 * 用户内容原样作为参数，不当翻译键；显式 locale 调用不写共享当前语言。本文件不使用 World、传输或应用预加载。
 */
import { describe, expect, test } from "bun:test";
import {
  dictionaries,
  placeholders,
  renderMessage,
  roleName,
  term,
  text,
  validateDictionaries,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";

describe("text public package contract", () => {
  test("every Chinese and English message has the same parameters and immutable owner", () => {
    validateDictionaries();
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries["zh-CN"]).sort());
    for (const key of Object.keys(dictionaries["zh-CN"]) as MessageKey[]) {
      expect(placeholders(dictionaries.en[key])).toEqual(placeholders(dictionaries["zh-CN"][key]));
      expect(dictionaries.en[key]).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(Object.isFrozen(dictionaries)).toBe(true);
    expect(Object.isFrozen(dictionaries.en)).toBe(true);
    expect(Object.isFrozen(dictionaries["zh-CN"])).toBe(true);
  });

  test("literal bilingual outputs and role labels preserve the public contract", () => {
    expect(text("en", "role.witch.state", { heal: 1, poison: 0 })).toBe(
      "Your role is Witch. Antidote:1 Poison:0",
    );
    expect(text("zh-CN", "common.player", { id: 12 })).toBe("12号");
    expect(renderMessage("en", { key: "common.player", parameters: { id: 12 } })).toBe("Player 12");
    for (const locale of ["zh-CN", "en"] as const)
      for (const id of ROLE_IDS) expect(roleName(id, locale)).not.toBe(id);
    expect(term("stage", "archived_unknown_stage", "en")).toBe("archived_unknown_stage");
  });

  test("unknown keys, missing or extraneous parameters reject rather than interpolate partial text", () => {
    expect(() => text("en", "constructor" as MessageKey)).toThrow("i18n_key_missing");
    expect(() => text("en", "does.not.exist" as MessageKey)).toThrow("i18n_key_missing");
    expect(() => text("en", "role.witch.state", { heal: 1 })).toThrow("i18n_parameter_missing");
    expect(() => text("en", "common.player", { id: NaN })).toThrow("i18n_parameter_invalid");
    expect(() => text("en", "common.none", { userText: "private text" })).toThrow(
      "i18n_parameter_unused",
    );
  });

  test("user text remains byte-for-byte and locale interleaving has no mutable global state", () => {
    const original = "苏茶茶\nExact custom text {role}";
    expect(text("en", "role.generic.state", { role: original })).toContain(original);
    expect([
      text("en", "common.none"),
      text("zh-CN", "common.none"),
      text("en", "common.none"),
    ]).toEqual(["None", "无", "None"]);
    expect(placeholders("{target} {actor} {target} literal braces {}")).toEqual([
      "actor",
      "target",
    ]);
  });
});
