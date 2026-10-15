/**
 * 单元测试验证公开死亡／遗言政策归一化、有界死亡波披露与变化政策撤销。输入为原阶段／
 * 日数／政策／修改／语言表和受控直接死亡结算；精确字段默认值、翻牌／授予顺序、原生命身份
 * 和无迟到权限断言保持原样，不运行 PhaseManager 周期或加载公开文件。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { expect, test, spyOn } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, DeathCause, Phase, Role, type GameEvent, type BoardConfig, type ActionProvider } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { boardConfigSchema } from "../../../src/domain/board-schema";
import { LastWordsMechanism } from "../../../src/features/last-words/last-words-mechanism";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { buildAgentVisibleEventFeed } from "../../../src/agents/observation/event-feed";
import { getDefaultConfigRenderRegistry } from "../../../src/agents/prompt/config-render-registry";


const roles = [Role.Wolf, Role.Hunter, Role.WolfKing, Role.Villager, Role.Villager, Role.Villager];

const newWords = "netease_2017_day_and_first_night_v1" as const;

const open = "netease_2017_open_v1" as const;

function fixture(
  policy: "awa_initial_wave_v1" | typeof newWords = newWords,
  reveal: "awa_hidden_v1" | typeof open = open,
  day = 1,
) {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.Wolf, count: 1 },
      { role: Role.Hunter, count: 1 },
      { role: Role.WolfKing, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
    lastWords: { policy },
    disclosure: { deathRevealPolicy: reveal },
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const state = { phase: Phase.Day, day, gameOver: false, result: null };
  const gateway = new ToolGateway();
  const resolver = new DeathResolution(
    game.world,
    events,
    gateway,
    new EventRegistry(),
    state,
    config,
  );
  return { ...game, config, events, state, gateway, resolver };
}

const speak: ActionProvider = {
  async getAction() {
    return { name: "speak", args: { text: "words" } };
  },
};

test("public policy defaults normalize omitted, empty and explicit fields and reverse old boards identically", () => {
  const raw = boardDefinitionFromConfig("public_default", sixPlayerMvpConfig);
  const expected = parseBoardDefinition(raw);
  const omitted = structuredClone(raw);
  delete (omitted.mechanisms as Partial<typeof omitted.mechanisms>).disclosure;
  delete (omitted.mechanisms as Partial<typeof omitted.mechanisms>).lastWords;
  for (const mechanisms of [
    omitted.mechanisms,
    { ...omitted.mechanisms, disclosure: {}, lastWords: {} },
    raw.mechanisms,
  ]) {
    const resolved = parseBoardDefinition({ ...raw, mechanisms });
    expect(resolved.config).toEqual(expected.config);
    expect(resolved.definition.mechanisms.disclosure).toEqual({
      deathRevealPolicy: "awa_hidden_v1",
    });
    expect(resolved.definition.mechanisms.lastWords).toEqual({ policy: "awa_initial_wave_v1" });
  }
  for (const [key, value] of [
    ["disclosure", { deathRevealPolicy: "unknown" }],
    ["lastWords", { policy: "unknown" }],
    ["lastWords", { policy: newWords, grantAll: true }],
  ] as const)
    expect(() =>
      parseBoardDefinition({ ...raw, mechanisms: { ...raw.mechanisms, [key]: value } }),
    ).toThrow("board_config_invalid_field");
  expect(
    boardConfigSchema.safeParse({ ...sixPlayerMvpConfig, lastWords: { policy: "unknown" } })
      .success,
  ).toBe(false);
  const variant = fixture().config;
  expect(
    parseBoardDefinition(boardDefinitionFromConfig("public_variant", variant)).config.lastWords,
  ).toEqual(variant.lastWords);
  expect(
    parseBoardDefinition(boardDefinitionFromConfig("public_variant", variant)).config.disclosure,
  ).toEqual(variant.disclosure);
});

for (const phase of [Phase.Day, Phase.Voting, Phase.Night])
  for (const day of [1, 2])
    test(`${phase}/${day}: 2017 last words use death time for every known cause and reject unknown/empty`, async () => {
      const mechanism = new LastWordsMechanism();
      for (const cause of Object.values(DeathCause)) {
        const f = fixture(newWords, open, day);
        const requests: number[] = [];
        await f.resolver.resolve(
          [4],
          { 4: [cause] },
          {
            async getAction(req) {
              requests.push(req.actorId);
              expect(req.context.death_phase).toBe(phase);
              return speak.getAction(req);
            },
          },
          phase,
          Phase.Day,
        );
        expect(requests).toEqual(phase !== Phase.Night || day === 1 ? [4] : []);
        expect(f.events.filter((e) => e.type === "player_role_revealed")).toEqual([
          {
            timestamp: expect.any(Number),
            type: "player_role_revealed",
            payload: { playerId: 4, role: Role.Villager },
          },
        ]);
      }
      expect(mechanism.shouldGrantLastWords(phase, day, [], newWords)).toBe(false);
      expect(mechanism.shouldGrantLastWords(phase, day, ["unknown" as DeathCause], newWords)).toBe(
        false,
      );
    });

for (const policy of ["awa_initial_wave_v1", newWords] as const)
  for (const day of [1, 2])
    test(`${policy}/${day}: actual night-origin three-wave gun chain has no duplicate grants or reveals`, async () => {
      const f = fixture(policy, open, day),
        seen: number[] = [];
      const provider: ActionProvider = {
        async getAction(req) {
          if (req.allowedTools.includes("shoot"))
            return { name: "shoot", args: { target_id: req.actorId === 2 ? 3 : 4 } };
          seen.push(req.actorId);
          return speak.getAction(req);
        },
      };
      await f.resolver.resolve(
        [2],
        { 2: [DeathCause.WolfKill] },
        provider,
        Phase.Night,
        Phase.Day,
        {},
        { nightOriginIds: [2] },
      );
      expect(seen).toEqual(day === 1 ? (policy === newWords ? [2, 3, 4] : [2]) : []);
      expect(
        f.events.filter((e) => e.type === "last_words_granted").map((e) => e.payload.playerId),
      ).toEqual(seen);
      expect(
        f.events.filter((e) => e.type === "player_role_revealed").map((e) => e.payload.playerId),
      ).toEqual([2, 3, 4]);
      expect(f.world.activeDeathActionCount).toBe(0);
      const n = f.events.length;
      await f.resolver.resolve(
        [2, 3, 4],
        { 2: [DeathCause.WolfKill], 3: [DeathCause.Shot], 4: [DeathCause.Shot] },
        provider,
        Phase.Night,
        Phase.Day,
      );
      expect(f.events).toHaveLength(n);
    });

test("daytime shot chains receive last words in every wave; mixed night/day first wave is classified per player", async () => {
  const f = fixture(newWords, open, 2),
    seen: number[] = [];
  await f.resolver.resolve(
    [2, 5],
    { 2: [DeathCause.Exile], 5: [DeathCause.WolfKill] },
    {
      async getAction(req) {
        if (req.allowedTools.includes("shoot"))
          return { name: "shoot", args: { target_id: req.actorId === 2 ? 3 : 4 } };
        seen.push(req.actorId);
        return speak.getAction(req);
      },
    },
    Phase.Night,
    Phase.Day,
    { 2: Phase.Voting, 5: Phase.Night },
    { nightOriginIds: [5] },
  );
  expect(seen).toEqual([2, 3, 4]);
});

test("hidden policy leaves no public role event; open wire excludes resources and repeat settlement only reveals a new life", async () => {
  const hidden = fixture(newWords, "awa_hidden_v1");
  await hidden.resolver.resolve([4], { 4: [DeathCause.SelfDestruct] }, speak, Phase.Day, Phase.Day);
  expect(hidden.events.some((e) => e.type === "player_role_revealed")).toBe(false);
  const f = fixture();
  await f.resolver.resolve([4], { 4: [DeathCause.Exile] }, speak, Phase.Voting, Phase.Day);
  const reveal = f.events.find((e) => e.type === "player_role_revealed")!;
  for (const viewer of [1, 2, 5])
    expect(
      buildAgentVisibleEventFeed(
        f.world,
        [
          {
            ...reveal,
            payload: { ...reveal.payload, camp: "wolf", resources: { secret: true } },
          } as GameEvent,
        ],
        viewer,
      ),
    ).toEqual([
      { seq: 1, type: "player_role_revealed", payload: { playerId: 4, role: Role.Villager } },
    ]);
  f.world.addComponent(4, COMPONENT.Alive, createAliveComponent());
  await f.resolver.resolve([4], { 4: [DeathCause.Exile] }, speak, Phase.Voting, Phase.Day);
  expect(f.events.filter((e) => e.type === "player_role_revealed")).toHaveLength(2);
});

for (const mutation of ["construction", "await", "gateway"] as const)
  test(`${mutation}: last words policy changes revoke provider/commit and close death permission`, async () => {
    const f = fixture();
    let calls = 0;
    const originalCreate = GameActionRequestFactory.prototype.create;
    const construction =
      mutation === "construction"
        ? spyOn(GameActionRequestFactory.prototype, "create").mockImplementation(function (
            this: GameActionRequestFactory,
            input,
          ) {
            const request = originalCreate.call(this, input);
            f.config.lastWords = { policy: "awa_initial_wave_v1" };
            return request;
          })
        : undefined;
    if (mutation === "gateway") {
      const original = f.gateway.validateAndSanitize.bind(f.gateway);
      f.gateway.validateAndSanitize = (...args) => {
        const result = original(...args);
        f.config.lastWords = { policy: "awa_initial_wave_v1" };
        return result;
      };
    }
    try {
      await f.resolver.resolve(
        [4],
        { 4: [DeathCause.SelfDestruct] },
        {
          async getAction(req) {
            calls++;
            if (mutation === "await") f.config.lastWords = { policy: "awa_initial_wave_v1" };
            return speak.getAction(req);
          },
        },
        Phase.Day,
        Phase.Day,
      );
    } finally {
      construction?.mockRestore();
    }
    expect(calls).toBe(mutation === "construction" ? 0 : 1);
    expect(f.events.some((e) => e.type === "last_words_spoken")).toBe(false);
    expect(f.world.activeDeathActionCount).toBe(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: rules distinguish configured public policies without changing default prose`, () => {
    const variant = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(
      fixture().config,
      locale,
    );
    const normal = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(
      sixPlayerMvpConfig,
      locale,
    );
    expect(variant).toContain("2017");
    expect(variant).toContain("player_role_revealed");
    expect(normal).not.toContain("player_role_revealed");
    expect(normal).toContain(locale === "en" ? "receive none" : "均无遗言");
  });

test("removing open-card policy during a pending action stops later wave disclosure", async () => {
  const f = fixture();
  await f.resolver.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction(req) {
        if (req.allowedTools.includes("shoot")) {
          f.config.disclosure = { deathRevealPolicy: "awa_hidden_v1" };
          return { name: "shoot", args: { target_id: req.actorId === 2 ? 3 : 4 } };
        }
        return speak.getAction(req);
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { nightOriginIds: [2] },
  );
  expect(
    f.events.filter((e) => e.type === "player_role_revealed").map((e) => e.payload.playerId),
  ).toEqual([2]);
  expect(
    f.events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
  ).toEqual([2, 3, 4]);
});
