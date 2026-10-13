/**
 * 单元测试：验证守墓人私密反馈字段及前次放逐的直接交付，不泄漏待结算或精确角色。输入为语言矩阵、字面畸形反馈与直接阶段上下文；原 null／接受、零 accessor 读及资格／历史为预期，不运行完整夜或 PhaseManager 周期。
 */
import { renderRolePrompt } from "../../../../src/game/observation/role-presentation";
import { nightStageContext } from "../../../engine/night_stage_fixture";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Camp,
  Role,
  Phase,
  COMPONENT,
  WinCondition,
  type RoleComponent,
  type GameEvent,
  type BoardConfig,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { GRAVEKEEPER_FEEDBACK_STAGE } from "../../../../src/game/mechanisms/roles/gravekeeper/feedback";
import {
  getGravekeeperState,
  setGravekeeperState,
} from "../../../../src/game/mechanisms/roles/gravekeeper/state";
import { readGravekeeperReport, readGravekeeperFeedback } from "@ai-werewolf-arena/replay-contract";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { getDefaultScriptEventRenderRegistry } from "../../../../src/game/mechanisms/script/event_render_registry";

const deck = [Role.Wolf, Role.Wolf, Role.Gravekeeper, Role.Seer, Role.Villager, Role.Villager];

const board: BoardConfig = {
  ...sixPlayerMvpConfig,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [
    { role: Role.Wolf, count: 2 },
    { role: Role.Gravekeeper, count: 1 },
    { role: Role.Seer, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
};

const role = (world: ReturnType<typeof bootstrapGame>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

const state = (world: ReturnType<typeof bootstrapGame>["world"], id = 3) =>
  getGravekeeperState(role(world, id))!;

function policy(world: ReturnType<typeof bootstrapGame>["world"], config: BoardConfig = board) {
  return new PlayerPromptPolicy(world, {
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    boardConfig: config,
  });
}

const request = (
  actorId: number,
  day: number,
  events: ActionRequest["context"]["visible_events"],
): ActionRequest => ({
  actorId,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: { day, stage: "day_speech", visible_events: events, turn_constraints: {} },
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: strict feedback readers and private rendering reject role/combined labels, bad IDs/dates, extra fields and accessors without exposing an exact role`, () => {
    const { world } = bootstrapGame(board, { fixedRoles: deck, locale });
    let reads = 0;
    const good: NonNullable<ReturnType<typeof readGravekeeperReport>> = {
        exileDay: 1,
        receivedDay: 2,
        targetId: 1,
        result: { kind: "camp", camp: "wolf" },
      },
      accessor = { ...good };
    Object.defineProperty(accessor, "result", {
      enumerable: true,
      get() {
        reads++;
        return { kind: "role", role: "wolf_king" };
      },
    });
    const bad = [
      { ...good, result: { kind: "role", role: "wolf_king" } },
      { ...good, result: { kind: "combined", camp: "wolf", role: "wolf_king" } },
      { ...good, result: { kind: "camp", camp: "unknown" } },
      { ...good, targetId: 0 },
      { ...good, targetId: 1.5 },
      { ...good, exileDay: 0 },
      { ...good, receivedDay: 3 },
      { ...good, receivedDay: Infinity },
      { ...good, role: "wolf_king" },
      accessor,
    ];
    for (const item of bad) {
      expect(readGravekeeperReport(item)).toBeNull();
      setGravekeeperState(role(world, 3), { history: [item as never] });
      const prompt = renderRolePrompt(role(world, 3), locale);
      expect(prompt).toContain(locale === "en" ? "Unknown" : "未知");
      expect(prompt).not.toContain("Wolf King");
      expect(policy(world).buildObservation(request(3, 2, [])).ownState.gravekeeper).toEqual({
        history: [],
      });
    }
    expect(reads).toBe(0);
    const parsed = readGravekeeperReport(good)!;
    parsed.result.camp = "good";
    expect(good.result.camp).toBe(Camp.Wolf);
    expect(readGravekeeperFeedback({ ...good, actorId: 3 })).toEqual({ ...good, actorId: 3 });
    expect(readGravekeeperFeedback({ ...good, actorId: -1 })).toBeNull();
    const event = {
      timestamp: 1,
      type: "gravekeeper_reported",
      payload: { ...good, actorId: 3, result: { kind: "role", role: "wolf_king" } },
    } as unknown as GameEvent;
    expect(getDefaultScriptEventRenderRegistry().toJudgeLine(event, locale)).toBe(
      locale === "en" ? "Unknown" : "未知",
    );
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: multiple native keepers only learn the immediately preceding exile once per night, and dead/transformed keepers receive nothing`, async () => {
    const config = {
        ...board,
        roleSetups: [
          { role: Role.Wolf, count: 2 },
          { role: Role.Gravekeeper, count: 2 },
          { role: Role.Villager, count: 2 },
        ],
      },
      game = bootstrapGame(config, {
        fixedRoles: [
          Role.Wolf,
          Role.Wolf,
          Role.Gravekeeper,
          Role.Gravekeeper,
          Role.Villager,
          Role.Villager,
        ],
        locale,
      }),
      events: GameEvent[] = [];
    let fact = {
      exileDay: 1,
      targetId: 1,
      result: { kind: "camp" as const, camp: Camp.ThirdParty },
    };
    let day = 1;
    const ctx = nightStageContext({
      world: game.world,
      events,
      isCurrent: () => true,
      currentDay: () => day,
      get previousExile() {
        return fact;
      },
      getAliveByRole: (wanted: Role) =>
        game.world.getAliveEntityIds().filter((id) => role(game.world, id).role === wanted),
    });
    await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);
    expect(events).toEqual([]);
    day = 2;
    await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);
    await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);
    expect(
      events
        .filter((event) => event.type === "gravekeeper_reported")
        .map((event) => event.payload.actorId),
    ).toEqual([3, 4]);
    expect(state(game.world, 3).history).toHaveLength(1);
    expect(state(game.world, 4).history).toHaveLength(1);
    expect(state(game.world, 3).history[0]).not.toBe(state(game.world, 4).history[0]);
    day = 3;
    await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);
    expect(events).toHaveLength(2);
    fact = { ...fact, exileDay: 2 };
    game.world.getComponent(3, COMPONENT.Alive)!.alive = false;
    role(game.world, 4).role = Role.Villager;
    await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);
    expect(events).toHaveLength(2);
    expect(state(game.world, 3).history).toHaveLength(1);
  });
