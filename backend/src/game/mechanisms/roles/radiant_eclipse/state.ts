/**
 * 负责蚀日侍女吞噬历史的严格读取、纯选择与原私有槽的数据投影。
 * 输入为原状态、日次和目标；输出为独立 history 副本或原具名错误，不写 live 能力或借用租约。
 * 公共结构唯一归 GC facts/radiant-eclipse；本 owner 保留原 runtime 五角色数组和全部校验，
 * scalar 读取仍来自 state-data。流光伯爵庇护的验证／付款独立，不能因类型迁移合并规则。
 */
import type { EclipseState, EclipseSwallowedRole } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import type { RoleComponent } from "../../../../core/domain/components/role";

import { types } from "node:util";
import { RADIANT_ECLIPSE_POLICY, record, positive } from "./state-data";
export { RADIANT_ECLIPSE_POLICY } from "./state-data";

const goodRoles = ["villager", "seer", "witch", "dreamer", "radiant_count"] as const;

function items(value: unknown): unknown[] | undefined {
  if (types.isProxy(value) || !Array.isArray(value)) return;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    value as object,
  );
  const length: unknown = fields.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return;
  const out: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const field = fields[String(index)];
    if (!field || !("value" in field)) return;
    out.push(field.value);
  }
  return out;
}

export const createEclipseState = (): EclipseState => ({
  policy: RADIANT_ECLIPSE_POLICY,
  history: [],
});

export function readEclipseState(value: unknown): EclipseState | undefined {
  const current = record(value, ["policy", "history"]);
  if (!current || current.policy !== RADIANT_ECLIPSE_POLICY) return;
  const entries = items(current.history);
  if (!entries) return;
  const history: EclipseState["history"] = [];
  let previous: EclipseState["history"][number] | undefined;
  for (const entry of entries) {
    const choice = record(entry, ["day", "targetId", "roleId", "abilityId"]);
    if (
      !choice ||
      !positive(choice.day) ||
      choice.day < 2 ||
      (previous && choice.day <= previous.day) ||
      (choice.targetId !== null && !positive(choice.targetId))
    )
      return;
    if (choice.targetId === null) {
      if (choice.roleId !== null || choice.abilityId !== null) return;
    } else {
      if (!(goodRoles as readonly unknown[]).includes(choice.roleId)) return;
      if (
        choice.roleId === "villager"
          ? choice.abilityId !== null
          : choice.abilityId !== `copy:eclipse:night:${choice.day}`
      )
        return;
      if (previous?.day === choice.day - 1 && previous.targetId === choice.targetId) return;
    }
    previous = {
      day: choice.day,
      targetId: choice.targetId as number | null,
      roleId: choice.roleId as EclipseSwallowedRole | null,
      abilityId: choice.abilityId as string | null,
    };
    history.push(previous);
  }
  return { policy: RADIANT_ECLIPSE_POLICY, history };
}
export function selectEclipse(
  state: EclipseState,
  day: number,
  targetId: unknown,
  goodIds: readonly number[],
  roleId: unknown,
): EclipseState {
  const current = readEclipseState(state),
    last = current?.history.at(-1);
  if (!current || !positive(day) || day < 2 || (last && day <= last.day))
    throw new Error("eclipse_swallow_unavailable");
  if (targetId === null) {
    if (roleId !== null) throw new Error("eclipse_swallow_target");
  } else if (
    !positive(targetId) ||
    !goodIds.includes(targetId) ||
    !(goodRoles as readonly unknown[]).includes(roleId) ||
    (last?.day === day - 1 && last.targetId === targetId)
  )
    throw new Error("eclipse_swallow_target");
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    history: [
      ...current.history,
      {
        day,
        targetId: targetId as number | null,
        roleId: roleId as EclipseSwallowedRole | null,
        abilityId: targetId === null || roleId === "villager" ? null : `copy:eclipse:night:${day}`,
      },
    ],
  };
}

/** 蚀日侍女原私有槽仍经既有 reader 逐行复制；ID 知识不是 live 借用句柄。 */
export function projectEclipseState(role: RoleComponent): EclipseState | undefined {
  return readEclipseState((role.privateState as { readonly eclipse?: unknown }).eclipse);
}
