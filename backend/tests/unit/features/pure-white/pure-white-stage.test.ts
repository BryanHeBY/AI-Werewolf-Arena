/**
 * Unit tests: Pure White stages use paired controlled inspections and abstentions; exact
 * simultaneous-life, private-report and stock assertions check independent stage results
 * and cancellation. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 * The controlled context binds its query at the original World read position.
 */
import { bindNightAbilityActorQuery } from "../../../../src/game/mechanisms/roles/night-ability-actors";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { pureWhiteTwelveConfig } from "../../../../src/runtime/scenarios/pure_white_twelve";
import { Role, Phase, type ToolCall } from "../../../../src/core/domain/model";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import type { StatusMarksComponent } from "../../../../src/core/domain/components/status_marks";
import { DeathCause } from "../../../../src/core/domain/deaths";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { getRoleInspectionState } from "../../../../src/game/mechanisms/roles/private_state";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";
import {
  PURE_WHITE_INSPECTION_STAGE,
  WOLF_WITCH_INSPECTION_STAGE,
} from "../../../../src/game/mechanisms/roles/pure_white/night_stages";

function fixture(day: number, locale: "zh-CN" | "en") {
  const { world } = bootstrapGame(structuredClone(pureWhiteTwelveConfig), { locale });
  const id = (role: Role) =>
    world
      .entityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role)!;
  const pure = id(Role.PureWhiteGirl),
    wolf = id(Role.WolfWitch);
  let calls = 0;
  const ctx: NightStageContext = {
    world,
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    events: [],
    previousExile: null,
    isCurrent: () => true,
    currentDay: () => day,
    actionProvider: {
      getAction: async (r) => {
        calls++;
        return {
          name: "inspect_night_identity",
          args: { target_id: r.actorId === pure ? wolf : pure, abstain: false },
        };
      },
    },
    makeRequest: (actorId, allowedTools, extras) => ({
      actorId,
      allowedTools,
      phase: Phase.Night,
      context: {
        day,
        ...extras,
        visible_events: [],
        turn_constraints: {
          required_any_tools: allowedTools,
          min_valid_actions: 1,
          max_valid_actions: 1,
        },
      },
    }),
    getAliveByRole: (role) =>
      world
        .getAliveEntityIds()
        .filter((actor) => world.getComponent<RoleComponent>(actor, COMPONENT.Role)?.role === role),
    ensureMarks: (actor) => world.getComponent<StatusMarksComponent>(actor, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
    },
  };
  return { world, ctx, pure, wolf, id, calls: () => calls };
}
for (const locale of ["zh-CN", "en"] as const) {
  for (const day of [1, 2]) {
    test(`paired inspections ${locale} night ${day} preserve simultaneous life and exact private reports`, async () => {
      const f = fixture(day, locale);
      await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
      await WOLF_WITCH_INSPECTION_STAGE.execute(f.ctx);
      expect(f.calls()).toBe(2);
      expect(f.ctx.events.filter((event) => event.type === "role_inspected")).toHaveLength(2);
      expect(
        getRoleInspectionState(f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role)!)
          ?.history[0]?.result,
      ).toMatchObject({ kind: "role", role: Role.WolfWitch });
      const damage = new DamageResolutionSystem().resolve(f.world, {
        inspectionAttacks: f.ctx.state.inspectionAttacks,
      });
      expect([...damage.deaths].sort((a, b) => a - b)).toEqual(
        day === 1 ? [] : [f.pure, f.wolf].sort((a, b) => a - b),
      );
      if (day === 2) {
        expect(damage.deathSources[f.wolf]).toContain(DeathCause.PureWhiteInspection);
        expect(damage.deathSources[f.pure]).toContain(DeathCause.WolfWitchInspection);
      }
      expect(f.world.getComponent<AliveComponent>(f.pure, COMPONENT.Alive)?.alive).toBe(true);
      expect(f.world.getComponent<AliveComponent>(f.wolf, COMPONENT.Alive)?.alive).toBe(true);
      await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
      await WOLF_WITCH_INSPECTION_STAGE.execute(f.ctx);
      expect(f.calls()).toBe(2);
    });
  }
  test(`explicit abstention closes without a report or resource use ${locale}`, async () => {
    const f = fixture(2, locale);
    f.ctx.actionProvider = {
      getAction: async () => ({
        name: "inspect_night_identity",
        args: { target_id: null, abstain: true },
      }),
    };
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    const ability = findNightAbility(
      f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role),
      "role_check",
    )!;
    expect(ability.lastUsedDay).toBe(2);
    expect(ability.uses).toBe(0);
    expect(ability.state.history).toEqual([]);
    expect(f.ctx.events.map((event) => event.type)).toEqual(["role_inspection_skipped"]);
  });
  test(`missing submission fails instead of becoming a pass ${locale}`, async () => {
    const f = fixture(2, locale);
    f.ctx.actionProvider = { getAction: async () => null };
    await expect(PURE_WHITE_INSPECTION_STAGE.execute(f.ctx)).rejects.toThrow(
      "pure_white_inspection_action_missing",
    );
    expect(f.ctx.events).toEqual([]);
  });
  test(`wolf teammate is not an inspection target ${locale}`, async () => {
    const f = fixture(2, locale);
    f.ctx.actionProvider = {
      getAction: async (): Promise<ToolCall> => ({
        name: "inspect_night_identity",
        args: { target_id: f.id(Role.Wolf), abstain: false },
      }),
    };
    await expect(WOLF_WITCH_INSPECTION_STAGE.execute(f.ctx)).rejects.toThrow(
      "pure_white_inspection_action_invalid",
    );
    expect(f.ctx.events).toEqual([]);
  });
  test(`revoked owner after awaiting cannot report or consume ${locale}`, async () => {
    const f = fixture(2, locale);
    f.ctx.actionProvider = {
      getAction: async () => {
        f.world.getComponent<AliveComponent>(f.pure, COMPONENT.Alive)!.alive = false;
        return { name: "inspect_night_identity", args: { target_id: f.wolf, abstain: false } };
      },
    };
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    expect(f.ctx.events).toEqual([]);
    expect(
      findNightAbility(f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role), "role_check")
        ?.uses,
    ).toBe(0);
  });
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`repeat target across nights preserves both reports ${locale}`, async () => {
    const f = fixture(1, locale);
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    expect(f.ctx.state.inspectionAttacks ?? []).toEqual([]);
    f.ctx.currentDay = () => 2;
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    const ability = findNightAbility(
      f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role),
      "role_check",
    )!;
    expect(ability.state.history.map((r) => [r.day, r.targetId])).toEqual([
      [1, f.wolf],
      [2, f.wolf],
    ]);
    expect(ability.uses).toBe(2);
    expect(
      new DamageResolutionSystem().resolve(f.world, {
        inspectionAttacks: f.ctx.state.inspectionAttacks,
      }).deaths,
    ).toEqual([f.wolf]);
  });
  test(`target revival while awaiting does not produce a new report ${locale}`, async () => {
    const f = fixture(2, locale);
    f.ctx.actionProvider = {
      getAction: async () => {
        const life = f.world.getComponent<AliveComponent>(f.wolf, COMPONENT.Alive)!;
        life.alive = false;
        life.alive = true;
        return { name: "inspect_night_identity", args: { target_id: f.wolf, abstain: false } };
      },
    };
    await expect(PURE_WHITE_INSPECTION_STAGE.execute(f.ctx)).rejects.toThrow(
      "pure_white_inspection_target_stale",
    );
    expect(f.ctx.events).toEqual([]);
    expect(
      findNightAbility(f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role), "role_check")
        ?.uses,
    ).toBe(0);
  });
  test(`late ability revocation cancels damage but retains the paid private report ${locale}`, async () => {
    const f = fixture(2, locale);
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    const ability = findNightAbility(
      f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role),
      "role_check",
    )!;
    (ability as { disabled: boolean }).disabled = true;
    expect(
      new DamageResolutionSystem().resolve(f.world, {
        inspectionAttacks: f.ctx.state.inspectionAttacks,
      }).deaths,
    ).toEqual([]);
    expect(ability.uses).toBe(1);
    expect(ability.state.history).toHaveLength(1);
    expect(f.ctx.events.filter((e) => e.type === "role_inspected")).toHaveLength(1);
  });
  test(`late target identity change cancels damage without rewriting history ${locale}`, async () => {
    const f = fixture(2, locale);
    await PURE_WHITE_INSPECTION_STAGE.execute(f.ctx);
    f.world.getComponent<RoleComponent>(f.wolf, COMPONENT.Role)!.role = Role.Villager;
    expect(
      new DamageResolutionSystem().resolve(f.world, {
        inspectionAttacks: f.ctx.state.inspectionAttacks,
      }).deaths,
    ).toEqual([]);
    const report = getRoleInspectionState(
      f.world.getComponent<RoleComponent>(f.pure, COMPONENT.Role)!,
    )!.history[0]!;
    expect(report.result).toMatchObject({ kind: "role", role: Role.WolfWitch });
  });
}
