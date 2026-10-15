/**
 * 单元／装配测试验证公开身份出口兼容。输入为 core 和共享契约出口；原注册数量及对象身份是字面预期。旧 core 出口必须引用同一枚举对象，包括成员类型，不能重复定义。Catalog 的资料条目不授予引擎执行权限。
 */
import { expect, test } from "bun:test";
import {
  Role as CoreRole,
  Camp as CoreCamp,
  type EntityId as CoreEntityId,
} from "../../src/domain";
import { Role, Camp, ROLE_IDS, type EntityId, type RoleId } from "@ai-werewolf-arena/game-contract";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import { getDefaultRoleCatalog } from "../../src/rulesets/mechanism-api";

// 重导出的枚举成员与未加品牌的 ID 类型保持编译期兼容。
const sourceMember: CoreRole.DayScholar = Role.DayScholar;
const contractMember: Role.DayScholar = sourceMember;
const entity: CoreEntityId = 12;
const contractEntity: EntityId = entity;
const rawId: RoleId = "wolf";
void contractMember;
void contractEntity;
void rawId;

test("public core identity is the shared enum instance and preserves the delivered runtime subset", () => {
  expect(CoreRole).toBe(Role);
  expect(CoreCamp).toBe(Camp);
  expect(Object.values(CoreRole)).toHaveLength(59);
  expect(Object.values(Role)).not.toContain("awakened_knight");
  expect(ROLE_IDS).toHaveLength(64);
  expect(ROLE_DEFINITIONS.map((row): RoleId => row.id)).toEqual(ROLE_IDS);
});

test("planned metadata is not a registered profile or execution capability", () => {
  const catalog = getDefaultRoleCatalog();
  for (const role of Object.values(Role)) expect(catalog.requireMetadata(role).role).toBe(role);
  expect(() => catalog.requireMetadata("awakened_knight" as Role)).toThrow();
  expect(ROLE_DEFINITIONS.find((row) => row.id === "awakened_knight")?.status).toBe("planned");
});
