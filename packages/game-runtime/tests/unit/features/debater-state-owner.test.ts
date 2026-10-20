/**
 * 单元测试验证杠精初始化的惰性读取、实际窗口付款后的写入失败与关闭。
 * 输入为原角色、真实请求／网关及受控字段 setter；输出按字面轨迹、同一错误和原引用断言。
 * 提交账本、库存与选择不是可回滚事务；异常关闭窗口，但不会恢复已提交的辩论资格。
 * 只执行局部窗口，不运行完整对局、模型或持久化；描述符探针仅安装在本例自有对象上。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Camp, COMPONENT, Role, type GameEvent, type ToolCall } from "../../../src/domain";
import { createRoleComponent } from "../../../src/domain/components/role";
import type {
  RoleInitializationComponent,
  RoleInitContext,
} from "../../../src/rulesets/roles/contracts";
import { getDebaterState, initializeDebaterState } from "../../../src/features/debater/state";
import { hasActiveDebate, hasDebateCommit } from "../../../src/features/debater/authority";
import { DebaterWindow } from "../../../src/features/debater/window";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { foxBoard } from "../../support/features/cursed-fox/builders/scenario";

test("Debater init evaluates its assignment container before a late policy failure", () => {
  const trace: string[] = [],
    failure = new Error("test_debater_policy_failed");
  const role = createRoleComponent(Role.Debater) as RoleInitializationComponent;
  const container = {
    set debater(_value: unknown) {
      trace.push("write");
    },
  };
  Object.defineProperty(role, "privateState", {
    configurable: true,
    get() {
      trace.push("container");
      return container;
    },
  });
  const context: Pick<RoleInitContext, "boardConfig"> = {
    get boardConfig() {
      trace.push("board");
      return {
        get debater() {
          trace.push("debater");
          return {
            get policy(): "awa_melbourne_2026_speech_gap_v1" {
              trace.push("policy");
              throw failure;
            },
          };
        },
      } as RoleInitContext["boardConfig"];
    },
  };
  let caught: unknown;
  try {
    initializeDebaterState(role, context);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  // 描述符读取不调用 privateState getter；唯一容器读取来自原赋值左值。
  expect(trace).toEqual(["container", "board", "debater", "policy"]);
  expect(Object.getOwnPropertyDescriptor(container, "debater")?.set).toBeDefined();
});

for (const failingField of ["remaining", "choice"] as const) {
  test(`Debater ${failingField} setter failure retains the committed prefix and closes its window`, async () => {
    const roles = [Role.Debater, Role.Wolf, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager];
    const game = bootstrapGame(foxBoard(roles), { fixedRoles: roles }),
      events: GameEvent[] = [];
    const actor = game.world.getComponent(1, COMPONENT.Role)!,
      state = getDebaterState(actor)!;
    const failure = new Error(`test_debater_${failingField}_failed`),
      trace: string[] = [];
    let remaining = 1,
      receivedChoice: unknown,
      requests = 0;
    Object.defineProperty(state, "remaining", {
      configurable: true,
      enumerable: true,
      get: () => remaining,
      set(value: number) {
        trace.push(`remaining:${value}`);
        if (failingField === "remaining") throw failure;
        remaining = value;
      },
    });
    Object.defineProperty(state, "choice", {
      configurable: true,
      enumerable: true,
      get: () => null,
      set(value: unknown) {
        trace.push("choice");
        receivedChoice = value;
        throw failure;
      },
    });
    const window = new DebaterWindow(game.world, new ToolGateway(), events);
    const factory = new GameActionRequestFactory(game.world, events, 1);
    const provider = {
      getAction: async (): Promise<ToolCall> => {
        requests++;
        return { name: "challenge", args: { target_id: 2 } };
      },
    };
    await expect(
      window.execute(game.boardConfig, factory, provider, 2, 1, () => true),
    ).rejects.toBe(failure);
    expect(trace).toEqual(
      failingField === "remaining" ? ["remaining:0"] : ["remaining:0", "choice"],
    );
    expect(state.remaining).toBe(failingField === "remaining" ? 1 : 0);
    expect(receivedChoice).toEqual(
      failingField === "remaining" ? undefined : { day: 1, targetId: 2 },
    );
    expect(state.choice).toBeNull();
    expect(hasDebateCommit(game.world, 1)).toBe(true);
    expect(hasActiveDebate(game.world)).toBe(false);
    expect(game.world.getComponent(1, COMPONENT.Role)).toBe(actor);
    expect(getDebaterState(actor)).toBe(state);
    expect(events).toEqual([]);
    // 关闭后即使库存写入未成功，原提交账本仍阻止第二次请求。
    expect(await window.execute(game.boardConfig, factory, provider, 2, 1, () => true)).toEqual({
      skipSpeech: false,
    });
    expect(requests).toBe(1);
  });
}
