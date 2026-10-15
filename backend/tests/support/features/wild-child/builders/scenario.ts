/**
 * Builds original wild-child test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { text } from "@ai-werewolf-arena/game-text";
import { roleName } from "@ai-werewolf-arena/game-text";
import { term } from "@ai-werewolf-arena/game-text";
import { Role } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { ActionWindow } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const WILD_CHILD_CASES = [
  "wolf_exile",
  "good_knife",
  "poison",
  "hunter_chain",
  "same_wave",
  "self_destruct",
  "model_alive",
] as const;

export type WildChildCase = (typeof WILD_CHILD_CASES)[number];

export function wildChildScenario(
  kind: WildChildCase,
  size: 6 | 12 = 6,
  locale: "zh-CN" | "en" = "zh-CN",
): TransportGameScenario & {
  actorId: number;
  modelId: number;
  transformed: boolean;
  active: boolean;
} {
  const deck = [
    Role.WildChild,
    ...Array<Role>(size === 6 ? 2 : 4).fill(Role.Wolf),
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    ...Array<Role>(size === 6 ? 0 : 4).fill(Role.Villager),
  ];
  const seed = `wild-child:${size}:${kind}`,
    roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    child = roles.indexOf(Role.WildChild) + 1,
    seer = roles.indexOf(Role.Seer) + 1,
    witch = roles.indexOf(Role.Witch) + 1,
    hunter = roles.indexOf(Role.Hunter) + 1,
    originalWolves = ids.filter((id) => roles[id - 1] === Role.Wolf);
  const model = ["wolf_exile", "poison", "self_destruct"].includes(kind)
    ? originalWolves[0]!
    : kind === "good_knife" && size === 12
      ? roles.indexOf(Role.Villager) + 1
      : hunter;
  const transformed = kind !== "same_wave" && kind !== "model_alive",
    active = transformed && kind !== "hunter_chain";
  const config = {
    ...foxBoard(deck),
    ...(kind === "self_destruct"
      ? {
          selfDestruct: { enabledWindows: [ActionWindow.OnPreVote] },
          hooks: { ...foxBoard(deck).hooks, onPreVote: true },
        }
      : {}),
  };
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
  add(1, [child], "wild_child", { name: "choose_wild_model", args: { target_id: model } });
  let day = 1,
    converted = false;
  for (;;) {
    const wolves = [...originalWolves, ...(converted && active ? [child] : [])].filter(
      (id) => !dead.has(id),
    );
    add(day, wolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "Raw pack", end_chat: true },
    });
    const knife =
      day === 1 && ["good_knife", "hunter_chain", "same_wave"].includes(kind) ? model : null;
    add(day, wolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: knife === null },
    });
    if (!dead.has(seer))
      add(day, [seer], "seer", {
        name: "check_identity",
        args: { target_id: day === 1 ? model : !dead.has(child) ? child : wolves[0] },
      });
    if (!dead.has(witch))
      add(day, [witch], "witch", {
        name: "use_potion",
        args: {
          target_id:
            day === 1 && kind === "poison"
              ? model
              : day === 1 && kind === "same_wave"
                ? child
                : witch,
          potion_type:
            day === 1 && ["poison", "same_wave"].includes(kind)
              ? PotionType.Poison
              : PotionType.None,
        },
      });
    const nightDead =
      day === 1
        ? [
            ...(knife === null ? [] : [model]),
            ...(kind === "poison" ? [model] : kind === "same_wave" ? [child] : []),
          ]
        : [];
    for (const id of nightDead) dead.add(id);
    if (nightDead.includes(model)) converted = transformed;
    add(
      day,
      [...new Set(nightDead)].sort((a, b) => a - b),
      "last_words",
      { name: "speak", args: { text: "Night last words" } },
    );
    if (nightDead.includes(hunter)) {
      add(day, [hunter], "hunter_shot", {
        name: "shoot",
        args: { target_id: kind === "hunter_chain" ? child : null },
      });
      if (kind === "hunter_chain") dead.add(child);
    }
    const alive = ids.filter((id) => !dead.has(id));
    add(day, alive, "day_speech", { name: "speak", args: { text: "Raw speech" } });
    if (kind === "self_destruct") {
      const candidates = originalWolves.filter((id) => !dead.has(id)).sort((a, b) => a - b);
      if (day === 1) {
        add(day, candidates, ActionWindow.OnPreVote, (id) =>
          id === model
            ? { name: "self_destruct", args: { reason: "Raw blast", confirm: true } }
            : null,
        );
        dead.add(model);
        converted = true;
        day++;
        continue;
      }
      add(day, candidates, ActionWindow.OnPreVote, null);
    }
    const target =
      originalWolves.find((id) => !dead.has(id)) ??
      (converted && !dead.has(child) ? child : undefined);
    if (target === undefined) throw new Error("fixture_unexpected_early_end");
    add(day, alive, "voting", (id) => ({
      name: "vote",
      args: { target_id: id === target ? null : target, abstain: id === target },
    }));
    add(day, [target], "last_words", { name: "speak", args: { text: "Raw exile" } });
    dead.add(target);
    if (target === model) converted = transformed;
    if (!originalWolves.some((id) => !dead.has(id)) && (!converted || dead.has(child))) break;
    day++;
  }
  for (const [id, rows] of turns)
    for (const turn of rows) {
      let faction = roles[id - 1] === Role.Wolf ? Camp.Wolf : Camp.Good;
      if (
        id === child &&
        transformed &&
        (turn.day > 1 ||
          (turn.day === 1 &&
            ["good_knife", "poison", "hunter_chain"].includes(kind) &&
            ["day_speech", "voting"].includes(turn.stage)))
      )
        faction = Camp.Wolf;
      turn.requiredPromptMarkers = [
        text(locale, "ability.identity", {
          role: roleName(roles[id - 1]!, locale),
          camp: term("camp", faction, locale),
        }),
      ];
    }
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig(`wild_child_${size}_${kind}`, config)),
    seed,
    roles,
    turns,
    eventRoles: roles.map((role, id) => (role === Role.WildChild && active ? Role.Wolf : role)),
    actorId: child,
    modelId: model,
    transformed,
    active,
  };
}
