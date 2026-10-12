/**
 * Responsibility: verify unit / composition compatibility of public identity exports.
 * Input: public core and shared-contract exports; literal runtime registry counts
 * and object identity are the oracle. The old core exit must refer to the same
 * enum object, including enum member types, rather than a second declaration.
 * Catalog metadata may contain planned IDs; it never grants engine execution.
 */
import { expect, test } from "bun:test";
import { Role as CoreRole, Camp as CoreCamp, type EntityId as CoreEntityId } from "../../src/core";
import { Role, Camp, ROLE_IDS, type EntityId, type RoleId } from "@ai-werewolf-arena/game-contract";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import { getDefaultRoleCatalog } from "../../src/game/mechanisms";

// Compile-time compatibility of re-exported enum member and unbranded ID types.
const sourceMember: CoreRole.DayScholar = Role.DayScholar;
const contractMember: Role.DayScholar = sourceMember;
const entity: CoreEntityId = 12;
const contractEntity: EntityId = entity;
const rawId: RoleId = "wolf";
void contractMember;
void contractEntity;
void rawId;

test("public core identity is the shared enum instance and preserves the 55-role runtime subset", () => {
  expect(CoreRole).toBe(Role);
  expect(CoreCamp).toBe(Camp);
  expect(Object.values(CoreRole)).toHaveLength(55);
  expect(Object.values(Role)).not.toContain("awakened_knight");
  expect(ROLE_IDS).toHaveLength(64);
  expect(ROLE_DEFINITIONS.map((row) => row.id)).toEqual(ROLE_IDS);
});

test("planned metadata is not a registered profile or execution capability", () => {
  const catalog = getDefaultRoleCatalog();
  for (const role of Object.values(Role)) expect(catalog.require(role).role).toBe(role);
  expect(() => catalog.require("awakened_knight" as Role)).toThrow();
  expect(ROLE_DEFINITIONS.find((row) => row.id === "awakened_knight")?.status).toBe("planned");
});
