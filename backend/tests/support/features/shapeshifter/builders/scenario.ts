/**
 * Builds original shapeshifter test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { text } from "@ai-werewolf-arena/game-text";
import { roleName } from "@ai-werewolf-arena/game-text";
import { term } from "@ai-werewolf-arena/game-text";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const SHAPESHIFTER_CASES = [
  "both0",
  "both1",
  "one1",
  "wolf",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
  "villager",
  "bottom",
] as const;

export type ShapeshifterCase = (typeof SHAPESHIFTER_CASES)[number];

export function shapeshifterScenario(
  kind: ShapeshifterCase,
  size: 6 | 12 = 6,
  locale: "zh-CN" | "en" = "zh-CN",
): TransportGameScenario & {
  initialDeal: Role[];
  actorId: number;
  slot: 0 | 1 | null;
  finalRoles: Role[];
} {
  const replacement =
    kind === "guard"
      ? Role.Guard
      : kind === "idiot"
        ? Role.Idiot
        : kind === "villager"
          ? Role.Villager
          : Role.Hunter;
  const deck = [
    Role.Shapeshifter,
    ...Array<Role>(size === 6 ? 2 : 4).fill(Role.Wolf),
    Role.Seer,
    Role.Witch,
    replacement,
    ...Array<Role>(size === 6 ? 0 : 4).fill(Role.Villager),
  ];
  const config = foxBoard(deck),
    fullDeck = [...deck, Role.Villager, Role.Villager];
  const wanted =
    kind === "both0" || kind === "both1"
      ? [Role.Wolf, Role.Wolf]
      : kind === "one1"
        ? [Role.Seer, Role.Wolf]
        : kind === "wolf"
          ? [Role.Wolf, Role.Seer]
          : kind === "bottom"
            ? [Role.Shapeshifter, Role.Villager]
            : [kind as Role, Role.Villager];
  let seed = "",
    initialDeal: Role[] = [];
  for (let i = 0; i < 200000; i++) {
    seed = `shapeshifter-${size}-${kind}:${i}`;
    initialDeal = shuffled(fullDeck, createRandom(seed).fork("deal"));
    if (
      initialDeal.slice(size).join(",") === wanted.join(",") &&
      (kind === "bottom" || initialDeal.slice(0, size).includes(Role.Shapeshifter))
    )
      break;
    if (i === 199999) throw new Error("fixture_shapeshifter_seed_not_found");
  }
  const roles = initialDeal.slice(0, size),
    actorId = roles.indexOf(Role.Shapeshifter) + 1,
    slot = kind === "bottom" ? null : kind === "both1" || kind === "one1" ? 1 : 0,
    finalRoles = [...roles];
  if (actorId && slot !== null) finalRoles[actorId - 1] = initialDeal[size + slot]!;
  const ids = roles.map((_, i) => i + 1),
    turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]])),
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
  if (actorId)
    add(
      1,
      [actorId],
      "shapeshifter",
      slot === null ? null : { name: "choose_shapeshifter_card", args: { slot } },
    );
  const wolves = ids.filter((id) => finalRoles[id - 1] === Role.Wolf),
    seer = finalRoles.indexOf(Role.Seer) + 1,
    witch = finalRoles.indexOf(Role.Witch) + 1,
    guard = finalRoles.indexOf(Role.Guard) + 1;
  let day = 1;
  while (wolves.some((id) => !dead.has(id))) {
    const liveWolves = wolves.filter((id) => !dead.has(id)),
      shoot = kind === "hunter" && day === 1;
    add(day, liveWolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "Done", end_chat: true },
    });
    add(day, liveWolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: shoot ? actorId : null, abstain: !shoot },
    });
    if (guard)
      add(day, [guard], "guard", {
        name: "guard",
        args: { target_id: day % 2 ? guard : null, abstain: day % 2 === 0 },
      });
    if (seer)
      add(day, [seer], "seer", { name: "check_identity", args: { target_id: liveWolves[0] } });
    if (witch)
      add(day, [witch], "witch", {
        name: "use_potion",
        args: { target_id: witch, potion_type: PotionType.None },
      });
    if (shoot) {
      add(day, [actorId], "last_words", { name: "speak", args: { text: "First-night Hunter" } });
      add(day, [actorId], "hunter_shot", { name: "shoot", args: { target_id: liveWolves[0] } });
      dead.add(actorId);
      dead.add(liveWolves[0]!);
    }
    const remaining = wolves.filter((id) => !dead.has(id));
    if (!remaining.length) break;
    const alive = ids.filter((id) => !dead.has(id)),
      target = remaining[0]!;
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(day, alive, "voting", (id) => ({
      name: "vote",
      args: { target_id: id === target ? null : target, abstain: id === target },
    }));
    add(day, [target], "last_words", { name: "speak", args: { text: "Exile" } });
    dead.add(target);
    day++;
  }
  for (const [id, rows] of turns)
    for (const turn of rows) {
      const current = turn.stage === "shapeshifter" ? Role.Shapeshifter : finalRoles[id - 1]!;
      turn.requiredPromptMarkers = [
        text(locale, "ability.identity", {
          role: roleName(current, locale),
          camp: term("camp", current === Role.Wolf ? "wolf" : "good", locale),
        }),
      ];
    }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig(`shapeshifter_${size}_${kind}`, config)),
    seed,
    roles,
    eventRoles: finalRoles,
    turns,
    initialDeal,
    actorId,
    slot,
    finalRoles,
  };
}
