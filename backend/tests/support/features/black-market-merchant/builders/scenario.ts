/**
 * Builds original black-market-merchant test input plans, fixed boards and explicit player/marker data.
 * Inputs are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and
 * configured identities. Existing dealing may construct input identities, while handwritten expected
 * outcomes remain supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { WinCondition } from "../../../../../src/domain";
import type { BoardConfig } from "../../../../../src/domain";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import { sixPlayerMvpConfig } from "../../../../../src/rulesets/presets/six-player-mvp";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const BLACK_CASES = [
  "check_cross",
  "check_duplicate",
  "poison_duplicate",
  "late_hold",
  "hidden_backlash",
  "seer_gun",
  "gun_poison",
  "gun_compound",
  "native_double",
  "native_pass",
  "last_wolf",
  "last_god",
  "twelve_gun",
  "twelve_backlash",
] as const;

export type BlackScenario = (typeof BLACK_CASES)[number];

const seeds = {
  a: "black-a:396",
  hidden: "black-hidden:1190",
  b: "black-b:1503",
  c: "black-c:79",
  twelve: "black-twelve:1041591",
};

export function blackMarketScenario(kind: BlackScenario): TransportGameScenario {
  const large = kind.startsWith("twelve"),
    c = ["native_pass", "last_wolf", "last_god"].includes(kind),
    b = kind === "native_double";
  const roles = large
    ? [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.WolfKing,
        Role.Seer,
        Role.Witch,
        Role.BlackMarketMerchant,
        Role.Dreamer,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : [
        Role.Wolf,
        kind === "hidden_backlash" ? Role.HiddenWolf : Role.Wolf,
        Role.BlackMarketMerchant,
        b || c ? Role.Hunter : Role.Seer,
        c ? Role.Villager : Role.Witch,
        Role.Villager,
      ];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: large,
    selfDestruct: { enabledWindows: [] },
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []]));
  const add = (
    day: number,
    ids: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => ids.forEach((id) => turns.get(id)!.push({ day, stage, action }));
  const trade = (
    day: number,
    target: number | null,
    skill: "check" | PotionType.Poison | "gun" = "check",
  ) =>
    add(
      day,
      [large ? 7 : 3],
      "black_market_merchant",
      target === null ? null : { name: "black_market_trade", args: { target_id: target, skill } },
    );
  const check = (day: number, actor: number, target: number, gifted = false) =>
    add(day, [actor], gifted ? "black_market_recipient" : "seer", {
      name: "check_identity",
      args: { target_id: target },
    });
  const potion = (
    day: number,
    actor: number,
    target: number,
    type: PotionType.None | PotionType.Heal | PotionType.Poison,
    gifted = false,
  ) =>
    add(day, [actor], gifted ? "black_market_recipient" : "witch", {
      name: "use_potion",
      args: { target_id: target, potion_type: type },
    });
  const knife = (day: number, ids: number[], target: number | null) =>
    add(day, ids, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: target === null },
    });
  const pack = (day: number, ids: number[], target: number | null) => {
    add(day, ids, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    knife(day, ids, target);
  };
  const words = (day: number, ids: number[]) =>
    add(day, ids, "last_words", { name: "speak", args: { text: "Original words" } });
  const shot = (day: number, actor: number, target: number | null, gifted = false) =>
    add(
      day,
      [actor],
      gifted ? "death_shot" : roles[actor - 1] === Role.Hunter ? "hunter_shot" : "death_shot",
      { name: "shoot", args: { target_id: target } },
    );
  const day = (n: number, ids: number[], target: number | null, sheriff?: number) => {
    if (sheriff)
      add(n, [sheriff], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
    add(n, ids, "day_speech", { name: "speak", args: { text: "Public evidence only" } });
    add(n, ids, "voting", { name: "vote", args: { target_id: target, abstain: target === null } });
    if (target !== null) words(n, [target]);
  };
  const invalid = (actor: number, action: NonNullable<PlannedTurn["action"]>) => {
    const row = turns.get(actor)!.at(-1)!;
    row.invalidActions = [action];
    row.expectedInvalidError = "lucky_target_repeat";
  };
  if (large) {
    trade(1, kind === "twelve_gun" ? 9 : 1, kind === "twelve_gun" ? "gun" : "check");
    add(1, [8], "dreamer", { name: "dream", args: { target_id: kind === "twelve_gun" ? 10 : 7 } });
    pack(1, [1, 2, 3, 4], kind === "twelve_gun" ? 9 : 7);
    potion(1, 6, kind === "twelve_gun" ? 9 : 7, PotionType.Heal);
    check(1, 5, 1);
    for (let i = 1; i <= 12; i++)
      add(1, [i], "sheriff_nomination", {
        name: "run_for_sheriff",
        args: { run: i === 7 || i === 10 },
      });
    add(1, [7, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [7], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [10], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: false } });
    add(
      1,
      Array.from({ length: 12 }, (_, i) => i + 1).filter((id) => id !== 7),
      "sheriff_vote",
      { name: "vote_for_sheriff", args: { target_id: 7, abstain: false } },
    );
    if (kind === "twelve_gun") {
      day(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3, 7);
      add(2, [8], "dreamer", { name: "dream", args: { target_id: 11 } });
      pack(2, [1, 2, 4], 9);
      potion(2, 6, 7, PotionType.Poison);
      check(2, 5, 2);
      shot(2, 9, 2, true);
      day(2, [1, 4, 5, 6, 8, 10, 11, 12], 4, 1);
      shot(2, 4, 1);
    } else {
      words(1, [7]);
      day(1, [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12], 4, 1);
      shot(1, 4, 2);
      add(2, [8], "dreamer", { name: "dream", args: { target_id: 9 } });
      pack(2, [1, 3], 5);
      potion(2, 6, 3, PotionType.Poison);
      check(2, 5, 1);
      day(2, [1, 6, 8, 9, 10, 11, 12], 1, 1);
    }
  } else if (["native_double", "native_pass", "last_wolf", "last_god"].includes(kind)) {
    trade(1, 4, "gun");
    pack(1, [1, 2], kind === "last_wolf" ? 3 : kind === "last_god" ? 5 : 4);
    if (b) potion(1, 5, 5, PotionType.None);
    if (kind === "native_double") {
      words(1, [4]);
      shot(1, 4, 1);
      shot(1, 4, 2, true);
    } else if (kind === "native_pass") {
      words(1, [4]);
      shot(1, 4, null);
      shot(1, 4, 1, true);
      day(1, [2, 3, 5, 6], 2);
    } else {
      words(1, [kind === "last_wolf" ? 3 : 5]);
      day(1, kind === "last_wolf" ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 6], 2);
      pack(2, [1], 4);
      shot(2, 4, kind === "last_wolf" ? 1 : 3);
      shot(2, 4, kind === "last_wolf" ? 5 : 1, true);
    }
  } else if (kind.startsWith("gun_") || kind === "seer_gun") {
    trade(1, 4, "gun");
    pack(1, [1, 2], kind === "gun_poison" ? null : 4);
    potion(
      1,
      5,
      kind === "seer_gun" ? 5 : 4,
      kind === "seer_gun" ? PotionType.None : PotionType.Poison,
    );
    check(1, 4, 1);
    words(1, [4]);
    if (kind === "seer_gun") {
      shot(1, 4, 1, true);
      day(1, [2, 3, 5, 6], 2);
    } else {
      day(1, [1, 2, 3, 5, 6], 1);
      pack(2, [2], 3);
      potion(2, 5, 5, PotionType.None);
      day(2, [2, 5, 6], 2);
    }
  } else if (kind === "hidden_backlash") {
    trade(1, 2);
    pack(1, [1], 3);
    potion(1, 5, 3, PotionType.Heal);
    check(1, 4, 2);
    words(1, [3]);
    day(1, [1, 2, 4, 5, 6], 1);
    knife(2, [2], 4);
    potion(2, 5, 5, PotionType.None);
    check(2, 4, 2);
    day(2, [2, 5, 6], 2);
  } else if (kind === "late_hold") {
    trade(1, null);
    pack(1, [1, 2], 6);
    potion(1, 5, 6, PotionType.Heal);
    check(1, 4, 1);
    day(1, [1, 2, 3, 4, 5, 6], 1);
    trade(2, 6, PotionType.Poison);
    pack(2, [2], 4);
    potion(2, 5, 5, PotionType.None);
    check(2, 4, 2);
    day(2, [2, 3, 5, 6], null);
    potion(3, 6, 6, PotionType.None, true);
    pack(3, [2], 3);
    potion(3, 5, 5, PotionType.None);
    day(3, [2, 5, 6], null);
    potion(4, 6, 2, PotionType.Poison, true);
    pack(4, [2], 5);
    potion(4, 5, 5, PotionType.None);
  } else {
    const recipient = kind === "check_cross" ? 6 : kind === "check_duplicate" ? 4 : 5;
    trade(1, recipient, kind === "poison_duplicate" ? PotionType.Poison : "check");
    pack(1, [1, 2], kind === "check_duplicate" ? 6 : 3);
    potion(
      1,
      5,
      kind === "check_duplicate" ? 6 : 5,
      kind === "check_duplicate" ? PotionType.Heal : PotionType.None,
    );
    check(1, 4, 1);
    if (kind !== "check_duplicate") words(1, [3]);
    day(1, kind === "check_duplicate" ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6], 1);
    if (kind === "poison_duplicate") {
      potion(2, 5, 2, PotionType.Poison, true);
      pack(2, [2], 4);
      potion(2, 5, 5, PotionType.Poison);
      invalid(5, { name: "use_potion", args: { target_id: 2, potion_type: PotionType.Poison } });
      check(2, 4, 2);
    } else {
      check(2, recipient, 2, true);
      pack(2, [2], kind === "check_duplicate" ? 3 : 4);
      potion(2, 5, 5, PotionType.None);
      check(2, 4, kind === "check_duplicate" ? 3 : 2);
      if (kind === "check_duplicate")
        invalid(4, { name: "check_identity", args: { target_id: 2 } });
      day(2, kind === "check_duplicate" ? [2, 4, 5, 6] : [2, 5, 6], 2);
    }
  }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_black_${kind}`, config),
    ),
    seed: large
      ? seeds.twelve
      : kind === "hidden_backlash"
        ? seeds.hidden
        : b
          ? seeds.b
          : c
            ? seeds.c
            : seeds.a,
    roles,
    turns,
  };
}
