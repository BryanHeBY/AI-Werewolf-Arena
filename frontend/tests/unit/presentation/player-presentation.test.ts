/**
 * 单元测试负责玩家展示白名单、座次稳定映射与匿名降级。输入为手写非连续 ID、隐藏配置和未授权附加字段，输出独立预期的纯 JSON 名册。
 * 不读取或推断角色、模型、发言意图，不修改源昵称和玩家原话；拒绝错误映射而非静默重编号。
 */
import { expect, test } from "bun:test";
import { presentationPlayers, resolvePlayerPresentations } from "../../../src/presentation";

test("legacy IDs remain original numbers and private extras cannot promote role or avatar while explicit model stays public", () => {
  const sources = [
    {
      player_id: 9,
      name: "原名 {actor}",
      role: "wolf",
      model: "explicit-model",
      avatarKey: "openai",
    },
    { player_id: 3 },
  ];
  const before = structuredClone(sources);
  expect(resolvePlayerPresentations(sources)).toEqual([
    { playerId: 3, seat: 3, avatar: { kind: "symbol", key: "neutral" } },
    {
      playerId: 9,
      seat: 9,
      displayName: "原名 {actor}",
      modelLabel: "explicit-model",
      avatar: { kind: "symbol", key: "neutral" },
    },
  ]);
  expect(sources).toEqual(before);
});
test("explicit seat and public labels resolve once while hiding omits actual fields", () => {
  const sources = [
    { player_id: 10, seat: 2, name: "昵称" },
    { player_id: 20, seat: 1 },
  ];
  const players = resolvePlayerPresentations(sources, {
    players: {
      "10": { modelLabel: "Explicit model", avatarKey: "deepseek" },
      "20": { displayName: "第二位", showName: false },
    },
  });
  expect(players.map((player) => player.playerId)).toEqual([20, 10]);
  expect(players[0]).not.toHaveProperty("displayName");
  expect(presentationPlayers(players)).toEqual([
    { id: 20, seat: 1 },
    { id: 10, seat: 2, name: "昵称" },
  ]);
  expect(JSON.parse(JSON.stringify(players))).toEqual(players);
  expect(
    resolvePlayerPresentations(sources, {
      anonymous: true,
      players: { "10": { modelLabel: "Secret", avatarKey: "deepseek" } },
    }),
  ).toEqual([
    { playerId: 20, seat: 1, avatar: { kind: "symbol", key: "neutral" } },
    { playerId: 10, seat: 2, avatar: { kind: "symbol", key: "neutral" } },
  ]);
});
test("duplicate seats, unknown IDs and unauthorized presentation fields fail", () => {
  for (const config of [
    { players: { "99": {} } },
    { players: { "1": { seat: 2 } } },
    { players: { "1": { role: "seer" } } },
    { players: { "1": { avatarKey: "openai", avatarAssetId: "asset" } } },
  ])
    expect(() =>
      resolvePlayerPresentations([{ player_id: 1 }, { player_id: 2 }], config as never),
    ).toThrow("player_presentation_");
  expect(() =>
    resolvePlayerPresentations([{ player_id: 1, seat: 2 }], { players: { "1": { seat: 1 } } }),
  ).toThrow("player_presentation_seat_conflict");
});
