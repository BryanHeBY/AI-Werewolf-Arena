/**
 * 单元测试验证夜间有限重入准入的真实提交证据、优先级及查询短路；输入为原 World、机制写入和日次。
 * 输出以手写完整 trace、原错误码及已提交状态验收，不用准入实现生成预期，不伪造谓词 registry。
 * 黑市只执行无目标时原跳过提交这个有界步骤；不运行整局、模型、文件或网络，拒绝不得重开已关闭交易。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { captureNightLife } from "../../../src/domain/night-effects";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import { assertNightCommitAdmission } from "../../../src/rulesets/night-commit-admission";
import { commitFoxInspection } from "../../../src/features/cursed-fox/inspection-effect";
import {
  markDreamNightCommitted,
  hasDreamNightCommit,
} from "../../../src/features/dreamer/night-frame";
import { recordMechanicalNightCommit } from "../../../src/features/mechanical-wolf/night-scope";
import { recordRecipientNightCommit } from "../../../src/features/night-abilities/recipient-ability-stage";
import {
  recordLuckyNightCommit,
  hasLuckyNightCommit,
} from "../../../src/features/miracle-merchant/lucky-stage";
import { BLACK_MARKET_TRADE_STAGE } from "../../../src/features/black-market-merchant/night-stage";
import {
  freshBlackMarketState,
  setBlackMarketState,
  getBlackMarketState,
} from "../../../src/features/black-market-merchant/state";
import type { NightStageState } from "../../../src/engine/night/contracts";
import { nightStageContext } from "../../support/builders/night-stage-context";

test("an uncommitted night reads World then day at every one of the twelve original predicate sites", () => {
  const world = new World(),
    trace: string[] = [];
  let index = 0;
  expect(() =>
    assertNightCommitAdmission({
      world() {
        trace.push(`world:${index}`);
        return world;
      },
      day() {
        trace.push(`day:${index++}`);
        return 3;
      },
    }),
  ).not.toThrow();
  expect(trace).toEqual([
    "world:0",
    "day:0",
    "world:1",
    "day:1",
    "world:2",
    "day:2",
    "world:3",
    "day:3",
    "world:4",
    "day:4",
    "world:5",
    "day:5",
    "world:6",
    "day:6",
    "world:7",
    "day:7",
    "world:8",
    "day:8",
    "world:9",
    "day:9",
    "world:10",
    "day:10",
    "world:11",
    "day:11",
  ]);
});

test("a committed Fox inspection wins before Dream and Mechanical without reading later suppliers or undoing claims", () => {
  const world = new World(),
    fox = world.createEntity(),
    trace: string[] = [];
  world.addComponent(fox, COMPONENT.Role, createRoleComponent(Role.CursedFox));
  world.addComponent(fox, COMPONENT.Camp, { camp: Camp.ThirdParty });
  world.addComponent(fox, COMPONENT.Alive, createAliveComponent());
  const state: NightStageState = {
    wolfChatOrder: [],
    endedWolves: new Set(),
    wolfVotes: {},
    wolfTarget: null,
    seerChecks: [],
  };
  commitFoxInspection(world, state, captureNightLife(world, fox)!, 3, () => true);
  markDreamNightCommitted(world, 3);
  recordMechanicalNightCommit(world, 3);
  let reads = 0;
  expect(() =>
    assertNightCommitAdmission({
      world() {
        trace.push("world");
        if (reads++ !== 0) throw new Error("later_world_must_not_read");
        return world;
      },
      day() {
        trace.push("day");
        return 3;
      },
    }),
  ).toThrow("fox_inspection_night_reentry_after_commit");
  expect(trace).toEqual(["world", "day"]);
  expect(state.foxInspections).toHaveLength(1);
  expect(hasDreamNightCommit(world, 3)).toBe(true);
});

test("Black Market trade and recipient commits keep their separate short-circuit prefixes before Lucky", async () => {
  const tradedWorld = new World(),
    merchant = tradedWorld.createEntity(),
    role = createRoleComponent(Role.BlackMarketMerchant);
  setBlackMarketState(role, freshBlackMarketState());
  tradedWorld.addComponent(merchant, COMPONENT.Role, role);
  tradedWorld.addComponent(merchant, COMPONENT.Camp, { camp: Camp.Good });
  tradedWorld.addComponent(merchant, COMPONENT.Alive, createAliveComponent());
  const context = nightStageContext({
    world: tradedWorld,
    currentDay: () => 3,
    getAliveByRole: (kind) => (kind === Role.BlackMarketMerchant ? [merchant] : []),
  });
  // 原机制对无目标交易执行 skip，实际关闭当天并写提交证据，不请求模型或构造假 marker。
  await BLACK_MARKET_TRADE_STAGE.execute(context);
  const tradeTrace: string[] = [];
  let tradeReads = 0;
  expect(() =>
    assertNightCommitAdmission({
      world() {
        tradeTrace.push(`world:${tradeReads}`);
        if (tradeReads >= 5) throw new Error("recipient_must_not_read_after_trade");
        return tradedWorld;
      },
      day() {
        tradeTrace.push(`day:${tradeReads++}`);
        return 3;
      },
    }),
  ).toThrow("black_market_night_reentry_after_commit");
  expect(tradeTrace).toEqual([
    "world:0",
    "day:0",
    "world:1",
    "day:1",
    "world:2",
    "day:2",
    "world:3",
    "day:3",
    "world:4",
    "day:4",
  ]);
  expect(getBlackMarketState(role)?.closedDay).toBe(3);
  expect(context.events.map((event) => event.type)).toEqual(["black_market_trade_skipped"]);

  const recipientWorld = new World(),
    recipientTrace: string[] = [];
  recordRecipientNightCommit(recipientWorld, 3, "black_market");
  recordLuckyNightCommit(recipientWorld, 3);
  let recipientReads = 0;
  expect(() =>
    assertNightCommitAdmission({
      world() {
        recipientTrace.push(`world:${recipientReads}`);
        if (recipientReads >= 6) throw new Error("lucky_must_not_read_after_recipient");
        return recipientWorld;
      },
      day() {
        recipientTrace.push(`day:${recipientReads++}`);
        return 3;
      },
    }),
  ).toThrow("black_market_night_reentry_after_commit");
  expect(recipientTrace).toEqual([
    "world:0",
    "day:0",
    "world:1",
    "day:1",
    "world:2",
    "day:2",
    "world:3",
    "day:3",
    "world:4",
    "day:4",
    "world:5",
    "day:5",
  ]);
  expect(hasLuckyNightCommit(recipientWorld, 3)).toBe(true);
});
