/**
 * 负责熊的数据初始化、原私有槽读取／安装、两种历史写入及玩家投影；输入为原角色／状态／报告，安装和读取返回原引用，写入无返回值，玩家投影返回报告副本。
 * 状态安装先赋原槽再返回，读取只是类型断言，不执行 schema／Proxy／当前性检查或深冻结。
 * 数据契约属于共享包，名单、生命、实际吼叫判定、玩家知识和检查点编码仍归各实际所有者。
 * 普通发布取原 history.push；黎明受控历史写体也归本叶，事件／原体复验和发布租约仍归 frame，两种写入不合并。
 * 原安装／追加的 getter、push 或受控写失败传播；黎明历史快照查询失败沿原 false 分支，不保存镜像、退款或授予权限。
 */
import type { BearState, BearReadState } from "@ai-werewolf-arena/game-contract";

import type { PlayerBearState } from "@ai-werewolf-arena/game-contract/player-state-views";
import { playerDataField, positiveInteger, rows } from "../player-state-data";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { types } from "node:util";
import { snapshotPlainData } from "../../../../core/domain/plain_data";

/** 保留 privateState 的原 LHS 读取和同对象赋值；允许的状态形状仍由安装调用方负责。 */
export function setBearState(role: RoleComponent, state: BearState): BearReadState {
  (role.privateState as { bear: BearState })["bear"] = state;
  return state;
}

/** 返回原 live 引用；BearReadState 的 readonly 约束不代表运行时冻结或合法性验证。 */
export function getBearState(role: RoleComponent): BearReadState | undefined {
  return (role.privateState as { readonly bear?: unknown })["bear"] as BearReadState | undefined;
}

/** 普通发布先读取 history／push，再追加原报告对象；后错不回滚，黎明独立 writer 不经此命令。 */
export function recordBearRoar(state: BearReadState, report: BearState["history"][number]): void {
  (state.history as BearState["history"]).push(report);
}

/** 原初始化完整写体：先形成默认数据，再由原安装函数写同一 privateState 槽；不检查角色或创建许可。 */
export function initializeBearState(role: RoleComponent): void {
  setBearState(role, { history: [] });
}

/** 黎明数据反射保原 Node Proxy 拒绝及 own data 读取；这里只读形状，不授予 frame 许可。 */
export function bearDataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
/** 原黎明只接受非 Proxy、直接 Array.prototype 的数组，要求自有 length 可写、容量未满且可扩展。
 * 此检查不遍历元素、不借普通 push 的自定义行为；同一查询也用于事件数组，不提供发布权。 */
export function bearDataArrayAppendable(value: unknown): value is unknown[] {
  if (
    !Array.isArray(value) ||
    types.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return false;
  const d = Object.getOwnPropertyDescriptor(value, "length");
  return (
    !!d?.writable &&
    Number.isSafeInteger(d.value) &&
    d.value < 4294967295 &&
    Object.isExtensible(value)
  );
}
/** 按原受控快照和本日字段判断是否尚未记录，不把不可读历史当空数组继续发表。
 * 快照或检查抛错沿原 catch 返回 false；不修改原历史、运行租约或普通 live getter 的接受面。 */
export function bearHistoryUnpublished(value: unknown, day: number): boolean {
  try {
    const rows = snapshotPlainData(value, new Set(), 0, 65536);
    return Array.isArray(rows) && !rows.some((report) => bearDataField(report, "day") === day);
  } catch {
    return false;
  }
}

/** 原 frame 已先写事件，此处再向受控 history 写原 report；不回滚首个写入或更新发布租约。 */
export function recordDawnBearRoar(
  history: unknown[],
  report: BearState["history"][number],
): void {
  Object.defineProperty(history, String(history.length), {
    value: report,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/** 原玩家历史投影逐项读取自有 data 字段并保正整数／布尔过滤；新报告副本不替代 live 库存或黎明许可。 */
export function projectBearState(state: unknown): PlayerBearState {
  return {
    history: rows(playerDataField(state, "history")).flatMap((row) => {
      const day = playerDataField(row, "day"),
        roared = playerDataField(row, "roared");
      return positiveInteger(day) && typeof roared === "boolean" ? [{ day, roared }] : [];
    }),
  };
}
