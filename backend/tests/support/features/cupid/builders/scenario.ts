/**
 * Builds original cupid test input plans, fixed boards and explicit player/marker data. Inputs are supplied
 * variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured identities.
 * Existing dealing may construct input identities, while handwritten expected outcomes remain supplied
 * data. It runs no game or model and changes no oracle algorithm.
 */
import { Role } from "../../../../../src/core";
import type { BoardConfig } from "../../../../../src/core";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import type { CupidPolicy } from "../../../../../src/core/domain/board";
import { createRandom } from "../../../../../src/core";
import { shuffled } from "../../../../../src/core";
import { PotionType } from "../../../../../src/core";
import type { ToolCall } from "../../../../../src/core";
import type { ActionStage } from "../../../../../src/core";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const CUPID_CASES = [
  "mixed_netease",
  "mixed_lui",
  "wolves_netease",
  "wolves_lui",
  "root_hunter",
  "heartbreak_hunter",
  "two_sources",
  "dream_chain",
  "beauty_poison",
  "shot_chain",
] as const;

export type CupidCase = (typeof CUPID_CASES)[number];

export function cupidBoard(
  roles: readonly Role[],
  policy: CupidPolicy = "netease_2017_cupid_follows_lovers_v1",
): BoardConfig {
  return { ...foxBoard(roles), cupid: { policy } };
}

function fixedDealSeed(name: string, roles: readonly Role[], board: BoardConfig): string {
  const deck = board.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role));
  for (let n = 0; n < 10000; n++) {
    const seed = `cupid-${name}:${n}`;
    if (shuffled(deck, createRandom(seed).fork("deal")).join() === roles.join()) return seed;
  }
  throw new Error("cupid_fixture_seed_missing");
}

export function cupidScenario(kind: CupidCase): TransportGameScenario {
  const roles =
    kind === "shot_chain"
      ? [Role.Cupid, Role.Hunter, Role.WolfKing, Role.Hunter, Role.Villager, Role.Wolf]
      : kind.startsWith("wolves_")
        ? [Role.Cupid, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager]
        : kind === "two_sources"
          ? [Role.Cupid, Role.Hunter, Role.Wolf, Role.Witch, Role.Villager]
          : kind === "dream_chain"
            ? [Role.Cupid, Role.Dreamer, Role.Wolf, Role.Hunter, Role.Villager]
            : kind === "beauty_poison"
              ? [Role.Cupid, Role.WolfBeauty, Role.Wolf, Role.Witch, Role.Hunter]
              : [Role.Cupid, Role.Hunter, Role.Wolf, Role.Villager, Role.Villager];
  const policy: CupidPolicy = kind.endsWith("_lui")
    ? "lui_meme_lovers_only_v1"
    : "netease_2017_cupid_follows_lovers_v1";
  const config = cupidBoard(roles, policy),
    turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []]));
  const add = (actors: number[], stage: ActionStage, action: ToolCall | null, day = 1) => {
    for (const actor of actors) turns.get(actor)!.push({ day, stage, action });
  };
  const pair: [number, number] =
    kind === "shot_chain"
      ? [3, 4]
      : kind.startsWith("wolves_")
        ? [2, 3]
        : kind.startsWith("mixed_") || kind === "heartbreak_hunter"
          ? [2, 3]
          : kind === "beauty_poison"
            ? [1, 2]
            : [1, 2];
  add([1], "cupid", { name: "choose_lovers", args: { first_id: pair[0], second_id: pair[1] } });
  if (kind === "dream_chain") add([2], "dreamer", { name: "dream", args: { target_id: 4 } });
  const wolves = roles
    .map((role, i) => [role, i + 1] as const)
    .filter(([role]) => role === Role.Wolf || role === Role.WolfBeauty || role === Role.WolfKing)
    .map(([, id]) => id);
  const knife =
    kind === "shot_chain" || kind === "root_hunter" || kind === "two_sources"
      ? 2
      : kind === "heartbreak_hunter"
        ? 3
        : kind === "dream_chain" || kind === "beauty_poison"
          ? 1
          : 4;
  add(wolves, "wolf_discussion", {
    name: "speak_to_wolves",
    args: { text: "Done", end_chat: true },
  });
  add(wolves, "wolf_vote", { name: "kill_vote", args: { target_id: knife, abstain: false } });
  if (kind === "beauty_poison") add([2], "wolf_beauty", { name: "charm", args: { target_id: 5 } });
  if (kind === "two_sources" || kind === "beauty_poison")
    add([4], "witch", {
      name: "use_potion",
      args: { target_id: kind === "two_sources" ? 1 : 2, potion_type: PotionType.Poison },
    });
  const nightDeaths =
    kind === "shot_chain"
      ? [2]
      : kind === "root_hunter" || kind === "two_sources"
        ? [2, 1]
        : kind === "heartbreak_hunter"
          ? [3, 2]
          : kind === "dream_chain"
            ? [1, 2, 4]
            : kind === "beauty_poison"
              ? [1, 2]
              : [4];
  const words =
    kind === "root_hunter"
      ? [2]
      : kind === "heartbreak_hunter"
        ? [3]
        : kind === "dream_chain"
          ? [1, 4]
          : nightDeaths;
  add(words, "last_words", { name: "speak", args: { text: "Last" } });
  if (kind === "shot_chain") {
    add([2], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
    add([3], "death_shot", { name: "shoot", args: { target_id: 5 } });
  }
  if (kind === "root_hunter") add([2], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
  if (!["root_hunter", "heartbreak_hunter", "shot_chain"].includes(kind)) {
    const alive = roles.map((_, i) => i + 1).filter((id) => !nightDeaths.includes(id));
    add(alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    const exile = kind.startsWith("mixed_") || kind.startsWith("wolves_") ? 5 : 3;
    add(alive, "voting", { name: "vote", args: { target_id: exile, abstain: false } });
    add([exile], "last_words", { name: "speak", args: { text: "Exile last" } });
  }
  if (kind.endsWith("_lui")) {
    add(
      wolves,
      "wolf_discussion",
      { name: "speak_to_wolves", args: { text: "Done", end_chat: true } },
      2,
    );
    add(wolves, "wolf_vote", { name: "kill_vote", args: { target_id: 1, abstain: false } }, 2);
  }
  return {
    roles,
    board: parseBoardDefinition(boardDefinitionFromConfig(`five_player_cupid_${kind}`, config)),
    turns,
    seed: fixedDealSeed(kind, roles, config),
    promptAssertions: (actor, locale) =>
      actor === 1
        ? {
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Cupid" : "你的底牌是【丘比特】",
            ],
            forbiddenCurrentMarkers: ['"pairCamps"', '"mixed"', '"affiliations"'],
          }
        : {},
  };
}
