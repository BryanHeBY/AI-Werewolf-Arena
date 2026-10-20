/** 单元测试负责独立核对表单只改指定字段；输入含原生扩展、环境占位和两语指令的手写样本，预期保留其它原始数据。 */
import { expect, test } from "bun:test";
import { writePath } from "../../src/client/config-edit";
test("editing a seat leaves provider placeholders and native options untouched", () => {
  const raw = {
    agent: "pi",
    customInstructions: { text: { "zh-CN": "欢乐局", en: "Have fun" } },
    players: {
      "1": {
        name: "Cat",
        agent: "other",
        customInstructions: { mode: "replace", text: "Keep calm" },
      },
    },
    extension: { apiKey: "${KEY}", native: { arbitrary: [1, true, null] } },
  };
  const result = writePath(raw, "players.1.name", "Miao");
  expect(result).toEqual({ ...raw, players: { "1": { ...raw.players["1"], name: "Miao" } } });
  expect(raw.players["1"].name).toBe("Cat");
});
test("inheriting an agent deletes only its binding and keeps the seat name", () => {
  expect(
    writePath(
      { players: { "2": { name: "Nerd", agent: "pi", customInstructions: { mode: "clear" } } } },
      "players.2.agent",
      undefined,
    ),
  ).toEqual({ players: { "2": { name: "Nerd", customInstructions: { mode: "clear" } } } });
});
