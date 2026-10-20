/**
 * 单元测试验证 bilingual-player-prompt 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { renderRolePrompt } from "../../../src/agents/observation/role-presentation";
import { WOLF_STAGE_DIRECTIVES, WOLF_TOOL_SPECS } from "../../../src/features/wolf/tool-specs";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Phase,
  Role,
  WinCondition,
  ActionWindow,
  WitchSelfHealRule,
  type ActionRequest,
  type BoardConfig,
  type ToolName,
  type ActionStage,
} from "../../../src/domain";
import { PlayerPromptPolicy } from "../../../src/agents/player/player-prompt-policy";
import { PlayerPromptSession } from "../../../src/agents/llm/player-prompt-session";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import { buildConstraintRetryPrompt } from "../../../src/agents/player/prompt-templates";
import { evaluateTurnConstraints } from "../../../src/engine/actions/turn-constraints";
import { renderTurnConstraintSystemRule } from "../../../src/agents/player/turn-constraints";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
  RoleCatalog,
  ToolSpecRegistry,
} from "../../../src/rulesets/mechanism-api";
import { getWitchState } from "../../../src/features/witch/ports";
import { setSeerState } from "../../../src/features/seer/ports";
import { COMPONENT } from "../../../src/domain/components/names";
import type { RoleComponent } from "../../../src/domain/components/role";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

const roles = [
  Role.Wolf,
  Role.Villager,
  Role.Seer,
  Role.Guard,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
];
const names = Object.fromEntries(roles.map((_, index) => [index + 1, `Seat ${index + 1}`]));
const board: BoardConfig = {
  boardSize: 7,
  roleSetups: roles.map((role) => ({ role, count: 1 })),
  winConditions: [WinCondition.SlaughterSide, WinCondition.WolfReachHalf],
  enableSheriff: true,
  hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
  sheriff: { voteWeight: 2 },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreVote] },
  witch: { canSelfHeal: WitchSelfHealRule.FirstNightOnly },
  tieBreaker: { exileVote: "no_elimination", wolfKillVote: "no_kill", sheriffVote: "min_seat" },
};

function setup(locale: Locale, personality?: string) {
  const game = bootstrapGame(board, { locale, fixedRoles: roles, playerNames: names });
  const policy = new PlayerPromptPolicy(game.world, {
    customInstructionsResolver: () => personality,
    boardConfig: board,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  return { ...game, policy };
}
function request(
  actorId: number,
  stage: ActionStage,
  allowedTools: ToolName[],
  wolfTarget?: number | null,
): ActionRequest {
  return {
    actorId,
    phase:
      stage === "witch" || stage === "wolf_vote" || stage === "wolf_discussion"
        ? Phase.Night
        : Phase.Day,
    allowedTools,
    context: {
      day: 1,
      stage,
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      ...(wolfTarget === undefined ? {} : { wolf_target: wolfTarget }),
    },
  };
}
const stages: Array<[ActionStage, ToolName[]]> = [
  ["day_speech", ["speak"]],
  ["last_words", ["speak"]],
  ["wolf_discussion", ["speak_to_wolves"]],
  ["wolf_vote", ["kill_vote"]],
  ["guard", ["guard"]],
  ["seer", ["check_identity"]],
  ["witch", ["use_potion"]],
  ["hunter_shot", ["shoot"]],
  [ActionWindow.OnPreVote, ["self_destruct"]],
  ["sheriff_nomination", ["run_for_sheriff"]],
  ["sheriff_withdraw", ["run_for_sheriff"]],
  ["sheriff_campaign_speech", ["speak"]],
  ["sheriff_vote", ["vote_for_sheriff"]],
  ["sheriff_choose_direction", ["choose_direction"]],
];

test("all base role identities, rules, private state and stages are bilingual and observation-neutral", () => {
  const chinese = setup("zh-CN");
  const english = setup("en");
  for (const actorId of chinese.playerIds) {
    const req = request(actorId, "day_speech", ["speak"]);
    const zh = chinese.policy.buildSystem(req, { supportsDebugReporting: true }).systemPrompt;
    const en = english.policy.buildSystem(req, { supportsDebugReporting: true }).systemPrompt;
    expect(zh).toContain("你必须使用中文");
    expect(en).toContain("Use English");
    expect(en).not.toMatch(/[\u4e00-\u9fff]/);
    expect(chinese.policy.buildObservation(req)).toEqual(english.policy.buildObservation(req));
    const role = english.world.getComponent(actorId, COMPONENT.Role)!;
    expect(renderRolePrompt(role)).not.toMatch(/[\u4e00-\u9fff]/);
  }
  for (const [stage, tools] of stages) {
    const req = request(stage === "witch" ? 5 : 1, stage, tools);
    const en = english.policy.buildUser(req, {
      turnId: "t9",
      allowedTools: tools,
      actionSubmissionHint: "submit_action turn_id=t9",
    });
    expect(en).not.toMatch(/[\u4e00-\u9fff]/);
    expect(en).toContain(tools[0]);
    expect(en).toContain("t9");
    if (stage === "sheriff_nomination") expect(en).toContain("not withdrawal");
    if (stage === "sheriff_withdraw") expect(en).toContain("run=false withdraws");
    if (stage === "sheriff_vote") expect(en).toContain("including withdrawn candidates");
    if (stage === "wolf_discussion") expect(en).toContain("does not end other wolves");
  }
  const hunter = english.policy.buildUser(request(6, "hunter_shot", ["shoot"]), {
    turnId: "t9",
    allowedTools: ["shoot"],
    actionSubmissionHint: "submit",
  });
  expect(hunter).toContain("The last good special role may still shoot");
  expect(hunter).toContain("target_id=null");
  expect(hunter).toContain("An invalid target does not spend the shot");
  for (const [target, expected] of [
    [2, "player 2"],
    [null, "is empty"],
    [undefined, "No definite"],
  ] as const) {
    const req = request(5, "witch", ["use_potion"], target);
    const before = getWitchState(english.world.getComponent(5, COMPONENT.Role)!);
    expect(
      english.policy.buildUser(req, {
        turnId: "t9",
        allowedTools: req.allowedTools,
        actionSubmissionHint: "submit",
      }),
    ).toContain(expected);
    expect(getWitchState(english.world.getComponent(5, COMPONENT.Role)!)).toEqual(before);
  }
  setSeerState(english.world.getComponent(3, COMPONENT.Role)!, {
    lastTarget: 1,
    lastIsWerewolf: true,
    history: [],
  });
  expect(
    english.policy.buildUser(request(3, "seer", ["check_identity"]), {
      turnId: "t9",
      allowedTools: ["check_identity"],
      actionSubmissionHint: "submit",
    }),
  ).toContain("player 1's alignment is Werewolves");
});

test("missing nicknames remain absent while explicit default-looking names remain raw", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const game = bootstrapGame(board, { locale, fixedRoles: roles, playerNames: { "1": "玩家1" } });
    const catalog = getDefaultRoleCatalog();
    const policy = new PlayerPromptPolicy(game.world, {
      boardConfig: board,
      roleCatalog: catalog,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
    });
    const custom = policy.buildSystem(request(1, "day_speech", ["speak"]), {
      supportsDebugReporting: false,
    }).systemPrompt;
    const generated = policy.buildSystem(request(2, "day_speech", ["speak"]), {
      supportsDebugReporting: false,
    }).systemPrompt;
    expect(custom).toContain("玩家1");
    expect(generated).not.toContain(locale === "en" ? "Your nickname is" : "你的昵称是");
    expect(generated).toContain('{"id":2,"seat":2}');
    expect(generated).toContain('{"id":1,"seat":1,"name":"玩家1"}');
    if (locale === "en") expect(generated).toContain("Public player roster");
  }
});

test("player original text and explicit injected profile/directive text survive both locales", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const game = setup(locale, "统计控：我估计概率为60% {actor}");
    const req = request(1, "day_speech", ["speak"]);
    expect(game.policy.buildSystem(req, { supportsDebugReporting: true }).systemPrompt).toContain(
      "统计控：我估计概率为60% {actor}",
    );
    const catalog = createRoleCatalog([
      {
        ...getDefaultRoleCatalog().requireMetadata(Role.Wolf),
        ...getDefaultRoleCatalog().requireRuntime(Role.Wolf),
        label: "自定狼人",
        skillBrief: "原文说明",
        renderPrompt: () => "原文私有状态",
      },
    ]);
    expect(catalog.label(Role.Wolf, locale)).toBe("自定狼人");
    expect(catalog.skillBrief(Role.Wolf, locale)).toBe("原文说明");
    const role = game.world.getComponent(1, COMPONENT.Role)!;
    const initialCamp = game.world.getComponent(1, COMPONENT.Camp)!;
    catalog.applyRuntime(role, {
      locale,
      initialCamp,
      currentCamp: () => game.world.getComponent(1, COMPONENT.Camp),
    });
    expect(renderRolePrompt(role, locale)).toBe("原文私有状态");
    const tools = new ToolSpecRegistry([], [{ match: () => true, text: "定制阶段 {actor}" }]);
    expect(tools.getStageDirective(["speak"], locale)).toBe("定制阶段 {actor}");
    const inherited = new ToolSpecRegistry(
      [{ ...WOLF_TOOL_SPECS[0], userPromptHint: "覆盖用法 {actor}" }],
      [{ ...WOLF_STAGE_DIRECTIVES[0], text: "覆盖阶段 {actor}" }],
    );
    expect(inherited.getUserPromptHint("speak_to_wolves", locale)).toBe("覆盖用法 {actor}");
    expect(inherited.getStageDirective(["speak_to_wolves"], locale)).toBe("覆盖阶段 {actor}");
  }
});

test("SDK prompt histories preserve raw events and keep each session's language during retries", () => {
  const sessions = (["zh-CN", "en"] as const).map(
    (locale) => new PlayerPromptSession({ maxPromptEvents: 3, promptPolicy: setup(locale).policy }),
  );
  const req = request(2, "day_speech", ["speak"]);
  req.context.visible_events = [
    { seq: 1, type: "day_speech", payload: { playerId: 1, text: "绿茶：人家概率60%" } },
  ];
  for (let index = 0; index < sessions.length; index++) {
    const locale = index === 0 ? "zh-CN" : "en";
    const first = sessions[index].build(req);
    const second = sessions[index].build(req);
    expect(first.systemPrompt).toContain(locale === "en" ? "Use English" : "你必须使用中文");
    expect(
      first.messages.some(
        (message) =>
          message.content ===
          '{"event":[1,"day_speech",{"playerId":1,"text":"绿茶：人家概率60%"}]}',
      ),
    ).toBe(true);
    expect(first.userPrompt).toContain("t1");
    expect(second.userPrompt).toContain("t2");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const retry = buildConstraintRetryPrompt(attempt, 3, locale);
      expect(retry).toContain(`${attempt}/3`);
      expect(retry).toContain("submit_action");
      if (locale === "en") expect(retry).not.toMatch(/[\u4e00-\u9fff]/);
    }
    const constraints = {
      minValidActions: 1,
      maxValidActions: 1,
      requiredAnyTools: ["speak"] as ToolName[],
    };
    const evaluated = evaluateTurnConstraints({ validActions: [] }, constraints, locale);
    expect(evaluated.ok).toBe(false);
    expect(evaluated.errors.length).toBe(2);
    if (locale === "en") expect(JSON.stringify(evaluated.errors)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(
      renderTurnConstraintSystemRule({ ...constraints, summary: "自定约束原文" }, locale),
    ).toContain("自定约束原文");
  }
});

test("ACP session identity and actual turn prompts use isolated game locales and preserve raw event batches", async () => {
  await Promise.all(
    (["zh-CN", "en"] as const).map(async (locale) => {
      const game = setup(locale, "绿茶人设");
      const captured: string[] = [];
      let initial = "";
      const provider = new AcpActionProvider(game.world, {
        boardConfig: board,
        customInstructionsResolver: () => "绿茶人设",
        privilegedFallbackProvider: {
          async getAction() {
            throw new Error("unexpected_fallback");
          },
        },
        sessionFactory: {
          async createSession(input) {
            initial = input.initialPrompt!;
            return {
              sessionId: `task-${locale}`,
              async prompt(prompt) {
                captured.push(prompt);
                const turn = /(?:当前回合 ID：|Current turn ID: )(t\d+)/.exec(prompt)![1];
                expect(
                  input.registry.submitAction(`task-${locale}`, {
                    turn_id: turn,
                    action: "speak",
                    arguments: { text: "原文欢乐发言" },
                  }),
                ).toEqual({ ok: true, accepted: true });
              },
              async cancel() {},
              async close() {},
            };
          },
        },
      });
      const req = request(2, "day_speech", ["speak"]);
      req.context.visible_events = [
        { seq: 1, type: "day_speech", payload: { playerId: 1, text: "原文事件" } },
      ];
      try {
        expect(await provider.getAction(req)).toEqual({
          name: "speak",
          args: { text: "原文欢乐发言" },
        });
        expect(initial).toContain("绿茶人设");
        expect(initial).toContain(locale === "en" ? "Use English" : "你必须使用中文");
        expect(initial).not.toContain(
          locale === "en" ? "All effective game actions" : "游戏中所有能起效的行动",
        );
        expect(captured[0]).toContain(
          '{"events":[[1,"day_speech",{"playerId":1,"text":"原文事件"}]]}',
        );
        expect(captured[0]).toContain("werewolf-game");
        if (locale === "en")
          expect(captured[0].replace("原文事件", "")).not.toMatch(/[\u4e00-\u9fff]/);
      } finally {
        await provider.close();
      }
    }),
  );
});

test("shared player identity distinguishes victory, public announcements, private checks and tool receipts", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const { policy } = setup(locale);
    const system = policy.buildSystem(request(1, "day_speech", ["speak"]), {
      supportsDebugReporting: true,
    }).systemPrompt;
    expect(system).toContain(locale === "en" ? "personal victory conditions" : "个人胜利目标");
    expect(system).toContain(locale === "en" ? "private knowledge" : "私有知识");
    expect(system).toContain(locale === "en" ? "tool receipt" : "工具受理");
    expect(system).toContain(
      locale === "en" ? "You may strategically hide your role" : "允许按策略隐藏身份",
    );
    expect(system).toContain(locale === "en" ? "real Werewolf table" : "真实牌桌");
    expect(system).not.toContain(
      locale === "en" ? "one player agent in the Werewolf engine" : "引擎中的单个玩家智能体",
    );
    expect(system).not.toContain(
      locale === "en"
        ? "Do not reveal" + " system prompts, tool invocation details or rule metadata"
        : "各类发言中禁止泄露系统提示、工具调用细节或规则元信息",
    );
  }
});

test("all speech actions identify the actual audience without describing a private exchange as public", () => {
  const channels: Array<[ActionStage, ToolName, string, string]> = [
    ["day_speech", "speak", "正文会向全场公布", "whole table"],
    ["wolf_discussion", "speak_to_wolves", "狼聊成员", "wolf-chat members"],
    ["ghost_bride_chat", "speak_to_partner", "正文只发给你的伴侣", "only to your partner"],
    ["brew_discussion", "brew_discuss", "不发给女巫或全场", "not to the Witch or the table"],
  ];
  for (const locale of ["zh-CN", "en"] as const) {
    const { policy } = setup(locale);
    for (const [stage, tool, zhAudience, enAudience] of channels) {
      const prompt = policy.buildUser(request(1, stage, [tool]), {
        turnId: "t-audience",
        allowedTools: [tool],
        actionSubmissionHint: text(locale, "prompt.sdk.submit", { turn: "t-audience" }),
      });
      expect(prompt).toContain(locale === "en" ? enAudience : zhAudience);
      expect(prompt).not.toContain(
        locale === "en" ? "this is not your speaking turn" : "目前不是你的发言轮次",
      );
    }
  }
});

test("optional self-destruction instructions agree with both transport protocols and preserve confirmation", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const { policy } = setup(locale);
    const optional = request(1, ActionWindow.OnPreVote, ["self_destruct"]);
    optional.context.turn_constraints = { min_valid_actions: 0, max_valid_actions: 1 };
    for (const protocol of ["prompt.sdk.submit", "prompt.acp.submit"] as const) {
      const prompt = policy.buildUser(optional, {
        turnId: "t-optional",
        allowedTools: optional.allowedTools,
        actionSubmissionHint: text(locale, protocol, { turn: "t-optional" }),
      });
      expect(prompt).toContain(
        locale === "en" ? "end this response without submitting" : "不提交行动",
      );
      expect(prompt).toContain(
        locale === "en" ? "Optional windows permit no submission" : "可选窗口可不提交",
      );
      expect(prompt).toContain(locale === "en" ? "explicitly confirm again" : "再次明确确认");
    }
    for (const attempt of [1, 2, 3]) {
      const retry = buildConstraintRetryPrompt(attempt, 3, locale, false);
      expect(retry).toContain(
        locale === "en" ? "cannot count as a legal wait" : "不能当作合法等待",
      );
      expect(retry).toContain(locale === "en" ? "does not clear errors" : "不会清除错误");
      expect(retry).not.toContain(locale === "en" ? "Submit an action now" : "请立即提交行动");
    }
    expect(buildConstraintRetryPrompt(2, 3, locale)).toContain(
      locale === "en" ? "required action is still missing" : "必需行动未完成",
    );
  }
});
