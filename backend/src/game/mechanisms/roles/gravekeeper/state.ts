/**
 * 负责守墓人原私有状态槽的安装、同引用读取及已接受反馈的历史写入。
 * 输入是原角色／状态、当时捕获的放逐标签与接收日期；输出保留原状态引用或追加的报告副本。
 * 数据保存放逐日、目标、查验结果与接收日；公共字段类型归中立契约，本模块不新增 live schema 校验。
 * 阶段拥有资格、重复接收检查与事件发布；历史 push 的原 getter／spread／失败前缀保留，不回滚已写报告。
 * readonly 是读方类型，不冻结库存、验证原生命或授予行动许可；这里不捕获身份标签或推进阶段。
 */
import type {
  GravekeeperReport,
  GravekeeperState,
  GravekeeperReadReport,
  GravekeeperReadState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { ExileFeedback } from "@ai-werewolf-arena/game-contract";

/** 直接安装同一输入状态，先求原 privateState 左值；不创建／克隆、冻结或检查状态形状。 */
export function setGravekeeperState(
  roleComp: RoleComponent,
  state: GravekeeperState,
): GravekeeperReadState {
  (roleComp.privateState as { gravekeeper: GravekeeperState })["gravekeeper"] = state;
  return state;
}

/** 原直接字段读取，不校验角色／阵营／生命或 schema；调用方负责提供原组件，getter 失败照常传播。 */
export function getGravekeeperState(roleComp: RoleComponent): GravekeeperReadState | undefined {
  return (roleComp.privateState as { readonly gravekeeper?: unknown })["gravekeeper"] as
    GravekeeperReadState | undefined;
}

/** 调用方保留前置资格与后续发布；这里先取 history.push 的原 receiver，再展开 fact 和其 result 副本。
 * 不把收到的反馈当资源付款；push／spread 失败不补事件，已完成的写入不由本函数回滚。 */
export function recordExileFeedback(
  state: GravekeeperReadState,
  fact: ExileFeedback,
  receivedDay: number,
): void {
  (state.history as GravekeeperReport[]).push({ ...fact, receivedDay, result: { ...fact.result } });
}
