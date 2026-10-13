/**
 * 负责动物梦境子狐、河豚、白猫三种原资源槽的完整捕获、唯一替换命令及当前性检查。
 * 输入为原 World／角色容器、原 schema／初始数据和 authority 已验证的下一状态；输出保留原槽引用与 JSON。
 * 工厂、schema、允许的纯转换、commit、checkpoint codec 与失效检查引用本族唯一实现，真实 authority 实际消费。
 * 状态替换先写原 privateState，再记 live 引用和 JSON；可失败写入不回滚已付前缀，不另建存储或镜像。
 * 租约、生命、目标、死亡／放逐单元和停止策略仍由 authority 拥有；快照解码不重新授权或再校验。
 */
import { types } from "node:util";
import type { World } from "../../../../core/domain/world";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { animalOriginalRolePlayer, type AnimalOriginalPlayer } from "./roster";
import {
  freshFoxCubState,
  freshPufferfishState,
  freshWhiteCatState,
  readFoxCubState,
  readPufferfishState,
  readWhiteCatState,
  payFoxCubChoice,
  payPufferfishChoice,
  notePufferfishKnifeDeath,
  deferWhiteCat,
  expireWhiteCat,
  type FoxCubState,
  type PufferfishState,
  type WhiteCatState,
} from "./state";

/** 同一原槽、当前 live 对象与已提交 JSON 的捕获记录；具体 T 保留三族原形状，不复制 live 数据。 */
export interface Resource<T extends object> {
  readonly actor: AnimalOriginalPlayer;
  readonly key: string;
  state: T;
  json: string;
  readonly read: (value: unknown) => T;
}
/** 只接受原可枚举 data descriptor；Proxy、访问器和缺失键维持原拒绝，不执行输入 getter。 */
export function descriptor(value: unknown, key: string): PropertyDescriptor | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d && d.enumerable ? d : undefined;
}
/** 原 Node 安全数据副本与 65536 限制；序列化失败返回 null，不替换或冻结输入。 */
export function plainJson(value: unknown): string | null {
  try {
    return JSON.stringify(snapshotPlainData(value, new Set(), 0, 65536));
  } catch {
    return null;
  }
}
/** 捕获已由 profile 初始化的原槽；descriptor → JSON → schema → fresh 比较的顺序保持。 */
export function captureResource<T extends object>(
  world: World,
  role: "fox_cub" | "pufferfish" | "white_cat",
  key: string,
  read: (value: unknown) => T,
  fresh: T,
): Resource<T> {
  const actor = animalOriginalRolePlayer(world, role),
    d = actor && descriptor(actor.privateState, key),
    value = d?.value,
    json = plainJson(value);
  if (
    !actor ||
    !d?.writable ||
    json === null ||
    JSON.stringify(read(value)) !== JSON.stringify(fresh)
  )
    throw Error("animal_initial_resource_invalid");
  return { actor, key, state: value as T, json, read };
}
/** 原可写 descriptor、同状态引用和已提交 JSON 三项不变量；不以合法副本恢复已停 owner。 */
export function resourceCurrent<T extends object>(r: Resource<T>): boolean {
  const d = descriptor(r.actor.privateState, r.key);
  return !!d?.writable && d.value === r.state && plainJson(r.state) === r.json;
}
function replaceResource<T extends object>(r: Resource<T>, next: T, encoded: string): void {
  // 调用方已在最后外部回调之后核对可写数据槽；保持 privateState → state → json 的原写入前缀。
  r.actor.privateState[r.key] = next;
  r.state = next;
  r.json = encoded;
}

// 只冻结贡献声明与入口表；可写 live 状态及替换语义保持原机制所有权。
/** 子狐 pass 仍只追加历史；实际付款、效果与终止时点由原夜间租约判断。 */
export const FOX_STATE_SLOT = Object.freeze({
  create: freshFoxCubState,
  schema: readFoxCubState,
  allowedWrites: Object.freeze({ choose: payFoxCubChoice, commit: replaceResource }),
  checkpoint: Object.freeze({
    encode: (state: FoxCubState): string => JSON.stringify(state),
    decode: (readJson: () => string): FoxCubState => JSON.parse(readJson()) as FoxCubState,
  }),
  invalidations: Object.freeze({ current: resourceCurrent }),
});

/** 河豚主动报复与实际狼刀死亡独立计付；本 owner 不把它们归成同一个使用次数。 */
export const PUFFER_STATE_SLOT = Object.freeze({
  create: freshPufferfishState,
  schema: readPufferfishState,
  allowedWrites: Object.freeze({
    choose: payPufferfishChoice,
    knifeDeath: notePufferfishKnifeDeath,
    commit: replaceResource,
  }),
  checkpoint: Object.freeze({
    encode: (state: PufferfishState): string => JSON.stringify(state),
    decode: (readJson: () => string): PufferfishState => JSON.parse(readJson()) as PufferfishState,
  }),
  invalidations: Object.freeze({ current: resourceCurrent }),
});

/** 白猫只记录延迟及实际单元到期；Alive 与遗言仍由原死亡结算拥有。 */
export const CAT_STATE_SLOT = Object.freeze({
  create: freshWhiteCatState,
  schema: readWhiteCatState,
  allowedWrites: Object.freeze({ defer: deferWhiteCat, expire: expireWhiteCat, commit: replaceResource }),
  checkpoint: Object.freeze({
    encode: (state: WhiteCatState): string => JSON.stringify(state),
    decode: (readJson: () => string): WhiteCatState => JSON.parse(readJson()) as WhiteCatState,
  }),
  invalidations: Object.freeze({ current: resourceCurrent }),
});
