/**
 * 场景测试验证曜蚀借用能力的原提示历史。输入保留 locale／借用类别矩阵及内存 SDK／ACP 回合接收器；字面回执、引用／getter／错误轨迹、事实和状态是原预期。原 helper 实际推进完整 NightPipeline，并连接 ActionTurn／ACP 和玩家 feed；这些控制适配器不启动 HTTP／stdio，受控 provider 不调用模型，生产输出不生成新 golden。
 */
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { ActionTurn } from "../../../../src/agents/player/action-turn";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { PotionType } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import {
  Role,
  Phase,
  COMPONENT,
  createRandom,
  type ActionRequest,
  type RoleComponent,
  type GameEvent,
} from "../../../../src/domain";
import { NightPipeline } from "../../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { PlayerPromptPolicy } from "../../../../src/agents/player/player-prompt-policy";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { projectNightAbility } from "../../../../src/agents/observation/night-ability-projection";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../../src/rulesets/mechanism-api";
import { buildAgentVisibleEvent } from "../../../../src/agents/observation/event-feed";

const raw = JSON.parse(
  await readFile(
    new URL(
      "../../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

const board = parseBoardDefinition(raw).config;

const roles = [
  Role.EclipseMaid,
  Role.RadiantCount,
  Role.Seer,
  Role.Witch,
  Role.Dreamer,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
];

const cases = [
  { kind: "shelter", owner: 2, stage: "radiant_shelter", tool: "cast_shelter" },
  { kind: "seer_check", owner: 3, stage: "seer", tool: "check_identity" },
  { kind: "potion", owner: 4, stage: "witch", tool: "use_potion" },
  { kind: "dream", owner: 5, stage: "dreamer", tool: "dream" },
] as const;

async function run(locale: "zh-CN" | "en", spec: (typeof cases)[number], variant: 0 | 1) {
  const { world } = bootstrapGame(board, {
    locale,
    fixedRoles: roles,
    random: createRandom("independent-radiant-private"),
  });
  const owner = world.getComponent(spec.owner, COMPONENT.Role)!;
  const original = findNightAbility(owner, spec.kind)!;
  const tag = variant ? "ORIGINAL_HISTORY_B_841327" : "ORIGINAL_HISTORY_A_527841";
  (owner.privateState as Record<string, unknown>).privateNote = tag;
  (original as { uses: number }).uses = variant ? 4 : 2;
  (original as { lastUsedDay: number | null }).lastUsedDay = variant ? 2 : 1;
  if (spec.kind === "seer_check")
    Object.assign(original.state, {
      lastTarget: variant ? 8 : 7,
      lastIsWerewolf: !!variant,
      lastResult: { kind: "camp", camp: variant ? "wolf" : "good" },
      history: [
        {
          targetId: variant ? 8 : 7,
          isWerewolf: !!variant,
          result: { kind: "camp", camp: variant ? "wolf" : "good" },
          privateCanary: tag,
        },
      ],
    });
  if (spec.kind === "dream")
    Object.assign(original.state, {
      lastDay: 3,
      lastTarget: 6,
      history: [
        { day: 1, targetId: variant ? 8 : 7, privateCanary: tag },
        { day: 3, targetId: 6 },
      ],
    });
  if (spec.kind === "shelter") Object.assign(original.state, { lastDay: 3, lastTarget: 6 });
  const originalBefore = projectNightAbility(original, 4);
  const policy = new PlayerPromptPolicy(world, {
    boardConfig: board,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  const events: GameEvent[] = [];
  const pipeline = new NightPipeline({
    world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    random: createRandom("independent-radiant-night"),
  });
  const seen: any[] = [];
  const provider = {
    async getAction(r: ActionRequest) {
      if (r.actorId === 1) {
        const toolErrors: unknown[] = [];
        if (r.context.stage === spec.stage) {
          const args =
            spec.kind === "potion"
              ? { target_id: 999, potion_type: PotionType.Poison }
              : { target_id: 999 };
          const sdk = new ActionTurn(new ActionReception(world), r, "r-canary-sdk");
          const receipt = sdk.submit("r-canary-sdk", spec.tool, args);
          expect(receipt.ok).toBe(false);
          expect((receipt as any).error).toBe(
            (
              {
                shelter: "radiant_shelter_target",
                seer_check: "check_target",
                potion: "poison_target",
                dream: "dream_target",
              } as const
            )[spec.kind],
          );
          expect(Object.keys(receipt).sort()).toEqual(["error", "message", "ok"]);
          const registry = new AcpTurnRegistry(world);
          const pending = registry.openTurn(r, "r-canary-session");
          const acp = registry.submitAction("r-canary-session", {
            turn_id: pending.turnId,
            action: spec.tool,
            arguments: args,
          });
          expect(acp).toEqual(receipt);
          expect(JSON.stringify([receipt, acp])).not.toContain(tag);
          registry.closeTurn("r-canary-session");
          expect(await pending.action).toBeNull();
          const lateAcp = registry.submitAction("r-canary-session", {
            turn_id: pending.turnId,
            action: spec.tool,
            arguments: args,
          });
          sdk.close();
          const lateSdk = sdk.submit("r-canary-sdk", spec.tool, args);
          expect(lateAcp).toEqual(lateSdk);
          registry.close();
          toolErrors.push(receipt, acp, lateSdk, lateAcp);
        }
        seen.push({
          toolErrors,
          stage: r.context.stage,
          system: policy.buildSystem(r, { supportsDebugReporting: true }),
          user: policy.buildUser(r, {
            turnId: "t1",
            allowedTools: r.allowedTools,
            actionSubmissionHint: "submit",
          }),
          observation: policy.buildObservation(r),
        });
      }
      switch (r.context.stage) {
        case "eclipse_swallow":
          return { name: "swallow_skill", args: { target_id: spec.owner } } as const;
        case "radiant_shelter":
          return { name: "cast_shelter", args: { target_id: 9 } } as const;
        case "dreamer":
          return { name: "dream", args: { target_id: 9 } } as const;
        case "wolf_discussion":
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } } as const;
        case "wolf_vote":
          return { name: "kill_vote", args: { target_id: null, abstain: true } } as const;
        case "witch":
          return {
            name: "use_potion",
            args: { target_id: r.actorId, potion_type: PotionType.None },
          } as const;
        case "seer":
          return { name: "check_identity", args: { target_id: 10 } } as const;
        default:
          throw Error("unexpected " + r.context.stage);
      }
    },
  };
  const result = await pipeline.execute(board, provider, 4);
  expect(result.interrupted).toBe(false);
  const view = (actor: number) => {
    let seq = 1;
    return events.flatMap((e) => {
      const v = buildAgentVisibleEvent(world, e, actor, seq);
      if (v) seq++;
      return v ? [v] : [];
    });
  };
  const maid = world.getComponent(1, COMPONENT.Role)!;
  const borrowed = findNightAbility(maid, spec.kind, "copy:eclipse:night:4")!;
  const afterRequest: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 4, stage: "day_speech", visible_events: view(1), turn_constraints: {} },
  };
  const after = {
    system: policy.buildSystem(afterRequest, { supportsDebugReporting: true }),
    user: policy.buildUser(afterRequest, {
      turnId: "t2",
      allowedTools: ["speak"],
      actionSubmissionHint: "submit",
    }),
    observation: policy.buildObservation(afterRequest),
  };
  expect(JSON.stringify({ seen, after })).not.toContain(tag);
  expect(seen.map((x) => x.stage)).toEqual(["eclipse_swallow", spec.stage]);
  expect(seen[1].observation.abilities[0].uses).toBe(0);
  expect(seen[1].observation.abilities[0].lastUsedDay).toBeNull();
  expect(seen[1].observation.abilities[0].source).toEqual({
    kind: "copy",
    actorId: spec.owner,
    abilityId: "native:" + spec.kind,
  });
  expect(seen[1].observation.abilities[0]).not.toHaveProperty("nightSuppression");
  expect(projectNightAbility(original, 4).state).toEqual(originalBefore.state);
  expect(projectNightAbility(original, 4).uses).toBe(originalBefore.uses);
  expect(projectNightAbility(original, 4).lastUsedDay).toBe(originalBefore.lastUsedDay);
  expect(borrowed.disabled).toBe(true);
  expect(
    view(spec.owner)
      .filter((e) => e.type === "eclipse_native_suppressed" || e.type === "eclipse_native_restored")
      .map((e) => e.payload),
  ).toEqual([
    { playerId: spec.owner, day: 4 },
    { playerId: spec.owner, day: 4 },
  ]);
  expect(
    view(spec.owner).some((e) => e.type === "eclipse_swallowed" || e.type === "ability_changed"),
  ).toBe(false);
  expect(
    view(6).some((e) => e.type.startsWith("eclipse_") || e.type === "radiant_shelter_chosen"),
  ).toBe(false);
  return { seen, after, originalBefore };
}

for (const locale of ["zh-CN", "en"] as const)
  for (const spec of cases)
    test(`${locale} ${spec.kind}: actual policy plus SDK ActionTurn and ACP registry errors remain equal across source history variants`, async () => {
      const a = await run(locale, spec, 0),
        b = await run(locale, spec, 1);
      expect(a.originalBefore).not.toEqual(b.originalBefore);
      expect(a.seen).toEqual(b.seen);
      expect(a.after).toEqual(b.after);
    });
