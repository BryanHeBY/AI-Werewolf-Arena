/**
 * 负责觉醒守卫唯一周期历史槽的安装与替换。输入为原World／Role和严格下一历史，输出原状态或脱离投影。
 * 资源仅在同一cycles中记录；WeakMap只保原容器／状态身份及撤权墓碑，不持可用次数或另一份保护名单。
 * 只有原自有数据槽可写，访问器／Proxy／同形替换必须拒绝；字段恢复不复活已经观察到的撤权。
 */
import { types } from "node:util";
import {
  AWAKENED_GUARD_POLICY,
  readAwakenedGuardStateData,
  type AwakenedGuardCycle,
  type AwakenedGuardState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import type { World } from "../../domain/world";
import type { RoleComponent } from "../../domain/components/role";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { snapshotPlainData } from "../../domain/plain-data";
interface Owner {
  readonly world: World;
  readonly container: object;
  state: AwakenedGuardState;
  revoked: boolean;
}
const owners = new WeakMap<RoleComponent, Owner>();
// 工厂品牌只证明已校验且深冻结；合法状态迁移另在唯一writer核验，不凭同形JSON取得写权。
const prepared = new WeakSet<AwakenedGuardState>();
function own(v: unknown, key: string): unknown {
  if (!v || typeof v !== "object" || types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
export function prepareGuardCycles(cycles: readonly AwakenedGuardCycle[]): AwakenedGuardState {
  const data = readAwakenedGuardStateData({ policy: AWAKENED_GUARD_POLICY, cycles });
  if (!data) throw new Error("awakened_guard_history_invalid");
  const state = Object.freeze({
    policy: AWAKENED_GUARD_POLICY,
    cycles: Object.freeze(data.cycles.map((c) => Object.freeze({ ...c }))),
  });
  prepared.add(state);
  return state;
}
export function initializeAwakenedGuardState(role: RoleComponent, world: World): void {
  const container = own(role, "privateState"),
    state = prepareGuardCycles([]);
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedGuard") !== undefined ||
    owners.has(role)
  )
    throw new Error("awakened_guard_install_invalid");
  Object.defineProperty(container, "awakenedGuard", {
    value: state,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  owners.set(role, { world, container, state, revoked: false });
}
export function getAwakenedGuardState(
  role: RoleComponent | undefined,
): AwakenedGuardState | undefined {
  const value = own(own(role, "privateState"), "awakenedGuard");
  try {
    return readAwakenedGuardStateData(snapshotPlainData(value, new Set(), 0, 65536))
      ? (value as AwakenedGuardState)
      : undefined;
  } catch {
    return undefined;
  }
}
export function ownedGuardState(world: World, role: RoleComponent): AwakenedGuardState | undefined {
  const owner = owners.get(role);
  if (!owner || owner.world !== world || owner.revoked) return undefined;
  if (
    isRoleExecutionRetired(role) ||
    own(role, "privateState") !== owner.container ||
    getAwakenedGuardState(role) !== owner.state
  ) {
    owner.revoked = true;
    return undefined;
  }
  return owner.state;
}
/** 原slot唯一替换；首写前原体/窗口由authority的稳定ECS检查负责，本函数只拥有本族资源槽。 */
export function replaceGuardState(
  world: World,
  role: RoleComponent,
  expected: AwakenedGuardState,
  next: AwakenedGuardState,
): void {
  if (!prepared.has(next) || ownedGuardState(world, role) !== expected)
    throw new Error("awakened_guard_state_revoked");
  const same = (a: AwakenedGuardCycle, b: AwakenedGuardCycle) =>
    a.day === b.day &&
    a.status === b.status &&
    (a.status !== "protected" ||
      (b.status === "protected" && a.targetId === b.targetId && a.timing === b.timing));
  const before = expected.cycles,
    after = next.cycles,
    last = before.at(-1);
  const append =
    after.length === before.length + 1 &&
    after.at(-1)?.status === "open" &&
    before.every(
      (row, i) =>
        same(row, after[i]!) ||
        (i === before.length - 1 &&
          row.status === "open" &&
          after[i]!.status === "unused" &&
          row.day === after[i]!.day),
    );
  const settle =
    before.length > 0 &&
    after.length === before.length &&
    last?.status === "open" &&
    after.at(-1)?.day === last.day &&
    after.at(-1)?.status !== "open" &&
    before.slice(0, -1).every((row, i) => same(row, after[i]!));
  if (!append && !settle) throw new Error("awakened_guard_transition_invalid");
  const owner = owners.get(role)!,
    descriptor = Object.getOwnPropertyDescriptor(owner.container, "awakenedGuard");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    !descriptor.writable ||
    descriptor.value !== expected
  )
    throw new Error("awakened_guard_state_revoked");
  Object.defineProperty(owner.container, "awakenedGuard", { ...descriptor, value: next });
  owner.state = next;
}
