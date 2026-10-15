/**
 * 负责蚀日侍女的初态安装、完整严格历史读取／选择／玩家投影及唯一原状态身份编码。
 * 输入为原角色容器、数据与实际日次／候选；输出为原槽、独立历史副本或具名拒绝。
 * 运行绑定只持同一 raw 对象和原 normalized JSON 字符串，不保存第二份历史或借用权威；只读类型不冻结库存。
 * 原字段集合、descriptor／Proxy拒绝及连续目标规则保持；初始化先读左值容器，提交先 Object.assign 再编码。
 * 字段写入或后续 JSON 失败保留已写前缀及旧编码；World、生命、许可、借用／抑制／付款和夜间关闭仍归 frame。
 * 本地编码只核状态替换／内容变更，不是归档格式、sourceHash 或行动授权；流光伯爵庇护沿独立所有者。
 */
import type { EclipseState, EclipseSwallowedRole } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import type { RoleComponent } from "../../domain/components/role";

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

/** 原 profile 的左值容器读取先于初态创建；只安装此槽，不替换容器或主动清理已有能力。 */
export function initializeEclipseState(role: RoleComponent): void {
  (role.privateState as { eclipse: EclipseState }).eclipse = createEclipseState();
}

/**
 * 唯一运行数据绑定：raw 是原 live 引用，expected 只保存严格 reader 归一化后的 JSON 身份。
 * parsed 仅在原安装位置编码一次、不持有其副本；绑定不拥有玩家名单、生命或 borrowed lease。
 */
export class EclipseStateBinding {
  readonly #state: EclipseState;
  #expected: string;

  constructor(state: EclipseState, parsed: EclipseState) {
    this.#state = state;
    this.#expected = JSON.stringify(parsed);
  }

  /** 原名单／能力核对完成后才读原槽；引用不同先拒绝，不执行后续历史读取或 JSON 编码。 */
  assertCurrent(readOriginal: () => unknown): void {
    if (
      readOriginal() !== this.#state ||
      JSON.stringify(readEclipseState(this.#state)) !== this.#expected
    )
      throw new Error("eclipse_state_revoked");
  }

  /** 原严格读取仍逐次复制历史；返回最后选择只供候选规则，不能由此取得本夜借用许可。 */
  lastChoice(): EclipseState["history"][number] | undefined {
    return readEclipseState(this.#state)!.history.at(-1);
  }

  /** select callee／原状态先取，再在原参数位置查询 goodIds；不提前捕获候选或重建来源生命。 */
  next(day: number, targetId: unknown, goodIds: () => readonly number[], roleId: unknown): EclipseState {
    return selectEclipse(this.#state, day, targetId, goodIds(), roleId);
  }

  /**
   * 原 borrowed/allowed 前缀已由 frame 提交；本步按原 Object.assign 的字段序写同一 raw，随后才更新身份。
   * assign 的部分失败或 JSON 失败不回滚字段、不刷新旧编码，也不设置 frame 的 swallowed／lease／事件。
   */
  install(next: EclipseState): void {
    Object.assign(this.#state, next);
    this.#expected = JSON.stringify(next);
  }
}
