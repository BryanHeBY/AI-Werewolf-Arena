/**
 * 负责按当前目标角色和运行查验标签形成披露结果。输入为目标编号及阵营／身份／组合查验类型；输出为对应结果或 null。结果不授予行动权限，披露标签可以不同于真实角色和阵营。
 */
import type { InspectionKind, InspectionResult } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../domain/components/names";
import type { RoleComponent } from "../../../domain/components/role";
import type { EntityId } from "../../../domain/model";
import type { World } from "../../../domain/world";
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
  const camp = labels?.camp ?? world.getComponent(targetId, COMPONENT.Camp)?.camp,
    role = labels?.role ?? target.role;
  // 两个原字段已按原序读取；身份结果不要求阵营，阵营／组合结果缺当前来源时明确返回 null。
  if (kind === "role") return { kind, role } as Extract<InspectionResult, { kind: K }>;
  if (camp === undefined) return null;
  const result: InspectionResult = kind === "camp" ? { kind, camp } : { kind, camp, role };
  return result as Extract<InspectionResult, { kind: K }>;
}
