import { Phase } from "../../../../core/domain/identity";
import type { NightChoice } from "./state";

import type { SecretBodyKnowledge, NobleKnowledge } from "@ai-werewolf-arena/game-text";
export type { SecretBodyKnowledge, NobleKnowledge } from "@ai-werewolf-arena/game-text";
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
    // Public phase, never actual-versus-known inequality, determines this marker.
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
