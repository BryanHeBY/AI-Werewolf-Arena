/**
 * 单元测试：验证双语词典 key、占位符、不可变性及共享角色名称覆盖。输入为原机器 ID、字面参数
 * 与显式自定义原文；精确字面文案和完整 key 集合为独立预期，不执行模型或完整对局。
 * 三贡献装配不改变翻译策略，用户昵称、人格及自定义资料保持原文。
 */
import { expect, test } from "bun:test";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";
import {
  dictionaries,
  placeholders,
  roleName,
  term,
  text,
  validateDictionaries,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { ACTION_STAGES, Camp, Phase, PotionType, Role, WinCondition } from "../../../src/domain";
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { WOLF_ROLE_PROFILE } from "../../../src/features/wolf/profile";

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

test("supported machine IDs have shared labels and all 64 role names are text owned", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    // 完整双语字面快照由共享名称 owner 的测试保存；本层核公开机器 ID 均走文案回退而非裸 ID。
    for (const id of ROLE_IDS) expect(roleName(id, locale)).not.toBe(id);
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
  // 交错语言调用没有全局语言切换或共享可变展示状态。
  expect([
    text("en", "common.none"),
    text("zh-CN", "common.none"),
    text("en", "common.none"),
  ]).toEqual(["None", "无", "None"]);
});

test("explicit custom profile text remains original while built-in briefs have one shared owner", () => {
  const custom = createRoleCatalog([
    {
      ...WOLF_ROLE_PROFILE.metadata,
      ...WOLF_ROLE_PROFILE.runtime,
      label: "Custom Wolf",
      skillBrief: "Private custom rules",
    },
  ]);
  for (const locale of ["zh-CN", "en"] as const) {
    expect(custom.label(Role.Wolf, locale)).toBe("Custom Wolf");
    expect(custom.skillBrief(Role.Wolf, locale)).toBe("Private custom rules");
  }
  const defaults = createRoleCatalog();
  expect(defaults.skillBrief(Role.Wolf, "zh-CN")).toBe(text("zh-CN", "role.wolf.brief"));
  expect(defaults.skillBrief(Role.Wolf, "en")).toBe(text("en", "role.wolf.brief"));
});
