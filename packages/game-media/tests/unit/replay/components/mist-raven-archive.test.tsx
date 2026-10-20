/**
 * 组件单元测试负责雾鸦归档的复盘展示。输入为既有录制／字面事件、游标、语言和 frame 设置，输出保持原席位、时间线及画面断言。
 * 手写可见性／状态预期与不可变归档为独立 oracle，不运行真实对局或模型传输。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readReplayDocument,
  readReplayPlayerView,
  type ReplayDocument,
} from "@ai-werewolf-arena/replay-contract";
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";

const normal = ["linked", "saved-dreamer", "protected-heal", "draw"] as const;
const manual = [
  "blast-pre-election",
  "blast-daybreak",
  "blast-speech-gap",
  "blast-pre-vote",
  "blast-raw-target",
  "blast-badge-chain",
  "blast-last-wolf",
  "blast-parallel-raw-loser",
  "blast-parallel-second-gap",
] as const;
const load = (name: string, suffix: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}${suffix}`), "utf8"));
const dead = (snapshot: ReturnType<typeof buildReplaySnapshot>) =>
  snapshot.players.filter((p) => !p.alive).map((p) => p.playerId);
for (const locale of ["en", "zh-CN"] as const)
  for (const name of [
    ...normal.map((v) => `mist-normal-${v}-${locale}`),
    ...manual.map((v) => `mist-manual-${v}-${locale}`),
  ])
    test(`Mist actual god archive announcement boundaries, frame and rewind/${name}`, () => {
      const replay = readReplayDocument(load(name, ".replay.json"));
      const checkpoint = load(name, ".checkpoint.txt") as {
        players: Array<{ id: number; alive: boolean; badge?: { isSheriff: boolean } }>;
        snapshot: { result: SealedVictoryResult };
      };
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      for (const event of replay.events.filter(
        (e) =>
          [
            "night_resolved",
            "wolf_self_destruct",
            "sheriff_badge_transferred",
            "sheriff_badge_destroyed",
            "game_over",
          ].includes(e.type) ||
          e.type.startsWith("alchemist_") ||
          e.type.startsWith("raven_") ||
          e.type === "mist_knife_drawn",
      )) {
        const index = replay.events.findIndex((e) => e.seq === event.seq),
          before = buildReplaySnapshot(replay, index - 1),
          after = buildReplaySnapshot(replay, index);
        if (event.type === "night_resolved") {
          const deaths = event.payload.deaths as number[];
          expect(deaths.every((id) => !dead(before).includes(id))).toBe(true);
          expect(dead(after)).toEqual(
            [...new Set([...dead(before), ...deaths])].sort((a, b) => a - b),
          );
        } else if (
          event.type.startsWith("alchemist_") ||
          event.type.startsWith("raven_") ||
          event.type === "mist_knife_drawn"
        ) {
          expect(
            readReplayEvent(
              event,
              replay.players.map((p) => p.player_id),
            )?.effects,
          ).toEqual([]);
          expect(after.players).toEqual(before.players);
        }
        if (event.type === "sheriff_badge_transferred") {
          expect(before.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([
            Number(event.payload.fromId),
          ]);
          expect(after.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([
            Number(event.payload.toId),
          ]);
        }
        const frameIndex = input.replay.events.findIndex((e) => e.seq === event.seq);
        expect(frameIndex).toBeGreaterThanOrEqual(0);
        for (const offset of [0, 45, 89])
          expect(buildReplayFrame(input, frameIndex * FRAMES_PER_EVENT + offset).snapshot).toEqual(
            after,
          );
        if (frameIndex > 0)
          expect(
            buildReplayFrame(input, frameIndex * FRAMES_PER_EVENT - 1).snapshot.players,
          ).toEqual(before.players);
        if (event.type !== "game_over") expect(after.decision).toBeNull();
      }
      const last = buildReplayFrame(
        input,
        (input.replay.events.length - 1) * FRAMES_PER_EVENT + 89,
      );
      expect(dead(last.snapshot)).toEqual(
        checkpoint.players.filter((p) => !p.alive).map((p) => p.id),
      );
      expect(last.snapshot.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual(
        checkpoint.players.filter((p) => p.badge?.isSheriff).map((p) => p.id),
      );
      expect(last.snapshot.decision).toEqual(checkpoint.snapshot.result);
      const first = buildReplayFrame(input, 0);
      expect(dead(first.snapshot)).toEqual([]);
      expect(first.snapshot.decision).toBeNull();
      expect(buildReplayFrame(input, 0)).toEqual(first);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={0} />);
      expect(markup).not.toContain("undefined");
    });

for (const { kind, variant } of [
  ...normal.map((variant) => ({ kind: "normal" as const, variant })),
  ...manual.map((variant) => ({ kind: "manual" as const, variant })),
])
  for (const locale of ["en", "zh-CN"] as const)
    for (const actor of ["alchemist", "raven", "pack", "villager"] as const)
      test(`Mist real player archive authorized facts and minimal frame/${variant}/${actor}/${locale}`, () => {
        const name = `mist-${kind}-${variant}-${locale}`,
          god = readReplayDocument(load(name, ".replay.json"));
        const view = readReplayPlayerView(load(`player-views/${name}-${actor}`, ".player.json"));
        const events = view.timeline.flatMap((row) =>
          row.kind === "event"
            ? [
                {
                  seq: row.seq,
                  timestamp: row.timestamp!,
                  phase: row.phase,
                  day: row.day,
                  type: row.event.type,
                  payload: row.event.payload,
                },
              ]
            : [],
        );
        if (actor !== "alchemist")
          expect(events.filter((e) => e.type.startsWith("alchemist_"))).toHaveLength(0);
        if (actor !== "raven")
          expect(events.filter((e) => e.type.startsWith("raven_"))).toHaveLength(0);
        if (actor === "villager")
          expect(
            events.filter(
              (e) =>
                (e.type.startsWith("wolf_") && e.type !== "wolf_self_destruct") ||
                e.type === "mist_knife_drawn",
            ),
          ).toHaveLength(0);
        if (actor === "raven") {
          const unseal = events.findIndex((e) => e.type === "raven_unsealed");
          expect(unseal).toBeGreaterThanOrEqual(0);
          expect(events[unseal]!.payload.knownTeammateIds).toEqual(
            kind === "normal"
              ? variant === "protected-heal"
                ? []
                : [5]
              : variant.startsWith("blast-parallel")
                ? [12]
                : variant === "blast-last-wolf"
                  ? [10]
                  : [],
          );
          expect(
            events
              .slice(0, unseal)
              .some((e) =>
                [
                  "wolf_tactical_order",
                  "wolf_discussion",
                  "wolf_discussion_ended",
                  "wolf_kill_vote_cast",
                  "mist_knife_drawn",
                ].includes(e.type),
              ),
          ).toBe(false);
          expect(
            events
              .slice(unseal + 1)
              .some(
                (e) =>
                  ["wolf_discussion", "wolf_discussion_ended", "wolf_kill_vote_cast"].includes(
                    e.type,
                  ) && e.day < events[unseal]!.day,
              ),
          ).toBe(false);
        }
        // 使用实际 owner 事件流，不把 God 身份／结果当作玩家私有知识。
        const replay: ReplayDocument = readReplayDocument({
          ...god,
          result: { winner: null, reason: "private_render" },
          players: god.players.map((p) => ({
            ...p,
            role: p.player_id === view.player_id ? view.role : "unknown",
            camp: p.player_id === view.player_id ? view.camp : "unknown",
          })),
          events: events.map((e, i) => ({ ...e, seq: i + 1 })),
        });
        const input = createReplayRenderInput(replay, { locale, timeZone: "Asia/Shanghai" });
        const frame = buildReplayFrame(input, 0);
        expect(frame.snapshot.players.find((p) => p.playerId === view.player_id)).toMatchObject({
          role: view.role,
          camp: view.camp,
        });
        expect(
          frame.snapshot.players
            .filter((p) => p.playerId !== view.player_id)
            .every((p) => p.role === "unknown" && p.camp === "unknown"),
        ).toBe(true);
        expect(frame.snapshot.decision).toBeNull();
        for (const e of input.replay.events.filter(
          (e) =>
            e.type.startsWith("alchemist_") ||
            e.type.startsWith("raven_") ||
            e.type === "mist_knife_drawn" ||
            e.type === "night_resolved",
        )) {
          const i = input.replay.events.findIndex((x) => x.seq === e.seq),
            f = buildReplayFrame(input, i * 90 + 45);
          expect(f.label).toBe(
            eventLabel(
              e,
              locale,
              undefined,
              input.replay.players.map((p) => ({ id: p.player_id, name: p.name })),
            ),
          );
          expect(
            f.snapshot.players
              .filter((p) => p.playerId !== view.player_id)
              .every((p) => p.role === "unknown" && p.camp === "unknown"),
          ).toBe(true);
          expect(renderToStaticMarkup(<ReplayFrame input={input} frame={i * 90 + 45} />)).toContain(
            f.label,
          );
          if (i > 0)
            expect(buildReplayFrame(input, i * 90 - 1).snapshot.players).toEqual(
              buildReplaySnapshot(input.replay, i - 1).players,
            );
          expect(buildReplayFrame(input, 0).snapshot.decision).toBeNull();
        }
        for (const e of replay.events.filter(
          (e) =>
            e.type.startsWith("alchemist_") ||
            e.type.startsWith("raven_") ||
            e.type === "mist_knife_drawn",
        ))
          expect(
            readReplayEvent(
              e,
              god.players.map((p) => p.player_id),
            ),
          ).not.toBeNull();
        expect(renderToStaticMarkup(<ReplayFrame input={input} frame={0} />)).not.toContain(
          "undefined",
        );
      });

for (const locale of ["en", "zh-CN"] as const)
  test(`Mist real bilingual target and knowledge labels/${locale}`, () => {
    const r = readReplayDocument(load(`mist-normal-linked-${locale}`, ".replay.json"));
    const unseal = r.events.find((e) => e.type === "raven_unsealed")!;
    expect(eventLabel(unseal, locale)).toBe(
      locale === "en"
        ? "Night 2: Raven 12 unsealed; known teammate snapshot: 5."
        : "第 2 夜，12 号狼鸦解封；已知队友快照：5。",
    );
    const snake = r.events.find((e) => e.type === "alchemist_snake_chosen" && e.day === 2)!;
    expect(eventLabel(snake, locale)).toBe(
      locale === "en"
        ? "Before night 2 settlement: player 1 chose Snake target: 4."
        : "第 2 夜结算前，1 号的法老之蛇选择：4。",
    );
  });
