/**
 * Builds original evil-knight test input plans, fixed boards and explicit player/marker data. Inputs are
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
import { evilKnightTwelveConfig } from "../../../../../src/rulesets/presets/evil-knight-twelve";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export type EvilKnightScenarioKind = "night_immune_wolf" | "shot_bypass_good" | "day_shot_good";

export function evilKnightScenario(kind: EvilKnightScenarioKind): TransportGameScenario & {
  knight: number;
  seer: number;
  witch: number;
  hunter: number;
  wolves: number[];
  alive: number[];
  winner: Camp;
  lastNightDeaths: number[];
} {
  const config = structuredClone(evilKnightTwelveConfig),
    seed = "evil-knight-transport:" + kind;
  config.evilKnight!.shotPolicy =
    kind === "shot_bypass_good" ? "hunter_shot_bypasses" : "night_shot_immune";
  const roles = shuffled(
    config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1;
  const knight = id(Role.EvilKnight),
    seer = id(Role.Seer),
    witch = id(Role.Witch),
    hunter = id(Role.Hunter),
    guard = id(Role.Guard);
  const ordinary = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    wolves = [...ordinary, knight].sort((a, b) => a - b);
  const turns = new Map<number, PlannedTurn[]>(ids.map((id) => [id, []]));
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((id: number) => ToolCall | null),
  ) => {
    for (const actor of actors)
      turns
        .get(actor)!
        .push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
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
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Words" } });
  const speech = (day: number, alive: number[], exile: number, first: boolean) => {
    const canBlast = ordinary.filter((id) => alive.includes(id));
    if (first) {
      add(day, canBlast, ActionWindow.OnPreElection, null);
      add(day, alive, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
    }
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(day, canBlast, ActionWindow.OnPreVote, null);
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === exile ? null : exile, abstain: actor === exile },
    }));
    words(day, [exile]);
  };
  add(1, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  const firstKnife =
    kind === "night_immune_wolf" ? guard : kind === "day_shot_good" ? ordinary[1]! : villagers[0]!;
  pack(1, wolves, firstKnife);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: {
      target_id: kind === "night_immune_wolf" ? knight : ordinary[0]!,
      potion_type: PotionType.Poison,
    },
  });
  const firstInspect =
    kind === "night_immune_wolf" ? knight : kind === "day_shot_good" ? villagers[0]! : ordinary[1]!;
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: firstInspect } });
  const firstDeaths = kind === "night_immune_wolf" ? [guard, witch] : [firstKnife, ordinary[0]!];
  words(1, kind === "night_immune_wolf" ? [guard] : firstDeaths);
  const aliveDay = ids.filter((id) => !firstDeaths.includes(id));
  const firstExile =
    kind === "night_immune_wolf" ? seer : kind === "day_shot_good" ? ordinary[2]! : ordinary[1]!;
  speech(1, aliveDay, firstExile, true);
  const aliveNight = aliveDay.filter((id) => id !== firstExile);
  if (aliveNight.includes(guard))
    add(2, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  const secondKnife = kind === "day_shot_good" ? villagers[0]! : hunter;
  pack(
    2,
    wolves.filter((id) => aliveNight.includes(id)),
    secondKnife,
  );
  if (aliveNight.includes(witch))
    add(2, [witch], "witch", {
      name: "use_potion",
      args: { target_id: witch, potion_type: PotionType.None },
    });
  if (aliveNight.includes(seer))
    add(2, [seer], "seer", {
      name: "check_identity",
      args: { target_id: kind === "day_shot_good" ? villagers[1]! : ordinary[2]! },
    });
  if (kind !== "day_shot_good")
    add(2, [hunter], "hunter_shot", { name: "shoot", args: { target_id: knight } });
  const lastNightDeaths =
    kind === "night_immune_wolf"
      ? [hunter]
      : kind === "shot_bypass_good"
        ? [hunter, knight]
        : [villagers[0]!];
  let alive = aliveNight.filter((id) => !lastNightDeaths.includes(id));
  if (kind !== "night_immune_wolf") {
    const secondExile = kind === "shot_bypass_good" ? ordinary[2]! : hunter;
    speech(2, alive, secondExile, false);
    if (kind === "day_shot_good")
      add(2, [hunter], "hunter_shot", { name: "shoot", args: { target_id: knight } });
    alive = alive.filter((id) => id !== secondExile && (kind !== "day_shot_good" || id !== knight));
  }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig("evil_knight_transport_" + kind, config)),
    seed,
    roles,
    turns,
    knight,
    seer,
    witch,
    hunter,
    wolves,
    alive,
    lastNightDeaths,
    winner: kind === "night_immune_wolf" ? Camp.Wolf : Camp.Good,
    promptAssertions: (actor) => ({
      expectedTeammateIds: wolves.includes(actor) ? wolves.filter((id) => id !== actor) : [],
    }),
  };
}
