/**
 * 测试支持模块负责按 GargoyleScenario 的 kind 构造石像鬼传输输入，输出原板子、内部固定种子、身份及逐玩家回合。原技能、继承和终局计划保持为声明数据；不执行对局或由生产结果生成预期。
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

export const GARGOYLE_CASES = [
  "day_good",
  "night_wolf",
  "king_link",
  "same_wave",
  "solo_self",
  "twelve",
] as const;

export type GargoyleScenario = (typeof GARGOYLE_CASES)[number];

export function gargoyleScenario(kind: GargoyleScenario): TransportGameScenario {
  const twelve = kind === "twelve",
    same = kind === "same_wave",
    solo = kind === "solo_self";
  const roles = twelve
    ? [
        Role.Gargoyle,
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
    : same
      ? [
          Role.Gargoyle,
          Role.Wolf,
          Role.Witch,
          Role.Seer,
          Role.Gravekeeper,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ]
      : solo
        ? [Role.Gargoyle, Role.Seer, Role.Gravekeeper, Role.Hunter, Role.Villager, Role.Villager]
        : [
            Role.Gargoyle,
            kind === "king_link" ? Role.WolfKing : Role.Wolf,
            Role.Seer,
            Role.Gravekeeper,
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
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: twelve,
    selfDestruct: { enabledWindows: [] },
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
  const inspect = (day: number, target: number) =>
    add(day, [1], "role_inspection", { name: "inspect_role", args: { target_id: target } });
  const knife = (day: number, actors: number[], target: number) =>
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  const pack = (day: number, actors: number[], target: number) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    knife(day, actors, target);
  };
  const seer = (day: number, actor: number) =>
    add(day, [actor], "seer", { name: "check_identity", args: { target_id: 1 } });
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number) =>
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  if (twelve) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    inspect(1, 5);
    pack(1, [2, 3, 4], 9);
    add(1, [6], "witch", {
      name: "use_potion",
      args: { target_id: 9, potion_type: PotionType.Heal },
    });
    seer(1, 5);
    all.forEach((actor) =>
      add(1, [actor], "sheriff_nomination", {
        name: "run_for_sheriff",
        args: { run: actor === 1 || actor === 10 },
      }),
    );
    add(1, [1, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [1], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [10], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: false } });
    add(
      1,
      all.filter((id) => id !== 1),
      "sheriff_vote",
      { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } },
    );
    add(1, [1], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    speech(1, all);
    vote(1, all, 4);
    words(1, [4]);
    inspect(2, 6);
    pack(2, [2, 3], 7);
    add(2, [6], "witch", {
      name: "use_potion",
      args: { target_id: 3, potion_type: PotionType.Poison },
    });
    seer(2, 5);
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
    add(2, [1], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive2 = [1, 5, 6, 8, 9, 10, 11, 12];
    speech(2, alive2);
    vote(2, alive2, 9);
    words(2, [9]);
    inspect(3, 8);
    knife(3, [1], 6);
    add(3, [6], "witch", {
      name: "use_potion",
      args: { target_id: 6, potion_type: PotionType.None },
    });
    seer(3, 5);
    add(3, [1], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive3 = [1, 5, 8, 10, 11, 12];
    speech(3, alive3);
    vote(3, alive3, 1);
    words(3, [1]);
  } else if (solo) {
    inspect(1, 2);
    knife(1, [1], 1);
    seer(1, 2);
    words(1, [1]);
  } else if (same) {
    inspect(1, 4);
    pack(1, [2], 1);
    add(1, [3], "witch", {
      name: "use_potion",
      args: { target_id: 2, potion_type: PotionType.Poison },
    });
    seer(1, 4);
    words(1, [1, 2]);
  } else if (kind === "king_link") {
    inspect(1, 3);
    pack(1, [2], 2);
    seer(1, 3);
    words(1, [2]);
    add(1, [2], "death_shot", { name: "shoot", args: { target_id: 1 } });
  } else {
    inspect(1, 3);
    pack(1, [2], 5);
    seer(1, 3);
    words(1, [5]);
    const alive1 = [1, 2, 3, 4, 6];
    speech(1, alive1);
    vote(1, alive1, 2);
    words(1, [2]);
    inspect(2, 4);
    knife(2, [1], kind === "night_wolf" ? 6 : 3);
    seer(2, 3);
    if (kind === "day_good") {
      speech(2, [1, 4, 6]);
      vote(2, [1, 4, 6], 1);
      words(2, [1]);
    }
  }
  let latest: PlannedTurn["roleInspectionLatest"] = null;
  for (const turn of turns.get(1)!) {
    turn.roleInspectionLatest = latest;
    turn.gargoyleStatus = {
      inherited:
        solo ||
        (kind === "king_link" && turn.stage === "last_words") ||
        (twelve
          ? turn.day > 2 || (turn.day === 2 && turn.stage !== "role_inspection")
          : turn.day > 1),
      active: turn.stage === "wolf_vote",
    };
    if (turn.action?.name === "inspect_role") {
      const target = turn.action.args.target_id;
      latest = {
        targetId: target,
        roleLabel:
          target === (twelve ? 5 : solo ? 2 : same ? 4 : 3)
            ? ["预言家", "Seer"]
            : target === 6
              ? ["女巫", "Witch"]
              : ["守墓人", "Gravekeeper"],
      };
    }
  }
  const family = twelve
    ? "twelve"
    : same
      ? "same"
      : solo
        ? "solo"
        : kind === "king_link"
          ? "king"
          : "basic";
  const seeds: Record<string, string> = {
    basic: "garg-basic:203",
    king: "garg-king:520",
    same: "garg-same:8345",
    solo: "garg-solo:588",
    twelve: "garg-twelve:144927",
  };
  const wolves = roles.flatMap((r, i) => ([Role.Wolf, Role.WolfKing].includes(r) ? [i + 1] : []));
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        `${twelve ? "twelve" : same ? "eight" : "six"}_player_gargoyle_${kind}`,
        config,
      ),
    ),
    seed: seeds[family],
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds: wolves.includes(actor) ? wolves.filter((id) => id !== actor) : [],
      ...(actor === 1
        ? {
            expectedIdentityMarker:
              locale === "en"
                ? "Your true role when this session begins is Gargoyle."
                : "真实身份是石像鬼。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Gargoyle," : "你的底牌是【石像鬼】",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en"
                ? "knife eligibility after this night's inspection:"
                : "本夜查后刀资格：",
            ],
          }),
    }),
  };
}
