/**
 * 测试支持层负责觉醒狼王原十人板的两份独立完整行动计划。输入为保双爪或首夜亲传，输出手写胜方、存活表与回合。
 * 固定发牌仅将语义玩家映射为座位；两种死亡链和最终人数是人工预期，不运行生产结算求答案。
 * 本体保爪时D1连杀预言家／商人、N2刀女巫；亲传时D1本体杀预言家、N2刀商人、D2受传者杀女巫。
 */
import { Role, Camp, PotionType, ActionWindow } from "@ai-werewolf-arena/game-contract";
import { createRandom, shuffled } from "../../../../../src/domain";
import { awakenedWolfKingTenConfig } from "../../../../../src/rulesets/presets/awakened-wolf-king";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";
export function awakenedWolfKingScenario(kind: "double_claw" | "bequest"): TransportGameScenario & {
  king: number;
  recipient: number;
  seer: number;
  merchant: number;
  witch: number;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(awakenedWolfKingTenConfig),
    seed = `awakened-wolf-king:${kind}`;
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1;
  const king = id(Role.AwakenedWolfKing),
    seer = id(Role.Seer),
    witch = id(Role.Witch),
    merchant = id(Role.MiracleMerchant),
    wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager),
    recipient = wolves[0]!;
  const turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []]));
  const add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn);
  let alive = [...ids];
  for (const day of [1, 2]) {
    const pack = [king, ...wolves].filter((actor) => alive.includes(actor));
    const knife = day === 1 ? villagers[0]! : kind === "double_claw" ? witch : merchant;
    if (alive.includes(merchant)) {
      add(merchant, { day, stage: "miracle_merchant", action: null });
    }
    for (const actor of pack) {
      add(actor, {
        day,
        stage: "wolf_discussion",
        action: { name: "speak_to_wolves", args: { text: "End pack discussion", end_chat: true } },
      });
    }
    if (day === 1)
      add(king, {
        day,
        stage: "awakened_claw_bequest",
        action: {
          name: "bequeath_claw",
          args: { target_id: kind === "bequest" ? recipient : null },
        },
      });
    for (const actor of pack)
      add(actor, {
        day,
        stage: "wolf_vote",
        action: { name: "kill_vote", args: { target_id: knife, abstain: false } },
      });
    if (alive.includes(seer))
      add(seer, {
        day,
        stage: "seer",
        action: { name: "check_identity", args: { target_id: wolves[1]! } },
      });
    if (alive.includes(witch))
      add(witch, {
        day,
        stage: "witch",
        action: { name: "use_potion", args: { target_id: witch, potion_type: PotionType.None } },
      });
    if (day === 1) {
      for (const actor of pack)
        add(actor, { day, stage: ActionWindow.OnPreElection, action: null });
      for (const actor of ids)
        add(actor, {
          day,
          stage: "sheriff_nomination",
          action: { name: "run_for_sheriff", args: { run: false } },
        });
      add(knife, {
        day,
        stage: "last_words",
        action: { name: "speak", args: { text: "First night words" } },
      });
    }
    alive = alive.filter((actor) => actor !== knife);
    if (day === 2 && kind === "double_claw") break;
    for (const actor of alive)
      add(actor, {
        day,
        stage: "day_speech",
        action: { name: "speak", args: { text: "Discuss the visible game facts" } },
      });
    for (const actor of pack) add(actor, { day, stage: ActionWindow.OnPreVote, action: null });
    const exile = day === 1 ? king : recipient;
    for (const actor of alive)
      add(actor, {
        day,
        stage: "voting",
        action: {
          name: "vote",
          args: { target_id: actor === exile ? null : exile, abstain: actor === exile },
        },
      });
    add(exile, {
      day,
      stage: "last_words",
      action: { name: "speak", args: { text: "Exile words" } },
    });
    add(exile, {
      day,
      stage: "death_shot",
      action: { name: "shoot", args: { target_id: day === 1 ? seer : witch } },
    });
    if (day === 1 && kind === "double_claw")
      add(king, {
        day,
        stage: "death_shot",
        action: { name: "shoot", args: { target_id: merchant } },
      });
    alive = alive.filter(
      (actor) =>
        actor !== exile &&
        actor !== (day === 1 ? seer : witch) &&
        !(day === 1 && kind === "double_claw" && actor === merchant),
    );
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig(`king_transport_${kind}`, config)),
    seed,
    roles,
    turns,
    king,
    recipient,
    seer,
    merchant,
    witch,
    alive,
    winner: Camp.Wolf,
  };
}
