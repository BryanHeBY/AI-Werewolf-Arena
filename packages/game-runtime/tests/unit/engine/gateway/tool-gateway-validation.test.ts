/**
 * 单元测试：验证 ToolGateway 在独立构造玩家上的规则预检与拒绝。输入为原局部玩家、工具及非法参数；原字面断言为预期，不执行模型或完整对局。
 */
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import { RoleComponent } from "../../../../src/domain/components/role";
import { Phase, PotionType, Role } from "../../../../src/domain/model";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { getGuardState } from "../../../../src/features/guard/ports";
import { getWitchState } from "../../../../src/features/witch/ports";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { twelvePlayerStandardConfig } from "../../../../src/rulesets/presets/twelve-player-standard";

describe("ToolGateway validation", () => {
  test("guard cannot protect same target in consecutive nights", () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig);
    const toolGateway = new ToolGateway();

    const guardId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.Guard);

    expect(guardId).toBeDefined();

    const guard = world.getComponent(guardId!, COMPONENT.Role)!;
    const guardState = getGuardState(guard)!;
    (guardState as { lastTarget: number | null }).lastTarget = 1;

    const result = toolGateway.validateAndSanitize(
      world,
      guardId!,
      { name: "guard", args: { target_id: 1, abstain: false } },
      { phase: Phase.Night },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("guard_repeat");
    expect(result.message).toContain("不可连续两晚守同一人");
  });

  test("witch cannot self-heal and cannot use two potions in same night", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const toolGateway = new ToolGateway();

    const witchId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.Witch);

    expect(witchId).toBeDefined();

    const selfHeal = toolGateway.validateAndSanitize(
      world,
      witchId!,
      { name: "use_potion", args: { target_id: witchId!, potion_type: PotionType.Heal } },
      { phase: Phase.Night },
    );

    expect(selfHeal.ok).toBe(false);
    expect(selfHeal.error).toBe("self_heal");
    expect(selfHeal.message).toContain("不可自救");

    const witch = world.getComponent(witchId!, COMPONENT.Role)!;
    const witchState = getWitchState(witch)!;
    (witchState as { healUsedThisNight: boolean }).healUsedThisNight = true;

    const usePoisonAfterHeal = toolGateway.validateAndSanitize(
      world,
      witchId!,
      { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } },
      { phase: Phase.Night },
    );

    expect(usePoisonAfterHeal.ok).toBe(false);
    expect(usePoisonAfterHeal.error).toBe("two_potions");
    expect(usePoisonAfterHeal.message).toContain("同夜不可双药");
  });

  test("report_bug should validate category/severity/message constraints", () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig);
    const toolGateway = new ToolGateway();

    const ok = toolGateway.validateAndSanitize(
      world,
      1,
      {
        name: "report_bug",
        args: {
          category: "flow",
          severity: "medium",
          message: "测试上报",
        },
      },
      { phase: Phase.Day },
    );
    expect(ok.ok).toBe(true);

    const bad = toolGateway.validateAndSanitize(
      world,
      1,
      {
        name: "report_bug",
        args: {
          category: "invalid",
          severity: "medium",
          message: "测试上报",
        },
      } as any,
      { phase: Phase.Day },
    );
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("category");
  });
});
