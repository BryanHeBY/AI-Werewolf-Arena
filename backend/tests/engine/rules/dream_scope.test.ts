import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type GameEvent,
  type RoleComponent,
} from "../../../src/core";
import { AliveComponent } from "../../../src/core/domain/components/alive";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { transferNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { DREAMER_NIGHT_STAGE } from "../../../src/game/mechanisms/roles/dreamer/night_stages";
import { hasDreamNightCommit } from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";

function fixture() {
  const roles = [Role.Dreamer, Role.Dreamer, Role.Wolf, Role.Hunter, Role.Villager, Role.Villager];
  const config = {
    ...sixPlayerMvpConfig,
    winConditions: [WinCondition.SlaughterCity],
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((candidate) => candidate === role).length,
    })),
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const role = (actorId: number) =>
    game.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
  return { ...game, role, ability: (actorId: number) => findNightAbility(role(actorId), "dream")! };
}

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: NightStageContext["actionProvider"]["getAction"],
): NightStageContext {
  const requests = new GameActionRequestFactory(game.world, events, 1);
  const unused = (): never => {
    throw new Error("unused_dream_stage_dependency");
  };
  return {
    world: game.world,
    events,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent: () => true,
    currentDay: () => 1,
    previousExile: null,
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: "Dream scope regression",
        context: extra,
      }),
    getAliveByRole: unused,
    ensureMarks: unused,
    pickMajorityTarget: unused,
    shuffleWolves: unused,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      dreamLinks: [],
    },
  };
}

for (const change of ["disabled", "spent", "transferred"] as const)
  test(`${change}: a revoked later dream actor gets no request while the earlier committed prefix remains`, async () => {
    const game = fixture(),
      events: GameEvent[] = [],
      later = game.ability(2),
      laterState = later.state,
      calls: number[] = [];
    const ctx = context(game, events, async (request) => {
      calls.push(request.actorId);
      if (request.actorId === 1) {
        if (change === "disabled") later.disabled = true;
        if (change === "spent") {
          later.maxUses = 1;
          later.uses = 1;
        }
        if (change === "transferred")
          transferNightAbility(game.world, 2, 6, later.id, "transfer:dream", [], {
            kind: "dream",
            statePolicy: (state) => ({ ...state, history: [...state.history] }),
          });
      }
      return { name: "dream", args: { target_id: 5 } };
    });
    await DREAMER_NIGHT_STAGE.execute(ctx);
    expect(calls).toEqual([1]);
    expect(game.ability(1).state.history).toEqual([{ day: 1, targetId: 5 }]);
    expect(game.ability(1).uses).toBe(1);
    expect(laterState.history).toEqual([]);
    expect(later.lastUsedDay).toBeNull();
    expect(later.uses).toBe(change === "spent" ? 1 : 0);
    expect(ctx.state.dreamLinks.map((link) => link.actorId)).toEqual([1]);
    expect(
      events
        .filter((event) => event.type === "dream_applied")
        .map((event) => event.payload.actorId),
    ).toEqual([1]);
    expect(hasDreamNightCommit(game.world, 1)).toBe(true);
    if (change === "transferred") expect(game.ability(6).uses).toBe(0);
  });

for (const point of ["await", "gateway"] as const)
  for (const change of [
    "source",
    "source_owner",
    "id",
    "activation",
    "private_owner",
    "life",
    "day",
    "starts",
    "max_uses",
  ] as const)
    test(`${point}/${change}: a changed dream scope cannot commit or consume a pending reply`, async () => {
      const game = fixture(),
        events: GameEvent[] = [],
        ability = game.ability(1),
        originalState = ability.state;
      game.ability(2).disabled = true;
      let calls = 0,
        day = 1;
      const revoke = () => {
        if (change === "source") ability.source = { kind: "gift", actorId: 3 };
        if (change === "source_owner" && ability.source.kind === "native")
          ability.source.role = Role.Wolf;
        if (change === "id") ability.id = "native:renamed";
        if (change === "activation") ability.activation = "lucky";
        if (change === "private_owner")
          game.role(1).privateState = { ...game.role(1).privateState };
        if (change === "life") {
          const life = game.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!;
          life.alive = false;
          life.alive = true;
        }
        if (change === "day") day = 2;
        if (change === "starts") ability.startsOnDay = 0;
        if (change === "max_uses") ability.maxUses = 2;
      };
      const ctx = context(game, events, async () => {
        calls++;
        if (point === "await") revoke();
        return { name: "dream", args: { target_id: 5 } };
      });
      ctx.currentDay = () => day;
      if (point === "gateway") {
        const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
        ctx.toolGateway.validateAndSanitize = (world, actorId, call, validationContext) => {
          const result = validate(world, actorId, call, validationContext);
          revoke();
          return result;
        };
      }
      await DREAMER_NIGHT_STAGE.execute(ctx);
      expect(calls).toBe(1);
      expect(originalState).toEqual({ lastTarget: null, lastDay: null, history: [] });
      expect(ability.uses).toBe(0);
      expect(ability.lastUsedDay).toBeNull();
      expect(ctx.state.dreamLinks).toEqual([]);
      expect(events).toEqual([]);
      expect(hasDreamNightCommit(game.world, 1)).toBe(false);
    });
