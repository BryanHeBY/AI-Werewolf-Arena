/**
 * 负责按席位解析的 profile 与只读规则装配 LLM／Pi／ACP 玩家运行时。输入为原 World、板子视图及传输选项；输出为 provider、资源状态和原关闭操作。生产装配使用共同观察回退，不注入特权 Baseline；会话与进程由各 owner 关闭，本工厂不写规则、库存或游戏阶段。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { World } from "../domain/world";
import { ActionProvider } from "../domain/model";
import { AcpActionProvider, AcpProcessClient, LlmActionProvider } from "./agent-exports";
import { AiSdkClient } from "../adapters/llm/ai-sdk-client";
import { PiRuntime } from "../adapters/pi";
import { PiActionProvider } from "../agents/pi/pi-action-provider";
import type { ResolvedAgentRuntimeProfile } from "./config/contracts";

export interface PlayerAgentRuntime {
  kind: "llm" | "acp" | "pi" | "mixed";
  provider: ActionProvider;
  close(): Promise<void>;
  readonly runtimeState: {
    closed: boolean;
    sdk?: LlmActionProvider["runtimeState"];
    acp?: AcpActionProvider["runtimeState"][];
    pi?: PiActionProvider["runtimeState"][];
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

/** 根据统一 profile 创建玩家运行时；调用方无需感知 SDK／Pi／ACP 构造细节。 */
export async function createPlayerAgentRuntime(
  options: PlayerAgentFactoryOptions,
): Promise<PlayerAgentRuntime> {
  const profiles = new Map(
    [...options.profilesByActor].map(([actor, profile]) => [actor, structuredClone(profile)]),
  );
  if (!profiles.size) throw new Error("runtime_config_player_profiles_empty");
  const providerBindings = new Map<string, object>();
  for (const profile of profiles.values()) {
    // ACP 会话选项属于逐 Agent 设置，同一后端允许不同玩家选择不同模式。
    const binding =
      profile.provider.type === "acp"
        ? Object.fromEntries(
            Object.entries(profile.provider).filter(([key]) => key !== "sessionConfigOptions"),
          )
        : profile.provider;
    const previous = providerBindings.get(profile.providerName);
    if (previous && !isDeepStrictEqual(previous, binding))
      throw new Error("runtime_config_provider_binding_inconsistent");
    providerBindings.set(profile.providerName, binding);
  }
  const sdkProfiles = new Map([...profiles].filter(([, profile]) => profile.kind === "llm"));
  const acpProfiles = new Map([...profiles].filter(([, profile]) => profile.kind === "acp"));
  const piProfiles = new Map([...profiles].filter(([, profile]) => profile.kind === "pi"));
  const owned: PlayerAgentRuntime[] = [];
  let sdk: PlayerAgentRuntime | undefined,
    acp: PlayerAgentRuntime | undefined,
    pi: PlayerAgentRuntime | undefined;
  try {
    if (sdkProfiles.size) {
      sdk = createLlmRuntime({ ...options, profilesByActor: sdkProfiles });
      owned.push(sdk);
    }
    if (acpProfiles.size) {
      acp = await createAcpRuntime({ ...options, profilesByActor: acpProfiles });
      owned.push(acp);
    }
    if (piProfiles.size) {
      pi = await createPiRuntime({ ...options, profilesByActor: piProfiles });
      owned.push(pi);
    }
  } catch (error) {
    // 只对已成功返回并登记到 owned 的运行时发起关闭；已收集的关闭拒绝与原初始化错误合并，不回滚目录等既有前缀。
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
    kind: owned.length > 1 ? "mixed" : pi ? "pi" : acp ? "acp" : "llm",
    provider: {
      getAction(request) {
        if (closed) return Promise.reject(new DOMException("player_runtime_closed", "AbortError"));
        const profile = profiles.get(request.actorId);
        const runtime =
          profile?.kind === "llm"
            ? sdk
            : profile?.kind === "acp"
              ? acp
              : profile?.kind === "pi"
                ? pi
                : undefined;
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
        ...(pi ? { pi: pi.runtimeState.pi } : {}),
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
  // 同一 providerName 共用一个 ACP provider；客户端由会话工厂按玩家惰性创建，observer 也按玩家缓存。
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
    if (
      profile.kind !== "llm" ||
      (profile.provider.type !== "openai" && profile.provider.type !== "anthropic") ||
      !profile.model
    ) {
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
      return profile.provider.maxConcurrentRequests;
    },
    personalityPromptResolver: (request) => profileFor(request.actorId).personalityPrompt,
    trace: options.trace,
    displayLocale: options.displayLocale,
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

/** 每个 Pi backend 共享内存模型／认证运行时；玩家 transcript 仍由 provider 按席位独占。 */
async function createPiRuntime(options: PlayerAgentFactoryOptions): Promise<PlayerAgentRuntime> {
  const groups = new Map<string, Map<number, ResolvedAgentRuntimeProfile>>();
  for (const [actor, profile] of options.profilesByActor) {
    if (profile.kind !== "pi" || profile.provider.type !== "pi")
      throw new Error("runtime_config_pi_profile_required");
    const group =
      groups.get(profile.providerName) ?? new Map<number, ResolvedAgentRuntimeProfile>();
    group.set(actor, profile);
    groups.set(profile.providerName, group);
  }
  const providers = new Map<string, PiActionProvider>();
  try {
    for (const [name, profiles] of groups) {
      const first = profiles.values().next().value!;
      if (first.provider.type !== "pi") throw new Error("runtime_config_pi_profile_required");
      const runtime = await PiRuntime.create({
        models: first.provider.models,
        auth: first.provider.auth,
      });
      try {
        providers.set(
          name,
          new PiActionProvider(options.world, {
            runtime,
            settingsResolver: (actorId) => ({ ...profiles.get(actorId)?.piSettings }),
            personalityPromptResolver: (request) =>
              profiles.get(request.actorId)?.personalityPrompt,
            boardConfig: options.boardConfig,
            maxConcurrentRequests: first.provider.maxConcurrentRequests,
            turnTimeoutMs: options.llmTimeoutMs,
            displayLocale: options.displayLocale,
            printLlmIo: options.printLlmIo,
            printThinking: options.printThinking,
            trace: options.trace,
            colorizeLogs: options.colorizeLogs,
          }),
        );
      } catch (error) {
        try {
          await runtime.close();
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], "pi_runtime_initialization_failed");
        }
        throw error;
      }
    }
  } catch (error) {
    const settled = await Promise.allSettled(
      [...providers.values()].map((provider) => provider.close()),
    );
    const failures = settled.flatMap((item) => (item.status === "rejected" ? [item.reason] : []));
    if (failures.length)
      throw new AggregateError([error, ...failures], "pi_runtimes_initialization_failed");
    throw error;
  }
  let closed = false;
  return {
    kind: "pi",
    provider: {
      getAction(request) {
        if (closed) return Promise.reject(new DOMException("player_runtime_closed", "AbortError"));
        const profile = options.profilesByActor.get(request.actorId);
        const provider = profile && providers.get(profile.providerName);
        if (!provider)
          return Promise.reject(
            new Error(`runtime_config_pi_profile_missing_for_actor:${request.actorId}`),
          );
        return provider.getAction(request);
      },
    },
    get runtimeState() {
      return { closed, pi: [...providers.values()].map((provider) => provider.runtimeState) };
    },
    async close() {
      closed = true;
      const settled = await Promise.allSettled(
        [...providers.values()].map((provider) => provider.close()),
      );
      const failures = settled.flatMap((item) => (item.status === "rejected" ? [item.reason] : []));
      if (failures.length) throw new AggregateError(failures, "pi_runtime_close_failed");
    },
  };
}
