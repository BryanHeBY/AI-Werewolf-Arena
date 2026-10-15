/**
 * 负责乌鸦唯一私有数据槽的初始化、结构读取、历史付款及脱离投影。
 * 输入为原角色容器或已脱离值，输出原live状态或逐字段复制的本人知识；访问器和Proxy不当作合法状态。
 * 本模块仅写自己的历史，不拥有夜请求/原生命权限；投影不带额外字段，God录制保留完整原容器。
 */
import { types } from "node:util";
import type { CrowConfig, CrowState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";
import type { RoleInitializationComponent } from "../../rulesets/roles/contracts";
export const CROW_DEFAULTS: CrowConfig = Object.freeze({
  policy: "awa_netease_crow_v1",
  ballotPolicy: "initial_ballot_only",
  actionPolicy: "optional",
  selfTarget: false,
});
function own(v: unknown, key: string): unknown {
  if (!v || typeof v !== "object" || types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
export function readCrowStateData(value: unknown): CrowState | undefined {
  const s = own(value, "crow");
  const policy = own(s, "policy"),
    ballotPolicy = own(s, "ballotPolicy"),
    actionPolicy = own(s, "actionPolicy"),
    selfTarget = own(s, "selfTarget"),
    history = own(s, "history");
  if (
    policy !== CROW_DEFAULTS.policy ||
    (ballotPolicy !== "initial_ballot_only" && ballotPolicy !== "all_ballots") ||
    (actionPolicy !== "optional" && actionPolicy !== "required_when_legal") ||
    typeof selfTarget !== "boolean" ||
    !Array.isArray(history) ||
    types.isProxy(history)
  )
    return undefined;
  // 新槽只接受稠密普通数组；不接纳自定义at/map、索引访问器或数组扩展字段。
  if (
    Object.getPrototypeOf(history) !== Array.prototype ||
    Reflect.ownKeys(history).length !== history.length + 1
  )
    return undefined;
  let last = 0;
  for (let i = 0; i < history.length; i++) {
    const h = own(history, String(i)),
      day = own(h, "day"),
      target = own(h, "targetId");
    if (
      typeof day !== "number" ||
      !Number.isSafeInteger(day) ||
      day <= last ||
      (target !== null &&
        (typeof target !== "number" || !Number.isSafeInteger(target) || target <= 0))
    )
      return undefined;
    last = day;
  }
  return s as CrowState;
}
export function crowState(role: RoleComponent | undefined): CrowState | undefined {
  return own(role, "role") === "crow" ? readCrowStateData(own(role, "privateState")) : undefined;
}
export function initializeCrow(role: RoleInitializationComponent, config: CrowConfig): void {
  role.privateState.crow = { ...config, history: [] };
}
export function projectCrowState(role: RoleComponent | undefined): CrowState | undefined {
  const s = crowState(role);
  return s
    ? {
        policy: s.policy,
        ballotPolicy: s.ballotPolicy,
        actionPolicy: s.actionPolicy,
        selfTarget: s.selfTarget,
        history: Array.from({ length: s.history.length }, (_, index) => ({
          day: s.history[index]!.day,
          targetId: s.history[index]!.targetId,
        })),
      }
    : undefined;
}
/** 历史追加为唯一付款点；调用方已完成最后当前性检查，失败不退款或伪造事实。 */
export function commitCrowState(state: CrowState, day: number, targetId: number | null): void {
  state.history.push({ day, targetId });
}
