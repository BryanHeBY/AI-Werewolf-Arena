/**
 * 负责噩梦之影唯一数据槽的创建、既有 live 校验、原引用读取、玩家副本及实际状态写入。
 * 输入是原角色、参数和晚读容器；输出保持原状态／历史引用或脱离玩家副本。
 * 校验保留原字段宽度与历史一致性，不新增精确键限制；readonly 视图不提供写权或夜许可。
 * frame 仍拥有名单、生命、夜窗口及 expectedState，写入或编码失败不回滚已写前缀。
 * 身份 JSON 仅用于原运行比对，不是档案 decoder；目标政策归同族 targets 所有者。
 * 角色阵营渠道已退出；reader／project 以显式晚读 CurrentCampSource 获取实际 Camp，原 raw schema／写者不因此获得许可。
 */
import type { CurrentCampSource } from "../../../../domain/components/camp";
import type {
  FearActionPolicy,
  NightmareWolfActionPolicy,
  NightmareShadowState,
  NightmareShadowReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import type { RoleComponent } from "../../../../domain/components/role";
import { Camp, type EntityId } from "../../../../domain/identity";

export const NIGHTMARE_SHADOW_ROLE = "nightmare" as const;
export const NIGHTMARE_SHADOW_POLICY = "awa_nightmare_dreamer_v1" as const;
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
export function freshNightmareShadowState(
  fearActionPolicy: FearActionPolicy = "optional",
  wolfActionPolicy: NightmareWolfActionPolicy = "standard",
): NightmareShadowState {
  return {
    policy: NIGHTMARE_SHADOW_POLICY,
    fearActionPolicy,
    wolfActionPolicy,
    packReady: false,
    lastDay: null,
    lastTarget: null,
    history: [],
  };
}
function validId(value: unknown): value is EntityId {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validDay(value: unknown): value is number {
  return validId(value);
}
/** 仅读自身 data descriptor，先拒绝 Proxy；不执行 Role／状态字段 getter。
 * 合法时返回原 live 状态及 history，不复制、不冻结，也不以形状校验续期运行许可。 */
// 显式 Camp source 在原 camp 点晚调用，可以执行调用方代码并抛错；返回组件保本族 descriptor／Proxy 策略，不回退角色或目录。
export function getNightmareShadowState(
  role: RoleComponent | undefined,
  currentCamp: CurrentCampSource,
): NightmareShadowReadState | undefined {
  if (data(role, "role") !== NIGHTMARE_SHADOW_ROLE || data(currentCamp(), "camp") !== Camp.Wolf)
    return undefined;
  const state = data(data(role, "privateState"), "nightmareShadow");
  const fear = data(state, "fearActionPolicy"),
    wolf = data(state, "wolfActionPolicy");
  const day = data(state, "lastDay"),
    target = data(state, "lastTarget");
  const history = data(state, "history"),
    ready = data(state, "packReady");
  if (
    data(state, "policy") !== NIGHTMARE_SHADOW_POLICY ||
    (fear !== "optional" && fear !== "required_when_legal") ||
    (wolf !== "standard" && wolf !== "no_blast_no_self_knife") ||
    typeof ready !== "boolean" ||
    (day !== null && !validDay(day)) ||
    (target !== null && !validId(target)) ||
    (history !== null && typeof history === "object" && types.isProxy(history)) ||
    !Array.isArray(history)
  )
    return undefined;
  const length = data(history, "length");
  if (typeof length !== "number") return undefined;
  if (day === null)
    return !ready && target === null && length === 0
      ? (state as NightmareShadowReadState)
      : undefined;
  if (!ready || length === 0) return undefined;
  let previous = 0;
  for (let i = 0; i < length; i++) {
    const entry = data(history, String(i));
    const entryDay = data(entry, "day"),
      entryTarget = data(entry, "targetId");
    if (
      !validDay(entryDay) ||
      entryDay <= previous ||
      (entryTarget !== null && !validId(entryTarget))
    )
      return undefined;
    previous = entryDay;
    if (i === length - 1 && (entryDay !== day || entryTarget !== target)) return undefined;
  }
  return state as NightmareShadowReadState;
}
/** 按原顺序复制玩家字段及每条历史；不返回运行状态或复用 history／entry 对象。 */
export function projectNightmareShadowState(
  role: RoleComponent | undefined,
  currentCamp: CurrentCampSource,
): NightmareShadowState | undefined {
  const nightmare = getNightmareShadowState(role, currentCamp);
  if (nightmare) {
    const history: Array<{ day: number; targetId: number | null }> = [];
    for (let i = 0; i < nightmare.history.length; i++) {
      const entry = nightmare.history[i]!;
      history.push({ day: entry.day, targetId: entry.targetId });
    }
    return {
      policy: nightmare.policy,
      fearActionPolicy: nightmare.fearActionPolicy,
      wolfActionPolicy: nightmare.wolfActionPolicy,
      packReady: nightmare.packReady,
      lastDay: nightmare.lastDay,
      lastTarget: nightmare.lastTarget,
      history,
    };
  }
}

/** 同族目标政策复用原日期校验；这是数据谓词，不是目标许可或运行租约。 */
export { validDay as nightmareStateDayValid };

/** 初始化保留左值容器先读、两项政策随后读取的顺序；setter 失败不补写或回滚。 */
function installNightmareShadowState(
  privateState: () => Record<string, unknown>,
  value: { fearActionPolicy: FearActionPolicy; wolfActionPolicy: NightmareWolfActionPolicy },
): void {
  privateState().nightmareShadow = freshNightmareShadowState(
    value.fearActionPolicy,
    value.wolfActionPolicy,
  );
}

/** 原三项状态赋值先于历史追加；push/call 的查找在 history 容器晚读之前。
 * push 或后续身份 JSON 失败保留已写状态／历史，frame 不提前标 committed 或安装目标。 */
function recordNightmareFear(
  state: () => NightmareShadowReadState,
  day: number,
  targetId: EntityId | null,
): void {
  (state() as Pick<NightmareShadowState, "lastDay">).lastDay = day;
  (state() as Pick<NightmareShadowState, "lastTarget">).lastTarget = targetId;
  (state() as Pick<NightmareShadowState, "packReady">).packReady = true;
  Array.prototype.push.call(state().history, { day, targetId });
}

/** 按原字段与逐条历史编码；不调用状态自己的 toJSON，但保留 JSON.stringify 的原失败时点。 */
function encodeNightmareShadowStateIdentity(state: NightmareShadowReadState): string {
  const history: Array<[number, EntityId | null]> = [];
  for (let i = 0; i < state.history.length; i++) {
    const entry = state.history[i]!;
    history.push([entry.day, entry.targetId]);
  }
  return JSON.stringify([
    state.policy,
    state.fearActionPolicy,
    state.wolfActionPolicy,
    state.packReady,
    state.lastDay,
    state.lastTarget,
    history,
  ]);
}

/**
 * 唯一本族数据所有者：schema/get 使用同一原 live reader，allowedWrites 收走原恐惧状态／历史写入。
 * 方法表冻结不冻结输入状态、数组或玩家副本；expectedState 更新、committed 与目标仍属于 frame。
 */
export const NIGHTMARE_SHADOW_STATE_SLOT = Object.freeze({
  create: freshNightmareShadowState,
  schema: getNightmareShadowState,
  get: getNightmareShadowState,
  project: projectNightmareShadowState,
  install: installNightmareShadowState,
  allowedWrites: Object.freeze({ recordFear: recordNightmareFear }),
  checkpoint: Object.freeze({ identity: encodeNightmareShadowStateIdentity }),
});
