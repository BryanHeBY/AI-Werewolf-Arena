/**
 * 浏览器集成测试负责正向跳转并回看雾鸦连带死亡、救援／保护及手动结局归档。
 * 输入为两语 replay/checkpoint；输出按事件前缀和原席位预期检查夜报、死亡、警徽及终局时点，不重演机制规则。
 */
import { expectReplayCaption } from "../support/replay-caption-expectation";
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
const cases = [
  "normal-linked",
  "normal-saved-dreamer",
  "normal-protected-heal",
  "normal-draw",
  "manual-blast-pre-election",
  "manual-blast-daybreak",
  "manual-blast-speech-gap",
  "manual-blast-pre-vote",
  "manual-blast-raw-target",
  "manual-blast-badge-chain",
  "manual-blast-last-wolf",
  "manual-blast-parallel-raw-loser",
  "manual-blast-parallel-second-gap",
];
for (const variant of cases)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist actual replay frame, night disclosure and rewind/${variant}/${locale}`, async ({
      page,
    }) => {
      const name = `mist-${variant}-${locale}`;
      const replay = readReplayDocument(
        JSON.parse(
          readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}.replay.json`), "utf8"),
        ),
      );
      const cp = JSON.parse(
        readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}.checkpoint.txt`), "utf8"),
      ) as { players: Array<{ id: number; alive: boolean }> };
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const dead = async () =>
        (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
      const expected = (index: number) => {
        const deaths = new Set<number>();
        for (const e of replay.events.slice(0, index + 1)) {
          if (e.type === "night_resolved")
            for (const id of e.payload.deaths as number[]) deaths.add(id);
          if (e.type === "wolf_self_destruct") deaths.add(Number(e.payload.wolfId));
          if (e.type === "voted_out") deaths.add(Number(e.payload.target));
        }
        return [...deaths].sort((a, b) => a - b);
      };
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      const seek = async (frame: number) => {
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
      const compositionDead = async () =>
        page
          .locator("[data-composition-player]")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => Number((n as HTMLElement).style.opacity) < 1)
              .map((n) => Number(n.getAttribute("data-composition-player"))),
          );
      const critical = replay.events.filter((e) =>
        [
          "alchemist_snake_chosen",
          "raven_knife_chosen",
          "mist_knife_drawn",
          "wolf_self_destruct",
          "night_resolved",
          "sheriff_badge_transferred",
          "game_over",
        ].includes(e.type),
      );
      for (const e of critical) {
        const label = eventLabel(
          e,
          locale,
          replay.players.map((p: { player_id: number }) => p.player_id),
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        );
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expectReplayCaption(
          page,
          replay,
          { seq: e.seq, text: label },
          { locale, timeZone: "UTC" },
        );
        expect(await dead()).toEqual(expected(replay.events.findIndex((x) => x.seq === e.seq)));
        expect(await compositionDead()).toEqual(
          expected(replay.events.findIndex((x) => x.seq === e.seq)),
        );
        const frameIndex = input.replay.events.findIndex((x) => x.seq === e.seq);
        await seek(frameIndex * 90 + 45);
        await expectReplayCaption(
          page,
          replay,
          { seq: e.seq, text: label },
          { locale, timeZone: "UTC" },
        );
        expect(await compositionDead()).toEqual(
          expected(replay.events.findIndex((x) => x.seq === e.seq)),
        );
        if (frameIndex > 0) {
          await seek(frameIndex * 90 - 1);
          await expect(page.getByTestId("composition-event")).toHaveAttribute(
            "data-event-seq",
            String(input.replay.events[frameIndex - 1]!.seq),
          );
          const previous = expected(
            replay.events.findIndex((x) => x.seq === input.replay.events[frameIndex - 1]!.seq),
          );
          expect(await dead()).toEqual(previous);
          expect(await compositionDead()).toEqual(previous);
          await seek(frameIndex * 90 + 45);
        }
        if (e.type === "sheriff_badge_transferred") {
          const holder = Number(e.payload.toId);
          expect(
            (
              await page
                .locator(".seat-grid .seat")
                .filter({ has: page.locator(".sheriff") })
                .locator(".seat-number")
                .allTextContents()
            ).map(Number),
          ).toEqual([holder]);
          await expect(page.locator(`[data-composition-player="${holder}"]`)).toContainText(
            locale === "en" ? "Sheriff" : "警长",
          );
        }
        if (e.type !== "game_over")
          await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
      const final = cp.players.filter((p) => !p.alive).map((p) => p.id);
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
      await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      await page.locator(".timeline .event").first().click();
      expect(await dead()).toEqual([]);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      const other = locale === "en" ? "zh-CN" : "en";
      await page.locator(".display-controls select").nth(0).selectOption(other);
      await page.locator(".display-controls select").nth(1).selectOption("UTC");
      expect(await dead()).toEqual([]);
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
      await page.reload();
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
    });
