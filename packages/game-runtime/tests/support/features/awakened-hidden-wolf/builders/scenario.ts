/**
 * 测试支持模块负责按 AwakenedScenario 的 kind 构造觉醒隐狼传输输入，输出原固定板子、种子、身份与逐玩家行动计划。用例集合和种子在模块内维护，调用方不传入语言／种子；不运行游戏来生成结果预期。
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

export const AWAKENED_CASES = [
  "villager",
  "mirror",
  PotionType.Poison,
  "guard",
  "hunter_first",
  "hunter",
  "extra",
  "extra_hold",
  "late",
  "twelve",
] as const;

export type AwakenedScenario = (typeof AWAKENED_CASES)[number];

const seeds = {
  villager: "awakened-villager:560",
  mirror_girl: "awakened-mirror_girl:684",
  witch: "awakened-witch:163",
  guard: "awakened-guard:64",
  hunter: "awakened-hunter:292",
  wolf: "awakened-wolf:464",
  twelve: "awakened-twelve:952478",
};

export function awakenedScenario(kind: AwakenedScenario): TransportGameScenario {
  const large = kind === "twelve",
    extra = kind.startsWith("extra");
  const template =
    kind === "mirror"
      ? Role.MirrorGirl
      : kind === PotionType.Poison || kind === "late"
        ? Role.Witch
        : kind === "guard"
          ? Role.Guard
          : kind.startsWith("hunter")
            ? Role.Hunter
            : extra
              ? Role.Wolf
              : Role.Villager;
  const roles = large
    ? [
        Role.AwakenedHiddenWolf,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.MirrorGirl,
        Role.Witch,
        Role.Hunter,
        Role.Guard,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : [Role.AwakenedHiddenWolf, Role.Wolf, template, Role.Witch, Role.Guard, Role.Villager];
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
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
  const guard = (day: number, actor: number, target: number | null) =>
    add(day, [actor], "guard", {
      name: "guard",
      args: { target_id: target, abstain: target === null },
    });
  const knife = (day: number, actors: number[], target: number | null) =>
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: target === null },
    });
  const pack = (day: number, actors: number[], target: number | null) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    knife(day, actors, target);
  };
  const potion = (
    day: number,
    actor: number,
    target: number,
    potion_type: PotionType.Heal | PotionType.Poison | PotionType.None,
  ) => add(day, [actor], "witch", { name: "use_potion", args: { target_id: target, potion_type } });
  const mimic = (day: number, target: number | null) =>
    add(
      day,
      [1],
      "awakened_mimic",
      target === null ? null : { name: "awakened_mimic", args: { target_id: target } },
    );
  const inspect = (day: number, actor: number, target: number) =>
    add(day, [actor], "mirror_girl", { name: "inspect_role", args: { target_id: target } });
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number | null) =>
    add(day, actors, "voting", {
      name: "vote",
      args: { target_id: target, abstain: target === null },
    });
  const day = (n: number, actors: number[], target: number | null) => {
    speech(n, actors);
    vote(n, actors, target);
    if (target !== null) words(n, [target]);
  };
  const awGuard = (n: number, target: number | null) =>
    add(n, [1], "awakened_skill", { name: "awakened_guard", args: { target_id: target } });
  const awPoison = (n: number, target: number) =>
    add(n, [1], "awakened_skill", { name: "awakened_poison", args: { target_id: target } });
  const awAttack = (n: number, target: number | null) =>
    add(n, [1], "awakened_attack", { name: "awakened_attack", args: { target_id: target } });

  if (large) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    guard(1, 8, 10);
    pack(1, [2, 3, 4], 9);
    potion(1, 6, 9, PotionType.Heal);
    mimic(1, 7);
    inspect(1, 5, 1);
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
    day(1, all, 4);
    guard(2, 8, 11);
    pack(2, [2, 3], 7);
    potion(2, 6, 3, PotionType.Poison);
    inspect(2, 5, 2);
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
    add(2, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    day(2, [1, 5, 6, 8, 9, 10, 11, 12], 9);
    guard(3, 8, 10);
    knife(3, [1], 1);
    potion(3, 6, 6, PotionType.None);
    inspect(3, 5, 8);
    add(3, [1], "death_shot", { name: "shoot", args: { target_id: 8 } });
  } else if (kind === "hunter_first") {
    guard(1, 5, 6);
    pack(1, [2], 1);
    potion(1, 4, 4, PotionType.None);
    mimic(1, 3);
    words(1, [1]);
    add(1, [1], "death_shot", { name: "shoot", args: { target_id: 2 } });
  } else if (extra) {
    guard(1, 5, 1);
    pack(1, [2, 3], 1);
    potion(1, 4, 3, PotionType.Poison);
    mimic(1, 3);
    words(1, [3]);
    day(1, [1, 2, 4, 5, 6], 2);
    guard(2, 5, 6);
    knife(2, [1], 6);
    potion(2, 4, 4, PotionType.None);
    awAttack(2, kind === "extra_hold" ? null : 4);
    if (kind === "extra") day(2, [1, 5, 6], 1);
    else {
      day(2, [1, 4, 5, 6], null);
      guard(3, 5, 5);
      knife(3, [1], 4);
      potion(3, 4, 4, PotionType.None);
      awAttack(3, 6);
    }
  } else if (kind === PotionType.Poison) {
    guard(1, 5, 5);
    pack(1, [2], 1);
    potion(1, 3, 2, PotionType.Poison);
    potion(1, 4, 1, PotionType.Heal);
    mimic(1, 3);
    words(1, [2]);
    day(1, [1, 3, 4, 5, 6], null);
    guard(2, 5, 6);
    knife(2, [1], 6);
    potion(2, 3, 3, PotionType.None);
    potion(2, 4, 4, PotionType.None);
    awPoison(2, 3);
    day(2, [1, 4, 5, 6], 1);
  } else if (kind === "late") {
    guard(1, 5, 1);
    pack(1, [2], 1);
    potion(1, 3, 3, PotionType.None);
    potion(1, 4, 4, PotionType.None);
    mimic(1, null);
    day(1, [1, 2, 3, 4, 5, 6], 2);
    guard(2, 5, 5);
    knife(2, [1], 5);
    potion(2, 3, 3, PotionType.None);
    potion(2, 4, 4, PotionType.None);
    mimic(2, 3);
    day(2, [1, 3, 4, 5, 6], null);
    guard(3, 5, 6);
    knife(3, [1], 6);
    potion(3, 3, 3, PotionType.None);
    potion(3, 4, 4, PotionType.None);
    awPoison(3, 5);
    day(3, [1, 3, 4, 6], 1);
  } else if (kind === "guard") {
    guard(1, 3, 6);
    guard(1, 5, 5);
    pack(1, [2], 1);
    potion(1, 4, 1, PotionType.Heal);
    mimic(1, 3);
    day(1, [1, 2, 3, 4, 5, 6], 2);
    guard(2, 3, 4);
    guard(2, 5, 3);
    knife(2, [1], 6);
    potion(2, 4, 6, PotionType.Poison);
    awGuard(2, 6);
    day(2, [1, 3, 4, 5, 6], null);
    guard(3, 3, 6);
    guard(3, 5, 4);
    knife(3, [1], 6);
    potion(3, 4, 4, PotionType.None);
    awGuard(3, null);
    const retry = turns.get(1)!.at(-1)!;
    retry.invalidActions = [{ name: "awakened_guard", args: { target_id: 6 } }];
    retry.expectedInvalidError = "awakened_guard_repeat";
    day(3, [1, 3, 4, 5, 6], null);
    guard(4, 3, 4);
    guard(4, 5, 6);
    knife(4, [1], 6);
    potion(4, 4, 4, PotionType.None);
    awGuard(4, 6);
    day(4, [1, 3, 4, 5, 6], 1);
  } else {
    guard(1, 5, kind === "villager" ? 6 : 5);
    pack(1, [2], 1);
    potion(1, 4, 1, PotionType.Heal);
    mimic(1, 3);
    if (kind === "mirror") inspect(1, 3, 1);
    day(1, [1, 2, 3, 4, 5, 6], 2);
    guard(2, 5, kind === "villager" ? 5 : 6);
    knife(2, [1], kind === "hunter" ? 1 : 5);
    potion(2, 4, 4, PotionType.None);
    if (kind === "hunter") {
      add(2, [1], "death_shot", { name: "shoot", args: { target_id: 3 } });
      add(2, [3], "hunter_shot", { name: "shoot", args: { target_id: 5 } });
    } else {
      if (kind === "mirror") {
        inspect(2, 1, 4);
        inspect(2, 3, 6);
      }
      day(2, kind === "villager" ? [1, 3, 4, 5, 6] : [1, 3, 4, 6], 1);
    }
  }
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_awakened_${kind}`, config),
    ),
    seed: large ? seeds.twelve : seeds[template as keyof typeof seeds],
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds:
        roles[actor - 1] === Role.Wolf
          ? roles.flatMap((role, i) => (role === Role.Wolf && i + 1 !== actor ? [i + 1] : []))
          : [],
      ...(actor === 1
        ? {
            expectedIdentityMarker:
              locale === "en"
                ? "Your true role when this session begins is Awakened Hidden Wolf."
                : "真实身份是觉醒隐狼。",
            requiredCurrentMarkers: [
              locale === "en"
                ? "Your role is Awakened Hidden Wolf; alignment and victory affiliation remain Werewolves."
                : "你的底牌是觉醒隐狼，阵营与胜利归属始终为狼人",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en"
                ? "Your role is Awakened Hidden Wolf; alignment and victory affiliation remain Werewolves."
                : "你的底牌是觉醒隐狼，阵营与胜利归属始终为狼人",
            ],
          }),
    }),
  };
}
