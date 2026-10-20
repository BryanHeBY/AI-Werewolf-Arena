/** 浏览器测试负责游戏配置语义回归；以手写预算、继承顺序和原始 JSON 为独立预期，核对缺省编辑、换板清理及附加指令预览，不使用真实模型。 */
import { expect, test, type APIRequestContext } from "@playwright/test";

async function saveGame(request: APIRequestContext, name: string, raw: object) {
  const response = await request.put(`/api/documents/games/${name}`, {
    data: { revision: null, text: JSON.stringify(raw) },
  });
  expect(response.ok()).toBe(true);
}
async function defaultAgent(request: APIRequestContext): Promise<string> {
  return (await (await request.get("/api/catalog")).json()).defaultAgent;
}

test("new GUI games disclose and save a full-game budget", async ({ page, request }) => {
  const name = `budget_${Date.now().toString(36)}`;
  await page.goto("/#/games/new");
  await expect(page.getByLabel("最多天数", { exact: true })).toHaveValue("10");
  await expect(page.getByLabel("整局时限（分钟）", { exact: true })).toHaveValue("120");
  await expect(page.getByLabel("单次玩家行动时限（秒）", { exact: true })).toHaveValue("180");
  await expect(page.getByText(/适用于 LLM、Pi 和 ACP/)).toBeVisible();
  await page.getByLabel("配置 ID", { exact: true }).fill(name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  const raw = JSON.parse((await (await request.get(`/api/documents/games/${name}`)).json()).text);
  expect(raw).toMatchObject({ maxDays: 10, maxRuntimeMs: 7_200_000, llmTimeoutMs: 180_000 });
  await expect(page.locator(".config-summary")).toContainText("单次玩家行动时限（秒）180");
  await expect(page.locator(".config-summary")).toContainText("整局时限（分钟）120");
});

test("editing omitted settings shows real defaults and saves only explicit edits", async ({
  page,
  request,
}) => {
  const name = `omitted_${Date.now().toString(36)}`;
  await saveGame(request, name, { board: "six_player_mvp", agent: await defaultAgent(request) });
  await page.goto(`/#/games/${name}/edit`);
  await expect(page.getByLabel("整局时限（分钟）", { exact: true })).toHaveValue("0.5");
  await expect(page.getByLabel("单次玩家行动时限（秒）", { exact: true })).toHaveValue("30");
  await page.locator("summary").filter({ hasText: "高级参数" }).click();
  await expect(page.getByRole("checkbox", { name: "实时事件", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "显示上帝私有事件", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "显示思考", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "显示上帝私有事件", exact: true }).uncheck();
  await page.getByLabel("整局时限（分钟）", { exact: true }).fill("120");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  const raw = JSON.parse((await (await request.get(`/api/documents/games/${name}`)).json()).text);
  expect(raw).toMatchObject({ maxRuntimeMs: 7_200_000, printPrivateEvents: false });
  expect(raw).not.toHaveProperty("llmTimeoutMs");
  expect(raw).not.toHaveProperty("streamEvents");
});

test("changing boards preserves hidden bindings until explicit cleanup makes the draft valid", async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(36),
    boardId = `switch_board_${suffix}`,
    gameId = `switch_game_${suffix}`;
  const template = await (
    await request.get("/api/board-template/twelve_player_wolf_beauty?source=example")
  ).json();
  const boardResponse = await request.put(`/api/documents/boards/${boardId}`, {
    data: { revision: null, text: JSON.stringify({ ...template, id: boardId }) },
  });
  expect(boardResponse.ok()).toBe(true);
  await saveGame(request, gameId, {
    board: boardId,
    agent: await defaultAgent(request),
    roles: { knight: { agent: await defaultAgent(request) } },
    players: { "12": { name: "Keep until confirmed" }, "1": { name: "Keep inside" } },
  });
  await page.goto(`/#/games/${gameId}/edit`);
  await page.getByLabel("选择板子", { exact: true }).selectOption("six_player_mvp");
  const notice = page.getByRole("alert").filter({ hasText: "存在不适用于当前板子的设置" });
  await expect(notice).toContainText("骑士");
  await expect(notice).toContainText("12");
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "JSON 源码", exact: true });
  expect(JSON.parse(await source.inputValue())).toMatchObject({
    roles: { knight: { agent: await defaultAgent(request) } },
    players: { "12": { name: "Keep until confirmed" } },
  });
  await page.getByRole("button", { name: "配置向导", exact: true }).click();
  await page.getByRole("button", { name: "清理这些不适用设置", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "查看游戏配置", exact: true })).toBeVisible();
  const raw = JSON.parse((await (await request.get(`/api/documents/games/${gameId}`)).json()).text);
  expect(raw).toMatchObject({ board: "six_player_mvp", players: { "1": { name: "Keep inside" } } });
  expect(raw).not.toHaveProperty("roles");
  expect(raw.players).not.toHaveProperty("12");
});

test("instruction previews honor agent precedence and clear earlier instructions without certifying later edits", async ({
  page,
  request,
}) => {
  const name = `instructions_${Date.now().toString(36)}`,
    agent = await defaultAgent(request);
  await saveGame(request, name, {
    board: "six_player_mvp",
    agent,
    customInstructions: { text: "Game custom style" },
    roles: { wolf: { customInstructions: { text: "Role custom style" } } },
    players: {
      "1": { name: "Preview player", agent, customInstructions: { text: "Seat custom style" } },
    },
  });
  await page.goto(`/#/games/${name}/edit`);
  await page.locator("summary").filter({ hasText: "预览玩家最终附加指令" }).click();
  await page.getByLabel("假设分配的角色", { exact: true }).selectOption("wolf");
  await page.getByRole("button", { name: "生成指令预览", exact: true }).click();
  const preview = page.getByRole("status");
  await expect(preview).toContainText("座位设置");
  await expect(preview).toContainText("Game custom style");
  await expect(preview).toContainText("Role custom style");
  await expect(preview).toContainText("Seat custom style");
  await page.locator("summary").filter({ hasText: "玩家设置" }).click();
  const player = page.locator(".seat-config").first();
  await player.getByRole("combobox", { name: "自定义指令", exact: true }).selectOption("clear");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(player).toContainText("身份、游戏规则和工具协议保持有效");
  await page.getByRole("button", { name: "生成指令预览", exact: true }).click();
  await expect(preview).toContainText("此玩家没有额外的自定义指令");
  await expect(preview).not.toContainText("Game custom style");
  await player.getByRole("combobox", { name: "自定义指令", exact: true }).selectOption("append");
  await player
    .getByRole("textbox", { name: "自定义指令", exact: true })
    .fill("New unsaved custom style");
  await expect(page.getByRole("status")).toHaveCount(0);
});
