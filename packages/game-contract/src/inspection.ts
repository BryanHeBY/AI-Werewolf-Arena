/**
 * 负责规则揭示的查验数据，明确区别于目标真实身份。输入为公共角色 ID 与阵营标签，
 * 输出保留阵营、角色或两者组合的原判别联合，本契约唯一声明结果形状。
 * 查验资格、目标和结果计算仍归具体机制；这里不读取 World、原生命或政策，不授予请求权限。
 */
import type { RoleId } from "./role-ids";

export type InspectionCamp = "good" | "wolf" | "third_party";
/** kind 描述本次揭示范围；RoleId 是数据标签，不是实际 Role 对象、真实底牌或活跃许可。 */
export type InspectionResult =
  | { kind: "camp"; camp: InspectionCamp }
  | { kind: "role"; role: RoleId }
  | { kind: "combined"; camp: InspectionCamp; role: RoleId };
export type InspectionKind = InspectionResult["kind"];
