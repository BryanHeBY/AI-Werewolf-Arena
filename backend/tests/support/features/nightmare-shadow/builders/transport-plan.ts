/**
 * Builds original nightmare-shadow test input plans, fixed boards and explicit player/marker data. Inputs
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
import { nightmareTwelveConfig } from "../../../../../src/rulesets/presets/nightmare-twelve";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function nightmareScenario(): TransportGameScenario & {
  nightmare: number;
  seer: number;
  hunter: number;
  alive: number[];
  winner: Camp;
} {
  const config = structuredClone(nightmareTwelveConfig),
    seed = "nightmare-transport-day-shot";
  config.nightmareShadow!.wolfActionPolicy = "no_blast_no_self_knife";
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const nightmare = id(Role.NightmareShadow),
    seer = id(Role.Seer),
    witch = id(Role.Witch),
    hunter = id(Role.Hunter),
    dreamer = id(Role.Dreamer);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const wolves = [...ordinary, nightmare].sort((a, b) => a - b);
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
  const speech = (day: number, alive: number[], exile: number, first: boolean) => {
    const blast = ordinary.filter((i) => alive.includes(i));
    if (first) {
      add(day, blast, ActionWindow.OnPreElection, null);
      add(day, alive, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
    }
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(day, blast, ActionWindow.OnPreVote, null);
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === exile ? null : exile, abstain: actor === exile },
    }));
    words(day, [exile]);
  };
  add(1, [nightmare], "nightmare_fear", {
    name: "fear",
    args: { target_id: seer, abstain: false },
  });
  add(1, [dreamer], "dreamer", { name: "dream", args: { target_id: villagers[0]! } });
  pack(1, wolves, ordinary[2]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: ordinary[0]!, potion_type: PotionType.Poison },
  });
  add(1, ordinary, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, [ordinary[0]!, ordinary[2]!]);
  const alive1 = ids.filter((i) => i !== ordinary[0] && i !== ordinary[2]);
  speech(1, alive1, ordinary[1]!, false);
  const alive2 = alive1.filter((i) => i !== ordinary[1]);
  add(2, [nightmare], "nightmare_fear", {
    name: "fear",
    args: { target_id: hunter, abstain: false },
  });
  add(2, [dreamer], "dreamer", { name: "dream", args: { target_id: villagers[1]! } });
  pack(2, [nightmare], witch);
  add(2, [witch], "witch", {
    name: "use_potion",
    args: { target_id: witch, potion_type: PotionType.None },
  });
  add(2, [seer], "seer", { name: "check_identity", args: { target_id: villagers[0]! } });
  const day2 = alive2.filter((i) => i !== witch);
  speech(2, day2, hunter, false);
  add(2, [hunter], "hunter_shot", { name: "shoot", args: { target_id: nightmare } });
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("nightmare_transport_day_shot", config)),
    seed,
    roles,
    turns,
    nightmare,
    seer,
    hunter,
    alive: day2.filter((i) => i !== hunter && i !== nightmare),
    winner: Camp.Good,
  };
}
