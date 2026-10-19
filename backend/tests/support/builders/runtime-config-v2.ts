/**
 * 将既有非配置测试的连接／Agent 字面输入机械展开为 V2 文件结构，保持原传输、预算、人格及故障值。
 * 输入仅为测试显式构造的旧 setup；输出交给真实配置 parser，不自行验证配置、替换模型或计算规则预期。
 * 本构建器不读取文件或认证，不迁移生产配置，不改冻结 fixture 与原行为 oracle。
 */
interface RuntimeFixtureInput {
  providers: { default?: string; items: Record<string, unknown> };
  agents: { default: string; items: Record<string, unknown> };
  game: unknown;
  debugSummary?: unknown;
  environment?: NodeJS.ProcessEnv;
}

function fields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("runtime_config_fixture_object_required");
  return value as Record<string, unknown>;
}

/** 仅挪动测试字段；非法 budget 等原输入仍交生产 parser 拒绝，不能在构建器中修正为合法默认值。 */
export function runtimeConfigV2(input: RuntimeFixtureInput) {
  return {
    backends: {
      schemaVersion: 2,
      items: Object.fromEntries(
        Object.entries(input.providers.items).map(([name, value]) => {
          const {
            maxConcurrentRequests,
            sessionConfigOptions: _agentOptions,
            ...provider
          } = fields(value);
          const acp = provider.type === "acp";
          const { type: _transportType, ...processConfig } = provider;
          return [
            name,
            {
              kind: acp ? "acp" : "llm",
              config: acp ? processConfig : provider,
              ...(maxConcurrentRequests === undefined ? {} : { limits: { maxConcurrentRequests } }),
            },
          ];
        }),
      ),
    },
    agents: {
      schemaVersion: 2,
      default: input.agents.default,
      items: Object.fromEntries(
        Object.entries(input.agents.items).map(([name, value]) => {
          const { kind, provider, customInstructions, ...options } = fields(value);
          const connection = fields(input.providers.items[String(provider)]);
          return [
            name,
            {
              backend: provider,
              options: {
                ...(kind === "acp" && connection.sessionConfigOptions !== undefined
                  ? { sessionConfigOptions: connection.sessionConfigOptions }
                  : {}),
                ...options,
              },
              ...(customInstructions === undefined ? {} : { customInstructions }),
            },
          ];
        }),
      ),
    },
    game: input.game,
    ...(input.debugSummary === undefined ? {} : { debugSummary: input.debugSummary }),
    ...(input.environment === undefined ? {} : { environment: input.environment }),
  };
}
