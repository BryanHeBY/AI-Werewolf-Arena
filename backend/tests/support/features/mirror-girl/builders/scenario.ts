/**
 * 测试支持模块负责按 MirrorScenario 的 kind 构造魔镜少女传输输入，输出原板子、内部固定种子、身份及字面查验／跳过回合。有限场景及所需角色标签在模块内维护；不执行查验或生成实际知识预期。
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

export const MIRROR_CASES = [
  "skip",
  "unique",
  "good",
  "twelve",
  "king_badge",
  "hidden_before",
  "hidden_after",
  "exhausted",
] as const;

export type MirrorScenario = (typeof MIRROR_CASES)[number];

export function mirrorScenario(kind: MirrorScenario): TransportGameScenario {
  const large = kind === "twelve",
    king = kind === "king_badge",
    hidden = kind.startsWith("hidden"),
    exhausted = kind === "exhausted";
  const roles = large
    ? [
        Role.Wolf,
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
    : king
      ? [Role.WolfKing, Role.Wolf, Role.MirrorGirl, Role.Seer, Role.Villager, Role.Villager]
      : [
          Role.Wolf,
          hidden ? Role.HiddenWolf : Role.Wolf,
          Role.MirrorGirl,
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
    enableSheriff: large || king,
    ...(king ? { initialSheriffSeat: 1 } : {}),
    selfDestruct: { enabledWindows: [] },
  };
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []])),
    mirror = large ? 5 : 3;
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
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
  const inspect = (day: number, target: number | null) =>
    add(
      day,
      [mirror],
      "mirror_girl",
      target === null ? null : { name: "inspect_role", args: { target_id: target } },
    );
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number | null) =>
    add(day, actors, "voting", {
      name: "vote",
      args: { target_id: target, abstain: target === null },
    });
  const potion = (
    day: number,
    actor: number,
    target: number,
    potion_type: PotionType.Heal | PotionType.Poison | PotionType.None,
  ) => add(day, [actor], "witch", { name: "use_potion", args: { target_id: target, potion_type } });
  if (large) {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    add(1, [8], "guard", { name: "guard", args: { target_id: 10, abstain: false } });
    pack(1, [1, 2, 3, 4], 9);
    potion(1, 6, 9, PotionType.Heal);
    inspect(1, 6);
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
    potion(2, 6, 3, PotionType.Poison);
    inspect(2, 1);
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
    potion(3, 6, 6, PotionType.None);
    inspect(3, 8);
    const retry = turns.get(5)!.at(-1)!;
    retry.invalidActions = [{ name: "inspect_role", args: { target_id: 1 } }];
    retry.expectedInvalidError = "role_inspection_repeat";
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
    add(1, [4], "seer", { name: "check_identity", args: { target_id: 2 } });
    inspect(1, 1);
    words(1, [1]);
    add(1, [1], "death_shot", { name: "shoot", args: { target_id: 3 } });
    add(1, [2], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    speech(1, [2, 4, 5, 6]);
    vote(1, [2, 4, 5, 6], 2);
    words(1, [2]);
  } else if (exhausted) {
    const all = [1, 2, 3, 4, 5, 6],
      targets = [2, 1, 4, 5, 6];
    for (let day = 1; day <= 5; day++) {
      pack(day, [1, 2], null);
      potion(day, 4, 4, PotionType.None);
      inspect(day, targets[day - 1]);
      speech(day, all);
      vote(day, all, null);
    }
    pack(6, [1, 2], 5);
    potion(6, 4, 4, PotionType.None);
    speech(6, [1, 2, 3, 4, 6]);
    vote(6, [1, 2, 3, 4, 6], 1);
    words(6, [1]);
    pack(7, [2], 6);
    potion(7, 4, 4, PotionType.None);
  } else {
    pack(1, hidden ? [1] : [1, 2], hidden ? 5 : 3);
    potion(1, 4, hidden ? 5 : 3, PotionType.Heal);
    inspect(1, kind === "hidden_after" ? null : 2);
    speech(1, [1, 2, 3, 4, 5, 6]);
    vote(1, [1, 2, 3, 4, 5, 6], 1);
    words(1, [1]);
    if (hidden) knife(2, [2], 5);
    else pack(2, [2], 5);
    potion(2, 4, 4, PotionType.None);
    inspect(2, kind === "skip" ? null : kind === "hidden_after" ? 2 : 4);
    if (kind === "unique" || kind === "hidden_before") {
      const retry = turns.get(3)!.at(-1)!;
      retry.invalidActions = [{ name: "inspect_role", args: { target_id: 2 } }];
      retry.expectedInvalidError = "role_inspection_repeat";
    }
    speech(2, [2, 3, 4, 6]);
    vote(2, [2, 3, 4, 6], kind === "skip" || kind === "unique" ? 6 : 2);
    words(2, [kind === "skip" || kind === "unique" ? 6 : 2]);
  }
  let latest: PlannedTurn["roleInspectionLatest"] = null;
  const labels: Record<string, [string, string]> = {
    wolf: ["狼人", "Werewolf"],
    wolf_king: ["狼王", "Wolf King"],
    witch: ["女巫", "Witch"],
    guard: ["守卫", "Guard"],
    villager: ["平民", "Villager"],
    hidden_wolf: ["隐狼", "Hidden Wolf"],
  };
  for (const turn of turns.get(mirror)!) {
    turn.roleInspectionLatest = latest;
    if (turn.action?.name === "inspect_role") {
      const target = turn.action.args.target_id,
        label =
          hidden && target === 2
            ? turn.day === 1
              ? "villager"
              : "hidden_wolf"
            : roles[target - 1];
      latest = { targetId: target, roleLabel: labels[label] };
    }
  }
  if (hidden)
    for (const turn of turns.get(2)!)
      turn.hiddenWolfStatus = {
        inherited: turn.day > 1,
        active: turn.day > 1 && turn.stage !== "last_words",
      };
  const seed = large
      ? "psychic-twelve:731742"
      : king
        ? "mirror-king:791"
        : hidden
          ? "psychic-hidden:256"
          : "psychic-six:465",
    wolves = roles.flatMap((r, i) => ([Role.Wolf, Role.WolfKing].includes(r) ? [i + 1] : []));
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_mirror_${kind}`, config),
    ),
    seed,
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds:
        actor === 2 && hidden
          ? [1]
          : wolves.includes(actor)
            ? wolves.filter((id) => id !== actor)
            : [],
      ...(actor === mirror
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Mirror Girl." : "真实身份是魔镜少女。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your role is Mirror Girl," : "你的角色是魔镜少女",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Your role is Mirror Girl," : "你的角色是魔镜少女",
            ],
          }),
    }),
  };
}
