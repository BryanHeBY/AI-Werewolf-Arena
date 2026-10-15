/**
 * 文件系统 catalog 集成测试以公开词典项及其引用的仓库文档为输入，核对维护的双语身份名及真实规则卡引用。非空名称和精确文件／锚点存在为预期；不执行身份规则，也不从文档推断玩法准入。
 */
import { expect, test } from "bun:test";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("every catalog entry has bilingual labels and registered entries have rule cards", async () => {
  for (const entry of ROLE_DEFINITIONS) {
    expect(entry.names["zh-CN"].trim().length).toBeGreaterThan(0);
    expect(entry.names.en.trim().length).toBeGreaterThan(0);
    if (entry.status !== "verified" && entry.status !== "implemented") continue;
    expect(entry.ruleCardRef).not.toBeNull();
    const [file, anchor] = entry.ruleCardRef!.split("#");
    const text = await readFile(path.resolve(import.meta.dir, "../../../..", file), "utf8");
    if (anchor) expect(text).toContain(`## ${anchor}`);
    else expect(text.trimStart().startsWith("# ")).toBe(true);
  }
});
