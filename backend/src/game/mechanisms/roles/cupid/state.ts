/**
 * 负责丘比特原槽读取与玩家选择投影。输入为原角色和选择数据；输出为原只读状态引用，
 * 或只含已选择编号的独立玩家视图，其公共类型归 game-contract。
 * 此处不绑定情侣、提交选择库存或判断关系胜负；字段投影不能新增行动许可。
 */
import type { CupidReadState } from "@ai-werewolf-arena/game-contract";
import { playerDataField } from "../player_state";

import type { RoleComponent } from "../../../../core/domain/components/role";
export function getCupidState(role: RoleComponent | undefined): CupidReadState | undefined {
  return (role as { readonly privateState: { readonly cupid?: unknown } } | undefined)?.privateState
    .cupid as CupidReadState | undefined;
}
export function projectCupidState(
  state: CupidReadState,
): import("@ai-werewolf-arena/game-contract/player-state-views").PlayerCupidState {
  const policy = playerDataField(state, "policy"),
    choice = playerDataField(state, "choice"),
    pair = playerDataField(choice, "pairIds");
  // 数组用自己的数据属性读取；共用对象读取器本来拒绝数组，不能因此执行外来编号访问器。
  const pairField = (key: string): unknown => {
    if (!Array.isArray(pair)) return undefined;
    const field = Object.getOwnPropertyDescriptor(pair, key);
    return field && Object.hasOwn(field, "value") ? field.value : undefined;
  };
  const first = pairField("0"),
    second = pairField("1");
  const positive = (id: unknown): id is number =>
    typeof id === "number" && Number.isSafeInteger(id) && id > 0;
  return {
    policy: policy === "lui_meme_lovers_only_v1" ? policy : "netease_2017_cupid_follows_lovers_v1",
    remaining: playerDataField(state, "remaining") === 1 ? 1 : 0,
    choice:
      playerDataField(choice, "day") === 1 &&
      Array.isArray(pair) &&
      pairField("length") === 2 &&
      positive(first) &&
      positive(second) &&
      first !== second
        ? { day: 1, pairIds: [first, second] }
        : null,
  };
}
