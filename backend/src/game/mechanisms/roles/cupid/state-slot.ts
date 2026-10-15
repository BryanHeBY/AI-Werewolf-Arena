/**
 * 负责丘比特完整选择数据的原初始化、同槽读取、玩家投影与库存／选择写入。
 * 输入是原初始化角色及上下文，或已获准提交的原状态和配对编号；输出保留原槽引用与独立玩家选择视图。
 * 初始化先查原槽，先求值赋值左值的容器，再读取政策并安装；提交先消费剩余次数，再复制配对数组并写选择，失败不回滚。
 * 本槽不新增 live schema、深冻结或档案编码；关系、生命、Victory、窗口和许可仍由原夜阶段／关系 owner 持有。
 */
import type { CupidReadState, CupidState } from "@ai-werewolf-arena/game-contract";
import { playerDataField } from "../player-state-data";

import type { RoleComponent } from "../../../../domain/components/role";
import type { RoleInitializationComponent, RoleInitContext } from "../contracts";
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

/** 原完整初始化：槽不存在时才建初态，不提前读取政策或把整个私有容器复制／冻结。 */
export function installCupidState(role: RoleInitializationComponent, ctx: Pick<RoleInitContext, "boardConfig">): void {
  if (!getCupidState(role))
    role.privateState.cupid = {
      policy: ctx.boardConfig?.cupid?.policy ?? "netease_2017_cupid_follows_lovers_v1",
      remaining: 1,
      choice: null,
    };
}

/** 调用前关系已由原 owner 绑定；次数写入后的配对复制或 choice setter 失败不撤回已绑定关系或补发事实。 */
export function commitCupidChoice(state: CupidReadState, pairIds: [number, number]): void {
  (state as Pick<CupidState, "remaining">).remaining = 0;
  (state as Pick<CupidState, "choice">).choice = { day: 1, pairIds: [...pairIds] };
}
