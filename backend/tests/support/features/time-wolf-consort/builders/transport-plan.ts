/**
 * Builds original time-wolf-consort test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
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
import { timeConsortTwelveConfig } from "../../../../../src/runtime/scenarios/time_consort_twelve";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function timeConsortScenario(
  scope: "whole_night" | "first_effect" = "whole_night",
): TransportGameScenario & {
  consort: number;
  seer: number;
  guard: number;
  witch: number;
  locked: number;
  winner: Camp;
  alive: number[];
} {
  const config = structuredClone(timeConsortTwelveConfig),
    seed = "time-consort-transport";
  config.timeConsort!.reflectionScope = scope;
  const roles = shuffled(
    config.roleSetups.flatMap((row) => Array.from({ length: row.count }, () => row.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1;
  const consort = id(Role.TimeWolfConsort),
    seer = id(Role.Seer),
    guard = id(Role.Guard),
    witch = id(Role.Witch);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    wolves = [...ordinary, consort].sort((a, b) => a - b),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager),
    locked = ordinary[0]!;
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
    if (alive.includes(id(Role.OrderPrince)))
      add(day, [id(Role.OrderPrince)], "order_prince_choice", {
        name: "reset_exile_vote",
        args: { activate: false },
      });
    words(day, [target]);
  };
  add(1, [consort], "time_consort_lock", {
    name: "lock_time",
    args: { target_id: locked, abstain: false },
  });
  add(1, [guard], "guard", { name: "guard", args: { target_id: locked, abstain: false } });
  pack(1, wolves, villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: locked, potion_type: PotionType.Poison },
  });
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: locked } });
  add(1, wolves, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  const poisonDeath = scope === "whole_night" ? witch : locked;
  words(1, [villagers[0]!, poisonDeath]);
  let alive = ids.filter((i) => i !== villagers[0] && i !== poisonDeath);
  dayVote(1, alive, ordinary[1]!);
  alive = alive.filter((i) => i !== ordinary[1]);
  for (let day = 2; day <= 3; day++) {
    const killed = day === 2 ? villagers[2]! : villagers[1]!;
    add(day, [guard], "guard", {
      name: "guard",
      args: { target_id: day === 2 ? villagers[1]! : guard, abstain: false },
    });
    pack(
      day,
      wolves.filter((i) => alive.includes(i)),
      killed,
    );
    if (alive.includes(witch))
      add(day, [witch], "witch", {
        name: "use_potion",
        args: { target_id: witch, potion_type: PotionType.None },
      });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: consort } });
    alive = alive.filter((i) => i !== killed);
    const voted = day === 2 ? ordinary[2]! : consort;
    dayVote(day, alive, voted);
    alive = alive.filter((i) => i !== voted);
  }
  if (scope === "whole_night") {
    add(4, [guard], "guard", { name: "guard", args: { target_id: seer, abstain: false } });
    pack(4, [locked], guard);
    add(4, [seer], "seer", { name: "check_identity", args: { target_id: locked } });
    alive = alive.filter((i) => i !== guard);
    dayVote(4, alive, locked);
    alive = alive.filter((i) => i !== locked);
  }
  for (const actor of wolves)
    for (const turn of turns.get(actor)!)
      turn.currentTeammateIds = wolves.filter((i) => i !== actor);
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("time_consort_transport_" + scope, config),
    ),
    seed,
    roles,
    turns,
    consort,
    seer,
    guard,
    witch,
    locked,
    winner: Camp.Good,
    alive,
  };
}
