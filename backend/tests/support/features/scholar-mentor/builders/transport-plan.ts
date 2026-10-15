/**
 * Builds original scholar-mentor test input plans, fixed boards and explicit player/marker data. Inputs are
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
import { scholarMentorTwelveConfig } from "../../../../../src/runtime/scenarios/scholar_mentor_twelve";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function scholarMentorScenario(
  variant: "enhance" | "same-good" | "both-wolves" | "early-heal" = "enhance",
): TransportGameScenario & {
  scholar: number;
  mentor: number;
  seer: number;
  knifeActor: number;
  winner: Camp;
  alive: number[];
} {
  const enhanced = variant === "enhance" || variant === "early-heal";
  const config = structuredClone(scholarMentorTwelveConfig),
    seed = "scholar-mentor-transport";
  const roles = shuffled(
    config.roleSetups.flatMap((row) => Array.from({ length: row.count }, () => row.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (role: Role) => roles.indexOf(role) + 1;
  const scholar = id(Role.DayScholar),
    mentor = id(Role.NightMentor),
    seer = id(Role.Seer),
    guard = id(Role.Guard),
    witch = id(Role.Witch);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    wolves = [...ordinary, mentor].sort((a, b) => a - b),
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
    add(
      day,
      actors.filter((i) => i !== mentor),
      "wolf_discussion",
      { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
    );
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  };
  const dayVote = (day: number, alive: number[], target: number) => {
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      ordinary.filter((i) => alive.includes(i)),
      ActionWindow.OnPreVote,
      null,
    );
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === target ? null : target, abstain: actor === target },
    }));
    words(day, [target]);
  };
  add(1, [guard], "guard", { name: "guard", args: { target_id: villagers[3]!, abstain: false } });
  pack(1, ordinary, villagers[0]!);
  add(1, [witch], "witch", {
    name: "use_potion",
    args: {
      target_id: variant === "both-wolves" ? witch : ordinary[0]!,
      potion_type: variant === "both-wolves" ? PotionType.None : PotionType.Poison,
    },
  });
  add(1, [seer], "seer", { name: "check_identity", args: { target_id: mentor } });
  add(1, ordinary, ActionWindow.OnPreElection, null);
  add(1, ids, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
  words(1, variant === "both-wolves" ? [villagers[0]!] : [villagers[0]!, ordinary[0]!]);
  let alive = ids.filter(
    (i) => i !== villagers[0] && (variant === "both-wolves" || i !== ordinary[0]),
  );
  dayVote(1, alive, ordinary[1]!);
  alive = alive.filter((i) => i !== ordinary[1]);
  add(2, [scholar], "scholar_mentor_choice", {
    name: "modify_skill",
    args: { mode: "enhance", target_id: variant === "both-wolves" ? ordinary[0]! : seer },
  });
  add(2, [mentor], "scholar_mentor_choice", {
    name: "modify_skill",
    args: { mode: "enhance", target_id: variant === "same-good" ? seer : ordinary[2]! },
  });
  add(2, [guard], "guard", { name: "guard", args: { target_id: villagers[1]!, abstain: false } });
  pack(
    2,
    ordinary.filter((id) => alive.includes(id)),
    villagers[1]!,
  );
  if (enhanced)
    add(2, [ordinary[2]!], "scholar_mentor_bonus", {
      name: "bonus_action",
      args: { kind: "kill", target_id: villagers[2]!, abstain: false },
    });
  add(2, [witch], "witch", {
    name: "use_potion",
    args: {
      target_id: variant === "early-heal" ? villagers[2]! : witch,
      potion_type: variant === "early-heal" ? PotionType.Heal : PotionType.None,
    },
  });
  add(2, [seer], "seer", { name: "check_identity", args: { target_id: mentor } });
  if (enhanced)
    add(2, [seer], "scholar_mentor_bonus", {
      name: "bonus_action",
      args: { kind: "check", target_id: ordinary[2]!, abstain: false },
    });
  alive = alive.filter(
    (i) =>
      variant === "early-heal" ||
      i !== (enhanced ? villagers[2] : variant === "same-good" ? seer : mentor),
  );
  dayVote(2, alive, ordinary[2]!);
  alive = alive.filter((i) => i !== ordinary[2]);
  add(3, [scholar], "scholar_mentor_choice", {
    name: "modify_skill",
    args: { mode: "weaken", target_id: guard },
  });
  if (alive.includes(mentor))
    add(3, [mentor], "scholar_mentor_choice", {
      name: "modify_skill",
      args: { mode: "weaken", target_id: witch },
    });
  pack(
    3,
    wolves.filter((id) => alive.includes(id)),
    villagers[3]!,
  );
  add(3, [witch], "witch", {
    name: "use_potion",
    args: {
      target_id: variant === "early-heal" ? witch : villagers[3]!,
      potion_type: variant === "early-heal" ? PotionType.None : PotionType.Heal,
    },
  });
  if (alive.includes(seer))
    add(3, [seer], "seer", {
      name: "check_identity",
      args: { target_id: variant === "both-wolves" ? ordinary[0]! : mentor },
    });
  if (variant === "early-heal") alive = alive.filter((i) => i !== villagers[3]);
  const lastWolf = variant === "both-wolves" ? ordinary[0]! : mentor;
  dayVote(3, alive, lastWolf);
  alive = alive.filter((i) => i !== lastWolf);
  for (const actor of wolves)
    for (const turn of turns.get(actor)!)
      turn.currentTeammateIds = actor === mentor ? [] : wolves.filter((i) => i !== actor);
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig("scholar_mentor_transport_" + variant, config),
    ),
    promptAssertions: (_actor, locale) => ({
      requiredSystemMarkers:
        locale === "en"
          ? [
              "apply immunity before conflicts",
              "Both casters are immune",
              "Villagers have no skill",
              "Seer one extra inspection",
              "Guard one extra guard",
              "one independent bonus poison",
              "one individual extra knife",
              "blocks only poison and preserves heal",
              "blocks the entire pack knife",
              "still spends its charge",
              "cancel both effects and cause death at dawn",
              "kill the Mentor at dawn",
              "does not overwrite native previous-target history",
            ]
          : [
              "先判定免疫再判定冲突",
              "两名施法者均免疫",
              "村民没有可增减的技能",
              "增强预言家增加一次查验",
              "增强守卫增加一次守护",
              "独立额外毒药",
              "该狼人独自追加一刀",
              "只禁毒药，保留解药",
              "封锁全队本夜狼刀",
              "合法施法仍消耗次数",
              "两效果取消但原生行动照常",
              "导师黎明死亡",
              "也不改写该历史",
            ],
    }),
    seed,
    roles,
    turns,
    scholar,
    mentor,
    seer,
    knifeActor: ordinary[2]!,
    winner: Camp.Good,
    alive,
  };
}
