/**
 * 负责死亡枪击请求、三次有界选择及等待后的原生命／交换目标复验。输入为结算器的延迟读取、
 * 原死亡来源和同一动作窗口；输出为未付款的选择，空枪同样持原许可编号。
 * 资格捕获、恐惧与交换政策归原机制；本组合不标死、不消费弹药、不关闭窗口或确定胜负。
 * World 唯一开许可，结算器仍在原提交回调与 finally 关闭同一 permits 数组；异常不退款已提交前缀。
 */
import {
  Phase,
  Role,
  type EntityId,
  type DeathSources,
  type GameEvent,
  type RuntimeSnapshot,
  type ReadonlyBoardConfig,
} from "@ai-werewolf-arena/game-contract";
import type { ActionProvider } from "../domain/actions";
import type { DeathShotSelection } from "../domain/deaths";
import type { World } from "../domain/world";
import { COMPONENT } from "../domain/components/names";
import { captureNightLife, livingNightLife } from "../domain/night-effects";
import type { ToolGateway } from "../engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../engine/actions/action-request-factory";
import { captureDeathShotEligibility } from "../features/death-actions/death-abilities";
import type { DeathShotEligibility } from "../features/death-actions/death-shot-eligibility";
import {
  assertMagicianRosterCurrent,
  isMagicianBoard,
  resolveMagicianNightTarget,
} from "../features/magician/ports";
import { nightmareFearBlocks } from "../features/nightmare/ports";
import { demonHunterNativeGunCurrent } from "../features/demon-hunter/ports";

/** 延迟读取原结算器；类型只声明所需成员，不是进程隔离或额外的运行权限屏障。 */
export interface DeathShotSelectionRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly toolGateway: ToolGateway;
  readonly state: Pick<RuntimeSnapshot, "phase" | "day" | "gameOver">;
  readonly config?: ReadonlyBoardConfig;
}

/** 一次角色死亡动作的窗口；所有 permit 在退出该回调时关闭，不跨波复用。 */
export interface DeathWaveActions {
  phase: Phase;
  day: number;
  permits: Array<ReturnType<World["openDeathAction"]>>;
  isCurrent: () => boolean;
}

/** 开原窗口后登记给外层持有；每次 await 和工具校验之后仍按原顺序复验资格与窗口。 */
export async function collectDeathShot(
  runtime: DeathShotSelectionRuntime,
  actorId: EntityId,
  deathPhase: Phase,
  deathOriginPhase: Phase,
  sources: DeathSources,
  actionProvider: ActionProvider,
  actions: DeathWaveActions,
  abilityId?: string,
  nightExchange: boolean = false,
  ownedQualification?: DeathShotEligibility,
): Promise<DeathShotSelection> {
  if (deathPhase === Phase.Night && nightmareFearBlocks(runtime.world, actorId, actions.day, true))
    return { kind: "invalid" };
  const isCurrent = () =>
    actions.isCurrent() &&
    runtime.state.phase === actions.phase &&
    runtime.state.day === actions.day &&
    !runtime.state.gameOver;
  // 只装配延迟查询，不提前读取 World／日期；资格所有者 在原 callee 和参数时点捕获。
  const resolution = runtime;
  const qualification =
    ownedQualification ??
    captureDeathShotEligibility(
      {
        get world() {
          return resolution.world;
        },
        get day() {
          return actions.day;
        },
        get demonHunterNativeGunCurrent() {
          return demonHunterNativeGunCurrent;
        },
      },
      actorId,
      abilityId,
      sources,
      deathOriginPhase,
      isCurrent,
    );
  if (!qualification) return { kind: "invalid" };
  const { nativePolicy, permissionCurrent, eligible } = qualification;
  if (!eligible()) return { kind: "invalid" };
  const permit = runtime.world.openDeathAction(
    actorId,
    "shoot",
    actions.phase,
    actions.day,
    permissionCurrent,
    abilityId,
  );
  actions.permits.push(permit);
  const requests = new GameActionRequestFactory(runtime.world, runtime.events, actions.day);
  for (let attempt = 1; attempt <= 3; attempt++) {
    // 每次重试重新捕获候选生命；同一编号复活或替换组件后，上一轮回复不能命中新生命。
    const targets = new Map(
      runtime.world.getAliveEntityIds().map((id) => [id, captureNightLife(runtime.world, id)]),
    );
    if (!eligible()) return { kind: "invalid" };
    const request = requests.create({
      phase: actions.phase,
      actorId: actorId,
      allowedTools: ["shoot"],
      stage:
        abilityId === undefined &&
        runtime.world.getComponent(actorId, COMPONENT.Role)?.role === Role.Hunter
          ? "hunter_shot"
          : "death_shot",
      requiresAction: true,
      summary: { key: "request.summary.death_shot" },
      context: {
        ...(ownedQualification ||
        runtime.config?.magician ||
        runtime.config?.evilKnight ||
        abilityId !== undefined ||
        runtime.world.getComponent(actorId, COMPONENT.Role)?.role === Role.AwakenedHiddenWolf
          ? { action_failure_policy: "error" as const, allow_fallback: false }
          : {}),
        ...(abilityId === undefined ? {} : { ability_id: abilityId }),
        trigger: "on_death",
        death_phase: deathPhase,
        ...(nativePolicy === "awa_day_deaths_v1" ? { death_origin_phase: deathOriginPhase } : {}),
        death_sources: [...(sources[actorId] ?? [])],
        death_action_id: permit.id,
        shoot_candidates: [...targets.keys()].filter((id) => id !== actorId),
        ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
      },
    });
    if (!eligible()) return { kind: "invalid" };
    if (runtime.config?.magician) assertMagicianRosterCurrent(runtime.world);
    const action = await actionProvider.getAction(request);
    if (runtime.config?.magician) assertMagicianRosterCurrent(runtime.world);
    if (
      !eligible() ||
      !runtime.world.hasDeathAction(
        actorId,
        "shoot",
        actions.phase,
        actions.day,
        permit.id,
        abilityId,
      )
    )
      return { kind: "invalid" };
    if (action?.name !== "shoot") {
      if (runtime.config?.magician) throw new Error("magician_shot_action_missing");
      if (runtime.config?.evilKnight) throw new Error("evil_knight_hunter_action_missing");
      continue;
    }
    const validated = runtime.toolGateway.validateAndSanitize(runtime.world, actorId, action, {
      phase: actions.phase,
      day: actions.day,
      deathActionId: permit.id,
      abilityId,
    });
    if (
      !eligible() ||
      !runtime.world.hasDeathAction(
        actorId,
        "shoot",
        actions.phase,
        actions.day,
        permit.id,
        abilityId,
      )
    )
      return { kind: "invalid" };
    if (!validated.ok || !validated.sanitizedCall) {
      if (runtime.config?.magician) throw new Error("magician_shot_action_invalid");
      if (runtime.config?.evilKnight) throw new Error("evil_knight_hunter_action_invalid");
      continue;
    }
    const targetId = validated.sanitizedCall.args.target_id;
    // 空枪也只是已授权选择，真正消耗留给随后处理该选择的角色钩子。
    if (targetId === null) return { kind: "pass", deathActionId: permit.id };
    const targetScope = targets.get(targetId);
    if (!targetScope || !livingNightLife(runtime.world, targetScope)) {
      if (runtime.config?.magician) throw new Error("magician_shot_target_stale");
      continue;
    }
    if (nightExchange && isMagicianBoard(runtime.world)) {
      const mapped = resolveMagicianNightTarget(runtime.world, actions.day, targetId, "death_shot");
      if (!mapped.isCurrent()) throw new Error("magician_shot_target_stale");
      return {
        kind: "shot",
        targetId: mapped.effectiveId,
        deathActionId: permit.id,
        targetScope: mapped.scope,
        mappingCurrent: mapped.isCurrent,
        ...(!mapped.scope.life.alive ? { mappedMiss: true as const } : {}),
      };
    }
    return { kind: "shot", targetId, deathActionId: permit.id, targetScope };
  }
  if (ownedQualification && eligible()) throw new Error("death_action_valid_action_missing");
  if (abilityId !== undefined && eligible()) throw new Error("gift_gun_valid_action_missing");
  return { kind: "invalid" };
}
