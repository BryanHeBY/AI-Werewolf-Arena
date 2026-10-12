/**
 * Unit tests: Death action permits use literal native/gifted ability instances and invalid
 * IDs; exact permission and rejection assertions check that reception and application
 * cannot borrow another gun instance. Inputs and expected outcomes remain the original
 * literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type ActionRequest, type RoleComponent } from "../../../src/core";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { ActionReception, ActionTurn } from "../../../src/ai/agents/player/action_reception";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { getHunterState } from "../../../src/game/mechanisms/roles/private_state";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

function fixture(locale: "zh-CN" | "en" = "en") {
  const roles = [Role.Wolf, Role.Hunter, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
  const game = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((r) => r === role).length,
      })),
    },
    { fixedRoles: roles, locale },
  );
  game.world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!.alive = false;
  return game;
}

for (const abilityId of [undefined, "gift:1", "gift:2"])
  test(`${abilityId}: a death permission authorizes only its exact native or gifted instance`, () => {
    const { world } = fixture(),
      permit = world.openDeathAction(2, "shoot", Phase.Day, 1, () => true, abilityId);
    try {
      for (const attempted of [undefined, "gift:1", "gift:2"]) {
        expect(world.hasDeathAction(2, "shoot", Phase.Day, 1, permit.id, attempted)).toBe(
          attempted === abilityId,
        );
        expect(world.isDeathActionOpen(2, "shoot", permit.id, attempted)).toBe(
          attempted === abilityId,
        );
      }
      expect(world.hasDeathAction(2, "shoot", Phase.Day, 2, permit.id, abilityId)).toBe(false);
      expect(world.hasDeathAction(2, "speak", Phase.Day, 1, permit.id, abilityId)).toBe(false);
    } finally {
      permit.close();
    }
    expect(world.activeDeathActionCount).toBe(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: inserting a gifted ID cannot borrow a native gun permission at reception or application`, () => {
    const { world } = fixture(locale),
      receive = new ActionReception(world),
      gateway = new ToolGateway(),
      permit = world.openDeathAction(2, "shoot", Phase.Day, 1);
    const request: ActionRequest = {
      actorId: 2,
      phase: Phase.Day,
      allowedTools: ["shoot"],
      context: {
        day: 1,
        stage: "hunter_shot",
        trigger: "on_death",
        death_action_id: permit.id,
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const nativeState = getHunterState(world.getComponent<RoleComponent>(2, COMPONENT.Role)!)!;
    try {
      const forged = structuredClone(request);
      forged.context.ability_id = "gift:1";
      expect(receive.validate(forged, "shoot", { target_id: 1 })).toMatchObject({
        ok: false,
        error: "death_action_unavailable",
      });
      expect(
        gateway.validateAndSanitize(
          world,
          2,
          { name: "shoot", args: { target_id: 1 } },
          { phase: Phase.Day, day: 1, deathActionId: permit.id, abilityId: "gift:1" },
        ),
      ).toMatchObject({ ok: false, error: "death_action_unavailable" });
      const turn = new ActionTurn(receive, request, "native-turn");
      expect(turn.submit("wrong-turn", "shoot", { target_id: 1 }).ok).toBe(false);
      expect(turn.submit("native-turn", "shoot", { target_id: 1 })).toMatchObject({
        ok: true,
        accepted: true,
        applied: false,
      });
      expect(nativeState.canShoot).toBe(true);
      expect(world.getAliveEntityIds()).toContain(1);
    } finally {
      permit.close();
    }
  });

for (const change of ["revive", "replace", "clock", "close"] as const)
  test(`${change}: exact instance knowledge cannot keep an obsolete death permission alive`, () => {
    const { world } = fixture();
    let current = true;
    const permit = world.openDeathAction(2, "shoot", Phase.Day, 1, () => current, "gift:1");
    if (change === "revive") {
      const life = world.getComponent<{ alive: boolean }>(2, COMPONENT.Alive)!;
      life.alive = true;
      life.alive = false;
    }
    if (change === "replace") world.addComponent(2, COMPONENT.Alive, createAliveComponent(false));
    if (change === "clock") current = false;
    if (change === "close") permit.close();
    expect(world.hasDeathAction(2, "shoot", Phase.Day, 1, permit.id, "gift:1")).toBe(false);
    expect(world.activeDeathActionCount).toBe(0);
    permit.close();
  });

test("closing one inventory and opening another does not let old IDs or an old close revoke the new permission", () => {
  const { world } = fixture(),
    native = world.openDeathAction(2, "shoot", Phase.Day, 1);
  native.close();
  const gifted = world.openDeathAction(2, "shoot", Phase.Day, 1, () => true, "gift:1");
  expect(gifted.id).not.toBe(native.id);
  native.close();
  expect(world.hasDeathAction(2, "shoot", Phase.Day, 1, native.id, "gift:1")).toBe(false);
  expect(world.hasDeathAction(2, "shoot", Phase.Day, 1, gifted.id)).toBe(false);
  expect(world.hasDeathAction(2, "shoot", Phase.Day, 1, gifted.id, "gift:1")).toBe(true);
  gifted.close();
  expect(world.activeDeathActionCount).toBe(0);
});

test("instance bindings are valid opaque gifted IDs and cannot be attached to last words", () => {
  const { world } = fixture();
  for (const id of ["", "native:gun", "../gun", "x".repeat(129), null, 2])
    expect(() => world.openDeathAction(2, "shoot", Phase.Day, 1, () => true, id as string)).toThrow(
      "death_action_invalid_actor_or_stage",
    );
  expect(() => world.openDeathAction(2, "speak", Phase.Day, 1, () => true, "gift:1")).toThrow(
    "death_action_invalid_actor_or_stage",
  );
  expect(world.activeDeathActionCount).toBe(0);
});
