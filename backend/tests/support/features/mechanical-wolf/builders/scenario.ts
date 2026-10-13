/**
 * Builds original mechanical-wolf test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/core";
import { Role } from "../../../../../src/core";
import { WinCondition } from "../../../../../src/core";
import type { BoardConfig } from "../../../../../src/core";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../../src/runtime/scenarios/six_player_mvp";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export const MECHANICAL_CASES = [
  "villager",
  "inspection",
  PotionType.Poison,
  "reflection",
  "guard_failure",
  "hunter",
  "extra",
  "late",
  "twelve",
] as const;

export type MechanicalScenario = (typeof MECHANICAL_CASES)[number];

const labels: Partial<Record<Role, [string, string]>> = {
  [Role.MechanicalWolf]: ["机械狼", "Mechanical Wolf"],
  [Role.Wolf]: ["狼人", "Werewolf"],
  [Role.Villager]: ["平民", "Villager"],
  [Role.Psychic]: ["通灵师", "Spirit Seer"],
  [Role.Witch]: ["女巫", "Witch"],
  [Role.Guard]: ["守卫", "Guard"],
  [Role.Hunter]: ["猎人", "Hunter"],
};

export function mechanicalScenario(kind: MechanicalScenario): TransportGameScenario {
  const large = kind === "twelve",
    hunter = kind === "hunter";
  const roles = large
    ? [
        Role.MechanicalWolf,
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
    : [
        Role.MechanicalWolf,
        Role.Wolf,
        hunter ? Role.Hunter : Role.Psychic,
        Role.Witch,
        Role.Guard,
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
  const witch = (
    day: number,
    actor: number,
    target: number,
    potion_type: PotionType.Heal | PotionType.Poison | PotionType.None,
  ) => add(day, [actor], "witch", { name: "use_potion", args: { target_id: target, potion_type } });
  const mimic = (day: number, target: number | null) =>
    add(
      day,
      [1],
      "mechanical_mimic",
      target === null ? null : { name: "mimic_role", args: { target_id: target } },
    );
  const mode = (day: number, choice: "kill" | "skill" | null) =>
    add(
      day,
      [1],
      "mechanical_mode",
      choice === null ? null : { name: "mechanical_mode", args: { mode: choice } },
    );
  const inspect = (day: number, actor: number) =>
    add(day, [actor], "psychic", { name: "inspect_role", args: { target_id: 1 } });
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Authorized words" } });
  const vote = (day: number, actors: number[], target: number) => {
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
    words(day, [target]);
  };
  const all = Array.from({ length: roles.length }, (_, i) => i + 1);
  if (large) {
    guard(1, 8, 10);
    pack(1, [2, 3, 4], 9);
    witch(1, 6, 9, PotionType.Heal);
    mimic(1, 7);
    inspect(1, 5);
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
    guard(2, 8, 11);
    mode(2, "skill");
    pack(2, [2, 3], 7);
    witch(2, 6, 3, PotionType.Poison);
    inspect(2, 5);
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 2 } });
    add(2, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    vote(2, [1, 5, 6, 8, 9, 10, 11, 12], 9);
    guard(3, 8, 10);
    mode(3, "kill");
    knife(3, [1], 6);
    witch(3, 6, 6, PotionType.None);
    inspect(3, 5);
    add(3, [5], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    vote(3, [1, 5, 8, 10, 11, 12], 1);
    add(3, [1], "death_shot", { name: "shoot", args: { target_id: 8 } });
  } else {
    const learningTarget =
      kind === "villager"
        ? 6
        : kind === "inspection"
          ? 3
          : [PotionType.Poison, "late"].includes(kind)
            ? 4
            : hunter
              ? 3
              : kind === "extra"
                ? 2
                : 5;
    guard(1, 5, null);
    pack(1, [2], null);
    witch(1, 4, 4, PotionType.None);
    mimic(1, kind === "late" ? null : learningTarget);
    if (!hunter) inspect(1, 3);
    vote(1, all, 2);
    guard(2, 5, kind === "extra" ? 3 : null);
    const kill = ["villager", "hunter", "extra", "late"].includes(kind);
    mode(2, kill ? "kill" : "skill");
    if (kill) knife(2, [1], kind === "villager" ? 5 : 6);
    witch(
      2,
      4,
      kind === "reflection" ? 3 : 4,
      kind === "reflection" ? PotionType.Poison : PotionType.None,
    );
    if (kind === "late") mimic(2, 4);
    if (!hunter) inspect(2, 3);
    if (kind === "inspection")
      add(2, [1], "mechanical_skill", { name: "mechanical_inspect", args: { target_id: 4 } });
    if (kind === PotionType.Poison)
      add(2, [1], "mechanical_skill", { name: "mechanical_poison", args: { target_id: 3 } });
    if (["reflection", "guard_failure"].includes(kind))
      add(2, [1], "mechanical_skill", { name: "mechanical_guard", args: { target_id: 3 } });
    if (kind === "extra")
      add(2, [1], "mechanical_attack", { name: "mechanical_attack", args: { target_id: 3 } });
    const alive2 =
      kind === "villager"
        ? [1, 3, 4, 6]
        : [PotionType.Poison, "extra"].includes(kind)
          ? kind === "extra"
            ? [1, 4, 5]
            : [1, 4, 5, 6]
          : kind === "reflection"
            ? [1, 3, 5, 6]
            : ["hunter", "late"].includes(kind)
              ? [1, 3, 4, 5]
              : [1, 3, 4, 5, 6];
    const third = ["inspection", "guard_failure", "late"].includes(kind);
    vote(2, alive2, third ? (kind === "late" ? 3 : 6) : 1);
    if (hunter) add(2, [1], "death_shot", { name: "shoot", args: { target_id: 4 } });
    if (third) {
      guard(3, 5, null);
      mode(3, kind === "late" ? null : "skill");
      witch(3, 4, 4, PotionType.None);
      if (kind !== "late") inspect(3, 3);
      add(
        3,
        [1],
        "mechanical_skill",
        kind === "late"
          ? null
          : kind === "inspection"
            ? { name: "mechanical_inspect", args: { target_id: 4 } }
            : { name: "mechanical_guard", args: { target_id: 3 } },
      );
      if (kind !== "guard_failure") vote(3, kind === "late" ? [1, 4, 5] : [1, 3, 4, 5], 1);
    }
  }
  let learned: Role | null = null,
    ready: number | null = null,
    selected: NonNullable<PlannedTurn["mechanicalStatus"]>["mode"] = null;
  for (const turn of turns.get(1)!) {
    const inherited = large
        ? turn.day >= 3 ||
          (turn.day === 2 && ["day_speech", "voting", "last_words"].includes(turn.stage))
        : turn.day >= 2,
      first = inherited ? (large ? 3 : 2) : null;
    turn.mechanicalStatus = {
      learned: learned ? labels[learned]! : null,
      ready,
      inherited,
      first,
      mode: selected,
    };
    if (turn.action?.name === "mimic_role") {
      learned = roles[turn.action.args.target_id - 1];
      ready = turn.day + 1;
    }
    if (turn.stage === "mechanical_mode")
      selected = {
        day: turn.day,
        kind: turn.action?.name === "mechanical_mode" ? turn.action.args.mode : "skill",
      };
  }
  if (!hunter) {
    let latest: PlannedTurn["roleInspectionLatest"] = null;
    for (const turn of turns.get(large ? 5 : 3)!) {
      turn.roleInspectionLatest = latest;
      if (turn.stage === "psychic") {
        const targetRole =
          kind === "late" && turn.day === 1
            ? Role.MechanicalWolf
            : roles[
                (kind === "twelve"
                  ? 7
                  : kind === "villager"
                    ? 6
                    : kind === "inspection"
                      ? 3
                      : kind === PotionType.Poison || kind === "late"
                        ? 4
                        : kind === "extra"
                          ? 2
                          : 5) - 1
              ];
        latest = { targetId: 1, roleLabel: labels[targetRole]! };
      }
    }
  }
  const wolves = large ? [2, 3, 4] : [2];
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(`${large ? "twelve" : "six"}_player_mechanical_${kind}`, config),
    ),
    seed: large ? "mech-twelve:2332785" : hunter ? "mech-hunter:101" : "mech-six:123",
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedTeammateIds: wolves.includes(actor) ? wolves.filter((id) => id !== actor) : [],
      ...(actor === 1
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Mechanical Wolf." : "真实身份是机械狼。",
            requiredCurrentMarkers: [
              locale === "en" ? "Your true role is Mechanical Wolf and" : "你的真实底牌是机械狼",
            ],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Your true role is Mechanical Wolf and" : "你的真实底牌是机械狼",
            ],
          }),
    }),
  };
}
