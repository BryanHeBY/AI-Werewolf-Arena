/**
 * 单元测试验证每个死亡 hook 的运行贡献在下一 hook 前同步提交，以及已结算生命的原因追加。
 * 输入为真实狼美人绑定、原生命和字面故障描述；输出以原错误、事件顺序、resolved／applied 与生命验收。
 * 描述读取失败仍保已领取前缀，不伪造新角色生产者、许可或回执；只驱动有限死亡波，不执行整局／模型。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleComponent } from "../../../src/domain/components/role";
import {
  setWolfBeautyState,
  attemptCharmTrigger,
  commitCharmDeath,
  createWolfBeautyDeathContribution,
  bindWolfBeautyDeathCommands,
} from "../../../src/features/wolf-beauty/ports";
import { bindCharm, activeCharm } from "../../../src/features/wolf-beauty/relation";
import { wolfBeautyDeathHook } from "../../../src/features/wolf-beauty/death-hook";
import { HookRegistry } from "../../../src/engine/hooks/registry";
import type { DeathHook } from "../../../src/engine/hooks/registry";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";

function fixture(hooks: (f: { world: World; actor: number; target: number }) => DeathHook[]) {
  const world = new World("en"),
    actor = world.createEntity(),
    target = world.createEntity();
  const role = createRoleComponent(Role.WolfBeauty);
  setWolfBeautyState(role, {
    targetId: target,
    lastActedDay: 1,
    history: [],
    deathLinkPolicy: "awa_exile_poison_v1",
  });
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  const actorLife = createAliveComponent(),
    targetLife = createAliveComponent();
  world.addComponent(actor, COMPONENT.Alive, actorLife);
  world.addComponent(target, COMPONENT.Alive, targetLife);
  bindCharm(world, actor, target);
  const binding = activeCharm(world, actor)!;
  const events: GameEvent[] = [];
  const resolver = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], hooks({ world, actor, target }))),
    {
      day: 2,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    },
  );
  return { world, actor, target, binding, actorLife, targetLife, events, resolver };
}
const provider = {
  async getAction() {
    return { name: "speak" as const, args: { text: "Last words" } };
  },
};

test("each real Wolf Beauty contribution marks and publishes before the next hook, whose failure keeps the prefix", async () => {
  const error = new Error("later_hook_failure");
  let later = 0,
    after = 0;
  const f = fixture(({ world, target }) => [
    wolfBeautyDeathHook,
    async () => {
      later++;
      expect(world.getComponent(target, COMPONENT.Alive)!.alive).toBe(false);
      throw error;
    },
    async () => {
      after++;
      return { extraDeaths: [], extraDeathSources: {} };
    },
  ]);
  await expect(
    f.resolver.resolve(
      [f.actor],
      { [f.actor]: [DeathCause.Exile] },
      provider,
      Phase.Day,
      Phase.Day,
    ),
  ).rejects.toBe(error);
  expect(later).toBe(1);
  expect(after).toBe(0);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(true);
  expect(f.targetLife.alive).toBe(false);
  expect(
    f.events
      .filter((e) => e.type === "additional_deaths" || e.type === "charm_death")
      .map((e) => e.type),
  ).toEqual(["additional_deaths", "charm_death"]);
});

test("a linked target already in the initial wave keeps its prior cause and adds the declared cause before later hooks", async () => {
  const captured: string[][] = [];
  const f = fixture(({ target }) => [
    wolfBeautyDeathHook,
    async (_world, _ids, sources) => {
      captured.push([...(sources[target] ?? [])]);
      return { extraDeaths: [], extraDeathSources: {} };
    },
  ]);
  await f.resolver.resolve(
    [f.actor, f.target],
    { [f.actor]: [DeathCause.Exile], [f.target]: [DeathCause.WolfKill] },
    provider,
    Phase.Day,
    Phase.Day,
  );
  expect(captured).toEqual([
    [DeathCause.WolfKill, DeathCause.Charm],
    [DeathCause.WolfKill, DeathCause.Charm],
  ]);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(true);
  expect(f.events.filter((e) => e.type === "additional_deaths")).toEqual([]);
  expect(f.events.filter((e) => e.type === "charm_death").map((e) => e.payload)).toEqual([
    { actorId: f.actor, targetId: f.target },
  ]);
});

test("a declared-cause getter failure after real preparation keeps the paid claim but never marks its target or starts another hook", async () => {
  const error = new Error("declared_cause_read_failed"),
    trace: string[] = [];
  let later = 0;
  let real!: ReturnType<typeof createWolfBeautyDeathContribution>;
  const f = fixture(({ target }) => [
    async () => ({
      extraDeaths: [],
      extraDeathSources: {},
      deathWaveContributions: [
        {
          prepare(...args) {
            const prepared = real.prepare(...args);
            return {
              linkedDeaths: [
                {
                  get targetId() {
                    trace.push("target");
                    return target;
                  },
                  get addedCauses(): readonly DeathCause[] {
                    trace.push("causes");
                    throw error;
                  },
                  get publicAdditionalDeath() {
                    throw new Error("visibility_must_not_read");
                  },
                },
              ],
              publishAfterDeaths: prepared.publishAfterDeaths,
            };
          },
        },
      ],
    }),
    async () => {
      later++;
      return { extraDeaths: [], extraDeathSources: {} };
    },
  ]);
  real = createWolfBeautyDeathContribution(
    [{ binding: f.binding, nightEffect: false }],
    bindWolfBeautyDeathCommands({
      world: f.world,
      events: f.events,
      prepareWorld: () => f.world,
      prepareEvents: () => f.events,
    }),
  );
  await expect(
    f.resolver.resolve(
      [f.actor],
      { [f.actor]: [DeathCause.Exile] },
      provider,
      Phase.Day,
      Phase.Day,
    ),
  ).rejects.toBe(error);
  expect(trace).toEqual(["target", "target", "causes"]);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(false);
  expect(f.targetLife.alive).toBe(true);
  expect(later).toBe(0);
  expect(
    f.events.filter((e) => e.type === "charm_death" || e.type === "additional_deaths"),
  ).toEqual([]);
});
