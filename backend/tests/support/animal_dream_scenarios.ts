import { bootstrapGame } from "../../src/app/bootstrap";
import { animalDreamTwelveConfig } from "../../src/runtime/scenarios/animal_dream_twelve";
import {
  Role,
  Camp,
  ActionWindow,
  createRandom,
  type ActionRequest,
  type ToolCall,
  type BoardConfig,
} from "../../src/core";
export const animalRoles = [
  Role.WolfBeauty,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];
export type AnimalPlan =
  "fox_beauty" | "cat_badge" | "puffer_knife" | "pk" | "last_chain" | "full_retaliation";
export function animalBoard(skip = false, first = false): BoardConfig {
  return {
    ...animalDreamTwelveConfig,
    whiteCat: {
      skippedVotePolicy: skip ? "awa_expire_on_skipped_day_v1" : "awa_wait_for_actual_exile_v1",
    },
    pufferfish: { ballotPolicy: first ? "awa_first_ballot_v1" : "awa_final_ballot_v1" },
  };
}
/** Literal old-seat plan; it uses the issued request only, never World or opponent truth. */
export function animalAction(r: ActionRequest, name: AnimalPlan, first = false): ToolCall | null {
  const d = r.context.day,
    has = (s: ToolCall["name"]) => r.allowedTools.includes(s);
  if (has("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } };
  if (has("fox_distract"))
    return { name: "fox_distract", args: { target_id: name === "fox_beauty" ? 1 : null } };
  if (has("charm"))
    return {
      name: "charm",
      args: {
        target_id:
          name === "fox_beauty"
            ? d === 4
              ? 7
              : 5
            : name === "last_chain"
              ? [7, 8, 6, 12][d - 1]!
              : name === "puffer_knife"
                ? 5
                : null,
      },
    };
  if (has("kill_vote")) {
    const target =
      name === "fox_beauty"
        ? d === 3
          ? 6
          : d === 4
            ? 8
            : null
        : name === "cat_badge"
          ? [9, 6, 7, 8][d - 1]!
          : name === "puffer_knife"
            ? [12, 10, 9, 8][d - 1]!
            : name === "pk"
              ? [null, 5, 6, 9, 10][d - 1]!
              : name === "last_chain"
                ? [9, 10, 11, null][d - 1]!
                : null;
    return { name: "kill_vote", args: { target_id: target, abstain: target === null } };
  }
  if (has("run_for_sheriff"))
    return {
      name: "run_for_sheriff",
      args: { run: r.actorId === (name === "cat_badge" ? 9 : name === "puffer_knife" ? 12 : -1) },
    };
  if (has("vote_for_sheriff"))
    return {
      name: "vote_for_sheriff",
      args: { target_id: name === "cat_badge" ? 9 : 12, abstain: false },
    };
  if (has("choose_direction"))
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (has("choose_badge_successor"))
    return { name: "choose_badge_successor", args: { target_id: 5 } };
  if (has("speak"))
    return { name: "speak", args: { text: `Literal ${r.context.stage} seat ${r.actorId}` } };
  if (has("self_destruct"))
    return name === "cat_badge" &&
      d === 1 &&
      r.actorId === 2 &&
      r.actionWindow === ActionWindow.OnPreVote
      ? { name: "self_destruct", args: { confirm: true, reason: "Literal skipped vote" } }
      : null;
  if (has("puffer_retaliate")) return { name: "puffer_retaliate", args: { activate: true } };
  if (has("vote")) {
    let target: number | null =
      name === "fox_beauty" || name === "last_chain"
        ? d === 4
          ? 1
          : d + 1
        : name === "cat_badge"
          ? d === 4
            ? 1
            : d + 1
          : name === "puffer_knife"
            ? d
            : name === "full_retaliation"
              ? 12
              : d === 2
                ? 4
                : d === 3
                  ? 1
                  : d === 4
                    ? 2
                    : 3;
    if (name === "pk" && d === 1)
      target =
        r.context.round === 2
          ? null
          : [2, 3].includes(r.actorId)
            ? 12
            : [4, 5].includes(r.actorId)
              ? 6
              : null;
    if (name === "last_chain" && d === 4 && r.actorId === 1) target = 12;
    return { name: "vote", args: { target_id: target, abstain: target === null } };
  }
  throw Error("animal_unplanned_tool:" + r.context.stage);
}
export function animalGolden(name: AnimalPlan, skip = false, first = false) {
  const g = {
    fox_beauty: {
      winner: Camp.Good,
      alive: [5, 9, 10, 11, 12],
      night: [[], [], [6], [8]],
      days: 4,
    },
    cat_badge: { winner: Camp.Good, alive: [5, 10, 11, 12], night: [[], [6], [7], [8]], days: 4 },
    puffer_knife: {
      winner: Camp.Good,
      alive: [5, 6, 7, 11],
      night: [[12], [10], [], [8]],
      days: 4,
    },
    pk: first
      ? { winner: Camp.Good, alive: [7, 8, 9, 10, 11, 12], night: [[], [5], [6]], days: 3 }
      : { winner: Camp.Good, alive: [7, 8, 11, 12], night: [[], [5], [6], [], [10]], days: 5 },
    last_chain: { winner: Camp.Wolf, alive: [5, 6, 7, 8], night: [[], [10], [11], []], days: 4 },
    full_retaliation: { winner: Camp.Wolf, alive: [9], night: [[]], days: 1 },
  };
  return g[name];
}
export function animalGame(locale: "zh-CN" | "en" = "zh-CN", skip = false, first = false) {
  return bootstrapGame(animalBoard(skip, first), {
    fixedRoles: animalRoles,
    locale,
    random: createRandom("animal-literal-v1"),
  });
}
