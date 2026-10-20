/** 集成测试负责核对真实文件编辑的冲突、遮罩及路径边界；输入独立临时根和字面 JSON，预期拒绝外部改写且保留原认证。 */
import { afterEach, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigDocuments } from "../../src/server/config-documents";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function create() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-doc-"));
  roots.push(root);
  return { root, store: new ConfigDocuments(root) };
}
test("masked edit preserves secrets and environment placeholders without resolving them", async () => {
  const { root, store } = await create();
  await fs.mkdir(path.join(root, "runtime"));
  const original = {
    schemaVersion: 2,
    items: {
      pi: {
        kind: "pi",
        config: {
          auth: {
            openai: { type: "api_key", key: "private-value" },
            other: { type: "api_key", key: "${OTHER_KEY}" },
          },
        },
      },
    },
  };
  await fs.writeFile(path.join(root, "runtime/backends.json"), JSON.stringify(original));
  const doc = await store.read("backends", "backends");
  expect(doc.text).not.toContain("private-value");
  expect(doc.text).toContain("${OTHER_KEY}");
  const raw = JSON.parse(doc.text);
  raw.items.pi.limits = { maxConcurrentRequests: 3 };
  await store.save({ ...doc, text: JSON.stringify(raw) });
  expect(await store.raw("backends", "backends")).toEqual({
    ...original,
    items: { pi: { ...original.items.pi, limits: { maxConcurrentRequests: 3 } } },
  });
});
test("external edits and parallel saves are never silently overwritten", async () => {
  const { store } = await create();
  const first = await store.save({
    kind: "games",
    name: "one",
    revision: null,
    text: '{"board":"x"}',
  });
  const operations = await Promise.allSettled([
    store.save({ ...first, text: '{"board":"y"}' }),
    store.save({ ...first, text: '{"board":"z"}' }),
  ]);
  expect(operations.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(operations.filter((x) => x.status === "rejected")).toHaveLength(1);
  await expect(store.save(first)).rejects.toMatchObject({ code: "config_conflict" });
});
test("invalid names and symlinked roots cannot write outside the configuration root", async () => {
  const { root, store } = await create();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-outside-"));
  roots.push(outside);
  await expect(store.read("games", "../escape")).rejects.toMatchObject({
    code: "invalid_config_name",
  });
  await fs.symlink(outside, path.join(root, "games"));
  await expect(
    store.save({ kind: "games", name: "escape", revision: null, text: "{}" }),
  ).rejects.toMatchObject({ code: "symlink_not_allowed" });
  expect(await fs.readdir(outside)).toEqual([]);
});
