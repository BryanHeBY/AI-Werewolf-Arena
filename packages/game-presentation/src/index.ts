/**
 * 向后端和浏览器公开双端展示函数。导出查验／胜负与已授权事件的标签映射；
 * 原文案和契约读取由具体展示模块消费，类型、词典与事实定义保留各自所有者。
 * 此出口不引入 World、Node、React、传输或资源提交权限。
 */
export {
  inspectionLabel,
  victoryClaimLabel,
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "./results";
export {
  hybridEventLabel,
  cupidEventLabel,
  debateEventLabel,
  wallEventLabel,
  thiefEventLabel,
  wildChildEventLabel,
  shapeshifterEventLabel,
  lonelyGirlEventLabel,
  ghostBrideEventLabel,
} from "./events/relationships";
export {
  awakenedEventLabel,
  mechanicalEventLabel,
  merchantEventLabel,
  deathAbilityEventLabel,
  blackMarketEventLabel,
} from "./events/abilities";
export {
  demonHunterEventLabel,
  nightmareEventLabel,
  redMoonEventLabel,
  magicianEventLabel,
  orderPrinceEventLabel,
  tricksterEventLabel,
  wolfSorcererEventLabel,
  timeConsortEventLabel,
  scholarMentorEventLabel,
  mistRavenEventLabel,
  radiantEclipseEventLabel,
  nobleSecretBodyEventLabel,
  fragrantPairEventLabel,
} from "./events/night-mechanisms";

export { formatNativeRolePart } from "./native-role-state";

export { formatComponentPart } from "./component-state";

export { GAME_PRESENTATION_CONTRACT, supportsGamePresentation } from "./version";

export { animalDreamEventLabel } from "./events/animal-dream";

export { crowEventLabel } from "./events/crow";

export { awakenedWitchEventLabel } from "./events/awakened-witch";
export { awakenedClawEventLabel } from "./events/awakened-claws";
export { silenceElderEventLabel } from "./events/silence-elder";

export { wardenEventLabel } from "./events/warden";

export { awakenedBeautyEventLabel } from "./events/awakened-beauty";
export { awakenedPatrolEventLabel, patrolDirection } from "./events/awakened-patrol";

export { awakenedGuardEventLabel } from "./events/awakened-guard";
export { awakenedDuelEventLabel } from "./events/awakened-duel";
export { agentOutputPresentation, isAgentOutputVisible } from "./agent-output";
export type { AgentOutputDisplayOptions, AgentOutputTone } from "./agent-output";
