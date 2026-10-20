/**
 * 浏览器端到端测试负责首次空目录的 GUI 配置闭环；输入合成认证与 localhost 模型，独立核对 Agent、板子、游戏的保存与重载。
 * 不导入占位配置，不读取个人认证、不调用真实模型；反例覆盖缺少 Agent、非法 ID 和默认 Agent 的保留。
 */
import { expect, test } from "@playwright/test";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";

test("empty workspace guides agent setup and disables game save until an agent exists", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-awa-test-empty-workspace": `missing_${Date.now().toString(36)}`,
  });
  await page.goto("/#/games/new");
  await expect(page.getByRole("alert")).toContainText("还没有配置 Agent");
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "检查配置", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "配置 Agent", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agent", exact: true })).toBeVisible();
  await expect(page.getByText("还没有配置 Agent", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "补充缺失的示例配置", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "配置 Agent", exact: true }).click();
  await expect(page.getByRole("button", { name: /Zhipu Coding Plan/ })).toBeVisible();
  // 空连接源码也能打开；没有 Agent 不应被误判为配置文件不存在。
  await page.getByRole("button", { name: "连接与认证源码", exact: true }).click();
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "JSON 源码", exact: true })).toHaveValue(
    /schemaVersion/,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("对局语言", { exact: true }).selectOption("en");
  await page.goto("/#/games/new");
  await expect(page.getByRole("alert")).toContainText("No agents are configured yet");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
});

test("a new machine can create agents, a board and a game through the GUI, reload them and launch", async ({
  page,
  request,
}, testInfo) => {
  const headers = { "x-awa-test-empty-workspace": `flow_${Date.now().toString(36)}` };
  const offline = JSON.parse(
    (await (await request.get("/api/documents/backends/backends")).json()).text,
  ).items.offline.config.baseURL;
  await page.setExtraHTTPHeaders(headers);
  const read = async (kind: string, name: string) => {
    const response = await request.get(`/api/documents/${kind}/${name}`, { headers });
    expect(response.ok()).toBe(true);
    return JSON.parse((await response.json()).text);
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const setup = page.getByRole("region", { name: "开局前的配置", exact: true });
  await expect(setup).toContainText("待配置");
  await expect(setup.getByRole("button", { name: /新建游戏配置/ })).toBeDisabled();
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "配置 Agent", exact: true }).click();
  await page.getByRole("button", { name: /OpenAI API/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("first_pi");
  await page.getByLabel("API key 或 ${ENV_NAME}", { exact: true }).fill("synthetic-first-pi-key");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  expect(await read("agents", "agents")).toMatchObject({
    default: "first_pi",
    items: { first_pi: { backend: "first_pi_connection" } },
  });
  // 第二个 Agent 使用本机合成 API，后续真实 CLI 不会连接任何计费服务。
  await page.getByRole("button", { name: /OpenAI Compatible/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("first_local");
  await page.getByLabel("模型 ID", { exact: true }).fill("offline-model");
  await page
    .getByLabel("API key 或 ${ENV_NAME}", { exact: true })
    .fill("synthetic-first-local-key");
  await page.getByLabel("API 地址", { exact: true }).fill(offline);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "first_local", exact: true })).toBeVisible();
  expect((await read("agents", "agents")).default).toBe("first_pi");
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(page.locator(".connection-test")).toContainText("连接成功，已收到模型回复");
  await page.reload();
  await expect(page.getByLabel("已配置 Agent", { exact: true })).toContainText("first_local");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button", { name: "对局", exact: true }).click();
  await expect(page.locator(".hero").getByRole("button", { name: /新建板子/ })).toBeVisible();
  await expect(setup.locator("li").nth(0)).toContainText("已保存");
  await expect(setup.locator("li").nth(1)).toContainText("待配置");
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await page.getByRole("button", { name: "新建板子", exact: true }).click();
  await page
    .getByRole("textbox", { name: "搜索板子或角色", exact: true })
    .fill("twelve_player_standard");
  await page.locator(".board-card").first().getByRole("button", { name: /选择/ }).click();
  const save = page.getByRole("button", { name: "保存", exact: true });
  await expect(save).toBeInViewport();
  await page.getByLabel("配置 ID", { exact: true }).fill("猫娘 板.json");
  await expect(page.getByLabel("配置 ID", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(save).toBeDisabled();
  await expect(page.locator(".editor-footer")).toContainText("小写英文字母");
  await page.getByLabel("配置 ID", { exact: true }).fill("first_board");
  await page.getByLabel("女巫自救", { exact: true }).selectOption("first_night_only");
  await expect(save).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("board-save-action.png") });
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
  await save.click();
  await expect(page.getByRole("heading", { name: "查看板子", exact: true })).toBeVisible();
  expect(await read("boards", "first_board")).toMatchObject({
    id: "first_board",
    roles: { witch: { selfHeal: "first_night_only" } },
  });
  await page.reload();
  await page
    .locator('[data-config-id="first_board"]')
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(page.getByLabel("女巫自救", { exact: true })).toHaveValue("first_night_only");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "对局", exact: true }).click();
  const steps = page.getByRole("region", { name: "开局前的配置", exact: true });
  await expect(steps.locator("li").nth(0)).toContainText("已保存");
  await expect(steps.locator("li").nth(1)).toContainText("已保存");
  await expect(steps.getByRole("button", { name: /新建游戏配置/ })).toBeEnabled();
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await page
    .locator('[data-config-id="first_board"]')
    .getByRole("button", { name: "查看配置", exact: true })
    .click();
  await page.getByRole("button", { name: "创建游戏", exact: true }).click();
  await expect(page).toHaveURL(/#\/games\/new$/);
  await page.getByLabel("配置 ID", { exact: true }).fill("first_game");
  await page.getByLabel("选择板子", { exact: true }).selectOption("first_board");
  await page.getByLabel("默认 Agent", { exact: true }).selectOption("first_local");
  await page.locator("summary").filter({ hasText: "玩家设置" }).click();
  await page.locator(".seat-config").first().getByLabel("玩家名字（可留空）").fill("小喵");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  const game = JSON.parse(await source.inputValue());
  expect(game).toMatchObject({
    board: "first_board",
    agent: "first_local",
    players: { "1": { name: "小喵" } },
  });
  await source.fill(
    JSON.stringify({ ...game, maxDays: 1, maxRuntimeMs: 4000, llmTimeoutMs: 1000 }),
  );
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
  await save.click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/games\/first_game$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← 游戏配置", exact: true }).click();
  const card = page.locator('[data-config-id="first_game"]');
  await expect(card).toContainText("first_local");
  await card.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByLabel("默认 Agent", { exact: true })).toHaveValue("first_local");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "开始对局", exact: true }).click();
  await expect(page.getByRole("log", { name: "终端日志", exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        const runs: SessionEntry[] = await (await request.get("/api/runs", { headers })).json();
        return runs.some((run) => run.gameName === "first_game" && run.recording === "complete");
      },
      { timeout: 25000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "打开回放", exact: true }).click();
  await expect(page.locator(".replay-workspace")).toBeVisible();
  expect(errors).toEqual([]);
});
