/**
 * Unit tests verify explicit/legacy window configuration and bounded concurrent blast choices reject changed actor authority.
 * Input: Original locale matrix, literal override variants and controlled SelfDestructWindow reply timing.
 * Output and oracle: Exact effective windows, no stale application and closed permission assertions remain unchanged; no complete Day/PM flow runs.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionWindow, COMPONENT, Phase, Role, type GameEvent } from "../../../src/core";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { SelfDestructWindow } from "../../../src/game/engine/self_destruct_window";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import { convertLegacyBoard } from "../../../src/runtime/config/migrate_board";
import { resolveBoardConfig } from "../../../src/runtime/scenarios/board_config_resolver";

test("new overrides preserve explicit empty windows while legacy conversion preserves historically effective defaults and ignores unsupported declarations", () => {
  expect(
    resolveBoardConfig("twelve_player_standard", { selfDestruct: { enabledWindows: [] } })
      .selfDestruct!.enabledWindows,
  ).toEqual([]);
  const oldEmpty = convertLegacyBoard(
    { selfDestruct: { enabledWindows: [] } },
    "twelve_player_standard",
  );
  expect(oldEmpty.definition.mechanisms.selfDestruct.enabledWindows).toEqual([
    ActionWindow.OnPreVote,
  ]);
  expect(oldEmpty.warnings).toContain("legacy_empty_windows_used_default_pre_vote_window");
  const oldUnsupported = convertLegacyBoard(
    {
      hooks: { onDaybreak: true },
      selfDestruct: { enabledWindows: [ActionWindow.OnDaybreak, ActionWindow.OnPreVote] },
    },
    "twelve_player_standard",
  );
  expect(oldUnsupported.definition.mechanisms.selfDestruct.enabledWindows).toEqual([
    ActionWindow.OnPreVote,
  ]);
  expect(oldUnsupported.warnings).toContain("legacy_unsupported_windows_removed_explicitly");
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: completed concurrent choices cannot apply to changed lives, identities or phases`, async () => {
    for (const revoke of ["life", "role", "phase"] as const) {
      const { world } = bootstrapGame(twelvePlayerStandardConfig, {
        locale,
        fixedRoles: [
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Idiot,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ],
      });
      const events: GameEvent[] = [];
      let live = true;
      const result = await new SelfDestructWindow(
        world,
        createDefaultRoleRegistry(),
        new ToolGateway(),
      ).execute(
        new GameActionRequestFactory(world, events, 1),
        {
          async getAction(request) {
            if (request.actorId === 4) {
              await Promise.resolve();
              if (revoke === "life") {
                const alive = world.getComponent<{ alive: boolean }>(1, COMPONENT.Alive)!;
                alive.alive = false;
                alive.alive = true;
              }
              if (revoke === "role")
                world.getComponent<{ role: Role }>(1, COMPONENT.Role)!.role = Role.Villager;
              if (revoke === "phase") live = false;
            }
            return { name: "self_destruct", args: { confirm: true, reason: "raw" } };
          },
        },
        ActionWindow.OnDaybreak,
        Phase.Day,
        () => live,
      );
      expect(result).toEqual(
        revoke === "phase" ? null : { kind: "ordinary", actorId: 2, targetId: null },
      );
      expect(events).toEqual([]); // A bare selector returns an intent; the manager commits the fact.
      expect(world.getAliveEntityIds()).toContain(2); // The manager still owns death application.
    }
  });
