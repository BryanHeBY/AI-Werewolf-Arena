/**
 * Provides the named compatibility exit for existing noble-secret-body fact consumers.
 * Inputs are public contract reader/type ports; outputs retain the original
 * exports without duplicate parsing. This facade never renders text, validates
 * finite board support or grants domain authority; Node ingress stays separate.
 */
export {
  NOBLE_SECRET_BODY_POLICY,
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
  nobleSecretBodyVisibility,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
export type {
  KnownNightChoice,
  KnownServantContract,
  NobleKnowledge,
  SecretBodyKnowledge,
  NobleContractClosedFact,
  NobleSecretBodyPayloadMap,
  NobleSecretBodyEventType,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
