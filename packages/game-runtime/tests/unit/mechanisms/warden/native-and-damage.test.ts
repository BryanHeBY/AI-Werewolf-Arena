/**
 * 负责原十二人夜流水线的真实工具集成，手写pair/决定/刀/药/梦输入，按字面核原生能力与独立死因。
 * 未调用生产真值表生成预期；观测只是记录请求，不替代真实ToolGateway和伤害结算。
 */
import { expect, test } from "bun:test";
import {
  Role,
  DeathCause,
  PotionType,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { wardenTwelveConfig } from "../../../../src/rulesets/presets/warden-twelve";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { COMPONENT } from "../../../../src/domain/components/names";
import { bindDreamLifeQueries } from "../../../../src/domain/dream-night-effects";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { getWardenState } from "../../../../src/features/warden/state";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
function fixture() {
  const config = structuredClone(wardenTwelveConfig);
  const f = bootstrapGame(config);
  const role = (r: Role) => f.world.getEntityIdsByRole(r)[0]!;
  const events: GameEvent[] = [];
  const pipeline = new NightPipeline({
    world: f.world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  return {
    ...f,
    config,
    events,
    pipeline,
    role,
    seer: role(Role.Seer),
    witch: role(Role.Witch),
    dream: role(Role.Dreamer),
    villagers: f.world.getEntityIdsByRole(Role.Villager),
    actor: role(Role.Warden),
  };
}
function provider(
  f: ReturnType<typeof fixture>,
  pair: readonly [number, number],
  choice: "trade" | "betray",
  potion: "none" | "heal" | "poison" = "none",
  wrong = false,
) {
  const seen: ActionRequest[] = [];
  return {
    seen,
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      seen.push(r);
      switch (r.allowedTools[0]) {
        case "warden_pair":
          return { name: "warden_pair", args: { target_ids: pair } };
        case "warden_decide":
          return { name: "warden_decide", args: { choice } };
        case "speak_to_wolves":
          return { name: "speak_to_wolves", args: { text: "本夜刀口建议", end_chat: true } };
        case "kill_vote":
          return { name: "kill_vote", args: { target_id: f.villagers[0]!, abstain: false } };
        case "check_identity":
          return {
            name: "check_identity",
            args: {
              target_id: wrong
                ? f.villagers[1]!
                : (r.context.warden_forced_target ?? f.villagers[1]!),
            },
          };
        case "dream":
          return {
            name: "dream",
            args: { target_id: r.context.warden_forced_target ?? f.villagers[2]! },
          };
        case "use_potion":
          return {
            name: "use_potion",
            args: {
              target_id:
                potion === "none" ? r.actorId : (r.context.warden_forced_target ?? f.villagers[0]!),
              potion_type: potion as PotionType,
            },
          };
        default:
          return null;
      }
    },
  };
}
test("Seer/Witch双背叛只强制原生partner，团刀仍指C；非真实刀口不能假救", async () => {
  const f = fixture(),
    p = provider(f, [f.seer, f.witch], "betray", "poison");
  const result = await f.pipeline.execute(f.config, p, 2);
  expect(result.interrupted).toBe(false);
  if (result.interrupted) return;
  expect(result.summary.wolfTarget).toBe(f.villagers[0]);
  expect(result.summary.seerChecks).toContainEqual(
    expect.objectContaining({ seerId: f.seer, targetId: f.witch, isWerewolf: false }),
  );
  expect(result.damage.deathSources[f.seer]).toEqual([DeathCause.Poison]);
  expect(result.damage.deathSources[f.villagers[0]!]).toEqual([DeathCause.WolfKill]);
  expect(
    p.seen
      .filter((r) => r.allowedTools[0] === "kill_vote")
      .every((r) => r.context.warden_forced_target === undefined),
  ).toBe(true);
  expect(
    p.seen.find((r) => r.actorId === f.witch && r.allowedTools[0] === "use_potion")!.context
      .warden_forced_target,
  ).toBe(f.seer);
});
test("强制女巫明确none合法且不耗毒；heal在partner非刀口时显式失败", async () => {
  const f = fixture();
  await f.pipeline.execute(f.config, provider(f, [f.seer, f.witch], "betray"), 2);
  expect(f.events.filter((e) => e.type === "witch_potion_used")).toEqual([]);
  const second = fixture();
  await expect(
    second.pipeline.execute(
      second.config,
      provider(second, [second.seer, second.witch], "betray", "heal"),
      2,
    ),
  ).rejects.toThrow("warden_witch_action_invalid");
  expect(
    getWardenState(second.world.getComponent(second.actor, COMPONENT.Role))!.history[0]!.resolved,
  ).toBe(true);
});
test("强制Seer非法partner动作真实网关拒绝，不改查验历史或生成替代目标", async () => {
  const f = fixture();
  await expect(
    f.pipeline.execute(f.config, provider(f, [f.seer, f.witch], "betray", "none", true), 2),
  ).rejects.toThrow("warden_seer_action_invalid");
  expect(f.events.filter((e) => e.type === "seer_checked")).toEqual([]);
});
test("Dreamer/Wolf双背叛保真实连续历史与团刀", async () => {
  const f = fixture(),
    wolf = f.role(Role.Wolf);
  const first = provider(f, [f.dream, wolf], "betray");
  const original = first.getAction;
  first.getAction = async (r) =>
    r.allowedTools[0] === "dream" ? { name: "dream", args: { target_id: wolf } } : original(r);
  await f.pipeline.execute(f.config, first, 1);
  const result = await f.pipeline.execute(f.config, provider(f, [f.dream, wolf], "betray"), 2);
  if (result.interrupted) throw new Error("unexpected");
  expect(result.summary.wolfTarget).toBe(f.villagers[0]);
  expect(result.damage.deathSources[wolf]).toEqual([DeathCause.Dream]);
  expect(f.events.filter((e) => e.type === "dream_applied").at(-1)!.payload).toMatchObject({
    targetId: wolf,
    consecutive: true,
  });
});
test("双trade保护刀/毒/梦连锁但不提供Shot免疫；目标替身不继承已付保护", async () => {
  const f = fixture(),
    a = f.villagers[0]!,
    b = f.villagers[2]!;
  const result = await f.pipeline.execute(f.config, provider(f, [a, b], "trade", "poison"), 2);
  if (result.interrupted) throw new Error("unexpected");
  expect(result.damage.deaths).not.toContain(a);
  expect(result.damage.deaths).not.toContain(b);
  const q = bindDreamLifeQueries(f.world);
  expect(result.dreamFrame.linkedDeaths(q, [f.dream])).toEqual([]);
  expect(result.dreamFrame.blocksNightShot(q, a)).toBe(false);
  f.world.addComponent(b, COMPONENT.Alive, createAliveComponent());
  expect(result.dreamFrame.linkedDeaths(q, [f.dream])).toEqual([]);
});
test("单背叛Deal独立于刀毒且纯Deal不授猎枪", async () => {
  const f = fixture(),
    hunter = f.role(Role.Hunter);
  const p = provider(f, [hunter, f.villagers[1]!], "trade");
  const orig = p.getAction;
  p.getAction = async (r) =>
    r.allowedTools[0] === "warden_decide"
      ? { name: "warden_decide", args: { choice: r.actorId === hunter ? "trade" : "betray" } }
      : orig(r);
  const result = await f.pipeline.execute(f.config, p, 2);
  if (result.interrupted) throw new Error("unexpected");
  expect(result.damage.deathSources[hunter]).toEqual([DeathCause.Deal]);
  const { permitsHunterShot } = await import("../../../../src/domain/deaths");
  expect(permitsHunterShot([DeathCause.Deal])).toBe(false);
  expect(permitsHunterShot([DeathCause.WolfKill, DeathCause.Deal])).toBe(false);
  expect(permitsHunterShot([DeathCause.WolfKill, DeathCause.Poison, DeathCause.Deal])).toBe(false);
});

test("force女巫none首sink getter撤partner时false关闭，不发表skip或消费夜次数", async () => {
  const f = fixture(),
    p = provider(f, [f.seer, f.witch], "betray"),
    original = p.getAction,
    out: boolean[] = [];
  p.getAction = async (r) => {
    if (r.allowedTools[0] === "use_potion") {
      deferRequestDelivery(r, (ok) => out.push(ok));
      Object.defineProperty(f.events, "push", {
        configurable: true,
        get() {
          f.world.addComponent(f.seer, COMPONENT.Alive, createAliveComponent());
          return Array.prototype.push;
        },
      });
    }
    return original(r);
  };
  await expect(f.pipeline.execute(f.config, p, 2)).rejects.toThrow("warden_witch_target_revoked");
  expect(out).toEqual([false]);
  expect(
    f.events.filter((e) => e.type === "witch_potion_skipped" || e.type === "witch_potion_used"),
  ).toEqual([]);
});

test("真实死亡结算保Shot穿透交易保护且纯Deal不打开枪窗", async () => {
  const { DeathResolution } = await import("../../../../src/engine/death-resolution"),
    { EventRegistry } = await import("../../../../src/engine/events/event-registry"),
    { Phase } = await import("@ai-werewolf-arena/game-contract");
  const f = fixture(),
    target = f.villagers[0]!,
    other = f.villagers[2]!,
    hunter = f.role(Role.Hunter),
    p = provider(f, [target, other], "trade"),
    night = await f.pipeline.execute(f.config, p, 2);
  if (night.interrupted) throw new Error("unexpected");
  let asks = 0;
  await new DeathResolution(
    f.world,
    f.events,
    new ToolGateway(),
    new EventRegistry(),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
    f.config,
  ).resolve(
    [hunter],
    { [hunter]: [DeathCause.WolfKill] },
    {
      async getAction(r) {
        if (r.allowedTools.includes("shoot")) {
          asks++;
          return { name: "shoot", args: { target_id: target } };
        }
        return null;
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { dreams: night.dreamFrame, nightOriginIds: [hunter] },
  );
  expect(asks).toBe(1);
  expect(f.world.getComponent(hunter, COMPONENT.Alive)!.alive).toBe(false);
  expect(f.world.getComponent(target, COMPONENT.Alive)!.alive).toBe(false);
  const g = fixture(),
    h = g.role(Role.Hunter);
  let forbidden = 0;
  await new DeathResolution(
    g.world,
    g.events,
    new ToolGateway(),
    new EventRegistry(),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
    g.config,
  ).resolve(
    [h],
    { [h]: [DeathCause.Deal] },
    {
      async getAction() {
        forbidden++;
        return null;
      },
    },
    Phase.Night,
    Phase.Day,
  );
  expect(forbidden).toBe(0);
  expect(g.world.getComponent(h, COMPONENT.Alive)!.alive).toBe(false);
});

test("真实同夜刀毒Deal全部保留，死亡名单仍唯一", async () => {
  const f = fixture(),
    a = f.villagers[0]!,
    b = f.villagers[1]!,
    p = provider(f, [a, b], "trade", "poison"),
    original = p.getAction;
  p.getAction = async (r) =>
    r.allowedTools[0] === "warden_decide"
      ? { name: "warden_decide", args: { choice: r.actorId === a ? "trade" : "betray" } }
      : original(r);
  const night = await f.pipeline.execute(f.config, p, 2);
  if (night.interrupted) throw new Error("unexpected");
  expect(night.damage.deathSources[a]).toEqual([
    DeathCause.Poison,
    DeathCause.WolfKill,
    DeathCause.Deal,
  ]);
  expect(night.damage.deaths.filter((id) => id === a)).toHaveLength(1);
});

test("双trade阻挡真正连续摄梦，保原连续历史而不伪造梦死亡", async () => {
  const f = fixture(),
    a = f.villagers[0]!,
    b = f.villagers[1]!;
  for (const day of [1, 2]) {
    const p = provider(f, [a, b], "trade"),
      original = p.getAction;
    p.getAction = async (r) =>
      r.allowedTools[0] === "dream" ? { name: "dream", args: { target_id: a } } : original(r);
    const night = await f.pipeline.execute(f.config, p, day);
    if (night.interrupted) throw new Error("unexpected");
    if (day === 2) {
      expect(night.damage.deaths).not.toContain(a);
      expect(f.events.filter((e) => e.type === "dream_applied").at(-1)!.payload).toMatchObject({
        targetId: a,
        consecutive: true,
      });
      expect(f.events.filter((e) => e.type === "dream_death")).toEqual([]);
    }
  }
});

test("夜源猎枪杀死Dreamer的完整追加波仍保原双trade目标，显示Day不提早到期", async () => {
  const { DeathResolution } = await import("../../../../src/engine/death-resolution"),
    { EventRegistry } = await import("../../../../src/engine/events/event-registry"),
    { Phase } = await import("@ai-werewolf-arena/game-contract");
  const f = fixture(),
    a = f.villagers[0]!,
    b = f.villagers[2]!,
    hunter = f.role(Role.Hunter),
    night = await f.pipeline.execute(f.config, provider(f, [a, b], "trade"), 2);
  if (night.interrupted) throw new Error("unexpected");
  await new DeathResolution(
    f.world,
    f.events,
    new ToolGateway(),
    new EventRegistry(),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
    f.config,
  ).resolve(
    [hunter],
    { [hunter]: [DeathCause.WolfKill] },
    {
      async getAction(r) {
        return r.allowedTools.includes("shoot")
          ? { name: "shoot", args: { target_id: f.dream } }
          : null;
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    { dreams: night.dreamFrame, nightOriginIds: [hunter] },
  );
  expect(f.world.getComponent(f.dream, COMPONENT.Alive)!.alive).toBe(false);
  expect(f.world.getComponent(b, COMPONENT.Alive)!.alive).toBe(true);
  expect(f.events.filter((e) => e.type === "dream_death")).toEqual([]);
});
