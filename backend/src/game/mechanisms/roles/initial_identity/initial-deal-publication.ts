/**
 * 负责盗贼／千面人开局整副牌组的公共事实发布；输入是原 World、事件数组与牌局人数的晚读端口。
 * 输出保留原 roles 副本、事件种类和政策标识；不披露手牌与玩家对应表、不选择角色或授予设置许可。
 * 无牌组仍执行第二次身份种类查询；有牌组才复制角色并读人数，push callee 先于时钟／政策读取。
 * getter／复制／push 失败原样传播，不回滚此前事实；阶段、私密牌表、继承与警长发布顺序仍由 manager 拥有。
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import type { World } from "../../../../core/domain/world";
import { initialIdentityDeal, initialIdentityKind, INITIAL_IDENTITY_POLICIES } from "./deal";

/** 原运行引用在各表达式处查询；事件数组仍可追加，端口与公共数据不充当运行权限。 */
export interface InitialDealPublicationRuntime {
  world(): World;
  events(): GameEvent[];
  boardSize(): number;
}

/** deal 已先 map 出角色副本，这里按原顺序再次 spread；不保存或冻结另一个手牌库存。 */
export function publishInitialIdentityDeal(runtime: InitialDealPublicationRuntime): void {
  const initialDeal = initialIdentityDeal(runtime.world()),
    initialKind = initialIdentityKind(runtime.world());
  if (initialDeal) {
    const data = { roles: [...initialDeal], boardSize: runtime.boardSize() };
    runtime.events().push(
      initialKind === "shapeshifter"
        ? {
            timestamp: Date.now(),
            type: "shapeshifter_initial_deal",
            payload: { ...data, policy: INITIAL_IDENTITY_POLICIES.shapeshifter },
          }
        : {
            timestamp: Date.now(),
            type: "thief_initial_deal",
            payload: { ...data, policy: INITIAL_IDENTITY_POLICIES.thief },
          },
    );
  }
}
