/**
 * 单元测试负责原十／十二人板的真实夜流水线与严格亲传交付反例。输入为原牌组和手写 Provider，
 * 字面断言狼聊→传爪→刀票、源库存／受传库存和失败零扣，不用生产规则计算 oracle。
 * 旧奇迹商人明确选择其合法 null，不把缺失亲传动作冒充空过；不运行模型、网络或完整对局。
 */
import { expect, test } from "bun:test";
import {
  Role,
  PotionType,
  type ActionRequest,
  type GameEvent,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  awakenedWolfKingTenConfig,
  awakenedWolfKingTwelveConfig,
} from "../../../../src/rulesets/presets/awakened-wolf-king";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import {
  ownedAwakenedClaws,
  getAwakenedClaws,
} from "../../../../src/features/awakened-wolf-king/state";
import {
  deferRequestDelivery,
  deriveBoundedRequest,
} from "../../../../src/domain/request-delivery";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
function fixture(twelve = false) {
  const config = structuredClone(twelve ? awakenedWolfKingTwelveConfig : awakenedWolfKingTenConfig),
    f = bootstrapGame(config),
    events: GameEvent[] = [];
  const king = f.world.getEntityIdsByRole(Role.AwakenedWolfKing)[0]!,
    wolf = f.world.getEntityIdsByRole(Role.Wolf)[0]!,
    villagers = f.world.getEntityIdsByRole(Role.Villager);
  const pipeline = new NightPipeline({
    world: f.world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
  });
  return { ...f, config, events, pipeline, king, wolf, villagers };
}
function provider(f: ReturnType<typeof fixture>, special: (r: ActionRequest) => ToolCall | null) {
  return {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      switch (r.allowedTools[0]) {
        case "bequeath_claw":
          return special(r);
        case "bestow_ability":
          return null;
        case "speak_to_wolves":
          return { name: "speak_to_wolves", args: { text: "literal finish", end_chat: true } };
        case "kill_vote":
          return { name: "kill_vote", args: { target_id: f.villagers[0]!, abstain: false } };
        case "check_identity":
          return { name: "check_identity", args: { target_id: f.wolf } };
        case "use_potion":
          return {
            name: "use_potion",
            args: { target_id: r.actorId, potion_type: PotionType.None },
          };
        case "dream":
          return { name: "dream", args: { target_id: f.villagers[1]! } };
        default:
          throw new Error(`unexpected_literal_tool:${r.allowedTools[0]}`);
      }
    },
  };
}
for (const twelve of [false, true])
  test(`original ${twelve ? 12 : 10}-player board reaches the real private bequest between pack chat and knife vote`, async () => {
    const f = fixture(twelve),
      delivery: boolean[] = [];
    const parsed = parseBoardDefinition(boardDefinitionFromConfig("king_pipeline", f.config));
    expect(parsed.config.boardSize).toBe(twelve ? 12 : 10);
    const result = await f.pipeline.execute(
      f.config,
      provider(f, (request) => {
        expect(request.context.claw_bequest_candidates).toContain(f.wolf);
        expect(request.context.action_failure_policy).toBe("error");
        expect(request.context.allow_fallback).toBe(false);
        expect(deferRequestDelivery(request, (accepted) => delivery.push(accepted))).toBe(true);
        return { name: "bequeath_claw", args: { target_id: f.wolf } };
      }),
      1,
    );
    expect(result.interrupted).toBe(false);
    expect(delivery).toEqual([true]);
    expect(ownedAwakenedClaws(f.world, f.king)!.units.map((u) => u.status)).toEqual([
      "transferred",
      "ready",
    ]);
    expect(ownedAwakenedClaws(f.world, f.wolf)!.units.map((u) => u.status)).toEqual(["ready"]);
    const grant = f.events.findIndex((e) => e.type === "awakened_claw_bequeathed"),
      vote = f.events.findIndex((e) => e.type === "wolf_kill_vote_cast");
    expect(grant).toBeGreaterThan(
      f.events.findLastIndex((e) => e.type === "wolf_discussion_ended"),
    );
    expect(grant).toBeLessThan(vote);
    expect(
      (f.events[grant] as Extract<GameEvent, { type: "awakened_claw_bequeathed" }>).audience,
    ).toEqual([f.king, f.wolf].sort((a, b) => a - b));
  });
test.each(["missing", "target", "source", "pin", "deadline"] as const)(
  "real bequest %s failure closes false and preserves both native units",
  async (mode) => {
    const f = fixture(),
      delivery: boolean[] = [],
      originalNow = Date.now;
    try {
      await expect(
        f.pipeline.execute(
          f.config,
          provider(f, (request) => {
            expect(deferRequestDelivery(request, (accepted) => delivery.push(accepted))).toBe(true);
            if (mode === "missing") return null;
            if (mode === "target")
              f.world.addComponent(f.wolf, COMPONENT.Alive, createAliveComponent());
            if (mode === "source") {
              const role = f.world.getComponent(f.king, COMPONENT.Role)!;
              Object.defineProperty(role.privateState, "awakenedClaws", {
                value: JSON.parse(JSON.stringify(getAwakenedClaws(role))),
                writable: true,
              });
            }
            if (mode === "pin")
              request.context.claw_bequest_candidates = [
                ...request.context.claw_bequest_candidates!,
              ];
            if (mode === "deadline") {
              const deadline = Date.now() + 10;
              deriveBoundedRequest(request, deadline);
              Date.now = () => deadline;
            }
            return { name: "bequeath_claw", args: { target_id: f.wolf } };
          }),
          1,
        ),
      ).rejects.toThrow();
    } finally {
      Date.now = originalNow;
    }
    expect(delivery).toEqual([false]);
    expect(
      getAwakenedClaws(f.world.getComponent(f.king, COMPONENT.Role))!.units.map((u) => u.status),
    ).toEqual(["ready", "ready"]);
    expect(getAwakenedClaws(f.world.getComponent(f.wolf, COMPONENT.Role))).toBeUndefined();
    expect(f.events.filter((e) => e.type === "awakened_claw_bequeathed")).toEqual([]);
    expect(f.world.activeDeathActionCount).toBe(0);
  },
);
