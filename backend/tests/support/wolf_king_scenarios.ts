import { Role, WinCondition, PotionType, ActionWindow } from "../../src/core";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { foundationTransportPlan, type PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/runtime/scenarios/twelve_player_standard";
import { boardDefinitionFromConfig } from "../../src/runtime/config/board_definition";

export type WolfKingScenario = "exile_chain" | "poison" | "twelve" | "blast" | "shot_chain";
function withPromptOracle(scenario: TransportGameScenario): TransportGameScenario {
  return { ...scenario, promptAssertions: (actor, locale) => scenario.roles[actor - 1] === Role.WolfKing ? {
    expectedIdentityMarker: locale === "en" ? "your true role is Wolf King." : "真实身份是狼王。",
    requiredCurrentMarkers: locale === "en" ? ["Your role is Wolf King.", "Shots remaining: 1."] : ["你的底牌是【狼王】", "剩余枪：1。"],
  } : { forbiddenCurrentMarkers: [locale === "en" ? "Shots remaining:" : "剩余枪："] } };
}
export function wolfKingScenario(kind: WolfKingScenario): TransportGameScenario {
  if (kind === "twelve") {
    // Frozen seed maps the first old wolf card to seat 2. Permute only literal wolf IDs 1/2.
    const ids = (id: number) => id === 1 ? 2 : id === 2 ? 1 : id;
    const turns = new Map<number, PlannedTurn[]>();
    for (const [actor, rows] of foundationTransportPlan(12)) turns.set(ids(actor), rows.filter(row => !(actor === 10 && row.day === 2)).map(row => ({ ...row, action: row.action && "target_id" in row.action.args && row.action.args.target_id !== null ? { ...row.action, args: { ...row.action.args, target_id: ids(row.action.args.target_id) } } as typeof row.action : row.action })));
    turns.get(2)!.push({ day: 1, stage: "death_shot", action: { name: "shoot", args: { target_id: 10 } }, invalidActions: [{ name: "shoot", args: { target_id: 999 } }] });
    const definition = boardDefinitionFromConfig("twelve_player_wolf_king", { ...twelvePlayerStandardConfig, roleSetups: [{ role: Role.WolfKing, count: 1 }, { role: Role.Wolf, count: 3 }, ...twelvePlayerStandardConfig.roleSetups.slice(1)] });
    return withPromptOracle({ board: parseBoardDefinition(definition), seed: "foundation-twelve:124680", roles: [Role.Wolf, Role.WolfKing, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager], turns });
  }
  const roles = kind === "poison" ? [Role.WolfKing, Role.Hunter, Role.Seer, Role.Witch, Role.Villager, Role.Villager] : [Role.WolfKing, Role.Hunter, Role.Seer, Role.Villager, Role.Villager, Role.Villager];
  const counts = roles.map(role => ({ role, count: roles.filter(item => item === role).length })).filter((entry, index, array) => array.findIndex(item => item.role === entry.role) === index);
  const board = parseBoardDefinition(boardDefinitionFromConfig(kind === "poison" ? "six_player_wolf_king_poison" : "six_player_wolf_king", { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterSide], roleSetups: counts, enableSheriff: true, initialSheriffSeat: 1, sheriff: { voteWeight: 2.25 }, hooks: { ...sixPlayerMvpConfig.hooks, onPreVote: kind === "blast" }, selfDestruct: { enabledWindows: kind === "blast" ? [ActionWindow.OnPreVote] : [] } }));
  const turns = new Map<number, PlannedTurn[]>(roles.map((_, index) => [index + 1, []]));
  const add = (actors: number[], stage: PlannedTurn["stage"], action: PlannedTurn["action"]) => actors.forEach(actor => turns.get(actor)!.push({ day: 1, stage, action }));
  add([1], "wolf_discussion", { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } });
  add([1], "wolf_vote", { name: "kill_vote", args: { target_id: kind === "poison" || kind === "shot_chain" ? 2 : 5, abstain: false } });
  add([3], "seer", { name: "check_identity", args: { target_id: 1 } });
  if (kind === "poison") {
    add([4], "witch", { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } });
    add([1, 2], "last_words", { name: "speak", args: { text: "First night last words" } });
    add([2], "hunter_shot", { name: "shoot", args: { target_id: 5 } });
  } else if (kind === "shot_chain") {
    add([2], "last_words", { name: "speak", args: { text: "First night last words" } });
    add([2], "hunter_shot", { name: "shoot", args: { target_id: 1 } });
    add([1], "death_shot", { name: "shoot", args: { target_id: 3 } }); turns.get(1)!.at(-1)!.invalidActions = [{ name: "shoot", args: { target_id: 999 } }];
  } else {
    add([5], "last_words", { name: "speak", args: { text: "First night last words" } });
    add([1], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
    add([1, 2, 3, 4, 6], "day_speech", { name: "speak", args: { text: "Exile the wolf king" } });
    if (kind === "blast") add([1], "on_pre_vote", { name: "self_destruct", args: { reason: "Ordinary blast", confirm: true } });
    else {
      add([1, 2, 3, 4, 6], "voting", { name: "vote", args: { target_id: 1, abstain: false } });
      add([1], "last_words", { name: "speak", args: { text: "Exile last words" } });
      add([1], "death_shot", { name: "shoot", args: { target_id: 2 } }); turns.get(1)!.at(-1)!.invalidActions = [{ name: "shoot", args: { target_id: 999 } }];
      add([2], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
    }
  }
  return withPromptOracle({ board, roles, turns, seed: kind === "poison" ? "wolf-king-poison:225" : "wolf-king-exile:91" });
}
