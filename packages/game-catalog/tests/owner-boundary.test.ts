/**
 * 包单元测试负责资料目录的公开出口边界。输入为实际目录 namespace 与编译期旧具名导入；
 * 输出用字面三个运行出口和逐项类型拒绝核对，元数据不冒充文案、机器契约或角色执行许可。
 * 编译负例的名字全部在导出类型中使用，避免未使用导入诊断掩盖旧出口意外保留。
 */
import { expect, test } from "bun:test";
import * as catalog from "@ai-werewolf-arena/game-catalog";

// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { EVENT_PACK_IDS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { EVENT_IDS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { ITEM_IDS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { LOCALES } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { isLocale } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { ROLE_IDS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { isRoleId } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { Locale } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { FACTION_IDS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VICTORY_CHECKPOINTS } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { FactionId } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VictoryPoint } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VictoryAffiliation } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VictoryTarget } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { VictoryClaim } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { GameOutcome } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { InspectionCamp } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { InspectionResult } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { InspectionKind } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { RuleError } from "@ai-werewolf-arena/game-catalog";
// @ts-expect-error 目录已退出此契约出口，调用方应使用 game-contract。
import type { RuleViolation } from "@ai-werewolf-arena/game-catalog";

// @ts-expect-error 角色名称查询已迁入 game-text，目录不保反向依赖或长期转发。
import type { roleName } from "@ai-werewolf-arena/game-catalog";

// @ts-expect-error 双语名称字段已退出目录资料，由 game-text 的名称词典独占。
export type RetiredCatalogNames = catalog.RoleDefinition["names"];

export type RetiredCatalogContracts = [
  typeof roleName,
  typeof EVENT_PACK_IDS,
  typeof EVENT_IDS,
  typeof ITEM_IDS,
  typeof LOCALES,
  typeof isLocale,
  typeof ROLE_IDS,
  typeof isRoleId,
  Locale,
  RoleId,
  typeof FACTION_IDS,
  typeof VICTORY_CHECKPOINTS,
  FactionId,
  VictoryCheckpoint,
  VictoryPoint,
  VictoryAffiliation,
  VictoryTarget,
  VictoryClaim,
  GameOutcome,
  SealedVictoryResult,
  InspectionCamp,
  InspectionResult,
  InspectionKind,
  RuleError,
  RuleViolation,
];

test("catalog runtime namespace contains exactly its three metadata owners", () => {
  expect(Object.keys(catalog).sort()).toEqual(["ROLE_DEFINITIONS", "RULESET", "roleDefinition"]);
});
