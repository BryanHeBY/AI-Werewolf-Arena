/**
 * 单元组件测试验证杠精六／十二人成功及平票归档。输入为已录翻牌和匿名聚合结果；
 * 输出检查翻牌保持存活、画面保留角色且字幕不泄露 voterId，归档及原断言为验收依据，不执行投票或真实对局。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
for (const size of [6, 12])
  for (const outcome of ["success", "tie"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${outcome}/${locale}: actual recorded flip keeps Debater alive and shared studio/video caption anonymous`, () => {
        const document = readReplayDocument(
            JSON.parse(
              readFileSync(
                frontendFixtureURL(
                  `frontend/tests/fixtures/debater-${size}-${outcome}.replay.json`,
                ),
                "utf8",
              ),
            ),
          ),
          before = JSON.stringify(document),
          index = document.events.findIndex((e) => e.type === "debater_revealed"),
          actor = document.events[index]!.payload.actorId,
          pre = buildReplaySnapshot(document, index - 1),
          post = buildReplaySnapshot(document, index);
        expect(pre.players.find((p) => p.playerId === actor)?.alive).toBe(true);
        expect(post.players.find((p) => p.playerId === actor)?.alive).toBe(true);
        expect(post.players.find((p) => p.playerId === actor)?.role).toBe("debater");
        const resultIndex = document.events.findIndex((e) => e.type === "debate_resolved"),
          result = document.events[resultIndex]!,
          input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
          frame = resultIndex * 90 + 15;
        expect(
          buildReplayFrame(input, frame).snapshot.players.find((p) => p.playerId === actor)?.alive,
        ).toBe(true);
        const label = eventLabel(
          result,
          locale,
          document.players.map((p) => p.player_id),
        );
        expect(label).not.toContain("voterId");
        expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
          locale === "en" ? "Debater" : "杠精",
        );
        expect(JSON.stringify(document)).toBe(before);
      });
