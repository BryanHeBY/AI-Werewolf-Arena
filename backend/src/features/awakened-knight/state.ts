/**
 * 负责觉醒骑士唯一已付尝试历史槽。输入为原World／Role和严格下一历史，输出原状态或脱离投影。
 * 全局目标使用资格只从attempts推导；原容器／状态身份与撤权墓碑保在弱绑定，不复制库存或生命。
 * 仅原自有数据槽能替换，重复安装、访问器、Proxy及同形clone均不能重新获得写权；异常保已写前缀。
 */
import { types } from "node:util";
import {
  AWAKENED_DUEL_POLICY,
  readAwakenedKnightStateData,
  type AwakenedDuelAttempt,
  type AwakenedKnightState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import type { World } from "../../domain/world";
import type { RoleComponent } from "../../domain/components/role";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { snapshotPlainData } from "../../domain/plain-data";
interface Owner {
  readonly world: World;
  readonly container: object;
  state: AwakenedKnightState;
  revoked: boolean;
}
const owners = new WeakMap<RoleComponent, Owner>();
const prepared = new WeakSet<AwakenedKnightState>();
function own(v: unknown, key: string): unknown {
  if (!v || typeof v !== "object" || types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
export function prepareDuelAttempts(attempts: readonly AwakenedDuelAttempt[]): AwakenedKnightState {
  const data = readAwakenedKnightStateData({ policy: AWAKENED_DUEL_POLICY, attempts });
  if (!data) throw new Error("awakened_duel_history_invalid");
  const state = Object.freeze({
    policy: AWAKENED_DUEL_POLICY,
    attempts: Object.freeze(data.attempts.map((a) => Object.freeze({ ...a }))),
  });
  prepared.add(state);
  return state;
}
export function initializeAwakenedKnightState(role: RoleComponent, world: World): void {
  const container = own(role, "privateState"),
    state = prepareDuelAttempts([]);
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedKnight") !== undefined ||
    owners.has(role)
  )
    throw new Error("awakened_knight_install_invalid");
  Object.defineProperty(container, "awakenedKnight", {
    value: state,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  owners.set(role, { world, container, state, revoked: false });
}
export function getAwakenedKnightState(
  role: RoleComponent | undefined,
): AwakenedKnightState | undefined {
  const value = own(own(role, "privateState"), "awakenedKnight");
  try {
    return readAwakenedKnightStateData(snapshotPlainData(value, new Set(), 0, 65536))
      ? (value as AwakenedKnightState)
      : undefined;
  } catch {
    return undefined;
  }
}
export function ownedKnightState(
  world: World,
  role: RoleComponent,
): AwakenedKnightState | undefined {
  const owner = owners.get(role);
  if (!owner || owner.world !== world || owner.revoked) return undefined;
  if (
    isRoleExecutionRetired(role) ||
    own(role, "privateState") !== owner.container ||
    getAwakenedKnightState(role) !== owner.state
  ) {
    owner.revoked = true;
    return undefined;
  }
  return owner.state;
}
/** CAS只替换同一原slot；动作授权、实际camp及两端原生命由本族authority最后稳定核验。 */
export function replaceKnightState(
  world: World,
  role: RoleComponent,
  expected: AwakenedKnightState,
  next: AwakenedKnightState,
): void {
  if (!prepared.has(next) || ownedKnightState(world, role) !== expected)
    throw new Error("awakened_knight_state_revoked");
  // writer只追加一份真实尝试；不接受清空、改原分支／目标、一次批量跳过多次付款。
  if (
    next.attempts.length !== expected.attempts.length + 1 ||
    !expected.attempts.every((a, i) => {
      const b = next.attempts[i]!;
      return (
        a.day === b.day && a.chain === b.chain && a.targetId === b.targetId && a.branch === b.branch
      );
    })
  )
    throw new Error("awakened_knight_transition_invalid");
  const owner = owners.get(role)!,
    descriptor = Object.getOwnPropertyDescriptor(owner.container, "awakenedKnight");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    !descriptor.writable ||
    descriptor.value !== expected
  )
    throw new Error("awakened_knight_state_revoked");
  Object.defineProperty(owner.container, "awakenedKnight", { ...descriptor, value: next });
  owner.state = next;
}
