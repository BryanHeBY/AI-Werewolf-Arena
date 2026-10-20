/**
 * 单元组件测试验证丘比特关系与阵营胜者的归档展示。输入为四类固定归档及畸形关系事实；
 * 手写胜者／存活数组是独立预期，输出据此核对终局、死亡与关系区分，并验证拒绝不留部分效果。
 * 帧／markup 是被测输出，不启动真实对局或模型。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { text } from "@ai-werewolf-arena/game-text";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { replayResultLabel } from "../../../../src/replay/replay-localization";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
const oracle = {
  mixed_netease: { winners: [1, 2, 3], alive: [1, 2, 3] },
  mixed_lui: { winners: [2, 3], alive: [2, 3] },
  root_hunter: { winners: [1, 2, 4, 5], alive: [4, 5] },
  dream_chain: { winners: [1, 2, 4, 5], alive: [5] },
};
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["mixed_netease", "mixed_lui", "root_hunter", "dream_chain"] as const)
    test(`${locale}/${kind}: actual Cupid archive/studio/video show chain-final relation or faction winners separately from survival`, () => {
      const document = readReplayDocument(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/cupid-${kind}.replay.json`),
              "utf8",
            ),
          ),
        ),
        before = JSON.stringify(document),
        terminal = document.events.length - 1;
      const early = buildReplaySnapshot(document, terminal - 1),
        final = buildReplaySnapshot(document, terminal);
      expect(early.players.filter((p) => p.isWinner)).toEqual([]);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(
        oracle[kind].winners,
      );
      expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual(
        oracle[kind].alive,
      );
      const label = replayResultLabel(document, locale);
      if (kind.startsWith("mixed_")) {
        expect(label).toContain(locale === "en" ? "Cupid lovers" : "丘比特情侣组");
        expect(label).not.toContain("cupid_lovers");
      }
      for (const event of document.events.filter((e) =>
        [
          "cupid_lovers_chosen",
          "lover_recognized",
          "cupid_relation_resolved",
          "lovers_death",
        ].includes(e.type),
      )) {
        expect(readReplayEvent(event, [1, 2, 3, 4, 5])).not.toBeNull();
        expect(eventLabel(event, locale, [1, 2, 3, 4, 5])).not.toBe(text(locale, "replay.unknown"));
      }
      const input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
        frame = terminal * 90 + 15;
      expect(
        buildReplayFrame(input, frame)
          .snapshot.players.filter((p) => p.isWinner)
          .map((p) => p.playerId),
      ).toEqual(oracle[kind].winners);
      expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
        locale === "en" ? "Cupid" : "丘比特",
      );
      expect(JSON.stringify(document)).toBe(before);
    });
test("Cupid known facts reject malformed/hidden-field envelopes without associations, partial labels or death effects", () => {
  const document = readReplayDocument(
    JSON.parse(
      readFileSync(
        frontendFixtureURL("frontend/tests/fixtures/cupid-mixed_netease.replay.json"),
        "utf8",
      ),
    ),
  );
  const base = document.events.find((event) => event.type === "lover_recognized")!;
  for (const payload of [
    { actorId: 2, partnerId: 3, pairCamps: ["good", "wolf"] },
    { actorId: 2, partnerId: 99 },
    { actorId: 2, partnerId: 2 },
  ])
    expect(readReplayEvent({ ...base, payload }, [1, 2, 3, 4, 5])).toBeNull();
  const choice = document.events.find((event) => event.type === "cupid_lovers_chosen")!;
  expect(
    readReplayEvent(
      { ...choice, payload: { actorId: 1, day: 1, pairIds: [2, 3, 5] } },
      [1, 2, 3, 4, 5],
    ),
  ).toBeNull();
  const relation = document.events.find((event) => event.type === "cupid_relation_resolved")!;
  expect(
    readReplayEvent(
      { ...relation, payload: { ...relation.payload, mixed: false } },
      [1, 2, 3, 4, 5],
    ),
  ).toBeNull();
  const death =
    document.events.find((event) => event.type === "lovers_death") ??
    ({ ...base, type: "lovers_death", payload: { actorId: 2, targetId: 3 } } as ReplayEvent);
  expect(readReplayEvent(death, [1, 2, 3, 4, 5])!.effects).toEqual([
    { kind: "deaths", playerIds: [3] },
  ]);
});
