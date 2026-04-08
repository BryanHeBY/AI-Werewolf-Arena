import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { Phase, PotionType, Role } from "../../src/domain/model";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

describe("V3 ToolGateway validation", () => {
  test("guard cannot protect same target in consecutive nights", () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig);
    const toolGateway = new ToolGateway();

    const guardId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Guard);

    expect(guardId).toBeDefined();

    const guard = world.getComponent<RoleComponent>(guardId!, COMPONENT.Role)!;
    guard.guardState!.lastTarget = 1;

    const result = toolGateway.validateAndSanitize(
      world,
      guardId!,
      { name: "guard", args: { target_id: 1 } },
      { phase: Phase.Night },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("不可连续两晚守同一人");
  });

  test("witch cannot self-heal and cannot use two potions in same night", () => {
    const { world } = bootstrapGame(twelvePlayerStandardConfig);
    const toolGateway = new ToolGateway();

    const witchId = world
      .getAliveEntityIds()
      .find((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Witch);

    expect(witchId).toBeDefined();

    const selfHeal = toolGateway.validateAndSanitize(
      world,
      witchId!,
      { name: "use_potion", args: { target_id: witchId!, potion_type: PotionType.Heal } },
      { phase: Phase.Night },
    );

    expect(selfHeal.ok).toBe(false);
    expect(selfHeal.error).toContain("不可自救");

    const witch = world.getComponent<RoleComponent>(witchId!, COMPONENT.Role)!;
    witch.witchState!.healUsedThisNight = true;

    const usePoisonAfterHeal = toolGateway.validateAndSanitize(
      world,
      witchId!,
      { name: "use_potion", args: { target_id: 1, potion_type: PotionType.Poison } },
      { phase: Phase.Night },
    );

    expect(usePoisonAfterHeal.ok).toBe(false);
    expect(usePoisonAfterHeal.error).toContain("同夜不可双药");
  });
});
