import { PotionType, Role, WinCondition, type BoardConfig } from "../../src/core";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export const PSYCHIC_CASES = [
  "six_skip",
  "six_repeat",
  "six_good",
  "twelve",
  "king_link",
  "hidden_mask",
] as const;
export type PsychicScenario = (typeof PSYCHIC_CASES)[number];
export function psychicScenario(kind: PsychicScenario): TransportGameScenario {
  const large = kind === "twelve",
    king = kind === "king_link",
    hidden = kind === "hidden_mask";
  const roles = large
    ? [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Psychic,
        Role.Witch,
        Role.Hunter,
        Role.Guard,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
      ]
    : king
      ? [Role.WolfKing, Role.Wolf, Role.Psychic, Role.Bear, Role.Villager, Role.Villager]
      : [
          Role.Wolf,
          hidden ? Role.HiddenWolf : Role.Wolf,
          Role.Psychic,
          Role.Witch,
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
  const inspect = (day: number, actor: number, target: number | null) =>
    add(
      day,
      [actor],
      "psychic",
      target === null ? null : { name: "inspect_role", args: { target_id: target } },
    );
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number) =>
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  if (large) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    add(1, [8], "guard", { name: "guard", args: { target_id: 10, abstain: false } });
    pack(1, [1, 2, 3, 4], 9);
    add(1, [6], "witch", {
      name: "use_potion",
      args: { target_id: 9, potion_type: PotionType.Heal },
    });
    inspect(1, 5, 6);
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
    pack(2, [1, 2, 3], 7);
    add(2, [6], "witch", {
      name: "use_potion",
      args: { target_id: 3, potion_type: PotionType.Poison },
    });
    inspect(2, 5, 1);
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
    add(2, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive2 = [1, 5, 6, 8, 9, 10, 11, 12];
    speech(2, alive2);
    vote(2, alive2, 9);
    words(2, [9]);
    add(3, [8], "guard", { name: "guard", args: { target_id: 10, abstain: false } });
    pack(3, [1], 6);
    add(3, [6], "witch", {
      name: "use_potion",
      args: { target_id: 6, potion_type: PotionType.None },
    });
    inspect(3, 5, 1);
    add(3, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive3 = [1, 5, 8, 10, 11, 12];
    speech(3, alive3);
    vote(3, alive3, 1);
    words(3, [1]);
  } else if (king) {
    pack(1, [1, 2], 1);
    inspect(1, 3, 1);
    words(1, [1]);
    add(1, [1], "death_shot", { name: "shoot", args: { target_id: 3 } });
    speech(1, [2, 4, 5, 6]);
    vote(1, [2, 4, 5, 6], 2);
    words(1, [2]);
  } else {
    pack(1, hidden ? [1] : [1, 2], hidden ? 5 : 3);
    add(1, [4], "witch", {
      name: "use_potion",
      args: { target_id: hidden ? 5 : 3, potion_type: PotionType.Heal },
    });
    inspect(1, 3, 2);
    speech(1, [1, 2, 3, 4, 5, 6]);
    vote(1, [1, 2, 3, 4, 5, 6], 1);
    words(1, [1]);
    if (hidden) knife(2, [2], 5);
    else pack(2, [2], 5);
    add(2, [4], "witch", {
      name: "use_potion",
      args: { target_id: 4, potion_type: PotionType.None },
    });
    inspect(2, 3, kind === "six_skip" ? null : 2);
    speech(2, [2, 3, 4, 6]);
    vote(2, [2, 3, 4, 6], kind === "six_skip" || kind === "six_repeat" ? 6 : 2);
    words(2, [kind === "six_skip" || kind === "six_repeat" ? 6 : 2]);
  }
  let latest: PlannedTurn["roleInspectionLatest"] = null;
  for (const turn of turns.get(large ? 5 : 3)!) {
    turn.roleInspectionLatest = latest;
    if (turn.action?.name === "inspect_role") {
      const target = turn.action.args.target_id;
      latest = {
        targetId: target,
        roleLabel:
          large && turn.day === 1
            ? ["女巫", "Witch"]
            : king
              ? ["狼王", "Wolf King"]
              : hidden
                ? turn.day === 1
                  ? ["平民", "Villager"]
                  : ["隐狼", "Hidden Wolf"]
                : ["狼人", "Werewolf"],
      };
    }
  }
  if (hidden)
    for (const turn of turns.get(2)!)
      turn.hiddenWolfStatus = {
        inherited: turn.day > 1,
        active: turn.day > 1 && turn.stage !== "last_words",
      };
  const family = large ? "twelve" : king ? "king" : hidden ? "hidden" : "six",
    seeds: Record<string, string> = {
      six: "psychic-six:465",
      king: "psychic-king:435",
      hidden: "psychic-hidden:256",
      twelve: "psychic-twelve:731742",
    },
    wolves = roles.flatMap((r, i) => ([Role.Wolf, Role.WolfKing].includes(r) ? [i + 1] : [])),
    psychic = large ? 5 : 3;
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_psychic_${kind}`, config),
    ),
    seed: seeds[family],
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds:
        actor === 2 && hidden
          ? [1]
          : wolves.includes(actor)
            ? wolves.filter((id) => id !== actor)
            : [],
      ...(actor === psychic
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Spirit Seer." : "真实身份是通灵师。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Spirit Seer," : "你的底牌是【通灵师】",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Your role is Spirit Seer," : "你的底牌是【通灵师】",
            ],
          }),
    }),
  };
}
