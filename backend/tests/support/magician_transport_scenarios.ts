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
import { magicianTwelveConfig } from "../../src/runtime/scenarios/magician_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export function magicianScenario(
  shot: "original" | "exchanged" = "exchanged",
): TransportGameScenario & {
  magician: number;
  hunter: number;
  king: number;
  pair: [number, number];
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(magicianTwelveConfig),
    seed = "magician-transport-night-shot";
  config.magician!.deathShotTargetPolicy = shot;
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const magician = id(Role.Magician),
    hunter = id(Role.Hunter),
    king = id(Role.WolfKing),
    seer = id(Role.Seer),
    witch = id(Role.Witch);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const wolves = [...ordinary, king].sort((a, b) => a - b),
    pair = [king, hunter].sort((a, b) => a - b) as [number, number];
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
  const speech = (day: number, alive: number[], exile: number) => {
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      ordinary.filter((i) => alive.includes(i)),
      ActionWindow.OnPreVote,
      null,
    );
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === exile ? null : exile, abstain: actor === exile },
    }));
    words(day, [exile]);
  };
  add(1, [magician], "magician_exchange", {
    name: "swap_targets",
    args: { first_id: pair[0], second_id: pair[1], abstain: false },
  });
  pack(1, wolves, hunter);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: ordinary[0]!, potion_type: PotionType.Poison },
  });
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: hunter } });
  add(1, wolves, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, [king, ordinary[0]!]);
  add(1, [king], "death_shot", {
    name: "shoot",
    args: { target_id: shot === "exchanged" ? hunter : villagers[0]! },
  });
  const alive1 = ids.filter(
    (i) => i !== king && i !== ordinary[0] && (shot === "exchanged" || i !== villagers[0]),
  );
  speech(1, alive1, ordinary[1]!);
  const alive2 = alive1.filter((i) => i !== ordinary[1]);
  add(2, [magician], "magician_exchange", {
    name: "swap_targets",
    args: { first_id: null, second_id: null, abstain: true },
  });
  pack(2, [ordinary[2]!], witch);
  add(2, [witch], "witch", {
    name: "use_potion",
    args: { target_id: witch, potion_type: PotionType.None },
  });
  add(2, [seer], "seer", { name: "check_identity", args: { target_id: ordinary[2]! } });
  const day2 = alive2.filter((i) => i !== witch);
  speech(2, day2, ordinary[2]!);
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("magician_transport_" + shot, config)),
    seed,
    roles,
    turns,
    magician,
    hunter,
    king,
    pair,
    alive: day2.filter((i) => i !== ordinary[2]),
    winner: Camp.Good,
  };
}
