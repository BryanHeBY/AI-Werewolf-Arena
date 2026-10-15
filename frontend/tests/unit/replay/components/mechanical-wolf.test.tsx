/**
 * 单元组件测试验证机械狼学习、反毒、守护失败和枪击归档。输入为真实 fixture、两语及畸形字段／getter；
 * 输出以字面事实、死亡／胜者名单检查选择与真实死亡分离、原角色保留及纯帧／markup，不运行学习、反射或模型。
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
import reflection from "../../../fixtures/six-player-mechanical-reflection/mechanical-reflection/zh-CN/god.replay.json";
import twelve from "../../../fixtures/twelve-player-mechanical-twelve/mechanical-twelve/en/god.replay.json";
import failure from "../../../fixtures/six-player-mechanical-guard-failure/mechanical-guard-failure/zh-CN/god.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["reflection", "mimic", "failure"] as const)
    test(`${locale}/${kind}: real mechanical choices and God facts change neither seat identity nor life before actual death`, () => {
      const raw = structuredClone(kind === "failure" ? failure : reflection),
        before = structuredClone(raw),
        replay = readReplayDocument(raw);
      const event =
        kind === "reflection"
          ? replay.events.find((e) => e.type === "mechanical_poison_reflected")!
          : kind === "mimic"
            ? replay.events.find((e) => e.type === "mechanical_mimicked")!
            : replay.events.find(
                (e) => e.type === "mechanical_guard_chosen" && e.payload.failed === true,
              )!;
      const index = replay.events.indexOf(event),
        previous = buildReplaySnapshot(replay, index - 1),
        snapshot = buildReplaySnapshot(replay, index);
      expect(snapshot.players).toEqual(previous.players);
      expect(snapshot.decision).toBeNull();
      expect(snapshot.players.find((p) => p.playerId === 1)!.role).toBe("mechanical_wolf");
      expect(snapshot.players.find((p) => p.playerId === 1)!.alive).toBe(true);
      const expected =
        kind === "reflection"
          ? locale === "en"
            ? "Mechanical reflection: on night 2, player 1 shielded player 3; poison returned to original caster 4."
            : "【机械反毒】第2夜，1号保护3号，毒返回原施毒者4号。"
          : kind === "mimic"
            ? locale === "en"
              ? "Mechanical Wolf player 1 learned player 5's Guard on night 1, effective night 2."
              : "【机械狼】1号第1夜学习5号的守卫，第2夜生效。"
            : locale === "en"
              ? "Mechanical guard: player 1 chose 3 on night 3; consecutive-guard penalty: Yes."
              : "【机械守护】1号第3夜选择3，连续守护判离：是。";
      expect(eventLabel(event, locale)).toBe(expected);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(expected);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(expected.replaceAll("'", "&#x27;"));
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      expect(raw).toEqual(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual inherited mechanical gun updates death before final victory and keeps the real role`, () => {
    const replay = readReplayDocument(twelve),
      event = replay.events.find((e) => e.type === "mechanical_shot")!,
      index = replay.events.indexOf(event),
      before = buildReplaySnapshot(replay, index - 1),
      after = buildReplaySnapshot(replay, index);
    expect(before.players.find((p) => p.playerId === 8)!.alive).toBe(true);
    expect(after.players.find((p) => p.playerId === 8)!.alive).toBe(false);
    expect(after.players.find((p) => p.playerId === 1)!.role).toBe("mechanical_wolf");
    expect(after.decision).toBeNull();
    expect(eventLabel(event, locale)).toBe(
      locale === "en"
        ? "Mechanical Wolf shot: player 1 hit player 8."
        : "【机械狼开枪】1号命中8号。",
    );
    const final = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([5, 10, 11, 12]);
    expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: malformed mechanical records stay Unknown without invoking accessors`, () => {
    const replay = readReplayDocument(reflection),
      event = replay.events.find((e) => e.type === "mechanical_mimicked")!,
      unknown = locale === "en" ? "Unknown" : "未知";
    for (const payload of [
      { ...event.payload, actorId: 0 },
      { ...event.payload, role: "invented_role" },
      { ...event.payload, readyOnNight: "2" },
      { ...event.payload, targetId: 1.5 },
    ])
      expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    let reads = 0;
    const payload = { ...event.payload };
    Object.defineProperty(payload, "role", {
      enumerable: true,
      get() {
        reads++;
        return "witch";
      },
    });
    expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    expect(reads).toBe(0);
  });
