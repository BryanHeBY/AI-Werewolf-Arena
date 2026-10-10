import {
  ActionWindow,
  Camp,
  Role,
  PotionType,
  createRandom,
  shuffled,
  type ActionStage,
  type ToolCall,
} from "../../src/core";
import { orderPrinceTwelveConfig } from "../../src/runtime/scenarios/order_prince_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export function orderPrinceScenario(
  variant: "day1" | "day2" | "pk" = "day1",
): TransportGameScenario & { prince: number; alive: number[]; winner: Camp } {
  const config = structuredClone(orderPrinceTwelveConfig),
    seed = "order-prince-transport";
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const prince = id(Role.OrderPrince),
    seer = id(Role.Seer),
    witch = id(Role.Witch);
  const wolves = ids.filter((i) => roles[i - 1] === Role.Wolf),
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
  const ballot = (day: number, alive: number[], target: number, stage: ActionStage) =>
    add(day, alive, stage, (actor) => ({
      name: "vote",
      args: { target_id: actor === target ? null : target, abstain: actor === target },
    }));
  const daylight = (day: number, alive: number[], target: number) => {
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      wolves.filter((id) => alive.includes(id)),
      ActionWindow.OnPreVote,
      null,
    );
    const activate = (variant !== "day2" && day === 1) || (variant === "day2" && day === 2);
    ballot(day, alive, activate ? prince : target, "voting");
    if (day === 1 || (variant === "day2" && day === 2))
      add(day, [prince], "order_prince_choice", { name: "reset_exile_vote", args: { activate } });
    if (activate) {
      add(day, [prince], "order_prince_speech", {
        name: "speak",
        args: { text: "Restart this ballot." },
      });
      if (variant === "pk") {
        const candidates = [wolves[1]!, wolves[2]!],
          voters = alive.filter((id) => !candidates.includes(id));
        add(day, alive, "order_prince_revote", (actor) => ({
          name: "vote",
          args: {
            target_id: candidates.includes(actor)
              ? null
              : candidates[voters.indexOf(actor) < 4 ? 0 : 1]!,
            abstain: candidates.includes(actor),
          },
        }));
        add(day, candidates, "exile_pk_speech", { name: "speak", args: { text: "PK speech." } });
        ballot(day, voters, target, "exile_pk_vote");
      } else ballot(day, alive, target, "order_prince_revote");
    }
    words(day, [target]);
  };
  pack(1, wolves, villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: wolves[0]!, potion_type: PotionType.Poison },
  });
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: wolves[1]! } });
  add(1, wolves, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, [villagers[0]!, wolves[0]!]);
  const alive1 = ids.filter((id) => id !== villagers[0] && id !== wolves[0]);
  daylight(1, alive1, wolves[1]!);
  pack(2, [wolves[2]!, wolves[3]!], witch);
  add(2, [witch], "witch", {
    name: "use_potion",
    args: { target_id: witch, potion_type: PotionType.None },
  });
  add(2, [seer], "seer", { name: "check_identity", args: { target_id: wolves[2]! } });
  const alive2 = alive1.filter((id) => id !== wolves[1] && id !== witch);
  daylight(2, alive2, wolves[2]!);
  pack(3, [wolves[3]!], villagers[1]!);
  add(3, [seer], "seer", { name: "check_identity", args: { target_id: wolves[3]! } });
  const alive3 = alive2.filter((id) => id !== wolves[2] && id !== villagers[1]);
  daylight(3, alive3, wolves[3]!);
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("order_prince_transport_" + variant, config),
    ),
    seed,
    roles,
    turns,
    prince,
    alive: alive3.filter((id) => id !== wolves[3]),
    winner: Camp.Good,
  };
}
