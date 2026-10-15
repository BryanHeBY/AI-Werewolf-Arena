/**
 * 负责经受限名单与资格端口同步枚举夜间施法实例。输入为原存活 ID、已存能力引用、种类和 day；
 * 输出保留能力原引用及只读 payload，不生成档案 DTO 或可写库存。先对完整名单过滤恐惧，再过滤导师修饰，
 * 最后按原序读能力状态；绑定不查 World／时钟，查询不消费资源、不提交效果或随机选目标。
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import type { EntityId } from "../../../domain/model";
import { COMPONENT } from "../../../domain/components/names";
import type { World } from "../../../domain/world";
import { abilityStatus, allNightAbilities, type NightAbilityReadView } from "./abilities";
import {
  bindNightmareNightEligibility,
  type NightmareNightEligibility,
} from "./nightmare_shadow/ports";
import {
  bindScholarMentorNightEligibility,
  type ScholarMentorNightEligibility,
} from "./scholar_mentor/ports";

/** 名单端口只给原存活成员和已存实例序列；不提供库存写或资源提交方法。 */
export interface NightAbilityRosterPort {
  aliveIds(): EntityId[];
  abilitiesFor(actorId: EntityId): readonly NightAbilityReadView[];
}

/** 已绑定资格查询不接收 World、时钟、writer 或回执提交实参；内部仍按本族规则晚查询。 */
export interface NightActorEligibilityQuery {
  filterAliveActors(ids: readonly EntityId[], kind: NightAbilityKind, day: number): EntityId[];
}

export interface NightAbilityActorQuery {
  actors<K extends NightAbilityKind>(
    kind: K,
    day: number,
  ): Array<{ actorId: EntityId; ability: NightAbilityReadView<K> }>;
}

/** 保留先完整恐惧过滤、再完整修饰过滤的两次遍历，不逐人交错两族查询。 */
export function createNightActorEligibilityQuery(
  nightmare: NightmareNightEligibility,
  scholarMentor: ScholarMentorNightEligibility,
): NightActorEligibilityQuery {
  return Object.freeze({
    filterAliveActors(ids: readonly EntityId[], kind: NightAbilityKind, day: number) {
      return ids
        .filter((actorId) => !nightmare.blocks(actorId, day))
        .filter(
          (actorId) =>
            (kind !== "guard" && kind !== "seer_check") ||
            !scholarMentor.blocks(actorId, day, kind === "guard" ? "guard" : "check"),
        );
    },
  });
}

/** 在实际查询点同步生成列表；不冻结或复制选中的实例，readonly payload 仍是原引用。 */
export function createNightAbilityActorQuery(
  roster: NightAbilityRosterPort,
  eligibility: NightActorEligibilityQuery,
): NightAbilityActorQuery {
  return Object.freeze({
    actors<K extends NightAbilityKind>(kind: K, day: number) {
      return eligibility.filterAliveActors(roster.aliveIds(), kind, day).flatMap((actorId) =>
        roster
          .abilitiesFor(actorId)
          .filter(
            (ability): ability is NightAbilityReadView<K> =>
              ability.kind === kind && abilityStatus(ability, day) === "active",
          )
          .map((ability) => ({ actorId, ability })),
      );
    },
  });
}

/** 装配只捕获一个原 World 引用，绑定时不读取名单或能力；这些读取留到实际 actors 查询。 */
export function bindNightAbilityActorQuery(world: World): NightAbilityActorQuery {
  return createNightAbilityActorQuery(
    {
      aliveIds: () => world.getAliveEntityIds(),
      abilitiesFor: (actorId) => allNightAbilities(world.getComponent(actorId, COMPONENT.Role)),
    },
    createNightActorEligibilityQuery(
      bindNightmareNightEligibility(world),
      bindScholarMentorNightEligibility(world),
    ),
  );
}
