/**
 * 负责猎魔人完整数据槽：原 schema／工具副本、creator、同引用查询、安装及已接受历史写入。
 * 输入为原角色或 authority 的原 state／history／夜时钟；输出保持 live 引用和唯一 historyJson。
 * Node 快照只在原入口拒绝外来 descriptor／Proxy，校验副本不替换运行槽；公共纯结构仍归契约包。
 * 原下一历史先编码，再 push 和更新 JSON；后续 actor 审计、夜选择、请求结算和 stock 写权仍归 authority。
 * 此 owner 不建镜像／第二 WeakMap、不冻结 live 数据或把类型／查询当许可；失败保原部分写入前缀。
 */
import { snapshotPlainData } from "../../domain/plain-data";
import { types } from "node:util";
import type { RoleComponent } from "../../domain";
import { DEMON_HUNTER_POLICY, readDemonHunterState as readState, readDemonHuntTool as readTool } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import type { DemonHunterState, DemonHuntTool } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
export { DEMON_HUNTER_POLICY };
export const DEMON_HUNTER_ROLE = "demon_hunter" as const;
export function ownDemonData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
export function demonSnapshot(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
  arrayLimit = 256,
): unknown {
  return snapshotPlainData(value, seen, depth, arrayLimit, "demon_hunter_data_invalid");
}
export function demonJson(value: unknown): string | null {
  try {
    return JSON.stringify(demonSnapshot(value));
  } catch {
    return null;
  }
}
export function exactDemonData(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function freshDemonHunterState(): DemonHunterState {
  return { policy: DEMON_HUNTER_POLICY, history: [] };
}
export function readDemonHunterState(value: unknown): DemonHunterState | null {
  try {
    return readState(demonSnapshot(value));
  } catch {
    return null;
  }
}
export function getDemonHunterState(role: RoleComponent | undefined): DemonHunterState | undefined {
  const s = ownDemonData(ownDemonData(role, "privateState"), "demonHunter");
  // 复制只用于验证；成功后仍返回原 slot，不能让查询生成第二份 live 状态。
  return readDemonHunterState(s) ? (s as DemonHunterState) : undefined;
}
export function readDemonHuntTool(value: unknown): DemonHuntTool | null {
  try {
    return readTool(demonSnapshot(value));
  } catch {
    return null;
  }
}

/** 唯一 live state／history 和已提交 JSON 留在原 binding 对象，不复制第二份运行库存。 */
export interface DemonHunterStateSlot {
  state: DemonHunterState;
  history: DemonHunterState["history"];
  historyJson: string;
}

/** 初始化仍先求值左侧 privateState，再调用原 creator；没有 schema、授权或新冻结。 */
export function installDemonHunterStateSlot(role: RoleComponent): void {
  (role.privateState as { demonHunter: DemonHunterState }).demonHunter = freshDemonHunterState();
}

/** 原安装字段依次取 state、history，再给空历史 JSON；临时返回对象不成为第二份 live store。 */
export function captureDemonHunterStateSlot(state: DemonHunterState): DemonHunterStateSlot {
  return { state, history: state.history, historyJson: "[]" };
}

/** 数据当前性保持原历史引用优先、已校验历史 JSON 后查；原参与者与 World alias 仍由 authority 核对。 */
export function demonHunterHistoryCurrent(b: DemonHunterStateSlot, state: DemonHunterState): boolean {
  return ownDemonData(b.state, "history") === b.history && demonJson(state.history) === b.historyJson;
}

/**
 * 完整原历史写命令。各 history 与 n.day 均在原表达式处读取；不提前缓存夜时钟。
 * 下一历史 JSON 失败时尚未 push；push 后再写 historyJson，后续抛错保留原历史写入前缀。
 * 返回原冻结 choice；actor.auditPrivateJson、n.choice／turn 和请求结算必须仍由 authority 随后按原序提交。
 */
export function appendDemonHunterChoiceData(
  b: DemonHunterStateSlot,
  n: { readonly day: number },
  targetId: number | null,
): Readonly<DemonHunterState["history"][number]> | null {
  const length = Object.getOwnPropertyDescriptor(b.history, "length");
  if (!length?.writable || !Object.isExtensible(b.history) || (b.history.at(-1)?.day ?? 1) >= n.day)
    return null;
  const choice = Object.freeze({ day: n.day, targetId });
  const nextHistoryJson = demonJson([...b.history, choice]);
  if (nextHistoryJson === null) return null;
  b.history.push(choice);
  b.historyJson = nextHistoryJson;
  return choice;
}
