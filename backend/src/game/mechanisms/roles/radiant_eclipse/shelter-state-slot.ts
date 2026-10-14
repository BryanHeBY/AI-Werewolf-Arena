/**
 * 输入为待安装庇护状态、原能力实例或已通过选择的 next 数据；输出为安装引用、独立读取结果或原槽的字段写入。
 * 庇护夜实例的完整状态契约与实际 payload 写入。prepare 只沿用原 JSON 复制，schema 则
 * 是原严格 reader，二者接受集合不同，不能在原生安装时增加拒绝。选择／投影返回独立数据。
 * 接受行动后仍先提交已支付庇护效果、再记 uses、最后写原 payload；Object.assign callee
 * 先于 ability.state getter，写失败保留已提交前缀。借用、过期已支付效果与首死归 frame。
 */
import type { ShelterState } from "@ai-werewolf-arena/game-contract";
import { copyAbilityData, type NightAbilityReadView } from "../abilities";
import { commitPreparedNativeAbility } from "../abilities";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { createShelterState, readShelterState, selectShelter, projectShelterState } from "./shelter-state";

/** 仅初始化安装库存，保留原 JSON 复制和 owned 返回引用，不提前执行 strict reader。 */
function installShelterState(role: RoleComponent, state: ShelterState) {
  return commitPreparedNativeAbility(role, "shelter", SHELTER_STATE_SLOT.prepare(state));
}

/** 保留 assign 查找、状态读取和逐字段写入；next 已由原 caller 完成选择。 */
function recordShelterSelection(ability: NightAbilityReadView<"shelter">, next: ShelterState): void {
  // 原顺序：查 Object.assign → 读原 ability.state → 按 next 字段顺序赋值，绝不替换槽引用。
  Object.assign(ability.state, next);
}

/** 原政策 codec 保持 JSON callee 在 state/policy 读取之前，失效仍由 scope 判定。 */
function encodePolicyIdentity(ability: NightAbilityReadView<"shelter">): string {
  return JSON.stringify([ability.state.policy]);
}

export const SHELTER_STATE_SLOT = Object.freeze({
  create: createShelterState,
  prepare: copyAbilityData<ShelterState>,
  schema: readShelterState,
  select: selectShelter,
  project: projectShelterState,
  install: installShelterState,
  allowedWrites: Object.freeze({ recordShelterSelection }),
  checkpoint: Object.freeze({ policyIdentity: encodePolicyIdentity }),
  invalidations: Object.freeze({ policyIdentity: encodePolicyIdentity }),
});
