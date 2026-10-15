/**
 * 负责觉醒女巫原板的四夜真实传输计划；输入为固定发牌seed，输出手写行动与字面终局。
 * 三次调毒之间穿插一次救人：第一轮一人同意、第二轮两人否决、末轮三人全同意毒死狼王。
 * 六名协助者不重用，含狼人、平民和猎人；实际引擎仍独立验证权限、秘密feed、付款和终局。
 * 场景测试支持层只编排字面行动，不调用生产资源或伤害计算生成预期。
 */
import { Role, Camp, ActionWindow } from "@ai-werewolf-arena/game-contract";
import { createRandom, shuffled } from "../../../../../src/domain";
import { awakenedWitchTwelveConfig } from "../../../../../src/rulesets/presets/awakened-witch-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";
export function awakenedWitchScenario(): TransportGameScenario & {
  witch: number;
  helpers: number[][];
  king: number;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(awakenedWitchTwelveConfig),
    seed = "awakened-witch-transport",
    roles = shuffled(
      config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
      createRandom(seed).fork("deal"),
    ),
    ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1,
    witch = id(Role.AwakenedWitch),
    king = id(Role.AwakenedWolfKing),
    guard = id(Role.Guard),
    hunter = id(Role.Hunter),
    seer = id(Role.Seer),
    wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager),
    helpers = [
      [wolves[1]!],
      [wolves[2]!, villagers[1]!].sort((a, b) => a - b),
      [villagers[2]!, villagers[3]!, hunter].sort((a, b) => a - b),
    ],
    turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []])),
    add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn);
  let alive = [...ids];
  for (const day of [1, 2, 3, 4]) {
    const pack = [...wolves, king].filter((i) => alive.includes(i)),
      knife = day === 1 ? villagers[0]! : day === 2 ? seer : guard,
      brew = day === 1 ? 0 : day === 2 ? 1 : 2,
      poison = day === 1 ? wolves[0]! : day === 2 ? wolves[2]! : king,
      assistants = day === 3 ? [] : helpers[brew]!;
    for (const wolf of pack) {
      add(wolf, {
        day,
        stage: "wolf_discussion",
        action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
      });
    }
    add(king, {
      day,
      stage: "awakened_claw_bequest",
      action: { name: "bequeath_claw", args: { target_id: null } },
    });
    for (const wolf of pack)
      add(wolf, {
        day,
        stage: "wolf_vote",
        action: { name: "kill_vote", args: { target_id: knife, abstain: false } },
      });
    if (alive.includes(guard))
      add(guard, {
        day,
        stage: "guard",
        action: { name: "guard", args: { target_id: null, abstain: true } },
      });
    if (alive.includes(seer))
      add(seer, {
        day,
        stage: "seer",
        action: {
          name: "check_identity",
          args: { target_id: day === 1 ? wolves[0]! : wolves[2]! },
        },
      });
    add(witch, {
      day,
      stage: "awakened_witch",
      action: {
        name: "awakened_brew",
        args:
          day === 3
            ? { mode: "heal", target_id: knife, assistant_ids: [] }
            : { mode: "poison", target_id: poison, assistant_ids: [...assistants] },
      },
    });
    for (const helper of assistants) {
      add(helper, {
        day,
        stage: "brew_discussion",
        action: {
          name: "brew_discuss",
          args: { text: `Private brew ${brew + 1} contribution from ${helper}; no role claim.` },
        },
      });
      add(helper, {
        day,
        stage: "brew_approval",
        action: { name: "brew_approve", args: { approve: !(day === 2 && helper === wolves[2]) } },
      });
    }
    const nightDead =
      day === 1 ? [knife, poison] : day === 2 ? [knife] : day === 3 ? [] : [knife, poison];
    if (day === 1) {
      for (const wolf of pack) add(wolf, { day, stage: ActionWindow.OnPreElection, action: null });
      for (const actor of ids)
        add(actor, {
          day,
          stage: "sheriff_nomination",
          action: { name: "run_for_sheriff", args: { run: false } },
        });
      for (const actor of nightDead)
        add(actor, {
          day,
          stage: "last_words",
          action: { name: "speak", args: { text: "First night words" } },
        });
    }
    alive = alive.filter((i) => !nightDead.includes(i));
    if (day === 4) break;
    for (const actor of alive)
      add(actor, {
        day,
        stage: "day_speech",
        action: {
          name: "speak",
          args: { text: "Use visible information; private roles remain unconfirmed." },
        },
      });
    for (const wolf of pack.filter((i) => alive.includes(i)))
      add(wolf, { day, stage: ActionWindow.OnPreVote, action: null });
    const exile = day === 1 ? wolves[1]! : day === 2 ? wolves[2]! : villagers[1]!;
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
    alive = alive.filter((i) => i !== exile);
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("awa_awakened_witch_12_v1", config)),
    seed,
    roles,
    turns,
    witch,
    helpers,
    king,
    alive,
    winner: Camp.Good,
  };
}
