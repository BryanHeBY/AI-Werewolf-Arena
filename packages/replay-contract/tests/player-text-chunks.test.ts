/** 玩家录制分片以原文可还原和有效代理对不分离为准，不修改历史档案。 */
import { expect, test } from "bun:test";
import { PLAYER_RECORD_TEXT_LIMIT, splitPlayerRecordText } from "../src/player-text-chunks";

test("玩家档案分片保留边界 emoji、换行、空文本与完整尾部", () => {
  for (const source of ["", "a".repeat(7999) + "😀\r\n" + "尾".repeat(9000), "🙂".repeat(8001)]) {
    const chunks = splitPlayerRecordText(source);
    expect(chunks.join("")).toBe(source);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(PLAYER_RECORD_TEXT_LIMIT);
      expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/);
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]/);
    }
  }
});
