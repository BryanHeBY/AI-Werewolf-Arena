/**
 * 负责平台向导的浏览器反例。输入合成凭据和拦截的认证回执，输出原生JSON与重试断言。
 * 仅操作浏览器测试独立配置根，不读取本机订阅、不请求真实模型。
 */
import { expect, test } from "@playwright/test";

async function openWizard(page: import("@playwright/test").Page) {
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "添加 Agent", exact: true }).click();
}
test("built-in Pi platforms show optional endpoint defaults and save no implicit override", async ({
  page,
  request,
}) => {
  const platforms = [
    ["OpenAI API", "openai"],
    ["Anthropic API", "anthropic"],
    ["Zhipu Coding Plan", "zai-coding-cn"],
    ["Kimi Coding", "kimi-coding"],
  ];
  for (const [name, provider] of platforms) {
    await openWizard(page);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByLabel("Agent ID", { exact: true })
      .fill(`platform_${provider.replaceAll("-", "_")}`);
    const endpoint = page.getByLabel("API 地址", { exact: true });
    await expect(endpoint).toHaveValue("");
    await expect(endpoint).toHaveAttribute("placeholder", /^https?:\/\//);
    await expect(
      page.getByText("可留空：使用 Pi 内置地址；只有代理或自定义服务才填写覆盖。", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("API key 或 ${ENV_NAME}", { exact: true }).fill("synthetic-platform-key");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已保存");
    const document = await (
      await request.get("/api/documents/backends/backends?reveal=true")
    ).json();
    const backend = JSON.parse(document.text).items[
      `platform_${provider.replaceAll("-", "_")}_connection`
    ];
    expect(backend.config.models.providers).toEqual({});
    expect(backend.config.auth[provider]).toEqual({
      type: "api_key",
      key: "synthetic-platform-key",
    });
  }
});

test("Codex import failure retains its connection and retry completes without a duplicate", async ({
  page,
  request,
}) => {
  let attempts = 0,
    connectionWrites = 0;
  await page.route("**/api/codex-import", (route) => {
    attempts++;
    return route.fulfill({
      status: attempts === 1 ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify(attempts === 1 ? { error: "codex_auth_missing" } : { ok: true }),
    });
  });
  page.on("request", (req) => {
    if (req.method() === "PUT" && req.url().endsWith("/api/documents/backends/backends"))
      connectionWrites++;
  });
  await openWizard(page);
  await page.getByRole("button", { name: /OpenAI Codex/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("codex_retry_synthetic");
  const submit = page.getByRole("button", {
    name: "从本机 Codex 导入订阅认证 + 保存",
    exact: true,
  });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("未找到本地 Codex 认证");
  await expect(page.getByText(/连接已保存并锁定连接字段/)).toBeVisible();
  await submit.click();
  await expect(page.getByRole("status")).toContainText("已保存");
  expect(attempts).toBe(2);
  expect(connectionWrites).toBe(1);
  const document = await (await request.get("/api/documents/agents/agents")).json();
  expect(JSON.parse(document.text).items.codex_retry_synthetic.backend).toBe(
    "codex_retry_synthetic_connection",
  );
});

test("existing agents open as editable profiles and retain native options", async ({
  page,
  request,
}) => {
  await page.goto("/#/agents");
  await expect(page.getByLabel("已配置 Agent", { exact: true })).toBeVisible();
  await page.getByLabel("已配置 Agent", { exact: true }).selectOption("offline");
  await page.getByLabel("模型 ID", { exact: true }).fill("edited-synthetic-model");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  const document = await (await request.get("/api/documents/agents/agents")).json();
  expect(JSON.parse(document.text).items.offline.options).toMatchObject({
    model: "edited-synthetic-model",
    maxTokens: 128,
  });
});

test("Claude Code API setup keeps the isolated launcher and explicit environment", async ({
  page,
  request,
}) => {
  await openWizard(page);
  await page.getByRole("button", { name: /Claude Code ACP/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("claude_api_synthetic");
  await page.getByLabel("Claude Code 认证方式", { exact: true }).selectOption("api");
  await page.getByLabel("API key 或 ${ENV_NAME}", { exact: true }).fill("synthetic-claude-key");
  await page.getByLabel("API 地址", { exact: true }).fill("https://synthetic.invalid/anthropic");
  await page.getByLabel("模型 ID", { exact: true }).fill("synthetic-claude-model");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  const doc = await (await request.get("/api/documents/backends/backends?reveal=true")).json();
  const config = JSON.parse(doc.text).items.claude_api_synthetic_connection.config;
  expect(config.command).toMatch(/configs\.example[\\/]acp[\\/]run-bwrap-acp\.sh$/);
  expect(config.args[0]).toMatch(/claude-agent-acp$/);
  expect(config.env).toMatchObject({
    ACP_AUTH_KIND: "claude",
    ANTHROPIC_AUTH_TOKEN: "synthetic-claude-key",
    ANTHROPIC_BASE_URL: "https://synthetic.invalid/anthropic",
    ANTHROPIC_MODEL: "synthetic-claude-model",
  });
  expect(config.env.ACP_AUTH_SOURCE).toBeUndefined();
  expect(config.env.ACP_ENV_ALLOWLIST).toContain("ANTHROPIC_AUTH_TOKEN");
});
