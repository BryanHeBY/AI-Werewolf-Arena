/**
 * 负责构造恶魔猎手数据并读取原角色的 demonHunter 状态槽，结构包含 policy 和选择 history。
 * 状态库存由原角色及 authority 所有者持有；输入为角色记录或未知工具数据，输出为原字段
 * 校验后的槽引用／工具副本。Node 快照拒绝外来 descriptor，复制只用于校验，查询不生成
 * 第二份 live 状态，也不结算选择或封存资源。
 */
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core";
import { DEMON_HUNTER_POLICY, readDemonHunterState as readState, readDemonHuntTool as readTool } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
export { DEMON_HUNTER_POLICY };
export const DEMON_HUNTER_ROLE = "demon_hunter" as const;
export interface DemonHunterChoice {
  day: number;
  targetId: number | null;
}
export interface DemonHunterState {
  policy: typeof DEMON_HUNTER_POLICY;
  history: DemonHunterChoice[];
}
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
export interface DemonHuntTool {
  name: "demon_hunt";
  args: { target_id: number | null; abstain: boolean };
}
export function readDemonHuntTool(value: unknown): DemonHuntTool | null {
  try {
    return readTool(demonSnapshot(value));
  } catch {
    return null;
  }
}
