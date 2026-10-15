/**
 * 负责狼术师唯一状态槽的创建、完整 live 校验、同引用读取、原初始化／历史写入及身份编码。
 * 输入为原角色、参数和晚读容器；输出原状态引用、脱离知识副本或原明确拒绝。原 descriptor、
 * 日期、排序与一次性号码规则保持，写入失败保留原已写前缀，不回滚或付新资源。
 * frame 仍拥有原体生命、夜窗口、映射关系和 expectedState；此槽不另存 shadow、
 * 授予行动许可、关闭或标死。身份 JSON 仅为原运行比对，档案格式与独立核验仍归原 owner。
 * 角色阵营渠道已退出；reader／project 以显式晚读 CurrentCampSource 获取实际 Camp，原 raw schema／写者不因此获得许可。
 */
import type { CurrentCampSource } from "../../../../domain/components/camp";
import type {
  WolfSorcererChoice,
  WolfSorcererState,
  WolfSorcererReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../domain";
export const WOLF_SORCERER_ROLE = "wolf_sorcerer" as const;
export const WOLF_SORCERER_POLICY = "awa_wolf_sorcerer_seats_v1" as const;
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
/** 完整原 live 校验先拒绝 Proxy，再仅读自身数据 descriptor；不调用 Role／状态字段 getter、迭代器或数组方法。
 * 合法时返回原状态／历史引用，不克隆或冻结；readonly 是读方类型，原体与夜窗口授权仍由 frame 复验。 */
// 显式 Camp source 在原 camp 点晚调用，可以执行调用方代码并抛错；返回组件保本族 descriptor／Proxy 策略，不回退角色或目录。
export function getWolfSorcererState(
  role: RoleComponent | undefined,
  currentCamp: CurrentCampSource,
): WolfSorcererReadState | undefined {
  if (field(role, "role") !== WOLF_SORCERER_ROLE || field(currentCamp(), "camp") !== Camp.Wolf)
    return undefined;
  const state = field(field(role, "privateState"), "wolfSorcerer");
  if (!exact(state, ["policy", "firstNight", "history"])) return undefined;
  const firstNight = field(state, "firstNight");
  if (field(state, "policy") !== WOLF_SORCERER_POLICY || (firstNight !== 1 && firstNight !== 2))
    return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  // 历史日期严格递增；非空二人组保原升序／全局号码一次使用，null 不消耗号码。
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
  return state as WolfSorcererReadState;
}
export function createWolfSorcererState(firstNight: 1 | 2): WolfSorcererState {
  return { policy: WOLF_SORCERER_POLICY, firstNight, history: [] };
}
/** 复制原知识历史和非空 pair；可写副本不含运行窗口，也不经投影授予交换写权。 */
export function projectWolfSorcererState(
  role: RoleComponent | undefined,
  currentCamp: CurrentCampSource,
): WolfSorcererState | undefined {
  const state = getWolfSorcererState(role, currentCamp);
  if (!state) return undefined;
  const history: WolfSorcererChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: WOLF_SORCERER_POLICY,
    firstNight: field(state, "firstNight") as 1 | 2,
    history,
  };
}

/** 原初始化先读左值容器，再读 firstNight 并创建／赋值；创建或 setter 失败不补写、回滚。 */
function installWolfSorcererState(
  privateState: () => Record<string, unknown>,
  value: { firstNight: 1 | 2 },
): void {
  privateState().wolfSorcerer = createWolfSorcererState(value.firstNight);
}

/** 准入仍由 frame 负责；先取 defineProperty callee，再两次晚读原 state/history，保 index 与 descriptor。 */
function appendWolfSorcererHistory(
  state: () => WolfSorcererReadState,
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

/** 原 frame 身份编码：先 project／拒绝，再找 JSON.stringify；不是严格档案 decoder 或权限。 */
function encodeWolfSorcererStateIdentity(
  role: RoleComponent,
  currentCamp: CurrentCampSource,
): string {
  const view = projectWolfSorcererState(role, currentCamp);
  if (!view) throw new Error("wolf_sorcerer_original_state_revoked");
  return JSON.stringify(view);
}

/**
 * 本族唯一数据槽：schema/get 是同一个原完整 live 校验，不新增严格接受政策或第二份状态。
 * install 收走原赋值，allowedWrites 只收走历史 descriptor 追加；expectedState／pair／committed
 * 仍由 frame 在原顺序更新。checkpoint 仅提供原 JSON 比较，方法表冻结不冻结输入状态／知识副本。
 */
export const WOLF_SORCERER_STATE_SLOT = Object.freeze({
  create: createWolfSorcererState,
  schema: getWolfSorcererState,
  get: getWolfSorcererState,
  project: projectWolfSorcererState,
  install: installWolfSorcererState,
  allowedWrites: Object.freeze({ appendHistory: appendWolfSorcererHistory }),
  checkpoint: Object.freeze({ identity: encodeWolfSorcererStateIdentity }),
});
