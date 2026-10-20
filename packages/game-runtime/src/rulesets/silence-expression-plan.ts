/**
 * 负责将禁言表达贡献接在普通／PK发言与真实日终的具名位置。输入为明确配置和运行端口，
 * 输出原表达 Promise 或无替换；未配置时不读 World、不创建夜窗或额外异步等待。
 * 本组合不拥有状态、投票资格或阶段切换，公告及到期只发表本族 owner 已确认的事实。
 */
import type { ReadonlyBoardConfig, GameEvent } from "@ai-werewolf-arena/game-contract";
import {
  SILENCE_ELDER_POLICY,
  type SilenceExpressionRound,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import type { World } from "../domain/world";
import {
  openSilenceSpeech,
  type SilenceExpressionRuntime,
} from "../features/silence-elder/expression-window";
import {
  pendingSilenceAnnouncement,
  markSilenceAnnounced,
  expireSilence,
} from "../features/silence-elder/authority";

export function announceSilenceDay(
  config: ReadonlyBoardConfig,
  world: World,
  events: GameEvent[],
  day: number,
  isCurrent: () => boolean = () => true,
): void {
  if (!config.silenceElder) return;
  // 先准备可触发外部读取的发表callee和时钟，再核阶段与原目标；读取getter不能把公告写给新生命。
  const publish = events.push,
    timestamp = Date.now();
  if (!isCurrent()) return;
  const payload = pendingSilenceAnnouncement(world, day);
  if (!payload) return;
  Reflect.apply(publish, events, [
    {
      timestamp,
      type: "silence_announced",
      payload: { policy: SILENCE_ELDER_POLICY, day, ...payload },
    },
  ]);
  markSilenceAnnounced(world, day);
}

export function replaceSilencedSpeech(
  config: ReadonlyBoardConfig,
  runtime: SilenceExpressionRuntime,
  actorId: number,
  round: SilenceExpressionRound,
): Promise<void> | undefined {
  return config.silenceElder ? openSilenceSpeech(runtime, actorId, round) : undefined;
}

export function finishSilenceDay(
  config: ReadonlyBoardConfig,
  world: World,
  events: GameEvent[],
  day: number,
): void {
  if (!config.silenceElder) return;
  const targetId = expireSilence(world, day);
  if (targetId === null) return;
  events.push({
    timestamp: Date.now(),
    type: "silence_expired",
    payload: { policy: SILENCE_ELDER_POLICY, day, targetId },
    audience: Object.freeze([]),
  });
}
