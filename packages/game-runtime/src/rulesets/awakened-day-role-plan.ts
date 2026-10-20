/**
 * 负责觉醒守卫→觉醒骑士的有限白天安全边界。输入实际边界身份与原运行依赖，输出resumeDay/nextNight。
 * 每次真实DR完整返回后才给下一Guard→Knight机会；尝试／盾资源归本族，死亡和延期词归DR，阶段与判胜归PM。
 * 不伪装死亡hook、不递归DR或复制Alive；Provider／结算异常仅收旧链权限，保真实已付及未完成遗言前缀。
 */
import {
  Phase,
  Role,
  DeathCause,
  type GameEvent,
  type DeathSources,
} from "@ai-werewolf-arena/game-contract";
import { AWAKENED_DUEL_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { AWAKENED_GUARD_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import type { World } from "../domain/world";
import type { ActionProvider, ActionRequestConstructionPort } from "../domain/actions";
import type { ToolGateway } from "../engine/actions/tool-gateway";
import type { DeathResolution } from "../engine/death-resolution";
import type { DuelLastWordsScope } from "../engine/duel-last-words";
import { openGuardBoundary, endGuardCycle } from "../features/awakened-guard/authority";
import { hasAwakenedGuardFrame } from "../features/awakened-guard/protection-ports";
import { runGuardBoundary } from "../features/awakened-guard/window";
import {
  openDuelBoundary,
  duelBoundaryOptions,
  duelChainCurrent,
  paidDuelProposal,
  closeDuelBoundary,
  closeDuelChain,
  type DuelChain,
} from "../features/awakened-knight/authority";
import { runDuelBoundary } from "../features/awakened-knight/window";

/** 沿真实边界调用，固定值捕获本次phase/day；current仍由唯一PM阶段修订号晚查。 */
export interface AwakenedDayRoleRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly requests: ActionRequestConstructionPort;
  readonly provider: ActionProvider;
  readonly gateway: ToolGateway;
  readonly deaths: DeathResolution;
  readonly phase: Phase;
  readonly day: number;
  readonly phaseRevision: number;
  current(): boolean;
}
/** 原板必有首夜守卫；只读真实已安装frame，未接入的旧板不新增World/config查询或Promise窗口。 */
export function hasAwakenedDayRolePlan(world: World): boolean {
  return hasAwakenedGuardFrame(world);
}
async function guardFirst(runtime: AwakenedDayRoleRuntime, identity: object): Promise<void> {
  if (!runtime.current()) throw new Error("awakened_day_boundary_revoked");
  const boundary = openGuardBoundary(runtime.world, runtime.day, identity, "day");
  if (boundary) await runGuardBoundary(runtime, boundary);
  if (!runtime.current()) throw new Error("awakened_day_boundary_revoked");
}
export async function runAwakenedDayRoleBoundary(
  runtime: AwakenedDayRoleRuntime,
  identity: object,
): Promise<"resumeDay" | "nextNight"> {
  if (![Phase.Day, Phase.Voting].includes(runtime.phase) || !runtime.current())
    throw new Error("awakened_day_boundary_invalid");
  await guardFirst(runtime, identity);
  const ids = runtime.world.getEntityIdsByRole(Role.AwakenedKnight);
  if (ids.length !== 1) throw new Error("awakened_knight_actor_count_invalid");
  const actorId = ids[0]!;
  let chain: DuelChain | undefined,
    words: DuelLastWordsScope | undefined,
    ordinal = 0;
  try {
    let boundary = openDuelBoundary(runtime.world, actorId, runtime.day, identity);
    if (!boundary) return "resumeDay";
    const initial = duelBoundaryOptions(runtime.world, boundary);
    if (!initial?.targetIds.length) {
      closeDuelBoundary(boundary);
      return "resumeDay";
    }
    words = runtime.deaths.openDuelLastWords(runtime.current);
    let reason: "ended" | "no_targets" | "actor_lost" | "miss", result: "resumeDay" | "nextNight";
    while (true) {
      const chosen = await runDuelBoundary(runtime, boundary);
      if (chosen.kind === "declined") {
        runtime.deaths.abortDuelLastWords(words);
        words = undefined;
        return "resumeDay";
      }
      if (chosen.kind === "ended") {
        reason = "ended";
        result = "nextNight";
        break;
      }
      chain = chosen.chain;
      const proposal = paidDuelProposal(runtime.world, chosen.attempt);
      ordinal = proposal.chain;
      const sources: DeathSources = Object.fromEntries(
        proposal.deaths.map((id) => [id, [DeathCause.AwakenedDuel]]),
      );
      // 已付款提案只带原life/version；真实shield/替死及标死仍在DR唯一prepare/commit路径。
      await runtime.deaths.resolve(
        proposal.deaths,
        sources,
        runtime.provider,
        runtime.phase,
        runtime.phase,
        Object.fromEntries(proposal.deaths.map((id) => [id, runtime.phase])),
        {
          duelLastWords: words,
          originalLives: proposal.originalLives,
          isCurrent: runtime.current,
          execution: { phaseRevision: runtime.phaseRevision },
          onInitialWaveCommitted(deaths) {
            const event: GameEvent = {
              timestamp: Date.now(),
              type: "awakened_duel_resolved",
              payload: {
                policy: AWAKENED_DUEL_POLICY,
                actorId,
                day: runtime.day,
                chain: proposal.chain,
                targetId: proposal.targetId,
                deaths: [...deaths],
              },
            };
            runtime.events.push(event);
            return event;
          },
        },
      );
      if (!runtime.current()) throw new Error("awakened_day_boundary_revoked");
      if (chosen.branch === "good") {
        reason = "miss";
        result = "resumeDay";
        break;
      }
      if (!duelChainCurrent(runtime.world, chain)) {
        reason = "actor_lost";
        result = "nextNight";
        break;
      }
      const nextIdentity = Object.freeze({});
      await guardFirst(runtime, nextIdentity);
      boundary = openDuelBoundary(runtime.world, actorId, runtime.day, nextIdentity, chain);
      if (!boundary) {
        reason = "actor_lost";
        result = "nextNight";
        break;
      }
      const options = duelBoundaryOptions(runtime.world, boundary);
      if (!options?.targetIds.length) {
        closeDuelBoundary(boundary);
        reason = "no_targets";
        result = "nextNight";
        break;
      }
    }
    await runtime.deaths.flushDuelLastWords(words, runtime.provider);
    words = undefined;
    const events = runtime.events,
      publish = events.push,
      event: GameEvent = {
        timestamp: Date.now(),
        type: "awakened_duel_chain_ended",
        payload: {
          policy: AWAKENED_DUEL_POLICY,
          actorId,
          day: runtime.day,
          chain: ordinal,
          reason,
        },
      },
      args: [GameEvent] = [event],
      invoke = Reflect.apply.bind(Reflect);
    if (!runtime.current()) throw new Error("awakened_day_boundary_revoked");
    invoke(publish, events, args);
    if (chain) closeDuelChain(runtime.world, chain);
    return result;
  } catch (error) {
    if (words) {
      try {
        runtime.deaths.abortDuelLastWords(words);
      } catch {
        /* 保留原异常，不补正常flush。 */
      }
    }
    if (chain) {
      try {
        closeDuelChain(runtime.world, chain);
      } catch {
        /* 已付尝试和真实死亡不回滚。 */
      }
    }
    throw error;
  }
}
/** 真实日终只关闭本单位；已死施者的已付盾也在此到期，失败／阶段撤销不伪造成unused。 */
export function finishAwakenedDayRoles(
  world: World,
  events: () => GameEvent[],
  day: () => number,
  completed = true,
): void {
  if (!hasAwakenedGuardFrame(world)) return;
  const ended = endGuardCycle(world, day(), completed);
  if (ended)
    events().push({
      timestamp: Date.now(),
      type: "awakened_protection_expired",
      payload: { policy: AWAKENED_GUARD_POLICY, ...ended },
      audience: Object.freeze([]),
    });
}
