/**
 * 浏览器集成测试逐帧验证夜之贵族／觉醒愚者机制的 God 和本人两语归档。
 * 输入为失败翻牌、次夜通知及警徽事件；输出检查各帧披露、仍存活的公开身份和授权最小画面。
 * 原字面预期与归档事件保留，不在测试重算隐匿规则或暴露其他玩家私有身份。
 */
import { expectReplayCaption } from "../support/replay-caption-expectation";
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { test, expect } from "@playwright/test";
import { text } from "@ai-werewolf-arena/game-text";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
import { eventLabel } from "../../src/replay/event-labels";
const load = (name: string, suffix: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}${suffix}`), "utf8"));

for (const locale of ["en", "zh-CN"] as const)
  test(`Noble actual failed reveal retains alive badge without winner ${locale}`, async ({
    page,
  }) => {
    const replay = readReplayDocument(load(`noble-failed-reveal-${locale}`, ".replay.json")),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      id = Number(replay.events.find((e) => e.type === "secret_body_revealed")!.payload.actorId);
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const slider = page.locator('.frame-control input[type="range"]');
    await slider.evaluate(
      (el, frame) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          el,
          String(frame),
        );
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      replayBrowserFrame(replay, (input.replay.events.length - 1) * 90 + 89, {
        locale,
        timeZone: "UTC",
      }),
    );
    const seat = page.locator(`[data-composition-player="${id}"]`);
    await expect(seat).toHaveAttribute("data-player-alive", "true");
    await expect(seat).toContainText(locale === "en" ? "Awakened Village Idiot" : "觉醒愚者");
    await expect(seat.locator("[data-sheriff-badge]")).toHaveAttribute(
      "aria-label",
      locale === "en" ? "Sheriff" : "警长",
    );
    await expect(page.getByTestId("composition-winner")).toHaveCount(0);
    expect(replay.events.some((e) => e.type === "secret_body_reveal_speech")).toBe(false);
  });

for (const locale of ["en", "zh-CN"] as const)
  for (const owner of ["body", "noble"] as const)
    test(`Noble actual owner notices only update on next-night frame ${owner}/${locale}`, async ({
      page,
    }) => {
      const fixture = `noble-expiry-${locale}`,
        god = readReplayDocument(load(fixture, ".replay.json")),
        view = readReplayPlayerView(load(`player-views/${fixture}-${owner}`, ".player.json")),
        events = view.timeline.flatMap((row) =>
          row.kind === "event"
            ? [
                {
                  seq: row.seq,
                  timestamp: row.timestamp!,
                  day: row.day,
                  phase: row.phase,
                  type: row.event.type,
                  payload: row.event.payload,
                },
              ]
            : [],
        ),
        replay = readReplayDocument({
          ...god,
          result: { winner: null, reason: "private_render" },
          players: god.players.map((p) => ({
            ...p,
            role: p.player_id === view.player_id ? view.role : "unknown",
            camp: p.player_id === view.player_id ? view.camp : "unknown",
          })),
          events: events.map((e, i) => ({ ...e, seq: i + 1 })),
        }),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        type = owner === "body" ? "secret_body_night_notified" : "noble_night_notified",
        n3 = input.replay.events.find((e) => e.type === type && e.day === 3)!,
        n4 = input.replay.events.find((e) => e.type === type && e.day === 4)!;
      expect(
        owner === "body"
          ? n3.payload.resource
          : (n3.payload.contracts as Array<{ status: { kind: string } }>)[0]!.status.kind,
      ).toBe(owner === "body" ? "intact" : "pending");
      expect(
        owner === "body"
          ? n4.payload.resource
          : (n4.payload.contracts as Array<{ status: { kind: string } }>)[0]!.status.kind,
      ).toBe(owner === "body" ? "spent" : "expired");
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const slider = page.locator('.frame-control input[type="range"]');
      for (const e of [n3, n4]) {
        const i = input.replay.events.findIndex((x) => x.seq === e.seq);
        await slider.evaluate(
          (el, frame) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              el,
              String(frame),
            );
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          replayBrowserFrame(replay, i * 90 + 45, { locale, timeZone: "UTC" }),
        );
        await expectReplayCaption(
          page,
          replay,
          {
            seq: e.seq,
            text: eventLabel(
              e,
              locale,
              replay.players.map((p) => p.player_id),
              replay.players.map((p: { player_id: number; name?: string }) => ({
                id: p.player_id,
                name: p.name,
              })),
            ),
          },
          { locale, timeZone: "UTC" },
        );
      }
      await slider.evaluate(
        (el, frame) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(frame),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        replayBrowserFrame(
          replay,
          input.replay.events.findIndex((e) => e.seq === n3.seq) * 90 + 45,
          { locale, timeZone: "UTC" },
        ),
      );
      await expectReplayCaption(
        page,
        replay,
        {
          seq: n3.seq,
          text: eventLabel(
            n3,
            locale,
            replay.players.map((p) => p.player_id),
            replay.players.map((p: { player_id: number; name?: string }) => ({
              id: p.player_id,
              name: p.name,
            })),
          ),
        },
        { locale, timeZone: "UTC" },
      );
    });
for (const locale of ["en", "zh-CN"] as const)
  for (const name of ["expiry", "new_and_old_clear", "two_sources", "badge_reveal"] as const)
    test(`Noble actual God critical frame seek and rewind ${name}/${locale}`, async ({ page }) => {
      const fixture = `noble-${name}-${locale}`,
        replay = readReplayDocument(load(fixture, ".replay.json")),
        cp = load(fixture, ".checkpoint.txt"),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const dead = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number),
        expected = (index: number) => {
          const ids = new Set<number>();
          for (const e of replay.events.slice(0, index + 1)) {
            if (e.type === "night_resolved")
              for (const id of e.payload.deaths as number[]) ids.add(id);
            if (e.type === "voted_out" && typeof e.payload.target === "number")
              ids.add(e.payload.target);
          }
          return [...ids].sort((a, b) => a - b);
        },
        seek = async (frame: number) => {
          const slider = page.locator('.frame-control input[type="range"]');
          await slider.evaluate(
            (el, value) => {
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
                el,
                String(value),
              );
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            },
            replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
          );
          await expect(slider).toHaveValue(
            String(replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" })),
          );
        };
      const critical = replay.events.filter((e) =>
        [
          "noble_servant_chosen",
          "noble_contract_closed",
          "secret_body_blocked",
          "secret_body_revealed",
          "secret_body_reveal_speech",
          "night_resolved",
          "sheriff_badge_transferred",
          "game_over",
        ].includes(e.type),
      );
      for (const e of critical) {
        await page
          .locator(".timeline .event")
          .filter({ hasText: `#${e.seq} ·` })
          .click();
        await expectReplayCaption(
          page,
          replay,
          {
            seq: e.seq,
            text: eventLabel(
              e,
              locale,
              replay.players.map((p) => p.player_id),
              replay.players.map((p: { player_id: number; name?: string }) => ({
                id: p.player_id,
                name: p.name,
              })),
            ),
          },
          { locale, timeZone: "UTC" },
        );
        expect(await dead()).toEqual(expected(replay.events.findIndex((x) => x.seq === e.seq)));
        const i = input.replay.events.findIndex((x) => x.seq === e.seq);
        await seek(i * 90 + 45);
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(e.seq),
        );
        if (e.type === "secret_body_revealed") {
          const id = Number(e.payload.actorId);
          await expect(page.locator(`[data-composition-player="${id}"]`)).toHaveAttribute(
            "data-player-alive",
            "true",
          );
          await expect(
            page.locator(`[data-composition-player="${id}"] [data-sheriff-badge]`),
          ).toHaveAttribute("aria-label", locale === "en" ? "Sheriff" : "警长");
        }
        if (i > 0) {
          await seek(i * 90 - 1);
          await expect(page.getByTestId("composition-event")).toHaveAttribute(
            "data-event-seq",
            String(input.replay.events[i - 1]!.seq),
          );
        }
        if (e.type !== "game_over")
          await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
      await seek((input.replay.events.length - 1) * 90 + 89);
      expect(await dead()).toEqual(
        cp.players.filter((p: { alive: boolean }) => !p.alive).map((p: { id: number }) => p.id),
      );
      await seek(0);
      expect(await dead()).toEqual([]);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
    });
for (const locale of ["en", "zh-CN"] as const)
  for (const actor of ["noble", "body", "demon", "pack", "villager"] as const)
    test(`Noble actual authorized movie reveal and badge ${actor}/${locale}`, async ({ page }) => {
      const fixture = `noble-badge_reveal-${locale}`,
        god = readReplayDocument(load(fixture, ".replay.json")),
        view = readReplayPlayerView(load(`player-views/${fixture}-${actor}`, ".player.json")),
        events = view.timeline.flatMap((row) =>
          row.kind === "event"
            ? [
                {
                  seq: row.seq,
                  timestamp: row.timestamp!,
                  day: row.day,
                  phase: row.phase,
                  type: row.event.type,
                  payload: row.event.payload,
                },
              ]
            : [],
        );
      const replay = readReplayDocument({
          ...god,
          result: { winner: null, reason: "private_render" },
          players: god.players.map((p) => ({
            ...p,
            role: p.player_id === view.player_id ? view.role : "unknown",
            camp: p.player_id === view.player_id ? view.camp : "unknown",
          })),
          events: events.map((e, i) => ({ ...e, seq: i + 1 })),
        }),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        reveal = input.replay.events.find((e) => e.type === "secret_body_revealed")!,
        i = input.replay.events.findIndex((e) => e.seq === reveal.seq),
        id = Number(reveal.payload.actorId);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const slider = page.locator('.frame-control input[type="range"]'),
        seat = page.locator(`[data-composition-player="${id}"]`),
        seek = async (frame: number) => {
          await slider.evaluate(
            (el, value) => {
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
                el,
                String(value),
              );
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            },
            replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
          );
          await expect(slider).toHaveValue(
            String(replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" })),
          );
        };
      await seek(i * 90 - 1);
      if (actor !== "body") await expect(seat).toContainText(text(locale, "replay.unknown"));
      await expect(seat).toHaveAttribute("data-player-alive", "true");
      await expect(seat.locator("[data-sheriff-badge]")).toHaveAttribute(
        "aria-label",
        locale === "en" ? "Sheriff" : "警长",
      );
      await seek(i * 90 + 45);
      await expect(seat).toContainText(locale === "en" ? "Awakened Village Idiot" : "觉醒愚者");
      await expect(seat).toHaveAttribute("data-player-alive", "true");
      await expect(seat.locator("[data-sheriff-badge]")).toHaveAttribute(
        "aria-label",
        locale === "en" ? "Sheriff" : "警长",
      );
      await seek(i * 90 - 1);
      if (actor !== "body") await expect(seat).toContainText(text(locale, "replay.unknown"));
      expect(
        replay.events.some(
          (e) =>
            e.type.startsWith("noble_body_") ||
            ["noble_contract_closed", "secret_body_blocked"].includes(e.type),
        ),
      ).toBe(false);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
    });
