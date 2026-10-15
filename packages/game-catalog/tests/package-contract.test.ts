/**
 * 包单元测试负责目录公开资料及与机器契约的关系，不导入后端引擎。输入为字面覆盖、机器 ID 与规则引用，输出核对完整资料及名称 API 退出。
 * 目录包含角色不等于允许运行；profile 注册与具体规则仍归应用测试，机器 ID 直接消费契约包。
 */
import { describe, expect, test } from "bun:test";
import { ROLE_DEFINITIONS, roleDefinition } from "@ai-werewolf-arena/game-catalog";
import {
  EVENT_IDS,
  EVENT_PACK_IDS,
  FACTION_IDS,
  ITEM_IDS,
  LOCALES,
  ROLE_IDS,
  RuleError,
  VICTORY_CHECKPOINTS,
  isLocale,
  isRoleId,
} from "@ai-werewolf-arena/game-contract";

describe("catalog public package contract", () => {
  test("all 64 IDs are unique and each catalog entry has been delivered", () => {
    expect(ROLE_DEFINITIONS).toHaveLength(64);
    expect(new Set(ROLE_IDS).size).toBe(64);
    expect(ROLE_DEFINITIONS.filter((role) => role.status === "verified")).toHaveLength(23);
    expect(ROLE_DEFINITIONS.filter((role) => role.status === "implemented")).toHaveLength(41);
    expect(ROLE_DEFINITIONS.map((role) => role.status)).not.toContain("planned");
    expect(roleDefinition("white_cat")?.status).toBe("implemented");
    expect(roleDefinition("fox_cub")?.status).toBe("implemented");
    expect(roleDefinition("pufferfish")?.status).toBe("implemented");
    expect(roleDefinition("awakened_knight")?.status).toBe("implemented");
  });

  test("all catalog entries retain metadata and delivered entries cite a rule contract", () => {
    for (const role of ROLE_DEFINITIONS) {
      expect(isRoleId(role.id)).toBe(true);
      expect(Object.hasOwn(role, "names")).toBe(false);
      if (role.status === "verified" || role.status === "implemented")
        expect(role.ruleCardRef).not.toBeNull();
    }
  });

  test("unknown IDs remain absent and machine locale inputs are exact", () => {
    for (const value of [null, 3, {}, "", "Wolf", "unsupported_role"])
      expect(isRoleId(value)).toBe(false);
    expect(roleDefinition("unsupported_role")).toBeUndefined();
    expect(LOCALES).toEqual(["zh-CN", "en"]);
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("en")).toBe(true);
    for (const value of [null, {}, "zh", "en-US", "EN"]) expect(isLocale(value)).toBe(false);
  });

  test("shared event, victory and failure identifiers do not depend on display names", () => {
    expect(EVENT_PACK_IDS).toEqual(["awa_wall_notes_once_v1"]);
    expect(EVENT_IDS).toEqual(["awa_wall_notes_v1"]);
    expect(ITEM_IDS).toEqual(["anonymous_note"]);
    expect(FACTION_IDS).toEqual(["good", "wolf", "third_party"]);
    expect(VICTORY_CHECKPOINTS).toEqual([
      "night_settled",
      "day_interrupted",
      "exile_settled",
      "max_days_reached",
    ]);
    expect(String(RuleError.AnimalActionUnavailable)).toBe("animal_action_unavailable");
    expect(String(RuleError.ActorDead)).toBe("actor_dead");
  });
});
