/**
 * 测试支持模块负责按 mapped、cancel 或 pk 变体构造诡术师传输输入，输出原板子、内部固定种子、身份、行动和字面胜方／存活表。不执行映射、复投或对局结算生成预期。
 */
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { tricksterTwelveConfig } from "../../../../../src/rulesets/presets/trickster-twelve";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function tricksterScenario(
  variant: "mapped" | "cancel" | "pk" = "mapped",
): TransportGameScenario & { trickster: number; prince: number; alive: number[]; winner: Camp } {
  const config = structuredClone(tricksterTwelveConfig),
    seed = "trickster-transport";
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const prince = id(Role.OrderPrince),
    trickster = id(Role.Trickster),
    magician = id(Role.Magician),
    seer = id(Role.Seer),
    witch = id(Role.Witch);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    wolves = [...ordinary, trickster].sort((a, b) => a - b),
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

  const exchange = (
    day: number,
    actor: number,
    tool: "swap_targets" | "swap_exile_targets",
    pair: [number, number] | null,
  ): void => {
    const args = {
      first_id: pair?.[0] ?? null,
      second_id: pair?.[1] ?? null,
      abstain: pair === null,
    };
    const action: ToolCall =
      tool === "swap_targets"
        ? { name: "swap_targets", args }
        : { name: "swap_exile_targets", args };
    add(day, [actor], tool === "swap_targets" ? "magician_exchange" : "trickster_exchange", action);
  };
  const daylight = (day: number, alive: number[], raw: number, actual: number | null) => {
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      wolves.filter((id) => alive.includes(id)),
      ActionWindow.OnPreVote,
      null,
    );
    ballot(day, alive, day === 1 ? prince : raw, "voting");
    if (day === 1) {
      add(day, [prince], "order_prince_choice", {
        name: "reset_exile_vote",
        args: { activate: true },
      });
      add(day, [prince], "order_prince_speech", {
        name: "speak",
        args: { text: "Restart this ballot." },
      });
      if (variant === "pk") {
        const candidates = [prince, ordinary[2]!],
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
        add(day, candidates, "exile_pk_speech", { name: "speak", args: { text: "PK speech" } });
        ballot(day, voters, raw, "exile_pk_vote");
      } else ballot(day, alive, raw, "order_prince_revote");
    }
    if (actual !== null) words(day, [actual]);
  };
  exchange(1, magician, "swap_targets", variant === "cancel" ? [prince, ordinary[1]!] : null);
  exchange(1, trickster, "swap_exile_targets", [ordinary[1]!, prince]);
  pack(1, wolves, villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: { target_id: ordinary[0]!, potion_type: PotionType.Poison },
  });
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: ordinary[1]! } });
  add(1, wolves, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, [villagers[0]!, ordinary[0]!]);
  const alive1 = ids.filter((id) => id !== villagers[0] && id !== ordinary[0]);
  daylight(1, alive1, variant === "cancel" ? ordinary[1]! : prince, ordinary[1]!);
  exchange(2, magician, "swap_targets", null);
  exchange(2, trickster, "swap_exile_targets", [witch, ordinary[2]!]);
  pack(
    2,
    [ordinary[2]!, trickster].sort((a, b) => a - b),
    witch,
  );
  add(2, [witch], "witch", {
    name: "use_potion",
    args: { target_id: witch, potion_type: PotionType.None },
  });
  add(2, [seer], "seer", { name: "check_identity", args: { target_id: ordinary[2]! } });
  const alive2 = alive1.filter((id) => id !== ordinary[1] && id !== witch);
  daylight(2, alive2, ordinary[2]!, null);
  exchange(3, magician, "swap_targets", null);
  exchange(3, trickster, "swap_exile_targets", null);
  pack(
    3,
    [ordinary[2]!, trickster].sort((a, b) => a - b),
    villagers[1]!,
  );
  add(3, [seer], "seer", { name: "check_identity", args: { target_id: trickster } });
  const alive3 = alive2.filter((id) => id !== villagers[1]);
  daylight(3, alive3, trickster, trickster);
  exchange(4, magician, "swap_targets", null);
  pack(4, [ordinary[2]!], seer);
  add(4, [seer], "seer", { name: "check_identity", args: { target_id: ordinary[2]! } });
  const alive4 = alive3.filter((id) => id !== trickster && id !== seer);
  daylight(4, alive4, ordinary[2]!, ordinary[2]!);
  for (const [index, turn] of turns.get(trickster)!.entries()) {
    turn.currentTeammateIds = index === 0 ? [] : [...ordinary].sort((a, b) => a - b);
  }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("trickster_transport_" + variant, config),
    ),
    seed,
    roles,
    turns,
    trickster,
    prince,
    alive: alive4.filter((id) => id !== ordinary[2]),
    winner: Camp.Good,
  };
}
