import {
  Role,
  WinCondition,
  PotionType,
  type BoardConfig,
  type ToolCall,
  type ActionStage,
} from "../../src/core";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export const FOX_CASES = [
  "knife",
  "inspection",
  "poison_inspection",
  "dream",
  "mirror",
  "lucky",
  "fox_lucky",
  "king_chain",
] as const;
export type FoxCase = (typeof FOX_CASES)[number];
export function foxBoard(roles: readonly Role[]): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    enableSheriff: false,
    selfDestruct: { enabledWindows: [] },
  };
}
export function foxScenario(kind: FoxCase): TransportGameScenario {
  const roles = [
    Role.CursedFox,
    kind === "mirror"
      ? Role.MirrorGirl
      : ["lucky", "fox_lucky"].includes(kind)
        ? Role.MiracleMerchant
        : Role.Seer,
    kind === "king_chain" ? Role.WolfKing : Role.Wolf,
    Role.Witch,
    kind === "dream" ? Role.Dreamer : Role.Guard,
    Role.Villager,
  ];
  const turns = new Map<number, PlannedTurn[]>(Array.from({ length: 6 }, (_, i) => [i + 1, []]));
  const add = (actors: number[], stage: ActionStage, action: ToolCall | null) => {
    for (const id of actors) turns.get(id)!.push({ day: 1, stage, action });
  };
  if (["lucky", "fox_lucky"].includes(kind))
    add([2], "miracle_merchant", {
      name: "bestow_ability",
      args: { target_id: kind === "fox_lucky" ? 1 : 6, skill: "check" },
    });
  if (kind === "dream") add([5], "dreamer", { name: "dream", args: { target_id: 1 } });
  else add([5], "guard", { name: "guard", args: { target_id: 6, abstain: false } });
  add([3], "wolf_discussion", { name: "speak_to_wolves", args: { text: "Done", end_chat: true } });
  add([3], "wolf_vote", {
    name: "kill_vote",
    args: { target_id: kind === "knife" ? 1 : null, abstain: kind !== "knife" },
  });
  add([4], "witch", {
    name: "use_potion",
    args: {
      target_id: kind === "poison_inspection" ? 1 : 4,
      potion_type: kind === "poison_inspection" ? PotionType.Poison : PotionType.None,
    },
  });
  if (["lucky", "fox_lucky"].includes(kind))
    add([kind === "fox_lucky" ? 1 : 6], "lucky", {
      name: "check_identity",
      args: { target_id: kind === "fox_lucky" ? 3 : 1 },
    });
  else if (kind === "mirror")
    add([2], "mirror_girl", { name: "inspect_role", args: { target_id: 1 } });
  else
    add([2], "seer", {
      name: "check_identity",
      args: { target_id: ["inspection", "poison_inspection", "dream"].includes(kind) ? 1 : 6 },
    });
  const dead = ["inspection", "poison_inspection", "lucky"].includes(kind);
  if (dead) add([1], "last_words", { name: "speak", args: { text: "Last" } });
  const alive = dead ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  for (const id of alive) add([id], "day_speech", { name: "speak", args: { text: "Speech" } });
  add(alive, "voting", { name: "vote", args: { target_id: 3, abstain: false } });
  add([3], "last_words", { name: "speak", args: { text: "Wolf last" } });
  if (kind === "king_chain") add([3], "death_shot", { name: "shoot", args: { target_id: 1 } });
  const seeds: Record<FoxCase, string> = {
    knife: "fox-knife:686",
    inspection: "fox-inspection:343",
    poison_inspection: "fox-inspection:343",
    dream: "fox-dream:65",
    mirror: "fox-mirror:2146",
    lucky: "fox-lucky:753",
    fox_lucky: "fox-lucky:753",
    king_chain: "fox-king_chain:541",
  };
  return {
    roles,
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`six_player_fox_${kind}`, foxBoard(roles)),
    ),
    turns,
    seed: seeds[kind],
    promptAssertions: (actor, locale) =>
      actor === 1
        ? {
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Cursed Fox." : "你的底牌是【咒狐】",
            ],
          }
        : {},
  };
}
