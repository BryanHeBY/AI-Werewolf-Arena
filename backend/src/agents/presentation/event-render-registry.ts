/**
 * 负责按事件类型装配脚本和终端的展示贡献。输入为事件、私有输出选项与语言；输出为原聊天行和分类文本。保留各贡献的读取、受众与分派顺序，不提交行动、改写事实或重算历史阵营。事件文案消费共享展示 owner，自定义贡献仍保留原接口。
 */
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import {
  awakenedGuardEventLabel,
  awakenedDuelEventLabel,
} from "@ai-werewolf-arena/game-presentation";
import {
  readAwakenedGuardFact,
  awakenedGuardFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import {
  awakenedBeautyEventLabel,
  awakenedPatrolEventLabel,
} from "@ai-werewolf-arena/game-presentation";
import { wardenEventLabel } from "@ai-werewolf-arena/game-presentation";
import { nobleSecretBodyVisibility } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import { nobleSecretBodyEventLabel } from "@ai-werewolf-arena/game-presentation";
import {
  animalDreamFactAudience,
  type AnimalDreamEventType,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { animalDreamEventLabel } from "@ai-werewolf-arena/game-presentation";
import { fragrantPairVisibility } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { fragrantPairEventLabel } from "@ai-werewolf-arena/game-presentation";
import { radiantEclipseEventLabel } from "@ai-werewolf-arena/game-presentation";
import { mistRavenEventLabel } from "@ai-werewolf-arena/game-presentation";
import { scholarMentorEventLabel } from "@ai-werewolf-arena/game-presentation";
import { timeConsortEventLabel } from "@ai-werewolf-arena/game-presentation";
import { wolfSorcererEventLabel } from "@ai-werewolf-arena/game-presentation";
import { tricksterEventLabel } from "@ai-werewolf-arena/game-presentation";
import { orderPrinceEventLabel } from "@ai-werewolf-arena/game-presentation";
import { magicianEventLabel } from "@ai-werewolf-arena/game-presentation";
import { redMoonEventLabel } from "@ai-werewolf-arena/game-presentation";
import { awakenedWitchEventLabel } from "@ai-werewolf-arena/game-presentation";
import { awakenedClawEventLabel } from "@ai-werewolf-arena/game-presentation";
import { silenceElderEventLabel } from "@ai-werewolf-arena/game-presentation";
import {
  SILENCE_ELDER_EVENT_TYPES,
  silenceElderFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { crowEventLabel } from "@ai-werewolf-arena/game-presentation";
import { nightmareEventLabel } from "@ai-werewolf-arena/game-presentation";
import { demonHunterEventLabel } from "@ai-werewolf-arena/game-presentation";
import { ghostBrideEventLabel } from "@ai-werewolf-arena/game-presentation";
import { lonelyGirlEventLabel } from "@ai-werewolf-arena/game-presentation";
import { wildChildEventLabel } from "@ai-werewolf-arena/game-presentation";
import { shapeshifterEventLabel } from "@ai-werewolf-arena/game-presentation";
import { thiefEventLabel } from "@ai-werewolf-arena/game-presentation";
import { readGravekeeperFeedback, readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import { text as defaultText, roleName, type Locale } from "@ai-werewolf-arena/game-text";
import {
  wallEventLabel,
  blackMarketEventLabel,
  deathAbilityEventLabel,
  inspectionLabel,
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
  mechanicalEventLabel,
  merchantEventLabel,
  hybridEventLabel,
  cupidEventLabel,
  debateEventLabel,
  awakenedEventLabel,
} from "@ai-werewolf-arena/game-presentation";
/** 文件说明：事件 -> 脚本回放文本/终端文本渲染注册表。 */
import { GameEvent } from "../../domain/model";
import {
  ScriptChatLineHandlers,
  ScriptJudgeLineHandlers,
  ScriptLiveRender,
  ScriptLiveRenderHandlers,
  ScriptReplayStageHandlers,
} from "./contracts";
import { GUARD_SCRIPT_LIVE_HANDLERS } from "../../features/guard/event-presenters";
import { HUNTER_SCRIPT_JUDGE_HANDLERS } from "../../features/hunter/event-presenters";
import { SEER_SCRIPT_LIVE_HANDLERS } from "../../features/seer/event-presenters";
import { WITCH_SCRIPT_LIVE_HANDLERS } from "../../features/witch/event-presenters";
import {
  WOLF_SCRIPT_CHAT_HANDLERS,
  WOLF_SCRIPT_LIVE_HANDLERS,
} from "../../features/wolf/event-presenters";
import { LAST_WORDS_SCRIPT_JUDGE_HANDLERS } from "../../features/last-words/event-presenters";
import { LAST_WORDS_SCRIPT_LIVE_HANDLERS } from "../../features/last-words/event-presenters";
import { IDIOT_SCRIPT_JUDGE_HANDLERS } from "../../features/idiot/event-presenters";
import {
  SHERIFF_SCRIPT_JUDGE_HANDLERS,
  SHERIFF_SCRIPT_LIVE_HANDLERS,
} from "../../features/sheriff/event-presenters";
import { getDefaultTextLocalizationRegistry } from "./text-localization-registry";

function resultLabel(
  payload: unknown,
  locale: Locale,
  key: "console.judge.result" | "console.live.result",
  text: PlayerText = defaultText,
): string {
  if (
    payload &&
    typeof payload === "object" &&
    (Object.hasOwn(payload, "outcome") || Object.hasOwn(payload, "decidedAt"))
  ) {
    try {
      const decision = readVictoryResult(payload);
      return `${text(locale, "victory.finished", { result: outcomeLabel(decision.outcome, locale, text), reason: getDefaultTextLocalizationRegistry().gameOverReason(decision.reason, locale) })} · ${outcomeWinnersLabel(decision.outcome, locale, text)} · ${victoryPointLabel(decision.decidedAt, locale, text)}`;
    } catch {
      return text(locale, "replay.unknown");
    }
  }
  const old = payload as { winner?: string | null; reason?: string };
  return text(locale, key, {
    winner: getDefaultTextLocalizationRegistry().winnerName(old.winner ?? "", locale),
    reason: getDefaultTextLocalizationRegistry().gameOverReason(old.reason ?? "", locale),
  });
}

function gravekeeperLabel(
  payload: unknown,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  const report = readGravekeeperFeedback(payload);
  return report
    ? text(locale, "console.gravekeeper.report", {
        actor: report.actorId,
        target: report.targetId,
        exileDay: report.exileDay,
        receivedDay: report.receivedDay,
        result: inspectionLabel(report.result, locale, text),
      })
    : text(locale, "replay.unknown");
}

const CHAT_HANDLERS: ScriptChatLineHandlers = {
  day_speech: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.chat.day", { actor: event.payload.actorId, speech: event.payload.text }),
  ...WOLF_SCRIPT_CHAT_HANDLERS,
};

const JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  player_role_revealed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_revealed", {
      actor: event.payload.playerId,
      role: roleName(event.payload.role, locale),
    }),
  sheriff_pk_started: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.pk.sheriff", {
      players: event.payload.candidates
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  exile_pk_started: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.pk.exile", {
      players: event.payload.candidates
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  player_shot: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.player_shot", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  lucky_ability_skipped: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.lucky.skipped", {
      actor: event.payload.actorId,
      day: event.payload.day,
      ability: event.payload.abilityId,
    }),
  gargoyle_awakened: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.gargoyle.awakened", {
      actor: event.payload.actorId,
      day: event.payload.day,
    }),
  role_inspection_skipped: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_inspection.skipped", {
      actor: event.payload.actorId,
      day: event.payload.day,
      reason: text(
        locale,
        event.payload.reason === "passed" ? "inspection.skip.passed" : "inspection.skip.no_targets",
      ),
    }),
  role_inspected: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.role_inspected", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      result: inspectionLabel(event.payload.result, locale, text),
    }),
  hidden_wolf_awakened: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.hidden_wolf.awakened", {
      actor: event.payload.actorId,
      day: event.payload.day,
    }),
  bear_roared: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.bear.report", {
      day: event.payload.day,
      result: text(locale, event.payload.roared ? "bear.roar" : "bear.quiet"),
    }),
  charm_applied: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.applied", {
      actor: event.payload.actorId,
      target: event.payload.targetId ?? text(locale, "common.none"),
      day: event.payload.day,
    }),
  charm_death: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.death", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  charm_blocked: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.charm.blocked", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  additional_deaths: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.additional_deaths", {
      players: event.payload.deaths
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  dream_applied: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.dream.applied", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      day: event.payload.day,
      consecutive: text(locale, event.payload.consecutive ? "common.yes" : "common.no"),
    }),
  dream_death: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.dream.death", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
      day: event.payload.day,
      reason: text(
        locale,
        event.payload.reason === "consecutive"
          ? "console.dream.consecutive"
          : "console.dream.linked",
      ),
    }),
  death_shot_blocked: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.shot.blocked", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  gravekeeper_reported: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    gravekeeperLabel(event.payload, locale, text),
  phase_changed: (event, locale = "zh-CN", text: PlayerText = defaultText) => {
    const p = event.payload;
    if (p.phase === "night") return text(locale, "console.judge.night", { day: p.day });
    if (p.phase === "day") return text(locale, "console.judge.day", { day: p.day });
    if (p.phase === "voting") return text(locale, "console.judge.voting");
    if (p.phase === "game_over") {
      const i18n = getDefaultTextLocalizationRegistry();
      return p.winner != null && p.reason != null
        ? text(locale, "console.judge.over", {
            winner: i18n.winnerName(p.winner, locale),
            reason: i18n.gameOverReason(p.reason, locale),
          })
        : text(locale, "console.judge.over_short");
    }
    return null;
  },
  night_resolved: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.deaths.length
      ? text(locale, "console.judge.deaths", {
          deaths: event.payload.deaths
            .map((id) => text(locale, "common.player_reference", { id }))
            .join(", "),
        })
      : text(locale, "console.judge.peace"),
  vote_summary: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.votes", {
      votes: event.payload.votes
        .map((item) => {
          const vote =
            item.abstain || item.targetId == null
              ? text(locale, "console.vote.abstain", { actor: item.actorId })
              : text(locale, "console.vote.target", { actor: item.actorId, target: item.targetId });
          return item.weight !== 1
            ? `${vote}${text(locale, "replay.vote_weight", { weight: item.weight })}`
            : vote;
        })
        .join(", "),
    }),
  voted_out: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.exile", { target: event.payload.target }),
  sheriff_badge_transferred: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_transfer", {
      from: event.payload.fromId,
      to: event.payload.toId,
    }),
  sheriff_badge_destroyed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_destroy", { target: event.payload.targetId }),
  wolf_self_destruct: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.blast", { actor: event.payload.wolfId }),
  white_wolf_king_self_destruct: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.targetId === null
      ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId })
      : text(locale, "console.white_wolf_king.blast", {
          actor: event.payload.actorId,
          target: event.payload.targetId,
        }),
  knight_duel: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, event.payload.result === "wolf" ? "console.knight.wolf" : "console.knight.miss", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  wolf_king_shot: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.wolf_king_shot", {
      actor: event.payload.actorId,
      target: event.payload.targetId,
    }),
  game_over: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    resultLabel(event.payload, locale, "console.judge.result", text),
  ...LAST_WORDS_SCRIPT_JUDGE_HANDLERS,
  ...IDIOT_SCRIPT_JUDGE_HANDLERS,
  ...HUNTER_SCRIPT_JUDGE_HANDLERS,
  ...SHERIFF_SCRIPT_JUDGE_HANDLERS,
};

const REPLAY_STAGE_HANDLERS: ScriptReplayStageHandlers = {
  awakened_inherited: () => "awakened_inherited",
  awakened_ready: () => "awakened_activation",
  awakened_mimicked: () => "awakened_mimic",
  awakened_mimic_skipped: () => "awakened_mimic",
  awakened_poison_used: () => "awakened_skill",
  awakened_guard_chosen: () => "awakened_skill",
  awakened_skill_skipped: () => "awakened_skill",
  awakened_attack_chosen: () => "awakened_attack",
  player_shot: () => "death_shot",
  gargoyle_awakened: () => "gargoyle_awakened",
  role_inspected: () => "role_inspected",
  role_inspection_skipped: () => "role_inspection_skipped",
  hidden_wolf_awakened: () => "hidden_wolf_awakened",
  bear_roared: () => "bear_roared",
  dream_applied: () => "dreamer",
  dream_death: () => "dream_death",
  gravekeeper_reported: () => "gravekeeper_feedback",
  phase_changed: (event) => String(event.payload.phase ?? "phase_changed"),
  day_speech: () => "day_speech",
  sheriff_pk_started: () => "sheriff_pk_speech",
  exile_pk_started: () => "exile_pk_speech",
  vote_cast: () => "voting",
  vote_summary: () => "voting",
  voted_out: () => "voting",
  idiot_revealed: () => "voting",
  wolf_discussion: () => "wolf_discussion",
  wolf_discussion_ended: () => "wolf_discussion",
  wolf_kill_vote_cast: () => "wolf_discussion",
  guard_applied: () => "guard",
  seer_checked: () => "seer",
  witch_potion_used: () => "witch",
  witch_potion_skipped: () => "witch",
  sheriff_candidate_declared: () => "sheriff",
  sheriff_candidates_finalized: () => "sheriff",
  sheriff_vote_cast: () => "sheriff",
  sheriff_elected: () => "sheriff",
};

const LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  sheriff_pk_started: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "god",
      text: text(locale, "console.pk.sheriff", {
        players: event.payload.candidates
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],
  exile_pk_started: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "god",
      text: text(locale, "console.pk.exile", {
        players: event.payload.candidates
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],

  player_shot: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "action",
      text: text(locale, "console.player_shot", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
      }),
    },
  ],
  gargoyle_awakened: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.gargoyle.awakened", {
              actor: event.payload.actorId,
              day: event.payload.day,
            }),
          },
        ]
      : [],
  role_inspection_skipped: (
    event,
    privateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.role_inspection.skipped", {
              actor: event.payload.actorId,
              day: event.payload.day,
              reason: text(
                locale,
                event.payload.reason === "passed"
                  ? "inspection.skip.passed"
                  : "inspection.skip.no_targets",
              ),
            }),
          },
        ]
      : [],
  role_inspected: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.role_inspected", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              result: inspectionLabel(event.payload.result, locale, text),
            }),
          },
        ]
      : [],
  hidden_wolf_awakened: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.hidden_wolf.awakened", {
              actor: event.payload.actorId,
              day: event.payload.day,
            }),
          },
        ]
      : [],
  bear_roared: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.bear.report", {
        day: event.payload.day,
        result: text(locale, event.payload.roared ? "bear.roar" : "bear.quiet"),
      }),
    },
  ],
  charm_applied: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.applied", {
              actor: event.payload.actorId,
              target: event.payload.targetId ?? text(locale, "common.none"),
              day: event.payload.day,
            }),
          },
        ]
      : [],
  charm_death: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.death", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
          },
        ]
      : [],
  charm_blocked: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.charm.blocked", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
          },
        ]
      : [],
  additional_deaths: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.additional_deaths", {
        players: event.payload.deaths
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],
  dream_applied: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.dream.applied", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              day: event.payload.day,
              consecutive: text(locale, event.payload.consecutive ? "common.yes" : "common.no"),
            }),
          },
        ]
      : [],
  dream_death: (event, privateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    privateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "console.dream.death", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
              day: event.payload.day,
              reason: text(
                locale,
                event.payload.reason === "consecutive"
                  ? "console.dream.consecutive"
                  : "console.dream.linked",
              ),
            }),
          },
        ]
      : [],
  death_shot_blocked: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.shot.blocked", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
      }),
    },
  ],
  gravekeeper_reported: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [{ kind: "private", text: gravekeeperLabel(event.payload, locale, text) }]
      : [],
  death_ability_changed: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: deathAbilityEventLabel(event.type, event.payload, locale, text)!,
          },
        ]
      : [],
  ability_changed: (event, printPrivateEvents, locale = "zh-CN", text: PlayerText = defaultText) =>
    printPrivateEvents
      ? [
          {
            kind: "private",
            text: text(locale, "ability.change", {
              actor: event.payload.actorId,
              id: event.payload.abilityId,
              kind: text(locale, `ability.kind.${event.payload.kind}`),
              operation: text(locale, `ability.operation.${event.payload.operation}`),
            }),
          },
        ]
      : [],
  god_private_game_info: (
    event,
    printPrivateEvents,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    printPrivateEvents
      ? [
          {
            kind: "god",
            text: text(locale, "console.live.initial", {
              roles: event.payload.players
                .map(
                  (item) =>
                    `${text(locale, "common.player_reference", { id: item.id })}:${getDefaultTextLocalizationRegistry().roleName(item.role, locale)}`,
                )
                .join(", "),
            }),
          },
        ]
      : [],
  day_speech: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.live.day", {
        actor: event.payload.actorId,
        speech: event.payload.text,
      }),
    },
  ],
  wolf_king_shot: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.judge.wolf_king_shot", {
        actor: event.payload.actorId,
        target: event.payload.targetId,
      }),
    },
  ],
  white_wolf_king_self_destruct: (
    event,
    _private,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) => [
    {
      kind: "system",
      text:
        event.payload.targetId === null
          ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId })
          : text(locale, "console.white_wolf_king.blast", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
    },
  ],
  knight_duel: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(
        locale,
        event.payload.result === "wolf" ? "console.knight.wolf" : "console.knight.miss",
        { actor: event.payload.actorId, target: event.payload.targetId },
      ),
    },
  ],
  game_over: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    { kind: "god", text: resultLabel(event.payload, locale, "console.live.result", text) },
  ],
  ...WOLF_SCRIPT_LIVE_HANDLERS,
  ...SEER_SCRIPT_LIVE_HANDLERS,
  ...GUARD_SCRIPT_LIVE_HANDLERS,
  ...WITCH_SCRIPT_LIVE_HANDLERS,
  ...LAST_WORDS_SCRIPT_LIVE_HANDLERS,
  ...SHERIFF_SCRIPT_LIVE_HANDLERS,
};

/** 脚本渲染注册表。 */
export class ScriptEventRenderRegistry {
  toChatLine(
    event: GameEvent,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): string | null {
    const handler = CHAT_HANDLERS[event.type];
    return handler
      ? (handler as (event: GameEvent, locale: Locale, text?: PlayerText) => string | null)(
          event,
          locale,
          text,
        )
      : null;
  }

  toJudgeLine(
    event: GameEvent,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): string | null {
    const animal = animalDreamEventLabel(event.type, event.payload, locale, text);
    if (animal !== null) return animal;
    const fragrant = fragrantPairEventLabel(event.type, event.payload, locale, text);
    if (fragrant !== null) return fragrant;
    const noble = nobleSecretBodyEventLabel(event.type, event.payload, locale, text);
    if (noble !== null) return noble;
    const radiant = radiantEclipseEventLabel(event.type, event.payload, locale, text);
    if (radiant !== null) return radiant;
    const mist = mistRavenEventLabel(event.type, event.payload, locale, text);
    if (mist !== null) return mist;
    const modifier = scholarMentorEventLabel(event.type, event.payload, locale, text);
    if (modifier !== null) return modifier;
    const consort = timeConsortEventLabel(event.type, event.payload, locale, text);
    if (consort !== null) return consort;
    const sorcerer = wolfSorcererEventLabel(event.type, event.payload, locale, text);
    if (sorcerer !== null) return sorcerer;
    const trickster = tricksterEventLabel(event.type, event.payload, locale, text);
    if (trickster !== null) return trickster;
    const prince = orderPrinceEventLabel(event.type, event.payload, locale, text);
    if (prince !== null) return prince;
    const magician = magicianEventLabel(event.type, event.payload, locale, text);
    if (magician !== null) return magician;
    const redMoon = redMoonEventLabel(event.type, event.payload, locale, text);
    if (redMoon !== null) return redMoon;
    const warden = wardenEventLabel(event.type, event.payload, locale, text);
    if (warden !== null) return warden;
    const beauty = awakenedBeautyEventLabel(event.type, event.payload, locale, text);
    if (beauty !== null) return beauty;
    const patrol = awakenedPatrolEventLabel(event.type, event.payload, locale, text);
    if (patrol !== null) return patrol;
    const protection = awakenedGuardEventLabel(event.type, event.payload, locale, text);
    if (protection !== null) return protection;
    const duel = awakenedDuelEventLabel(event.type, event.payload, locale, text);
    if (duel !== null) return duel;
    const brew = awakenedWitchEventLabel(event.type, event.payload, locale, text);
    if (brew !== null) return brew;
    const claws = awakenedClawEventLabel(event.type, event.payload, locale, text);
    if (claws !== null) return claws;
    const silence = silenceElderEventLabel(event.type, event.payload, locale, text);
    if (silence !== null) return silence;
    const crow = crowEventLabel(event.type, event.payload, locale, text);
    if (crow !== null) return crow;
    const nightmare = nightmareEventLabel(event.type, event.payload, locale, text);
    if (nightmare !== null) return nightmare;
    const demon = demonHunterEventLabel(event.type, event.payload, locale, text);
    if (demon !== null) return demon;
    const wedding = ghostBrideEventLabel(event.type, event.payload, locale, text);
    if (wedding !== null) return wedding;
    const lonely = lonelyGirlEventLabel(event.type, event.payload, locale, text);
    if (lonely) return lonely;
    const wild = wildChildEventLabel(event.type, event.payload, locale, text);
    if (wild !== null) return wild;
    const shape = shapeshifterEventLabel(event.type, event.payload, locale, text);
    if (shape !== null) return shape;
    const thief = thiefEventLabel(event.type, event.payload, locale, text);
    if (thief !== null) return thief;
    const black = blackMarketEventLabel(event.type, event.payload, locale, text);
    if (black !== null) return black;
    const deathAbility = deathAbilityEventLabel(event.type, event.payload, locale, text);
    if (deathAbility !== null) return deathAbility;
    const awakened = awakenedEventLabel(event.type, event.payload, locale, text);
    if (awakened !== null) return awakened;
    const wall = wallEventLabel(event.type, event.payload, locale, text);
    if (wall !== null) return wall;
    const debate = debateEventLabel(event.type, event.payload, locale, text);
    if (debate !== null) return debate;
    const cupid = cupidEventLabel(event.type, event.payload, locale, text);
    if (cupid !== null) return cupid;
    const hybrid = hybridEventLabel(event.type, event.payload, locale, text);
    if (hybrid !== null) return hybrid;
    const merchant = merchantEventLabel(event.type, event.payload, locale, text);
    if (merchant !== null) return merchant;
    const mechanical = mechanicalEventLabel(event.type, event.payload, locale, text);
    if (mechanical !== null) return mechanical;
    const handler = JUDGE_HANDLERS[event.type];
    return handler
      ? (handler as (event: GameEvent, locale: Locale, text?: PlayerText) => string | null)(
          event,
          locale,
          text,
        )
      : null;
  }

  toReplayStage(event: GameEvent): string {
    const handler = REPLAY_STAGE_HANDLERS[event.type];
    if (handler) {
      return (handler as (event: GameEvent) => string | null)(event) ?? event.type;
    }
    return event.type;
  }

  toLiveRender(
    event: GameEvent,
    printPrivateEvents: boolean,
    locale: Locale = "zh-CN",
    text: PlayerText = defaultText,
  ): ScriptLiveRender[] {
    const animal = animalDreamEventLabel(event.type, event.payload, locale, text);
    if (animal !== null) {
      const visibility = animalDreamFactAudience(event.type as AnimalDreamEventType);
      // 文案与复盘共用；终端只附加分类和私有开关，不扩大事实受众。
      return visibility === "public"
        ? [{ kind: "system", text: animal }]
        : printPrivateEvents
          ? [{ kind: visibility === "actor" ? "private" : "god", text: animal }]
          : [];
    }
    const fragrant = fragrantPairEventLabel(event.type, event.payload, locale, text);
    if (fragrant !== null)
      return printPrivateEvents
        ? [
            {
              kind: fragrantPairVisibility(event.type) === "actor" ? "private" : "god",
              text: fragrant,
            },
          ]
        : [];
    const noble = nobleSecretBodyEventLabel(event.type, event.payload, locale, text);
    if (noble !== null) {
      const visibility = nobleSecretBodyVisibility(event.type);
      return visibility === "public"
        ? [{ kind: "system", text: noble }]
        : printPrivateEvents
          ? [{ kind: visibility === "actor" ? "private" : "god", text: noble }]
          : [];
    }
    const radiant = radiantEclipseEventLabel(event.type, event.payload, locale, text);
    if (radiant !== null) return printPrivateEvents ? [{ kind: "god", text: radiant }] : [];
    const mist = mistRavenEventLabel(event.type, event.payload, locale, text);
    if (mist !== null) return printPrivateEvents ? [{ kind: "god", text: mist }] : [];
    const modifier = scholarMentorEventLabel(event.type, event.payload, locale, text);
    if (modifier !== null) return printPrivateEvents ? [{ kind: "god", text: modifier }] : [];
    const consort = timeConsortEventLabel(event.type, event.payload, locale, text);
    if (consort !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "time_consort_reflected" ? "god" : "private", text: consort }]
        : [];
    const sorcerer = wolfSorcererEventLabel(event.type, event.payload, locale, text);
    if (sorcerer !== null) return printPrivateEvents ? [{ kind: "private", text: sorcerer }] : [];
    const trickster = tricksterEventLabel(event.type, event.payload, locale, text);
    if (trickster !== null)
      return event.type === "exile_target_mapped"
        ? [{ kind: "system", text: trickster }]
        : printPrivateEvents
          ? [{ kind: "private", text: trickster }]
          : [];
    const prince = orderPrinceEventLabel(event.type, event.payload, locale, text);
    if (prince !== null)
      return event.type === "order_prince_choice_committed"
        ? printPrivateEvents
          ? [{ kind: "god", text: prince }]
          : []
        : [{ kind: "system", text: prince }];
    const magician = magicianEventLabel(event.type, event.payload, locale, text);
    if (magician !== null)
      return event.type === "death_shot_missed"
        ? [{ kind: "system", text: magician }]
        : printPrivateEvents
          ? [{ kind: "god", text: magician }]
          : [];
    const nightmare = nightmareEventLabel(event.type, event.payload, locale, text);
    if (nightmare !== null) return printPrivateEvents ? [{ kind: "god", text: nightmare }] : [];
    const warden = wardenEventLabel(event.type, event.payload, locale, text);
    if (warden !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "warden_resolved" ? "god" : "private", text: warden }]
        : [];
    const beauty = awakenedBeautyEventLabel(event.type, event.payload, locale, text);
    if (beauty !== null)
      return event.type === "awakened_beauty_replaced"
        ? [{ kind: "system", text: beauty }]
        : printPrivateEvents
          ? [
              {
                kind: event.type === "awakened_beauty_replacement_paid" ? "god" : "private",
                text: beauty,
              },
            ]
          : [];
    const patrol = awakenedPatrolEventLabel(event.type, event.payload, locale, text);
    if (patrol !== null)
      return event.type === "awakened_patrol_resolved"
        ? [{ kind: "system", text: patrol }]
        : printPrivateEvents
          ? [{ kind: "private", text: patrol }]
          : [];
    const protection = awakenedGuardEventLabel(event.type, event.payload, locale, text);
    if (protection !== null) {
      const f = readAwakenedGuardFact(event.type, event.payload)!,
        audience = awakenedGuardFactAudience(f);
      return audience === undefined
        ? [{ kind: "system", text: protection }]
        : printPrivateEvents
          ? [{ kind: audience.length ? "private" : "god", text: protection }]
          : [];
    }
    const duel = awakenedDuelEventLabel(event.type, event.payload, locale, text);
    if (duel !== null) return [{ kind: "system", text: duel }];
    const brew = awakenedWitchEventLabel(event.type, event.payload, locale, text);
    if (brew !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "brew_resolved" ? "god" : "private", text: brew }]
        : [];
    const claws = awakenedClawEventLabel(event.type, event.payload, locale, text);
    if (claws !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "awakened_claws_expired" ? "god" : "private", text: claws }]
        : [];
    const silence = silenceElderEventLabel(event.type, event.payload, locale, text);
    if (silence !== null) {
      const type = SILENCE_ELDER_EVENT_TYPES.find((type) => type === event.type)!;
      const audience = silenceElderFactAudience(type);
      return audience === "public"
        ? [{ kind: event.type === "silence_announced" ? "system" : "chat", text: silence }]
        : printPrivateEvents
          ? [{ kind: audience === "actor" ? "private" : "god", text: silence }]
          : [];
    }
    const crow = crowEventLabel(event.type, event.payload, locale, text);
    if (crow !== null)
      return event.type === "crow_curse_applied"
        ? [{ kind: "system", text: crow }]
        : printPrivateEvents
          ? [{ kind: "private", text: crow }]
          : [];
    const demon = demonHunterEventLabel(event.type, event.payload, locale, text);
    if (demon !== null) return printPrivateEvents ? [{ kind: "god", text: demon }] : [];
    const wedding = ghostBrideEventLabel(event.type, event.payload, locale, text);
    if (wedding !== null) return printPrivateEvents ? [{ kind: "god", text: wedding }] : [];
    const lonely = lonelyGirlEventLabel(event.type, event.payload, locale, text);
    if (lonely) return printPrivateEvents ? [{ kind: "god", text: lonely }] : [];
    const wild = wildChildEventLabel(event.type, event.payload, locale, text);
    if (wild !== null) return printPrivateEvents ? [{ kind: "god", text: wild }] : [];
    const shape = shapeshifterEventLabel(event.type, event.payload, locale, text);
    if (shape !== null) return printPrivateEvents ? [{ kind: "god", text: shape }] : [];
    const thief = thiefEventLabel(event.type, event.payload, locale, text);
    if (thief !== null) return printPrivateEvents ? [{ kind: "god", text: thief }] : [];
    const wall = wallEventLabel(event.type, event.payload, locale, text);
    if (wall !== null)
      return ["wall_note_changed", "wall_note_order_recorded"].includes(event.type)
        ? printPrivateEvents
          ? [{ kind: "god", text: wall }]
          : []
        : [{ kind: "system", text: wall }];
    const debate = debateEventLabel(event.type, event.payload, locale, text);
    if (debate !== null)
      return event.type === "debate_ballots_recorded"
        ? printPrivateEvents
          ? [{ kind: "god", text: debate }]
          : []
        : [{ kind: "system", text: debate }];
    const cupid = cupidEventLabel(event.type, event.payload, locale, text);
    if (cupid !== null)
      return printPrivateEvents
        ? [
            {
              kind: ["cupid_relation_resolved", "lovers_death"].includes(event.type)
                ? "god"
                : "private",
              text: cupid,
            },
          ]
        : [];
    const black = blackMarketEventLabel(event.type, event.payload, locale, text);
    if (black !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "black_market_trade_resolved" ? "god" : "private", text: black }]
        : [];
    const awakened = awakenedEventLabel(event.type, event.payload, locale, text);
    if (awakened !== null) return printPrivateEvents ? [{ kind: "private", text: awakened }] : [];
    const hybrid = hybridEventLabel(event.type, event.payload, locale, text);
    if (hybrid !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "hybrid_affiliation_resolved" ? "god" : "private", text: hybrid }]
        : [];
    const merchant = merchantEventLabel(event.type, event.payload, locale, text);
    if (merchant !== null)
      return printPrivateEvents
        ? [{ kind: event.type === "merchant_trade_resolved" ? "god" : "private", text: merchant }]
        : [];
    if (event.type === "lucky_ability_skipped")
      return printPrivateEvents
        ? [
            {
              kind: "private",
              text: text(locale, "console.lucky.skipped", {
                actor: event.payload.actorId,
                day: event.payload.day,
                ability: event.payload.abilityId,
              }),
            },
          ]
        : [];
    const mechanical = mechanicalEventLabel(event.type, event.payload, locale, text);
    if (mechanical !== null) {
      if (event.type === "mechanical_shot") return [{ kind: "action", text: mechanical }];
      return printPrivateEvents
        ? [
            {
              kind: event.type === "mechanical_poison_reflected" ? "god" : "private",
              text: mechanical,
            },
          ]
        : [];
    }
    const handler = LIVE_HANDLERS[event.type];
    if (handler) {
      const rendered = (
        handler as (
          event: GameEvent,
          printPrivateEvents: boolean,
          locale: Locale,
          text?: PlayerText,
        ) => ScriptLiveRender[] | null
      )(event, printPrivateEvents, locale, text);
      if (rendered) {
        return rendered;
      }
    }
    const judge = this.toJudgeLine(event, locale, text);
    if (judge) {
      return [{ kind: "god", text: text(locale, "console.live.god", { line: judge }) }];
    }
    return [];
  }
}

let defaultRegistry: ScriptEventRenderRegistry | null = null;

/** 获取默认脚本渲染注册表实例。 */
export function getDefaultScriptEventRenderRegistry(): ScriptEventRenderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ScriptEventRenderRegistry();
  }
  return defaultRegistry;
}
