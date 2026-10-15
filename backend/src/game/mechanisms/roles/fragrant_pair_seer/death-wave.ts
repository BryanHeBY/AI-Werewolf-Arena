/**
 * 负责馥郁双生已提交死亡波的事实构造、必要记录和公开事件触发的披露。
 * 输入是原 receipt、死亡名单、原因与来源阶段，以及限定的行动者查询、日期/阶段/事件读取和发布端口；
 * 输出是原隐藏事实、记录条目及有公开根事件时的披露。receipt 是运行时权威凭据，不能当普通归档数据。
 * 本模块只构造原纯数据 payload；先追加全部事实，再执行可失败的发布与必要记录，保留已发生前缀。
 * 不修改 Alive，不准备、消费或取消双生绑定，也不扩展关系、请求遗言/警徽、处理枪或切换阶段。
 * 规则依据：docs/rules/awa-fragrant-pair-seer-twelve-v1.md。
 */
import { getSessionRecorder } from "../../../../recording/recording_context";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  Phase,
  type EntityId,
  type GameEvent,
  type DeathSources,
} from "../../../../domain/model";
import type { FragrantWaveReceipt } from "./authority";

/** 窄运行端口不暴露 World、原组件、库存或时钟；各 getter 在原表达式时点才读取。 */
interface FragrantDeathWaveRuntime {
  actorId(): EntityId;
  readonly phase: Phase;
  readonly day: number;
  readonly events: GameEvent[];
  publish(receipt: FragrantWaveReceipt, event: GameEvent): void;
}

export class FragrantDeathWavePublication {
  constructor(private readonly runtime: FragrantDeathWaveRuntime) {}

  // 所有事实先于可失败的记录；不能将发布或记录提前到事实之前。
  recordCommittedWave(
    receipt: FragrantWaveReceipt | null,
    ids: readonly number[],
    sources: DeathSources,
    origins: ReadonlyMap<number, Phase>,
    initialWave: boolean,
  ): void {
    const actorId = this.runtime.actorId(),
      phases: Record<string, "night" | "day" | "voting"> = {};
    for (const id of ids) {
      const origin = origins.get(id) ?? this.runtime.phase;
      if (origin === Phase.GameOver) throw Error("fragrant_death_origin_invalid");
      phases[String(id)] = origin;
    }
    const wave = {
      policy: FRAGRANT_PAIR_POLICY,
      actorId,
      day: this.runtime.day,
      deaths: [...ids],
      deathSources: Object.fromEntries(ids.map((id) => [String(id), [...(sources[id] ?? [])]])),
      deathPhases: phases,
      initialWave,
    };
    this.runtime.events.push({
      timestamp: Date.now(),
      type: "fragrant_wave_committed",
      payload: wave,
      audience: Object.freeze([]),
    });
    const rootPhase = receipt ? phases[String(receipt.rootId)]! : null,
      link = receipt && {
        policy: FRAGRANT_PAIR_POLICY,
        actorId,
        day: receipt.day,
        bindingId: `fragrant:night:${receipt.day}`,
        pairIds: receipt.pairIds,
        rootId: receipt.rootId,
        addedTargetId: receipt.addedTargetId,
        rootPhase: rootPhase!,
        initialWave,
      };
    if (link)
      this.runtime.events.push({
        timestamp: Date.now(),
        type: "fragrant_link_triggered",
        payload: link,
        audience: Object.freeze([]),
      });
    // 放逐公开根可以早于本波，枪击公开根可以早于记录；只在确实找到原事件后披露。
    if (receipt) {
      const publicRoot = [...this.runtime.events]
        .reverse()
        .find(
          (e) =>
            (e.type === "wolf_self_destruct" && e.payload.wolfId === receipt.rootId) ||
            (e.type === "voted_out" && e.payload.target === receipt.rootId) ||
            (e.type === "hunter_shot" && e.payload.targetId === receipt.rootId),
        );
      if (publicRoot) this.runtime.publish(receipt, publicRoot);
    }
    getSessionRecorder()?.recordRequiredLogicOp({
      scope: "resolution",
      op: "fragrant_wave_committed",
      phase: this.runtime.phase,
      status: "ok",
      output: wave,
    });
    if (link)
      getSessionRecorder()?.recordRequiredLogicOp({
        scope: "resolution",
        op: "fragrant_link_triggered",
        phase: this.runtime.phase,
        status: "ok",
        output: link,
      });
  }

  /**
   * 只选已存在的公开事件交给 authority 发布；与 pairIds 相交不是新的绑定或库存授权。
   * receipt 的有效性及重复披露由原 owner 检查，失败保留已产生的死亡与事实。
   */
  publishVisibleWave(receipt: FragrantWaveReceipt | null, event: GameEvent): void {
    if (
      receipt &&
      (event.type === "night_resolved" || event.type === "additional_deaths") &&
      event.payload.deaths.some((id) => receipt.pairIds.includes(id))
    )
      this.runtime.publish(receipt, event);
  }
}
