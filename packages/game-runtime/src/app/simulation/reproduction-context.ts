/**
 * 负责：从实际执行上下文编码原 reproduction 元数据和 checkpoint。
 * 输入：真实 World/经理、同一参数与 RulePlan owner、记录与运行选项；
 * 输出：严格录制的元数据、checkpoint 与当前构建轨迹，不写入计划对象或新 revision 字段。
 * 编码前校验参数、开局上下文与经理的计划引用；伪造别名在记录前拒绝。
 * 参数 DTO 从同一 owner 脱离克隆，来源指纹和当前状态仍沿原读序获取。
 */
import { requireBoardParameters } from "../../rulesets/board-parameters";
import { RulePlan } from "../../rulesets/rule-plan";
import { fingerprintEngine } from "../../recording/reproduction/engine-fingerprint";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { RuntimeSnapshot, World } from "../../domain";
import type { EngineVersion, RecordedCheckpoint } from "../../recording/reproduction/format";
import { recordedErrorName } from "../../recording/reproduction/format";
import {
  prepareCheckpointContributions,
  captureCheckpointContributions,
  capturePlayerContributions,
} from "../checkpoint/contributions";
import { initialIdentityDeal } from "../../features/initial-identity/deal";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { Role, type Locale } from "@ai-werewolf-arena/game-contract";
import type { BootstrapResult } from "../bootstrap";
import type { BoardConfig } from "../../domain";
import type { ResolvedAgentRuntimeProfile } from "../config/contracts";
import type { SessionRecordManager } from "../../recording/session/recorder";

/** 即使引擎存在未提交改动，真实源码／lock 指纹仍明确控制重放兼容。 */
export async function currentEngineVersion(
  sourceRoot: string = path.resolve(__dirname, "../../../../.."),
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
          ...(player.name !== undefined ? { name: player.name } : {}),
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
    // 丘比特／混血儿的选择与相认事实会先于下个 checkpoint 进入后续请求。刷盘必须复制当前事件，
    // 不能用旧 checkpoint 事件误判本人可见事实为伪造；副本仍由 Trace.build 持有，
    // 不提前推进 checkpoint、公开隐藏归属或改变普通板子原有的回调选择。
    parameters.board.warden ||
      parameters.board.silenceElder ||
      parameters.board.awakenedWolfKing ||
      parameters.board.awakenedWitch ||
      parameters.board.awakenedWolfBeauty ||
      parameters.board.awakenedHunter ||
      parameters.board.radiantEclipse ||
      parameters.board.nobleSecretBody ||
      parameters.board.fragrantPairSeer ||
      parameters.board.animalDream ||
      parameters.board.roleSetups.some(
        (row) => (row.role === Role.Hybrid || row.role === Role.Cupid) && row.count > 0,
      )
      ? () => context.phaseManager.getEvents()
      : undefined,
  );
  trace.checkpoint(initial, context.phaseManager.getEvents());
  return trace;
}
