/**
 * 单元测试：验证注册／计划角色区分、重复／缺失 profile 拒绝与恶灵骑士工具声明。输入为字面角色 ID 和注入 profile；精确支持集合、原查找错误和具名工具为预期，不加载规则卡文件、对局或模型。
 */
import { renderRolePrompt } from "../../../src/agents/observation/role-presentation";
import { expect, test } from "bun:test";
import { ROLE_DEFINITIONS, roleName } from "@ai-werewolf-arena/game-catalog";
import { ROLE_IDS, isRoleId } from "@ai-werewolf-arena/game-contract";
import { Role } from "../../../src/domain/identity";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import { Camp } from "../../../src/domain/identity";
import { createDefaultRoleRegistry } from "../../../src/rulesets/roles/permissions";

test("shared catalog distinguishes planned definitions from registered roles", () => {
  expect(ROLE_DEFINITIONS).toHaveLength(64);
  expect(new Set(ROLE_IDS).size).toBe(64);
  expect(
    ROLE_DEFINITIONS.filter((item) => item.status === "verified" || item.status === "implemented")
      .map((item) => String(item.id))
      .sort(),
  ).toEqual(Object.values(Role).sort());
  expect(ROLE_DEFINITIONS.filter((item) => item.status !== "planned")).toHaveLength(55);
  for (const role of [Role.WhiteCat, Role.FoxCub, Role.Pufferfish])
    expect(ROLE_DEFINITIONS.find((item) => item.id === role)?.status).toBe("implemented");
  expect(
    getDefaultRoleCatalog()
      .allMetadata()
      .map((item) => item.role)
      .sort(),
  ).toEqual(Object.values(Role).sort());
  expect(isRoleId("awakened_hidden_wolf")).toBe(true);
  expect(getDefaultRoleCatalog().requireMetadata(Role.AwakenedHiddenWolf).role).toBe(
    Role.AwakenedHiddenWolf,
  );
  expect(getDefaultRoleCatalog().requireMetadata(Role.BlackMarketMerchant).role).toBe(
    Role.BlackMarketMerchant,
  );
  expect(() => getDefaultRoleCatalog().requireMetadata("awakened_knight" as Role)).toThrow(
    "role_profile_not_registered",
  );
  expect(roleName("wolf", "zh-CN")).toBe("狼人");
  expect(roleName("wolf", "en")).toBe("Werewolf");
});

test("runtime catalog rejects duplicate or missing profiles", () => {
  const profile = getDefaultRoleContributions().find((item) => item.metadata.role === Role.Wolf)!;
  expect(() => createRoleCatalog({ contributions: [profile, profile] })).toThrow(
    "role_profile_duplicate",
  );
  expect(() => createRoleCatalog([]).getCamp(Role.Seer)).toThrow("role_profile_not_registered");
  const component = createRoleComponent(Role.Wolf);
  const initialCamp = { camp: Camp.Wolf };
  getDefaultRoleCatalog().applyRuntime(component, { initialCamp, currentCamp: () => initialCamp });
  component.role = "awakened_knight" as Role;
  expect(() => renderRolePrompt(component)).toThrow("role_profile_not_registered");
});

test("evil knight keeps wolf night tools without inheriting self-destruct requests", () => {
  const profile = getDefaultRoleCatalog().requireRuntime(Role.EvilKnight);
  const registry = createDefaultRoleRegistry();
  expect(profile.canSelfDestruct).toBe(false);
  const tools = registry.getAllowedTools(Role.EvilKnight);
  expect(tools).toContain("speak_to_wolves");
  expect(tools).toContain("kill_vote");
  expect(tools).not.toContain("self_destruct");
  expect(tools).not.toContain("self_destruct_with_target");
  expect(registry.getAllowedTools(Role.Wolf)).toContain("self_destruct");
  expect(registry.getAllowedTools(Role.WhiteWolfKing)).toContain("self_destruct_with_target");
});
