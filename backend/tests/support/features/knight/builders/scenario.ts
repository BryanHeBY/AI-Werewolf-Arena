/**
 * Builds original knight test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { oracle } from "../oracles/prompt-plan";
import { Role } from "../../../../../src/core";
import { KnightDuelWindow } from "../../../../../src/core";
import { WinCondition } from "../../../../../src/core";
import { PotionType } from "../../../../../src/core";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../../../src/runtime/scenarios/twelve_player_standard";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export type KnightScenario = "hit" | "miss" | "last_god_miss" | "king_hit" | "white_hit" | "twelve";

export function knightScenario(
  kind: KnightScenario,
  window: KnightDuelWindow = KnightDuelWindow.AfterSpeeches,
): TransportGameScenario {
  const roles =
    kind === "twelve"
      ? [
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Knight,
          Role.Idiot,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ]
      : kind === "last_god_miss"
        ? [Role.Knight, Role.Wolf, Role.Villager, Role.Villager, Role.Villager, Role.Villager]
        : [
            Role.Knight,
            kind === "king_hit"
              ? Role.WolfKing
              : kind === "white_hit"
                ? Role.WhiteWolfKing
                : Role.Wolf,
            Role.Seer,
            Role.Villager,
            Role.Villager,
            Role.Villager,
          ];
  const counts = roles
    .map((role) => ({ role, count: roles.filter((item) => item === role).length }))
    .filter((row, index, all) => all.findIndex((entry) => entry.role === row.role) === index);
  const original = kind === "twelve" ? twelvePlayerStandardConfig : sixPlayerMvpConfig;
  const roleSetups =
    kind === "twelve"
      ? twelvePlayerStandardConfig.roleSetups.map((row) =>
          row.role === Role.Hunter ? { role: Role.Knight, count: 1 } : row,
        )
      : counts;
  const config = {
    ...original,
    roleSetups,
    winConditions: [WinCondition.SlaughterSide],
    selfDestruct: { enabledWindows: [] },
    enableSheriff: kind === "twelve" || kind === "miss" || kind === "last_god_miss",
    ...(kind === "miss" || kind === "last_god_miss"
      ? { initialSheriffSeat: 1, sheriff: { voteWeight: 2.25 } }
      : {}),
    knight: { enabledWindows: [window] },
  };
  const definition = boardDefinitionFromConfig(
    kind === "twelve" ? "twelve_player_knight" : "six_player_knight",
    config,
  );
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, index) => [index + 1, []]));
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: PlannedTurn["action"],
  ) => actors.forEach((actor) => turns.get(actor)!.push({ day, stage, action }));
  const night = (day: number, wolves: number[], target: number) => {
    add(day, wolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, wolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  };
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", { name: "speak", args: { text: "Public speech" } });
  const vote = (day: number, actors: number[], target: number) =>
    add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  const words = (day: number, actor: number) =>
    add(day, [actor], "last_words", { name: "speak", args: { text: "Authorized last words" } });
  const cast = (actor: number, target: number) => {
    add(1, [actor], window, { name: "duel", args: { target_id: target, confirm: true } });
    const turn = turns.get(actor)!.at(-1)!;
    turn.invalidActions = [{ name: "duel", args: { target_id: 999, confirm: true } }];
    turn.expectedInvalidError = "knight_duel_target";
  };
  if (kind === "twelve") {
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
    speech(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    cast(7, 1);
    night(2, [2, 3, 4], 7);
    add(2, [6], "witch", {
      name: "use_potion",
      args: { target_id: 4, potion_type: PotionType.Poison },
    });
    add(2, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
    add(2, [8], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive2 = [2, 3, 5, 6, 8, 9, 10, 11, 12];
    speech(2, alive2);
    vote(2, alive2, 2);
    words(2, 2);
    night(3, [3], 5);
    add(3, [6], "witch", {
      name: "use_potion",
      args: { target_id: 6, potion_type: PotionType.None },
    });
    add(3, [5], "seer", { name: "check_identity", args: { target_id: 3 } });
    add(3, [8], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    const alive3 = [3, 6, 8, 9, 10, 11, 12];
    speech(3, alive3);
    vote(3, alive3, 3);
    words(3, 3);
    return oracle({
      board: parseBoardDefinition(definition),
      roles,
      turns,
      seed: "foundation-twelve:124680",
    });
  }
  night(1, [2], 5);
  if (kind !== "last_god_miss")
    add(1, [3], "seer", { name: "check_identity", args: { target_id: 2 } });
  words(1, 5);
  if (kind === "miss" || kind === "last_god_miss") {
    if (window !== KnightDuelWindow.BeforeSpeeches)
      add(1, [1], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
  }
  if (window === KnightDuelWindow.AfterSpeeches) speech(1, [1, 2, 3, 4, 6]);
  if (window === KnightDuelWindow.BetweenSpeeches) speech(1, [1]);
  cast(1, kind === "miss" ? 4 : kind === "last_god_miss" ? 3 : 2);
  if (kind === "miss" || kind === "last_god_miss") words(1, 1);
  if (kind === "miss") {
    if (window === KnightDuelWindow.BeforeSpeeches) {
      add(1, [2], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
      speech(1, [2, 3, 4, 6]);
    }
    vote(1, [2, 3, 4, 6], 2);
    words(1, 2);
  }
  return oracle({
    board: parseBoardDefinition(definition),
    roles,
    turns,
    seed:
      kind === "last_god_miss"
        ? "knight-last_god_miss:2"
        : kind === "king_hit"
          ? "knight-king_hit:20"
          : kind === "white_hit"
            ? "knight-white_hit:70"
            : "knight-hit:190",
  });
}
