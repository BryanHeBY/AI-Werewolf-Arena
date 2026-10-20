/**
 * 组件单元测试验证赠枪的复盘展示。输入为既有录制／字面量数据、事件游标、语言和帧设置；输出断言席位、时间线与渲染画面。手写可见性、状态及不变归档构成预期，不运行真实游戏或模型传输。
 */
import { withPlayerNames } from "../../../support/named-label-expectation";
import { expect, test } from "bun:test";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { deathAbilityEventLabel } from "@ai-werewolf-arena/game-presentation";
import { renderToStaticMarkup } from "react-dom/server";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, FRAMES_PER_EVENT } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import wolf from "../../../fixtures/controlled-gift-gun/gift-gun-last-wolf/en/god.replay.json";
import god from "../../../fixtures/controlled-gift-gun/gift-gun-last-god/en/god.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  for (const first of ["wolf", "god"] as const)
    test(`${locale}/${first}: actual controlled G02 gifts preserve original identity, commit both gun targets and only then show victory`, () => {
      const raw = structuredClone(first === "wolf" ? wolf : god),
        original = structuredClone(raw),
        replay = readReplayDocument(raw);
      const arm = replay.events.findIndex(
        (e) => e.type === "death_ability_changed" && e.payload.operation === "armed",
      );
      expect(arm).toBeGreaterThan(0);
      expect(buildReplaySnapshot(replay, arm).players).toEqual(
        buildReplaySnapshot(replay, arm - 1).players,
      );
      const label =
        locale === "en"
          ? "Player 2: gifted gun gift-gun:1, Armed."
          : "2号：赠枪gift-gun:1，已激活。";
      expect(eventLabel(replay.events[arm], locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame =
          input.replay.events.findIndex((e) => e.seq === replay.events[arm].seq) *
            FRAMES_PER_EVENT +
          10;
      expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
        withPlayerNames(label, input.replay.players, locale),
      );
      const native = replay.events.findIndex((e) => e.type === "hunter_shot"),
        gift = replay.events.findIndex((e) => e.type === "player_shot"),
        terminal = replay.events.findIndex((e) => e.type === "game_over");
      expect(native).toBeLessThan(gift);
      expect(gift).toBeLessThan(terminal);
      expect(buildReplaySnapshot(replay, native).decision).toBeNull();
      expect(buildReplaySnapshot(replay, gift).decision).toBeNull();
      expect(
        buildReplaySnapshot(replay, gift).players.find(
          (p) => p.playerId === Number(replay.events[gift].payload.targetId),
        )!.alive,
      ).toBe(false);
      const final = buildReplaySnapshot(replay, terminal);
      expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([4, 5, 6]);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([
        2, 3, 4, 5, 6,
      ]);
      expect(final.players[1]).toMatchObject({
        role: "hunter",
        camp: "good",
        alive: false,
        isWinner: true,
      });
      expect(raw).toEqual(original);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: malformed activated status cannot claim an unarmed gun and never invokes hostile getters`, () => {
    const payload = {
      actorId: 2,
      abilityId: "gift-gun:1",
      operation: "armed",
      grantedNight: 1,
      armedOnNight: null,
      remaining: 1,
      disabled: false,
      deathExpired: false,
    };
    expect(deathAbilityEventLabel("death_ability_changed", payload, locale)).toBe(
      text(locale, "replay.unknown"),
    );
    let reads = 0;
    Object.defineProperty(payload, "armedOnNight", {
      enumerable: true,
      get() {
        reads++;
        throw new Error("must_not_run");
      },
    });
    expect(deathAbilityEventLabel("death_ability_changed", payload, locale)).toBe(
      text(locale, "replay.unknown"),
    );
    expect(reads).toBe(0);
  });
