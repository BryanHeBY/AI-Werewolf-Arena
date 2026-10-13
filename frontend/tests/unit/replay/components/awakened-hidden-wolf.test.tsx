/**
 * 组件单元测试验证觉醒隐狼的复盘展示。输入为既有录制／字面量数据、事件游标、语言和帧设置；输出断言席位、时间线与渲染画面。手写可见性、状态及不变归档构成预期，不运行真实游戏或模型传输。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { awakenedEventLabel } from "@ai-werewolf-arena/game-presentation";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import twelve from "../../../fixtures/twelve-player-awakened-twelve/awakened-twelve/en/god.replay.json";
import guard from "../../../fixtures/six-player-awakened-guard/awakened-guard/en/god.replay.json";
import mirror from "../../../fixtures/six-player-awakened-mirror/awakened-mirror/en/god.replay.json";
import held from "../../../fixtures/six-player-awakened-extra-hold/awakened-extra-hold/en/god.replay.json";
import firstGun from "../../../fixtures/six-player-awakened-hunter-first/awakened-hunter-first/en/god.replay.json";

for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: actual Awakened learning and readiness retain the true Wolf seat without death or victory`, () => {
    const raw = structuredClone(twelve),
      before = structuredClone(raw),
      replay = readReplayDocument(raw);
    for (const type of ["awakened_mimicked", "awakened_ready"]) {
      const index = replay.events.findIndex((e) => e.type === type),
        event = replay.events[index];
      expect(buildReplaySnapshot(replay, index).players).toEqual(
        buildReplaySnapshot(replay, index - 1).players,
      );
      expect(
        buildReplaySnapshot(replay, index).players.find((p) => p.playerId === 1),
      ).toMatchObject({ role: "awakened_hidden_wolf", camp: "wolf", alive: true, isWinner: false });
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      const label = eventLabel(event, locale);
      expect(label).toContain(locale === "en" ? "Hunter" : "猎人");
      expect(buildReplayFrame(input, frame).label).toBe(label);
      expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
        label.replaceAll("'", "&#x27;"),
      );
    }
    expect(raw).toEqual(before);
  });

  test(`${locale}: actual copied inspection mask and protection choices do not overwrite God identities or prematurely kill`, () => {
    const replay = readReplayDocument(mirror),
      report = replay.events.findIndex(
        (e) => e.type === "role_inspected" && e.payload.targetId === 1,
      );
    expect(eventLabel(replay.events[report], locale)).toBe(
      locale === "en"
        ? "Player 3 inspects player 1's role: Mirror Girl"
        : "3号查验1号的具体角色：魔镜少女",
    );
    expect(buildReplaySnapshot(replay, report).players).toEqual(
      buildReplaySnapshot(replay, report - 1).players,
    );
    expect(buildReplaySnapshot(replay, report).players[0]).toMatchObject({
      role: "awakened_hidden_wolf",
      camp: "wolf",
    });
    const protectedReplay = readReplayDocument(guard);
    expect(
      protectedReplay.events
        .filter((e) => e.type === "awakened_guard_chosen")
        .map((e) => e.payload.targetId),
    ).toEqual([6, null, 6]);
    for (const event of protectedReplay.events.filter((e) => e.type === "awakened_guard_chosen")) {
      const i = protectedReplay.events.indexOf(event);
      expect(buildReplaySnapshot(protectedReplay, i).players).toEqual(
        buildReplaySnapshot(protectedReplay, i - 1).players,
      );
    }
    expect(
      protectedReplay.events
        .filter((e) => e.type === "night_resolved")
        .every((e) => (e.payload.deaths as number[]).length === 0),
    ).toBe(true);
  });

  test(`${locale}: actual copied gun and held extra knife settle before victory and retain dead faction winners`, () => {
    for (const raw of [twelve, firstGun]) {
      const replay = readReplayDocument(raw),
        shot = replay.events.findIndex((e) => e.type === "player_shot"),
        event = replay.events[shot],
        target = Number(event.payload.targetId);
      expect(
        buildReplaySnapshot(replay, shot - 1).players.find((p) => p.playerId === target)!.alive,
      ).toBe(true);
      expect(
        buildReplaySnapshot(replay, shot).players.find((p) => p.playerId === target)!.alive,
      ).toBe(false);
      expect(buildReplaySnapshot(replay, shot).decision).toBeNull();
      expect(eventLabel(event, locale)).toBe(
        locale === "en" ? `Player 1 shoots player ${target}` : `1号开枪带走${target}号`,
      );
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players[0]).toMatchObject({
        role: "awakened_hidden_wolf",
        camp: "wolf",
        alive: false,
        isWinner: false,
      });
    }
    const replay = readReplayDocument(held),
      choice = replay.events.findIndex(
        (e) => e.type === "awakened_attack_chosen" && e.payload.targetId === 6,
      );
    expect(buildReplaySnapshot(replay, choice).players.find((p) => p.playerId === 6)!.alive).toBe(
      true,
    );
    const final = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([1, 5]);
    expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([1, 2, 3]);
    expect(final.players[1]).toMatchObject({ alive: false, isWinner: true });
  });

  test(`${locale}: malformed Awakened labels use a safe unknown without executing getters`, () => {
    let reads = 0;
    const hostile = Object.defineProperty({ day: 1, targetId: 3, role: "hunter" }, "actorId", {
      enumerable: true,
      get() {
        reads++;
        throw new Error("must_not_execute");
      },
    });
    expect(awakenedEventLabel("awakened_mimicked", hostile, locale)).toBe(
      text(locale, "replay.unknown"),
    );
    expect(
      awakenedEventLabel(
        "awakened_ready",
        { actorId: 1, role: "hunter", activationNight: 1, activeFromNight: 1 },
        locale,
      ),
    ).toBe(text(locale, "replay.unknown"));
    expect(
      eventLabel({ type: "awakened_mimicked", payload: hostile } as unknown as ReplayEvent, locale),
    ).toBe(text(locale, "replay.unknown"));
    expect(reads).toBe(0);
  });
}
