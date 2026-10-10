import { expect, test } from "bun:test";
import { sanitizeSpeechText } from "../../../src/utils/speech_text";
test("speech cleaning is shared, repeatable and limited to reserved leading labels", () => {
  expect(sanitizeSpeechText(" [Judge]  Restart this ballot. ")).toBe("Restart this ballot.");
  expect(sanitizeSpeechText(" [系统] [God]  发言 ")).toBe("发言");
  expect(sanitizeSpeechText(" [judge] Another ")).toBe("Another");
  expect(sanitizeSpeechText("I said [God] hello.")).toBe("I said [God] hello.");
  expect(sanitizeSpeechText(" [God] ")).toBe("");
});
