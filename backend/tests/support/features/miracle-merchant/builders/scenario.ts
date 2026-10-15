/**
 * Builds original miracle-merchant test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { WinCondition } from "../../../../../src/domain";
import type { BoardConfig } from "../../../../../src/domain";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../../src/runtime/scenarios/six_player_mvp";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const MERCHANT_CASES = [
  "check",
  PotionType.Poison,
  "guard",
  "hold",
  "late",
  "backlash",
  "dream",
  "hidden",
  "twelve",
] as const;

export type MerchantScenario = (typeof MERCHANT_CASES)[number];

export function merchantScenario(kind: MerchantScenario): TransportGameScenario {
  const large = kind === "twelve",
    guard = ["guard", "hold", "late", "hidden"].includes(kind),
    dream = kind === "dream",
    hidden = kind === "hidden";
  const roles = large
    ? [
        Role.WolfKing,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Seer,
        Role.Witch,
        Role.Guard,
        Role.MiracleMerchant,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : [
        Role.Wolf,
        hidden ? Role.HiddenWolf : Role.WolfKing,
        Role.MiracleMerchant,
        Role.Seer,
        dream ? Role.Dreamer : guard ? Role.Guard : Role.Witch,
        Role.Villager,
      ];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [large ? WinCondition.SlaughterSide : WinCondition.SlaughterCity],
    enableSheriff: large,
    selfDestruct: { enabledWindows: [] },
  };
  const rows = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []])),
    merchant = large ? 8 : 3;
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => rows.get(actor)!.push({ day, stage, action }));
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
  const knife = (day: number, actor: number, target: number) =>
    add(day, [actor], "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  const trade = (
    day: number,
    target: number | null,
    skill: "check" | PotionType.Poison | "guard" = "check",
  ) =>
    add(
      day,
      [merchant],
      "miracle_merchant",
      target === null ? null : { name: "bestow_ability", args: { target_id: target, skill } },
    );
  const check = (day: number, actor: number, target: number) =>
    add(day, [actor], "seer", { name: "check_identity", args: { target_id: target } });
  const guardAction = (day: number, actor: number, target: number) =>
    add(day, [actor], "guard", { name: "guard", args: { target_id: target, abstain: false } });
  const potion = (
    day: number,
    actor: number,
    target: number,
    potion_type: PotionType.Heal | PotionType.Poison | PotionType.None,
  ) => add(day, [actor], "witch", { name: "use_potion", args: { target_id: target, potion_type } });
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const vote = (day: number, actors: number[], target: number) => {
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
    words(day, [target]);
  };
  const lucky = (day: number, actor: number, action: PlannedTurn["action"]) =>
    add(day, [actor], "lucky", action);
  if (large) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    trade(1, 5);
    guardAction(1, 7, 10);
    pack(1, [1, 2, 3, 4], 9);
    potion(1, 6, 9, PotionType.Heal);
    check(1, 5, 1);
    lucky(1, 5, { name: "check_identity", args: { target_id: 2 } });
    const turn = rows.get(5)!.at(-1)!;
    turn.invalidActions = [{ name: "check_identity", args: { target_id: 1 } }];
    turn.expectedInvalidError = "lucky_target_repeat";
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
    vote(1, all, 4);
    guardAction(2, 7, 11);
    pack(2, [1, 2, 3], 9);
    potion(2, 6, 3, PotionType.Poison);
    check(2, 5, 1);
    add(2, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    vote(2, [1, 2, 5, 6, 7, 8, 10, 11, 12], 2);
    guardAction(3, 7, 10);
    pack(3, [1], 6);
    potion(3, 6, 6, PotionType.None);
    check(3, 5, 1);
    add(3, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    vote(3, [1, 5, 7, 8, 10, 11, 12], 1);
    add(3, [1], "death_shot", { name: "shoot", args: { target_id: 8 } });
  } else {
    trade(
      1,
      kind === "late"
        ? null
        : ["backlash", "dream"].includes(kind)
          ? 1
          : hidden
            ? 2
            : kind === "check"
              ? 4
              : kind === PotionType.Poison
                ? 5
                : kind === "guard"
                  ? 5
                  : 6,
      kind === PotionType.Poison || hidden
        ? PotionType.Poison
        : kind === "guard" || kind === "backlash"
          ? "guard"
          : "check",
    );
    if (guard) guardAction(1, 5, 6);
    if (dream) add(1, [5], "dreamer", { name: "dream", args: { target_id: 3 } });
    pack(1, hidden ? [1] : [1, 2], dream ? 3 : 6);
    if (!guard && !dream) potion(1, 5, 6, PotionType.Heal);
    check(1, 4, kind === PotionType.Poison || hidden ? 2 : 1);
    if (kind === "check") {
      lucky(1, 4, { name: "check_identity", args: { target_id: 2 } });
      const turn = rows.get(4)!.at(-1)!;
      turn.invalidActions = [{ name: "check_identity", args: { target_id: 1 } }];
      turn.expectedInvalidError = "lucky_target_repeat";
    }
    if (kind === PotionType.Poison)
      lucky(1, 5, { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } });
    if (kind === "guard") lucky(1, 5, { name: "guard", args: { target_id: 4, abstain: false } });
    if (kind === "hold") lucky(1, 6, null);
    if (kind === "backlash" || hidden) words(1, [3]);
    if (kind === PotionType.Poison) words(1, [1]);
    vote(
      1,
      kind === PotionType.Poison
        ? [2, 3, 4, 5, 6]
        : kind === "backlash" || hidden
          ? [1, 2, 4, 5, 6]
          : [1, 2, 3, 4, 5, 6],
      kind === PotionType.Poison ? 2 : 1,
    );
    if (kind === PotionType.Poison)
      add(1, [2], "death_shot", { name: "shoot", args: { target_id: 4 } });
    else {
      if (kind === "late") trade(2, 6, PotionType.Poison);
      if (guard) guardAction(2, 5, kind === "hold" ? 3 : kind === "late" || hidden ? 4 : 3);
      if (kind === "guard") {
        const turn = rows.get(5)!.at(-1)!;
        turn.invalidActions = [{ name: "guard", args: { target_id: 4, abstain: false } }];
        turn.expectedInvalidError = "lucky_target_repeat";
      }
      if (dream) add(2, [5], "dreamer", { name: "dream", args: { target_id: 4 } });
      if (hidden) knife(2, 2, 6);
      else
        pack(
          2,
          [2],
          kind === "check" || kind === "guard" || dream
            ? 6
            : kind === "hold" || kind === "backlash"
              ? 4
              : 5,
        );
      if (!guard && !dream)
        potion(
          2,
          5,
          kind === "backlash" ? 2 : 5,
          kind === "backlash" ? PotionType.Poison : PotionType.None,
        );
      check(2, 4, 2);
      if (kind === "hold") lucky(2, 6, { name: "check_identity", args: { target_id: 2 } });
      if (kind === "late")
        lucky(2, 6, { name: "use_potion", args: { target_id: 2, potion_type: PotionType.Poison } });
      if (kind !== "backlash" && kind !== "late") {
        const alive = hidden ? [2, 4, 5] : kind === "hold" ? [2, 3, 5, 6] : [2, 3, 4, 5];
        vote(2, alive, 2);
        if (!hidden)
          add(2, [2], "death_shot", {
            name: "shoot",
            args: { target_id: kind === "check" ? 4 : 5 },
          });
      }
    }
  }
  if (hidden)
    for (const turn of rows.get(2)!)
      turn.hiddenWolfStatus = {
        inherited: turn.day > 1,
        active: turn.day > 1 && turn.stage !== "last_words",
      };
  const wolves = large ? [1, 2, 3, 4] : hidden ? [1] : [1, 2],
    seeds = {
      witch: "merchant-witch:1155",
      guard: "merchant-guard:2746",
      dream: "merchant-dream:2293",
      hidden: "merchant-hidden:123",
      twelve: "merchant-twelve:2872156",
    };
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_merchant_${kind}`, config),
    ),
    seed: large
      ? seeds.twelve
      : hidden
        ? seeds.hidden
        : dream
          ? seeds.dream
          : guard
            ? seeds.guard
            : seeds.witch,
    roles,
    turns: rows,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds:
        hidden && actor === 2
          ? [1]
          : wolves.includes(actor)
            ? wolves.filter((id) => id !== actor)
            : [],
      ...(actor === merchant
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Miracle Merchant." : "真实身份是奇迹商人。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your true role is Miracle Merchant," : "你的真实身份是奇迹商人",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Your true role is Miracle Merchant," : "你的真实身份是奇迹商人",
            ],
          }),
    }),
  };
}
