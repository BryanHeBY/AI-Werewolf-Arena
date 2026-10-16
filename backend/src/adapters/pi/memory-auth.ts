/**
 * 负责把 SDK 内置 provider 的认证查询限制到宿主显式注入的凭据。
 * ModelRuntime 1.3 没有 AuthContext 注入参数，因此使用公开 native-provider 注册口绑定局部 context。
 * 不改全局环境/SDK 私有字段；未声明的 provider 不查环境或个人文件，显式 $VAR 配置仍由原生外层解析。
 * deadline 取消只结束调用方等待；排队未开始的修改拒绝，已开始的认证旋转由 settle 真正收尾。
 */
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  InMemoryCredentialStore,
  type ApiKeyCredential,
  type AuthContext,
  type AuthOperationOptions,
  type Credential,
  type CredentialStore,
} from "@earendil-works/pi-ai";

/**
 * 认证值仍只存于 Pi 的公开内存 store；这里只追踪完整排队/提交任务，不复制认证状态。
 * OAuth 刷新可能已经旋转密钥，SDK 因而允许它在调用方取消后继续；关闭必须等这些任务结算。
 */
export class PiMemoryCredentials implements CredentialStore {
  private readonly store = new InMemoryCredentialStore();
  private readonly writes = new Set<Promise<Credential | undefined>>();
  private readonly failures: unknown[] = [];

  read(provider: string, options?: AuthOperationOptions) {
    return this.store.read(provider, options);
  }
  list(options?: AuthOperationOptions) {
    return this.store.list(options);
  }
  delete(provider: string, options?: AuthOperationOptions) {
    return this.store.delete(provider, options);
  }

  modify(
    provider: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    options?: AuthOperationOptions,
  ) {
    let started = false;
    // 不把 caller signal 交给 store 的 race：该 Promise 必须代表真正完成排队、回调和提交。
    const write = this.store.modify(provider, async (current) => {
      options?.signal?.throwIfAborted();
      started = true;
      return fn(current);
    });
    this.writes.add(write);
    void write.then(
      () => this.writes.delete(write),
      (error) => {
        if (started || !options?.signal?.aborted || error !== options.signal.reason)
          this.failures.push(error);
        this.writes.delete(write);
      },
    );
    const signal = options?.signal;
    if (!signal) return write;
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise<Credential | undefined>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      void write.then(
        (result) => {
          signal.removeEventListener("abort", abort);
          resolve(result);
        },
        (error) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
    });
  }

  get pending(): number {
    return this.writes.size;
  }

  async settle(): Promise<void> {
    while (this.writes.size) await Promise.allSettled([...this.writes]);
    const failures = [...new Set(this.failures)];
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "pi_auth_settlement_failed");
  }
}

function referencedEnv(values: string[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const value of values)
    for (const match of value.matchAll(
      /\$(\$|!|\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/g,
    )) {
      const reference = match[1]!;
      if (reference !== "$" && reference !== "!")
        names.add(reference.startsWith("{") ? reference.slice(1, -1) : reference);
    }
  return names;
}

function credentialContext(
  credential?: ApiKeyCredential,
  declared: ReadonlySet<string> = new Set(),
): AuthContext {
  return {
    env: async (name) =>
      credential?.env?.[name] ?? (declared.has(name) ? process.env[name] : undefined),
    fileExists: async () => false,
  };
}

function resolveModelHeaders(
  raw: Record<string, string> | undefined,
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value.replace(
        /\$(\$|!|\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/g,
        (_match, reference: string) => {
          if (reference === "$" || reference === "!") return reference;
          const name = reference.startsWith("{") ? reference.slice(1, -1) : reference;
          const resolved = env?.[name] || process.env[name];
          if (resolved === undefined) throw new Error("pi_header_env_missing");
          return resolved;
        },
      ),
    ]),
  );
}

export function bindPiMemoryAuth(runtime: ModelRuntime, configured: ReadonlySet<string>): void {
  // 全部同步注册后才让异步 availability 继续。每次注册的 cache-only 刷新先 await 内存 store，
  // 于是第一轮 auth 扫描看到的也全是这些封闭 provider，不存在先检查旧宿主认证的窗口。
  for (const provider of runtime.getProviders()) {
    const apiKey = provider.auth.apiKey;
    if (!apiKey) continue;
    // registerNativeProvider 会收回该 ID 的扩展配置；先捕获公开配置中的头和原生 resolver。
    // 其余注册语义封在已组合 provider 内，不能重新退回未封闭的 builtin provider。
    const registration = runtime.getRegisteredProviderConfig(provider.id);
    const rawModelHeaders = new Map(
      registration?.models?.map((model) => [model.id, model.headers]),
    );
    const declared = referencedEnv([
      registration?.apiKey ?? "",
      ...Object.values(registration?.headers ?? {}),
      ...[...rawModelHeaders.values()].flatMap((headers) => Object.values(headers ?? {})),
    ]);
    const mayResolve = (credential?: ApiKeyCredential) =>
      configured.has(provider.id) &&
      (credential !== undefined || registration?.apiKey !== undefined);
    runtime.registerNativeProvider({
      ...provider,
      stream: (model, context, options) =>
        provider.stream(
          model,
          context,
          Object.assign({}, options, {
            headers: {
              ...options?.headers,
              ...resolveModelHeaders(rawModelHeaders.get(model.id), options?.env),
            },
          }),
        ),
      streamSimple: (model, context, options) =>
        provider.streamSimple(model, context, {
          ...options,
          headers: {
            ...options?.headers,
            ...resolveModelHeaders(rawModelHeaders.get(model.id), options?.env),
          },
        }),
      auth: {
        ...provider.auth,
        apiKey: {
          ...apiKey,
          check: async (input) => {
            if (!mayResolve(input.credential)) return undefined;
            const bound = { ...input, ctx: credentialContext(input.credential, declared) };
            if (apiKey.check) return apiKey.check(bound);
            const result = await apiKey.resolve(bound);
            return result ? { type: "api_key", source: result.source } : undefined;
          },
          resolve: async (input) => {
            if (!mayResolve(input.credential)) return undefined;
            return apiKey.resolve({ ...input, ctx: credentialContext(input.credential, declared) });
          },
        },
      },
    });
  }
}
