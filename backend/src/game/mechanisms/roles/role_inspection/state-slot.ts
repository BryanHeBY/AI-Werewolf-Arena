/**
 * 负责角色查验能力族的原生状态创建、既有政策校验、同实例访问及两条历史写入前缀。
 * 输入为原角色／能力引用与已验证报告；输出保留原 JSON 复制、policy 默认解释、原状态
 * 引用与局部 payload 失效规则。查验目标、次数、生命、来源、阶段与租约仍归原 owner。
 * 本族覆盖五种原生政策和觉醒隐狼晚学习，赠予／复制／转移仍使用共享实例库存；
 * 不复制第二仓库、不严格化旧 payload、退款或推导新权限。
 */
import type {
  RoleInspectionState,
  RoleInspectionReadState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { InspectionResult } from "@ai-werewolf-arena/game-contract";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../abilities";
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { commitPreparedNativeAbility } from "../abilities";

export function setRoleInspectionState(
  role: RoleComponent,
  state: RoleInspectionState,
): RoleInspectionReadState {
  return commitPreparedNativeAbility(role, "role_check", ROLE_INSPECTION_STATE_SLOT.create(state));
}

export function getRoleInspectionState(
  role: RoleComponent,
  abilityId?: string,
): RoleInspectionReadState | undefined {
  return findNightAbility(role, "role_check", abilityId)?.state;
}

/** 调用方保留全部预检，以及随后次数、效果和事件发布；此处仅写原 payload 历史前缀。 */
export function recordRoleInspection(
  state: RoleInspectionReadState,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (state as RoleInspectionState).lastTarget = targetId;
  (state as RoleInspectionState).lastDay = day;
  (state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}

/** 纯白／狼巫仍逐次读取 ability.state 三次，并只追加一次结果历史。 */
export function recordAbilityRoleInspection(
  ability: import("../abilities").NightAbilityReadView<"role_check">,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (ability.state as RoleInspectionState).lastTarget = targetId;
  (ability.state as RoleInspectionState).lastDay = day;
  (ability.state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}

/** 原生安装先按原 JSON 规则复制，再校验原 policy；不增加 history／目标形状拒绝政策。 */
function createRoleInspectionState(state: RoleInspectionState): RoleInspectionState {
  const ownedState = copyAbilityData(state);
  roleInspectionPolicy(ownedState);
  return ownedState;
}

/** 保持 JSON.stringify 方法查找先于两次 ability.state 读取，不提前捕获状态或政策字段。 */
function encodeRoleInspectionPolicy(ability: NightAbilityReadView<"role_check">): string {
  return JSON.stringify([ability.state.policy, ability.state.inspectionPolicy]);
}

/** 原完成回执仅捕获 payload 关联；生命、id、来源、激活、当前阶段和禁用仍归原夜间 owner。 */
interface CapturedInspectionPayload {
  readonly ability: NightAbilityReadView<"role_check">;
  readonly inspection: RoleInspectionReadState;
  readonly inspectionPolicy: RoleInspectionReadState["inspectionPolicy"];
}
function capturedInspectionPayloadChanged(scope: CapturedInspectionPayload): boolean {
  return (
    scope.ability.state !== scope.inspection ||
    scope.inspection.inspectionPolicy !== scope.inspectionPolicy ||
    roleInspectionPolicy(scope.inspection) !== "gargoyle"
  );
}

/**
 * 本族唯一状态槽贡献。create 使用原复制与政策校验；schema 只引用原既有政策验证器，
 * 不冒称已验证整个 history 或添加严格 schema。原 native／赠予／转移能力仍存在原 abilities。
 * 两条 append 入口分别保留捕获状态与三次实例 state 读取的旧轨迹，不合并次数提交。
 * checkpoint 仅编码原运行政策身份；归档仍由既有 checkpoint 完整克隆 privateState，
 * 本声明不创建第二 JSON 仓库、解码器或新 lease，不把 payload 当前性当作完整行动授权。
 */
export const ROLE_INSPECTION_STATE_SLOT = Object.freeze({
  create: createRoleInspectionState,
  schema: roleInspectionPolicy,
  install: setRoleInspectionState,
  get: getRoleInspectionState,
  allowedWrites: Object.freeze({
    appendState: recordRoleInspection,
    appendAbility: recordAbilityRoleInspection,
  }),
  checkpoint: Object.freeze({ policyIdentity: encodeRoleInspectionPolicy }),
  invalidations: Object.freeze({ payloadChanged: capturedInspectionPayloadChanged }),
});
