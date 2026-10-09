import { expect, test } from "bun:test";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import {
  dictionaries,
  placeholders,
  roleName,
  term,
  text,
  validateDictionaries,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { ACTION_STAGES, Camp, Phase, PotionType, Role, WinCondition } from "../../src/core";
import { RoleCatalog } from "../../src/game/mechanisms/roles/catalog";
import { WOLF_ROLE_PROFILE } from "../../src/game/mechanisms/roles/wolf/profile";

test("shared Chinese/English keys and placeholders are complete and immutable", () => {
  validateDictionaries();
  expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries["zh-CN"]).sort());
  for (const key of Object.keys(dictionaries["zh-CN"]) as MessageKey[]) {
    expect(placeholders(dictionaries.en[key])).toEqual(placeholders(dictionaries["zh-CN"][key]));
    expect(dictionaries.en[key]).not.toMatch(/[\u4e00-\u9fff]/);
  }
  expect(Object.isFrozen(dictionaries)).toBe(true);
  expect(Object.isFrozen(dictionaries.en)).toBe(true);
});

test("supported machine IDs have shared labels and all 64 role names remain catalog owned", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    for (const role of ROLE_DEFINITIONS) expect(roleName(role.id, locale)).toBe(role.names[locale]);
    for (const [kind, ids] of [
      ["phase", Object.values(Phase)],
      ["stage", ACTION_STAGES],
      ["camp", Object.values(Camp)],
      ["potion", Object.values(PotionType)],
      ["rule", Object.values(WinCondition)],
    ] as const) {
      for (const id of ids) expect(term(kind, id, locale)).not.toBe(id);
    }
    for (const role of Object.values(Role))
      expect(text(locale, `role.${role}.brief` as MessageKey)).not.toBeEmpty();
  }
  expect(term("stage", "legacy_unknown_stage", "en")).toBe("legacy_unknown_stage");
});

test("formatters reject missing text and parameters and never translate user content", () => {
  expect(text("en", "role.witch.state", { heal: 1, poison: 0 })).toBe(
    "Your role is Witch. Antidote:1 Poison:0",
  );
  expect(text("zh-CN", "common.player", { id: 12 })).toBe("12号");
  expect(text("en", "common.player", { id: 12 })).toBe("Player 12");
  expect(() => text("en", "does.not.exist" as MessageKey)).toThrow("i18n_key_missing");
  expect(() => text("en", "constructor" as MessageKey)).toThrow("i18n_key_missing");
  expect(() => text("en", "role.witch.state", { heal: 1 })).toThrow("i18n_parameter_missing");
  expect(() => text("en", "common.player", { id: NaN })).toThrow("i18n_parameter_invalid");
  expect(() => text("en", "common.none", { secret: "PRIVATE_VALUE" })).toThrow(
    "i18n_parameter_unused",
  );
  const original = "苏茶茶\nExact custom text";
  expect(text("en", "role.generic.state", { role: original })).toContain(original);
  // Locale interleaving has no global switch or shared mutable rendering state.
  expect([
    text("en", "common.none"),
    text("zh-CN", "common.none"),
    text("en", "common.none"),
  ]).toEqual(["None", "无", "None"]);
});

test("explicit custom profile text remains original while built-in briefs have one shared owner", () => {
  const custom = new RoleCatalog([
    { ...WOLF_ROLE_PROFILE, label: "Custom Wolf", skillBrief: "Private custom rules" },
  ]);
  for (const locale of ["zh-CN", "en"] as const) {
    expect(custom.label(Role.Wolf, locale)).toBe("Custom Wolf");
    expect(custom.skillBrief(Role.Wolf, locale)).toBe("Private custom rules");
  }
  const defaults = new RoleCatalog();
  expect(defaults.skillBrief(Role.Wolf, "zh-CN")).toBe(text("zh-CN", "role.wolf.brief"));
  expect(defaults.skillBrief(Role.Wolf, "en")).toBe(text("en", "role.wolf.brief"));
});
