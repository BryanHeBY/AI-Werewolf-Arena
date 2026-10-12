/**
 * Assembles seat-specific LLM or ACP providers from resolved profiles and readonly rules.
 * Inputs are the original World, bound board view and explicit transport options;
 * outputs are player providers and their owned close operations. This factory retains
 * process/session ownership without writing rules, actor resources or game phases.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { World } from "../core/domain/world";
import { ActionProvider } from "../core/domain/model";
import {
  AcpActionProvider,
  AcpProcessClient,
  BaselineBotActionProvider,
  LlmActionProvider,
} from "../ai";
import { AiSdkClient } from "../ai/integrations/llm/ai_sdk_client";
import type { ResolvedAgentRuntimeProfile } from "./config/contracts";

export interface PlayerAgentRuntime {
  kind: "llm" | "acp" | "mixed";
  provider: ActionProvider;
  close(): Promise<void>;
  readonly runtimeState: {
    closed: boolean;
    sdk?: LlmActionProvider["runtimeState"];
    acp?: AcpActionProvider["runtimeState"][];
  };
}

export interface PlayerAgentFactoryOptions {
  world: World;
  boardConfig: ReadonlyBoardConfig;
  profilesByActor: ReadonlyMap<number, ResolvedAgentRuntimeProfile>;
  acpWorkspaceRoot: string;
  llmTimeoutMs: number;
  trace: boolean;
  displayLocale?: Locale;
  colorizeLogs: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  createAcpUpdateObserver?: (actorId: number) => AcpUpdateObserver | undefined;
}

interface AcpUpdateObserver {
  (update: unknown): void;
  flush?(): void;
}

/** 根据统一 profile 创建玩家运行时；调用方无需感知 SDK/ACP 构造细节。 */
export async function createPlayerAgentRuntime(
  options: PlayerAgentFactoryOptions,
): Promise<PlayerAgentRuntime> {
  const profiles = new Map(
    [...options.profilesByActor].map(([actor, profile]) => [actor, structuredClone(profile)]),
  );
  if (!profiles.size) throw new Error("runtime_config_player_profiles_empty");
  const providerBindings = new Map<string, ResolvedAgentRuntimeProfile["provider"]>();
  for (const profile of profiles.values()) {
    const previous = providerBindings.get(profile.providerName);
    if (previous && !isDeepStrictEqual(previous, profile.provider))
      throw new Error("runtime_config_provider_binding_inconsistent");
    providerBindings.set(profile.providerName, profile.provider);
  }
  const sdkProfiles = new Map([...profiles].filter(([, profile]) => profile.kind === "llm"));
  const acpProfiles = new Map([...profiles].filter(([, profile]) => profile.kind === "acp"));
  const owned: PlayerAgentRuntime[] = [];
  let sdk: PlayerAgentRuntime | undefined, acp: PlayerAgentRuntime | undefined;
  try {
    if (sdkProfiles.size) {
      sdk = createLlmRuntime({ ...options, profilesByActor: sdkProfiles });
      owned.push(sdk);
    }
    if (acpProfiles.size) {
      acp = await createAcpRuntime({ ...options, profilesByActor: acpProfiles });
      owned.push(acp);
    }
  } catch (error) {
    const cleanup = await Promise.allSettled(owned.map((runtime) => runtime.close()));
    const failures = cleanup.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError([error, ...failures], "player_runtime_initialization_failed");
    throw error;
  }
  let closed = false;
  return {
    kind: sdk && acp ? "mixed" : acp ? "acp" : "llm",
    provider: {
      getAction(request) {
        if (closed) return Promise.reject(new DOMException("player_runtime_closed", "AbortError"));
        const profile = profiles.get(request.actorId);
        const runtime = profile?.kind === "llm" ? sdk : profile?.kind === "acp" ? acp : undefined;
        if (!runtime)
          return Promise.reject(
            new Error(`runtime_config_agent_profile_missing_for_actor:${request.actorId}`),
          );
        return runtime.provider.getAction(request);
      },
    },
    get runtimeState() {
      return {
        closed,
        ...(sdk ? { sdk: sdk.runtimeState.sdk } : {}),
        ...(acp ? { acp: acp.runtimeState.acp } : {}),
      };
    },
    async close() {
      closed = true;
      const settled = await Promise.allSettled(owned.map((runtime) => runtime.close()));
      const failures = settled.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length) throw new AggregateError(failures, "player_runtime_close_failed");
    },
  };
}

async function createAcpRuntime(options: PlayerAgentFactoryOptions): Promise<PlayerAgentRuntime> {
  await fs.mkdir(options.acpWorkspaceRoot, { recursive: true });
  const observers = new Map<number, AcpUpdateObserver | undefined>();
  const providers = new Map<string, AcpActionProvider>();
  const groups = new Map<string, Map<number, ResolvedAgentRuntimeProfile>>();
  for (const [actor, profile] of options.profilesByActor) {
    if (profile.kind !== "acp" || profile.provider.type !== "acp")
      throw new Error(`runtime_config_acp_profile_missing_for_actor:${actor}`);
    const group =
      groups.get(profile.providerName) ?? new Map<number, ResolvedAgentRuntimeProfile>();
    group.set(actor, profile);
    groups.set(profile.providerName, group);
  }
  for (const [name, profiles] of groups) {
    const first = profiles.values().next().value!;
    const provider = new AcpActionProvider(options.world, {
      maxConcurrentRequests: first.provider.maxConcurrentRequests,
      sessionFactoryResolver: (actorId) => {
        const profile = profiles.get(actorId);
        if (!profile || profile.provider.type !== "acp")
          throw new Error(`runtime_config_acp_profile_missing_for_actor:${actorId}`);
        if (!observers.has(actorId))
          observers.set(actorId, options.createAcpUpdateObserver?.(actorId));
        return new AcpProcessClient({
          command: profile.provider.command,
          args: [...(profile.provider.args ?? []), ...(profile.spawnArgs ?? [])],
          env: profile.provider.env,
          sessionConfigOptions: profile.provider.sessionConfigOptions,
          initializeTimeoutMs: profile.provider.initializeTimeoutMs,
          cwd: profile.provider.cwd ?? path.join(options.acpWorkspaceRoot, `player-${actorId}`),
          onUpdate: ({ update }) => observers.get(actorId)?.(update),
          onPromptEnd: (actor) => observers.get(actor)?.flush?.(),
        });
      },
      personalityPromptResolver: (request) => profiles.get(request.actorId)?.personalityPrompt,
      boardConfig: options.boardConfig,
      turnTimeoutMs: options.llmTimeoutMs,
      trace: options.trace,
      displayLocale: options.displayLocale,
      colorizeLogs: options.colorizeLogs,
      printLlmIo: options.printLlmIo,
      printThinking: options.printThinking,
      fallbackProvider: new BaselineBotActionProvider(options.world),
    });
    providers.set(name, provider);
  }
  let closed = false;
  return {
    kind: "acp",
    provider: {
      getAction(request) {
        if (closed) return Promise.reject(new DOMException("player_runtime_closed", "AbortError"));
        const profile = options.profilesByActor.get(request.actorId),
          provider = profile && providers.get(profile.providerName);
        if (!provider)
          return Promise.reject(
            new Error(`runtime_config_acp_profile_missing_for_actor:${request.actorId}`),
          );
        return provider.getAction(request);
      },
    },
    get runtimeState() {
      return { closed, acp: [...providers.values()].map((provider) => provider.runtimeState) };
    },
    async close() {
      closed = true;
      const settled = await Promise.allSettled(
        [...providers.values()].map((provider) => provider.close()),
      );
      const failures = settled.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      for (const observer of observers.values())
        try {
          observer?.flush?.();
        } catch (error) {
          failures.push(error);
        }
      if (failures.length) throw new AggregateError(failures, "acp_runtime_close_failed");
    },
  };
}

function createLlmRuntime(options: PlayerAgentFactoryOptions): PlayerAgentRuntime {
  const clientByActor = new Map<number, AiSdkClient>();
  for (const [actorId, profile] of options.profilesByActor) {
    if (profile.kind !== "llm" || profile.provider.type === "acp" || !profile.model) {
      throw new Error(`runtime_config_llm_profile_missing_for_actor:${actorId}`);
    }
    clientByActor.set(
      actorId,
      new AiSdkClient({
        providerType: profile.provider.type,
        providerName: profile.providerName,
        baseURL: profile.provider.baseURL,
        apiKey: profile.provider.apiKey,
        model: profile.model,
        userAgent: profile.provider.userAgent,
        temperature:
          profile.temperature ??
          (profile.reasoningEffort || profile.thinkingEnabled ? undefined : 0.2),
        maxTokens: profile.maxTokens ?? 512,
        reasoningEffort: profile.reasoningEffort,
        thinkingEnabled: profile.thinkingEnabled ?? false,
      }),
    );
  }
  const firstClient = clientByActor.values().next().value as AiSdkClient | undefined;
  if (!firstClient) throw new Error("runtime_config_llm_clients_empty");
  const profileFor = (actorId: number): ResolvedAgentRuntimeProfile => {
    const profile = options.profilesByActor.get(actorId);
    if (!profile) throw new Error(`runtime_config_agent_profile_missing_for_actor:${actorId}`);
    return profile;
  };
  const provider = LlmActionProvider.fromModelClient(options.world, firstClient, {
    clientResolver: (request) => {
      const client = clientByActor.get(request.actorId);
      if (!client)
        throw new Error(`runtime_config_llm_profile_missing_for_actor:${request.actorId}`);
      return client;
    },
    requestConcurrencyScopeResolver: (request) => profileFor(request.actorId).providerName,
    maxConcurrentRequestsResolver: (request) => {
      const profile = profileFor(request.actorId);
      return profile.provider.type === "acp" ? undefined : profile.provider.maxConcurrentRequests;
    },
    personalityPromptResolver: (request) => profileFor(request.actorId).personalityPrompt,
    trace: options.trace,
    displayLocale: options.displayLocale,
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
    close: () => provider.close(),
    get runtimeState() {
      return { closed: provider.runtimeState.closed, sdk: provider.runtimeState };
    },
  };
}
