/**
 * 负责诡术师唯一状态槽的创建、完整 live 校验、同引用读取、脱离选择／知识副本及原实际写入。
 * 输入为原角色、日期、合法号码和晚读容器；输出保持原状态、副本和明确拒绝顺序。
 * 原 history 递增／相邻夜不能连续跳过／号码一次使用规则保留；失败不修复已写前缀或退还号码。
 * frame 仍唯一拥有原体生命、夜窗口、finished／exileResolved、映射与 expectedState。
 * 本槽不另建状态镜像，不授行动许可或结算放逐；身份 JSON 仅为运行比对，非档案 decoder。
 */
import type {
  TricksterChoice,
  TricksterState,
  TricksterReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const TRICKSTER_ROLE = "trickster" as const;
export const TRICKSTER_POLICY = "awa_trickster_exile_v1" as const;
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
/** 完整原校验先拒绝 Proxy，再仅读自身 data descriptor，不执行输入 getter、迭代器或数组方法。
 * 合法 live 读返回原状态／history 引用；readonly 是读方类型，不提供写许可或原体生命保证。 */
export function getTricksterState(role: RoleComponent | undefined): TricksterReadState | undefined {
  if (field(role, "role") !== TRICKSTER_ROLE || field(role, "camp") !== Camp.Wolf) return undefined;
  const state = field(field(role, "privateState"), "trickster");
  if (!exact(state, ["policy", "history"])) return undefined;
  if (field(state, "policy") !== TRICKSTER_POLICY) return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  // null 不消费号码，但相邻两夜的 null 历史仍被拒绝；跨日间隔不扩成连续跳过。
  let previous = 0;
  let previousPass = false;
  const used = new Set<number>();
  for (const entry of history) {
    if (!exact(entry, ["day", "pair"])) return undefined;
    const day = field(entry, "day"),
      rawPair = field(entry, "pair");
    if (!integer(day) || day <= previous) return undefined;
    if (rawPair === null && previousPass && day === previous + 1) return undefined;
    previous = day;
    previousPass = rawPair === null;
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
  return state as TricksterReadState;
}
export function createTricksterState(): TricksterState {
  return { policy: TRICKSTER_POLICY, history: [] };
}
/** 仅复制历史及非空 pair；原可写知识副本不含 frame 句柄或夜／放逐许可。 */
export function projectTricksterState(role: RoleComponent | undefined): TricksterState | undefined {
  const state = getTricksterState(role);
  if (!state) return undefined;
  const history: TricksterChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: TRICKSTER_POLICY,
    history,
  };
}

/** 返回脱离的下一选择，不改原 history；原 day／连续跳过／legalIds 政策保留，准入仍由 frame 复验。 */
export function nextTricksterChoice(
  role: RoleComponent | undefined,
  day: number,
  pair: readonly [number, number] | null,
  legalIds: readonly number[],
): TricksterState {
  const state = projectTricksterState(role);
  if (!state || !integer(day) || day <= (state.history.at(-1)?.day ?? 0))
    throw new Error("trickster_choice_invalid");
  if (pair === null) {
    const last = state.history.at(-1);
    if (last?.pair === null && last.day === day - 1) throw new Error("trickster_consecutive_pass");
    return { ...state, history: [...state.history, { day, pair: null }] };
  }
  const values = arrayItems(pair);
  if (
    !values ||
    values.length !== 2 ||
    !integer(values[0]) ||
    !integer(values[1]) ||
    values[0] === values[1]
  )
    throw new Error("trickster_target_invalid");
  const used = new Set(state.history.flatMap((row) => row.pair ?? []));
  if (values.some((id) => used.has(id as number) || !legalIds.includes(id as number)))
    throw new Error("trickster_target_invalid");
  const a = values[0],
    b = values[1];
  return { ...state, history: [...state.history, { day, pair: a < b ? [a, b] : [b, a] }] };
}

/** 初始化仍先取原左值容器，再创建并赋值；容器 getter／setter 失败不补写或回滚。 */
function installTricksterState(privateState: () => Record<string, unknown>): void {
  privateState().trickster = createTricksterState();
}

/** 先查 defineProperty callee，再两次晚读原 state/history；追加原 choice 引用与可写 descriptor。 */
function appendTricksterHistory(state: () => TricksterReadState, choice: TricksterChoice): void {
  Object.defineProperty(state().history, String(state().history.length), {
    value: choice,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** 原 frame 身份编码：先 project／明确拒绝，再查 JSON.stringify，不提供序列化输入授权。 */
function encodeTricksterStateIdentity(role: RoleComponent): string {
  const view = projectTricksterState(role);
  if (!view) throw new Error("trickster_original_state_revoked");
  return JSON.stringify(view);
}

/**
 * 唯一本族数据槽：schema/get 同一原完整 reader；allowedWrites 收走实际 descriptor 追加，
 * nextChoice 仅生成副本。frame 保 history→expectedState→pair／committed 的原提交顺序。
 * 冻结的是方法表及子表，不冻结输入状态、历史或知识副本，不另存 JSON shadow 或窗口。
 */
export const TRICKSTER_STATE_SLOT = Object.freeze({
  create: createTricksterState,
  schema: getTricksterState,
  get: getTricksterState,
  project: projectTricksterState,
  nextChoice: nextTricksterChoice,
  install: installTricksterState,
  allowedWrites: Object.freeze({ appendHistory: appendTricksterHistory }),
  checkpoint: Object.freeze({ identity: encodeTricksterStateIdentity }),
});
