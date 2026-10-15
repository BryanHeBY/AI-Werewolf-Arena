/**
 * 单元组件测试验证混血儿私有选择与冻结胜利归属归档。输入为真实 fixture、两语和畸形字段／getter；
 * 输出以字面席位／胜者名单检查角色阵营不随归属改变、已死成员仍可获胜及安全拒绝，并核纯帧，不运行对局或模型。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import wolf from "../../../fixtures/six-player-hybrid-wolf-win/hybrid-wolf-win/en/god.replay.json";
import good from "../../../fixtures/six-player-hybrid-good-dead/hybrid-good-dead/en/god.replay.json";
import twelve from "../../../fixtures/twelve-player-hybrid-twelve-wolf-win/hybrid-twelve-wolf-win/en/god.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  for (const resolved of [false, true])
    test(`${locale}/${resolved}: real Hybrid God facts label secret affiliation without changing physical identity or life`, () => {
      const raw = structuredClone(wolf),
        before = structuredClone(raw),
        replay = readReplayDocument(raw),
        event = replay.events.find(
          (e) => e.type === (resolved ? "hybrid_affiliation_resolved" : "hybrid_exemplar_chosen"),
        )!,
        index = replay.events.indexOf(event);
      const previous = buildReplaySnapshot(replay, index - 1),
        snapshot = buildReplaySnapshot(replay, index);
      expect(snapshot.players).toEqual(previous.players);
      expect(snapshot.players.find((p) => p.playerId === 3)).toMatchObject({
        role: "hybrid",
        camp: "good",
        alive: true,
        isWinner: false,
      });
      expect(snapshot.decision).toBeNull();
      const label = resolved
        ? locale === "en"
          ? "God victory affiliation: player 3 chose player 1 on night 1; frozen affiliation: Werewolves."
          : "【上帝胜利归属】3号第1夜选择1号，冻结胜利归属：狼人。"
        : locale === "en"
          ? "Hybrid private choice: player 3 chose player 1 on night 1; faction and role remain unknown."
          : "【混血儿私有选择】3号第1夜选择1号为榜样，阵营与身份未知。";
      expect(eventLabel(event, locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      expect(buildReplayFrame(input, frame).stage).toBe(
        resolved
          ? locale === "en"
            ? "Victory affiliation"
            : "胜利归属"
          : locale === "en"
            ? "Exemplar choice"
            : "榜样选择",
      );
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(label);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      expect(raw).toEqual(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const [name, raw, id, winners, alive] of [
    ["wolf", wolf, 3, [1, 2, 3], [1, 2]],
    ["good", good, 3, [3, 4, 5, 6], [5]],
    ["twelve_wolf", twelve, 8, [1, 2, 3, 4, 8], [1, 2, 3, 4, 5, 6, 7, 9]],
  ] as const)
    test(`${locale}/${name}: exact terminal members include a dead Good Hybrid independently of role/camp`, () => {
      const replay = readReplayDocument(raw),
        final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([...alive]);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([...winners]);
      expect(final.players.find((p) => p.playerId === id)).toMatchObject({
        role: "hybrid",
        camp: "good",
        alive: false,
        isWinner: true,
      });
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = (input.replay.events.length - 1) * FRAMES_PER_EVENT + 10,
        markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(locale === "en" ? "Hybrid" : "混血儿");
      expect(markup.match(/data-testid="composition-winner"/g)).toHaveLength(winners.length);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: malformed or extra Hybrid fields cannot fabricate a faction choice or execute getters`, () => {
    const event = readReplayDocument(wolf).events.find(
        (e) => e.type === "hybrid_affiliation_resolved",
      )!,
      unknown = locale === "en" ? "Unknown" : "未知";
    for (const payload of [
      { ...event.payload, faction: "third_party" },
      { ...event.payload, day: 2 },
      { ...event.payload, actorId: 0 },
      { ...event.payload, targetId: 3 },
      { ...event.payload, targetId: 1.5 },
      { ...event.payload, role: "wolf" },
    ])
      expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    let reads = 0;
    const payload = { ...event.payload };
    Object.defineProperty(payload, "faction", {
      enumerable: true,
      get() {
        reads++;
        return "wolf";
      },
    });
    expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    expect(reads).toBe(0);
  });
