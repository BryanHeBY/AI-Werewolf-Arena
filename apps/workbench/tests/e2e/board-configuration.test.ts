/** 浏览器测试负责板子 GUI 语义回归；按标准板规则与手写原文断言推荐模板、实际自爆窗口、依赖联动及固定项，仅使用隔离测试目录。 */
import { expect, test, type Page } from "@playwright/test";

async function createBoard(page: Page, id?: string) {
  await page.setExtraHTTPHeaders({
    "x-awa-test-empty-workspace": `board_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  });
  await page.goto("/#/boards");
  await page.getByRole("button", { name: "新建板子", exact: true }).click();
  if (id) await page.getByRole("textbox", { name: "搜索板子或角色", exact: true }).fill(id);
  const card = page
    .locator(".board-card")
    .filter({ has: page.locator("code", { hasText: id ?? /^twelve_player_standard$/ }) });
  await expect(card).toHaveCount(1);
  if (!id) await expect(card.locator("select")).toHaveValue("twelve_player_standard");
  await card.getByRole("button", { name: /选择/ }).click();
  await expect(page.locator(".editor-draft-fields > .form-body > .field-section")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function readSource(page: Page) {
  await page.getByRole("button", { name: "JSON 源码", exact: true }).click();
  const value = JSON.parse(
    await page.getByRole("textbox", { name: "JSON 源码", exact: true }).inputValue(),
  );
  await page.getByRole("button", { name: "配置向导", exact: true }).click();
  await expect(page.locator(".editor-draft-fields > .form-body > .field-section")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  return value;
}

test("new standard board shows one actual self-destruct setting and preserves the template until edited", async ({
  page,
}) => {
  await createBoard(page);
  await expect(page.getByRole("heading", { name: "行动窗口", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "自爆时机", exact: true })).toHaveCount(1);
  await expect(page.getByLabel("放逐投票前", { exact: true })).toBeChecked();
  await expect(page.getByLabel("每位玩家发言间隙", { exact: true })).not.toBeChecked();
  const original = await readSource(page);
  expect(original.mechanisms.selfDestruct.enabledWindows).toEqual(["on_pre_vote"]);
  expect(original.rules.hooks.onDaybreak).toBe(true);
  await page.getByLabel("放逐投票前", { exact: true }).uncheck();
  const disabled = await readSource(page);
  expect(disabled.mechanisms.selfDestruct.enabledWindows).toEqual([]);
  expect(disabled.rules.hooks).toEqual({
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  });
});

test("sheriff dependency and PK edits produce the same rule the GUI describes", async ({
  page,
}) => {
  await createBoard(page, "twelve_player_standard");
  await page
    .getByLabel("警长选举流程", { exact: true })
    .selectOption("awa_nomination_offstage_pk_v1");
  await expect(
    page.getByText("平票处理：PK 后仍平票则无人当选警长", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("放逐投票流程", { exact: true }).selectOption("awa_one_pk_v1");
  await expect(page.getByText("放逐平票：PK 后仍平票则无人出局", { exact: true })).toBeVisible();
  expect((await readSource(page)).mechanisms).toMatchObject({
    sheriff: { tieBreaker: "no_elimination" },
    tieBreaker: { exileVote: "no_elimination" },
  });
  await page.getByLabel("警长票权", { exact: true }).fill("2");
  await page.getByLabel("启用警长", { exact: true }).uncheck();
  await expect(page.getByLabel("警长票权", { exact: true })).toHaveCount(0);
  expect((await readSource(page)).mechanisms.sheriff).toEqual({ enabled: false });
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
});

test("animal board presents fixed constraints and describes the selected bear and puffer policies", async ({
  page,
}) => {
  await createBoard(page, "twelve_player_animal_dream_wait_final");
  await expect(page.getByLabel("警长票权", { exact: true })).toHaveCount(0);
  await expect(page.getByText("警长票权：1.5", { exact: true })).toBeVisible();
  await expect(page.getByLabel("熊咆哮取样时机", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("熊咆哮取样时机：按天亮时存活邻位取样", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/熊在真实天亮完整死亡链后/)).toBeVisible();
  await page.getByLabel("生效票轮", { exact: true }).selectOption("awa_first_ballot_v1");
  await expect(page.getByText(/整局一次反击首轮投给自己的完整原选民/)).toBeVisible();
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("配置检查通过");
});

test("extra gameplay defaults to none and explains the anonymous wall when selected", async ({
  page,
}) => {
  await createBoard(page, "twelve_player_standard");
  const extra = page.getByLabel("额外玩法", { exact: true });
  await expect(extra).toHaveValue("");
  await expect(extra.locator("option:checked")).toHaveText("不开启");
  await extra.selectOption("awa_wall_notes_once_v1");
  await expect(page.getByText(/第一日正常放逐结束后、第二夜开始前触发一次/)).toBeVisible();
  await extra.selectOption("");
  expect((await readSource(page)).mechanisms.eventPack).toBeUndefined();
});
