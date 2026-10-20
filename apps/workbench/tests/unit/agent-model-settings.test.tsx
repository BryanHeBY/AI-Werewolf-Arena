/** 单元测试负责核对 Agent 表单可见语义；以合成公开目录及手写生效值独立断言模型覆盖、缺省和共享 Fast，不使用认证或模型网络。 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentThinkingField, AgentConnectionInfo } from "../../src/client/AgentModelSettings";

test("model-specific thinking is selected and its precedence is explained", () => {
  const html = renderToStaticMarkup(
    <AgentThinkingField
      kind="pi"
      provider="openai"
      model="synthetic"
      models={[]}
      locale="zh-CN"
      onChange={() => {}}
      options={{ defaultThinkingLevel: "low", modelThinkingLevels: { "openai/synthetic": "high" } }}
    />,
  );
  expect(html).toContain('value="high" selected=""');
  expect(html).toContain("优先于默认等级");
  expect(html).toContain("使用 SDK 默认（不指定）");
});
test("reused Codex connection exposes the model request tier and shared concurrency", () => {
  const html = renderToStaticMarkup(
    <AgentConnectionInfo
      locale="zh-CN"
      provider="openai-codex"
      model="test"
      connection={{
        name: "shared",
        kind: "pi",
        maxConcurrentRequests: 2,
        modelTiers: { "openai-codex": { test: "priority" } },
      }}
    />,
  );
  expect(html).toContain("priority");
  expect(html).toContain("共享连接最大并发数");
  expect(html).toContain("连接与认证源码");
  expect(html).not.toContain('type="checkbox"');
});
