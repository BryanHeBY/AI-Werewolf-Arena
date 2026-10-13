/**
 * 负责血月使徒状态创建、原体槽位校验和玩家可读字段投影；输入是原角色与既有政策。
 * 校验成功时仍返回原状态引用，投影则只复制原玩家可见的五个字段，不暴露写句柄。
 * 保留数据属性检查与政策、身份约束；不消耗自爆、关闭到期流程或授予死亡效果权限。
 */
import type {
  LastWolfBlastPolicy,
  RedMoonState,
  RedMoonReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp } from "../../../../core/domain/identity";

export const RED_MOON_ROLE = "red_moon_apostle" as const;
export const RED_MOON_POLICY = "awa_red_moon_demon_v1" as const;
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && "value" in field ? field.value : undefined;
}
function day(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
export function freshRedMoonState(
  lastWolfBlastPolicy: LastWolfBlastPolicy = "ends_game",
): RedMoonState {
  return {
    policy: RED_MOON_POLICY,
    lastWolfBlastPolicy,
    blastDay: null,
    exileDay: null,
    expirySettled: false,
  };
}
export function getRedMoonState(role: RoleComponent | undefined): RedMoonReadState | undefined {
  if (own(role, "role") !== RED_MOON_ROLE || own(role, "camp") !== Camp.Wolf) return undefined;
  const state = own(own(role, "privateState"), "redMoon");
  if (!state || typeof state !== "object" || types.isProxy(state)) return undefined;
  const expected = ["policy", "lastWolfBlastPolicy", "blastDay", "exileDay", "expirySettled"];
  const fields = Object.getOwnPropertyDescriptors(state);
  if (
    Reflect.ownKeys(fields).length !== expected.length ||
    !expected.every((key) => fields[key] && "value" in fields[key]!)
  )
    return undefined;
  const policy = own(state, "lastWolfBlastPolicy");
  const blast = own(state, "blastDay"),
    exile = own(state, "exileDay");
  const settled = own(state, "expirySettled");
  if (
    own(state, "policy") !== RED_MOON_POLICY ||
    (policy !== "ends_game" && policy !== "forbidden") ||
    (blast !== null && !day(blast)) ||
    (exile !== null && !day(exile)) ||
    (blast !== null && exile !== null) ||
    typeof settled !== "boolean" ||
    (settled && exile === null)
  )
    return undefined;
  return state as RedMoonReadState;
}

/** 机制自己决定玩家字段；校验失败仍为 undefined，不补默认政策或猜测到期结果。 */
export function projectRedMoonState(role: RoleComponent | undefined): RedMoonState | undefined {
  const redMoon = getRedMoonState(role);
  if (redMoon)
    return {
      policy: redMoon.policy,
      lastWolfBlastPolicy: redMoon.lastWolfBlastPolicy,
      blastDay: redMoon.blastDay,
      exileDay: redMoon.exileDay,
      expirySettled: redMoon.expirySettled,
    };
}
