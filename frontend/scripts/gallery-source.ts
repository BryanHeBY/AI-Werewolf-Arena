/**
 * 负责正式渲染图库的源码与素材指纹。输入为前端根目录和显式依赖目录，输出按相对路径稳定排序的字节摘要及文件数。
 * 显式逐目录扫描以避开含斜杠brace模式的空匹配；字体与位图同样入摘要，空集合必须失败而不是签发空SHA。
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function videoGallerySource(root: string, dependencyRoots: readonly string[] = []) {
  const files: string[] = [];
  for (const scope of ["src", "scripts", "tests/support"]
    .map((scope) => path.resolve(root, scope))
    .concat([...dependencyRoots]))
    for await (const file of new Bun.Glob("**/*").scan({
      cwd: scope,
      absolute: true,
      onlyFiles: true,
    }))
      if (/\.(?:ts|tsx|css|json|png|webp|woff2)$/.test(file)) files.push(file);
  if (!files.length) throw new Error("art_gallery_source_inventory_empty");
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(root, file));
    hash.update(await readFile(file));
  }
  return { sourceDigest: hash.digest("hex"), sourceFileCount: files.length };
}
