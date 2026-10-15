/**
 * Builds original lonely-girl test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { Role } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import { text } from "@ai-werewolf-arena/game-text";
import { roleName } from "@ai-werewolf-arena/game-text";
import { term } from "@ai-werewolf-arena/game-text";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const LONELY_GIRL_CASES = [
  "good_alive",
  "wolf_alive",
  "good_dead",
  "wolf_dead",
  "wolf_win",
  "wolf_needs_girl",
  "target_dead",
  "same_wave",
  "hunter_chain",
] as const;

export type LonelyGirlCase = (typeof LONELY_GIRL_CASES)[number];

export function lonelyGirlScenario(
  kind: LonelyGirlCase,
  size: 6 | 12 = 6,
  locale: "zh-CN" | "en" = "zh-CN",
): TransportGameScenario & {
  actorId: number;
  targetId: number;
  faction: Camp;
  winner: Camp;
  winners: number[];
  alive: number[];
} {
  const deck = [
      ...Array<Role>(size === 6 ? 2 : 4).fill(Role.Wolf),
      Role.LonelyGirl,
      Role.Seer,
      kind === "hunter_chain" ? Role.Hunter : Role.Witch,
      ...Array<Role>(size === 6 ? 1 : 5).fill(Role.Villager),
    ],
    seed = `lonely-girl:${size}:${kind}`,
    roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    girl = roles.indexOf(Role.LonelyGirl) + 1,
    seer = roles.indexOf(Role.Seer) + 1,
    witch = roles.indexOf(Role.Witch) + 1,
    hunter = roles.indexOf(Role.Hunter) + 1,
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    followsWolf = kind.startsWith("wolf"),
    target = followsWolf ? wolves[0]! : kind === "hunter_chain" ? hunter : seer,
    faction = followsWolf ? Camp.Wolf : Camp.Good,
    wolfWin = kind === "wolf_win" || kind === "wolf_needs_girl",
    winner = wolfWin ? Camp.Wolf : Camp.Good;
  const turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]])),
    dead = new Set<number>();
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((id: number) => ToolCall | null),
  ) => {
    for (const id of actors)
      turns
        .get(id)!
        .push({ day, stage, action: typeof action === "function" ? action(id) : action });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized last words" } });
  add(1, [girl], "lonely_girl", { name: "choose_admired_player", args: { target_id: target } });
  const good = ids.filter((id) => roles[id - 1] !== Role.Wolf),
    wolfOrder =
      kind === "wolf_needs_girl"
        ? [...good.filter((id) => id !== girl), girl]
        : [girl, ...good.filter((id) => id !== girl)];
  const days = wolfWin ? good.length / 2 : wolves.length;
  for (let day = 1; day <= days; day++) {
    const pack = wolves.filter((id) => !dead.has(id));
    add(day, pack, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End pack chat", end_chat: true },
    });
    const knife = wolfWin
      ? wolfOrder[(day - 1) * 2]!
      : day === 1 && ["good_dead", "wolf_dead", "same_wave"].includes(kind)
        ? girl
        : day === 1 && ["target_dead", "hunter_chain"].includes(kind)
          ? target
          : null;
    add(day, pack, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: knife === null },
    });
    if (!dead.has(seer))
      add(day, [seer], "seer", {
        name: "check_identity",
        args: { target_id: day === 1 ? girl : pack[0]! },
      });
    if (witch > 0 && !dead.has(witch))
      add(day, [witch], "witch", {
        name: "use_potion",
        args: {
          target_id: day === 1 && kind === "same_wave" ? target : witch,
          potion_type: day === 1 && kind === "same_wave" ? PotionType.Poison : PotionType.None,
        },
      });
    const nightDead = [
      ...(knife === null ? [] : [knife]),
      ...(day === 1 && kind === "same_wave" ? [target] : []),
    ];
    for (const id of nightDead) dead.add(id);
    if (day === 1)
      words(
        day,
        [...new Set(nightDead)].sort((a, b) => a - b),
      );
    if (hunter > 0 && nightDead.includes(hunter)) {
      add(day, [hunter], "hunter_shot", { name: "shoot", args: { target_id: girl } });
      dead.add(girl);
    }
    const alive = ids.filter((id) => !dead.has(id));
    if (wolfWin && !good.some((id) => !dead.has(id))) break;
    add(day, alive, "day_speech", { name: "speak", args: { text: "Public speech" } });
    const exile = wolfWin ? wolfOrder[(day - 1) * 2 + 1]! : wolves[day - 1]!;
    add(day, alive, "voting", (id) => ({
      name: "vote",
      args: { target_id: id === exile ? null : exile, abstain: id === exile },
    }));
    words(day, [exile]);
    dead.add(exile);
  }
  // Handwritten plan deaths determine this oracle; no production World or winner data is consulted.
  const winners = ids.filter((id) =>
    roles[id - 1] === Role.Wolf
      ? winner === Camp.Wolf
      : id === girl
        ? faction === winner
        : winner === Camp.Good,
  );
  for (const [id, rows] of turns)
    for (const turn of rows) {
      turn.requiredPromptMarkers = [
        text(locale, "ability.identity", {
          role: roleName(roles[id - 1]!, locale),
          camp: term("camp", roles[id - 1] === Role.Wolf ? Camp.Wolf : Camp.Good, locale),
        }),
      ];
      if (id === girl) {
        turn.requiredPromptMarkers.push(
          JSON.stringify({
            policy: "awa_netease_lonely_girl_v1",
            remaining: turn.stage === "lonely_girl" ? 1 : 0,
            choice: turn.stage === "lonely_girl" ? null : { day: 1, targetId: target },
          }),
        );
        turn.forbiddenPromptMarkers = ['"affiliations"', '"faction"', '"targetCamp"'];
      }
    }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`lonely_girl_${size}_${kind}`, foxBoard(deck)),
    ),
    seed,
    roles,
    turns,
    actorId: girl,
    targetId: target,
    faction,
    winner,
    winners,
    alive: ids.filter((id) => !dead.has(id)),
    promptAssertions: (actor) => ({
      expectedTeammateIds: wolves.includes(actor) ? wolves.filter((id) => id !== actor) : [],
    }),
  };
}
