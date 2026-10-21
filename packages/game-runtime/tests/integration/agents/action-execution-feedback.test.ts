/**
 * 集成测试负责验证三种模型传输的真实规则反馈与私有录制。输入为内存传输、标准板和真实夜间流水线，
 * 输出以字面结果、库存、原始错误和归档回读为预期；不调用外部模型，不以待测工具回执构造期望。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  PotionType,
  WinCondition,
  Role,
  type ActionProvider,
  type ActionRequest,
  type GameEvent,
  type ToolCall,
  type BoardConfig,
} from "../../../src/domain";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import { PiActionProvider } from "../../../src/agents/pi/pi-action-provider";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import type { ChatModelClient } from "../../../src/adapters/llm/transport";
import type { PiPromptOptions, PiPromptResult } from "../../../src/adapters/pi/contracts";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { withActionExecutionScope } from "../../../src/engine/actions/action-execution-scope";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";
import { magicianTwelveConfig } from "../../../src/rulesets/presets/magician-twelve";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { getWitchState } from "../../../src/features/witch/ports";
import { buildAgentVisibleEventFeed } from "../../../src/agents/observation/event-feed";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import { ReplaySessionAggregate } from "../../../src/recording/session/aggregate";
import type { SessionRecordManager } from "../../../src/recording/session/recorder";
import {
  agentActionExecution,
  agentOutputFromDeltaMessages,
  readReplayPlayerView,
  type AgentTransport,
} from "@ai-werewolf-arena/replay-contract";

function harness(
  transport: AgentTransport,
  afterResult?: () => void,
  config = twelvePlayerStandardConfig,
  fixedRoles?: Role[],
) {
  const game = bootstrapGame(config, { fixedRoles });
  const events: GameEvent[] = [];
  const results: Array<Record<string, unknown> | string> = [];
  let action: ToolCall = { name: "use_potion", args: { potion_type: PotionType.None } };
  let duplicates = 0,
    fallbackCalls = 0;
  const args = (input: string) => ({
    turn_id: input.match(/\b[tp]\d+\b/)![0],
    action: action.name,
    arguments: action.args,
  });
  const received = (result: Record<string, unknown> | string) => {
    results.push(result);
    afterResult?.();
  };
  const client: ChatModelClient = {
    async chat() {
      return "";
    },
    async runToolLoop(_messages, _tools, callbacks) {
      const input = args(_messages.at(-1)!.content);
      const call = {
        id: "native-submit",
        name: "submit_action",
        args: input,
        rawArgs: JSON.stringify(input),
      };
      const reply = await callbacks.onToolCall(call);
      received(reply.toolResult);
      const duplicate = await callbacks.onToolCall(call);
      if (typeof duplicate.toolResult === "object" && duplicate.toolResult.ok === false)
        duplicates++;
      return { finalAction: reply.finalAction ?? null, assistantText: "", thinkingTrace: [] };
    },
  };
  const options = {
    printThinking: false,
    printLlmIo: false,
    turnTimeoutMs: 2000,
    privilegedFallbackProvider: {
      async getAction() {
        fallbackCalls++;
        return null;
      },
    },
  };
  const provider =
    transport === "llm"
      ? new LlmActionProvider(game.world, client, options)
      : transport === "pi"
        ? new PiActionProvider(game.world, {
            ...options,
            settingsResolver: () => ({}),
            runtime: {
              async createSession() {
                return {
                  async prompt<T>(
                    text: string,
                    options: PiPromptOptions<T>,
                  ): Promise<PiPromptResult<T>> {
                    const input = args(text);
                    const call = {
                      id: "native-submit",
                      name: "submit_action",
                      args: input,
                      rawArgs: JSON.stringify(input),
                    };
                    const reply = await options.onToolCall(call);
                    received(reply.toolResult);
                    const duplicate = await options.onToolCall(call);
                    if (
                      typeof duplicate.toolResult === "object" &&
                      duplicate.toolResult.ok === false
                    )
                      duplicates++;
                    return {
                      finalAction: reply.finalAction ?? null,
                      assistantText: "",
                      thinkingText: "",
                      toolCalls: [],
                      events: [],
                    };
                  },
                  takeTrace<T>(): PiPromptResult<T> {
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
          })
        : new AcpActionProvider(game.world, {
            ...options,
            sessionFactory: {
              async createSession(input) {
                const sessionId = `memory-${input.actorId}`;
                return {
                  sessionId,
                  async prompt(text) {
                    const submission = args(text);
                    received(await input.registry.submitActionWithFeedback(sessionId, submission));
                    const duplicate = await input.registry.submitActionWithFeedback(
                      sessionId,
                      submission,
                    );
                    if (duplicate.ok === false) duplicates++;
                  },
                  async cancel() {},
                  async close() {},
                };
              },
            },
          });
  const aggregate = new ReplaySessionAggregate({
    sessionId: "execution-feedback",
    board: "twelve_player_standard",
    startedAtIso: "2026-10-21T00:00:00.000Z",
  });
  const recorder = {
    recordPlayerRound: aggregate.recordPlayerRound.bind(aggregate),
    recordLogicOp() {},
  } as unknown as SessionRecordManager;
  const actor = (role: Role) =>
    game.world
      .entityIds()
      .find((id) => game.world.getComponent(id, COMPONENT.Role)?.role === role)!;
  return {
    game,
    events,
    provider,
    results,
    aggregate,
    actor,
    get duplicates() {
      return duplicates;
    },
    get fallbackCalls() {
      return fallbackCalls;
    },
    choose(value: ToolCall) {
      action = value;
    },
    record<T>(run: () => Promise<T>) {
      return runWithSessionRecorder(recorder, run);
    },
  };
}

for (const transport of ["llm", "pi", "acp"] as const) {
  test(`${transport}: 缺少本人结果时返回未知，不把其他玩家的报告当成本人行动成功`, async () => {
    const f = harness(transport),
      actorId = f.actor(Role.Seer),
      targetId = f.actor(Role.Wolf);
    f.choose({ name: "check_identity", args: { target_id: targetId } });
    const req: ActionRequest = {
      actorId,
      phase: Phase.Night,
      allowedTools: ["check_identity"],
      context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
    };
    try {
      await f.record(() =>
        withActionExecutionScope(f.provider, f.events, async (provider) => {
          await provider.getAction(req);
          f.events.push({
            timestamp: 1,
            type: "seer_checked",
            payload: {
              actorId: targetId,
              targetId: actorId,
              isWerewolf: false,
              result: { kind: "camp", camp: "good" },
            },
          });
        }),
      );
      expect(f.results).toEqual([
        {
          ok: true,
          accepted: true,
          applied: null,
          action: "check_identity",
          status: "unavailable",
          feedback: { version: 1, events: [] },
        },
      ]);
    } finally {
      await f.provider.close();
    }
  });
  test(`${transport}: 开局选牌等待真实身份安装后返回本人身份`, async () => {
    const roles = [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      winConditions: [WinCondition.SlaughterCity],
      thief: { policy: "lui_meme_thief_two_extra_villagers_v1" },
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((item) => item === role).length,
      })),
    };
    // 前六张为入座角色，最后两张为盗贼候选；总牌组等于配置再加两张平民。
    const f = harness(transport, undefined, config, [
      Role.Thief,
      Role.Wolf,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Villager,
      Role.Wolf,
      Role.Villager,
    ]);
    f.choose({ name: "choose_thief_card", args: { slot: 0 } });
    try {
      await f.record(() =>
        f.game.phaseManager.runSingleCycle({
          async getAction(request) {
            if (request.allowedTools.includes("choose_thief_card"))
              return f.provider.getAction(request);
            if (request.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "空刀", end_chat: true } };
            if (request.allowedTools.includes("kill_vote"))
              return { name: "kill_vote", args: { target_id: null, abstain: true } };
            if (request.allowedTools.includes("check_identity"))
              return { name: "check_identity", args: { target_id: 2 } };
            if (request.allowedTools.includes("use_potion"))
              return { name: "use_potion", args: { potion_type: PotionType.None } };
            if (request.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "先听大家。" } };
            if (request.allowedTools.includes("vote"))
              return { name: "vote", args: { target_id: null, abstain: true } };
            return null;
          },
        }),
      );
      expect(f.results).toMatchObject([
        {
          action: "choose_thief_card",
          status: "resolved",
          feedback: {
            events: [
              {
                type: "thief_identity_chosen",
                payload: { actorId: 1, role: "wolf", camp: "wolf", slot: 0 },
              },
            ],
          },
        },
      ]);
      expect(f.game.world.getComponent(1, COMPONENT.Role)?.role).toBe(Role.Wolf);
      expect(f.fallbackCalls).toBe(0);
    } finally {
      await f.provider.close();
    }
  });
  test(`${transport}: 换位查验只返回请求号码的规则报告，不泄漏隐藏换位表`, async () => {
    const f = harness(transport, undefined, magicianTwelveConfig);
    const requested = f.actor(Role.Villager),
      effective = f.actor(Role.Wolf);
    f.choose({ name: "check_identity", args: { target_id: requested } });
    try {
      await f.record(() =>
        new NightPipeline({
          world: f.game.world,
          events: f.events,
          toolGateway: new ToolGateway(),
          damageResolutionSystem: new DamageResolutionSystem(),
        }).execute(
          magicianTwelveConfig,
          {
            async getAction(request) {
              if (request.allowedTools.includes("check_identity"))
                return f.provider.getAction(request);
              if (request.allowedTools.includes("swap_targets"))
                return {
                  name: "swap_targets",
                  args: { first_id: requested, second_id: effective, abstain: false },
                };
              if (request.allowedTools.includes("speak_to_wolves"))
                return { name: "speak_to_wolves", args: { text: "空刀", end_chat: true } };
              if (request.allowedTools.includes("kill_vote"))
                return { name: "kill_vote", args: { abstain: true, target_id: null } };
              if (request.allowedTools.includes("use_potion"))
                return { name: "use_potion", args: { potion_type: PotionType.None } };
              return null;
            },
          },
          1,
        ),
      );
      expect(f.results).toMatchObject([
        {
          action: "check_identity",
          status: "resolved",
          feedback: {
            events: [
              {
                type: "seer_checked",
                payload: {
                  targetId: requested,
                  isWerewolf: true,
                  result: { kind: "camp", camp: "wolf" },
                },
              },
            ],
          },
        },
      ]);
      expect(JSON.stringify(f.results)).not.toMatch(
        /magician_exchange|effectiveTarget|actualTarget|"seq"|"timestamp"|"audience"/,
      );
    } finally {
      await f.provider.close();
    }
  });
  test(`${transport}: 学习和具体角色查验返回本人新获知的结果，不伪装成技能已激活`, async () => {
    const config: BoardConfig = {
      ...twelvePlayerStandardConfig,
      roleSetups: [
        { role: Role.Wolf, count: 3 },
        { role: Role.MechanicalWolf, count: 1 },
        { role: Role.Villager, count: 4 },
        { role: Role.Psychic, count: 1 },
        { role: Role.Witch, count: 1 },
        { role: Role.Hunter, count: 1 },
        { role: Role.Guard, count: 1 },
      ],
    };
    const f = harness(transport, undefined, config),
      target = f.actor(Role.Witch);
    try {
      await f.record(() =>
        new NightPipeline({
          world: f.game.world,
          events: f.events,
          toolGateway: new ToolGateway(),
          damageResolutionSystem: new DamageResolutionSystem(),
        }).execute(
          config,
          {
            async getAction(request) {
              if (request.allowedTools.includes("mimic_role"))
                f.choose({ name: "mimic_role", args: { target_id: target } });
              else if (request.allowedTools.includes("inspect_role"))
                f.choose({ name: "inspect_role", args: { target_id: target } });
              else if (request.allowedTools.includes("mechanical_mode"))
                return { name: "mechanical_mode", args: { mode: "skill" } };
              else if (request.allowedTools.includes("speak_to_wolves"))
                return { name: "speak_to_wolves", args: { text: "空刀", end_chat: true } };
              else if (request.allowedTools.includes("kill_vote"))
                return { name: "kill_vote", args: { abstain: true, target_id: null } };
              else if (request.allowedTools.includes("use_potion"))
                return { name: "use_potion", args: { potion_type: PotionType.None } };
              else if (request.allowedTools.includes("guard"))
                return { name: "guard", args: { target_id: null, abstain: true } };
              else return null;
              return f.provider.getAction(request);
            },
          },
          1,
        ),
      );
      expect(f.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "mimic_role",
            status: "resolved",
            feedback: {
              version: 1,
              events: [
                expect.objectContaining({
                  type: "mechanical_mimicked",
                  payload: expect.objectContaining({
                    targetId: target,
                    role: "witch",
                    readyOnNight: 2,
                  }),
                }),
              ],
            },
          }),
          expect.objectContaining({
            action: "inspect_role",
            status: "resolved",
            feedback: {
              version: 1,
              events: [
                expect.objectContaining({
                  type: "role_inspected",
                  payload: expect.objectContaining({
                    targetId: target,
                    result: { kind: "role", role: "witch" },
                  }),
                }),
              ],
            },
          }),
        ]),
      );
      expect(f.fallbackCalls).toBe(0);
    } finally {
      await f.provider.close();
    }
  });
  test(`${transport}: 真实查验／用药回执在提交后返回，私有档案回读保留结果`, async () => {
    const f = harness(transport);
    const seer = f.actor(Role.Seer),
      witch = f.actor(Role.Witch),
      wolf = f.actor(Role.Wolf),
      victim = f.actor(Role.Villager);
    const routed: ActionProvider = {
      async getAction(request) {
        if (request.allowedTools.includes("check_identity")) {
          f.choose({ name: "check_identity", args: { target_id: wolf } });
          return f.provider.getAction(request);
        }
        if (request.allowedTools.includes("use_potion")) {
          f.choose({
            name: "use_potion",
            args: { target_id: victim, potion_type: PotionType.Poison },
          });
          return f.provider.getAction(request);
        }
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "同意空刀。", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { abstain: true, target_id: null } };
        return null;
      },
    };
    try {
      await f.record(() =>
        new NightPipeline({
          world: f.game.world,
          events: f.events,
          toolGateway: new ToolGateway(),
          damageResolutionSystem: new DamageResolutionSystem(),
        }).execute(twelvePlayerStandardConfig, routed, 1),
      );
      const check = f.results.find(
        (result) => typeof result === "object" && result.action === "check_identity",
      );
      expect(check).toMatchObject({
        ok: true,
        accepted: true,
        applied: true,
        status: "resolved",
        feedback: {
          version: 1,
          events: [
            {
              type: "seer_checked",
              payload: {
                actorId: seer,
                targetId: wolf,
                isWerewolf: true,
                result: { kind: "camp", camp: "wolf" },
              },
            },
          ],
        },
      });
      expect(
        f.results.find((result) => typeof result === "object" && result.action === "use_potion"),
      ).toMatchObject({
        applied: true,
        status: "committed",
        feedback: {
          events: [
            {
              type: "witch_potion_used",
              payload: { actorId: witch, targetId: victim, potionType: "poison" },
            },
          ],
        },
      });
      expect(getWitchState(f.game.world.getComponent(witch, COMPONENT.Role)!)?.poison).toBe(0);
      expect(f.duplicates).toBe(2);
      expect(f.fallbackCalls).toBe(0);
      const raw = JSON.parse(JSON.stringify(f.aggregate.normalizedPlayerView(seer)));
      const view = readReplayPlayerView(raw);
      const outputs = view.timeline.flatMap((entry) =>
        entry.kind === "turn" ? agentOutputFromDeltaMessages(entry.delta_messages) : [],
      );
      expect(outputs.map(agentActionExecution).filter(Boolean)).toHaveLength(1);
      expect(
        JSON.stringify(buildAgentVisibleEventFeed(f.game.world, f.events, victim)),
      ).not.toContain("seer_checked");
    } finally {
      await f.provider.close();
    }
  });

  test(`${transport}: 中断反馈不声称回滚，已交出候选不触发回退`, async () => {
    const f = harness(transport);
    const actorId = f.actor(Role.Seer),
      target = f.actor(Role.Wolf);
    f.choose({ name: "check_identity", args: { target_id: target } });
    const req: ActionRequest = {
      actorId,
      phase: Phase.Night,
      allowedTools: ["check_identity"],
      context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
    };
    const error = new Error("failed_after_partial_resource_commit");
    let paid = 0;
    try {
      await expect(
        f.record(() =>
          withActionExecutionScope(f.provider, f.events, async (provider) => {
            expect(await provider.getAction(req)).toEqual({
              name: "check_identity",
              args: { target_id: target },
            });
            expect(f.results).toHaveLength(0);
            paid++;
            throw error;
          }),
        ),
      ).rejects.toBe(error);
      expect(f.results).toEqual([
        {
          ok: true,
          accepted: true,
          applied: null,
          action: "check_identity",
          status: "interrupted",
          feedback: { version: 1, events: [] },
        },
      ]);
      expect(paid).toBe(1);
      expect(f.fallbackCalls).toBe(0);
    } finally {
      await f.provider.close();
    }
  });

  test(`${transport}: 提交后传输失败保留录制，不重试或二次消耗`, async () => {
    const error = new Error("transport_failed_after_execution");
    const f = harness(transport, () => {
      throw error;
    });
    const actorId = f.actor(Role.Seer),
      targetId = f.actor(Role.Wolf);
    f.choose({ name: "check_identity", args: { target_id: targetId } });
    const req: ActionRequest = {
      actorId,
      phase: Phase.Night,
      allowedTools: ["check_identity"],
      context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
    };
    try {
      await expect(
        f.record(() =>
          withActionExecutionScope(f.provider, f.events, async (provider) => {
            await provider.getAction(req);
            f.events.push({
              timestamp: 1,
              type: "seer_checked",
              payload: {
                actorId,
                targetId,
                isWerewolf: true,
                result: { kind: "camp", camp: "wolf" },
              },
            });
          }),
        ),
      ).rejects.toBe(error);
      expect(f.fallbackCalls).toBe(0);
      expect(JSON.stringify(f.aggregate.normalizedPlayerView(actorId))).toContain(
        '"status":"resolved"',
      );
    } finally {
      await f.provider.close().catch(() => {});
    }
  });
}
