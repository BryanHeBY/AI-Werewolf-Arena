/**
 * 单元组件测试验证恶夜骑士两语查验和枪政策归档。输入为 replay、checkpoint 及十二份玩家档；
 * 输出检查查验不提前伤害、本人报告受众、终局席位／胜者及静态帧。字面数量与归档对照分别保留，不运行游戏或模型。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
const kinds = ["night_immune_wolf", "shot_bypass_good", "day_shot_good"] as const;
const load = (name: string): unknown =>
  JSON.parse(readFileSync(frontendFixtureURL("frontend/tests/fixtures/" + name), "utf8"));
for (const kind of kinds)
  for (const locale of ["zh-CN", "en"] as const) {
    test(`evil knight ${kind}/${locale}: real archive, private reports and exact final checkpoint`, () => {
      const prefix = `evil-knight-${kind}-${locale}`;
      const raw = load(prefix + ".replay.json"),
        before = structuredClone(raw);
      const replay = readReplayDocument(raw);
      const checkpoint = load("checkpoints/" + prefix + ".json") as {
        complete: boolean;
        players: { id: number; alive: boolean }[];
        snapshot: { result: { outcome: { winningPlayerIds: number[] } } };
      };
      const views = load("player-views/" + prefix + ".json") as unknown[];
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(checkpoint.complete).toBe(true);
      expect(final.players.map((p) => ({ id: p.playerId, alive: p.alive }))).toEqual(
        checkpoint.players.map((p) => ({ id: p.id, alive: p.alive })),
      );
      expect(
        final.players
          .filter((p) => p.isWinner)
          .map((p) => p.playerId)
          .sort((a, b) => a - b),
      ).toEqual([...checkpoint.snapshot.result.outcome.winningPlayerIds].sort((a, b) => a - b));
      expect(final.players.filter((p) => p.isWinner)).toHaveLength(
        kind === "night_immune_wolf" ? 4 : 8,
      );
      expect(final.players.filter((p) => !p.alive)).toHaveLength(
        kind === "night_immune_wolf" ? 4 : 6,
      );
      const knight = final.players.find((p) => p.role === "evil_knight");
      expect(knight?.alive).toBe(kind === "night_immune_wolf");
      const reports = replay.events.filter((e) => e.type === "seer_checked");
      expect(reports).toHaveLength(kind === "night_immune_wolf" ? 1 : 2);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      for (const report of reports) {
        const index = replay.events.indexOf(report);
        expect(buildReplaySnapshot(replay, index).players).toEqual(
          buildReplaySnapshot(replay, index - 1).players,
        );
        const label = eventLabel(report, locale);
        expect(label).not.toBe(locale === "en" ? "Unknown" : "未知");
        if (locale === "en") expect(label).not.toMatch(/[\u3400-\u9fff]/);
        const frame =
          input.replay.events.findIndex((e) => e.seq === report.seq) * FRAMES_PER_EVENT + 10;
        expect(buildReplayFrame(input, frame).label).toBe(label);
        const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(markup).toContain(label.replaceAll("'", "&#x27;"));
        expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      }
      expect(views).toHaveLength(12);
      const ids: number[] = [];
      for (const rawView of views) {
        const view = readReplayPlayerView(rawView);
        ids.push(view.player_id);
        const own = view.timeline.flatMap((row) =>
          row.kind === "event" && row.event.type === "seer_checked" ? [row.event.payload] : [],
        );
        const expected = reports.filter((e) => e.payload.actorId === view.player_id);
        expect(own).toEqual(expected.map((e) => e.payload));
        expect(own).toHaveLength(view.role === "seer" ? reports.length : 0);
      }
      expect(ids.sort((a, b) => a - b)).toEqual(
        checkpoint.players.map((p) => p.id).sort((a, b) => a - b),
      );
      expect(raw).toEqual(before);
    });
  }
