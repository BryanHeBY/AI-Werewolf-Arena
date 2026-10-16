/**
 * 负责 Pi 的内存模型/认证容器与会话所有权。
 * 建立过程不发现 home/project 配置，不进行模型目录网络刷新；关闭等待所有建立和会话清理。
 * 宿主只持此句柄，Pi 自己持有完整对话、摘要与认证刷新状态。
 * 建立不另开 deadline；请求取消由会话 signal 处理，close 等待创建、请求和认证物理结算。
 */
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { PiHostConfig, PiSessionOptions } from "./contracts";
import { nativePiCredentials, registerNativePiModels, validatePiHostConfig } from "./native-config";
import { PiSession } from "./pi-session";
import { bindPiMemoryAuth, PiMemoryCredentials } from "./memory-auth";

export class PiRuntime {
  private readonly sessions = new Set<PiSession>();
  private readonly creating = new Set<Promise<PiSession>>();
  private closed = false;
  private closing?: Promise<void>;
  private readonly creationCleanupFailures: unknown[] = [];

  private constructor(
    private readonly sdk: ModelRuntime,
    private readonly providers: ReadonlySet<string>,
    private readonly credentials: PiMemoryCredentials,
  ) {}

  static async create(config: PiHostConfig): Promise<PiRuntime> {
    const validated = validatePiHostConfig(config);
    const credentials = new PiMemoryCredentials();
    for (const [provider, credential] of Object.entries(nativePiCredentials(validated.auth)))
      await credentials.modify(provider, async () => credential);
    const sdk = await ModelRuntime.create({
      credentials,
      modelsPath: null,
      refreshOnCreate: false,
      allowModelNetwork: false,
    });
    const modelsProviders = validated.models.providers as Record<string, unknown> | undefined;
    const providers = new Set([
      ...Object.keys(modelsProviders ?? {}),
      ...Object.keys(validated.auth),
    ]);
    bindPiMemoryAuth(sdk, providers);
    registerNativePiModels(sdk, validated.models);
    // 配置扩展注册会替换 native provider；对最终组合再封闭，不能让同名内置 provider 恢复 ambient auth。
    bindPiMemoryAuth(sdk, providers);
    // registerProvider 自带无网络 availability 更新；显式等待一轮，使建立错误可观察。
    await sdk.refresh({ allowNetwork: false });
    const error = sdk.getError();
    if (error) throw new Error(`pi_model_runtime_invalid: ${error}`);
    return new PiRuntime(sdk, providers, credentials);
  }

  createSession(options: PiSessionOptions): Promise<PiSession> {
    if (this.closed) return Promise.reject(new Error("pi_runtime_closed"));
    let session: PiSession | undefined;
    const creating = PiSession.create(this.sdk, this.providers, options, () => {
      if (session) this.sessions.delete(session);
    }).then(async (created) => {
      session = created;
      this.sessions.add(created);
      if (this.closed) {
        try {
          await created.close();
        } catch (error) {
          this.creationCleanupFailures.push(error);
          throw error;
        }
        throw new Error("pi_runtime_closed");
      }
      return created;
    });
    this.creating.add(creating);
    void creating.then(
      () => this.creating.delete(creating),
      () => this.creating.delete(creating),
    );
    return creating;
  }

  get runtimeState(): {
    closed: boolean;
    sessions: number;
    creating: number;
    pending: number;
    credentialOperations: number;
  } {
    return {
      closed: this.closed,
      sessions: this.sessions.size,
      creating: this.creating.size,
      pending: [...this.sessions].reduce((sum, session) => sum + session.runtimeState.pending, 0),
      credentialOperations: this.credentials.pending,
    };
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closing = (async () => {
      // 建立中的会话观察 closed 后自行关闭；其原始建立失败不冒充清理失败。
      await Promise.allSettled([...this.creating]);
      const results = await Promise.allSettled(
        [...this.sessions].map((session) => session.close()),
      );
      const failures = [
        ...this.creationCleanupFailures,
        ...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
      ];
      try {
        await this.credentials.settle();
      } catch (error) {
        failures.push(error);
      }
      const unique = [...new Set(failures)];
      if (unique.length === 1) throw unique[0];
      if (unique.length) throw new AggregateError(unique, "pi_runtime_close_failed");
    })();
    return this.closing;
  }
}
