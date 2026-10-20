/**
 * 负责守墓人原私有槽的初始化、安装、同引用读取、已接受反馈历史写入及玩家报告投影。
 * 输入是原角色／状态、当时捕获的放逐标签与接收日期；输出为原状态引用、历史写入或脱离的玩家报告副本。
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

import type { RoleComponent } from "../../domain/components/role";
import type { ExileFeedback } from "@ai-werewolf-arena/game-contract";
import type { PlayerGravekeeperState } from "@ai-werewolf-arena/game-contract/player-state-views";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";

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

/** 原初始化完整写体：先形成默认数据，再由原安装函数写同一 privateState 槽；不检查角色或创建许可。 */
export function initializeGravekeeperState(role: RoleComponent): void {
  setGravekeeperState(role, { history: [] });
}

/** 保留原 live history 读取后才走严格报告 reader；只输出已接受报告副本，不授予放逐／接收资格。 */
export function projectGravekeeperState(role: RoleComponent): PlayerGravekeeperState {
  const history = getGravekeeperState(role)?.history;
  return {
    history: Array.isArray(history)
      ? history.flatMap((item) => {
          const report = readGravekeeperReport(item);
          return report ? [report] : [];
        })
      : [],
  };
}
