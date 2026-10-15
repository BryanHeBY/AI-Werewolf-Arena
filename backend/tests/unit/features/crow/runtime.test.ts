/**
 * 单元与真实流水线测试负责验证乌鸦付款、原生命撤权、配置及独立附加票。
 * 输入为固定原生板、真实请求和手写动作；字面预期核连续夜、自选/必选、PK两政策、失败通知及受众。
 * 伪造生命、到期/坏别名和扩展getter是实际反例，不用生产计票生成oracle，也不调用付费模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { crowTwelveConfig } from "../../../../src/rulesets/presets/crow-twelve";
import {
  Role,
  Phase,
  type GameEvent,
  type ActionRequest,
  type ToolCall,
  type CrowConfig,
} from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { crowState, projectCrowState } from "../../../../src/features/crow/state";
import {
  openCrowNight,
  commitCrowChoice,
  closeCrowNight,
  crowChoiceAllowed,
  applyCrowBonus,
} from "../../../../src/features/crow/authority";
import { CROW_NIGHT_STAGE } from "../../../../src/features/crow/night-stage";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import {
  deferRequestDelivery,
  deriveBoundedRequest,
  assertRequestDelivery,
} from "../../../../src/domain/request-delivery";
import type { TrustedNightStageRuntime } from "../../../../src/engine/night/trusted-runtime";
import { getDefaultRoleContributions } from "../../../../src/rulesets/roles/role-catalog-assembly";
import { buildAgentVisibleEventFeed } from "../../../../src/agents/observation/event-feed";
import { crowEventLabel } from "@ai-werewolf-arena/game-presentation";
function fixture(
  policy: "initial_ballot_only" | "all_ballots" = "initial_ballot_only",
  overrides: Partial<CrowConfig> = {},
) {
  const config = structuredClone(crowTwelveConfig);
  config.crow = { ...config.crow!, ballotPolicy: policy, ...overrides };
  const f = bootstrapGame(config);
  const actor = f.world
    .entityIds()
    .find((id) => f.world.getComponent(id, COMPONENT.Role)?.role === Role.Crow)!;
  const target = f.world
    .entityIds()
    .find((id) => f.world.getComponent(id, COMPONENT.Role)?.role === Role.Villager)!;
  return { ...f, actor, target, events: [] as GameEvent[] };
}
test("乌鸦附加票是固定一票，不制造vote_cast；本人当夜死亡仍有效，首轮与PK政策独立", () => {
  for (const policy of ["initial_ballot_only", "all_ballots"] as const) {
    const f = fixture(policy);
    openCrowNight(f.world, f.actor, 1);
    commitCrowChoice(f.world, f.actor, 1, f.target);
    f.world.getComponent(f.actor, COMPONENT.Alive)!.alive = false;
    const tally = { [f.target]: 1.5 };
    applyCrowBonus(f.world, 1, 1, tally, f.events);
    applyCrowBonus(f.world, 1, 1, tally, f.events);
    expect(tally[f.target]).toBe(2.5);
    expect(f.events.map((e) => e.type)).toEqual(["crow_curse_applied"]);
    const pk = {};
    applyCrowBonus(f.world, 1, 2, pk, f.events, [f.target]);
    expect(pk).toEqual(policy === "all_ballots" ? { [f.target]: 1 } : {});
    const tomorrow = {};
    applyCrowBonus(f.world, 2, 1, tomorrow, f.events);
    expect(tomorrow).toEqual({});
  }
});
test("已付目标死亡、同号复活或换身体不接续诅咒；PK无该候选不加票", () => {
  for (const mode of ["dead", "revived", "replacement", "pk_not_candidate"] as const) {
    const f = fixture("all_ballots");
    openCrowNight(f.world, f.actor, 1);
    commitCrowChoice(f.world, f.actor, 1, f.target);
    if (mode === "dead" || mode === "revived")
      f.world.getComponent(f.target, COMPONENT.Alive)!.alive = false;
    if (mode === "revived") f.world.getComponent(f.target, COMPONENT.Alive)!.alive = true;
    if (mode === "replacement")
      f.world.addComponent(f.target, COMPONENT.Alive, createAliveComponent());
    const tally = {};
    applyCrowBonus(
      f.world,
      1,
      mode === "pk_not_candidate" ? 2 : 1,
      tally,
      f.events,
      mode === "pk_not_candidate" ? [f.actor] : undefined,
    );
    expect(tally).toEqual({});
    expect(f.events).toEqual([]);
  }
});
test("旧请求选到同号替换生命必须拒绝，历史不付款", () => {
  const f = fixture();
  openCrowNight(f.world, f.actor, 1);
  f.world.addComponent(f.target, COMPONENT.Alive, createAliveComponent());
  expect(crowChoiceAllowed(f.world, f.actor, 1, f.target)).toBe(false);
  expect(() => commitCrowChoice(f.world, f.actor, 1, f.target)).toThrow("crow_choice_invalid");
  expect(crowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history).toEqual([]);
});
test("连续两晚同目标禁止；中间明确弃权重置连续夜；玩家投影完全脱离", () => {
  const f = fixture();
  openCrowNight(f.world, f.actor, 1);
  commitCrowChoice(f.world, f.actor, 1, f.target);
  openCrowNight(f.world, f.actor, 2);
  expect(crowChoiceAllowed(f.world, f.actor, 2, f.target)).toBe(false);
  commitCrowChoice(f.world, f.actor, 2, null);
  openCrowNight(f.world, f.actor, 3);
  expect(crowChoiceAllowed(f.world, f.actor, 3, f.target)).toBe(true);
  commitCrowChoice(f.world, f.actor, 3, f.target);
  const projected = projectCrowState(f.world.getComponent(f.actor, COMPONENT.Role))!;
  projected.history[0]!.targetId = null;
  expect(crowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history[0]!.targetId).toBe(
    f.target,
  );
});
async function runStage(
  f: ReturnType<typeof fixture>,
  decide: (r: ActionRequest) => Promise<ToolCall | null>,
) {
  const factory = new GameActionRequestFactory(f.world, f.events, 1);
  return CROW_NIGHT_STAGE.execute({
    world: f.world,
    events: f.events,
    getAliveByRole: (role) =>
      f.world
        .getAliveEntityIds()
        .filter((id) => f.world.getComponent(id, COMPONENT.Role)?.role === role),
    currentDay: () => 1,
    isCurrent: () => true,
    actionProvider: { getAction: decide },
    toolGateway: new ToolGateway(),
    makeRequest: (actorId, allowedTools, context) => {
      const { stage, requiresAction = true, ...extra } = context;
      return factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage,
        requiresAction,
        summary: { key: "request.summary.night_action" },
        context: extra,
      });
    },
  } as TrustedNightStageRuntime);
}
for (const mode of ["expired", "context_mutated", "target_replaced", "missing"] as const)
  test(`真实夜请求${mode}只结算false，不支付选择`, async () => {
    const f = fixture(),
      settlements: boolean[] = [];
    await expect(
      runStage(f, async (r) => {
        expect(deferRequestDelivery(r, (accepted) => settlements.push(accepted))).toBe(true);
        if (mode === "expired") r.deadlineAtMs = Date.now() - 1;
        if (mode === "context_mutated") r.context.day = 2;
        if (mode === "target_replaced")
          f.world.addComponent(f.target, COMPONENT.Alive, createAliveComponent());
        return mode === "missing" ? null : { name: "curse_exile", args: { target_id: f.target } };
      }),
    ).rejects.toThrow();
    expect(settlements).toEqual([false]);
    expect(projectCrowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history).toEqual([]);
  });
test("合法期限别名与原请求共用预算；坏别名不毒原请求；true通知晚错保已付历史", async () => {
  const f = fixture(),
    settlements: boolean[] = [];
  await expect(
    runStage(f, async (r) => {
      const alias = deriveBoundedRequest(r, Date.now() + 30000);
      alias.actorId = f.target;
      expect(() => assertRequestDelivery(alias)).toThrow();
      assertRequestDelivery(r);
      deferRequestDelivery(r, (accepted) => {
        settlements.push(accepted);
        throw new Error("observer_late_error");
      });
      return { name: "curse_exile", args: { target_id: f.target } };
    }),
  ).rejects.toThrow("observer_late_error");
  expect(settlements).toEqual([true]);
  expect(projectCrowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history).toEqual([
    { day: 1, targetId: f.target },
  ]);
  closeCrowNight(f.world);
});
test("原55角色仍native，新乌鸦仅custom值查询；夜选受众与公开附加票中英无原始JSON", () => {
  const contributions = getDefaultRoleContributions();
  const crow = contributions.find((c) => c.metadata.role === Role.Crow)!;
  expect(crow.presentation.kind).toBe("custom");
  expect(contributions.filter((c) => c.presentation.kind === "native")).toHaveLength(55);
  const f = fixture();
  const events: GameEvent[] = [
    {
      timestamp: 1,
      type: "crow_curse_chosen",
      payload: { actorId: f.actor, day: 1, targetId: f.target },
      audience: [f.actor],
    },
    {
      timestamp: 2,
      type: "crow_curse_applied",
      payload: { day: 1, targetId: f.target, round: 1, bonus: 1 },
    },
  ];
  expect(buildAgentVisibleEventFeed(f.world, events, f.actor).map((e) => e.type)).toEqual([
    "crow_curse_chosen",
    "crow_curse_applied",
  ]);
  expect(buildAgentVisibleEventFeed(f.world, events, f.target).map((e) => e.type)).toEqual([
    "crow_curse_applied",
  ]);
  expect(crowEventLabel(events[1]!.type, events[1]!.payload, "zh-CN")).toContain("额外计1票");
  expect(crowEventLabel(events[1]!.type, events[1]!.payload, "en")).toContain("one extra vote");
});

test("领域晚查询抛原错误，租约不能改写原因或付款", async () => {
  const f = fixture(),
    sentinel = new Error("crow_domain_sentinel"),
    settlements: boolean[] = [];
  await expect(
    runStage(f, async (r) => {
      deferRequestDelivery(r, (accepted) => settlements.push(accepted));
      Object.defineProperty(f.world.getComponent(f.actor, COMPONENT.Role)!, "privateState", {
        get() {
          throw sentinel;
        },
      });
      return { name: "curse_exile", args: { target_id: f.target } };
    }),
  ).rejects.toBe(sentinel);
  expect(settlements).toEqual([false]);
});

import { BaselineBotActionProvider } from "../../../../src/agents/baseline/privileged";
for (const policy of ["initial_ballot_only", "all_ballots"] as const)
  test(`真实流水线PK不复制附加票或玩家票据/${policy}`, async () => {
    const f = fixture(policy),
      other = f.world
        .entityIds()
        .find(
          (id) =>
            id !== f.target &&
            id !== f.actor &&
            f.world.getComponent(id, COMPONENT.Role)?.role === Role.Villager,
        )!;
    const voters = f.world.entityIds().filter((id) => id !== f.target && id !== other);
    const baseline = new BaselineBotActionProvider(f.world);
    await f.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (r.allowedTools.includes("curse_exile"))
            return { name: "curse_exile", args: { target_id: f.target } };
          if (r.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: null, abstain: true } };
          if (r.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (r.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: { target_id: r.actorId, potion_type: "none" as never },
            };
          if (r.allowedTools.includes("run_for_sheriff"))
            return { name: "run_for_sheriff", args: { run: false } };
          if (r.allowedTools.includes("self_destruct")) return null;
          if (r.allowedTools.includes("vote")) {
            const index = voters.indexOf(r.actorId),
              target =
                r.context.stage === "exile_pk_vote"
                  ? null
                  : index >= 0 && index < 2
                    ? f.target
                    : index >= 2 && index < 5
                      ? other
                      : null;
            return { name: "vote", args: { target_id: target, abstain: target === null } };
          }
          return baseline.getAction(r);
        },
      },
      30,
    );
    const events = f.phaseManager.getEvents();
    const summaries = events.filter((e) => e.type === "vote_summary");
    expect(summaries).toHaveLength(2);
    expect(summaries[0]!.payload.tally).toEqual({ [f.target]: 3, [other]: 3 });
    expect(summaries[1]!.payload.tally).toEqual(policy === "all_ballots" ? { [f.target]: 1 } : {});
    expect(summaries[1]!.payload.target).toBe(policy === "all_ballots" ? f.target : null);
    expect(events.filter((e) => e.type === "vote_cast")).toHaveLength(22);
    expect(events.filter((e) => e.type === "crow_curse_applied")).toHaveLength(
      policy === "all_ballots" ? 2 : 1,
    );
  });

test("自身历史投影只拣公开字段，扩展getter不执行也不泄漏", () => {
  const f = fixture();
  openCrowNight(f.world, f.actor, 1);
  commitCrowChoice(f.world, f.actor, 1, f.target);
  const entry = crowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history[0]!;
  Object.defineProperty(entry, "receipt", {
    enumerable: true,
    get() {
      throw new Error("secret_receipt_read");
    },
  });
  Object.assign(entry, { hiddenTargetCamp: "wolf" });
  expect(projectCrowState(f.world.getComponent(f.actor, COMPONENT.Role))!.history).toEqual([
    { day: 1, targetId: f.target },
  ]);
});
import { getDefaultPhaseStageLocalizationRegistry } from "../../../../src/agents/presentation/phase-stage-localization-registry";
test("行动阶段名支持两语自然语言", () => {
  expect(getDefaultPhaseStageLocalizationRegistry().stageName("crow_curse", "zh-CN")).toBe(
    "乌鸦诅咒",
  );
  expect(getDefaultPhaseStageLocalizationRegistry().stageName("crow_curse", "en")).toBe(
    "Crow curse",
  );
});

test("必选政策拒有目标时空过，无目标可合法空过；自选政策两分支生效", () => {
  const strict = fixture("initial_ballot_only", { actionPolicy: "required_when_legal" });
  openCrowNight(strict.world, strict.actor, 1);
  expect(crowChoiceAllowed(strict.world, strict.actor, 1, null)).toBe(false);
  expect(() => commitCrowChoice(strict.world, strict.actor, 1, null)).toThrow(
    "crow_choice_invalid",
  );
  expect(crowChoiceAllowed(strict.world, strict.actor, 1, strict.actor)).toBe(false);
  closeCrowNight(strict.world);
  const empty = fixture("initial_ballot_only", { actionPolicy: "required_when_legal" });
  for (const id of empty.world.entityIds())
    if (id !== empty.actor) empty.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  openCrowNight(empty.world, empty.actor, 1);
  expect(crowChoiceAllowed(empty.world, empty.actor, 1, null)).toBe(true);
  commitCrowChoice(empty.world, empty.actor, 1, null);
  const self = fixture("initial_ballot_only", { selfTarget: true });
  openCrowNight(self.world, self.actor, 1);
  expect(crowChoiceAllowed(self.world, self.actor, 1, self.actor)).toBe(true);
  commitCrowChoice(self.world, self.actor, 1, self.actor);
  const tally = {};
  applyCrowBonus(self.world, 1, 1, tally, self.events);
  expect(tally).toEqual({ [self.actor]: 1 });
});
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
test("公开配置严格往返，未知字段与高级角色混板拒绝", () => {
  const config = structuredClone(crowTwelveConfig);
  const raw = boardDefinitionFromConfig("crow_validation", config);
  const normalized = parseBoardDefinition(raw).config;
  expect(
    parseBoardDefinition(boardDefinitionFromConfig("crow_validation", normalized)).config,
  ).toEqual(normalized);
  const bad = structuredClone(raw);
  (bad.roles.crow as Record<string, unknown>).unknownOption = true;
  expect(() => parseBoardDefinition(bad)).toThrow();
  config.roleSetups.find((r) => r.role === Role.Hunter)!.role = Role.Guard;
  expect(() => bootstrapGame(config)).toThrow("crow_preset_invalid");
});

import { buildPlayerStageContextHint } from "../../../../src/agents/observation/player-prompt-directives";
import { getDefaultConfigRenderRegistry } from "../../../../src/agents/prompt/config-render-registry";
test("两语行动提示显示已告知候选，公开配置列明三项政策", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const f = fixture(),
      factory = new GameActionRequestFactory(f.world, [], 1);
    const request = factory.create({
      actorId: f.actor,
      phase: Phase.Night,
      allowedTools: ["curse_exile"],
      stage: "crow_curse",
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
      context: { crow_candidates: [1, 3] },
    });
    const hint = buildPlayerStageContextHint(request, {
      locale: () => locale,
      boardConfig: () => {
        throw new Error("unexpected_world_knowledge");
      },
    });
    expect(hint).toContain("1, 3");
    const config = getDefaultConfigRenderRegistry().renderBoardConfigPrompt(
      crowTwelveConfig,
      locale,
    );
    expect(config).toContain(locale === "en" ? "initial exile ballot" : "仅首轮放逐加一票");
    expect(config).toContain(locale === "en" ? "self-targeting forbidden" : "禁止自选");
  }
});
test("新状态拒绝自定义数组方法且不执行getter", () => {
  const f = fixture();
  const state = crowState(f.world.getComponent(f.actor, COMPONENT.Role))!;
  let reads = 0;
  Object.defineProperty(state.history, "at", {
    get() {
      reads++;
      throw new Error("unexpected_array_method");
    },
  });
  expect(projectCrowState(f.world.getComponent(f.actor, COMPONENT.Role))).toBeUndefined();
  expect(reads).toBe(0);
});

test("未付关闭留下同日墓碑，旧日不得重开；下一日原生命仍可开启", () => {
  const f = fixture();
  openCrowNight(f.world, f.actor, 1);
  closeCrowNight(f.world);
  expect(() => openCrowNight(f.world, f.actor, 1)).toThrow("crow_night_unavailable");
  expect(() => openCrowNight(f.world, f.actor, 2)).not.toThrow();
  closeCrowNight(f.world);
  expect(() => openCrowNight(f.world, f.actor, 1)).toThrow("crow_night_unavailable");
  f.world.addComponent(f.actor, COMPONENT.Alive, createAliveComponent());
  expect(() => openCrowNight(f.world, f.actor, 3)).toThrow("crow_night_unavailable");
});

test("关闭后的下一夜不能换席位安装另一个乌鸦续接原窗口", () => {
  const f = fixture();
  openCrowNight(f.world, f.actor, 1);
  closeCrowNight(f.world);
  const impostor = f.world.getComponent(f.target, COMPONENT.Role)!;
  impostor.role = Role.Crow;
  Object.assign(impostor.privateState, { crow: { ...crowTwelveConfig.crow, history: [] } });
  expect(() => openCrowNight(f.world, f.target, 2)).toThrow("crow_night_unavailable");
});
