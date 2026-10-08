import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const original = JSON.parse(readFileSync(new URL("../fixtures/sample.replay.json", import.meta.url), "utf8"));

test("switches display locale and time zone while keeping playback and seat focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "six_player_mvp" })).toBeVisible();
  await expect(page.getByText("session_frontend_fixture", { exact: false })).toBeVisible();
  await expect(page.getByText("天黑请闭眼", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "下一事件", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await page.getByRole("button", { name: "1号", exact: true }).click();
  await expect(page.getByRole("heading", { name: "与 1 号相关的事件" })).toBeVisible();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Events involving player 1" })).toBeVisible();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await expect(page.locator(".current-event p")).toHaveText("Player 2 is exiled");
  await expect(page.getByRole("button", { name: "Player 2", exact: true })).toHaveClass(/dead/);
  await expect(page.locator(".current-event time")).toHaveText("2026-07-29 00:01:00 [UTC]");
  await page.getByLabel("Display time zone", { exact: true }).selectOption("Asia/Shanghai");
  await expect(page.locator(".current-event time")).toHaveText("2026-07-29 08:01:00 [Asia/Shanghai]");
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await page.getByRole("button", { name: "Clear seat filter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Game timeline", exact: true })).toBeVisible();
  await page.getByLabel("Display language", { exact: true }).selectOption("zh-CN");
  await expect(page.locator(".current-event p")).toHaveText("2号被放逐出局");
  await expect(page.getByRole("heading", { name: "全局对局时间线" })).toBeVisible();
});

test("new replay locale is the default and raw names and speech remain unchanged", async ({ page }) => {
  const replay = { ...original, schemaVersion: 2, meta: { ...original.meta, locale: "en" },
    players: [{ ...original.players[0], name: "茶茶 {role}" }, original.players[1]],
    events: [{ ...original.events[0], type: "day_speech", payload: { actorId: 1, text: "我是绿茶 <b>raw</b> {actor}" } }],
  };
  await page.route("**/api/replay", route => route.fulfill({ json: replay }));
  await page.goto("/");
  await expect(page.getByLabel("Display language", { exact: true })).toHaveValue("en");
  await expect(page.locator(".current-event p")).toHaveText("Player 1 says: 我是绿茶 <b>raw</b> {actor}");
  await expect(page.getByRole("button", { name: "Player 1 · 茶茶 {role}", exact: true })).toBeVisible();
  await page.getByLabel("Display language", { exact: true }).selectOption("zh-CN");
  await expect(page.locator(".current-event p")).toHaveText("1号发言：我是绿茶 <b>raw</b> {actor}");
  await expect(page.getByRole("button", { name: "1号 · 茶茶 {role}", exact: true })).toBeVisible();
  expect(await page.locator(".current-event b").count()).toBe(0);
});

test("load errors and empty state can change language", async ({ page }) => {
  await page.route("**/api/replay", route => route.fulfill({ json: { ...original, schemaVersion: 99 } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "无法打开复盘" })).toBeVisible();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByText("This replay format version is not supported.", { exact: true })).toBeVisible();
  await page.unroute("**/api/replay");
  await page.route("**/api/replay", route => route.fulfill({ status: 404 }));
  await page.reload();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Werewolf replay player" })).toBeVisible();
});

test("choosing only a time zone during load does not override the incoming replay locale", async ({ page }) => {
  let release!: () => void;
  const loaded = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/replay", async route => {
    await loaded;
    await route.fulfill({ json: { ...original, schemaVersion: 2, meta: { ...original.meta, locale: "en" } } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("显示时区", { exact: true }).selectOption("Asia/Shanghai");
  release();
  await expect(page.getByLabel("Display language", { exact: true })).toHaveValue("en");
  await expect(page.getByLabel("Display time zone", { exact: true })).toHaveValue("Asia/Shanghai");
});

test("playing video keeps advancing while display language changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2", { timeout: 5000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("a completed replay with no winner differs from an in-progress replay", async ({ page }) => {
  await page.route("**/api/replay", route => route.fulfill({ json: { ...original, result: { winner: null, reason: "max_days_reached" } } }));
  await page.goto("/");
  await expect(page.locator(".result-chip strong")).toHaveText("无胜者");
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.locator(".result-chip strong")).toHaveText("No winner");
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: explicit personal and relationship victory stays visible for dead winners only at the terminal frame`, async ({ page }) => {
  const victory = JSON.parse(readFileSync(new URL("../fixtures/victory.replay.json", import.meta.url), "utf8"));
  victory.meta.locale = locale;
  await page.route("**/api/replay", route => route.fulfill({ json: victory }));
  await page.goto("/");
  await expect(page.locator(".result-chip strong")).toContainText(locale === "en" ? "personal goal victory" : "个人目标胜利");
  await expect(page.locator(".result-chip strong")).toContainText("scenario_pair");
  await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
  await page.getByRole("button", { name: locale === "en" ? "Next event" : "下一事件", exact: true }).click();
  await expect(page.locator(".seat-grid .winner")).toHaveCount(3);
  await expect(page.getByTestId("composition-winner")).toHaveCount(3);
  await expect(page.getByTestId("composition-victory")).toContainText(locale === "en" ? "Exile settled" : "放逐结算完成");
  await expect(page.getByRole("button", { name: locale === "en" ? "Player 1 · 原名<Alpha>" : "1号 · 原名<Alpha>", exact: true })).toHaveClass(/dead.*winner-seat/);
  await page.getByLabel(locale === "en" ? "Display language" : "显示语言", { exact: true }).selectOption(locale === "en" ? "zh-CN" : "en");
  await expect(page.locator(".seat-grid .winner")).toHaveCount(3);
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: malformed victory never invents an unknown winning player`, async ({ page }) => {
  const victory = JSON.parse(readFileSync(new URL("../fixtures/victory.replay.json", import.meta.url), "utf8"));
  victory.meta.locale = locale; delete victory.result.decision;
  const outcome = { kind: "victory", primary: { kind: "individual", playerId: 999, goalId: "scenario_unknown", winningPlayerIds: [999] }, additional: [], winningPlayerIds: [999] };
  victory.events[1].payload.outcome = outcome;
  await page.route("**/api/replay", route => route.fulfill({ json: victory }));
  await page.goto("/");
  const unknown = locale === "en" ? "Unknown" : "未知";
  await expect(page.locator(".result-chip strong")).toHaveText(unknown);
  await expect(page.locator(".timeline .event p").last()).toHaveText(unknown);
  await page.getByRole("button", { name: locale === "en" ? "Next event" : "下一事件", exact: true }).click();
  await expect(page.locator(".current-event p")).toHaveText(unknown);
  await expect(page.getByTestId("composition-event")).toHaveText(unknown);
  await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
  await expect(page.getByTestId("composition-winner")).toHaveCount(0);
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: an actual wolf-king complete-game archive shows distinct shots and death order`, async ({ page }) => {
  const replay = JSON.parse(readFileSync(new URL("../fixtures/wolf-king.replay.json", import.meta.url), "utf8")); replay.meta.locale = locale;
  await page.route("**/api/replay", route => route.fulfill({ json: replay }));
  await page.goto("/");
  const king = locale === "en" ? "Wolf King 1 shoots player 2" : "1号狼王开枪带走2号";
  const hunter = locale === "en" ? "Hunter 2 shoots player 3" : "2号猎人开枪带走3号";
  await page.locator(".timeline .event").filter({ hasText: king }).click();
  await expect(page.getByTestId("composition-event")).toHaveText(king);
  await expect(page.locator(".seat-grid .dead")).toHaveCount(3); // Night victim 5, exiled 1, shot 2.
  await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
  await page.locator(".timeline .event").filter({ hasText: hunter }).click();
  await expect(page.getByTestId("composition-event")).toHaveText(hunter);
  await expect(page.locator(".seat-grid .dead")).toHaveCount(4);
  await page.locator(".timeline .event").last().click();
  await expect(page.getByTestId("composition-winner")).toHaveCount(5);
  await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: actual White Wolf King archive applies both initial deaths before the Hunter's response`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL("../fixtures/white-wolf-king.replay.json",import.meta.url),"utf8"));replay.meta.locale=locale;
 await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const blast=locale==="en"?"White Wolf King 1 self-destructs and takes player 4":"1号白狼王自爆并带走4号";
 await page.locator(".timeline .event").filter({hasText:blast}).click();await expect(page.getByTestId("composition-event")).toHaveText(blast);
 await expect(page.locator(".seat-grid .dead")).toHaveCount(3);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const shot=locale==="en"?"Hunter 4 shoots player 2":"4号猎人开枪带走2号";
 await page.locator(".timeline .event").filter({hasText:shot}).click();await expect(page.getByTestId("composition-event")).toHaveText(shot);
 await expect(page.locator(".seat-grid .dead")).toHaveCount(4);await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(4);
});

for(const locale of ["zh-CN","en"] as const)for(const miss of [false,true])test(`${locale}/${miss}: actual Knight archive kills exactly its duel loser and then settles the terminal frame`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/${miss?"knight-miss":"knight"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;
 await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const duel=miss?locale==="en"?"Knight 1 duels player 4; the non-wolf target survives and the Knight dies":"1号骑士决斗4号，目标非狼存活，骑士出局":locale==="en"?"Knight 1 duels player 2; the wolf target dies":"1号骑士决斗2号，目标为狼并出局";
 await page.locator(".timeline .event").filter({hasText:duel}).click();await expect(page.getByTestId("composition-event")).toHaveText(duel);
 await expect(page.locator(".seat-grid .dead")).toHaveCount(2);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 await expect(page.getByRole("button",{name:locale==="en"?`Player ${miss?1:2} · Seat ${miss?1:2}`:`${miss?1:2}号 · Seat ${miss?1:2}`,exact:true})).toHaveClass(/dead/);
 await expect(page.getByRole("button",{name:locale==="en"?`Player ${miss?4:1} · Seat ${miss?4:1}`:`${miss?4:1}号 · Seat ${miss?4:1}`,exact:true})).not.toHaveClass(/dead/);
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(5);await expect(page.getByTestId("composition-winner")).toHaveCount(5);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: actual Gravekeeper archive displays private camp feedback at the right night without altering death or terminal winners`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL("../fixtures/gravekeeper.replay.json",import.meta.url),"utf8"));replay.meta.locale=locale;
 await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const first=locale==="en"?"Gravekeeper 8 learns on night 2 that player 1, exiled on day 1, has camp label Werewolves":"8号守墓人在第2夜获知第1日放逐1号的阵营标签：狼人";
 await page.locator(".timeline .event").filter({hasText:first}).click();await expect(page.getByTestId("composition-event")).toHaveText(first);await expect(page.locator(".seat-grid .dead")).toHaveCount(1);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const second=locale==="en"?"Gravekeeper 8 learns on night 3 that player 5, exiled on day 2, has camp label Good":"8号守墓人在第3夜获知第2日放逐5号的阵营标签：好人";
 await page.locator(".timeline .event").filter({hasText:second}).click();await expect(page.getByTestId("composition-event")).toHaveText(second);await expect(page.locator(".seat-grid .dead")).toHaveCount(5);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();
 for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(8);await expect(page.getByTestId("composition-winner")).toHaveCount(8);
});

for(const locale of ["zh-CN","en"] as const)for(const kind of ["gun_blocked","gun_link"] as const)test(`${locale}/${kind}: actual Dreamer archive distinguishes blocked night shots from anonymous real link deaths`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/dreamer-${kind}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const text=kind==="gun_blocked"?locale==="en"?"Player 4 shoots at player 5; night protection blocks the shot":"4号向5号开枪，夜间保护使枪击落空":locale==="en"?"Additional deaths: Player 5":"追加死亡：5号";
 await page.locator(".timeline .event").filter({hasText:text}).click();await expect(page.getByTestId("composition-event")).toHaveText(text);await expect(page.locator(".seat-grid .dead")).toHaveCount(kind==="gun_blocked"?1:3);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
});

for(const locale of ["zh-CN","en"] as const)for(const special of [false,true])test(`${locale}/${special}: actual Beauty archive preserves protected lives and shows a dead winning wolf after the whole exile chain`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/wolf-beauty-${special?"last-god":"blocked"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const text=special?locale==="en"?"Additional deaths: Player 2":"追加死亡：2号":locale==="en"?"Dream protection blocks Wolf Beauty 1's night charm death of player 5":"1号对5号的夜间魅惑牵连被梦保护阻止";
 await page.locator(".timeline .event").filter({hasText:text}).click();await expect(page.getByTestId("composition-event")).toHaveText(text);await expect(page.locator(".seat-grid .dead")).toHaveCount(special?3:2);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(special?1:4);await expect(page.getByTestId("composition-winner")).toHaveCount(special?1:4);
 if(special)await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).toHaveClass(/dead/);
});

for(const locale of ["zh-CN","en"] as const)for(const badge of [false,true])test(`${locale}/${badge}: actual Bear archive gives an anonymous quiet signal after death/shot/badge settlement without changing any seat`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/bear-${badge?"king-badge":"neighbor-update"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const text=locale==="en"?`Day ${badge?1:2}: Bear did not roar`:`第${badge?1:2}天：熊没有咆哮`;await page.locator(".timeline .event").filter({hasText:text}).click();await expect(page.getByTestId("composition-event")).toHaveText(text);await expect(page.locator(".seat-grid .dead")).toHaveCount(badge?2:3);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(badge?5:4);await expect(page.getByTestId("composition-winner")).toHaveCount(badge?5:4);
 if(badge)await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).toHaveClass(/dead/);
});

for(const locale of ["zh-CN","en"] as const)for(const large of [false,true])test(`${locale}/${large}: actual Hidden Wolf inheritance is a private fact followed by a separate real death, without premature winners`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/hidden-wolf-${large?"twelve":"king-link"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const label=locale==="en"?`Hidden Wolf 1 inherits the knife on day ${large?2:1}`:`1号隐狼在第${large?2:1}天获得刀权`;await page.locator(".timeline .event").filter({hasText:label}).click();await expect(page.getByTestId("composition-event")).toHaveText(label);await expect(page.locator(".seat-grid .dead")).toHaveCount(large?4:1);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).not.toHaveClass(/dead/);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(large?8:4);await expect(page.getByTestId("composition-winner")).toHaveCount(large?8:4);await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).toHaveClass(/dead/);
});

for(const locale of ["zh-CN","en"] as const)for(const large of [false,true])test(`${locale}/${large}: actual Gargoyle inheritance is a private fact followed by a separate real death, without premature winners`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/gargoyle-${large?"twelve":"king-link"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");
 const label=locale==="en"?`Gargoyle 1 inherits the knife on day ${large?2:1}`:`1号石像鬼在第${large?2:1}天获得刀权`;await page.locator(".timeline .event").filter({hasText:label}).click();await expect(page.getByTestId("composition-event")).toHaveText(label);await expect(page.locator(".seat-grid .dead")).toHaveCount(large?4:1);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).not.toHaveClass(/dead/);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(large?8:4);await expect(page.getByTestId("composition-winner")).toHaveCount(large?8:4);await expect(page.getByRole("button",{name:locale==="en"?"Player 1 · Seat 1":"1号 · Seat 1",exact:true})).toHaveClass(/dead/);
});
for(const locale of ["zh-CN","en"] as const)test(`${locale}: actual role inspection renders a specific label without changing any seat`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL("../fixtures/gargoyle-twelve.replay.json",import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");const label=locale==="en"?"Player 1 inspects player 5's role: Seer":"1号查验5号的具体角色：预言家";await page.locator(".timeline .event").filter({hasText:label}).click();await expect(page.getByTestId("composition-event")).toHaveText(label);await expect(page.locator(".seat-grid .dead")).toHaveCount(0);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
});
for(const locale of ["zh-CN","en"] as const)for(const large of [false,true])test(`${locale}/${large}: actual Spirit Seer pass/repeat renders privately without killing seats or premature victory`,async({page})=>{
 const replay=JSON.parse(readFileSync(new URL(`../fixtures/psychic-${large?"twelve":"skip"}.replay.json`,import.meta.url),"utf8"));replay.meta.locale=locale;await page.route("**/api/replay",route=>route.fulfill({json:replay}));await page.goto("/");const label=large?(locale==="en"?"Player 5 inspects player 1's role: Werewolf":"5号查验1号的具体角色：狼人"):(locale==="en"?"Player 3 ends the inspection opportunity on night 2: Passed":"3号在第2夜结束查验机会：主动跳过");await page.locator(".timeline .event").filter({hasText:label}).last().click();await expect(page.getByTestId("composition-event")).toHaveText(label);await expect(page.locator(".seat-grid .dead")).toHaveCount(large?5:1);await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
 const caption=await page.getByTestId("composition-caption").boundingBox();expect(caption).not.toBeNull();for(const seat of await page.locator("[data-composition-player]").all()){const box=await seat.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThan(caption!.y);}
 await page.locator(".timeline .event").last().click();await expect(page.locator(".seat-grid .winner")).toHaveCount(large?8:2);await expect(page.getByTestId("composition-winner")).toHaveCount(large?8:2);
});
