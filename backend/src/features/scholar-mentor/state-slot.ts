/**
 * 负责白昼学者／寂夜导师原状态 schema、脱离复制／选择以及 live 槽的库存、历史和内容快照。
 * 输入为原 caster／角色数据、初始化左值查询和通过 frame 原许可复验的 next；输出保原形状、引用与写入前缀。
 * 不变量：raw、remaining、history 三层原引用和脱离 JSON 内容分别核验；同内容替换不能续权。
 * 真实写入口只有初始化与已校验选择提交；副本、JSON 指纹和只读数据不是角色／生命／阶段或行动许可。
 * frame 仍拥有 roster、原生命、夜 pending／selections、加成与提交／关闭；有限板碰撞另归同族 rules。
 * 角色阵营渠道已退出；reader／project 以显式晚读 CurrentCampSource 获取实际 Camp，原 raw schema／写者不因此获得许可。
 */
import type { CurrentCampSource } from "../../domain/components/camp";
import type {
  ModifierCaster,
  ModifierMode,
  ModifierChoice,
  ModifierState,
  ModifierReadState,
} from "@ai-werewolf-arena/game-contract";
import { Camp } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";
import { types } from "node:util";

export const SCHOLAR_MENTOR_POLICY = "awa_scholar_mentor_twelve_v1" as const;
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    Reflect.ownKeys(descriptors).length === allowed.length &&
    allowed.every((key) => descriptors[key] !== undefined && "value" in descriptors[key]!)
  );
}
function arrayItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || types.isProxy(value)) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(descriptors).length !== length + 1
  )
    return undefined;
  const out: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) return undefined;
    out.push(descriptor.value);
  }
  return out;
}
export function createModifierState(caster: ModifierCaster): ModifierState {
  if (caster !== "day_scholar" && caster !== "night_mentor")
    throw new Error("modifier_caster_invalid");
  return {
    policy: SCHOLAR_MENTOR_POLICY,
    caster,
    remaining: { enhance: 1, weaken: 1 },
    history: [],
  };
}
export function readModifierState(value: unknown): ModifierState | undefined {
  if (
    !object(value) ||
    !keys(value, ["policy", "caster", "remaining", "history"]) ||
    value.policy !== SCHOLAR_MENTOR_POLICY ||
    (value.caster !== "day_scholar" && value.caster !== "night_mentor") ||
    !object(value.remaining) ||
    !keys(value.remaining, ["enhance", "weaken"]) ||
    !Array.isArray(value.history)
  )
    return undefined;
  const items = arrayItems(value.history);
  if (!items) return undefined;
  // 由逐条历史重算两种一次库存；只接受原严格数据形状，返回可写脱离副本。
  let last = 1,
    enhance = 1,
    weaken = 1;
  const history: ModifierChoice[] = [];
  for (const item of items) {
    if (
      !object(item) ||
      !keys(item, ["day", "mode", "targetId"]) ||
      typeof item.day !== "number" ||
      !Number.isSafeInteger(item.day) ||
      item.day >= Number.MAX_SAFE_INTEGER ||
      item.day <= last ||
      (item.mode !== null && item.mode !== "enhance" && item.mode !== "weaken")
    )
      return undefined;
    if (
      item.mode === null
        ? item.targetId !== null
        : typeof item.targetId !== "number" ||
          !Number.isSafeInteger(item.targetId) ||
          item.targetId < 1
    )
      return undefined;
    if (item.mode === "enhance") enhance--;
    if (item.mode === "weaken") weaken--;
    if (enhance < 0 || weaken < 0) return undefined;
    last = item.day;
    history.push({ day: item.day, mode: item.mode, targetId: item.targetId as number | null });
  }
  if (value.remaining.enhance !== enhance || value.remaining.weaken !== weaken) return undefined;
  return {
    policy: SCHOLAR_MENTOR_POLICY,
    caster: value.caster,
    remaining: { enhance, weaken },
    history,
  };
}
/** 脱离选择只校验与扣减返回副本；不向施法者披露实际效果／碰撞，也不提交 live 库存。 */
export function selectModifier(
  state: ModifierReadState,
  day: number,
  mode: ModifierMode | null,
  targetId: number | null,
  livingIds: readonly number[],
): ModifierState {
  const next = readModifierState(state);
  if (
    !next ||
    !Number.isSafeInteger(day) ||
    day >= Number.MAX_SAFE_INTEGER ||
    day < 2 ||
    day <= (next.history.at(-1)?.day ?? 1)
  )
    throw new Error("modifier_choice_day_invalid");
  if (mode !== null && mode !== "enhance" && mode !== "weaken")
    throw new Error("modifier_mode_invalid");
  if (
    mode === null
      ? targetId !== null
      : targetId === null ||
        !Number.isSafeInteger(targetId) ||
        targetId < 1 ||
        !livingIds.includes(targetId)
  )
    throw new Error("modifier_target_invalid");
  if (mode !== null) {
    if (next.remaining[mode] !== 1) throw new Error("modifier_charge_spent");
    next.remaining[mode] = 0;
  }
  next.history.push({ day, mode, targetId });
  return next;
}

export function modifierOwnData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}

export function modifierStateIdentity(raw: unknown): string {
  const value = readModifierState(raw);
  if (!value) throw new Error("scholar_mentor_original_state_revoked");
  return JSON.stringify(value);
}
/** 原 LHS 在 caster 和工厂之前读取；parse 配置仍在调用方先完成，不提前缓存 privateState。 */
export function initializeScholarMentorState(
  privateState: () => RoleComponent["privateState"],
  caster: () => ModifierCaster,
): void {
  (privateState() as { scholarMentor?: ModifierState }).scholarMentor =
    createModifierState(caster());
}

/** raw、资源与历史的原引用不是脱离副本；expected 仅保存原 JSON 内容证据，不代表授权或 JSON schema。 */
export class ScholarMentorStateSlot {
  state: ModifierReadState;
  remaining: ModifierReadState["remaining"];
  history: ModifierReadState["history"];
  expected: string;

  constructor(state: ModifierReadState) {
    this.state = state;
    this.remaining = state.remaining;
    this.history = state.history;
    this.expected = modifierStateIdentity(state);
  }

  /** frame 先在原时点取 raw；逐层引用失败就短路，之后才读取／复制原 schema 并比 JSON。 */
  matches(raw: unknown): boolean {
    return (
      raw === this.state &&
      modifierOwnData(this.state, "remaining") === this.remaining &&
      modifierOwnData(this.state, "history") === this.history &&
      modifierStateIdentity(this.state) === this.expected
    );
  }

  /** next 已完成原选择验证；先两项库存赋值，再查 defineProperty、历史两读／length／最后条目，再更新 expected。
   * 任一步抛错保已写前缀，不补回库存；frame 在此成功之后才删除 pending 并追加 selection。
   */
  commit(next: ModifierState): void {
    (this.remaining as Pick<ModifierState["remaining"], "enhance">).enhance =
      next.remaining.enhance;
    (this.remaining as Pick<ModifierState["remaining"], "weaken">).weaken = next.remaining.weaken;
    Object.defineProperty(this.history, String(this.history.length), {
      value: next.history.at(-1)!,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    this.expected = modifierStateIdentity(this.state);
  }
}

/** 只检查原角色／阵营和数据形状，返回原 raw 只读视图；不读取 board 或授予 modify_skill 权限。 */
// 先保原 role 读取，再无条件取得当前 Camp；即使身份随后拒绝，也不提前省略原 camp 点。
export function scholarMentorStateForRole(
  role: RoleComponent | undefined,
  currentCamp: CurrentCampSource,
): ModifierReadState | undefined {
  const name = modifierOwnData(role, "role"),
    camp = modifierOwnData(currentCamp(), "camp");
  if (
    (name !== "day_scholar" && name !== "night_mentor") ||
    camp !== (name === "day_scholar" ? Camp.Good : Camp.Wolf)
  )
    return undefined;
  const raw = modifierOwnData(modifierOwnData(role, "privateState"), "scholarMentor"),
    value = readModifierState(raw);
  return value?.caster === name ? (raw as ModifierReadState) : undefined;
}
