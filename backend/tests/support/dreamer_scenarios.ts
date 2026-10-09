import { Role, WinCondition, PotionType } from "../../src/core";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/runtime/scenarios/twelve_player_standard";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export const DREAMER_CASES = [
  "protected",
  "knife_link",
  "saved",
  "poison_link",
  "gun_blocked",
  "gun_link",
  "consecutive",
  "king_repeat",
  "twelve",
] as const;
export type DreamerScenario = (typeof DREAMER_CASES)[number];
export function dreamerScenario(kind: DreamerScenario): TransportGameScenario {
  const twelve = kind === "twelve",
    roles = twelve
      ? [
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Dreamer,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ]
      : [
          Role.Dreamer,
          kind === "king_repeat" ? Role.WolfKing : Role.Wolf,
          Role.Witch,
          Role.Hunter,
          Role.Villager,
          Role.Villager,
        ];
  const counts = [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((item) => item === role).length,
    })),
    base = twelve ? twelvePlayerStandardConfig : sixPlayerMvpConfig;
  const config = {
    ...base,
    roleSetups: twelve
      ? base.roleSetups.map((row) =>
          row.role === Role.Idiot ? { role: Role.Dreamer, count: 1 } : row,
        )
      : counts,
    winConditions: [WinCondition.SlaughterSide],
    selfDestruct: { enabledWindows: [] },
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, index) => [index + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
  const night = (day: number, wolves: number[], target: number | null) => {
    add(day, wolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, wolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: target === null },
    });
  };
  const dream = (day: number, actor: number, target: number) => {
    add(day, [actor], "dreamer", { name: "dream", args: { target_id: target } });
    if (day === 1) {
      const turn = turns.get(actor)!.at(-1)!;
      turn.invalidActions = [{ name: "dream", args: { target_id: 999 } }];
      turn.expectedInvalidError = "dream_target";
    }
  };
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number | null) =>
    add(day, actors, "voting", {
      name: "vote",
      args: { target_id: target, abstain: target === null },
    });
  const words = (day: number, actor: number) =>
    add(day, [actor], "last_words", { name: "speak", args: { text: "Authorized last words" } });
  if (twelve) {
    dream(1, 8, 10);
    night(1, [1, 2, 3, 4], 9);
    add(1, [6], "witch", {
      name: "use_potion",
      args: { target_id: 9, potion_type: PotionType.Heal },
    });
    add(1, [5], "seer", { name: "check_identity", args: { target_id: 1 } });
    for (let actor = 1; actor <= 12; actor++)
      add(1, [actor], "sheriff_nomination", {
        name: "run_for_sheriff",
        args: { run: actor === 8 || actor === 10 },
      });
    add(1, [8, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [8], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [10], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: false } });
    add(1, [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12], "sheriff_vote", {
      name: "vote_for_sheriff",
      args: { target_id: 8, abstain: false },
    });
    add(1, [8], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    speech(1, all);
    vote(1, all, 1);
    words(1, 1);
    dream(2, 8, 2);
    night(2, [2, 3, 4], 7);
    add(2, [6], "witch", {
      name: "use_potion",
      args: { target_id: 4, potion_type: PotionType.Poison },
    });
    add(2, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
    add(2, [8], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive2 = [2, 5, 6, 8, 9, 10, 11, 12];
    speech(2, alive2);
    vote(2, alive2, 5);
    words(2, 5);
    dream(3, 8, 2);
    night(3, [2], 9);
    add(3, [6], "witch", {
      name: "use_potion",
      args: { target_id: 6, potion_type: PotionType.None },
    });
  } else {
    const repeated = kind === "consecutive" || kind === "king_repeat";
    const target = kind === "king_repeat" ? 2 : kind === "poison_link" ? 4 : 5;
    dream(1, 1, target);
    night(
      1,
      [2],
      kind === "knife_link" || kind === "saved"
        ? 1
        : kind === "gun_blocked" || kind === "gun_link"
          ? 4
          : kind === "protected"
            ? 5
            : null,
    );
    add(1, [3], "witch", {
      name: "use_potion",
      args: {
        target_id: kind === "saved" || kind === "poison_link" ? 1 : kind === "protected" ? 5 : 3,
        potion_type:
          kind === "saved"
            ? PotionType.Heal
            : kind === "protected" || kind === "poison_link"
              ? PotionType.Poison
              : PotionType.None,
      },
    });
    if (kind === "knife_link") {
      words(1, 1);
      words(1, 5);
    }
    if (kind === "poison_link") {
      words(1, 1);
      words(1, 4);
    }
    if (kind === "gun_blocked" || kind === "gun_link") {
      words(1, 4);
      add(1, [4], "hunter_shot", {
        name: "shoot",
        args: { target_id: kind === "gun_link" ? 1 : 5 },
      });
    }
    const alive =
      kind === "knife_link"
        ? [2, 3, 4, 6]
        : kind === "poison_link"
          ? [2, 3, 5, 6]
          : kind === "gun_blocked"
            ? [1, 2, 3, 5, 6]
            : kind === "gun_link"
              ? [2, 3, 6]
              : [1, 2, 3, 4, 5, 6];
    speech(1, alive);
    vote(1, alive, repeated ? null : 2);
    if (!repeated) words(1, 2);
    if (repeated) {
      dream(2, 1, target);
      night(2, [2], kind === "consecutive" ? 5 : null);
      add(2, [3], "witch", {
        name: "use_potion",
        args: {
          target_id: kind === "consecutive" ? 5 : 3,
          potion_type: kind === "consecutive" ? PotionType.Heal : PotionType.None,
        },
      });
      if (kind === "consecutive") {
        speech(2, [1, 2, 3, 4, 6]);
        vote(2, [1, 2, 3, 4, 6], 2);
        words(2, 2);
      }
    }
  }
  const actor = twelve ? 8 : 1;
  let latest: PlannedTurn["dreamLatest"] = null;
  for (const turn of turns.get(actor)!) {
    turn.dreamLatest = latest;
    if (turn.action?.name === "dream")
      latest = { day: turn.day, targetId: turn.action.args.target_id };
  }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        twelve ? "twelve_player_dreamer" : `six_player_dreamer_${kind}`,
        config,
      ),
    ),
    roles,
    turns,
    seed: twelve ? "foundation-twelve:124680" : "dream-six:1462",
    promptAssertions: (id, locale) =>
      id === actor
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Dreamer." : "真实身份是摄梦人。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Dreamer," : "你的底牌是【摄梦人】",
            ],
          }
        : {
            forbiddenCurrentMarkers: [locale === "en" ? "Latest dream choice:" : "最近梦游选择："],
          },
  };
}
