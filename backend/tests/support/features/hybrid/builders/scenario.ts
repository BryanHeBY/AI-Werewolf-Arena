/**
 * Builds original hybrid test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { WinCondition } from "../../../../../src/domain";
import type { BoardConfig } from "../../../../../src/domain";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { sixPlayerMvpConfig } from "../../../../../src/rulesets/presets/six-player-mvp";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const HYBRID_CASES = [
  "good_alive",
  "wolf_alive",
  "good_dead",
  "wolf_dead",
  "wolf_win",
  "hidden",
  "twelve_good",
  "twelve_wolf",
  "twelve_wolf_win",
] as const;

export type HybridScenario = (typeof HYBRID_CASES)[number];

export function hybridScenario(kind: HybridScenario): TransportGameScenario {
  const large = kind.startsWith("twelve"),
    hidden = kind === "hidden",
    wolfWin = kind.endsWith("wolf_win"),
    earlyDeath = kind === "good_dead" || kind === "wolf_dead" || wolfWin;
  const roles = large
    ? [
        Role.WolfKing,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Seer,
        Role.Witch,
        Role.Guard,
        Role.Hybrid,
        Role.Hunter,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : [
        Role.Wolf,
        hidden ? Role.HiddenWolf : Role.WolfKing,
        Role.Hybrid,
        Role.Seer,
        Role.Witch,
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
  const hybrid = large ? 8 : 3,
    followGood = kind.startsWith("good") || kind === "twelve_good",
    target = followGood ? (large ? 9 : 4) : hidden || kind === "wolf_dead" ? 2 : 1;
  const rows = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => rows.get(actor)!.push({ day, stage, action }));
  const pack = (day: number, actors: number[], knife: number) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: false },
    });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const vote = (day: number, actors: number[], exile: number) => {
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
    add(day, actors, "voting", { name: "vote", args: { target_id: exile, abstain: false } });
    words(day, [exile]);
  };
  const check = (day: number, actor: number, inspected: number) =>
    add(day, [actor], "seer", { name: "check_identity", args: { target_id: inspected } });
  const potion = (
    day: number,
    actor: number,
    chosen: number,
    potion_type: PotionType.Heal | PotionType.Poison | PotionType.None,
  ) => add(day, [actor], "witch", { name: "use_potion", args: { target_id: chosen, potion_type } });
  const guard = (day: number, chosen: number) =>
    add(day, [7], "guard", { name: "guard", args: { target_id: chosen, abstain: false } });
  const direction = (day: number, sheriff: number) =>
    add(day, [sheriff], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
  const election = (alive: number[], sheriff: number) => {
    alive.forEach((actor) =>
      add(1, [actor], "sheriff_nomination", {
        name: "run_for_sheriff",
        args: { run: actor === sheriff || actor === 10 },
      }),
    );
    add(1, [sheriff, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [sheriff], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [10], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: false } });
    add(
      1,
      alive.filter((id) => id !== sheriff),
      "sheriff_vote",
      { name: "vote_for_sheriff", args: { target_id: sheriff, abstain: false } },
    );
    direction(1, sheriff);
  };
  add(1, [hybrid], "hybrid", { name: "choose_exemplar", args: { target_id: target } });
  if (kind === "good_alive") {
    const turn = rows.get(hybrid)![0];
    turn.invalidActions = [{ name: "choose_exemplar", args: { target_id: hybrid } }];
    turn.expectedInvalidError = "hybrid_target";
  }
  if (large) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    guard(1, 10);
    pack(1, [1, 2, 3, 4], wolfWin ? 8 : 9);
    potion(1, 6, wolfWin ? 6 : 9, wolfWin ? PotionType.None : PotionType.Heal);
    check(1, 5, 8);
    if (wolfWin) {
      election(all, 5);
      words(1, [8]);
      const alive = all.filter((id) => id !== 8);
      vote(1, alive, 12);
      guard(2, 7);
      pack(2, [1, 2, 3, 4], 11);
      potion(2, 6, 6, PotionType.None);
      check(2, 5, 1);
      direction(2, 5);
      vote(2, [1, 2, 3, 4, 5, 6, 7, 9, 10], 10);
    } else {
      election(all, 8);
      vote(1, all, 4);
      guard(2, 11);
      pack(2, [1, 2, 3], 9);
      potion(2, 6, 3, PotionType.Poison);
      check(2, 5, 2);
      add(2, [9], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
      direction(2, 8);
      vote(2, [1, 5, 6, 7, 8, 10, 11, 12], 1);
      add(2, [1], "death_shot", { name: "shoot", args: { target_id: 8 } });
    }
  } else {
    pack(1, hidden ? [1] : [1, 2], earlyDeath ? 3 : 6);
    potion(1, 5, earlyDeath ? 5 : 6, earlyDeath ? PotionType.None : PotionType.Heal);
    check(1, 4, 3);
    if (earlyDeath) words(1, [3]);
    vote(1, earlyDeath ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 5, 6], wolfWin ? 4 : 1);
    if (hidden)
      add(2, [2], "wolf_vote", { name: "kill_vote", args: { target_id: 6, abstain: false } });
    else pack(2, wolfWin ? [1, 2] : [2], 6);
    potion(2, 5, 5, PotionType.None);
    if (!wolfWin) check(2, 4, 2);
    vote(2, wolfWin ? [1, 2, 5] : earlyDeath ? [2, 4, 5] : [2, 3, 4, 5], wolfWin ? 5 : 2);
    if (!hidden && !wolfWin) add(2, [2], "death_shot", { name: "shoot", args: { target_id: 4 } });
  }
  for (const turn of rows.get(hybrid)!)
    turn.hybridChoice = turn.stage === "hybrid" ? null : { targetId: target };
  if (hidden)
    for (const turn of rows.get(2)!)
      turn.hiddenWolfStatus = {
        inherited: turn.day > 1,
        active: turn.day > 1 && turn.stage !== "last_words",
      };
  const packIds = large ? [1, 2, 3, 4] : hidden ? [1] : [1, 2];
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_hybrid_${kind}`, config),
    ),
    seed: large ? "hybrid-twelve:573604" : hidden ? "merchant-hidden:123" : "merchant-witch:1155",
    roles,
    turns: rows,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds:
        hidden && actor === 2
          ? [1]
          : packIds.includes(actor)
            ? packIds.filter((id) => id !== actor)
            : [],
      ...(actor === hybrid
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Hybrid." : "真实身份是混血儿。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your true role is Hybrid," : "你的真实底牌是混血儿",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Your true role is Hybrid," : "你的真实底牌是混血儿",
            ],
          }),
    }),
  };
}
