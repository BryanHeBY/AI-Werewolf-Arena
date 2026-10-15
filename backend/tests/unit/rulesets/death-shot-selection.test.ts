/**
 * 单元测试验证死亡枪选择组合与真实结算器的窗口边界。输入为固定六人装配、明确死亡来源及受控
 * 提供者异常／等待后组件变化；输出核对原弹药、事件、重试次数和许可关闭，不运行完整对局或模型。
 * 目标替换只能由下一次新请求命中新生命；射手原生命撤销时不能把旧回复当作已付枪击。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { DeathCause, Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { getHunterState } from "../../../src/features/hunter/ports";

function fixture() {
  const roles = [Role.Wolf, Role.Hunter, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
  const config = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
  };
  const game = bootstrapGame(config, { fixedRoles: roles, locale: "en" });
  const events: GameEvent[] = [];
  const state = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  return {
    ...game,
    events,
    hunter: getHunterState(game.world.getComponent(2, COMPONENT.Role)!)!,
    resolution: new DeathResolution(
      game.world,
      events,
      new ToolGateway(),
      new EventRegistry(),
      state,
    ),
  };
}

test("提供者抛错保留已标死前缀，未消费原生枪并由外层关闭许可", async () => {
  const f = fixture();
  let requests = 0;
  await expect(
    f.resolution.resolve(
      [2],
      { 2: [DeathCause.Exile] },
      {
        async getAction(request) {
          if (request.allowedTools.includes("shoot")) {
            requests++;
            expect(f.world.activeDeathActionCount).toBe(1);
            throw new Error("selection_provider_failed");
          }
          return { name: "speak", args: { text: "Original words" } };
        },
      },
      Phase.Voting,
      Phase.Day,
    ),
  ).rejects.toThrow("selection_provider_failed");
  expect(requests).toBe(1);
  expect(f.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(false);
  expect(f.hunter.canShoot).toBe(true);
  expect(f.events.filter((event) => event.type === "hunter_shot")).toEqual([]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("等待后目标生命替换拒绝旧快照，下一请求重新捕获后才可命中新生命", async () => {
  const f = fixture();
  const original = f.world.getComponent(1, COMPONENT.Alive)!;
  const replacement = createAliveComponent();
  let requests = 0;
  await f.resolution.resolve(
    [2],
    { 2: [DeathCause.Exile] },
    {
      async getAction(request) {
        if (!request.allowedTools.includes("shoot"))
          return { name: "speak", args: { text: "Original words" } };
        requests++;
        if (requests === 1) {
          f.world.addComponent(1, COMPONENT.Alive, replacement);
        } else {
          expect(request.context.retry_attempt).toBe(1);
          expect(replacement.alive).toBe(true);
          expect(f.hunter.canShoot).toBe(true);
          expect(f.events.filter((event) => event.type === "hunter_shot")).toEqual([]);
        }
        return { name: "shoot", args: { target_id: 1 } };
      },
    },
    Phase.Voting,
    Phase.Day,
  );
  expect(requests).toBe(2);
  expect(original.alive).toBe(true);
  expect(replacement.alive).toBe(false);
  expect(
    f.events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
  ).toEqual([{ hunterId: 2, targetId: 1 }]);
  expect(f.hunter.canShoot).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("等待后射手复活再死亡撤销原窗口，不消费弹药也不追击旧目标", async () => {
  const f = fixture();
  let requests = 0;
  await f.resolution.resolve(
    [2],
    { 2: [DeathCause.Exile] },
    {
      async getAction(request) {
        if (!request.allowedTools.includes("shoot"))
          return { name: "speak", args: { text: "Original words" } };
        requests++;
        const life = f.world.getComponent(2, COMPONENT.Alive)!;
        life.alive = true;
        life.alive = false;
        return { name: "shoot", args: { target_id: 1 } };
      },
    },
    Phase.Voting,
    Phase.Day,
  );
  expect(requests).toBe(1);
  expect(f.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
  expect(f.hunter.canShoot).toBe(true);
  expect(f.events.filter((event) => event.type === "hunter_shot")).toEqual([]);
  expect(f.world.activeDeathActionCount).toBe(0);
});
