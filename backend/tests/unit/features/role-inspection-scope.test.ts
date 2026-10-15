/**
 * 单元测试验证查验 scope 的能力 ID 变更、持有回复与注入历史。原所有者、结果唯一性和期限断言是最终授权重检预期；保留原字面输入及样本，不调用模型或完整对局 driver。
 */
import { nightStageContext } from "../../support/builders/night-stage-context";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type GameEvent,
  type RoleComponent,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { findNightAbility } from "../../../src/features/night-abilities/abilities";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../src/rulesets/roles/role-catalog-assembly";
import {
  ROLE_INSPECTION_STAGE,
  PSYCHIC_INSPECTION_STAGE,
  MIRROR_INSPECTION_STAGE,
} from "../../../src/features/role-inspection/contribution-ports";
import { hasRoleInspectionNightCommit } from "../../../src/features/role-inspection/night-scope";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import type { NightStageContext } from "../../../src/engine/night/contracts";
import {
  canGargoyleKnife,
  refreshGargoyleInheritance,
} from "../../../src/features/gargoyle/inheritance";
import { grantNightAbility } from "../../../src/features/night-abilities/night-ability-grants";

function fixture(kind: Role.Gargoyle | Role.Psychic | Role.MirrorGirl) {
  const roles = [kind, Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager],
    config = {
      ...sixPlayerMvpConfig,
      winConditions: [WinCondition.SlaughterCity],
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((r) => r === role).length,
      })),
      selfDestruct: { enabledWindows: [] },
    };
  const game = bootstrapGame(config, { fixedRoles: roles });
  return {
    ...game,
    ability: findNightAbility(game.world.getComponent(1, COMPONENT.Role)!, "role_check")!,
    stage:
      kind === Role.Gargoyle
        ? ROLE_INSPECTION_STAGE
        : kind === Role.MirrorGirl
          ? MIRROR_INSPECTION_STAGE
          : PSYCHIC_INSPECTION_STAGE,
  };
}
function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, 1);
  return nightStageContext({
    world: game.world,
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent: () => true,
    currentDay: () => 1,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        summary: "Offline stage fixture",
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        context: extra,
      }),
    getAliveByRole: () => [],
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
  });
}

for (const kind of [Role.Gargoyle, Role.Psychic, Role.MirrorGirl] as const)
  for (const point of ["await", "gateway"] as const)
    test(`${kind}/${point}: an in-place ability ID change cannot redirect a pending role inspection`, async () => {
      const game = fixture(kind),
        events: GameEvent[] = [];
      let calls = 0;
      const ctx = context(game, events, async (request) => {
        calls++;
        expect(request.context.ability_id).toBe("native:role_check");
        if (point === "await") (game.ability as { id: string }).id = "native:renamed";
        return { name: "inspect_role", args: { target_id: 2 } };
      });
      if (point === "gateway") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          (game.ability as { id: string }).id = "native:renamed";
          return result;
        };
      }
      await game.stage.execute(ctx);
      expect(calls).toBe(1);
      expect(game.ability.state.history).toEqual([]);
      expect(game.ability.uses).toBe(0);
      expect(game.ability.lastUsedDay).toBeNull();
      expect(events).toEqual([]);
      expect(hasRoleInspectionNightCommit(game.world, 1)).toBe(false);
    });

test("Gargoyle final application rechecks unique history after gateway, preserves the injected prefix and lets a fresh target retry", async () => {
  const game = fixture(Role.Gargoyle),
    events: GameEvent[] = [];
  let calls = 0,
    injected = false;
  const prefix = { day: 1, targetId: 2, result: { kind: "role" as const, role: Role.Wolf } };
  const ctx = context(game, events, async () => {
    calls++;
    return { name: "inspect_role", args: { target_id: calls === 1 ? 2 : 3 } };
  });
  const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
  ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
    const result = validate(world, actorId, call, validationContext);
    if (!injected) {
      injected = true;
      (
        game.ability.state.history as {
          day: number;
          targetId: import("@ai-werewolf-arena/game-contract").EntityId;
          result: Extract<
            import("@ai-werewolf-arena/game-contract").InspectionResult,
            { kind: "role" }
          >;
        }[]
      ).push(structuredClone(prefix));
    }
    return result;
  };
  await game.stage.execute(ctx);
  expect(calls).toBe(2);
  expect(game.ability.state.history).toEqual([
    prefix,
    { day: 1, targetId: 3, result: { kind: "role", role: Role.Seer } },
  ]);
  expect(game.ability.uses).toBe(1);
  expect(events.filter((e) => e.type === "role_inspected").map((e) => e.payload.targetId)).toEqual([
    3,
  ]);
});

test("Gargoyle final report rechecks unique history after an inspection-label callback changes it", async () => {
  const game = fixture(Role.Gargoyle),
    events: GameEvent[] = [];
  let calls = 0;
  const ctx = context(game, events, async () => {
    calls++;
    return { name: "inspect_role", args: { target_id: calls === 1 ? 2 : 3 } };
  });
  const profiles = getDefaultRoleContributions().map((profile) =>
    profile.metadata.role === Role.Wolf
      ? {
          ...profile,
          runtime: {
            ...profile.runtime,
            inspectionLabels: () => {
              (
                game.ability.state.history as {
                  day: number;
                  targetId: import("@ai-werewolf-arena/game-contract").EntityId;
                  result: Extract<
                    import("@ai-werewolf-arena/game-contract").InspectionResult,
                    { kind: "role" }
                  >;
                }[]
              ).push({
                day: 1,
                targetId: 2,
                result: { kind: "role" as const, role: Role.Wolf },
              });
              return { role: Role.Wolf };
            },
          },
        }
      : profile,
  );
  const { RoleCatalog } = await import("../../../src/rulesets/roles/catalog");
  ctx.roleCatalog = createRoleCatalog({ contributions: profiles });
  await game.stage.execute(ctx);
  expect(calls).toBe(2);
  expect(game.ability.state.history.map((row) => row.targetId)).toEqual([2, 3]);
  expect(game.ability.uses).toBe(1);
  expect(events.filter((e) => e.type === "role_inspected").map((e) => e.payload.targetId)).toEqual([
    3,
  ]);
});

for (const change of ["id", "source", "private_owner", "activation", "actor_transfer"] as const)
  test(`${change}: paid native Gargoyle completion cannot authorize a different ability owner but keeps its report`, async () => {
    const game = fixture(Role.Gargoyle),
      events: GameEvent[] = [],
      role = game.world.getComponent(1, COMPONENT.Role)!;
    game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    refreshGargoyleInheritance(game.world, events, 1);
    await game.stage.execute(
      context(game, events, async () => ({ name: "inspect_role", args: { target_id: 3 } })),
    );
    expect(
      canGargoyleKnife(role, game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
    ).toBe(true);
    expect(game.ability.lastUsedDay).toBe(1);
    const prefix = structuredClone(game.ability.state.history);
    if (change === "id") (game.ability as { id: string }).id = "native:renamed";
    if (change === "source")
      (
        game.ability as {
          source: import("@ai-werewolf-arena/game-contract").AbilitySource;
        }
      ).source = { kind: "gift", actorId: 3 };
    if (change === "private_owner")
      (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
        ...role.privateState,
      };
    if (change === "activation")
      (game.ability as { activation: "lucky" | "black_market" | undefined }).activation = "lucky";
    if (change === "actor_transfer") {
      const otherRole = game.world.getComponent(5, COMPONENT.Role)!,
        ownLife = game.world.getComponent(1, COMPONENT.Alive)!,
        otherLife = game.world.getComponent(5, COMPONENT.Alive)!;
      game.world.addComponent(1, COMPONENT.Role, otherRole);
      game.world.addComponent(1, COMPONENT.Alive, otherLife);
      game.world.addComponent(5, COMPONENT.Role, role);
      game.world.addComponent(5, COMPONENT.Alive, ownLife);
    }
    expect(
      canGargoyleKnife(role, game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
    ).toBe(false);
    expect(game.ability.uses).toBe(1);
    expect(game.ability.state.history).toEqual(prefix);
    expect(events.filter((e) => e.type === "role_inspected")).toHaveLength(1);
  });

for (const point of ["await", "gateway", "label"] as const)
  test(`${point}: a gifted inspection cannot become native while pending and fabricate Gargoyle knife authority`, async () => {
    const game = fixture(Role.Gargoyle),
      events: GameEvent[] = [],
      role = game.world.getComponent(1, COMPONENT.Role)!;
    (game.ability as { disabled: boolean }).disabled = true;
    game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    refreshGargoyleInheritance(game.world, events, 1);
    events.length = 0;
    const gift = grantNightAbility(
      game.world,
      1,
      {
        id: "gift:inspection",
        kind: "role_check",
        source: { kind: "gift", actorId: 3 },
        startsOnDay: 1,
        maxUses: 2,
        state: { lastTarget: null, lastDay: null, history: [] },
      },
      [],
    );
    const promote = () => {
      (gift as { source: import("@ai-werewolf-arena/game-contract").AbilitySource }).source = {
        kind: "native",
        role: Role.Gargoyle,
      };
    };
    let calls = 0;
    const ctx = context(game, events, async () => {
      calls++;
      if (point === "await") promote();
      return { name: "inspect_role", args: { target_id: 3 } };
    });
    if (point === "gateway") {
      const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
      ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
        const result = validate(world, actorId, call, validationContext);
        promote();
        return result;
      };
    }
    if (point === "label") {
      const { RoleCatalog } = await import("../../../src/rulesets/roles/catalog");
      ctx.roleCatalog = createRoleCatalog({
        contributions: getDefaultRoleContributions().map((profile) =>
          profile.metadata.role === Role.Seer
            ? {
                ...profile,
                runtime: {
                  ...profile.runtime,
                  inspectionLabels: () => {
                    promote();
                    return { role: Role.Seer };
                  },
                },
              }
            : profile,
        ),
      });
    }
    await game.stage.execute(ctx);
    expect(calls).toBe(1);
    expect(gift.uses).toBe(0);
    expect(gift.lastUsedDay).toBeNull();
    expect(gift.state.history).toEqual([]);
    expect(events).toEqual([]);
    expect(
      canGargoyleKnife(role, game.world, () => game.world.getComponent(1, COMPONENT.Camp)),
    ).toBe(false);
    expect(hasRoleInspectionNightCommit(game.world, 1)).toBe(false);
  });

for (const kind of [Role.Gargoyle, Role.Psychic, Role.MirrorGirl] as const)
  test(`${kind}: a source owner changed in place revokes the old native request`, async () => {
    const game = fixture(kind),
      events: GameEvent[] = [];
    let calls = 0;
    await game.stage.execute(
      context(game, events, async () => {
        calls++;
        if (game.ability.source.kind === "native")
          (game.ability.source as { role: Role }).role = Role.Wolf;
        return { name: "inspect_role", args: { target_id: 3 } };
      }),
    );
    expect(calls).toBe(1);
    expect(game.ability.uses).toBe(0);
    expect(game.ability.state.history).toEqual([]);
    expect(events).toEqual([]);
  });
