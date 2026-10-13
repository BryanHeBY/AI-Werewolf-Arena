/**
 * Unit tests for llm-action-provider-prompts; In-memory llm-action-provider-prompts decision/turn/client control with supplied mocks or DTOs; no physical transport.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../src/core";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { ActionWindow, Phase } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { getSeerState, getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  AssertClient,
  ToolLoopClient,
  InvalidPotionThenNoneToolLoopClient,
  FallbackProvider,
} from "../../support/drivers/agents/llm-clients";

describe("LlmActionProvider prompts", () => {
  test("prompt no longer contains private-intel snapshot line", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = context.world.entityIds().find((id) => {
      const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.role === "seer";
    })!;
    const seerRole = context.world.getComponent<RoleComponent>(seerId, COMPONENT.Role)!;
    const seerState = getSeerState(
      seerRole,
    )! as import("../../../src/game/mechanisms/roles/seer/state-contracts").SeerState;
    seerState.lastTarget = 1;
    seerState.lastIsWerewolf = true;
    seerState.history.push({ targetId: 1, isWerewolf: true });

    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到查验"}}', (messages) => {
        const joined = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        expect(joined).not.toContain("私有查验情报=");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: seerId,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到查验" },
    });
  });

  test("injects structured visible events as compact JSON user messages", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到公开信息"}}', (messages) => {
        const joined = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        expect(joined).toContain(
          '{"event":[1,"day_speech",{"actorId":1,"text":"我是1号，我是狼人"}]}',
        );
        expect(joined).not.toContain("公开信息摘要=");
        expect(joined).not.toContain("阶段上下文=");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 2,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [
          { seq: 1, type: "day_speech", payload: { actorId: 1, text: "我是1号，我是狼人" } },
        ],
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到公开信息" },
    });
  });

  test("user prompt should use compact three-line natural language format", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"收到板子信息"}}', (messages) => {
        const systemMessages = messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n");
        expect(systemMessages).toContain("当前板子信息");
        expect(systemMessages).toContain("总玩家数=6");
        expect(systemMessages).toContain("角色构成=");
        expect(systemMessages).toContain("角色技能简介=");
        expect(systemMessages).toContain("当你看到“[行动提示]”时，说明你可以开始行动了");
        expect(systemMessages).toContain("结构化事件是引擎确认的事实");
        expect(systemMessages).toContain("只有收到 night_resolved 才能确认昨夜公开结果");
        expect(systemMessages).toContain("空数组仅表示该初始批次平安");
        expect(systemMessages).toContain("additional_deaths 和成功的公开枪击可确认后续追加死亡");
        expect(systemMessages).toContain("death_shot_blocked 表示落空，不能当作击杀");
        expect(systemMessages).toContain("狼人刀人投票只表示刀口选择");

        const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
        const latest = userMessages[userMessages.length - 1] ?? "";
        const lines = latest.split("\n");
        expect(lines.length).toBe(4);
        expect(lines[0]).toContain("[行动提示]");
        expect(lines[0]).toContain("目前是你的发言轮次");
        expect(lines[1]).toContain("阶段规则：");
        expect(lines[2]).toContain("本轮结束前需满足");
        expect(lines[3]).toContain("行动参数提示：");
        expect(lines[3]).toContain("submit_action");
        expect(latest).not.toContain("玩家编号=");
        expect(latest).not.toContain("当前板子信息");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        visible_events: [],
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "收到板子信息" },
    });
  });

  test("target_id tools should include actionable ids hint with role-specific self override", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const wolfId = context.world.entityIds().find((id) => {
      const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.role === "wolf";
    })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"kill_vote","args":{"target_id":null,"abstain":true}}',
        (messages) => {
          const user = messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n");
          expect(user).toContain("可行动ID（含你自己）：");
          expect(user).toContain(String(wolfId));
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: wolfId,
      allowedTools: ["kill_vote"],
      context: {
        day: 1,
        visible_events: [],
        stage: "wolf_vote",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "kill_vote",
      args: { target_id: null, abstain: true },
    });
  });

  test("appends structured events once using seq cursors", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const toolClient = new ToolLoopClient("speak", { text: "收到广播" });
    const provider = new LlmActionProvider(context.world, toolClient as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [{ seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } }],
      },
    });

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [
          { seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } },
          { seq: 2, type: "day_speech", payload: { actorId: 2, text: "我是2号" } },
        ],
      },
    });

    const joined = toolClient.lastMessages.map((msg) => `${msg.role}:${msg.content}`).join("\n");
    expect(joined).toContain('{"event":[1,"phase_changed"');
    expect(joined).toContain('{"event":[2,"day_speech"');
  });

  test("system prompt should explicitly distinguish wolf discussion and wolf vote stages", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"speak_to_wolves","args":{"text":"收到","end_chat":false}}',
        (messages) => {
          const system = messages.find((msg) => msg.role === "system")?.content ?? "";
          const user = messages.find((msg) => msg.role === "user")?.content ?? "";
          expect(system).toContain("狼人交流阶段");
          expect(system).toContain("不会在本阶段完成刀人");
          expect(system).toContain("end_chat=true");
          expect(user).toContain('speak_to_wolves args: {"text":"...","end_chat":true|false}');
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    await provider.getAction({
      phase: Phase.Night,
      actorId: 1,
      allowedTools: ["speak_to_wolves"],
      context: {
        day: 1,
        stage: "wolf_discussion",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });
  });

  test("parses wolf kill abstain vote", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const wolfId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "wolf",
      )!;
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("kill_vote", { target_id: null, abstain: true }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: wolfId,
      allowedTools: ["kill_vote"],
      context: {
        day: 1,
        stage: "wolf_vote",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "kill_vote",
      args: { target_id: null, abstain: true },
    });
  });

  test("witch prompt should include wolf target hint before potion action", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world.entityIds().find((id) => {
      const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.role === "witch";
    })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        `{"name":"use_potion","args":{"target_id":${witchId},"potion_type":"none"}}`,
        (messages) => {
          const user = messages.find((msg) => msg.role === "user")?.content ?? "";
          expect(user).toContain("当前已知本夜刀口是3号");
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: {
        day: 1,
        stage: "witch",
        wolf_target: 3,
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: PotionType.None },
    });
  });

  test("witch prompt should expose remaining potions and reject unavailable heal in tool loop", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "witch",
      )!;
    const witch = context.world.getComponent<RoleComponent>(witchId, COMPONENT.Role)!;
    (getWitchState(witch)! as { heal: number }).heal = 0;
    const targetId = context.world.entityIds().find((id) => id !== witchId)!;
    const client = new InvalidPotionThenNoneToolLoopClient(targetId);
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: witchId,
      allowedTools: ["use_potion"],
      context: {
        day: 1,
        visible_events: [],
        stage: "witch",
        wolf_target: targetId,
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "use_potion",
      args: { target_id: targetId, potion_type: PotionType.None },
    });
    expect(client.invalidPotionResult).toEqual({
      ok: false,
      error: "heal_unavailable",
      message: "非法操作，解药不可用",
    });
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("你的私有状态：你的底牌是【女巫】。解药:0 毒药:1");
  });

  test("on_pre_vote self_destruct window should include strict tool boundary hint", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const wolfId = context.world.entityIds().find((id) => {
      const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.role === "wolf";
    })!;
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient(
        '{"name":"self_destruct","args":{"reason":"test","confirm":true}}',
        (messages) => {
          const user = messages.find((msg) => msg.role === "user")?.content ?? "";
          expect(user).toContain("只有 self_destruct 会改变对局");
        },
      ),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Voting,
      actionWindow: ActionWindow.OnPreVote,
      actorId: wolfId,
      allowedTools: ["self_destruct"],
      context: { day: 1, visible_events: [], turn_constraints: {}, stage: ActionWindow.OnPreVote },
    });

    expect(action).toEqual({
      name: "self_destruct",
      args: { reason: "test", confirm: true },
    });
  });

  test("initial system prompt should include rendered board config summary", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"speak","args":{"text":"ok"}}', (messages) => {
        const system = messages.find((msg) => msg.role === "system")?.content ?? "";
        expect(system).toContain("本局规则配置");
        expect(system).toContain("胜利条件");
        expect(system).toContain("警长机制");
        expect(system).toContain("首日特殊时序");
      }),
      {
        fallbackProvider: new FallbackProvider(null),
        boardConfig: twelvePlayerStandardConfig,
      },
    );

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [],
      },
    });
  });

  test("injects the player personality in the shared system prompt", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new ToolLoopClient("speak", { text: "简洁发言" });
    const provider = new LlmActionProvider(context.world, client, {
      personalityPromptResolver: () => "先总结事实，再提出问题。",
    });
    await provider.getAction({
      actorId: 1,
      phase: Phase.Day,
      allowedTools: ["speak"],
      context: { turn_constraints: {}, day: 1, stage: "day_speech", visible_events: [] },
    });
    const system = client.lastMessages.find((message) => message.role === "system")?.content;
    expect(system).toContain("你的性格与发言风格要求：先总结事实，再提出问题。");
    expect(system).toContain("你的唯一目标是帮助你所在阵营赢得本局");
  });

  test("first-day sheriff prompts distinguish pending night results and run semantics", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const observedPrompts: string[] = [];
    const provider = new LlmActionProvider(
      context.world,
      new AssertClient('{"name":"run_for_sheriff","args":{"run":true}}', (messages) => {
        observedPrompts.push(
          messages.filter((message) => message.role === "user").at(-1)?.content ?? "",
        );
      }),
      {
        fallbackProvider: new FallbackProvider(null),
        boardConfig: twelvePlayerStandardConfig,
      },
    );

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["run_for_sheriff"],
      context: { turn_constraints: {}, day: 1, stage: "sheriff_nomination", visible_events: [] },
    });
    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["run_for_sheriff"],
      context: { turn_constraints: {}, day: 1, stage: "sheriff_withdraw", visible_events: [] },
    });

    expect(observedPrompts[0]).toContain("这是上警报名阶段，不是退水阶段");
    expect(observedPrompts[0]).toContain("run=false 表示不上警");
    expect(observedPrompts[0]).toContain("尚未通过 night_resolved 公布死亡或平安夜");
    expect(observedPrompts[1]).toContain("这是警上发言结束后的退水阶段");
    expect(observedPrompts[1]).toContain("run=false 表示退水");
  });

  test("system prompt should require tools for every effective game action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new ToolLoopClient("speak", { text: "通过工具发言" });
    const provider = new LlmActionProvider(context.world, client as any);

    await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        visible_events: [],
      },
    });

    const system = client.lastMessages.find((message) => message.role === "system")?.content ?? "";
    expect(system).toContain("所有能起效的行动都必须调用 submit_action 提交");
    expect(system).toContain("普通 assistant 文本只会被当作本地思考");
    expect(system).toContain("内容写入 arguments.text");
    expect(system).toContain("可以先调用 report_bug 上报，再继续本轮正常行动");
    const user = client.lastMessages.find((message) => message.role === "user")?.content ?? "";
    expect(user).toContain("正常策略分歧、身份声称、诈身份或信息不足不是 bug");
  });
});
