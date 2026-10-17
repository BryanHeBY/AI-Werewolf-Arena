/**
 * 单元测试负责玩家录制分片的 Unicode 与长度边界。输入边界 emoji、换行、长尾及空文本；
 * 预期来自原文拼接等值与明确字符上限，不修改历史档案或使用生产分片结果生成预期。
 */
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
