/**
 * 单元测试验证赤月使徒声明的末狼政策和有限 roster 资格。原安装贡献／状态相等是字面预期，保留原输入及样本，不调用模型或完整对局 driver。
 */
import { expect, test } from "bun:test";
import { isDemonHunterPreset, isRedMoonPreset } from "../../../src/rulesets";
import { COMPONENT, type RoleComponent } from "../../../src/core";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
} from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state-slot";
import {
  demonHunterActorId,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
for (const policy of ["ends_game", "forbidden"] as const)
  test(policy + ": finite roster installs with matching runtime profile", () => {
    const { world, config, ids } = redMoonCandidateWorld(policy);
    expect(ids).toHaveLength(12);
    expect(isRedMoonPreset(config)).toBe(true);
    expect(isDemonHunterPreset(config)).toBe(true);
    expect(demonHunterActorId(world)).toBe(11);
    expect(
      getRedMoonState(world.getComponent(4, COMPONENT.Role))?.lastWolfBlastPolicy,
    ).toBe(policy);
    expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
    expect(
      getDefaultRoleContributions().some((p) => String(p.metadata.role) === "red_moon_apostle"),
    ).toBe(true);
  });
