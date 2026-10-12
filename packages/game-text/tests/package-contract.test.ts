/**
 * Package unit contract: validate the public bilingual catalog and formatting
 * policy using literal outputs and complete key/placeholder comparisons.
 * User content is an immutable input, never a translation key. These tests use
 * no World, transport, application preload or production rule calculation.
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
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";

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

  test("literal bilingual outputs and role metadata preserve the public contract", () => {
    expect(text("en", "role.witch.state", { heal: 1, poison: 0 })).toBe(
      "Your role is Witch. Antidote:1 Poison:0",
    );
    expect(text("zh-CN", "common.player", { id: 12 })).toBe("12号");
    expect(renderMessage("en", { key: "common.player", parameters: { id: 12 } })).toBe("Player 12");
    for (const locale of ["zh-CN", "en"] as const)
      for (const role of ROLE_DEFINITIONS)
        expect(roleName(role.id, locale)).toBe(role.names[locale]);
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
