/**
 * 测试支持模块负责持有守墓人有限场景及反馈数据 helper；graveFeedback 接收放逐日、接收日、目标和阵营字段，gravekeeperScenario 接收 kind。输出由调用方字面字段组成的反馈对象和固定板子／内部种子／身份／回合，不执行被动反馈或整局结算。
 */
import { ActionWindow } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { WinCondition } from "../../../../../src/domain";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { sixPlayerMvpConfig } from "../../../../../src/rulesets/presets/six-player-mvp";
import { twelvePlayerStandardConfig } from "../../../../../src/rulesets/presets/twelve-player-standard";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const GRAVEKEEPER_CASES = [
  "six",
  "idiot",
  "blast",
  "stale_blast",
  "hunter_chain",
  "keeper_exiled",
  "keeper_night_killed",
  "twelve",
] as const;

export type GravekeeperScenario = (typeof GRAVEKEEPER_CASES)[number];

export const graveFeedback = (
  exileDay: number,
  receivedDay: number,
  targetId: number,
  camp: "good" | "wolf",
) => ({ exileDay, receivedDay, targetId, camp });

export function gravekeeperScenario(kind: GravekeeperScenario): TransportGameScenario {
  const roles =
    kind === "twelve"
      ? [
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Gravekeeper,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ]
      : kind === "idiot"
        ? [Role.Wolf, Role.Wolf, Role.Gravekeeper, Role.Idiot, Role.Villager, Role.Villager]
        : kind === "hunter_chain"
          ? [Role.WolfKing, Role.Wolf, Role.Gravekeeper, Role.Hunter, Role.Villager, Role.Villager]
          : kind === "stale_blast"
            ? [Role.Wolf, Role.Wolf, Role.Gravekeeper, Role.Seer, Role.Villager, Role.Wolf]
            : [Role.Wolf, Role.Wolf, Role.Gravekeeper, Role.Seer, Role.Villager, Role.Villager];
  const counts = [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((item) => item === role).length,
  }));
  const blast = kind === "blast" || kind === "stale_blast",
    base = kind === "twelve" ? twelvePlayerStandardConfig : sixPlayerMvpConfig;
  const config = {
    ...base,
    roleSetups:
      kind === "twelve"
        ? base.roleSetups.map((row) =>
            row.role === Role.Idiot ? { role: Role.Gravekeeper, count: 1 } : row,
          )
        : counts,
    winConditions: [
      kind === "hunter_chain" ? WinCondition.SlaughterCity : WinCondition.SlaughterSide,
    ],
    hooks: { ...base.hooks, onPreVote: blast || base.hooks.onPreVote },
    selfDestruct: { enabledWindows: blast ? [ActionWindow.OnPreVote] : [] },
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []]));
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
  const check = (day: number, target: number) => {
    if (roles[3] === Role.Seer)
      add(day, [4], "seer", { name: "check_identity", args: { target_id: target } });
  };
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number) =>
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  const words = (day: number, actor: number) =>
    add(day, [actor], "last_words", { name: "speak", args: { text: "Authorized last words" } });
  const blasts = (day: number, wolves: number[], caster: number | null) =>
    wolves.forEach((actor) =>
      add(
        day,
        [actor],
        ActionWindow.OnPreVote,
        actor === caster
          ? { name: "self_destruct", args: { reason: "Public blast", confirm: true } }
          : null,
      ),
    );
  let seed = "grave-six:419";
  let latestByDay: Record<number, PlannedTurn["gravekeeperLatest"]> = { 1: null };
  if (kind === "twelve") {
    seed = "foundation-twelve:124680";
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
    night(3, [2], 9);
    add(3, [6], "witch", {
      name: "use_potion",
      args: { target_id: 6, potion_type: PotionType.None },
    });
    add(3, [8], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive3 = [2, 6, 8, 10, 11, 12];
    speech(3, alive3);
    vote(3, alive3, 2);
    words(3, 2);
    latestByDay = { 1: null, 2: graveFeedback(1, 2, 1, "wolf"), 3: graveFeedback(2, 3, 5, "good") };
  } else if (kind === "stale_blast") {
    seed = "grave-stale_blast:402";
    night(1, [1, 2, 6], null);
    check(1, 1);
    speech(1, [1, 2, 3, 4, 5, 6]);
    blasts(1, [1, 2, 6], null);
    vote(1, [1, 2, 3, 4, 5, 6], 1);
    words(1, 1);
    night(2, [2, 6], null);
    check(2, 2);
    speech(2, [2, 3, 4, 5, 6]);
    blasts(2, [2, 6], 2);
    night(3, [6], null);
    check(3, 6);
    speech(3, [3, 4, 5, 6]);
    blasts(3, [6], null);
    vote(3, [3, 4, 5, 6], 6);
    words(3, 6);
    latestByDay = { 1: null, 2: graveFeedback(1, 2, 1, "wolf"), 3: graveFeedback(1, 2, 1, "wolf") };
  } else {
    if (kind === "idiot") seed = "grave-idiot:0";
    if (kind === "hunter_chain") seed = "grave-hunter_chain:131";
    night(1, [1, 2], 6);
    check(1, 1);
    words(1, 6);
    speech(1, [1, 2, 3, 4, 5]);
    if (kind === "blast") blasts(1, [1, 2], 1);
    else {
      vote(1, [1, 2, 3, 4, 5], kind === "idiot" ? 4 : kind === "keeper_exiled" ? 3 : 1);
      if (kind !== "idiot") words(1, kind === "keeper_exiled" ? 3 : 1);
    }
    if (kind === "hunter_chain") {
      add(1, [1], "death_shot", { name: "shoot", args: { target_id: 4 } });
      add(1, [4], "hunter_shot", { name: "shoot", args: { target_id: 5 } });
      night(2, [2], null);
      speech(2, [2, 3]);
      vote(2, [2, 3], 2);
      words(2, 2);
      latestByDay = { 1: null, 2: graveFeedback(1, 2, 1, "wolf") };
    } else if (kind === "keeper_night_killed") {
      night(2, [2], 3);
      check(2, 2);
      speech(2, [2, 4, 5]);
      vote(2, [2, 4, 5], 2);
      words(2, 2);
    } else if (kind === "keeper_exiled") {
      night(2, [1, 2], null);
      check(2, 1);
      speech(2, [1, 2, 4, 5]);
      vote(2, [1, 2, 4, 5], 1);
      words(2, 1);
      night(3, [2], null);
      check(3, 2);
      speech(3, [2, 4, 5]);
      vote(3, [2, 4, 5], 2);
      words(3, 2);
    } else {
      night(2, kind === "idiot" ? [1, 2] : [2], null);
      check(2, 2);
      speech(2, kind === "idiot" ? [1, 2, 3, 4, 5] : [2, 3, 4, 5]);
      if (kind === "blast") blasts(2, [2], null);
      vote(2, kind === "idiot" ? [1, 2, 3, 5] : [2, 3, 4, 5], kind === "idiot" ? 1 : 4);
      words(2, kind === "idiot" ? 1 : 4);
      night(3, [2], null);
      speech(3, kind === "idiot" ? [2, 3, 4, 5] : [2, 3, 5]);
      if (kind === "blast") blasts(3, [2], null);
      vote(3, kind === "idiot" ? [2, 3, 5] : [2, 3, 5], 2);
      words(3, 2);
      latestByDay =
        kind === "idiot"
          ? { 1: null, 2: null, 3: graveFeedback(2, 3, 1, "wolf") }
          : kind === "blast"
            ? { 1: null, 2: null, 3: graveFeedback(2, 3, 4, "good") }
            : { 1: null, 2: graveFeedback(1, 2, 1, "wolf"), 3: graveFeedback(2, 3, 4, "good") };
    }
  }
  const keeper = kind === "twelve" ? 8 : 3;
  for (const turn of turns.get(keeper)!) turn.gravekeeperLatest = latestByDay[turn.day] ?? null;
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        kind === "twelve" ? "twelve_player_gravekeeper" : `six_player_gravekeeper_${kind}`,
        config,
      ),
    ),
    roles,
    turns,
    seed,
    promptAssertions: (actor, locale) =>
      actor === keeper
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Gravekeeper." : "真实身份是守墓人。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Gravekeeper," : "你的底牌是【守墓人】",
            ],
          }
        : {
            forbiddenCurrentMarkers:
              locale === "en"
                ? ["Latest grave feedback:", "No exile feedback received yet;"]
                : ["最新守墓反馈：", "尚未收到放逐反馈；"],
          },
  };
}
