/**
 * Builds original wall-notes test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function wallScenario(size: 6 | 12, mode: "write" | "skip"): TransportGameScenario {
  const deck = [
    ...Array<Role>(size === 6 ? 2 : 4).fill(Role.Wolf),
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    ...Array<Role>(size === 6 ? 1 : 5).fill(Role.Villager),
  ];
  const config = { ...foxBoard(deck), events: { pack: "awa_wall_notes_once_v1" as const } },
    seed = `wall-${size}-${mode}`,
    roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    seer = roles.indexOf(Role.Seer) + 1,
    witch = roles.indexOf(Role.Witch) + 1;
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
  for (let day = 1; day <= wolves.length; day++) {
    const liveWolves = wolves.filter((id) => !dead.has(id)),
      knife = villagers[Math.max(0, day - 2)]!;
    add(day, liveWolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "Done", end_chat: true },
    });
    add(day, liveWolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: false },
    });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: liveWolves[0] } });
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
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(day, alive, "voting", (id) => ({
      name: "vote",
      args: {
        target_id: id === liveWolves[0] ? null : liveWolves[0],
        abstain: id === liveWolves[0],
      },
    }));
    add(day, [liveWolves[0]], "last_words", { name: "speak", args: { text: "Exile last" } });
    dead.add(liveWolves[0]);
    if (day === 1)
      add(
        day,
        ids.filter((id) => !dead.has(id)),
        "wall_notes",
        (id) =>
          mode === "skip"
            ? null
            : {
                name: "write_note",
                args: { text: id % 2 ? "  [God] secret 💌  " : "Anonymous note" },
              },
      );
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig(`wall_${size}_${mode}`, config)),
    seed,
    roles,
    turns,
  };
}
