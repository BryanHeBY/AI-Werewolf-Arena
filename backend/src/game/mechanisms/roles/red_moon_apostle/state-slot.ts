/**
 * 负责赤月使徒的完整数据槽：原初态、五字段校验、同引用读取、玩家投影及三项有序提交。
 * 输入为原角色、原状态和调用方已经捕获的审计数据；输出保留原引用或原 JSON／浅副本，
 * 不改变旧接受集合。属性描述符校验允许原非枚举／只读数据字段，可写资格另由权威核对。
 * 状态提交只写 blastDay、exileDay、expirySettled；后项失败保留前项写入，不回滚或重读角色槽。
 * 内部审计编码函数 保留完整容器字段和 JSON 方法的原查找时点，不是严格档案读器 或复现授权。
 * 原生命、末狼、夜窗口、请求租约和完整容器失效／最终审计写入仍由恶魔猎手权威持有。
 */
import type {
  LastWolfBlastPolicy,
  RedMoonState,
  RedMoonReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { RoleInitializationComponent } from "../contracts";
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
/** 安装的左值先查原 privateState，再在原 fresh callee 后读取政策；初始化不复制或二次校验。 */
export function initializeRedMoonState(
  role: RoleInitializationComponent,
  readPolicy: () => LastWolfBlastPolicy,
): void {
  role.privateState.redMoon = freshRedMoonState(readPolicy());
}

/** 原五字段形状校验 返回输入本体；拒绝代理对象／访问器，不执行它们，也不补默认或加强可写要求。 */
export function readRedMoonPayload(state: unknown): RedMoonReadState | undefined {
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

/** 原角色／阵营门槛先于容器与 payload 校验；不以合法副本替换所属 live 状态。 */
export function getRedMoonState(role: RoleComponent | undefined): RedMoonReadState | undefined {
  if (own(role, "role") !== RED_MOON_ROLE || own(role, "camp") !== Camp.Wolf) return undefined;
  const state = own(own(role, "privateState"), "redMoon");
  return readRedMoonPayload(state);
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

/** JSON.parse 的方法查找先于 readJson；只解码原已持有审计字符串，不读取 live 容器。 */
export function readRedMoonShadow(readJson: () => string): Record<string, unknown> {
  return JSON.parse(readJson()) as Record<string, unknown>;
}

/** 在原状态校验后按原 spread 顺序生成候选；这是一次浅副本，不是第二份 live 库存。 */
export function copyRedMoonPayload(state: RedMoonReadState): RedMoonState {
  return { ...state };
}

/** 原完整私有容器保留其余字段；JSON.stringify 查找先于 spread，结果只供原同步审计比较。 */
export function encodeRedMoonShadow(original: Record<string, unknown>, next: RedMoonState): string {
  return JSON.stringify({ ...original, redMoon: next });
}

/** 调用方已完成原可写预检与 kind／夜政策；每次 next 字段读取仍紧邻对应写入，失败不补偿。 */
export function writeRedMoonTransition(state: RedMoonReadState, next: RedMoonState): void {
  (state as Pick<RedMoonState, "blastDay">).blastDay = next.blastDay;
  (state as Pick<RedMoonState, "exileDay">).exileDay = next.exileDay;
  (state as Pick<RedMoonState, "expirySettled">).expirySettled = next.expirySettled;
}

/**
 * 契约引用本族唯一实现；仅冻结声明，不冻结原运行状态。形状校验和失效读取沿用同一原校验，
 * 不新增 id／life／request 租约。checkpoint 是内部审计影子的原编码函数，未替代档案完整读器。
 */
export const RED_MOON_STATE_SLOT = Object.freeze({
  create: freshRedMoonState,
  schema: readRedMoonPayload,
  get: getRedMoonState,
  install: initializeRedMoonState,
  allowedWrites: Object.freeze({ transition: writeRedMoonTransition }),
  checkpoint: Object.freeze({
    read: readRedMoonShadow,
    prepare: copyRedMoonPayload,
    encode: encodeRedMoonShadow,
  }),
  invalidations: Object.freeze({ readCurrent: getRedMoonState }),
});
