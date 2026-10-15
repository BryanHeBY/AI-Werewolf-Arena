/**
 * Builds original demon-hunter test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { WinCondition } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import { demonHunterBoard } from "./candidate-world";
import { demonHunterDeck } from "./candidate-world";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function demonHunterTransportScenario(
  size: 6 | 12,
  goal: WinCondition,
): TransportGameScenario & { demonId: number; winner: Camp; alive: number[] } {
  const seed = `demon-transport:${size}:${goal}`,
    roles = shuffled(demonHunterDeck(size), createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf),
    demonId = roles.indexOf(Role.DemonHunter) + 1,
    witch = roles.indexOf(Role.Witch) + 1,
    seer = roles.indexOf(Role.Seer) + 1,
    guard = roles.indexOf(Role.Guard) + 1,
    hunter = roles.indexOf(Role.Hunter) + 1;
  const turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]]));
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
  for (const day of [1, 2]) {
    if (guard)
      add(day, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
    add(day, wolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "", end_chat: true },
    });
    add(day, wolves, "wolf_vote", {
      name: "kill_vote",
      args: {
        target_id: day === 2 && size === 12 ? hunter : null,
        abstain: !(day === 2 && size === 12),
      },
    });
    add(day, [witch], "witch", {
      name: "use_potion",
      args: {
        target_id: day === 1 ? demonId : witch,
        potion_type: day === 1 ? PotionType.Poison : PotionType.None,
      },
    });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: wolves[0]! } });
    if (day === 2)
      add(day, [demonId], "demon_hunter", {
        name: "demon_hunt",
        args: { target_id: wolves[0]!, abstain: false },
      });
    if (day === 2 && size === 12)
      add(day, [hunter], "hunter_shot", { name: "shoot", args: { target_id: wolves[2]! } });
    const alive =
      day === 1
        ? ids
        : ids.filter(
            (id) => id !== wolves[0] && !(size === 12 && [hunter, wolves[2]].includes(id)),
          );
    const pack = wolves.filter((id) => alive.includes(id));
    if (day === 1 && size === 12) {
      add(day, pack, ActionWindow.OnPreElection, null);
      add(day, alive, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
    }
    add(day, alive, "day_speech", { name: "speak", args: { text: "" } });
    add(day, pack, ActionWindow.OnPreVote, null);
    add(day, alive, "voting", (id) => ({
      name: "vote",
      args: {
        target_id: day === 1 || id === wolves[1] ? null : wolves[1]!,
        abstain: day === 1 || id === wolves[1],
      },
    }));
    if (day === 2) add(day, [wolves[1]!], "last_words", { name: "speak", args: { text: "" } });
  }
  return {
    seed,
    roles,
    turns,
    demonId,
    winner: Camp.Good,
    alive: ids.filter((id) => !wolves.includes(id) && !(size === 12 && id === hunter)),
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`demon_transport_${size}_${goal}`, demonHunterBoard(size, goal)),
    ),
  };
}

export function demonHunterFailureScenario(
  size: 6 | 12,
  goal: WinCondition,
  failure: "missing" | "late",
): TransportGameScenario & { demonId: number } {
  const scenario = demonHunterTransportScenario(size, goal);
  const turns = new Map<number, PlannedTurn[]>();
  const before = new Set([
    "guard",
    "wolf_discussion",
    "wolf_vote",
    "witch",
    "seer",
    "demon_hunter",
  ]);
  for (const [actor, plan] of scenario.turns)
    turns.set(
      actor,
      plan
        .filter((t) => t.day === 1 || (t.day === 2 && before.has(t.stage)))
        .map((t) =>
          t.stage === "demon_hunter"
            ? { ...t, terminalFailure: failure, action: failure === "missing" ? null : t.action }
            : t,
        ),
    );
  return {
    ...scenario,
    turns,
    expectedFailure: { actorId: scenario.demonId, stage: "demon_hunter" },
  };
}
