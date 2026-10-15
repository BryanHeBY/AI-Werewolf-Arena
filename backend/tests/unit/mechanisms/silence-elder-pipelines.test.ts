/**
 * 负责禁言具名流水线接线的集成测试。输入为真实原板、手写票型与 Provider，字面断言普通／PK替换和原投票资格。
 * 覆盖方向等待撤销后零公告、译者无需PK资格、已付目标不丢正常票以及有限配置解析。
 * 测试直接使用生产流水线，不以投影或生产计票函数计算预期票数。
 */
import { expect, test } from "bun:test";
import { Role, Phase, type ActionRequest, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { silenceElderTwelveConfig } from "../../../src/rulesets/presets/silence-elder-twelve";
import {
  openSilenceNight,
  commitSilenceChoice,
} from "../../../src/features/silence-elder/authority";
import { announceSilenceDay } from "../../../src/rulesets/silence-expression-plan";
import { DayPipeline } from "../../../src/engine/phases/day-pipeline";
import { VotingPipeline } from "../../../src/engine/phases/voting-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";

function fixture(sheriff = false) {
  const config = structuredClone(silenceElderTwelveConfig);
  config.enableSheriff = sheriff;
  if (sheriff) config.initialSheriffSeat = 1;
  const f = bootstrapGame(config),
    events: GameEvent[] = [];
  const actor = f.world.getEntityIdsByRole(Role.SilenceElder)[0]!;
  const target = f.world.getEntityIdsByRole(Role.Villager)[0]!;
  const translator = f.world.getEntityIdsByRole(Role.Seer)[0]!;
  openSilenceNight(f.world, actor, 1);
  commitSilenceChoice(f.world, actor, 1, target, translator, () => true);
  const dependencies = {
    world: f.world,
    events,
    toolGateway: new ToolGateway(),
    roleRegistry: createDefaultRoleRegistry(),
  };
  return { ...f, actor, target, translator, events, config, dependencies };
}

test("方向等待期间撤销阶段，不发表旧日禁言公告", async () => {
  const f = fixture(true);
  let current = true,
    calls = 0;
  await new DayPipeline(f.dependencies).execute(
    f.config,
    {
      async getAction(request) {
        calls++;
        expect(request.allowedTools).toEqual(["choose_direction"]);
        current = false;
        return { name: "choose_direction", args: { direction: "clockwise" } };
      },
    },
    { day: 1, isCurrent: () => current },
  );
  expect(calls).toBe(1);
  expect(f.events.filter((e) => e.type.startsWith("silence_"))).toEqual([]);
});

test("公告sink getter替换原目标／撤阶段时零公告，不预占已付目标的公告机会", () => {
  for (const mode of ["life", "phase"] as const) {
    const f = fixture();
    let current = true;
    Object.defineProperty(f.events, "push", {
      configurable: true,
      get() {
        if (mode === "life")
          f.world.addComponent(f.target, COMPONENT.Alive, createAliveComponent());
        else current = false;
        return Array.prototype.push;
      },
    });
    announceSilenceDay(f.config, f.world, f.events, 1, () => current);
    expect(f.events).toEqual([]);
    if (mode === "phase") {
      Object.defineProperty(f.events, "push", { value: Array.prototype.push });
      current = true;
      announceSilenceDay(f.config, f.world, f.events, 1, () => current);
      expect(f.events.map((e) => e.type)).toEqual(["silence_announced"]);
    }
  }
});

test("普通流水线仅替换禁言席位，译者仍有自己的正常发言", async () => {
  const f = fixture(),
    seen: ActionRequest[] = [];
  const result = await new DayPipeline(f.dependencies).execute(
    f.config,
    {
      async getAction(request) {
        seen.push(request);
        if (request.allowedTools.includes("gesture"))
          return { name: "gesture", args: { description: "（摇头指桌）" } };
        if (request.allowedTools.includes("translate_silence"))
          return { name: "translate_silence", args: { text: "这是我的解读。" } };
        return { name: "speak", args: { text: "普通发言" } };
      },
    },
    { day: 1 },
  );
  expect(result.interrupted).toBe(false);
  expect(seen.filter((r) => r.actorId === f.target).map((r) => r.allowedTools)).toEqual([
    ["gesture"],
  ]);
  expect(
    seen
      .filter((r) => r.actorId === f.translator)
      .map((r) => r.context.stage)
      .sort(),
  ).toEqual(["day_speech", "silence_translation"]);
  expect(result.summary.speeches).toHaveLength(11);
  expect(f.events[0]!.type).toBe("silence_announced");
  expect(f.events.filter((e) => e.type === "day_speech")).toHaveLength(11);
  expect(f.events.filter((e) => e.type === "silence_gesture")).toHaveLength(1);
});

test("PK保原投票资格，非候选译者仍可翻译；额外解释不变成第二张票", async () => {
  const f = fixture(),
    seen: ActionRequest[] = [];
  announceSilenceDay(f.config, f.world, f.events, 1);
  const other = f.world.getEntityIdsByRole(Role.Villager)[1]!;
  const voters = f.world.entityIds().filter((id) => id !== f.target && id !== other);
  const pipeline = new VotingPipeline({ ...f.dependencies, eventRegistry: new EventRegistry() });
  const result = await pipeline.execute(
    f.config,
    {
      async getAction(request) {
        seen.push(request);
        if (request.allowedTools.includes("gesture"))
          return { name: "gesture", args: { description: "（指向另一候选人）" } };
        if (request.allowedTools.includes("translate_silence"))
          return { name: "translate_silence", args: { text: null } };
        if (request.allowedTools.includes("speak"))
          return { name: "speak", args: { text: "PK发言" } };
        if (request.allowedTools.includes("vote")) {
          const target =
            request.context.stage === "exile_pk_vote"
              ? f.target
              : request.actorId === f.target
                ? other
                : request.actorId === other
                  ? f.target
                  : voters.indexOf(request.actorId) < 5
                    ? f.target
                    : other;
          return { name: "vote", args: { target_id: target, abstain: false } };
        }
        return null;
      },
    },
    { day: 1, isCurrent: () => true },
  );
  expect(result.summary.target).toBe(f.target);
  expect(result.summary.tally).toEqual({ [f.target]: 10 });
  expect(seen.filter((r) => r.actorId === f.target).map((r) => r.context.stage)).toEqual([
    "voting",
    "silence_gesture",
  ]);
  expect(
    seen.some((r) => r.actorId === f.translator && r.context.stage === "silence_translation"),
  ).toBe(true);
  expect(seen.filter((r) => r.context.stage === "exile_pk_vote")).toHaveLength(10);
  expect(f.events.filter((e) => e.type === "silence_translation_declined")).toHaveLength(1);
});

test("公开配置严格往返，未知参数与高级混板拒绝", () => {
  const definition = boardDefinitionFromConfig(
    "silence_contract",
    structuredClone(silenceElderTwelveConfig),
  );
  expect(parseBoardDefinition(definition).config.silenceElder).toEqual({
    policy: "awa_melbourne_gestures_v1",
  });
  expect(() =>
    parseBoardDefinition({
      ...definition,
      roles: {
        ...definition.roles,
        silence_elder: { policy: "awa_melbourne_gestures_v1", permanent: true },
      },
    }),
  ).toThrow();
  const mixed = structuredClone(silenceElderTwelveConfig);
  mixed.roleSetups.find((r) => r.role === Role.Hunter)!.role = Role.OrderPrince;
  expect(() => bootstrapGame(mixed)).toThrow();
});
