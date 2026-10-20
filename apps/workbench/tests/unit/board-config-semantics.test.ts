/**
 * 单元测试负责板子配置语义反例：用公开模板和真实解析器独立核对推荐默认、选项可用性与显式编辑后的运行值。
 * 不读取本地认证、不落盘、不执行模型或完整对局。
 */
import { expect, test } from "bun:test";
import { ActionWindow } from "@ai-werewolf-arena/game-contract";
import { parseBoardDefinition } from "@ai-werewolf-arena/game-runtime/config/board";
import { describeBoardRuleCatalog } from "@ai-werewolf-arena/game-runtime/config/rule-catalog";
import {
  applyBoardRuleEdit,
  type BoardCard,
  type JsonObject,
} from "@ai-werewolf-arena/workbench-contract";
import { boardLabel } from "@ai-werewolf-arena/game-text/workbench-board";
import { orderBoardTemplates } from "../../src/client/BoardExplorer";
import { boardRoleBrief } from "../../src/client/BoardRuleFields";
import { variantRuleSummary } from "../../src/client/board-summary";

async function board(id: string): Promise<JsonObject> {
  return Bun.file(new URL(`../../../../configs.example/boards/${id}.json`, import.meta.url)).json();
}
function card(raw: JsonObject): BoardCard {
  const parsed = parseBoardDefinition(raw).definition;
  return {
    id: parsed.id,
    size: parsed.board.size,
    roles: parsed.board.roleSetups,
    supported: true,
    source: "example",
    rules: raw.rules as JsonObject,
    mechanisms: raw.mechanisms as JsonObject,
    roleOptions: raw.roles as JsonObject,
  };
}

test("the standard roster recommends the standard single-window board rather than the shorter experimental ID", async () => {
  const cards = await Promise.all(
    ["twelve_player_windows", "twelve_player_standard", "awa_classic_pk_choice_12_v1"].map(
      async (id) => card(await board(id)),
    ),
  );
  expect(orderBoardTemplates(cards)[0].id).toBe("twelve_player_standard");
  expect(orderBoardTemplates(cards.reverse())[0].id).toBe("twelve_player_standard");
  expect(
    variantRuleSummary(
      cards.find((b) => b.id === "twelve_player_windows")!,
      cards,
      "zh-CN",
    ),
  ).toContain("高频自爆窗口");
});

test("the real animal preset restricts fixed choices while retaining both puffer variants", async () => {
  const raw = await board("twelve_player_animal_dream_wait_final");
  const snapshot = JSON.stringify(raw);
  const result = describeBoardRuleCatalog(raw);
  expect(result.diagnostics).toEqual([]);
  expect(result.constraints["mechanisms.sheriff.voteWeight"].fixed).toBe(true);
  expect(result.constraints["mechanisms.sheriff.enabled"].allowedValues).toEqual([true]);
  expect(result.constraints["roles.bear.signalPolicy"].allowedValues).toEqual([
    "netease_dawn_live_v1",
  ]);
  expect(result.constraints["roles.pufferfish.ballotPolicy"].allowedValues).toEqual([
    "awa_final_ballot_v1",
    "awa_first_ballot_v1",
  ]);
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].fixed).toBe(true);
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].allowedValues).toEqual([
    ["on_pre_election", "on_pre_vote"],
  ]);
  expect(JSON.stringify(raw)).toBe(snapshot);
});

test("missing bear parameters display the actual animal-board default rather than an unspecified policy", async () => {
  const raw = await board("twelve_player_animal_dream_wait_final");
  delete (raw.roles as JsonObject).bear;
  const result = describeBoardRuleCatalog(raw);
  expect((result.resolved!.roles as JsonObject).bear).toEqual({
    signalPolicy: "netease_dawn_live_v1",
  });
  expect(boardRoleBrief("bear", { signalPolicy: "netease_dawn_live_v1" }, "zh-CN")).toContain(
    "天亮完整死亡链后",
  );
  expect(boardRoleBrief("bear", { signalPolicy: "awa_night_open_v1" }, "zh-CN")).toContain(
    "入夜按座位环",
  );
  const ordinary = describeBoardRuleCatalog(await board("twelve_player_bear"));
  expect((ordinary.resolved!.roles as JsonObject).bear).toEqual({
    signalPolicy: "awa_night_open_v1",
  });
});

test("the standard board exposes configurable weight and self-destruct windows", async () => {
  const result = describeBoardRuleCatalog(await board("twelve_player_standard"));
  expect(result.constraints["mechanisms.sheriff.voteWeight"].fixed).toBe(false);
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].allowedValues).toContainEqual(
    [],
  );
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].allowedValues).toContainEqual(
    ["on_pre_vote", "on_per_speech_gap"],
  );
  expect(result.constraints["rules.hooks.onPreVote"]).toBeUndefined();
});

test("editing self-destruct windows synchronizes both enabled and disabled hooks without mutating the source", async () => {
  const raw = await board("twelve_player_windows");
  const next = applyBoardRuleEdit(raw, "mechanisms.selfDestruct.enabledWindows", ["on_pre_vote"]);
  expect((next.rules as JsonObject).hooks).toEqual({
    onDaybreak: false,
    onPreElection: false,
    onPreVote: true,
    onPerSpeechGap: false,
  });
  expect(parseBoardDefinition(next).config.selfDestruct!.enabledWindows).toEqual([
    ActionWindow.OnPreVote,
  ]);
  expect(((raw.rules as JsonObject).hooks as JsonObject).onPerSpeechGap).toBe(true);
  const disabled = applyBoardRuleEdit(next, "mechanisms.selfDestruct.enabledWindows", []);
  expect(parseBoardDefinition(disabled).config.selfDestruct!.enabledWindows).toEqual([]);
  expect(Object.values((disabled.rules as JsonObject).hooks as JsonObject)).toEqual([
    false,
    false,
    false,
    false,
  ]);
});

test("turning off an edited sheriff clears dependent settings and produces a valid board", async () => {
  let raw = await board("twelve_player_standard");
  raw = applyBoardRuleEdit(raw, "mechanisms.sheriff.voteWeight", 2);
  raw = applyBoardRuleEdit(
    raw,
    "mechanisms.sheriff.electionPolicy",
    "awa_nomination_offstage_pk_v1",
  );
  raw = applyBoardRuleEdit(raw, "mechanisms.sheriff.initialSeat", 3);
  const disabled = applyBoardRuleEdit(raw, "mechanisms.sheriff.enabled", false);
  expect((disabled.mechanisms as JsonObject).sheriff).toEqual({ enabled: false });
  expect(parseBoardDefinition(disabled).config.enableSheriff).toBe(false);
  const reopened = applyBoardRuleEdit(disabled, "mechanisms.sheriff.enabled", true);
  expect(parseBoardDefinition(reopened).config.sheriff?.voteWeight).toBe(1.5);
});

test("PK choices serialize their actual fixed tie outcome instead of retaining inactive min-ID settings", async () => {
  let raw = await board("twelve_player_standard");
  raw = applyBoardRuleEdit(
    raw,
    "mechanisms.sheriff.electionPolicy",
    "awa_nomination_offstage_pk_v1",
  );
  raw = applyBoardRuleEdit(raw, "mechanisms.voting.exilePolicy", "awa_one_pk_v1");
  expect(parseBoardDefinition(raw).config.tieBreaker).toMatchObject({
    sheriffVote: "no_elimination",
    exileVote: "no_elimination",
  });
  const result = describeBoardRuleCatalog(raw);
  expect(result.constraints["mechanisms.sheriff.tieBreaker"].allowedValues).toEqual([
    "no_elimination",
  ]);
  expect(result.constraints["mechanisms.tieBreaker.exileVote"].allowedValues).toEqual([
    "no_elimination",
  ]);
});

test("opening old PK JSON projects the actual tie outcome without altering the source document", async () => {
  const raw = await board("twelve_player_standard");
  const mechanisms = raw.mechanisms as JsonObject;
  (mechanisms.sheriff as JsonObject).electionPolicy = "awa_nomination_offstage_pk_v1";
  mechanisms.voting = { exilePolicy: "awa_one_pk_v1" };
  const source = JSON.stringify(raw);
  const result = describeBoardRuleCatalog(raw);
  const actual = result.resolved!.mechanisms as JsonObject;
  expect((actual.sheriff as JsonObject).tieBreaker).toBe("no_elimination");
  expect((actual.tieBreaker as JsonObject).exileVote).toBe("no_elimination");
  expect(result.constraints["mechanisms.sheriff.tieBreaker"].allowedValues).toEqual([
    "no_elimination",
  ]);
  expect(result.constraints["mechanisms.tieBreaker.exileVote"].allowedValues).toEqual([
    "no_elimination",
  ]);
  expect(JSON.stringify(raw)).toBe(source);
});

test("finite support stays enforced: the GUI reports mist-raven windows as fixed instead of relaxing runtime rules", async () => {
  const raw = await board("awa_mist_raven_12_v1");
  const result = describeBoardRuleCatalog(raw);
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].fixed).toBe(true);
  expect(result.constraints["mechanisms.selfDestruct.enabledWindows"].allowedValues).toEqual([
    ["on_pre_election", "on_daybreak", "on_per_speech_gap", "on_pre_vote"],
  ]);
  const unsupported = applyBoardRuleEdit(raw, "mechanisms.selfDestruct.enabledWindows", [
    "on_pre_vote",
  ]);
  expect(describeBoardRuleCatalog(unsupported).diagnostics).toEqual([
    { code: "board_config_mist_raven_preset_invalid", path: "board" },
  ]);
});

test("role descriptions and labels state the selected ballot and real badge succession rule in both languages", () => {
  expect(boardRoleBrief("pufferfish", { ballotPolicy: "awa_first_ballot_v1" }, "zh-CN")).toContain(
    "首轮投给自己",
  );
  expect(boardRoleBrief("pufferfish", { ballotPolicy: "awa_final_ballot_v1" }, "zh-CN")).toContain(
    "最后完成票轮",
  );
  expect(boardRoleBrief("pufferfish", { ballotPolicy: "awa_first_ballot_v1" }, "en")).toContain(
    "first ballot",
  );
  expect(boardLabel("zh-CN", "awa_next_seat_v1")).toContain("最小座位");
  expect(boardLabel("en", "awa_next_seat_v1")).toContain("Lowest eligible living seat");
  expect(boardLabel("zh-CN", "wallNotesHelp")).toContain("第一日正常放逐结束后");
  expect(boardLabel("zh-CN", "noExtraRules")).toBe("不开启");
});
