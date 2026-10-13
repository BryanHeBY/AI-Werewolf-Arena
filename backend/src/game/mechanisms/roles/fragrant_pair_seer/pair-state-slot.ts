/**
 * 负责原生 Pair 状态安装与已审查的查验写入前缀。
 * 输入为原角色或 authority 捕获的槽和已验证下一历史；输出保留 pairSeer/native 同状态引用。
 * 按原顺序写状态 JSON、提交共享 use metadata、再写 ability JSON；authority 随后才提交租约。
 * 安装槽的 LHS 仍先于原能力复制调用；不读时 clone、替换存储状态、退款或吞掉部分写入错误。
 */
import type { PairSeerState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import { type NightAbilityReadView } from "../abilities";
import { installNativeAbility, recordNightAbilityUse } from "../ability_changes";
import { freshPairSeerState } from "./state";
import { assertWritable, plainJson, write } from "./owned-state-data";

/** Captured references and audit snapshots stay on the original Fragrant owner object. */
export interface PairStateSlot {
  readonly pairState: PairSeerState;
  readonly pairAbility: NightAbilityReadView<"pair_check">;
  pairAbilityJson: string;
  pairJson: string;
}

/** The left-hand privateState reference is evaluated before ability installation. */
export function installPairStateSlot(role: RoleComponent): void {
  (role.privateState as { pairSeer: NightAbilityReadView<"pair_check">["state"] }).pairSeer =
    installNativeAbility(role, "pair_check", freshPairSeerState());
}

/** The caller already passed the original currentness and active-ability checks. */
export function commitPairStateSlot(slot: PairStateSlot, next: PairSeerState, day: number): void {
  assertWritable(slot.pairAbility, slot.pairAbility);
  write(slot.pairState, next);
  slot.pairJson = JSON.stringify(next);
  recordNightAbilityUse(slot.pairAbility, day, true);
  slot.pairAbilityJson = plainJson(slot.pairAbility)!;
}
