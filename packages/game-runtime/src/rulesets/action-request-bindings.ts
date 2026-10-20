/**
 * 负责有限角色及墙事件的请求绑定组合。输入为工厂已构造的原请求和延迟阶段／World 查询；
 * 输出是在原机制所有者中建立的请求关联，顺序为孤独少女、野孩子、初始身份、墙、鬼新娘。
 * 各分支独立判断，保留初始身份的短路和阶段重复读取；命中时才读取 World，失败不撤销前面的绑定。
 * 权限及期限别名仍归具体机制的原 WeakMap 和守卫；本组合不复制请求、创建库存或授予新许可。
 */
import type { ActionStage } from "@ai-werewolf-arena/game-contract";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { World } from "../domain/world";
import { bindGhostBrideRequest } from "../features/ghost-bride/authority";
import { bindLonelyGirlRequest } from "../features/lonely-girl/lifecycle";
import { bindWildChildRequest } from "../features/wild-child/lifecycle";
import { bindInitialIdentityRequest } from "../features/initial-identity/setup";
import { bindWallRequest } from "../features/wall-notes/authority";

/** 查询保原表达式位置；工厂使用自己的输入与 World，阶段不能从请求快照反推。 */
export interface ActionRequestBindingQueries {
  stage(): ActionStage;
  world(): World;
}

/** 只组合已有绑定命令；请求、context 与具体机制状态保持原引用，异常继续沿原调用路径抛出。 */
export function bindRulesetActionRequest(
  request: ActionRequest,
  queries: ActionRequestBindingQueries,
): void {
  if (queries.stage() === "lonely_girl") bindLonelyGirlRequest(queries.world(), request);
  if (queries.stage() === "wild_child") bindWildChildRequest(queries.world(), request);
  if (queries.stage() === "thief" || queries.stage() === "shapeshifter")
    bindInitialIdentityRequest(queries.world(), request);
  // 墙分支原本就在初始身份与鬼新娘之间；不能为按角色分组而改变绑定及失败前缀。
  if (queries.stage() === "wall_notes") bindWallRequest(queries.world(), request);
  if (
    [
      "ghost_bride_groom",
      "ghost_bride_chat",
      "ghost_bride_witness",
      "ghost_bride_knife",
      "wolf_vote",
    ].includes(queries.stage())
  )
    bindGhostBrideRequest(queries.world(), request);
}
