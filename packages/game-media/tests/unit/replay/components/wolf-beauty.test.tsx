/**
 * 单元组件测试验证狼美人梦保护与末神归档。输入为真实 fixture、两语和 null／未知原因变体；
 * 输出以字面死亡／胜者预期检查受保护生命、已死胜者及纯帧／markup，保原输入，不执行魅惑或判胜规则。
 */
import { withPlayerNames } from "../../../support/named-label-expectation";
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
import blocked from "../../../fixtures/six-player-wolf-beauty-night-dream-block/wolf-beauty-blocked/zh-CN/god.replay.json";
import lastGod from "../../../fixtures/six-player-wolf-beauty-last-god/wolf-beauty-last-god/zh-CN/god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const special of [false, true])
    test(`${locale}/${special}: actual Beauty protection/last-god archive keeps actual lives and dead winner membership in the pure frame`, () => {
      const raw = structuredClone(special ? lastGod : blocked);
      raw.meta.locale = locale;
      const before = structuredClone(raw),
        replay = readReplayDocument(raw);
      const index = replay.events.findIndex(
          (event) => event.type === (special ? "additional_deaths" : "charm_blocked"),
        ),
        snapshot = buildReplaySnapshot(replay, index);
      expect(
        snapshot.players.filter((player) => !player.alive).map((player) => player.playerId),
      ).toEqual(special ? [1, 2, 3] : [1, 6]);
      expect(snapshot.players.find((player) => player.playerId === 5)!.alive).toBe(true);
      expect(snapshot.decision).toBeNull();
      const label = special
        ? locale === "en"
          ? "Additional deaths: Player 2"
          : "追加死亡：2号"
        : locale === "en"
          ? "Dream protection blocks Wolf Beauty 1's night charm death of player 5"
          : "1号对5号的夜间魅惑牵连被梦保护阻止";
      expect(eventLabel(replay.events[index], locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame =
          input.replay.events.findIndex((event) => event.seq === replay.events[index].seq) *
            FRAMES_PER_EVENT +
          10;
      expect(buildReplayFrame(input, frame).label).toBe(
        withPlayerNames(label, input.replay.players, locale),
      );
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(
        special
          ? withPlayerNames(label, input.replay.players, locale)
          : locale === "en"
            ? "Dream protection blocks Wolf Beauty"
            : "夜间魅惑牵连被梦保护阻止",
      );
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      const final = buildReplaySnapshot(replay, replay.events.length - 1),
        outcome = final.decision?.outcome;
      if (outcome?.kind !== "victory") throw new Error("wolf_beauty_fixture_victory_missing");
      expect(outcome.winningPlayerIds).toEqual(special ? [1] : [3, 4, 5, 6]);
      expect(final.players.find((player) => player.playerId === 1)!.alive).toBe(false);
      expect(raw).toEqual(before);
      const choice = replay.events.find((event) => event.type === "charm_applied")!,
        nullChoice = { ...choice, payload: { actorId: 1, targetId: null, day: 1 } };
      expect(eventLabel(nullChoice, locale)).toBe(
        locale === "en"
          ? "Wolf Beauty 1 chooses charm target None on night 1"
          : "1号狼美人本夜魅惑目标：无（第1夜）",
      );
      if (!special)
        expect(
          eventLabel(
            { ...replay.events[index], payload: { actorId: 1, targetId: 5, reason: "unknown" } },
            locale,
          ),
        ).toBe(locale === "en" ? "Unknown" : "未知");
    });
