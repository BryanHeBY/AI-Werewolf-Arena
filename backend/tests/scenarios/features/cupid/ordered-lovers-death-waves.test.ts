/**
 * 场景测试以原有限丘比特政策、恋人选择、生命替换及死因为输入。原字面回执、引用／getter／
 * 错误轨迹、事实与状态是预期；真实 DeathResolution 处理初始／追加死亡波、角色 hook、遗言、
 * 枪、梦境／魅惑交互与取消。引擎顺序保持真实，模型由受控 provider 代替，不从生产输出新建 golden。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, DeathCause, Phase, Role, type RoleComponent, type AliveComponent, type GameEvent, type ActionRequest, type ToolCall, type RuntimeSnapshot } from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { CUPID_STAGE } from "../../../../src/game/mechanisms/roles/cupid/night_stage";
import {
  loversRecord,
  projectLover,
  livingOriginalLovers,
} from "../../../../src/game/mechanisms/roles/cupid/relation";
import { cupidCityDecision } from "../../../../src/game/mechanisms/roles/cupid/victory";
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { DreamNightFrame } from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
import { aliveLifeVersion } from "../../../../src/core/domain/components/alive";
import {
  permitsCharm,
  bindCharm,
} from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/wolf_beauty/ports";

const deck = [Role.Cupid, Role.Hunter, Role.Wolf, Role.Villager, Role.Wolf, Role.Villager];

type CupidPolicy = import("../../../../src/core/domain/board").CupidPolicy;

const fixture = (roles = deck, policy: CupidPolicy = "netease_2017_cupid_follows_lovers_v1") => {
  const config = { ...foxBoard(roles), cupid: { policy } };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config };
};

const role = (game: ReturnType<typeof fixture>, id: number) =>
  game.world.getComponent(id, COMPONENT.Role)!;

const life = (game: ReturnType<typeof fixture>, id: number) =>
  game.world.getComponent(id, COMPONENT.Alive)!;

const choose = (a: number, b: number): ToolCall => ({
  name: "choose_lovers",
  args: { first_id: a, second_id: b },
});

function context(
  game: ReturnType<typeof fixture>,
  events: GameEvent[],
  getAction: (request: ActionRequest) => Promise<ToolCall | null>,
  isCurrent = () => true,
) {
  const factory = new GameActionRequestFactory(game.world, events, 1);
  return nightStageContext({
    world: game.world,
    events,
    isCurrent,
    getAliveByRole: (r) => game.world.getAliveEntityIds().filter((id) => role(game, id).role === r),
    actionProvider: { getAction },
    makeRequest: (actorId, tools, extras) =>
      factory.create({
        actorId,
        allowedTools: tools,
        phase: Phase.Night,
        stage: extras.stage,
        requiresAction: extras.requiresAction ?? true,
        summary: "Offline",
        context: extras,
      }),
  });
}

async function connect(
  game: ReturnType<typeof fixture>,
  a: number,
  b: number,
  events: GameEvent[] = [],
) {
  await CUPID_STAGE.execute(context(game, events, async () => choose(a, b)));
  return events;
}

const snapshot = (): RuntimeSnapshot => ({
  day: 1,
  phase: Phase.Day,
  gameOver: false,
  result: null,
});

function resolver(game: ReturnType<typeof fixture>, events: GameEvent[]) {
  return new DeathResolution(
    game.world,
    events,
    new ToolGateway(),
    new EventRegistry(),
    snapshot(),
    game.config,
  );
}

test("cancelled death settlement has no events/consumption, then original legitimate wave still settles once", async () => {
  const game = fixture(),
    events: GameEvent[] = [];
  await connect(game, 1, 2);
  const resolution = resolver(game, events);
  await resolution.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction() {
        throw new Error("unexpected");
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2], isCurrent: () => false },
  );
  expect(events).toEqual([]);
  expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  const guns: number[] = [];
  await resolution.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction(request) {
        if (request.allowedTools.includes("shoot")) {
          guns.push(request.actorId);
          return { name: "shoot", args: { target_id: 3 } };
        }
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2] },
  );
  expect(guns).toEqual([2]);
  expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
  expect(events.filter((e) => e.type === "lovers_death").map((e) => e.payload)).toEqual([
    { actorId: 2, targetId: 1 },
  ]);
});

for (const both of [false, true])
  test(`Hunter lovers: two independent seeds=${both} qualify before any gun request; root never gets reverse heartbeat`, async () => {
    const game = fixture([Role.Cupid, Role.Hunter, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 2, 4);
    const guns: number[] = [];
    await resolver(game, events).resolve(
      both ? [2, 4] : [2],
      both ? { 2: [DeathCause.WolfKill], 4: [DeathCause.Exile] } : { 2: [DeathCause.WolfKill] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) {
            guns.push(request.actorId);
            return { name: "shoot", args: { target_id: 3 } };
          }
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Night,
      Phase.Day,
      {},
      { nightOriginIds: [2] },
    );
    expect(guns).toEqual(both ? [] : [2]);
    expect(life(game, 2).alive).toBe(false);
    expect(life(game, 4).alive).toBe(false);
  });

for (const night of [false, true])
  test(`paid Dreamer night=${night}: Cupid closure precedes Dream-target gun qualification`, async () => {
    const game = fixture([Role.Cupid, Role.Dreamer, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 1, 2);
    const actorLife = life(game, 2),
      targetLife = life(game, 4),
      dreams = new DreamNightFrame([
        {
          actorId: 2,
          targetId: 4,
          day: 1,
          consecutive: false,
          actorLife,
          actorVersion: aliveLifeVersion(actorLife),
          targetLife,
          targetVersion: aliveLifeVersion(targetLife),
        },
      ]);
    const guns: number[] = [];
    await resolver(game, events).resolve(
      [1],
      { 1: [night ? DeathCause.WolfKill : DeathCause.Exile] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) guns.push(request.actorId);
          return { name: "speak", args: { text: "last" } };
        },
      },
      night ? Phase.Night : Phase.Day,
      Phase.Day,
      {},
      { dreams, nightOriginIds: night ? [1] : [] },
    );
    expect(life(game, 4).alive).toBe(!night);
    expect(guns).toEqual([]);
    expect(events.some((e) => e.type === "dream_death")).toBe(night);
  });

for (const policy of ["awa_exile_poison_v1", "heroes_s7_2017_exile_hunter_v1"] as const)
  test(`${policy}: Beauty poison+heartbreak does not charm a third player`, async () => {
    const game = fixture([Role.Cupid, Role.WolfBeauty, Role.Wolf, Role.Hunter, Role.Villager]),
      events: GameEvent[] = [];
    await connect(game, 1, 2);
    const beauty = getWolfBeautyState(role(game, 2))!;
    (
      beauty as {
        deathLinkPolicy: "awa_exile_poison_v1" | "heroes_s7_2017_exile_hunter_v1" | undefined;
      }
    ).deathLinkPolicy = policy;
    (beauty as { targetId: number | null }).targetId = 4;
    bindCharm(game.world, 2, 4);
    await resolver(game, events).resolve(
      [1, 2],
      { 1: [DeathCause.Exile], 2: [DeathCause.Poison] },
      {
        async getAction() {
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(life(game, 4).alive).toBe(true);
    expect(events.some((e) => e.type === "charm_death")).toBe(false);
    for (const cause of Object.values(DeathCause))
      expect(permitsCharm([cause, DeathCause.Lovers], policy, true)).toBe(false);
  });

test("paid relation survives Cupid/partner role replacement, while revived or replaced lives do not inherit it", async () => {
  const game = fixture();
  await connect(game, 2, 3);
  const record = loversRecord(game.world)!;
  role(game, 1).role = Role.Villager;
  (role(game, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
  life(game, 1).alive = false;
  role(game, 2).role = Role.Villager;
  (role(game, 2) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
  expect(loversRecord(game.world)).toBe(record);
  expect(projectLover(game.world, 2)).toEqual({ partnerId: 3, mayNotVotePartner: false });
  await resolver(game, []).resolve(
    [2],
    { 2: [DeathCause.Exile] },
    {
      async getAction() {
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(life(game, 3).alive).toBe(false);
  life(game, 2).alive = true;
  life(game, 3).alive = true;
  for (const id of [4, 5, 6]) life(game, id).alive = false;
  expect(livingOriginalLovers(game.world)).toBe(false);
  expect(projectLover(game.world, 2)).toBeNull();
  expect(cupidCityDecision(game.world)!.decision).toBeNull();
  game.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
  const events: GameEvent[] = [];
  await resolver(game, events).resolve(
    [3],
    { 3: [DeathCause.Poison] },
    {
      async getAction() {
        return { name: "speak", args: { text: "last" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(life(game, 2).alive).toBe(true);
  expect(events.some((e) => e.type === "lovers_death")).toBe(false);
});

for (const causes of [[DeathCause.Lovers], []])
  test(`external lethal wave with causes=${JSON.stringify(causes)} still closes paid relationship`, async () => {
    const game = fixture(),
      events: GameEvent[] = [];
    await connect(game, 2, 4);
    await resolver(game, events).resolve(
      [2],
      { 2: causes },
      {
        async getAction() {
          return { name: "speak", args: { text: "last" } };
        },
      },
      Phase.Day,
      Phase.Day,
    );
    expect(life(game, 2).alive).toBe(false);
    expect(life(game, 4).alive).toBe(false);
    expect(events.filter((e) => e.type === "lovers_death").map((e) => e.payload)).toEqual([
      { actorId: 2, targetId: 4 },
    ]);
  });
