/**
 * 负责摄梦人原生状态槽访问及 target/day/history 的具体写入。
 * 输入为原角色、能力或已捕获状态和接受目标；输出保留安装复制、原槽引用与部分写入顺序。
 * 数据／只读形状来自 contract；连续目标、租约、use 计数、梦效果和事实仍在原 caller 位置。
 * 本 owner 不制造状态镜像、回滚已付资源或新增资格重检。
 */
import type { DreamerState, DreamerReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../abilities";
import { commitPreparedNativeAbility } from "../prepared-native-install";

/** 初始化只复制原 JSON 并提交同一原生库存；连续目标和保护资格不是安装校验。 */
export function setDreamerState(roleComp: RoleComponent, state: DreamerState): DreamerReadState {
  return commitPreparedNativeAbility(roleComp, "dream", DREAMER_STATE_SLOT.create(state));
}

export function getDreamerState(
  roleComp: RoleComponent,
  abilityId?: string,
): DreamerReadState | undefined {
  return findNightAbility(roleComp, "dream", abilityId)?.state;
}

/** 目标／scope 检查、次数、梦效果与事实仍在 caller；history 失败不回滚已写 target/day。 */
export function recordDreamSelection(
  state: DreamerReadState,
  targetId: EntityId,
  day: number,
): void {
  // target/day 先落原槽，再读取 history 并 push；后段失败保留两项已写前缀。
  (state as DreamerState).lastTarget = targetId;
  (state as DreamerState).lastDay = day;
  (state as DreamerState).history.push({ day, targetId });
}

/** 原 stringify callee 先于 state／protectionPolicy 读取；只编码既有 scope 身份。 */
function encodePolicyIdentity(ability: NightAbilityReadView<"dream">): string {
  return JSON.stringify([ability.state.protectionPolicy]);
}

/** JSON 创建／schema 沿用旧接受集合；读同一库存，明确写入不制造新 lease 或状态镜像。 */
export const DREAMER_STATE_SLOT = Object.freeze({
  create: copyAbilityData<DreamerState>,
  schema: copyAbilityData<DreamerState>,
  install: setDreamerState,
  get: getDreamerState,
  allowedWrites: Object.freeze({ recordDreamSelection }),
  checkpoint: Object.freeze({ policyIdentity: encodePolicyIdentity }),
  invalidations: Object.freeze({ policyIdentity: encodePolicyIdentity }),
});
