/**
 * 负责构造禁言原板的真实传输场景。输入为固定种子，输出手写三夜行动、胜方及存活表。
 * 首日禁言狼人，次日另一狼人，末日长老本人；译者含神职和平民，末次明确拒译。
 * 行动队列遵守普通席位顺序，字面预期不依赖生产禁言／票数算法生成，不调用外部模型。
 */
import { Role, Camp, PotionType, ActionWindow } from "@ai-werewolf-arena/game-contract";
import { createRandom, shuffled } from "../../../../../src/domain";
import { silenceElderTwelveConfig } from "../../../../../src/rulesets/presets/silence-elder-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";

export function silenceElderScenario(): TransportGameScenario & {
  elder: number;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(silenceElderTwelveConfig),
    seed = "silence-elder-transport";
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const elder = id(Role.SilenceElder),
    witch = id(Role.Witch),
    seer = id(Role.Seer);
  const wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []]));
  const add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn);
  let alive = [...ids];
  for (const day of [1, 2, 3]) {
    const target = day === 3 ? elder : wolves[day]!,
      translator = day === 2 ? villagers[2]! : seer;
    add(elder, {
      day,
      stage: "silence_elder",
      action: { name: "silence", args: { target_id: target, translator_id: translator } },
    });
    const pack = wolves.filter((id) => alive.includes(id));
    const knife = day === 1 ? villagers[0]! : day === 2 ? witch : villagers[1]!;
    for (const wolf of pack) {
      add(wolf, {
        day,
        stage: "wolf_discussion",
        action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
      });
      add(wolf, {
        day,
        stage: "wolf_vote",
        action: { name: "kill_vote", args: { target_id: knife, abstain: false } },
      });
    }
    if (alive.includes(witch))
      add(witch, {
        day,
        stage: "witch",
        action: {
          name: "use_potion",
          args: {
            target_id: day === 1 ? wolves[0]! : witch,
            potion_type: day === 1 ? PotionType.Poison : PotionType.None,
          },
        },
      });
    add(seer, {
      day,
      stage: "seer",
      action: { name: "check_identity", args: { target_id: wolves[day]! } },
    });
    const nightDead = day === 1 ? [knife, wolves[0]!] : [knife];
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
    alive = alive.filter((id) => !nightDead.includes(id));
    for (const actor of alive) {
      if (actor === target) {
        add(actor, {
          day,
          stage: "silence_gesture",
          action: {
            name: "gesture",
            args: { description: `Gesture ${day}: point at the table 🖐️\nExact {target}` },
          },
        });
        add(translator, {
          day,
          stage: "silence_translation",
          action: {
            name: "translate_silence",
            args: { text: day === 3 ? null : `Interpretation ${day}\nExact {target}` },
          },
        });
      } else
        add(actor, {
          day,
          stage: "day_speech",
          action: { name: "speak", args: { text: "Ordinary speech" } },
        });
    }
    for (const wolf of pack.filter((id) => alive.includes(id)))
      add(wolf, { day, stage: ActionWindow.OnPreVote, action: null });
    const exile = wolves[day]!;
    for (const actor of alive)
      add(actor, {
        day,
        stage: "voting",
        action: {
          name: "vote",
          args: {
            target_id: actor === exile ? null : exile,
            abstain: actor === exile,
          },
        },
      });
    add(exile, {
      day,
      stage: "last_words",
      action: { name: "speak", args: { text: "Exile words" } },
    });
    alive = alive.filter((id) => id !== exile);
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("silence_elder_transport", config)),
    seed,
    roles,
    turns,
    elder,
    alive,
    winner: Camp.Good,
  };
}
