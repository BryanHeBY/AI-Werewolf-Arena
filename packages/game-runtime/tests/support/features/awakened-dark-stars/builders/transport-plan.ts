/**
 * 场景测试支持负责暗夜星辰原10/12人的字面传输计划；固定seed的手写牌序让巡猎者下一座恰为狼美人。
 * 夜根案以毒授巡猎并压制替死；日根案先真实替死、次日原狼美人放逐，最后由毒与票清狼。
 * 胜者/存活名单按这些显式步骤书写，不调用生产保护、选狼、替死或判胜函数生成oracle。
 */
import { Role, Camp, ActionWindow, PotionType } from "@ai-werewolf-arena/game-contract";
import {
  awakenedDarkStarsTenConfig,
  awakenedDarkStarsTwelveConfig,
} from "../../../../../src/rulesets/presets/awakened-dark-stars";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";
export type DarkStarsPath = "night_patrol" | "day_replacement";
export function darkStarsScenario(
  size: 10 | 12,
  path: DarkStarsPath,
): TransportGameScenario & {
  beauty: number;
  hunter: number;
  substitute: number;
  alive: number[];
  winner: Camp;
} {
  const roles: Role[] =
      size === 10
        ? [
            Role.Seer,
            Role.Witch,
            Role.Villager,
            Role.AwakenedHunter,
            Role.AwakenedWolfBeauty,
            Role.Villager,
            Role.Wolf,
            Role.Wolf,
            Role.Guard,
            Role.Villager,
          ]
        : [
            Role.Seer,
            Role.AwakenedHunter,
            Role.AwakenedWolfBeauty,
            Role.Guard,
            Role.Villager,
            Role.Villager,
            Role.Wolf,
            Role.Wolf,
            Role.Villager,
            Role.Witch,
            Role.Villager,
            Role.Wolf,
          ],
    seed = size === 10 ? "dark-stars:10:16" : "dark-stars:12:19",
    config = structuredClone(
      size === 10 ? awakenedDarkStarsTenConfig : awakenedDarkStarsTwelveConfig,
    ),
    ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1,
    beauty = id(Role.AwakenedWolfBeauty),
    hunter = id(Role.AwakenedHunter),
    seer = id(Role.Seer),
    witch = id(Role.Witch),
    guard = id(Role.Guard),
    wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager),
    turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []])),
    add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn),
    lastDay = path === "night_patrol" ? (size === 10 ? 2 : 3) : size === 10 ? 3 : 4;
  let alive = [...ids];
  for (let day = 1; day <= lastDay; day++) {
    const pack = [...wolves, beauty].filter((i) => alive.includes(i)),
      knife = day === 1 ? villagers[0]! : day === 2 ? seer : day === 3 ? guard : villagers[2]!,
      poison =
        path === "night_patrol" ? (day === 1 ? hunter : null) : day === 3 ? wolves[1]! : null,
      heal = path === "night_patrol" && day === 2;
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
    if (alive.includes(beauty) && day === 1)
      add(beauty, {
        day,
        stage: "awakened_charm",
        action: { name: "awakened_charm", args: { target_id: villagers[1]! } },
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
          args: { target_id: wolves.find((i) => alive.includes(i))! },
        },
      });
    add(witch, {
      day,
      stage: "witch",
      action: {
        name: "use_potion",
        args: {
          target_id: poison ?? (heal ? knife : witch),
          potion_type:
            poison !== null ? PotionType.Poison : heal ? PotionType.Heal : PotionType.None,
        },
      },
    });
    const initialDead = [...(heal ? [] : [knife]), ...(poison === null ? [] : [poison])],
      nightDead = [...initialDead, ...(path === "night_patrol" && day === 1 ? [beauty] : [])];
    if (day === 1) {
      for (const wolf of wolves)
        add(wolf, { day, stage: ActionWindow.OnPreElection, action: null });
      for (const actor of ids)
        add(actor, {
          day,
          stage: "sheriff_nomination",
          action: { name: "run_for_sheriff", args: { run: false } },
        });
      for (const actor of initialDead)
        add(actor, {
          day,
          stage: "last_words",
          action: { name: "speak", args: { text: "First-night words" } },
        });
      if (path === "night_patrol")
        add(hunter, {
          day,
          stage: "awakened_patrol",
          action: { name: "patrol", args: { direction: "clockwise" } },
        });
    }
    alive = alive.filter((i) => !nightDead.includes(i));
    for (const actor of alive)
      add(actor, {
        day,
        stage: "day_speech",
        action: {
          name: "speak",
          args: { text: "Compare public facts; role claims remain unconfirmed." },
        },
      });
    for (const wolf of wolves.filter((i) => alive.includes(i)))
      add(wolf, { day, stage: ActionWindow.OnPreVote, action: null });
    const exile =
      path === "night_patrol"
        ? wolves[day - 1]!
        : day === 1
          ? hunter
          : day === 2
            ? beauty
            : day === 3
              ? wolves[0]!
              : wolves[2]!;
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
    if (path === "day_replacement" && day === 1)
      add(hunter, {
        day,
        stage: "awakened_patrol",
        action: { name: "patrol", args: { direction: "clockwise" } },
      });
    alive = alive.filter(
      (i) => i !== exile && !(path === "day_replacement" && day === 1 && i === villagers[1]),
    );
  }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`awa_netease_dark_stars_${size}_v1`, config),
    ),
    seed,
    roles,
    turns,
    beauty,
    hunter,
    substitute: villagers[1]!,
    alive,
    winner: Camp.Good,
  };
}
