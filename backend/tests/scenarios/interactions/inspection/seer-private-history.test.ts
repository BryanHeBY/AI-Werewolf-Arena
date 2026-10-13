/**
 * Interaction scenarios verify the actual night pipeline publishes only the Seer's authorized camp label and detached private history.
 * Input: Original locale-by-camp matrix, fresh role/catalog fixtures and deterministic wolf, guard and Seer responses.
 * Output and oracle: Literal inspection payload/history and private-feed isolation remain tied to the executed night; existing localized render expectations use text helpers rather than independent presentation goldens.
 */
import { completedNight } from "../../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { inspectionLabel, text } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, type GameEvent, type RoleComponent } from "../../../../src/core";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { getSeerState } from "../../../../src/game/mechanisms/roles/seer/ports";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../../src/game/gateway/action_validator";
import { ToolValidationRuleRegistry } from "../../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms/script/event_render_registry";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
for (const locale of ["zh-CN", "en"] as const) {
  for (const inspectedCamp of [Camp.Good, Camp.Wolf, Camp.ThirdParty])
    test(`${locale}: actual seer stage records only its authorized ${inspectedCamp} label and detached private history`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles, locale }),
        events: GameEvent[] = [];
      const catalog = new RoleCatalog(
        getDefaultRoleCatalog()
          .all()
          .map((profile) =>
            profile.role !== Role.Wolf
              ? profile
              : { ...profile, inspectionLabels: { camp: inspectedCamp, role: Role.Villager } },
          ),
      );
      const pipeline = new NightPipeline({
        world,
        events,
        damageResolutionSystem: new DamageResolutionSystem(),
        stageRegistry: new NightStageRegistry(catalog),
        toolGateway: new ToolGateway(
          new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
        ),
      });
      const result = await pipeline.execute(
        sixPlayerMvpConfig,
        {
          async getAction(input) {
            if (input.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "end", end_chat: true } };
            if (input.allowedTools.includes("kill_vote"))
              return { name: "kill_vote", args: { target_id: null, abstain: true } };
            if (input.allowedTools.includes("guard"))
              return { name: "guard", args: { target_id: null, abstain: true } };
            if (input.allowedTools.includes("check_identity"))
              return { name: "check_identity", args: { target_id: 1 } };
            throw new Error("unexpected_action");
          },
        },
        1,
      );
      const inspection = events.find((event) => event.type === "seer_checked")!;
      expect(inspection.payload).toEqual({
        actorId: 3,
        targetId: 1,
        result: { kind: "camp", camp: inspectedCamp },
        isWerewolf: inspectedCamp === Camp.Wolf,
      });
      expect(inspection.payload.result).not.toHaveProperty("role");
      expect(completedNight(result).summary.seerChecks).toEqual([
        {
          seerId: 3,
          targetId: 1,
          result: { kind: "camp", camp: inspectedCamp },
          isWerewolf: inspectedCamp === Camp.Wolf,
        },
      ]);
      expect(world.getComponent<RoleComponent>(1, COMPONENT.Role)!.camp).toBe(Camp.Wolf);
      const state = getSeerState(world.getComponent<RoleComponent>(3, COMPONENT.Role)!)!;
      expect(state.lastResult).toEqual({ kind: "camp", camp: inspectedCamp });
      expect(state.history).toEqual([
        {
          targetId: 1,
          result: { kind: "camp", camp: inspectedCamp },
          isWerewolf: inspectedCamp === Camp.Wolf,
        },
      ]);
      expect(state.lastResult).not.toBe(inspection.payload.result);
      expect(state.history[0].result).not.toBe(inspection.payload.result);
      for (const id of world.entityIds())
        expect(
          buildAgentVisibleEventFeed(world, events, id).some(
            (event) => event.type === "seer_checked",
          ),
        ).toBe(id === 3);
      const projected = buildAgentVisibleEventFeed(world, events, 3).find(
        (event) => event.type === "seer_checked",
      )!;
      (projected.payload.result as Record<string, unknown>).camp = "synthetic-tampered";
      expect(inspection.payload.result).toEqual({ kind: "camp", camp: inspectedCamp });
      expect(state.lastResult).toEqual({ kind: "camp", camp: inspectedCamp });
      expect(state.history[0].result).toEqual({ kind: "camp", camp: inspectedCamp });
      expect(completedNight(result).summary.seerChecks[0].result).toEqual({
        kind: "camp",
        camp: inspectedCamp,
      });
      const expectedLabel = inspectionLabel({ kind: "camp", camp: inspectedCamp }, locale);
      expect(getDefaultScriptEventRenderRegistry().toLiveRender(inspection, true, locale)).toEqual([
        {
          kind: "private",
          text: text(locale, "console.live.check", { actor: 3, target: 1, camp: expectedLabel }),
        },
      ]);
      expect(getDefaultScriptEventRenderRegistry().toLiveRender(inspection, false, locale)).toEqual(
        [],
      );
      expect(world.getComponent<RoleComponent>(3, COMPONENT.Role)!.renderPrompt(locale)).toContain(
        text(locale, "inspection.latest", { target: 1, result: expectedLabel }),
      );
    });
}
