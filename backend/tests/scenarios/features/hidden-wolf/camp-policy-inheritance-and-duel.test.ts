/**
 * Scenario tests check actual pack self-knife inheritance and Knight duel under Hidden Wolf camp inspection variants. Inputs are fixed decks and controlled actions over real phase cycles; literal private history, true faction, knife membership and duel facts are the oracle. Policy projection never substitutes for the original faction or role owner.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Role,
  type ActionRequest,
  type BoardConfig,
  type HiddenWolfCampInspectionPolicy,
  type RoleComponent,
} from "../../../../src/core";
import { getHiddenWolfState } from "../../../../src/game/mechanisms/roles/hidden_wolf/ports";
import { getSeerState } from "../../../../src/game/mechanisms/roles/seer/ports";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

const roles = [Role.HiddenWolf, Role.Wolf, Role.Seer, Role.Knight, Role.Villager, Role.Villager];

const catalog = getDefaultRoleCatalog();

function setup(campInspection?: HiddenWolfCampInspectionPolicy, locale: "en" | "zh-CN" = "en") {
  const board: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((item) => item === role).length,
    })),
    ...(campInspection ? { hiddenWolf: { campInspection } } : {}),
  };
  const resolved = parseBoardDefinition(boardDefinitionFromConfig("hidden_policy", board));
  return { ...bootstrapGame(resolved.config, { fixedRoles: roles, locale }), ...resolved };
}

for (const campInspection of ["awa_inheritance_v1", "netease_2020_good_v1"] as const) {
  test(`${campInspection}: actual pack self-knife changes inheritance while Seer results follow the named camp policy`, async () => {
    const game = setup(campInspection),
      hidden = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
    const act = async (request: ActionRequest) => {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote" as const,
          args: {
            target_id: request.context.day === 1 ? 2 : null,
            abstain: request.context.day !== 1,
          },
        };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 1 } };
      if (request.allowedTools.includes("speak"))
        return { name: "speak" as const, args: { text: "Raw" } };
      if (request.allowedTools.includes("duel")) return null;
      if (request.allowedTools.includes("vote"))
        return { name: "vote" as const, args: { target_id: null, abstain: true } };
      throw new Error(`Unexpected offline stage ${request.context.stage}`);
    };
    expect(knownWolfTeammates(game.world, 1, catalog)).toEqual([2]);
    expect(knownWolfTeammates(game.world, 2, catalog)).toEqual([]);
    await game.phaseManager.runSingleCycle({ getAction: act });
    expect(getHiddenWolfState(hidden)?.hasInheritedKnife).toBe(true);
    expect(hidden.camp).toBe(Camp.Wolf);
    expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
      kind: "camp",
      camp: campInspection === "netease_2020_good_v1" ? Camp.Good : Camp.Wolf,
    });
    expect(resolveInspection(game.world, 1, "role", catalog)).toEqual({
      kind: "role",
      role: Role.HiddenWolf,
    });
    expect(wolfChatParticipants(game.world, catalog)).toEqual([]);
    expect(wolfKnifeHolders(game.world, catalog)).toEqual([1]);
    await game.phaseManager.runSingleCycle({ getAction: act });
    expect(
      getSeerState(game.world.getComponent<RoleComponent>(3, COMPONENT.Role)!)?.history.map(
        (report) => report.isWerewolf,
      ),
    ).toEqual([false, campInspection !== "netease_2020_good_v1"]);
  });
}

test("Good inspection never changes true faction for a real Knight duel", async () => {
  const game = setup("netease_2020_good_v1");
  await game.phaseManager.runSingleCycle({
    async getAction(request) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (request.allowedTools.includes("duel"))
        return { name: "duel", args: { target_id: 1, confirm: true } };
      if (request.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      throw new Error(`Unexpected offline stage ${request.context.stage}`);
    },
  });
  expect(game.world.getAliveEntityIds()).not.toContain(1);
  expect(game.world.getAliveEntityIds()).toContain(4);
  expect(
    game.phaseManager.getEvents().find((event) => event.type === "knight_duel")?.payload,
  ).toEqual({ actorId: 4, targetId: 1, result: "wolf" });
  expect(resolveInspection(game.world, 1, "camp", catalog)).toEqual({
    kind: "camp",
    camp: Camp.Good,
  });
});
