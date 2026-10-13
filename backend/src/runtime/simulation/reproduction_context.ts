/**
 * 负责：从实际执行上下文编码原 reproduction 元数据和 checkpoint。
 * 输入：真实 World/经理、同一参数与 RulePlan owner、记录与运行选项；
 * 输出：原 schema2 归档数据与轨迹，不写入计划对象或新 revision 字段。
 * 编码前校验参数、开局上下文与经理的计划引用；伪造别名在记录前拒绝。
 * 参数 DTO 从同一 owner 脱离克隆，来源指纹和当前状态仍沿原读序获取。
 */
import { requireBoardParameters } from "../../rulesets/board-parameters";
import { RulePlan } from "../../rulesets/rule-plan";
import { fingerprintEngine } from "../../recording/engine-fingerprint";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { RuntimeSnapshot, World } from "../../core";
import type { EngineVersion, RecordedCheckpoint } from "../../recording/reproduction";
import { recordedErrorName } from "../../recording/reproduction";
import {
  prepareCheckpointContributions,
  captureCheckpointContributions,
  capturePlayerContributions,
} from "../../recording/checkpoint/contributions";
import { initialIdentityDeal } from "../../game/mechanisms/roles/initial_identity/deal";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { type Locale } from "@ai-werewolf-arena/game-contract";
import type { BootstrapResult } from "../../app/bootstrap";
import type { BoardConfig } from "../../core";
import type { ResolvedAgentRuntimeProfile } from "../config/contracts";
import type { SessionRecordManager } from "../../recording/session_recorder";

/** 即使引擎存在未提交改动，真实源码／lock 指纹仍明确控制重放兼容。 */
export async function currentEngineVersion(
  sourceRoot: string = path.resolve(__dirname, "../../../.."),
): Promise<EngineVersion> {
  const root = path.resolve(sourceRoot);
  const { sourceHash, lockHash } = await fingerprintEngine(root);
  let commit: string | undefined;
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (/^[a-f0-9]{40}$/.test(value)) commit = value;
  } catch {
    /* 无 .git 的归档仍可使用源码／lock 指纹，不补造提交身份。 */
  }
  return {
    id: "awa-engine",
    sourceHash,
    lockHash,
    ...(commit ? { commit } : {}),
  };
}

export function captureCheckpoint(
  world: World,
  snapshot: RuntimeSnapshot,
  cycle: number,
  complete: boolean,
  eventCount: number,
  failure?: unknown,
  cursors?: { settlementCount: number; decisionCount: number },
): RecordedCheckpoint {
  const contributions = prepareCheckpointContributions(world, complete);
  return {
    ...captureCheckpointContributions(world, complete, contributions, cursors),
    cycle,
    complete,
    snapshot,
    eventCount,
    ...(!complete
      ? { failure: { name: recordedErrorName(failure), code: "cycle_failed" as const } }
      : {}),
    players: capturePlayerContributions(world, complete, contributions.animal),
  };
}

export function beginGameReproduction(
  manager: SessionRecordManager,
  context: BootstrapResult,
  options: {
    engine: EngineVersion;
    boardId: string;
    locale: Locale;
    maxDays: number;
    profiles?: ReadonlyMap<number, ResolvedAgentRuntimeProfile>;
  },
) {
  const parameters = requireBoardParameters(context.world);
  if (context.parameters !== parameters || context.boardConfig !== parameters.board)
    throw new Error("rule_parameters_context_mismatch");
  if (
    !RulePlan.isOwned(context.rulePlan) ||
    context.rulePlan !== context.phaseManager.getRulePlan() ||
    context.rulePlan.parameters !== parameters
  )
    throw new Error("rule_plan_context_mismatch");
  const initial = captureCheckpoint(
    context.world,
    context.phaseManager.getSnapshot(),
    0,
    true,
    context.phaseManager.getEvents().length,
  );
  const trace = manager.beginReproduction(
    {
      engine: options.engine,
      boardId: options.boardId,
      normalizedBoard: context.rulePlan.encodeParameters(),
      locale: options.locale,
      maxDays: options.maxDays,
      dealMode: context.dealMode,
      ...(context.phaseManager.getFaultPlan()
        ? { faultPlan: context.phaseManager.getFaultPlan() }
        : {}),
      ...(initialIdentityDeal(context.world)
        ? { initialDeal: [...initialIdentityDeal(context.world)!] }
        : {}),
      ruleset: RULESET,
      random: context.random.metadata,
      players: initial.players.map((player) => {
        const profile = options.profiles?.get(player.id);
        return {
          id: player.id,
          name: player.name,
          role: player.role,
          camp: player.camp,
          ...(profile
            ? {
                agent: {
                  kind: profile.kind,
                  name: profile.name,
                  ...(profile.model ? { model: profile.model } : {}),
                },
              }
            : {}),
        };
      }),
    },
    parameters.board.radiantEclipse ||
      parameters.board.nobleSecretBody ||
      parameters.board.fragrantPairSeer ||
      parameters.board.animalDream
      ? () => context.phaseManager.getEvents()
      : undefined,
  );
  trace.checkpoint(initial, context.phaseManager.getEvents());
  return trace;
}
