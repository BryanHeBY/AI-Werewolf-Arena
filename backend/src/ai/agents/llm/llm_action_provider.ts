import { RoleComponent } from "../../../core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  ToolCall,
} from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import {
  ConfigRenderRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRolePromptRegistry,
  getDefaultTargetHintRegistry,
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  PhaseStageLocalizationRegistry,
  RolePromptRegistry,
  TargetHintRegistry,
  ToolCallRepairRegistry,
  ToolSpecRegistry,
} from "../../../game/mechanisms";
import { BaselineBotActionProvider } from "../providers/action_providers";
import { FallbackActionPolicy } from "./fallback_action_policy";
import { LegacyResponseInterpreter } from "./legacy_response_interpreter";
import { LlmObserver } from "./llm_observer";
import { ChatModelClient } from "./model_client";
import { PlayerPromptSession } from "./player_prompt_session";
import { PlayerRoundRecorder } from "./player_round_recorder";
import { ScopedRequestScheduler } from "./request_scheduler";
import { SdkGameToolLoop } from "./sdk_game_tool_loop";
import { LlmTurnOrchestrator } from "./llm_turn_orchestrator";

export interface LlmActionProviderOptions {
  maxPromptEvents?: number;
  trace?: boolean;
  fallbackProvider?: ActionProvider;
  llmTimeoutMs?: number;
  colorizeLogs?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  clientResolver?: (request: ActionRequest, role?: RoleComponent) => ChatModelClient;
  requestConcurrencyScopeResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => string | undefined;
  maxConcurrentRequestsResolver?: (
    request: ActionRequest,
    role?: RoleComponent,
  ) => number | undefined;
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry?: ToolSpecRegistry;
  rolePromptRegistry?: RolePromptRegistry;
  toolCallRepairRegistry?: ToolCallRepairRegistry;
  targetHintRegistry?: TargetHintRegistry;
  phaseStageLocalizationRegistry?: PhaseStageLocalizationRegistry;
  boardConfig?: BoardConfig;
  configRenderRegistry?: ConfigRenderRegistry;
  maxConcurrentRequests?: number;
}

/**
 * Facade and composition root for SDK-backed game agents.
 * Turn flow, prompt state, protocol handling and observability are separate collaborators.
 */
export class LlmActionProvider implements ActionProvider {
  private readonly orchestrator: LlmTurnOrchestrator;

  constructor(
    world: World,
    client: ChatModelClient,
    options: LlmActionProviderOptions = {},
  ) {
    const toolSpecRegistry = options.toolSpecRegistry ?? getDefaultToolSpecRegistry();
    const rolePromptRegistry = options.rolePromptRegistry ?? getDefaultRolePromptRegistry();
    const repairRegistry = options.toolCallRepairRegistry ?? getDefaultToolCallRepairRegistry();
    const targetHintRegistry = options.targetHintRegistry ?? getDefaultTargetHintRegistry();
    const localization = options.phaseStageLocalizationRegistry ??
      getDefaultPhaseStageLocalizationRegistry();
    const configRenderer = options.configRenderRegistry ?? getDefaultConfigRenderRegistry();
    const configuredConcurrency = options.maxConcurrentRequests ?? this.readConcurrencyFromEnvironment();
    const observer = new LlmObserver({
      trace: options.trace ?? false,
      colorizeLogs: options.colorizeLogs,
      printLlmIo: options.printLlmIo ?? false,
      printThinking: options.printThinking ?? false,
    });
    const scheduler = new ScopedRequestScheduler({
      defaultMaxConcurrentRequests: configuredConcurrency,
      scopeResolver: options.requestConcurrencyScopeResolver,
      limitResolver: options.maxConcurrentRequestsResolver,
      onWait: ({ request, scope, queueDepth, active, limit }) => {
        observer.trace(
          `request_queue_wait player=${request.actorId} phase=${request.phase} scope=${scope} queue_depth=${queueDepth} active=${active}/${limit}`,
        );
      },
    });
    const interpreter = new LegacyResponseInterpreter(world, repairRegistry);
    const promptSession = new PlayerPromptSession(world, {
      maxPromptEvents: options.maxPromptEvents ?? 16,
      supportsNativeTools: Boolean(client.runToolLoop),
      personalityPromptResolver: options.personalityPromptResolver,
      toolSpecRegistry,
      rolePromptRegistry,
      targetHintRegistry,
      phaseStageLocalizationRegistry: localization,
      configRenderRegistry: configRenderer,
      boardConfig: options.boardConfig,
    });
    const fallback = new FallbackActionPolicy(
      options.fallbackProvider ?? new BaselineBotActionProvider(world),
      observer,
    );
    const recorder = new PlayerRoundRecorder(world, localization);
    const sdkToolLoop = new SdkGameToolLoop(world, interpreter, promptSession, observer);
    this.orchestrator = new LlmTurnOrchestrator({
      world,
      defaultClient: client,
      clientResolver: options.clientResolver,
      timeoutMs: options.llmTimeoutMs ?? 1200,
      promptSession,
      scheduler,
      sdkToolLoop,
      interpreter,
      fallbackPolicy: fallback,
      recorder,
      observer,
    });
  }

  static fromModelClient(
    world: World,
    client: ChatModelClient,
    options: LlmActionProviderOptions = {},
  ): LlmActionProvider {
    return new LlmActionProvider(world, client, options);
  }

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    return this.orchestrator.run(request);
  }

  private readConcurrencyFromEnvironment(): number {
    const value = Number(process.env.LLM_MAX_CONCURRENT_REQUESTS ?? "");
    return Number.isFinite(value) && value > 0
      ? Math.max(1, Math.floor(value))
      : Number.POSITIVE_INFINITY;
  }
}
