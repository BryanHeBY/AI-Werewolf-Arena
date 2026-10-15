/**
 * 负责典狱长原板三夜手写真实协议计划。N1不交易；N2预女双背叛且团刀另指；N3本人双trade纯Deal出局。
 * 座位只从固定洗牌预先算出，胜方和存活表为字面计划预期；不读取运行World或生产交易表。
 * 本模块是场景测试计划构造器，不提供生产策略；真实SDK／ACP驱动负责按该独立字面计划验收。
 */
import { Role, Camp, PotionType } from "@ai-werewolf-arena/game-contract";
import { createRandom, shuffled } from "../../../../../src/domain";
import { wardenTwelveConfig } from "../../../../../src/rulesets/presets/warden-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";
export function wardenScenario(): TransportGameScenario & {
  warden: number;
  seer: number;
  witch: number;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(wardenTwelveConfig),
    seed = "warden-transport";
  config.enableSheriff = false;
  config.hooks = {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  };
  config.selfDestruct = { enabledWindows: [] };
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const warden = id(Role.Warden),
    seer = id(Role.Seer),
    witch = id(Role.Witch),
    dream = id(Role.Dreamer),
    wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []])),
    add = (a: number, t: PlannedTurn) => turns.get(a)!.push(t);
  let alive = [...ids];
  for (const day of [1, 2, 3]) {
    if (day >= 2) {
      const pair = day === 2 ? ([seer, witch] as const) : ([warden, villagers[3]!] as const);
      add(warden, {
        day,
        stage: "warden_pair",
        action: { name: "warden_pair", args: { target_ids: pair } },
      });
      for (const a of pair)
        add(a, {
          day,
          stage: "warden_decide",
          action: { name: "warden_decide", args: { choice: day === 2 ? "betray" : "trade" } },
        });
    }
    add(dream, {
      day,
      stage: "dreamer",
      action: {
        name: "dream",
        args: { target_id: day === 1 ? villagers[3]! : day === 2 ? seer : witch },
      },
    });
    const pack = [...wolves, warden].filter((i) => alive.includes(i)),
      knife = villagers[day - 1]!;
    for (const wolf of pack) {
      add(wolf, {
        day,
        stage: "wolf_discussion",
        action: { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } },
      });
      add(wolf, {
        day,
        stage: "wolf_vote",
        action: { name: "kill_vote", args: { target_id: knife, abstain: false } },
      });
    }
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
      action: { name: "check_identity", args: { target_id: day === 2 ? witch : warden } },
    });
    const nightDead = day === 1 ? [knife, wolves[0]!] : day === 2 ? [knife] : [knife, warden];
    if (day === 1)
      for (const a of nightDead)
        add(a, {
          day,
          stage: "last_words",
          action: { name: "speak", args: { text: "First night words" } },
        });
    alive = alive.filter((a) => !nightDead.includes(a));
    if (day === 3) break;
    for (const a of alive)
      add(a, {
        day,
        stage: "day_speech",
        action: { name: "speak", args: { text: "Public speech" } },
      });
    const exile = wolves[day]!;
    for (const a of alive)
      add(a, {
        day,
        stage: "voting",
        action: {
          name: "vote",
          args: { target_id: a === exile ? null : exile, abstain: a === exile },
        },
      });
    add(exile, {
      day,
      stage: "last_words",
      action: { name: "speak", args: { text: "Exile words" } },
    });
    alive = alive.filter((a) => a !== exile);
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("warden_transport", config)),
    seed,
    roles,
    turns,
    warden,
    seer,
    witch,
    alive,
    winner: Camp.Good,
  };
}
