/**
 * 单元测试：验证序王固定放逐票、明确放弃与合格持有者的翻牌投票。输入为原票和库存；生命、重启及库存断言检查仅翻牌一次的原机制，不生成新预期。
 */
import { assignSheriff } from "../../../../src/game/mechanisms/sheriff/badge";
import type { BadgeComponent } from "../../../../src/domain/components/badge";
import type { VotingRightComponent } from "../../../../src/domain/components/voting-right";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import {
  Role,
  WinCondition,
  type BoardConfig,
  type ActionRequest,
  type GameEvent,
  type ToolCall,
} from "../../../../src/domain/model";
import { VotingPipeline } from "../../../../src/game/engine/phase_pipeline/voting_pipeline";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { createDefaultRoleRegistry } from "../../../../src/game/mechanisms";
import { getOrderPrinceState } from "../../../../src/game/mechanisms/roles/order_prince/ports";
import type { RoleComponent } from "../../../../src/domain/components/role";
const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.OrderPrince,
];
function fixture() {
  const config: BoardConfig = {
    boardSize: 12,
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: false,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    voting: { exilePolicy: "awa_one_pk_v1" },
  };
  const { world } = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const voting = new VotingPipeline({
    world,
    events,
    toolGateway: new ToolGateway(),
    eventRegistry: new EventRegistry(),
    roleRegistry: createDefaultRoleRegistry(),
  });
  const state = () => getOrderPrinceState(world.getComponent(12, COMPONENT.Role), () => world.getComponent(12, COMPONENT.Camp));
  return { world, events, voting, config, state };
}
function vote(id: number | null): ToolCall {
  return { name: "vote", args: { target_id: id, abstain: id === null } };
}
function provider(activate = true, fail: string | null = null, first: number | null = 12) {
  const requests: ActionRequest[] = [];
  return {
    requests,
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      requests.push(r);
      const s = r.context.stage;
      if (s === fail) return null;
      if (s === "voting") return vote(first);
      if (s === "order_prince_choice") return { name: "reset_exile_vote", args: { activate } };
      if (s === "order_prince_speech" || s === "exile_pk_speech")
        return { name: "speak", args: { text: "Use the new ballot." } };
      if (s === "order_prince_revote" || s === "exile_pk_vote") return vote(1);
      return null;
    },
  };
}
test("order prince: saves self before exile and restarts exactly once", async () => {
  const f = fixture(),
    p = provider();
  const result = await f.voting.execute(f.config, p, { day: 1 });
  expect(result.removed).toEqual([1]);
  expect(f.world.getAliveEntityIds()).toContain(12);
  expect(f.state()?.history).toEqual([{ day: 1, activate: true }]);
  expect(p.requests.filter((r) => r.context.stage === "order_prince_choice")).toHaveLength(1);
  expect(p.requests.filter((r) => r.context.stage === "order_prince_revote")).toHaveLength(12);
  expect(f.events.filter((e) => e.type === "order_prince_revote_started")).toHaveLength(1);
  expect(f.events.filter((e) => e.type === "voted_out").map((e) => e.payload.target)).toEqual([1]);
  for (const r of p.requests.filter((r) => r.context.stage?.startsWith("order_prince")))
    expect(r.context.allow_fallback).toBe(false);
});
test("order prince: explicit decline preserves skill and normal exile", async () => {
  const f = fixture(),
    p = provider(false, null, 1);
  const result = await f.voting.execute(f.config, p, { day: 1 });
  expect(result.removed).toEqual([1]);
  expect(f.state()?.history).toEqual([{ day: 1, activate: false }]);
  expect(p.requests.some((r) => r.context.stage === "order_prince_speech")).toBe(false);
});
test("order prince: all-abstention first ballot still allows activation", async () => {
  const f = fixture(),
    p = provider(true, null, null);
  const result = await f.voting.execute(f.config, p, { day: 1 });
  expect(result.removed).toEqual([1]);
  expect(f.state()?.history.at(-1)?.activate).toBe(true);
});
for (const stage of ["order_prince_choice", "order_prince_speech", "order_prince_revote"])
  test("order prince: required failure " + stage, async () => {
    const f = fixture(),
      p = provider(true, stage);
    await expect(f.voting.execute(f.config, p, { day: 1 })).rejects.toThrow();
    expect(f.events.some((e) => e.type === "voted_out")).toBe(false);
    expect(f.state()?.history).toEqual(
      stage === "order_prince_choice" ? [] : [{ day: 1, activate: true }],
    );
  });
test("order prince: spent skill not offered on a later day", async () => {
  const f = fixture(),
    p = provider();
  await f.voting.execute(f.config, p, { day: 1 });
  const next = provider(true, null, 2);
  const result = await f.voting.execute(f.config, next, { day: 2 });
  expect(result.removed).toEqual([2]);
  expect(next.requests.some((r) => r.context.stage === "order_prince_choice")).toBe(false);
});

for (const stage of [
  "order_prince_choice",
  "order_prince_speech",
  "order_prince_revote",
  "exile_pk_speech",
  "exile_pk_vote",
])
  test("order prince: original authority revoked during " + stage, async () => {
    const f = fixture();
    const base = provider();
    let replaced = false;
    const p = {
      async getAction(r: ActionRequest): Promise<ToolCall | null> {
        if (r.context.stage === stage && !replaced) {
          replaced = true;
          const role = f.world.getComponent(12, COMPONENT.Role)!;
          (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
            ...role.privateState,
          };
        }
        if (stage.startsWith("exile_pk") && r.context.stage === "order_prince_revote")
          return vote(r.actorId <= 6 ? 1 : 2);
        return base.getAction(r);
      },
    };
    await expect(f.voting.execute(f.config, p, { day: 1 })).rejects.toThrow(
      "order_prince_original_state_revoked",
    );
    expect(replaced).toBe(true);
    expect(f.events.some((e) => e.type === "voted_out")).toBe(false);
  });
test("order prince: stale phase in PK fails rather than recording a successful empty result", async () => {
  const f = fixture();
  const base = provider();
  let valid = true;
  const p = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      if (r.context.stage === "order_prince_revote") return vote(r.actorId <= 6 ? 1 : 2);
      if (r.context.stage === "exile_pk_speech") valid = false;
      return base.getAction(r);
    },
  };
  await expect(f.voting.execute(f.config, p, { day: 1, isCurrent: () => valid })).rejects.toThrow(
    "order_prince_revote_stale",
  );
  expect(f.events.some((e) => e.type === "voted_out")).toBe(false);
});

test("order prince: public reveal preserves badge and weighted revote", async () => {
  const f = fixture();
  expect(assignSheriff(f.world, 12, f.config)).toBe(true);
  const result = await f.voting.execute(f.config, provider(), { day: 1 });
  expect(result.removed).toEqual([1]);
  expect(f.world.getAliveEntityIds()).toContain(12);
  expect(f.world.getComponent(12, COMPONENT.Badge)).toMatchObject({
    isSheriff: true,
    destroyed: false,
    voteWeight: 1.5,
  });
  expect(f.world.getComponent(12, COMPONENT.VotingRight)).toMatchObject({
    canVote: true,
    weight: 1.5,
  });
  const reset = f.events.findIndex((e) => e.type === "order_prince_revote_started");
  expect(
    f.events
      .slice(reset)
      .filter((e) => e.type === "vote_cast" && e.payload.actorId === 12)
      .map((e) => (e.type === "vote_cast" ? e.payload.weight : Number.NaN)),
  ).toEqual([1.5]);
  expect(
    f.events.some(
      (e) => e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed",
    ),
  ).toBe(false);
});

test("order prince: tied original ballot is voided before PK and saves another target", async () => {
  const f = fixture(),
    base = provider();
  const requests: ActionRequest[] = [];
  const p = {
    async getAction(r: ActionRequest) {
      requests.push(r);
      if (r.context.stage === "voting") return vote(r.actorId <= 6 ? 1 : 2);
      if (r.context.stage === "order_prince_revote") return vote(3);
      return base.getAction(r);
    },
  };
  const result = await f.voting.execute(f.config, p, { day: 1 });
  expect(result.removed).toEqual([3]);
  expect(requests.some((r) => r.context.stage === "exile_pk_speech")).toBe(false);
  expect(f.world.getAliveEntityIds()).toContain(1);
  expect(f.world.getAliveEntityIds()).toContain(2);
  expect(requests.filter((r) => r.context.stage === "order_prince_choice")).toHaveLength(1);
});
test("order prince: all-abstention restarted ballot ends without exile or recursive reset", async () => {
  const f = fixture(),
    base = provider();
  const requests: ActionRequest[] = [];
  const p = {
    async getAction(r: ActionRequest) {
      requests.push(r);
      return r.context.stage === "order_prince_revote" ? vote(null) : base.getAction(r);
    },
  };
  const result = await f.voting.execute(f.config, p, { day: 1 });
  expect(result.removed).toEqual([]);
  expect(f.world.getAliveEntityIds()).toHaveLength(12);
  expect(f.state()?.history).toEqual([{ day: 1, activate: true }]);
  expect(requests.filter((r) => r.context.stage === "order_prince_choice")).toHaveLength(1);
  expect(
    requests.filter((r) => r.context.stage === "order_prince_speech")[0]!.allowedTools,
  ).toEqual(["speak"]);
});
