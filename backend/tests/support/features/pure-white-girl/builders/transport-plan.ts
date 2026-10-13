/**
 * Builds original pure-white-girl test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { roleName } from "@ai-werewolf-arena/game-text";
import { ActionWindow } from "../../../../../src/core";
import { Camp } from "../../../../../src/core";
import { Role } from "../../../../../src/core";
import { PotionType } from "../../../../../src/core";
import { createRandom } from "../../../../../src/core";
import { shuffled } from "../../../../../src/core";
import type { ActionStage } from "../../../../../src/core";
import type { ToolCall } from "../../../../../src/core";
import { pureWhiteTwelveConfig } from "../../../../../src/runtime/scenarios/pure_white_twelve";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function pureWhiteScenario(kind: "wolf" | "good"): TransportGameScenario & {
  pure: number;
  wolfWitch: number;
  wolves: number[];
  dead: number[];
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(pureWhiteTwelveConfig),
    seed = "pure-white-transport:" + kind;
  const deck = config.roleSetups.flatMap((row) =>
    Array.from({ length: row.count }, () => row.role),
  );
  const roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1);
  const id = (role: Role) => roles.indexOf(role) + 1;
  const pure = id(Role.PureWhiteGirl),
    wolfWitch = id(Role.WolfWitch),
    witch = id(Role.Witch),
    hunter = id(Role.Hunter),
    guard = id(Role.Guard),
    ordinary = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    wolves = [...ordinary, wolfWitch].sort((a, b) => a - b);
  const turns = new Map<number, PlannedTurn[]>(ids.map((id) => [id, []]));
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((id: number) => ToolCall | null),
  ) => {
    for (const actor of actors)
      turns
        .get(actor)!
        .push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
  const inspect = (day: number, actor: number, target: number) =>
    add(day, [actor], actor === pure ? "pure_white_girl" : "wolf_witch", {
      name: "inspect_night_identity",
      args: { target_id: target, abstain: false },
    });
  const pack = (day: number, actors: number[], target: number) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Words" } });
  add(1, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  pack(1, wolves, kind === "wolf" ? guard : villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: kind === "wolf" ? hunter : ordinary[0]!, potion_type: PotionType.Poison },
  });
  inspect(1, pure, wolfWitch);
  inspect(1, wolfWitch, pure);
  const firstDeaths = kind === "wolf" ? [guard, hunter] : [villagers[0]!, ordinary[0]!];
  words(1, firstDeaths);
  const aliveDay = ids.filter((id) => !firstDeaths.includes(id));
  const packDay = wolves.filter((id) => aliveDay.includes(id));
  add(1, packDay, ActionWindow.OnPreElection, null);
  add(1, aliveDay, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  add(1, aliveDay, "day_speech", { name: "speak", args: { text: "Speech" } });
  add(1, packDay, ActionWindow.OnPreVote, null);
  const exile = kind === "wolf" ? witch : ordinary[1]!;
  add(1, aliveDay, "voting", (actor) => ({
    name: "vote",
    args: { target_id: actor === exile ? null : exile, abstain: actor === exile },
  }));
  words(1, [exile]);
  const aliveNight = aliveDay.filter((id) => id !== exile);
  if (kind === "good")
    add(2, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  pack(
    2,
    wolves.filter((id) => aliveNight.includes(id)),
    kind === "wolf" ? villagers[0]! : hunter,
  );
  if (kind === "good")
    add(2, [witch], "witch", {
      name: "use_potion",
      args: { target_id: witch, potion_type: PotionType.None },
    });
  inspect(2, pure, kind === "wolf" ? wolfWitch : ordinary[2]!);
  inspect(2, wolfWitch, pure);
  if (kind === "good")
    add(2, [hunter], "hunter_shot", { name: "shoot", args: { target_id: wolfWitch } });
  const dead =
    kind === "wolf" ? [villagers[0]!, pure, wolfWitch] : [hunter, pure, ordinary[2]!, wolfWitch];
  for (const actor of [pure, wolfWitch]) {
    let latest: PlannedTurn["roleInspectionLatest"] = null;
    for (const turn of turns.get(actor)!) {
      turn.roleInspectionLatest = latest;
      if (turn.action?.name === "inspect_night_identity" && turn.action.args.target_id !== null) {
        const target = turn.action.args.target_id,
          role = roles[target - 1]!;
        latest = { targetId: target, roleLabel: [roleName(role, "zh-CN"), roleName(role, "en")] };
      }
    }
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("pure_white_transport_" + kind, config)),
    seed,
    roles,
    turns,
    pure,
    wolfWitch,
    wolves,
    dead,
    alive: aliveNight.filter((id) => !dead.includes(id)),
    winner: kind === "wolf" ? Camp.Wolf : Camp.Good,
    promptAssertions: (actor) => ({
      expectedTeammateIds: wolves.includes(actor) ? wolves.filter((id) => id !== actor) : [],
    }),
  };
}
