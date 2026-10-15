/**
 * 单元测试以有／无 Bride 的字面身份集合为输入，核对 Ghost Bride 局部阶段优先级及胜利条件贡献。固定优先级、普通 descriptor 不变及明确目标注册为预期；不运行 setup 窗口、阶段、死亡链、文件或模型。
 */
import { expect, test } from "bun:test";
import { Role } from "../../../src/domain";
import { ghostBrideBoard } from "../../support/features/ghost-bride/builders/scenario";
import { getDefaultWinConditionRegistry, NightStageRegistry } from "../../../src/rulesets/mechanism-api";

test("stage registry uses local Guard/chat priority without mutating ordinary stage descriptors", () => {
  const config = ghostBrideBoard(),
    registry = new NightStageRegistry();
  const before = registry
    .getStages({
      ...config,
      roleSetups: config.roleSetups.filter((r) => r.role !== Role.GhostBride),
    })
    .find((s) => s.id === "wolf_discussion")!.priority;
  expect(registry.getStages(config).find((s) => s.id === "wolf_discussion")!.priority).toBe(350);
  expect(
    registry
      .getStages({
        ...config,
        roleSetups: config.roleSetups.filter((r) => r.role !== Role.GhostBride),
      })
      .find((s) => s.id === "wolf_discussion")!.priority,
  ).toBe(before);
  expect(
    getDefaultWinConditionRegistry()
      .all()
      .some((s) => s.id === "three_factions_elimination"),
  ).toBe(true);
});
