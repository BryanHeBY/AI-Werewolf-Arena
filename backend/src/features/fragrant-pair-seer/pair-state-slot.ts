/**
 * 负责原生 Pair 完整 slot 契约、安装与已审查的查验写入前缀。
 * 输入为原角色或 authority 捕获的槽和已验证下一历史；输出保留 pairSeer/native 同状态引用。
 * 按原顺序写状态 JSON、提交共享 use metadata、再写 ability JSON；authority 随后才提交租约。
 * 安装槽的 LHS 仍先于原能力复制调用；不读时 clone、替换存储状态、退款或吞掉部分写入错误。
 * create/schema、唯一追加写命令、checkpoint codec 与别名／已提交 JSON 失效规则实际统一于本 owner。
 * codec 只在原 JSON 位置编码已验证数据，不把重新校验提前到付款或篡改普通 private 扩展键。
 * 规则边界见 docs/rules/awa-fragrant-pair-seer-twelve-v1.md。
 */
import type { PairSeerState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../domain/components/role";
import { recordNightAbilityUse, type NightAbilityReadView } from "../night-abilities/abilities";
import { installNativeAbility } from "../night-abilities/ability-changes";
import { freshPairSeerState, readPairSeerState } from "./state";
import { assertWritable, plainJson, write } from "./owned-state-data";

/** 捕获的状态／能力引用与已提交 JSON 保留在同一个原 Fragrant owner 上。 */
export interface PairStateSlot {
  readonly pairState: PairSeerState;
  readonly pairAbility: NightAbilityReadView<"pair_check">;
  pairAbilityJson: string;
  pairJson: string;
}

/** 安装先读取赋值左侧 privateState，再调用原能力安装函数。 */
export function installPairStateSlot(role: RoleComponent): void {
  (role.privateState as { pairSeer: NightAbilityReadView<"pair_check">["state"] }).pairSeer =
    installNativeAbility(role, "pair_check", PAIR_STATE_SLOT_CONTRACT.create());
}

/** 调用方已在原位置检查当前性与活跃能力；此处只拥有已审查写入前缀。 */
export function commitPairStateSlot(slot: PairStateSlot, next: PairSeerState, day: number): void {
  assertWritable(slot.pairAbility, slot.pairAbility);
  write(slot.pairState, next);
  slot.pairJson = PAIR_STATE_SLOT_CONTRACT.checkpoint.encode(next);
  recordNightAbilityUse(slot.pairAbility, day, true);
  slot.pairAbilityJson = plainJson(slot.pairAbility)!;
}

/** 只描述已有 Pair owner 的原引用；不复制角色、能力或第二份状态。 */
export interface PairStateSlotProof extends PairStateSlot {
  readonly seer: { readonly privateState: object };
  readonly abilities: unknown;
  readonly pairSource: NightAbilityReadView<"pair_check">["source"];
}

/** 使用 authority 原 descriptor reader，保持同一 invalid sentinel 及所有参数读取顺序。 */
type OwnDataReader = (value: unknown, key: PropertyKey) => unknown;
function pairAliasesCurrent(slot: PairStateSlotProof, own: OwnDataReader): boolean {
  return (
    own(slot.seer.privateState, "pairSeer") === slot.pairState &&
    own(slot.seer.privateState, "abilities") === slot.abilities &&
    plainJson(slot.pairAbility) === slot.pairAbilityJson &&
    slot.pairAbility.source === slot.pairSource &&
    own(slot.abilities, slot.pairAbility.id) === slot.pairAbility &&
    slot.pairAbility.state === slot.pairState
  );
}
function pairDataCurrent(slot: PairStateSlot): boolean {
  // 此检查仍在 Fragrant schema 检查之后；JSON callee 先于数据／JSON getter 读取。
  return JSON.stringify(readPairSeerState(slot.pairState)) === slot.pairJson;
}

/**
 * Pair 本族完整贡献：schema 与 factory 是原函数，允许写入口仅为实际 append commit。
 * snapshot decoder 接延迟 JSON 字段，保 JSON.parse 方法查找在原字段 getter 之前。
 * 失效检查只验证别名和已提交数据；资格、原生命、租约及完整／失败模式仍由 authority 控制。
 */
export const PAIR_STATE_SLOT_CONTRACT = Object.freeze({
  create: freshPairSeerState,
  schema: readPairSeerState,
  allowedWrites: Object.freeze({ appendCheck: commitPairStateSlot }),
  checkpoint: Object.freeze({
    encode: (state: PairSeerState): string => JSON.stringify(state),
    decode: (readJson: () => string): PairSeerState => JSON.parse(readJson()) as PairSeerState,
  }),
  invalidations: Object.freeze({
    aliasesCurrent: pairAliasesCurrent,
    dataCurrent: pairDataCurrent,
  }),
});
