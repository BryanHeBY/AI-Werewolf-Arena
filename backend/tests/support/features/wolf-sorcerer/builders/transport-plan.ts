/**
 * Builds original wolf-sorcerer test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { wolfSorcererTwelveConfig } from "../../../../../src/runtime/scenarios/wolf_sorcerer_twelve";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function wolfSorcererScenario(
  variant: "overlap" | "cancel" | "disjoint" = "overlap",
): TransportGameScenario & {
  sorcerer: number;
  psychic: number;
  hunter: number;
  wolfTarget: number;
  inspectionRole: Role;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(wolfSorcererTwelveConfig),
    seed = "wolf-sorcerer-transport";
  config.magician!.deathShotTargetPolicy = "exchanged";
  const roles = shuffled(
    config.roleSetups.flatMap((row) => Array.from({ length: row.count }, () => row.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1;
  const sorcerer = id(Role.WolfSorcerer),
    magician = id(Role.Magician),
    psychic = id(Role.Psychic),
    witch = id(Role.Witch),
    hunter = id(Role.Hunter);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    wolves = [...ordinary, sorcerer].sort((a, b) => a - b),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []]));
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((actor: number) => ToolCall | null),
  ) => {
    for (const actor of actors)
      turns
        .get(actor)!
        .push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Words" } });
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
  const dayVote = (day: number, alive: number[], target: number) => {
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      wolves.filter((i) => alive.includes(i)),
      ActionWindow.OnPreVote,
      null,
    );
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === target ? null : target, abstain: actor === target },
    }));
    words(day, [target]);
  };
  pack(1, ordinary, villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: ordinary[0]!, potion_type: PotionType.Poison },
  });
  add(1, [psychic], "psychic", { name: "inspect_role", args: { target_id: sorcerer } });
  add(1, wolves, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, [villagers[0]!, ordinary[0]!]);
  const alive1 = ids.filter((i) => i !== villagers[0] && i !== ordinary[0]);
  dayVote(1, alive1, ordinary[1]!);
  add(2, [magician], "magician_exchange", {
    name: "swap_targets",
    args: { first_id: psychic, second_id: hunter, abstain: false },
  });
  const pair =
    variant === "cancel"
      ? [psychic, hunter]
      : variant === "disjoint"
        ? [ordinary[2]!, villagers[1]!]
        : [hunter, villagers[1]!];
  add(2, [sorcerer], "wolf_sorcerer_exchange", {
    name: "swap_night_seats",
    args: { first_id: pair[0]!, second_id: pair[1]!, abstain: false },
  });
  pack(
    2,
    [ordinary[2]!, sorcerer].sort((a, b) => a - b),
    variant === "cancel" ? hunter : psychic,
  );
  add(2, [witch], "witch", {
    name: "use_potion",
    args: { target_id: witch, potion_type: PotionType.None },
  });
  add(2, [psychic], "psychic", { name: "inspect_role", args: { target_id: hunter } });
  add(2, [hunter], "hunter_shot", {
    name: "shoot",
    args: { target_id: variant === "disjoint" ? villagers[1]! : ordinary[2]! },
  });
  const alive2 = alive1.filter((i) => i !== ordinary[1] && i !== hunter && i !== ordinary[2]);
  dayVote(2, alive2, sorcerer);
  for (const actor of wolves)
    for (const turn of turns.get(actor)!) {
      turn.currentTeammateIds =
        actor === sorcerer && turn.stage === "wolf_sorcerer_exchange"
          ? []
          : turn.day === 1
            ? actor === sorcerer
              ? []
              : ordinary.filter((i) => i !== actor)
            : wolves.filter((i) => i !== actor);
    }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("wolf_sorcerer_transport_" + variant, config),
    ),
    seed,
    roles,
    turns,
    sorcerer,
    psychic,
    hunter,
    wolfTarget: ordinary[2]!,
    inspectionRole:
      variant === "cancel" ? Role.Hunter : variant === "disjoint" ? Role.Psychic : Role.Villager,
    alive: alive2.filter((i) => i !== sorcerer),
    winner: Camp.Good,
  };
}
