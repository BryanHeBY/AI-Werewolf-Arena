/**
 * Builds original bear test input plans, fixed boards and explicit player/marker data. Inputs are supplied
 * variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured identities.
 * Existing dealing may construct input identities, while handwritten expected outcomes remain supplied
 * data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/core";
import { ActionWindow } from "../../../../../src/core";
import { Role } from "../../../../../src/core";
import { WinCondition } from "../../../../../src/core";
import type { BoardConfig } from "../../../../../src/core";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../../src/runtime/scenarios/six_player_mvp";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const BEAR_CASES = [
  "positive",
  "quiet",
  "neighbor_dead",
  "neighbor_update",
  "knife",
  PotionType.Poison,
  "dream",
  "charm",
  "night_shot",
  "king_badge",
  "early_white",
  "day_dead",
  "twelve",
] as const;

export type BearScenario = (typeof BEAR_CASES)[number];

export function bearScenario(kind: BearScenario): TransportGameScenario {
  const twelve = kind === "twelve",
    king = kind === "king_badge",
    early = kind === "early_white";
  const roles = twelve
    ? [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Bear,
        Role.Witch,
        Role.Hunter,
        Role.Guard,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : king
      ? [Role.Bear, Role.WolfKing, Role.Villager, Role.Villager, Role.Villager, Role.Villager]
      : early
        ? [Role.Bear, Role.WhiteWolfKing, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager]
        : kind === "neighbor_update"
          ? [Role.Bear, Role.Wolf, Role.Witch, Role.Wolf, Role.Hunter, Role.Villager]
          : kind === "quiet"
            ? [Role.Bear, Role.Witch, Role.Wolf, Role.Hunter, Role.Villager, Role.Villager]
            : [
                Role.Bear,
                kind === "charm" ? Role.WolfBeauty : Role.Wolf,
                Role.Witch,
                kind === "dream" ? Role.Dreamer : Role.Hunter,
                Role.Villager,
                Role.Villager,
              ];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    enableSheriff: twelve || king || early,
    winConditions: [WinCondition.SlaughterSide],
    hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
    selfDestruct: { enabledWindows: early ? [ActionWindow.OnPreElection] : [] },
    ...(king ? { initialSheriffSeat: 1 } : {}),
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, index) => [index + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
  const night = (day: number, actors: number[], target: number | null) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: target === null },
    });
  };
  const potion = (day: number, actor: number, target: number, type: PotionType = PotionType.None) =>
    add(day, [actor], "witch", {
      name: "use_potion",
      args: { target_id: target, potion_type: type },
    });
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number | null) =>
    add(day, actors, "voting", {
      name: "vote",
      args: { target_id: target, abstain: target === null },
    });
  const words = (day: number, actors: number[], beforeDawn = false) => {
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
    if (day === 1 && beforeDawn)
      for (const actor of actors)
        turns.get(actor)!.at(-1)!.forbiddenPromptMarkers = ["bear_roared"];
  };
  if (twelve) {
    add(1, [8], "guard", { name: "guard", args: { target_id: 10, abstain: false } });
    night(1, [1, 2, 3, 4], 9);
    potion(1, 6, 9, PotionType.Heal);
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    all.forEach((actor) =>
      add(1, [actor], "sheriff_nomination", {
        name: "run_for_sheriff",
        args: { run: actor === 5 || actor === 10 },
      }),
    );
    add(1, [5, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [5], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [10], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: false } });
    add(
      1,
      all.filter((id) => id !== 5),
      "sheriff_vote",
      { name: "vote_for_sheriff", args: { target_id: 5, abstain: false } },
    );
    add(1, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    speech(1, all);
    vote(1, all, 4);
    words(1, [4]);
    add(2, [8], "guard", { name: "guard", args: { target_id: 11, abstain: false } });
    night(2, [1, 2, 3], 7);
    potion(2, 6, 3, PotionType.Poison);
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
    add(2, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive = [1, 5, 6, 8, 9, 10, 11, 12];
    speech(2, alive);
    vote(2, alive, 1);
    words(2, [1]);
  } else if (king) {
    night(1, [2], 2);
    words(1, [2], true);
    add(1, [2], "death_shot", { name: "shoot", args: { target_id: 1 } });
  } else if (early) {
    night(1, [2, 3], 6);
    potion(1, 4, 4);
    add(1, [2], ActionWindow.OnPreElection, {
      name: "self_destruct_with_target",
      args: { target_id: 1, confirm: true, reason: "Public blast" },
    });
    add(1, [3], ActionWindow.OnPreElection, null);
    words(1, [6], true);
  } else if (kind === "neighbor_update") {
    night(1, [2, 4], 2);
    potion(1, 3, 3);
    words(1, [2], true);
    speech(1, [1, 3, 4, 5, 6]);
    vote(1, [1, 3, 4, 5, 6], null);
    night(2, [4], 5);
    potion(2, 3, 3);
    add(2, [5], "hunter_shot", { name: "shoot", args: { target_id: 4 } });
  } else if (kind === "day_dead") {
    night(1, [2], null);
    potion(1, 3, 3);
    speech(1, [1, 2, 3, 4, 5, 6]);
    vote(1, [1, 2, 3, 4, 5, 6], 1);
    words(1, [1]);
    night(2, [2], 6);
    potion(2, 3, 3);
    speech(2, [2, 3, 4, 5]);
    vote(2, [2, 3, 4, 5], 2);
    words(2, [2]);
  } else {
    if (kind === "dream") add(1, [4], "dreamer", { name: "dream", args: { target_id: 1 } });
    const wolf = kind === "quiet" ? 3 : 2,
      witch = kind === "quiet" ? 2 : 3;
    night(
      1,
      [wolf],
      kind === "neighbor_dead"
        ? 2
        : kind === "knife"
          ? 1
          : kind === "dream" || kind === "night_shot"
            ? 4
            : kind === PotionType.Poison
              ? null
              : 6,
    );
    if (kind === "charm") add(1, [2], "wolf_beauty", { name: "charm", args: { target_id: 1 } });
    potion(
      1,
      witch,
      kind === PotionType.Poison ? 1 : kind === "charm" ? 2 : witch,
      kind === PotionType.Poison || kind === "charm" ? PotionType.Poison : PotionType.None,
    );
    words(
      1,
      kind === "neighbor_dead"
        ? [2]
        : kind === "knife" || kind === PotionType.Poison
          ? [1]
          : kind === "dream"
            ? [4, 1]
            : kind === "charm"
              ? [2, 6]
              : kind === "night_shot"
                ? [4]
                : [6],
      true,
    );
    if (kind === "night_shot")
      add(1, [4], "hunter_shot", { name: "shoot", args: { target_id: 1 } });
    if (kind !== "neighbor_dead" && kind !== "charm") {
      const alive =
        kind === "knife" || kind === PotionType.Poison
          ? [2, 3, 4, 5, 6]
          : kind === "dream" || kind === "night_shot"
            ? [2, 3, 5, 6]
            : [1, 2, 3, 4, 5];
      speech(1, alive);
      vote(1, alive, wolf);
      words(1, [wolf]);
    }
  }
  const bear = twelve ? 5 : 1;
  for (const [actor, plan] of turns)
    for (const turn of plan) {
      const preDawn =
        turn.day === 1 &&
        !["day_speech", "voting", "last_words", "sheriff_choose_direction"].includes(turn.stage);
      if (preDawn) turn.forbiddenPromptMarkers = ["bear_roared"];
      if (actor === bear) {
        const before =
          (turn.stage.startsWith("sheriff_") && turn.stage !== "sheriff_choose_direction") ||
          (turn.stage === "last_words" && kind !== "day_dead");
        turn.bearLatest = before
          ? null
          : {
              day: turn.day,
              roared:
                kind !== "knife" &&
                kind !== PotionType.Poison &&
                kind !== "dream" &&
                kind !== "charm" &&
                kind !== "night_shot" &&
                kind !== "quiet",
            };
      }
    }
  const family = twelve
      ? "twelve"
      : king
        ? "king"
        : early
          ? "white"
          : kind === "dream"
            ? "dream"
            : kind === "charm"
              ? "beauty"
              : kind === "neighbor_update"
                ? "update"
                : "basic",
    seeds = {
      twelve: "bear-twelve:812583",
      king: "bear-king:69",
      white: "bear-white:1224",
      dream: "bear-dream:154",
      beauty: "bear-beauty:133",
      update: "bear-update:937",
      basic: "bear-basic:117",
    };
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${twelve ? "twelve" : "six"}_player_bear_${kind}`, config),
    ),
    roles,
    turns,
    seed: seeds[family],
    promptAssertions: (actor, locale) =>
      actor === bear
        ? {
            expectedIdentityMarker: locale === "en" ? "your true role is Bear." : "真实身份是熊。",
            requiredCurrentMarkers: [locale === "en" ? "Your role is Bear," : "你的底牌是【熊】"],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Latest public announcement:" : "最近公开公告：",
            ],
          },
  };
}
