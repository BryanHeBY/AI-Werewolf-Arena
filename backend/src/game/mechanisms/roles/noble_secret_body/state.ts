/**
 * 负责夜之贵族／秘密之身的初始数据、原接受集合、纯状态转换和同引用状态槽。
 * 输入为原数据、选择或已由权威复验的下一状态；输出为归一化副本、原槽写入和本地审计影子。
 * 槽拥有唯一两份 JSON 影子，先按原描述符次序写原对象，再编码下一状态；失败保留已写前缀。
 * World、原体／生命、请求、夜间和实际付款仍归 authority；本地影子不是归档 schema 或行动许可。
 */
import { types } from "node:util";
import type { RoleInitializationComponent } from "../contracts";
import type { SecretBodyCause } from "./damage";
export const NOBLE_SECRET_BODY_POLICY = "awa_noble_secret_body_v1" as const;
export type NobleWolfPolicy = "standard" | "no_blast_no_self_knife";
export type BodyRepeatPolicy = "awa_nonconsecutive_nights_v1" | "awa_repeat_v1";
/** 主动选择记录包含合法空过；它不代表伤害已发生或一次资源已付款，真实 lease 仍由权威持有。 */
export interface NightChoice {
  day: number;
  targetId: number | null;
}
/** 一次身体的实际耗用终态：夜间最终抵伤与白天免放逐分别记录，exile_revealed 不是死亡。 */
export type BodyResource =
  | { kind: "intact" }
  | { kind: "night_spent"; day: number; targetId: number; cause: SecretBodyCause }
  | { kind: "exile_revealed"; day: number };
export interface SecretBodyState {
  policy: typeof NOBLE_SECRET_BODY_POLICY;
  protectionRepeatPolicy: BodyRepeatPolicy;
  lastChoice: NightChoice | null;
  body: BodyResource;
}
/** 历史契约保存一次终态；到期日只供后续权威产生提案，本数据不标死目标或重开选择窗口。 */
export interface ServantContract {
  id: string;
  targetId: number;
  createdNight: number;
  expiresNight: number;
  status: { kind: "pending" } | { kind: "cleared" | "expired" | "target_dead"; day: number };
}
export interface NobleState {
  policy: typeof NOBLE_SECRET_BODY_POLICY;
  wolfActionPolicy: NobleWolfPolicy;
  lastChoice: NightChoice | null;
  contracts: ServantContract[];
}
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER - 1
  );
}
function data(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length) return;
  // 原 schema 读取 own data descriptor 后生成副本；不执行 getter，也不把副本当成原对象身份。
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field || !("value" in field)) return;
    result[key] = field.value;
  }
  return result;
}
function dense(value: unknown): unknown[] | undefined {
  if (
    types.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      value as object,
    ),
    length: unknown = fields.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const field = fields[String(i)];
    if (!field || !("value" in field)) return;
    result.push(field.value);
  }
  return result;
}
function livingSnapshot(value: unknown): number[] {
  const ids = dense(value);
  if (!ids || ids.some((id) => !positive(id)) || new Set(ids).size !== ids.length)
    throw Error("noble_secret_body_roster_invalid");
  return ids as number[];
}
function choice(value: unknown): NightChoice | null | undefined {
  if (value === null) return null;
  const row = data(value, ["day", "targetId"]);
  if (!row || !positive(row.day) || (row.targetId !== null && !positive(row.targetId))) return;
  return { day: row.day, targetId: row.targetId as number | null };
}
export function createSecretBodyState(
  policy: BodyRepeatPolicy = "awa_nonconsecutive_nights_v1",
): SecretBodyState {
  if (policy !== "awa_nonconsecutive_nights_v1" && policy !== "awa_repeat_v1")
    throw Error("secret_body_policy_invalid");
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    protectionRepeatPolicy: policy,
    lastChoice: null,
    body: { kind: "intact" },
  };
}
/**
 * 安装原身体初态；先求值赋值左侧的 privateState，再调用原工厂和惰性政策输入，最后写该槽。
 * 政策解析仍由 profile 的原 schema 负责；解析／工厂失败不写槽，setter 失败保原异常而不补偿。
 */
export function installSecretBodyState(
  role: Pick<RoleInitializationComponent, "privateState">,
  readPolicy: () => BodyRepeatPolicy | undefined,
): void {
  role.privateState.secretBody = createSecretBodyState(readPolicy());
}
export function readSecretBodyState(value: unknown): SecretBodyState | undefined {
  const row = data(value, ["policy", "protectionRepeatPolicy", "lastChoice", "body"]);
  if (
    !row ||
    row.policy !== NOBLE_SECRET_BODY_POLICY ||
    !["awa_nonconsecutive_nights_v1", "awa_repeat_v1"].includes(
      row.protectionRepeatPolicy as string,
    )
  )
    return;
  const last = choice(row.lastChoice);
  if (last === undefined) return;
  let body: BodyResource | undefined;
  const intact = data(row.body, ["kind"]);
  if (intact?.kind === "intact") body = { kind: "intact" };
  const night = data(row.body, ["kind", "day", "targetId", "cause"]);
  if (
    night?.kind === "night_spent" &&
    positive(night.day) &&
    positive(night.targetId) &&
    ["wolf_kill", "poison", "demon_hunt", "demon_hunt_backlash", "servant_expiry"].includes(
      night.cause as string,
    ) &&
    last?.day === night.day
  )
    body = {
      kind: "night_spent",
      day: night.day,
      targetId: night.targetId,
      cause: night.cause as SecretBodyCause,
    };
  const exile = data(row.body, ["kind", "day"]);
  if (exile?.kind === "exile_revealed" && positive(exile.day) && (!last || last.day <= exile.day))
    body = { kind: "exile_revealed", day: exile.day };
  if (!body) return;
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    protectionRepeatPolicy: row.protectionRepeatPolicy as BodyRepeatPolicy,
    lastChoice: last,
    body,
  };
}
export function chooseBodyTarget(
  raw: SecretBodyState,
  day: number,
  targetId: number | null,
  livingIds: readonly number[],
): SecretBodyState {
  const state = readSecretBodyState(raw),
    living = livingSnapshot(livingIds);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    (state.lastChoice && state.lastChoice.day >= day)
  )
    throw Error("secret_body_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) ||
      !living.includes(targetId) ||
      (state.protectionRepeatPolicy === "awa_nonconsecutive_nights_v1" &&
        state.lastChoice?.day === day - 1 &&
        state.lastChoice.targetId === targetId))
  )
    throw Error("secret_body_target");
  return { ...state, lastChoice: { day, targetId } };
}
/** 原生命授权归调用方；调用方将此消费与最终有效抵伤同步提交，本函数只准备下一数据。 */
export function spendBodyForNight(
  raw: SecretBodyState,
  day: number,
  actorId: number,
  block: { targetId: number; cause: SecretBodyCause },
): SecretBodyState {
  const state = readSecretBodyState(raw);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    !positive(actorId) ||
    state.lastChoice?.day !== day
  )
    throw Error("secret_body_unavailable");
  const proposed = data(block, ["targetId", "cause"]);
  if (
    !proposed ||
    !positive(proposed.targetId) ||
    !["wolf_kill", "poison", "demon_hunt", "demon_hunt_backlash", "servant_expiry"].includes(
      proposed.cause as string,
    ) ||
    (proposed.targetId !== actorId && proposed.targetId !== state.lastChoice.targetId)
  )
    throw Error("secret_body_block_invalid");
  return {
    ...state,
    body: {
      kind: "night_spent",
      day,
      targetId: proposed.targetId,
      cause: proposed.cause as SecretBodyCause,
    },
  };
}
export function revealBodyByExile(raw: SecretBodyState, day: number): SecretBodyState {
  const state = readSecretBodyState(raw);
  if (
    !state ||
    state.body.kind !== "intact" ||
    !positive(day) ||
    (state.lastChoice && state.lastChoice.day > day)
  )
    throw Error("secret_body_unavailable");
  return { ...state, body: { kind: "exile_revealed", day } };
}
export function createNobleState(policy: NobleWolfPolicy = "standard"): NobleState {
  if (policy !== "standard" && policy !== "no_blast_no_self_knife")
    throw Error("night_noble_policy_invalid");
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    wolfActionPolicy: policy,
    lastChoice: null,
    contracts: [],
  };
}
/** 与身体槽保持相同的左值先读顺序；将贵族槽重设为初态，现场许可和审计影子继续归 authority，本命令不更新它们。 */
export function installNobleState(
  role: Pick<RoleInitializationComponent, "privateState">,
  readPolicy: () => NobleWolfPolicy | undefined,
): void {
  role.privateState.noble = createNobleState(readPolicy());
}
export function readNobleState(value: unknown): NobleState | undefined {
  const row = data(value, ["policy", "wolfActionPolicy", "lastChoice", "contracts"]);
  if (
    !row ||
    row.policy !== NOBLE_SECRET_BODY_POLICY ||
    !["standard", "no_blast_no_self_knife"].includes(row.wolfActionPolicy as string)
  )
    return;
  const last = choice(row.lastChoice),
    rows = dense(row.contracts);
  if (last === undefined || !rows || (last && last.day < 2)) return;
  const contracts: ServantContract[] = [];
  for (const raw of rows) {
    const contract = data(raw, ["id", "targetId", "createdNight", "expiresNight", "status"]);
    if (
      !contract ||
      !positive(contract.targetId) ||
      !positive(contract.createdNight) ||
      contract.createdNight < 2 ||
      contract.id !== `servant:night:${contract.createdNight}` ||
      contract.expiresNight !== contract.createdNight + 1
    )
      return;
    const previous = contracts.at(-1);
    if (
      previous &&
      (previous.status.kind === "pending" || contract.createdNight <= previous.status.day)
    )
      return;
    let status: ServantContract["status"] | undefined;
    if (data(contract.status, ["kind"])?.kind === "pending") status = { kind: "pending" };
    const ended = data(contract.status, ["kind", "day"]);
    if (
      ended &&
      ["cleared", "expired", "target_dead"].includes(ended.kind as string) &&
      positive(ended.day) &&
      ended.day >= contract.createdNight &&
      ended.day <= Number(contract.expiresNight) &&
      (ended.kind !== "expired" || ended.day === contract.expiresNight)
    )
      status = { kind: ended.kind as "cleared" | "expired" | "target_dead", day: ended.day };
    if (!status) return;
    contracts.push({
      id: contract.id as string,
      targetId: contract.targetId,
      createdNight: contract.createdNight,
      expiresNight: Number(contract.expiresNight),
      status,
    });
  }
  const latest = contracts.at(-1);
  if (
    latest &&
    (!last ||
      last.day < latest.createdNight ||
      (last.day === latest.createdNight && last.targetId !== latest.targetId) ||
      (last.day > latest.createdNight &&
        (last.targetId !== null ||
          latest.status.kind === "pending" ||
          last.day <= latest.status.day)) ||
      (latest.status.kind === "pending" && last.day !== latest.createdNight))
  )
    return;
  if (!latest && last?.targetId !== null && last !== null) return;
  return {
    policy: NOBLE_SECRET_BODY_POLICY,
    wolfActionPolicy: row.wolfActionPolicy as NobleWolfPolicy,
    lastChoice: last,
    contracts,
  };
}
export function chooseServant(
  raw: NobleState,
  day: number,
  targetId: number | null,
  actorId: number,
  livingIds: readonly number[],
): NobleState {
  const state = readNobleState(raw),
    living = livingSnapshot(livingIds),
    latest = state?.contracts.at(-1);
  if (
    !state ||
    !positive(day) ||
    day < 2 ||
    !positive(actorId) ||
    (state.lastChoice && state.lastChoice.day >= day) ||
    state.contracts.some((c) => c.status.kind === "pending") ||
    (latest && latest.status.kind !== "pending" && day <= latest.status.day)
  )
    throw Error("night_noble_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) || targetId === actorId || !living.includes(targetId))
  )
    throw Error("night_noble_target");
  return {
    ...state,
    lastChoice: { day, targetId },
    contracts:
      targetId === null
        ? state.contracts
        : [
            ...state.contracts,
            {
              id: `servant:night:${day}`,
              targetId,
              createdNight: day,
              expiresNight: day + 1,
              status: { kind: "pending" },
            },
          ],
  };
}
/** 准备一次终态转换；原权威／目标生命复验和到期伤害来源的提交仍由控制方负责。 */
export function endServant(
  raw: NobleState,
  id: string,
  day: number,
  kind: "cleared" | "expired" | "target_dead",
): NobleState {
  const state = readNobleState(raw),
    contract = state?.contracts.find((c) => c.id === id);
  if (
    !state ||
    !contract ||
    contract.status.kind !== "pending" ||
    !positive(day) ||
    day < contract.createdNight ||
    day > contract.expiresNight ||
    !["cleared", "expired", "target_dead"].includes(kind) ||
    (kind === "expired" && day !== contract.expiresNight)
  )
    throw Error("night_noble_contract_unavailable");
  return {
    ...state,
    contracts: state.contracts.map((c) => (c.id === id ? { ...c, status: { kind, day } } : c)),
  };
}

/** 原对象的有序字段写入；先完整核描述符，再逐字段写，不创建替代库存或自动退款。 */
function writeState<T extends NobleState | SecretBodyState>(current: T, next: T): void {
  const keys = Reflect.ownKeys(current),
    descriptors = Object.getOwnPropertyDescriptors(current);
  if (
    Object.getPrototypeOf(current) !== Object.prototype ||
    keys.some(
      (k) =>
        typeof k !== "string" ||
        !("value" in descriptors[k]!) ||
        descriptors[k]!.writable !== true ||
        descriptors[k]!.configurable !== true,
    ) ||
    keys.length !== Object.keys(next).length
  )
    throw Error("noble_body_state_write_revoked");
  for (const key of keys as Array<keyof T>)
    Object.defineProperty(current, key, { ...descriptors[key as string]!, value: next[key] });
}

/**
 * 两种状态共用一个实际数据槽：原对象引用与已成功编码的影子分别保存，不存第二份可变状态。
 * 创建者已检查初始归一化数据；这里仍先编码贵族、后编码身体，不新增校验或冻结原库存。
 * 外层权威决定何时写入和失效；读影子只做原 JSON.parse，不复验或重构归档字段。
 */
export class NobleBodyStateSlot {
  readonly nobleState: NobleState;
  readonly bodyState: SecretBodyState;
  #nobleJson: string;
  #bodyJson: string;

  constructor(
    nobleState: NobleState,
    bodyState: SecretBodyState,
    nobleData: NobleState,
    bodyData: SecretBodyState,
  ) {
    this.nobleState = nobleState;
    this.bodyState = bodyState;
    this.#nobleJson = JSON.stringify(nobleData);
    this.#bodyJson = JSON.stringify(bodyData);
  }

  /** 原槽身份先由权威核对；按贵族、身体顺序读取 schema 副本并比较唯一影子，保留短路。 */
  matchesCanonicalData(): boolean {
    return (
      JSON.stringify(readNobleState(this.nobleState)) === this.#nobleJson &&
      JSON.stringify(readSecretBodyState(this.bodyState)) === this.#bodyJson
    );
  }

  commitNoble(next: NobleState): void {
    writeState(this.nobleState, next);
    // 写字段已经发生；stringify 失败时旧影子保持，外层尚未继续 lease／知识或目标绑定提交。
    this.#nobleJson = JSON.stringify(next);
  }

  commitBody(next: SecretBodyState): void {
    writeState(this.bodyState, next);
    this.#bodyJson = JSON.stringify(next);
  }

  /** 逐属性在原 checkpoint 位置解析已编码影子；不能提前聚合、触发另一影子的读取。 */
  decodeNobleShadow(): NobleState {
    return JSON.parse(this.#nobleJson) as NobleState;
  }

  decodeBodyShadow(): SecretBodyState {
    return JSON.parse(this.#bodyJson) as SecretBodyState;
  }
}
