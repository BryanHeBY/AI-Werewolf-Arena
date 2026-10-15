/**
 * 负责雾鸦延迟夜的完整建立、领取、蛇选择及最终伤害准备／完成步骤。输入为经理的延迟原引用、
 * 同一待处理实例和当前性回调；输出同步步骤序列，原蛇 Promise 与准备伤害分别交回经理。
 * 经理唯一保存 pending，仍拥有阶段时钟、公开夜报、实际死亡提交、判胜和外层 abort；本组合不复制权威。
 * 原生命／伤害复制、疗救付款和窗口许可仍归本族原所有者。失败停在当前步骤，不退款、不自动完成或正常关闭。
 */
import type { EntityId, NightSummary } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider } from "../domain/actions";
import type { GameEvent } from "../domain/events";
import type { World } from "../domain/world";
import type { AliveComponent } from "../domain/components/alive";
import { aliveLifeVersion } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import type { DamageResolutionResult } from "../domain/systems/damage-resolution-system";
import type { DreamNightEffects } from "../domain/dream-night-effects";
import { Phase } from "@ai-werewolf-arena/game-contract";
import type { ToolGateway } from "../engine/actions/tool-gateway";
import type { NightManagerLifecycle } from "./night-lifecycle-plan";
import { assertMistRosterCurrent } from "../features/mist-raven/ports";
import { MistPendingNight } from "../features/mist-raven/pending-night";
import { decideSnake } from "../features/mist-raven/choice-ports";
import { GameActionRequestFactory } from "../engine/actions/action-request-factory";
import { safeRecordLogicOp } from "../recording/session/recorder";

/** 只读取已交接的同一夜结果；原生命、梦句柄和伤害仍按各自所有者的既有规则处理。 */
export interface MistDelayedNightInput {
  deathLives: ReadonlyMap<EntityId, { life: AliveComponent; version: number | undefined }>;
  summary: Pick<NightSummary, "wolfTarget">;
  damage: DamageResolutionResult;
  dreamFrame: DreamNightEffects;
}

export interface MistDelayedNightOpening {
  readonly world: World;
  readonly cycleDay: number;
  readonly night: MistDelayedNightInput;
}

/** 先核名单／每个原生命，再构造唯一待处理实例；检查失败时经理原字段尚未被新实例替换。 */
export function prepareMistDelayedNight(runtime: MistDelayedNightOpening): MistPendingNight {
  assertMistRosterCurrent(runtime.world);
  for (const [id, scope] of runtime.night.deathLives) {
    if (
      runtime.world.getComponent(id, COMPONENT.Alive) !== scope.life ||
      !scope.life.alive ||
      scope.version === undefined ||
      aliveLifeVersion(scope.life) !== scope.version
    )
      throw new Error("mist_pending_life_stale");
  }
  return new MistPendingNight(
    runtime.world,
    runtime.cycleDay,
    runtime.night.summary.wolfTarget,
    runtime.night.damage,
    runtime.night.dreamFrame,
  );
}

/** 窄读取仍指向经理唯一字段；这里没有第二份 pending、阶段时钟或完成标志。 */
export interface MistDelayedNightSettlementRuntime {
  readonly pending: MistPendingNight | null;
  readonly world: World;
  readonly events: GameEvent[];
  readonly toolGateway: ToolGateway;
  readonly lifecycle: Pick<NightManagerLifecycle, "closeMistNormally">;
  readonly cycleDay: number;
}

/** 同一 current 闭包交给经理的真实死亡提交；这是运行数据，不是 JSON、许可或第二份状态。 */
export interface MistPreparedNightDamage {
  damage: DamageResolutionResult;
  current: () => boolean;
}

/** 两个 yield 都同步交回原对象；恢复协议仅用于这个具体延迟夜，不驱动其它角色或通用清理。 */
export function* settleMistDelayedNight(
  runtime: MistDelayedNightSettlementRuntime,
  actionProvider: ActionProvider,
  dayIsCurrent: () => boolean,
  alreadyClaimed: boolean,
): Generator<Promise<number | null> | MistPreparedNightDamage, void, number | null> {
  const pending = runtime.pending;
  if (!pending) throw new Error("mist_pending_night_missing");
  const current = () => dayIsCurrent() && pending === runtime.pending;
  if (!alreadyClaimed) pending.claim(current);
  // 第一次只交原蛇 Promise：经理在原位置等待，拒绝时不恢复下面的准备／完成步骤。
  const healed = yield decideSnake(
    runtime.world,
    runtime.events,
    runtime.toolGateway,
    actionProvider,
    pending,
    current,
    // 这里只捕获真实类的晚读取；窗口仍在原 roster／开窗之后 new，不提前创建请求或增加 await。
    { get requestFactory() { return GameActionRequestFactory; } },
  );
  const damage = pending.prepareFinalDamage(healed, current);
  safeRecordLogicOp({
    scope: "resolution",
    op: "night_damage_resolved",
    phase: Phase.Night,
    status: "ok",
    output: { deaths: damage.deaths, death_sources: damage.deathSources },
  });
  // 第二次交原伤害，经理同步发表夜报并等待真实 DeathResolution；成功之后才允许第三次 next。
  // 死亡提交失败不恢复这里，已付蛇和已发表／标死前缀保留，外层经理沿原路径 abort。
  yield { damage, current };
  assertMistRosterCurrent(runtime.world);
  pending.finish(current);
  runtime.lifecycle.closeMistNormally(runtime.cycleDay);
}
