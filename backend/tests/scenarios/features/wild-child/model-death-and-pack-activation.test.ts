/**
 * 野孩子榜样场景以原选择、生命替换与真实初始／追加死因为输入。原字面回执、引用／getter／
 * 错误轨迹、事实与状态是预期；真实中央死亡结算及完整 PhaseManager 周期驱动转阵营、实际
 * 死亡波和下一夜狼群激活。模型受控，不从生产输出新建 golden。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  COMPONENT,
  DeathCause,
  type BoardConfig,
  type RoleComponent,
  type AliveComponent,
  type GameEvent,
  type ToolCall,
  type ActionRequest,
  type VictoryComponent,
} from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { WildChildSetupWindow } from "../../../../src/game/mechanisms/roles/wild_child/setup";
import { getWildChildState } from "../../../../src/game/mechanisms/roles/wild_child/state";
import {
  openWildChildNight,
  projectWildChild,
} from "../../../../src/game/mechanisms/roles/wild_child/lifecycle";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import {
  getDefaultRoleCatalog,
  getDefaultWinConditionRegistry,
} from "../../../../src/game/mechanisms";
import {
  knownWolfTeammates,
  wolfKnifeHolders,
  wolfTeamPermissions,
  wolfTeamEvent,
} from "../../../../src/game/mechanisms/roles/wolf_team";
import { ConditionRegistry } from "../../../../src/core/domain/registries/condition_registry";
import { WinCondition } from "../../../../src/core";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";
import { readWildChildEventFact } from "@ai-werewolf-arena/game-text";

const deck = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];

function fixture(roles = deck, extra: Partial<BoardConfig> = {}) {
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const role = (g: Fixture, id = 1) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const choose = (target_id: number): ToolCall => ({
  name: "choose_wild_model",
  args: { target_id },
});

const setup = (
  g: Fixture,
  getAction: (r: ActionRequest) => Promise<ToolCall | null> = async () => choose(2),
  isCurrent = () => true,
) =>
  new WildChildSetupWindow(g.world, new ToolGateway(), g.events).execute(
    g.config,
    { getAction },
    1,
    isCurrent,
  );

async function deaths(
  g: Fixture,
  ids: number[],
  source = DeathCause.Exile,
  shotTarget: number | null = null,
  day = 1,
) {
  const resolver = new DeathResolution(
    g.world,
    g.events,
    new ToolGateway(),
    new EventRegistry(),
    { day, phase: Phase.Day, gameOver: false, result: null },
    g.config,
  );
  await resolver.resolve(
    ids,
    Object.fromEntries(ids.map((id) => [id, [source]])),
    {
      async getAction(r) {
        if (r.context.stage === "last_words") return { name: "speak", args: { text: "Raw" } };
        return { name: "shoot", args: { target_id: shotTarget } };
      },
    },
    source === DeathCause.WolfKill || source === DeathCause.Poison ? Phase.Night : Phase.Day,
    Phase.Day,
  );
}

for (const source of [
  DeathCause.WolfKill,
  DeathCause.Poison,
  DeathCause.Exile,
  DeathCause.Shot,
  DeathCause.SelfDestruct,
])
  test(`${source}: actual model death synchronously changes faction and waits for the following actual night`, async () => {
    const g = fixture(),
      original = role(g);
    await setup(g);
    await deaths(g, [2], source);
    expect(role(g)).toBe(original);
    expect(role(g).role).toBe(Role.WildChild);
    expect(role(g).camp).toBe(Camp.Wolf);
    expect(g.world.getComponent<VictoryComponent>(1, COMPONENT.Victory)!.affiliations).toEqual([
      { kind: "faction", faction: Camp.Wolf },
    ]);
    expect(getWildChildState(role(g))?.status).toBe("transformed");
    expect(getWildChildState(role(g))?.eligibleNight).toBe(2);
    const catalog = getDefaultRoleCatalog();
    expect(knownWolfTeammates(g.world, 3, catalog)).toEqual([2]);
    expect(wolfKnifeHolders(g.world, catalog)).toEqual([3]);
    const close1 = openWildChildNight(g.world, 1, g.events);
    close1();
    expect(getWildChildState(role(g))?.status).toBe("transformed");
    const close2 = openWildChildNight(g.world, 2, g.events);
    close2();
    expect(knownWolfTeammates(g.world, 3, catalog)).toEqual([1, 2]);
    expect(knownWolfTeammates(g.world, 1, catalog)).toEqual([2, 3]);
    expect(wolfKnifeHolders(g.world, catalog)).toEqual([1, 3]);
    expect(getDefaultRoleCatalog().requireRuntime(Role.WildChild).canSelfDestruct).toBe(false);
    expect(getDefaultRoleCatalog().requireRuntime(Role.Wolf).canSelfDestruct).toBe(true);
    const privateFacts = buildAgentVisibleEventFeed(g.world, g.events, 1);
    expect(privateFacts.some((e) => e.type === "wild_child_model_eliminated")).toBe(false);
    const p = privateFacts.find((e) => e.type === "wild_child_transformed")!.payload;
    expect(p.deathCommit).toBeUndefined();
    expect(p.sources).toBeUndefined();
    expect(
      buildAgentVisibleEventFeed(g.world, g.events, 3).filter((e) =>
        e.type.startsWith("wild_child_"),
      ),
    ).toEqual([]);
    const causal = g.events.find((e) => e.type === "wild_child_model_eliminated")!;
    expect(readWildChildEventFact(causal.type, causal.payload)).not.toBeNull();
  });

for (const ids of [
  [1, 2],
  [2, 1],
])
  test(`whole first wave ${ids} leaves simultaneous dead child Good`, async () => {
    const g = fixture();
    await setup(g);
    await deaths(g, ids);
    expect(role(g).camp).toBe(Camp.Good);
    expect(g.events.some((e) => e.type === "wild_child_transformed")).toBe(false);
  });

for (const ids of [
  [3, 4],
  [4, 3],
])
  test(`two Hunter roots ${ids} kill model/child in one added wave independently of order`, async () => {
    const g = fixture([
      Role.WildChild,
      Role.Villager,
      Role.Hunter,
      Role.Hunter,
      Role.Wolf,
      Role.Villager,
    ]);
    await setup(g);
    await new DeathResolution(
      g.world,
      g.events,
      new ToolGateway(),
      new EventRegistry(),
      { day: 1, phase: Phase.Day, gameOver: false, result: null },
      g.config,
    ).resolve(
      ids,
      Object.fromEntries(ids.map((id) => [id, [DeathCause.Exile]])),
      {
        async getAction(r) {
          return r.context.stage === "last_words"
            ? { name: "speak", args: { text: "Raw" } }
            : { name: "shoot", args: { target_id: r.actorId === 3 ? 2 : 1 } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(role(g).camp).toBe(Camp.Good);
    expect(g.world.getAliveEntityIds()).toEqual([5, 6]);
    expect(g.events.some((e) => e.type === "wild_child_transformed")).toBe(false);
  });

test("Hunter model first dies then shoots Child in the next wave: Wolf death, no activation", async () => {
  const g = fixture([Role.WildChild, Role.Hunter, Role.Wolf, Role.Villager, Role.Seer, Role.Witch]);
  await setup(g);
  await deaths(g, [2], DeathCause.Exile, 1);
  expect(role(g).camp).toBe(Camp.Wolf);
  expect(g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive).toBe(false);
  expect(g.events.filter((e) => e.type === "wild_child_transformed")).toHaveLength(1);
  const close = openWildChildNight(g.world, 2, g.events);
  close();
  expect(g.events.some((e) => e.type === "wild_child_pack_activated")).toBe(false);
});

for (const change of ["modelRevive", "modelReplace", "childRevive"] as const)
  test(`${change}: external new life cannot trigger or activate an old relationship`, async () => {
    const g = fixture();
    await setup(g);
    const id = change === "childRevive" ? 1 : 2;
    if (change === "modelReplace")
      g.world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    else {
      const life = g.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    await deaths(g, [2]);
    expect(role(g).camp).toBe(Camp.Good);
    const close = openWildChildNight(g.world, 2, g.events);
    close();
    expect(g.events.some((e) => e.type === "wild_child_pack_activated")).toBe(false);
  });

test("accepted model binding survives later role/camp change without learning or copying it", async () => {
  const g = fixture();
  await setup(g);
  role(g, 2).role = Role.Villager;
  role(g, 2).camp = Camp.Good;
  await deaths(g, [2]);
  expect(role(g).camp).toBe(Camp.Wolf);
  expect(role(g).privateState).toHaveProperty("wildChild");
  expect(Object.keys(role(g).privateState)).toEqual(["wildChild"]);
});

test("raw external dead flip does not trigger a model elimination", async () => {
  const g = fixture();
  await setup(g);
  g.world.getComponent<AliveComponent>(2, COMPONENT.Alive)!.alive = false;
  await deaths(g, [2]);
  expect(role(g).camp).toBe(Camp.Good);
  expect(g.events.some((e) => e.type === "wild_child_model_eliminated")).toBe(false);
});

test("active dead Child retains pack knowledge while losing chat/knife; revival never restores actions", async () => {
  const g = fixture();
  await setup(g);
  await deaths(g, [2]);
  openWildChildNight(g.world, 2, g.events)();
  await deaths(g, [1]);
  const c = getDefaultRoleCatalog();
  expect(knownWolfTeammates(g.world, 3, c)).toEqual([1, 2]);
  expect(wolfTeamPermissions(role(g), c, g.world).canChat).toBe(false);
  expect(wolfKnifeHolders(g.world, c)).toEqual([3]);
  g.world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = true;
  expect(wolfTeamPermissions(role(g), c, g.world).canChat).toBe(false);
});

test("private resource accessors revoke death trigger/pack access without executing getters", async () => {
  for (const stage of ["chosen", "active"]) {
    const g = fixture();
    await setup(g);
    if (stage === "active") {
      await deaths(g, [2]);
      openWildChildNight(g.world, 2, g.events)();
    }
    let reads = 0;
    Object.defineProperty(getWildChildState(role(g))!, "status", {
      get() {
        reads++;
        return stage;
      },
      enumerable: true,
    });
    if (stage === "chosen") await deaths(g, [2]);
    expect(wolfTeamPermissions(role(g), getDefaultRoleCatalog(), g.world).canChat).toBe(false);
    expect(projectWildChild(g.world, role(g))?.status).toBe("closed");
    expect(reads).toBe(0);
  }
});

test("current queries never activate an eligible child or backfill old wolf events", async () => {
  const g = fixture();
  await setup(g);
  const old = wolfTeamEvent(g.world, getDefaultRoleCatalog(), {
    timestamp: 1,
    type: "wolf_discussion",
    payload: { actorId: 3, text: "old", endChat: false, round: 1 },
  } as never);
  await deaths(g, [2]);
  for (let i = 0; i < 5; i++) wolfTeamPermissions(role(g), getDefaultRoleCatalog(), g.world);
  expect(getWildChildState(role(g))?.status).toBe("transformed");
  openWildChildNight(g.world, 5, g.events)();
  expect(getWildChildState(role(g))?.activeFromNight).toBe(5);
  expect(buildAgentVisibleEventFeed(g.world, [old], 1)).toEqual([]);
});

test("last original Wolf model does not seal Good before Child transformation; PM next night activates once", async () => {
  const g = fixture([Role.WildChild, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager]);
  let choices = 0,
    reentered = 0;
  const provider = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      const stage = r.context.stage;
      if (stage === "wild_child") {
        choices++;
        return choose(2);
      }
      if (stage === "seer") return { name: "check_identity", args: { target_id: 6 } };
      if (stage === "witch")
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: "none" as never } };
      if (stage === "wolf_discussion")
        return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
      if (stage === "wolf_vote")
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (stage === "day_speech" || stage === "last_words") {
        const before = g.phaseManager.getSnapshot(),
          n = g.phaseManager.getEvents().length;
        await expect(
          g.phaseManager.runSingleCycle({ getAction: async () => null }),
        ).rejects.toThrow("wild_child_cycle_reentry");
        expect(g.phaseManager.getSnapshot()).toEqual(before);
        expect(g.phaseManager.getEvents()).toHaveLength(n);
        reentered++;
        return { name: "speak", args: { text: "Raw" } };
      }
      if (stage === "voting") {
        const target = r.context.day === 1 ? 2 : 1;
        return {
          name: "vote",
          args: { target_id: r.actorId === target ? null : target, abstain: r.actorId === target },
        };
      }
      return null;
    },
  };
  const first = await g.phaseManager.runSingleCycle(provider);
  expect(first.gameOver).toBe(false);
  expect(role(g).camp).toBe(Camp.Wolf);
  expect(
    new ConditionRegistry(getDefaultWinConditionRegistry()).evaluate(
      g.world,
      WinCondition.SlaughterCity,
    ),
  ).toBeNull();
  const final = await g.phaseManager.runSingleCycle(provider);
  expect(final.gameOver).toBe(true);
  expect(final.result?.winner).toBe(Camp.Good);
  expect(choices).toBe(1);
  expect(reentered).toBeGreaterThan(0);
  expect(
    g.phaseManager.getEvents().filter((e) => e.type === "wild_child_pack_activated"),
  ).toHaveLength(1);
});

for (const mode of ["guard", "heal", "idiot"] as const)
  test(`${mode}: actual survived model is not an elimination or transformation`, async () => {
    const model = mode === "idiot" ? 6 : 2,
      g = fixture([
        Role.WildChild,
        Role.Wolf,
        Role.Wolf,
        Role.Seer,
        Role.Witch,
        mode === "idiot" ? Role.Idiot : Role.Guard,
      ]);
    await g.phaseManager.runSingleCycle({
      async getAction(r: ActionRequest): Promise<ToolCall | null> {
        switch (r.context.stage) {
          case "wild_child":
            return choose(model);
          case "wolf_discussion":
            return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
          case "wolf_vote":
            return {
              name: "kill_vote",
              args: { target_id: mode === "idiot" ? null : model, abstain: mode === "idiot" },
            };
          case "guard":
            return {
              name: "guard",
              args: { target_id: mode === "guard" ? model : null, abstain: mode !== "guard" },
            };
          case "seer":
            return { name: "check_identity", args: { target_id: 3 } };
          case "witch":
            return {
              name: "use_potion",
              args: {
                target_id: mode === "heal" ? model : 5,
                potion_type: (mode === "heal" ? "heal" : "none") as never,
              },
            };
          case "day_speech":
          case "last_words":
            return { name: "speak", args: { text: "Raw" } };
          case "voting":
            return {
              name: "vote",
              args: {
                target_id: mode === "idiot" && r.actorId !== model ? model : null,
                abstain: mode !== "idiot" || r.actorId === model,
              },
            };
          default:
            return null;
        }
      },
    });
    expect(g.world.getComponent<AliveComponent>(model, COMPONENT.Alive)?.alive).toBe(true);
    expect(role(g).camp).toBe(Camp.Good);
    expect(
      g.phaseManager
        .getEvents()
        .filter(
          (e) => e.type === "wild_child_model_eliminated" || e.type === "wild_child_transformed",
        ),
    ).toEqual([]);
  });
