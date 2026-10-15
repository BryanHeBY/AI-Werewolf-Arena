/**
 * 负责将完整内建资源程序与可替换扩展分派到各自运行输入；只按真实 handler＋execute 双引用，不按 id／priority 授权。
 * 输入为真实阶段对象、原执行方法和当次可信上下文；输出为原执行结果或公开查询／本族命令对象。
 * 表仅保存定义和函数引用，World／运行状态只由本次调用的私有输入持有，不建反查 runtime 的 token 或全局 World 缓存。
 * 原 execute getter 在调用方原点只读取一次；若被替换，callback 只收到实际无 World／组件的公开对象。
 */
import type {
  NightStageDefinition as NightStageHandler,
  NightStageContext,
} from "../engine/night/contracts";
import {
  bindLegacyAwakenedProposals,
  bindSyntheticNightDamageCommands,
  type TrustedNightStageRuntime,
} from "../engine/night/trusted-runtime";
import { createBoundToolGateway } from "../engine/actions/tool-gateway";
import { bindPaidDreamNightProbe } from "../features/dreamer/night-links";
import { OWNED_NIGHT_STAGE_PROGRAMS as AnimalDreamNightStagesPrograms } from "../features/animal-dream/night-stages";
import {
  AWAKENED_NIGHT_STAGES,
  OWNED_NIGHT_STAGE_PROGRAMS as AwakenedHiddenWolfNightStagesPrograms,
} from "../features/awakened-hidden-wolf/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as BlackMarketMerchantNightStagePrograms } from "../features/black-market-merchant/night-stage";
import { OWNED_NIGHT_STAGE_PROGRAMS as CupidNightStagePrograms } from "../features/cupid/night-stage";
import { OWNED_NIGHT_STAGE_PROGRAMS as DeathActionsDeathAbilityActivationPrograms } from "../features/death-actions/death-ability-activation";
import { OWNED_NIGHT_STAGE_PROGRAMS as DemonHunterNightStagesPrograms } from "../features/demon-hunter/night-stages";
import {
  DREAMER_NIGHT_STAGE,
  OWNED_NIGHT_STAGE_PROGRAMS as DreamerNightStagesPrograms,
} from "../features/dreamer/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as EvilKnightNightFramePrograms } from "../features/evil-knight/night-frame";
import { OWNED_NIGHT_STAGE_PROGRAMS as FragrantPairSeerNightStagesPrograms } from "../features/fragrant-pair-seer/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as GhostBrideNightStagesPrograms } from "../features/ghost-bride/night-stages";
import {
  GRAVEKEEPER_FEEDBACK_STAGE,
  OWNED_NIGHT_STAGE_PROGRAMS as GravekeeperFeedbackPrograms,
} from "../features/gravekeeper/feedback";
import { OWNED_NIGHT_STAGE_PROGRAMS as GuardNightStagesPrograms } from "../features/guard/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as HybridNightStagePrograms } from "../features/hybrid/night-stage";
import { OWNED_NIGHT_STAGE_PROGRAMS as MagicianNightStagesPrograms } from "../features/magician/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as MechanicalWolfNightStagesPrograms } from "../features/mechanical-wolf/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as MiracleMerchantNightStagePrograms } from "../features/miracle-merchant/night-stage";
import { OWNED_NIGHT_STAGE_PROGRAMS as MistRavenNightStagesPrograms } from "../features/mist-raven/night-stages";
import { isOwnedRecipientAbilityProgram } from "../features/night-abilities/recipient-ability-stage";
import { OWNED_NIGHT_STAGE_PROGRAMS as NightmareNightStagesPrograms } from "../features/nightmare/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as NobleSecretBodyNightStagesPrograms } from "../features/noble-secret-body/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as PureWhiteNightStagesPrograms } from "../features/pure-white/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as RadiantEclipseNightStagesPrograms } from "../features/radiant-eclipse/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as RoleInspectionNightStagesPrograms } from "../features/role-inspection/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as ScholarMentorNightStagesPrograms } from "../features/scholar-mentor/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as SeerNightStagesPrograms } from "../features/seer/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as TimeWolfConsortNightStagesPrograms } from "../features/time-wolf-consort/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as TricksterNightStagesPrograms } from "../features/trickster/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as WitchNightStagesPrograms } from "../features/witch/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as WolfBeautyNightStagesPrograms } from "../features/wolf-beauty/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as WolfSorcererNightStagesPrograms } from "../features/wolf-sorcerer/night-stages";
import { OWNED_NIGHT_STAGE_PROGRAMS as WolfNightStagesPrograms } from "../features/wolf/night-stages";

// 这些引用来自内建完整程序自己的定义；没有接受外部“登记可信 callback”的通用入口。
import { OWNED_NIGHT_STAGE_PROGRAMS as CrowPrograms } from "../features/crow/night-stage";
const programs: ReadonlyArray<readonly [object, unknown]> = [
  ...AnimalDreamNightStagesPrograms,
  ...CrowPrograms,
  ...AwakenedHiddenWolfNightStagesPrograms,
  ...BlackMarketMerchantNightStagePrograms,
  ...CupidNightStagePrograms,
  ...DeathActionsDeathAbilityActivationPrograms,
  ...DemonHunterNightStagesPrograms,
  ...DreamerNightStagesPrograms,
  ...EvilKnightNightFramePrograms,
  ...FragrantPairSeerNightStagesPrograms,
  ...GhostBrideNightStagesPrograms,
  ...GravekeeperFeedbackPrograms,
  ...GuardNightStagesPrograms,
  ...HybridNightStagePrograms,
  ...MagicianNightStagesPrograms,
  ...MechanicalWolfNightStagesPrograms,
  ...MiracleMerchantNightStagePrograms,
  ...MistRavenNightStagesPrograms,
  ...NightmareNightStagesPrograms,
  ...NobleSecretBodyNightStagesPrograms,
  ...PureWhiteNightStagesPrograms,
  ...RadiantEclipseNightStagesPrograms,
  ...RoleInspectionNightStagesPrograms,
  ...ScholarMentorNightStagesPrograms,
  ...SeerNightStagesPrograms,
  ...TimeWolfConsortNightStagesPrograms,
  ...TricksterNightStagesPrograms,
  ...WitchNightStagesPrograms,
  ...WolfBeautyNightStagesPrograms,
  ...WolfSorcererNightStagesPrograms,
  ...WolfNightStagesPrograms,
];
const syntheticDamageStages = new WeakSet<object>();
/** 显式自定义伤害贡献只取得加毒印记的具体 writer，不取得任意组件或提案容器。 */
export function bindSyntheticNightDamageStage<T extends object>(handler: T): T {
  syntheticDamageStages.add(handler);
  return handler;
}
import { sourceNightStageHandler } from "./night-stage-registration";

export type PaidDreamStagePorts = ReturnType<typeof bindPaidDreamNightProbe>;
export type LegacyAwakenedStagePorts = ReturnType<typeof bindLegacyAwakenedProposals>;
export interface GravekeeperStagePorts {
  runFeedback(): Promise<void>;
}
export type SyntheticNightDamagePorts = ReturnType<typeof bindSyntheticNightDamageCommands>;

/** 每次实际调用只绑定已有具体 owner；未知 handler 不填入伪成功的空操作。 */
export function bindNightStageContext<P extends object = object>(
  handler: NightStageHandler,
  runtime: TrustedNightStageRuntime,
): NightStageContext<P> {
  const source = sourceNightStageHandler(handler);
  let ports: object | undefined;
  if (source === DREAMER_NIGHT_STAGE)
    ports = bindPaidDreamNightProbe({ state: () => runtime.state, world: () => runtime.world });
  else if (AWAKENED_NIGHT_STAGES.some((known) => known === source))
    ports = bindLegacyAwakenedProposals(runtime);
  else if (source === GRAVEKEEPER_FEEDBACK_STAGE)
    ports = {
      get runFeedback() {
        const callee = GRAVEKEEPER_FEEDBACK_STAGE.execute;
        return () => executePreparedNightStage(GRAVEKEEPER_FEEDBACK_STAGE, callee, runtime);
      },
    };
  else if (syntheticDamageStages.has(handler)) ports = bindSyntheticNightDamageCommands(runtime);
  return {
    get isCurrent() {
      const callee = runtime.isCurrent,
        invoke = Reflect.apply.bind(Reflect);
      return () => invoke(callee, runtime, []) as boolean;
    },
    get previousExile() {
      return runtime.previousExile;
    },
    get actions() {
      return createBoundToolGateway(
        () => runtime.toolGateway,
        () => runtime.world,
      );
    },
    get actionProvider() {
      const provider = runtime.actionProvider;
      return {
        get getAction() {
          const callee = provider.getAction,
            invoke = Reflect.apply.bind(Reflect);
          return (request: Parameters<typeof callee>[0]) =>
            invoke(callee, provider, [request]) as ReturnType<typeof callee>;
        },
      };
    },
    get currentDay() {
      const callee = runtime.currentDay,
        invoke = Reflect.apply.bind(Reflect);
      return () => invoke(callee, runtime, []) as number;
    },
    get makeRequest() {
      const callee = runtime.makeRequest,
        invoke = Reflect.apply.bind(Reflect);
      return (
        actor: Parameters<typeof callee>[0],
        tools: Parameters<typeof callee>[1],
        extras: Parameters<typeof callee>[2],
      ) => invoke(callee, runtime, [actor, tools, extras]) as ReturnType<typeof callee>;
    },
    entityIds() {
      return runtime.world.entityIds();
    },
    get getAliveByRole() {
      const callee = runtime.getAliveByRole,
        invoke = Reflect.apply.bind(Reflect);
      return (role: Parameters<typeof callee>[0]) =>
        invoke(callee, runtime, [role]) as ReturnType<typeof callee>;
    },
    get pickMajorityTarget() {
      const callee = runtime.pickMajorityTarget,
        invoke = Reflect.apply.bind(Reflect);
      return (votes: Parameters<typeof callee>[0]) =>
        invoke(callee, runtime, [votes]) as ReturnType<typeof callee>;
    },
    get pickMistKnife() {
      const callee = runtime.pickMistKnife;
      if (!callee) return callee;
      const invoke = Reflect.apply.bind(Reflect);
      return (ids: Parameters<NonNullable<typeof callee>>[0]) =>
        invoke(callee, runtime, [ids]) as ReturnType<NonNullable<typeof callee>>;
    },
    get shuffleWolves() {
      const callee = runtime.shuffleWolves,
        invoke = Reflect.apply.bind(Reflect);
      return (ids: Parameters<typeof callee>[0]) =>
        invoke(callee, runtime, [ids]) as ReturnType<typeof callee>;
    },
    get ports() {
      return ports as P | undefined;
    },
  };
}

/**
 * 实际 callee 已在原调用点求出；先准备新增 Reflect 调用，再选择私有完整程序或公开扩展输入。
 * 不提前测试 callability，参数仍先形成；invoke 保原 handler receiver。此新增委托／对象分配是明确扩展 API 变更。
 */
export function executePreparedNightStage(
  handler: NightStageHandler,
  callee: unknown,
  runtime: TrustedNightStageRuntime,
): Promise<void> {
  const invoke = Reflect.apply.bind(Reflect),
    source = sourceNightStageHandler(handler);
  const owned =
    programs.some(([known, program]) => known === source && program === callee) ||
    isOwnedRecipientAbilityProgram(source, callee);
  const context = owned ? runtime : bindNightStageContext(handler, runtime);
  return invoke(callee as (...args: never[]) => unknown, handler, [context]) as Promise<void>;
}
