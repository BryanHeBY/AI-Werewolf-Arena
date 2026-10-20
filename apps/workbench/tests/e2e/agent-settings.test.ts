/** 浏览器测试负责 Agent 新建和编辑的语义回归；以合成连接和手写保存结果为独立预期，核对冲突、思考覆盖及连接筛选，不请求模型或使用个人认证。 */
import { expect, test } from "@playwright/test";

test("native conflicts are explained before a new connection is written", async ({
  page,
  request,
}) => {
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "添加 Agent", exact: true }).click();
  await page.getByRole("button", { name: /OpenAI Compatible/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("native_conflict_probe");
  await page.getByLabel("模型 ID", { exact: true }).fill("synthetic-test");
  await page.getByLabel("API key 或 ${ENV_NAME}", { exact: true }).fill("synthetic-test");
  await page.getByLabel("API 地址", { exact: true }).fill("https://synthetic.invalid/v1");
  await page.getByText("高级参数", { exact: true }).click();
  await page
    .getByLabel("Agent 原生参数（JSON 对象）", { exact: true })
    .fill('{"reasoningEffort":"high"}');
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("原生 JSON 与表单重复声明字段");
  const current = await (await request.get("/api/documents/backends/backends")).json();
  expect(JSON.parse(current.text).items.native_conflict_probe_connection).toBeUndefined();
});

test("editing a Pi model override changes the effective level and excludes incompatible connections", async ({
  page,
  request,
}) => {
  const backend = await (await request.get("/api/documents/backends/backends")).json();
  const connections = JSON.parse(backend.text);
  connections.items.thinking_openai = {
    kind: "pi",
    limits: { maxConcurrentRequests: 4 },
    config: {
      models: { providers: { openai: { models: [{ id: "workbench-custom", reasoning: true }] } } },
      auth: { openai: { type: "api_key", key: "synthetic-test" } },
    },
  };
  connections.items.thinking_anthropic = {
    kind: "pi",
    config: {
      models: {},
      auth: { anthropic: { type: "api_key", key: "synthetic-test" } },
    },
  };
  expect(
    (
      await request.put("/api/documents/backends/backends", {
        data: {
          revision: backend.revision,
          text: JSON.stringify(connections),
        },
      })
    ).ok(),
  ).toBe(true);
  const agentDocument = await (await request.get("/api/documents/agents/agents")).json();
  const agents = JSON.parse(agentDocument.text);
  agents.items.thinking_probe = {
    backend: "thinking_openai",
    options: {
      defaultProvider: "openai",
      defaultModel: "workbench-custom",
      defaultThinkingLevel: "low",
      modelThinkingLevels: { "openai/workbench-custom": "high", "openai/other": "medium" },
    },
  };
  expect(
    (
      await request.put("/api/documents/agents/agents", {
        data: {
          revision: agentDocument.revision,
          text: JSON.stringify(agents),
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/agents");
  await page.getByLabel("已配置 Agent", { exact: true }).selectOption("thinking_probe");
  await expect(page.getByLabel("思考等级", { exact: true })).toHaveValue("high");
  await expect(page.getByText(/当前值来自此模型的 modelThinkingLevels 覆盖/)).toBeVisible();
  await expect(
    page.getByLabel("连接", { exact: true }).locator("option[value='thinking_anthropic']"),
  ).toHaveCount(0);
  await page.getByLabel("思考等级", { exact: true }).selectOption("low");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  const saved = JSON.parse((await (await request.get("/api/documents/agents/agents")).json()).text);
  expect(saved.items.thinking_probe.options).toMatchObject({
    defaultThinkingLevel: "low",
    modelThinkingLevels: { "openai/other": "medium" },
  });
  expect(
    saved.items.thinking_probe.options.modelThinkingLevels["openai/workbench-custom"],
  ).toBeUndefined();
});
