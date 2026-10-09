import {
  Role,
  PotionType,
  createRandom,
  shuffled,
  type ActionStage,
  type ToolCall,
} from "../../src/core";
import { foxBoard } from "./cursed_fox_scenarios";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export function debaterScenario(
  size: 6 | 12,
  outcome: "success" | "tie" | "abstain",
): TransportGameScenario {
  const deck = [
      Role.Debater,
      Role.Hunter,
      ...Array<Role>(size === 6 ? 1 : 4).fill(Role.Wolf),
      Role.Witch,
      Role.Seer,
      ...Array<Role>(size === 6 ? 1 : 4).fill(Role.Villager),
    ],
    config = foxBoard(deck),
    seed = `debater-${size}-${outcome}`,
    roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    actor = roles.indexOf(Role.Debater) + 1,
    target = ids.find((id) => id !== actor)!,
    witch = roles.indexOf(Role.Witch) + 1,
    seer = roles.indexOf(Role.Seer) + 1,
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]]));
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
  const dead = new Set<number>();
  for (let day = 1; day <= wolves.length; day++) {
    const liveWolves = wolves.filter((id) => !dead.has(id)),
      knife = villagers[day - 1]!;
    add(day, liveWolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "Done", end_chat: true },
    });
    add(day, liveWolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: false },
    });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: liveWolves[0]! } });
    add(
      day,
      [witch],
      "witch",
      day === 1
        ? { name: "use_potion", args: { target_id: knife, potion_type: PotionType.Heal } }
        : { name: "use_potion", args: { target_id: witch, potion_type: PotionType.None } },
    );
    if (day > 1) dead.add(knife);
    const alive = ids.filter((id) => !dead.has(id));
    // The challenge is before the first other ordinary speaker; only the actor may precede it.
    if (day === 1) {
      if (alive[0] === actor)
        add(day, [actor], "day_speech", { name: "speak", args: { text: "Speech" } });
      add(day, [actor], "debate_challenge", { name: "challenge", args: { target_id: target } });
      add(day, [actor, target], "debate_speech", { name: "speak", args: { text: "Debate" } });
      add(day, alive, "debate_ballot", (id) => ({
        name: "debate_vote",
        args: {
          support:
            alive.indexOf(id) < size / 2 + (outcome === "success" ? 1 : 0)
              ? true
              : outcome === "abstain"
                ? null
                : false,
        },
      }));
    }
    const speakers = alive.filter(
      (id) =>
        !(day === 1 && outcome === "success" && id === target) &&
        !(day === 1 && alive[0] === actor && id === actor),
    );
    add(day, speakers, "day_speech", { name: "speak", args: { text: "Speech" } });
    const blocked = day === 1 ? (outcome === "success" ? target : actor) : null,
      exile = liveWolves[0]!;
    add(
      day,
      alive.filter((id) => id !== blocked),
      "voting",
      (id) => ({
        name: "vote",
        args: { target_id: id === exile ? null : exile, abstain: id === exile },
      }),
    );
    add(day, [exile], "last_words", { name: "speak", args: { text: "Exile last" } });
    dead.add(exile);
  }
  return {
    roles,
    board: parseBoardDefinition(boardDefinitionFromConfig(`debater_${size}_${outcome}`, config)),
    seed,
    turns,
    promptAssertions: (id, locale) =>
      id === actor
        ? {
            requiredCurrentMarkers: [
              locale === "en" ? "You are the Good god Debater" : "你是好人神职杠精",
            ],
            forbiddenCurrentMarkers: ['"ballots"', '"voterId"'],
          }
        : {},
  };
}
