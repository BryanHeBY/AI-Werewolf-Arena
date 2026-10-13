/**
 * 咒狐场景验证完整夜提交后重入、警长时点替换过滤和个人终局。输入为原毒矩阵、固定角色和真实 Pipeline／经理；手写保留效果、独立毒结果与咒狐唯一胜者是预期，不重生成预期数据。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Camp, COMPONENT, Role, PotionType, type RoleComponent } from "../../../../src/core";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";
import { RoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { SEER_NIGHT_STAGES } from "../../../../src/game/mechanisms/roles/seer/night_stages";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { NightStageRegistry } from "../../../../src/game/mechanisms/stages/night/night_stage_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { BaselineBotActionProvider } from "../../../../src/ai/agents/providers/action_providers";

const deck = [Role.CursedFox, Role.Seer, Role.Wolf, Role.Witch, Role.Guard, Role.Villager];

const fixture = () => bootstrapGame(foxBoard(deck), { fixedRoles: deck });

test("committed Fox inspection interrupted later cannot be silently lost by full same-night reentry", async () => {
  const { world } = fixture();
  let current = true,
    requests = 0;
  const catalog = createRoleCatalog({
    contributions: getDefaultRoleContributions().map((profile) => ({
      ...profile,
      runtime: {
        ...profile.runtime,
        possibleNightAbilities: [],
        nightStages:
          profile.metadata.role === Role.Seer
            ? [
                SEER_NIGHT_STAGES[0]!,
                {
                  id: "late_interrupt",
                  priority: 800,
                  async execute() {
                    current = false;
                  },
                },
              ]
            : [],
      },
    })),
  });
  const pipeline = new NightPipeline({
    world,
    events: [],
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new NightStageRegistry(catalog),
  });
  const actions = {
    async getAction() {
      requests++;
      return { name: "check_identity" as const, args: { target_id: 1 } };
    },
  };
  expect(await pipeline.execute(foxBoard(deck), actions, 1, { isCurrent: () => current })).toEqual({
    interrupted: true,
  });
  current = true;
  await expect(
    pipeline.execute(foxBoard(deck), actions, 1, { isCurrent: () => current }),
  ).rejects.toThrow("fox_inspection_night_reentry_after_commit");
  expect(requests).toBe(1);
});

for (const poison of [false, true])
  test(`first-day sheriff identity replacement filters only old FoxInspection; independent poison=${poison}`, async () => {
    const board = { ...foxBoard(deck), enableSheriff: true },
      game = bootstrapGame(board, { fixedRoles: deck }),
      base = new BaselineBotActionProvider(game.world);
    let replaced = false;
    await game.phaseManager.runSingleCycle(
      {
        async getAction(req) {
          if (req.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: null, abstain: true } };
          if (req.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (req.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: {
                target_id: poison ? 1 : 4,
                potion_type: poison ? PotionType.Poison : PotionType.None,
              },
            };
          if (req.context.stage === "sheriff_nomination" && !replaced) {
            const role = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
            role.role = Role.Villager;
            role.camp = Camp.Good;
            (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {};
            replaced = true;
          }
          if (req.allowedTools.includes("vote"))
            return { name: "vote", args: { target_id: null, abstain: true } };
          return base.getAction(req);
        },
      },
      2,
    );
    expect(replaced).toBe(true);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload.deaths),
    ).toEqual([poison ? [1] : []]);
    expect(game.world.getAliveEntityIds().includes(1)).toBe(!poison);
  });

test("last Good dies while Fox survives: only Fox wins at the complete night checkpoint", async () => {
  const roles = [Role.CursedFox, Role.Wolf, Role.Villager],
    game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const base = new BaselineBotActionProvider(game.world);
  await game.phaseManager.runSingleCycle(
    {
      async getAction(req) {
        if (req.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        return base.getAction(req);
      },
    },
    2,
  );
  expect(game.phaseManager.getSnapshot().result).toMatchObject({
    winner: null,
    reason: "cursed_fox_survived_faction_elimination",
    outcome: {
      kind: "victory",
      primary: { kind: "individual", playerId: 1, winningPlayerIds: [1] },
      winningPlayerIds: [1],
    },
    decidedAt: { checkpoint: "night_settled" },
  });
  expect(game.world.getAliveEntityIds()).toEqual([1, 2]);
});
