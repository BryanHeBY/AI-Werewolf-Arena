/**
 * 单元测试持有旧私档元数据转换及错误版本／形状的严格拒绝。输入为每次新读的不可变公开本地化身份夹具；字面规范字段、用户／工具原文不变及来源零修改为预期。不写玩家档案。
 */
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";

import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayPlayerView, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";

async function legacy() {
  return JSON.parse(
    await readFile(
      path.resolve(
        PROJECT_ROOT,
        "packages/replay-contract/fixtures/board-unrecorded/legacy-player-view/locale-unrecorded/players/1-localized-role.player.json",
      ),
      "utf8",
    ),
  );
}

test("private record reader converts only metadata paths and leaves prompts/events/tool results original", async () => {
  const old = await legacy();
  const before = structuredClone(old);
  const current = readReplayPlayerView(old);
  expect(current.schemaVersion).toBe(2);
  expect(current.locale).toBeUndefined();
  expect(current.role).toBe("wolf");
  expect(current.camp).toBe("wolf");
  expect(current.initial_prompt?.phase).toBe("night");
  expect(current.initial_prompt?.stage).toBe("wolf_discussion");
  expect(current.timeline.map((entry) => [entry.phase, entry.stage])).toEqual([
    ["night", "wolf_discussion"],
    ["night", "wolf_discussion"],
    ["未知阶段", "未知技能"],
  ]);
  expect(current.initial_prompt?.prompt_system).toBe(old.initial_prompt.prompt_system);
  expect(current.timeline[0].kind === "event" && current.timeline[0].event).toEqual(
    old.timeline[0].event,
  );
  expect(current.timeline[1].kind === "turn" && current.timeline[1].delta_messages).toEqual(
    old.timeline[1].delta_messages,
  );
  expect(current.timeline[2].day).toBe(0); // 保留可诊断的历史异常。
  expect(old).toEqual(before);
  assertReplayPlayerView(current);
  expect(readReplayPlayerView(current)).toEqual(current);
  expect(readReplayPlayerView({ ...old, schemaVersion: 1 })).toEqual(current);
  const v2 = readReplayPlayerView({ ...old, schemaVersion: 2 });
  expect(v2.initial_prompt?.phase).toBe("夜晚");
});

test("private record versions and nested shapes fail explicitly", async () => {
  const old = await legacy();
  for (const version of [null, "2", 3])
    expect(() => readReplayPlayerView({ ...old, schemaVersion: version })).toThrow(
      "player.schemaVersion",
    );
  const mutate = (change: (value: any) => void) => {
    const value = structuredClone(old);
    change(value);
    expect(() => readReplayPlayerView(value)).toThrow("replay_document_invalid");
  };
  mutate((value) => {
    value.timeline[0].seq = 7;
  });
  mutate((value) => {
    value.timeline[0].event.payload = [];
  });
  mutate((value) => {
    value.timeline[1].delta_messages[0].content = 7;
  });
  mutate((value) => {
    value.locale = "en-US";
  });
  for (const version of [undefined, 2])
    for (const wrong of [["user"], { value: "user" }]) {
      mutate((value) => {
        value.schemaVersion = version;
        value.timeline[1].delta_messages[0].role = wrong;
      });
      mutate((value) => {
        value.schemaVersion = version;
        value.timeline[1].delta_messages[0].kind = Array.isArray(wrong)
          ? ["prompt"]
          : { value: "prompt" };
      });
    }
  mutate((value) => {
    value.timeline[1].turn_seq = 0;
  });
  mutate((value) => {
    value.initial_prompt.prompt_user = [7];
  });
});
