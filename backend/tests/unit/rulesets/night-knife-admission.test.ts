/**
 * 单元测试验证夜刀组合的非触发晚读与前步已清、后步失败的真实前缀。
 * 输入为测试自有运行 thunks、原标记库存和 stageState；字面轨迹与库存结果是独立预期。
 * 不组装完整对局／模型，不以候选或 scope 形状当作行动许可，不复制两种权威的业务规则。
 */
import { expect, test } from "bun:test";
import { StatusMark } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../src/domain/components/alive";
import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import type { NightStageState } from "../../../src/engine/night/contracts";
import { discardStaleNightKnives } from "../../../src/rulesets/night-knife-admission";

function stageState(): NightStageState {
  return {
    wolfChatOrder: [],
    endedWolves: new Set(),
    wolfVotes: {},
    wolfTarget: null,
    seerChecks: [],
  };
}

test("普通刀无scope仍晚查婚约条件，false不读取第二组world与day", () => {
  const trace: string[] = [],
    world = new World(),
    state = stageState();
  discardStaleNightKnives({
    world: () => {
      trace.push("world");
      return world;
    },
    state: () => {
      trace.push("state");
      return state;
    },
    ownsWedding: () => {
      trace.push("ownsWedding");
      return false;
    },
    day: () => {
      throw new Error("literal_day_must_not_read");
    },
  });
  expect(trace).toEqual(["world", "state", "ownsWedding"]);
  expect(state.wolfTarget).toBeNull();
  expect(state.wolfTargetScope).toBeUndefined();
});

test("普通刀先移原和现场marks再清stage，婚约world失败保留已清前缀", () => {
  const trace: string[] = [],
    world = new World(),
    state = stageState();
  const targetId = world.createEntity(),
    life = createAliveComponent();
  class TracedMarks extends StatusMarksComponent {
    constructor(private readonly label: string) {
      super([StatusMark.WolfKillMark]);
    }
    override remove(mark: StatusMark): void {
      trace.push(this.label);
      super.remove(mark);
    }
  }
  const originalMarks = new TracedMarks("originalMarks"),
    currentMarks = new TracedMarks("currentMarks");
  // 测试的现行实体没有原scope的Alive，走原过期分支；两组真实标记各自保库存。
  world.addComponent(targetId, COMPONENT.StatusMarks, currentMarks);
  state.wolfTarget = targetId;
  state.wolfTargetScope = {
    targetId,
    life,
    version: aliveLifeVersion(life)!,
    marks: originalMarks,
  };
  const failure = new Error("literal_wedding_world_failure");
  let reads = 0;
  expect(() =>
    discardStaleNightKnives({
      world: () => {
        trace.push(`world:${++reads}`);
        if (reads === 2) throw failure;
        return world;
      },
      state: () => {
        trace.push("state");
        return state;
      },
      ownsWedding: () => {
        trace.push("ownsWedding");
        return true;
      },
      day: () => {
        throw new Error("literal_day_after_world_failure_must_not_read");
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual([
    "world:1",
    "state",
    "originalMarks",
    "currentMarks",
    "ownsWedding",
    "world:2",
  ]);
  expect(originalMarks.has(StatusMark.WolfKillMark)).toBe(false);
  expect(currentMarks.has(StatusMark.WolfKillMark)).toBe(false);
  expect(state.wolfTarget).toBeNull();
  expect(state.wolfTargetScope).toBeUndefined();
  expect(world.getComponent(targetId, COMPONENT.StatusMarks)).toBe(currentMarks);
});
