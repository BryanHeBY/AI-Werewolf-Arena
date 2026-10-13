/**
 * Builds original animal-dream test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../../src/core";
import { createRandom } from "../../../../../src/core";
import { shuffled } from "../../../../../src/core";
import type { ActionRequest } from "../../../../../src/core";
import type { ToolCall } from "../../../../../src/core";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { animalRoles } from "./runtime-game";
import { animalBoard } from "./runtime-game";
import { animalAction } from "../drivers/actions";
import { animalGolden } from "../oracles/golden";
import type { AnimalPlan } from "../contracts";
import type { TransportGameScenario } from "../../../transport/contracts";
import type { PlannedTurn } from "../../../transport/contracts";

export async function animalTransportScenario(
  name: AnimalPlan,
  skip = false,
  first = false,
): Promise<
  TransportGameScenario & {
    turns: Map<number, PlannedTurn[]>;
    golden: ReturnType<typeof animalGolden>;
    mapping: Map<number, number>;
  }
> {
  const seed = `animal-wire:${name}:${skip}:${first}`,
    roles = shuffled(
      animalBoard(skip, first).roleSetups.flatMap((row) =>
        Array.from({ length: row.count }, () => row.role),
      ),
      createRandom(seed).fork("deal"),
    ),
    mapping = new Map<number, number>(),
    used = new Set<number>();
  animalRoles.forEach((role, i) => {
    const id = roles.findIndex((r, j) => r === role && !used.has(j + 1)) + 1;
    used.add(id);
    mapping.set(i + 1, id);
  });
  const map = (id: number) => mapping.get(id)!;
  const config = animalBoard(skip, first),
    board = parseBoardDefinition(boardDefinitionFromConfig("animal_dream", config)),
    turns = new Map<number, PlannedTurn[]>();
  const golden = animalGolden(name, skip, first);
  // Original-seat life prefixes are authored independently of the engine and request factory.
  const cycleLives: Record<AnimalPlan, number[][]> = {
    fox_beauty: [
      [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 5, 7, 8, 9, 10, 11, 12],
      [5, 9, 10, 11, 12],
    ],
    cat_badge: [
      skip ? [1, 3, 4, 5, 6, 7, 8, 10, 11, 12] : [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 4, 5, 7, 8, 10, 11, 12],
      [1, 5, 8, 10, 11, 12],
      [5, 10, 11, 12],
    ],
    puffer_knife: [
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [3, 4, 5, 6, 7, 8, 9, 11],
      [4, 5, 6, 7, 8, 11],
      [5, 6, 7, 11],
    ],
    pk: first
      ? [
          [1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          [1, 6, 7, 8, 9, 10, 11, 12],
          [7, 8, 9, 10, 11, 12],
        ]
      : [
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          [1, 2, 3, 6, 7, 8, 9, 10, 11, 12],
          [2, 3, 7, 8, 9, 10, 11, 12],
          [3, 7, 8, 10, 11, 12],
          [7, 8, 11, 12],
        ],
    last_chain: [
      [1, 3, 4, 5, 6, 7, 8, 10, 11, 12],
      [1, 4, 5, 6, 7, 8, 11, 12],
      [1, 5, 6, 7, 8, 12],
      [5, 6, 7, 8],
    ],
    full_retaliation: [[9]],
  };
  const add = (
    day: number,
    actors: number[],
    stage: ActionRequest["context"]["stage"],
    tool: ToolCall["name"],
    round = 1,
  ) => {
    for (const actor of actors) {
      const request = {
        actorId: actor,
        allowedTools: [tool],
        actionWindow: stage.startsWith("on_") ? stage : undefined,
        context: { day, stage, round },
      } as ActionRequest;
      const chosen = animalAction(request, name, first),
        action = chosen ? structuredClone(chosen) : null;
      if (action && "target_id" in action.args && typeof action.args.target_id === "number")
        action.args.target_id = map(action.args.target_id);
      const id = map(actor),
        rows = turns.get(id) ?? [];
      rows.push({ day, stage, action });
      turns.set(id, rows);
    }
  };
  let badge: number | null = name === "cat_badge" ? 9 : name === "puffer_knife" ? 12 : null;
  for (let day = 1; day <= golden.days; day++) {
    const start =
      day === 1 ? Array.from({ length: 12 }, (_, i) => i + 1) : cycleLives[name][day - 2]!;
    const pack = [1, 2, 3, 4].filter((id) => start.includes(id)),
      plain = pack.filter((id) => id !== 1);
    if (day >= 2 && start.includes(10) && !(name === "fox_beauty" && day > 2))
      add(day, [10], "fox_distract", "fox_distract");
    add(day, pack, "wolf_discussion", "speak_to_wolves");
    if (!(name === "fox_beauty" && day === 2)) add(day, pack, "wolf_vote", "kill_vote");
    if (start.includes(1) && !(name === "fox_beauty" && day === 2))
      add(day, [1], "wolf_beauty", "charm");
    if (day === 1) {
      add(day, plain, ActionWindow.OnPreElection, "self_destruct");
      add(day, start, "sheriff_nomination", "run_for_sheriff");
      if (badge !== null) {
        add(day, [badge], "sheriff_campaign_speech", "speak");
        add(day, [badge], "sheriff_withdraw", "run_for_sheriff");
      }
      if (name === "puffer_knife") {
        add(day, [12], "last_words", "speak");
        add(day, [12], "sheriff_badge_choice", "choose_badge_successor");
        badge = 5;
      }
    }
    const nightIds: readonly number[] = golden.night[day - 1]!;
    const live = start.filter((id) => !nightIds.includes(id));
    if (badge !== null) add(day, [badge], "sheriff_choose_direction", "choose_direction");
    add(day, live, "day_speech", "speak");
    add(
      day,
      plain.filter((id) => live.includes(id)),
      ActionWindow.OnPreVote,
      "self_destruct",
    );
    if (name === "cat_badge" && day === 1) {
      if (skip) {
        add(day, [9], "sheriff_badge_choice", "choose_badge_successor");
        badge = 5;
      }
      continue;
    }
    add(day, live, "voting", "vote");
    if (name === "pk" && day === 1) {
      add(day, [6, 12], "exile_pk_speech", "speak");
      add(
        day,
        live.filter((id) => ![6, 12].includes(id)),
        "exile_pk_vote",
        "vote",
        2,
      );
      if (first) add(day, [12], "puffer_reaction", "puffer_retaliate");
      continue;
    }
    if (name === "full_retaliation" || (name === "last_chain" && day === 4))
      add(day, [12], "puffer_reaction", "puffer_retaliate");
    const exiled =
      name === "fox_beauty" || name === "last_chain"
        ? day === 4
          ? 1
          : day + 1
        : name === "cat_badge"
          ? day === 4
            ? 1
            : day + 1
          : name === "puffer_knife"
            ? day
            : name === "full_retaliation"
              ? 12
              : day === 2
                ? 4
                : day === 3
                  ? 1
                  : day === 4
                    ? 2
                    : 3;
    add(day, [exiled], "last_words", "speak");
    if (name === "cat_badge" && !skip && day === 2) {
      add(day, [9], "sheriff_badge_choice", "choose_badge_successor");
      badge = 5;
    }
  }
  return {
    board,
    seed,
    roles,
    turns,
    mapping,
    golden: {
      ...golden,
      alive: golden.alive.map(map).sort((a, b) => a - b),
      night: golden.night.map((ids) => ids.map(map).sort((a, b) => a - b)),
    },
    promptAssertions(actor) {
      return {
        verifyGameWire: true,
        expectedTeammateIds:
          roles[actor - 1] === "wolf" || roles[actor - 1] === "wolf_beauty"
            ? roles.flatMap((role, i) =>
                ["wolf", "wolf_beauty"].includes(role) && i + 1 !== actor ? [i + 1] : [],
              )
            : [],
      };
    },
  };
}
