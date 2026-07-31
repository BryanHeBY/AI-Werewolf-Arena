import { promises as fs } from "node:fs";
import * as path from "node:path";
import { World } from "../core/domain/world";
import { ActionProvider, BoardConfig } from "../core/domain/model";
import {
  AcpActionProvider,
  AcpProcessClient,
  BaselineBotActionProvider,
  LlmActionProvider,
} from "../ai";
import { AiSdkClient } from "../ai/integrations/llm/ai_sdk_client";
import { ResolvedAgentRuntimeProfile } from "./config/runtime_config";

export interface PlayerAgentRuntime {
  kind: "llm" | "acp";
  provider: ActionProvider;
  close(): Promise<void>;
}

export interface PlayerAgentFactoryOptions {
  world: World;
  boardConfig: BoardConfig;
  profilesByActor: ReadonlyMap<number, ResolvedAgentRuntimeProfile>;
  acpWorkspaceRoot: string;
  llmTimeoutMs: number;
  trace: boolean;
  colorizeLogs: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  defaultForceJsonResponse?: boolean;
  createAcpUpdateObserver?: (actorId: number) => ((update: unknown) => void) | undefined;
}

/** 根据统一 profile 创建玩家运行时；调用方无需感知 SDK/ACP 构造细节。 */
export async function createPlayerAgentRuntime(
  options: PlayerAgentFactoryOptions,
): Promise<PlayerAgentRuntime> {
  const profiles = [...options.profilesByActor.values()];
  if (profiles.length === 0) throw new Error("runtime_config_player_profiles_empty");
  const usesAcp = profiles.some((profile) => profile.kind === "acp");
  if (usesAcp && profiles.some((profile) => profile.kind !== "acp")) {
    throw new Error("runtime_config_mixed_llm_and_acp_agents_not_supported_yet");
  }
  return usesAcp ? createAcpRuntime(options) : createLlmRuntime(options);
}

async function createAcpRuntime(
  options: PlayerAgentFactoryOptions,
): Promise<PlayerAgentRuntime> {
  await fs.mkdir(options.acpWorkspaceRoot, { recursive: true });
  const observers = new Map<number, ((update: unknown) => void) | undefined>();
  const provider = new AcpActionProvider(options.world, {
    sessionFactoryResolver: (actorId) => {
      const profile = options.profilesByActor.get(actorId);
      if (!profile || profile.kind !== "acp" || profile.provider.type !== "acp") {
        throw new Error(`runtime_config_acp_profile_missing_for_actor:${actorId}`);
      }
      if (!observers.has(actorId)) {
        observers.set(actorId, options.createAcpUpdateObserver?.(actorId));
      }
      return new AcpProcessClient({
        command: profile.provider.command,
        args: [...(profile.provider.args ?? []), ...(profile.spawnArgs ?? [])],
        env: profile.provider.env,
        cwd: profile.provider.cwd ?? path.join(options.acpWorkspaceRoot, `player-${actorId}`),
        onUpdate: ({ update }) => observers.get(actorId)?.(update),
      });
    },
    personalityPromptResolver: (request) =>
      options.profilesByActor.get(request.actorId)?.personalityPrompt,
    boardConfig: options.boardConfig,
    turnTimeoutMs: options.llmTimeoutMs,
    fallbackProvider: new BaselineBotActionProvider(options.world),
  });
  return {
    kind: "acp",
    provider,
    close: () => provider.close(),
  };
}

function createLlmRuntime(options: PlayerAgentFactoryOptions): PlayerAgentRuntime {
  const clientByActor = new Map<number, AiSdkClient>();
  for (const [actorId, profile] of options.profilesByActor) {
    if (profile.kind !== "llm" || profile.provider.type === "acp" || !profile.model) {
      throw new Error(`runtime_config_llm_profile_missing_for_actor:${actorId}`);
    }
    clientByActor.set(actorId, new AiSdkClient({
      providerType: profile.provider.type,
      providerName: profile.providerName,
      baseURL: profile.provider.baseURL,
      apiKey: profile.provider.apiKey,
      model: profile.model,
      userAgent: profile.provider.userAgent,
      temperature: profile.temperature ?? 0.2,
      maxTokens: profile.maxTokens ?? 512,
      forceJsonResponse: profile.forceJsonResponse ?? options.defaultForceJsonResponse ?? true,
      reasoningEnabled: profile.reasoningEnabled ?? true,
      reasoningEffort: profile.reasoningEffort ?? "medium",
      thinkingEnabled: profile.thinkingEnabled ?? false,
    }));
  }
  const firstClient = clientByActor.values().next().value as AiSdkClient | undefined;
  if (!firstClient) throw new Error("runtime_config_llm_clients_empty");
  const profileFor = (actorId: number): ResolvedAgentRuntimeProfile => {
    const profile = options.profilesByActor.get(actorId);
    if (!profile) throw new Error(`runtime_config_agent_profile_missing_for_actor:${actorId}`);
    return profile;
  };
  const provider = LlmActionProvider.fromModelClient(options.world, firstClient, {
    clientResolver: (request) => clientByActor.get(request.actorId) ?? firstClient,
    requestConcurrencyScopeResolver: (request) => profileFor(request.actorId).providerName,
    maxConcurrentRequestsResolver: (request) => {
      const profile = profileFor(request.actorId);
      return profile.provider.type === "acp" ? undefined : profile.provider.maxConcurrentRequests;
    },
    personalityPromptResolver: (request) => profileFor(request.actorId).personalityPrompt,
    trace: options.trace,
    fallbackProvider: new BaselineBotActionProvider(options.world),
    maxPromptEvents: 20,
    llmTimeoutMs: options.llmTimeoutMs,
    colorizeLogs: options.colorizeLogs,
    printLlmIo: options.printLlmIo,
    printThinking: options.printThinking,
    boardConfig: options.boardConfig,
  });
  return {
    kind: "llm",
    provider,
    close: async () => undefined,
  };
}

