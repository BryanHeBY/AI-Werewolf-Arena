/**
 * 负责寻香魅影完整数据槽的创建、原严格 schema、知识／绑定下一状态及原位提交。
 * 输入为原角色或 authority 已捕获的槽；输出保持同一 live 状态和已提交 JSON，
 * 原生命、roster、RNG、夜间租约、关系付款和死亡发布仍由 authority 拥有。
 * 初始化先求值 privateState 左值容器再调用 creator；提交先写全部原字段，再编码 JSON，
 * 编码失败保留已经写入的前缀，不回滚、不额外冻结或重新检查授权。内部 codec 保原位置，
 * 不是所有 private 扩展键的归档格式；状态知识和 public schema 不授予行动或资源写权限。
 */
import type { Pair } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { FRAGRANT_PAIR_POLICY, normalizePair } from "./state";
import { positive, exact, pair, write } from "./owned-state-data";

/** 原绑定数据只记录期限／触发；实际原生命、关系消费和发布权限仍由 authority 证明。 */
export interface Binding {
  id: string;
  createdNight: number;
  expiresNight: number;
  pairIds: Pair;
  status: { kind: "pending" } | { kind: "expired" | "triggered"; day: number };
}
/** knownWolfId 与 knowledgeNight 是原首夜知识，不能据此重新推导玩家真实 Camp 或发放租约。 */
export interface FragrantState {
  policy: typeof FRAGRANT_PAIR_POLICY;
  knownWolfId: number | null;
  knowledgeNight: 1 | null;
  lastChoice: { day: number; pairIds: Pair | null } | null;
  bindings: readonly Binding[];
  trigger: { bindingId: string; day: number; rootId: number; addedTargetId: number | null } | null;
}
export function freshFragrantState(): FragrantState {
  return {
    policy: FRAGRANT_PAIR_POLICY,
    knownWolfId: null,
    knowledgeNight: null,
    lastChoice: null,
    bindings: [],
    trigger: null,
  };
}
export function readFragrantState(value: unknown): FragrantState | null {
  try {
    const v = snapshotPlainData(value, new Set(), 0, 65536);
    if (
      !exact(v, ["policy", "knownWolfId", "knowledgeNight", "lastChoice", "bindings", "trigger"]) ||
      v.policy !== FRAGRANT_PAIR_POLICY ||
      !Array.isArray(v.bindings)
    )
      return null;
    if (
      v.knownWolfId === null
        ? v.knowledgeNight !== null
        : !positive(v.knownWolfId) || v.knowledgeNight !== 1
    )
      return null;
    if (
      v.lastChoice !== null &&
      (!exact(v.lastChoice, ["day", "pairIds"]) ||
        !positive(v.lastChoice.day) ||
        (v.lastChoice.pairIds !== null && !pair(v.lastChoice.pairIds)))
    )
      return null;
    let previous = 0,
      pending = 0,
      triggered = 0;
    // 创建夜严格递增，到期夜固定为下一夜；状态日期在此核对，末次选择与绑定的关联随后完整复验。
    for (const b of v.bindings) {
      if (
        !exact(b, ["id", "createdNight", "expiresNight", "pairIds", "status"]) ||
        !positive(b.createdNight) ||
        b.createdNight <= previous ||
        b.expiresNight !== b.createdNight + 1 ||
        b.id !== `fragrant:night:${b.createdNight}` ||
        !pair(b.pairIds)
      )
        return null;
      previous = b.createdNight;
      if (exact(b.status, ["kind"]) && b.status.kind === "pending") pending++;
      else if (exact(b.status, ["kind", "day"]) && positive(b.status.day)) {
        if (b.status.kind === "expired" && b.status.day === b.expiresNight) {
        } else if (b.status.kind === "triggered" && b.status.day === b.createdNight) triggered++;
        else return null;
      } else return null;
    }
    if (pending > 1 || triggered > 1 || (pending && triggered)) return null;
    if (v.bindings.length && v.knowledgeNight !== 1) return null;
    if (
      pending &&
      (!exact(v.lastChoice, ["day", "pairIds"]) ||
        v.lastChoice.pairIds === null ||
        v.bindings.at(-1)?.status.kind !== "pending")
    )
      return null;
    if (
      triggered &&
      (v.bindings.at(-1)?.status.kind !== "triggered" ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        v.lastChoice.day !== v.bindings.at(-1)?.createdNight)
    )
      return null;
    if (
      v.bindings.length &&
      (!v.lastChoice ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        Number(v.lastChoice.day) < previous)
    )
      return null;
    if (v.bindings.length) {
      const latest = v.bindings.at(-1)!;
      if (!exact(v.lastChoice, ["day", "pairIds"])) return null;
      if (v.lastChoice.day === latest.createdNight) {
        if (
          v.lastChoice.pairIds === null ||
          JSON.stringify(v.lastChoice.pairIds) !== JSON.stringify(latest.pairIds)
        )
          return null;
      } else if (latest.status.kind !== "expired" || v.lastChoice.pairIds !== null) return null;
    } else if (
      v.lastChoice !== null &&
      exact(v.lastChoice, ["day", "pairIds"]) &&
      v.lastChoice.pairIds !== null
    )
      return null;
    // 回执必须对应唯一 triggered 绑定及原 pair 内的 root；追加目标可为 null，否则也须在 pair 内且不同于 root。
    if (v.trigger === null) {
      if (triggered) return null;
    } else {
      const r = v.trigger;
      if (
        !exact(r, ["bindingId", "day", "rootId", "addedTargetId"]) ||
        !positive(r.day) ||
        !positive(r.rootId) ||
        (r.addedTargetId !== null && !positive(r.addedTargetId))
      )
        return null;
      const b = v.bindings.find((b) => b.id === r.bindingId);
      if (
        !b ||
        triggered !== 1 ||
        b.status.kind !== "triggered" ||
        b.createdNight !== r.day ||
        !b.pairIds.includes(r.rootId) ||
        (r.addedTargetId !== null &&
          (r.addedTargetId === r.rootId || !b.pairIds.includes(r.addedTargetId)))
      )
        return null;
    }
    if (v.lastChoice !== null && v.knowledgeNight !== 1) return null;
    return v as unknown as FragrantState;
  } catch {
    return null;
  }
}
function valid(value: FragrantState): FragrantState {
  const s = readFragrantState(value);
  if (!s) throw Error("fragrant_state_invalid");
  return s;
}
export function commitKnownWolf(value: FragrantState, targetId: number): FragrantState {
  const s = valid(value);
  if (!positive(targetId) || s.knowledgeNight !== null)
    throw Error("fragrant_knowledge_already_committed");
  return { ...s, knownWolfId: targetId, knowledgeNight: 1 };
}
export function expireFragrantAtNightOpen(value: FragrantState, day: number): FragrantState {
  const s = valid(value);
  if (!positive(day) || (s.lastChoice && day <= s.lastChoice.day))
    throw Error("fragrant_night_invalid");
  return {
    ...s,
    bindings: s.bindings.map((b) =>
      b.status.kind === "pending" && b.expiresNight <= day
        ? { ...b, status: { kind: "expired" as const, day: b.expiresNight } }
        : b,
    ),
  };
}
export function chooseFragrantPair(
  value: FragrantState,
  day: number,
  targets: unknown,
): FragrantState {
  const s = valid(value);
  if (
    !positive(day) ||
    s.knowledgeNight !== 1 ||
    s.trigger ||
    s.bindings.some((b) => b.status.kind === "pending") ||
    (s.lastChoice && day <= s.lastChoice.day)
  )
    throw Error("fragrant_binding_unavailable");
  const pairIds = targets === null ? null : normalizePair(targets);
  return {
    ...s,
    lastChoice: { day, pairIds },
    bindings:
      pairIds === null
        ? s.bindings
        : [
            ...s.bindings,
            {
              id: `fragrant:night:${day}`,
              createdNight: day,
              expiresNight: day + 1,
              pairIds,
              status: { kind: "pending" },
            },
          ],
  };
}
/** 调用方证明真实原生命死亡；此纯回执不标记 World 或判胜。 */
export function triggerFragrantPair(
  value: FragrantState,
  day: number,
  rootId: number,
  addedTargetId: number | null,
): FragrantState {
  const s = valid(value),
    b = s.bindings.find((b) => b.status.kind === "pending");
  if (
    s.trigger ||
    !b ||
    day !== b.createdNight ||
    !b.pairIds.includes(rootId) ||
    (addedTargetId !== null && (addedTargetId === rootId || !b.pairIds.includes(addedTargetId)))
  )
    throw Error("fragrant_trigger_unavailable");
  return {
    ...s,
    bindings: s.bindings.map((row) =>
      row === b ? { ...row, status: { kind: "triggered" as const, day } } : row,
    ),
    trigger: { bindingId: b.id, day, rootId, addedTargetId },
  };
}

/** 原槽和已提交 JSON 仍是原 authority binding 的字段，不建立第二份 WeakMap 或影子状态。 */
export interface FragrantStateSlot {
  readonly fragrant: FragrantState;
  fragrantJson: string;
}
export interface FragrantStateSlotProof extends FragrantStateSlot {
  readonly phantom: { readonly privateState: object };
}

/** 完整原安装语句；写入左值容器先于 fresh callee 和新状态的创建。 */
export function installFragrantStateSlot(role: RoleComponent): void {
  (role.privateState as { fragrant: FragrantState }).fragrant = freshFragrantState();
}

/** 原 descriptor 写全部字段后才求 JSON callee／next；编码抛错保留已经完成的 live 字段写入。 */
export function commitFragrantStateSlot(o: FragrantStateSlot, next: FragrantState): void {
  write(o.fragrant, next);
  o.fragrantJson = JSON.stringify(next);
}

/** 使用 authority 原 own reader 和 sentinel，保持其参数读取与裸调用，不新增运行权限。 */
export function fragrantAliasesCurrent(
  o: FragrantStateSlotProof,
  own: (value: unknown, key: PropertyKey) => unknown,
): boolean {
  return own(o.phantom.privateState, "fragrant") === o.fragrant;
}

/** JSON callee 先于 schema callee、槽和已提交字段的读取；此数据比较仍在 Pair alias 检查之后。 */
export function fragrantDataCurrent(o: FragrantStateSlot): boolean {
  return JSON.stringify(readFragrantState(o.fragrant)) === o.fragrantJson;
}

/** 原安装已校验副本在原字段位置编码，不能把 schema 重新校验提前到付款点。 */
export function encodeFragrantState(state: FragrantState): string {
  return JSON.stringify(state);
}

/** 查找 JSON.parse callee 后才晚读原 JSON 字段，输出原可写副本；不生成新的行动原体。 */
export function decodeFragrantState(readJson: () => string): FragrantState {
  return JSON.parse(readJson()) as FragrantState;
}
