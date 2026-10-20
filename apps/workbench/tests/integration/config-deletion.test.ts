/** 测试负责核对服务文件与身份边界；输入独立临时文件或字面数据，输出由手写独立预期断言。
 * 不读取用户配置与认证，不触碰真实录制或 output；字节预算用于验证分页成本。 */
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigDocuments } from "../../src/server/config-documents";
import { ConfigService } from "../../src/server/config-service";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-delete-config-"));
  const local = path.join(root, "local"),
    examples = path.join(root, "examples");
  for (const base of [local, examples])
    for (const part of ["boards", "games"])
      await fs.mkdir(path.join(base, part), { recursive: true });
  const documents = new ConfigDocuments(local);
  return { root, local, examples, documents, service: new ConfigService(documents, examples) };
}
test("board references block deletion, stale revisions conflict and removing local never modifies template", async () => {
  const f = await fixture();
  try {
    const template = '{"template":true}';
    await fs.writeFile(path.join(f.examples, "boards/board.json"), template);
    const board = await f.documents.save({
      kind: "boards",
      name: "board",
      revision: null,
      text: '{"local":true}',
    });
    const game = await f.documents.save({
      kind: "games",
      name: "game",
      revision: null,
      text: '{"board":" board "}',
    });
    await expect(f.service.delete("boards", "board", board.revision!)).rejects.toMatchObject({
      code: "board_in_use",
      references: ["game"],
    });
    await fs.writeFile(
      path.join(f.local, "games/game.json"),
      '{"board":"board","seed":"external"}',
    );
    await expect(f.service.delete("games", "game", game.revision!)).rejects.toMatchObject({
      code: "config_conflict",
    });
    const current = await f.documents.read("games", "game");
    await f.service.delete("games", "game", current.revision!);
    await f.service.delete("boards", "board", board.revision!);
    expect(await f.documents.list("games")).toEqual([]);
    expect(await f.documents.list("boards")).toEqual([]);
    expect(await fs.readFile(path.join(f.examples, "boards/board.json"), "utf8")).toBe(template);
    await expect(f.service.delete("boards", "board", board.revision!)).rejects.toMatchObject({
      code: "config_not_found",
    });
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("unreadable game references and linked configuration paths are rejected", async () => {
  const f = await fixture();
  try {
    const b = await f.documents.save({ kind: "boards", name: "board", revision: null, text: "{}" });
    await fs.writeFile(path.join(f.local, "games/broken.json"), "{");
    await expect(f.service.delete("boards", "board", b.revision!)).rejects.toMatchObject({
      code: "board_references_unreadable",
      references: ["broken"],
    });
    const outside = path.join(f.root, "outside.json");
    await fs.writeFile(outside, "keep");
    await fs.symlink(outside, path.join(f.local, "games/linked.json"));
    await expect(f.service.delete("games", "linked", "x")).rejects.toMatchObject({
      code: "symlink_not_allowed",
    });
    expect(await fs.readFile(outside, "utf8")).toBe("keep");
    await expect(f.service.delete("backends", "backends", "x")).rejects.toMatchObject({
      code: "delete_not_supported",
    });
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
test("default board references are included when a game omits its board", async () => {
  const f = await fixture();
  try {
    const b = await f.documents.save({
      kind: "boards",
      name: "six_player_mvp",
      revision: null,
      text: "{}",
    });
    await f.documents.save({ kind: "games", name: "defaults", revision: null, text: "{}" });
    await expect(f.service.delete("boards", "six_player_mvp", b.revision!)).rejects.toMatchObject({
      code: "board_in_use",
      references: ["defaults"],
    });
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
