/**
 * 集成测试：验证夜间能力共享契约的 JSON checkpoint 接线。输入为原能力、快照及序列化数据；既有字面预期和不可变 fixture 检查完整边界，不重写归档或调用模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { getSeerState } from "../../../src/game/mechanisms/roles/seer/ports";

const fixedRoles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const fixture = (locale: "zh-CN" | "en" = "en") =>
  bootstrapGame(sixPlayerMvpConfig, { fixedRoles, locale });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

test("explicit undefined optional fields normalize into a serializable CP/Tape without weakening strict JSON parsing", async () => {
  const { SessionRecordManager } = await import("../../../src/recording/session_recorder");
  const { beginGameReproduction, currentEngineVersion } =
    await import("../../../src/runtime/simulation/reproduction_context");
  const { parseReproductionRecord } = await import("../../../src/recording/reproduction");
  const { createTestTempDirectory } = await import("../../support/drivers/temp-directories");
  const { setSeerState } = await import("../../../src/game/mechanisms/roles/seer/ports");
  const context = fixture(),
    events: GameEvent[] = [];
  setSeerState(role(context.world, 3), {
    lastTarget: 1,
    lastIsWerewolf: true,
    lastResult: undefined,
    history: [{ targetId: 1, isWerewolf: true, result: undefined }],
  });
  const ability = grantNightAbility(
    context.world,
    5,
    {
      id: "gift:json",
      kind: "seer_check",
      state: { lastTarget: null, lastIsWerewolf: null, lastResult: undefined, history: [] },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      expiresAfterDay: undefined,
      maxUses: 1,
    },
    events,
  );
  expect(Object.hasOwn(ability, "expiresAfterDay")).toBe(false);
  expect(Object.hasOwn(ability.state, "lastResult")).toBe(false);
  expect(Object.hasOwn(getSeerState(role(context.world, 3))!.history[0], "result")).toBe(false);
  const manager = await SessionRecordManager.create(
    {
      sessionId: "ability-json",
      board: "six_player_mvp",
      locale: "en",
      startedAtIso: new Date().toISOString(),
    },
    await createTestTempDirectory("awa-ability-json-"),
  );
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    ...(void sixPlayerMvpConfig, {}),
    locale: "en",
    maxDays: 6,
  });
  const tape = trace.build();
  expect<unknown>(parseReproductionRecord(tape).checkpoints[0].players[4].privateState).toEqual(
    role(context.world, 5).privateState,
  );
});
