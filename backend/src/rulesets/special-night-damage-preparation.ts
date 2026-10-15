/**
 * 负责特殊夜初始死亡波的完整同步准备：可读性、故障／必需证据、原来源封存、保护、夜仆收尾与事实发布。
 * 输入为经理原夜结果、固定夜日、两项原归属和晚读取视图；输出同一待提交名单／来源、原生命表及链前活人快照。
 * World 仍是原运行对象，字段只读不构成写权限隔离；具体付款、原体、来源当前性和封存权仍归原机制所有者。
 * 故障、资源或事实写入后的失败保合法前缀，不退款、不重抓来源或吞必需记录。空名单不提前读取 deathLives。
 * 本组合不创建 Promise、标死、换阶段、判胜或关闭外层夜；经理保原 try/finally、初始死亡波 DR 等待与后续到期裁决。
 */
import { DeathCause, Phase, StatusMark, type EntityId, type DeathSources, type ReadonlyBoardConfig, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../domain/world";
import { COMPONENT } from "../domain/components/names";
import { aliveLifeVersion, type AliveComponent } from "../domain/components/alive";
import { statusMarkSnapshot } from "../domain/components/status-marks";
import type { DamageResolutionResult } from "../domain/systems/damage-resolution-system";
import type { DeathOriginalLife } from "../game/engine/death-wave";
import type { NightPipelineResult } from "../game/engine/phase_pipeline/night_pipeline";
import type { NightFaultPlan } from "../game/engine/fault_plan";
import type { NightManagerLifecycle } from "./night-lifecycle-plan";
import {
  appendDemonNightDamageSources,
  publishDemonNightDamageSources,
  committedDemonFaultBoundary,
} from "../game/mechanisms/roles/demon_hunter/ports";
import { freezeDeliveredDemonNightSources } from "../game/mechanisms/roles/demon_hunter/native_potion_controller";
import { appendNobleContractClosure, publishNobleNightDamage } from "../game/mechanisms/roles/noble_secret_body/ports";
import { weddingKnifeCurrent } from "../game/mechanisms/roles/ghost_bride/ports";
import { getSessionRecorder } from "../recording/recording_context";

/** getter 只闭包经理原对象；在每个原表达式才读字段。assertReadable 仍晚查经理原 private 方法与 receiver。 */
export interface SpecialNightDamageRuntime {
  readonly world: World;
  readonly config: ReadonlyBoardConfig;
  readonly events: GameEvent[];
  readonly nightFaultPlan: Pick<NightFaultPlan, "applyBeforeNightSourceFreeze"> | undefined;
  assertReadable(): void;
}

/** 非序列化运行结果；字段及数组／Map 不克隆或冻结，sourceDamage 保原毒来源证据关联。 */
export interface PreparedSpecialNightDamage {
  deaths: EntityId[];
  sources: DeathSources;
  originalLives: ReadonlyMap<EntityId, DeathOriginalLife> | undefined;
  sourceDamage: DamageResolutionResult;
  livingBeforeChain: Map<EntityId, { life: AliveComponent; version: number | undefined }>;
}

/** 四项是否进入特殊夜仍在经理 try 之前判定；这里只组合已进入分支的原同步工作，不增加等待点。 */
export function prepareSpecialNightDamage(
  runtime: SpecialNightDamageRuntime,
  night: Extract<NightPipelineResult, { interrupted: false }>,
  nightDay: number,
  ownsWedding: boolean,
  ownsDemon: boolean,
  lifecycle: Pick<NightManagerLifecycle, "expireNobleAtNightEnd" | "closeNobleNormally">,
): PreparedSpecialNightDamage {
  runtime.assertReadable();

  // 原故障驱动可先换生命并消费计划；必需记录失败保此前前缀，不能跳过回调继续封存。
  const faults =
    runtime.nightFaultPlan?.applyBeforeNightSourceFreeze(
      nightDay,
      committedDemonFaultBoundary(runtime.world),
      (fault) => {
        // 开启录制时这是必需写入；写入失败不能生成缺少证据却标记成功的 Tape。
        getSessionRecorder()?.recordRequiredLogicOp({
          scope: "resolution",
          op: "fault_applied",
          phase: Phase.Night,
          status: "ok",
          input: { version: "awa_fault_plan_v1", step: fault.step },
          output: {
            originalVersion: fault.originalVersion,
            replacementVersion: fault.replacementVersion,
          },
        });
      },
    ) ?? [];
  const demon = ownsDemon
    ? freezeDeliveredDemonNightSources(runtime.world, night.demonSources!, faults[0] ?? null)
    : null;
  let sourceDamage: DamageResolutionResult;
  let originalLives: ReadonlyMap<EntityId, DeathOriginalLife> | undefined;
  const proposedSources: DeathSources = Object.fromEntries(
    (sourceDamage = night.damage).deaths.map((id) => [
      id,
      [...(night.damage.deathSources[id] ?? [])],
    ]),
  );
  const guardOverrides: Array<{ targetId: number; guard: boolean }> = [];
  if (demon) {
    const manager = runtime;
    appendDemonNightDamageSources({
      get knifeProtection() { return night.demonKnifeProtection; },
      healMarkPresent(target) {
        return statusMarkSnapshot(
          manager.world.getComponent(target(), COMPONENT.StatusMarks),
          StatusMark.HealMark,
        )?.present === true;
      },
      wolfSourceCurrent(target) { return night.demonWolfSourceCurrent?.(target()); },
    }, demon, proposedSources, guardOverrides);
  }
  if (runtime.config.nobleSecretBody) {
    if (demon?.hunt.servantCleared)
      runtime.events.push({
        timestamp: Date.now(),
        type: "noble_contract_closed",
        payload: demon.hunt.servantCleared,
        audience: Object.freeze([]),
      });
    const expiry = lifecycle.expireNobleAtNightEnd(night, () => nightDay);
    if (expiry) {
      appendNobleContractClosure(runtime.world, nightDay, expiry, runtime.events, Phase.Night);
      (proposedSources[expiry.targetId] ??= []).push(DeathCause.ServantExpiry);
    }
    lifecycle.closeNobleNormally(night, nightDay);
  }
  // 每目标才读取原 deathLives；空来源不读取它，originalLives 保留 undefined，不预抓新的生命。
  const deaths = Object.keys(proposedSources)
    .map(Number)
    .filter((id) => {
      const scope = (originalLives = night.deathLives).get(id);
      return (
        scope &&
        runtime.world.getComponent(id, COMPONENT.Alive) === scope.life &&
        scope.life.alive &&
        aliveLifeVersion(scope.life) === scope.version
      );
    });
  const sources: DeathSources = Object.fromEntries(
    deaths.map((id) => [
      id,
      proposedSources[id]!.filter(
        (cause) =>
          (cause !== DeathCause.WolfKill ||
            (ownsWedding
              ? weddingKnifeCurrent(runtime.world, nightDay, id)
              : ownsDemon
                ? night.demonWolfSourceCurrent?.(id) === true
                : true)) &&
          (cause !== DeathCause.EvilKnightReflection ||
            night.retaliationAttacks?.some(
              (attack) => attack.target.id === id && attack.isCurrent(),
            ) === true) &&
          ((cause !== DeathCause.PureWhiteInspection &&
            cause !== DeathCause.WolfWitchInspection) ||
            night.inspectionAttacks?.some(
              (attack) =>
                attack.target.id === id && attack.cause === cause && attack.isCurrent(),
            ) === true),
      ),
    ]),
  );
  for (let i = deaths.length - 1; i >= 0; i--)
    if (!sources[deaths[i]!]!.length) deaths.splice(i, 1);
  if (runtime.config.nobleSecretBody) {
    const manager = runtime;
    publishNobleNightDamage({
      get world() { return manager.world; },
      get events() { return manager.events; },
    }, nightDay, sources, deaths);
  }
  if (demon) {
    const manager = runtime;
    publishDemonNightDamageSources({
      get events() { return manager.events; },
    }, demon, nightDay, guardOverrides, deaths, sources);
  }
  // 先完成原保护、夜仆和事实发布，再捕获活人生命；这里只准备，真实标死与追加波仍归经理的 DR。
  const livingBeforeChain = new Map(
    runtime.world.getAliveEntityIds().map((id) => {
      const life = runtime.world.getComponent(id, COMPONENT.Alive)!;
      return [id, { life, version: aliveLifeVersion(life) }] as const;
    }),
  );
  return { deaths, sources, originalLives, sourceDamage: sourceDamage!, livingBeforeChain };
}
