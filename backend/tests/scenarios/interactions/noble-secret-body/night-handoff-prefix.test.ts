/**
 * 交互场景验证真实原生夜晚后的 Noble 输出失败前缀。输入保原固定玩家、合法行动与同一错误；
 * 末阶段只捕获状态，在真实 native_damage 事件已进入测试数组后才安装晚输出字段 getter。
 * 一次读取／同错误、仍 open 的 authority 与已发布末事实是原独立字面预期；原事件 push 接收方和返回值保留。
 * 旧 evilKnightBindings 输出字段已退休，探针渠道／安装时点的迁移明确记录，不用生产 hook、模型或整局替代原结果。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { NightPipeline } from "../../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { nobleSecretBodyTwelveConfig } from "../../../../src/runtime/scenarios/noble_secret_body_twelve";
import { Role } from "../../../../src/domain/identity";
import type { BoardConfig } from "../../../../src/domain/board";
import type { World } from "../../../../src/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { NightStageRegistry } from "../../../../src/rulesets/night-stage-plan";
import { checkpointNobleBodyAuthority } from "../../../../src/game/mechanisms/roles/noble_secret_body/authority";
import type { NightStageContext } from "../../../../src/game/mechanisms/stages/night/contracts";

test("a later result getter failure preserves the already-transferred sender prefix", async () => {
  const config = nobleSecretBodyTwelveConfig(),
    game = bootstrapGame(config, {
      fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    error = new Error("noble_return_getter_rejected");
  let reads = 0;
  let capturedState: NightStageContext["state"] | undefined;
  class Stages extends NightStageRegistry {
    override getStages(config: BoardConfig, world?: World) {
      return [
        ...super.getStages(config, world),
        {
          id: "return-getter-probe",
          priority: 1,
          async execute(ctx: NightStageContext) {
            capturedState = ctx.state;
          },
        },
      ];
    }
  }
  const events: GameEvent[] = [],
    pipeline = new NightPipeline({
      world: game.world,
      events,
      stageRegistry: new Stages(),
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
  const originalPush = events.push, originalDescriptor = Object.getOwnPropertyDescriptor(events, "push");
  events.push = function(this: GameEvent[], ...items: GameEvent[]) {
    const size = originalPush.apply(this, items);
    // 先保原事实发布，再安装故障；伤害组合的早读取已经完成，return/handoff 尚未发生。
    if (items.some((event) => event.type === "noble_body_native_damage_committed")) {
      if (!capturedState) throw new Error("probe_state_missing");
      Object.defineProperty(capturedState, "inspectionAttacks", {
        get() { reads++; throw error; },
      });
    }
    return size;
  };
  try {
    await expect(
      pipeline.execute(
        config,
        {
          async getAction(request) {
            if (request.allowedTools.includes("protect_secret_body"))
              return { name: "protect_secret_body", args: { target_id: null } };
            if (request.allowedTools.includes("check_identity"))
              return { name: "check_identity", args: { target_id: 6 } };
            return demonNightChoice(request, 5, { knife: null, hunt: null });
          },
        },
        1,
      ),
    ).rejects.toBe(error);
  } finally {
    if (originalDescriptor) Object.defineProperty(events, "push", originalDescriptor);
    else Reflect.deleteProperty(events, "push");
  }
  expect(reads).toBe(1);
  expect(checkpointNobleBodyAuthority(game.world, false).nights[0]?.status).toBe("open");
  expect(events.at(-1)?.type).toBe("noble_body_native_damage_committed");
});
