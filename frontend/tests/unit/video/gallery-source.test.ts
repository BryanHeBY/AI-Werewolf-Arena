/**
 * 单元测试负责核对图库证据摘要确实覆盖源码、嵌套支持层和资产字节。输入为临时目录，输出确定性与空集拒绝断言。
 * 不启动浏览器、不以固定空hash冒充渲染证明；改动位图或文字任一字节都应令摘要变化。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { videoGallerySource } from "../../../scripts/gallery-source";
test("gallery digest includes nested support plus font and image bytes and rejects empty inventories", async () => {
  const root = await mkdtemp(
    path.resolve(import.meta.dir, "../../../../node_modules/.cache/gallery-source-"),
  );
  try {
    for (const scope of ["src", "scripts", "tests/support"])
      await mkdir(path.join(root, scope), { recursive: true });
    await expect(videoGallerySource(root)).rejects.toThrow("art_gallery_source_inventory_empty");
    await writeFile(path.join(root, "src/view.tsx"), "export const view=1");
    await writeFile(path.join(root, "src/hero.png"), new Uint8Array([1, 2, 3]));
    await writeFile(path.join(root, "src/font.woff2"), new Uint8Array([4, 5, 6]));
    await writeFile(path.join(root, "tests/support/case.ts"), "export const cases=[]");
    const first = await videoGallerySource(root);
    expect(first.sourceFileCount).toBe(4);
    expect(first.sourceDigest).not.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await videoGallerySource(root)).toEqual(first);
    await writeFile(path.join(root, "src/hero.png"), new Uint8Array([1, 2, 4]));
    expect((await videoGallerySource(root)).sourceDigest).not.toBe(first.sourceDigest);
    const shared = path.join(root, "external");
    await mkdir(shared);
    await writeFile(path.join(shared, "text.ts"), "export const label='first'");
    const withShared = await videoGallerySource(root, [shared]);
    expect(withShared.sourceFileCount).toBe(5);
    await writeFile(path.join(shared, "text.ts"), "export const label='second'");
    expect((await videoGallerySource(root, [shared])).sourceDigest).not.toBe(
      withShared.sourceDigest,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
