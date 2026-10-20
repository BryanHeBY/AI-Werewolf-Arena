/** 浏览器端到端测试负责核对平台、板子、游戏、真实 CLI 与回放闭环；合成本机认证和 API 是输入，独立页面断言是预期。 */
import { expect, test } from "@playwright/test";
test("workbench reuses video themes and keeps appearance when opening configuration pages", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const shell = page.locator(".workbench");
  await expect(shell).toHaveAttribute("data-web-theme", "gothic-v1");
  await expect(shell).toHaveCSS("background-color", "rgb(16, 23, 35)");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("workbench-gothic.png"), fullPage: true });
  await page.getByRole("combobox", { name: "网页主题", exact: true }).selectOption("minimal-v1");
  await expect(shell).toHaveCSS("background-color", "rgb(17, 23, 34)");
  await page.getByRole("combobox", { name: "界面明暗", exact: true }).selectOption("day");
  await expect(shell).toHaveCSS("background-color", "rgb(242, 244, 247)");
  await page.getByRole("navigation").getByRole("button", { name: "Agent", exact: true }).click();
  await expect(shell).toHaveAttribute("data-web-theme", "minimal-v1");
  await page.screenshot({
    path: testInfo.outputPath("workbench-minimal-agents.png"),
    fullPage: true,
  });
});
test("configure a game, watch the ANSI log, then open the existing replay workspace", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "配置一桌，开局即看" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "游戏配置", exact: true }).click();
  await page
    .locator('[data-config-id="offline_game"]')
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(page.getByLabel("配置 ID", { exact: true })).toHaveValue("offline_game");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  const game = JSON.parse(await source.inputValue());
  game.customInstructions = { text: "A cheerful local test.", mode: "append" };
  await source.fill(JSON.stringify(game, null, 2));
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始对局", exact: true }).click();
  await expect(page.getByRole("log", { name: "终端日志" })).toBeVisible();
  await expect
    .poll(
      async () => {
        const runs = await (await request.get("/api/runs")).json();
        return runs.some((run: any) => run.recording === "complete");
      },
      { timeout: 25000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "打开回放", exact: true }).click();
  await expect(page.locator(".replay-workspace")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".replay-workspace")).toHaveAttribute("data-web-theme", "gothic-v1");
  const header = page.locator(".replay-workspace > .topbar");
  const headerBounds = await header.boundingBox();
  const subtitleBounds = await header.locator(".subtitle").boundingBox();
  expect(subtitleBounds!.y + subtitleBounds!.height).toBeLessThanOrEqual(
    headerBounds!.y + headerBounds!.height,
  );
  await page.screenshot({ path: testInfo.outputPath("workbench-replay.png"), fullPage: true });
  expect(errors).toEqual([]);
});
test("board discovery and English UI expose the same configuration flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await page.getByRole("button", { name: "新建板子", exact: true }).click();
  await page.getByRole("button", { name: "六人局", exact: true }).click();
  await expect(page.locator(".board-card")).not.toHaveCount(0);
  await page.getByLabel("对局语言", { exact: true }).first().selectOption("en");
  await expect(page.getByRole("heading", { name: "Choose board", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "Agents", exact: true }).click();
  await page.getByRole("button", { name: "Add agent", exact: true }).click();
  await expect(page.getByRole("button", { name: /OpenAI API/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zhipu Coding Plan/ })).toBeVisible();
});

test("platform wizard creates reusable agents and player edits persist in the same JSON", async ({
  page,
  request,
}) => {
  const backend = await (await request.get("/api/documents/backends/backends")).json();
  const endpoint = JSON.parse(backend.text).items.offline.config.baseURL;
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Agent", exact: true }).click();
  await page.getByRole("button", { name: "添加 Agent", exact: true }).click();
  await page.getByRole("button", { name: /OpenAI Compatible/ }).click();
  await page.getByLabel("Agent ID", { exact: true }).fill("browser_agent");
  await page.getByLabel("模型 ID", { exact: true }).fill("offline-model");
  await page.getByLabel("思考等级", { exact: true }).selectOption("low");
  await page.getByLabel(/API key/).fill("synthetic-browser-key");
  await page.getByLabel("API 地址", { exact: true }).fill(endpoint);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "browser_agent", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "游戏配置", exact: true }).click();
  await page
    .locator('[data-config-id="offline_game"]')
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.getByLabel("默认 Agent", { exact: true }).selectOption("browser_agent");
  await page.locator("summary").filter({ hasText: "玩家设置" }).click();
  await page.locator(".seat-config").first().getByLabel("玩家名字（可留空）").fill("Miao");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  const game = await (await request.get("/api/documents/games/offline_game")).json();
  expect(JSON.parse(game.text)).toMatchObject({
    agent: "browser_agent",
    players: { "1": { name: "Miao" } },
  });
  expect(JSON.stringify(await (await request.get("/api/catalog")).json())).not.toContain(
    "synthetic-browser-key",
  );
});

test("a board can be copied with textual rule choices without editing JSON", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await page.getByRole("button", { name: "新建板子", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索板子或角色" }).fill("twelve_player_wolf_beauty");
  await page.locator(".board-card").first().getByRole("button", { name: /选择/ }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill("browser_beauty");
  await page.getByLabel("女巫自救", { exact: true }).selectOption("first_night_only");
  await page.getByRole("button", { name: "另存为", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看板子", exact: true })).toBeVisible();
  const doc = await (await request.get("/api/documents/boards/browser_beauty")).json();
  expect(JSON.parse(doc.text)).toMatchObject({
    id: "browser_beauty",
    roles: { witch: { selfHeal: "first_night_only" } },
  });
});

test("unsaved JSON survives sidebar and browser hash navigation until explicit reload", async ({
  page,
}) => {
  await page.goto("/#/games");
  await page
    .locator('[data-config-id="offline_game"]')
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  const original = await source.inputValue();
  const edited = `${original}\n `;
  await source.fill(edited);
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("先保存当前修改");
  await expect(source).toHaveValue(edited);
  await page.evaluate(() => {
    location.hash = "/agents";
  });
  await expect(page).toHaveURL(/#\/games$/);
  await expect(source).toHaveValue(edited);
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(source).toHaveValue(original);
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已保存的板子", exact: true })).toBeVisible();
});

test("new templates can be reset and connection-only wizard edits have a visible clear action", async ({
  page,
}) => {
  await page.goto("/#/games/new");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  await expect(source).not.toHaveValue("");
  const original = await source.inputValue();
  await source.fill(`${original}\n `);
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(source).toHaveValue(original);
  await page.getByRole("navigation").getByRole("button", { name: "Agent", exact: true }).click();
  await page.getByRole("button", { name: "添加 Agent", exact: true }).click();
  await page.getByLabel("API 地址", { exact: true }).fill("http://local.invalid/v1");
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("先保存当前修改");
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect(page.getByLabel("API 地址", { exact: true })).toHaveValue("");
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已保存的板子", exact: true })).toBeVisible();
});

test("saved lists are read only and games can be created twice, cancelled, then deleted explicitly", async ({
  page,
  request,
}) => {
  await page.goto("/#/games");
  await expect(page.getByRole("heading", { name: "已保存的游戏配置", exact: true })).toBeVisible();
  await expect(page.locator(".editor")).toHaveCount(0);
  await page
    .locator('[data-config-id="offline_game"]')
    .getByRole("button", { name: "查看配置", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  await expect(page.locator(".editor")).toHaveCount(0);
  await page.getByRole("button", { name: "← 游戏配置", exact: true }).click();
  for (const name of ["browser_new_one", "browser_new_two"]) {
    await page.getByRole("button", { name: "创建游戏", exact: true }).click();
    await page.getByLabel("配置 ID", { exact: true }).fill(name);
    await page.getByRole("button", { name: "另存为", exact: true }).click();
    await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
    await expect(page.locator(".config-detail > code")).toHaveText(`games/${name}.json`);
    await page.getByRole("button", { name: "← 游戏配置", exact: true }).click();
  }
  await page.getByRole("button", { name: "创建游戏", exact: true }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill("browser_cancelled");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect((await request.get("/api/documents/games/browser_cancelled")).status()).toBe(404);
  const card = page.locator('[data-config-id="browser_new_one"]');
  await card.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  expect((await request.get("/api/documents/games/browser_new_one")).ok()).toBe(true);
  await card.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-config-id="browser_new_one"]')).toHaveCount(0);
  expect((await request.get("/api/documents/games/browser_new_two")).ok()).toBe(true);
});

test("a save response preserves typing started after submission and catalog refresh preserves the draft", async ({
  page,
}) => {
  await page.goto("/#/games/offline_game/edit");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  const original = await source.inputValue();
  let release!: () => void;
  let received!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const submitted = new Promise<void>((resolve) => (received = resolve));
  await page.route("**/api/documents/games/offline_game", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await source.fill(`${original}\n`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await submitted;
  const newer = `${original}\n  `;
  await source.fill(newer);
  release();
  await expect(page.getByRole("status")).toContainText("当前新增修改尚未保存");
  await expect(source).toHaveValue(newer);
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(source).toHaveValue(newer);
});

test("homepage quick start names the saved game and deletion blocks referenced boards", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "选择已保存的游戏，直接开局", exact: true }),
  ).toBeVisible();
  const game = JSON.parse(
    (await (await request.get("/api/documents/games/offline_game")).json()).text,
  );
  await page.getByRole("navigation").getByRole("button", { name: "板子", exact: true }).click();
  await expect(page.locator(".editor")).toHaveCount(0);
  await page
    .locator(`[data-config-id="${game.board}"]`)
    .getByRole("button", { name: "查看配置", exact: true })
    .click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("offline_game");
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  expect((await request.get(`/api/documents/boards/${game.board}`)).ok()).toBe(true);
});

test("copy a local board, save a game from it, start, replay and delete only that session", async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(36),
    boardName = `browser_workflow_board_${suffix}`,
    gameName = `browser_workflow_game_${suffix}`;
  await page.goto("/#/boards");
  await page
    .locator('[data-config-id="six_player_mvp"]')
    .getByRole("button", { name: "查看配置", exact: true })
    .click();
  await page.getByRole("button", { name: "复制为新配置", exact: true }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill(boardName);
  await page.getByRole("button", { name: "另存为", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看板子", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "创建游戏", exact: true }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill(gameName);
  await page.getByLabel("默认 Agent", { exact: true }).selectOption("offline");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  const raw = JSON.parse(await source.inputValue());
  expect(raw.board).toBe(boardName);
  raw.maxDays = 1;
  raw.maxRuntimeMs = 4000;
  raw.llmTimeoutMs = 1000;
  await source.fill(JSON.stringify(raw, null, 2));
  await page.getByRole("button", { name: "另存为", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始对局", exact: true }).click();
  await expect(page.getByRole("log", { name: "终端日志" })).toBeVisible();
  const sessionId = decodeURIComponent(new URL(page.url()).hash.split("/")[2]);
  await expect
    .poll(
      async () => {
        const runs = await (await request.get("/api/runs")).json();
        return runs.find((run: any) => run.sessionId === sessionId)?.canDelete;
      },
      { timeout: 25000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "打开回放", exact: true }).click();
  await expect(page.locator(".replay-workspace")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect
    .poll(async () =>
      (await (await request.get("/api/runs")).json()).some(
        (run: any) => run.sessionId === sessionId,
      ),
    )
    .toBe(false);
  expect((await request.get(`/api/documents/games/${gameName}`)).ok()).toBe(true);
  expect((await request.get(`/api/documents/boards/${boardName}`)).ok()).toBe(true);
});

test("quick start runs a mixed LLM, Pi and ACP table to a natural good-team victory", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const card = page.locator('[data-config-id="natural_mixed"]');
  await expect(card).toContainText("natural_1");
  await expect(card).toContainText("natural_6");
  await card.getByRole("button", { name: "开始对局", exact: true }).click();
  await expect(page.getByRole("log", { name: "终端日志" })).toBeVisible();
  const sessionId = decodeURIComponent(new URL(page.url()).hash.split("/")[2]);
  await expect
    .poll(
      async () => {
        const runs = await (await request.get("/api/runs")).json();
        const run = runs.find((row: any) => row.sessionId === sessionId);
        return (
          run && { state: run.state, game: run.game, winner: run.winner, recording: run.recording }
        );
      },
      { timeout: 40000 },
    )
    .toEqual({ state: "completed", game: "decided", winner: "good", recording: "complete" });
  await page.getByRole("button", { name: "打开回放", exact: true }).click();
  await expect(page.locator(".replay-workspace")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".replay-workspace")).toContainText("好人");
});

test("a local board can be deleted after confirmation while the source board remains", async ({
  page,
  request,
}) => {
  const name = `browser_delete_board_${Date.now().toString(36)}`;
  await page.goto("/#/boards");
  await page
    .locator('[data-config-id="six_player_mvp"]')
    .getByRole("button", { name: "查看配置", exact: true })
    .click();
  await page.getByRole("button", { name: "复制为新配置", exact: true }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill(name);
  await page.getByRole("button", { name: "另存为", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看板子", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  expect((await request.get(`/api/documents/boards/${name}`)).ok()).toBe(true);
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已保存的板子", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(`[data-config-id="${name}"]`)).toHaveCount(0);
  expect((await request.get("/api/documents/boards/six_player_mvp")).ok()).toBe(true);
});

test("quick start rejects an externally changed game instead of using the stale summary", async ({
  page,
  request,
}) => {
  const saved = await (await request.get("/api/documents/games/offline_game")).json();
  await page.goto("/");
  const card = page.locator('[data-config-id="offline_game"]');
  await expect(card.getByRole("button", { name: "开始对局", exact: true })).toBeEnabled();
  const changed = JSON.stringify({ ...JSON.parse(saved.text), maxDays: 2 });
  const update = await request.put("/api/documents/games/offline_game", {
    data: { revision: saved.revision, text: changed },
  });
  expect(update.ok()).toBe(true);
  await card.getByRole("button", { name: "开始对局", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("config_conflict");
  await expect(page).not.toHaveURL(/#\/logs\//);
  const newest = await update.json();
  expect(
    (
      await request.put("/api/documents/games/offline_game", {
        data: { revision: newest.revision, text: saved.text },
      })
    ).ok(),
  ).toBe(true);
});

test("late board template responses cannot replace the currently edited template", async ({
  page,
  request,
}) => {
  const catalog = await (await request.get("/api/catalog")).json();
  const templates = catalog.boards.filter(
    (board: any) => board.source === "example" && board.supported && board.size === 12,
  );
  const first = templates[0],
    second = templates.find((board: any) => board.id !== first.id);
  expect(second).toBeTruthy();
  let release!: () => void, received!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve)),
    submitted = new Promise<void>((resolve) => (received = resolve));
  await page.route(`**/api/board-template/${first.id}`, async (route) => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await page.goto("/#/boards");
  await page.getByRole("button", { name: "新建板子", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索板子或角色", exact: true }).fill(first.id);
  await page.locator(".board-card").first().getByRole("button", { name: /选择/ }).click();
  await submitted;
  await page.getByRole("textbox", { name: "搜索板子或角色", exact: true }).fill(second.id);
  await page.locator(".board-card").first().getByRole("button", { name: /选择/ }).click();
  await page.getByLabel("配置 ID", { exact: true }).fill("browser_kept_template");
  release();
  await expect(page.getByLabel("配置 ID", { exact: true })).toHaveValue("browser_kept_template");
});

test("reload locks inputs while reading and a stale validation response cannot certify a newer draft", async ({
  page,
}) => {
  await page.goto("/#/games/offline_game/edit");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  await expect(source).not.toHaveValue("");
  const original = await source.inputValue();
  let release!: () => void, received!: () => void;
  let held = new Promise<void>((resolve) => (release = resolve)),
    submitted = new Promise<void>((resolve) => (received = resolve));
  await page.route("**/api/documents/games/offline_game", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await submitted;
  await expect(source).toBeDisabled();
  release();
  await expect(source).toBeEnabled();
  await expect(source).toHaveValue(original);
  held = new Promise<void>((resolve) => (release = resolve));
  submitted = new Promise<void>((resolve) => (received = resolve));
  await page.route("**/api/validate", async (route) => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await submitted;
  await source.fill(`${original}\n `);
  release();
  await expect(page.getByRole("button", { name: "检查配置", exact: true })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("revealing credentials cannot replace a document with an external revision", async ({
  page,
}) => {
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "连接与认证源码", exact: true }).click();
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  await expect(source).not.toHaveValue("");
  const original = await source.inputValue();
  let release!: () => void, received!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve)),
    submitted = new Promise<void>((resolve) => (received = resolve));
  await page.route("**/api/documents/backends/backends?reveal=true", async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    received();
    await held;
    await route.fulfill({ response, json: { ...body, revision: "external-revision" } });
  });
  await page.getByRole("button", { name: "显示密钥", exact: true }).click();
  await submitted;
  await expect(source).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("config_conflict");
  await expect(source).toBeEnabled();
  await expect(source).toHaveValue(original);
});
