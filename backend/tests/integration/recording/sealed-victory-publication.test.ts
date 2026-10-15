/**
 * 文件系统集成测试验证已封盘胜利的清单、公开复盘与清理失败发布。输入为两语结果字面量和临时会话；预期来自序列化成员及脱离副本，不运行模型或完整对局。
 */
import { readReplayManifest } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { Camp, Phase, type GameResult } from "../../../src/domain";
import {
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "@ai-werewolf-arena/game-presentation";
import { getDefaultScriptEventRenderRegistry } from "../../../src/engine/game-api";
import { auditSummaryHeader } from "../../../src/audit/summary-format";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const players = [1, 2, 3, 4, 5, 6].map((id) => ({
  player_id: id,
  role: id === 1 || id === 4 ? "wolf" : "villager",
  camp: id === 1 || id === 4 ? "wolf" : "good",
  alive: id !== 3,
  name: `Raw name ${id}`,
}));

const decision = (
  kind: "faction" | "individual" | "relationship" | "multiple" | "no_winner",
): GameResult => ({
  winner: kind === "faction" ? Camp.Good : null,
  reason: kind === "no_winner" ? "max_days_reached" : "scenario_win",
  outcome:
    kind === "no_winner"
      ? { kind }
      : {
          kind: "victory",
          primary:
            kind === "faction"
              ? { kind, faction: "good", winningPlayerIds: [2, 3, 5, 6] }
              : kind === "relationship"
                ? { kind, groupId: "scenario_pair", winningPlayerIds: [2, 3] }
                : {
                    kind: "individual",
                    playerId: 5,
                    goalId: "scenario_solo",
                    winningPlayerIds: [5],
                  },
          additional:
            kind === "multiple"
              ? [{ kind: "faction", faction: "wolf", winningPlayerIds: [1, 4] }]
              : [],
          winningPlayerIds:
            kind === "faction"
              ? [2, 3, 5, 6]
              : kind === "relationship"
                ? [2, 3]
                : kind === "multiple"
                  ? [1, 4, 5]
                  : [5],
        },
  decidedAt: {
    day: 2,
    phase: kind === "no_winner" ? Phase.Night : Phase.Voting,
    checkpoint: kind === "no_winner" ? "max_days_reached" : "exile_settled",
  },
});

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["faction", "individual", "relationship", "multiple", "no_winner"] as const)
    test(`${locale}/${kind}: actual manifest and public replay preserve a sealed decision independently of cleanup failure`, async () => {
      const root = await createTestTempDirectory("awa-victory-record-"),
        result = decision(kind),
        original = structuredClone(result);
      const manager = await SessionRecordManager.create(
        {
          sessionId: `victory-${locale}-${kind}`,
          board: "scenario_victory",
          locale,
          startedAtIso: "2026-10-08T00:00:00.000Z",
        },
        root,
      );
      manager.recordPublicEvent({
        type: "game_over",
        timestampMs: 1,
        phase: Phase.GameOver,
        day: 2,
        payload: result as unknown as Record<string, unknown>,
      });
      const summary = await manager.finalize({
        endedAtIso: "2026-10-08T00:01:00.000Z",
        winner: result.winner,
        finishReason: "runtime_error",
        gameResult: result,
        players,
      });
      const manifest = readReplayManifest(JSON.parse(
          await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8"),
        )),
        replay = readReplayDocument(
          JSON.parse(await readFile(path.join(manager.sessionDir, "replay.json"), "utf8")),
        );
      expect(manifest.game_result).toEqual(original);
      expect(manifest.finish_reason).toBe("runtime_error");
      expect(replay.result).toEqual({
        winner: original.winner,
        reason: "runtime_error",
        decision: original,
      });
      expect(replay.events[0].payload).toEqual({ ...original });
      const label = outcomeLabel(original.outcome, locale),
        winners = outcomeWinnersLabel(original.outcome, locale),
        point = victoryPointLabel(original.decidedAt, locale);
      const rendered = getDefaultScriptEventRenderRegistry()
        .toLiveRender({ type: "game_over", timestamp: 1, payload: original }, false, locale)
        .map((item) => item.text)
        .join(" ");
      expect(rendered).toContain(label);
      expect(rendered).toContain(winners);
      expect(rendered).toContain(point);
      const audit = auditSummaryHeader(summary.manifest, [], locale).join("\n");
      expect(audit).toContain(label);
      expect(audit).toContain(winners);
      if (kind === "individual" || kind === "relationship" || kind === "multiple")
        expect(label).not.toBe(locale === "en" ? "No winner" : "无获胜方");
      if (original.outcome.kind === "victory") original.outcome.winningPlayerIds.length = 0;
      expect(replay.result.decision).toEqual({ ...result }); // 与其他副本脱离引用共享。
    });
