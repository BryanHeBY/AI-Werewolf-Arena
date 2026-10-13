/**
 * 负责从贵族／隐秘之躯已知知识构造冻结的玩家视图，结构类型直接来自契约包。
 * 输入为 known journal 与公开 phase；输出为复制的选择／契约／资源字段和 awaitingNightReport。
 * 日志所有者仍拥有知识更新；此模块仅投影，不付款或授予行动权限。标记必须由公开阶段
 * 决定，不能比较真实与已知状态来泄漏尚未通知的变化。
 */
import { Phase } from "../../../../core/domain/identity";
import type { NightChoice } from "./state";

import type { SecretBodyKnowledge, NobleKnowledge } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
export type { SecretBodyKnowledge, NobleKnowledge } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
export type SecretBodyPlayerState = Readonly<
  SecretBodyKnowledge & { awaitingNightReport: boolean }
>;
export type NoblePlayerState = Readonly<NobleKnowledge & { awaitingNightReport: boolean }>;

function copyChoice(choice: NightChoice | null): NightChoice | null {
  return choice && Object.freeze({ day: choice.day, targetId: choice.targetId });
}
export function copyNobleKnowledge(known: NobleKnowledge): NobleKnowledge {
  return Object.freeze({
    wolfActionPolicy: known.wolfActionPolicy,
    lastNotifiedNight: known.lastNotifiedNight,
    lastChoice: copyChoice(known.lastChoice),
    contracts: Object.freeze(
      known.contracts.map((c) =>
        Object.freeze({
          id: c.id,
          targetId: c.targetId,
          createdNight: c.createdNight,
          expiresNight: c.expiresNight,
          status: Object.freeze({ ...c.status }),
        }),
      ),
    ),
  });
}
export function copySecretBodyKnowledge(known: SecretBodyKnowledge): SecretBodyKnowledge {
  return Object.freeze({
    protectionRepeatPolicy: known.protectionRepeatPolicy,
    lastNotifiedNight: known.lastNotifiedNight,
    resource: known.resource,
    publicRevealDay: known.publicRevealDay,
    lastChoice: copyChoice(known.lastChoice),
  });
}
export function projectSecretBodyKnowledge(
  known: SecretBodyKnowledge,
  phase: Phase,
): SecretBodyPlayerState {
  return Object.freeze({
    ...copySecretBodyKnowledge(known),
    // 仅公开阶段决定此标记，不能用真实／已知状态的差异推断尚未通知的结果。
    awaitingNightReport: phase !== Phase.Night && known.resource !== "exile_revealed",
  });
}
export function projectNobleKnowledge(known: NobleKnowledge, phase: Phase): NoblePlayerState {
  return Object.freeze({
    ...copyNobleKnowledge(known),
    awaitingNightReport: phase !== Phase.Night,
  });
}
export type NobleBodyNightNotice =
  | Readonly<{ kind: "secret_body"; actorId: number; day: number; known: SecretBodyKnowledge }>
  | Readonly<{ kind: "night_noble"; actorId: number; day: number; known: NobleKnowledge }>;
