/**
 * 黯月独立 history 的严格读取、纯选择与原私有状态投影。共享政策和 scalar reader 来自
 * state-data，数组与吞噬 history 的完整校验仍在此处；本模块不写 live 能力或借用 lease。
 * 明辉庇护的数据已归独立 owner，不能借迁移合并两种状态的验证或付款规则。
 */
import type { RoleComponent } from "../../../../core/domain/components/role";

import { types } from "node:util";
import { RADIANT_ECLIPSE_POLICY, record, positive } from "./state-data";
export { RADIANT_ECLIPSE_POLICY } from "./state-data";

const goodRoles = ["villager", "seer", "witch", "dreamer", "radiant_count"] as const;
export type EclipseSwallowedRole = (typeof goodRoles)[number];
export interface EclipseState {
  policy: typeof RADIANT_ECLIPSE_POLICY;
  history: Array<{
    day: number;
    targetId: number | null;
    roleId: EclipseSwallowedRole | null;
    abilityId: string | null;
  }>;
}

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

/** 原 Eclipse 私有槽仍通过既有 reader 投影为独立数据。 */
export function projectEclipseState(role: RoleComponent): EclipseState | undefined {
  return readEclipseState((role.privateState as { readonly eclipse?: unknown }).eclipse);
}
