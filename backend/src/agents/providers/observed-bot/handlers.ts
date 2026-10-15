/**
 * 负责装配受限观察机器人的有序工具策略。输入为脱离权威状态的玩家观察与该玩家随机流；
 * 输出为供 ObservedBot 依次匹配的工具与决策函数，不读取 World 或执行领域提交。
 * 顺序是选择优先级和随机消费契约；null 表示结束本次选择，undefined 才继续后续工具。
 * 工具动作不是付款或生效凭据，合法性仍由引擎在提交入口复验。
 */
import { bindFragrantPair, inspectPair } from "./fragrant-pair-seer";
import { bequeathClaw } from "./awakened-wolf-king";
import { castShelter, swallowSkill } from "./radiant-eclipse";
import { chooseServant, protectSecretBody } from "./noble-secret-body";
import { modifySkill, bonusAction } from "./native";
import { castMist, useSnake, ravenKnife } from "./mist-raven";
import { lockTime } from "./native";
import { swapNightSeats } from "./native";
import { resetExileVote, swapTargets, swapExileTargets } from "./native";
import {
  choose_bridegroom,
  speak_to_partner,
  choose_wedding_witness,
  wedding_kill_vote,
} from "./wedding";
import type { ObservedToolEntry } from "./context";
import {
  choose_badge_successor,
  speak,
  choose_direction,
  run_for_sheriff,
  vote_for_sheriff,
  vote,
} from "./public";
import {
  speak_to_wolves,
  kill_vote,
  charm,
  self_destruct_with_target,
  self_destruct,
} from "./wolf";
import { bestow_ability, black_market_trade } from "./granted";
import {
  mechanical_mode,
  mimic_role,
  awakened_mimic,
  awakened_poison,
  awakened_guard,
  awakened_attack,
  mechanical_inspect,
  mechanical_poison,
  mechanical_guard,
  mechanical_attack,
} from "./copied";
import {
  fear,
  wardenPair,
  wardenDecide,
  curseExile,
  silence,
  gesture,
  translateSilence,
  demon_hunt,
  choose_admired_player,
  choose_wild_model,
  choose_thief_card,
  choose_shapeshifter_card,
  write_note,
  choose_exemplar,
  choose_lovers,
  challenge,
  debate_vote,
  guard,
  dream,
  check_identity,
  inspect_role,
  inspect_night_identity,
  use_potion,
  shoot,
  duel,
} from "./native";

/** 保持原工具优先级和随机抽取次序，避免相同 seed 的严格 Tape 因装配顺序变化而漂移。 */
export const observedToolHandlers: readonly ObservedToolEntry[] = [
  {tool:"warden_pair",decide:wardenPair},
  {tool:"warden_decide",decide:wardenDecide},
  { tool: "bequeath_claw", decide: bequeathClaw },
  {
    tool: "fox_distract",
    decide: ({ request, pick, style, random }) => ({
      name: "fox_distract",
      args: {
        target_id:
          style === "conservative" || (style === "random" && random.next() < 0.35)
            ? null
            : (pick([...(request.context.fox_candidates ?? [])]) ?? null),
      },
    }),
  },
  {
    tool: "puffer_retaliate",
    decide: ({ style, random }) => ({
      name: "puffer_retaliate",
      args: { activate: style !== "conservative" && (style !== "random" || random.next() >= 0.5) },
    }),
  },
  { tool: "bind_fragrant_pair", decide: bindFragrantPair },
  { tool: "check_pair", decide: inspectPair },
  { tool: "choose_servant", decide: chooseServant },
  { tool: "protect_secret_body", decide: protectSecretBody },
  { tool: "cast_shelter", decide: castShelter },
  { tool: "swallow_skill", decide: swallowSkill },
  { tool: "cast_mist", decide: castMist },
  { tool: "use_snake", decide: useSnake },
  { tool: "raven_knife", decide: ravenKnife },
  { tool: "modify_skill", decide: modifySkill },
  { tool: "bonus_action", decide: bonusAction },
  { tool: "reset_exile_vote", decide: resetExileVote },
  { tool: "swap_exile_targets", decide: swapExileTargets },
  { tool: "lock_time", decide: lockTime },
  { tool: "swap_night_seats", decide: swapNightSeats },
  { tool: "swap_targets", decide: swapTargets },
  { tool: "fear", decide: fear },
  { tool: "curse_exile", decide: curseExile },
  { tool: "silence", decide: silence },
  { tool: "gesture", decide: gesture },
  { tool: "translate_silence", decide: translateSilence },
  { tool: "choose_bridegroom", decide: choose_bridegroom },
  { tool: "speak_to_partner", decide: speak_to_partner },
  { tool: "choose_wedding_witness", decide: choose_wedding_witness },
  { tool: "wedding_kill_vote", decide: wedding_kill_vote },
  { tool: "demon_hunt", decide: demon_hunt },
  { tool: "choose_admired_player", decide: choose_admired_player },
  { tool: "choose_wild_model", decide: choose_wild_model },
  { tool: "choose_thief_card", decide: choose_thief_card },
  { tool: "choose_shapeshifter_card", decide: choose_shapeshifter_card },
  { tool: "choose_exemplar", decide: choose_exemplar },
  { tool: "choose_lovers", decide: choose_lovers },
  { tool: "write_note", decide: write_note },
  { tool: "challenge", decide: challenge },
  { tool: "debate_vote", decide: debate_vote },
  { tool: "bestow_ability", decide: bestow_ability },
  { tool: "black_market_trade", decide: black_market_trade },
  { tool: "speak", decide: speak },
  { tool: "speak_to_wolves", decide: speak_to_wolves },
  { tool: "choose_badge_successor", decide: choose_badge_successor },
  { tool: "choose_direction", decide: choose_direction },
  { tool: "run_for_sheriff", decide: run_for_sheriff },
  { tool: "vote_for_sheriff", decide: vote_for_sheriff },
  { tool: "kill_vote", decide: kill_vote },
  { tool: "mechanical_mode", decide: mechanical_mode },
  { tool: "mimic_role", decide: mimic_role },
  { tool: "awakened_mimic", decide: awakened_mimic },
  { tool: "awakened_poison", decide: awakened_poison },
  { tool: "awakened_guard", decide: awakened_guard },
  { tool: "awakened_attack", decide: awakened_attack },
  { tool: "mechanical_inspect", decide: mechanical_inspect },
  { tool: "mechanical_poison", decide: mechanical_poison },
  { tool: "mechanical_guard", decide: mechanical_guard },
  { tool: "mechanical_attack", decide: mechanical_attack },
  { tool: "guard", decide: guard },
  { tool: "dream", decide: dream },
  { tool: "charm", decide: charm },
  { tool: "check_identity", decide: check_identity },
  { tool: "inspect_role", decide: inspect_role },
  { tool: "inspect_night_identity", decide: inspect_night_identity },
  { tool: "use_potion", decide: use_potion },
  { tool: "shoot", decide: shoot },
  { tool: "duel", decide: duel },
  { tool: "vote", decide: vote },
  { tool: "self_destruct_with_target", decide: self_destruct_with_target },
  { tool: "self_destruct", decide: self_destruct },
];
