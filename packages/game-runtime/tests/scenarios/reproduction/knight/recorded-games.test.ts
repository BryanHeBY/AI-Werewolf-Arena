/**
 * 复现场景测试负责骑士完整录制对局的决斗窗口、命中／落空与死亡链时点。输入为原枚举窗口矩阵、额外落空／狼王／白狼王／十二人计划、传输和语言。
 * 输出用字面决斗载荷、存活、遗言、检查点和胜者断言核对；用例生成及声明的原预期保持。
 */
import type { VictoryPoint } from "@ai-werewolf-arena/game-contract";
import { Camp, DeathCause, KnightDuelWindow, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import {
  knightScenario,
  type KnightScenario,
} from "../../../support/features/knight/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const cases: Array<[KnightScenario, KnightDuelWindow]> = Object.values(KnightDuelWindow).map(
  (window) => ["hit", window],
);
for (const kind of ["miss", "last_god_miss", "king_hit", "white_hit", "twelve"] as KnightScenario[])
  cases.push([
    kind,
    kind === "last_god_miss" ? KnightDuelWindow.BeforeSpeeches : KnightDuelWindow.AfterSpeeches,
  ]);
for (const [kind, window] of cases)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${window}/${transport}: actual bilingual Knight complete games preserve literal results, words and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(knightScenario(kind, window), transport, locale);
        runs.push(run);
        const events = run.replay.events;
        const actor = kind === "twelve" ? 7 : 1,
          target = kind === "miss" ? 4 : kind === "last_god_miss" ? 3 : kind === "twelve" ? 1 : 2,
          miss = kind === "miss" || kind === "last_god_miss";
        expect(
          events.filter((event) => event.type === "knight_duel").map((event) => event.payload),
        ).toEqual([{ actorId: actor, targetId: target, result: miss ? "not_wolf" : "wolf" }]);
        expect(
          events.filter(
            (event) =>
              event.type === "hunter_shot" ||
              event.type === "wolf_king_shot" ||
              event.type === "white_wolf_king_self_destruct",
          ),
        ).toEqual([]);
        const winners =
          kind === "twelve"
            ? [5, 6, 7, 8, 9, 10, 11, 12]
            : kind === "last_god_miss"
              ? [2]
              : [1, 3, 4, 5, 6];
        const point: VictoryPoint = {
          day: kind === "twelve" ? 3 : 1,
          phase: kind === "miss" || kind === "twelve" ? Phase.Voting : Phase.Day,
          checkpoint: kind === "miss" || kind === "twelve" ? "exile_settled" : "day_interrupted",
        };
        const faction = kind === "last_god_miss" ? Camp.Wolf : Camp.Good,
          reason = kind === "last_god_miss" ? "slaughter_side_completed" : "all_wolves_eliminated";
        expect(run.result.snapshot.result).toEqual({
          winner: faction,
          reason,
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: point,
        });
        expect(
          run.manifest.players.filter((player) => player.alive).map((player) => player.player_id),
        ).toEqual(
          kind === "twelve"
            ? [6, 8, 9, 10, 11, 12]
            : kind === "miss"
              ? [3, 4, 6]
              : kind === "last_god_miss"
                ? [2, 3, 4, 6]
                : [1, 3, 4, 6],
        );
        expect(
          events
            .filter((event) => event.type === "last_words_spoken")
            .map((event) => event.payload.playerId),
        ).toEqual(
          kind === "twelve"
            ? [2, 3]
            : kind === "miss"
              ? [5, 1, 2]
              : kind === "last_god_miss"
                ? [5, 1]
                : [5],
        );
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        expect(
          run.record.checkpoints.at(-1)!.players.find((player) => player.id === actor)!.privateState
            .knight,
        ).toEqual({ canDuel: false });
        expect(
          (run.rejected.get(actor) ?? 0) +
            (run.acpTraces.find((item) => item.actor === actor)?.trace.rejected ?? 0),
        ).toBe(1);
        if (kind === "miss" || kind === "last_god_miss") {
          expect(
            events
              .filter((event) => event.type === "sheriff_badge_transferred")
              .map((event) => [event.payload.fromId, event.payload.toId]),
          ).toEqual(
            kind === "miss"
              ? [
                  [1, 2],
                  [2, 3],
                ]
              : [[1, 2]],
          );
          expect(
            events.findIndex(
              (event) => event.type === "last_words_spoken" && event.payload.playerId === 1,
            ),
          ).toBeLessThan(events.findIndex((event) => event.type === "sheriff_badge_transferred"));
        }
        if (kind !== "miss" && kind !== "twelve")
          expect(events.some((event) => event.type === "vote_cast")).toBe(false);
        if (kind === "hit")
          expect(events.filter((event) => event.type === "day_speech").length).toBe(
            window === KnightDuelWindow.BeforeSpeeches
              ? 0
              : window === KnightDuelWindow.BetweenSpeeches
                ? 1
                : 5,
          );
        if (kind === "hit" && window === KnightDuelWindow.AfterSpeeches && transport === "llm")
          await writeFile(`/tmp/awa-p5-knight-${locale}.replay.json`, JSON.stringify(run.replay));
        if (kind === "miss" && transport === "llm")
          await writeFile(
            `/tmp/awa-p5-knight-miss-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
