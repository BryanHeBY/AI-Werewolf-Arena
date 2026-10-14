/**
 * 单元测试：验证野孩子榜样选择、生命替换及真实首波／追加死因。输入为原选择与修改，字面回执、引用、getter、错误、事实及状态为预期；有界选择窗口与数据／配置 reader 不执行中央死亡结算、完整阶段或付费模型。
 */
import { createAliveComponent, createCampComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { inheritRequestAlias } from "../../../../src/core/domain/request_delivery";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Camp, COMPONENT, createVictoryComponent, type BoardConfig, type RoleComponent, type AliveComponent, type GameEvent, type ToolCall, type ActionRequest } from "../../../../src/core";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { WildChildSetupWindow } from "../../../../src/game/mechanisms/roles/wild_child/setup";
import {
  getWildChildState,
  readWildChildTool,
} from "../../../../src/game/mechanisms/roles/wild_child/state-slot";
import {
  wildChildBinding,
  wildChildRequestScope,
  hasActiveWildChild,
  wildChildReady,
} from "../../../../src/game/mechanisms/roles/wild_child/lifecycle";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { readWildChildEventFact } from "@ai-werewolf-arena/game-contract/facts/wild-child";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";

const deck = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];

function fixture(roles = deck, extra: Partial<BoardConfig> = {}) {
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const role = (g: Fixture, id = 1) => g.world.getComponent(id, COMPONENT.Role)!;

const choose = (target_id: number): ToolCall => ({
  name: "choose_wild_model",
  args: { target_id },
});

const setup = (
  g: Fixture,
  getAction: (r: ActionRequest) => Promise<ToolCall | null> = async () => choose(2),
  isCurrent = () => true,
) =>
  new WildChildSetupWindow(g.world, new ToolGateway(), g.events, { get requestFactory() { return GameActionRequestFactory; } }).execute(
    g.config,
    { getAction },
    1,
    isCurrent,
  );

const changes: Record<string, (g: Fixture) => void> = {
  actorLife: (g) => {
    g.world.getComponent(1, COMPONENT.Alive)!.alive = false;
  },
  actorRevive: (g) => {
    const life = g.world.getComponent(1, COMPONENT.Alive)!;
    life.alive = false;
    life.alive = true;
  },
  actorBody: (g) => g.world.addComponent(1, COMPONENT.Alive, createAliveComponent()),
  actorRole: (g) => {
    role(g).role = Role.Villager;
  },
  actorRoleRef: (g) =>
    g.world.addComponent(1, COMPONENT.Role, createRoleComponent(Role.WildChild, Camp.Good)),
  actorState: (g) => {
    (role(g) as { privateState: Readonly<Record<string, unknown>> }).privateState = {
      ...role(g).privateState,
    };
  },
  actorResource: (g) => {
    (getWildChildState(role(g))! as { remaining: 0 | 1 }).remaining = 0;
  },
  camp: (g) => g.world.addComponent(1, COMPONENT.Camp, createCampComponent(Camp.Good)),
  victory: (g) =>
    g.world.addComponent(
      1,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: Camp.Good }]),
    ),
  modelLife: (g) => {
    g.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  },
  modelBody: (g) => g.world.addComponent(2, COMPONENT.Alive, createAliveComponent()),
  modelRole: (g) => {
    role(g, 2).camp = Camp.Good;
  },
  config: (g) => {
    g.config.hooks.onDaybreak = !g.config.hooks.onDaybreak;
  },
};

test("finite public schema/default/roundtrip and internal policy agree; unsupported topology is rejected", () => {
  const g = fixture(),
    doc = boardDefinitionFromConfig("wild", g.config),
    board = parseBoardDefinition(doc);
  expect(board.config.wildChild).toEqual({ policy: "awa_lui_meme_wild_child_v1" });
  expect(boardDefinitionFromConfig("wild", board.config).roles.wild_child).toEqual({
    policy: "awa_lui_meme_wild_child_v1",
  });
  expect(() =>
    parseBoardDefinition({ ...doc, roles: { ...doc.roles, wild_child: { policy: "invented" } } }),
  ).toThrow();
  expect(() =>
    fixture([Role.WildChild, Role.Wolf, Role.Cupid, Role.Villager, Role.Villager, Role.Villager]),
  ).toThrow("role_combination_not_supported");
  expect(() => fixture(deck, { wildChild: { policy: "invented" as never } })).toThrow(
    "wild_child_policy_invalid",
  );
  expect(() =>
    fixture([
      Role.WildChild,
      Role.WildChild,
      Role.Wolf,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ]),
  ).toThrow("role_count_exceeds_limit");
  expect(() => fixture(deck, { events: { pack: "awa_wall_notes_once_v1" } })).toThrow(
    "event_pack_combination_not_supported",
  );
});

for (const target of [2, 4])
  test(`model ${target}: mandatory one-time choice learns neither role nor faction`, async () => {
    const g = fixture();
    expect(
      await setup(g, async (r) => {
        expect(r.context.stage).toBe("wild_child");
        expect(r.context.turn_constraints.min_valid_actions).toBe(1);
        expect(r.context.allow_fallback).toBe(false);
        expect(wildChildRequestScope(g.world, r)).toBe(wildChildBinding(g.world));
        return choose(target);
      }),
    ).toBe(true);
    expect(getWildChildState(role(g))).toEqual({
      policy: "awa_lui_meme_wild_child_v1",
      remaining: 0,
      status: "chosen",
      choice: { day: 1, targetId: target },
      eligibleNight: null,
      activeFromNight: null,
    });
    expect(role(g).camp).toBe(Camp.Good);
    expect(await setup(g)).toBe(true);
    expect(g.events).toHaveLength(1);
    expect(buildAgentVisibleEventFeed(g.world, g.events, 1)).toHaveLength(1);
    expect(buildAgentVisibleEventFeed(g.world, g.events, target)).toEqual([]);
  });

for (const target of [1, 0, 7])
  test(`invalid model ${target} closes the required window without fallback`, async () => {
    const g = fixture();
    await expect(setup(g, async () => choose(target))).rejects.toThrow();
    expect(wildChildReady(g.world)).toBe(false);
    expect(hasActiveWildChild(g.world)).toBe(false);
    expect(g.events).toEqual([]);
    expect(getWildChildState(role(g))?.status).toBe("closed");
  });

test("null required action and original provider error both release authority and preserve the original failure", async () => {
  const g = fixture();
  await expect(setup(g, async () => null)).rejects.toThrow("wild_child_required_choice_missing");
  const h = fixture(),
    err = new TypeError("original");
  Object.freeze(getWildChildState(role(h)));
  let caught: unknown;
  try {
    await setup(h, async () => {
      throw err;
    });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBe(err);
  expect(hasActiveWildChild(h.world)).toBe(false);
  expect(wildChildReady(h.world)).toBe(false);
});

for (const [name, mutate] of Object.entries(changes))
  test(`late ${name} withdrawal performs no choice or faction change`, async () => {
    const g = fixture();
    expect(
      await setup(g, async () => {
        mutate(g);
        return choose(2);
      }),
    ).toBe(false);
    expect(g.events).toEqual([]);
    expect(wildChildReady(g.world)).toBe(false);
    expect(hasActiveWildChild(g.world)).toBe(false);
  });

test("opaque factory request is World-bound and only deadline copies inherit it", async () => {
  const g = fixture(),
    other = fixture();
  await setup(g, async (r) => {
    const timed = { ...r, deadlineAtMs: 200 };
    inheritRequestAlias(r, timed);
    expect(wildChildRequestScope(g.world, timed)).toBeDefined();
    expect(wildChildRequestScope(other.world, timed)).toBeUndefined();
    expect(wildChildRequestScope(g.world, { ...r })).toBeUndefined();
    const altered = { ...r, allowedTools: [] };
    inheritRequestAlias(r, altered);
    expect(wildChildRequestScope(g.world, altered)).toBeUndefined();
    return choose(2);
  });
});

test("strict raw facts reject accessors, extras and self-contradictory causal actor/day", () => {
  let reads = 0;
  expect(
    readWildChildTool({
      name: "choose_wild_model",
      args: {
        get target_id() {
          reads++;
          return 2;
        },
      },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(
    readWildChildTool({ name: "choose_wild_model", args: { target_id: 2, role: "wolf" } }),
  ).toBeNull();
  expect(
    readWildChildEventFact("wild_child_transformed", {
      actorId: 1,
      day: 1,
      eligibleNight: 2,
      camp: "wolf",
      deathCommit: "wild-model:7:8:9",
    }),
  ).toBeNull();
});

for (const field of ["role", "camp", "privateState"] as const)
  test(`late model ${field} accessor rejects without executing target resources`, async () => {
    const g = fixture();
    let reads = 0;
    expect(
      await setup(g, async () => {
        const value = role(g, 2)[field];
        Object.defineProperty(role(g, 2), field, {
          get() {
            reads++;
            return value;
          },
          enumerable: true,
        });
        return choose(2);
      }),
    ).toBe(false);
    expect(reads).toBe(0);
    expect(role(g).camp).toBe(Camp.Good);
    expect(g.events).toEqual([]);
  });
