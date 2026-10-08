import type { Locale } from "@ai-werewolf-arena/game-text";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionProvider,
ActionRequest,
BoardConfig,
ToolCall, } from "../../../core/domain"
import { World } from "../../../core/domain/world";
import {
  ConfigRenderRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  PhaseStageLocalizationRegistry,
  RoleCatalog,
  TargetHintRegistry,
  ToolCallRepairRegistry,
  ToolSpecRegistry,
  ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { BaselineBotActionProvider } from "../providers/action_providers";
import { ChatModelClient } from "../../integrations/llm/transport";
import { FallbackActionPolicy } from "./fallback_action_policy";
import { LlmObserver } from "../player/player_observer";
import { PlayerPromptSession } from "./player_prompt_session";
import { PlayerPromptPolicy } from "../player/player_prompt_policy";
import { PlayerRoundRecorder } from "../player/player_round_recorder";
import { ScopedRequestScheduler } from "../../runtime/request_scheduler";
import { SdkGameToolLoop } from "./sdk_game_tool_loop";
import { LlmTurnOrchestrator } from "./llm_turn_orchestrator";

export interface LlmActionProviderOptions {
  maxPromptEvents?: number;
  displayLocale?: Locale;
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
  roleCatalog?: RoleCatalog;
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
    const roleCatalog = options.roleCatalog ?? getDefaultRoleCatalog();
    const repairRegistry = options.toolCallRepairRegistry ?? getDefaultToolCallRepairRegistry();
    const targetHintRegistry = options.targetHintRegistry ?? getDefaultTargetHintRegistry();
    const localization = options.phaseStageLocalizationRegistry ??
      getDefaultPhaseStageLocalizationRegistry();
    const configRenderer = options.configRenderRegistry ?? getDefaultConfigRenderRegistry();
    const configuredConcurrency = options.maxConcurrentRequests ?? this.readConcurrencyFromEnvironment();
    const observer = new LlmObserver({
      trace: options.trace ?? false,
      locale: options.displayLocale ?? world.locale,
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
    const promptPolicy = new PlayerPromptPolicy(world, {
      personalityPromptResolver: options.personalityPromptResolver,
      toolSpecRegistry,
      roleCatalog,
      targetHintRegistry,
      phaseStageLocalizationRegistry: localization,
      configRenderRegistry: configRenderer,
      boardConfig: options.boardConfig,
    });
    const promptSession = new PlayerPromptSession({
      maxPromptEvents: options.maxPromptEvents ?? 16,
      promptPolicy,
    });
    const fallback = new FallbackActionPolicy(
      options.fallbackProvider ?? new BaselineBotActionProvider(world, roleCatalog),
      observer,
    );
    const recorder = new PlayerRoundRecorder(world);
    const sdkToolLoop = new SdkGameToolLoop(world, repairRegistry, promptSession, observer, toolSpecRegistry, new ToolValidationRuleRegistry(undefined, roleCatalog));
    this.orchestrator = new LlmTurnOrchestrator({
      world,
      defaultClient: client,
      clientResolver: options.clientResolver,
      timeoutMs: options.llmTimeoutMs ?? 1200,
      promptSession,
      scheduler,
      sdkToolLoop,
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

  close(): Promise<void> { return this.orchestrator.close(); }

  get runtimeState() { return this.orchestrator.runtimeState; }

  private readConcurrencyFromEnvironment(): number {
    const value = Number(process.env.LLM_MAX_CONCURRENT_REQUESTS ?? "");
    return Number.isFinite(value) && value > 0
      ? Math.max(1, Math.floor(value))
      : Number.POSITIVE_INFINITY;
  }
}
