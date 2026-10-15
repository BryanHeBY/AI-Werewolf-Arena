/**
 * 单元测试以字面保留前导标签及原文本为输入，用精确重复输出核对共享幂等发言清理规则，不改变普通发言。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { sanitizeSpeechText } from "../../../src/utils/speech-text";
test("speech cleaning is shared, repeatable and limited to reserved leading labels", () => {
  expect(sanitizeSpeechText(" [Judge]  Restart this ballot. ")).toBe("Restart this ballot.");
  expect(sanitizeSpeechText(" [系统] [God]  发言 ")).toBe("发言");
  expect(sanitizeSpeechText(" [judge] Another ")).toBe("Another");
  expect(sanitizeSpeechText("I said [God] hello.")).toBe("I said [God] hello.");
  expect(sanitizeSpeechText(" [God] ")).toBe("");
});
