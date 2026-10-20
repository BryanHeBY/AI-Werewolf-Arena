/**
 * 单元测试验证 LLM 截断对话后保留已知公告；输入为内存 World、事件增量和受限窗口。
 * 预期来自手写公告、消息数量和未公开状态反例；不调用模型或读取 God 事件补齐知识。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { PlayerPromptSession } from "../../../src/agents/llm/player-prompt-session";
import { PlayerPromptPolicy } from "../../../src/agents/player/player-prompt-policy";
import {
  appendPublicGameKnowledge,
  type PublicGameKnowledge,
} from "../../../src/agents/observation/public-game-knowledge";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type PlayerVisibleEvent,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/rulesets/mechanism-api";

function request(actorId = 1, events: PlayerVisibleEvent[] = []): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      visible_events: events,
    },
  };
}

function summary(prompt: string): PublicGameKnowledge {
  return JSON.parse(prompt.split("\n")[0]!.match(/\{.*\}/)![0]);
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: a small LLM window retains announced facts without reading unpublished deaths`, () => {
    const game = bootstrapGame(sixPlayerMvpConfig, {
      locale,
      fixedRoles: [Role.Villager, Role.Wolf, Role.Guard, Role.Wolf, Role.Seer, Role.Villager],
    });
    // 真实死亡与角色仍未公布；生成摘要不能从 World 偷看。
    game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
    const session = new PlayerPromptSession({
      maxPromptEvents: 1,
      promptPolicy: new PlayerPromptPolicy(game.world, {
        boardConfig: game.boardConfig,
        roleCatalog: getDefaultRoleCatalog(),
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      }),
    });
    expect(summary(session.build(request()).userPrompt)).toEqual({
      announcedDeadIds: [],
      roleReveals: [],
    });
    const visible: PlayerVisibleEvent[] = [
      { seq: 1, type: "night_resolved", payload: { deaths: [2] } },
      { seq: 2, type: "player_role_revealed", payload: { playerId: 4, role: "wolf" } },
      { seq: 3, type: "sheriff_elected", payload: { winnerId: 3 } },
      { seq: 4, type: "day_speech", payload: { actorId: 6, text: "OLD_SPEECH_MARKER" } },
      { seq: 5, type: "animal_cat_revealed", payload: { actorId: 6 } },
    ];
    session.build(request(1, visible));
    for (let turn = 0; turn < 12; turn++) {
      session.appendAssistant(1, `old-response-${turn}`);
      // 即使上游只给本轮增量，摘要仍由同一玩家已消费的事实累积。
      session.build(request());
    }
    const built = session.build(request());
    expect(built.messages.length).toBeLessThanOrEqual(8);
    expect(built.messages.map((message) => message.content).join("\n")).not.toContain(
      "OLD_SPEECH_MARKER",
    );
    expect(summary(built.userPrompt)).toEqual({
      announcedDeadIds: [2],
      roleReveals: [
        { playerId: 4, role: "wolf", seq: 2 },
        { playerId: 6, role: "white_cat", seq: 5 },
      ],
      lastAnnouncedBadge: 3,
    });
    // 同一宿主会话中的另一玩家没有收到上述公告，不能继承其知识。
    expect(summary(session.build(request(6)).userPrompt)).toEqual({
      announcedDeadIds: [],
      roleReveals: [],
    });
  });
}

test("only public results enter the summary, while skipped shots and private/player claims do not", () => {
  const events: PlayerVisibleEvent[] = [
    { seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } },
    { seq: 2, type: "wolf_kill_vote_cast", payload: { actorId: 2, targetId: 3 } },
    {
      seq: 3,
      type: "seer_checked",
      payload: { actorId: 1, targetId: 3, result: { kind: "role", role: "wolf" } },
    },
    { seq: 4, type: "day_speech", payload: { actorId: 4, text: "我是猎人，3号已经死了" } },
    { seq: 5, type: "death_shot_blocked", payload: { actorId: 5, targetId: 3 } },
    { seq: 6, type: "idiot_revealed", payload: { targetId: 6 } },
    { seq: 7, type: "sheriff_elected", payload: { winnerId: 4 } },
    { seq: 8, type: "sheriff_badge_transferred", payload: { fromId: 4, toId: 1 } },
    { seq: 9, type: "hunter_shot", payload: { hunterId: 5, targetId: 2 } },
    { seq: 10, type: "additional_deaths", payload: { deaths: [4] } },
  ];
  const known = appendPublicGameKnowledge(undefined, events);
  expect(known).toEqual({
    announcedDeadIds: [2, 4],
    roleReveals: [{ playerId: 6, role: "idiot", seq: 6 }],
    lastAnnouncedBadge: 1,
  });
  const destroyed = appendPublicGameKnowledge(known, [
    { seq: 11, type: "sheriff_badge_destroyed", payload: { targetId: 1 } },
  ]);
  expect(destroyed.lastAnnouncedBadge).toBeNull();
  expect(known.lastAnnouncedBadge).toBe(1);
});

test("special public role announcements survive independently of generic role-reveal facts", () => {
  const known = appendPublicGameKnowledge(undefined, [
    { seq: 1, type: "animal_cat_revealed", payload: { actorId: 1 } },
    { seq: 2, type: "animal_puffer_revealed", payload: { actorId: 2 } },
    { seq: 3, type: "debater_revealed", payload: { actorId: 3 } },
    { seq: 4, type: "mechanical_shot", payload: { actorId: 4, targetId: 5 } },
    { seq: 5, type: "player_shot", payload: { actorId: 6, targetId: 5 } },
  ]);
  expect(known.roleReveals).toEqual([
    { playerId: 1, role: "white_cat", seq: 1 },
    { playerId: 2, role: "pufferfish", seq: 2 },
    { playerId: 3, role: "debater", seq: 3 },
    { playerId: 4, role: "mechanical_wolf", seq: 4 },
  ]);
  expect(known.announcedDeadIds).toEqual([5]);
});
