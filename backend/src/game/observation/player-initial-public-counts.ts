/**
 * 负责玩家提示开局公开角色配比的来源选择和完整聚合；输入为原初发牌、板子及角色查询。
 * 输出直接填入调用方已有的配比缓存，盗贼／千面人初发牌优先于板子，旧无板子调用按开局角色统计。
 * 本模块不创建第二份缓存、不选择身份或授予行动许可；公开人数的原先赋值仍由提示策略先完成。
 * 每次板子、角色和缓存查询保留原位置及接收方，失败保留此前已经写入的 Map 前缀，不回滚或补默认值。
 */
import type { EntityId, ReadonlyBoardConfig, Role } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../core/domain/components/role";
import type { World } from "../../core/domain/world";
import { initialIdentityCandidateCounts } from "../mechanisms/roles/initial_identity/deal";

/** 查询在原表达式处执行；缓存仍归调用方，role 查询保留其原方法的 receiver。 */
export interface PlayerInitialPublicCountQueries {
  world(): World;
  boardConfig(): ReadonlyBoardConfig | undefined;
  role(actorId: EntityId): RoleComponent | undefined;
  counts(): Map<Role, number>;
}

/** 填入构造时的公开配比，不读取手牌选择、当前许可或后续角色变化来刷新这份缓存。 */
export function collectPlayerInitialPublicCounts(queries: PlayerInitialPublicCountQueries): void {
  const thiefCounts = initialIdentityCandidateCounts(queries.world());
  if (thiefCounts) {
    for (const [role, count] of thiefCounts) queries.counts().set(role, count);
  } else if (queries.boardConfig()) {
    // 原条件和迭代器各读一次板子；! 只保类型，不把第二次缺失改成静默空配比。
    for (const { role, count } of queries.boardConfig()!.roleSetups) {
      queries.counts().set(role, (queries.counts().get(role) ?? 0) + count);
    }
  } else {
    // 旧无板子调用只在构造时查询；Role 字段在 set、get 参数处分别读取，不能提前缓存。
    for (const id of queries.world().entityIds()) {
      const role = queries.role(id);
      if (role) queries.counts().set(role.role, (queries.counts().get(role.role) ?? 0) + 1);
    }
  }
}
