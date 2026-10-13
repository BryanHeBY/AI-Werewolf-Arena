/**
 * Filesystem catalog integration test checks maintained bilingual role labels and actual rule-card references. Inputs are public catalog entries and the referenced repository documents; nonempty names and exact file/anchor existence are the oracle. This adapter never executes a role rule or infers gameplay acceptance from documentation.
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
