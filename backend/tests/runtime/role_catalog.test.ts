import { expect, test } from "bun:test";
import { ROLE_DEFINITIONS, ROLE_IDS, isRoleId, roleName } from "@ai-werewolf-arena/game-catalog";
import { Role } from "../../src/core/domain/identity";
import { RoleCatalog, getDefaultRoleCatalog } from "../../src/game/mechanisms/roles/catalog";
import { createRoleComponent } from "../../src/core/domain/components/role";
import { Camp } from "../../src/core/domain/identity";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("shared catalog distinguishes planned definitions from registered roles", () => {
  expect(ROLE_DEFINITIONS).toHaveLength(64);
  expect(new Set(ROLE_IDS).size).toBe(64);
  expect(
    ROLE_DEFINITIONS.filter((item) => item.status === "verified" || item.status === "implemented")
      .map((item) => String(item.id))
      .sort(),
  ).toEqual(Object.values(Role).sort());
  expect(
    getDefaultRoleCatalog()
      .all()
      .map((item) => item.role)
      .sort(),
  ).toEqual(Object.values(Role).sort());
  expect(isRoleId("awakened_hidden_wolf")).toBe(true);
  expect(getDefaultRoleCatalog().require(Role.AwakenedHiddenWolf).role).toBe(
    Role.AwakenedHiddenWolf,
  );
  expect(getDefaultRoleCatalog().require(Role.BlackMarketMerchant).role).toBe(
    Role.BlackMarketMerchant,
  );
  expect(() => getDefaultRoleCatalog().require("awakened_knight" as Role)).toThrow(
    "role_profile_not_registered",
  );
  expect(roleName("wolf", "zh-CN")).toBe("狼人");
  expect(roleName("wolf", "en")).toBe("Werewolf");
});

test("runtime catalog rejects duplicate or missing profiles", () => {
  const profile = getDefaultRoleCatalog().require(Role.Wolf);
  expect(() => new RoleCatalog([profile, profile])).toThrow("role_profile_duplicate");
  expect(() => new RoleCatalog([]).getCamp(Role.Seer)).toThrow("role_profile_not_registered");
  const component = createRoleComponent(Role.Wolf, Camp.Wolf);
  getDefaultRoleCatalog().applyRuntime(component);
  component.role = "awakened_knight" as Role;
  expect(() => component.renderPrompt()).toThrow("role_profile_not_registered");
});

test("every catalog entry has bilingual labels and registered entries have rule cards", async () => {
  for (const entry of ROLE_DEFINITIONS) {
    expect(entry.names["zh-CN"].trim().length).toBeGreaterThan(0);
    expect(entry.names.en.trim().length).toBeGreaterThan(0);
    if (entry.status !== "verified" && entry.status !== "implemented") continue;
    expect(entry.ruleCardRef).not.toBeNull();
    const [file, anchor] = entry.ruleCardRef!.split("#");
    const text = await readFile(path.resolve(import.meta.dir, "../../..", file), "utf8");
    if (anchor) expect(text).toContain(`## ${anchor}`);
    else expect(text.trimStart().startsWith("# ")).toBe(true);
  }
});

import { createDefaultRoleRegistry } from "../../src/game/mechanisms/roles/permissions";

test("evil knight keeps wolf night tools without inheriting self-destruct requests", () => {
  const profile = getDefaultRoleCatalog().require(Role.EvilKnight);
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
