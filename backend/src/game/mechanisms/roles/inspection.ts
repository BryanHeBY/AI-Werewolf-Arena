/**
 * 负责按当前目标角色和运行查验标签形成披露结果。输入为目标编号及阵营／身份／组合查验类型；输出为对应结果或 null。结果不授予行动权限，披露标签可以不同于真实角色和阵营。
 */
import type { InspectionKind, InspectionResult } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { EntityId } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleCatalog } from "./catalog";

/** 只读规则投影，调用此查询不等于取得行动许可。 */
export function resolveInspection<K extends InspectionKind>(
  world: World,
  targetId: EntityId,
  kind: K,
  catalog: RoleCatalog,
): Extract<InspectionResult, { kind: K }> | null {
  const target = world.getComponent(targetId, COMPONENT.Role);
  if (!target) return null;
  const definition = catalog.runtime(target.role)?.inspectionLabels;
  const labels = typeof definition === "function" ? definition(target) : definition;
  const camp = labels?.camp ?? target.camp,
    role = labels?.role ?? target.role;
  const result: InspectionResult =
    kind === "camp" ? { kind, camp } : kind === "role" ? { kind, role } : { kind, camp, role };
  return result as Extract<InspectionResult, { kind: K }>;
}
