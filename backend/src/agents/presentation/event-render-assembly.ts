/**
 * 负责脚本展示贡献的显式组合根。输入为机制handler与共享label函数，输出按旧judge/live各自顺序安装的只读贡献表。
 * 这里只声明顺序与统一分类；条件受众归机制，labels直接复用packages，不引入逐族转发或另一个注册系统。
 */
import {
  animalDreamEventLabel,
  fragrantPairEventLabel,
  nobleSecretBodyEventLabel,
  radiantEclipseEventLabel,
  mistRavenEventLabel,
  scholarMentorEventLabel,
  timeConsortEventLabel,
  wolfSorcererEventLabel,
  tricksterEventLabel,
  orderPrinceEventLabel,
  magicianEventLabel,
  redMoonEventLabel,
  wardenEventLabel,
  awakenedBeautyEventLabel,
  awakenedPatrolEventLabel,
  awakenedGuardEventLabel,
  awakenedDuelEventLabel,
  awakenedWitchEventLabel,
  awakenedClawEventLabel,
  silenceElderEventLabel,
  crowEventLabel,
  nightmareEventLabel,
  demonHunterEventLabel,
  ghostBrideEventLabel,
  lonelyGirlEventLabel,
  wildChildEventLabel,
  shapeshifterEventLabel,
  thiefEventLabel,
  blackMarketEventLabel,
  deathAbilityEventLabel,
  awakenedEventLabel,
  wallEventLabel,
  debateEventLabel,
  cupidEventLabel,
  hybridEventLabel,
  merchantEventLabel,
  mechanicalEventLabel,
} from "@ai-werewolf-arena/game-presentation";
import {
  labelLiveContribution,
  privateLabelRows,
  publicLabelRows,
  liveHandlerContribution,
} from "./event-render-dispatch";
import type {
  ScriptChatLineHandlers,
  ScriptJudgeLineHandlers,
  ScriptReplayStageHandlers,
  ScriptLiveRenderHandlers,
  JudgeLabelContribution,
  LiveRenderContribution,
} from "./contracts";
import {
  COMMON_EVENT_CHAT_HANDLERS,
  COMMON_EVENT_JUDGE_HANDLERS,
  COMMON_EVENT_STAGE_HANDLERS,
  COMMON_EVENT_LIVE_HANDLERS,
} from "./common-event-presenters";
import {
  INITIAL_IDENTITY_EVENT_JUDGE_HANDLERS,
  INITIAL_IDENTITY_EVENT_LIVE_HANDLERS,
} from "../../features/initial-identity/event-presenters";
import {
  SHERIFF_EVENT_JUDGE_HANDLERS,
  SHERIFF_EVENT_STAGE_HANDLERS,
  SHERIFF_EVENT_LIVE_HANDLERS,
} from "../../features/sheriff/event-presenters";
import {
  DEATH_ACTIONS_EVENT_JUDGE_HANDLERS,
  DEATH_ACTIONS_EVENT_STAGE_HANDLERS,
  DEATH_ACTIONS_EVENT_LIVE_HANDLERS,
} from "../../features/death-actions/event-presenters";
import {
  NIGHT_ABILITIES_EVENT_JUDGE_HANDLERS,
  NIGHT_ABILITIES_EVENT_STAGE_HANDLERS,
  NIGHT_ABILITIES_EVENT_LIVE_HANDLERS,
  NIGHT_ABILITIES_EVENT_SKIPPED_LIVE_HANDLERS,
} from "../../features/night-abilities/event-presenters";
import {
  GARGOYLE_EVENT_JUDGE_HANDLERS,
  GARGOYLE_EVENT_STAGE_HANDLERS,
  GARGOYLE_EVENT_LIVE_HANDLERS,
} from "../../features/gargoyle/event-presenters";
import {
  ROLE_INSPECTION_EVENT_JUDGE_HANDLERS,
  ROLE_INSPECTION_EVENT_STAGE_HANDLERS,
  ROLE_INSPECTION_EVENT_LIVE_HANDLERS,
} from "../../features/role-inspection/event-presenters";
import {
  HIDDEN_WOLF_EVENT_JUDGE_HANDLERS,
  HIDDEN_WOLF_EVENT_STAGE_HANDLERS,
  HIDDEN_WOLF_EVENT_LIVE_HANDLERS,
} from "../../features/hidden-wolf/event-presenters";
import {
  BEAR_EVENT_JUDGE_HANDLERS,
  BEAR_EVENT_STAGE_HANDLERS,
  BEAR_EVENT_LIVE_HANDLERS,
} from "../../features/bear/event-presenters";
import {
  WOLF_BEAUTY_EVENT_JUDGE_HANDLERS,
  WOLF_BEAUTY_EVENT_LIVE_HANDLERS,
} from "../../features/wolf-beauty/event-presenters";
import {
  DREAMER_EVENT_JUDGE_HANDLERS,
  DREAMER_EVENT_STAGE_HANDLERS,
  DREAMER_EVENT_LIVE_HANDLERS,
} from "../../features/dreamer/event-presenters";
import {
  GRAVEKEEPER_EVENT_JUDGE_HANDLERS,
  GRAVEKEEPER_EVENT_STAGE_HANDLERS,
  GRAVEKEEPER_EVENT_LIVE_HANDLERS,
} from "../../features/gravekeeper/event-presenters";
import { SELF_DESTRUCT_EVENT_JUDGE_HANDLERS } from "../../features/self-destruct/event-presenters";
import {
  WHITE_WOLF_KING_EVENT_JUDGE_HANDLERS,
  WHITE_WOLF_KING_EVENT_LIVE_HANDLERS,
} from "../../features/white-wolf-king/event-presenters";
import {
  KNIGHT_EVENT_JUDGE_HANDLERS,
  KNIGHT_EVENT_LIVE_HANDLERS,
} from "../../features/knight/event-presenters";
import {
  WOLF_KING_EVENT_JUDGE_HANDLERS,
  WOLF_KING_EVENT_LIVE_HANDLERS,
} from "../../features/wolf-king/event-presenters";
import { IDIOT_EVENT_STAGE_HANDLERS } from "../../features/idiot/event-presenters";
import { WOLF_EVENT_STAGE_HANDLERS } from "../../features/wolf/event-presenters";
import { GUARD_EVENT_STAGE_HANDLERS } from "../../features/guard/event-presenters";
import { SEER_EVENT_STAGE_HANDLERS } from "../../features/seer/event-presenters";
import { WITCH_EVENT_STAGE_HANDLERS } from "../../features/witch/event-presenters";
import { ANIMAL_DREAM_LIVE_LABEL_ROWS } from "../../features/animal-dream/event-labels";
import { FRAGRANT_PAIR_SEER_LIVE_LABEL_ROWS } from "../../features/fragrant-pair-seer/event-labels";
import { NOBLE_SECRET_BODY_LIVE_LABEL_ROWS } from "../../features/noble-secret-body/event-labels";
import { TIME_WOLF_CONSORT_LIVE_LABEL_ROWS } from "../../features/time-wolf-consort/event-labels";
import { TRICKSTER_LIVE_LABEL_ROWS } from "../../features/trickster/event-labels";
import { ORDER_PRINCE_LIVE_LABEL_ROWS } from "../../features/order-prince/event-labels";
import { MAGICIAN_LIVE_LABEL_ROWS } from "../../features/magician/event-labels";
import { WARDEN_LIVE_LABEL_ROWS } from "../../features/warden/event-labels";
import { AWAKENED_WOLF_BEAUTY_LIVE_LABEL_ROWS } from "../../features/awakened-wolf-beauty/event-labels";
import { AWAKENED_HUNTER_LIVE_LABEL_ROWS } from "../../features/awakened-hunter/event-labels";
import { AWAKENED_GUARD_LIVE_LABEL_ROWS } from "../../features/awakened-guard/event-labels";
import { AWAKENED_WITCH_LIVE_LABEL_ROWS } from "../../features/awakened-witch/event-labels";
import { AWAKENED_WOLF_KING_LIVE_LABEL_ROWS } from "../../features/awakened-wolf-king/event-labels";
import { SILENCE_ELDER_LIVE_LABEL_ROWS } from "../../features/silence-elder/event-labels";
import { CROW_LIVE_LABEL_ROWS } from "../../features/crow/event-labels";
import { WALL_NOTES_LIVE_LABEL_ROWS } from "../../features/wall-notes/event-labels";
import { DEBATER_LIVE_LABEL_ROWS } from "../../features/debater/event-labels";
import { CUPID_LIVE_LABEL_ROWS } from "../../features/cupid/event-labels";
import { BLACK_MARKET_MERCHANT_LIVE_LABEL_ROWS } from "../../features/black-market-merchant/event-labels";
import { HYBRID_LIVE_LABEL_ROWS } from "../../features/hybrid/event-labels";
import { MIRACLE_MERCHANT_LIVE_LABEL_ROWS } from "../../features/miracle-merchant/event-labels";
import { MECHANICAL_WOLF_LIVE_LABEL_ROWS } from "../../features/mechanical-wolf/event-labels";
import {
  WOLF_SCRIPT_CHAT_HANDLERS,
  WOLF_SCRIPT_LIVE_HANDLERS,
} from "../../features/wolf/event-presenters";
import {
  LAST_WORDS_SCRIPT_JUDGE_HANDLERS,
  LAST_WORDS_SCRIPT_LIVE_HANDLERS,
} from "../../features/last-words/event-presenters";
import { IDIOT_SCRIPT_JUDGE_HANDLERS } from "../../features/idiot/event-presenters";
import { HUNTER_SCRIPT_JUDGE_HANDLERS } from "../../features/hunter/event-presenters";
import {
  SHERIFF_SCRIPT_JUDGE_HANDLERS,
  SHERIFF_SCRIPT_LIVE_HANDLERS,
} from "../../features/sheriff/event-presenters";
import { SEER_SCRIPT_LIVE_HANDLERS } from "../../features/seer/event-presenters";
import { GUARD_SCRIPT_LIVE_HANDLERS } from "../../features/guard/event-presenters";
import { WITCH_SCRIPT_LIVE_HANDLERS } from "../../features/witch/event-presenters";

export const CHAT_HANDLERS: ScriptChatLineHandlers = {
  ...COMMON_EVENT_CHAT_HANDLERS,
  ...WOLF_SCRIPT_CHAT_HANDLERS,
};
export const JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  ...INITIAL_IDENTITY_EVENT_JUDGE_HANDLERS,
  ...SHERIFF_EVENT_JUDGE_HANDLERS,
  ...COMMON_EVENT_JUDGE_HANDLERS,
  ...DEATH_ACTIONS_EVENT_JUDGE_HANDLERS,
  ...NIGHT_ABILITIES_EVENT_JUDGE_HANDLERS,
  ...GARGOYLE_EVENT_JUDGE_HANDLERS,
  ...ROLE_INSPECTION_EVENT_JUDGE_HANDLERS,
  ...HIDDEN_WOLF_EVENT_JUDGE_HANDLERS,
  ...BEAR_EVENT_JUDGE_HANDLERS,
  ...WOLF_BEAUTY_EVENT_JUDGE_HANDLERS,
  ...DREAMER_EVENT_JUDGE_HANDLERS,
  ...GRAVEKEEPER_EVENT_JUDGE_HANDLERS,
  ...SELF_DESTRUCT_EVENT_JUDGE_HANDLERS,
  ...WHITE_WOLF_KING_EVENT_JUDGE_HANDLERS,
  ...KNIGHT_EVENT_JUDGE_HANDLERS,
  ...WOLF_KING_EVENT_JUDGE_HANDLERS,
  ...LAST_WORDS_SCRIPT_JUDGE_HANDLERS,
  ...IDIOT_SCRIPT_JUDGE_HANDLERS,
  ...HUNTER_SCRIPT_JUDGE_HANDLERS,
  ...SHERIFF_SCRIPT_JUDGE_HANDLERS,
};
export const REPLAY_STAGE_HANDLERS: ScriptReplayStageHandlers = {
  ...NIGHT_ABILITIES_EVENT_STAGE_HANDLERS,
  ...DEATH_ACTIONS_EVENT_STAGE_HANDLERS,
  ...GARGOYLE_EVENT_STAGE_HANDLERS,
  ...ROLE_INSPECTION_EVENT_STAGE_HANDLERS,
  ...HIDDEN_WOLF_EVENT_STAGE_HANDLERS,
  ...BEAR_EVENT_STAGE_HANDLERS,
  ...DREAMER_EVENT_STAGE_HANDLERS,
  ...GRAVEKEEPER_EVENT_STAGE_HANDLERS,
  ...COMMON_EVENT_STAGE_HANDLERS,
  ...SHERIFF_EVENT_STAGE_HANDLERS,
  ...IDIOT_EVENT_STAGE_HANDLERS,
  ...WOLF_EVENT_STAGE_HANDLERS,
  ...GUARD_EVENT_STAGE_HANDLERS,
  ...SEER_EVENT_STAGE_HANDLERS,
  ...WITCH_EVENT_STAGE_HANDLERS,
};
export const LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  ...SHERIFF_EVENT_LIVE_HANDLERS,
  ...COMMON_EVENT_LIVE_HANDLERS,
  ...DEATH_ACTIONS_EVENT_LIVE_HANDLERS,
  ...GARGOYLE_EVENT_LIVE_HANDLERS,
  ...ROLE_INSPECTION_EVENT_LIVE_HANDLERS,
  ...HIDDEN_WOLF_EVENT_LIVE_HANDLERS,
  ...BEAR_EVENT_LIVE_HANDLERS,
  ...WOLF_BEAUTY_EVENT_LIVE_HANDLERS,
  ...DREAMER_EVENT_LIVE_HANDLERS,
  ...GRAVEKEEPER_EVENT_LIVE_HANDLERS,
  ...NIGHT_ABILITIES_EVENT_LIVE_HANDLERS,
  ...INITIAL_IDENTITY_EVENT_LIVE_HANDLERS,
  ...WOLF_KING_EVENT_LIVE_HANDLERS,
  ...WHITE_WOLF_KING_EVENT_LIVE_HANDLERS,
  ...KNIGHT_EVENT_LIVE_HANDLERS,
  ...WOLF_SCRIPT_LIVE_HANDLERS,
  ...SEER_SCRIPT_LIVE_HANDLERS,
  ...GUARD_SCRIPT_LIVE_HANDLERS,
  ...WITCH_SCRIPT_LIVE_HANDLERS,
  ...LAST_WORDS_SCRIPT_LIVE_HANDLERS,
  ...SHERIFF_SCRIPT_LIVE_HANDLERS,
};
export const JUDGE_LABEL_CONTRIBUTIONS: readonly JudgeLabelContribution[] = [
  { label: animalDreamEventLabel },
  { label: fragrantPairEventLabel },
  { label: nobleSecretBodyEventLabel },
  { label: radiantEclipseEventLabel },
  { label: mistRavenEventLabel },
  { label: scholarMentorEventLabel },
  { label: timeConsortEventLabel },
  { label: wolfSorcererEventLabel },
  { label: tricksterEventLabel },
  { label: orderPrinceEventLabel },
  { label: magicianEventLabel },
  { label: redMoonEventLabel },
  { label: wardenEventLabel },
  { label: awakenedBeautyEventLabel },
  { label: awakenedPatrolEventLabel },
  { label: awakenedGuardEventLabel },
  { label: awakenedDuelEventLabel },
  { label: awakenedWitchEventLabel },
  { label: awakenedClawEventLabel },
  { label: silenceElderEventLabel },
  { label: crowEventLabel },
  { label: nightmareEventLabel },
  { label: demonHunterEventLabel },
  { label: ghostBrideEventLabel },
  { label: lonelyGirlEventLabel, truthy: true },
  { label: wildChildEventLabel },
  { label: shapeshifterEventLabel },
  { label: thiefEventLabel },
  { label: blackMarketEventLabel },
  { label: deathAbilityEventLabel },
  { label: awakenedEventLabel },
  { label: wallEventLabel },
  { label: debateEventLabel },
  { label: cupidEventLabel },
  { label: hybridEventLabel },
  { label: merchantEventLabel },
  { label: mechanicalEventLabel },
];
export const LIVE_LABEL_CONTRIBUTIONS: readonly LiveRenderContribution[] = [
  labelLiveContribution(animalDreamEventLabel, ANIMAL_DREAM_LIVE_LABEL_ROWS),
  labelLiveContribution(fragrantPairEventLabel, FRAGRANT_PAIR_SEER_LIVE_LABEL_ROWS),
  labelLiveContribution(nobleSecretBodyEventLabel, NOBLE_SECRET_BODY_LIVE_LABEL_ROWS),
  labelLiveContribution(radiantEclipseEventLabel, privateLabelRows("god")),
  labelLiveContribution(mistRavenEventLabel, privateLabelRows("god")),
  labelLiveContribution(scholarMentorEventLabel, privateLabelRows("god")),
  labelLiveContribution(timeConsortEventLabel, TIME_WOLF_CONSORT_LIVE_LABEL_ROWS),
  labelLiveContribution(wolfSorcererEventLabel, privateLabelRows("private")),
  labelLiveContribution(tricksterEventLabel, TRICKSTER_LIVE_LABEL_ROWS),
  labelLiveContribution(orderPrinceEventLabel, ORDER_PRINCE_LIVE_LABEL_ROWS),
  labelLiveContribution(magicianEventLabel, MAGICIAN_LIVE_LABEL_ROWS),
  labelLiveContribution(nightmareEventLabel, privateLabelRows("god")),
  labelLiveContribution(wardenEventLabel, WARDEN_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedBeautyEventLabel, AWAKENED_WOLF_BEAUTY_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedPatrolEventLabel, AWAKENED_HUNTER_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedGuardEventLabel, AWAKENED_GUARD_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedDuelEventLabel, publicLabelRows("system")),
  labelLiveContribution(awakenedWitchEventLabel, AWAKENED_WITCH_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedClawEventLabel, AWAKENED_WOLF_KING_LIVE_LABEL_ROWS),
  labelLiveContribution(silenceElderEventLabel, SILENCE_ELDER_LIVE_LABEL_ROWS),
  labelLiveContribution(crowEventLabel, CROW_LIVE_LABEL_ROWS),
  labelLiveContribution(demonHunterEventLabel, privateLabelRows("god")),
  labelLiveContribution(ghostBrideEventLabel, privateLabelRows("god")),
  labelLiveContribution(lonelyGirlEventLabel, privateLabelRows("god"), true),
  labelLiveContribution(wildChildEventLabel, privateLabelRows("god")),
  labelLiveContribution(shapeshifterEventLabel, privateLabelRows("god")),
  labelLiveContribution(thiefEventLabel, privateLabelRows("god")),
  labelLiveContribution(wallEventLabel, WALL_NOTES_LIVE_LABEL_ROWS),
  labelLiveContribution(debateEventLabel, DEBATER_LIVE_LABEL_ROWS),
  labelLiveContribution(cupidEventLabel, CUPID_LIVE_LABEL_ROWS),
  labelLiveContribution(blackMarketEventLabel, BLACK_MARKET_MERCHANT_LIVE_LABEL_ROWS),
  labelLiveContribution(awakenedEventLabel, privateLabelRows("private")),
  labelLiveContribution(hybridEventLabel, HYBRID_LIVE_LABEL_ROWS),
  labelLiveContribution(merchantEventLabel, MIRACLE_MERCHANT_LIVE_LABEL_ROWS),
  liveHandlerContribution(NIGHT_ABILITIES_EVENT_SKIPPED_LIVE_HANDLERS),
  labelLiveContribution(mechanicalEventLabel, MECHANICAL_WOLF_LIVE_LABEL_ROWS),
];
