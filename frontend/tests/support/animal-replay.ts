/**
 * 为单元和浏览器集成测试提供动物梦境归档。输入为登记名称／后缀和玩家视角名；
 * 输出为新解析文件，或仅用该玩家导出事件构成的遮蔽画面。此支持层只拥有读取／样本选择，不调用生产可见性投影或游戏规则。
 */
import { frontendFixtureURL } from "./fixtures/manifest";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
export const animalNames = [
  "fox_beauty",
  "cat_badge",
  "puffer_knife",
  "pk",
  "last_chain",
  "full_retaliation",
] as const;
export const loadAnimal = (name: string, suffix: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}${suffix}`), "utf8"));
/** 遮蔽后的渲染输入只纳入该玩家实际导出的事件。 */
export function animalPrivateReplay(name: string, owner: string) {
  const god = readReplayDocument(loadAnimal(name, ".replay.json")),
    view = readReplayPlayerView(loadAnimal(`player-views/${name}-${owner}`, ".player.json"));
  return readReplayDocument({
    ...god,
    result: { winner: null, reason: "private_render" },
    players: god.players.map((p) => ({
      ...p,
      role: p.player_id === view.player_id ? view.role : "unknown",
      camp: p.player_id === view.player_id ? view.camp : "unknown",
    })),
    events: view.timeline
      .flatMap((row) =>
        row.kind === "event"
          ? [
              {
                seq: row.seq,
                timestamp: row.timestamp!,
                day: row.day,
                phase: row.phase,
                type: row.event.type,
                payload: row.event.payload,
              },
            ]
          : [],
      )
      .map((e, i) => ({ ...e, seq: i + 1 })),
  });
}
