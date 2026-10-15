/**
 * 负责秘密之身最终来源折叠、原名单更新以及上帝事实与录制操作的顺序发布。
 * 输入为经过既有夜间来源检查的同一 sources／deaths 和晚读取的 World／事件；输出原地更新名单与事实。
 * 实际保护付款和唯一原体仍由 authority 拥有，本模块不标死、推进阶段或选择判胜检查点。
 * 先更新来源和名单，再发布事实及必需操作；必需录制失败原样传播，已经付款／写入的前缀不回滚。
 */
import { DeathCause, Phase, type DeathSources, type EntityId, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../domain/world";
import { getSessionRecorder } from "../../../../recording/recording_context";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { resolveSecretBodyDamage, checkpointNobleBodyAuthority } from "./authority";
import type { SecretBodySources } from "./damage";

/** 保留原运行引用与晚 getter；字段只读不冻结事件数组，也不创建新的保护或死亡许可。 */
export interface NobleNightDamagePublicationRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

/** 只在原最终来源检查点同步执行；名单、来源字典和 fact 字段顺序保持原引用与顺序。 */
export function publishNobleNightDamage(
  runtime: NobleNightDamagePublicationRuntime,
  nightDay: number,
  sources: DeathSources,
  deaths: EntityId[],
): void {
  const final = resolveSecretBodyDamage(runtime.world, nightDay, sources as SecretBodySources);
  // 先原地替换来源再重建名单，保留调用方字典和数组身份；后续发布失败不恢复已付保护。
  for (const id of Object.keys(sources)) delete sources[Number(id)];
  for (const [id, causes] of Object.entries(final.sources))
    sources[Number(id)] = causes.map((c) => c as DeathCause);
  deaths.splice(0, deaths.length, ...Object.keys(sources).map(Number));
  if (final.blocked) {
    const actorId = checkpointNobleBodyAuthority(runtime.world, true).bodyId,
      payload = {
        policy: "awa_noble_secret_body_v1" as const,
        actorId,
        day: nightDay,
        ...final.blocked,
      };
    runtime.events.push({
      timestamp: Date.now(),
      type: "secret_body_blocked",
      payload,
      audience: Object.freeze([]),
    });
    getSessionRecorder()?.recordRequiredLogicOp({
      scope: "resolution",
      op: "secret_body_blocked",
      actorId,
      phase: Phase.Night,
      status: "ok",
      output: payload,
    });
  }
  // 上帝来源事实保留同一死因字典，死亡名单另取当时副本；玩家投影不能从空受众读取这份事实。
  const committed = {
    policy: "awa_noble_secret_body_v1" as const,
    actorId: checkpointNobleBodyAuthority(runtime.world, true).bodyId,
    day: nightDay,
    blocked: final.blocked,
    deaths: [...deaths],
    deathSources: sources,
  };
  runtime.events.push({
    timestamp: Date.now(),
    type: "noble_body_sources_committed",
    payload: committed,
    audience: Object.freeze([]),
  });
  getSessionRecorder()?.recordRequiredLogicOp({
    scope: "resolution",
    op: "noble_body_sources_committed",
    phase: Phase.Night,
    status: "ok",
    output: committed,
  });
  // 已发生的必需录制完成之后才写可选诊断；不能把必需录制错误降为可选失败。
  safeRecordLogicOp({
    scope: "resolution",
    op: "night_damage_resolved",
    phase: Phase.Night,
    status: "ok",
    output: { deaths: [...deaths], death_sources: sources },
  });
}
