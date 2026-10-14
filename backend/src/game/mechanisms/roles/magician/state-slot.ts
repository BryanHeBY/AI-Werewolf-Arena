/**
 * 负责魔术师唯一状态槽的创建、完整 live 校验、同引用读取、初始化／历史写入与原身份编码。
 * 输入为原角色、参数及晚读容器，输出为原状态引用、脱离知识副本或原明确拒绝；原完整字段、
 * descriptor、日次、排序及一次性号码校验不变。写权仅收走原赋值与历史追加，失败保留已写前缀。
 * frame 仍拥有原体生命、夜窗口、交换关系及 expectedState 检查点；此槽不另建立 shadow、
 * 退款、标死、关闭、付新资源或授予请求许可。身份 JSON 仅为原运行比对，档案 schema／核验仍归原 owner。
 */
import type {
  MagicianChoice,
  MagicianState,
  MagicianReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const MAGICIAN_ROLE = "magician" as const;
export const MAGICIAN_POLICY = "awa_magician_wolf_king_v1" as const;
function field(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function exact(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value))
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    Reflect.ownKeys(descriptors).length === keys.length &&
    keys.every((k) => descriptors[k] && "value" in descriptors[k]!)
  );
}
function integer(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function arrayItems(value: unknown): unknown[] | null {
  if (types.isProxy(value) || !Array.isArray(value)) return null;
  const length = field(value, "length");
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const d = descriptors[String(i)];
    if (!d || !("value" in d)) return null;
    result.push(d.value);
  }
  return result;
}
/** 完整原 live 校验：仅读自身数据 descriptor，先拒绝 Proxy；不调用 caller getter、迭代器或数组方法。
 * 合法时返回原状态及历史引用，不克隆／冻结；readonly 是读方类型，不能替代 frame 原授权。 */
export function getMagicianState(role: RoleComponent | undefined): MagicianReadState | undefined {
  if (field(role, "role") !== MAGICIAN_ROLE || field(role, "camp") !== Camp.Good) return undefined;
  const state = field(field(role, "privateState"), "magician");
  if (!exact(state, ["policy", "firstNight", "deathShotTargetPolicy", "history"])) return undefined;
  const firstNight = field(state, "firstNight");
  if (field(state, "policy") !== MAGICIAN_POLICY || (firstNight !== 1 && firstNight !== 2))
    return undefined;
  const shot = field(state, "deathShotTargetPolicy");
  if (shot !== "original" && shot !== "exchanged") return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  // 历史日期严格递增；非空二人组保持原升序／全局号码一次使用，null 不消耗号码。
  let previous = 0;
  const used = new Set<number>();
  for (const entry of history) {
    if (!exact(entry, ["day", "pair"])) return undefined;
    const day = field(entry, "day"),
      rawPair = field(entry, "pair");
    if (!integer(day) || day < firstNight || day <= previous) return undefined;
    previous = day;
    if (rawPair === null) continue;
    const pair = arrayItems(rawPair);
    if (
      !pair ||
      pair.length !== 2 ||
      !integer(pair[0]) ||
      !integer(pair[1]) ||
      pair[0] >= pair[1] ||
      used.has(pair[0]) ||
      used.has(pair[1])
    )
      return undefined;
    used.add(pair[0]);
    used.add(pair[1]);
  }
  return state as MagicianReadState;
}
export function createMagicianState(
  firstNight: 1 | 2,
  deathShotTargetPolicy: "original" | "exchanged" = "original",
): MagicianState {
  return { policy: MAGICIAN_POLICY, firstNight, deathShotTargetPolicy, history: [] };
}
/** 按原 descriptor 逐行复制知识，嵌套二人组脱离；不使用 caller 数组 species 或解码为运行许可。 */
export function projectMagicianState(role: RoleComponent | undefined): MagicianState | undefined {
  const state = getMagicianState(role);
  if (!state) return undefined;
  const history: MagicianChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: MAGICIAN_POLICY,
    firstNight: field(state, "firstNight") as 1 | 2,
    deathShotTargetPolicy: field(state, "deathShotTargetPolicy") as "original" | "exchanged",
    history,
  };
}

/** 初始化只有原左值赋值：容器先于 create 的参数读取，setter 或创建失败不补写或回滚。 */
function installMagicianState(
  privateState: () => Record<string, unknown>,
  value: { firstNight: 1 | 2; deathShotTargetPolicy: "original" | "exchanged" },
): void {
  privateState().magician = createMagicianState(
    value.firstNight,
    value.deathShotTargetPolicy,
  );
}

/** 原准入仍由 frame 完成；先取 defineProperty，再两次晚读原状态，保 index／descriptor 写入顺序。 */
function appendMagicianHistory(
  state: () => MagicianReadState,
  day: number,
  chosen: [number, number] | null,
): void {
  Object.defineProperty(state().history, String(state().history.length), {
    value: { day, pair: chosen },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** 原 frame 的身份编码，不是严格档案 codec；先 project／拒绝，再找 JSON.stringify 并编码原副本。 */
function encodeMagicianStateIdentity(role: RoleComponent): string {
  const view = projectMagicianState(role);
  if (!view) throw new Error("magician_original_state_revoked");
  return JSON.stringify(view);
}

/**
 * 本族唯一数据槽贡献：schema 与 get 是同一完整 live 校验，不另造更严格接受政策。
 * allowedWrites 保原初始化和历史 descriptor 写；frame 的 expectedState、pair、committed
 * 仍在原顺序更新。checkpoint 只提供原 JSON 身份编码，不存第二份状态或解析玩家许可。
 * 冻结的是贡献方法表，不冻结输入状态、历史或投影；录制仍完整克隆原 privateState。
 */
export const MAGICIAN_STATE_SLOT = Object.freeze({
  create: createMagicianState,
  schema: getMagicianState,
  get: getMagicianState,
  project: projectMagicianState,
  install: installMagicianState,
  allowedWrites: Object.freeze({ appendHistory: appendMagicianHistory }),
  checkpoint: Object.freeze({ identity: encodeMagicianStateIdentity }),
});
