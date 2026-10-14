/**
 * 负责编译期单元验证蚀时狼妃知识 DTO 的原推断形状、可写字段和观察类型来源。
 * 输入为固定 Git 修改前的独立四字段预期；输出由编译器核对精确类型、双向赋值、
 * 可空目标与错误字段反例。本单元拥有独立预期，不从新 DTO 推导旧结构，不执行
 * state reader、投影、反射、World、模型或提交；数据和 exhausted 不授予权限。
 */
import type { PlayerTimeConsortState } from "@ai-werewolf-arena/game-contract/facts/time-consort";
import type { ReflectionScope, TimeConsortChoice } from "@ai-werewolf-arena/game-contract";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";
import type { projectTimeConsortState } from "../../../src/game/mechanisms/roles/time_wolf_consort/ports";

// 修改前实际 TypeChecker 确认 policy 是此 literal、history 是原可写 Choice[]，返回另有 undefined。
interface OriginalProjection {
  policy: "awa_time_consort_reflection_v1";
  reflectionScope: ReflectionScope;
  history: TimeConsortChoice[];
  exhausted: boolean;
}
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type ProjectionBoundaryChecks = [
  Expect<Equal<PlayerTimeConsortState, OriginalProjection>>,
  Expect<Equal<ReturnType<typeof projectTimeConsortState>, OriginalProjection | undefined>>,
  Expect<Equal<PlayerObservation["ownState"]["timeConsort"], OriginalProjection | undefined>>,
  Expect<PlayerTimeConsortState extends OriginalProjection ? true : false>,
  Expect<OriginalProjection extends PlayerTimeConsortState ? true : false>,
];

/** 仅编译：对象及 history／exhausted 原来可写，知识不增加内部触发日或生命／回执句柄。 */
export function originalWritableKnowledge(dto: PlayerTimeConsortState): void {
  dto.policy = "awa_time_consort_reflection_v1";
  dto.reflectionScope = "first_effect";
  dto.history = [{ day: 2, targetId: null }];
  dto.history.push({ day: 3, targetId: 4 });
  dto.history[0]!.targetId = 5;
  dto.exhausted = true;
  // @ts-expect-error 内部实际触发日不会提前告知玩家。
  dto.triggeredDay;
  // @ts-expect-error 玩家知识不提供 World 或真实资源 owner。
  dto.world;
  // @ts-expect-error exhausted 字段不是反射回执或提交许可。
  dto.receipt;
}
