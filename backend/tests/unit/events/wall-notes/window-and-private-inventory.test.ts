/**
 * 单元测试验证纸条窗口、原纸张／Unicode／随机／请求矩阵及首投票／终态边界。预期来自字面回执、原引用和 getter／错误轨迹。仅尝试被拒绝的阶段重入，记录器 flush 使用内存惰性 manager，不运行完整游戏或文件持久化。
 */
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../../src/runtime/game_event_recorder";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { expect, test } from "bun:test";
import { inheritRequestAlias } from "../../../../src/domain/request-delivery";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  Camp,
  Phase,
  createRandom,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
  type WallNoteComponent,
  type RoleComponent,
} from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { WallNotesWindow } from "../../../../src/game/mechanisms/events/wall_notes/window";
import {
  hasWallCommit,
  hasActiveWall,
  projectWallNote,
  openWall,
  grantWallNote,
  closeWall,
  authorizedWallAuthor,
  wallRequestScope,
} from "../../../../src/game/mechanisms/events/wall_notes/authority";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { validWallText, readWallTool, readWallEventFact } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import { wallEventLabel } from "@ai-werewolf-arena/game-presentation";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";

const roles = [Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];

function fixture(deck = roles) {
  const config = { ...foxBoard(deck), events: { pack: "awa_wall_notes_once_v1" as const } };
  return { ...bootstrapGame(config, { fixedRoles: deck }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const note = (g: Fixture, id: number) =>
  g.world.getComponent(id, COMPONENT.WallNote)!;

const role = (g: Fixture, id: number) => g.world.getComponent(id, COMPONENT.Role)!;

const text = (body: string): ToolCall => ({ name: "write_note", args: { text: body } });

async function run(
  g: Fixture,
  provider: (r: ActionRequest) => Promise<ToolCall | null>,
  current = () => true,
  day = 1,
  gateway = new ToolGateway(),
  factory = new GameActionRequestFactory(g.world, g.events, day),
  random = () => createRandom("wall-fixed").fork("wall_notes"),
) {
  await new WallNotesWindow(g.world, gateway, g.events).execute(
    g.config,
    factory,
    { getAction: provider },
    day,
    current,
    random,
  );
}

const publicTexts = (g: Fixture) =>
  g.events.find((e) => e.type === "wall_notes_published")?.payload;

test("scenario hook overrides cannot contaminate other games or the shared default", () => {
  const first = foxBoard(roles),
    second = foxBoard(roles);
  expect(first.hooks).not.toBe(second.hooks);
  const before = { ...second.hooks };
  first.hooks.onPreVote = !before.onPreVote;
  first.hooks.onPerSpeechGap = !before.onPerSpeechGap;
  expect(second.hooks).toEqual(before);
  expect(foxBoard(roles).hooks).toEqual(before);
});

test("explicit schema/reverse off and supported seven roles; both entrances reject unsupported", () => {
  const g = fixture(),
    definition = boardDefinitionFromConfig("wall_fixture", g.config);
  expect(definition.mechanisms.eventPack).toBe("awa_wall_notes_once_v1");
  expect(parseBoardDefinition(definition).config.events).toEqual(g.config.events);
  const unsupported = {
    ...g.config,
    roleSetups: [
      { role: Role.Debater, count: 1 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 4 },
    ],
  };
  expect(() => bootstrapGame(unsupported)).toThrow("event_pack_combination_not_supported");
  expect(() => boardDefinitionFromConfig("wall_bad", unsupported)).toThrow(
    "board_config_role_combination_not_supported",
  );
  expect(
    boardDefinitionFromConfig("wall_off", foxBoard(roles)).mechanisms.eventPack,
  ).toBeUndefined();
});

test("off/day2/not current never commit/fork/grant/request", async () => {
  for (const kind of ["off", "day2", "phase"]) {
    const g = fixture();
    if (kind === "off") g.config.events = undefined as any;
    let count = 0;
    await run(
      g,
      async () => {
        count++;
        return null;
      },
      () => kind !== "phase",
      kind === "day2" ? 2 : 1,
      undefined,
      undefined,
      () => {
        throw new Error("forked");
      },
    );
    expect(count).toBe(0);
    expect(g.events).toEqual([]);
    expect(hasWallCommit(g.world)).toBe(false);
    expect(g.world.getComponent(1, COMPONENT.WallNote)).toBeUndefined();
  }
});

test("all requests constructed first, optional exact constraints, no partial feed, literals retained and expired", async () => {
  const g = fixture(),
    requests: ActionRequest[] = [];
  let constructed = 0;
  const factory = new GameActionRequestFactory(g.world, g.events, 1),
    original = factory.create.bind(factory);
  factory.create = (input) => {
    constructed++;
    return original(input);
  };
  await run(
    g,
    async (r) => {
      expect(constructed).toBe(6);
      requests.push(r);
      expect(r.context.turn_constraints.min_valid_actions).toBe(0);
      expect(r.context.turn_constraints.max_valid_actions).toBe(1);
      expect(r.context.allow_fallback).toBe(false);
      expect(r.context.item_instance_id).toBe(`wall:1:${r.actorId}`);
      expect(r.context.visible_events.some((e) => e.type === "wall_note_changed")).toBe(false);
      return text(r.actorId === 1 ? "  [God] 玩家6💌  " : "same");
    },
    undefined,
    1,
    undefined,
    factory,
  );
  expect(requests).toHaveLength(6);
  expect((publicTexts(g) as any).texts).toContain("  [God] 玩家6💌  ");
  expect(
    g.events.filter((e) => e.type === "wall_note_changed" && e.payload.operation === "accepted"),
  ).toHaveLength(6);
  for (let id = 1; id <= 6; id++) {
    expect(note(g, id).remaining).toBe(0);
    expect(note(g, id).expired).toBe(true);
    expect(projectWallNote(g.world, id)?.effectiveRemaining).toBe(0);
  }
  for (const e of g.events) expect(readWallEventFact(e.type, e.payload)).not.toBeNull();
  expect(hasActiveWall(g.world)).toBe(false);
  await run(g, async () => {
    throw new Error("reopened");
  });
  expect(g.events.filter((e) => e.type === "wall_notes_started")).toHaveLength(1);
});

for (const bad of ["", " \n\t", "x".repeat(161), "\ud800", "\udc00", 123])
  test(`invalid note ${JSON.stringify(bad)} zero consumption and empty publish`, async () => {
    const g = fixture();
    await run(g, async () => ({ name: "write_note", args: { text: bad } }) as ToolCall);
    expect((publicTexts(g) as any).texts).toEqual([]);
    expect(note(g, 1).remaining).toBe(1);
    expect(
      g.events.filter((e) => e.type === "wall_note_changed" && e.payload.operation === "accepted"),
    ).toEqual([]);
  });

test("codepoint limit, blank and malformed UTF16 distinguish valid prefixes", () => {
  expect(validWallText("💌".repeat(160))).toBe(true);
  expect(validWallText("💌".repeat(161))).toBe(false);
  expect(validWallText("[God] x")).toBe(true);
  expect(validWallText("\ud800a")).toBe(false);
});

test("getter/extra unsafe text is never executed nor accepted", async () => {
  let reads = 0;
  const args = {
    get text() {
      reads++;
      return "secret";
    },
  };
  expect(readWallTool({ name: "write_note", args })).toBeNull();
  const g = fixture();
  await run(g, async () => ({ name: "write_note", args }));
  expect(reads).toBe(0);
  expect((publicTexts(g) as any).texts).toEqual([]);
  expect(readWallTool({ name: "write_note", args: { text: "x", extra: 1 } })).toBeNull();
});

test("null optional grants expire without fabricated notes", async () => {
  const g = fixture();
  await run(g, async () => null);
  expect((publicTexts(g) as any).texts).toEqual([]);
  expect(note(g, 1)).toMatchObject({ remaining: 1, expired: true });
});

test("canonical anonymous multiset invariant under author and completion permutation", async () => {
  const texts = ["a", "b", "a", "[God] 1", "💌", "  c "];
  const first = fixture(),
    second = fixture();
  await run(first, async (r) => text(texts[r.actorId - 1]));
  await run(second, async (r) => {
    await Promise.resolve();
    return text(texts[6 - r.actorId]);
  });
  expect(publicTexts(first)).toEqual(publicTexts(second));
  const feed = buildAgentVisibleEventFeed(first.world, first.events, 3);
  expect(feed.map((e) => e.type)).toEqual(["wall_notes_started", "wall_notes_published"]);
  expect(JSON.stringify(feed)).not.toContain("instanceId");
  expect(JSON.stringify(feed)).not.toContain("actorId");
});

for (const mutation of [
  "death",
  "revive",
  "role",
  "camp",
  "state",
  "component",
  "instance",
  "source_ref",
  "source_field",
  "remaining",
  "expired",
])
  test(`late ${mutation} revokes only author without consumption`, async () => {
    const g = fixture();
    await run(g, async (r) => {
      if (r.actorId === 6) {
        const n = note(g, 1),
          rc = role(g, 1);
        switch (mutation) {
          case "death":
            g.world.getComponent(1, COMPONENT.Alive)!.alive = false;
            break;
          case "revive": {
            const alive = g.world.getComponent(1, COMPONENT.Alive)!;
            alive.alive = false;
            alive.alive = true;
            break;
          }
          case "role":
            rc.role = Role.Villager;
            break;
          case "camp":
            g.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
            break;
          case "state":
            (rc as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
            break;
          case "component":
            g.world.addComponent(1, COMPONENT.WallNote, { ...n });
            break;
          case "instance":
            n.instanceId = "wrong";
            break;
          case "source_ref":
            n.source = { ...n.source };
            break;
          case "source_field":
            n.source.day = 2 as any;
            break;
          case "remaining":
            n.remaining = 0;
            break;
          case "expired":
            n.expired = true;
            break;
        }
      }
      return text(String(r.actorId));
    });
    expect((publicTexts(g) as any).texts).not.toContain("1");
    expect((publicTexts(g) as any).texts).toHaveLength(5);
    expect(
      g.events.some(
        (e) =>
          e.type === "wall_note_changed" &&
          e.payload.actorId === 1 &&
          e.payload.operation === "accepted",
      ),
    ).toBe(false);
  });

test("accepted then later gateway revocation omits paid author without refund", async () => {
  const g = fixture(),
    gateway = new ToolGateway(),
    original = gateway.validateAndSanitize.bind(gateway);
  gateway.validateAndSanitize = ((world, id, call, context) => {
    if (id === 2)
      (role(g, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
    return original(world, id, call, context);
  }) as typeof gateway.validateAndSanitize;
  await run(g, async (r) => text(String(r.actorId)), undefined, 1, gateway);
  expect(note(g, 1).remaining).toBe(0);
  expect((publicTexts(g) as any).texts).not.toContain("1");
  expect((publicTexts(g) as any).texts).toHaveLength(5);
});

test("real errors settle all, choose first frozen ID exception, zero accepted, finally expired", async () => {
  const g = fixture(),
    first = new Error("first"),
    later = new Error("later");
  let settled = 0;
  await expect(
    run(g, async (r) => {
      if (r.actorId === 1) {
        await Promise.resolve();
        throw first;
      }
      if (r.actorId === 2) throw later;
      await Promise.resolve();
      settled++;
      return text("x");
    }),
  ).rejects.toBe(first);
  expect(settled).toBe(4);
  expect(publicTexts(g)).toBeUndefined();
  expect(
    g.events.some((e) => e.type === "wall_note_changed" && e.payload.operation === "accepted"),
  ).toBe(false);
  expect(note(g, 1)).toMatchObject({ remaining: 1, expired: true });
  expect(hasActiveWall(g.world)).toBe(false);
});

test("factory exception also closes and expires all granted paper", async () => {
  const g = fixture(),
    factory = new GameActionRequestFactory(g.world, g.events, 1),
    err = new Error("factory");
  factory.create = () => {
    throw err;
  };
  await expect(run(g, async () => null, undefined, 1, undefined, factory)).rejects.toBe(err);
  expect(note(g, 6).expired).toBe(true);
  expect(hasActiveWall(g.world)).toBe(false);
  expect(hasWallCommit(g.world)).toBe(true);
});

test("phase loss prevents late publish/cancel; config loss cancels current public window", async () => {
  for (const mode of ["phase", "pack"]) {
    const g = fixture();
    let current = true;
    await run(
      g,
      async (r) => {
        if (r.actorId === 1) {
          if (mode === "phase") current = false;
          else g.config.events = undefined as any;
        }
        return text("x");
      },
      () => current,
    );
    expect(publicTexts(g)).toBeUndefined();
    expect(g.events.filter((e) => e.type === "wall_notes_canceled")).toHaveLength(
      mode === "pack" ? 1 : 0,
    );
    expect(note(g, 1).expired).toBe(true);
  }
});

test("window and manager reentry cannot alter phase/events or request twice", async () => {
  const g = fixture();
  let count = 0;
  await run(g, async (r) => {
    count++;
    if (r.actorId === 1) {
      const before = g.phaseManager.getSnapshot(),
        eventCount = g.phaseManager.getEvents().length;
      await expect(run(g, async () => null)).rejects.toThrow("wall_window_reentry");
      await expect(g.phaseManager.runSingleCycle({ getAction: async () => null })).rejects.toThrow(
        "wall_window_reentry",
      );
      expect(g.phaseManager.getSnapshot()).toEqual(before);
      expect(g.phaseManager.getEvents()).toHaveLength(eventCount);
    }
    return null;
  });
  expect(count).toBe(6);
});

test("out of window, wrong instance/token and cross world are unauthorized", async () => {
  const g = fixture(),
    other = fixture(),
    gateway = new ToolGateway();
  expect(
    gateway.validateAndSanitize(g.world, 1, text("x"), {
      phase: Phase.Voting,
      day: 1,
      wallId: "wall:1",
      itemInstanceId: "wall:1:1",
    }).ok,
  ).toBe(false);
  await run(g, async (r) => {
    expect(
      gateway.validateAndSanitize(other.world, r.actorId, text("x"), {
        phase: Phase.Voting,
        day: 1,
        wallId: "wall:1",
        itemInstanceId: r.context.item_instance_id,
      }).ok,
    ).toBe(false);
    expect(
      gateway.validateAndSanitize(g.world, r.actorId, text("x"), {
        phase: Phase.Voting,
        day: 1,
        wallId: "bad",
        itemInstanceId: r.context.item_instance_id,
      }).ok,
    ).toBe(false);
    return null;
  });
});

test("strict shared fact state matrix and bilingual literal text", () => {
  const valid = { day: 1, eventId: "awa_wall_notes_v1", texts: ["[God] 6 is Wolf"] };
  expect(readWallEventFact("wall_notes_published", valid)).not.toBeNull();
  for (const locale of ["zh-CN", "en"] as const)
    expect(wallEventLabel("wall_notes_published", valid, locale)).toContain("[God] 6 is Wolf");
  expect(readWallEventFact("wall_notes_published", { ...valid, actorId: 1 })).toBeNull();
  const item = {
    day: 1,
    eventId: "awa_wall_notes_v1",
    actorId: 1,
    itemId: "anonymous_note",
    instanceId: "wall:1:1",
    operation: "granted",
    remaining: 1,
    expired: false,
  };
  expect(readWallEventFact("wall_note_changed", item)).not.toBeNull();
  expect(readWallEventFact("wall_note_changed", { ...item, text: "private" })).toBeNull();
  expect(
    readWallEventFact("wall_note_changed", {
      ...item,
      operation: "accepted",
      remaining: 0,
      text: "ok",
    }),
  ).not.toBeNull();
  expect(
    readWallEventFact("wall_note_changed", { ...item, operation: "expired", expired: true }),
  ).not.toBeNull();
});

for (const seam of ["factory", "next"])
  for (const mode of ["phase", "author", "pack"])
    test(`RNG ${seam}/${mode} late boundary cancels without publishing paid papers`, async () => {
      const g = fixture();
      let current = true,
        mutated = false;
      const mutate = () => {
        if (mutated) return;
        mutated = true;
        if (mode === "phase") current = false;
        else if (mode === "pack") g.config.events = undefined as any;
        else (role(g, 1) as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
      };
      const source = createRandom("seam");
      const original = source.next.bind(source);
      source.next = () => {
        if (seam === "next") mutate();
        return original();
      };
      await run(
        g,
        async () => text("ok"),
        () => current,
        1,
        undefined,
        undefined,
        () => {
          if (seam === "factory") mutate();
          return source;
        },
      );
      expect(publicTexts(g)).toBeUndefined();
      expect(note(g, 1).remaining).toBe(0);
      expect(note(g, 1).expired).toBe(true);
      expect(g.events.filter((e) => e.type === "wall_notes_canceled")).toHaveLength(
        mode === "phase" ? 0 : 1,
      );
    });

test("simultaneously active worlds reject foreign opaque capability and factory request", () => {
  const first = fixture(),
    second = fixture(),
    a = openWall(first.world, () => true),
    b = openWall(second.world, () => true);
  grantWallNote(first.world, a, 1);
  grantWallNote(second.world, b, 1);
  expect(authorizedWallAuthor(second.world, 1, a.token, "wall:1:1", a)).toBeNull();
  expect(authorizedWallAuthor(second.world, 1, b.token, "wall:1:1", b)).not.toBeNull();
  const request = new GameActionRequestFactory(first.world, [], 1).create({
    actorId: 1,
    phase: Phase.Voting,
    stage: "wall_notes",
    allowedTools: ["write_note"],
    requiresAction: false,
    summary: "note",
    context: { wall_id: a.token, item_instance_id: "wall:1:1" },
  });
  expect(wallRequestScope(second.world, request)).toBeUndefined();
  expect(wallRequestScope(first.world, request)).toBe(a);
  closeWall(first.world, a);
  closeWall(second.world, b);
});

test("inventory data getters fail closed without execution and replacement is never projected", async () => {
  const g = fixture();
  let reads = 0;
  await run(g, async (r) => {
    if (r.actorId === 6) {
      Object.defineProperty(note(g, 1), "instanceId", {
        enumerable: true,
        get() {
          reads++;
          return "wall:1:1";
        },
      });
      g.world.addComponent(2, COMPONENT.WallNote, { ...note(g, 2) });
      expect(projectWallNote(g.world, 2)).toBeUndefined();
    }
    return text(String(r.actorId));
  });
  expect(reads).toBe(0);
  expect(projectWallNote(g.world, 1)).toBeUndefined();
  expect((publicTexts(g) as any).texts).not.toContain("1");
});

test("raw request actor/instance/context/phase mutation revokes the factory capability", () => {
  const g = fixture(),
    a = openWall(g.world, () => true);
  grantWallNote(g.world, a, 1);
  grantWallNote(g.world, a, 2);
  for (const mutation of ["actor", "instance", "context", "phase", "stage"]) {
    const request = new GameActionRequestFactory(g.world, [], 1).create({
      actorId: 1,
      phase: Phase.Voting,
      stage: "wall_notes",
      allowedTools: ["write_note"],
      requiresAction: false,
      summary: "note",
      context: { wall_id: a.token, item_instance_id: "wall:1:1" },
    });
    expect(wallRequestScope(g.world, request)).toBe(a);
    if (mutation === "actor") {
      request.actorId = 2;
      request.context.item_instance_id = "wall:1:2";
    }
    if (mutation === "instance") request.context.item_instance_id = "wall:1:2";
    if (mutation === "context") request.context = { ...request.context };
    if (mutation === "phase") request.phase = Phase.Day;
    if (mutation === "stage") request.context.stage = "voting";
    expect(wallRequestScope(g.world, request)).toBeUndefined();
  }
  closeWall(g.world, a);
});

for (const mode of ["getter", "readonly", "freeze"])
  test(`corrupt ${mode} expiry preserves original exception and releases authority`, async () => {
    const g = fixture(),
      error = new Error("original");
    let reads = 0;
    await expect(
      run(g, async (r) => {
        if (r.actorId === 6) {
          if (mode === "getter")
            Object.defineProperty(note(g, 1), "expired", {
              get() {
                reads++;
                return false;
              },
              enumerable: true,
            });
          else if (mode === "readonly")
            Object.defineProperty(note(g, 1), "expired", {
              value: false,
              writable: false,
              enumerable: true,
            });
          else Object.freeze(note(g, 1));
          throw error;
        }
        return text("x");
      }),
    ).rejects.toBe(error);
    expect(hasActiveWall(g.world)).toBe(false);
    expect(reads).toBe(0);
    expect(
      g.events.filter((e) => e.type === "wall_note_changed" && e.payload.operation === "expired"),
    ).toHaveLength(6);
    expect(
      g.events.some((e) => e.type === "wall_note_changed" && e.payload.operation === "accepted"),
    ).toBe(false);
  });

test("nonwritable native stock revokes before consumption without throwing", async () => {
  const g = fixture();
  await run(g, async (r) => {
    if (r.actorId === 6)
      Object.defineProperty(note(g, 1), "remaining", {
        value: 1,
        writable: false,
        enumerable: true,
      });
    return text(String(r.actorId));
  });
  expect((publicTexts(g) as any).texts).not.toContain("1");
  expect(hasActiveWall(g.world)).toBe(false);
});

test("actual Reception rejects tampered author; only otherwise-identical deadline derivations keep authority", () => {
  const g = fixture(),
    a = openWall(g.world, () => true);
  grantWallNote(g.world, a, 1);
  grantWallNote(g.world, a, 2);
  const request = new GameActionRequestFactory(g.world, [], 1).create({
      actorId: 1,
      phase: Phase.Voting,
      stage: "wall_notes",
      allowedTools: ["write_note"],
      requiresAction: false,
      summary: "note",
      context: { wall_id: a.token, item_instance_id: "wall:1:1" },
    }),
    reception = new ActionReception(g.world),
    timed = { ...request, deadlineAtMs: 100 };
  inheritRequestAlias(request, timed);
  // 保原 100 输入，F02 现拒过去期限；原作者不会因非法别名而被关闭。
  expect(reception.validate(timed, "write_note", { text: "original" }).ok).toBe(false);
  const changed = { ...timed, actorId: 2 };
  inheritRequestAlias(timed, changed);
  expect(reception.validate(changed, "write_note", { text: "forged" }).ok).toBe(false);
  request.actorId = 2;
  request.context.item_instance_id = "wall:1:2";
  expect(reception.validate(request, "write_note", { text: "forged" }).ok).toBe(false);
  closeWall(g.world, a);
});

test("actual Reception raw getter never executes; Unicode limit, exact args and literal preserved", () => {
  const g = fixture(),
    a = openWall(g.world, () => true);
  grantWallNote(g.world, a, 1);
  const request = new GameActionRequestFactory(g.world, [], 1).create({
      actorId: 1,
      phase: Phase.Voting,
      stage: "wall_notes",
      allowedTools: ["write_note"],
      requiresAction: false,
      summary: "note",
      context: { wall_id: a.token, item_instance_id: "wall:1:1" },
    }),
    reception = new ActionReception(g.world);
  let reads = 0;
  expect(
    reception.validate(request, "write_note", {
      get text() {
        reads++;
        return "hidden";
      },
    }).ok,
  ).toBe(false);
  expect(reads).toBe(0);
  expect(reception.validate(request, "write_note", { text: "x", extra: 1 }).ok).toBe(false);
  expect(reception.validate(request, "write_note", { text: "💌".repeat(160) }).ok).toBe(true);
  expect(reception.validate(request, "write_note", { text: "💌".repeat(161) }).ok).toBe(false);
  expect(reception.validate(request, "write_note", { text: "  [God] literal  " })).toMatchObject({
    ok: true,
    action: { name: "write_note", args: { text: "  [God] literal  " } },
  });
  closeWall(g.world, a);
});

test("player archive provenance stays identical when hidden God note counts differ", () => {
  const g = fixture(),
    base = { day: 1 as const, eventId: "awa_wall_notes_v1" as const },
    start: GameEvent = { timestamp: 100, type: "wall_notes_started", payload: base },
    publish: GameEvent = {
      timestamp: 100,
      type: "wall_notes_published",
      payload: { ...base, texts: ["same"] },
    };
  const collect = (hidden: GameEvent[]) => {
    const records: any[] = [];
    const manager = {
        recordPublicEvent() {},
        recordPlayerEvent(input: any) {
          records.push(input);
        },
      },
      recorder = new GameEventRecorder({ world: g.world, replayManager: manager as any }, "voting");
    recorder.flush([start]);
    recorder.flush([start, ...hidden, publish]);
    return records.filter((row) => row.playerId === 1);
  };
  const hidden: GameEvent = {
    timestamp: 100,
    type: "wall_note_changed",
    payload: {
      ...base,
      actorId: 2,
      itemId: "anonymous_note",
      instanceId: "wall:1:2",
      operation: "rejected",
      remaining: 1,
      expired: false,
    },
  };
  const first = collect([]),
    second = collect([hidden, hidden]);
  expect(first).toEqual(second);
  expect(first.map((r) => r.sourceEventSeq)).toEqual([1, 2]);
  expect(first.map((r) => r.requestId)).toEqual(["1-voting-1-event-1", "1-voting-1-event-2"]);
});

test("frozen note expired DTO and checkpoint agree with closed runtime authority", async () => {
  const g = fixture();
  await run(g, async (r) => {
    if (r.actorId === 6) Object.freeze(note(g, 1));
    return null;
  });
  expect(projectWallNote(g.world, 1)).toMatchObject({
    remaining: 1,
    expired: true,
    effectiveRemaining: 0,
  });
});

test("mutated valid remaining/instance/source cannot forge a player inventory or checkpoint", () => {
  for (const mutation of ["remaining", "instance", "source"]) {
    const g = fixture(),
      a = openWall(g.world, () => true);
    grantWallNote(g.world, a, 1);
    if (mutation === "remaining") note(g, 1).remaining = 0;
    else if (mutation === "instance") note(g, 1).instanceId = "wall:1:2";
    else note(g, 1).source = { ...note(g, 1).source };
    closeWall(g.world, a);
    expect(projectWallNote(g.world, 1)).toBeUndefined();
    const snapshot = { day: 1, phase: Phase.Voting, gameOver: false, result: null };
    expect(
      captureCheckpoint(g.world, snapshot, 1, true, 0).players.find((p) => p.id === 1)?.wallNote,
    ).toBeUndefined();
  }
});

test("closed immutable original note records effective expired inventory", () => {
  const g = fixture(),
    a = openWall(g.world, () => true);
  grantWallNote(g.world, a, 1);
  Object.freeze(note(g, 1));
  closeWall(g.world, a);
  expect(
    captureCheckpoint(
      g.world,
      { day: 1, phase: Phase.Voting, gameOver: false, result: null },
      1,
      true,
      0,
    ).players.find((p) => p.id === 1)?.wallNote,
  ).toMatchObject({ remaining: 1, expired: true });
});
