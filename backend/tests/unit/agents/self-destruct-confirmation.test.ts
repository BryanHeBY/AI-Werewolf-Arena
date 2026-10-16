/**
 * 单元测试以真实规则接收器和内存选择窗口检查自爆确认协议；预期为手写回执和生命状态。
 * 覆盖首次占位误调用、重复请求、参数／作用域变化、关闭及资格撤销；不调用模型或执行死亡结算。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionTurn, type ActionReceipt } from "../../../src/agents/player/action-turn";
import { ActionReception } from "../../../src/engine/actions/action-reception";
import { ActionWindow, COMPONENT, Phase, Role, type ActionRequest } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const args = { reason: "占位", confirm: true };
function setup(locale: "zh-CN" | "en" = "zh-CN", targeted = false) {
  const roles = [
    targeted ? Role.WhiteWolfKing : Role.Wolf,
    Role.Seer,
    Role.Villager,
    Role.Wolf,
    Role.Guard,
    Role.Villager,
  ];
  const game = bootstrapGame(
    { ...sixPlayerMvpConfig, roleSetups: roles.map((role) => ({ role, count: 1 })) },
    { fixedRoles: roles, locale },
  );
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Voting,
    actionWindow: ActionWindow.OnPreVote,
    allowedTools: [targeted ? "self_destruct_with_target" : "self_destruct"],
    context: {
      day: 1,
      stage: ActionWindow.OnPreVote,
      visible_events: [],
      action_failure_policy: "error",
      turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
    },
  };
  const reception = new ActionReception(game.world);
  return { ...game, request, reception, turn: new ActionTurn(reception, request, "t1") };
}
function pending(receipt: ActionReceipt) {
  expect(receipt).toMatchObject({
    ok: true,
    status: "confirmation_required",
    accepted: false,
    applied: false,
  });
  if (!receipt.ok || receipt.accepted) throw new Error("expected_pending_confirmation");
  expect(receipt.confirmation_id).toMatch(/^[0-9a-f-]{36}$/);
  return receipt;
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: 占位首次提交与重复首次请求都不能选择自爆，第二次带编号才选择一次`, () => {
    const f = setup(locale);
    const proposal = pending(f.turn.submit("t1", "self_destruct", args));
    expect(proposal.arguments).toEqual(args);
    expect(proposal.warning).toContain(locale === "en" ? "not a placeholder" : "不是占位");
    if (locale === "en") expect(proposal.warning).not.toMatch(/\p{Script=Han}/u);
    expect(f.turn.action).toBeNull();
    expect(f.turn.outcome).toEqual({ rejectedActions: 0, failureCode: null });
    const replay = pending(f.turn.submit("t1", "self_destruct", { confirm: true, reason: "占位" }));
    expect(replay.confirmation_id).toBe(proposal.confirmation_id);
    proposal.arguments.reason = "mutated";
    expect(f.turn.submit("t1", "self_destruct", args, proposal.confirmation_id)).toEqual({
      ok: true,
      accepted: true,
      applied: false,
      action: "self_destruct",
      status: "confirmed",
      confirmation_id: proposal.confirmation_id,
    });
    expect(f.turn.action).toEqual({ name: "self_destruct", args });
    expect(f.turn.submit("t1", "self_destruct", args, proposal.confirmation_id)).toMatchObject({
      ok: false,
      error: "turn_not_open_or_session_invalid",
    });
    expect(f.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
    expect(f.phaseManager.getEvents().some((e) => e.type === "wolf_self_destruct")).toBe(false);
  });
}

test("改变理由须重新提案，旧编号不能确认新参数或旧参数", () => {
  const f = setup(),
    first = pending(f.turn.submit("t1", "self_destruct", args));
  const changed = { ...args, reason: "主动中断" };
  const second = pending(f.turn.submit("t1", "self_destruct", changed));
  expect(second.confirmation_id).not.toBe(first.confirmation_id);
  expect(f.turn.submit("t1", "self_destruct", changed, first.confirmation_id)).toMatchObject({
    ok: false,
    error: "action_confirmation_invalid",
  });
  expect(f.turn.action).toBeNull();
  expect(f.turn.submit("t1", "self_destruct", changed, second.confirmation_id)).toMatchObject({
    ok: false,
    error: "action_confirmation_invalid",
  });
});

for (const mutation of ["actor", "day", "phase", "stage", "window"] as const)
  test(`确认编号绑定请求作用域：${mutation}`, () => {
    const f = setup(),
      first = pending(f.turn.submit("t1", "self_destruct", args));
    if (mutation === "actor") f.request.actorId = 4;
    if (mutation === "day") f.request.context.day = 2;
    if (mutation === "phase") f.request.phase = Phase.Day;
    if (mutation === "stage") f.request.context.stage = ActionWindow.OnDaybreak;
    if (mutation === "window") f.request.actionWindow = ActionWindow.OnDaybreak;
    expect(f.turn.submit("t1", "self_destruct", args, first.confirmation_id).ok).toBe(false);
    expect(f.turn.action).toBeNull();
  });

for (const ending of ["close", "deadline", "next_turn", "other_owner", "wrong_turn_id"] as const)
  test(`未确认提案在 ${ending} 时不能提交`, () => {
    const f = setup(),
      first = pending(f.turn.submit("t1", "self_destruct", args));
    let turn = f.turn,
      id = "t1";
    if (ending === "close") turn.close();
    if (ending === "deadline") f.request.deadlineAtMs = Date.now() - 1;
    if (ending === "next_turn") {
      f.turn.close();
      id = "t2";
      turn = new ActionTurn(f.reception, f.request, id);
    }
    if (ending === "other_owner") turn = new ActionTurn(f.reception, f.request, id);
    if (ending === "wrong_turn_id") id = "foreign";
    expect(turn.submit(id, "self_destruct", args, first.confirmation_id).ok).toBe(false);
    expect(turn.action).toBeNull();
  });

test("第二次确认重新预检，死亡后不能使用旧合法提案", () => {
  const f = setup(),
    first = pending(f.turn.submit("t1", "self_destruct", args));
  f.world.getComponent(1, COMPONENT.Alive)!.alive = false;
  expect(f.turn.submit("t1", "self_destruct", args, first.confirmation_id).ok).toBe(false);
  expect(f.turn.action).toBeNull();
});

test("白狼王目标变化重新提案，旧编号不可以带走新目标", () => {
  const f = setup("en", true),
    action = "self_destruct_with_target";
  const firstArgs = { ...args, target_id: 2 },
    secondArgs = { ...args, target_id: 3 };
  const first = pending(f.turn.submit("t1", action, firstArgs));
  expect(f.turn.submit("t1", action, secondArgs, first.confirmation_id)).toMatchObject({
    ok: false,
    error: "action_confirmation_invalid",
  });
  const next = pending(f.turn.submit("t1", action, secondArgs));
  expect(f.turn.submit("t1", action, secondArgs, next.confirmation_id)).toMatchObject({
    ok: true,
    accepted: true,
    status: "confirmed",
  });
  expect(f.turn.action).toEqual({ name: action, args: secondArgs });
  expect(f.world.getComponent(3, COMPONENT.Alive)!.alive).toBe(true);
});

test("白狼王目标死亡会撤销旧提案", () => {
  const f = setup("en", true),
    action = "self_destruct_with_target",
    proposalArgs = { ...args, target_id: 2 };
  const first = pending(f.turn.submit("t1", action, proposalArgs));
  f.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  expect(f.turn.submit("t1", action, proposalArgs, first.confirmation_id).ok).toBe(false);
  f.world.getComponent(2, COMPONENT.Alive)!.alive = true;
  expect(f.turn.submit("t1", action, proposalArgs, first.confirmation_id)).toMatchObject({
    ok: false,
    error: "action_confirmation_invalid",
  });
  expect(f.turn.action).toBeNull();
});

for (const transport of ["llm", "acp", "pi"] as const)
  test(`${transport}: 首次提案后传输失败，恶意自爆回退不能替模型二次确认`, async () => {
    const { LlmActionProvider } = await import("../../../src/agents/llm/llm-action-provider");
    const { AcpActionProvider } = await import("../../../src/agents/acp/acp-action-provider");
    const { PiActionProvider } = await import("../../../src/agents/pi/pi-action-provider");
    const f = setup();
    delete f.request.context.action_failure_policy;
    let fallbackCalls = 0,
      proposals = 0;
    const fallbackStrategy = {
      async decide() {
        fallbackCalls++;
        return { name: "self_destruct" as const, args };
      },
    };
    const proposal = { action: "self_destruct", arguments: args };
    const fail = () => {
      throw new Error("synthetic_failure_after_proposal");
    };
    const provider =
      transport === "llm"
        ? new LlmActionProvider(
            f.world,
            {
              async chat() {
                return "";
              },
              async runToolLoop(_messages, _tools, callbacks) {
                const receipt = await callbacks.onToolCall({
                  id: "first",
                  name: "submit_action",
                  args: { ...proposal, turn_id: "t1" },
                  rawArgs: "",
                });
                pending(receipt.toolResult as ActionReceipt);
                expect(receipt.finalAction).toBeUndefined();
                proposals++;
                return fail();
              },
            },
            { boardConfig: sixPlayerMvpConfig, fallbackStrategy, outputSink() {} },
          )
        : transport === "acp"
          ? new AcpActionProvider(f.world, {
              fallbackStrategy,
              outputSink() {},
              sessionFactory: {
                async createSession(input) {
                  return {
                    sessionId: "fallback-check",
                    async prompt() {
                      pending(
                        input.registry.submitAction("fallback-check", {
                          ...proposal,
                          turn_id: "t1",
                        }) as ActionReceipt,
                      );
                      proposals++;
                      fail();
                    },
                    async cancel() {},
                    async close() {},
                  };
                },
              },
            })
          : new PiActionProvider(f.world, {
              boardConfig: sixPlayerMvpConfig,
              fallbackStrategy,
              outputSink() {},
              settingsResolver: () => ({}),
              runtime: {
                async createSession() {
                  return {
                    async prompt(_text, options) {
                      const receipt = await options.onToolCall({
                        id: "first",
                        name: "submit_action",
                        args: { ...proposal, turn_id: "p1" },
                        rawArgs: "",
                      });
                      pending(receipt.toolResult as ActionReceipt);
                      expect(receipt.stop).not.toBe(true);
                      proposals++;
                      return fail();
                    },
                    takeTrace() {
                      return {
                        finalAction: null,
                        assistantText: "",
                        thinkingText: "",
                        toolCalls: [],
                        events: [],
                      };
                    },
                    async close() {},
                  };
                },
                async close() {},
              },
            });
    try {
      expect(await provider.getAction(f.request)).toBeNull();
      expect(proposals).toBe(1);
      expect(fallbackCalls).toBe(1);
      expect(f.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
    } finally {
      await provider.close();
    }
  });

for (const confirm of [false, true])
  test(`ACP 不发送原生 rawOutput 时，引擎仍私有保存并展示${confirm ? "两份回执" : "首份警示"}`, async () => {
    const { AcpActionProvider } = await import("../../../src/agents/acp/acp-action-provider");
    const { runWithSessionRecorder } = await import("../../../src/recording/session/context");
    const { agentActionConfirmation } = await import("@ai-werewolf-arena/replay-contract");
    const f = setup(),
      records: any[] = [],
      outputs: any[] = [];
    const provider = new AcpActionProvider(f.world, {
      outputSink: (event) => outputs.push(event),
      sessionFactory: {
        async createSession(input) {
          return {
            sessionId: "no-output",
            async prompt() {
              const proposal = { turn_id: "t1", action: "self_destruct", arguments: args };
              const first = pending(
                input.registry.submitAction("no-output", proposal) as ActionReceipt,
              );
              if (confirm)
                input.registry.submitAction("no-output", {
                  ...proposal,
                  confirmation_id: first.confirmation_id,
                });
            },
            async cancel() {},
            async close() {},
          };
        },
      },
    });
    try {
      const recorder = {
        recordPlayerRound: (record: unknown) => records.push(record),
        recordLogicOp() {},
      } as unknown as import("../../../src/recording/session/recorder").SessionRecordManager;
      const selected = await runWithSessionRecorder(recorder, () => provider.getAction(f.request));
      expect(selected).toEqual(confirm ? { name: "self_destruct", args } : null);
      expect(records).toHaveLength(1);
      const statuses = records[0].agentOutputs
        .map(agentActionConfirmation)
        .filter(Boolean)
        .map((x: any) => x.status);
      expect(statuses).toEqual(
        confirm ? ["confirmation_required", "confirmed"] : ["confirmation_required"],
      );
      expect(
        outputs.filter((e) => agentActionConfirmation(e.output)).map((e) => e.visibility),
      ).toEqual(confirm ? ["private", "private"] : ["private"]);
    } finally {
      await provider.close();
    }
  });
